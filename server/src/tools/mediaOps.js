const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const yts = require('yt-search');
const { exec } = require('child_process');

const searchMediaTool = tool(async ({ query }) => {
  try {
    const r = await yts(query);
    const videos = r.videos.slice(0, 5);
    if (!videos.length) return "No media results found for query: " + query;
    return videos.map((v, i) => `${i + 1}. [${v.timestamp}] ${v.title} by ${v.author.name} (URL: ${v.url})`).join("\n");
  } catch (e) {
    return `Error searching media: ${e.message}`;
  }
}, {
  name: "search_media",
  description: "Search YouTube for music, songs, or videos. Returns top 5 results with titles and URLs.",
  schema: z.object({ query: z.string().describe("Music / video search query.") })
});

const playMediaTool = tool(async ({ url }) => {
  return new Promise((resolve) => {
    let targetUrl = url;
    if (!/^https?:\/\//i.test(targetUrl)) targetUrl = 'https://' + targetUrl;
    const psCommand = `Start-Process '${targetUrl.replace(/'/g, "''")}'`;
    exec(`powershell -NoProfile -Command "${psCommand}"`, (error) => {
      resolve(error ? `Failed to launch media URL: ${error.message}` : `Successfully launched media playback for ${targetUrl}`);
    });
  });
}, {
  name: "play_media_url",
  description: "Play a specific YouTube / media URL in the browser.",
  schema: z.object({ url: z.string().describe("Exact video URL to launch.") })
});

module.exports = { searchMediaTool, playMediaTool };
