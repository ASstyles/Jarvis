const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { resolveAndValidatePath, FilesystemSecurityError } = require('../src/security/fsGuard');
const { isBlockedAddress, vetTargetUrl, NetworkSecurityError } = require('../src/security/netProxy');
const { runJsInIsolatedWorker, getSanitizedEnvironment } = require('../src/sandbox/isolatedSandbox');
const { evaluateToolCall, CAPABILITY_CLASSES, RISK_LEVELS, OPERATING_MODES } = require('../src/security/capabilityPolicy');
const { verifyFirebaseToken } = require('../src/middleware/auth');
const modelRouter = require('../src/llm/modelRouter');

async function runSecurityAndUpgradeTests() {
  console.log("===============================================================");
  console.log("  JARVIS SECURITY, CAPABILITY & INTEGRATION TEST SUITE        ");
  console.log("===============================================================");

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  console.log("\n--- SECTION 1: FILESYSTEM HARDENING (fsGuard) ---");

  test("Allows valid file inside workspace root", () => {
    const validPath = resolveAndValidatePath("package.json");
    assert(validPath.endsWith("package.json"));
  });

  test("Rejects directory traversal escape (../)", () => {
    assert.throws(() => {
      resolveAndValidatePath("../../../../../../../etc/passwd");
    }, /outside allowed workspace root/);
  });

  test("Rejects UNC paths (\\\\server\\share)", () => {
    assert.throws(() => {
      resolveAndValidatePath("\\\\192.168.1.100\\c$\\Windows");
    }, /UNC and device namespace paths are strictly prohibited/);
  });

  test("Rejects Windows DOS device names (CON, NUL, AUX, PRN)", () => {
    assert.throws(() => {
      resolveAndValidatePath("CON.txt");
    }, /Windows reserved device name prohibited/);

    assert.throws(() => {
      resolveAndValidatePath("nul");
    }, /Windows reserved device name prohibited/);
  });

  console.log("\n--- SECTION 2: SSRF & NETWORK ISOLATION (netProxy) ---");

  test("Blocks loopback IPv4 addresses (127.0.0.1, 127.0.1.1)", () => {
    assert.strictEqual(isBlockedAddress("127.0.0.1"), true);
    assert.strictEqual(isBlockedAddress("127.0.1.1"), true);
  });

  test("Blocks RFC 1918 private IPv4 ranges (10.x, 172.16.x, 192.168.x)", () => {
    assert.strictEqual(isBlockedAddress("10.0.0.1"), true);
    assert.strictEqual(isBlockedAddress("172.16.0.1"), true);
    assert.strictEqual(isBlockedAddress("172.31.255.255"), true);
    assert.strictEqual(isBlockedAddress("192.168.1.1"), true);
    assert.strictEqual(isBlockedAddress("192.168.0.254"), true);
  });

  test("Blocks cloud metadata endpoint (169.254.169.254)", () => {
    assert.strictEqual(isBlockedAddress("169.254.169.254"), true);
  });

  test("Blocks IPv4-mapped IPv6 loopback (::ffff:127.0.0.1)", () => {
    assert.strictEqual(isBlockedAddress("::ffff:127.0.0.1"), true);
    assert.strictEqual(isBlockedAddress("::ffff:10.0.0.1"), true);
  });

  test("Allows legitimate public internet IPs", () => {
    assert.strictEqual(isBlockedAddress("8.8.8.8"), false);
    assert.strictEqual(isBlockedAddress("1.1.1.1"), false);
    assert.strictEqual(isBlockedAddress("142.250.190.46"), false);
  });

  test("vetTargetUrl rejects unsupported protocols (file://, ftp://, gopher://)", () => {
    assert.throws(() => {
      vetTargetUrl("file:///etc/passwd");
    }, /Unsupported protocol/);

    assert.throws(() => {
      vetTargetUrl("ftp://files.example.com/secret.txt");
    }, /Unsupported protocol/);
  });

  test("vetTargetUrl rejects localhost and internal hostnames", () => {
    assert.throws(() => {
      vetTargetUrl("http://localhost:8080/admin");
    }, /SSRF Refusal/);

    assert.throws(() => {
      vetTargetUrl("http://internal.service/health");
    }, /SSRF Refusal/);
  });

  console.log("\n--- SECTION 3: CODE EXECUTION SANDBOX (isolatedSandbox) ---");

  test("Environment sanitizer strips credentials and API keys", () => {
    const origKey = process.env.GEMINI_API_KEY;
    const origSec = process.env.AWS_SECRET_KEY;
    process.env.GEMINI_API_KEY = "test_key_12345";
    process.env.AWS_SECRET_KEY = "super_secret_aws";

    const cleanEnv = getSanitizedEnvironment();
    assert.strictEqual(cleanEnv.GEMINI_API_KEY, undefined);
    assert.strictEqual(cleanEnv.AWS_SECRET_KEY, undefined);

    if (origKey) process.env.GEMINI_API_KEY = origKey; else delete process.env.GEMINI_API_KEY;
    if (origSec) process.env.AWS_SECRET_KEY = origSec; else delete process.env.AWS_SECRET_KEY;
  });

  await asyncTest("Executes JavaScript in isolated Worker thread & VM", async () => {
    const res = await runJsInIsolatedWorker("const x = 21 * 2; console.log('COMPUTED=' + x);", 5000);
    assert.strictEqual(res.status, 'SUCCESS');
    assert(res.stdout.includes("COMPUTED=42"));
  });

  await asyncTest("Terminates execution on infinite loop timeout", async () => {
    const res = await runJsInIsolatedWorker("while(true) {}", 800);
    assert.strictEqual(res.status, 'ERROR');
    assert(res.stderr.includes("timed out") || res.stderr.includes("Script execution timed out") || res.error?.includes("timed out"));
  });

  console.log("\n--- SECTION 4: CAPABILITY POLICY & RISK GOVERNANCE ---");

  test("Safe read tool passes in ZERO_FRICTION mode without confirmation", () => {
    const evalResult = evaluateToolCall("read_file", { path: "README.md" }, { mode: OPERATING_MODES.ZERO_FRICTION });
    assert.strictEqual(evalResult.requiresConfirmation, false);
    assert.strictEqual(evalResult.definition.capability, CAPABILITY_CLASSES.READ);
  });

  test("Destructive shell command requires confirmation even in ZERO_FRICTION", () => {
    const evalResult = evaluateToolCall("run_terminal_command", { command: "rm -rf /" }, { mode: OPERATING_MODES.ZERO_FRICTION });
    assert.strictEqual(evalResult.requiresConfirmation, true);
    assert.strictEqual(evalResult.risk, RISK_LEVELS.CONFIRMATION_REQUIRED);
  });

  test("All state-mutating actions require confirmation in ASSISTED mode", () => {
    const evalResult = evaluateToolCall("manage_files", { operation: "write", path: "test.txt", content: "data" }, { mode: OPERATING_MODES.ASSISTED });
    assert.strictEqual(evalResult.requiresConfirmation, true);
  });

  console.log("\n--- SECTION 5: BACKEND AUTHENTICATION (auth) ---");

  await asyncTest("Rejects malformed JWT tokens", async () => {
    let threw = false;
    try {
      await verifyFirebaseToken("not.a.valid.jwt");
    } catch (e) {
      threw = true;
    }
    assert.strictEqual(threw, true);
  });

  await asyncTest("Rejects expired JWT tokens", async () => {
    // Construct expired token payload
    const expiredPayload = Buffer.from(JSON.stringify({
      sub: "user-123",
      exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
    })).toString('base64url');
    const dummyHeader = Buffer.from(JSON.stringify({ alg: "RS256" })).toString('base64url');
    const dummySig = "signature";

    let expiredCaught = false;
    try {
      await verifyFirebaseToken(`${dummyHeader}.${expiredPayload}.${dummySig}`);
    } catch (e) {
      if (e.message.includes("expired")) expiredCaught = true;
    }
    assert.strictEqual(expiredCaught, true);
  });

  console.log("\n--- SECTION 6: MODEL ROUTER & MULTI-PROVIDER ABSTRACTION ---");

  test("Model router supports provider registration and status querying", () => {
    const providers = modelRouter.getAvailableProviders();
    assert(Array.isArray(providers));
    assert(providers.some(p => p.id === "gemini"));
    assert(providers.some(p => p.id === "claude"));
  });

  test("Model router respects manual provider selection", () => {
    modelRouter.setActiveProvider("gemini");
    assert.strictEqual(modelRouter.activeProvider, "gemini");

    modelRouter.setActiveProvider("claude");
    assert.strictEqual(modelRouter.activeProvider, "claude");
  });

  console.log("\n===============================================================");
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED               `);
  console.log("===============================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityAndUpgradeTests().catch(err => {
  console.error("Unhandled error in test suite:", err);
  process.exit(1);
});
