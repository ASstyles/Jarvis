const { securityGuard, OPERATING_MODES, RISK_LEVELS } = require('../src/security/securityGuard');
const orchestrator = require('../src/agents/orchestrator');
const wakeWordEngine = require('../src/voice/wakeWordEngine');
const goalEngine = require('../src/goals/goalEngine');

async function runTests() {
  console.log("==================================================");
  console.log("  JARVIS ZERO-FRICTION MODE VERIFICATION SUITE   ");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Operating Mode Switching & Persistence
  console.log("--- TEST 1: Operating Mode Management ---");
  securityGuard.setOperatingMode(OPERATING_MODES.ZERO_FRICTION);
  assert(securityGuard.getOperatingMode() === 'ZERO_FRICTION', "Set and get ZERO_FRICTION mode");

  securityGuard.setOperatingMode(OPERATING_MODES.AUTONOMOUS);
  assert(securityGuard.getOperatingMode() === 'AUTONOMOUS', "Set and get AUTONOMOUS mode");

  securityGuard.setOperatingMode(OPERATING_MODES.ASSISTED);
  assert(securityGuard.getOperatingMode() === 'ASSISTED', "Set and get ASSISTED mode");

  securityGuard.setOperatingMode(OPERATING_MODES.ZERO_FRICTION);

  // 2. Remembered Scoped Permissions
  console.log("\n--- TEST 2: Remembered Scoped Permissions ---");
  const testPerm = securityGuard.grantPermission({
    scope: 'WORKSPACE',
    action: 'terminal:tests',
    context: 'Test execution permitted without asking',
    description: 'Autonomous test suite runs'
  });
  assert(testPerm && testPerm.id, "Grant remembered permission");

  const remembered = securityGuard.getRememberedPermissions();
  assert(remembered.some(p => p.id === testPerm.id), "Retrieve active remembered permissions list");

  const grantedCheck = securityGuard.isPermissionGranted('run_terminal_command', { command: 'npm test' });
  assert(grantedCheck === true, "Scoped permission matches 'npm test' command");

  const revoked = securityGuard.revokePermission(testPerm.id);
  assert(revoked === true, "Revoke remembered permission");
  assert(!securityGuard.getRememberedPermissions().some(p => p.id === testPerm.id), "Permission no longer in active list after revocation");

  // 3. Risk Evaluation in ZERO-FRICTION Mode
  console.log("\n--- TEST 3: Mode-Aware Risk Assessment in Zero-Friction ---");
  securityGuard.setOperatingMode(OPERATING_MODES.ZERO_FRICTION);

  const safeReadRisk = securityGuard.evaluateToolRisk('read_file', { path: 'package.json' });
  assert(safeReadRisk === RISK_LEVELS.SAFE, "Zero-Friction: read_file is SAFE (auto-execute)");

  const safeCmdRisk = securityGuard.evaluateToolRisk('run_terminal_command', { command: 'npm run build' });
  assert(safeCmdRisk === RISK_LEVELS.SAFE, "Zero-Friction: safe dev terminal command is SAFE (auto-execute)");

  const safeFileRisk = securityGuard.evaluateToolRisk('manage_files', { action: 'write', path: 'src/test.js' });
  assert(safeFileRisk === RISK_LEVELS.SAFE, "Zero-Friction: workspace file write is SAFE (auto-execute)");

  const dangerousCmdRisk = securityGuard.evaluateToolRisk('run_terminal_command', { command: 'format C:' });
  assert(dangerousCmdRisk === RISK_LEVELS.CONFIRMATION_REQUIRED, "Zero-Friction: dangerous format command requires CONFIRMATION");

  const shutdownRisk = securityGuard.evaluateToolRisk('system_power', { action: 'shutdown' });
  assert(shutdownRisk === RISK_LEVELS.CONFIRMATION_REQUIRED, "Zero-Friction: system power shutdown requires CONFIRMATION");

  // 4. Voice Commands in Wake-Word Engine
  console.log("\n--- TEST 4: Voice Commands & Mode Switching ---");
  const voiceModeRes = wakeWordEngine.handleVoiceCommand("JARVIS, switch to Zero-Friction Mode");
  assert(voiceModeRes && voiceModeRes.handled && voiceModeRes.mode === 'ZERO_FRICTION', "Voice command switches to Zero-Friction Mode");

  const voiceStatusRes = wakeWordEngine.handleVoiceCommand("JARVIS, what are you doing?");
  assert(voiceStatusRes && voiceStatusRes.handled && voiceStatusRes.action === 'STATUS', "Voice command handles status inquiry");

  // 5. Fast Directive Interception in Orchestrator
  console.log("\n--- TEST 5: Orchestrator Fast Intent Directives ---");
  const orchModeSwitch = await orchestrator.processUserRequest("JARVIS, switch to Zero-Friction Mode");
  assert(orchModeSwitch.emotion === 'system stable' && orchModeSwitch.text.includes('Zero-Friction Mode engaged'), "Orchestrator handles 'switch to Zero-Friction Mode'");

  const orchPermGrant = await orchestrator.processUserRequest("You can run tests in this repository without asking me");
  assert(orchPermGrant.emotion === 'system stable' && orchPermGrant.text.includes('Permission preference remembered'), "Orchestrator handles natural permission grant");

  const orchStatus = await orchestrator.processUserRequest("Show me what you're doing");
  assert(orchStatus.text.includes('Operating in ZERO_FRICTION mode'), "Orchestrator handles live status query");

  console.log("\n==================================================");
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
