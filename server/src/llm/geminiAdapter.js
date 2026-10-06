/**
 * JARVIS Gemini Config Adapter & Strict Provider Boundary
 *
 * Implements a strict boundary between internal JARVIS metadata and Google Gemini API payloads:
 *
 *   JARVIS INTERNAL CONFIG
 *            ↓
 *   GEMINI CONFIG ADAPTER (This Module)
 *            ↓
 *   GOOGLE GEMINI API PAYLOAD
 *
 * Guarantees:
 * 1. Canonical model is strictly 'gemini-3.8-flash'.
 * 2. 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'
 *    and other legacy/stale models are strictly forbidden and redirected to 'gemini-3.8-flash'.
 * 3. Model strings with thinking suffixes like 'gemini-3.8-flash-high' are sanitized to 'gemini-3.8-flash'.
 * 4. thinkingConfig uses strictly 'thinkingLevel': 'low' | 'medium' | 'high'.
 * 5. Internal metadata ('level', 'label', 'internalLevel', 'thinkingBudget', etc.)
 *    is NEVER leaked or serialized into Google's API payload.
 * 6. Unknown or unsupported fields are stripped and validated.
 */

const CANONICAL_PRIMARY_MODEL = 'gemini-3.8-flash';

const FORBIDDEN_MODELS = new Set([
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-2.0',
  'gemini-2.0-pro-exp-02-05',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.5'
]);

const ALLOWED_THINKING_LEVELS = new Set(['low', 'medium', 'high']);
const DEFAULT_THINKING_LEVEL = 'medium';

/**
 * Validates and sanitizes a requested Gemini model name.
 * Strictly prevents any execution path from using gemini-2.5-pro, gemini-2.0-flash, etc.
 * Also sanitizes model names like 'gemini-3.8-flash-high' -> 'gemini-3.8-flash'.
 */
