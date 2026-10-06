const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const fs = require('fs');
const path = require('path');
const { resolveAndValidatePath } = require('../security/fsGuard');

/**
 * Hardened File Operations Tools
 * Strictly contained within allowed workspace roots.
 */

const readFileTool = tool(async ({ targetPath }) => {
  try {
    const validatedPath = resolveAndValidatePath(targetPath, { mustExist: true });
    const stats = fs.statSync(validatedPath);
    if (stats.isDirectory()) {
      return `Target path is a directory, not a file: ${validatedPath}`;
    }
    const content = fs.readFileSync(validatedPath, 'utf-8');
    return content;
  } catch (e) {
    return `Read File Error (${e.code || 'ERROR'}): ${e.message}`;
  }
}, {
  name: "read_file",
  description: "Read text contents of a file strictly contained inside the workspace.",
  schema: z.object({ targetPath: z.string().describe("Path to the file.") })
});

const listDirectoryTool = tool(async ({ targetPath = "." }) => {
  try {
    const validatedPath = resolveAndValidatePath(targetPath, { mustExist: true });
    const stats = fs.statSync(validatedPath);
    if (!stats.isDirectory()) {
      return `Target path is a file, not a directory: ${validatedPath}`;
    }
    const items = fs.readdirSync(validatedPath, { withFileTypes: true });
    const formatted = items.map(item => `${item.isDirectory() ? '[DIR]' : '[FILE]'} ${item.name}`).join("\n");
    return formatted || "(Empty directory)";
  } catch (e) {
    return `List Directory Error (${e.code || 'ERROR'}): ${e.message}`;
  }
}, {
  name: "list_directory",
  description: "List files and subdirectories inside a directory within the workspace.",
  schema: z.object({ targetPath: z.string().optional().default(".").describe("Directory path.") })
});

const manageFilesTool = tool(async ({ action, targetPath, content }) => {
  try {
    const validatedPath = resolveAndValidatePath(targetPath, { mustExist: action === 'delete' });

    if (action === 'create' || action === 'update') {
      const dir = path.dirname(validatedPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(validatedPath, content || '', 'utf-8');
      return `File ${action}d successfully at ${validatedPath}`;
    }

    if (action === 'delete') {
      if (!fs.existsSync(validatedPath)) {
        return `File does not exist: ${validatedPath}`;
      }
      fs.unlinkSync(validatedPath);
      return `File successfully deleted at ${validatedPath}`;
    }

    return "Unsupported action";
  } catch (e) {
    return `File Operations Error (${e.code || 'ERROR'}): ${e.message}`;
  }
}, {
  name: "manage_files",
  description: "Create, update, or delete files strictly within the workspace.",
  schema: z.object({
    action: z.enum(['create', 'update', 'delete']).describe("File operation."),
    targetPath: z.string().describe("Target file path inside the workspace."),
    content: z.string().optional().describe("Content for create or update.")
  })
});

module.exports = { readFileTool, listDirectoryTool, manageFilesTool };
