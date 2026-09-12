"use client";

import React from "react";
import { Award, Trophy, Shield, Zap, X, Star } from "lucide-react";

interface GamerProfileModalProps {
  isOpen: boolean;
  profile: {
    level: number;
    xp: number;
    nextLevelXp: number;
    gamesPlayed: number;
    totalScore: number;
    unlockedAchievements: string[];
  };
  onClose: () => void;
}

export default function GamerProfileModal({ isOpen, profile, onClose }: GamerProfileModalProps) {
  if (!isOpen) return null;

  const xpPct = Math.min(100, Math.round((profile.xp / profile.nextLevelXp) * 100));

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="bg-[#0b0f1d] border border-amber-500/40 rounded-3xl p-6 max-w-lg w-full shadow-[0_0_60px_rgba(245,158,11,0.2)] font-sans relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white p-1">
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center text-xl">
            👑
          </div>
          <div>
            <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-widest">CREATOR PROFILE</span>
            <h3 className="text-base font-mono font-bold text-white uppercase">JARVIS GAMER MATRIX</h3>
          </div>
        </div>

        <div className="space-y-4 font-mono text-xs">
          {/* Level & XP */}
          <div className="p-4 bg-black/50 border border-white/10 rounded-2xl space-y-2">
            <div className="flex justify-between items-center text-sm font-bold text-amber-300">
              <span>PLAYER LEVEL {profile.level}</span>
              <span className="text-xs text-white/60">{profile.xp} / {profile.nextLevelXp} XP</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 shadow-[0_0_10px_#f59e0b]" style={{ width: `${xpPct}%` }} />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
              <span className="text-[10px] text-white/40 uppercase">GAMES PLAYED</span>
              <div className="text-lg font-bold text-cyan-300 mt-1">{profile.gamesPlayed}</div>
            </div>
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
              <span className="text-[10px] text-white/40 uppercase">TOTAL CAREER SCORE</span>
              <div className="text-lg font-bold text-emerald-400 mt-1">{profile.totalScore.toLocaleString()} PTS</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
