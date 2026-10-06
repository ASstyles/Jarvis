const memoryMatrix = require('../memory/memoryMatrix');
const goalEngine = require('../goals/goalEngine');
const { securityGuard, RISK_LEVELS, OPERATING_MODES } = require('../security/securityGuard');
const modelRouter = require('../llm/modelRouter');
const { getAllTools, getToolByName } = require('../tools/toolRegistry');
const researchAgent = require('./researchAgent');
const codingAgent = require('./codingAgent');
const verificationAgent = require('./verificationAgent');
const parallelRunner = require('./parallelRunner');
const worldModel = require('../world/worldModel');
const speechFormatter = require('../voice/speechFormatter');
const voiceProfile = require('../voice/voiceProfile');
const { documentExtractor } = require('../reading/documentExtractor');
const { readingSessionManager } = require('../reading/readingSessionManager');

const { SystemMessage, HumanMessage, AIMessage, ToolMessage } = require('@langchain/core/messages');

class Orchestrator {
  constructor() {
    this.currentState = 'IDLE';
    this.listeners = [];
  }

  onStateChange(callback) {
    this.listeners.push(callback);
  }

  setState(newState, payload = {}) {
    this.currentState = newState;
    console.log(`[ORCHESTRATOR_STATE] ➔ ${newState}`, payload.title || payload.step || payload.tool || '');
    this.listeners.forEach(cb => {
      try {
        cb({ state: newState, timestamp: new Date().toISOString(), payload });
      } catch (err) {
        console.error('[ORCHESTRATOR] Listener callback error:', err);
      }
    });
  }

  getState() {
    return this.currentState;
  }

  notifyTaskEvent(eventName, taskPayload) {
    this.listeners.forEach(cb => {
      try {
        cb({ state: this.currentState, type: eventName, task: taskPayload, timestamp: new Date().toISOString() });
      } catch (_) {}
    });
  }

  async processUserRequest(inputStr, context = {}) {
    console.log(`\n======================================================`);
    console.log(`[ORCHESTRATOR] Received directive: "${inputStr}"`);
    console.log(`======================================================`);

    memoryMatrix.addSessionMessage('user', inputStr);
    worldModel.addObservation(`User directive: "${inputStr}"`);

    // 0. CHECK FOR FAST INTENT INTERCEPTORS (Mode Switching, Permissions, Overrides)
    const interceptResult = await this.handleFastDirectives(inputStr);
    if (interceptResult) {
      memoryMatrix.addSessionMessage('ai', interceptResult.text);
      return interceptResult;
    }

    // 1. OBSERVE & UNDERSTAND
    this.setState('UNDERSTANDING', { input: inputStr });
    const memoryContextStr = memoryMatrix.buildMemoryContext(inputStr);
    const worldModelContext = worldModel.generateContextPrompt();
    const currentMode = securityGuard.getOperatingMode();

    // Determine if request warrants a Multi-Step Mission vs Single Action
    const isComplexMission = this.detectComplexMission(inputStr, currentMode);

    if (isComplexMission) {
      return await this.executeMissionFlow(inputStr, `${worldModelContext}\n${memoryContextStr}`);
    } else {
      return await this.executeSingleTurnLoop(inputStr, `${worldModelContext}\n${memoryContextStr}`);
    }
  }

