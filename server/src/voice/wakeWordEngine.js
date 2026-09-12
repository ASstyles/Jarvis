const worldModel = require('../world/worldModel');
const goalEngine = require('../goals/goalEngine');
const taskEngine = require('../tasks/taskEngine');
const { securityGuard, OPERATING_MODES } = require('../security/securityGuard');
const { getCollection, setCollection } = require('../db/database');

class WakeWordEngine {
  constructor() {
    this.state = 'IDLE'; // 'IDLE' | 'LISTENING_FOR_WAKE_WORD' | 'WAKE_WORD_DETECTED' | 'LISTENING' | 'UNDERSTANDING' | 'PLANNING' | 'EXECUTING' | 'RESPONDING'
    this.micActive = true;
    this.provider = 'WebAudio Local VAD & Keyword Matcher (Offline)';
    this.detectionHistory = [];
    this.listeners = [];
  }

  onStateChange(cb) {
    this.listeners.push(cb);
  }

  notifyStateChange(newState, payload = {}) {
    this.state = newState;
    worldModel.updateVoiceState({
      state: newState,
      micActive: this.micActive,
      wakeWordActive: true,
      lastEvent: payload
    });

    this.listeners.forEach(cb => {
      try {
        cb({ state: newState, payload, timestamp: new Date().toISOString() });
      } catch (err) {
        console.error('[WAKE_WORD] Listener error:', err);
      }
    });
  }

  // Handles incoming detection event from client or local runtime
  handleWakeWordTriggered(source = 'local_mic', phrase = 'JARVIS') {
    if (!this.micActive) return { success: false, reason: 'Microphone muted' };

    const event = {
      id: 'wake_' + Date.now(),
      phrase,
      source,
      provider: this.provider,
      timestamp: new Date().toISOString()
    };

    this.detectionHistory.unshift(event);
    if (this.detectionHistory.length > 50) this.detectionHistory.pop();

    setCollection('wakeWordTelemetry', this.detectionHistory);
    worldModel.addObservation(`[VOICE 3.0] Offline wake-word detected: "${phrase}"`);
    
    this.notifyStateChange('WAKE_WORD_DETECTED', event);

    setTimeout(() => {
      if (this.state === 'WAKE_WORD_DETECTED') {
        this.notifyStateChange('LISTENING');
      }
    }, 400);

    return { success: true, event };
  }

