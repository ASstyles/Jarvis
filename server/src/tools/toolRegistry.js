const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const memoryMatrix = require("../memory/memoryMatrix");
const worldModel = require("../world/worldModel");

const { readFileTool, listDirectoryTool, manageFilesTool } = require("./fileOps");
const { runTerminalCommandTool } = require("./terminalOps");
const { searchWebTool, openUrlTool, webFetchTool } = require("./webOps");
const { executeCodeSandboxTool } = require("./codeOps");
const { getGitStatusTool, getGitLogTool } = require("./gitOps");
const { writeNotepadTool } = require("./notepadOps");
const { searchMediaTool, playMediaTool } = require("./mediaOps");
const { systemVolumeTool, systemPowerTool } = require("./systemOps");
const { manageProcessTool, readActiveWindowTool } = require("./appOps");
const { launchGameverseGameTool } = require("./gameOps");

// JARVIS 2.0 Extended Ops
const {
  captureScreenTool,
  inspectUiElementsTool,
  mouseClickTool,
  typeTextTool,
  keyboardPressTool,
  waitForUiStateTool,
  verifyUiStateTool
} = require("./computerOps");

const {
  createBackgroundTaskTool,
  manageBackgroundTaskTool
} = require("./taskOps");

const {
  runSkillTool,
  saveWorkflowSkillTool
} = require("./skillOps");

const {
  queryKnowledgeVaultTool,
  ingestVaultDocumentTool
} = require("./vaultOps");

// JARVIS 3.0 Visual Perception & Distributed Compute Ops
const {
  groundUiElementTool,
  clickSemanticElementTool,
  readScreenTextTool,
  visuallyVerifyActionTool
} = require("./visualOps");

const {
  dispatchDistributedJobTool,
  queryComputeFabricTool,
  manageDistributedJobTool
} = require("./computeOps");

// Memory tools tied to MemoryMatrix 2.0
const saveMemoryTool = tool(async ({ key, value, importance = 3, category = 'fact' }) => {
  return memoryMatrix.saveFact(key, value, importance, category);
}, {
  name: "save_memory",
  description: "Save a long-term fact, preference, procedural guideline, or piece of user information into JARVIS Memory 2.0.",
  schema: z.object({
    key: z.string().describe("Memory key identifier."),
    value: z.string().describe("Information value to store."),
    importance: z.number().optional().default(3).describe("Importance score 1-5."),
    category: z.enum(['fact', 'preference', 'episodic', 'procedural', 'constraint']).optional().default('fact').describe("Memory category type.")
  })
});

const recallMemoryTool = tool(async ({ key }) => {
  const fact = memoryMatrix.recallFact(key);
  if (fact) return `Memory Record [${key}]: ${fact}`;
  const semanticResults = memoryMatrix.searchSemanticMemory(key, 3);
  if (semanticResults.length > 0) {
    return "No exact key match, but found relevant memories:\n" + semanticResults.map(r => `- [${r.key}] (${r.type || 'fact'}): ${r.value}`).join("\n");
  }
  return `No memory record found for key or topic: "${key}".`;
}, {
  name: "recall_memory",
  description: "Recall a stored long-term fact or search semantic memory.",
  schema: z.object({
    key: z.string().describe("Fact key or topic keyword to recall.")
  })
});

const allTools = [
  // File Ops
  readFileTool,
  listDirectoryTool,
  manageFilesTool,

  // Memory Ops
  saveMemoryTool,
  recallMemoryTool,

  // Terminal & Execution Ops
  runTerminalCommandTool,
  executeCodeSandboxTool,

  // Web Ops
  searchWebTool,
  openUrlTool,
  webFetchTool,

  // Git Ops
  getGitStatusTool,
  getGitLogTool,

  // Document & Notepad Ops
  writeNotepadTool,

  // Media & Music Ops
  searchMediaTool,
  playMediaTool,

  // System & App Ops
  systemVolumeTool,
  systemPowerTool,
  manageProcessTool,
  readActiveWindowTool,

  // Computer Vision & Computer Use Ops
  captureScreenTool,
  inspectUiElementsTool,
  mouseClickTool,
  typeTextTool,
  keyboardPressTool,
  waitForUiStateTool,
  verifyUiStateTool,

  // Background Task Ops
  createBackgroundTaskTool,
  manageBackgroundTaskTool,

  // Skills Ops
  runSkillTool,
  saveWorkflowSkillTool,

  // Knowledge Vault Ops
  queryKnowledgeVaultTool,
  ingestVaultDocumentTool,

  // JARVIS 3.0 Visual Perception & Semantic Grounding
  groundUiElementTool,
  clickSemanticElementTool,
  readScreenTextTool,
  visuallyVerifyActionTool,

  // JARVIS 3.0 Distributed Compute Fabric
  dispatchDistributedJobTool,
  queryComputeFabricTool,
  manageDistributedJobTool,

  // Game Ops
  launchGameverseGameTool
];

const { validateToolsForGemini } = require("./toolValidator");

function getAllTools() {
  const validated = validateToolsForGemini(allTools);
  try {
    worldModel.updateAvailableTools(validated.map(t => t.name));
  } catch (_) {}
  return validated;
}

function getToolByName(name) {
  return allTools.find(t => t.name === name);
}

module.exports = {
  getAllTools,
  getToolByName,
  saveMemoryTool,
  recallMemoryTool,
  validateToolsForGemini
};
