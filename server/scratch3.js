const { exec } = require('child_process');
const url = "https://www.youtube.com/watch?v=JGwWNGJdvx8";

exec(`explorer "${url}"`, (err, stdout, stderr) => {
    console.log("Explorer result:");
    console.log({ err: err ? err.message : null, stdout, stderr });
});
