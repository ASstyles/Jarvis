const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { exec } = require('child_process');

const manageProcessTool = tool(async ({ action, processName }) => {
    return new Promise(resolve => {
        let cmd = '';
        if(action === 'kill') cmd = `powershell -Command "Stop-Process -Name '${processName}' -Force"`;
        if(action === 'list') cmd = `powershell -Command "Get-Process | Sort-Object CPU -Descending | Select-Object -First 10 ProcessName, CPU | ConvertTo-Json"`;
        exec(cmd, (err, stdout) => resolve(err ? `Error: ${err.message}` : action === 'list' ? `Top Processes:\n${stdout}` : `Successfully killed process ${processName}`));
    });
}, { 
    name: "manage_processes", 
    description: "Kill a process by name, or list the top CPU heavy processes.", 
    schema: z.object({ action: z.enum(['kill', 'list']), processName: z.string().optional() }) 
});

const readActiveWindowTool = tool(async () => {
    const ps = `Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    public class Win32 {
        [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
    }
"@;
    $hwnd = [Win32]::GetForegroundWindow();
    $sb = New-Object System.Text.StringBuilder 256;
    if ([Win32]::GetWindowText($hwnd, $sb, 256) -gt 0) { $sb.ToString() } else { "Unknown" }`;
    
    return new Promise(resolve => exec(`powershell -NoProfile -Command "${ps.replace(/\n/g, '')}"`, (err, stdout) => resolve(err ? err.message : `Active Window Title: ${stdout.trim()}`)));
}, { 
    name: "read_active_window", 
    description: "Get the exact title of the currently focused application/window on the user's screen.", 
    schema: z.object({}) 
});

module.exports = { manageProcessTool, readActiveWindowTool };
