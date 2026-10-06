const modelRouter = require('../llm/modelRouter');
const { readFileTool, manageFilesTool, listDirectoryTool } = require('../tools/fileOps');
const { runTerminalCommandTool } = require('../tools/terminalOps');
const { executeCodeSandboxTool } = require('../tools/codeOps');
const { getGitStatusTool, getGitLogTool } = require('../tools/gitOps');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');

class CodingAgent {
  constructor() {
    this.tools = [
      readFileTool,
      manageFilesTool,
      listDirectoryTool,
      runTerminalCommandTool,
      executeCodeSandboxTool,
      getGitStatusTool,
      getGitLogTool
    ];
  }

  async executeCodingTask(taskDescription, contextStr = "") {
    console.log(`[CODING_AGENT] Starting task: "${taskDescription}"`);

    const messages = [
      new SystemMessage(`You are the CODING AGENT inside JARVIS.
Your objective: Inspect codebases, write high-quality code, execute terminal commands or code sandboxes to test, and verify syntax.
Be clean, robust, and handle errors gracefully.`),
      new HumanMessage(`Context:\n${contextStr}\n\nTask: ${taskDescription}`)
    ];

    try {
      const response = await modelRouter.invokeWithFallback(messages, this.tools, 'coding', 0.1, { taskType: 'coding' });
      return response.content || "Coding task completed cleanly.";
    } catch (err) {
      console.error("[CODING_AGENT] Error:", err.message);
      return `Coding agent encountered an error: ${err.message}`;
    }
  }
}

const codingAgent = new CodingAgent();
module.exports = codingAgent;
