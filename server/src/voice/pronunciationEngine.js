/**
 * JARVIS Pronunciation & Phonetic Formatting Engine
 * Converts technical acronyms, programming frameworks, code symbols,
 * file paths, URLs, and numeric data into natural conversational speech.
 */

const ACRONYM_DICTIONARY = {
  "API": "A-P-I",
  "APIs": "A-P-I's",
  "SQL": "sequel",
  "NoSQL": "no-sequel",
  "OAuth": "O-Auth",
  "OAuth2": "O-Auth two",
  "Next.js": "Next J-S",
  "Node.js": "Node J-S",
  "React.js": "React J-S",
  "Vue.js": "Vue J-S",
  "JSON": "J-son",
  "YAML": "yam-el",
  "XML": "X-M-L",
  "HTML": "H-T-M-L",
  "CSS": "C-S-S",
  "UI": "U-I",
  "UX": "U-X",
  "GUI": "gooey",
  "CLI": "C-L-I",
  "VLM": "V-L-M",
  "LLM": "L-L-M",
  "LLMs": "L-L-M's",
  "OCR": "O-C-R",
  "DAG": "D-A-G",
  "RAM": "ram",
  "CPU": "C-P-U",
  "GPU": "G-P-U",
  "IP": "I-P",
  "TCP": "T-C-P",
  "HTTP": "H-T-T-P",
  "HTTPS": "H-T-T-P-S",
  "SSH": "S-S-H",
  "URL": "U-R-L",
  "URLs": "U-R-L's",
  "SDK": "S-D-K",
  "SDKs": "S-D-K's",
  "CI/CD": "C-I C-D",
  "PR": "P-R",
  "PRs": "pull requests",
  "DNS": "D-N-S",
  "DOM": "dom",
  "CJS": "Common-J-S",
  "ESM": "E-S Modules",
  "TS": "TypeScript",
  "JS": "JavaScript",
  "OS": "operating system",
  "ID": "I-D",
  "IDs": "I-D's",
  "EBUSY": "resource busy error",
  "ENOENT": "file not found",
  "VS Code": "V-S Code",
  "GitHub": "Git-Hub",
  "OpenAI": "Open-A-I",
  "TTS": "T-T-S",
  "STT": "S-T-T"
};

class PronunciationEngine {
  /**
   * Convert numbers, latencies, dates, and metrics into natural conversational speech
   */
  formatSpokenNumbers(text) {
    if (!text) return "";

    let formatted = text;

    // 1. Latency: "0.084921 seconds" or "0.085s" -> "about eighty-five milliseconds"
    formatted = formatted.replace(/(\d+(?:\.\d+)?)\s*(?:seconds|s)\b/gi, (match, val) => {
      const num = parseFloat(val);
      if (num < 0.001) return "less than a millisecond";
      if (num < 1.0) {
        const ms = Math.round(num * 1000);
        return `about ${ms} milliseconds`;
      }
      return `${Math.round(num * 10) / 10} seconds`;
    });

    // 2. Milliseconds: "450ms" -> "450 milliseconds"
    formatted = formatted.replace(/(\d+)\s*ms\b/gi, "$1 milliseconds");

    // 3. File sizes: "12.4MB" -> "12.4 megabytes", "256KB" -> "256 kilobytes"
    formatted = formatted.replace(/(\d+(?:\.\d+)?)\s*GB\b/gi, "$1 gigabytes");
    formatted = formatted.replace(/(\d+(?:\.\d+)?)\s*MB\b/gi, "$1 megabytes");
    formatted = formatted.replace(/(\d+(?:\.\d+)?)\s*KB\b/gi, "$1 kilobytes");

    // 4. Versions: "v2.0" -> "version two point zero", "v3.5" -> "version three point five"
    formatted = formatted.replace(/\bv(\d+)\.(\d+)(?:\.(\d+))?\b/gi, (m, major, minor, patch) => {
      if (patch) return `version ${major} point ${minor} point ${patch}`;
      return `version ${major} point ${minor}`;
    });

    // 5. Port numbers: ":4000" or "port 4000" -> "port four thousand"
    formatted = formatted.replace(/(?:port\s+|:)(3000|4000|5000|8000|8080)\b/gi, (m, port) => {
      const ports = {
        "3000": "port three thousand",
        "4000": "port four thousand",
        "5000": "port five thousand",
        "8000": "port eight thousand",
        "8080": "port eighty eighty"
      };
      return ports[port] || `port ${port}`;
    });

    // 6. Percentages: "98.5%" -> "98.5 percent"
    formatted = formatted.replace(/(\d+(?:\.\d+)?)\s*%/g, "$1 percent");

    return formatted;
  }

  /**
   * Translates technical terms, file paths, URLs, and acronyms into natural phonetics
   */
  formatPronunciation(text) {
    if (!text) return "";

    let formatted = this.formatSpokenNumbers(text);

    // Replace known technical acronyms with natural phonetic pauses
    for (const [acronym, phonetic] of Object.entries(ACRONYM_DICTIONARY)) {
      // Escape special characters in acronym for regex
      const escaped = acronym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'g');
      formatted = formatted.replace(regex, phonetic);
    }

    // Convert file paths like "server/src/routes/api.js" into conversational references
    formatted = formatted.replace(/(?:[a-zA-Z0-9_-]+\/)+([a-zA-Z0-9_-]+\.[a-zA-Z0-9]+)/g, (match, filename) => {
      return filename.replace(/\./g, " dot ");
    });

    // Convert URLs into readable forms: "https://localhost:4000/api" -> "local host API"
    formatted = formatted.replace(/https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/([a-zA-Z0-9_\-\/]+))?/gi, (m, path) => {
      if (path) return `local ${path.replace(/\//g, " ")}`;
      return "local host";
    });

    return formatted;
  }
}

const pronunciationEngine = new PronunciationEngine();
module.exports = pronunciationEngine;
