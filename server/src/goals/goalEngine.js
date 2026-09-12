const { getCollection, setCollection } = require('../db/database');

class GoalEngine {
  constructor() {
    this.activeMissionId = null;
  }

  createMission(title, objective, subtasks = [], options = {}) {
    const missions = getCollection('missions');
    const id = 'mission_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    
    const formattedSubtasks = subtasks.map((st, idx) => {
      const isStr = typeof st === 'string';
      const taskId = `${id}_task_${idx + 1}`;
      return {
        id: isStr ? taskId : (st.id || taskId),
        title: isStr ? st : st.title,
        description: isStr ? '' : (st.description || ''),
        agentType: isStr ? 'general' : (st.agentType || 'general'),
        status: 'PENDING',
        priority: isStr ? 'MEDIUM' : (st.priority || 'MEDIUM'),
        dependencies: isStr ? [] : (st.dependencies || []),
        result: null,
        error: null,
        retryCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });

    const newMission = {
      id,
      title,
      objective,
      status: 'IN_PROGRESS',
      progress: 0,
      priority: options.priority || 'HIGH',
      deadline: options.deadline || null,
      blockers: [],
      nextActions: formattedSubtasks.length > 0 ? [formattedSubtasks[0].title] : [],
      subtasks: formattedSubtasks,
      artifacts: options.artifacts || [],
      checkpoints: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    missions.unshift(newMission);
    setCollection('missions', missions);
    this.activeMissionId = id;
    
    // Sync with World Model
    try {
      const worldModel = require('../world/worldModel');
      worldModel.setCurrentGoal(title + ': ' + objective);
      worldModel.updateActiveMissions(this.getMissions().filter(m => m.status === 'IN_PROGRESS'));
      worldModel.addObservation(`Created Mission "${title}" with ${formattedSubtasks.length} subtasks.`);
    } catch (_) {}

    console.log(`[GOAL_ENGINE] Created Mission: "${title}" (ID: ${id}) with ${formattedSubtasks.length} subtasks.`);
    return newMission;
  }

  getActiveMission() {
    if (!this.activeMissionId) {
      const missions = getCollection('missions');
      const inProgress = missions.find(m => m.status === 'IN_PROGRESS');
      if (inProgress) this.activeMissionId = inProgress.id;
    }

    if (this.activeMissionId) {
      const missions = getCollection('missions');
      return missions.find(m => m.id === this.activeMissionId) || null;
    }
    return null;
  }

  getMissionById(missionId) {
    const missions = getCollection('missions');
    return missions.find(m => m.id === missionId) || null;
  }

  // Resolves subtasks ready for execution (all dependencies satisfied)
  getExecutableSubtasks(missionId) {
    const mission = this.getMissionById(missionId);
    if (!mission || mission.status !== 'IN_PROGRESS') return [];

    const completedIds = new Set(
      mission.subtasks.filter(st => st.status === 'COMPLETED').map(st => st.id)
    );

    return mission.subtasks.filter(st => {
      if (st.status !== 'PENDING') return false;
      if (!st.dependencies || st.dependencies.length === 0) return true;
      return st.dependencies.every(depId => completedIds.has(depId));
    });
  }

  updateSubtask(taskId, status, result = null, error = null) {
    const missions = getCollection('missions');
    const mission = missions.find(m => m.subtasks.some(st => st.id === taskId));
    if (!mission) return false;

    const subtask = mission.subtasks.find(st => st.id === taskId);
    if (subtask) {
      subtask.status = status;
      if (result) subtask.result = result;
      if (error) subtask.error = error;
      subtask.updatedAt = new Date().toISOString();
    }

    // Calculate progress %
    const completedCount = mission.subtasks.filter(st => st.status === 'COMPLETED').length;
    mission.progress = Math.round((completedCount / mission.subtasks.length) * 100);

    // Update next actions
    const pending = mission.subtasks.filter(st => st.status === 'PENDING');
    mission.nextActions = pending.slice(0, 2).map(st => st.title);

    if (completedCount === mission.subtasks.length) {
      mission.status = 'COMPLETED';
      console.log(`[GOAL_ENGINE] Mission "${mission.title}" is now 100% COMPLETED!`);
    } else if (mission.subtasks.some(st => st.status === 'IN_PROGRESS')) {
      mission.status = 'IN_PROGRESS';
    }

    mission.updatedAt = new Date().toISOString();
    setCollection('missions', missions);

    // Sync World Model
    try {
      const worldModel = require('../world/worldModel');
      worldModel.updateActiveMissions(this.getMissions().filter(m => m.status === 'IN_PROGRESS'));
    } catch (_) {}

    return true;
  }

  addArtifact(missionId, artifact) {
    const missions = getCollection('missions');
    const mission = missions.find(m => m.id === missionId);
    if (mission) {
      mission.artifacts.push({
        id: 'art_' + Date.now(),
        ...artifact,
        createdAt: new Date().toISOString()
      });
      mission.updatedAt = new Date().toISOString();
      setCollection('missions', missions);
      return true;
    }
    return false;
  }

  addBlocker(missionId, blocker) {
    const missions = getCollection('missions');
    const mission = missions.find(m => m.id === missionId);
    if (mission) {
      mission.blockers.push({
        id: 'blk_' + Date.now(),
        text: blocker,
        timestamp: new Date().toISOString()
      });
      mission.updatedAt = new Date().toISOString();
      setCollection('missions', missions);
      return true;
    }
    return false;
  }

  pauseMission(missionId) {
    const missions = getCollection('missions');
    const mission = missions.find(m => m.id === missionId);
    if (mission && mission.status === 'IN_PROGRESS') {
      mission.status = 'PAUSED';
      mission.updatedAt = new Date().toISOString();
      setCollection('missions', missions);
      return true;
    }
    return false;
  }

  resumeMission(missionId) {
    const missions = getCollection('missions');
    const mission = missions.find(m => m.id === missionId);
    if (mission && mission.status === 'PAUSED') {
      mission.status = 'IN_PROGRESS';
      this.activeMissionId = missionId;
      mission.updatedAt = new Date().toISOString();
      setCollection('missions', missions);
      return true;
    }
    return false;
  }

  cancelMission(missionId, reason = 'Cancelled by user') {
    const missions = getCollection('missions');
    const mission = missions.find(m => m.id === missionId);
    if (mission) {
      mission.status = 'CANCELLED';
      mission.cancellationReason = reason;
      mission.updatedAt = new Date().toISOString();
      setCollection('missions', missions);
      if (this.activeMissionId === missionId) this.activeMissionId = null;
      return true;
    }
    return false;
  }

  completeMission(missionId, summary = "") {
    const missions = getCollection('missions');
    const mission = missions.find(m => m.id === missionId);
    if (mission) {
      mission.status = 'COMPLETED';
      mission.progress = 100;
      mission.summary = summary;
      mission.updatedAt = new Date().toISOString();
      setCollection('missions', missions);
      if (this.activeMissionId === missionId) this.activeMissionId = null;

      try {
        const worldModel = require('../world/worldModel');
        worldModel.addObservation(`Mission "${mission.title}" completed successfully.`);
        worldModel.updateActiveMissions(this.getMissions().filter(m => m.status === 'IN_PROGRESS'));
      } catch (_) {}

      return true;
    }
    return false;
  }

  getMissions() {
    return getCollection('missions');
  }

  getAllMissions() {
    return this.getMissions();
  }
}

const goalEngine = new GoalEngine();
module.exports = goalEngine;
