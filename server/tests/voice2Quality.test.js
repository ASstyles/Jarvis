const assert = require('assert');
const speechFormatter = require('../src/voice/speechFormatter');
const pronunciationEngine = require('../src/voice/pronunciationEngine');
const voiceProfile = require('../src/voice/voiceProfile');

function runVoice2QualityTests() {
  console.log("=================================================");
  console.log("  RUNNING JARVIS VOICE 2.0 QUALITY TEST SUITE    ");
  console.log("=================================================");

  // Test 1: Conversational Cliché Filter
  console.log("\n[TEST 1] Testing Robotic AI Cliché Filtering & Humanization...");
  const rawClicheText = "Certainly! As an AI language model, I would be happy to help you with that. Your request has been successfully processed. Here is the information you requested: System online. Is there anything else I can help you with?";
  const filtered = speechFormatter.filterCliches(rawClicheText);

  assert(!filtered.includes("As an AI"), "Must remove 'As an AI'");
  assert(!filtered.includes("happy to help"), "Must remove 'happy to help'");
  assert(!filtered.includes("Here is the information"), "Must remove 'Here is the information'");
  assert(!filtered.includes("anything else"), "Must remove 'Is there anything else...'");
  console.log(`  => Filtered output: "${filtered}"`);
  console.log("  => PASSED ✅");

  // Test 2: Speech Segmentation (Visual vs. Spoken Content)
  console.log("\n[TEST 2] Testing Speech Segmentation on Code Blocks & Markdown Tables...");
  const rawMarkdown = `
# System Architecture Summary
Here is the implementation of the auth service:
\`\`\`typescript
export function verifyToken(token: string): boolean {
  return token.startsWith("jwt_valid_");
}
\`\`\`

| Service | Status | Latency |
|---|---|---|
| Auth API | ONLINE | 45ms |
| Database | ONLINE | 12ms |

* Verified auth service token validator.
* Verified database connectivity.
`;

  const spoken = speechFormatter.formatForSpeech(rawMarkdown);
  assert(!spoken.includes("```"), "Spoken delivery must not include raw code fences");
  assert(!spoken.includes("verifyToken(token: string)"), "Spoken delivery must not recite raw function signature lines");
  assert(!spoken.includes("| Service | Status |"), "Spoken delivery must not recite markdown table pipes");
  assert(spoken.includes("implementation on your screen") || spoken.includes("table on your display"), "Spoken delivery should cue user to screen");
  console.log(`  => Clean Spoken Segment: "${spoken}"`);
  console.log("  => PASSED ✅");

  // Test 3: Phonetic Pronunciation & Acronym Translation
  console.log("\n[TEST 3] Testing Phonetic Pronunciation & Acronym Formatter...");
  const rawTech = "Connecting to Next.js server with OAuth2 authentication and SQL database at port 4000 via API.";
  const phonetic = pronunciationEngine.formatPronunciation(rawTech);

  assert(phonetic.includes("Next J-S"), "Must pronounce Next.js as Next J-S");
  assert(phonetic.includes("O-Auth two"), "Must pronounce OAuth2 as O-Auth two");
  assert(phonetic.includes("sequel"), "Must pronounce SQL as sequel");
  assert(phonetic.includes("port four thousand"), "Must format port 4000");
  assert(phonetic.includes("A-P-I"), "Must pronounce API as A-P-I");
  console.log(`  => Phonetic output: "${phonetic}"`);
  console.log("  => PASSED ✅");

  // Test 4: Spoken Number & Latency Formatter
  console.log("\n[TEST 4] Testing Conversational Number & Latency Formatter...");
  const rawNumbers = "Execution completed in 0.084921 seconds with 98.5% confidence on v2.5 release.";
  const formattedNumbers = pronunciationEngine.formatSpokenNumbers(rawNumbers);

  assert(formattedNumbers.includes("about 85 milliseconds"), "Must convert 0.084921s to about 85 milliseconds");
  assert(formattedNumbers.includes("98.5 percent"), "Must format 98.5 percent");
  assert(formattedNumbers.includes("version 2 point 5"), "Must format version 2.5");
  console.log(`  => Number output: "${formattedNumbers}"`);
  console.log("  => PASSED ✅");

  // Test 5: Context-Aware Prosody Mapping
  console.log("\n[TEST 5] Testing Context-Aware Prosody & Emotion Mapping...");
  const prosodyNormal = voiceProfile.getProsody("neutral", "IDLE");
  assert.strictEqual(prosodyNormal.context, "normal");
  assert.strictEqual(prosodyNormal.pitch, 0.88);

  const prosodyExecuting = voiceProfile.getProsody("golden glow", "EXECUTING");
  assert.strictEqual(prosodyExecuting.context, "executing");
  assert.strictEqual(prosodyExecuting.rate, 1.05);

  const prosodyWarning = voiceProfile.getProsody("critical warning", "WAITING");
  assert.strictEqual(prosodyWarning.context, "warning");
  assert(prosodyWarning.pitch <= 0.82);

  const prosodyError = voiceProfile.getProsody("red alert", "ERROR");
  assert.strictEqual(prosodyError.context, "critical");
  assert(prosodyError.rate <= 0.90);
  console.log("  => Verified prosody parameters across normal, executing, warning, and critical states.");
  console.log("  => PASSED ✅");

  // Test 6: Natural Contextual Acknowledgments
  console.log("\n[TEST 6] Testing Natural Contextual Acknowledgments...");
  const inspectingAck = speechFormatter.getAcknowledgment("inspecting");
  assert(inspectingAck.includes("checking") || inspectingAck.includes("Looking") || inspectingAck.includes("Scanning"));

  const successAck = speechFormatter.getAcknowledgment("success");
  assert(successAck.includes("Done") || successAck.includes("took care") || successAck.includes("set") || successAck.includes("worked"));
  console.log(`  => Sample Acknowledgment (inspecting): "${inspectingAck}" | (success): "${successAck}"`);
  console.log("  => PASSED ✅");

  console.log("\n=================================================");
  console.log("  ALL JARVIS VOICE 2.0 QUALITY TESTS PASSED! 🎙️✨✅");
  console.log("=================================================");
}

try {
  runVoice2QualityTests();
} catch (err) {
  console.error("Voice 2.0 Quality Tests Failed ❌:", err);
  process.exit(1);
}
