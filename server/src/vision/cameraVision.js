const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const EventEmitter = require('events');

/**
 * Real-Time Webcam Vision & Temporal Buffer Engine
 *
 * Provides opt-in camera perception:
 * - 'look': Single frame capture with visible indicator
 * - 'watch': Multi-frame observation over time (past rolling buffer or upcoming seconds)
 * - Temporary in-memory processing only; no unnecessary disk persistence.
 */

class CameraVisionManager extends EventEmitter {
  constructor() {
    super();
    this.pendingCaptures = new Map();
    this.nextCaptureId = 1;
  }

  requestCapture(mode = 'look', seconds = 6, when = 'now', reason = '') {
    return new Promise((resolve, reject) => {
      const captureId = `cap_${this.nextCaptureId++}_${Date.now()}`;

      const timer = setTimeout(() => {
        if (this.pendingCaptures.has(captureId)) {
          this.pendingCaptures.delete(captureId);
          reject(new Error(`Camera capture timed out. Ensure browser camera permission is granted.`));
        }
      }, (seconds + 10) * 1000);

      this.pendingCaptures.set(captureId, {
        resolve: (val) => { clearTimeout(timer); resolve(val); },
        reject: (err) => { clearTimeout(timer); reject(err); }
      });

      // Emit event for SSE bus to notify client
      this.emit('CAMERA_CAPTURE_REQUESTED', {
        captureId,
        mode,
        seconds,
        when,
        reason: reason || 'Visual observation requested'
      });
    });
  }

  handleCaptureResponse(captureId, result) {
    if (this.pendingCaptures.has(captureId)) {
      const { resolve, reject } = this.pendingCaptures.get(captureId);
      this.pendingCaptures.delete(captureId);
      if (result.error) {
        reject(new Error(result.error));
      } else {
        resolve(result);
      }
    }
  }
}

const cameraVisionManager = new CameraVisionManager();

const lookTool = tool(async ({ reason = '' }) => {
  try {
    const result = await cameraVisionManager.requestCapture('look', 0, 'now', reason);
    if (!result || !result.imageData) {
      return "Camera returned no visual data.";
    }
    return `[Single camera frame captured successfully. Reason: "${reason || 'visual check'}"]`;
  } catch (err) {
    return `Camera Error: ${err.message}. The user's camera might be disabled or permission was denied.`;
  }
}, {
  name: "look",
  description: "Look through the webcam at the user or scene in front of the screen (single frame). Opt-in with visible indicator.",
  schema: z.object({
    reason: z.string().optional().describe("Brief description of why camera observation is requested.")
  })
});

const watchTool = tool(async ({ seconds = 6, when = 'now', reason = '' }) => {
  try {
    const dur = Math.min(15, Math.max(2, seconds));
    const result = await cameraVisionManager.requestCapture('watch', dur, when, reason);
    if (!result || !result.frames) {
      return "Temporal camera buffer returned no frames.";
    }
    return `[Temporal camera observation complete: ${result.frames.length} frames analyzed across ${dur}s (${when}). Observation: ${result.summary || 'Scene captured cleanly'}]`;
  } catch (err) {
    return `Camera Watch Error: ${err.message}`;
  }
}, {
  name: "watch",
  description: "Watch through the webcam over time (e.g. 6 seconds) to observe motion, or review what happened a few seconds ago ('past').",
  schema: z.object({
    seconds: z.number().min(2).max(15).optional().default(6).describe("Duration to observe in seconds (2 to 15)."),
    when: z.enum(['now', 'past']).optional().default('now').describe("'now' = observe next few seconds; 'past' = review short rolling buffer."),
    reason: z.string().optional().describe("Reason for watching.")
  })
});

module.exports = {
  cameraVisionManager,
  lookTool,
  watchTool
};
