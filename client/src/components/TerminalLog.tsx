"use client";

import React, { useState, useEffect, useRef } from "react";
import { Terminal as TerminalIcon } from "lucide-react";

export type LogEntry = {
  id: string;
  type: "system" | "user" | "ai" | "tool";
  text: string;
  timestamp?: string;
};

interface TerminalLogProps {
  logs: LogEntry[];
}

export default function TerminalLog({ logs }: TerminalLogProps) {
  const [filter, setFilter] = useState<"all" | "system" | "user" | "ai" | "tool">("all");
  const bottomRef = useRef<HTMLDivElement>(null);

  const filteredLogs = logs.filter(l => filter === "all" || l.type === filter);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, filter]);

  return (
    <div className="glass-panel rounded-2xl p-4 flex flex-col h-full overflow-hidden border border-white/10 font-mono text-xs">
      {/* Header */}
      <div className="flex justify-between items-center pb-2 border-b border-white/10 mb-2">
        <div className="flex items-center gap-2">
          <TerminalIcon size={14} className="text-cyan-400" />
          <span className="font-bold tracking-widest text-cyan-300 text-[11px] uppercase">Neural Event Stream</span>
        </div>
        
        {/* Filter Tabs */}
        <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-white/5 text-[9px]">
          {(["all", "system", "user", "ai", "tool"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded uppercase font-semibold transition-colors ${
                filter === f ? 'bg-cyan-500/30 text-cyan-300' : 'text-white/40 hover:text-white/70'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Log Output Stream */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[11px]">
        {filteredLogs.map((log) => {
          let badgeColor = "text-cyan-400 border-cyan-500/30 bg-cyan-500/10";
          let prefix = "[SYS]";

          if (log.type === "user") {
            badgeColor = "text-amber-400 border-amber-500/30 bg-amber-500/10";
            prefix = "[USER]";
          } else if (log.type === "ai") {
            badgeColor = "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
            prefix = "[JARVIS]";
          } else if (log.type === "tool") {
            badgeColor = "text-purple-400 border-purple-500/30 bg-purple-500/10";
            prefix = "[TOOL]";
          }

          return (
            <div key={log.id} className="leading-relaxed flex items-start gap-2">
              <span className={`px-1.5 py-0.5 text-[9px] rounded border ${badgeColor} flex-shrink-0 font-bold`}>
                {prefix}
              </span>
              <span className="text-white/80 whitespace-pre-wrap flex-1">{log.text}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