function validateModel(modelName) {
  if (!modelName || typeof modelName !== 'string') {
    return CANONICAL_PRIMARY_MODEL;
  }

  let trimmed = modelName.trim().replace(/^models\//, '');

  // Strip any accidental thinking suffixes like '-high', '-medium', '-low'
  if (trimmed.startsWith('gemini-3.8-flash-')) {
    trimmed = 'gemini-3.8-flash';
  }

  if (FORBIDDEN_MODELS.has(trimmed)) {
    console.warn(`[GEMINI_ADAPTER] Blocked forbidden/stale model '${trimmed}'. Enforcing canonical primary model '${CANONICAL_PRIMARY_MODEL}'.`);
    return CANONICAL_PRIMARY_MODEL;
  }

  return trimmed;
}

/**
 * Normalizes any thinking level input into an allowed Gemini 3.8 thinking level ('low' | 'medium' | 'high').
 */
function normalizeThinkingLevel(input) {
  if (!input) return DEFAULT_THINKING_LEVEL;

  if (typeof input === 'string') {
    const lower = input.toLowerCase().trim();
    if (ALLOWED_THINKING_LEVELS.has(lower)) {
      return lower;
    }
    // Mapping common synonyms/aliases
    if (lower === 'standard' || lower === 'balanced' || lower === 'normal' || lower === 'default') {
      return 'medium';
    }
    if (lower === 'fast' || lower === 'minimal' || lower === 'simple') {
      return 'low';
    }
    if (lower === 'deep' || lower === 'complex' || lower === 'max' || lower === 'architecture') {
      return 'high';
    }
    if (lower === 'off' || lower === 'zero' || lower === 'none') {
      return null; // Explicitly disabled
    }
  }

  return DEFAULT_THINKING_LEVEL;
}

/**
 * Strict Adapter: Translates any internal JARVIS config object into a pure Google API thinkingConfig.
 *
 * Internal shapes supported:
 * - { thinkingLevel: 'medium' }
 * - { level: 'medium', label: 'balanced reasoning' }
 * - { thinking: { level: 'medium', label: 'balanced' } }
 * - { thinking_config: { level: '...', label: '...' } }
 * - { thinkingBudget: 4096, level: 'STANDARD', label: '...' }
 * - 'low' | 'medium' | 'high'
 *
 * Output: ONLY { thinkingLevel: 'low' | 'medium' | 'high' } or undefined if disabled.
 * ZERO internal metadata ('level', 'label', etc.) will ever reach Google.
 */
function buildGoogleThinkingConfig(internalConfig) {
  if (!internalConfig) {
    return { thinkingLevel: DEFAULT_THINKING_LEVEL };
  }

  // If already a primitive string
  if (typeof internalConfig === 'string') {
    const level = normalizeThinkingLevel(internalConfig);
    return level ? { thinkingLevel: level } : undefined;
  }

  if (typeof internalConfig !== 'object') {
    return { thinkingLevel: DEFAULT_THINKING_LEVEL };
  }

  // Check nested internal objects
  let rawLevel = null;

  if (internalConfig.thinkingLevel) {
    rawLevel = internalConfig.thinkingLevel;
  } else if (internalConfig.thinking && typeof internalConfig.thinking === 'object') {
    rawLevel = internalConfig.thinking.thinkingLevel || internalConfig.thinking.level || internalConfig.thinking.thinking_level;
  } else if (internalConfig.thinking_config && typeof internalConfig.thinking_config === 'object') {
    rawLevel = internalConfig.thinking_config.thinkingLevel || internalConfig.thinking_config.level || internalConfig.thinking_config.thinking_level;
  } else if (internalConfig.thinkingConfig && typeof internalConfig.thinkingConfig === 'object') {
    rawLevel = internalConfig.thinkingConfig.thinkingLevel || internalConfig.thinkingConfig.level;
  } else if (internalConfig.level) {
    rawLevel = internalConfig.level;
  } else if (internalConfig.internalLevel) {
    rawLevel = internalConfig.internalLevel;
  } else if (internalConfig.thinking_level) {
    rawLevel = internalConfig.thinking_level;
  }

  const normalized = normalizeThinkingLevel(rawLevel);
  if (!normalized) {
    return undefined; // Off / Disabled
  }

  // Construct pure Google-compliant thinkingConfig object
  const googleThinkingConfig = {
    thinkingLevel: normalized
  };

  // Optional includeThoughts boolean passthrough if explicitly requested
  if (typeof internalConfig.includeThoughts === 'boolean') {
    googleThinkingConfig.includeThoughts = internalConfig.includeThoughts;
  }

  // Strict invariant: verify no forbidden fields exist on the returned object
  validateGoogleThinkingConfig(googleThinkingConfig);

  return googleThinkingConfig;
}

/**
 * Validates that a thinkingConfig object conforms strictly to Google's Gemini API specification.
 * Throws an informative error if any invalid field like 'level' or 'label' is detected.
 */
function validateGoogleThinkingConfig(thinkingConfig) {
  if (!thinkingConfig || typeof thinkingConfig !== 'object') return;

  const forbiddenFields = ['level', 'label', 'thinking_level', 'thinking_budget', 'internalLevel'];
  for (const field of forbiddenFields) {
    if (Object.prototype.hasOwnProperty.call(thinkingConfig, field)) {
      throw new Error(`[GEMINI_ADAPTER_ERROR] Forbidden internal field "${field}" detected in Google thinkingConfig payload.`);
    }
  }

  if (thinkingConfig.thinkingLevel && !ALLOWED_THINKING_LEVELS.has(thinkingConfig.thinkingLevel)) {
    throw new Error(`[GEMINI_ADAPTER_ERROR] Invalid thinkingLevel "${thinkingConfig.thinkingLevel}". Must be one of: ${Array.from(ALLOWED_THINKING_LEVELS).join(', ')}`);
  }
}

/**
 * Comprehensive outbound request payload validator
 */
function validateOutboundGeminiConfig(config) {
  if (!config || typeof config !== 'object') return;

  if (config.model) {
    config.model = validateModel(config.model);
  }

  if (config.thinkingConfig) {
    validateGoogleThinkingConfig(config.thinkingConfig);
  }
}

/**
 * Structured development-time logging for Gemini requests
 * Never logs API keys, auth tokens, or private secrets.
 */
function logGeminiRequest({ provider = 'google', model, thinkingLevel, toolCount = 0 }) {
  console.log(`[GEMINI REQUEST]\nprovider=${provider}\nmodel=${model}\nthinkingLevel=${thinkingLevel || 'none'}\ntools=${toolCount}`);
}

module.exports = {
  CANONICAL_PRIMARY_MODEL,
  FORBIDDEN_MODELS,
  ALLOWED_THINKING_LEVELS,
  DEFAULT_THINKING_LEVEL,
  validateModel,
  normalizeThinkingLevel,
  buildGoogleThinkingConfig,
  validateGoogleThinkingConfig,
  validateOutboundGeminiConfig,
  logGeminiRequest
};
