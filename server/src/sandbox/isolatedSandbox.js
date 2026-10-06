const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { Worker } = require('worker_threads');

/**
 * Isolated Code Execution Sandbox
 *
 * Implements genuine isolation for untrusted autonomous code execution:
 * - JavaScript: Isolated Worker Thread with Node vm sandbox, stripped env, memory cap, strict timeout.
 * - Python: Process isolation with stripped credentials, dedicated scratch directory, timeout, output cap.
 */

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_OUTPUT_BYTES = 256 * 1024; // 256 KB

const SANDBOX_BASE_DIR = path.resolve(__dirname, '../../../.jarvis_sandbox');
if (!fs.existsSync(SANDBOX_BASE_DIR)) {
  try { fs.mkdirSync(SANDBOX_BASE_DIR, { recursive: true }); } catch (_) {}
}

/**
 * Strips sensitive credentials from environment variables before passing to sub-processes.
 */
function getSanitizedEnvironment() {
  const safeEnv = {};
  const allowedKeys = ['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'NODE_ENV'];

  for (const [key, val] of Object.entries(process.env)) {
    const upper = key.toUpperCase();
    // Exclude anything that looks like an API key, token, secret, password, or cloud credential
    if (
      upper.includes('KEY') ||
      upper.includes('SECRET') ||
      upper.includes('TOKEN') ||
      upper.includes('PASS') ||
      upper.includes('AUTH') ||
      upper.includes('CREDENTIAL') ||
      upper.includes('GEMINI') ||
      upper.includes('ANTHROPIC') ||
      upper.includes('CLAUDE') ||
      upper.includes('FIREBASE') ||
      upper.includes('ELEVEN')
    ) {
      continue;
    }

    if (allowedKeys.includes(upper) || upper.startsWith('LC_') || upper.startsWith('LANG')) {
      safeEnv[key] = val;
    }
  }

  return safeEnv;
}

/**
 * Executes JavaScript code inside an isolated Worker thread and VM context.
 */
function runJsInIsolatedWorker(code, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const workerScript = `
      const { parentPort, workerData } = require('worker_threads');
      const vm = require('vm');

      const logs = [];
      const errLogs = [];

      const virtualConsole = {
        log: (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
        error: (...args) => errLogs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
        warn: (...args) => logs.push('[WARN] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
        info: (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '))
      };

      const context = {
        console: virtualConsole,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        Math,
        Date,
        JSON,
        Buffer,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
        Map,
        Set,
        Promise,
        // Prohibit direct host fs, child_process, network
        process: {
          env: {},
          nextTick: process.nextTick,
          uptime: () => 0
        }
      };

      vm.createContext(context);

      try {
        const script = new vm.Script(workerData.code);
        const result = script.runInContext(context, { timeout: workerData.timeoutMs });
        parentPort.postMessage({
          success: true,
          stdout: logs.join('\\n'),
          stderr: errLogs.join('\\n'),
          result: result !== undefined ? String(result) : null
        });
      } catch (err) {
        parentPort.postMessage({
          success: false,
          stdout: logs.join('\\n'),
          stderr: (errLogs.length ? errLogs.join('\\n') + '\\n' : '') + err.message
        });
      }
    `;

    const startTime = Date.now();
    let settled = false;

    const worker = new Worker(workerScript, {
      eval: true,
      workerData: { code, timeoutMs },
      resourceLimits: { maxOldGenerationSizeMb: 128 }
    });

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        worker.terminate();
        resolve({
          status: 'TIMEOUT',
          stdout: '',
          stderr: `Execution timed out after ${timeoutMs}ms. Process terminated.`,
          durationMs: Date.now() - startTime
        });
      }
    }, timeoutMs + 500);

    worker.on('message', (msg) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        worker.terminate();
        resolve({
          status: msg.success ? 'SUCCESS' : 'ERROR',
          stdout: msg.stdout || '',
          stderr: msg.stderr || '',
          result: msg.result,
          durationMs: Date.now() - startTime
        });
      }
    });

    worker.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({
          status: 'ERROR',
          stdout: '',
          stderr: `Sandbox Worker Error: ${err.message}`,
          durationMs: Date.now() - startTime
        });
      }
    });

    worker.on('exit', (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({
          status: code === 0 ? 'SUCCESS' : 'ERROR',
          stdout: '',
          stderr: `Sandbox Worker exited with code ${code}`,
          durationMs: Date.now() - startTime
        });
      }
    });
  });
}

/**
 * Executes Python code inside a dedicated, credential-stripped scratch folder.
 */
function runPythonInIsolatedProcess(code, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const runDir = path.join(SANDBOX_BASE_DIR, runId);
    fs.mkdirSync(runDir, { recursive: true });

    const scriptPath = path.join(runDir, 'script.py');
    fs.writeFileSync(scriptPath, code, 'utf-8');

    const startTime = Date.now();
    const safeEnv = getSanitizedEnvironment();

    let stdout = '';
    let stderr = '';
    let settled = false;

    const proc = spawn('python', [scriptPath], {
      cwd: runDir,
      env: safeEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { proc.kill('SIGKILL'); } catch (_) {}
        cleanup();
        resolve({
          status: 'TIMEOUT',
          stdout: stdout.trim(),
          stderr: `Execution timed out after ${timeoutMs}ms. Process terminated.`,
          durationMs: Date.now() - startTime
        });
      }
    }, timeoutMs);

    proc.stdout.on('data', (data) => {
      if (stdout.length < MAX_OUTPUT_BYTES) {
        stdout += data.toString('utf-8');
      }
    });

    proc.stderr.on('data', (data) => {
      if (stderr.length < MAX_OUTPUT_BYTES) {
        stderr += data.toString('utf-8');
      }
    });

    function cleanup() {
      try {
        if (fs.existsSync(runDir)) {
          fs.rmSync(runDir, { recursive: true, force: true });
        }
      } catch (_) {}
    }

    proc.on('close', (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);

        // Check for created artifacts before cleanup
        const artifacts = [];
        try {
          const files = fs.readdirSync(runDir);
          for (const f of files) {
            if (f !== 'script.py') {
              artifacts.push(f);
            }
          }
        } catch (_) {}

        cleanup();

        resolve({
          status: code === 0 ? 'SUCCESS' : 'ERROR',
          stdout: stdout.trim() || 'Executed with no stdout output.',
          stderr: stderr.trim(),
          artifacts,
          durationMs: Date.now() - startTime
        });
      }
    });

    proc.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        cleanup();
        resolve({
          status: 'ERROR',
          stdout: '',
          stderr: `Failed to spawn Python interpreter: ${err.message}`,
          durationMs: Date.now() - startTime
        });
      }
    });
  });
}

/**
 * Universal sandbox execution entrypoint.
 */
async function executeInSandbox(language, code, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const lang = String(language || '').toLowerCase().trim();

  if (lang === 'javascript' || lang === 'js') {
    return await runJsInIsolatedWorker(code, timeoutMs);
  } else if (lang === 'python' || lang === 'py') {
    return await runPythonInIsolatedProcess(code, timeoutMs);
  } else {
    return {
      status: 'ERROR',
      stdout: '',
      stderr: `Unsupported sandbox language "${language}". Supported: javascript, python.`,
      durationMs: 0
    };
  }
}

module.exports = {
  executeInSandbox,
  runJsInIsolatedWorker,
  getSanitizedEnvironment
};
