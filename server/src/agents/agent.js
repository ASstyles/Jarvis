/**
 * JARVIS Agent Interface Adapter
 * Provides backward-compatible entrypoints (runAgent, runAgenticTask) routing directly to Orchestrator.
 */

const orchestrator = require('./orchestrator');

async function runAgent(input) {
  const result = await orchestrator.processUserRequest(input);
  return result.text;
}

async function runAgenticTask(input, context = {}) {
  return await orchestrator.processUserRequest(input, context);
}

module.exports = {
  runAgent,
  runAgenticTask
};
