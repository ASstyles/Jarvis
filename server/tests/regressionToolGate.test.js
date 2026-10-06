const assert = require('assert');
const { z } = require('zod');
const { DynamicStructuredTool } = require('@langchain/core/tools');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { getAllTools, getToolByName } = require('../src/tools/toolRegistry');
const { validateToolsForGemini, getToolHealthMatrix, formatInvalidToolDiagnostic } = require('../src/tools/toolValidator');

function runToolGateRegressionTests() {
  console.log("=================================================");
  console.log("  RUNNING TOOL VALIDATOR GATE REGRESSION SUITE   ");
  console.log("=================================================");

  const tools = getAllTools();

  // Test 1: Complete Tool Health Matrix (All 40 Tools)
  console.log("\n[TEST 1] Verifying Tool Health Matrix across all registered tools...");
  const matrix = getToolHealthMatrix(tools);
  assert.strictEqual(matrix.length, 40, `Expected 40 tools, got ${matrix.length}`);
  
  const defectiveTools = matrix.filter(m => m.status !== 'HEALTHY');
  if (defectiveTools.length > 0) {
    console.error("Defective tools found:", defectiveTools);
  }
  assert.strictEqual(defectiveTools.length, 0, "No tools should have defective status.");
  console.log(`  => Verified ${matrix.length}/40 tools are 100% HEALTHY.`);
  console.log("  => PASSED ✅");

  // Test 2: Gemini Tool Conversion Compatibility
  console.log("\n[TEST 2] Testing LangChain & Gemini Tool Binding across all 40 tools...");
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.8-flash",
    apiKey: "dummy-key-for-binding-test"
  });

  assert.doesNotThrow(() => {
    model.bindTools(tools);
  }, "All 40 tools must bind cleanly to ChatGoogleGenerativeAI without throwing.");
  console.log("  => All 40 tools successfully bound to Gemini without '_zod' or 'propertyNames' errors.");
  console.log("  => PASSED ✅");

  // Test 3: Isolation and Blocking of Defective Tools
  console.log("\n[TEST 3] Testing Gate Isolation on Intentionally Broken Tool Schemas...");
  const badToolUndefinedSchema = {
    name: "bad_tool_undefined",
    description: "Tool with undefined schema",
    schema: undefined,
    func: async () => {}
  };

  const badToolMissingDesc = {
    name: "bad_tool_no_desc",
    description: "",
    schema: z.object({ x: z.string() }),
    func: async () => {}
  };

  const mixedTools = [...tools, badToolUndefinedSchema, badToolMissingDesc];
  
  // Strict mode must throw
  assert.throws(() => {
    validateToolsForGemini(mixedTools, { strict: true });
  }, "Strict validation must throw on defective tools.");

  // Non-strict mode must filter out defective tools and return only the 40 healthy tools
  const filtered = validateToolsForGemini(mixedTools, { strict: false });
  assert.strictEqual(filtered.length, 40);
  assert(!filtered.some(t => t.name === "bad_tool_undefined"));
  assert(!filtered.some(t => t.name === "bad_tool_no_desc"));
  console.log("  => Defective tools isolated and blocked cleanly.");
  console.log("  => PASSED ✅");

  // Test 4: Duplicate Tool Declaration Prevention
  console.log("\n[TEST 4] Testing Duplicate Tool Declaration Prevention...");
  const duplicateList = [
    tools[0],
    tools[0] // duplicate
  ];

  assert.throws(() => {
    validateToolsForGemini(duplicateList, { strict: true, throwOnDuplicate: true });
  }, /\[DUPLICATE_TOOL_ERROR\]/);
  console.log("  => Duplicate declarations blocked with DUPLICATE_TOOL_ERROR diagnostic.");
  console.log("  => PASSED ✅");

  console.log("\n=================================================");
  console.log("  ALL TOOL VALIDATOR GATE TESTS PASSED! 🛡️✅    ");
  console.log("=================================================");
}

try {
  runToolGateRegressionTests();
} catch (err) {
  console.error("Tool Gate Regression Tests Failed ❌:", err);
  process.exit(1);
}
