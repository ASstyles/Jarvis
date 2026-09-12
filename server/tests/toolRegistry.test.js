const assert = require('assert');
const { getAllTools } = require('../src/tools/toolRegistry');
const { validateToolsForGemini } = require('../src/tools/toolValidator');

function runToolRegistryTests() {
  console.log("=========================================");
  console.log("  RUNNING GEMINI TOOL REGISTRY TEST SUITE");
  console.log("=========================================");

  // Test 1: Fetch all tools
  console.log("\n[TEST 1] Fetching registered tools...");
  const tools = getAllTools();
  assert(Array.isArray(tools), "getAllTools() must return array.");
  console.log(`  => Total registered tools: ${tools.length}`);

  // Test 2: Run Tool Validation
  console.log("\n[TEST 2] Running validateToolsForGemini()...");
  const validated = validateToolsForGemini(tools);
  assert.strictEqual(validated.length, tools.length, "All tools should be validated.");
  console.log("  => PASSED ✅ (No Duplicate Tool Declarations Found)");

  // Test 3: Check launch_gameverse_game exact count
  console.log("\n[TEST 3] Asserting 'launch_gameverse_game' count equals 1...");
  const gameToolCount = tools.filter(t => t.name === "launch_gameverse_game").length;
  assert.strictEqual(gameToolCount, 1, `Expected exactly 1 launch_gameverse_game declaration, found ${gameToolCount}`);
  console.log("  => PASSED ✅ ('launch_gameverse_game' occurs EXACTLY 1 time)");

  // Test 4: Negative Test - Duplicate Detection Error
  console.log("\n[TEST 4] Testing duplicate detection throw...");
  const mockDuplicates = [...tools, tools[0]];
  assert.throws(() => {
    validateToolsForGemini(mockDuplicates);
  }, /DUPLICATE_TOOL_ERROR/);
  console.log("  => PASSED ✅ (Duplicate Tool Detector threw expected diagnostic error)");

  console.log("\n=========================================");
  console.log("  ALL TOOL REGISTRY TESTS PASSED! 🛡️   ");
  console.log("=========================================");
}

try {
  runToolRegistryTests();
} catch (err) {
  console.error("Tool Registry Test Failed ❌:", err);
  process.exit(1);
}
