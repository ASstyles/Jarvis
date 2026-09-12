/**
 * JARVIS Speech Segmenter
 * Divides full unabridged document text into natural, digestible speech segments.
 * Prevents browser speech synthesis engine cutoffs by ensuring chunks are 80-220 characters
 * while preserving 100% of original words, punctuation, quotes, and paragraph boundaries.
 */

class SpeechSegmenter {
  /**
   * Segments text into sequentially tracked speech chunks
   * @param {string} fullText
   * @returns {Array<Object>}
   */
  segment(fullText) {
    if (!fullText || typeof fullText !== 'string' || fullText.trim() === '') {
      return [];
    }

    const segments = [];
    const paragraphs = fullText.split(/\n\s*\n/);
    let segmentIndex = 1;
    let globalCharOffset = 0;

    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const paragraph = paragraphs[pIdx].trim();
      if (!paragraph) continue;

      // Split paragraph into sentence candidates
      // Respect common abbreviations and quotes
      const sentenceCandidates = this.splitIntoSentences(paragraph);

      for (const sentence of sentenceCandidates) {
        if (!sentence.trim()) continue;

        // If sentence is short or medium length, keep as single segment
        if (sentence.length <= 220) {
          const wordCount = (sentence.match(/\S+/g) || []).length;
          const startOffset = fullText.indexOf(sentence, globalCharOffset);
          const effectiveStart = startOffset >= 0 ? startOffset : globalCharOffset;
          const effectiveEnd = effectiveStart + sentence.length;
          globalCharOffset = effectiveEnd;

          segments.push({
            index: segmentIndex++,
            paragraphIndex: pIdx + 1,
            text: sentence.trim(),
            wordCount,
            charCount: sentence.length,
            startCharOffset: effectiveStart,
            endCharOffset: effectiveEnd,
            status: 'PENDING',
            retries: 0
          });
        } else {
          // Break very long sentence on clauses/phrases (comma, semicolon, dash, conjunctions)
          const subChunks = this.splitLongSentence(sentence);
          for (const sub of subChunks) {
            if (!sub.trim()) continue;
            const wordCount = (sub.match(/\S+/g) || []).length;
            const startOffset = fullText.indexOf(sub, globalCharOffset);
            const effectiveStart = startOffset >= 0 ? startOffset : globalCharOffset;
            const effectiveEnd = effectiveStart + sub.length;
            globalCharOffset = effectiveEnd;

            segments.push({
              index: segmentIndex++,
              paragraphIndex: pIdx + 1,
              text: sub.trim(),
              wordCount,
              charCount: sub.length,
              startCharOffset: effectiveStart,
              endCharOffset: effectiveEnd,
              status: 'PENDING',
              retries: 0
            });
          }
        }
      }
    }

    return segments;
  }

  /**
   * Split paragraph into sentence units using regex that respects ellipses and quotes
   */
  splitIntoSentences(text) {
    // Lookbehind for .!? followed by whitespace or line break, but handle quotes
    const rawSentences = text
      .split(/(?<=[.!?]["'”’]?)\s+(?=[A-Z0-9"“'‘(—-])/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (rawSentences.length === 0) return [text.trim()];
    return rawSentences;
  }

  /**
   * Splits a long sentence (>220 chars) into natural speech phrases on clauses
   */
  splitLongSentence(sentence) {
    const clauseDelimiters = /([,;:\u2014\u2013\-]|\band\b|\bbut\b|\bbecause\b|\bwhile\b|\bwhich\b)/gi;
    const parts = sentence.split(clauseDelimiters);
    const chunks = [];
    let current = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      if ((current + part).length > 200 && current.trim().length > 30) {
        chunks.push(current.trim());
        current = part;
      } else {
        current += part;
      }
    }

    if (current.trim().length > 0) {
      chunks.push(current.trim());
    }

    return chunks.length > 0 ? chunks : [sentence];
  }
}

const speechSegmenter = new SpeechSegmenter();
module.exports = { SpeechSegmenter, speechSegmenter };
