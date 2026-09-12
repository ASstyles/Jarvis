const assert = require('assert');
const vlmProvider = require('../src/vision/vlmProvider');
const ocrProvider = require('../src/vision/ocrProvider');
const visualGrounding = require('../src/vision/visualGrounding');
const visualVerification = require('../src/vision/visualVerification');

async function runVlmPerceptionTests() {
  console.log("=========================================");
  console.log("  RUNNING VLM & VISUAL PERCEPTION TESTS  ");
  console.log("=========================================");

  // Test 1: VLM Provider Capability & Info
  console.log("\n[TEST 1] Testing VLM Provider interface & capabilities...");
  const cap = vlmProvider.getCapabilities();
  assert(cap.provider, "VLM Provider name must exist.");
  assert.strictEqual(cap.supportsSemanticGrounding, true);
  assert.strictEqual(cap.supportsVisualVerification, true);
  console.log(`  => Active Provider: ${cap.provider} (Latency: ~${cap.averageLatencyMs}ms)`);
  console.log("  => PASSED ✅");

  // Test 2: OCR Text & Bounding Box Extraction
  console.log("\n[TEST 2] Testing OCR Extraction & Text Blocks...");
  const ocrRes = await ocrProvider.extractText(null); // tests fallback or available engine
  assert.strictEqual(ocrRes.success, true);
  assert(Array.isArray(ocrRes.blocks));
  assert(ocrRes.blocks.length > 0);
  assert(ocrRes.blocks[0].boundingBox, "Bounding box must be present.");
  console.log(`  => Extracted ${ocrRes.blocks.length} text blocks via ${ocrRes.provider}.`);
  console.log("  => PASSED ✅");

  // Test 3: Visual Grounding of UI Elements
  console.log("\n[TEST 3] Testing Semantic UI Element Grounding to Coordinates...");
  const groundRes = await visualGrounding.groundElement("Submit button");
  assert.strictEqual(groundRes.success, true);
  assert(groundRes.matchedElement, "Matched element must be returned.");
  assert(groundRes.matchedElement.center, "Center coordinate must be calculated.");
  assert(typeof groundRes.matchedElement.center.x === 'number');
  assert(typeof groundRes.matchedElement.center.y === 'number');
  assert(groundRes.matchedElement.confidence > 0.8, "Confidence must be high.");
  console.log(`  => Grounded "${groundRes.matchedElement.label}" to center: (${groundRes.matchedElement.center.x}, ${groundRes.matchedElement.center.y}) with ${Math.round(groundRes.matchedElement.confidence * 100)}% confidence.`);
  console.log("  => PASSED ✅");

  // Test 4: Ambiguity Detection in Visual Grounding
  console.log("\n[TEST 4] Testing Ambiguity Resolution...");
  const ambiguousRes = await visualGrounding.groundElement("tab");
  assert.strictEqual(ambiguousRes.success, true);
  assert(typeof ambiguousRes.isAmbiguous === 'boolean');
  console.log(`  => Query "tab" evaluated (Ambiguity: ${ambiguousRes.isAmbiguous}, Candidates: ${ambiguousRes.allCandidatesCount})`);
  console.log("  => PASSED ✅");

  // Test 5: Visual Verification of Actions
  console.log("\n[TEST 5] Testing Visual Verification of State Transitions...");
  const verifyRes = await visualVerification.verifyAction("Click Command Center tab", "Command Center");
  assert.strictEqual(verifyRes.success, true);
  assert.strictEqual(verifyRes.verified, true);
  assert(verifyRes.confidence > 0.8);
  console.log(`  => Visual Verification status: ${verifyRes.status} (Confidence: ${Math.round(verifyRes.confidence * 100)}%)`);
  console.log("  => PASSED ✅");

  console.log("\n=========================================");
  console.log("  ALL VLM & PERCEPTION TESTS PASSED! 👁️✅ ");
  console.log("=========================================");
}

runVlmPerceptionTests().catch(err => {
  console.error("VLM Perception Tests Failed ❌:", err);
  process.exit(1);
});
