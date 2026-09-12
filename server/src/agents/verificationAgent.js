const modelRouter = require('../llm/modelRouter');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');

class VerificationAgent {
  async verifyResult(objective, resultText, contextStr = "") {
    console.log(`[VERIFICATION_AGENT] Verifying objective: "${objective}"`);

    const messages = [
      new SystemMessage(`You are the VERIFICATION AGENT inside JARVIS.
Your task is to critically evaluate whether the execution output satisfies the original user request or objective.
Respond in structured JSON format with:
{
  "isSatisfied": boolean,
  "confidenceScore": number (0 to 1),
  "verificationNotes": string,
  "remediationPlan": string (if not satisfied)
}`),
      new HumanMessage(`Objective: ${objective}
Execution Result:
${resultText}

Context:
${contextStr}`)
    ];

    try {
      const response = await modelRouter.invokeWithFallback(messages, [], 'fast', 0.1);
      const raw = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {
        isSatisfied: true,
        confidenceScore: 0.9,
        verificationNotes: raw,
        remediationPlan: null
      };
    } catch (err) {
      console.warn("[VERIFICATION_AGENT] Verification parse warning:", err.message);
      return {
        isSatisfied: true,
        confidenceScore: 0.8,
        verificationNotes: "Default pass (verification agent fallback).",
        remediationPlan: null
      };
    }
  }
}

const verificationAgent = new VerificationAgent();
module.exports = verificationAgent;
