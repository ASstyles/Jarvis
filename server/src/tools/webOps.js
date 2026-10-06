const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { safeFetchText, vetTargetUrl } = require('../security/netProxy');
const { spawn } = require('child_process');

/**
 * Hardened Web Operations Tools
 * Strictly validates URLs and enforces SSRF protection.
 */

const searchWebTool = tool(async ({ query }) => {
  return new Promise((resolve) => {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    // Open URL safely via spawn without raw shell interpolation
    const proc = spawn('powershell.exe', ['-NoProfile', '-Command', 'Start-Process', searchUrl], {
      windowsHide: true
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(`Successfully launched web search for "${query}" in browser.`);
      } else {
        resolve(`Failed to open search (exit code ${code}).`);
      }
    });

    proc.on('error', (err) => {
      resolve(`Failed to open search: ${err.message}`);
    });
  });
}, {
  name: "search_web",
  description: "Search Google for a web query and open results in the default browser.",
  schema: z.object({ query: z.string().describe("Search query string.") })
});

const openUrlTool = tool(async ({ url }) => {
  try {
    let target = url.trim();
    if (!/^https?:\/\//i.test(target)) {
      target = 'https://' + target;
    }

    // SSRF validation before launching
    const vetted = vetTargetUrl(target);

    return new Promise((resolve) => {
      const proc = spawn('powershell.exe', ['-NoProfile', '-Command', 'Start-Process', vetted.href], {
        windowsHide: true
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(`Successfully opened ${vetted.href} in default browser.`);
        } else {
          resolve(`Failed to launch browser (exit code ${code}).`);
        }
      });

      proc.on('error', (err) => {
        resolve(`Failed to launch URL: ${err.message}`);
      });
    });
  } catch (err) {
    return `Security Refusal: ${err.message}`;
  }
}, {
  name: "open_url",
  description: "Open a verified public web page or URL directly in the browser.",
  schema: z.object({ url: z.string().describe("Target web address (e.g. google.com, github.com)") })
});

const webFetchTool = tool(async ({ url }) => {
  try {
    let target = url.trim();
    if (!/^https?:\/\//i.test(target)) {
      target = 'https://' + target;
    }

    // SSRF-guarded fetch
    const result = await safeFetchText(target, 5 * 1024 * 1024, 12000);

    // Sanitize basic HTML tags for text output
    const cleanText = result.text
      .replace(/<script\b[^<]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^<]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript\b[^<]*>[\s\S]*?<\/noscript>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .trim();

    const truncated = cleanText.substring(0, 3500) + (cleanText.length > 3500 ? "\n...[Content Truncated]" : "");
    return `[Fetched from ${result.finalUrl}]\n${truncated}`;
  } catch (e) {
    return `Error fetching web page (${e.code || 'E_FETCH'}): ${e.message}`;
  }
}, {
  name: "web_fetch",
  description: "Fetch and extract text content directly from a URL via SSRF-guarded proxy.",
  schema: z.object({ url: z.string().describe("The URL to fetch content from.") })
});

module.exports = { searchWebTool, openUrlTool, webFetchTool };
