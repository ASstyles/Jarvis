"use client";

import React, { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import {
  Shield, ShieldAlert, ShieldCheck, Lock, Zap, Bot, Eye, Terminal,
  Monitor, HardDrive, Globe, RefreshCw, CheckCircle2, XCircle, Plus, Trash2, Clock, AlertCircle
} from "lucide-react";

export default function PermissionCenter() {
  const [currentMode, setCurrentMode] = useState<string>("ZERO_FRICTION");
  const [permissions, setPermissions] = useState<any>({});
  const [rememberedPermissions, setRememberedPermissions] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // New Scoped Permission Modal/Form state
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [newScope, setNewScope] = useState("WORKSPACE");
  const [newAction, setNewAction] = useState("terminal:tests");
  const [newContext, setNewContext] = useState("Run test suites autonomously in workspace");

  const fetchPermissions = async () => {
    try {
      const res = await fetchApi<any>("/api/permissions");
      if (res.ok && res.data) {
        setCurrentMode(res.data.mode || "ZERO_FRICTION");
        setPermissions(res.data.permissions || {});
        setRememberedPermissions(res.data.rememberedPermissions || []);
        setPending(res.data.pending || []);
        setLogs(res.data.logs || []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchPermissions();
    const interval = setInterval(fetchPermissions, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleModeChange = async (targetMode: string) => {
    setSaving(true);
    try {
      const res = await fetchApi<{ mode: string }>("/api/mode", {
        method: "POST",
        body: JSON.stringify({ mode: targetMode })
      });
      if (res.ok && res.data) {
        setCurrentMode(res.data.mode);
      }
    } catch (_) {}
    setSaving(false);
  };

  const handleToggle = async (key: string, newValues: any) => {
    setSaving(true);
    try {
      const updated = { ...permissions, [key]: { ...permissions[key], ...newValues } };
      await fetchApi("/api/permissions", {
        method: "POST",
        body: JSON.stringify(updated)
      });
      setPermissions(updated);
    } catch (_) {}
    setSaving(false);
  };

  const handleDecision = async (id: string, approved: boolean) => {
    try {
      await fetchApi("/api/security/approve", {
        method: "POST",
        body: JSON.stringify({ id, approved })
      });
      fetchPermissions();
    } catch (_) {}
  };

  const handleGrantPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi("/api/permissions/grant", {
        method: "POST",
        body: JSON.stringify({
          scope: newScope,
          action: newAction,
          context: newContext,
          description: newContext
        })
      });
      setShowGrantModal(false);
      fetchPermissions();
    } catch (_) {}
  };

  const handleRevokePermission = async (id: string) => {
    try {
      await fetchApi(`/api/permissions/remembered/${id}`, {
        method: "DELETE"
      });
      fetchPermissions();
    } catch (_) {}
  };

  return (
    <div className="h-full flex flex-col gap-6 overflow-y-auto pr-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-mono font-bold tracking-wider text-cyan-300 uppercase flex items-center gap-2">
            <Shield className="text-cyan-400" size={18} /> Central Security & Permission Governance
          </h1>
          <p className="text-xs text-white/50 mt-0.5">Control autonomous operating modes, remembered permissions, and risk-aware security gates.</p>
        </div>
        <button 
          onClick={fetchPermissions}
          className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors"
          title="Refresh Permissions"
        >
          <RefreshCw size={14} className={saving ? "animate-spin" : ""} />
        </button>
      </div>

      {/* 1. Operating Mode Selector Grid */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold tracking-wider text-white/80 uppercase flex items-center gap-1.5">
            <Zap size={14} className="text-amber-400" /> Operating Autonomy Level
          </span>
          <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
            ACTIVE: {currentMode}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* ZERO-FRICTION MODE */}
          <div 
            onClick={() => handleModeChange("ZERO_FRICTION")}
            className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-3 ${
              currentMode === "ZERO_FRICTION" 
                ? "bg-cyan-950/40 border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30" 
                : "glass-panel border-white/10 hover:border-white/20 opacity-70 hover:opacity-100"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-300">
                <Zap size={16} className="text-amber-400 fill-amber-400/20" />
                <span>Zero-Friction Mode</span>
              </div>
              <span className={`text-[9px] font-mono px-2 py-0.5 rounded uppercase font-bold ${
                currentMode === "ZERO_FRICTION" ? "bg-cyan-500 text-black font-extrabold" : "bg-white/10 text-white/40"
              }`}>
                {currentMode === "ZERO_FRICTION" ? "ENGAGED" : "SELECT"}
              </span>
            </div>
            <p className="text-[11px] text-white/70 leading-relaxed">
              <strong>Direct & Decisive.</strong> Auto-executes ordinary, reversible, safe tasks (tests, refactoring, builds, files) without unnecessary interruptions. Protects only high-impact security operations.
            </p>
            <div className="text-[10px] font-mono text-cyan-400/80 pt-2 border-t border-white/5 flex items-center justify-between">
              <span>DO → VERIFY → REPORT</span>
              <span>⚡ Max Speed</span>
            </div>
          </div>

          {/* AUTONOMOUS MODE */}
          <div 
            onClick={() => handleModeChange("AUTONOMOUS")}
            className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-3 ${
              currentMode === "AUTONOMOUS" 
                ? "bg-blue-950/40 border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/30" 
                : "glass-panel border-white/10 hover:border-white/20 opacity-70 hover:opacity-100"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-blue-300">
                <Bot size={16} className="text-blue-400" />
                <span>Autonomous Mode</span>
              </div>
              <span className={`text-[9px] font-mono px-2 py-0.5 rounded uppercase font-bold ${
                currentMode === "AUTONOMOUS" ? "bg-blue-500 text-black font-extrabold" : "bg-white/10 text-white/40"
              }`}>
                {currentMode === "AUTONOMOUS" ? "ENGAGED" : "SELECT"}
              </span>
            </div>
            <p className="text-[11px] text-white/70 leading-relaxed">
              <strong>Balanced Autonomy.</strong> Executes multi-step objectives independently while requesting confirmation on intermediate-risk terminal commands and file deletions.
            </p>
            <div className="text-[10px] font-mono text-blue-400/80 pt-2 border-t border-white/5 flex items-center justify-between">
              <span>Goal Autopilot DAG</span>
              <span>⚖️ Balanced</span>
            </div>
          </div>

          {/* ASSISTED MODE */}
          <div 
            onClick={() => handleModeChange("ASSISTED")}
            className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-3 ${
              currentMode === "ASSISTED" 
                ? "bg-purple-950/40 border-purple-500/60 shadow-[0_0_20px_rgba(168,85,247,0.15)] ring-1 ring-purple-500/30" 
                : "glass-panel border-white/10 hover:border-white/20 opacity-70 hover:opacity-100"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-purple-300">
                <Shield size={16} className="text-purple-400" />
                <span>Assisted Mode</span>
              </div>
              <span className={`text-[9px] font-mono px-2 py-0.5 rounded uppercase font-bold ${
                currentMode === "ASSISTED" ? "bg-purple-500 text-black font-extrabold" : "bg-white/10 text-white/40"
              }`}>
                {currentMode === "ASSISTED" ? "ENGAGED" : "SELECT"}
              </span>
            </div>
            <p className="text-[11px] text-white/70 leading-relaxed">
              <strong>Guided Execution.</strong> High confirmation frequency. Asks user authorization before executing any state-modifying actions or scripts.
            </p>
            <div className="text-[10px] font-mono text-purple-400/80 pt-2 border-t border-white/5 flex items-center justify-between">
              <span>Interactive Gates</span>
              <span>🛡️ High Review</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Authorizations Bar if any */}
      {pending.length > 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col gap-3">
          <div className="flex items-center gap-2 text-amber-300 font-mono text-xs font-bold">
            <ShieldAlert size={16} className="animate-pulse" />
            <span>PENDING SECURITY CONFIRMATION ({pending.length})</span>
          </div>
          {pending.map((p) => (
            <div key={p.id} className="p-3 bg-black/50 border border-amber-500/20 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-mono text-white font-semibold">Tool: {p.toolName}</span>
                <p className="text-[11px] text-white/60 mt-0.5">{p.reason}</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleDecision(p.id, true)} 
                  className="px-3 py-1.5 bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-mono font-bold hover:bg-emerald-500/40 transition-all flex items-center gap-1"
                >
                  <CheckCircle2 size={12} /> APPROVE
                </button>
                <button 
                  onClick={() => handleDecision(p.id, false)} 
                  className="px-3 py-1.5 bg-red-600/30 text-red-300 border border-red-500/40 rounded-lg text-xs font-mono font-bold hover:bg-red-500/40 transition-all flex items-center gap-1"
                >
                  <XCircle size={12} /> DENY
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Remembered Permissions Management */}
      <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col gap-3">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-400" />
            <h2 className="text-xs font-mono font-bold tracking-wider text-white/90 uppercase">
              Remembered Scoped Permissions ({rememberedPermissions.length})
            </h2>
          </div>
          <button 
            onClick={() => setShowGrantModal(true)}
            className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition-colors"
          >
            <Plus size={12} /> Grant Permission
          </button>
        </div>

        {showGrantModal && (
          <form onSubmit={handleGrantPermission} className="p-4 bg-black/60 border border-cyan-500/30 rounded-xl flex flex-col gap-3">
            <span className="text-xs font-mono font-bold text-cyan-300">Authorize New Scoped Permission Rule</span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-mono text-white/50 block mb-1">Scope</label>
                <select 
                  value={newScope} 
                  onChange={(e) => setNewScope(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                >
                  <option value="WORKSPACE" className="bg-slate-900">WORKSPACE</option>
                  <option value="REPOSITORY" className="bg-slate-900">REPOSITORY</option>
                  <option value="SYSTEM" className="bg-slate-900">SYSTEM</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono text-white/50 block mb-1">Action</label>
                <select 
                  value={newAction} 
                  onChange={(e) => setNewAction(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                >
                  <option value="terminal:tests" className="bg-slate-900">Terminal: Run Tests</option>
                  <option value="terminal:build" className="bg-slate-900">Terminal: Build & Lint</option>
                  <option value="terminal:safe" className="bg-slate-900">Terminal: Safe Commands</option>
                  <option value="manage_files" className="bg-slate-900">File System: Full Workspace Ops</option>
                  <option value="*" className="bg-slate-900">All Safe Operations (*)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono text-white/50 block mb-1">Context / Description</label>
                <input 
                  type="text" 
                  value={newContext}
                  onChange={(e) => setNewContext(e.target.value)}
                  placeholder="e.g. Always allow tests without asking"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-1">
              <button 
                type="button" 
                onClick={() => setShowGrantModal(false)}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-mono text-white/60"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-3 py-1 bg-cyan-500 text-black font-mono text-xs font-bold rounded-lg hover:bg-cyan-400"
              >
                Authorize & Remember
              </button>
            </div>
          </form>
        )}

        {rememberedPermissions.length === 0 ? (
          <div className="py-4 text-center text-white/40 font-mono text-xs">
            No specific remembered permissions set. Default mode policies apply.
          </div>
        ) : (
          <div className="space-y-2">
            {rememberedPermissions.map((perm) => (
              <div key={perm.id} className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-cyan-300 font-bold">{perm.action}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-white/60 border border-white/10">
                      SCOPE: {perm.scope}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/70">{perm.description || perm.context}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-white/40">
                    Granted: {new Date(perm.grantedAt).toLocaleDateString()}
                  </span>
                  <button 
                    onClick={() => handleRevokePermission(perm.id)}
                    className="p-1.5 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Revoke Permission"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Subsystem Governance Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* 1. Computer Vision & Computer Use */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-cyan-300">
              <Monitor size={16} className="text-cyan-400" />
              <span>Computer Vision & Use</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              {permissions.computerUse?.scope || 'FULL_CONTROL'}
            </span>
          </div>
          <p className="text-[11px] text-white/60">Enables screen capture, UI inspection, coordinate mouse clicking, and typing text.</p>
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <span className="text-[10px] font-mono text-white/40">Destructive shortcut confirmation</span>
            <button 
              onClick={() => handleToggle('computerUse', { requireConfirmationForKeys: !permissions.computerUse?.requireConfirmationForKeys })}
              className={`px-2.5 py-1 rounded text-[10px] font-mono transition-all ${permissions.computerUse?.requireConfirmationForKeys ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-white/5 text-white/40'}`}
            >
              {permissions.computerUse?.requireConfirmationForKeys ? 'MANDATORY' : 'AUTOMATIC'}
            </button>
          </div>
        </div>

        {/* 2. Terminal & Command Execution */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-amber-300">
              <Terminal size={16} className="text-amber-400" />
              <span>Terminal & PowerShell</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {permissions.terminalExecution?.scope || 'SAFE_COMMANDS'}
            </span>
          </div>
          <p className="text-[11px] text-white/60">Executes shell scripts, tests, builds. Dangerous patterns (format, root deletion, shutdown) trigger authorization.</p>
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <span className="text-[10px] font-mono text-white/40">Safe Dev Commands</span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">AUTO-EXECUTE ⚡</span>
          </div>
        </div>

        {/* 3. File System Access */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-purple-300">
              <HardDrive size={16} className="text-purple-400" />
              <span>File System Access</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
              {permissions.fileAccess?.scope || 'WORKSPACE_ONLY'}
            </span>
          </div>
          <p className="text-[11px] text-white/60">Reading, writing, creating drafts, and refactoring project files inside the workspace.</p>
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <span className="text-[10px] font-mono text-white/40">Workspace Refactoring</span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">ACTIVE 🛡️</span>
          </div>
        </div>

        {/* 4. Background Tasks & Workers */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-emerald-300">
              <RefreshCw size={16} className="text-emerald-400" />
              <span>Background Tasks</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {permissions.backgroundTasks?.maxWorkers || 4} WORKERS
            </span>
          </div>
          <p className="text-[11px] text-white/60">Allows long-running autonomous monitoring and background asynchronous worker threads.</p>
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <span className="text-[10px] font-mono text-white/40">Concurrency Limit</span>
            <span className="text-[10px] font-mono text-cyan-300 font-bold">4 THREADS</span>
          </div>
        </div>

        {/* 5. Network & External Services */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-blue-300">
              <Globe size={16} className="text-blue-400" />
              <span>Network & Web Fetch</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              INTERNET
            </span>
          </div>
          <p className="text-[11px] text-white/60">Web browsing, search queries, media retrieval, and document extraction for research.</p>
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <span className="text-[10px] font-mono text-white/40">Outbound Connections</span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">ALLOWED</span>
          </div>
        </div>

        {/* 6. System Power & OS Controls */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-red-300">
              <Lock size={16} className="text-red-400" />
              <span>System Power Operations</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
              RESTRICTED
            </span>
          </div>
          <p className="text-[11px] text-white/60">System shutdown, sleep, and killing critical OS-level processes. Always requires explicit clearance.</p>
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <span className="text-[10px] font-mono text-white/40">Clearance Status</span>
            <span className="text-[10px] font-mono text-red-400 font-bold">MANDATORY USER AUTH</span>
          </div>
        </div>

      </div>

      {/* 4. Security Logs Audit Trail */}
      <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col flex-1 min-h-[220px]">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <h2 className="text-xs font-mono font-bold tracking-wider text-cyan-300 uppercase flex items-center gap-2">
            <ShieldCheck size={16} className="text-cyan-400" /> Live Security Audit Trail
          </h2>
          <span className="text-[10px] font-mono text-white/40">{logs.length} Recorded Security Events</span>
        </div>

        <div className="flex-1 overflow-y-auto mt-3 space-y-2">
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-white/40 font-mono text-xs">
              No security anomalies or authorization requests logged.
            </div>
          ) : (
            logs.slice(0, 20).map((log, idx) => (
              <div key={idx} className="p-2.5 bg-black/40 rounded-xl border border-white/5 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-3">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${log.eventType.includes('DENIED') ? 'bg-red-500/20 text-red-300' : log.eventType.includes('APPROVED') || log.eventType.includes('GRANTED') ? 'bg-emerald-500/20 text-emerald-300' : 'bg-cyan-500/20 text-cyan-300'}`}>
                    {log.eventType}
                  </span>
                  <span className="text-white/80">{log.payload?.toolName ? `Tool: ${log.payload.toolName}` : log.payload?.mode ? `Mode switched to ${log.payload.mode}` : 'Security policy update'}</span>
                </div>
                <span className="text-[10px] text-white/40">{new Date(log.timestamp).toLocaleTimeString()}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
