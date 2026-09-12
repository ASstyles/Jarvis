const assert = require('assert');
const database = require('../src/db/database');
const memoryMatrix = require('../src/memory/memoryMatrix');
const goalEngine = require('../src/goals/goalEngine');
const { securityGuard, RISK_LEVELS } = require('../src/security/securityGuard');
const modelRouter = require('../src/llm/modelRouter');

async function runTests() {
  console.log("=========================================");
  console.log("   RUNNING JARVIS SYSTEM TEST SUITE      ");
  console.log("=========================================");

  // Test 1: Database Persistence
  console.log("\n[TEST 1] Testing Database read/write...");
  database.writeDb({ ...database.readDb(), testKey: "testVal" });
  const db = database.readDb();
  assert.strictEqual(db.testKey, "testVal", "Database should persist data.");
  console.log("  => PASSED ✅");

  // Test 2: Memory Matrix
  console.log("\n[TEST 2] Testing Memory Matrix Save & Semantic Search...");
  memoryMatrix.saveFact("user_tech_stack", "Next.js, Express, Zod, LangChain", 5);
  const recalled = memoryMatrix.recallFact("user_tech_stack");
  assert.strictEqual(recalled, "Next.js, Express, Zod, LangChain", "Fact recall should match saved value.");
  
  const semanticRes = memoryMatrix.searchSemanticMemory("tech stack", 2);
  assert(semanticRes.length > 0, "Semantic search should find saved tech stack.");
  console.log("  => PASSED ✅");

  // Test 3: Goal Engine
  console.log("\n[TEST 3] Testing Goal Engine Mission Creation & Subtask Graph...");
  const mission = goalEngine.createMission("Build Hackathon App", "Prepare and launch hackathon project", [
    { title: "Research Competitors", description: "Search web for existing tools", agentType: "research" },
    { title: "Write Prototype Code", description: "Create index.js script", agentType: "coding" }
  ]);
  assert.strictEqual(mission.status, "IN_PROGRESS");
  assert.strictEqual(mission.subtasks.length, 2);

  goalEngine.updateSubtask(mission.subtasks[0].id, "COMPLETED", "Research output");
  const activeM = goalEngine.getActiveMission();
  assert.strictEqual(activeM.progress, 50, "Progress should be 50%.");
  console.log("  => PASSED ✅");

  // Test 4: Security Guard Risk Evaluation & Confirmation
  console.log("\n[TEST 4] Testing Security Guard Risk Rules & Human Confirmation...");
  const safeRisk = securityGuard.evaluateToolRisk('read_file', { targetPath: 'foo.txt' });
  assert.strictEqual(safeRisk, RISK_LEVELS.SAFE, "read_file should be SAFE.");

  const dangerousRisk = securityGuard.evaluateToolRisk('run_terminal_command', { command: 'rm -rf /' });
  assert.strictEqual(dangerousRisk, RISK_LEVELS.CONFIRMATION_REQUIRED, "Dangerous command should require confirmation.");

  const conf = securityGuard.createConfirmationRequest('run_terminal_command', { command: 'rm -rf /' });
  assert.strictEqual(conf.status, 'PENDING');
  securityGuard.approveConfirmation(conf.id);
  assert.strictEqual(securityGuard.getPendingConfirmations().length, 0, "Pending confirmations should be cleared on approval.");
  console.log("  => PASSED ✅");

  // Test 5: Model Router Stats
  console.log("\n[TEST 5] Testing Model Router Configuration...");
  const stats = modelRouter.getStats();
  assert(typeof stats.totalInvocations === 'number');
  console.log("  => PASSED ✅");

  console.log("\n=========================================");
  console.log("   ALL JARVIS SYSTEM TESTS PASSED! 🎉    ");
  console.log("=========================================");
}

runTests().catch(err => {
  console.error("Test Suite Failed ❌:", err);
  process.exit(1);
});
