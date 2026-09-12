const { getCollection, setCollection } = require('../db/database');
const worldModel = require('../world/worldModel');

class ProactiveEngine {
  constructor() {
    this.lastEvaluationTime = 0;
    this.minIntervalMs = 10000; // Throttle to prevent spam
  }

  evaluateState() {
    const now = Date.now();
    if (now - this.lastEvaluationTime < this.minIntervalMs) {
      return this.getSuggestions();
    }
    this.lastEvaluationTime = now;

    const wmState = worldModel.getState();
    const suggestions = getCollection('proactiveSuggestions') || [];

    // Rule 1: Mission completed with uncommitted changes
    const completedMissions = wmState.activeMissions.filter(m => m.status === 'COMPLETED');
    if (completedMissions.length > 0 && wmState.files.length > 0) {
      this.addSuggestion({
        type: 'GIT_COMMIT',
        title: 'Mission Completed — Prepare Git Commit',
        description: `Mission "${completedMissions[0].title}" completed with ${wmState.files.length} modified files. Would you like me to prepare a git commit?`,
        actionPayload: { skillId: 'skill-git-cleanup' }
      });
    }

    // Rule 2: Unresolved failure detected
    const unresolvedFailures = wmState.recentFailures.filter(f => !f.resolved);
    if (unresolvedFailures.length > 0) {
      const latestFail = unresolvedFailures[0];
      this.addSuggestion({
        type: 'AUTO_REMEDIATION',
        title: `Failure in ${latestFail.component} — Auto Remediation Available`,
        description: `Error: "${latestFail.error}". I can launch a sandbox experiment to isolate and fix this issue.`,
        actionPayload: { failureId: latestFail.id, component: latestFail.component }
      });
    }

    // Rule 3: Active background task milestone
    const runningTasks = wmState.runningTasks || [];
    if (runningTasks.some(t => t.status === 'COMPLETED' && t.type === 'DEPLOYMENT_MONITOR')) {
      this.addSuggestion({
        type: 'VISUAL_VERIFICATION',
        title: 'Deployment Verified Active — Capture Screen?',
        description: 'Deployment monitor verified 200 OK. Would you like me to capture screen and inspect UI elements?',
        actionPayload: { tool: 'capture_screen' }
      });
    }

    return this.getSuggestions();
  }

  addSuggestion(suggestionData) {
    const suggestions = getCollection('proactiveSuggestions') || [];
    const exists = suggestions.some(s => s.title === suggestionData.title && !s.dismissed);
    if (exists) return;

    const newSug = {
      id: 'sug_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      ...suggestionData,
      dismissed: false,
      createdAt: new Date().toISOString()
    };

    suggestions.unshift(newSug);
    if (suggestions.length > 15) suggestions.pop();
    setCollection('proactiveSuggestions', suggestions);
    worldModel.addObservation(`[PROACTIVE INTELLIGENCE] Generated suggestion: "${newSug.title}"`);
  }

  dismissSuggestion(id) {
    const suggestions = getCollection('proactiveSuggestions') || [];
    const target = suggestions.find(s => s.id === id);
    if (target) {
      target.dismissed = true;
      setCollection('proactiveSuggestions', suggestions);
      return true;
    }
    return false;
  }

  getSuggestions() {
    const list = getCollection('proactiveSuggestions') || [];
    return list.filter(s => !s.dismissed).slice(0, 5);
  }
}

const proactiveEngine = new ProactiveEngine();
module.exports = proactiveEngine;
