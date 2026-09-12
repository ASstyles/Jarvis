require('dotenv').config();
const { runAgenticTask } = require('./src/agents/agent');

(async () => {
    try {
        console.log("SENDING: Save memory that my favorite color is crimson.");
        const res1 = await runAgenticTask("Save memory that my favorite color is crimson.");
        console.log("REPLY 1:", res1.text);
        
        console.log("\nSENDING: Recall my favorite color.");
        const res2 = await runAgenticTask("Recall my favorite color.");
        console.log("REPLY 2:", res2.text);
        
        console.log("\nSENDING: Read the first 50 chars of package.json");
        const res3 = await runAgenticTask("Read package.json from this folder. DO NOT output the whole thing, just summarize the first 50 characters.");
        console.log("REPLY 3:", res3.text);
    } catch(e) {
        console.error("FAIL:", e);
    }
})();
