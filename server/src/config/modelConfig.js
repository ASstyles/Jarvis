/**
 * JARVIS Centralized Model Configuration — Single Source of Truth
 *
 * Implements the mandatory Gemini 3.8 architecture across JARVIS:
 * - gemini-3.8-flash: Primary general-purpose reasoning, agentic, tool-calling,
 *                     coding, planning, multimodal, and orchestration model.
 * - gemini-3.8-live:  Real-time conversational voice, low-latency audio interaction,
 *                     and voice agent sessions.
 * - gemini-3.8-flash-tts: Natural speech synthesis, long-form document reading,
 *                         and JARVIS voice responses.
 */

const { validateModel, DEFAULT_THINKING_LEVEL } = require('../llm/geminiAdapter');

const rawPrimary = process.env.GEMINI_PRIMARY_MODEL || process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const validatedPrimary = validateModel(rawPrimary);

const MODEL_CONFIG = {
  // Provider
  DEFAULT_PROVIDER: process.env.JARVIS_LLM_PROVIDER || 'gemini',

  // Core Gemini 3.8 Model Family Identifiers
  GEMINI: {
    PRIMARY: validatedPrimary,
    LIVE: process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live',
    TTS: process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts',
    REASONING: validateModel(process.env.GEMINI_REASONING_MODEL || 'gemini-3.8-flash'),
    CODING: validateModel(process.env.GEMINI_CODING_MODEL || 'gemini-3.8-flash'),
    VISION: validateModel(process.env.GEMINI_VISION_MODEL || 'gemini-3.8-flash'),
    DOCUMENT: validateModel(process.env.GEMINI_DOCUMENT_MODEL || 'gemini-3.8-flash'),
  },

  // Fallback sequence (Strictly used only during rate limits, quota, 429, 503, or outage)
  // NEVER includes or silently falls back to gemini-2.5-pro, gemini-2.0-flash, or gemini-1.5-flash
  FALLBACKS: {
    gemini: [
      'gemini-3.8-flash'
    ],
    claude: [
      process.env.CLAUDE_REASONING_MODEL || 'claude-3-5-sonnet-20241022',
      process.env.CLAUDE_FAST_MODEL || 'claude-3-5-haiku-20241022'
    ]
  },

  // Thinking / Reasoning Configurations for Gemini 3.8
  // Official thinking levels: "low" | "medium" | "high" (Default: "medium")
  DEFAULT_THINKING_LEVEL,
  THINKING_LEVELS: {
    low: {
      thinkingLevel: 'low',
      level: 'LOW',
      label: 'Low Reasoning (Simple Tool Calls)',
      thinkingBudget: 1024
    },
    medium: {
      thinkingLevel: 'medium',
      level: 'MEDIUM',
      label: 'Medium Reasoning (Standard / Balanced)',
      thinkingBudget: 4096
    },
    high: {
      thinkingLevel: 'high',
      level: 'HIGH',
      label: 'High Reasoning (Complex Planning & Architecture)',
      thinkingBudget: 8192
    },
    // Backwards-compatible aliases
    off: {
      thinkingLevel: 'low',
      level: 'OFF',
      label: 'Fast Reasoning',
      thinkingBudget: 0
    },
    standard: {
      thinkingLevel: 'medium',
      level: 'MEDIUM',
      label: 'Standard Reasoning (Coding & Research)',
      thinkingBudget: 4096
    }
  },

  /**
   * Determine the appropriate thinking configuration based on task tier and operational context
   */
  getThinkingConfig(tier = 'fast', taskType = 'general') {
    // High reasoning tasks: Complex planning, large codebase analysis, difficult debugging, architecture, recovery
    if (tier === 'reasoning' || taskType === 'planning' || taskType === 'architecture' || taskType === 'failure_recovery') {
      return this.THINKING_LEVELS.high;
    }
    if (tier === 'coding' || taskType === 'coding' || taskType === 'debugging') {
      return this.THINKING_LEVELS.medium;
    }
    if (taskType === 'research' || taskType === 'verification') {
      return this.THINKING_LEVELS.medium;
    }
    if (taskType === 'tool_calling') {
      return this.THINKING_LEVELS.low;
    }
    // Default JARVIS setting: medium
    return this.THINKING_LEVELS.medium;
  },

  /**
   * Resolve model name for a specific operational tier
   */
  resolveModelForTier(tier = 'fast', provider = 'gemini') {
    if (provider === 'claude') {
      if (tier === 'reasoning' || tier === 'coding') {
        return process.env.CLAUDE_REASONING_MODEL || 'claude-3-5-sonnet-20241022';
      }
      return process.env.CLAUDE_FAST_MODEL || 'claude-3-5-haiku-20241022';
    }

    // Default to Gemini 3.8 Flash for all tiers
    switch (tier) {
      case 'reasoning':
        return this.GEMINI.REASONING;
      case 'coding':
        return this.GEMINI.CODING;
      case 'live':
        return this.GEMINI.LIVE;
      case 'tts':
        return this.GEMINI.TTS;
      case 'vision':
        return this.GEMINI.VISION;
      case 'document':
        return this.GEMINI.DOCUMENT;
      case 'fast':
      default:
        return this.GEMINI.PRIMARY;
    }
  }
};

module.exports = MODEL_CONFIG;
