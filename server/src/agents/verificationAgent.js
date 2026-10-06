const modelRouter = require('../llm/modelRouter');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');

/**
 * Verification Agent
 *
 * Provides rigorous, multi-layered verification of execution results:
 * - Status codes: PASS, FAIL, INCONCLUSIVE.
 * - NEVER interprets verifier failures, timeouts, or parse errors as success.
 * - Combines deterministic criteria with semantic verification.
 */

const VERIFICATION_STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  INCONCLUSIVE: 'INCONCLUSIVE'
};

class VerificationAgent {
  /**
   * Deterministic pre-check for obvious failures or tool error signatures.
   */
  runDeterministicChecks(resultText) {
    if (!resultText || typeof resultText !== 'string' || resultText.trim().length === 0) {
      return {
        matched: true,
        status: VERIFICATION_STATUS.FAIL,
        confidenceScore: 1.0,
        notes: 'Deterministic failure: Result is empty or undefined.'
      };
    }

    const lower = resultText.toLowerCase();
    const hardFailurePatterns = [
      'command execution failed',
      'error: command failed',
      'syntaxerror:',
      'referenceerror:',
      'typeerror:',
      'uncaught exception',
      'traceback (most recent call last):',
      'ssrf refusal:',
      'access denied: path'
    ];

    for (const pat of hardFailurePatterns) {
      if (lower.includes(pat)) {
        return {
          matched: true,
          status: VERIFICATION_STATUS.FAIL,
          confidenceScore: 0.95,
          notes: `Deterministic failure pattern detected: "${pat}"`
        };
      }
    }

    return { matched: false };
  }

  async verifyResult(objective, resultText, contextStr = "") {
    console.log(`[VERIFICATION_AGENT] Evaluating objective: "${objective}"`);

    // 1. Run deterministic checks first
    const det = this.runDeterministicChecks(resultText);
    if (det.matched) {
      return {
        status: det.status,
        isSatisfied: det.status === VERIFICATION_STATUS.PASS,
        confidenceScore: det.confidenceScore,
        verificationNotes: det.notes,
        remediationPlan: 'Inspect execution error output and retry with corrective arguments.'
      };
    }

    const messages = [
      new SystemMessage(`You are the VERIFICATION AGENT inside JARVIS.
Critically evaluate whether the execution output satisfies the objective.
You must respond ONLY with structured JSON matching this schema:
{
  "status": "PASS" | "FAIL" | "INCONCLUSIVE",
  "isSatisfied": boolean,
  "confidenceScore": number (0.0 to 1.0),
  "verificationNotes": "Precise explanation of what was verified or what is missing",
  "remediationPlan": "Actionable steps if FAIL or INCONCLUSIVE, or null if PASS"
}`),
      new HumanMessage(`Objective: ${objective}

Execution Result:
${resultText}

Context:
${contextStr}`)
    ];

    try {
      const response = await modelRouter.invokeWithFallback(messages, [], 'fast', 0.1, { taskType: 'verification' });
      const raw = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        let status = String(parsed.status || '').toUpperCase();
        if (![VERIFICATION_STATUS.PASS, VERIFICATION_STATUS.FAIL, VERIFICATION_STATUS.INCONCLUSIVE].includes(status)) {
          status = parsed.isSatisfied ? VERIFICATION_STATUS.PASS : VERIFICATION_STATUS.FAIL;
        }

        const isPass = status === VERIFICATION_STATUS.PASS;
        modelRouter.recordVerificationOutcome(isPass);

        return {
          status,
          isSatisfied: isPass,
          confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : (isPass ? 0.9 : 0.4),
          verificationNotes: parsed.verificationNotes || 'Semantic verification complete.',
          remediationPlan: parsed.remediationPlan || null
        };
      }

      // If response could not be parsed as JSON, DO NOT mark as satisfied!
      console.warn("[VERIFICATION_AGENT] Model output did not contain valid JSON. Marking INCONCLUSIVE.");
      return {
        status: VERIFICATION_STATUS.INCONCLUSIVE,
        isSatisfied: false,
        confidenceScore: 0.3,
        verificationNotes: `Verification output unparseable. Raw response: ${raw.substring(0, 150)}...`,
        remediationPlan: 'Re-verify with clearer output format or inspect execution artifact directly.'
      };
    } catch (err) {
      // Under NO circumstances should an error in the verifier become a PASS!
      console.error("[VERIFICATION_AGENT] Verification invocation failed:", err.message);
      return {
        status: VERIFICATION_STATUS.INCONCLUSIVE,
        isSatisfied: false,
        confidenceScore: 0.0,
        verificationNotes: `Verification pipeline error: ${err.message}`,
        remediationPlan: 'Verification unavailable. Manual confirmation or retry required.'
      };
    }
  }
}

const verificationAgent = new VerificationAgent();
module.exports = verificationAgent;
module.exports.VERIFICATION_STATUS = VERIFICATION_STATUS;
