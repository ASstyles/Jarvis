require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const assert = require('assert');
const MODEL_CONFIG = require('../src/config/modelConfig');
const modelRouter = require('../src/llm/modelRouter');
const geminiAdapter = require('../src/llm/geminiAdapter');
const { credentialManager } = require('../src/security/credentialManager');
const { validateToolsForGemini, checkGeminiSchemaCompatibility } = require('../src/tools/toolValidator');
const { readingSessionManager } = require('../src/reading/readingSessionManager');
const { documentExtractor } = require('../src/reading/documentExtractor');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { z } = require('zod');

console.log("===============================================================");
console.log("  JARVIS GEMINI 3.8 ARCHITECTURE INTEGRATION TEST SUITE       ");
console.log("===============================================================\n");

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

async function executeAllTests() {
  // -------------------------------------------------------------
  // 1. CENTRALIZED MODEL CONFIGURATION & MODEL ROUTING TESTS
  // -------------------------------------------------------------
  console.log("--- SECTION 1: CENTRALIZED GEMINI 3.8 CONFIGURATION ---");

  runTest("Central config defines gemini-3.8-flash as primary model", () => {
    assert.strictEqual(MODEL_CONFIG.GEMINI.PRIMARY, 'gemini-3.8-flash');
  });

  runTest("Central config defines gemini-3.8-live as real-time voice model", () => {
    assert.strictEqual(MODEL_CONFIG.GEMINI.LIVE, 'gemini-3.8-live');
  });

  runTest("Central config defines gemini-3.8-flash-tts as speech synthesis model", () => {
    assert.strictEqual(MODEL_CONFIG.GEMINI.TTS, 'gemini-3.8-flash-tts');
  });

  runTest("Fallback sequence strictly excludes gemini-2.0-flash", () => {
    const geminiFallbacks = MODEL_CONFIG.FALLBACKS.gemini;
    assert.strictEqual(geminiFallbacks.includes('gemini-2.0-flash'), false);
    assert.strictEqual(geminiFallbacks.includes('gemini-2.0'), false);
    assert.strictEqual(geminiFallbacks[0], 'gemini-3.8-flash');
  });

  runTest("geminiAdapter.validateModel prevents gemini-2.0-flash from executing", () => {
    assert.strictEqual(geminiAdapter.validateModel('gemini-2.0-flash'), 'gemini-3.8-flash');
    assert.strictEqual(geminiAdapter.validateModel('gemini-2.0'), 'gemini-3.8-flash');
    assert.strictEqual(geminiAdapter.validateModel('models/gemini-2.0-flash'), 'gemini-3.8-flash');
    assert.strictEqual(geminiAdapter.validateModel('gemini-3.8-flash'), 'gemini-3.8-flash');
  });

  runTest("Thinking levels define low, medium, high with default as medium", () => {
    assert.strictEqual(MODEL_CONFIG.DEFAULT_THINKING_LEVEL, 'medium');
    assert.strictEqual(MODEL_CONFIG.THINKING_LEVELS.low.thinkingLevel, 'low');
    assert.strictEqual(MODEL_CONFIG.THINKING_LEVELS.medium.thinkingLevel, 'medium');
    assert.strictEqual(MODEL_CONFIG.THINKING_LEVELS.high.thinkingLevel, 'high');
  });

  runTest("getThinkingConfig returns high thinkingLevel for reasoning and planning", () => {
    const planCfg = MODEL_CONFIG.getThinkingConfig('reasoning', 'planning');
    assert.strictEqual(planCfg.thinkingLevel, 'high');
  });

  runTest("getThinkingConfig returns medium thinkingLevel for coding and research", () => {
    const codingCfg = MODEL_CONFIG.getThinkingConfig('coding', 'coding');
    const researchCfg = MODEL_CONFIG.getThinkingConfig('fast', 'research');
    assert.strictEqual(codingCfg.thinkingLevel, 'medium');
    assert.strictEqual(researchCfg.thinkingLevel, 'medium');
  });

  runTest("getThinkingConfig returns low thinkingLevel for tool_calling", () => {
    const toolCfg = MODEL_CONFIG.getThinkingConfig('fast', 'tool_calling');
    assert.strictEqual(toolCfg.thinkingLevel, 'low');
  });

  runTest("getThinkingConfig defaults to medium for general tasks", () => {
    const defaultCfg = MODEL_CONFIG.getThinkingConfig('fast', 'general');
    assert.strictEqual(defaultCfg.thinkingLevel, 'medium');
  });

  // -------------------------------------------------------------
  // 2. GEMINI ADAPTER — SEPARATION OF INTERNAL CONFIG FROM GOOGLE CONFIG
  // -------------------------------------------------------------
  console.log("\n--- SECTION 2: GEMINI ADAPTER & STRICT SCHEMA ISOLATION ---");

  runTest("Adapter converts internal { thinking: { level, label } } to ONLY { thinkingLevel: 'medium' }", () => {
    const internalConfig = {
      thinking: {
        level: "medium",
        label: "balanced reasoning"
      }
    };
    const googleThinking = geminiAdapter.buildGoogleThinkingConfig(internalConfig);

    assert.deepStrictEqual(googleThinking, { thinkingLevel: "medium" });
    assert.strictEqual(googleThinking.level, undefined);
    assert.strictEqual(googleThinking.label, undefined);
    assert.strictEqual(googleThinking.thinkingBudget, undefined);
  });

  runTest("Adapter converts internal { thinking_config: { level, label } } correctly", () => {
    const internalConfig = {
      thinking_config: {
        level: "high",
        label: "deep reasoning"
      }
    };
    const googleThinking = geminiAdapter.buildGoogleThinkingConfig(internalConfig);

    assert.deepStrictEqual(googleThinking, { thinkingLevel: "high" });
    assert.strictEqual(googleThinking.level, undefined);
    assert.strictEqual(googleThinking.label, undefined);
  });

  runTest("Adapter strips internal metadata from MODEL_CONFIG.THINKING_LEVELS objects", () => {
    const internal = MODEL_CONFIG.THINKING_LEVELS.high;
    const googleThinking = geminiAdapter.buildGoogleThinkingConfig(internal);

    assert.deepStrictEqual(googleThinking, { thinkingLevel: "high" });
    assert.strictEqual('level' in googleThinking, false);
    assert.strictEqual('label' in googleThinking, false);
    assert.strictEqual('internalLevel' in googleThinking, false);
    assert.strictEqual('thinkingBudget' in googleThinking, false);
  });

  runTest("Adapter handles low, medium, high thinking level requests", () => {
    assert.deepStrictEqual(geminiAdapter.buildGoogleThinkingConfig('low'), { thinkingLevel: 'low' });
    assert.deepStrictEqual(geminiAdapter.buildGoogleThinkingConfig('medium'), { thinkingLevel: 'medium' });
    assert.deepStrictEqual(geminiAdapter.buildGoogleThinkingConfig('high'), { thinkingLevel: 'high' });
  });

  runTest("validateGoogleThinkingConfig throws if 'level' or 'label' reaches payload", () => {
    assert.throws(() => {
      geminiAdapter.validateGoogleThinkingConfig({ level: "medium" });
    }, /Forbidden internal field "level"/);

    assert.throws(() => {
      geminiAdapter.validateGoogleThinkingConfig({ label: "balanced" });
    }, /Forbidden internal field "label"/);

    assert.throws(() => {
      geminiAdapter.validateGoogleThinkingConfig({ thinking_budget: 4096 });
    }, /Forbidden internal field "thinking_budget"/);
  });

  runTest("validateGoogleThinkingConfig throws if thinkingLevel is invalid", () => {
    assert.throws(() => {
      geminiAdapter.validateGoogleThinkingConfig({ thinkingLevel: "extreme" });
    }, /Invalid thinkingLevel "extreme"/);
  });

  runTest("validateGoogleThinkingConfig passes for valid thinkingLevel: low, medium, high", () => {
    assert.doesNotThrow(() => geminiAdapter.validateGoogleThinkingConfig({ thinkingLevel: "low" }));
    assert.doesNotThrow(() => geminiAdapter.validateGoogleThinkingConfig({ thinkingLevel: "medium" }));
    assert.doesNotThrow(() => geminiAdapter.validateGoogleThinkingConfig({ thinkingLevel: "high" }));
  });

  runTest("validateOutboundGeminiConfig validates full ChatGoogleGenerativeAI config", () => {
    const validConfig = {
      model: 'gemini-3.8-flash',
      thinkingConfig: { thinkingLevel: 'medium' }
    };
    assert.doesNotThrow(() => geminiAdapter.validateOutboundGeminiConfig(validConfig));
    assert.strictEqual(validConfig.model, 'gemini-3.8-flash');

    const invalidConfig = {
      model: 'gemini-2.0-flash',
      thinkingConfig: { thinkingLevel: 'medium' }
    };
    geminiAdapter.validateOutboundGeminiConfig(invalidConfig);
    // Must sanitize model to gemini-3.8-flash
    assert.strictEqual(invalidConfig.model, 'gemini-3.8-flash');
  });

  // -------------------------------------------------------------
  // 3. MODEL ROUTER & TELEMETRY TESTS
  // -------------------------------------------------------------
  console.log("\n--- SECTION 3: MODEL ROUTER & GEMINI 3.8 TELEMETRY ---");

  runTest("Model router resolves gemini-3.8-flash for fast and reasoning tiers", () => {
    const fastModel = modelRouter.getModelNameForTier('fast', 'gemini');
    const reasoningModel = modelRouter.getModelNameForTier('reasoning', 'gemini');
    assert.strictEqual(fastModel, 'gemini-3.8-flash');
    assert.strictEqual(reasoningModel, 'gemini-3.8-flash');
  });

  runTest("Fallback sequence prioritizes gemini-3.8-flash as index 0 and has no gemini-2.0", () => {
    const seq = modelRouter.getFallbackSequence('gemini-3.8-flash', 'gemini');
    assert.strictEqual(seq[0], 'gemini-3.8-flash');
    assert.strictEqual(seq.some(m => m.includes('gemini-2.0')), false);
  });

  runTest("Telemetry structure tracks Gemini 3.8 specifically", () => {
    const stats = modelRouter.getStats();
    assert(stats.models['gemini-3.8-flash'], 'gemini-3.8-flash telemetry must exist');
    assert(stats.models['gemini-3.8-live'], 'gemini-3.8-live telemetry must exist');
    assert(stats.models['gemini-3.8-flash-tts'], 'gemini-3.8-flash-tts telemetry must exist');
    assert.strictEqual(stats.primaryModel, 'gemini-3.8-flash');
  });

  runTest("recordSuccess records token usage, tool calls, and thinking level", () => {
    modelRouter.recordSuccess({
      provider: 'gemini',
      modelName: 'gemini-3.8-flash',
      duration: 350,
      messages: [{ role: 'user', content: 'hello world' }],
      tools: [],
      response: { content: 'Greetings', tool_calls: [{ name: 'test_tool' }] },
      isFallback: false,
      primaryModel: 'gemini-3.8-flash',
      taskType: 'coding',
      thinkingConfig: { thinkingLevel: 'medium' }
    });

    const updatedStats = modelRouter.getStats();
    assert.strictEqual(updatedStats.successfulInvocations > 0, true);
    assert.strictEqual(updatedStats.models['gemini-3.8-flash'].requestCount > 0, true);
    assert.strictEqual(updatedStats.models['gemini-3.8-flash'].toolCallCount > 0, true);
    assert.strictEqual(updatedStats.models['gemini-3.8-flash'].thinkingUsage.count > 0, true);
    assert.strictEqual(updatedStats.models['gemini-3.8-flash'].thinkingUsage.activeLevel, 'medium');
  });

  runTest("recordFailure captures fallback incident diagnostic with reason", () => {
    modelRouter.recordFailure({
      provider: 'gemini',
      modelName: 'gemini-3.8-flash',
      duration: 500,
      error: new Error("429 Resource has been exhausted (quota)"),
      primaryModel: 'gemini-3.8-flash',
      nextModel: 'gemini-2.5-flash',
      taskType: 'planning'
    });

    const stats = modelRouter.getStats();
    assert(stats.fallbackIncidents.length > 0);
    assert.strictEqual(stats.fallbackIncidents[0].reasonForFallback, 'RATE_LIMIT_OR_QUOTA_EXHAUSTED');
  });

  // -------------------------------------------------------------
  // 4. TOOL VALIDATION & 6-STAGE PRE-FLIGHT PIPELINE
  // -------------------------------------------------------------
  console.log("\n--- SECTION 4: TOOL CALLING VALIDATION & 6-STAGE PIPELINE ---");

  runTest("Validates valid tool with unique name and Zod schema", () => {
    const testTool = {
      name: "test_verified_tool",
      description: "A tool to verify math operations",
      schema: z.object({ x: z.number(), y: z.number() }),
      invoke: async ({ x, y }) => x + y
    };

    const validated = validateToolsForGemini([testTool]);
    assert.strictEqual(validated.length, 1);
    assert.strictEqual(validated[0].name, "test_verified_tool");
    assert(validated[0].securityClassification, "Security classification must be attached");
    assert(validated[0].timeoutMs > 0, "Timeout must be attached");
  });

  runTest("Rejects duplicate tool names cleanly", () => {
    const t1 = {
      name: "duplicate_check_tool",
      description: "Instance 1",
      schema: z.object({ a: z.string() })
    };
    const t2 = {
      name: "duplicate_check_tool",
      description: "Instance 2",
      schema: z.object({ b: z.string() })
    };

    assert.throws(() => {
      validateToolsForGemini([t1, t2], { throwOnDuplicate: true });
    }, /DUPLICATE_TOOL_ERROR/);
  });

  runTest("Rejects invalid schemas that generate illegal propertyNames", () => {
    const unTypedRecord = z.record(z.any());
    const compat = checkGeminiSchemaCompatibility(unTypedRecord);
    assert.strictEqual(compat.valid, false);
  });

  // -------------------------------------------------------------
  // 5. DOCUMENT READING REQUIREMENT (EXTRACTED VS ACTUALLY SPOKEN)
  // -------------------------------------------------------------
  console.log("\n--- SECTION 5: DOCUMENT READING & EXTRACTED VS SPOKEN DISTINCTION ---");

  runTest("Reading session distinguishes textExtracted from textActuallySpoken", () => {
    const dummyDoc = {
      documentId: 'doc_test_1',
      title: 'Test Letter',
      text: 'Sentence one. Sentence two. Sentence three.',
      totalCharacters: 42,
      totalWords: 6,
      extractionModel: 'gemini-3.8-flash'
    };

    const session = readingSessionManager.createSession(dummyDoc);
    assert.strictEqual(session.textExtracted, dummyDoc.text);
    assert.strictEqual(session.textActuallySpoken, "");
    assert.strictEqual(session.speechModel, 'gemini-3.8-flash-tts');
    assert.strictEqual(session.extractionModel, 'gemini-3.8-flash');
  });

  runTest("Does NOT verify completion if speech playback was not completed", () => {
    const verification = readingSessionManager.verifySessionCompletion();
    assert.strictEqual(verification.verified, false);
    assert.strictEqual(verification.status !== 'COMPLETED', true);
  });

  runTest("Accumulates textActuallySpoken upon segment completion", () => {
    const active = readingSessionManager.getActiveSession();
    assert(active, "Active session must exist");
    
    // Mark segment 1 completed
    readingSessionManager.updateSegmentStatus(1, 'COMPLETED');
    const telemetry = readingSessionManager.getTelemetry();
    assert(telemetry.textActuallySpokenLength > 0, "textActuallySpoken must accumulate spoken words");
  });

  // -------------------------------------------------------------
  // 6. LIVE VOICE & INTERRUPT BARGE-IN SPECIFICATION
  // -------------------------------------------------------------
  console.log("\n--- SECTION 6: GEMINI 3.8 LIVE VOICE & BARGE-IN INTERRUPT ---");

  runTest("Gemini provider creates live voice session config for gemini-3.8-live", () => {
    const provider = modelRouter.getProvider('gemini');
    const liveConfig = provider.createLiveSessionConfig({ voice: 'Aoede' });
    assert.strictEqual(liveConfig.model, 'gemini-3.8-live');
    assert.strictEqual(liveConfig.provider, 'gemini-3.8-live');
    assert.strictEqual(liveConfig.interruptionAllowed, true);
  });

  await runAsyncTest("Gemini provider creates TTS synthesis config for gemini-3.8-flash-tts", async () => {
    const provider = modelRouter.getProvider('gemini');
    const ttsRes = await provider.synthesizeSpeech("Welcome back, Sir.", { voice: 'Puck' });
    assert.strictEqual(ttsRes.model, 'gemini-3.8-flash-tts');
    assert.strictEqual(ttsRes.provider, 'gemini-3.8-flash-tts');
    assert.strictEqual(ttsRes.text, "Welcome back, Sir.");
  });

  runTest("Interruption stops active reading session cleanly", () => {
    const stopRes = readingSessionManager.stopSession("User vocal barge-in");
    assert.strictEqual(readingSessionManager.getActiveSession().status, 'STOPPED');
    assert.strictEqual(readingSessionManager.getActiveSession().interrupted, true);
  });

  // -------------------------------------------------------------
  // 7. NETWORK & PAYLOAD VERIFICATION (NO GEMINI 2.0, NO LEVEL/LABEL)
  // -------------------------------------------------------------
  console.log("\n--- SECTION 7: OUTBOUND NETWORK & PAYLOAD VERIFICATION ---");

  await runAsyncTest("ChatGoogleGenerativeAI with thinkingLevel generates valid gemini-3.8-flash request", async () => {
    const provider = modelRouter.getProvider('gemini');
    const chat = provider.createChatInstance('gemini-3.8-flash', 0.2, {
      thinking: {
        level: 'medium',
        label: 'balanced reasoning'
      }
    });

    // Verify chat model properties
    assert.strictEqual(chat.model, 'gemini-3.8-flash');
    assert.deepStrictEqual(chat.thinkingConfig, { thinkingLevel: 'medium' });
    assert.strictEqual(chat.thinkingConfig.level, undefined);
    assert.strictEqual(chat.thinkingConfig.label, undefined);

    // Verify invocation reaches Google's endpoint with gemini-3.8-flash and valid payload structure
    try {
      await chat.invoke("Hello");
    } catch (err) {
      // Must NOT fail on payload parsing ("Unknown name 'level'" or "Unknown name 'label'")
      assert.strictEqual(err.message.includes('Unknown name "level"'), false, "Payload must not contain level");
      assert.strictEqual(err.message.includes('Unknown name "label"'), false, "Payload must not contain label");
      // Must target gemini-3.8-flash endpoint
      assert(err.message.includes('gemini-3.8-flash'), `Outbound request must target gemini-3.8-flash, got: ${err.message}`);
      assert.strictEqual(err.message.includes('gemini-2.0-flash'), false, "Outbound request must NOT target gemini-2.0-flash");
    }
  });

  await runAsyncTest("Raw GoogleGenerativeAI with thinkingLevel produces clean schema accepted by Google", async () => {
    const apiKey = credentialManager.getGeminiApiKey() || "dummy-key-for-schema-verification-only";
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.8-flash',
      generationConfig: {
        thinkingConfig: {
          thinkingLevel: 'medium'
        }
      }
    });

    try {
      await model.generateContent("Hello");
    } catch (err) {
      // Must NOT have unknown field error for thinking_config
      assert.strictEqual(err.message.includes('Unknown name "level"'), false);
      assert.strictEqual(err.message.includes('Unknown name "label"'), false);
      assert(err.message.includes('gemini-3.8-flash'), `Must target gemini-3.8-flash: ${err.message}`);
    }
  });

  // -------------------------------------------------------------
  // 8. REQUIREMENT 11 REGRESSION TEST SUITE (A THROUGH I)
  // -------------------------------------------------------------
  console.log("\n--- SECTION 8: REQUIREMENT 11 REGRESSION SUITE (A THROUGH I) ---");

  // A. Basic request: "Hello"
  await runAsyncTest("Test A: Basic request ('Hello') routes to gemini-3.8-flash", async () => {
    const provider = modelRouter.getProvider('gemini');
    const chat = provider.createChatInstance('gemini-3.8-flash', 0.2);
    assert.strictEqual(chat.model, 'gemini-3.8-flash');
    try {
      await chat.invoke("Hello");
    } catch (err) {
      assert(err.message.includes('gemini-3.8-flash'), "Must target gemini-3.8-flash");
      assert.strictEqual(err.message.includes('gemini-2.0'), false);
    }
  });

  // B. Normal JARVIS request: "What can you do for me?"
  await runAsyncTest("Test B: Normal JARVIS request ('What can you do for me?') resolves properly", async () => {
    const resolvedModel = modelRouter.getModelNameForTier('fast', 'gemini');
    assert.strictEqual(resolvedModel, 'gemini-3.8-flash');
    const provider = modelRouter.getProvider('gemini');
    const chat = provider.createChatInstance(resolvedModel, 0.2);
    try {
      await chat.invoke("What can you do for me?");
    } catch (err) {
      assert(err.message.includes('gemini-3.8-flash'));
      assert.strictEqual(err.message.includes('gemini-2.0'), false);
    }
  });

  // C. Tool-enabled request
  runTest("Test C: Tool-enabled request binds tools without schema rejection", () => {
    const provider = modelRouter.getProvider('gemini');
    const chat = provider.createChatInstance('gemini-3.8-flash', 0.2);
    const testTool = {
      name: "sample_system_tool",
      description: "Sample tool for regression check",
      schema: z.object({ query: z.string() })
    };
    const { llm, boundCount } = provider.safelyBindTools(chat, [testTool]);
    assert.strictEqual(boundCount, 1);
    assert(llm);
  });

  // D. Reasoning request: Expected thinkingLevel=medium
  runTest("Test D: Standard reasoning request uses thinkingLevel=medium", () => {
    const config = MODEL_CONFIG.getThinkingConfig('coding', 'coding');
    const googleCfg = geminiAdapter.buildGoogleThinkingConfig(config);
    assert.strictEqual(googleCfg.thinkingLevel, 'medium');
  });

  // E. Low reasoning request: Expected thinkingLevel=low
  runTest("Test E: Low reasoning request uses thinkingLevel=low", () => {
    const config = MODEL_CONFIG.getThinkingConfig('fast', 'tool_calling');
    const googleCfg = geminiAdapter.buildGoogleThinkingConfig(config);
    assert.strictEqual(googleCfg.thinkingLevel, 'low');
  });

  // F. High reasoning request: Expected thinkingLevel=high
  runTest("Test F: High reasoning request uses thinkingLevel=high", () => {
    const config = MODEL_CONFIG.getThinkingConfig('reasoning', 'planning');
    const googleCfg = geminiAdapter.buildGoogleThinkingConfig(config);
    assert.strictEqual(googleCfg.thinkingLevel, 'high');
  });

  // G. Invalid internal metadata stripping
  runTest("Test G: Internal { thinking: { level: 'medium', label: 'balanced' } } strips all metadata", () => {
    const internal = { thinking: { level: "medium", label: "balanced" } };
    const googleThinking = geminiAdapter.buildGoogleThinkingConfig(internal);
    assert.deepStrictEqual(googleThinking, { thinkingLevel: "medium" });
    assert.strictEqual(googleThinking.label, undefined);
    assert.strictEqual(googleThinking.level, undefined);
  });

  // H. No request may contain thinkingConfig.level or thinkingConfig.label
  runTest("Test H: Outbound payload rejects thinkingConfig.level and thinkingConfig.label", () => {
    const badPayload1 = { thinkingConfig: { level: 'medium' } };
    const badPayload2 = { thinkingConfig: { label: 'balanced' } };
    assert.throws(() => geminiAdapter.validateGoogleThinkingConfig(badPayload1.thinkingConfig), /level/);
    assert.throws(() => geminiAdapter.validateGoogleThinkingConfig(badPayload2.thinkingConfig), /label/);
  });

  // I. No runtime request may call gemini-2.0-flash
  runTest("Test I: No runtime request or fallback may call gemini-2.0-flash", () => {
    assert.strictEqual(MODEL_CONFIG.FALLBACKS.gemini.includes('gemini-2.0-flash'), false);
    assert.strictEqual(geminiAdapter.validateModel('gemini-2.0-flash'), 'gemini-3.8-flash');
    const seq = modelRouter.getFallbackSequence('gemini-3.8-flash', 'gemini');
    assert.strictEqual(seq.includes('gemini-2.0-flash'), false);
  });

  // -------------------------------------------------------------
  // 9. CREDENTIAL SECURITY, VALIDATION & STALE MODEL PURGE
  // -------------------------------------------------------------
  console.log("\n--- SECTION 9: CREDENTIAL SECURITY & STALE MODEL PURGE ---");

  runTest("CredentialManager safely strips wrapping quotes and whitespace", () => {
    assert.strictEqual(credentialManager.normalizeKey('  "AIzaSyTest123"  \n'), 'AIzaSyTest123');
    assert.strictEqual(credentialManager.normalizeKey("  'AIzaSyTest456'  \r\n"), 'AIzaSyTest456');
    assert.strictEqual(credentialManager.normalizeKey('your_gemini_api_key_here'), null);
    assert.strictEqual(credentialManager.normalizeKey(''), null);
    assert.strictEqual(credentialManager.normalizeKey(null), null);
  });

  runTest("CredentialManager prioritizes GEMINI_API_KEY over GOOGLE_API_KEY", () => {
    const origGemini = process.env.GEMINI_API_KEY;
    const origGoogle = process.env.GOOGLE_API_KEY;

    process.env.GEMINI_API_KEY = "AIzaSyPrimaryGeminiKey123456789";
    process.env.GOOGLE_API_KEY = "AIzaSySecondaryGoogleKey123456789";

    const resolved = credentialManager.getGeminiApiKey();
    assert.strictEqual(resolved, "AIzaSyPrimaryGeminiKey123456789");

    process.env.GEMINI_API_KEY = origGemini;
    process.env.GOOGLE_API_KEY = origGoogle;
  });

  runTest("Safe diagnostics payload never leaks the actual API key", () => {
    const diag = credentialManager.getSafeDiagnostics();
    assert.strictEqual(diag.provider, 'google');
    assert.strictEqual(diag.model, 'gemini-3.8-flash');
    assert('credentialConfigured' in diag);
    assert('credentialSource' in diag);
    assert('credentialLength' in diag);
    assert('apiKey' in diag === false, "apiKey must never be in diagnostics");
    assert('key' in diag === false, "key must never be in diagnostics");
  });

  runTest("geminiAdapter prevents all stale models: 2.5-pro, 2.5-flash, 2.0-flash, 1.5-flash", () => {
    assert.strictEqual(geminiAdapter.validateModel('gemini-2.5-pro'), 'gemini-3.8-flash');
    assert.strictEqual(geminiAdapter.validateModel('gemini-2.5-flash'), 'gemini-3.8-flash');
    assert.strictEqual(geminiAdapter.validateModel('gemini-2.0-flash'), 'gemini-3.8-flash');
    assert.strictEqual(geminiAdapter.validateModel('gemini-1.5-flash'), 'gemini-3.8-flash');
    assert.strictEqual(geminiAdapter.validateModel('gemini-1.5-pro'), 'gemini-3.8-flash');
  });

  runTest("geminiAdapter normalizes 'gemini-3.8-flash-high' to 'gemini-3.8-flash'", () => {
    assert.strictEqual(geminiAdapter.validateModel('gemini-3.8-flash-high'), 'gemini-3.8-flash');
    assert.strictEqual(geminiAdapter.validateModel('gemini-3.8-flash-medium'), 'gemini-3.8-flash');
    assert.strictEqual(geminiAdapter.validateModel('gemini-3.8-flash-low'), 'gemini-3.8-flash');
  });

  runTest("MODEL_CONFIG.FALLBACKS.gemini strictly excludes all 2.5, 2.0, and 1.5 models", () => {
    const geminiFallbacks = MODEL_CONFIG.FALLBACKS.gemini;
    assert.strictEqual(geminiFallbacks.length, 1);
    assert.strictEqual(geminiFallbacks[0], 'gemini-3.8-flash');
    assert.strictEqual(geminiFallbacks.includes('gemini-2.5-pro'), false);
    assert.strictEqual(geminiFallbacks.includes('gemini-2.5-flash'), false);
    assert.strictEqual(geminiFallbacks.includes('gemini-2.0-flash'), false);
    assert.strictEqual(geminiFallbacks.includes('gemini-1.5-flash'), false);
  });

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log("\n===============================================================");
  console.log(`  GEMINI 3.8 INTEGRATION TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

executeAllTests().catch(err => {
  console.error("Unhandled test runner error:", err);
  process.exit(1);
});
