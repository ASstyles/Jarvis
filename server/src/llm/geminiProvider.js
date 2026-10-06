const { BaseModelProvider } = require('./modelProvider');
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { validateToolsForGemini } = require("../tools/toolValidator");
const MODEL_CONFIG = require("../config/modelConfig");
const geminiAdapter = require("./geminiAdapter");
const { credentialManager } = require("../security/credentialManager");

/**
 * Google Gemini 3.8 Model Provider
 *
 * Implements the Gemini 3.8 model family architecture:
 * - gemini-3.8-flash (Primary reasoning, planning, coding, tools, multimodal)
 * - gemini-3.8-live (Real-time conversational voice)
 * - gemini-3.8-flash-tts (Speech synthesis & document reading)
 */
/**
 * Helper to identify transient errors (503 high demand, 429 rate limit, 500/502/504, network drops)
 */
function isTransientError(err) {
  const msg = (err?.message || String(err)).toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('service unavailable') ||
    msg.includes('high demand') ||
    msg.includes('spikes in demand') ||
    msg.includes('overloaded') ||
    msg.includes('429') ||
    msg.includes('resource exhausted') ||
    msg.includes('quota') ||
    msg.includes('too many requests') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('504') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('fetch failed')
  );
}

/**
 * Execute an asynchronous operation with exponential backoff on transient errors
 */
