const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { exec } = require('child_process');

const searchWebTool = tool(async ({ query }) => {
  return new Promise((resolve) => {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    const psCommand = `Start-Process '${searchUrl.replace(/'/g, "''")}'`;
    exec(`powershell -NoProfile -Command "${psCommand}"`, (error) => {
      if (error) resolve(`Failed to open search: ${error.message}`);
      else resolve(`Successfully launched web search for "${query}" in browser.`);
    });
  });
}, {
  name: "search_web",
  description: "Search Google for a web query and open results in the user's default browser.",
  schema: z.object({ query: z.string().describe("Search query string.") })
});

const openUrlTool = tool(async ({ url }) => {
  return new Promise((resolve) => {
    let targetUrl = url;
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }
    const psCommand = `Start-Process '${targetUrl.replace(/'/g, "''")}'`;
    exec(`powershell -NoProfile -Command "${psCommand}"`, (error) => {
      if (error) resolve(`Failed to launch URL: ${error.message}`);
      else resolve(`Successfully opened ${targetUrl} in default browser.`);
    });
  });
}, {
  name: "open_url",
  description: "Open any web page or URL directly in the user's browser.",
  schema: z.object({ url: z.string().describe("Target web address (e.g. google.com, github.com)") })
});

const webFetchTool = tool(async ({ url }) => {
  try {
    let targetUrl = url;
    if (!/^https?:\/\//i.test(targetUrl)) targetUrl = 'https://' + targetUrl;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(id);

    if (!response.ok) return `Fetch failed with status: ${response.status} ${response.statusText}`;

    const text = await response.text();
    // Basic strip tags to get readable text
    const cleanText = text
      .replace(/<script\b[^<]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^<]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleanText.substring(0, 3000) + (cleanText.length > 3000 ? "\n...[Content Truncated]" : "");
  } catch (e) {
    return `Error fetching web page: ${e.message}`;
  }
}, {
  name: "web_fetch",
  description: "Fetch and extract text content directly from a URL (silent web fetch for research).",
  schema: z.object({ url: z.string().describe("The URL to fetch content from.") })
});

module.exports = { searchWebTool, openUrlTool, webFetchTool };
