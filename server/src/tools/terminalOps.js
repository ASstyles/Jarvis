const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { exec } = require('child_process');

const runTerminalCommandTool = tool(async ({ command, timeoutMs = 30000 }) => {
  return new Promise((resolve) => {
    console.log(`[TERMINAL] Executing command: "${command}"`);
    const proc = exec(command, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        if (error.killed) {
          return resolve(`Execution timed out after ${timeoutMs}ms.`);
        }
        return resolve(`Command execution failed (Exit code ${error.code}):\n${stderr || error.message}`);
      }
      const output = stdout.trim() || stderr.trim() || "Command executed cleanly with no output.";
      resolve(output);
    });
  });
}, {
  name: "run_terminal_command",
  description: "Execute a local shell / terminal command on the Windows host machine (PowerShell / CMD). Use for running scripts, npm, git, system diagnostics, build tasks, etc.",
  schema: z.object({
    command: z.string().describe("The exact terminal command string to execute."),
    timeoutMs: z.number().optional().default(30000).describe("Optional execution timeout in milliseconds.")
  })
});

module.exports = { runTerminalCommandTool };
