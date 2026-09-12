const { tool } = require("@langchain/core/tools");
const { z } = require("zod");

const launchGameverseGameTool = tool(async ({ gameId, difficulty = "MEDIUM" }) => {
  const gameNames = {
    "jarvis-command": "JARVIS Command (Tactical Defense)",
    "neural-rush": "Neural Rush (Reaction Survival Runner)",
    "cyber-heist": "Cyber Heist (Stealth Security Puzzle)",
    "ai-arena": "AI Arena (Top-Down Shooter)",
    "codebreak": "Codebreak (Interactive Circuit Puzzle)",
    "void-runner": "Void Runner (Endless Space Flight)",
    "jarvis-tactics": "JARVIS Tactics (Turn-Based Strategy)",
    "boss-protocol": "Boss Protocol (Showcase Boss Battle)"
  };

  const name = gameNames[gameId] || gameId;
  return `[GAMEVERSE_LAUNCH] Initializing Gameverse Launcher for '${name}' on difficulty [${difficulty}]. Systems ready for player input.`;
}, {
  name: "launch_gameverse_game",
  description: "Launch a specific game inside the JARVIS Gameverse platform.",
  schema: z.object({
    gameId: z.enum([
      "jarvis-command",
      "neural-rush",
      "cyber-heist",
      "ai-arena",
      "codebreak",
      "void-runner",
      "jarvis-tactics",
      "boss-protocol"
    ]).describe("Unique identifier of the game to launch."),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD", "NIGHTMARE"]).optional().default("MEDIUM").describe("Target difficulty setting.")
  })
});

module.exports = {
  launchGameverseGameTool
};