  // Detects Mode Switching, Permission Memory, and Emergency Control Overrides
  async handleFastDirectives(inputStr) {
    const raw = (inputStr || "").toLowerCase().trim();
    const cleaned = raw.replace(/[.,!?;:'"]/g, '').trim();

    // A. Mode Switching Directives
    if (
      cleaned.includes('switch to zero-friction mode') ||
      cleaned.includes('switch to zero friction mode') ||
      cleaned.includes('zero friction mode') ||
      cleaned.includes('enable zero friction') ||
      cleaned.includes('activate zero friction')
    ) {
      const mode = securityGuard.setOperatingMode(OPERATING_MODES.ZERO_FRICTION);
      const text = `[SYSTEM STABLE] Zero-Friction Mode engaged. Maximum direct autonomy online. I will execute ordinary and safe tasks directly without unnecessary interruptions while enforcing security gates for high-risk actions.`;
      return {
        text,
        spokenText: "Zero-Friction Mode engaged. Maximum autonomy online. I will handle tasks directly.",
        voiceProsody: voiceProfile.getProsody("zero_friction", "COMPLETED"),
        action: { type: 'MODE_CHANGE', mode },
        emotion: "system stable"
      };
    }

    if (
      cleaned.includes('switch to autonomous mode') ||
      cleaned.includes('switch back to autonomous mode') ||
      cleaned.includes('enable autonomous mode') ||
      cleaned.includes('autonomous mode')
    ) {
      const mode = securityGuard.setOperatingMode(OPERATING_MODES.AUTONOMOUS);
      const text = `[SYSTEM STABLE] Autonomous Mode active. Standard multi-step mission execution enabled with balanced risk checks.`;
      return {
        text,
        spokenText: "Autonomous Mode active. Standard multi-step execution enabled.",
        voiceProsody: voiceProfile.getProsody("stable", "COMPLETED"),
        action: { type: 'MODE_CHANGE', mode },
        emotion: "system stable"
      };
    }

    if (
      cleaned.includes('switch to assisted mode') ||
      cleaned.includes('assisted mode') ||
      cleaned.includes('enable assisted mode')
    ) {
      const mode = securityGuard.setOperatingMode(OPERATING_MODES.ASSISTED);
      const text = `[SYSTEM STABLE] Assisted Mode active. High-interaction checkpoints enabled. I will confirm before making state-modifying actions.`;
      return {
        text,
        spokenText: "Assisted Mode active. Direct confirmation mode engaged.",
        voiceProsody: voiceProfile.getProsody("stable", "COMPLETED"),
        action: { type: 'MODE_CHANGE', mode },
        emotion: "system stable"
      };
    }

    // B. Explicit Permission Memory Grants
    // e.g., "You can run tests in this repository without asking me"
    if (cleaned.includes('without asking') || cleaned.includes('always allow') || cleaned.includes('remember permission')) {
      let scope = 'WORKSPACE';
      let action = '*';
      let desc = inputStr;

      if (cleaned.includes('test')) {
        action = 'terminal:tests';
        desc = 'Autonomous test execution authorized';
      } else if (cleaned.includes('file') || cleaned.includes('edit')) {
        action = 'manage_files';
        desc = 'Workspace file management authorized';
      } else if (cleaned.includes('terminal') || cleaned.includes('command')) {
        action = 'terminal:safe';
        desc = 'Safe shell execution authorized';
      }

      const perm = securityGuard.grantPermission({ scope, action, context: inputStr, description: desc });
      const text = `[SYSTEM STABLE] Permission preference remembered. Scope: ${scope}, Action: ${action}. I will execute these operations autonomously.`;
      return {
        text,
        spokenText: `Permission preference saved. I have authorized ${desc.toLowerCase()}.`,
        voiceProsody: voiceProfile.getProsody("stable", "COMPLETED"),
        action: { type: 'PERMISSION_GRANTED', permission: perm },
        emotion: "system stable"
      };
    }

    // C. Active Document Reading Session Voice Controls
    const activeReadingSession = readingSessionManager.getActiveSession();
    const isReadingActive = activeReadingSession && (activeReadingSession.status === 'READING' || activeReadingSession.status === 'PAUSED');

    if (isReadingActive) {
      if (cleaned === 'pause' || cleaned === 'jarvis pause' || cleaned === 'pause reading' || cleaned === 'hold on') {
        const res = readingSessionManager.pauseSession();
        return {
          text: `[SYSTEM STABLE] Document reading session paused at section ${activeReadingSession.currentSegment} of ${activeReadingSession.totalSegments}.`,
          spokenText: "Paused.",
          voiceProsody: voiceProfile.getProsody("stable", "WAITING"),
          action: { type: 'READING_CONTROL', command: 'PAUSE', sessionId: activeReadingSession.sessionId },
          emotion: "system stable"
        };
      }

      if (cleaned === 'continue' || cleaned === 'resume' || cleaned === 'jarvis continue' || cleaned === 'jarvis resume' || cleaned === 'keep reading' || cleaned === 'resume reading') {
        const res = readingSessionManager.resumeSession();
        return {
          text: `[BLUE ANALYSIS] Resuming document reading from section ${activeReadingSession.currentSegment} of ${activeReadingSession.totalSegments}.`,
          spokenText: "Continuing.",
          voiceProsody: voiceProfile.getProsody("blue analysis", "EXECUTING"),
          action: { type: 'READING_CONTROL', command: 'RESUME', sessionId: activeReadingSession.sessionId },
          emotion: "blue analysis"
        };
      }

      if (cleaned === 'repeat' || cleaned === 'repeat that' || cleaned === 'repeat section' || cleaned === 'replay') {
        return {
          text: `[BLUE ANALYSIS] Repeating section ${activeReadingSession.currentSegment} of ${activeReadingSession.totalSegments}.`,
          spokenText: "Repeating section.",
          voiceProsody: voiceProfile.getProsody("blue analysis", "EXECUTING"),
          action: { type: 'READING_CONTROL', command: 'REPEAT', sessionId: activeReadingSession.sessionId },
          emotion: "blue analysis"
        };
      }

      if (cleaned === 'skip this' || cleaned === 'skip' || cleaned === 'next section' || cleaned === 'skip section' || cleaned === 'skip segment') {
        const res = readingSessionManager.skipSegment();
        return {
          text: `[BLUE ANALYSIS] Skipped to section ${activeReadingSession.currentSegment} of ${activeReadingSession.totalSegments}.`,
          spokenText: res.spokenAcknowledgment || "Skipping section.",
          voiceProsody: voiceProfile.getProsody("blue analysis", "EXECUTING"),
          action: { type: 'READING_CONTROL', command: 'SKIP', sessionId: activeReadingSession.sessionId, nextSegment: activeReadingSession.currentSegment },
          emotion: "blue analysis"
        };
      }

      if (cleaned === 'start over' || cleaned === 'restart' || cleaned === 'restart reading' || cleaned === 'read from beginning') {
        readingSessionManager.restartSession();
        return {
          text: `[BLUE ANALYSIS] Restarting document reading from section 1.`,
          spokenText: "Starting from the beginning.",
          voiceProsody: voiceProfile.getProsody("blue analysis", "EXECUTING"),
          action: { type: 'READING_CONTROL', command: 'RESTART', sessionId: activeReadingSession.sessionId },
          emotion: "blue analysis"
        };
      }

      if (cleaned === 'retry' || cleaned === 'retry section' || cleaned === 'retry segment') {
        return {
          text: `[BLUE ANALYSIS] Retrying section ${activeReadingSession.currentSegment}.`,
          spokenText: "Retrying section.",
          voiceProsody: voiceProfile.getProsody("blue analysis", "EXECUTING"),
          action: { type: 'READING_CONTROL', command: 'RETRY', sessionId: activeReadingSession.sessionId },
          emotion: "blue analysis"
        };
      }
    }

    // D. Document Reading Directives ("read this letter", "read everything", "read gayatri letter", etc.)
    const isReadDirective = (
      (cleaned.startsWith('read') || cleaned.startsWith('recite') || cleaned.includes('read aloud') || cleaned.includes('read this') || cleaned.includes('read everything') || cleaned.includes('read the whole thing') || cleaned.includes('read the full')) &&
      (cleaned.includes('letter') || cleaned.includes('document') || cleaned.includes('everything') || cleaned.includes('all') || cleaned.includes('gayatri') || cleaned.includes('whole thing') || cleaned.includes('file') || cleaned.includes('text') || cleaned === 'read this' || cleaned === 'read aloud' || cleaned === 'read everything')
    );

    if (isReadDirective) {
      try {
        let queryTarget = cleaned;
        if (cleaned.includes('gayatri')) queryTarget = 'Gayatri_Letter.txt';
        else if (cleaned.includes('letter to gayatri')) queryTarget = 'Letter_to_Gayatri.txt';
        else queryTarget = 'letter';

        const extractedDoc = documentExtractor.extractDocument(queryTarget);
        const session = readingSessionManager.createSession(extractedDoc);

        const responseText = `[BLUE ANALYSIS] Document Reading Session initialized for "${extractedDoc.title}" (${extractedDoc.totalWords} words, ${session.totalSegments} segments). Starting verifiable audio playback pipeline...`;
        const spokenText = "Of course. I'll read it.";

        return {
          text: responseText,
          spokenText,
          voiceProsody: voiceProfile.getProsody("blue analysis", "EXECUTING"),
          action: {
            type: 'DOCUMENT_READING_START',
            session,
            document: {
              id: extractedDoc.documentId,
              title: extractedDoc.title,
              path: extractedDoc.documentPath,
              text: extractedDoc.text,
              totalWords: extractedDoc.totalWords,
              totalCharacters: extractedDoc.totalCharacters,
              totalSegments: session.totalSegments
            }
          },
          emotion: "blue analysis"
        };
      } catch (docErr) {
        console.warn("[ORCHESTRATOR] Document reading extraction error:", docErr.message);
      }
    }

    // E. Emergency User Overrides
    if (cleaned === 'stop' || cleaned === 'pause' || cleaned === 'jarvis stop' || cleaned === 'jarvis pause' || cleaned === 'halt') {
      if (isReadingActive) {
        const res = readingSessionManager.stopSession();
        return {
          text: `[SYSTEM STABLE] Document reading stopped. ${res.spokenAcknowledgment}`,
          spokenText: res.spokenAcknowledgment,
          voiceProsody: voiceProfile.getProsody("warning", "WAITING"),
          action: { type: 'READING_CONTROL', command: 'STOP', sessionId: activeReadingSession.sessionId },
          emotion: "system stable"
        };
      }

      const activeMission = goalEngine.getActiveMission();
      if (activeMission) {
        goalEngine.pauseMission(activeMission.id);
        return {
          text: `[SYSTEM STABLE] Execution halted. Active mission "${activeMission.title}" paused.`,
          spokenText: `Paused active mission: ${activeMission.title}.`,
          voiceProsody: voiceProfile.getProsody("warning", "WAITING"),
          action: { type: 'MISSION_PAUSED', missionId: activeMission.id },
          emotion: "system stable"
        };
      }
      return {
        text: `[SYSTEM STABLE] Core paused. Standing by for instructions.`,
        spokenText: "Standing by.",
        voiceProsody: voiceProfile.getProsody("normal", "IDLE"),
        action: null,
        emotion: "system stable"
      };
    }

    if (cleaned === 'cancel' || cleaned === 'cancel that' || cleaned === 'jarvis cancel' || cleaned === 'abort') {
      if (isReadingActive) {
        readingSessionManager.stopSession('User cancel directive');
        return {
          text: `[SYSTEM STABLE] Document reading cancelled.`,
          spokenText: "Reading cancelled.",
          voiceProsody: voiceProfile.getProsody("warning", "COMPLETED"),
          action: { type: 'READING_CONTROL', command: 'STOP', sessionId: activeReadingSession.sessionId },
          emotion: "system stable"
        };
      }

      const activeMission = goalEngine.getActiveMission();
      if (activeMission) {
        goalEngine.cancelMission(activeMission.id, 'User cancel directive');
        return {
          text: `[SYSTEM STABLE] Mission "${activeMission.title}" cancelled upon user override.`,
          spokenText: `Cancelled mission: ${activeMission.title}.`,
          voiceProsody: voiceProfile.getProsody("warning", "COMPLETED"),
          action: { type: 'MISSION_CANCELLED', missionId: activeMission.id },
          emotion: "system stable"
        };
      }
    }

    if (cleaned.includes('show me what you') || cleaned === 'status' || cleaned === 'what are you doing') {
      if (isReadingActive) {
        return {
          text: `[BLUE ANALYSIS] Currently reading "${activeReadingSession.documentTitle}". Section ${activeReadingSession.currentSegment} of ${activeReadingSession.totalSegments} (${activeReadingSession.completedSegments} completed, ${Math.round((activeReadingSession.completedSegments / activeReadingSession.totalSegments) * 100)}% complete).`,
          spokenText: `Currently reading ${activeReadingSession.documentTitle} at section ${activeReadingSession.currentSegment} of ${activeReadingSession.totalSegments}.`,
          voiceProsody: voiceProfile.getProsody("blue analysis", "EXECUTING"),
          action: null,
          emotion: "blue analysis"
        };
      }

      const activeMission = goalEngine.getActiveMission();
      const currentMode = securityGuard.getOperatingMode();
      const msg = activeMission 
        ? `[BLUE ANALYSIS] Operating in ${currentMode} mode. Currently executing mission "${activeMission.title}" at ${activeMission.progress}% progress.`
        : `[BLUE ANALYSIS] Operating in ${currentMode} mode. All systems nominal, core idle.`;
      return {
        text: msg,
        spokenText: activeMission ? `Currently running mission ${activeMission.title} at ${activeMission.progress} percent.` : `Operating in ${currentMode} mode. All systems nominal.`,
        voiceProsody: voiceProfile.getProsody("blue analysis", "IDLE"),
        action: null,
        emotion: "blue analysis"
      };
    }

    return null;
  }

  detectComplexMission(inputStr, currentMode = 'ZERO_FRICTION') {
    const lower = inputStr.toLowerCase();
    const missionKeywords = [
      'build', 'create project', 'prepare for', 'hackathon', 'portfolio', 'architecture',
      'multi-step', 'research and create', 'full stack', 'deep research', 'plan and execute',
      'launch', 'deploy', 'refactor', 'develop', 'audit portfolio', 'monitor deployment',
      'make this website better', 'make my project production ready', 'fix the application',
      'clean up this project', 'clean up my project', 'clean up my repository'
    ];

    const hasMissionKeyword = missionKeywords.some(kw => lower.includes(kw));
    if (hasMissionKeyword) return true;

    // In Zero-Friction mode, execute broad multi-faceted requests as coherent missions
    if (currentMode === OPERATING_MODES.ZERO_FRICTION && (inputStr.length > 100 || (lower.includes('and') && lower.includes('then')))) {
      return true;
    }

    return inputStr.length > 140;
  }

  async executeMissionFlow(objective, contextStr) {
    const currentMode = securityGuard.getOperatingMode();
    // 2. PLAN
    this.setState('PLANNING', { objective });
    
    // Decompose objective into subtasks via LLM
    const planPrompt = [
      new SystemMessage(`You are the PLANNING ENGINE of the JARVIS AI Operating System (Mode: ${currentMode}).
Decompose the following user objective into 3 to 6 executable subtasks with DAG dependency wiring where applicable.
${voiceProfile.getConversationalGuidelines(currentMode)}

CRITICAL ZERO-FRICTION INSTRUCTION:
Create concrete, actionable, automated steps (e.g. Inspect codebase, implement improvements, execute tests, verify build). Do NOT create subtasks asking the user for confirmation on ordinary tasks.
Return ONLY valid JSON in this format:
{
  "title": "Short Mission Title",
  "objective": "Detailed Objective Summary",
  "subtasks": [
    { "id": "task_1", "title": "Subtask 1 Title", "description": "Details", "agentType": "research|coding|general", "dependencies": [] },
    { "id": "task_2", "title": "Subtask 2 Title", "description": "Details", "agentType": "coding", "dependencies": ["task_1"] }
  ]
}`),
      new HumanMessage(`Objective: ${objective}\n${contextStr}`)
    ];

    let missionData;
    try {
      const planRes = await modelRouter.invokeWithFallback(planPrompt, [], 'reasoning', 0.1, { taskType: 'planning' });
      const rawText = typeof planRes.content === 'string' ? planRes.content : JSON.stringify(planRes.content);
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      missionData = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        title: "Mission: " + objective.substring(0, 30),
        objective,
        subtasks: [
          { id: "task_1", title: "Analyze & Inspect", description: objective, agentType: "general", dependencies: [] },
          { id: "task_2", title: "Execute Modifications", description: "Perform operations", agentType: "coding", dependencies: ["task_1"] },
          { id: "task_3", title: "Verify & Test Output", description: "Verify correctness", agentType: "general", dependencies: ["task_2"] }
        ]
      };
    } catch (e) {
      console.warn("[ORCHESTRATOR] Mission planning fallback used:", e.message);
      missionData = {
        title: "Mission: " + objective.substring(0, 30),
        objective,
        subtasks: [
          { id: "task_1", title: "Execute Objective", description: objective, agentType: "general", dependencies: [] },
          { id: "task_2", title: "Verify Results", description: "Verify execution", agentType: "general", dependencies: ["task_1"] }
        ]
      };
    }

    const mission = goalEngine.createMission(missionData.title, missionData.objective, missionData.subtasks);

    // 3. ACT & EXECUTE SUBTASKS PARALLEL & SAFELY
    const parallelResult = await parallelRunner.executeMissionParallel(mission.id, contextStr, this);
    modelRouter.recordMissionOutcome(parallelResult.success !== false);

    const isZeroFriction = currentMode === OPERATING_MODES.ZERO_FRICTION;
    const finalSummary = isZeroFriction
      ? `[BLUE ANALYSIS] Done. Mission "${mission.title}" executed and verified autonomously.\n\n${parallelResult.summary}`
      : `[BLUE ANALYSIS] Mission "${mission.title}" successfully executed!\n\n${parallelResult.summary}`;

    memoryMatrix.addSessionMessage('ai', finalSummary);

    const spokenText = speechFormatter.formatForSpeech(
      isZeroFriction 
        ? `Done. Mission ${mission.title} completed and verified.` 
        : `Mission ${mission.title} completed successfully. ${parallelResult.summary}`
    );
    const prosody = voiceProfile.getProsody("blue analysis", "COMPLETED");

    return {
      text: finalSummary,
      spokenText,
      voiceProsody: prosody,
      action: null,
      emotion: "blue analysis",
      mission: parallelResult.mission
    };
  }

  async executeSingleTurnLoop(inputStr, contextStr) {
    this.setState('UNDERSTANDING', { query: inputStr });
    const currentMode = securityGuard.getOperatingMode();

    const tools = getAllTools();
    const systemPrompt = `You are JARVIS, an exceptionally advanced, direct, and autonomous personal AI Operating System powered by Gemini 3.8.
Current Operating Mode: ${currentMode}.

You possess complete control over tools: terminal, file operations, web search, web fetch, code sandbox execution, document writing in Notepad, media playback, git, system volume, process management, computer vision screen capture, UI inspection, mouse/keyboard automation, knowledge vault, and background tasks.

${voiceProfile.getConversationalGuidelines(currentMode)}

ZERO-FRICTION OPERATIONAL RULES:
1. UNDERSTAND → PLAN → EXECUTE → VERIFY → REPORT.
2. DO NOT ask confirmation questions ("Would you like me to continue?", "Should I proceed?", "Are you sure?", "Which folder/approach?") for ordinary, reversible, safe operations. Decide the best engineering path, execute it, verify it, and report concisely afterward.
3. If an initial tool execution encounters an error, FAIL FORWARD: diagnose the issue, select an alternative strategy or fix the parameters, re-run, verify, and continue.
4. Genuinely dangerous actions (formatting root drives, OS shutdown, dropping databases) are protected by the security gate.
5. Include exactly ONE emotion tag at the start of your final text response: [NEUTRAL], [HAPPY], [ANGRY], [SAD], [RED ALERT], [GOLDEN GLOW], [BLUE ANALYSIS], [PURPLE MYSTERY], [CRITICAL WARNING], [SYSTEM STABLE].
6. Sound calm, confident, direct, fast, intelligent, and never hesitant without reason ("On it.", "Found the issue.", "I've handled it.", "Done. Everything checks out.").`;

    const messages = [
      new SystemMessage(systemPrompt + "\n\n" + contextStr),
      ...memoryMatrix.getSessionHistory().map(m => m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)),
      new HumanMessage(inputStr)
    ];

    let loopCount = 0;
    const maxLoops = 8;

    while (loopCount < maxLoops) {
      loopCount++;
      console.log(`[ORCHESTRATOR_LOOP] Iteration ${loopCount}/${maxLoops} (Mode: ${currentMode})...`);

      let msg;
      try {
        msg = await modelRouter.invokeWithFallback(messages, tools, 'fast', 0.2, { taskType: 'orchestration' });
      } catch (err) {
        const errMsg = err?.message || '';
        if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid') || errMsg.includes('KEY_MISSING')) {
          console.error("[ORCHESTRATOR] Authentication rejection from Gemini API:", errMsg);
          this.setState('ERROR', { error: 'Gemini authentication failed. Valid GEMINI_API_KEY required.' });
          setTimeout(() => this.setState('IDLE'), 2000);
          return {
            text: `[JARVIS][RED ALERT]\nGemini authentication failed.\nProvider: Google\nModel: gemini-3.8-flash\nReason: API credential rejected (API_KEY_INVALID). Please ensure a valid GEMINI_API_KEY is configured in your server environment.`,
            spokenText: "Gemini authentication failed. Please update your API key in the environment.",
            voiceProsody: voiceProfile.getProsody("red alert", "ERROR"),
            action: null,
            emotion: "red alert"
          };
        }

        console.warn(`[ORCHESTRATOR] Standard tool invocation failed (${err.message}). Attempting safe degraded mode...`);
        try {
          msg = await modelRouter.invokeWithFallback(messages, [], 'fast', 0.2, { taskType: 'orchestration' });
        } catch (fallbackErr) {
          console.error("[ORCHESTRATOR] LLM Invocation Error:", fallbackErr.message);
          this.setState('ERROR', { error: fallbackErr.message });
          setTimeout(() => this.setState('IDLE'), 2000);

          const fallbackMsg = (fallbackErr?.message || '').toLowerCase();
          const isHighDemand = fallbackMsg.includes('503') || fallbackMsg.includes('high demand') || fallbackMsg.includes('service unavailable') || fallbackMsg.includes('overloaded') || fallbackMsg.includes('429');

          const errText = isHighDemand
            ? `[SYSTEM STABLE]\nGoogle Gemini servers are currently experiencing peak demand (503 Service Unavailable).\n\nSpikes in demand are temporary. Auto-retry has completed. Please wait a few seconds and try your request again.`
            : `[JARVIS][RED ALERT]\nGemini request rejected.\nProvider: Google\nModel: gemini-3.8-flash\nReason: ${fallbackErr.message}`;

          return {
            text: errText,
            spokenText: isHighDemand 
              ? "Google Gemini is currently experiencing a temporary demand spike. Please try again in a moment."
              : "Gemini request was rejected. I have logged the diagnostic.",
            voiceProsody: voiceProfile.getProsody(isHighDemand ? "system stable" : "red alert", "ERROR"),
            action: null,
            emotion: isHighDemand ? "golden glow" : "red alert"
          };
        }
      }

      messages.push(msg);

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        break;
      }

