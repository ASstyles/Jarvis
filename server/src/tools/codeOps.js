const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const executeCodeSandboxTool = tool(async ({ language, code }) => {
  return new Promise((resolve) => {
    const tmpDir = os.tmpdir();
    const ext = language.toLowerCase() === 'python' ? 'py' : 'js';
    const filePath = path.join(tmpDir, `jarvis_exec_${Date.now()}.${ext}`);

    fs.writeFileSync(filePath, code, 'utf-8');

    const cmd = ext === 'py' ? `python "${filePath}"` : `node "${filePath}"`;

    exec(cmd, { timeout: 15000 }, (error, stdout, stderr) => {
      // Clean up temp file
      try { fs.unlinkSync(filePath); } catch (_) {}

      if (error) {
        return resolve(`Execution Error (${language}):\n${stderr || error.message}`);
      }
      resolve(`Sandbox Output:\n${stdout.trim() || "Executed successfully with no console output."}`);
    });
  });
}, {
  name: "execute_code_sandbox",
  description: "Execute a JavaScript (Node.js) or Python snippet in an isolated local sandbox and return stdout/stderr.",
  schema: z.object({
    language: z.enum(["javascript", "js", "python", "py"]).describe("Programming language."),
    code: z.string().describe("Executable code content.")
  })
});

module.exports = { executeCodeSandboxTool };
