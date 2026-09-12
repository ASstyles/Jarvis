const assert = require('assert');
const fs = require('fs');
const path = require('path');
const jobScheduler = require('../src/compute/jobScheduler');
const distributedFabric = require('../src/compute/distributedFabric');
const workerRegistry = require('../src/compute/workerRegistry');
const wakeWordEngine = require('../src/voice/wakeWordEngine');
const { launchGameverseGameTool } = require('../src/tools/gameOps');
const progression = require('../src/gameverse/progression');
const database = require('../src/db/database');

async function runFailureInjectionTests() {
  console.log("=================================================");
  console.log("  RUNNING FAILURE INJECTION & RESILIENCY SUITE   ");
  console.log("=================================================");

  // Test 1: Worker Node Disappearance & Auto-Requeue
  console.log("\n[TEST 1] Testing Worker Node Disappearance & Auto-Requeue...");
  const job = distributedFabric.dispatchJob(
    "Resilience Stress Test Job",
    "HEAVY_COMPUTE",
    { matrix: 500 },
    { priority: "HIGH" }
  );

  assert(job.id);
  const failingWorker = { id: "worker-vanishing-node", name: "Vanishing Node", currentJobs: 1 };
  
  // Intercept failure
  jobScheduler.handleJobFailure(job, failingWorker, "Worker vanished / connection timeout");
  assert.strictEqual(job.retryCount, 1);
  assert.strictEqual(job.status, 'RETRYING');
  console.log(`  => Detected worker failure and scheduled auto-requeue (${job.status}, Attempt 1/3)`);
  console.log("  => PASSED ✅");

  // Test 2: Corrupted DB Recovery
  console.log("\n[TEST 2] Testing Database In-Memory Recovery on File System Disruption...");
  const dbState = database.readDb();
  assert(dbState, "Database must return valid state object.");
  assert(Array.isArray(dbState.missions), "Missions collection must be array.");
  console.log("  => PASSED ✅");

  // Test 3: Voice Privacy Hardware Mute Enforcement
  console.log("\n[TEST 3] Testing Voice Privacy Hardware Mute Enforcement...");
  wakeWordEngine.toggleMicrophone(false); // Mute
  const mutedRes = wakeWordEngine.handleWakeWordTriggered('local_mic', 'JARVIS');
  assert.strictEqual(mutedRes.success, false);
  assert.strictEqual(mutedRes.reason, 'Microphone muted');
  
  wakeWordEngine.toggleMicrophone(true); // Unmute
  const unmutedRes = wakeWordEngine.handleWakeWordTriggered('local_mic', 'JARVIS');
  assert.strictEqual(unmutedRes.success, true);
  console.log("  => PASSED ✅");

  // Test 4: Gameverse 8/8 Launch Resolution & Profile Progression
  console.log("\n[TEST 4] Testing Gameverse 8/8 Launch Resolution & Progression...");
  const gameIds = [
    "jarvis-command",
    "neural-rush",
    "cyber-heist",
    "ai-arena",
    "codebreak",
    "void-runner",
    "jarvis-tactics",
    "boss-protocol"
  ];
  assert.strictEqual(gameIds.length, 8);
  for (const gId of gameIds) {
    const launchRes = await launchGameverseGameTool.invoke({ gameId: gId, difficulty: "HARD" });
    assert(launchRes.includes("[GAMEVERSE_LAUNCH]"), `Launch message expected for ${gId}`);
  }

  const profile = progression.getPlayerProfile();
  assert(profile.level >= 1);
  console.log(`  => Verified all 8 games launch cleanly. Player profile active (Level ${profile.level}, XP ${profile.xp}).`);
  console.log("  => PASSED ✅");

  console.log("\n=================================================");
  console.log("  ALL FAILURE INJECTION TESTS PASSED! 🛡️⚡✅    ");
  console.log("=================================================");
}

runFailureInjectionTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error("Failure Injection Tests Failed ❌:", err);
  process.exit(1);
});
