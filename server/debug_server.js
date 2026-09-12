const { spawn } = require('child_process');
const path = require('path');

const server = spawn('node', ['src/index.js'], { cwd: __dirname, env: { ...process.env, PORT: 4001 } });

server.stdout.on('data', data => process.stdout.write('SERVER OUT: ' + data.toString()));
server.stderr.on('data', data => process.stdout.write('SERVER ERR: ' + data.toString()));

setTimeout(async () => {
   console.log("SENDING CAPTURE REQUEST...");
   try {
     let abort = new AbortController();
     setTimeout(() => abort.abort(), 10000);
     const res = await fetch("http://localhost:4001/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "what all can u do?" }),
        signal: abort.signal
     });
     console.log("FETCH DONE", res.status);
   } catch(e) {
     console.log("FETCH FAIL:", e.message);
   }
   server.kill();
}, 2000);
