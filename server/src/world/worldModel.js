const path = require('path');
const os = require('os');
const { getCollection, setCollection } = require('../db/database');

class WorldModel {
  constructor() {
    this.listeners = [];
    this.state = this.loadState();
  }

  loadState() {
    const persisted = getCollection('worldModel') || {};
    const defaultModel = {
      userContext: {
        username: os.userInfo().username || 'User',
        os: os.platform() + ' ' + os.release(),
        arch: os.arch(),
        workspaceRoot: path.resolve(__dirname, '../../../'),
        hostname: os.hostname(),
        lastActive: new Date().toISOString()
      },
      currentGoal: null,
      activeMissions: [],
      projects: [
        {
          name: 'Jarvis',
          path: path.resolve(__dirname, '../../../'),
          type: 'Full-Stack AI Operating System (Next.js + Express)',
          status: 'ACTIVE'
        }
      ],
      files: [],
      applications: {
        activeWindow: 'JARVIS Command Center',
        openApps: ['Next.js Client', 'Express Neural Server']
      },
      visualPerception: {
        currentScreenshot: null,
        detectedElements: [],
        detectedState: 'Desktop Active',
        visibleErrors: [],
        confidence: 0.98,
        status: 'Observed', // 'Observed' | 'Inferred' | 'Remembered' | 'Verified'
        lastPerceptionTimestamp: new Date().toISOString()
      },
      computeFabric: {
        activeWorkersCount: 1,
        runningJobsCount: 0,
        clusterHealth: 100,
        workerNodes: []
      },
      voiceState: {
        wakeWordActive: true,
        state: 'IDLE',
        lastSpokenCommand: null,
        micActive: true
      },
      processes: [],
      runningTasks: [],
      availableTools: [],
      externalServices: [
        { name: 'Gemini Neural API', status: 'ONLINE' },
        { name: 'Local Shell / PowerShell', status: 'ONLINE' },
        { name: 'Gameverse Engine', status: 'ONLINE' }
      ],
      recentObservations: [],
      constraints: [
        'Require user confirmation for destructive file/system actions',
        'Protect critical OS processes from termination'
      ],
      pendingApprovals: [],
      recentFailures: [],
      gameverseState: {
        activeGame: null,
        playerLevel: 1,
        totalScore: 0
      },
      lastUpdated: new Date().toISOString()
    };

    return { ...defaultModel, ...persisted };
  }

  saveState() {
    this.state.lastUpdated = new Date().toISOString();
    setCollection('worldModel', this.state);
    this.notifyListeners();
  }

  onUpdate(callback) {
    this.listeners.push(callback);
  }

  notifyListeners() {
    const payload = { type: 'WORLD_MODEL_UPDATED', worldModel: this.state };
    this.listeners.forEach(cb => {
      try {
        cb(payload);
      } catch (err) {
        console.error('[WORLD_MODEL] Listener error:', err);
      }
    });
  }

  getState() {
    return this.state;
  }

  // Update Methods
  setCurrentGoal(goal) {
    this.state.currentGoal = goal;
    this.addObservation(`Current goal updated to: "${goal}"`);
    this.saveState();
  }

  updateActiveMissions(missions) {
    this.state.activeMissions = missions;
    this.saveState();
  }

  recordFileAccess(filePath, action = 'READ') {
    const existingIdx = this.state.files.findIndex(f => f.path === filePath);
    const fileRecord = {
      path: filePath,
      basename: path.basename(filePath),
      lastAction: action,
      timestamp: new Date().toISOString()
    };
    if (existingIdx >= 0) {
      this.state.files[existingIdx] = fileRecord;
    } else {
      this.state.files.unshift(fileRecord);
      if (this.state.files.length > 20) this.state.files.pop();
    }
    this.addObservation(`File ${action}: ${path.basename(filePath)}`);
    this.saveState();
  }

  updateActiveWindow(windowTitle) {
    if (this.state.applications.activeWindow !== windowTitle) {
      this.state.applications.activeWindow = windowTitle;
      this.addObservation(`Focused window changed to: "${windowTitle}"`);
      this.saveState();
    }
  }

  updateVisualPerception(perceptionData) {
    this.state.visualPerception = {
      ...this.state.visualPerception,
      ...perceptionData,
      lastPerceptionTimestamp: new Date().toISOString()
    };
    if (perceptionData.detectedState) {
      this.addObservation(`[VISUAL PERCEPTION] State: "${perceptionData.detectedState}" (Confidence: ${perceptionData.confidence || 0.95})`);
    }
    this.saveState();
  }

