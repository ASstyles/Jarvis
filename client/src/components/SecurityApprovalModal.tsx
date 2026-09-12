"use client";

import React from "react";
import { ShieldAlert, Check, X } from "lucide-react";

export type SecurityConfirmation = {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  reason: string;
  timestamp: string;
};

interface SecurityApprovalModalProps {
  confirmation: SecurityConfirmation | null;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}

export default function SecurityApprovalModal({ confirmation, onApprove, onDeny }: SecurityApprovalModalProps) {
  if (!confirmation) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0f1424] border border-amber-500/50 rounded-3xl p-6 max-w-lg w-full shadow-[0_0_50px_rgba(245,158,11,0.2)] font-sans relative">
        <div className="flex items-center gap-3 text-amber-400 mb-4">
          <ShieldAlert size={28} className="animate-pulse" />
          <div>
            <h3 className="text-sm font-mono font-bold uppercase tracking-widest text-amber-300">Security Clearance Required</h3>
            <p className="text-xs text-white/50">JARVIS is requesting authorization for a high-risk tool call.</p>
          </div>
        </div>

        <div className="p-4 bg-black/50 border border-white/10 rounded-2xl space-y-2 font-mono text-xs text-white/80 my-4">
          <div>
            <span className="text-amber-400 font-bold uppercase">TOOL: </span>
            <span>{confirmation.toolName}</span>
          </div>
          <div>
            <span className="text-amber-400 font-bold uppercase">REASON: </span>
            <span>{confirmation.reason}</span>
          </div>
          <div>
            <span className="text-amber-400 font-bold uppercase">PARAMETERS: </span>
            <pre className="text-[11px] text-amber-200/80 bg-white/5 p-2 rounded mt-1 overflow-x-auto">
              {JSON.stringify(confirmation.args, null, 2)}
            </pre>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button 
            onClick={() => onDeny(confirmation.id)}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-5 py-2.5 rounded-xl font-mono text-xs flex items-center gap-2 transition-all"
          >
            <X size={16} /> DENY ACTION
          </button>
          <button 
            onClick={() => onApprove(confirmation.id)}
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-6 py-2.5 rounded-xl font-mono text-xs flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(245,158,11,0.4)]"
          >
            <Check size={16} /> AUTHORIZE EXECUTION
          </button>
        </div>
      </div>
    </div>
  );
}
