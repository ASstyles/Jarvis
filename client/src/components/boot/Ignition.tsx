"use client";

import React from "react";

/**
 * Ignition Start Gate
 * Solves the browser autoplay/AudioContext policy: user must initiate audio interaction
 * via click, unmuting AudioContext, speech synthesis, and microphone pipelines.
 */

interface IgnitionProps {
  onStart: () => void;
  visible: boolean;
}

export default function Ignition({ onStart, visible }: IgnitionProps) {
  if (!visible) return null;

  return (
    <button className="ignition" onClick={onStart} aria-label="Initialize JARVIS">
      <span className="ignition-ring" />
      <span className="ignition-label">
        <span className="ignition-word">INITIALISE</span>
        <span className="ignition-sub">click to power up audio & neural systems</span>
      </span>
    </button>
  );
}
