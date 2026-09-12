const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { documentExtractor } = require('../src/reading/documentExtractor');
const { speechSegmenter } = require('../src/reading/speechSegmenter');
const { ReadingSessionManager } = require('../src/reading/readingSessionManager');
const speechFormatter = require('../src/voice/speechFormatter');
const orchestrator = require('../src/agents/orchestrator');

async function runDocumentReadingTests() {
  console.log("==========================================================");
  console.log("  RUNNING JARVIS DOCUMENT READING REGRESSION TEST SUITE   ");
  console.log("==========================================================");

  // ---------------------------------------------------------------------------
  // TEST 1: Exact Text Extraction & Preservation (100% Fidelity)
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 1] Testing Document Extraction on 'Gayatri_Letter.txt'...");
  const extracted = documentExtractor.extractDocument("Gayatri_Letter.txt");

  assert(extracted.text.length > 0, "Extracted text must not be empty");
  assert(extracted.text.includes("A Letter to My Gayatri"), "Must contain exact title line");
  assert(extracted.text.includes("My Gayatri. My undoing. My favorite sin."), "Must preserve exact words");
  assert(extracted.text.includes("September 1st..."), "Must preserve exact date and ellipsis");
  assert.strictEqual(extracted.confidence, 1.0, "Confidence should be 1.0 for local text files");
  assert(extracted.totalWords > 0, "Word count must be computed accurately");
  assert.strictEqual(extracted.text.length, extracted.totalCharacters, "Character count must match length exactly");
  console.log(`  => Document Extracted: "${extracted.title}" (${extracted.totalWords} words, ${extracted.totalCharacters} chars)`);
  console.log("  => PASSED ✅");

  // ---------------------------------------------------------------------------
  // TEST 2: Speech Segmentation (No Omission, Verifiable Chunks)
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 2] Testing Speech Segmentation Engine...");
  const multiParagraphDoc = `
A Letter to My Gayatri

My Gayatri. My undoing. My favorite sin.
They say love is light. They're lying. Love is the dark that swallows stars. Love is what I feel for you—a beautiful sickness that has no cure, and I don't want one.

How It All Began
September 1st... You stood by the old iron gates, a cigarette burning between your fingers. You looked at me like I was something you had already decided to ruin.

"You're late," you said.
"I wasn't looking for you," I replied.
"Doesn't matter," you smiled, slow and dangerous. "You found me anyway."
`;

  const segments = speechSegmenter.segment(multiParagraphDoc);
  assert(segments.length >= 4, `Expected at least 4 segments, got ${segments.length}`);
  
  // Verify all segment words are present in original text
  for (const seg of segments) {
    assert(seg.text.length > 0, "Segment text must not be empty");
    assert(seg.wordCount > 0, "Segment word count must be > 0");
    assert(seg.index >= 1, "Segment index must be 1-indexed");
    assert(seg.paragraphIndex >= 1, "Paragraph index must be 1-indexed");
    assert(seg.status === "PENDING", "Initial segment status must be PENDING");
  }

  const combinedSegmentText = segments.map(s => s.text).join(" ");
  assert(combinedSegmentText.includes("My Gayatri"), "Must contain all paragraphs");
  assert(combinedSegmentText.includes("You're late"), "Must contain quotes intact");
  assert(combinedSegmentText.includes("You found me anyway"), "Must contain final dialog");
  console.log(`  => Segmented into ${segments.length} verified speech units.`);
  console.log("  => PASSED ✅");

  // ---------------------------------------------------------------------------
  // TEST 3: Verifiable State Machine & Audio Playback Tracking
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 3] Testing Reading Session State Machine Lifecycle...");
  const manager = new ReadingSessionManager();
  const session = manager.createSession(extracted);

  assert.strictEqual(session.status, "READY");
  assert.strictEqual(session.audioStarted, false);
  assert.strictEqual(session.verified, false);
  assert.strictEqual(session.completedSegments, 0);

  // Transition segment 1 to PLAYING
  manager.updateSegmentStatus(1, "PLAYING");
  assert.strictEqual(session.status, "READING");
  assert.strictEqual(session.audioStarted, true);
  assert.strictEqual(session.currentSegment, 1);

  // Complete segment 1
  manager.updateSegmentStatus(1, "COMPLETED");
  assert.strictEqual(session.completedSegments, 1);
  assert(session.currentWordOffset > 0, "Word offset must advance after completed segment");
  console.log("  => Lifecycle state machine transitions verified.");
  console.log("  => PASSED ✅");

  // ---------------------------------------------------------------------------
  // TEST 4: CRITICAL BUG REGRESSION — FALSE COMPLETION PREVENTION
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 4] (CRITICAL) Testing False-Completion Prevention...");
  // Simulate a 10-segment document where only 6 segments were played
  const fakeDoc = {
    documentId: "ten_segments.txt",
    title: "Ten Segment Test Letter",
    text: "Section one. Section two. Section three. Section four. Section five. Section six. Section seven. Section eight. Section nine. Section ten.",
    totalWords: 20,
    totalCharacters: 120
  };

  const testManager = new ReadingSessionManager();
  const testSession = testManager.createSession(fakeDoc);
  assert.strictEqual(testSession.totalSegments, 10, "Should have 10 segments");

  // Simulate playing only segments 1 through 6
  for (let i = 1; i <= 6; i++) {
    testManager.updateSegmentStatus(i, "PLAYING");
    testManager.updateSegmentStatus(i, "COMPLETED");
  }

  assert.strictEqual(testSession.completedSegments, 6);

  // Attempt to verify / declare completion
  const verifyResult = testManager.verifySessionCompletion();

  // MUST FAIL!
  assert.strictEqual(verifyResult.verified, false, "CRITICAL: verifySessionCompletion MUST FAIL when only 6 of 10 segments played!");
  assert.notStrictEqual(testSession.status, "COMPLETED", "CRITICAL: session status must NOT be COMPLETED!");
  assert.strictEqual(testSession.verified, false, "CRITICAL: session.verified must remain false!");
  assert(verifyResult.message.includes("6 of 10") || verifyResult.message.includes("stopped"), "Message must specify exact incomplete count");
  assert(!verifyResult.message.toLowerCase().includes("complete letter has been"), "Must NEVER claim complete letter was recited!");
  console.log(`  => False Completion Rejection Succeeded: verified=${verifyResult.verified}, message="${verifyResult.message}"`);
  console.log("  => PASSED ✅");

  // ---------------------------------------------------------------------------
  // TEST 5: Voice Session Controls (Pause, Resume, Stop, Repeat, Skip, Restart)
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 5] Testing Reading Session Voice Controls...");
  
  // Pause
  const pauseRes = testManager.pauseSession();
  assert.strictEqual(testSession.status, "PAUSED");
  assert.strictEqual(pauseRes.spokenAcknowledgment, "Paused.");

  // Resume
  const resumeRes = testManager.resumeSession();
  assert.strictEqual(testSession.status, "READING");
  assert.strictEqual(resumeRes.spokenAcknowledgment, "Continuing.");

  // Skip Segment
  testManager.skipSegment(8);
  assert.strictEqual(testSession.currentSegment, 8);
  assert.strictEqual(testSession.skippedSegments, 1);

  // Stop
  const stopRes = testManager.stopSession("User stop");
  assert.strictEqual(testSession.status, "STOPPED");
  assert.strictEqual(testSession.interrupted, true);

  // Restart
  const restartRes = testManager.restartSession();
  assert.strictEqual(testSession.status, "READY");
  assert.strictEqual(testSession.currentSegment, 1);
  assert.strictEqual(testSession.completedSegments, 0);
  assert.strictEqual(testSession.skippedSegments, 0);
  assert.strictEqual(restartRes.spokenAcknowledgment, "Starting from the beginning.");
  console.log("  => All voice session controls verified.");
  console.log("  => PASSED ✅");

  // ---------------------------------------------------------------------------
  // TEST 6: TTS Error Handling & Retries
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 6] Testing TTS Error & Retry Policy...");
  testManager.updateSegmentStatus(1, "PLAYING");
  testManager.updateSegmentStatus(1, "FAILED", { error: "Network audio synthesis timeout" });
  assert.strictEqual(testSession.retryCount, 1);
  assert.strictEqual(testSession.segments[0].retries, 1);
  assert.strictEqual(testSession.segments[0].error, "Network audio synthesis timeout");
  console.log("  => TTS failure properly tracked and retry policy recorded.");
  console.log("  => PASSED ✅");

  // ---------------------------------------------------------------------------
  // TEST 7: Full Complete Verifiable Playback
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 7] Testing Legitimate Full Verification...");
  const completeManager = new ReadingSessionManager();
  const cSession = completeManager.createSession(fakeDoc);

  for (let i = 1; i <= 10; i++) {
    completeManager.updateSegmentStatus(i, "PLAYING");
    completeManager.updateSegmentStatus(i, "COMPLETED");
  }

  const legitimateResult = completeManager.verifySessionCompletion();
  assert.strictEqual(legitimateResult.verified, true, "Must verify when 100% of segments completed");
  assert.strictEqual(legitimateResult.status, "COMPLETED");
  assert.strictEqual(cSession.verified, true);
  assert.strictEqual(cSession.audioCompleted, true);
  assert.strictEqual(legitimateResult.message, "That's the end of the letter.");
  console.log(`  => Full completion verified: message="${legitimateResult.message}"`);
  console.log("  => PASSED ✅");

  // ---------------------------------------------------------------------------
  // TEST 8: Orchestrator Intent Resolution (No LLM Truncation)
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 8] Testing Orchestrator Directives for Document Reading...");
  const orchResult = await orchestrator.processUserRequest("JARVIS, read this letter.");

  assert.strictEqual(orchResult.action?.type, "DOCUMENT_READING_START", "Must return DOCUMENT_READING_START action");
  assert(orchResult.action.document.text.includes("A Letter to My Gayatri"), "Must contain complete unabridged letter text");
  assert.strictEqual(orchResult.spokenText, "Of course. I'll read it.", "Must respond with concise initial acknowledgment");
  assert(orchResult.action.session.totalSegments > 0, "Session must have structured speech segments");
  console.log(`  => Orchestrator Intent: ${orchResult.action.type}, Spoken: "${orchResult.spokenText}", Title: "${orchResult.action.document.title}"`);
  console.log("  => PASSED ✅");

  console.log("\n==========================================================");
  console.log("  ALL JARVIS DOCUMENT READING REGRESSION TESTS PASSED! 🎉 ");
  console.log("==========================================================");
}

runDocumentReadingTests().catch((err) => {
  console.error("Test Suite Failed ❌:", err);
  process.exit(1);
});
