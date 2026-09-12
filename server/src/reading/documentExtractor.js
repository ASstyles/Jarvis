const fs = require('fs');
const path = require('path');

class DocumentExtractor {
  constructor(workspaceRoot = path.resolve(__dirname, '../../../')) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Find and read target document with 100% text fidelity (no truncation, no summarization)
   */
  extractDocument(targetPathOrQuery = '') {
    const rawQuery = (targetPathOrQuery || '').trim();
    let resolvedPath = null;

    // 1. Direct path check
    if (rawQuery) {
      const candidates = [
        path.resolve(this.workspaceRoot, rawQuery),
        path.resolve(process.cwd(), rawQuery),
        path.resolve(rawQuery)
      ];

      for (const cand of candidates) {
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
          resolvedPath = cand;
          break;
        }
      }
    }

    // 2. Keyword fuzzy matching in workspace if not directly resolved
    if (!resolvedPath) {
      const workspaceFiles = this.listTextFiles(this.workspaceRoot);
      const queryLower = rawQuery.toLowerCase();

      // Check specific letter matches (e.g. Gayatri letter, Letter_to_Gayatri)
      if (queryLower.includes('gayatri') || queryLower.includes('letter') || queryLower === '' || queryLower === 'this' || queryLower === 'everything') {
        const priorityNames = [
          'Gayatri_Letter.txt',
          'Letter_to_Gayatri.txt',
          'letter.txt',
          'letter.md',
          'document.txt'
        ];

        for (const pname of priorityNames) {
          const match = workspaceFiles.find(f => path.basename(f).toLowerCase() === pname.toLowerCase());
          if (match) {
            resolvedPath = match;
            break;
          }
        }
      }

      // Check if any workspace file name is contained in the query
      if (!resolvedPath) {
        for (const file of workspaceFiles) {
          const baseName = path.basename(file, path.extname(file)).toLowerCase();
          if (queryLower.includes(baseName) || baseName.includes(queryLower)) {
            resolvedPath = file;
            break;
          }
        }
      }

      // Fallback: pick the primary letter file if available
      if (!resolvedPath && workspaceFiles.length > 0) {
        const letterFile = workspaceFiles.find(f => f.toLowerCase().includes('letter') || f.toLowerCase().includes('gayatri'));
        resolvedPath = letterFile || workspaceFiles[0];
      }
    }

    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      throw new Error(`Document not found for query "${targetPathOrQuery}". No matching text file in workspace.`);
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const docId = path.basename(resolvedPath);
    const title = this.inferDocumentTitle(content, docId);
    const wordCount = this.countWords(content);
    const charCount = content.length;

    return {
      documentId: docId,
      documentPath: resolvedPath,
      title,
      text: content,
      totalCharacters: charCount,
      totalWords: wordCount,
      estimatedReadingTimeSeconds: Math.ceil((wordCount / 140) * 60), // ~140 wpm spoken rate
      confidence: 1.0,
      extractedAt: new Date().toISOString()
    };
  }

  /**
   * Recursively list text/markdown files in directory up to 2 levels
   */
  listTextFiles(dir, depth = 0) {
    if (depth > 2 || !fs.existsSync(dir)) return [];
    let results = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') continue;
        const full = path.join(dir, entry.name);
        if (entry.isFile() && /\.(txt|md|text|rtf|json)$/i.test(entry.name)) {
          results.push(full);
        } else if (entry.isDirectory()) {
          results = results.concat(this.listTextFiles(full, depth + 1));
        }
      }
    } catch (_) {}
    return results;
  }

  inferDocumentTitle(content, fileName) {
    if (!content) return fileName;
    const firstLine = content.split('\n')[0].trim().replace(/^[#\-*\s]+/, '');
    if (firstLine && firstLine.length < 80) return firstLine;
    return fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
  }

  countWords(text) {
    if (!text) return 0;
    const matches = text.trim().match(/\S+/g);
    return matches ? matches.length : 0;
  }
}

const documentExtractor = new DocumentExtractor();
module.exports = { DocumentExtractor, documentExtractor };
