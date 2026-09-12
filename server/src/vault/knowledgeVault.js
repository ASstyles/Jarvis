const { getCollection, setCollection } = require('../db/database');
const worldModel = require('../world/worldModel');

class KnowledgeVault {
  constructor() {
    this.initDefaultVault();
  }

  initDefaultVault() {
    const items = getCollection('vaultItems') || [];
    if (items.length === 0) {
      const initialDocs = [
        {
          id: 'doc_jarvis_arch',
          title: 'JARVIS 2.0 AI OS Architecture Manual',
          category: 'document',
          tags: ['architecture', 'os', 'agents', 'security'],
          sourcePath: 'docs/jarvis_architecture.md',
          content: 'JARVIS 2.0 AI Operating System operates a unified World Model, Goal Autopilot DAG engine, secure Computer Use layer, Memory 2.0 with conflict detection, parallel multi-agent orchestrator, and empirical self-benchmarking.',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'doc_gameverse_spec',
          title: 'Gameverse 8-Game Arcade Specification',
          category: 'document',
          tags: ['gameverse', 'arcade', 'games', 'progression'],
          sourcePath: 'docs/gameverse_spec.md',
          content: 'Gameverse features 8 unique arcade games: Jarvis Command, Neural Rush, Cyber Heist, AI Arena, Codebreak, Void Runner, Jarvis Tactics, and Boss Protocol. Progression includes XP, level ups, and persistent high score leaderboards.',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      setCollection('vaultItems', initialDocs);
    }
  }

  getAllDocuments() {
    return getCollection('vaultItems');
  }

  ingestDocument(title, content, category = 'note', tags = [], sourcePath = 'manual_input') {
    const items = getCollection('vaultItems');
    const id = 'vault_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    const newDoc = {
      id,
      title,
      content,
      category, // 'document', 'note', 'code_snippet', 'web_import'
      tags: Array.isArray(tags) ? tags : [tags],
      sourcePath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    items.unshift(newDoc);
    setCollection('vaultItems', items);
    worldModel.addObservation(`Ingested document into Knowledge Vault: "${title}" (${category})`);

    return newDoc;
  }

  queryKnowledge(query, limit = 5) {
    const items = this.getAllDocuments();
    const queryTokens = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    if (!queryTokens.length) return [];

    const scored = items.map(doc => {
      const searchTarget = `${doc.title} ${doc.tags.join(' ')} ${doc.content} ${doc.sourcePath}`.toLowerCase();
      let matchCount = 0;
      for (const token of queryTokens) {
        if (searchTarget.includes(token)) matchCount += 1;
      }

      if (matchCount === 0) return { doc, score: 0 };
      const score = matchCount / queryTokens.length;
      return { doc, score };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => ({
        id: s.doc.id,
        title: s.doc.title,
        category: s.doc.category,
        source: s.doc.sourcePath,
        snippet: s.doc.content.substring(0, 300) + (s.doc.content.length > 300 ? '...' : ''),
        score: s.score
      }));
  }

  deleteDocument(id) {
    const items = getCollection('vaultItems');
    const filtered = items.filter(d => d.id !== id);
    if (filtered.length !== items.length) {
      setCollection('vaultItems', filtered);
      return true;
    }
    return false;
  }
}

const knowledgeVault = new KnowledgeVault();
module.exports = knowledgeVault;
