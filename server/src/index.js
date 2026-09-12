require('dotenv').config();
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api');
const orchestrator = require('./agents/orchestrator');
const taskEngine = require('./tasks/taskEngine');
const worldModel = require('./world/worldModel');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Server-Sent Events (SSE) subscribers
const sseClients = new Set();

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  sseClients.add(res);

  // Send immediate connected message with full World Model & state
  res.write(`data: ${JSON.stringify({
    type: 'CONNECTED',
    state: orchestrator.getState(),
    worldModel: worldModel.getState()
  })}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

const broadcastSse = (payloadObj) => {
  const payload = `data: ${JSON.stringify(payloadObj)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(payload);
    } catch (_) {}
  });
};

// 1. Broadcast orchestrator state updates
orchestrator.onStateChange((eventData) => {
  broadcastSse({ type: 'STATE_CHANGE', ...eventData });
});

// 2. Broadcast background task events
taskEngine.on('TASK_CREATED', (task) => broadcastSse({ type: 'TASK_EVENT', event: 'TASK_CREATED', task }));
taskEngine.on('TASK_STARTED', (task) => broadcastSse({ type: 'TASK_EVENT', event: 'TASK_STARTED', task }));
taskEngine.on('TASK_PROGRESS', (task) => broadcastSse({ type: 'TASK_EVENT', event: 'TASK_PROGRESS', task }));
taskEngine.on('TASK_COMPLETED', (task) => broadcastSse({ type: 'TASK_EVENT', event: 'TASK_COMPLETED', task }));
taskEngine.on('TASK_FAILED', (task) => broadcastSse({ type: 'TASK_EVENT', event: 'TASK_FAILED', task }));
taskEngine.on('TASK_PAUSED', (task) => broadcastSse({ type: 'TASK_EVENT', event: 'TASK_PAUSED', task }));
taskEngine.on('TASK_RESUMED', (task) => broadcastSse({ type: 'TASK_EVENT', event: 'TASK_RESUMED', task }));
taskEngine.on('TASK_CANCELLED', (task) => broadcastSse({ type: 'TASK_EVENT', event: 'TASK_CANCELLED', task }));

// 3. Broadcast World Model changes
worldModel.onUpdate((wmEvent) => {
  broadcastSse(wmEvent);
});

// 4. Broadcast Compute Fabric changes
const workerRegistry = require('./compute/workerRegistry');
const jobScheduler = require('./compute/jobScheduler');
workerRegistry.onUpdate((evt) => broadcastSse(evt));
jobScheduler.onUpdate((evt) => broadcastSse(evt));

// 5. Broadcast Wake Word & Voice events
const wakeWordEngine = require('./voice/wakeWordEngine');
wakeWordEngine.onStateChange((evt) => broadcastSse({ type: 'VOICE_STATE_CHANGE', ...evt }));

// 6. Broadcast Document Reading Session events
const { readingSessionManager } = require('./reading/readingSessionManager');
readingSessionManager.on('SESSION_CREATED', (session) => broadcastSse({ type: 'READING_STATE_CHANGE', event: 'SESSION_CREATED', session }));
readingSessionManager.on('SESSION_UPDATED', (session) => broadcastSse({ type: 'READING_STATE_CHANGE', event: 'SESSION_UPDATED', session }));
readingSessionManager.on('SEGMENT_PLAYING', (data) => broadcastSse({ type: 'READING_STATE_CHANGE', event: 'SEGMENT_PLAYING', ...data }));
readingSessionManager.on('SEGMENT_COMPLETED', (data) => broadcastSse({ type: 'READING_STATE_CHANGE', event: 'SEGMENT_COMPLETED', ...data }));
readingSessionManager.on('SESSION_PAUSED', (session) => broadcastSse({ type: 'READING_STATE_CHANGE', event: 'SESSION_PAUSED', session }));
readingSessionManager.on('SESSION_RESUMED', (session) => broadcastSse({ type: 'READING_STATE_CHANGE', event: 'SESSION_RESUMED', session }));
readingSessionManager.on('SESSION_STOPPED', (data) => broadcastSse({ type: 'READING_STATE_CHANGE', event: 'SESSION_STOPPED', ...data }));
readingSessionManager.on('SESSION_COMPLETED', (session) => broadcastSse({ type: 'READING_STATE_CHANGE', event: 'SESSION_COMPLETED', session }));

app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'JARVIS 2.0 AI OS Online',
    cognitiveState: orchestrator.getState(),
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`[SYS] JARVIS 2.0 Autonomous AI Operating System online on port ${PORT}`);
});
