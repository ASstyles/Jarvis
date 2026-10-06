"use client";

import React, { useEffect, useRef } from "react";
import { BONES, INDEX_TIP, THUMB_TIP, TIPS, WRIST, hands, handsDiag } from "@/lib/hands/hands";

/**
 * JARVIS Holographic Hand Skeleton & Cursor Overlay
 * High-performance 2D Canvas rendering for tracked hand landmarks and pinch cursors.
 */

const GLOW_WIDTH = 7;
const LINE_WIDTH = 2;

export default function Pointer() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;

    const fit = () => {
      const nw = window.innerWidth;
      const nh = window.innerHeight;
      const ndpr = Math.min(window.devicePixelRatio || 1, 2);
      if (!nw || !nh) return false;
      if (nw === w && nh === h && ndpr === dpr) return true;
      w = nw;
      h = nh;
      dpr = ndpr;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    };

    const accent = "#00f0ff";

    const draw = () => {
      raf.current = requestAnimationFrame(draw);
      if (!fit()) return;
      ctx.clearRect(0, 0, w, h);
      if (!handsDiag.enabled || !hands.length) return;

      for (const hand of hands) {
        const p = hand.points;
        if (!p || p.length < 21) continue;

        const scale = Math.max(0.6, Math.min(2.2, hand.span / 90));
        const lit = hand.pinched ? 1 : 0.82 + hand.closeness * 0.18;

        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Soft glow pass for bones
        ctx.globalAlpha = 0.35 * lit;
        ctx.strokeStyle = accent;
        ctx.lineWidth = GLOW_WIDTH * scale;
        ctx.beginPath();
        for (const [a, b] of BONES) {
          ctx.moveTo(p[a].x, p[a].y);
          ctx.lineTo(p[b].x, p[b].y);
        }
        ctx.stroke();

        // Sharp bright bone line
        ctx.globalAlpha = 0.9 * lit;
        ctx.strokeStyle = "#e6ffff";
        ctx.lineWidth = LINE_WIDTH * scale;
        ctx.stroke();

        // Joint nodes
        ctx.fillStyle = accent;
        for (let j = 0; j < 21; j++) {
          const r = (TIPS.includes(j) ? 3.5 : 2.0) * scale;
          ctx.beginPath();
          ctx.arc(p[j].x, p[j].y, r, 0, Math.PI * 2);
          ctx.fill();
        }

        // Index Fingertip Cursor Target Reticle
        const tip = p[INDEX_TIP];
        const cursorRadius = hand.pinched ? 8 * scale : 14 * scale;

        ctx.beginPath();
        ctx.arc(tip.x, tip.y, cursorRadius, 0, Math.PI * 2);
        ctx.strokeStyle = hand.pinched ? "#10b981" : accent;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (hand.pinched) {
          ctx.fillStyle = "rgba(16, 185, 129, 0.4)";
          ctx.fill();
        }
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(raf.current);
    };
  }, []);

  return <canvas ref={canvas} className="hands-canvas" />;
}
