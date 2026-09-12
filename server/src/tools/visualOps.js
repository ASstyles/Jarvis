const { DynamicStructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');
const visualGrounding = require('../vision/visualGrounding');
const visualVerification = require('../vision/visualVerification');
const ocrProvider = require('../vision/ocrProvider');
const computerUse = require('../computer/computerUse');
const { securityGuard } = require('../security/securityGuard');

const groundUiElementTool = new DynamicStructuredTool({
  name: 'ground_ui_element',
  description: 'Inspects screen visually using VLM and OCR to ground a natural language UI element description (e.g., "Submit button", "Settings tab", "Search bar") into exact (x, y) screen coordinates with confidence scores and ambiguity detection.',
  schema: z.object({
    targetDescription: z.string().describe('Natural language description of the target UI element to ground.')
  }),
  func: async ({ targetDescription }) => {
    const res = await visualGrounding.groundElement(targetDescription);
    return JSON.stringify(res);
  }
});

const clickSemanticElementTool = new DynamicStructuredTool({
  name: 'click_semantic_element',
  description: 'Finds a UI element by semantic description on screen, checks security permissions, clicks its center coordinates, and visually verifies the expected state change.',
  schema: z.object({
    targetDescription: z.string().describe('Target UI element to find and click.'),
    expectedOutcome: z.string().optional().describe('Expected UI outcome to visually verify after clicking.'),
    button: z.enum(['left', 'right']).optional().default('left').describe('Mouse button to click.')
  }),
  func: async ({ targetDescription, expectedOutcome, button = 'left' }) => {
    // 1. Ground the element
    const groundRes = await visualGrounding.groundElement(targetDescription);
    if (!groundRes.success || !groundRes.matchedElement) {
      return JSON.stringify({ success: false, error: `Could not visually locate "${targetDescription}" on screen.` });
    }

    const { center, label, confidence } = groundRes.matchedElement;

    // 2. Security Guard Risk Assessment
    const risk = securityGuard.evaluateToolRisk('click_semantic_element', { targetDescription, center });
    if (risk === 'RESTRICTED') {
      return JSON.stringify({ success: false, error: `Action on "${targetDescription}" is RESTRICTED by security policy.` });
    }

    // 3. Click coordinates
    const clickRes = await computerUse.mouseClick(center.x, center.y, button);
    if (!clickRes.success) {
      return JSON.stringify({ success: false, error: clickRes.error });
    }

    // 4. Visual Verification if expected outcome specified
    let verifyRes = null;
    if (expectedOutcome) {
      // Wait brief moment for UI animation/response
      await new Promise(r => setTimeout(r, 400));
      verifyRes = await visualVerification.verifyAction(`Click ${label}`, expectedOutcome);
    }

    return JSON.stringify({
      success: true,
      groundedElement: groundRes.matchedElement,
      action: clickRes.action,
      verification: verifyRes,
      message: `Successfully grounded "${label}" (Confidence: ${Math.round(confidence * 100)}%), clicked at (${center.x}, ${center.y})${verifyRes ? ` and verified outcome: ${verifyRes.status}` : '.'}`
    });
  }
});

const readScreenTextTool = new DynamicStructuredTool({
  name: 'read_screen_text',
  description: 'Extracts all visible text, headings, code, and UI button labels on the current screen using OCR and VLM.',
  schema: z.object({
    filterKeyword: z.string().optional().describe('Optional keyword to filter detected text blocks.')
  }),
  func: async ({ filterKeyword }) => {
    const cap = await computerUse.captureScreen();
    const ocrRes = await ocrProvider.extractText(cap.filePath);

    if (filterKeyword && ocrRes.blocks) {
      const kw = filterKeyword.toLowerCase();
      ocrRes.blocks = ocrRes.blocks.filter(b => b.text.toLowerCase().includes(kw));
    }

    return JSON.stringify(ocrRes);
  }
});

const visuallyVerifyActionTool = new DynamicStructuredTool({
  name: 'visually_verify_action',
  description: 'Visually verifies whether a previous computer action produced the expected UI state transition or threw an error banner.',
  schema: z.object({
    actionDescription: z.string().describe('Description of the action that was performed.'),
    expectedCondition: z.string().describe('Condition expected to appear on screen (e.g. "Settings dialog opened", "Build success").')
  }),
  func: async ({ actionDescription, expectedCondition }) => {
    const res = await visualVerification.verifyAction(actionDescription, expectedCondition);
    return JSON.stringify(res);
  }
});

module.exports = {
  groundUiElementTool,
  clickSemanticElementTool,
  readScreenTextTool,
  visuallyVerifyActionTool
};