  updateComputeFabricState(fabricData) {
    this.state.computeFabric = {
      ...this.state.computeFabric,
      ...fabricData
    };
    this.saveState();
  }

  updateVoiceState(voiceData) {
    this.state.voiceState = {
      ...this.state.voiceState,
      ...voiceData
    };
    this.saveState();
  }

  updateRunningTasks(tasks) {
    this.state.runningTasks = tasks;
    this.saveState();
  }

  updateAvailableTools(toolNames) {
    this.state.availableTools = toolNames;
    this.saveState();
  }

  addObservation(observation) {
    this.state.recentObservations.unshift({
      id: 'obs_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      text: observation,
      timestamp: new Date().toISOString()
    });
    if (this.state.recentObservations.length > 30) {
      this.state.recentObservations.pop();
    }
    this.saveState();
  }

  recordFailure(component, error, context = {}) {
    const failure = {
      id: 'fail_' + Date.now(),
      component,
      error: error instanceof Error ? error.message : String(error),
      context,
      timestamp: new Date().toISOString(),
      resolved: false
    };
    this.state.recentFailures.unshift(failure);
    if (this.state.recentFailures.length > 20) {
      this.state.recentFailures.pop();
    }
    this.addObservation(`[FAILURE] in ${component}: ${failure.error}`);
    this.saveState();
    return failure;
  }

  resolveFailure(failureId, resolution) {
    const failure = this.state.recentFailures.find(f => f.id === failureId);
    if (failure) {
      failure.resolved = true;
      failure.resolution = resolution;
      failure.resolvedAt = new Date().toISOString();
      this.addObservation(`[RECOVERED] Failure ${failureId} resolved: ${resolution}`);
      this.saveState();
    }
  }

  updatePendingApprovals(approvals) {
    this.state.pendingApprovals = approvals;
    this.saveState();
  }

  updateGameverseState(gameverseData) {
    this.state.gameverseState = { ...this.state.gameverseState, ...gameverseData };
    this.saveState();
  }

  // Generates structured text summary for LLM context
  generateContextPrompt() {
    const { userContext, currentGoal, activeMissions, applications, visualPerception, computeFabric, runningTasks, recentObservations, recentFailures } = this.state;
    
    let prompt = "=== JARVIS WORLD MODEL 3.0 (CURRENT ENVIRONMENT STATE) ===\n";
    prompt += `User: ${userContext.username} | OS: ${userContext.os} (${userContext.arch})\n`;
    prompt += `Workspace Root: ${userContext.workspaceRoot}\n`;
    prompt += `Active Window: ${applications.activeWindow || 'None'}\n`;
    
    if (visualPerception && visualPerception.detectedState) {
      prompt += `Visual State [${visualPerception.status}]: ${visualPerception.detectedState} (Confidence: ${Math.round((visualPerception.confidence || 0.9) * 100)}%)\n`;
      if (visualPerception.visibleErrors && visualPerception.visibleErrors.length > 0) {
        prompt += `Visible UI Errors: ${visualPerception.visibleErrors.join('; ')}\n`;
      }
    }

    if (computeFabric && computeFabric.activeWorkersCount) {
      prompt += `Compute Fabric: ${computeFabric.activeWorkersCount} Workers Online | Health: ${computeFabric.clusterHealth}%\n`;
    }

    if (currentGoal) {
      prompt += `Current Goal: ${currentGoal}\n`;
    }

    if (activeMissions && activeMissions.length > 0) {
      prompt += `Active Missions: ${activeMissions.map(m => `"${m.title}" (${m.progress}%)`).join(', ')}\n`;
    }

    if (runningTasks && runningTasks.length > 0) {
      prompt += `Running Background Tasks: ${runningTasks.map(t => `${t.id} [${t.status}]`).join(', ')}\n`;
    }

    if (recentFailures && recentFailures.filter(f => !f.resolved).length > 0) {
      const activeFailures = recentFailures.filter(f => !f.resolved).slice(0, 3);
      prompt += `Recent Unresolved Failures:\n` + activeFailures.map(f => ` - [${f.component}] ${f.error}`).join('\n') + '\n';
    }

    if (recentObservations && recentObservations.length > 0) {
      prompt += `Recent Environmental Observations:\n` + recentObservations.slice(0, 5).map(o => ` - ${o.text}`).join('\n') + '\n';
    }

    prompt += "===========================================================\n";
    return prompt;
  }
}

const worldModel = new WorldModel();
module.exports = worldModel;
