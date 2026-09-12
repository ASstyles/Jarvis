const assert = require('assert');
const memoryMatrix = require('../src/memory/memoryMatrix');

function runMemory2Tests() {
  console.log("=========================================");
  console.log("  RUNNING MEMORY 2.0 TEST SUITE          ");
  console.log("=========================================");

  // Test 1: Structured Memory Save with Types
  console.log("\n[TEST 1] Testing Structured Memory Record Saving...");
  const msg = memoryMatrix.saveFact(
    "preferred_ide",
    "Visual Studio Code with Vim Keybindings",
    5,
    "preference",
    { confidence: 0.98, source: "user_explicit", relatedProject: "Jarvis" }
  );
  assert(msg.includes("Saved Memory 2.0"));
  
  const recalled = memoryMatrix.recallFact("preferred_ide");
  assert.strictEqual(recalled, "Visual Studio Code with Vim Keybindings");
  console.log("  => PASSED ✅");

  // Test 2: Multi-factor Semantic Search
  console.log("\n[TEST 2] Testing Multi-Factor Semantic Ranking...");
  memoryMatrix.saveFact("server_port", "4000", 4, "fact");
  memoryMatrix.saveFact("database_type", "JSON File Persistence", 3, "fact");

  const results = memoryMatrix.searchSemanticMemory("server port", 2);
  assert(results.length > 0);
  assert.strictEqual(results[0].key, "server_port");
  console.log("  => PASSED ✅");

  // Test 3: Conflict Detection Engine
  console.log("\n[TEST 3] Testing Semantic Conflict Detection...");
  const noConflict = memoryMatrix.detectConflict("server_port", "4000");
  assert.strictEqual(noConflict.hasConflict, false, "Identical value should not have conflict.");

  const hasConflict = memoryMatrix.detectConflict("server_port", "8080");
  assert.strictEqual(hasConflict.hasConflict, true, "Conflicting value should be flagged.");
  assert.strictEqual(hasConflict.existingValue, "4000");
  console.log("  => PASSED ✅");

  // Test 4: Conflict Resolution Strategy
  console.log("\n[TEST 4] Testing Conflict Resolution (OVERWRITE strategy)...");
  memoryMatrix.resolveConflict("server_port", "8080", "OVERWRITE");
  const updated = memoryMatrix.recallFact("server_port");
  assert.strictEqual(updated, "8080", "Updated value should take precedence.");
  console.log("  => PASSED ✅");

  // Test 5: Memory Verification
  console.log("\n[TEST 5] Testing Memory Verification Flagging...");
  const verified = memoryMatrix.verifyMemory("preferred_ide");
  assert.strictEqual(verified, true);
  console.log("  => PASSED ✅");

  console.log("\n=========================================");
  console.log("  ALL MEMORY 2.0 TESTS PASSED! 🧠✅      ");
  console.log("=========================================");
}

try {
  runMemory2Tests();
} catch (err) {
  console.error("Memory 2.0 Tests Failed ❌:", err);
  process.exit(1);
}