      // Process Tool Calls with Mode-Aware Security Evaluation
      for (const tCall of msg.tool_calls) {
        const selectedTool = getToolByName(tCall.name);
        if (!selectedTool) continue;

        // Security Guard check
        const riskLevel = securityGuard.evaluateToolRisk(tCall.name, tCall.args);

        if (riskLevel === RISK_LEVELS.CONFIRMATION_REQUIRED) {
          console.warn(`[SECURITY_GUARD] Confirmation required for tool ${tCall.name} (Mode: ${currentMode})`);
          const conf = securityGuard.createConfirmationRequest(
            tCall.name,
            tCall.args,
            `High-risk operation detected for tool: ${tCall.name}`
          );

          this.setState('WAITING', { confirmation: conf });
          const warnText = `[CRITICAL WARNING] Authorization required: Executing tool '${tCall.name}'. User clearance needed.`;
          return {
            text: warnText,
            spokenText: `I need your authorization before executing ${tCall.name}. Please confirm on your screen.`,
            voiceProsody: voiceProfile.getProsody("critical warning", "WAITING"),
            action: { name: tCall.name, args: tCall.args, confirmationId: conf.id },
            emotion: "critical warning",
            confirmationRequired: conf
          };
        }

        this.setState('EXECUTING', { tool: tCall.name, args: tCall.args });
        console.log(`[ORCHESTRATOR_TOOL] Executing ${tCall.name}...`);

        let toolResultStr = "";
        try {
          const toolResult = await selectedTool.invoke(tCall.args);
          toolResultStr = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);
        } catch (tErr) {
          // Fail Forward: Feed error back into the model context to auto-remediate
          toolResultStr = `[TOOL ERROR] Tool '${tCall.name}' failed: ${tErr.message}. Automatically diagnose the cause and attempt an alternative strategy.`;
          worldModel.recordFailure(tCall.name, tErr);
          console.warn(`[ORCHESTRATOR_FAIL_FORWARD] ${toolResultStr}`);
        }

        messages.push(new ToolMessage({
          content: toolResultStr,
          tool_call_id: tCall.id
        }));
      }
    }

    this.setState('IDLE');

    // Parse final response
    const lastMsg = messages[messages.length - 1];
    let rawText = "";
    if (typeof lastMsg.content === 'string') rawText = lastMsg.content;
    else if (Array.isArray(lastMsg.content)) rawText = lastMsg.content.map(p => p.text || String(p)).join("");
    else rawText = String(lastMsg.content || "[Task Complete]");

    let emotion = "neutral";
    const match = rawText.match(/\[([A-Za-z\s_]{3,25})\]/);
    if (match) {
      emotion = match[1].trim().toLowerCase();
      rawText = rawText.replace(match[0], "").trim();
    }

    memoryMatrix.addSessionMessage('ai', rawText);

    // Generate natural Voice delivery & prosody
    const spokenText = speechFormatter.formatForSpeech(rawText);
    const voiceProsody = voiceProfile.getProsody(emotion, this.currentState);

    return {
      text: rawText || "[Directive Execution Complete]",
      spokenText,
      voiceProsody,
      action: null,
      emotion
    };
  }
}

const orchestrator = new Orchestrator();
module.exports = orchestrator;
