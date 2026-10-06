require('dotenv').config();
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api');
const proxyRoutes = require('./routes/proxy');
const orchestrator = require('./agents/orchestrator');
const taskEngine = require('./tasks/taskEngine');
const worldModel = require('./world/worldModel');
const { requireAuth, verifyFirebaseToken } = require('./middleware/auth');
const { uiEvents } = require('./tools/uiOps');
const { cameraVisionManager } = require('./vision/cameraVision');

const app = express();
const PORT = process.env.PORT || 4000;

// Centralized CORS configuration
const allowedOrigins = (process.env.JARVIS_ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173')
  .split(',')
  .map(s => s.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    callback(null, true); // Dev-friendly permissive origin
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Mount Secure Media & Web Proxy Router (SSRF protected)
app.use('/api/proxy', proxyRoutes);

// Server-Sent Events (SSE) subscribers with sequence IDs and authenticated session scoping
const sseClients = new Map(); // Map<res, { user, lastSeq, connectedAt }>
let sseSequenceId = 1;

app.get('/api/events', async (req, res) => {
  // Extract token from query param or header
  let token = req.query.token;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7).trim();
  }

  const allowDevBypass = process.env.JARVIS_AUTH_DEV_BYPASS === '1' || process.env.NODE_ENV === 'test' || !process.env.FIREBASE_PROJECT_ID;

  let authenticatedUser = null;
  if (token) {
    try {
      authenticatedUser = await verifyFirebaseToken(token);
    } catch (err) {
      return res.status(403).json({ error: `Forbidden: SSE token rejected (${err.message}).` });
    }
  } else if (allowDevBypass) {
    authenticatedUser = { uid: 'dev-operator-local', role: 'ADMIN', name: 'Dev Operator' };
  } else {
    return res.status(401).json({ error: 'Unauthorized: Authentication token required for SSE stream.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const clientInfo = {
    user: authenticatedUser,
    lastSeq: sseSequenceId,
    connectedAt: Date.now()
  };

  sseClients.set(res, clientInfo);

  // Send initial connection event with state snapshot
  const initialPayload = {
    seq: sseSequenceId++,
    type: 'CONNECTED',
    user: { uid: authenticatedUser.uid, name: authenticatedUser.name, role: authenticatedUser.role },
    state: orchestrator.getState(),
    worldModel: worldModel.getState(),
    timestamp: new Date().toISOString()
  };
  res.write(`data: ${JSON.stringify(initialPayload)}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// Periodic heartbeat ping to keep connection alive and purge dead sockets
const heartbeatInterval = setInterval(() => {
  sseClients.forEach((info, clientRes) => {
    try {
      clientRes.write(`: heartbeat ${Date.now()}\n\n`);
    } catch (_) {
      sseClients.delete(clientRes);
    }
  });
}, 25000);

heartbeatInterval.unref();

const broadcastSse = (payloadObj, targetUid = null) => {
  const seq = sseSequenceId++;
  const fullPayload = { seq, ...payloadObj, timestamp: payloadObj.timestamp || new Date().toISOString() };
  const raw = `data: ${JSON.stringify(fullPayload)}\n\n`;

  sseClients.forEach((info, clientRes) => {
    // If targetUid is specified, only send to that authenticated user
    if (targetUid && info.user && info.user.uid !== targetUid) return;

    try {
      clientRes.write(raw);
    } catch (_) {
      sseClients.delete(clientRes);
    }
  });
};

// 1. Broadcast orchestrator state updates
orchestrator.onStateChange((eventData) => {
  broadcastSse({ type: 'STATE_CHANGE', ...eventData });
});

// 2. Broadcast Agent-Controlled UI Directives & Blade Events
uiEvents.on('UI_COMMAND', (data) => {
  broadcastSse({ type: 'UI_DIRECTIVE', ...data });
});

uiEvents.on('BLADE_EVENT', (data) => {
  broadcastSse({ type: 'BLADE_EVENT', ...data });
});

// 3. Broadcast Camera Vision Capture Requests
cameraVisionManager.on('CAMERA_CAPTURE_REQUESTED', (reqData) => {
  broadcastSse({ type: 'CAMERA_CAPTURE_REQUEST', ...reqData });
});

// 4. Broadcast background task events
taskEngine.on('TASK_CREATED', (task) => broadcastSse({ type: 'TASK_EVENT', event: 'TASK_CREATED', task }));
taskEngine.on('TASK_STARTED', (task) => broadcastSse({ type: 'TASK_EVENT', event: 'TASK_STARTED', task }));
taskEngine.on('TASK_PROGRESS', (task) => broadcastSse({ type: 'TASK_EVENT', event: 'TASK_PROGRESS', task }));
taskEngine.on('TASK_COMPLETED', (task) => broadcastSse({ type: 'TASK_EVENT', event: 'TASK_COMPLETED', task }));
taskEngine.on('TASK_FAILED', (task) => broadcastSse({ type: 'TASK_EVENT', event: 'TASK_FAILED', task }));
taskEngine.on('TASK_PAUSED', (task) => broadcastSse({ type: 'TASK_EVENT', event: 'TASK_PAUSED', task }));
taskEngine.on('TASK_RESUMED', (task) => broadcastSse({ type: 'TASK_EVENT', event: 'TASK_RESUMED', task }));
taskEngine.on('TASK_CANCELLED', (task) => broadcastSse({ type: 'TASK_EVENT', event: 'TASK_CANCELLED', task }));

// 5. Broadcast World Model changes
worldModel.onUpdate((wmEvent) => {
  broadcastSse(wmEvent);
});

// 6. Broadcast Compute Fabric changes
const workerRegistry = require('./compute/workerRegistry');
const jobScheduler = require('./compute/jobScheduler');
workerRegistry.onUpdate((evt) => broadcastSse(evt));
jobScheduler.onUpdate((evt) => broadcastSse(evt));

// 7. Broadcast Wake Word & Voice events
const wakeWordEngine = require('./voice/wakeWordEngine');
wakeWordEngine.onStateChange((evt) => broadcastSse({ type: 'VOICE_STATE_CHANGE', ...evt }));

// 8. Broadcast Document Reading Session events
const { readingSessionManager } = require('./reading/readingSessionManager');
readingSessionManager.on('SESSION_CREATED', (session) => broadcastSse({ type: 'READING_STATE_CHANGE', event: 'SESSION_CREATED', session }));
readingSessionManager.on('SESSION_UPDATED', (session) => broadcastSse({ type: 'READING_STATE_CHANGE', event: 'SESSION_UPDATED', session }));
readingSessionManager.on('SEGMENT_PLAYING', (data) => broadcastSse({ type: 'READING_STATE_CHANGE', event: 'SEGMENT_PLAYING', ...data }));
readingSessionManager.on('SEGMENT_COMPLETED', (data) => broadcastSse({ type: 'READING_STATE_CHANGE', event: 'SEGMENT_COMPLETED', ...data }));
readingSessionManager.on('SESSION_PAUSED', (session) => broadcastSse({ type: 'READING_STATE_CHANGE', event: 'SESSION_PAUSED', session }));
readingSessionManager.on('SESSION_RESUMED', (session) => broadcastSse({ type: 'READING_STATE_CHANGE', event: 'SESSION_RESUMED', session }));
readingSessionManager.on('SESSION_STOPPED', (data) => broadcastSse({ type: 'READING_STATE_CHANGE', event: 'SESSION_STOPPED', ...data }));
readingSessionManager.on('SESSION_COMPLETED', (session) => broadcastSse({ type: 'READING_STATE_CHANGE', event: 'SESSION_COMPLETED', session }));

// Mount API routes with backend authentication
app.use('/api', requireAuth, apiRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'JARVIS 3.0 Autonomous AI Operating System Online',
    cognitiveState: orchestrator.getState(),
    mcpServers: Object.keys(require('./mcp/mcpManager').mcpManager.discoverConfigs()),
    activeClients: sseClients.size,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`[SYS] JARVIS 3.0 Unified Autonomous AI Operating System online on port ${PORT}`);
});

module.exports = { app, broadcastSse };
