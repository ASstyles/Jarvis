const { GeminiProvider } = require('./geminiProvider');
const { ClaudeProvider } = require('./claudeProvider');
const MODEL_CONFIG = require('../config/modelConfig');
const geminiAdapter = require('./geminiAdapter');

/**
 * Universal Model Router & Telemetry Hub
 *
 * Implements the Gemini 3.8 architecture:
 * - gemini-3.8-flash (Primary intelligence, reasoning, planning, tool calling, coding, multimodal)
 * - gemini-3.8-live (Real-time conversational voice)
 * - gemini-3.8-flash-tts (Speech synthesis & document reading)
 *
 * Provides comprehensive telemetry tracking, intelligent thinking/reasoning budget assignment,
 * and transparent fallback telemetry without silent downgrades to Gemini 2.0.
 */
class ModelRouter {
  constructor() {
    this.gemini = new GeminiProvider();
    this.claude = new ClaudeProvider();

    this.primaryProvider = process.env.JARVIS_LLM_PROVIDER || (this.gemini.isAvailable() ? 'gemini' : 'claude');

    // Enhanced Telemetry Matrix tracking Gemini 3.8 specifically
    this.stats = {
      totalInvocations: 0,
      successfulInvocations: 0,
      failedInvocations: 0,
      fallbackTriggers: 0,
      estimatedTokensTotal: 0,
      inputTokensTotal: 0,
      outputTokensTotal: 0,
      toolCallsTotal: 0,
      thinkingInvocations: 0,

      // Provider-level counters
      providerUsageCounts: { gemini: 0, claude: 0 },

      // Detailed per-model metrics: modelId, requestCount, successRate, failureRate, latencies, tokens, thinking, toolCalls
      models: {
        'gemini-3.8-flash': this._createModelTelemetry('gemini-3.8-flash'),
        'gemini-3.8-live': this._createModelTelemetry('gemini-3.8-live'),
        'gemini-3.8-flash-tts': this._createModelTelemetry('gemini-3.8-flash-tts')
      },

      // Task types metrics
      taskTypeMetrics: {
        planning: { requests: 0, successes: 0, avgLatency: 0 },
        coding: { requests: 0, successes: 0, avgLatency: 0 },
        research: { requests: 0, successes: 0, avgLatency: 0 },
        verification: { requests: 0, successes: 0, avgLatency: 0 },
        orchestration: { requests: 0, successes: 0, avgLatency: 0 },
        general: { requests: 0, successes: 0, avgLatency: 0 }
      },

      // Mission & Verification success counters
      missionSuccessCount: 0,
      missionFailureCount: 0,
      verificationSuccessCount: 0,
      verificationFailureCount: 0,

      // Fallback incident audit log
      fallbackIncidents: [],

      // Legacy compatibility mappings
      modelUsageCounts: {},
      modelLatencies: {},
      averageLatenciesMs: {}
    };
  }

  _createModelTelemetry(modelId) {
    return {
      modelId,
      requestCount: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 100,
      averageLatencyMs: 0,
      minLatencyMs: 0,
      maxLatencyMs: 0,
      latencies: [],
      inputTokens: 0,
      outputTokens: 0,
      thinkingUsage: {
        count: 0,
        activeLevel: 'medium',
        byLevel: { low: 0, medium: 0, high: 0 },
        totalBudget: 0
      },
      toolCallCount: 0,
      fallbackCount: 0
    };
  }

  getProvider(providerName) {
    if (providerName === 'claude') return this.claude;
    return this.gemini;
  }

  getActiveProviderName() {
    if (this.primaryProvider === 'claude' && this.claude.isAvailable()) return 'claude';
    if (this.gemini.isAvailable()) return 'gemini';
    if (this.claude.isAvailable()) return 'claude';
    return 'gemini'; // Default
  }

  setPrimaryProvider(name) {
    if (name === 'claude' || name === 'gemini') {
      this.primaryProvider = name;
      console.log(`[MODEL_ROUTER] Primary provider set to: ${name}`);
    }
  }

