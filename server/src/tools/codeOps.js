const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { executeInSandbox } = require('../sandbox/isolatedSandbox');

/**
 * Isolated Code Sandbox Tool
 * Executes JS in an isolated Worker thread and Python in a dedicated, credential-stripped process.
 */

const executeCodeSandboxTool = tool(async ({ language, code, timeoutMs = 15000 }) => {
  try {
    const outcome = await executeInSandbox(language, code, { timeoutMs });

    if (outcome.status === 'TIMEOUT') {
      return `Sandbox Execution Timed Out (${outcome.durationMs}ms):\n${outcome.stderr}`;
    }

    if (outcome.status === 'ERROR') {
      return `Sandbox Execution Error (${language}, ${outcome.durationMs}ms):\n${outcome.stderr || outcome.stdout}`;
    }

    let output = `Sandbox Output (${language}, ${outcome.durationMs}ms):\n`;
    if (outcome.stdout) output += outcome.stdout;
    if (outcome.result !== undefined && outcome.result !== null) output += `\nReturn Value: ${outcome.result}`;
    if (outcome.artifacts && outcome.artifacts.length) {
      output += `\nGenerated Artifacts: ${outcome.artifacts.join(', ')}`;
    }

    return output.trim() || "Executed successfully with no console output.";
  } catch (err) {
    return `Sandbox Failure: ${err.message}`;
  }
}, {
  name: "execute_code_sandbox",
  description: "Execute a JavaScript (Node.js) or Python snippet in a genuinely isolated worker/sandbox environment.",
  schema: z.object({
    language: z.enum(["javascript", "js", "python", "py"]).describe("Programming language."),
    code: z.string().describe("Executable code content."),
    timeoutMs: z.number().optional().default(15000).describe("Optional execution timeout in milliseconds.")
  })
});

module.exports = { executeCodeSandboxTool };
