/**
 * JARVIS Centralized Configuration
 *
 * Eliminates hardcoded magic URLs like 'http://localhost:4000' across the frontend.
 */

export const CONFIG = {
  API_BASE_URL: process.env.NEXT_PUBLIC_JARVIS_API_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000',
  get SSE_URL() {
    return `${this.API_BASE_URL}/api/events`;
  },
  get PROXY_URL() {
    return `${this.API_BASE_URL}/api/proxy`;
  },
  DEFAULT_THEME: {
    accent: '#00f0ff',
    background: '#030712'
  },
  FEATURES: {
    THREE_D_REACTOR: true,
    HAND_TRACKING: true,
    LOCAL_VAD: true,
    BLADE_SYSTEM: true
  },
  MODELS: {
    PRIMARY: 'gemini-3.8-flash',
    LIVE: 'gemini-3.8-live',
    TTS: 'gemini-3.8-flash-tts'
  }
};

export default CONFIG;
