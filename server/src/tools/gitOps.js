const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { exec } = require('child_process');

const getGitStatusTool = tool(async ({ repoPath = "." }) => {
  return new Promise((resolve) => {
    exec(`git -C "${repoPath}" status`, (error, stdout, stderr) => {
      if (error) resolve(`Git Error: ${stderr || error.message}`);
      else resolve(stdout.trim());
    });
  });
}, {
  name: "get_git_status",
  description: "Get repository status and branch information.",
  schema: z.object({
    repoPath: z.string().optional().default(".").describe("Path to repository (defaults to current project).")
  })
});

const getGitLogTool = tool(async ({ count = 5, repoPath = "." }) => {
  return new Promise((resolve) => {
    exec(`git -C "${repoPath}" log -n ${count} --oneline`, (error, stdout, stderr) => {
      if (error) resolve(`Git Log Error: ${stderr || error.message}`);
      else resolve(stdout.trim());
    });
  });
}, {
  name: "get_git_log",
  description: "Get recent commit history.",
  schema: z.object({
    count: z.number().optional().default(5).describe("Number of commits to retrieve."),
    repoPath: z.string().optional().default(".").describe("Repository path.")
  })
});

module.exports = { getGitStatusTool, getGitLogTool };
