"use client";

import React from "react";
import { Terminal, Cpu, CheckCircle2, ShieldAlert } from "lucide-react";

export type ToolLogItem = {
  id: string;
  toolName: string;
  args?: Record<string, unknown>;
  status: "EXECUTING" | "VERIFYING" | "COMPLETED" | "ERROR" | "SECURITY_HOLD";
  output?: string;
  timestamp: string;
};

interface ToolActivityFeedProps {
  logs: ToolLogItem[];
}

export default function ToolActivityFeed({ logs }: ToolActivityFeedProps) {
  if (logs.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-4 flex flex-col items-center justify-center text-center text-white/40 h-full">
        <Cpu size={28} className="text-cyan-500/30 mb-2" />
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-400/80">Tool Activity Feed</span>
        <p className="text-[11px] text-white/40 mt-1">Awaiting tool execution streams...</p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl p-4 flex flex-col h-full overflow-hidden border border-white/10">
      <div className="flex justify-between items-center pb-2 border-b border-white/10 mb-3">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-cyan-400" />
          <h3 className="text-xs font-mono font-bold tracking-[0.2em] uppercase text-cyan-300">
            Real-Time Tool Activity
          </h3>
        </div>
        <span className="text-[9px] font-mono text-cyan-400/70">{logs.length} EXECUTIONS</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {logs.map((log) => (
          <div
            key={log.id}
            className="p-3 rounded-xl bg-black/40 border border-white/5 font-mono text-xs text-white/80 space-y-1.5 transition-all hover:border-cyan-500/30"
          >
            <div className="flex justify-between items-center">
              <span className="text-cyan-400 font-semibold text-[11px] flex items-center gap-1.5">
                <Cpu size={12} className="text-cyan-400" />
                {log.toolName}
              </span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${log.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' :
                  log.status === 'EXECUTING' ? 'bg-amber-500/20 text-amber-400 animate-pulse' :
                    log.status === 'SECURITY_HOLD' ? 'bg-red-500/20 text-red-400' :
                      'bg-cyan-500/20 text-cyan-400'
                }`}>
                {log.status}
              </span>
            </div>

            {log.args && (
              <div className="text-[10px] text-white/50 bg-white/[0.02] p-1.5 rounded overflow-x-auto truncate">
                Args: {JSON.stringify(log.args)}
              </div>
            )}

            {log.output && (
              <div className="text-[11px] text-emerald-300/90 bg-emerald-950/20 p-2 rounded border border-emerald-500/10 max-h-24 overflow-y-auto whitespace-pre-wrap">
                {log.output}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
