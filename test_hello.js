require('dotenv').config({ path: './server/.env' });
const { runAgenticTask } = require('./server/src/agents/agent');

(async () => {
    try {
        console.log("SENDING: Hello API");
        const res1 = await runAgenticTask("Hello API");
        console.log("REPLY:", res1.text);
    } catch(e) {
        console.error("FAIL:", e);
    }
})();
