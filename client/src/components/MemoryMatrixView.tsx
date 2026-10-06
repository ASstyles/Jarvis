"use client";

import React, { useState } from "react";
import { fetchApi } from "@/lib/api";
import { Database, Plus, Trash2, Search, Brain } from "lucide-react";

export type MemoryFact = {
  key: string;
  value: string;
  importance?: number;
  category?: string;
  updatedAt?: string;
};

interface MemoryMatrixViewProps {
  facts: MemoryFact[];
  preferences: Record<string, string>;
  onRefresh: () => void;
}

export default function MemoryMatrixView({ facts, preferences, onRefresh }: MemoryMatrixViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const filteredFacts = facts.filter(f => 
    f.key.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddFact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;

    try {
      await fetchApi("/api/memory", {
        method: "POST",
        body: JSON.stringify({ action: "save", key: newKey.trim(), value: newValue.trim() })
      });
      setNewKey("");
      setNewValue("");
      setIsAdding(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFact = async (key: string) => {
    try {
      await fetchApi("/api/memory", {
        method: "POST",
        body: JSON.stringify({ action: "delete", key })
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-5 flex flex-col h-full overflow-hidden border border-purple-500/20">
      {/* Header */}
      <div className="flex justify-between items-center pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-purple-400" />
          <h3 className="text-xs font-mono font-bold tracking-[0.2em] uppercase text-purple-300">
            Memory Matrix Matrix
          </h3>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 p-1.5 rounded-lg text-xs flex items-center gap-1 transition-all"
        >
          <Plus size={14} /> Add Fact
        </button>
      </div>

      {/* Form Add Fact */}
      {isAdding && (
        <form onSubmit={handleAddFact} className="mt-3 p-3 bg-purple-950/20 border border-purple-500/30 rounded-xl space-y-2">
          <input 
            type="text" 
            placeholder="Fact Key (e.g. favorite_framework)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-purple-400"
          />
          <input 
            type="text" 
            placeholder="Fact Value (e.g. Next.js 15 App Router)"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-purple-400"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setIsAdding(false)} className="text-[10px] text-white/50 px-2 py-1">Cancel</button>
            <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-3 py-1 rounded-lg">Save Fact</button>
          </div>
        </form>
      )}

      {/* Search Input */}
      <div className="mt-3 relative">
        <Search size={14} className="absolute left-3 top-2.5 text-white/30" />
        <input 
          type="text"
          placeholder="Search semantic memory matrix..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:border-purple-500/50"
        />
      </div>

      {/* Memory List */}
      <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1">
        {filteredFacts.length === 0 ? (
          <div className="text-center text-xs text-white/40 py-6">No long-term memories found.</div>
        ) : (
          filteredFacts.map((fact) => (
            <div key={fact.key} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex justify-between items-start group hover:border-purple-500/30 transition-colors">
              <div>
                <span className="text-[10px] font-mono text-purple-400 font-semibold uppercase">{fact.key}</span>
                <p className="text-xs text-white/80 mt-0.5">{fact.value}</p>
              </div>
              <button 
                onClick={() => handleDeleteFact(fact.key)}
                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-1 transition-opacity"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