  // Intercepts spoken task control and mode commands
  handleVoiceCommand(transcript) {
    if (!transcript || typeof transcript !== 'string') return null;
    const lower = transcript.toLowerCase().replace(/[,.!?]/g, '').trim();

    // 1. Operating Mode Switch Commands
    if (lower.includes('zero friction') || lower.includes('zero-friction')) {
      const mode = securityGuard.setOperatingMode(OPERATING_MODES.ZERO_FRICTION);
      worldModel.addObservation(`[VOICE_CONTROL] Operating mode switched to ${mode}`);
      return {
        handled: true,
        action: 'SET_MODE',
        mode: OPERATING_MODES.ZERO_FRICTION,
        message: 'Zero-Friction Mode engaged. Direct and decisive execution online.'
      };
    }

    if (lower.includes('autonomous mode') || lower.includes('switch back to autonomous') || lower.includes('switch to autonomous')) {
      const mode = securityGuard.setOperatingMode(OPERATING_MODES.AUTONOMOUS);
      worldModel.addObservation(`[VOICE_CONTROL] Operating mode switched to ${mode}`);
      return {
        handled: true,
        action: 'SET_MODE',
        mode: OPERATING_MODES.AUTONOMOUS,
        message: 'Autonomous Mode active. Standard multi-step mission execution enabled.'
      };
    }

    if (lower.includes('assisted mode') || lower.includes('switch to assisted')) {
      const mode = securityGuard.setOperatingMode(OPERATING_MODES.ASSISTED);
      worldModel.addObservation(`[VOICE_CONTROL] Operating mode switched to ${mode}`);
      return {
        handled: true,
        action: 'SET_MODE',
        mode: OPERATING_MODES.ASSISTED,
        message: 'Assisted Mode active. Checkpointing and direct user confirmation engaged.'
      };
    }

    // 2. Interruption: STOP / PAUSE / HALT
    if (lower === 'jarvis stop' || lower === 'stop' || lower === 'jarvis pause' || lower === 'pause' || lower === 'halt') {
      const activeMission = goalEngine.getActiveMission();
      if (activeMission) {
        goalEngine.pauseMission(activeMission.id);
        worldModel.addObservation(`[VOICE_CONTROL] Paused active mission: "${activeMission.title}"`);
        return {
          handled: true,
          action: 'PAUSE',
          message: `Paused active mission: ${activeMission.title}`
        };
      }
      return { handled: true, action: 'PAUSE', message: 'System paused all active tasks.' };
    }

    // 3. Interruption: RESUME / CONTINUE
    if (lower === 'jarvis continue' || lower === 'continue' || lower === 'jarvis resume' || lower === 'resume') {
      const missions = goalEngine.getAllMissions();
      const paused = missions.find(m => m.status === 'PAUSED');
      if (paused) {
        goalEngine.resumeMission(paused.id);
        worldModel.addObservation(`[VOICE_CONTROL] Resumed mission: "${paused.title}"`);
        return {
          handled: true,
          action: 'RESUME',
          message: `Resumed mission: ${paused.title}`
        };
      }
      return { handled: true, action: 'RESUME', message: 'Resumed system operation.' };
    }

    // 4. Interruption: CANCEL THAT / ABORT
    if (lower === 'jarvis cancel that' || lower === 'cancel that' || lower === 'jarvis abort' || lower === 'abort' || lower === 'cancel') {
      const activeMission = goalEngine.getActiveMission();
      if (activeMission) {
        goalEngine.cancelMission(activeMission.id, 'Cancelled via voice command');
        worldModel.addObservation(`[VOICE_CONTROL] Cancelled active mission: "${activeMission.title}"`);
        return {
          handled: true,
          action: 'CANCEL',
          message: `Cancelled active mission: ${activeMission.title}`
        };
      }
      return { handled: true, action: 'CANCEL', message: 'Cancelled current operation.' };
    }

    // 5. Interruption: UNDO THAT
    if (lower.includes('undo that') || lower.includes('undo last action')) {
      const state = worldModel.getState();
      const recentObs = state.recentObservations ? state.recentObservations.slice(0, 3).map(o => o.text).join('; ') : 'None';
      return {
        handled: true,
        action: 'UNDO',
        message: `Inspecting state for rollback. Recent operations: ${recentObs}`
      };
    }

    // 6. Live Activity: SHOW ME WHAT YOU'RE DOING / STATUS
    if (lower.includes('what are you doing') || lower.includes('show me what you') || lower.includes('status')) {
      const state = worldModel.getState();
      const activeMission = goalEngine.getActiveMission();
      const currentMode = securityGuard.getOperatingMode();
      const activeCount = state.activeMissions ? state.activeMissions.length : 0;
      
      let msg = `Operating in ${currentMode} mode. `;
      if (activeMission) {
        msg += `Currently executing mission "${activeMission.title}" at ${activeMission.progress}% progress.`;
      } else {
        msg += `Core idle, all systems nominal. ${activeCount} active missions registered.`;
      }

      return {
        handled: true,
        action: 'STATUS',
        message: msg
      };
    }

    return null;
  }

  toggleMicrophone(enabled) {
    this.micActive = enabled !== undefined ? enabled : !this.micActive;
    worldModel.updateVoiceState({ micActive: this.micActive });
    this.notifyStateChange(this.micActive ? 'IDLE' : 'MUTED');
    return { micActive: this.micActive };
  }

  getTelemetry() {
    return {
      state: this.state,
      micActive: this.micActive,
      provider: this.provider,
      operatingMode: securityGuard.getOperatingMode(),
      recentDetections: this.detectionHistory.slice(0, 10),
      isOffline: true
    };
  }
}

const wakeWordEngine = new WakeWordEngine();
module.exports = wakeWordEngine;
