"use client";

import React, { useState, useEffect } from "react";
import { Activity, Play, Pause, XCircle, RotateCcw, CheckCircle2, AlertCircle, Clock, ShieldCheck, Cpu, ArrowRight } from "lucide-react";
import { Mission } from "./MissionTracker";

export interface BackgroundTask {
  id: string;
  type: string;
  title: string;
  status: "QUEUED" | "RUNNING" | "PAUSED" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMEOUT";
  progress: number;
  progressMessage?: string;
  result?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

interface MissionControlProps {
  activeMission: Mission | null;
  missionsList: Mission[];
  autonomyScore: number;
  onRefresh?: () => void;
}

export default function MissionControl({ activeMission, missionsList, autonomyScore, onRefresh }: MissionControlProps) {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTasks = async () => {
    try {
      const res = await fetch("http://localhost:4000/api/tasks");
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleTaskAction = async (taskId: string, action: string) => {
    setLoading(true);
    try {
      await fetch(`http://localhost:4000/api/tasks/${taskId}/${action}`, { method: "POST" });
      await fetchTasks();
    } catch (_) {}
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "RUNNING":
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 animate-pulse">RUNNING</span>;
      case "COMPLETED":
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">COMPLETED</span>;
      case "PAUSED":
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-400 border border-amber-500/40">PAUSED</span>;
      case "FAILED":
      case "TIMEOUT":
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-500/20 text-red-400 border border-red-500/40">FAILED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 text-white/60">QUEUED</span>;
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 overflow-y-auto pr-1">
      {/* Top Telemetry Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-shrink-0">
        <div className="glass-panel p-4 rounded-2xl border border-cyan-500/20 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-white/50 font-mono">
            <span>AUTONOMY SCORE</span>
            <ShieldCheck size={16} className="text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold text-cyan-300">{autonomyScore}</span>
            <span className="text-xs text-white/40 font-mono">/ 100</span>
          </div>
          <div className="w-full bg-white/5 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-cyan-400 h-full rounded-full transition-all duration-500" style={{ width: `${autonomyScore}%` }} />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-white/50 font-mono">
            <span>ACTIVE MISSIONS</span>
            <Activity size={16} className="text-amber-400" />
          </div>
          <div className="mt-2 text-3xl font-mono font-bold text-amber-300">
            {missionsList.filter(m => m.status === 'IN_PROGRESS').length}
          </div>
          <span className="text-[10px] font-mono text-white/40">Total Executed: {missionsList.length}</span>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-white/50 font-mono">
            <span>BACKGROUND WORKERS</span>
            <Cpu size={16} className="text-purple-400" />
          </div>
          <div className="mt-2 text-3xl font-mono font-bold text-purple-300">
            {tasks.filter(t => t.status === 'RUNNING').length}
          </div>
          <span className="text-[10px] font-mono text-white/40">Active Worker Threads</span>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-white/50 font-mono">
            <span>MULTI-AGENT HEALTH</span>
            <CheckCircle2 size={16} className="text-emerald-400" />
          </div>
          <div className="mt-2 text-3xl font-mono font-bold text-emerald-300">
            99.2%
          </div>
          <span className="text-[10px] font-mono text-white/40">Zero Critical Failures</span>
        </div>
      </div>

      {/* Main Mission & DAG Dependency View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[400px]">
        {/* Left: Active Mission Subtask Graph */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h2 className="text-xs font-mono font-bold tracking-wider text-cyan-300 uppercase flex items-center gap-2">
              <Activity size={16} className="text-cyan-400" /> Goal Autopilot Execution Graph
            </h2>
            {activeMission && (
              <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                {activeMission.progress}% PROGRESS
              </span>
            )}
          </div>

          {activeMission ? (
            <div className="flex-1 overflow-y-auto mt-4 space-y-3">
              <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                <h3 className="font-semibold text-sm text-white">{activeMission.title}</h3>
                <p className="text-xs text-white/60 mt-1">{activeMission.objective}</p>
              </div>

              <div className="space-y-2 mt-4">
                <span className="text-[10px] font-mono uppercase text-white/40 tracking-wider">Subtask DAG Workflow:</span>
                {activeMission.subtasks.map((st, idx) => (
                  <div key={st.id || idx} className="p-3 bg-black/40 rounded-xl border border-white/10 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {st.status === 'COMPLETED' ? (
                          <CheckCircle2 size={16} className="text-emerald-400" />
                        ) : st.status === 'IN_PROGRESS' ? (
                          <Clock size={16} className="text-cyan-400 animate-spin" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-white/30 flex items-center justify-center text-[9px] font-mono text-white/50">
                            {idx + 1}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-white">{st.title}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/60 border border-white/10 uppercase">
                            {st.agentType || 'General'}
                          </span>
                        </div>
                        {st.description && <p className="text-[11px] text-white/50 mt-0.5">{st.description}</p>}
                        {st.result && <p className="text-[11px] text-emerald-400/90 mt-1 font-mono bg-emerald-500/10 p-1.5 rounded border border-emerald-500/20">{st.result}</p>}
                      </div>
                    </div>
                    {getStatusBadge(st.status)}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-white/40 font-mono text-xs text-center p-6">
              <Activity size={32} className="mb-2 opacity-40 text-cyan-400" />
              No active mission executing. Provide a goal to JARVIS to trigger autonomous decomposition.
            </div>
          )}
        </div>

        {/* Right: Background Task Queue & Worker Controls */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h2 className="text-xs font-mono font-bold tracking-wider text-purple-300 uppercase flex items-center gap-2">
              <Cpu size={16} className="text-purple-400" /> Long-Running Background Tasks
            </h2>
            <span className="text-[10px] font-mono text-white/40">{tasks.length} Persistent Tasks</span>
          </div>

          <div className="flex-1 overflow-y-auto mt-4 space-y-3">
            {tasks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-white/40 font-mono text-xs text-center p-6">
                <Cpu size={32} className="mb-2 opacity-40 text-purple-400" />
                No background tasks in queue.
              </div>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="p-3 bg-black/40 rounded-xl border border-white/10 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white">{task.title}</span>
                      <span className="text-[9px] font-mono text-white/40">[{task.type}]</span>
                    </div>
                    {getStatusBadge(task.status)}
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${task.status === 'FAILED' ? 'bg-red-500' : task.status === 'COMPLETED' ? 'bg-emerald-400' : 'bg-purple-400'}`} 
                      style={{ width: `${task.progress}%` }} 
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-white/50">
                    <span>{task.progressMessage || `${task.progress}% complete`}</span>
                    <div className="flex items-center gap-1">
                      {task.status === 'RUNNING' && (
                        <button onClick={() => handleTaskAction(task.id, 'pause')} className="p-1 hover:text-amber-300 transition-colors" title="Pause">
                          <Pause size={12} />
                        </button>
                      )}
                      {task.status === 'PAUSED' && (
                        <button onClick={() => handleTaskAction(task.id, 'resume')} className="p-1 hover:text-cyan-300 transition-colors" title="Resume">
                          <Play size={12} />
                        </button>
                      )}
                      {['QUEUED', 'RUNNING', 'PAUSED'].includes(task.status) && (
                        <button onClick={() => handleTaskAction(task.id, 'cancel')} className="p-1 hover:text-red-400 transition-colors" title="Cancel">
                          <XCircle size={12} />
                        </button>
                      )}
                      {['FAILED', 'CANCELLED', 'TIMEOUT'].includes(task.status) && (
                        <button onClick={() => handleTaskAction(task.id, 'retry')} className="p-1 hover:text-cyan-300 transition-colors" title="Retry">
                          <RotateCcw size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
