"use client";

import React, { useState } from "react";
import JarvisOrb from "../JarvisOrb";
import HolographicReactor from "./HolographicReactor";
import { Eye, Layers, Sparkles } from "lucide-react";

interface JarvisVisualCoreProps {
  cognitiveState?: string;
  isListening?: boolean;
  isSpeaking?: boolean;
  audioLevel?: number;
  speechLevel?: number;
  emotion?: string;
  accentColor?: string;
  reactorProps?: {
    scale?: number;
    intensity?: number;
    spin?: number;
    style?: "ring" | "sphere" | "wire";
    visible?: boolean;
    orbitItems?: Array<{ id?: string; url: string; title?: string }>;
  };
}

export default function JarvisVisualCore({
  cognitiveState = "IDLE",
  isListening = false,
  isSpeaking = false,
  audioLevel = 0,
  speechLevel = 0,
  emotion = "neutral",
  accentColor,
  reactorProps = {}
}: JarvisVisualCoreProps) {
  const [renderMode, setRenderMode] = useState<"3D" | "2D">("3D");
  const [reducedMotion, setReducedMotion] = useState(false);

  if (reactorProps.visible === false) {
    return null;
  }

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Visual Core Display (3D Holographic Reactor or 2D Dynamic Orb) */}
      <div className="relative">
        {renderMode === "3D" ? (
          <HolographicReactor
            cognitiveState={cognitiveState}
            isListening={isListening}
            isSpeaking={isSpeaking}
            audioLevel={audioLevel}
            speechLevel={speechLevel}
            scale={reactorProps.scale ?? 1.0}
            intensity={reactorProps.intensity ?? 1.0}
            spin={reactorProps.spin ?? 1.0}
            style={reactorProps.style ?? "ring"}
            accentColor={accentColor}
            orbitItems={reactorProps.orbitItems ?? []}
            reducedMotion={reducedMotion}
          />
        ) : (
          <JarvisOrb
            cognitiveState={cognitiveState}
            isListening={isListening}
            isSpeaking={isSpeaking}
            audioLevel={audioLevel}
            speechLevel={speechLevel}
            emotion={emotion}
          />
        )}
      </div>

      {/* Subtle Mode Switcher Controls */}
      <div className="mt-2 flex items-center gap-2 px-3 py-1 bg-black/40 border border-cyan-500/20 rounded-full text-xs text-cyan-400/80 backdrop-blur-md">
        <button
          onClick={() => setRenderMode(prev => prev === "3D" ? "2D" : "3D")}
          className="flex items-center gap-1 hover:text-cyan-300 transition-colors"
          title="Toggle 3D Holographic Reactor / 2D Orb mode"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{renderMode === "3D" ? "3D Reactor" : "2D Orb"}</span>
        </button>
        <span className="text-cyan-500/30">|</span>
        <button
          onClick={() => setReducedMotion(prev => !prev)}
          className={`flex items-center gap-1 transition-colors ${reducedMotion ? 'text-amber-400' : 'hover:text-cyan-300'}`}
          title="Toggle reduced motion accessibility"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{reducedMotion ? "Motion: Min" : "Motion: Full"}</span>
        </button>
      </div>
    </div>
  );
}
