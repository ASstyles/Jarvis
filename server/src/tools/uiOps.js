const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const EventEmitter = require('events');

/**
 * Agent-Controlled JARVIS UI & Blade Tools
 *
 * Exposes strictly validated schema-governed tools for the AI to drive:
 * - Theme, accent, background
 * - 3D Reactor core shape, scale, intensity, spin, style
 * - Orbiting assets
 * - UI chrome & rails visibility
 * - Visual effects (glitch, pulse, scan, shake, flash)
 * - HUD display panels
 * - Interactive Blade content surfaces
 */

class UiEventManager extends EventEmitter {
  emitDirective(op, args) {
    this.emit('UI_COMMAND', { op, args, timestamp: new Date().toISOString() });
  }

  emitBlade(bladeData) {
    this.emit('BLADE_EVENT', { ...bladeData, timestamp: new Date().toISOString() });
  }
}

const uiEvents = new UiEventManager();

// 1. Theme control tool
const uiThemeTool = tool(async ({ accent, background, phase_colors }) => {
  uiEvents.emitDirective('setTheme', { accent, background, phase_colors });
  return `Interface theme updated: accent=${accent || 'auto'}, background=${background || 'auto'}`;
}, {
  name: "ui_theme",
  description: "Retint the whole interface with purposeful color meaning (e.g. red alert, blue analytical, cyan operational).",
  schema: z.object({
    accent: z.string().optional().describe("CSS color overriding phase color everywhere (e.g. '#00f0ff', '#ef4444', 'auto')."),
    background: z.string().optional().describe("Dark background tint (e.g. '#080d18', '#150808', 'auto')."),
    phase_colors: z.record(z.string()).optional().describe("Color map for specific states (listening, thinking, speaking).")
  })
});

// 2. Reactor control tool
const uiReactorTool = tool(async ({ color, scale, intensity, spin, style, visible }) => {
  uiEvents.emitDirective('setReactor', { color, scale, intensity, spin, style, visible });
  return `3D Reactor updated: style=${style || 'ring'}, scale=${scale ?? 1}, intensity=${intensity ?? 1}, spin=${spin ?? 1}`;
}, {
  name: "ui_reactor",
  description: "Reshape and modulate the 3D Holographic Reactor (scale, glow intensity, rotation speed, style).",
  schema: z.object({
    color: z.string().optional().describe("Reactor core color (hex/rgb/css)."),
    scale: z.number().min(0.2).max(3).optional().describe("Size multiplier 0.2 to 3.0 (default 1.0)."),
    intensity: z.number().min(0).max(3).optional().describe("Glow and brightness 0 to 3.0 (default 1.0)."),
    spin: z.number().min(0).max(5).optional().describe("Rotation speed multiplier 0 to 5.0 (default 1.0)."),
    style: z.enum(['ring', 'sphere', 'wire']).optional().describe("Geometry style: ring (arc halo), sphere (solid core), wire (diagnostic lattice)."),
    visible: z.boolean().optional().describe("Whether reactor is visible.")
  })
});

// 3. Orbit assets tool
const uiOrbitTool = tool(async ({ items = [] }) => {
  uiEvents.emitDirective('setOrbit', { items });
  return `Orbiting assets updated (${items.length} items).`;
}, {
  name: "ui_orbit",
  description: "Place images or media assets in a 3D holographic orbit around the reactor.",
  schema: z.object({
    items: z.array(z.object({
      id: z.string().optional(),
      url: z.string().describe("Image or media URL to orbit."),
      title: z.string().optional().describe("Short label.")
    })).describe("Array of visual assets to orbit.")
  })
});

// 4. UI Chrome visibility tool
const uiChromeTool = tool(async ({ rails, transcript, badges }) => {
  uiEvents.emitDirective('setChrome', { rails, transcript, badges });
  return `UI chrome visibility updated.`;
}, {
  name: "ui_chrome",
  description: "Show or hide UI rails, transcript panels, and system badges for full-immersion view.",
  schema: z.object({
    rails: z.boolean().optional().describe("Show/hide navigation rails and sidebars."),
    transcript: z.boolean().optional().describe("Show/hide conversational transcript."),
    badges: z.boolean().optional().describe("Show/hide system status badges.")
  })
});

// 5. Visual effect flourish tool
const uiEffectTool = tool(async ({ effect }) => {
  uiEvents.emitDirective('setEffect', { effect });
  return `Visual flourish effect triggered: ${effect}`;
}, {
  name: "ui_effect",
  description: "Trigger a brief visual flourish: glitch, pulse, scan, shake, or flash.",
  schema: z.object({
    effect: z.enum(['glitch', 'pulse', 'scan', 'shake', 'flash']).describe("Effect type.")
  })
});

// 6. UI Reset tool
const uiResetTool = tool(async () => {
  uiEvents.emitDirective('reset', {});
  return `Interface restored to default cybernetic state.`;
}, {
  name: "ui_reset",
  description: "Reset theme, reactor, and HUD layout back to standard defaults.",
  schema: z.object({})
});

// 7. Model-Authored HUD Display Panel tool
const displayTool = tool(async ({ title, html, anim = 'materialise', slot = 'right', accent = 'default', hold = 'turn' }) => {
  const panelId = `panel_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  uiEvents.emitDirective('display', { id: panelId, title, html, anim, slot, accent, hold });
  return `HUD panel displayed [${title}]: ${panelId}`;
}, {
  name: "display",
  description: "Author and render a structured HUD panel inside the interface using the .hud-* design system.",
  schema: z.object({
    title: z.string().describe("Short heading for the panel (e.g. 'SEARCH RESULTS', 'SYSTEM TELEMETRY')."),
    html: z.string().describe("HTML fragment authored using .hud-rows, .hud-row, .hud-metric, .hud-thumb, .hud-video classes."),
    anim: z.enum(['materialise', 'sweep', 'unfold', 'stagger', 'snap']).optional().default('materialise'),
    slot: z.enum(['right', 'left', 'wide']).optional().default('right'),
    accent: z.enum(['default', 'amber', 'violet', 'green', 'red']).optional().default('default'),
    hold: z.enum(['turn', 'sticky']).optional().default('turn')
  })
});

// 8. Interactive Blade Content Surface tool
const bladeTool = tool(async ({ title, type, content, url, mediaUrl, metadata }) => {
  const bladeId = `blade_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const bladePayload = {
    id: bladeId,
    title,
    type,
    content: content || '',
    url: url || '',
    mediaUrl: mediaUrl || '',
    metadata: metadata || {}
  };

  uiEvents.emitBlade({ action: 'open', blade: bladePayload });
  return `Interactive Blade opened: [${title}] (Type: ${type}, ID: ${bladeId})`;
}, {
  name: "blade",
  description: "Open an interactive stacking Blade (article, image, gallery, video, embed, camera, web_reader, live_page, mission).",
  schema: z.object({
    title: z.string().describe("Blade title."),
    type: z.enum(['article', 'image', 'gallery', 'video', 'embed', 'camera', 'web_reader', 'live_page', 'mission', 'markup']).describe("Content surface type."),
    content: z.string().optional().describe("Text or markup content."),
    url: z.string().optional().describe("Web page URL for reader/live mode."),
    mediaUrl: z.string().optional().describe("Media URL for image/video/embed."),
    metadata: z.record(z.any()).optional().describe("Additional metadata.")
  })
});

module.exports = {
  uiEvents,
  uiThemeTool,
  uiReactorTool,
  uiOrbitTool,
  uiChromeTool,
  uiEffectTool,
  uiResetTool,
  displayTool,
  bladeTool
};
