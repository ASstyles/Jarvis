const assert = require('assert');
const goalEngine = require('../src/goals/goalEngine');

function runGoalAutopilotTests() {
  console.log("=========================================");
  console.log("  RUNNING GOAL AUTOPILOT TEST SUITE      ");
  console.log("=========================================");

  // Test 1: Mission Creation with DAG Dependencies
  console.log("\n[TEST 1] Testing Mission DAG Creation & Subtasks...");
  const mission = goalEngine.createMission(
    "Internship Portfolio Mission",
    "Audit, design, and deploy portfolio site",
    [
      { id: "audit_1", title: "Audit Existing Projects", dependencies: [] },
      { id: "redesign_2", title: "Redesign UI Components", dependencies: ["audit_1"] },
      { id: "deploy_3", title: "Deploy to Production", dependencies: ["redesign_2"] }
    ],
    { priority: "HIGH", deadline: "2026-09-01" }
  );

  assert.strictEqual(mission.status, "IN_PROGRESS");
  assert.strictEqual(mission.subtasks.length, 3);
  console.log("  => PASSED ✅");

  // Test 2: DAG Executable Resolution
  console.log("\n[TEST 2] Testing DAG Executable Subtask Resolution...");
  const ready1 = goalEngine.getExecutableSubtasks(mission.id);
  assert.strictEqual(ready1.length, 1, "Only audit_1 should be ready initially.");
  assert.strictEqual(ready1[0].id, "audit_1");

  // Complete audit_1
  goalEngine.updateSubtask("audit_1", "COMPLETED", "Audit passed cleanly");
  const ready2 = goalEngine.getExecutableSubtasks(mission.id);
  assert.strictEqual(ready2.length, 1, "redesign_2 should now be ready.");
  assert.strictEqual(ready2[0].id, "redesign_2");

  // Complete redesign_2
  goalEngine.updateSubtask("redesign_2", "COMPLETED", "UI revamped");
  const ready3 = goalEngine.getExecutableSubtasks(mission.id);
  assert.strictEqual(ready3.length, 1, "deploy_3 should now be ready.");
  assert.strictEqual(ready3[0].id, "deploy_3");
  console.log("  => PASSED ✅");

  // Test 3: Artifact and Blocker Management
  console.log("\n[TEST 3] Testing Artifacts and Blockers...");
  goalEngine.addArtifact(mission.id, { type: "URL", value: "https://portfolio.dev" });
  goalEngine.addBlocker(mission.id, "Waiting for DNS propagation");
  
  const mRecord = goalEngine.getMissionById(mission.id);
  assert.strictEqual(mRecord.artifacts.length, 1);
  assert.strictEqual(mRecord.blockers.length, 1);
  console.log("  => PASSED ✅");

  // Test 4: Pause, Resume, and Completion
  console.log("\n[TEST 4] Testing Pause & Resume Lifecycle...");
  goalEngine.pauseMission(mission.id);
  assert.strictEqual(goalEngine.getMissionById(mission.id).status, "PAUSED");

  goalEngine.resumeMission(mission.id);
  assert.strictEqual(goalEngine.getMissionById(mission.id).status, "IN_PROGRESS");

  goalEngine.updateSubtask("deploy_3", "COMPLETED", "Deployment live at portfolio.dev");
  assert.strictEqual(goalEngine.getMissionById(mission.id).status, "COMPLETED");
  assert.strictEqual(goalEngine.getMissionById(mission.id).progress, 100);
  console.log("  => PASSED ✅");

  console.log("\n=========================================");
  console.log("  ALL GOAL AUTOPILOT TESTS PASSED! 🎯✅  ");
  console.log("=========================================");
}

try {
  runGoalAutopilotTests();
} catch (err) {
  console.error("Goal Autopilot Tests Failed ❌:", err);
  process.exit(1);
}
