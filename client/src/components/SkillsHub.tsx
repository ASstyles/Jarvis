"use client";

import React, { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import { Sparkles, Play, Plus, CheckCircle2, Cpu, FileText, Code2, Rocket, Globe, GitBranch, BarChart3 } from "lucide-react";

export default function SkillsHub() {
  const [skills, setSkills] = useState<any[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Skill form
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTrigger, setNewTrigger] = useState("");
  const [newSteps, setNewSteps] = useState("Step 1: Inspect environment\nStep 2: Execute operation\nStep 3: Verify result");

  const fetchSkills = async () => {
    try {
      const res = await fetchApi<{ skills: any[] }>("/api/skills");
      if (res.ok && res.data) {
        setSkills(res.data.skills || []);
        if (!selectedSkill && res.data.skills?.length > 0) {
          setSelectedSkill(res.data.skills[0]);
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  const handleRunSkill = async () => {
    if (!selectedSkill) return;
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetchApi(`/api/skills/${selectedSkill.id}/run`, {
        method: "POST",
        body: JSON.stringify({ parameters: {} })
      });
      setRunResult(res.data || { error: res.error });
    } catch (err: any) {
      setRunResult({ error: err.message });
    }
    setRunning(false);
  };

  const handleCreateSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    const parsedWorkflow = newSteps.split("\n").filter(Boolean).map((s, idx) => ({
      step: idx + 1,
      action: s.replace(/^step\s*\d+:\s*/i, '')
    }));

    try {
      await fetchApi("/api/skills", {
        method: "POST",
        body: JSON.stringify({
          name: newName,
          description: newDesc,
          trigger: newTrigger,
          workflow: parsedWorkflow
        })
      });
      setShowCreateModal(false);
      setNewName("");
      setNewDesc("");
      setNewTrigger("");
      fetchSkills();
    } catch (_) {}
  };

  const getSkillIcon = (id: string) => {
    if (id.includes('presentation')) return <FileText size={18} className="text-amber-400" />;
    if (id.includes('website')) return <Rocket size={18} className="text-cyan-400" />;
    if (id.includes('code-review')) return <Code2 size={18} className="text-purple-400" />;
    if (id.includes('research')) return <Globe size={18} className="text-blue-400" />;
    if (id.includes('git')) return <GitBranch size={18} className="text-emerald-400" />;
    if (id.includes('data')) return <BarChart3 size={18} className="text-pink-400" />;
    return <Sparkles size={18} className="text-cyan-400" />;
  };

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 flex-shrink-0">
        <div>
          <h1 className="text-sm font-mono font-bold tracking-wider text-cyan-300 uppercase flex items-center gap-2">
            <Sparkles className="text-cyan-400" size={18} /> Reusable Skills & Workflow Library
          </h1>
          <p className="text-xs text-white/50 mt-0.5">Pre-configured autonomous multi-tool workflows and user-recorded operational skills.</p>
        </div>

        <button 
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-cyan-600/30 hover:bg-cyan-500/40 text-cyan-300 border border-cyan-500/40 rounded-xl font-mono text-xs font-semibold transition-all flex items-center gap-2"
        >
          <Plus size={14} /> CREATE SKILL
        </button>
      </div>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
        {/* Left Skills List */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col overflow-y-auto space-y-2">
          <span className="text-[10px] font-mono uppercase text-white/40 font-bold mb-2">Available Skills ({skills.length})</span>
          {skills.map((skill) => (
            <button
              key={skill.id}
              onClick={() => { setSelectedSkill(skill); setRunResult(null); }}
              className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${selectedSkill?.id === skill.id ? 'bg-cyan-500/20 border-cyan-500/50 shadow-[0_0_15px_rgba(0,240,255,0.15)]' : 'bg-black/30 border-white/5 hover:border-white/20'}`}
            >
              <div className="p-2 rounded-lg bg-black/40 border border-white/10 mt-0.5">
                {getSkillIcon(skill.id)}
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white">{skill.name}</h3>
                <p className="text-[10px] text-white/50 mt-0.5 line-clamp-1">{skill.description}</p>
                <span className="text-[9px] font-mono text-cyan-400 mt-1 block">Trigger: "{skill.trigger}"</span>
              </div>
            </button>
          ))}
        </div>

        {/* Right Skill Details & Runner */}
        <div className="md:col-span-2 glass-panel p-6 rounded-2xl border border-white/10 flex flex-col justify-between overflow-y-auto">
          {selectedSkill ? (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">{selectedSkill.name}</h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white/60">v{selectedSkill.version}</span>
                  </div>
                  <p className="text-xs text-white/60 mt-1">{selectedSkill.description}</p>
                </div>

                <button
                  onClick={handleRunSkill}
                  disabled={running}
                  className="px-5 py-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl font-mono text-xs font-bold transition-all shadow-[0_0_20px_rgba(0,240,255,0.2)] flex items-center gap-2"
                >
                  <Play size={14} className={running ? "animate-spin" : ""} />
                  {running ? "EXECUTING SKILL..." : "EXECUTE SKILL"}
                </button>
              </div>

              {/* Workflow Steps */}
              <div className="space-y-3">
                <span className="text-[10px] font-mono uppercase text-white/40 tracking-wider">Workflow Step Sequence:</span>
                <div className="space-y-2">
                  {selectedSkill.workflow.map((w: any, idx: number) => (
                    <div key={idx} className="p-3 bg-black/40 rounded-xl border border-white/5 flex items-center gap-3 text-xs font-mono">
                      <div className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-300 text-[10px] font-bold">
                        {w.step || idx + 1}
                      </div>
                      <span className="text-white/80">{w.action}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tools & Permissions */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                <div>
                  <span className="text-[10px] font-mono text-white/40 block mb-1">REQUIRED TOOLS:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedSkill.requiredTools || []).map((t: string) => (
                      <span key={t} className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-cyan-300">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-white/40 block mb-1">PERMISSIONS:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedSkill.permissions || []).map((p: string) => (
                      <span key={p} className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-purple-300">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Result output */}
              {runResult && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl font-mono text-xs text-emerald-300">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <CheckCircle2 size={14} /> SKILL DISPATCHED TO GOAL AUTOPILOT
                  </div>
                  <p className="text-[11px] text-white/70">Mission ID: {runResult.mission?.id || 'Created'}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-white/40 font-mono text-xs">
              Select a skill to inspect and execute its workflow.
            </div>
          )}
        </div>
      </div>

      {/* Create Skill Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel border border-cyan-500/30 rounded-3xl p-6 max-w-lg w-full">
            <h2 className="text-sm font-mono font-bold text-cyan-300 uppercase mb-4">Record New Reusable Skill</h2>
            <form onSubmit={handleCreateSkill} className="space-y-4 font-mono text-xs">
              <div>
                <label className="text-white/60 block mb-1">Skill Name</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  placeholder="e.g. Daily Standup Briefing"
                  required
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 outline-none focus:border-cyan-500" 
                />
              </div>
              <div>
                <label className="text-white/60 block mb-1">Description</label>
                <input 
                  type="text" 
                  value={newDesc} 
                  onChange={(e) => setNewDesc(e.target.value)} 
                  placeholder="What this skill accomplishes"
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 outline-none focus:border-cyan-500" 
                />
              </div>
              <div>
                <label className="text-white/60 block mb-1">Natural Language Trigger</label>
                <input 
                  type="text" 
                  value={newTrigger} 
                  onChange={(e) => setNewTrigger(e.target.value)} 
                  placeholder="e.g. prepare daily standup"
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 outline-none focus:border-cyan-500" 
                />
              </div>
              <div>
                <label className="text-white/60 block mb-1">Workflow Steps (one per line)</label>
                <textarea 
                  rows={4} 
                  value={newSteps} 
                  onChange={(e) => setNewSteps(e.target.value)} 
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 outline-none focus:border-cyan-500" 
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl"
                >
                  CANCEL
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-cyan-600/30 hover:bg-cyan-500/40 text-cyan-300 border border-cyan-500/40 rounded-xl font-bold"
                >
                  SAVE SKILL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
