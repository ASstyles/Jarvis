require('dotenv').config();
const assert = require('assert');
const orchestrator = require('../src/agents/orchestrator');
const modelRouter = require('../src/llm/modelRouter');
const { HumanMessage } = require('@langchain/core/messages');

async function runConversationalRegressionTests() {
  console.log("=================================================");
  console.log("  RUNNING CONVERSATIONAL REGRESSION SUITE        ");
  console.log("=================================================");

  // Test 1: Normal Chat Requests
  console.log("\n[TEST 1] Testing standard conversational requests...");
  const queries = [
    "Hello",
    "What can you do for me?",
    "Who are you?",
    "What are you working on?",
    "Explain your capabilities."
  ];

  for (const q of queries) {
    console.log(`  -> Processing: "${q}"`);
    const res = await orchestrator.processUserRequest(q);
    assert(res, `Response for "${q}" must not be null.`);
    assert(res.text && res.text.length > 0, `Response text for "${q}" must not be empty.`);
    assert(!res.text.includes("[RED ALERT] Neural link disruption"), `Query "${q}" should not trigger disruption.`);
    console.log(`     Response [${res.emotion || 'neutral'}]: ${res.text.substring(0, 70)}...`);
  }
  console.log("  => All 5 standard conversational queries succeeded cleanly ✅");

  // Test 2: Safe Degraded Mode under Broken Optional Tool
  console.log("\n[TEST 2] Testing Safe Degraded Mode when broken tools are passed...");
  const brokenTool = {
    name: "intentionally_broken_tool",
    description: "Broken schema",
    schema: undefined,
    func: async () => {}
  };

  const messages = [new HumanMessage("What can you do for me?")];
  
  // Model router must isolate broken tool and succeed
  const response = await modelRouter.invokeWithFallback(messages, [brokenTool], 'fast', 0.2);
  assert(response, "Model response must succeed even with broken tool passed.");
  assert(response.content, "Content must exist in response.");
  console.log(`  => Model safely handled broken tool in degraded mode: "${typeof response.content === 'string' ? response.content.substring(0, 60) : 'OK'}"...`);
  console.log("  => PASSED ✅");

  console.log("\n=================================================");
  console.log("  ALL CONVERSATIONAL REGRESSION TESTS PASSED! 💬✅");
  console.log("=================================================");
}

runConversationalRegressionTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error("Conversational Regression Tests Failed ❌:", err);
  process.exit(1);
});
