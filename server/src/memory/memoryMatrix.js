const { getCollection, setCollection } = require('../db/database');

class MemoryMatrix {
  constructor() {
    this.workingMemory = {
      activeGoal: null,
      currentStep: null,
      transientNotes: [],
      toolExecutionResults: []
    };
    this.sessionHistory = [];
  }

  // Working Memory operations
  setWorkingState(key, val) {
    this.workingMemory[key] = val;
  }

  addTransientNote(note) {
    this.workingMemory.transientNotes.push({ timestamp: new Date().toISOString(), note });
    if (this.workingMemory.transientNotes.length > 20) {
      this.workingMemory.transientNotes.shift();
    }
  }

  clearWorkingMemory() {
    this.workingMemory = {
      activeGoal: null,
      currentStep: null,
      transientNotes: [],
      toolExecutionResults: []
    };
  }

  // Conversation Memory operations
  addSessionMessage(role, content, extra = {}) {
    this.sessionHistory.push({
      role,
      content,
      timestamp: new Date().toISOString(),
      ...extra
    });
    if (this.sessionHistory.length > 30) {
      this.sessionHistory.splice(0, 2); // Sliding window
    }
  }

  getSessionHistory() {
    return this.sessionHistory;
  }

  // Memory 2.0: Save with conflict detection and metadata
  saveFact(key, value, importance = 3, category = 'fact', options = {}) {
    const memoryMap = getCollection('longTermMemory');
    const keyLower = key.toLowerCase();
    const existing = memoryMap[keyLower];

    const record = {
      id: existing ? existing.id : 'mem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      key,
      value,
      type: category, // 'fact' | 'preference' | 'episodic' | 'procedural' | 'constraint'
      importance: Math.min(5, Math.max(1, importance)),
      confidence: options.confidence || 0.95,
      source: options.source || 'user_explicit',
      relatedProject: options.relatedProject || null,
      relatedMission: options.relatedMission || null,
      ttl: options.ttl || null,
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      lastVerified: new Date().toISOString()
    };

    memoryMap[keyLower] = record;
    setCollection('longTermMemory', memoryMap);
    return `Saved Memory 2.0 record: [${key}] = "${value}" (Type: ${category}, Importance: ${record.importance}/5)`;
  }

  recallFact(key) {
    const memoryMap = getCollection('longTermMemory');
    const keyLower = key.toLowerCase();
    const record = memoryMap[keyLower];
    if (record) {
      // Check TTL expiration
      if (record.ttl && new Date(record.ttl) < new Date()) {
        this.deleteFact(key);
        return null;
      }
      record.lastUsed = new Date().toISOString();
      setCollection('longTermMemory', memoryMap);
      return record.value;
    }
    return null;
  }

  getAllFacts() {
    const memoryMap = getCollection('longTermMemory');
    const now = new Date();
    // Filter out expired items
    return Object.values(memoryMap).filter(rec => !rec.ttl || new Date(rec.ttl) > now);
  }

  deleteFact(key) {
    const memoryMap = getCollection('longTermMemory');
    const keyLower = key.toLowerCase();
    if (memoryMap[keyLower]) {
      delete memoryMap[keyLower];
      setCollection('longTermMemory', memoryMap);
      return true;
    }
    return false;
  }

  // Conflict Detection Engine
  detectConflict(key, newValue) {
    const memoryMap = getCollection('longTermMemory');
    const existing = memoryMap[key.toLowerCase()];
    if (!existing) return { hasConflict: false };

    const valA = String(existing.value).trim().toLowerCase();
    const valB = String(newValue).trim().toLowerCase();

    if (valA !== valB) {
      return {
        hasConflict: true,
        key,
        existingValue: existing.value,
        newValue,
        existingRecord: existing,
        message: `Conflict detected for key "${key}": existing value is "${existing.value}", but new proposed value is "${newValue}".`
      };
    }

    return { hasConflict: false };
  }

