const assert = require('assert');
const path = require('path');
const fs = require('fs');
const selfTestingEngine = require('../src/sandbox/selfTestingEngine');

async function runSandboxTests() {
  console.log("=========================================");
  console.log("  RUNNING SELF-TESTING SANDBOX TESTS     ");
  console.log("=========================================");

  // Test 1: Isolated Experiment Workspace Creation
  console.log("\n[TEST 1] Testing Isolated Sandbox Experiment Creation...");
  const exp = selfTestingEngine.createExperiment("Sanity Script Test");
  assert(exp.id, "Experiment ID must exist.");
  assert(fs.existsSync(exp.dirPath), "Experiment directory must be created.");
  console.log("  => PASSED ✅");

  // Test 2: File Writing in Sandbox
  console.log("\n[TEST 2] Testing File Writing inside isolated sandbox...");
  selfTestingEngine.writeExperimentFile(exp.id, "sample.js", "console.log('SANDBOX_TEST_OK');");
  const filePath = path.join(exp.dirPath, "sample.js");
  assert(fs.existsSync(filePath), "sample.js must exist in sandbox directory.");
  console.log("  => PASSED ✅");

  // Test 3: Running Script in Sandbox
  console.log("\n[TEST 3] Testing Script Execution & Output Evaluation...");
  const runRes = await selfTestingEngine.runExperimentScript(exp.id, "node sample.js");
  assert.strictEqual(runRes.success, true);
  assert(runRes.stdout.includes("SANDBOX_TEST_OK"));
  console.log("  => PASSED ✅");

  // Test 4: Discard / Clean Up Failed Experiment
  console.log("\n[TEST 4] Testing Clean Rollback & Discarding of Experiment...");
  const discardRes = selfTestingEngine.discardExperiment(exp.id);
  assert.strictEqual(discardRes.success, true);
  assert(!fs.existsSync(exp.dirPath), "Directory should be cleaned up.");
  console.log("  => PASSED ✅");

  console.log("\n=========================================");
  console.log("  ALL SANDBOX TESTS PASSED! 🧪🛡️         ");
  console.log("=========================================");
}

runSandboxTests().catch(err => {
  console.error("Sandbox Tests Failed ❌:", err);
  process.exit(1);
});
