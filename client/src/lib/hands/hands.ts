"use client";

import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { OneEuroPoint } from "./oneEuro";
import { holdCamera, releaseCamera } from "../camera";

/**
 * JARVIS Real-Time Hand Tracking & Gesture Control Subsystem
 * Tracks hands via MediaPipe, filters landmarks with 1€ adaptive filtering,
 * synthesizes native PointerEvents (click, drag, scroll, resize), and visualizes skeleton.
 */

const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export const WRIST = 0;
const THUMB_MCP = 2;
export const THUMB_TIP = 4;
const INDEX_PIP = 6;
export const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_PIP = 10;
const MIDDLE_TIP = 12;
const RING_PIP = 14;
const RING_TIP = 16;
const PINKY_PIP = 18;
const PINKY_TIP = 20;

export const BONES: readonly [number, number][] = [
  // thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // middle
  [9, 10], [10, 11], [11, 12],
  // ring
  [13, 14], [14, 15], [15, 16],
  // pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // palm arch
  [5, 9], [9, 13], [13, 17],
];

export const TIPS = [THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP];

const CURSOR_MIN_CUTOFF = 1.1;
const CURSOR_BETA = 0.012;
const SKELETON_MIN_CUTOFF = 2.4;
const SKELETON_BETA = 0.02;

const PINCH_ON = 0.40;
const PINCH_OFF = 0.60;
const EXTEND_RATIO = 1.12;
const GESTURE_HOLD_MS = 200;
const PINCH_CONFIRM_MS = 70;
const POSE_SETTLE_MS = 220;
const CLICK_SLOP = 20;
const AIM_LAG_MS = 190;
const TRAIL_MS = 500;

export type Gesture = "point" | "pinch" | "frame" | "open" | "fist" | "peace" | "none";
export type Side = "left" | "right";

const SWAP_HANDEDNESS = false;
const MAX_JUMP_FRACTION = 0.28;

export interface Hand {
  id: number;
  points: { x: number; y: number }[];
  x: number;
  y: number;
  aimX: number;
  aimY: number;
  pinched: boolean;
  closeness: number;
  gesture: Gesture;
  fingers: {
    thumb: boolean;
    index: boolean;
    middle: boolean;
    ring: boolean;
    pinky: boolean;
  };
  handedness: Side;
  span: number;
}

export const hands: Hand[] = [];

export const handsDiag = {
  enabled: false,
  loading: false,
  ready: false,
  count: 0,
  fps: 0,
  gesture: "",
  lastError: "",
};

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__hands = handsDiag;
}

let landmarker: any = null;
let video: HTMLVideoElement | null = null;
let running = false;
let generation = 0;
let frames = 0;
let fpsAt = 0;
let stamp = 0;

type Filters = {
  cursor: OneEuroPoint;
  joints: OneEuroPoint[];
};

const filters = new Map<number, Filters>();
const trails = new Map<number, { x: number; y: number; at: number }[]>();
const pinchSince = new Map<number, number>();
const poseChangedAt = new Map<number, number>();
const sideVote = new Map<number, number>();
const settling = new Map<number, { raw: Gesture; since: number; held: Gesture }>();

function filtersFor(id: number): Filters {
  let f = filters.get(id);
  if (!f) {
    f = {
      cursor: new OneEuroPoint(CURSOR_MIN_CUTOFF, CURSOR_BETA),
      joints: Array.from({ length: 21 }, () => new OneEuroPoint(SKELETON_MIN_CUTOFF, SKELETON_BETA)),
    };
    filters.set(id, f);
  }
  return f;
}

let patched = false;
function patchPointerCapture() {
  if (patched || typeof Element === "undefined") return;
  patched = true;
  const capture = Element.prototype.setPointerCapture;
  const release = Element.prototype.releasePointerCapture;
  Element.prototype.setPointerCapture = function (id: number) {
    try {
      return capture.call(this, id);
    } catch (_) {}
  };
  Element.prototype.releasePointerCapture = function (id: number) {
    try {
      return release.call(this, id);
    } catch (_) {}
  };
}

type Press = {
  captured: Element | null;
  wasPinched: boolean;
  downX: number;
  downY: number;
};

const presses = new Map<number, Press>();

function fire(
  el: Element | null,
  type: string,
  h: Hand,
  pressed: boolean,
  at?: { x: number; y: number }
) {
  if (!el) return;
  const px = at?.x ?? h.x;
  const py = at?.y ?? h.y;
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: px,
      clientY: py,
      pointerId: 9000 + h.id,
      pointerType: "touch",
      isPrimary: h.id === 0,
      button: 0,
      buttons: pressed ? 1 : 0,
      width: 1,
      height: 1,
      pressure: pressed ? 0.5 : 0,
    })
  );
}

function releasePress(id: number, h: Hand) {
  const p = presses.get(id);
  if (!p || !p.wasPinched) return;
  if (p.captured) {
    fire(p.captured, "pointerup", h, false);
    fire(p.captured, "pointercancel", h, false);
  }
  p.wasPinched = false;
  p.captured = null;
}

