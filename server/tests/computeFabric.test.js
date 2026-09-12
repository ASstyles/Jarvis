const assert = require('assert');
const workerRegistry = require('../src/compute/workerRegistry');
const jobScheduler = require('../src/compute/jobScheduler');
const distributedFabric = require('../src/compute/distributedFabric');

async function runComputeFabricTests() {
  console.log("=========================================");
  console.log("  RUNNING DISTRIBUTED COMPUTE TESTS      ");
  console.log("=========================================");

  // Test 1: Worker Nodes Seeding & Registration
  console.log("\n[TEST 1] Testing Worker Nodes Registration & Health...");
  const workers = workerRegistry.getAllWorkers();
  assert(workers.length >= 3, `Expected at least 3 workers, found ${workers.length}`);
  
  const master = workerRegistry.getWorkerById('worker-local-master');
  assert(master, "Master node must exist.");
  assert.strictEqual(master.status, 'ONLINE');
  assert(master.cpuCores > 0);
  console.log(`  => Found ${workers.length} nodes. Master: ${master.name} (${master.cpuCores} Cores, ${Math.round(master.memoryMb / 1024)}GB RAM)`);
  console.log("  => PASSED ✅");

  // Test 2: Distributed Job Scheduling & Capability Matching
  console.log("\n[TEST 2] Testing Job Scheduling & Capability Matching...");
  const job = distributedFabric.dispatchJob(
    "Matrix Multiplication Compute Job",
    "HEAVY_COMPUTE",
    { matrixSize: 1000 },
    { priority: "HIGH" }
  );

  assert(job.id, "Job ID must be generated.");
  assert(['QUEUED', 'ASSIGNED', 'RUNNING', 'COMPLETED'].includes(job.status));
  console.log(`  => Job "${job.title}" dispatched (ID: ${job.id}, Initial Status: ${job.status})`);

  // Wait for asynchronous job completion
  await new Promise(resolve => {
    const check = setInterval(() => {
      const current = jobScheduler.getJobById(job.id);
      if (current.status === 'COMPLETED') {
        clearInterval(check);
        resolve();
      }
    }, 200);
  });

  const completedJob = jobScheduler.getJobById(job.id);
  assert.strictEqual(completedJob.status, 'COMPLETED');
  assert(completedJob.output, "Job output must exist.");
  console.log(`  => Job completed on worker "${completedJob.workerName}".`);
  console.log("  => PASSED ✅");

  // Test 3: Worker Failure & Automatic Job Requeue Failover
  console.log("\n[TEST 3] Testing Worker Failure Handling & Auto-Requeue Failover...");
  const failoverJob = jobScheduler.submitJob("Failover Resiliency Test", "DATA_PROCESSING", { dataChunks: 4 });
  
  // Simulate worker failure on initial attempt
  const mockFailingWorker = { name: "Mock Failing Node", id: "mock-fail-1", currentJobs: 1 };
  jobScheduler.handleJobFailure(failoverJob, mockFailingWorker, "Connection reset by peer");
  
  assert.strictEqual(failoverJob.retryCount, 1);
  assert.strictEqual(failoverJob.status, 'RETRYING');
  console.log(`  => Failover intercepted failure: ${failoverJob.error}`);
  console.log("  => PASSED ✅");

  // Test 4: Distributed Cluster Health Metrics
  console.log("\n[TEST 4] Testing Cluster Status Telemetry...");
  const clusterStatus = distributedFabric.getClusterStatus();
  assert(typeof clusterStatus.clusterHealth === 'number');
  assert(clusterStatus.totalWorkers >= 3);
  assert(clusterStatus.onlineWorkers >= 1);
  console.log(`  => Cluster Health: ${clusterStatus.clusterHealth}%, Online Nodes: ${clusterStatus.onlineWorkers}/${clusterStatus.totalWorkers}`);
  console.log("  => PASSED ✅");

  console.log("\n=========================================");
  console.log("  ALL DISTRIBUTED COMPUTE TESTS PASSED! ⚡ ");
  console.log("=========================================");
}

runComputeFabricTests().catch(err => {
  console.error("Compute Fabric Tests Failed ❌:", err);
  process.exit(1);
});
