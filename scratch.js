require('dotenv').config({ path: './server/.env' });
const { runAgenticTask } = require('./server/src/agents/agent');

(async () => {
  try {
    const res = await runAgenticTask("Hello", []);
    console.log("SUCCESS:", res);
  } catch (err) {
    console.error("FAIL:", err.message);
  }
})();