function emit(h: Hand) {
  let p = presses.get(h.id);
  if (!p) {
    p = { captured: null, wasPinched: false, downX: h.x, downY: h.y };
    presses.set(h.id, p);
  }

  const over = document.elementFromPoint(h.x, h.y);

  if (h.pinched && !p.wasPinched) {
    const aim = { x: h.aimX, y: h.aimY };
    const target = document.elementFromPoint(aim.x, aim.y) ?? over;
    p.captured = target;
    p.downX = aim.x;
    p.downY = aim.y;
    fire(target, "pointerdown", h, true, aim);
  } else if (!h.pinched && p.wasPinched) {
    if (p.captured) {
      fire(p.captured, "pointerup", h, false);
      const moved = Math.hypot(h.x - p.downX, h.y - p.downY);
      if (moved < CLICK_SLOP) {
        p.captured.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            composed: true,
            clientX: h.x,
            clientY: h.y,
            button: 0,
          })
        );
      }
    }
    p.captured = null;
  } else if (p.wasPinched) {
    fire(p.captured ?? over, "pointermove", h, true);
  } else {
    fire(over, "pointermove", h, false);
  }

  p.wasPinched = h.pinched;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function slotFor(
  side: Side,
  wrist: { x: number; y: number },
  taken: Set<number>,
  reach: number
): number {
  let best = -1;
  let bestDist = Infinity;
  for (const h of hands) {
    if (taken.has(h.id) || !h.points?.[WRIST]) continue;
    const d = Math.hypot(h.points[WRIST].x - wrist.x, h.points[WRIST].y - wrist.y);
    if (d < bestDist) {
      bestDist = d;
      best = h.id;
    }
  }
  if (best !== -1 && bestDist < reach * MAX_JUMP_FRACTION) return best;

  const want = side === "right" ? 1 : 0;
  if (!taken.has(want)) return want;
  return want === 1 ? 0 : 1;
}

function votedSide(id: number, saw: Side): Side {
  const prev = sideVote.get(id) ?? (saw === "right" ? 1 : -1);
  const delta = saw === "right" ? 1 : -1;
  const next = Math.max(-5, Math.min(5, prev + delta));
  sideVote.set(id, next);
  return next >= 0 ? "right" : "left";
}

function classify(fingers: Hand["fingers"], pinched: boolean): Gesture {
  if (pinched) return "pinch";
  const { thumb, index, middle, ring, pinky } = fingers;
  const up = [thumb, index, middle, ring, pinky].filter(Boolean).length;
  if (index && middle && !ring && !pinky) return "peace";
  if (thumb && index && !middle && !ring && !pinky) return "frame";
  if (index && !middle && !ring && !pinky) return "point";
  if (up >= 4) return "open";
  if (up === 0) return "fist";
  return "none";
}

async function ensureModel() {
  if (landmarker) return landmarker;
  handsDiag.loading = true;
  try {
    const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
    landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    handsDiag.ready = true;
    return landmarker;
  } catch (err) {
    handsDiag.lastError = `GPU delegate failed (${(err as Error)?.message ?? err}); retrying CPU`;
    const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
    landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
      runningMode: "VIDEO",
      numHands: 2,
    });
    handsDiag.ready = true;
    return landmarker;
  } finally {
    handsDiag.loading = false;
  }
}

function dropHand(i: number) {
  const at = hands.findIndex((h) => h.id === i);
  if (at === -1) return;
  releasePress(i, hands[at]);
  hands.splice(at, 1);
  filters.get(i)?.cursor.reset();
  filters.get(i)?.joints.forEach((f) => f.reset());
  settling.delete(i);
  sideVote.delete(i);
  trails.delete(i);
  pinchSince.delete(i);
  poseChangedAt.delete(i);
}

