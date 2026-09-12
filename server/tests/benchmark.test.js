const assert = require('assert');
const autonomyBenchmark = require('../src/benchmark/autonomyBenchmark');

async function runBenchmarkTests() {
  console.log("=========================================");
  console.log("  RUNNING AUTONOMY BENCHMARK TEST SUITE  ");
  console.log("=========================================");

  // Test 1: Autonomy Score Computation Formula
  console.log("\n[TEST 1] Testing Evidence-Based Autonomy Score Calculation...");
  const score = autonomyBenchmark.computeAutonomyScore();
  assert(typeof score.overallScore === 'number');
  assert(score.overallScore >= 0 && score.overallScore <= 100);
  assert(score.breakdown.taskCompletion >= 0);
  assert(score.breakdown.toolAccuracy >= 0);
  console.log(`  => Computed Autonomy Score: ${score.overallScore}/100`);
  console.log("  => PASSED ✅");

  // Test 2: Live Diagnostic Self-Benchmark
  console.log("\n[TEST 2] Testing Full Automated Self-Benchmark Run...");
  const result = await autonomyBenchmark.runSelfBenchmark();
  assert.strictEqual(result.success, true);
  assert(result.testResults.length >= 3);
  assert(result.testResults.every(t => t.passed));
  console.log(`  => All ${result.testResults.length} benchmark sub-tests executed and passed.`);
  console.log("  => PASSED ✅");

  console.log("\n=========================================");
  console.log("  ALL AUTONOMY BENCHMARK TESTS PASSED! 📊 ");
  console.log("=========================================");
}

runBenchmarkTests().catch(err => {
  console.error("Benchmark Tests Failed ❌:", err);
  process.exit(1);
});
