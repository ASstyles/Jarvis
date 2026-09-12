const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const writeNotepadTool = tool(async ({ content, filename = "jarvis_document.txt" }) => {
  return new Promise((resolve) => {
    const tempPath = path.join(os.tmpdir(), filename);
    fs.writeFileSync(tempPath, content, 'utf-8');

    const psCommand = `
      $old = Get-Clipboard;
      $path = "${tempPath.replace(/\\/g, '/')}";
      Set-Clipboard -Value (Get-Content -Raw -Path $path);
      Start-Process notepad;
      Start-Sleep -m 1500;
      Add-Type -AssemblyName System.Windows.Forms;
      [System.Windows.Forms.SendKeys]::SendWait('^v');
      Start-Sleep -m 200;
      if ($old) { Set-Clipboard -Value $old } else { Set-Clipboard -Value '' };
    `;

    exec(`powershell -NoProfile -Command "${psCommand.replace(/\n/g, ' ')}"`, (error) => {
      if (error) resolve(`Failed to write to Notepad: ${error.message}`);
      else resolve(`Successfully opened Notepad and populated document (${content.length} characters).`);
    });
  });
}, {
  name: "write_notepad",
  description: "Draft text content or documents and automatically write & launch Notepad on the user's desktop.",
  schema: z.object({
    content: z.string().describe("Text or document content to write."),
    filename: z.string().optional().default("jarvis_document.txt")
  })
});

module.exports = { writeNotepadTool };
