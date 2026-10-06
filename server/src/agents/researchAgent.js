const modelRouter = require('../llm/modelRouter');
const { searchWebTool, webFetchTool, openUrlTool } = require('../tools/webOps');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');

class ResearchAgent {
  constructor() {
    this.tools = [searchWebTool, webFetchTool, openUrlTool];
  }

  async executeResearch(objective, contextStr = "") {
    console.log(`[RESEARCH_AGENT] Starting research on: "${objective}"`);

    const messages = [
      new SystemMessage(`You are the RESEARCH AGENT inside JARVIS.
Your objective: Gather accurate web research, extract content, validate findings, and compile a clear technical briefing or research report.
Available tools: search_web, web_fetch, open_url.
Return a structured summary of findings with source references if available.`),
      new HumanMessage(`Context:\n${contextStr}\n\nResearch Objective: ${objective}`)
    ];

    try {
      const response = await modelRouter.invokeWithFallback(messages, this.tools, 'fast', 0.2, { taskType: 'research' });
      return response.content || "Research completed cleanly.";
    } catch (err) {
      console.error("[RESEARCH_AGENT] Error:", err.message);
      return `Research execution encountered an error: ${err.message}`;
    }
  }
}

const researchAgent = new ResearchAgent();
module.exports = researchAgent;
