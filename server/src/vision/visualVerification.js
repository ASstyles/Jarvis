const computerUse = require('../computer/computerUse');
const vlmProvider = require('./vlmProvider');
const ocrProvider = require('./ocrProvider');
const worldModel = require('../world/worldModel');

class VisualVerification {
  constructor() {}

  // Visually verifies whether an action produced the expected state transition
  async verifyAction(actionDescription, expectedCondition, preScreenshotPath = null) {
    const startTime = Date.now();
    console.log(`[VISUAL_VERIFICATION] Verifying action: "${actionDescription}" expecting: "${expectedCondition}"...`);

    // 1. Capture post-action screenshot
    const postCap = await computerUse.captureScreen();
    const postScreenshotPath = postCap.filePath;

    // 2. Perform OCR and VLM analysis on post-action screen
    const ocrResult = await ocrProvider.extractText(postScreenshotPath);
    const vlmResult = await vlmProvider.analyzeImage(
      postScreenshotPath,
      `Did the action "${actionDescription}" succeed according to expected condition: "${expectedCondition}"? Check for success badges, newly opened windows, or error banners.`
    );

    const conditionLower = expectedCondition.toLowerCase();
    const textLower = (ocrResult.text || "").toLowerCase();

    // Check if expected text / window exists
    let conditionFound = textLower.includes(conditionLower);
    if (!conditionFound && vlmResult.detectedState) {
      conditionFound = vlmResult.detectedState.toLowerCase().includes(conditionLower);
    }

    // Check for error banners
    const hasVisibleErrors = vlmResult.visibleErrors && vlmResult.visibleErrors.length > 0;
    const isVerified = conditionFound || (!hasVisibleErrors && (vlmResult.confidence || 0.9) > 0.8);

    const result = {
      success: true,
      verified: isVerified,
      actionDescription,
      expectedCondition,
      postScreenshotPath,
      detectedState: vlmResult.detectedState || "Screen state updated",
      visibleErrors: vlmResult.visibleErrors || [],
      confidence: isVerified ? 0.95 : 0.45,
      status: isVerified ? 'SUCCESS' : (hasVisibleErrors ? 'FAILED' : 'RETRY_NEEDED'),
      durationMs: Date.now() - startTime
    };

    // Update World Model with Verification status
    try {
      worldModel.updateVisualPerception({
        currentScreenshot: postScreenshotPath,
        detectedState: `[VERIFIED] ${result.detectedState}`,
        visibleErrors: result.visibleErrors,
        confidence: result.confidence,
        status: isVerified ? 'Verified' : 'Failed'
      });
    } catch (_) {}

    return result;
  }
}

const visualVerification = new VisualVerification();
module.exports = visualVerification;
