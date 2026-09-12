const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { exec } = require('child_process');

const systemVolumeTool = tool(async ({ level }) => {
    // Rough estimation using 50 ticks of MediaKeys for volume down to 0, then raising by steps.
    const steps = Math.round(level / 2);
    const ps = `
    $sc = New-Object -ComObject WScript.Shell;
    for($i=0; $i -lt 50; $i++) { $sc.SendKeys([char]174) };
    for($i=0; $i -lt ${steps}; $i++) { $sc.SendKeys([char]175) };
    `;
    return new Promise(resolve => exec(`powershell -NoProfile -Command "${ps.replace(/\n/g, '')}"`, (err) => resolve(err ? err.message : `Volume successfully set to approx ${level}%`)));
}, { 
    name: "system_volume_control", 
    description: "Set system volume (0-100).", 
    schema: z.object({ level: z.number().min(0).max(100) }) 
});

const systemPowerTool = tool(async ({ command }) => {
    return new Promise(resolve => {
        let cmd = '';
        if (command === 'lock') cmd = 'rundll32.exe user32.dll,LockWorkStation';
        if (command === 'sleep') cmd = 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0';
        if (cmd) exec(cmd, err => resolve(err ? err.message : `System executed power state: ${command}`));
        else resolve("Unsupported command");
    });
}, { 
    name: "system_power_state", 
    description: "Change the laptop's physical power state. Only use if explicitly requested.", 
    schema: z.object({ command: z.enum(['lock', 'sleep']) }) 
});

module.exports = { systemVolumeTool, systemPowerTool };
