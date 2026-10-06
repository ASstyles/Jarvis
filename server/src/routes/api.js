const express = require('express');
const orchestrator = require('../agents/orchestrator');
const memoryMatrix = require('../memory/memoryMatrix');
const goalEngine = require('../goals/goalEngine');
const { securityGuard } = require('../security/securityGuard');
const modelRouter = require('../llm/modelRouter');
const worldModel = require('../world/worldModel');
const taskEngine = require('../tasks/taskEngine');
const skillsManager = require('../skills/skillsManager');
const knowledgeVault = require('../vault/knowledgeVault');
const autonomyBenchmark = require('../benchmark/autonomyBenchmark');
const selfTestingEngine = require('../sandbox/selfTestingEngine');
const proactiveEngine = require('../proactive/proactiveEngine');
const collaborationEngine = require('../collaboration/collaborationEngine');
const gameverseRoutes = require('./gameverse');

// JARVIS 3.0 Modules
const vlmProvider = require('../vision/vlmProvider');
const ocrProvider = require('../vision/ocrProvider');
const visualGrounding = require('../vision/visualGrounding');
const visualVerification = require('../vision/visualVerification');
const wakeWordEngine = require('../voice/wakeWordEngine');
const workerRegistry = require('../compute/workerRegistry');
const jobScheduler = require('../compute/jobScheduler');
const distributedFabric = require('../compute/distributedFabric');

const path = require('path');
const { documentExtractor } = require('../reading/documentExtractor');
const { readingSessionManager } = require('../reading/readingSessionManager');
const MODEL_CONFIG = require('../config/modelConfig');

const router = express.Router();

// Mount Gameverse API routes
router.use('/gameverse', gameverseRoutes);

// 1. Chat directive endpoint
router.post('/chat', async (req, res) => {
  console.log("\n[API] POST /api/chat received");
  try {
    const { message, context } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message directive is required." });
    }

    const result = await orchestrator.processUserRequest(message, context);
    res.json(result);
  } catch (error) {
    console.error("[API_ERROR] Chat processing failed:", error);
    const errMsg = error.message || String(error);
    if (
      errMsg.includes("429") ||
      errMsg.includes("Quota") ||
      errMsg.includes("quota") ||
      errMsg.includes("503") ||
      errMsg.includes("Service Unavailable") ||
      errMsg.includes("overloaded")
    ) {
      return res.json({
        reply: "Neural link disruption: The underlying LLM rate limit was reached. Auto-retry mechanism initiated.",
        action: null,
        emotion: "red alert"
      });
    }
    res.status(500).json({ error: `Orchestrator Execution Error: ${error.message}` });
  }
});

// 2. World Model endpoint
router.get('/world', (req, res) => {
  res.json(worldModel.getState());
});

router.post('/world/observation', (req, res) => {
  const { observation } = req.body;
  if (!observation) return res.status(400).json({ error: "Observation text required" });
  worldModel.addObservation(observation);
  res.json({ success: true, worldModel: worldModel.getState() });
});

// 3. Missions & Goal Autopilot endpoints
router.get('/missions', (req, res) => {
  const missions = goalEngine.getMissions();
  const active = goalEngine.getActiveMission();
  res.json({ active, missions });
});

router.post('/missions/:id/pause', (req, res) => {
  const success = goalEngine.pauseMission(req.params.id);
  res.json({ success });
});

router.post('/missions/:id/resume', (req, res) => {
  const success = goalEngine.resumeMission(req.params.id);
  res.json({ success });
});

router.post('/missions/:id/cancel', (req, res) => {
  const success = goalEngine.cancelMission(req.params.id);
  res.json({ success });
});

// 4. Long-running Background Tasks endpoints
router.get('/tasks', (req, res) => {
  res.json({ tasks: taskEngine.getTasks() });
});

