/**
 * Universal Model Provider Interface
 *
 * Defines the standard contract for any LLM provider (Gemini, Claude, local models).
 */

class BaseModelProvider {
  constructor(name, options = {}) {
    this.name = name;
    this.options = options;
  }

  /**
   * Check if provider is configured and credentials/SDK are available.
   * @returns {boolean}
   */
  isAvailable() {
    return false;
  }

  /**
   * Invoke the model with messages and bound tools.
   * @param {Array} messages - LangChain or standardized messages array.
   * @param {Array} tools - Array of executable tools.
   * @param {Object} options - Invocation options (temperature, maxTokens, etc.).
   * @returns {Promise<Object>} - Standardized model response with content, tool_calls, tokens.
   */
  async invoke(messages, tools = [], options = {}) {
    throw new Error(`invoke() must be implemented by ${this.name} provider.`);
  }

  /**
   * Stream output from the model.
   * @param {Array} messages
   * @param {Array} tools
   * @param {Object} options
   * @returns {AsyncGenerator<string>}
   */
  async *stream(messages, tools = [], options = {}) {
    throw new Error(`stream() must be implemented by ${this.name} provider.`);
  }
}

module.exports = { BaseModelProvider };
