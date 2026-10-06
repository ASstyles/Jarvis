"use client";

import React, { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import { BookOpen, Search, Plus, Trash2, Tag, FileText, Code2, Globe, CheckCircle2 } from "lucide-react";

export default function KnowledgeVaultView() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);

  // Ingestion form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("note");
  const [tags, setTags] = useState("");
  const [sourcePath, setSourcePath] = useState("");

  const fetchVault = async () => {
    try {
      const res = await fetchApi<{ documents: any[] }>("/api/vault");
      if (res.ok && res.data) {
        setDocuments(res.data.documents || []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchVault();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      fetchVault();
      return;
    }
    try {
      const res = await fetchApi<{ results: any[] }>(`/api/vault/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok && res.data) {
        const matched = res.data.results || [];
        setDocuments(matched.map((m: any) => ({
          id: m.id,
          title: m.title,
          category: m.category,
          sourcePath: m.source,
          content: m.snippet,
          tags: [`relevance: ${Math.round(m.score * 100)}%`]
        })));
      }
    } catch (_) {}
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;

    try {
      await fetchApi("/api/vault", {
        method: "POST",
        body: JSON.stringify({
          title,
          content,
          category,
          tags: tags.split(",").map(t => t.trim()).filter(Boolean),
          sourcePath: sourcePath || "manual_input"
        })
      });
      setShowAddModal(false);
      setTitle("");
      setContent("");
      setTags("");
      setSourcePath("");
      fetchVault();
    } catch (_) {}
  };

  const handleDelete = async (id: string) => {
    try {
      await fetchApi(`/api/vault/${id}`, { method: "DELETE" });
      fetchVault();
    } catch (_) {}
  };

  const filteredDocs = selectedCategory === "all" 
    ? documents 
    : documents.filter(d => d.category === selectedCategory);

  const getCatIcon = (cat: string) => {
    switch (cat) {
      case "document": return <FileText size={16} className="text-cyan-400" />;
      case "code_snippet": return <Code2 size={16} className="text-purple-400" />;
      case "web_import": return <Globe size={16} className="text-emerald-400" />;
      default: return <BookOpen size={16} className="text-amber-400" />;
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 flex-shrink-0">
        <div>
          <h1 className="text-sm font-mono font-bold tracking-wider text-cyan-300 uppercase flex items-center gap-2">
            <BookOpen className="text-cyan-400" size={18} /> Central Knowledge Vault
          </h1>
          <p className="text-xs text-white/50 mt-0.5">Semantic document store for notes, project specs, code snippets, and web research with exact citations.</p>
        </div>

        <button 
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-cyan-600/30 hover:bg-cyan-500/40 text-cyan-300 border border-cyan-500/40 rounded-xl font-mono text-xs font-semibold transition-all flex items-center gap-2"
        >
          <Plus size={14} /> INGEST KNOWLEDGE
        </button>
      </div>

      {/* Search Bar & Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-center gap-4 flex-shrink-0">
        <form onSubmit={handleSearch} className="flex-1 relative w-full">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vault (e.g. 'What do I know about Gameverse arcade?')..."
            className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-xs font-mono outline-none focus:border-cyan-500"
          />
        </form>

        <div className="flex items-center gap-1 bg-black/50 p-1 rounded-xl border border-white/10 font-mono text-xs overflow-x-auto w-full sm:w-auto">
          {["all", "document", "note", "code_snippet", "web_import"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg capitalize transition-all ${selectedCategory === cat ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-white/40 hover:text-white'}`}
            >
              {cat.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Documents Grid */}
      <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-1">
        {filteredDocs.length === 0 ? (
          <div className="col-span-full h-48 flex flex-col items-center justify-center text-white/40 font-mono text-xs text-center">
            <BookOpen size={32} className="mb-2 opacity-30 text-cyan-400" />
            No documents found matching the criteria.
          </div>
        ) : (
          filteredDocs.map((doc) => (
            <div key={doc.id} className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col justify-between gap-3 hover:border-cyan-500/40 transition-all group">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-black/40 border border-white/10">
                      {getCatIcon(doc.category)}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white line-clamp-1">{doc.title}</h3>
                      <span className="text-[9px] font-mono text-white/40 block mt-0.5">Source: {doc.sourcePath || 'manual'}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleDelete(doc.id)} 
                    className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all p-1"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                <p className="text-xs text-white/70 mt-3 font-light line-clamp-4 leading-relaxed bg-black/30 p-2.5 rounded-xl border border-white/5 font-mono">
                  {doc.content}
                </p>
              </div>

              <div className="flex flex-wrap gap-1 pt-2 border-t border-white/10">
                {(doc.tags || []).map((t: string, idx: number) => (
                  <span key={idx} className="px-2 py-0.5 rounded text-[9px] font-mono bg-white/5 text-cyan-300/80 border border-white/10 flex items-center gap-1">
                    <Tag size={8} /> {t}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Document Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel border border-cyan-500/30 rounded-3xl p-6 max-w-lg w-full">
            <h2 className="text-sm font-mono font-bold text-cyan-300 uppercase mb-4">Ingest Knowledge Vault Document</h2>
            <form onSubmit={handleIngest} className="space-y-4 font-mono text-xs">
              <div>
                <label className="text-white/60 block mb-1">Document Title</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="e.g. Next.js 16 App Router Patterns"
                  required
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 outline-none focus:border-cyan-500" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 block mb-1">Category</label>
                  <select 
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 outline-none focus:border-cyan-500 text-white"
                  >
                    <option value="note">Note</option>
                    <option value="document">Document</option>
                    <option value="code_snippet">Code Snippet</option>
                    <option value="web_import">Web Import</option>
                  </select>
                </div>
                <div>
                  <label className="text-white/60 block mb-1">Source Path / URL</label>
                  <input 
                    type="text" 
                    value={sourcePath} 
                    onChange={(e) => setSourcePath(e.target.value)} 
                    placeholder="docs/readme.md"
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 outline-none focus:border-cyan-500" 
                  />
                </div>
              </div>

              <div>
                <label className="text-white/60 block mb-1">Tags (comma separated)</label>
                <input 
                  type="text" 
                  value={tags} 
                  onChange={(e) => setTags(e.target.value)} 
                  placeholder="react, routing, optimization"
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 outline-none focus:border-cyan-500" 
                />
              </div>

              <div>
                <label className="text-white/60 block mb-1">Document Content</label>
                <textarea 
                  rows={5} 
                  value={content} 
                  onChange={(e) => setContent(e.target.value)} 
                  placeholder="Paste documentation text, code snippet, or notes..."
                  required
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 outline-none focus:border-cyan-500" 
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl"
                >
                  CANCEL
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-cyan-600/30 hover:bg-cyan-500/40 text-cyan-300 border border-cyan-500/40 rounded-xl font-bold"
                >
                  INGEST
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