router.post('/tasks', (req, res) => {
  const { type, title, payload, timeoutMs } = req.body;
  if (!title) return res.status(400).json({ error: "Title required" });
  const task = taskEngine.createTask(type || 'GENERAL_JOB', title, payload || {}, { timeoutMs });
  res.json({ success: true, task });
});

router.post('/tasks/:id/:action', (req, res) => {
  const { id, action } = req.params;
  let success = false;
  if (action === 'pause') success = taskEngine.pauseTask(id);
  else if (action === 'resume') success = taskEngine.resumeTask(id);
  else if (action === 'cancel') success = taskEngine.cancelTask(id);
  else if (action === 'retry') success = taskEngine.retryTask(id);
  res.json({ success, action, taskId: id });
});

// 5. Memory Matrix 2.0 endpoints
router.get('/memory', (req, res) => {
  const facts = memoryMatrix.getAllFacts();
  const preferences = memoryMatrix.getPreferences();
  const working = memoryMatrix.workingMemory;
  res.json({ facts, preferences, working });
});

router.post('/memory', (req, res) => {
  const { action, key, value, importance, category, strategy } = req.body;
  if (action === 'save') {
    const msg = memoryMatrix.saveFact(key, value, importance || 3, category || 'fact');
    return res.json({ success: true, message: msg });
  } else if (action === 'delete') {
    const success = memoryMatrix.deleteFact(key);
    return res.json({ success });
  } else if (action === 'checkConflict') {
    const conflict = memoryMatrix.detectConflict(key, value);
    return res.json(conflict);
  } else if (action === 'resolveConflict') {
    const msg = memoryMatrix.resolveConflict(key, value, strategy || 'OVERWRITE');
    return res.json({ success: true, message: msg });
  }
  res.status(400).json({ error: "Invalid action" });
});

// 6. Skills Hub endpoints
router.get('/skills', (req, res) => {
  res.json({ skills: skillsManager.getAllSkills() });
});

router.post('/skills', (req, res) => {
  const skill = skillsManager.saveCustomSkill(req.body);
  res.json({ success: true, skill });
});

