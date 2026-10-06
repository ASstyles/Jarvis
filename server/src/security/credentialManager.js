/**
 * JARVIS Credential Manager & Security Validation Layer
 *
 * Provides safe, centralized credential handling for Google Gemini API:
 * 1. Precedence: GEMINI_API_KEY (authoritative) -> GOOGLE_API_KEY (legacy fallback)
 * 2. Normalization: Safely strips accidental quotes, trailing newlines, whitespace
 * 3. Secret Protection: NEVER logs, dumps, or exposes the actual key to browser/telemetry
 * 4. State Classification: KEY_MISSING, KEY_EMPTY, KEY_MALFORMED, KEY_REJECTED, KEY_VALID
 * 5. Safe Diagnostics: credentialConfigured, credentialSource, credentialLength
 */

const CREDENTIAL_STATES = {
  KEY_MISSING: 'KEY_MISSING',
  KEY_EMPTY: 'KEY_EMPTY',
  KEY_MALFORMED: 'KEY_MALFORMED',
  KEY_PRESENT: 'KEY_PRESENT',
  KEY_REJECTED: 'KEY_REJECTED',
  KEY_VALID: 'KEY_VALID'
};

class CredentialManager {
  constructor() {
    this.lastVerificationStatus = null;
    this.lastVerificationError = null;
    this.lastVerificationTimestamp = null;
  }

  /**
   * Safely normalizes raw credential strings:
   * - Strips accidental wrapping quotes (single or double)
   * - Strips surrounding whitespace, carriage returns, newlines
   * - Rejects placeholder values
   */
  normalizeKey(rawKey) {
    if (!rawKey || typeof rawKey !== 'string') return null;

    let key = rawKey.trim();

    // Strip accidental wrapping quotes (e.g. "AIzaSy..." or 'AIzaSy...')
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
      key = key.slice(1, -1).trim();
    }

    // Strip any internal carriage returns or newlines
    key = key.replace(/[\r\n]/g, '').trim();

    // Check for common placeholders
    const placeholders = [
      'your_gemini_api_key_here',
      'your_actual_gemini_api_key_here',
      'your_api_key_here',
      'your-api-key',
      'todo',
      'change_me',
      'dummy',
      'undefined',
      'null'
    ];

    if (placeholders.includes(key.toLowerCase())) {
      return null;
    }

    return key.length > 0 ? key : null;
  }

  /**
   * Resolves the active Gemini API key with strict precedence:
   * 1. process.env.GEMINI_API_KEY (Preferred & Canonical)
   * 2. process.env.GOOGLE_API_KEY (Secondary compatibility fallback)
   */
  getGeminiApiKey() {
    const rawGemini = process.env.GEMINI_API_KEY;
    const normalizedGemini = this.normalizeKey(rawGemini);

    if (normalizedGemini) {
      // Synchronize process.env.GOOGLE_API_KEY so legacy dependencies use the same key
      process.env.GOOGLE_API_KEY = normalizedGemini;
      return normalizedGemini;
    }

    const rawGoogle = process.env.GOOGLE_API_KEY;
    const normalizedGoogle = this.normalizeKey(rawGoogle);

    if (normalizedGoogle) {
      return normalizedGoogle;
    }

    return null;
  }

  /**
   * Evaluates the current state of the configured credential without leaking it.
   */
  evaluateState() {
    const raw = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (raw === undefined) {
      return CREDENTIAL_STATES.KEY_MISSING;
    }

    if (typeof raw !== 'string' || raw.trim().length === 0) {
      return CREDENTIAL_STATES.KEY_EMPTY;
    }

    const normalized = this.normalizeKey(raw);
    if (!normalized) {
      return CREDENTIAL_STATES.KEY_MALFORMED;
    }

    // Google API keys are typically >= 30 characters and start with AIzaSy
    if (normalized.length < 20) {
      return CREDENTIAL_STATES.KEY_MALFORMED;
    }

    if (this.lastVerificationStatus === CREDENTIAL_STATES.KEY_VALID) {
      return CREDENTIAL_STATES.KEY_VALID;
    }

    if (this.lastVerificationStatus === CREDENTIAL_STATES.KEY_REJECTED) {
      return CREDENTIAL_STATES.KEY_REJECTED;
    }

    return CREDENTIAL_STATES.KEY_PRESENT;
  }

  /**
   * Records verification result after an actual API call
   */
  recordVerificationOutcome(success, error = null) {
    this.lastVerificationTimestamp = new Date().toISOString();
    if (success) {
      this.lastVerificationStatus = CREDENTIAL_STATES.KEY_VALID;
      this.lastVerificationError = null;
    } else {
      this.lastVerificationStatus = CREDENTIAL_STATES.KEY_REJECTED;
      this.lastVerificationError = error?.message ? error.message.substring(0, 160) : 'API credential rejected';
    }
  }

  /**
   * Safe diagnostics payload for API endpoints and logging.
   * NEVER returns the key itself.
   */
  getSafeDiagnostics() {
    const state = this.evaluateState();
    const key = this.getGeminiApiKey();
    const source = process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY' : (process.env.GOOGLE_API_KEY ? 'GOOGLE_API_KEY' : 'NONE');

    return {
      provider: 'google',
      model: 'gemini-3.8-flash',
      credentialConfigured: Boolean(key),
      credentialSource: source,
      credentialLength: key ? key.length : 0,
      credentialState: state,
      authenticationVerified: state === CREDENTIAL_STATES.KEY_VALID,
      lastVerified: this.lastVerificationTimestamp,
      lastError: this.lastVerificationError
    };
  }
}

const credentialManager = new CredentialManager();

module.exports = {
  credentialManager,
  CREDENTIAL_STATES
};
