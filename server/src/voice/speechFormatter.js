/**
 * JARVIS Speech Formatter & Conversational Filter
 * Segregates rich visual markdown responses from concise, natural, cinematic spoken speech.
 * Eliminates robotic AI cliches, filters technical code/tables from voice, and inserts natural prosody pauses.
 */

const pronunciationEngine = require("./pronunciationEngine");

const CLICHE_REPLACEMENTS = [
  { pattern: /\b(?:As an AI(?:\s+language\s+model)?|As a large language model)\b[,.]?/gi, replacement: "" },
  { pattern: /\b(?:Certainly|Absolutely|Of course|Sure thing|Gladly|I would be happy to help(?: you)?(?: with that)?)[!.,:]*/gi, replacement: "Understood." },
  { pattern: /\b(?:I understand your request|I acknowledge your command)[!.,:]*/gi, replacement: "Got it." },
  { pattern: /\b(?:Here is the information you requested:?|Here are the results of your query:?|Below is the output:?)/gi, replacement: "" },
  { pattern: /\b(?:Your request has been successfully processed[.]?|The task has been completed successfully[.]?)/gi, replacement: "Done. I've taken care of it." },
  { pattern: /\b(?:I have detected an error in the application[.]?|An error has occurred during execution[.]?)/gi, replacement: "I found the problem." },
  { pattern: /\b(?:Would you like me to proceed with the requested operation\??)/gi, replacement: "Want me to take care of the rest?" },
  { pattern: /\b(?:Is there anything else I can help you with\??|Let me know if you need anything else[.]?|Feel free to ask if you have more questions[.]?)/gi, replacement: "" }
];

class SpeechFormatter {
  /**
   * Filter robotic AI clichés from text
   */
  filterCliches(text) {
    if (!text) return "";
    let cleaned = text;

    for (const item of CLICHE_REPLACEMENTS) {
      cleaned = cleaned.replace(item.pattern, item.replacement);
    }

    // Clean up multiple punctuation, double dots, and spaces
    cleaned = cleaned.replace(/\.{2,}/g, ".");
    cleaned = cleaned.replace(/([!?,.])\s*([!?,.])/g, "$1");
    cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
    return cleaned;
  }

  /**
   * Segment and convert visual Markdown text into a crisp, natural spoken voice delivery
   */
  formatForSpeech(rawText, options = { brevity: 'balanced' }) {
    if (!rawText) return "Standing by.";

    // 1. Remove bracketed emotion tags e.g. [blue analysis], [happy], [red alert]
    let text = rawText.replace(/\[([A-Za-z\s_]{3,25})\]/g, "").trim();

    // 2. Strip code blocks and replace with brief conversational summary
    const hasCodeBlock = /```[\s\S]*?```/g.test(text);
    text = text.replace(/```[a-zA-Z]*\n?([\s\S]*?)```/g, (match, code) => {
      const lineCount = code.trim().split('\n').length;
      return ` I've rendered the ${lineCount}-line implementation on your screen. `;
    });

    // 3. Strip markdown tables and replace with conversational cue
    const hasTable = /\|(?:[^\n|]+\|)+\n\|(?:\s*[-:]+\s*\|)+\n(?:\|(?:[^\n|]+\|)+\n?)+/g.test(text);
    text = text.replace(/\|(?:[^\n|]+\|)+\n\|(?:\s*[-:]+\s*\|)+\n(?:\|(?:[^\n|]+\|)+\n?)+/g, " The complete breakdown is organized in the table on your display. ");

    // 4. Strip markdown formatting: headers, bold, italics, links, blockquotes, bullets
    text = text.replace(/^#+\s+/gm, ""); // Headers
    text = text.replace(/\*\*(.*?)\*\*/g, "$1"); // Bold
    text = text.replace(/\*(.*?)\*/g, "$1"); // Italics
    text = text.replace(/__(.*?)__/g, "$1"); // Underline/bold
    text = text.replace(/\[(.*?)\]\((.*?)\)/g, "$1"); // Links
    text = text.replace(/^>\s+/gm, ""); // Blockquotes
    text = text.replace(/^[\*\-]\s+/gm, ""); // Unordered list bullets
    text = text.replace(/^\d+\.\s+/gm, ""); // Ordered list numbers
    text = text.replace(/`([^`]+)`/g, "$1"); // Inline code

    // 5. Apply conversational cliché filter (skip for document reading)
    if (!options.isDocumentReading && options.brevity !== 'verbatim') {
      text = this.filterCliches(text);
    }

    // 6. Natural Brevity Filtering
    // If response is excessively long (multi-paragraph), extract key lead statements and conclusion
    // CRITICAL: NEVER discard sentences when reading documents or when brevity is verbatim!
    let spoken = text;
    if (!options.isDocumentReading && options.brevity !== 'verbatim') {
      const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
      if (options.brevity === 'concise' && sentences.length > 2) {
        // Pick the primary answer and conclusion
        spoken = `${sentences[0]} ${sentences[sentences.length - 1]}`;
      } else if (sentences.length > 4) {
        // Keep up to 3 most informative sentences for audio comfort
        spoken = `${sentences[0]} ${sentences[1]} ${sentences[sentences.length - 1]}`;
      }
    }

    // 7. Inject natural pauses before punchlines/transitions (conversational only)
    if (!options.isDocumentReading) {
      spoken = spoken.replace(/\b(However|Furthermore|Additionally|Specifically|Fortunately|Unfortunately)\b/gi, "... $1");
      spoken = spoken.replace(/\b(I found the issue|Found it|The issue is)\b/gi, "$1...");
    }

    // 8. Apply phonetic pronunciation and number formatting
    spoken = pronunciationEngine.formatPronunciation(spoken);

    // 9. Clean up whitespace and punctuation
    spoken = spoken.replace(/\s{2,}/g, " ").trim();
    if (!spoken.endsWith(".") && !spoken.endsWith("!") && !spoken.endsWith("?") && !options.isDocumentReading) {
      spoken += ".";
    }

    return spoken;
  }

  /**
   * Format a single document speech segment for TTS while preserving exact words
   */
  formatDocumentSegment(segmentText) {
    if (!segmentText) return "";
    return pronunciationEngine.formatPronunciation(segmentText.trim());
  }

  /**
   * Generates a context-appropriate natural acknowledgment
   */
  getAcknowledgment(type = 'general') {
    const acks = {
      quick: ["On it.", "Understood.", "Right away.", "Got it."],
      inspecting: ["I'm checking it now...", "Looking into it...", "Scanning the environment..."],
      success: ["Done.", "That took care of it.", "All set.", "That worked."],
      warning: ["Hold on. That requires confirmation.", "Caution advised."],
      general: ["Understood.", "On it.", "Got it."]
    };

    const list = acks[type] || acks.general;
    return list[Math.floor(Math.random() * list.length)];
  }
}

const speechFormatter = new SpeechFormatter();
module.exports = speechFormatter;