router.post('/skills/:id/run', async (req, res) => {
  try {
    const result = await skillsManager.executeSkill(req.params.id, req.body.parameters || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Knowledge Vault endpoints
router.get('/vault', (req, res) => {
  res.json({ documents: knowledgeVault.getAllDocuments() });
});

router.post('/vault', (req, res) => {
  const { title, content, category, tags, sourcePath } = req.body;
  if (!title || !content) return res.status(400).json({ error: "Title and content required" });
  const doc = knowledgeVault.ingestDocument(title, content, category, tags, sourcePath);
  res.json({ success: true, document: doc });
});

router.get('/vault/search', (req, res) => {
  const query = req.query.q || '';
  const results = knowledgeVault.queryKnowledge(query, 5);
  res.json({ results });
});

router.delete('/vault/:id', (req, res) => {
  const success = knowledgeVault.deleteDocument(req.params.id);
  res.json({ success });
});

// 8. Autonomy Benchmark endpoints
router.get('/benchmark', (req, res) => {
  const score = autonomyBenchmark.computeAutonomyScore();
  res.json(score);
});

router.post('/benchmark/run', async (req, res) => {
  const result = await autonomyBenchmark.runSelfBenchmark();
  res.json(result);
});

// 9. Self-Testing Sandbox endpoints
router.get('/sandbox', (req, res) => {
  res.json({ experiments: selfTestingEngine.getExperiments() });
});

router.post('/sandbox/experiment', (req, res) => {
  const { name } = req.body;
  const exp = selfTestingEngine.createExperiment(name || 'Experiment');
  res.json({ success: true, experiment: exp });
});

router.post('/sandbox/run', async (req, res) => {
  const { runId, command } = req.body;
  const result = await selfTestingEngine.runExperimentScript(runId, command);
  res.json(result);
});

// 10. Proactive Intelligence endpoints
router.get('/proactive', (req, res) => {
  const suggestions = proactiveEngine.evaluateState();
  res.json({ suggestions });
});

router.post('/proactive/dismiss', (req, res) => {
  const { id } = req.body;
  const success = proactiveEngine.dismissSuggestion(id);
  res.json({ success });
});

// 11. Human + AI Collaboration endpoints
router.post('/collaboration/plan', (req, res) => {
  const { objective } = req.body;
  const plan = collaborationEngine.createCollaborationPlan(objective || 'Project Task');
  res.json({ success: true, plan });
});

router.post('/collaboration/decision', (req, res) => {
  const { workflowId, stepId, decisionValue } = req.body;
  const success = collaborationEngine.recordUserDecision(workflowId, stepId, decisionValue);
  res.json({ success, workflow: collaborationEngine.getWorkflow(workflowId) });
});

// 12. Operating Mode & Governance endpoints
router.get('/mode', (req, res) => {
  const currentMode = securityGuard.getOperatingMode();
  res.json({
    mode: currentMode,
    modes: [
      {
        id: 'ZERO_FRICTION',
        name: 'Zero-Friction Autonomous Mode',
        description: 'Direct, decisive, and fast. Auto-executes ordinary and safe actions without unnecessary confirmation interruptions while guarding high-impact operations.',
        autonomyLevel: 'MAXIMUM',
        active: currentMode === 'ZERO_FRICTION'
      },
      {
        id: 'AUTONOMOUS',
        name: 'Autonomous Mode',
        description: 'Standard multi-step mission autonomy with balanced confirmation gates for moderate-risk actions.',
        autonomyLevel: 'BALANCED',
        active: currentMode === 'AUTONOMOUS'
      },
      {
        id: 'ASSISTED',
        name: 'Assisted Mode',
        description: 'High confirmation frequency with guided step-by-step human authorization.',
        autonomyLevel: 'GUIDED',
        active: currentMode === 'ASSISTED'
      }
    ]
  });
});

router.post('/mode', (req, res) => {
  const { mode } = req.body;
  if (!mode) return res.status(400).json({ error: "Mode is required." });
  const updated = securityGuard.setOperatingMode(mode);
  res.json({ success: true, mode: updated });
});

// 13. Security & Permission Center endpoints
router.get('/permissions', (req, res) => {
  res.json({
    mode: securityGuard.getOperatingMode(),
    permissions: securityGuard.getPermissions(),
    rememberedPermissions: securityGuard.getRememberedPermissions(),
    pending: securityGuard.getPendingConfirmations(),
    logs: securityGuard.getSecurityLogs()
  });
});

router.post('/permissions', (req, res) => {
  const updated = securityGuard.updatePermissions(req.body);
  res.json({ success: true, permissions: updated });
});

router.get('/permissions/remembered', (req, res) => {
  res.json({ remembered: securityGuard.getRememberedPermissions() });
});

router.post('/permissions/grant', (req, res) => {
  const { scope, action, context, expiresAt, description } = req.body;
  const perm = securityGuard.grantPermission({ scope, action, context, expiresAt, description });
  res.json({ success: true, permission: perm });
});

router.delete('/permissions/remembered/:id', (req, res) => {
  const success = securityGuard.revokePermission(req.params.id);
  res.json({ success, id: req.params.id });
});

// Instant Emergency Override endpoint
router.post('/override', (req, res) => {
  const { action } = req.body;
  const lower = String(action || '').toLowerCase();

  if (lower === 'stop' || lower === 'pause') {
    const activeMission = goalEngine.getActiveMission();
    if (activeMission) goalEngine.pauseMission(activeMission.id);
    return res.json({ success: true, action: 'PAUSE', message: 'Execution halted.' });
  }

  if (lower === 'resume' || lower === 'continue') {
    const paused = goalEngine.getAllMissions().find(m => m.status === 'PAUSED');
    if (paused) goalEngine.resumeMission(paused.id);
    return res.json({ success: true, action: 'RESUME', message: 'Execution resumed.' });
  }

  if (lower === 'cancel' || lower === 'abort') {
    const activeMission = goalEngine.getActiveMission();
    if (activeMission) goalEngine.cancelMission(activeMission.id, 'User override cancel');
    return res.json({ success: true, action: 'CANCEL', message: 'Mission cancelled.' });
  }

  res.status(400).json({ error: 'Invalid override action. Valid: stop, pause, resume, cancel' });
});

router.get('/security/pending', (req, res) => {
  const pending = securityGuard.getPendingConfirmations();
  res.json({ pending });
});

router.post('/security/approve', async (req, res) => {
  const { id, approved } = req.body;
  if (!id) return res.status(400).json({ error: "Confirmation ID required" });

  if (approved) {
    const conf = securityGuard.approveConfirmation(id);
    if (!conf) return res.status(404).json({ error: "Confirmation not found" });

    // Resume tool execution
    const selectedTool = require('../tools/toolRegistry').getToolByName(conf.toolName);
    if (selectedTool) {
      const toolResult = await selectedTool.invoke(conf.args);
      const textResult = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);
      return res.json({ success: true, status: 'APPROVED', result: textResult });
    }
    return res.json({ success: true, status: 'APPROVED', result: "Executed cleanly." });
  } else {
    securityGuard.denyConfirmation(id);
    return res.json({ success: true, status: 'DENIED', result: "User denied action." });
  }
});

// 14. JARVIS 3.0 Visual Perception & VLM endpoints
router.get('/vision/status', (req, res) => {
  res.json({
    provider: vlmProvider.getActiveProviderName(),
    capabilities: vlmProvider.getCapabilities(),
    lastPerception: worldModel.getState().visualPerception
  });
});

router.post('/vision/ground', async (req, res) => {
  const { query, screenshotPath } = req.body;
  if (!query) return res.status(400).json({ error: "Query description required" });
  try {
    const result = await visualGrounding.groundElement(query, { screenshotPath });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/vision/ocr', async (req, res) => {
  const { imagePath } = req.body;
  try {
    const computerUse = require('../computer/computerUse');
    let targetPath = imagePath;
    if (!targetPath) {
      const cap = await computerUse.captureScreen();
      targetPath = cap.filePath;
    }
    const result = await ocrProvider.extractText(targetPath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/vision/verify', async (req, res) => {
  const { actionDescription, expectedCondition } = req.body;
  if (!actionDescription || !expectedCondition) {
    return res.status(400).json({ error: "actionDescription and expectedCondition required" });
  }
  try {
    const result = await visualVerification.verifyAction(actionDescription, expectedCondition);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 15. JARVIS 3.0 Voice & Wake-Word endpoints
router.get('/voice/status', (req, res) => {
  res.json(wakeWordEngine.getTelemetry());
});

router.post('/voice/wakeword', (req, res) => {
  const { phrase, source } = req.body;
  const result = wakeWordEngine.handleWakeWordTriggered(source || 'local_mic', phrase || 'JARVIS');
  res.json(result);
});

router.post('/voice/command', (req, res) => {
  const { command } = req.body;
  const result = wakeWordEngine.handleVoiceCommand(command);
  res.json(result || { handled: false, message: "Standard speech directive" });
});

router.post('/voice/mute', (req, res) => {
  const { muted } = req.body;
  const result = wakeWordEngine.toggleMicrophone(muted !== undefined ? !muted : undefined);
  res.json(result);
});

// Gemini 3.8 Live Voice Session Endpoint
router.post('/voice/live/session', (req, res) => {
  const { voice, systemInstruction } = req.body;
  const geminiProvider = modelRouter.getProvider('gemini');
  const sessionConfig = geminiProvider.createLiveSessionConfig({ voice, systemInstruction });
  res.json({ success: true, session: sessionConfig });
});

// Gemini 3.8 Flash TTS Speech Synthesis Endpoint
router.post('/voice/tts', async (req, res) => {
  const { text, voice, speed } = req.body;
  if (!text) return res.status(400).json({ error: "Text is required for TTS." });
  const geminiProvider = modelRouter.getProvider('gemini');
  const ttsPayload = await geminiProvider.synthesizeSpeech(text, { voice, speed });
  res.json({ success: true, tts: ttsPayload });
});

// Natural Voice Interruption / Barge-In Endpoint
router.post('/voice/interrupt', (req, res) => {
  const { reason } = req.body;
  if (readingSessionManager.getActiveSession()) {
    readingSessionManager.stopSession(reason || 'User vocal interruption');
  }
  res.json({
    success: true,
    interrupted: true,
    reason: reason || 'Barge-in',
    timestamp: new Date().toISOString()
  });
});

// Gemini 3.8 Central Model Configuration & Telemetry Endpoint
router.get('/models/config', (req, res) => {
  res.json({
    config: MODEL_CONFIG,
    telemetry: modelRouter.getStats()
  });
});

// Gemini 3.8 Live Health Check & Credential Verification Endpoint
router.get('/models/health', async (req, res) => {
  const { credentialManager } = require('../security/credentialManager');
  const geminiProvider = modelRouter.getProvider('gemini');
  const diagnostics = credentialManager.getSafeDiagnostics();

  let liveHandshake = null;
  if (diagnostics.credentialConfigured) {
    try {
      const chat = geminiProvider.createChatInstance('gemini-3.8-flash', 0.1);
      await chat.invoke("Ping");
      credentialManager.recordVerificationOutcome(true);
      liveHandshake = { success: true, model: 'gemini-3.8-flash', status: 'AUTHENTICATION_VERIFIED' };
    } catch (err) {
      credentialManager.recordVerificationOutcome(false, err);
      const isAuthFail = err.message.includes('API_KEY_INVALID') || err.message.includes('API key not valid');
      liveHandshake = {
        success: false,
        model: 'gemini-3.8-flash',
        status: isAuthFail ? 'AUTHENTICATION_FAILED' : 'REQUEST_FAILED',
        errorReason: isAuthFail ? 'API_KEY_INVALID' : err.message.substring(0, 160)
      };
    }
  }

  const updatedDiag = credentialManager.getSafeDiagnostics();
  res.json({
    provider: 'google',
    model: 'gemini-3.8-flash',
    ...updatedDiag,
    handshake: liveHandshake,
    status: updatedDiag.authenticationVerified ? 'healthy' : 'authentication_required'
  });
});


// 16. JARVIS 3.0 Distributed Compute Fabric endpoints
router.get('/compute/status', (req, res) => {
  res.json(distributedFabric.getClusterStatus());
});

router.post('/compute/dispatch', (req, res) => {
  const { title, type, payload, requiresGpu, priority } = req.body;
  if (!title) return res.status(400).json({ error: "Job title required" });
  const job = distributedFabric.dispatchJob(title, type || 'GENERAL_COMPUTE', payload || {}, { requiresGpu, priority });
  res.json({ success: true, job });
});

router.post('/compute/cancel', (req, res) => {
  const { jobId, reason } = req.body;
  const success = distributedFabric.cancelJob(jobId, reason);
  res.json({ success, jobId });
});

router.post('/compute/worker/register', (req, res) => {
  const worker = distributedFabric.registerWorker(req.body);
  res.json({ success: true, worker });
});

router.post('/compute/worker/heartbeat', (req, res) => {
  const { workerId } = req.body;
  const success = distributedFabric.recordHeartbeat(workerId);
  res.json({ success, workerId });
});

// 17. System Status & Diagnostics endpoint
router.get('/status', (req, res) => {
  res.json({
    system: "JARVIS 3.0 AI Operating System",
    operatingMode: securityGuard.getOperatingMode(),
    cognitiveState: orchestrator.getState(),
    activeMission: goalEngine.getActiveMission(),
    runningTasksCount: taskEngine.getTasks().filter(t => t.status === 'RUNNING').length,
    pendingConfirmationsCount: securityGuard.getPendingConfirmations().length,
    rememberedPermissionsCount: securityGuard.getRememberedPermissions().length,
    autonomyScore: autonomyBenchmark.computeAutonomyScore().overallScore,
    modelStats: modelRouter.getStats(),
    worldModel: worldModel.getState(),
    computeFabric: distributedFabric.getClusterStatus(),
    voiceState: wakeWordEngine.getTelemetry(),
    readingSession: readingSessionManager.getTelemetry()
  });
});

// 18. Verifiable Document Reading Session endpoints
router.get('/reading/session', (req, res) => {
  res.json(readingSessionManager.getTelemetry());
});

router.post('/reading/start', (req, res) => {
  const { target } = req.body;
  try {
    const doc = documentExtractor.extractDocument(target || 'letter');
    const session = readingSessionManager.createSession(doc);
    res.json({ success: true, session, document: doc });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.post('/reading/segment', (req, res) => {
  const { segmentIndex, status, metadata } = req.body;
  if (!segmentIndex || !status) {
    return res.status(400).json({ error: "segmentIndex and status are required." });
  }
  const updated = readingSessionManager.updateSegmentStatus(Number(segmentIndex), status, metadata);
  res.json({ success: true, session: updated });
});

router.post('/reading/control', (req, res) => {
  const { command, targetIndex, reason } = req.body;
  const cmd = String(command || '').toUpperCase();

  if (cmd === 'PAUSE') {
    return res.json({ success: true, result: readingSessionManager.pauseSession() });
  }
  if (cmd === 'RESUME' || cmd === 'CONTINUE') {
    return res.json({ success: true, result: readingSessionManager.resumeSession() });
  }
  if (cmd === 'STOP') {
    return res.json({ success: true, result: readingSessionManager.stopSession(reason) });
  }
  if (cmd === 'RESTART') {
    return res.json({ success: true, result: readingSessionManager.restartSession() });
  }
  if (cmd === 'SKIP') {
    return res.json({ success: true, result: readingSessionManager.skipSegment(targetIndex) });
  }
  if (cmd === 'VERIFY') {
    return res.json({ success: true, result: readingSessionManager.verifySessionCompletion() });
  }

  res.status(400).json({ error: "Invalid reading control command. Valid: PAUSE, RESUME, STOP, RESTART, SKIP, VERIFY" });
});

router.post('/reading/sync', (req, res) => {
  const synced = readingSessionManager.syncClientState(req.body);
  res.json({ success: true, session: synced });
});

router.post('/reading/verify', (req, res) => {
  const result = readingSessionManager.verifySessionCompletion();
  res.json(result);
});

router.get('/reading/documents', (req, res) => {
  try {
    const files = documentExtractor.listTextFiles(documentExtractor.workspaceRoot);
    res.json({ documents: files.map(f => ({ path: f, name: path.basename(f) })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Camera Vision Capture Response from Client
const { cameraVisionManager } = require('../vision/cameraVision');
router.post('/camera/response', (req, res) => {
  const { captureId, data, error, mimeType, frames } = req.body;
  if (!captureId) return res.status(400).json({ error: 'captureId is required' });

  cameraVisionManager.handleCaptureResponse(captureId, {
    imageData: data,
    mimeType,
    frames,
    error
  });
  res.json({ success: true });
});

// Browser Chrome Status Endpoint
const { chromeBridge } = require('../browser/chromeBridge');
router.get('/browser/status', async (req, res) => {
  const status = await chromeBridge.checkStatus();
  res.json(status);
});

// MCP Discovery Endpoint
const { mcpManager } = require('../mcp/mcpManager');
router.get('/mcp/servers', (req, res) => {
  const configs = mcpManager.discoverConfigs();
  const tools = mcpManager.getTools().map(t => ({ name: t.name, description: t.description }));
  res.json({ servers: Object.keys(configs), tools });
});

module.exports = router;
