const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '../../db');
const DB_FILE = path.join(DB_DIR, 'jarvis_state.json');

const defaultState = {
  longTermMemory: {},
  preferences: {},
  missions: [],
  securityLogs: [],
  taskHistory: [],
  worldModel: {},
  backgroundTasks: [],
  skills: [],
  vaultItems: [],
  benchmarkLogs: [],
  permissionsConfig: {},
  proactiveSuggestions: [],
  sandboxRuns: [],
  distributedJobs: [],
  workerNodes: [],
  visualPerceptions: [],
  wakeWordTelemetry: [],
  rememberedPermissions: [],
  operatingMode: 'ZERO_FRICTION'
};

let memCache = null;

function ensureDbExists() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultState, null, 2), 'utf-8');
  }
}

function readDb() {
  if (memCache) return memCache;
  ensureDbExists();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    memCache = { ...defaultState, ...JSON.parse(raw) };
    return memCache;
  } catch (err) {
    if (!memCache) memCache = { ...defaultState };
    return memCache;
  }
}

function writeDb(data) {
  ensureDbExists();
  memCache = { ...data };
  
  // Write to disk with retry loop for Windows file locking resiliency
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const tempPath = `${DB_FILE}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 6)}`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      
      try {
        fs.renameSync(tempPath, DB_FILE);
      } catch (_) {
        fs.copyFileSync(tempPath, DB_FILE);
        try { fs.unlinkSync(tempPath); } catch (_) {}
      }
      return;
    } catch (err) {
      if (attempt === 4) {
        // As a last fallback direct write
        try {
          fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
        } catch (_) {}
      }
    }
  }
}

function getCollection(key) {
  const db = readDb();
  return db[key] || (Array.isArray(defaultState[key]) ? [] : {});
}

function setCollection(key, value) {
  const db = readDb();
  db[key] = value;
  writeDb(db);
}

module.exports = {
  readDb,
  writeDb,
  getCollection,
  setCollection
};