function loop(mine: number) {
  if (!running || mine !== generation || !video || !landmarker) return;

  const now = performance.now();
  stamp += 1;

  let result;
  try {
    result = landmarker.detectForVideo(video, stamp);
  } catch (err) {
    handsDiag.lastError = String((err as Error)?.message ?? err);
    result = null;
  }

  const w = window.innerWidth;
  const h = window.innerHeight;
  const found = result?.landmarks ?? [];
  const labels = result?.handedness ?? [];
  handsDiag.count = found.length;
  const at = now / 1000;

  const seen = new Set<number>();

  for (let k = 0; k < found.length && k < 2; k++) {
    const marks = found[k];
    if (!marks || marks.length < 21) continue;

    const raw = labels[k]?.[0]?.categoryName ?? "";
    const named: Side = raw === "Right" ? "right" : "left";
    const side: Side = SWAP_HANDEDNESS ? (named === "right" ? "left" : "right") : named;

    const wristPx = { x: (1 - marks[WRIST].x) * w, y: marks[WRIST].y * h };
    const reach = Math.hypot(w, h);
    const i = slotFor(side, wristPx, seen, reach);
    seen.add(i);

    const f = filtersFor(i);
    const points = marks.map((m: any, j: number) =>
      f.joints[j].filter((1 - m.x) * w, m.y * h, at)
    );

    const span = dist(points[WRIST], points[MIDDLE_MCP]) || 1;
    const gap = dist(points[THUMB_TIP], points[INDEX_TIP]) / span;

    let hand = hands.find((q) => q.id === i);
    if (!hand) {
      hand = {
        id: i,
        points,
        x: points[INDEX_TIP].x,
        y: points[INDEX_TIP].y,
        aimX: points[INDEX_TIP].x,
        aimY: points[INDEX_TIP].y,
        pinched: false,
        closeness: 0,
        gesture: "none",
        fingers: { thumb: false, index: false, middle: false, ring: false, pinky: false },
        handedness: side,
        span,
      };
      hands.push(hand);
    }
    hand.points = points;
    hand.span = span;

    const wantsPinch = hand.pinched ? gap < PINCH_OFF : gap < PINCH_ON;
    if (wantsPinch && !hand.pinched) {
      pinchSince.set(i, pinchSince.get(i) ?? now);
    } else if (!wantsPinch) {
      pinchSince.delete(i);
    }
    const held = pinchSince.get(i);
    const settledLongEnough = now - (poseChangedAt.get(i) ?? 0) > POSE_SETTLE_MS;
    const pinched = hand.pinched
      ? wantsPinch
      : wantsPinch && held !== undefined && now - held >= PINCH_CONFIRM_MS && settledLongEnough;
    hand.closeness = Math.max(0, Math.min(1, 1 - (gap - PINCH_ON) / (PINCH_OFF - PINCH_ON)));

    const tip = points[INDEX_TIP];
    const aimed = f.cursor.filter(tip.x, tip.y, at);
    hand.x = aimed.x;
    hand.y = aimed.y;

    let trail = trails.get(i);
    if (!trail) {
      trail = [];
      trails.set(i, trail);
    }
    trail.push({ x: hand.x, y: hand.y, at: now });
    const trailCutoff = now - TRAIL_MS;
    while (trail.length && trail[0].at < trailCutoff) trail.shift();
    const aimTargetAt = now - AIM_LAG_MS;
    let aimPoint = trail[0];
    for (const step of trail) {
      if (step.at <= aimTargetAt) aimPoint = step;
      else break;
    }
    hand.aimX = aimPoint?.x ?? hand.x;
    hand.aimY = aimPoint?.y ?? hand.y;

    const wrist = points[WRIST];
    const isExtended = (tIdx: number, pIdx: number) =>
      dist(points[tIdx], wrist) > dist(points[pIdx], wrist) * EXTEND_RATIO;

    const nextFingers = {
      thumb: dist(points[THUMB_TIP], points[INDEX_PIP]) > span * 0.45,
      index: isExtended(INDEX_TIP, INDEX_PIP),
      middle: isExtended(MIDDLE_TIP, MIDDLE_PIP),
      ring: isExtended(RING_TIP, RING_PIP),
      pinky: isExtended(PINKY_TIP, PINKY_PIP),
    };
    hand.fingers = nextFingers;
    hand.handedness = votedSide(i, side);

    const rawG = classify(nextFingers, pinched);
    const prevG = hand.gesture;
    hand.gesture = rawG;
    if (rawG !== prevG) {
      poseChangedAt.set(i, now);
    }
    hand.pinched = pinched;

    emit(hand);
  }

  for (const id of [0, 1]) if (!seen.has(id)) dropHand(id);

  handsDiag.gesture = hands
    .map((q) => `${q.handedness === "right" ? "R" : "L"}:${q.gesture}`)
    .join(" + ");

  frames++;
  if (now - fpsAt > 1000) {
    handsDiag.fps = Math.round((frames * 1000) / (now - fpsAt));
    frames = 0;
    fpsAt = now;
  }

  schedule(mine);
}

function schedule(mine: number) {
  if (!video) return;
  if (typeof (video as any).requestVideoFrameCallback === "function") {
    (video as any).requestVideoFrameCallback(() => loop(mine));
  } else {
    requestAnimationFrame(() => loop(mine));
  }
}

export async function enableHands(): Promise<void> {
  if (running) return;
  patchPointerCapture();
  const mine = ++generation;
  try {
    video = await holdCamera();
    await ensureModel();
    running = true;
    handsDiag.enabled = true;
    fpsAt = performance.now();
    schedule(mine);
  } catch (err) {
    handsDiag.lastError = String((err as Error)?.message ?? err);
    disableHands();
    throw err;
  }
}

export function disableHands(): void {
  running = false;
  generation++;
  handsDiag.enabled = false;
  handsDiag.count = 0;
  handsDiag.fps = 0;
  handsDiag.gesture = "";
  for (const h of hands) releasePress(h.id, h);
  hands.length = 0;
  presses.clear();
  filters.clear();
  settling.clear();
  sideVote.clear();
  trails.clear();
  pinchSince.clear();
  poseChangedAt.clear();
  if (video) {
    video = null;
    releaseCamera();
  }
}

export function pinchCount(): number {
  return hands.filter((h) => h.pinched).length;
}

export const handsRunning = () => running;
