const http = require('http');
const WebSocket = require('ws');
const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const { vetTargetUrl } = require('../security/netProxy');

/**
 * Authenticated Chrome Browser Bridge
 *
 * Connects to the user's existing authenticated Google Chrome session via
 * Chrome DevTools Protocol (CDP) or native messaging bridge.
 * Serializes all actions through a FIFO queue to prevent racing.
 */

const DEFAULT_CDP_PORT = Number(process.env.CHROME_DEBUG_PORT || 9222);
const ACTION_TIMEOUT_MS = 25000;

class ChromeBridge {
  constructor(port = DEFAULT_CDP_PORT) {
    this.port = port;
    this.ws = null;
    this.activeTabWsUrl = null;
    this.actionQueue = Promise.resolve();
    this.messageId = 1;
    this.pendingCallbacks = new Map();
  }

  /**
   * Check if Chrome remote debugging endpoint is reachable.
   */
  async checkStatus() {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${this.port}/json/version`, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            resolve({
              connected: true,
              browser: data.Browser || 'Chrome',
              protocolVersion: data['Protocol-Version'],
              webSocketDebuggerUrl: data.webSocketDebuggerUrl
            });
          } catch (_) {
            resolve({ connected: false, error: 'Malformed response from Chrome port.' });
          }
        });
      });

      req.on('error', (err) => {
        resolve({
          connected: false,
          error: `Chrome remote debugging not detected on port ${this.port}. Start Chrome with '--remote-debugging-port=${this.port}'.`
        });
      });

      req.setTimeout(2500, () => {
        req.destroy();
        resolve({ connected: false, error: 'Connection to Chrome port timed out.' });
      });
    });
  }

  /**
   * Discovers the current active/foreground page tab in Chrome.
   */
  async getActiveTab() {
    return new Promise((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${this.port}/json/list`, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            const list = JSON.parse(raw);
            const pageTabs = list.filter(t => t.type === 'page');
            if (pageTabs.length === 0) return resolve(null);
            resolve(pageTabs[0]); // First tab is typically the active one
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', reject);
    });
  }

  /**
   * Connect to active tab's WebSocket debugger endpoint.
   */
  async ensureConnected() {
    const tab = await this.getActiveTab();
    if (!tab || !tab.webSocketDebuggerUrl) {
      throw new Error(`No active Chrome page tab found on port ${this.port}.`);
    }

    if (this.ws && this.activeTabWsUrl === tab.webSocketDebuggerUrl && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.ws) {
      try { this.ws.terminate(); } catch (_) {}
    }

    this.activeTabWsUrl = tab.webSocketDebuggerUrl;

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(tab.webSocketDebuggerUrl);
      const timer = setTimeout(() => {
        socket.terminate();
        reject(new Error('WebSocket connection to Chrome active tab timed out.'));
      }, 5000);

      socket.on('open', () => {
        clearTimeout(timer);
        this.ws = socket;

        socket.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.id && this.pendingCallbacks.has(msg.id)) {
              const { res, rej } = this.pendingCallbacks.get(msg.id);
              this.pendingCallbacks.delete(msg.id);
              if (msg.error) {
                rej(new Error(msg.error.message || JSON.stringify(msg.error)));
              } else {
                res(msg.result);
              }
            }
          } catch (_) {}
        });

        socket.on('close', () => {
          this.ws = null;
          this.activeTabWsUrl = null;
          this.pendingCallbacks.forEach(({ rej }) => rej(new Error('Chrome tab disconnected')));
          this.pendingCallbacks.clear();
        });

        resolve();
      });

      socket.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  /**
   * Executes a CDP method on the active tab, serializing through the action queue.
   */
  async sendCommand(method, params = {}, timeoutMs = ACTION_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      this.actionQueue = this.actionQueue.then(async () => {
        try {
          await this.ensureConnected();

          const id = this.messageId++;
          const payload = JSON.stringify({ id, method, params });

          const actionTimer = setTimeout(() => {
            if (this.pendingCallbacks.has(id)) {
              this.pendingCallbacks.delete(id);
              reject(new Error(`Chrome command ${method} timed out after ${timeoutMs}ms.`));
            }
          }, timeoutMs);

          this.pendingCallbacks.set(id, {
            res: (val) => { clearTimeout(actionTimer); resolve(val); },
            rej: (err) => { clearTimeout(actionTimer); reject(err); }
          });

          this.ws.send(payload);
        } catch (err) {
          reject(err);
        }
      }).catch(reject);
    });
  }

  // --- Browser Actions ---

  async navigate(url) {
    const vetted = vetTargetUrl(url);
    await this.sendCommand('Page.navigate', { url: vetted.href });
    return `Navigated active tab to ${vetted.href}`;
  }

  async screenshot() {
    const result = await this.sendCommand('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
    return result?.data; // Base64 JPEG data
  }

  async extractContent() {
    const doc = await this.sendCommand('Runtime.evaluate', {
      expression: `document.title + '\\n\\n' + (document.body ? document.body.innerText.substring(0, 4000) : '')`,
      returnByValue: true
    });
    return doc?.result?.value || 'No content found.';
  }

  async click(x, y) {
    await this.sendCommand('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this.sendCommand('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    return `Clicked at (${x}, ${y})`;
  }

  async type(text) {
    for (const char of text) {
      await this.sendCommand('Input.dispatchKeyEvent', { type: 'keyDown', text: char });
      await this.sendCommand('Input.dispatchKeyEvent', { type: 'keyUp', text: char });
    }
    return `Typed: "${text}"`;
  }
}

const chromeBridge = new ChromeBridge();

// --- LangChain Tools for Chrome Bridge ---

const chromeStatusTool = tool(async () => {
  const status = await chromeBridge.checkStatus();
  return JSON.stringify(status, null, 2);
}, {
  name: "chrome_status",
  description: "Check if the user's existing authenticated Google Chrome browser is reachable.",
  schema: z.object({})
});

const chromeNavigateTool = tool(async ({ url }) => {
  try {
    return await chromeBridge.navigate(url);
  } catch (err) {
    return `Chrome Navigate Error: ${err.message}`;
  }
}, {
  name: "chrome_navigate",
  description: "Navigate the user's authenticated Chrome browser to a verified URL.",
  schema: z.object({ url: z.string().describe("Target URL to open.") })
});

const chromeScreenshotTool = tool(async () => {
  try {
    const b64 = await chromeBridge.screenshot();
    if (!b64) return "Failed to capture Chrome screenshot.";
    return `[Screenshot captured: ${Math.round(b64.length / 1024)} KB base64 payload]`;
  } catch (err) {
    return `Chrome Screenshot Error: ${err.message}`;
  }
}, {
  name: "chrome_screenshot",
  description: "Capture a screenshot of the active tab in the user's authenticated Chrome session.",
  schema: z.object({})
});

const chromeContentTool = tool(async () => {
  try {
    return await chromeBridge.extractContent();
  } catch (err) {
    return `Chrome Content Error: ${err.message}`;
  }
}, {
  name: "chrome_content",
  description: "Read the title and text content of the active tab in the user's authenticated Chrome session.",
  schema: z.object({})
});

module.exports = {
  chromeBridge,
  chromeStatusTool,
  chromeNavigateTool,
  chromeScreenshotTool,
  chromeContentTool
};
