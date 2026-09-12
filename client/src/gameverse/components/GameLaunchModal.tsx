"use client";

import React, { useEffect, useState } from "react";
import { soundEngine } from "../engine/SoundEngine";
import { getGameById } from "../engine/gameRegistry";
import { Play, Shield, Terminal, Zap, Crosshair } from "lucide-react";

interface GameLaunchModalProps {
  game: {
    id: string;
    title: string;
    category: string;
    description: string;
    icon: string;
  } | null;
  difficulty: string;
  onConfirmLaunch: () => void;
  onCancel: () => void;
}

export default function GameLaunchModal({ game, difficulty, onConfirmLaunch, onCancel }: GameLaunchModalProps) {
  const [step, setStep] = useState<"INIT" | "BRIEFING" | "READY">("INIT");

  useEffect(() => {
    if (game) {
      console.log(`[GAMEVERSE] Modal opened for game: ${game.title} (ID: ${game.id})`);
      setStep("INIT");
      soundEngine.playWhoosh();

      const t1 = setTimeout(() => setStep("BRIEFING"), 200);
      const t2 = setTimeout(() => setStep("READY"), 500);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [game]);

  if (!game) return null;

  const gameDef = getGameById(game.id);
  const controlsText = gameDef?.controls || "WASD / Mouse Controls";

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="bg-[#0b0f1d] border border-cyan-500/50 rounded-3xl p-6 max-w-md w-full shadow-[0_0_60px_rgba(0,240,255,0.25)] font-sans relative overflow-hidden">
        {/* Holographic Header */}
        <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-4">
          <div className="text-3xl p-2 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 shadow-[0_0_15px_#00f0ff]">
            {game.icon}
          </div>
          <div>
            <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-widest">
              MISSION BRIEFING • [{difficulty}]
            </span>
            <h3 className="text-base font-mono font-bold text-white uppercase">{game.title}</h3>
          </div>
        </div>

        {/* Dynamic Transition States */}
        <div className="space-y-4 font-mono text-xs">
          <div className="p-3 bg-black/50 border border-white/10 rounded-xl space-y-1 text-white/80">
            <div className="text-[10px] text-cyan-400 font-bold uppercase">OBJECTIVE SUMMARY:</div>
            <p className="text-xs font-sans text-white/70 leading-relaxed">{game.description}</p>
          </div>

          <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-xl space-y-1 text-cyan-300">
            <div className="text-[10px] font-bold uppercase flex items-center gap-1.5">
              <Crosshair size={12} /> CONTROLS DIAGRAM:
            </div>
            <div className="text-xs text-white/90 font-semibold">
              {controlsText}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/10">
          <button 
            onClick={onCancel}
            className="text-xs font-mono text-white/40 hover:text-white px-3 py-2 transition-colors"
          >
            ABORT MISSION
          </button>

          <button 
            onClick={() => {
              console.log(`[GAMEVERSE] Initiate Deployment clicked for: ${game.id}`);
              onConfirmLaunch();
            }}
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:shadow-[0_0_30px_rgba(0,240,255,0.6)] cursor-pointer"
          >
            <Play size={16} /> INITIATE DEPLOYMENT
          </button>
        </div>
      </div>
    </div>
  );
}