async function executeWithRetry(operation, maxRetries = 3, baseDelayMs = 1500) {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (err) {
      attempt++;
      const errMsg = (err?.message || String(err)).toLowerCase();
      const isAuthFailure = errMsg.includes('api_key_invalid') || errMsg.includes('api key not valid') || errMsg.includes('key_missing') || errMsg.includes('401');

      if (!isTransientError(err) || isAuthFailure || attempt > maxRetries) {
        throw err;
      }

      const jitter = Math.random() * 500;
      const delay = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
      console.warn(`[GEMINI_PROVIDER] Temporary upstream spike (${(err.message || '').substring(0, 90)}). Auto-retrying attempt ${attempt}/${maxRetries} in ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

class GeminiProvider extends BaseModelProvider {
  constructor(options = {}) {
    super('gemini', options);
    this.primaryModel = geminiAdapter.validateModel(MODEL_CONFIG.GEMINI.PRIMARY);
    this.liveModel = MODEL_CONFIG.GEMINI.LIVE;
    this.ttsModel = MODEL_CONFIG.GEMINI.TTS;
    this.rawGenAI = null;
  }

  isAvailable() {
    return Boolean(this.getApiKey());
  }

  /**
   * Resolves the active Gemini API key safely through CredentialManager
   */
  getApiKey() {
    return credentialManager.getGeminiApiKey();
  }

  getRawGenAI() {
    const key = this.getApiKey();
    if (!key) return null;
    if (!this.rawGenAI || this._lastCachedKey !== key) {
      this.rawGenAI = new GoogleGenerativeAI(key);
      this._lastCachedKey = key;
    }
    return this.rawGenAI;
  }

  /**
   * Create LangChain Chat Instance with Gemini 3.8 Thinking/Reasoning support
   * Enforces strict provider adapter boundaries to ensure NO internal metadata leaks into Google's API.
   */
  createChatInstance(modelName, temperature = 0.2, internalThinkingConfig = null) {
    const sanitizedModel = geminiAdapter.validateModel(modelName || this.primaryModel);
    const googleThinkingConfig = geminiAdapter.buildGoogleThinkingConfig(internalThinkingConfig);
    const apiKey = this.getApiKey();

    const config = {
      model: sanitizedModel,
      apiKey,
      temperature,
      maxRetries: 0 // Do not retry indefinitely on auth failures; handled via executeWithRetry
    };

    if (googleThinkingConfig) {
      geminiAdapter.validateGoogleThinkingConfig(googleThinkingConfig);
      config.thinkingConfig = googleThinkingConfig;
    }

    geminiAdapter.validateOutboundGeminiConfig(config);

    geminiAdapter.logGeminiRequest({
      provider: 'google',
      model: sanitizedModel,
      thinkingLevel: googleThinkingConfig?.thinkingLevel || 'none'
    });

    return new ChatGoogleGenerativeAI(config);
  }

  safelyBindTools(llm, tools = []) {
    if (!tools || tools.length === 0) return { llm, boundCount: 0 };
    const preValidated = validateToolsForGemini(tools, { strict: false });
    try {
      const bound = llm.bindTools(preValidated);
      return { llm: bound, boundCount: preValidated.length };
    } catch (_) {
      const healthy = [];
      for (const t of preValidated) {
        try {
          llm.bindTools([t]);
          healthy.push(t);
        } catch (_) {}
      }
      return { llm: healthy.length > 0 ? llm.bindTools(healthy) : llm, boundCount: healthy.length };
    }
  }

  /**
   * Primary invocation method with Gemini 3.8 thinking configuration
   */
  async invoke(messages, tools = [], options = {}) {
    const rawModel = options.model || this.primaryModel;
    const modelName = geminiAdapter.validateModel(rawModel);
    const temperature = options.temperature ?? 0.2;
    const thinkingConfig = options.thinkingConfig || null;

    const apiKey = this.getApiKey();
    if (!apiKey) {
      console.error("[GEMINI_PIPELINE] AUTHENTICATION_FAILED: No GEMINI_API_KEY configured in server environment.");
      throw new Error("API key not valid. Please pass a valid API key (KEY_MISSING).");
    }

    const llm = this.createChatInstance(modelName, temperature, thinkingConfig);
    const { llm: boundLlm, boundCount } = this.safelyBindTools(llm, tools);

    console.log(`[GEMINI_PIPELINE] REQUEST_STARTED: provider=google model=${modelName} tools=${boundCount}`);

    try {
      const result = await executeWithRetry(() => boundLlm.invoke(messages), 3, 1500);
      credentialManager.recordVerificationOutcome(true);
      console.log(`[GEMINI_PIPELINE] REQUEST_SUCCEEDED: provider=google model=${modelName}`);
      return result;
    } catch (err) {
      const errMsg = err.message || '';

      // Check for authentication failure
      if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid') || errMsg.includes('401')) {
        credentialManager.recordVerificationOutcome(false, err);
        console.error(`[GEMINI_PIPELINE] AUTHENTICATION_FAILED: provider=google model=${modelName} reason="API_KEY_INVALID"`);
        throw err;
      }

      console.warn(`[GEMINI_PIPELINE] REQUEST_FAILED: provider=google model=${modelName} reason="${errMsg.substring(0, 150)}"`);

      // Auto-remediate if a model or API version rejects thinking_config
      if (errMsg.includes('thinking_config') || errMsg.includes('thinkingConfig') || errMsg.includes('Unknown name "level"') || errMsg.includes('Unknown name "label"')) {
        console.warn(`[GEMINI_PROVIDER] thinking_config rejected by '${modelName}'. Retrying without thinkingConfig...`);
        const cleanLlm = this.createChatInstance(modelName, temperature, null);
        const { llm: cleanBound } = this.safelyBindTools(cleanLlm, tools);
        try {
          const cleanResult = await executeWithRetry(() => cleanBound.invoke(messages), 2, 1000);
          credentialManager.recordVerificationOutcome(true);
          console.log(`[GEMINI_PIPELINE] REQUEST_SUCCEEDED (after thinkingConfig remediation): provider=google model=${modelName}`);
          return cleanResult;
        } catch (innerErr) {
          if (innerErr.message && (innerErr.message.includes('400') || innerErr.message.includes('propertyNames') || innerErr.message.includes('function_declarations'))) {
            return await executeWithRetry(() => cleanLlm.invoke(messages), 2, 1000);
          }
          throw innerErr;
        }
      }

      if (errMsg.includes('400') || errMsg.includes('propertyNames') || errMsg.includes('function_declarations')) {
        console.warn(`[GEMINI_PROVIDER] Schema rejected by Gemini. Retrying without tools...`);
        return await executeWithRetry(() => llm.invoke(messages), 2, 1000);
      }
      throw err;
    }
  }

  /**
   * Gemini 3.8 Multimodal Understanding (Images, Audio, PDF, Video)
   */
  async invokeMultimodal(parts, prompt, options = {}) {
    const rawGenAI = this.getRawGenAI();
    if (!rawGenAI) throw new Error("Gemini API key is not configured (KEY_MISSING).");
    const modelName = geminiAdapter.validateModel(options.model || this.primaryModel);
    const model = rawGenAI.getGenerativeModel({ model: modelName });

    const contents = [prompt, ...parts];
    const result = await executeWithRetry(() => model.generateContent(contents), 3, 1500);
    const response = await result.response;
    return response.text();
  }

  /**
   * Gemini 3.8 Live Voice Session Configuration
   */
  createLiveSessionConfig(options = {}) {
    return {
      model: this.liveModel,
      provider: 'gemini-3.8-live',
      modalities: ['AUDIO', 'TEXT'],
      voice: options.voice || 'Aoede',
      systemInstruction: options.systemInstruction || "You are JARVIS, an autonomous AI operating system.",
      interruptionAllowed: true
    };
  }

  /**
   * Gemini 3.8 Flash TTS Speech Synthesis
   */
  async synthesizeSpeech(text, options = {}) {
    return {
      model: this.ttsModel,
      provider: 'gemini-3.8-flash-tts',
      text,
      format: options.format || 'audio/mp3',
      voice: options.voice || 'Puck',
      speed: options.speed || 1.0
    };
  }
}

module.exports = { GeminiProvider };
