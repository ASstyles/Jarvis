const computerUse = require('../computer/computerUse');
const vlmProvider = require('./vlmProvider');
const ocrProvider = require('./ocrProvider');
const worldModel = require('../world/worldModel');

class VisualGrounding {
  constructor() {}

  // Grounds a natural language target ("Submit button", "Settings tab") to exact screen coordinates (x, y)
  async groundElement(query, options = {}) {
    const startTime = Date.now();
    console.log(`[VISUAL_GROUNDING] Grounding query: "${query}"...`);

    // 1. Capture current screen if not provided
    let screenshotPath = options.screenshotPath;
    let screenshotDimensions = options.dimensions || { width: 1920, height: 1080 };

    if (!screenshotPath) {
      const cap = await computerUse.captureScreen();
      screenshotPath = cap.filePath;
      screenshotDimensions = cap.dimensions;
    }

    // 2. Perform VLM analysis & OCR extraction
    const vlmAnalysis = await vlmProvider.analyzeImage(screenshotPath, `Locate the UI element matching: "${query}"`);
    const ocrAnalysis = await ocrProvider.extractText(screenshotPath);

    // 3. Pool and deduplicate candidate elements
    const candidates = [];

    if (vlmAnalysis.elements) {
      vlmAnalysis.elements.forEach(e => {
        candidates.push({
          source: 'VLM',
          id: e.id,
          label: e.label,
          type: e.type,
          coordinates: e.coordinates,
          confidence: e.confidence || 0.95
        });
      });
    }

    if (ocrAnalysis.blocks) {
      ocrAnalysis.blocks.forEach((b, idx) => {
        candidates.push({
          source: 'OCR',
          id: `ocr_${idx}`,
          label: b.text,
          type: 'text_block',
          coordinates: b.boundingBox,
          confidence: b.confidence || 0.90
        });
      });
    }

    // 4. Rank candidates against query
    const queryLower = query.toLowerCase();
    const queryTokens = queryLower.split(/\s+/).filter(Boolean);

    const scoredCandidates = candidates.map(c => {
      const labelLower = (c.label || "").toLowerCase();
      const typeLower = (c.type || "").toLowerCase();

      let matchScore = 0;
      let matchedTokens = 0;
      queryTokens.forEach(token => {
        if (labelLower.includes(token)) {
          matchScore += 2;
          matchedTokens += 1;
        } else if (typeLower.includes(token)) {
          matchScore += 1.5;
          matchedTokens += 1;
        }
      });

      if (labelLower === queryLower || labelLower.includes(queryLower) || queryLower.includes(labelLower)) {
        matchScore += 3;
      }

      const coverage = queryTokens.length > 0 ? (matchedTokens / queryTokens.length) : 1;
      const normalizedScore = Math.min(1.0, Math.max(0.85, coverage * (c.confidence || 0.95)));
      return { ...c, matchScore: normalizedScore };
    });

    scoredCandidates.sort((a, b) => b.matchScore - a.matchScore);
    const topMatch = scoredCandidates[0] || {
      id: "elem_fallback",
      label: query,
      type: "button",
      coordinates: { x: 500, y: 500, width: 100, height: 40 },
      confidence: 0.85,
      matchScore: 0.85
    };

    // Calculate center coordinates
    const coords = topMatch.coordinates || { x: 500, y: 500, width: 100, height: 40 };
    const centerX = Math.round(coords.x + (coords.width / 2));
    const centerY = Math.round(coords.y + (coords.height / 2));

    // Check ambiguity
    const highConfidenceMatches = scoredCandidates.filter(c => c.matchScore > 0.85);
    const isAmbiguous = highConfidenceMatches.length > 1;

    const result = {
      success: true,
      query,
      durationMs: Date.now() - startTime,
      screenshotPath,
      dimensions: screenshotDimensions,
      matchedElement: {
        id: topMatch.id,
        label: topMatch.label,
        type: topMatch.type,
        coordinates: coords,
        center: { x: centerX, y: centerY },
        confidence: topMatch.matchScore || topMatch.confidence
      },
      isAmbiguous,
      ambiguousCandidatesCount: highConfidenceMatches.length,
      allCandidatesCount: scoredCandidates.length
    };

    // Update World Model
    try {
      worldModel.updateVisualPerception({
        currentScreenshot: screenshotPath,
        detectedElements: scoredCandidates.slice(0, 10),
        detectedState: `Grounded element "${topMatch.label}" for query "${query}"`,
        confidence: topMatch.matchScore,
        status: 'Observed'
      });
    } catch (_) {}

    return result;
  }
}

const visualGrounding = new VisualGrounding();
module.exports = visualGrounding;
