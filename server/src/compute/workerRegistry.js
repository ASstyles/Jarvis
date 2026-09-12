const os = require('os');
const { getCollection, setCollection } = require('../db/database');

class WorkerRegistry {
  constructor() {
    this.workers = this.loadWorkers();
    this.listeners = [];
    this.startHeartbeatMonitor();
  }

  loadWorkers() {
    const persisted = getCollection('workerNodes') || [];
    if (persisted.length > 0) return persisted;

    // Seed production worker fabric nodes
    const localCores = os.cpus() ? os.cpus().length : 8;
    const localMemMb = Math.round(os.totalmem() / (1024 * 1024));

    const defaultNodes = [
      {
        id: 'worker-local-master',
        name: 'Local Master Node (Host OS)',
        type: 'LOCAL',
        status: 'ONLINE',
        capabilities: ['coding', 'research', 'vision_inference', 'data_analysis', 'sandbox_test', 'heavy_compute'],
        cpuCores: localCores,
        memoryMb: localMemMb,
        gpuPresent: true,
        currentJobs: 0,
        health: 100,
        lastHeartbeat: new Date().toISOString(),
        version: 'JARVIS-3.0.1'
      },
      {
        id: 'worker-remote-alpha',
        name: 'Remote Cloud Accelerator (Alpha Node)',
        type: 'REMOTE',
        status: 'ONLINE',
        capabilities: ['heavy_compute', 'data_analysis', 'vision_inference', 'sandbox_test'],
        cpuCores: 16,
        memoryMb: 32768,
        gpuPresent: true,
        currentJobs: 0,
        health: 98,
        lastHeartbeat: new Date().toISOString(),
        version: 'JARVIS-3.0.1'
      },
      {
        id: 'worker-cluster-edge',
        name: 'Distributed Cluster Edge (Node 03)',
        type: 'CLUSTER',
        status: 'ONLINE',
        capabilities: ['coding', 'sandbox_test', 'research'],
        cpuCores: 4,
        memoryMb: 8192,
        gpuPresent: false,
        currentJobs: 0,
        health: 100,
        lastHeartbeat: new Date().toISOString(),
        version: 'JARVIS-3.0.1'
      }
    ];

    setCollection('workerNodes', defaultNodes);
    return defaultNodes;
  }

  saveWorkers() {
    setCollection('workerNodes', this.workers);
    this.notify();
  }

  onUpdate(cb) {
    this.listeners.push(cb);
  }

  notify() {
    const payload = { type: 'WORKERS_UPDATED', workers: this.workers };
    this.listeners.forEach(cb => {
      try { cb(payload); } catch (_) {}
    });
  }

  getAllWorkers() {
    return this.workers;
  }

  getWorkerById(id) {
    return this.workers.find(w => w.id === id);
  }

  registerWorker(workerData) {
    const existingIdx = this.workers.findIndex(w => w.id === workerData.id);
    const node = {
      id: workerData.id || `worker_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: workerData.name || 'Custom Distributed Node',
      type: workerData.type || 'REMOTE',
      status: 'ONLINE',
      capabilities: workerData.capabilities || ['general'],
      cpuCores: workerData.cpuCores || 4,
      memoryMb: workerData.memoryMb || 8192,
      gpuPresent: !!workerData.gpuPresent,
      currentJobs: 0,
      health: 100,
      lastHeartbeat: new Date().toISOString(),
      version: 'JARVIS-3.0.1'
    };

    if (existingIdx >= 0) {
      this.workers[existingIdx] = { ...this.workers[existingIdx], ...node };
    } else {
      this.workers.push(node);
    }

    this.saveWorkers();
    return node;
  }

  recordHeartbeat(workerId) {
    const worker = this.getWorkerById(workerId);
    if (worker) {
      worker.lastHeartbeat = new Date().toISOString();
      if (worker.status === 'UNAVAILABLE') {
        worker.status = 'ONLINE';
      }
      this.saveWorkers();
      return true;
    }
    return false;
  }

  updateWorkerStatus(workerId, status) {
    const worker = this.getWorkerById(workerId);
    if (worker) {
      worker.status = status;
      this.saveWorkers();
    }
  }

  // Monitor worker node heartbeats and detect failures
  startHeartbeatMonitor() {
    const timer = setInterval(() => {
      const now = Date.now();
      let changed = false;

      this.workers.forEach(w => {
        const lastBeat = new Date(w.lastHeartbeat).getTime();
        // If no heartbeat for > 60 seconds (unless local master), mark UNAVAILABLE
        if (w.type !== 'LOCAL' && now - lastBeat > 60000 && w.status === 'ONLINE') {
          w.status = 'UNAVAILABLE';
          w.health = 0;
          changed = true;
          console.warn(`[WORKER_REGISTRY] Worker node "${w.name}" (${w.id}) heartbeat expired. Marked UNAVAILABLE.`);
        }
      });

      if (changed) this.saveWorkers();
    }, 15000);
    if (timer.unref) timer.unref();
  }
}

const workerRegistry = new WorkerRegistry();
module.exports = workerRegistry;
