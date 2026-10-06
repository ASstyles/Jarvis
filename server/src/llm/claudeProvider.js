const { BaseModelProvider } = require('./modelProvider');
const { AIMessage } = require('@langchain/core/messages');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Anthropic Claude & Claude Code Model Provider
 *
 * Reuses existing Claude Code login credentials or ANTHROPIC_API_KEY.
 * Converts LangChain message structures into Anthropic Messages API format and back.
 */
class ClaudeProvider extends BaseModelProvider {
  constructor(options = {}) {
    super('claude', options);
    this.primaryModel = process.env.JARVIS_CLAUDE_MODEL || process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";
    this.apiKey = this.resolveApiKey();
    this.client = null;

    if (this.apiKey) {
      try {
        const { Anthropic } = require('@anthropic-ai/sdk');
        this.client = new Anthropic({ apiKey: this.apiKey });
      } catch (err) {
        console.warn(`[CLAUDE_PROVIDER] Anthropic SDK initialization notice: ${err.message}`);
      }
    }
  }

  resolveApiKey() {
    if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;

    // Check Claude Code credentials in ~/.claude.json
    try {
      const claudeCfgPath = path.join(os.homedir(), '.claude.json');
      if (fs.existsSync(claudeCfgPath)) {
        const cfg = JSON.parse(fs.readFileSync(claudeCfgPath, 'utf8'));
        if (cfg.apiKey) return cfg.apiKey;
        if (cfg.mcpServers?.anthropic?.env?.ANTHROPIC_API_KEY) {
          return cfg.mcpServers.anthropic.env.ANTHROPIC_API_KEY;
        }
      }
    } catch (_) {}

    return null;
  }

  isAvailable() {
    return Boolean(this.client);
  }

  formatMessagesForAnthropic(messages) {
    let system = '';
    const anthropicMessages = [];

    for (const msg of messages) {
      const type = msg._getType ? msg._getType() : (msg.role || 'user');
      const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);

      if (type === 'system') {
        system += (system ? '\n\n' : '') + text;
      } else if (type === 'human' || type === 'user') {
        anthropicMessages.push({ role: 'user', content: text });
      } else if (type === 'ai' || type === 'assistant') {
        anthropicMessages.push({ role: 'assistant', content: text });
      } else if (type === 'tool') {
        anthropicMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.tool_call_id || 'tool_call_1',
              content: text
            }
          ]
        });
      }
    }

    return { system, messages: anthropicMessages };
  }

  formatToolsForAnthropic(tools) {
    if (!tools || !tools.length) return undefined;

    return tools.map(t => {
      const toolObj = {
        name: t.name,
        description: t.description || `Tool: ${t.name}`,
        input_schema: {
          type: 'object',
          properties: {},
          required: []
        }
      };

      if (t.schema && t.schema._def) {
        // Simple shape extraction from zod
        try {
          const shape = t.schema._def.shape ? t.schema._def.shape() : {};
          for (const [k, v] of Object.entries(shape)) {
            toolObj.input_schema.properties[k] = {
              type: 'string',
              description: v.description || k
            };
          }
        } catch (_) {}
      }

      return toolObj;
    });
  }

  async invoke(messages, tools = [], options = {}) {
    if (!this.client) {
      throw new Error('ClaudeProvider: Anthropic client is not initialized or API key is missing.');
    }

    const modelName = options.model || this.primaryModel;
    const { system, messages: formattedMessages } = this.formatMessagesForAnthropic(messages);
    const formattedTools = this.formatToolsForAnthropic(tools);

    const payload = {
      model: modelName,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.2,
      messages: formattedMessages
    };

    if (system) payload.system = system;
    if (formattedTools && formattedTools.length > 0) payload.tools = formattedTools;

    const response = await this.client.messages.create(payload);

    // Extract text content and any tool calls
    let textContent = '';
    const toolCalls = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          args: block.input
        });
      }
    }

    const aiMessage = new AIMessage({
      content: textContent,
      tool_calls: toolCalls
    });

    return aiMessage;
  }
}

module.exports = { ClaudeProvider };
