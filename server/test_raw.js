require('dotenv').config({ path: '.env' });
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
(async () => {
  try {
    const llm = new ChatGoogleGenerativeAI({
      model: "gemini-flash-latest",
      apiKey: process.env.GEMINI_API_KEY,
      maxRetries: 0
    });
    console.log("SENDING RAW...");
    const res = await llm.invoke("what all can u do?");
    console.log("RES:", res.content);
  } catch(e) {
    console.error("FAIL:", e.message);
  }
})();
