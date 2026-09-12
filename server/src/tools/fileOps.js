const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const fs = require('fs');
const path = require('path');

const readFileTool = tool(async ({ targetPath }) => {
  try {
    const fullPath = path.resolve(targetPath);
    if (!fs.existsSync(fullPath)) return `File does not exist at: ${fullPath}`;
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) return `Path is a directory, not a file: ${fullPath}`;
    const content = fs.readFileSync(fullPath, 'utf-8');
    return content;
  } catch (e) {
    return `Read File Error: ${e.message}`;
  }
}, {
  name: "read_file",
  description: "Read text contents of a local file.",
  schema: z.object({ targetPath: z.string().describe("Path to the file.") })
});

const listDirectoryTool = tool(async ({ targetPath = "." }) => {
  try {
    const fullPath = path.resolve(targetPath);
    if (!fs.existsSync(fullPath)) return `Directory does not exist at: ${fullPath}`;
    const items = fs.readdirSync(fullPath, { withFileTypes: true });
    const formatted = items.map(item => `${item.isDirectory() ? '[DIR]' : '[FILE]'} ${item.name}`).join("\n");
    return formatted || "(Empty directory)";
  } catch (e) {
    return `List Directory Error: ${e.message}`;
  }
}, {
  name: "list_directory",
  description: "List files and subdirectories inside a directory.",
  schema: z.object({ targetPath: z.string().optional().default(".").describe("Directory path.") })
});

const manageFilesTool = tool(async ({ action, targetPath, content }) => {
  try {
    const fullPath = path.resolve(targetPath);
    if (action === 'create' || action === 'update') {
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, content || '', 'utf-8');
      return `File ${action}d successfully at ${fullPath}`;
    }
    if (action === 'delete') {
      if (!fs.existsSync(fullPath)) return `File does not exist: ${fullPath}`;
      fs.unlinkSync(fullPath);
      return `File successfully deleted at ${fullPath}`;
    }
    return "Unsupported action";
  } catch (e) {
    return `File Operations Error: ${e.message}`;
  }
}, {
  name: "manage_files",
  description: "Create, update, or delete files on the file system.",
  schema: z.object({
    action: z.enum(['create', 'update', 'delete']).describe("File operation."),
    targetPath: z.string().describe("Target file path."),
    content: z.string().optional().describe("Content for create or update.")
  })
});

module.exports = { readFileTool, listDirectoryTool, manageFilesTool };
