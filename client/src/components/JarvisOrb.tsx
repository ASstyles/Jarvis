"use client";

import React from "react";

interface JarvisOrbProps {
  isListening?: boolean;
  isSpeaking?: boolean;
  speechLevel?: number;
  audioLevel?: number;
  emotion?: string;
  cognitiveState?: string;
}

export default function JarvisOrb({
  isListening = false,
  isSpeaking = false,
  speechLevel = 0,
  audioLevel = 0,
  emotion = "neutral",
  cognitiveState = "IDLE"
}: JarvisOrbProps) {
  // Determine color scheme based on cognitive states, voice state, and emotion
  const getColorScheme = () => {
    const state = cognitiveState.toUpperCase();
    const em = emotion.toLowerCase();

    // 1. Red Alert / Error State
    if (state === 'ERROR' || em.includes('red alert') || em.includes('critical warning')) {
      return {
        core: "bg-red-500 shadow-[0_0_90px_#ef4444]",
        ring1: "border-red-500/70 shadow-[0_0_35px_#ef4444]",
        ring2: "border-amber-500/50 shadow-[0_0_25px_#f59e0b]",
        badge: "text-red-400 bg-red-500/10 border-red-500/30",
        label: "RED ALERT"
      };
    }

    // 2. Speaking / Voice Waveform Active
    if (isSpeaking || state === 'SPEAKING' || state === 'RESPONDING') {
      return {
        core: "bg-cyan-400 shadow-[0_0_110px_#00f0ff]",
        ring1: "border-cyan-300/80 shadow-[0_0_45px_#00f0ff]",
        ring2: "border-emerald-400/60 shadow-[0_0_30px_#10b981]",
        badge: "text-cyan-300 bg-cyan-500/20 border-cyan-500/40",
        label: "SPEAKING..."
      };
    }

    // 3. Listening / Voice Input Active
    if (isListening || state === 'LISTENING') {
      return {
        core: "bg-cyan-300 shadow-[0_0_100px_#00f0ff]",
        ring1: "border-cyan-400 shadow-[0_0_40px_#00f0ff]",
        ring2: "border-blue-400 shadow-[0_0_30px_#60a5fa]",
        badge: "text-cyan-300 bg-cyan-500/20 border-cyan-500/40",
        label: "LISTENING..."
      };
    }

    // 4. Planning & Reasoning Matrix
    if (state === 'PLANNING' || state === 'THINKING' || em.includes('purple')) {
      return {
        core: "bg-purple-500 shadow-[0_0_90px_#a855f7]",
        ring1: "border-purple-400/70 shadow-[0_0_35px_#c084fc]",
        ring2: "border-indigo-400/50 shadow-[0_0_25px_#818cf8]",
        badge: "text-purple-300 bg-purple-500/10 border-purple-500/30",
        label: "THINKING & PLANNING"
      };
    }

    // 5. Executing Multi-Agent Pipeline
    if (state === 'EXECUTING' || em.includes('golden')) {
      return {
        core: "bg-amber-400 shadow-[0_0_90px_#f59e0b]",
        ring1: "border-amber-400/70 shadow-[0_0_35px_#fbbf24]",
        ring2: "border-cyan-400/50 shadow-[0_0_25px_#22d3ee]",
        badge: "text-amber-300 bg-amber-500/10 border-amber-500/30",
        label: "PARALLEL EXECUTION"
      };
    }

    // 6. Verifying & Quality Check
    if (state === 'VERIFYING') {
      return {
        core: "bg-teal-400 shadow-[0_0_90px_#14b8a6]",
        ring1: "border-teal-400/70 shadow-[0_0_35px_#2dd4bf]",
        ring2: "border-emerald-400/50 shadow-[0_0_25px_#34d399]",
        badge: "text-teal-300 bg-teal-500/10 border-teal-500/30",
        label: "VERIFYING RESULT"
      };
    }

    // 7. Waiting for Human Authorization
    if (state === 'WAITING' || em.includes('waiting')) {
      return {
        core: "bg-orange-500 shadow-[0_0_90px_#f97316]",
        ring1: "border-orange-400/70 shadow-[0_0_35px_#fb923c]",
        ring2: "border-yellow-400/50 shadow-[0_0_25px_#facc15]",
        badge: "text-orange-300 bg-orange-500/10 border-orange-500/30",
        label: "AWAITING CLEARANCE"
      };
    }

    // 8. Completed Mission
    if (state === 'COMPLETED' || em.includes('happy') || em.includes('stable')) {
      return {
        core: "bg-emerald-400 shadow-[0_0_90px_#10b981]",
        ring1: "border-emerald-400/70 shadow-[0_0_35px_#34d399]",
        ring2: "border-cyan-400/50 shadow-[0_0_25px_#22d3ee]",
        badge: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
        label: "MISSION COMPLETE"
      };
    }

    // 9. Understanding Directive
    if (state === 'UNDERSTANDING' || em.includes('blue analysis')) {
      return {
        core: "bg-blue-500 shadow-[0_0_90px_#3b82f6]",
        ring1: "border-blue-400/70 shadow-[0_0_35px_#60a5fa]",
        ring2: "border-cyan-400/50 shadow-[0_0_25px_#22d3ee]",
        badge: "text-blue-300 bg-blue-500/10 border-blue-500/30",
        label: "UNDERSTANDING"
      };
    }

    // 10. Default Idle Cybernetic State
    return {
      core: "bg-cyan-400 shadow-[0_0_90px_#00f0ff]",
      ring1: "border-cyan-400/60 shadow-[0_0_35px_#00f0ff]",
      ring2: "border-blue-500/40 shadow-[0_0_25px_#3b82f6]",
      badge: "text-cyan-300 bg-cyan-500/10 border-cyan-500/30",
      label: "SYSTEM ONLINE"
    };
  };

  const scheme = getColorScheme();
  const isActive = isListening || isSpeaking || ['THINKING', 'PLANNING', 'EXECUTING', 'VERIFYING', 'RECOVERING', 'UNDERSTANDING', 'SPEAKING'].includes(cognitiveState.toUpperCase());

  // Dynamic audio scale factor based on real-time speech/audio levels (0-100)
  const currentLevel = isSpeaking ? speechLevel : (isListening ? audioLevel : 0);
  const scaleMod = currentLevel > 0 ? (1 + (currentLevel / 100) * 0.18) : 1;

  return (
    <div className="relative flex items-center justify-center w-72 h-72 md:w-96 md:h-96 pointer-events-none select-none">
      {/* Outer Orbiting Ring 1 with Audio Scale Reactivity */}
      <div 
        style={{ transform: `scale(${scaleMod * (isActive ? 1.05 : 0.95)})` }}
        className={`absolute inset-0 rounded-full border border-dashed transition-all duration-300 ${scheme.ring1} ${isActive ? 'animate-spin-slow' : 'opacity-50'}`} 
      />

      {/* Counter-rotating Ring 2 */}
      <div 
        style={{ transform: `scale(${scaleMod * (isActive ? 1.0 : 0.9)})` }}
        className={`absolute inset-4 rounded-full border border-dotted transition-all duration-300 ${scheme.ring2} ${isActive ? 'animate-spin-reverse' : 'opacity-40'}`} 
      />

      {/* Audio Waveform Resonance Halo */}
      {(isSpeaking || isListening) && currentLevel > 15 && (
        <div 
          style={{ transform: `scale(${1 + (currentLevel / 100) * 0.35})` }}
          className="absolute inset-8 rounded-full border border-cyan-400/30 bg-cyan-400/5 blur-sm transition-transform duration-100 animate-pulse"
        />
      )}

      {/* Core Glowing Orb */}
      <div 
        style={{ transform: `scale(${scaleMod * (isActive ? 1.1 : 1.0)})` }}
        className={`w-32 h-32 md:w-44 md:h-44 rounded-full transition-all duration-300 ${scheme.core} ${isActive ? 'animate-pulse-glow' : 'opacity-90'}`} 
      />

      {/* Central Holographic HUD Text */}
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-[9px] tracking-[0.3em] font-mono text-white/70 uppercase font-semibold">
          JARVIS VOICE 2.0
        </span>
        <span className="text-xs tracking-[0.2em] font-mono text-white font-bold mt-1">
          {isSpeaking ? "SPEAKING" : (isListening ? "LISTENING" : cognitiveState)}
        </span>
        <span className={`text-[8px] font-mono px-2 py-0.5 rounded mt-1 border uppercase font-semibold ${scheme.badge}`}>
          {scheme.label}
        </span>
      </div>
    </div>
  );
}
