const fs = require('fs');
const { exec } = require('child_process');

const content = "Testing the final v3 block...";
const tempPath = require('path').join(require('os').tmpdir(), 'jarvis_notepad.txt');
fs.writeFileSync(tempPath, content);

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

console.log("EXEC:\n" + psCommand);

exec(`powershell -NoProfile -Command "${psCommand.replace(/\n/g, ' ')}"`, (err) => {
    if(err) console.error("Error", err.message);
    else console.log("Done");
});
