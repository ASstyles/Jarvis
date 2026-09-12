"use client";

import React from "react";
import { CheckCircle2, Clock, AlertTriangle, PlayCircle, Flag } from "lucide-react";

export type Subtask = {
  id: string;
  title: string;
  description: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "BLOCKED" | "SKIPPED";
  result?: string | null;
  agentType?: string;
  dependencies?: string[];
  priority?: string;
  error?: string | null;
};

export type Mission = {
  id: string;
  title: string;
  objective: string;
  status: "PENDING" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "FAILED" | "CANCELLED";
  progress: number;
  subtasks: Subtask[];
};

interface MissionTrackerProps {
  activeMission: Mission | null;
  missionsList: Mission[];
}

export default function MissionTracker({ activeMission, missionsList }: MissionTrackerProps) {
  if (!activeMission && missionsList.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-5 flex flex-col items-center justify-center text-center text-white/40 h-full">
        <Flag size={32} className="text-cyan-500/40 mb-3" />
        <h3 className="text-xs uppercase tracking-[0.2em] font-mono text-cyan-400">Mission Control</h3>
        <p className="text-xs text-white/40 mt-1">No active mission. Instruct JARVIS with an objective (e.g. &quot;Build portfolio website&quot;).</p>
      </div>
    );
  }

  const current = activeMission || missionsList[0];

  return (
    <div className="glass-panel rounded-2xl p-5 flex flex-col h-full overflow-hidden border border-cyan-500/20">
      {/* Header */}
      <div className="flex justify-between items-center pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Flag size={16} className="text-cyan-400" />
          <h3 className="text-xs font-mono font-bold tracking-[0.2em] uppercase text-cyan-300">
            Active Mission
          </h3>
        </div>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
          current?.status === 'COMPLETED' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' :
          current?.status === 'IN_PROGRESS' ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 animate-pulse' :
          'bg-white/5 border-white/10 text-white/60'
        }`}>
          {current?.status}
        </span>
      </div>

      {/* Title & Progress Bar */}
      <div className="mt-4">
        <h4 className="text-sm font-semibold text-white tracking-wide">{current?.title}</h4>
        <p className="text-xs text-white/60 mt-1 line-clamp-2">{current?.objective}</p>

        <div className="mt-3">
          <div className="flex justify-between items-center text-[10px] font-mono text-cyan-400 mb-1">
            <span>PROGRESS</span>
            <span>{current?.progress || 0}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-cyan-400 rounded-full transition-all duration-500 shadow-[0_0_10px_#00f0ff]" 
              style={{ width: `${current?.progress || 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Subtasks Graph */}
      <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-2">Milestones & Subtasks</div>
        {current?.subtasks?.map((task, idx) => (
          <div 
            key={task.id || idx}
            className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3 transition-colors hover:border-cyan-500/30"
          >
            {task.status === 'COMPLETED' && <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />}
            {task.status === 'IN_PROGRESS' && <PlayCircle size={16} className="text-cyan-400 flex-shrink-0 mt-0.5 animate-spin-slow" />}
            {task.status === 'PENDING' && <Clock size={16} className="text-white/30 flex-shrink-0 mt-0.5" />}
            {task.status === 'FAILED' && <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />}

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-white/90 truncate">{task.title}</span>
                <span className="text-[9px] font-mono text-white/40 uppercase">{task.status}</span>
              </div>
              {task.description && <p className="text-[11px] text-white/50 mt-0.5 line-clamp-1">{task.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