  setActiveProvider(name) {
    this.setPrimaryProvider(name);
  }

  get activeProvider() {
    return this.primaryProvider;
  }

  getAvailableProviders() {
    return [
      { id: 'gemini', available: this.gemini.isAvailable(), primaryModel: MODEL_CONFIG.GEMINI.PRIMARY },
      { id: 'claude', available: this.claude.isAvailable() }
    ];
  }

  /**
   * Returns exact model name for a cognitive tier
   */
  getModelNameForTier(tier = 'fast', provider = 'gemini') {
    return MODEL_CONFIG.resolveModelForTier(tier, provider);
  }

  /**
   * Fallback sequence — Gemini 3.8 Flash is always preferred
   * Strictly filters out any forbidden models (e.g. gemini-2.0-flash)
   */
  getFallbackSequence(preferredModel, provider = 'gemini') {
    if (provider === 'claude') {
      return Array.from(new Set([preferredModel, ...MODEL_CONFIG.FALLBACKS.claude]));
    }
    const rawList = [preferredModel, ...MODEL_CONFIG.FALLBACKS.gemini];
    return Array.from(new Set(rawList.filter(m => !geminiAdapter.FORBIDDEN_MODELS.has(m.replace(/^models\//, '')))));
  }

  /**
   * Core invocation method with Gemini 3.8 thinking configuration & fallback policy
   */
  async invokeWithFallback(messages, tools = [], tier = 'fast', temperature = 0.2, options = {}) {
    this.stats.totalInvocations++;
    const primaryProvName = this.getActiveProviderName();
    const primaryProvider = this.getProvider(primaryProvName);

    const taskType = options.taskType || (tier === 'reasoning' ? 'planning' : tier === 'coding' ? 'coding' : 'general');
    const thinkingConfig = options.thinkingConfig || MODEL_CONFIG.getThinkingConfig(tier, taskType);

    const rawModel = options.model || this.getModelNameForTier(tier, primaryProvName);
    const preferredModel = primaryProvName === 'gemini' ? geminiAdapter.validateModel(rawModel) : rawModel;
    const sequence = this.getFallbackSequence(preferredModel, primaryProvName);

    let lastError = null;

    // 1. Attempt primary model sequence
    for (let i = 0; i < sequence.length; i++) {
      const modelName = sequence[i];
      const isFallback = i > 0;
      const startTime = Date.now();
      const thinkingLevel = thinkingConfig.thinkingLevel || thinkingConfig.level || 'medium';

      try {
        console.log(`[MODEL_ROUTER] Invoking ${primaryProvName.toUpperCase()} '${modelName}' (Tier: ${tier}, Thinking: ${thinkingLevel}, Attempt ${i + 1}/${sequence.length})`);
        
        const response = await primaryProvider.invoke(messages, tools, {
          model: modelName,
          temperature,
          thinkingConfig
        });
        
        const duration = Date.now() - startTime;
        this.recordSuccess({
          provider: primaryProvName,
          modelName,
          duration,
          messages,
          tools,
          response,
          isFallback,
          primaryModel: preferredModel,
          taskType,
          thinkingConfig
        });
        return response;
      } catch (err) {
        lastError = err;
        const duration = Date.now() - startTime;
        this.recordFailure({
          provider: primaryProvName,
          modelName,
          duration,
          error: err,
          primaryModel: preferredModel,
          nextModel: sequence[i + 1] || 'cross_provider',
          taskType
        });
        console.warn(`[MODEL_ROUTER] ${primaryProvName.toUpperCase()} model '${modelName}' failed: ${err.message}`);

        // If authentication failed or API key rejected, do NOT attempt model fallbacks
        const errMsg = err?.message || '';
        if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid') || errMsg.includes('KEY_MISSING')) {
          console.error(`[MODEL_ROUTER] Authentication failed for ${primaryProvName.toUpperCase()}. Halting model fallback loop immediately.`);
          throw err;
        }
      }
    }

    // 2. Cross-provider fallback (e.g. Gemini -> Claude or Claude -> Gemini)
    const secondaryProvName = primaryProvName === 'gemini' ? 'claude' : 'gemini';
    const secondaryProvider = this.getProvider(secondaryProvName);

    if (secondaryProvider.isAvailable()) {
      console.log(`[MODEL_ROUTER] Primary provider exhausted. Attempting cross-provider fallback to ${secondaryProvName.toUpperCase()}...`);
      const secModel = this.getModelNameForTier(tier, secondaryProvName);
      const startTime = Date.now();

      try {
        const response = await secondaryProvider.invoke(messages, tools, {
          model: secModel,
          temperature
        });
        const duration = Date.now() - startTime;
        this.recordSuccess({
          provider: secondaryProvName,
          modelName: secModel,
          duration,
          messages,
          tools,
          response,
          isFallback: true,
          primaryModel: preferredModel,
          taskType,
          thinkingConfig
        });
        return response;
      } catch (secErr) {
        console.error(`[MODEL_ROUTER] Cross-provider fallback to ${secondaryProvName} also failed: ${secErr.message}`);
        lastError = secErr;
      }
    }

    this.stats.failedInvocations++;
    throw lastError || new Error('All model providers in routing chain failed.');
  }

  /**
   * Telemetry recording for successful invocations
   */
  recordSuccess({ provider, modelName, duration, messages, tools, response, isFallback, primaryModel, taskType, thinkingConfig }) {
    this.stats.successfulInvocations++;
    this.stats.providerUsageCounts[provider] = (this.stats.providerUsageCounts[provider] || 0) + 1;
    this.stats.modelUsageCounts[modelName] = (this.stats.modelUsageCounts[modelName] || 0) + 1;

    // Approximate token counts
    const inTokens = Math.round(JSON.stringify(messages).length / 4);
    const outTokens = Math.round(JSON.stringify(response?.content || '').length / 4);
    this.stats.inputTokensTotal += inTokens;
    this.stats.outputTokensTotal += outTokens;
    this.stats.estimatedTokensTotal += (inTokens + outTokens);

    // Track tool call count
    const toolCallCount = (response?.tool_calls?.length) || 0;
    this.stats.toolCallsTotal += toolCallCount;

    // Initialize model telemetry record if needed
    if (!this.stats.models[modelName]) {
      this.stats.models[modelName] = this._createModelTelemetry(modelName);
    }
    const m = this.stats.models[modelName];
    m.requestCount++;
    m.successCount++;
    m.successRate = Math.round((m.successCount / m.requestCount) * 100);
    m.inputTokens += inTokens;
    m.outputTokens += outTokens;
    m.toolCallCount += toolCallCount;

    m.latencies.push(duration);
    if (m.latencies.length > 30) m.latencies.shift();
    m.averageLatencyMs = Math.round(m.latencies.reduce((a, b) => a + b, 0) / m.latencies.length);
    m.minLatencyMs = m.minLatencyMs === 0 ? duration : Math.min(m.minLatencyMs, duration);
    m.maxLatencyMs = Math.max(m.maxLatencyMs, duration);

    // Thinking stats
    if (thinkingConfig) {
      const tLevel = thinkingConfig.thinkingLevel || (thinkingConfig.level ? thinkingConfig.level.toLowerCase() : 'medium');
      this.stats.thinkingInvocations++;
      m.thinkingUsage.count++;
      m.thinkingUsage.activeLevel = tLevel;
      if (m.thinkingUsage.byLevel && m.thinkingUsage.byLevel[tLevel] !== undefined) {
        m.thinkingUsage.byLevel[tLevel]++;
      }
      if (typeof thinkingConfig.thinkingBudget === 'number') {
        m.thinkingUsage.totalBudget += thinkingConfig.thinkingBudget;
      }
    }

    // Task Type telemetry
    if (this.stats.taskTypeMetrics[taskType]) {
      const tm = this.stats.taskTypeMetrics[taskType];
      tm.requests++;
      tm.successes++;
      tm.avgLatency = Math.round(((tm.avgLatency * (tm.requests - 1)) + duration) / tm.requests);
    }

    // Legacy latency compatibility
    const prevLatencies = this.stats.modelLatencies[modelName] || [];
    prevLatencies.push(duration);
    if (prevLatencies.length > 20) prevLatencies.shift();
    this.stats.modelLatencies[modelName] = prevLatencies;
    this.stats.averageLatenciesMs[modelName] = m.averageLatencyMs;

    // Record fallback incident if triggered
    if (isFallback) {
      this.stats.fallbackTriggers++;
      m.fallbackCount++;
      const incident = {
        primaryModel,
        fallbackModel: modelName,
        reasonForFallback: 'Primary model unavailable or threw error',
        latencyMs: duration,
        success: true,
        tokensUsed: inTokens + outTokens,
        taskType,
        timestamp: new Date().toISOString()
      };
      this.stats.fallbackIncidents.unshift(incident);
      if (this.stats.fallbackIncidents.length > 50) this.stats.fallbackIncidents.pop();
      console.log(`[MODEL_ROUTER_FALLBACK] Fell back from '${primaryModel}' to '${modelName}' in ${duration}ms (Reason: Auto-Recovered)`);
    }
  }

  /**
   * Telemetry recording for model errors
   */
  recordFailure({ provider, modelName, duration, error, primaryModel, nextModel, taskType }) {
    if (!this.stats.models[modelName]) {
      this.stats.models[modelName] = this._createModelTelemetry(modelName);
    }
    const m = this.stats.models[modelName];
    m.requestCount++;
    m.failureCount++;
    m.successRate = Math.round((m.successCount / m.requestCount) * 100);

    // Diagnose reason for fallback
    const errMsg = error?.message || String(error);
    let reason = 'GENERAL_ERROR';
    if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('Quota')) {
      reason = 'RATE_LIMIT_OR_QUOTA_EXHAUSTED';
    } else if (errMsg.includes('503') || errMsg.includes('Service Unavailable') || errMsg.includes('overloaded')) {
      reason = 'SERVICE_OVERLOAD_503';
    } else if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid')) {
      reason = 'AUTHENTICATION_FAILURE';
    } else if (errMsg.includes('timeout') || errMsg.includes('ECONNRESET')) {
      reason = 'NETWORK_TIMEOUT';
    } else if (errMsg.includes('thinking_config') || errMsg.includes('Unknown name')) {
      reason = 'INVALID_GENERATION_CONFIGURATION';
    }

    console.error(`[JARVIS][RED ALERT] Gemini request rejected.\nProvider: ${provider}\nModel: ${modelName}\nReason: ${reason}`);

    const incident = {
      primaryModel,
      fallbackModel: nextModel,
      reasonForFallback: reason,
      errorMessage: errMsg.substring(0, 160),
      latencyMs: duration,
      success: false,
      taskType,
      timestamp: new Date().toISOString()
    };
    this.stats.fallbackIncidents.unshift(incident);
    if (this.stats.fallbackIncidents.length > 50) this.stats.fallbackIncidents.pop();
  }

  recordMissionOutcome(success) {
    if (success) this.stats.missionSuccessCount++;
    else this.stats.missionFailureCount++;
  }

  recordVerificationOutcome(success) {
    if (success) this.stats.verificationSuccessCount++;
    else this.stats.verificationFailureCount++;
  }

  getStats() {
    const total = this.stats.totalInvocations;
    const successRatePct = total > 0 ? Math.round((this.stats.successfulInvocations / total) * 100) : 100;

    return {
      ...this.stats,
      activeProvider: this.getActiveProviderName(),
      primaryModel: MODEL_CONFIG.GEMINI.PRIMARY,
      liveModel: MODEL_CONFIG.GEMINI.LIVE,
      ttsModel: MODEL_CONFIG.GEMINI.TTS,
      successRatePct
    };
  }
}

const modelRouter = new ModelRouter();
module.exports = modelRouter;
