const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const { capabilityPolicy } = require('../security/capabilityPolicy');

/**
 * Generic MCP (Model Context Protocol) Manager
 *
 * Discovers servers in ~/.claude.json, manages stdio MCP child processes,
 * converts remote MCP tools into standard LangChain tools, and registers them.
 */

class StdioMcpClient {
  constructor(serverId, config) {
    this.serverId = serverId;
    this.config = config;
    this.proc = null;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = '';
    this.tools = [];
    this.isReady = false;
  }

  async start() {
    const { command, args = [], env = {} } = this.config;
    if (!command) throw new Error(`MCP server "${this.serverId}" missing "command" property.`);

    const mergedEnv = {
      ...process.env,
      ...env
    };

    return new Promise((resolve, reject) => {
      try {
        this.proc = spawn(command, args, {
          env: mergedEnv,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true
        });
      } catch (err) {
        return reject(err);
      }

      this.proc.stdout.on('data', (chunk) => this.handleData(chunk));
      this.proc.stderr.on('data', (chunk) => {
        const errText = chunk.toString('utf8');
        if (process.env.DEBUG_MCP) {
          console.warn(`[MCP:${this.serverId}:STDERR]`, errText.trim());
        }
      });

      this.proc.on('close', (code) => {
        this.isReady = false;
        this.pending.forEach(({ reject }) => reject(new Error(`MCP server ${this.serverId} closed (${code})`)));
        this.pending.clear();
      });

      this.proc.on('error', (err) => {
        this.isReady = false;
        reject(err);
      });

      // Send JSON-RPC initialize
      this.call('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'jarvis-mcp-client', version: '3.0.0' }
      }).then(() => {
        return this.sendNotification('notifications/initialized', {});
      }).then(() => {
        return this.listTools();
      }).then(tools => {
        this.tools = tools;
        this.isReady = true;
        resolve(this);
      }).catch(reject);
    });
  }

  handleData(chunk) {
    this.buffer += chunk.toString('utf8');
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) {
            reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          } else {
            resolve(msg.result);
          }
        }
      } catch (_) {}
    }
  }

  call(method, params = {}, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      if (!this.proc || this.proc.killed) {
        return reject(new Error(`MCP server ${this.serverId} is not running.`));
      }

      const id = this.nextId++;
      const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';

      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`MCP request ${method} to ${this.serverId} timed out.`));
        }
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (val) => { clearTimeout(timer); resolve(val); },
        reject: (err) => { clearTimeout(timer); reject(err); }
      });

      this.proc.stdin.write(payload);
    });
  }

  sendNotification(method, params = {}) {
    if (!this.proc || this.proc.killed) return;
    const payload = JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n';
    this.proc.stdin.write(payload);
  }

  async listTools() {
    const res = await this.call('tools/list', {});
    return res?.tools || [];
  }

  async callTool(name, args = {}) {
    const res = await this.call('tools/call', { name, arguments: args });
    if (!res || !res.content) return 'No content returned from MCP tool.';

    return res.content.map(c => {
      if (c.type === 'text') return c.text;
      if (c.type === 'image') return `[Image: ${c.mimeType || 'image/png'}, ${c.data?.length || 0} bytes]`;
      return JSON.stringify(c);
    }).join('\n');
  }

  stop() {
    if (this.proc && !this.proc.killed) {
      try { this.proc.kill('SIGTERM'); } catch (_) {}
    }
  }
}

class McpManager {
  constructor() {
    this.clients = new Map();
    this.registeredTools = [];
  }

  /**
   * Discover MCP server configs from ~/.claude.json
   */
  discoverConfigs() {
    try {
      const claudeJsonPath = path.join(os.homedir(), '.claude.json');
      if (!fs.existsSync(claudeJsonPath)) return {};

      const raw = fs.readFileSync(claudeJsonPath, 'utf8');
      const cfg = JSON.parse(raw);

      return {
        ...(cfg.mcpServers || {}),
        ...(cfg.projects?.[os.homedir()]?.mcpServers || {})
      };
    } catch (err) {
      console.warn(`[MCP_DISCOVERY] Could not parse ~/.claude.json: ${err.message}`);
      return {};
    }
  }

  /**
   * Initialize and start configured MCP servers
   */
  async initializeServers() {
    const configs = this.discoverConfigs();
    const serverIds = Object.keys(configs);
    console.log(`[MCP_MANAGER] Discovered ${serverIds.length} MCP servers in Claude configuration.`);

    const generatedTools = [];

    for (const id of serverIds) {
      const config = configs[id];
      // Only stdio supported in local process manager
      if (!config.command) continue;

      try {
        const client = new StdioMcpClient(id, config);
        await client.start();
        this.clients.set(id, client);
        console.log(`[MCP_SERVER:${id}] Online. Found ${client.tools.length} tools.`);

        // Convert MCP tools to LangChain tools
        for (const mcpToolDef of client.tools) {
          const toolInstance = this.createLangChainTool(id, mcpToolDef, client);
          generatedTools.push(toolInstance);
        }
      } catch (err) {
        console.warn(`[MCP_SERVER:${id}] Could not initialize: ${err.message}`);
      }
    }

    this.registeredTools = generatedTools;
    return generatedTools;
  }

  createLangChainTool(serverId, mcpToolDef, client) {
    const toolName = `mcp__${serverId}__${mcpToolDef.name}`;
    const desc = mcpToolDef.description || `MCP tool ${mcpToolDef.name} from server ${serverId}`;

    // Simple schema creation from properties
    const schemaObj = z.record(z.any()).describe("Tool arguments");

    return tool(async (args) => {
      try {
        return await client.callTool(mcpToolDef.name, args || {});
      } catch (err) {
        return `MCP Tool Error (${toolName}): ${err.message}`;
      }
    }, {
      name: toolName,
      description: desc,
      schema: schemaObj
    });
  }

  getTools() {
    return this.registeredTools;
  }

  stopAll() {
    this.clients.forEach(c => c.stop());
    this.clients.clear();
  }
}

const mcpManager = new McpManager();
module.exports = { mcpManager, StdioMcpClient };
