const fs = require('fs');
const { exec } = require('child_process');

const content = "This is a test document.\nIt has multiple lines.\n1234567890 !@#$%^&*()";
const tempPath = require('path').join(require('os').tmpdir(), 'jarvis_notepad.txt');
fs.writeFileSync(tempPath, content);

const psCommand = `
    $old = Get-Clipboard;
    Set-Clipboard -Value (Get-Content -Raw -Path '${tempPath}');
    Start-Process notepad;
    Start-Sleep -m 600;
    Add-Type -AssemblyName System.Windows.Forms;
    [System.Windows.Forms.SendKeys]::SendWait('^v');
    Start-Sleep -m 200;
    if ($old) { Set-Clipboard -Value $old } else { Set-Clipboard -Value '' };
`;

exec(`powershell -NoProfile -Command "${psCommand.replace(/\n/g, ' ')}"`, (err) => {
    if(err) console.error("Error", err.message);
    else console.log("Done");
});
