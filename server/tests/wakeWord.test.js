const assert = require('assert');
const wakeWordEngine = require('../src/voice/wakeWordEngine');
const goalEngine = require('../src/goals/goalEngine');

function runWakeWordTests() {
  console.log("=========================================");
  console.log("  RUNNING OFFLINE WAKE-WORD TESTS        ");
  console.log("=========================================");

  // Test 1: Offline Wake-Word Detection Event
  console.log("\n[TEST 1] Testing Wake-Word Event Triggering...");
  const triggerRes = wakeWordEngine.handleWakeWordTriggered('local_mic', 'JARVIS');
  assert.strictEqual(triggerRes.success, true);
  assert(triggerRes.event);
  assert.strictEqual(triggerRes.event.phrase, 'JARVIS');
  console.log("  => PASSED ✅");

  // Test 2: Privacy Mute Toggle
  console.log("\n[TEST 2] Testing Microphone Privacy Mute Controls...");
  wakeWordEngine.toggleMicrophone(false); // Mute
  const mutedTrigger = wakeWordEngine.handleWakeWordTriggered('local_mic', 'JARVIS');
  assert.strictEqual(mutedTrigger.success, false);
  assert.strictEqual(mutedTrigger.reason, 'Microphone muted');

  wakeWordEngine.toggleMicrophone(true); // Unmute
  const unmutedTrigger = wakeWordEngine.handleWakeWordTriggered('local_mic', 'JARVIS');
  assert.strictEqual(unmutedTrigger.success, true);
  console.log("  => PASSED ✅");

  // Test 3: Natural Spoken Task Control Commands (STOP / PAUSE)
  console.log("\n[TEST 3] Testing Spoken Task Interruption Commands...");
  
  // Create dummy mission
  const mission = goalEngine.createMission("Voice Control Test Mission", "Testing voice pause/resume/cancel", [
    { id: "sub_1", title: "Task step 1", dependencies: [] }
  ]);

  // Voice command: PAUSE
  const pauseCmd = wakeWordEngine.handleVoiceCommand("JARVIS, pause");
  assert(pauseCmd && pauseCmd.handled);
  assert.strictEqual(pauseCmd.action, "PAUSE");
  assert.strictEqual(goalEngine.getMissionById(mission.id).status, "PAUSED");

  // Voice command: CONTINUE / RESUME
  const resumeCmd = wakeWordEngine.handleVoiceCommand("JARVIS, continue");
  assert(resumeCmd && resumeCmd.handled);
  assert.strictEqual(resumeCmd.action, "RESUME");
  assert.strictEqual(goalEngine.getMissionById(mission.id).status, "IN_PROGRESS");

  // Voice command: CANCEL THAT
  const cancelCmd = wakeWordEngine.handleVoiceCommand("JARVIS, cancel that");
  assert(cancelCmd && cancelCmd.handled);
  assert.strictEqual(cancelCmd.action, "CANCEL");
  assert.strictEqual(goalEngine.getMissionById(mission.id).status, "CANCELLED");
  console.log("  => PASSED ✅");

  // Test 4: Voice Status Query
  console.log("\n[TEST 4] Testing Spoken Status Report Request...");
  const statusCmd = wakeWordEngine.handleVoiceCommand("JARVIS, status report");
  assert(statusCmd && statusCmd.handled);
  assert.strictEqual(statusCmd.action, "STATUS");
  console.log(`  => Status Response: "${statusCmd.message}"`);
  console.log("  => PASSED ✅");

  console.log("\n=========================================");
  console.log("  ALL OFFLINE WAKE-WORD TESTS PASSED! 🎙️✅");
  console.log("=========================================");
}

try {
  runWakeWordTests();
} catch (err) {
  console.error("Wake-Word Tests Failed ❌:", err);
  process.exit(1);
}
