"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { handsDiag } from "@/lib/hands/hands";

/**
 * JARVIS Gesture Guide HUD Card
 * Displays intuitive guidance on gesture interactions when tracking is active.
 */

const MOVES = [
  { gesture: "point", icon: "☝", does: "Aim pointer at buttons or blades" },
  { gesture: "pinch", icon: "🤏", does: "Pinch index + thumb to click or drag" },
  { gesture: "open", icon: "🖐", does: "Release drag / hover state" },
  { gesture: "peace", icon: "✌", does: "Two fingers vertical to scroll content" },
  { gesture: "frame", icon: "📐", does: "Two hand corners to resize blades" },
];

export default function GestureGuide({ live }: { live: boolean }) {
  const [show, setShow] = useState(false);
  const used = useRef(false);

  useEffect(() => {
    if (!live) {
      setShow(false);
      used.current = false;
      return;
    }
    setShow(true);

    const interval = setInterval(() => {
      if (used.current) return;
      if (handsDiag.gesture.includes("pinch")) {
        used.current = true;
        setTimeout(() => setShow(false), 2000);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [live]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="gguide"
          initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 8, filter: "blur(6px)" }}
          transition={{ duration: 0.3 }}
        >
          <div className="gguide-head text-cyan-400">HAND GESTURE CONTROL</div>
          {MOVES.map((m) => (
            <div key={m.gesture} className="gguide-row">
              <span className="gguide-icon">{m.icon}</span>
              <span className="gguide-name text-cyan-200">{m.gesture}</span>
              <span className="gguide-does text-slate-300">{m.does}</span>
            </div>
          ))}
          <div className="gguide-foot text-cyan-400/60">
            Pinch blade header to move · <kbd className="text-cyan-300 bg-cyan-950/60 px-1 rounded">G</kbd> to toggle
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
