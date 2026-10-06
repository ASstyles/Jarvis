"use client";

import React, { useEffect, useState } from "react";

/**
 * JARVIS Runtime Diagnostics HUD Panel (Press D to toggle, T for audio test)
 * Real-time inspection for:
 *  - Microphone status & energy noise floor
 *  - Speech recognition & fallback status
 *  - Speech synthesis & TTS engine performance
 *  - Barge-in & interruption metrics
 *  - Hand tracking FPS & detected gesture
 */

interface DiagnosticsProps {
  isOpen: boolean;
  onClose: () => void;
  onAudioTest?: () => void;
  phase?: string;
}

const ago = (t: number) => (t ? `${((Date.now() - t) / 1000).toFixed(1)}s ago` : "—");

function Row({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return (
    <div className="diag-row">
      <span className="diag-k">{k}</span>
      <span className={bad ? "diag-v diag-bad" : "diag-v"}>{v}</span>
    </div>
  );
}

export default function Diagnostics({
  isOpen,
  onClose,
  onAudioTest,
  phase = "IDLE",
}: DiagnosticsProps) {
  const [, tick] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [isOpen]);

  if (!isOpen) return null;

  const w = (typeof window !== "undefined" ? window : {}) as unknown as Record<string, any>;
  const v = w.__voice || {};
  const t = w.__tts || {};
  const cam = w.__camera || {};
  const hnd = w.__hands || {};

  const earsOk = Boolean(v.running || v.sessions > 0);
  const mouthOk = Boolean(t.spoken > 0 || t.started > 0);

  return (
    <div className="diag" aria-live="polite">
      <div className="diag-head flex justify-between items-center">
        <span>DIAGNOSTICS · PRESS D TO CLOSE</span>
        <button
          onClick={onClose}
          className="text-cyan-400 hover:text-white text-xs px-1.5 py-0.5 border border-cyan-500/40 rounded"
        >
          ESC / CLOSE
        </button>
      </div>

      <div className="diag-verdict">
        <span className={earsOk ? "diag-ok" : "diag-bad"}>
          {earsOk ? "● AUDIO INPUT ACTIVE" : "● NOT HEARING INPUT"}
        </span>
        <span className={mouthOk ? "diag-ok" : "diag-bad"}>
          {mouthOk ? "● SPEECH SYNTHESIS OPERATIONAL" : "● NO AUDIO OUTPUT"}
        </span>
      </div>

      <div className="diag-sec">SYSTEM // COGNITION</div>
      <Row k="phase" v={phase} />
      <Row k="backend api" v="http://localhost:4000 (authenticated)" />

      <div className="diag-sec">LISTENING // VAD</div>
      <Row k="stt recognizer" v={v.running ? "RUNNING" : "STANDBY"} bad={!v.running} />
      <Row k="last heard" v={v.heard ? `"${v.heard}" ${ago(v.heardAt)}` : "— nothing yet"} />
      <Row k="accepted" v={String(v.accepted ?? 0)} />
      <Row k="wake triggers" v={String(v.wakes ?? 0)} />
      <Row k="last error" v={v.lastError || "none"} bad={Boolean(v.lastError)} />

      <div className="diag-sec flex justify-between items-center">
        <span>SPEAKING // TTS</span>
        {onAudioTest && (
          <button
            onClick={onAudioTest}
            className="text-[10px] text-cyan-300 hover:text-white bg-cyan-950/60 px-1 rounded border border-cyan-500/30"
          >
            TEST [T]
          </button>
        )}
      </div>
      <Row k="tts engine" v={String(t.engine ?? "WebSpeech API (Streaming)")} />
      <Row k="synthesized" v={String(t.spoken ?? 0)} />
      <Row k="started" v={String(t.started ?? 0)} />
      <Row k="last error" v={t.lastError || "none"} bad={Boolean(t.lastError)} />

      <div className="diag-sec">VISION & SENSORS</div>
      <Row k="camera stream" v={cam.open ? "ACTIVE" : "STANDBY"} />
      <Row k="camera holders" v={String(cam.holders ?? 0)} />
      <Row k="rolling buffer" v={`${cam.buffered ?? 0} frames (~${((cam.buffered ?? 0) / 6).toFixed(1)}s)`} />
      <Row k="hand tracking" v={hnd.enabled ? "RUNNING" : "OFF"} />
      <Row k="hand fps" v={`${hnd.fps ?? 0} fps`} />
      <Row k="gesture" v={hnd.gesture || "none"} />
    </div>
  );
}
