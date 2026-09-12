const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { validateToolsForGemini, formatInvalidToolDiagnostic } = require("../tools/toolValidator");

class ModelRouter {
  constructor() {
    this.primaryModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    this.fallbackModels = [
      "gemini-2.5-flash",
      "gemini-flash-latest",
      "gemini-flash-lite-latest",
      "gemini-1.5-flash"
    ];
    this.stats = {
      totalInvocations: 0,
      successfulInvocations: 0,
      failedInvocations: 0,
      fallbackTriggers: 0,
      modelUsageCounts: {},
      modelLatencies: {},
      modelSuccessRates: {},
      estimatedTokensTotal: 0
    };
  }

  getModelNameForTier(tier = 'fast') {
    switch (tier) {
      case 'reasoning':
        return process.env.GEMINI_REASONING_MODEL || "gemini-2.5-flash";
      case 'coding':
        return process.env.GEMINI_CODING_MODEL || "gemini-2.5-flash";
      case 'fast':
      default:
        return this.primaryModel;
    }
  }

  getFallbackSequence(preferredModel) {
    const list = [preferredModel, ...this.fallbackModels.filter(m => m !== preferredModel)];
    return Array.from(new Set(list)); // Deduplicate
  }

  createModelInstance(modelName, temperature = 0.2) {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    return new ChatGoogleGenerativeAI({
      model: modelName,
      apiKey: key,
      temperature,
      maxRetries: 1
    });
  }

  // Safe tool binding that isolates defective tools rather than crashing the chat pipeline
  safelyBindTools(llm, tools = []) {
    if (!tools || tools.length === 0) return { llm, boundCount: 0 };

    // 1. Run tool validator gate
    const preValidated = validateToolsForGemini(tools, { strict: false });

    // 2. Attempt batch binding
    try {
      const bound = llm.bindTools(preValidated);
      return { llm: bound, boundCount: preValidated.length };
    } catch (bindErr) {
      console.warn(`[MODEL_ROUTER] Batch bindTools failed (${bindErr.message}). Isolating individual tools...`);
      
      // 3. Isolate defective tools
      const healthyTools = [];
      for (const t of preValidated) {
        try {
          llm.bindTools([t]);
          healthyTools.push(t);
        } catch (singleErr) {
          const diag = formatInvalidToolDiagnostic(t.name, singleErr.message, "modelRouter.safelyBindTools");
          console.error(diag);
        }
      }

      if (healthyTools.length > 0) {
        console.log(`[MODEL_ROUTER] Successfully bound ${healthyTools.length}/${preValidated.length} healthy tools.`);
        return { llm: llm.bindTools(healthyTools), boundCount: healthyTools.length };
      } else {
        console.warn(`[MODEL_ROUTER] No healthy tools could be bound. Entering safe degraded conversational mode.`);
        return { llm, boundCount: 0 };
      }
    }
  }

  async invokeWithFallback(messages, tools = [], tier = 'fast', temperature = 0.2) {
    this.stats.totalInvocations++;
    const preferredModel = this.getModelNameForTier(tier);
    const sequence = this.getFallbackSequence(preferredModel);
    
    let lastError = null;

    for (let i = 0; i < sequence.length; i++) {
      const modelName = sequence[i];
      const startTime = Date.now();

      try {
        console.log(`[MODEL_ROUTER] Invoking model '${modelName}' (Tier: ${tier}, Attempt ${i + 1}/${sequence.length})`);
        
        let llm = this.createModelInstance(modelName, temperature);
        const { llm: boundLlm } = this.safelyBindTools(llm, tools);

        let response;
        try {
          response = await boundLlm.invoke(messages);
        } catch (invokeErr) {
          // If invocation failed specifically due to tool schema payload reject (400 Bad Request), fallback to tool-free invocation
          if (invokeErr.message && (invokeErr.message.includes('400') || invokeErr.message.includes('propertyNames') || invokeErr.message.includes('function_declarations'))) {
            console.warn(`[MODEL_ROUTER] Tool schema payload rejected by Gemini. Retrying in safe degraded mode without tools...`);
            response = await llm.invoke(messages);
          } else {
            throw invokeErr;
          }
        }

        const duration = Date.now() - startTime;
        
        this.stats.successfulInvocations++;
        this.stats.modelUsageCounts[modelName] = (this.stats.modelUsageCounts[modelName] || 0) + 1;
        
        // Track Latency
        const prevLatencies = this.stats.modelLatencies[modelName] || [];
        prevLatencies.push(duration);
        if (prevLatencies.length > 20) prevLatencies.shift();
        this.stats.modelLatencies[modelName] = prevLatencies;

        // Estimate tokens
        const approxTokens = JSON.stringify(messages).length / 4;
        this.stats.estimatedTokensTotal += Math.round(approxTokens);

        if (i > 0) {
          this.stats.fallbackTriggers++;
          console.log(`[MODEL_ROUTER] Successfully fell back to model '${modelName}' in ${duration}ms.`);
        }

        return response;
      } catch (err) {
        lastError = err;
        const errMsg = err.message || String(err);
        console.warn(`[MODEL_ROUTER] Model '${modelName}' execution failed: ${errMsg}`);

        const isOverloadedOrRateLimited = 
          errMsg.includes("429") ||
          errMsg.includes("503") ||
          errMsg.includes("404") ||
          errMsg.includes("Quota") ||
          errMsg.includes("quota") ||
          errMsg.includes("Service Unavailable") ||
          errMsg.includes("overloaded") ||
          errMsg.includes("NOT_FOUND");

        if (isOverloadedOrRateLimited && i < sequence.length - 1) {
          console.log(`[MODEL_ROUTER] Overload/Rate limit on '${modelName}'. Trying next model in chain...`);
          continue;
        } else if (i < sequence.length - 1) {
          console.log(`[MODEL_ROUTER] Attempting next model in fallback sequence...`);
          continue;
        } else {
          this.stats.failedInvocations++;
          throw err;
        }
      }
    }

    this.stats.failedInvocations++;
    throw lastError || new Error("All LLM models in fallback pool failed.");
  }

  getStats() {
    const avgLatencies = {};
    for (const [model, latencies] of Object.entries(this.stats.modelLatencies)) {
      if (latencies.length > 0) {
        avgLatencies[model] = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
      }
    }

    return {
      ...this.stats,
      averageLatenciesMs: avgLatencies,
      successRatePct: this.stats.totalInvocations > 0 
        ? Math.round((this.stats.successfulInvocations / this.stats.totalInvocations) * 100)
        : 100
    };
  }
}

const modelRouter = new ModelRouter();
module.exports = modelRouter;
