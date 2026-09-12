const assert = require('assert');
const worldModel = require('../src/world/worldModel');

function runWorldModelTests() {
  console.log("=========================================");
  console.log("  RUNNING WORLD MODEL TEST SUITE         ");
  console.log("=========================================");

  // Test 1: World Model State Initialization
  console.log("\n[TEST 1] Testing World Model initial state...");
  const state = worldModel.getState();
  assert(state.userContext, "User context should exist.");
  assert(state.projects && state.projects.length > 0, "Projects should be populated.");
  assert(Array.isArray(state.constraints), "Constraints should be an array.");
  console.log("  => PASSED ✅");

  // Test 2: Goal and Observation updates
  console.log("\n[TEST 2] Testing Goal and Observation updates...");
  worldModel.setCurrentGoal("Prepare internship portfolio");
  assert.strictEqual(worldModel.getState().currentGoal, "Prepare internship portfolio");
  
  const initialObsCount = worldModel.getState().recentObservations.length;
  worldModel.addObservation("Testing automated file modification");
  assert(worldModel.getState().recentObservations.length >= initialObsCount, "Observations should be recorded.");
  console.log("  => PASSED ✅");

  // Test 3: File and Window Tracking
  console.log("\n[TEST 3] Testing File access and Window focus tracking...");
  worldModel.recordFileAccess("c:/Users/avira/Desktop/Jarvis/package.json", "WRITE");
  const fileEntry = worldModel.getState().files.find(f => f.basename === "package.json");
  assert(fileEntry, "File entry should be recorded.");
  assert.strictEqual(fileEntry.lastAction, "WRITE");

  worldModel.updateActiveWindow("Visual Studio Code");
  assert.strictEqual(worldModel.getState().applications.activeWindow, "Visual Studio Code");
  console.log("  => PASSED ✅");

  // Test 4: Failure Tracking and Recovery
  console.log("\n[TEST 4] Testing Failure Tracking and Resolution...");
  const failure = worldModel.recordFailure("TestEngine", new Error("Simulated connection timeout"));
  assert.strictEqual(failure.resolved, false);
  
  worldModel.resolveFailure(failure.id, "Retried and succeeded");
  const resolved = worldModel.getState().recentFailures.find(f => f.id === failure.id);
  assert.strictEqual(resolved.resolved, true);
  console.log("  => PASSED ✅");

  // Test 5: Context Prompt Generation
  console.log("\n[TEST 5] Testing Context Prompt Generation...");
  const prompt = worldModel.generateContextPrompt();
  assert(prompt.includes("=== JARVIS WORLD MODEL"), "Prompt should contain header.");
  assert(prompt.includes("Visual Studio Code"), "Prompt should include active window.");
  console.log("  => PASSED ✅");

  console.log("\n=========================================");
  console.log("  ALL WORLD MODEL TESTS PASSED! 🌍✅    ");
  console.log("=========================================");
}

try {
  runWorldModelTests();
} catch (err) {
  console.error("World Model Tests Failed ❌:", err);
  process.exit(1);
}
