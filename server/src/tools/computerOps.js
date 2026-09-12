const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const computerUse = require("../computer/computerUse");

const captureScreenTool = tool(async () => {
  const result = await computerUse.captureScreen();
  return JSON.stringify(result);
}, {
  name: "capture_screen",
  description: "Capture the primary display screen snapshot, window dimensions, and active window state for visual inspection.",
  schema: z.object({})
});

const inspectUiElementsTool = tool(async () => {
  const result = await computerUse.inspectUiElements();
  return JSON.stringify(result);
}, {
  name: "inspect_ui_elements",
  description: "Inspect visible UI windows and applications currently open on the user's desktop.",
  schema: z.object({})
});

const mouseClickTool = tool(async ({ x, y, button = 'left', doubleClick = false }) => {
  const result = await computerUse.mouseClick(x, y, button, doubleClick);
  return JSON.stringify(result);
}, {
  name: "mouse_click",
  description: "Move cursor and click at specific screen coordinates (x, y).",
  schema: z.object({
    x: z.number().describe("X coordinate on screen (0 to screen width)."),
    y: z.number().describe("Y coordinate on screen (0 to screen height)."),
    button: z.enum(['left', 'right']).optional().default('left').describe("Mouse button: left or right."),
    doubleClick: z.boolean().optional().default(false).describe("Whether to double-click.")
  })
});

const typeTextTool = tool(async ({ text, delayMs = 10 }) => {
  const result = await computerUse.typeText(text, delayMs);
  return JSON.stringify(result);
}, {
  name: "type_text",
  description: "Type text directly into the currently focused window.",
  schema: z.object({
    text: z.string().describe("The exact text string to type.")
  })
});

const keyboardPressTool = tool(async ({ shortcut }) => {
  const result = await computerUse.keyboardPress(shortcut);
  return JSON.stringify(result);
}, {
  name: "keyboard_press",
  description: "Send special keyboard shortcut or key press (e.g. {ENTER}, {ESC}, ^s for Ctrl+S, %{TAB} for Alt+Tab).",
  schema: z.object({
    shortcut: z.string().describe("The key or shortcut combination.")
  })
});

const waitForUiStateTool = tool(async ({ expectedWindowTitle, timeoutMs = 5000 }) => {
  const result = await computerUse.waitForUiState(expectedWindowTitle, timeoutMs);
  return JSON.stringify(result);
}, {
  name: "wait_for_ui_state",
  description: "Wait for a specific application or window title to appear on screen.",
  schema: z.object({
    expectedWindowTitle: z.string().describe("Substring of window title to wait for."),
    timeoutMs: z.number().optional().default(5000).describe("Timeout in milliseconds.")
  })
});

const verifyUiStateTool = tool(async ({ expectedCondition }) => {
  const result = await computerUse.verifyUiState(expectedCondition);
  return JSON.stringify(result);
}, {
  name: "verify_ui_state",
  description: "Verify that the current visual UI state matches the expected condition.",
  schema: z.object({
    expectedCondition: z.string().describe("Expected window name or state description.")
  })
});

module.exports = {
  captureScreenTool,
  inspectUiElementsTool,
  mouseClickTool,
  typeTextTool,
  keyboardPressTool,
  waitForUiStateTool,
  verifyUiStateTool
};
