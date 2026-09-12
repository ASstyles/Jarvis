const workerRegistry = require('./workerRegistry');
const jobScheduler = require('./jobScheduler');
const worldModel = require('../world/worldModel');

class DistributedFabric {
  constructor() {}

  // Dispatches a compute-heavy task across the worker cluster
  dispatchJob(title, type, payload = {}, options = {}) {
    return jobScheduler.submitJob(title, type, payload, options);
  }

  // Returns live cluster health, worker nodes, and active/queued job statistics
  getClusterStatus() {
    const workers = workerRegistry.getAllWorkers();
    const jobs = jobScheduler.getAllJobs();
    const onlineCount = workers.filter(w => w.status === 'ONLINE').length;
    const runningJobs = jobs.filter(j => j.status === 'RUNNING');
    const queuedJobs = jobs.filter(j => j.status === 'QUEUED');

    return {
      clusterHealth: Math.round((onlineCount / Math.max(1, workers.length)) * 100),
      totalWorkers: workers.length,
      onlineWorkers: onlineCount,
      workers,
      runningJobsCount: runningJobs.length,
      queuedJobsCount: queuedJobs.length,
      recentJobs: jobs.slice(0, 10),
      timestamp: new Date().toISOString()
    };
  }

  cancelJob(jobId, reason) {
    return jobScheduler.cancelJob(jobId, reason);
  }

  registerWorker(workerData) {
    return workerRegistry.registerWorker(workerData);
  }

  recordHeartbeat(workerId) {
    return workerRegistry.recordHeartbeat(workerId);
  }
}

const distributedFabric = new DistributedFabric();
module.exports = distributedFabric;
