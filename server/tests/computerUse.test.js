const assert = require('assert');
const computerUse = require('../src/computer/computerUse');
const { securityGuard } = require('../src/security/securityGuard');

async function runComputerUseTests() {
  console.log("=========================================");
  console.log("  RUNNING COMPUTER USE TEST SUITE        ");
  console.log("=========================================");

  // Test 1: Screen Capture
  console.log("\n[TEST 1] Testing Screen Capture execution & dimensions...");
  const cap = await computerUse.captureScreen();
  assert(cap.success, "Screen capture should return success.");
  assert(cap.dimensions && cap.dimensions.width > 0, "Dimensions should be present.");
  console.log(`  => Dimensions: ${cap.dimensions.width}x${cap.dimensions.height}`);
  console.log("  => PASSED ✅");

  // Test 2: Inspect UI Windows
  console.log("\n[TEST 2] Testing UI Elements / Window Inspection...");
  const ui = await computerUse.inspectUiElements();
  assert(ui.success, "UI Inspection should succeed.");
  assert(Array.isArray(ui.windows), "Windows should be an array.");
  console.log(`  => Found ${ui.windows.length} visible application windows.`);
  console.log("  => PASSED ✅");

  // Test 3: Mouse Click Boundary Checking
  console.log("\n[TEST 3] Testing Coordinate Validation...");
  const validClick = await computerUse.mouseClick(500, 500, 'left');
  assert(validClick.success, "Valid coordinates should succeed.");

  const invalidClick = await computerUse.mouseClick(-10, 9999, 'left');
  assert.strictEqual(invalidClick.success, false, "Out of bounds coordinate should be rejected.");
  console.log("  => PASSED ✅");

  // Test 4: Typing & Shortcut Safety
  console.log("\n[TEST 4] Testing Text Typing & Key Pressing...");
  const typeRes = await computerUse.typeText("Hello from JARVIS");
  assert(typeRes.success, "Type text should return success.");

  const keyRes = await computerUse.keyboardPress("{ENTER}");
  assert(keyRes.success, "Keyboard press should return success.");
  console.log("  => PASSED ✅");

  // Test 5: Security Guard Risk Assessment on Computer Use
  console.log("\n[TEST 5] Testing Security Guard Risk Rules on Computer Use...");
  const safeMouse = securityGuard.evaluateToolRisk('mouse_click', { x: 100, y: 100 });
  assert.strictEqual(safeMouse, 'SAFE');

  const dangerousKey = securityGuard.evaluateToolRisk('keyboard_press', { shortcut: '%{F4}' });
  assert.strictEqual(dangerousKey, 'CONFIRMATION_REQUIRED', 'Alt+F4 should require confirmation.');
  console.log("  => PASSED ✅");

  console.log("\n=========================================");
  console.log("  ALL COMPUTER USE TESTS PASSED! 🖥️✅    ");
  console.log("=========================================");
}

runComputerUseTests().catch(err => {
  console.error("Computer Use Tests Failed ❌:", err);
  process.exit(1);
});
