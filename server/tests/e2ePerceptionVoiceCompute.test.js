const assert = require('assert');
const wakeWordEngine = require('../src/voice/wakeWordEngine');
const visualGrounding = require('../src/vision/visualGrounding');
const visualVerification = require('../src/vision/visualVerification');
const distributedFabric = require('../src/compute/distributedFabric');
const jobScheduler = require('../src/compute/jobScheduler');
const worldModel = require('../src/world/worldModel');

async function runEndToEndPerceptionVoiceComputeTest() {
  console.log("=========================================================");
  console.log("  RUNNING JARVIS 3.0 END-TO-END UNIFIED PIPELINE TEST    ");
  console.log("=========================================================");

  // Step 1: Spoken Voice Wake-Word Detection
  console.log("\n[STEP 1] Offline Wake-Word Detection & Activation...");
  const wakeRes = wakeWordEngine.handleWakeWordTriggered('local_mic', 'Hey JARVIS');
  assert.strictEqual(wakeRes.success, true);
  console.log("  => Voice State: WAKE_WORD_DETECTED -> Listening OK ✅");

  // Step 2: Visual Perception & Semantic Grounding
  console.log("\n[STEP 2] Visual Perception & UI Element Grounding...");
  const groundRes = await visualGrounding.groundElement("Command Center tab");
  assert.strictEqual(groundRes.success, true);
  assert(groundRes.matchedElement);
  console.log(`  => Grounded "${groundRes.matchedElement.label}" at (${groundRes.matchedElement.center.x}, ${groundRes.matchedElement.center.y}) (Confidence: ${Math.round(groundRes.matchedElement.confidence * 100)}%) ✅`);

  // Step 3: Distributed Compute Job Execution
  console.log("\n[STEP 3] Dispatching Compute Job on Distributed Fabric...");
  const job = distributedFabric.dispatchJob(
    "Deep Neural Analysis",
    "HEAVY_COMPUTE",
    { iterations: 1000 },
    { priority: "HIGH" }
  );
  assert(job.id);

  // Await completion
  await new Promise(r => setTimeout(r, 400));
  const completedJob = jobScheduler.getJobById(job.id);
  assert(['RUNNING', 'COMPLETED'].includes(completedJob.status));
  console.log(`  => Distributed job assigned to: "${completedJob.workerName}" (Status: ${completedJob.status}) ✅`);

  // Step 4: Visual State Verification
  console.log("\n[STEP 4] Visual Verification of State Transition...");
  const verifyRes = await visualVerification.verifyAction("Switched to Command Center tab", "Command Center");
  assert.strictEqual(verifyRes.success, true);
  assert.strictEqual(verifyRes.verified, true);
  console.log(`  => Visual state verified cleanly (${verifyRes.status}) ✅`);

  // Step 5: World Model State Integrity
  console.log("\n[STEP 5] Validating World Model 3.0 Synchronized State...");
  const wm = worldModel.getState();
  assert(wm.visualPerception, "Visual perception state must exist.");
  assert(wm.computeFabric, "Compute fabric state must exist.");
  assert(wm.voiceState, "Voice state must exist.");
  console.log("  => World Model contains synchronized Perception, Voice, and Compute Fabric telemetry ✅");

  console.log("\n=========================================================");
  console.log("  JARVIS 3.0 END-TO-END TEST PASSED! 👁️🎙️⚡✅            ");
  console.log("=========================================================");
}

runEndToEndPerceptionVoiceComputeTest().catch(err => {
  console.error("End-to-End Test Failed ❌:", err);
  process.exit(1);
});