  resolveConflict(key, chosenValue, strategy = 'OVERWRITE') {
    const conflict = this.detectConflict(key, chosenValue);
    if (!conflict.hasConflict) {
      return this.saveFact(key, chosenValue);
    }

    if (strategy === 'OVERWRITE' || strategy === 'UPDATE') {
      const memoryMap = getCollection('longTermMemory');
      const rec = memoryMap[key.toLowerCase()];
      rec.previousValue = rec.value;
      rec.value = chosenValue;
      rec.updatedAt = new Date().toISOString();
      rec.lastVerified = new Date().toISOString();
      setCollection('longTermMemory', memoryMap);
      return `Conflict resolved: Updated [${key}] to "${chosenValue}" (Previous: "${rec.previousValue}").`;
    }

    return `Conflict retained for user review.`;
  }

  verifyMemory(key) {
    const memoryMap = getCollection('longTermMemory');
    const record = memoryMap[key.toLowerCase()];
    if (record) {
      record.lastVerified = new Date().toISOString();
      record.confidence = Math.min(1.0, (record.confidence || 0.9) + 0.05);
      setCollection('longTermMemory', memoryMap);
      return true;
    }
    return false;
  }

  // Preference Memory operations
  setPreference(key, value) {
    const prefs = getCollection('preferences');
    prefs[key] = value;
    setCollection('preferences', prefs);
  }

  getPreferences() {
    return getCollection('preferences');
  }

  // Memory 2.0: Multi-factor scored semantic search (Text + Recency + Importance + Confidence)
  searchSemanticMemory(query, limit = 5) {
    const queryTokens = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    if (!queryTokens.length) return [];

    const allRecords = this.getAllFacts();
    const prefs = Object.entries(this.getPreferences()).map(([k, v]) => ({
      key: `pref:${k}`,
      value: String(v),
      type: 'preference',
      importance: 5,
      confidence: 1.0,
      updatedAt: new Date().toISOString()
    }));

    const corpus = [...allRecords, ...prefs];
    const now = Date.now();

    const scored = corpus.map(item => {
      const textToSearch = `${item.key} ${item.value} ${item.type || ''}`.toLowerCase();
      let matchCount = 0;
      for (const token of queryTokens) {
        if (textToSearch.includes(token)) matchCount += 1;
      }

      if (matchCount === 0) return { item, score: 0 };

      // Multi-factor weighting:
      const textSim = matchCount / queryTokens.length;
      const importanceWeight = (item.importance || 3) / 5;
      const confidence = item.confidence || 0.9;
      
      // Recency decay: items within last 24 hours have higher weight
      const ageHours = (now - new Date(item.updatedAt || item.createdAt || now).getTime()) / (1000 * 3600);
      const recency = Math.max(0.1, 1 / (1 + ageHours * 0.05));

      const totalScore = (textSim * 0.45) + (importanceWeight * 0.25) + (recency * 0.15) + (confidence * 0.15);
      return { item, score: totalScore };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.item);
  }

  // Build context summary string for system prompt injection
  buildMemoryContext(currentInput = "") {
    const prefs = this.getPreferences();
    const relevantFacts = this.searchSemanticMemory(currentInput, 6);
    const allFacts = this.getAllFacts().slice(0, 10);

    let contextStr = "=== MEMORY MATRIX 2.0 CONTEXT ===\n";

    if (Object.keys(prefs).length > 0) {
      contextStr += "User Preferences:\n" + Object.entries(prefs).map(([k, v]) => ` - ${k}: ${v}`).join("\n") + "\n";
    }

    if (relevantFacts.length > 0) {
      contextStr += "Relevant Retrieved Knowledge:\n" + relevantFacts.map(f => ` - [${f.key}] (${f.type || 'fact'}): ${f.value}`).join("\n") + "\n";
    } else if (allFacts.length > 0) {
      contextStr += "Known Long-Term Facts:\n" + allFacts.map(f => ` - [${f.key}]: ${f.value}`).join("\n") + "\n";
    }

    if (this.workingMemory.activeGoal) {
      contextStr += `Active Goal: ${JSON.stringify(this.workingMemory.activeGoal)}\n`;
    }

    contextStr += "=================================\n";
    return contextStr;
  }
}

const memoryMatrix = new MemoryMatrix();
module.exports = memoryMatrix;
