"use client";

import React, { useEffect } from "react";
import { Trophy } from "lucide-react";

export type Achievement = {
  id: string;
  title: string;
  description: string;
  xp: number;
  icon?: string;
};

interface AchievementToastProps {
  achievement: Achievement | null;
  onClose: () => void;
}

export default function AchievementToast({ achievement, onClose }: AchievementToastProps) {
  useEffect(() => {
    if (achievement) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [achievement, onClose]);

  if (!achievement) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-bounce">
      <div className="bg-[#0f1424] border border-amber-500/50 rounded-2xl p-4 shadow-[0_0_30px_rgba(245,158,11,0.3)] flex items-center gap-3 font-sans max-w-sm">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center text-xl flex-shrink-0">
          {achievement.icon || "🏆"}
        </div>
        <div>
          <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest block">ACHIEVEMENT UNLOCKED!</span>
          <h4 className="text-xs font-bold text-white mt-0.5">{achievement.title}</h4>
          <p className="text-[11px] text-white/60 line-clamp-1">{achievement.description}</p>
        </div>
        <span className="text-xs font-mono font-bold text-amber-300 ml-auto bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
          +{achievement.xp} XP
        </span>
      </div>
    </div>
  );
}
