require('dotenv').config({ path: '.env' });
const { runAgenticTask } = require('./src/agents/agent');

(async () => {
    try {
        console.log("SENDING: what all can u do?");
        const res1 = await runAgenticTask("what all can u do?");
        console.log("REPLY:", res1.text);
    } catch(e) {
        console.error("FAIL:", e);
    }
})();
