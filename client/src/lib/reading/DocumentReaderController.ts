"use client";

import { voiceEngine } from "../voice/VoiceEngine";

export interface ReadingSegment {
  index: number;
  paragraphIndex: number;
  text: string;
  wordCount: number;
  charCount: number;
  startCharOffset: number;
  endCharOffset: number;
  status: "PENDING" | "PLAYING" | "COMPLETED" | "SKIPPED" | "FAILED";
  retries: number;
  audioStartedAt?: number;
  audioCompletedAt?: number;
  error?: string;
}

export interface ReadingSessionState {
  sessionId: string;
  documentId: string;
  documentTitle: string;
  documentPath?: string;
  fullText: string;
  totalCharacters: number;
  totalWords: number;
  totalSegments: number;
  currentSegment: number; // 1-indexed
  completedSegments: number;
  skippedSegments: number;
  retryCount: number;
  currentCharacterOffset: number;
  currentWordOffset: number;
  status: "PREPARING" | "EXTRACTING" | "READY" | "READING" | "PAUSED" | "STOPPED" | "ERROR" | "VERIFYING" | "COMPLETED";
  audioStarted: boolean;
  audioCompleted: boolean;
  interrupted: boolean;
  verified: boolean;
  confidence: number;
  segments: ReadingSegment[];
  error: string | null;
}

type SessionListener = (session: ReadingSessionState) => void;

export class DocumentReaderController {
  private session: ReadingSessionState | null = null;
  private listeners: Set<SessionListener> = new Set();
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isProcessing: boolean = false;
  private abortController: AbortController | null = null;
  private maxSegmentRetries: number = 2;

  constructor() {
    if (typeof window !== "undefined") {
      this.synth = window.speechSynthesis;
    }
  }

  public subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    if (this.session) listener(this.session);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    if (this.session) {
      const stateCopy = { ...this.session, segments: [...this.session.segments] };
      this.listeners.forEach(cb => cb(stateCopy));
      this.syncWithBackend(stateCopy);
    }
  }

  private async syncWithBackend(state: ReadingSessionState) {
    try {
      await fetch("http://localhost:4000/api/reading/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state)
      });
    } catch (_) {}
  }

  public getState(): ReadingSessionState | null {
    return this.session;
  }

  public get isReading(): boolean {
    return this.session?.status === "READING";
  }

  public get isPaused(): boolean {
    return this.session?.status === "PAUSED";
  }

  /**
   * Split document text into verifiable speech chunks (80-220 chars)
   */
  public segmentText(fullText: string): ReadingSegment[] {
    if (!fullText || fullText.trim() === "") return [];

    const segments: ReadingSegment[] = [];
    const paragraphs = fullText.split(/\n\s*\n/);
    let segmentIndex = 1;
    let globalOffset = 0;

    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const paragraph = paragraphs[pIdx].trim();
      if (!paragraph) continue;

      // Sentence splitting respecting quotes and abbreviations
      const sentences = paragraph
        .split(/(?<=[.!?]["'”’]?)\s+(?=[A-Z0-9"“'‘(—-])/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const sentenceList = sentences.length > 0 ? sentences : [paragraph];

      for (const sent of sentenceList) {
        if (sent.length <= 220) {
          const wordCount = (sent.match(/\S+/g) || []).length;
          const startIdx = fullText.indexOf(sent, globalOffset);
          const effectiveStart = startIdx >= 0 ? startIdx : globalOffset;
          const effectiveEnd = effectiveStart + sent.length;
          globalOffset = effectiveEnd;

          segments.push({
            index: segmentIndex++,
            paragraphIndex: pIdx + 1,
            text: sent,
            wordCount,
            charCount: sent.length,
            startCharOffset: effectiveStart,
            endCharOffset: effectiveEnd,
            status: "PENDING",
            retries: 0
          });
        } else {
          // Break overly long sentences into clauses
          const clauses = sent.split(/([,;:\u2014\u2013\-]|\band\b|\bbut\b|\bbecause\b|\bwhile\b|\bwhich\b)/gi);
          let currentChunk = "";

          for (const clause of clauses) {
            if (!clause) continue;
            if ((currentChunk + clause).length > 200 && currentChunk.trim().length > 30) {
              const wordCount = (currentChunk.match(/\S+/g) || []).length;
              const startIdx = fullText.indexOf(currentChunk, globalOffset);
              const effectiveStart = startIdx >= 0 ? startIdx : globalOffset;
              const effectiveEnd = effectiveStart + currentChunk.length;
              globalOffset = effectiveEnd;

              segments.push({
                index: segmentIndex++,
                paragraphIndex: pIdx + 1,
                text: currentChunk.trim(),
                wordCount,
                charCount: currentChunk.length,
                startCharOffset: effectiveStart,
                endCharOffset: effectiveEnd,
                status: "PENDING",
                retries: 0
              });
              currentChunk = clause;
            } else {
              currentChunk += clause;
            }
          }

          if (currentChunk.trim().length > 0) {
            const wordCount = (currentChunk.match(/\S+/g) || []).length;
            const startIdx = fullText.indexOf(currentChunk, globalOffset);
            const effectiveStart = startIdx >= 0 ? startIdx : globalOffset;
            const effectiveEnd = effectiveStart + currentChunk.length;
            globalOffset = effectiveEnd;

            segments.push({
              index: segmentIndex++,
              paragraphIndex: pIdx + 1,
              text: currentChunk.trim(),
              wordCount,
              charCount: currentChunk.length,
              startCharOffset: effectiveStart,
              endCharOffset: effectiveEnd,
              status: "PENDING",
              retries: 0
            });
          }
        }
      }
    }

    return segments;
  }

  /**
   * Load and prepare document for reading session
   */
  public loadDocument(doc: {
    id: string;
    title: string;
    text: string;
    path?: string;
    totalWords?: number;
    totalCharacters?: number;
    session?: any;
  }): ReadingSessionState {
    this.stopReading();

    const segments = doc.session?.segments || this.segmentText(doc.text);
    const dateStr = new Date().toISOString().slice(0, 10);
    const sessionId = doc.session?.sessionId || `READ-${dateStr}-${Date.now().toString().slice(-4)}`;

    const totalWords = doc.totalWords || (doc.text.match(/\S+/g) || []).length;
    const totalChars = doc.totalCharacters || doc.text.length;

    this.session = {
      sessionId,
      documentId: doc.id,
      documentTitle: doc.title || "Letter",
      documentPath: doc.path,
      fullText: doc.text,
      totalCharacters: totalChars,
      totalWords: totalWords,
      totalSegments: segments.length,
      currentSegment: 1,
      completedSegments: 0,
      skippedSegments: 0,
      retryCount: 0,
      currentCharacterOffset: 0,
      currentWordOffset: 0,
      status: "READY",
      audioStarted: false,
      audioCompleted: false,
      interrupted: false,
      verified: false,
      confidence: 1.0,
      segments,
      error: null
    };

    this.notify();
    return this.session;
  }

  /**
   * Select natural voice for document recitation
   */
  private getRecitationVoice(): SpeechSynthesisVoice | null {
    if (!this.synth) return null;
    const voices = this.synth.getVoices();
    if (!voices || voices.length === 0) return null;

    const preferred = [
      "Daniel",
      "Arthur",
      "Google UK English Male",
      "Microsoft George Online (Natural)",
      "Microsoft Ryan Online (Natural)",
      "Google US English",
      "en-GB"
    ];

    for (const p of preferred) {
      const match = voices.find(v => v.name.includes(p) || (v.lang === p && v.name.includes("Male")));
      if (match) return match;
    }

    return voices.find(v => v.lang.startsWith("en")) || voices[0];
  }

  /**
   * Start or resume verbatim audio reading
   */
  public async startReading(fromSegment?: number) {
    if (!this.session || this.session.segments.length === 0) return;

    // Interrupt any active conversational speech
    if (voiceEngine) voiceEngine.interrupt();
    if (this.synth) this.synth.cancel();

    if (typeof fromSegment === "number" && fromSegment >= 1 && fromSegment <= this.session.totalSegments) {
      this.session.currentSegment = fromSegment;
    }

    this.session.status = "READING";
    this.session.audioStarted = true;
    this.session.interrupted = false;
    this.isProcessing = true;
    this.abortController = new AbortController();
    this.notify();

    await this.playbackLoop();
  }

  /**
   * Main sequential audio playback loop
   */
  private async playbackLoop() {
    if (!this.session) return;

    while (
      this.session &&
      this.session.status === "READING" &&
      this.session.currentSegment <= this.session.totalSegments &&
      !this.session.interrupted
    ) {
      const currentIdx = this.session.currentSegment;
      const segment = this.session.segments.find(s => s.index === currentIdx);

      if (!segment) {
        this.session.currentSegment++;
        continue;
      }

      // 1. Mark segment PLAYING
      segment.status = "PLAYING";
      segment.audioStartedAt = Date.now();
      this.notify();

      // 2. Play segment via SpeechSynthesis
      const success = await this.playSegmentUtterance(segment);

      if (!success) {
        // Handle failure & retry
        segment.retries = (segment.retries || 0) + 1;
        this.session.retryCount++;

        if (segment.retries <= this.maxSegmentRetries && this.session.status === "READING") {
          console.warn(`[DOC_READER] Retrying segment ${currentIdx} (attempt ${segment.retries})...`);
          await new Promise(r => setTimeout(r, 400));
          continue; // Retry same segment
        } else {
          // Retry exhausted
          segment.status = "FAILED";
          segment.error = `Playback failed after ${this.maxSegmentRetries} attempts`;
          this.session.status = "ERROR";
          this.session.error = `Could not play section ${currentIdx}. Stopped at this position.`;
          this.notify();
          this.speakNotice(`I couldn't play section ${currentIdx}. I stopped there.`);
          return;
        }
      }

      // 3. Mark segment COMPLETED ONLY after audio has fully finished playing
      segment.status = "COMPLETED";
      segment.audioCompletedAt = Date.now();
      this.session.completedSegments = this.session.segments.filter(s => s.status === "COMPLETED").length;
      this.session.currentWordOffset += segment.wordCount;
      this.session.currentCharacterOffset = segment.endCharOffset;
      this.notify();

      // 4. Advance to next segment or complete
      if (this.session.currentSegment < this.session.totalSegments) {
        this.session.currentSegment++;
        this.notify();

        // Natural inter-sentence pause (160ms - 240ms)
        const pauseMs = segment.text.endsWith("...") ? 320 : 180;
        await new Promise(r => setTimeout(r, pauseMs));
      } else {
        // All segments reached
        break;
      }
    }

    // Check if loop finished naturally at end of document
    if (
      this.session &&
      this.session.status === "READING" &&
      this.session.currentSegment >= this.session.totalSegments &&
      !this.session.interrupted
    ) {
      await this.verifyAndComplete();
    }
  }

  /**
   * Play single segment with lifecycle promise
   */
  private playSegmentUtterance(segment: ReadingSegment): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (!this.synth) {
        resolve(false);
        return;
      }

      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(segment.text);
      this.currentUtterance = utterance;

      const voice = this.getRecitationVoice();
      if (voice) utterance.voice = voice;
      utterance.rate = 0.96; // Refined, clear reading speed
      utterance.pitch = 0.88; // Deep, composed tone
      utterance.volume = 1.0;

      let hasResolved = false;

      utterance.onend = () => {
        if (!hasResolved) {
          hasResolved = true;
          this.currentUtterance = null;
          resolve(true);
        }
      };

      utterance.onerror = (e) => {
        if (!hasResolved) {
          hasResolved = true;
          this.currentUtterance = null;
          // If error was triggered by intentional cancellation/pause, treat gracefully
          if (e.error === "canceled" || e.error === "interrupted") {
            resolve(true);
          } else {
            console.error(`[DOC_READER] TTS error on segment ${segment.index}:`, e.error);
            resolve(false);
          }
        }
      };

      this.synth.speak(utterance);
    });
  }

  /**
   * Strictly verify session completion and recite concluding confirmation
   */
  private async verifyAndComplete() {
    if (!this.session) return;

    this.session.status = "VERIFYING";
    this.notify();

    const allSegmentsFinished = this.session.segments.every(s => s.status === "COMPLETED" || s.status === "SKIPPED");
    const countMatches = (this.session.completedSegments + this.session.skippedSegments) === this.session.totalSegments;

    const isVerified = (
      this.session.audioStarted === true &&
      allSegmentsFinished &&
      countMatches &&
      !this.session.interrupted &&
      this.session.totalSegments > 0
    );

    if (isVerified) {
      this.session.status = "COMPLETED";
      this.session.audioCompleted = true;
      this.session.verified = true;
      this.isProcessing = false;
      this.notify();

      // Speak official verified conclusion
      await this.speakNotice("That’s the end of the letter.");
    } else {
      this.session.verified = false;
      this.session.status = "STOPPED";
      this.isProcessing = false;
      this.notify();

      const incompleteMsg = `I stopped after section ${this.session.completedSegments} of ${this.session.totalSegments}.`;
      await this.speakNotice(incompleteMsg);
    }
  }

  private speakNotice(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth || !text) return resolve();
      this.synth.cancel();

      const u = new SpeechSynthesisUtterance(text);
      const voice = this.getRecitationVoice();
      if (voice) u.voice = voice;
      u.rate = 1.0;
      u.pitch = 0.88;

      u.onend = () => resolve();
      u.onerror = () => resolve();

      this.synth.speak(u);
    });
  }

  public pauseReading() {
    if (!this.session || this.session.status !== "READING") return;
    this.session.status = "PAUSED";
    if (this.synth) this.synth.cancel();
    this.currentUtterance = null;
    this.notify();
    this.speakNotice("Paused.");
  }

  public resumeReading() {
    if (!this.session || this.session.status !== "PAUSED") return;
    this.session.status = "READING";
    this.notify();
    this.speakNotice("Continuing.");
    setTimeout(() => {
      this.playbackLoop();
    }, 600);
  }

  public stopReading(reason = "User directive") {
    if (!this.session) return;
    this.session.status = "STOPPED";
    this.session.interrupted = true;
    if (this.synth) this.synth.cancel();
    this.currentUtterance = null;
    this.isProcessing = false;
    this.notify();
  }

  public repeatCurrentSegment() {
    if (!this.session) return;
    if (this.synth) this.synth.cancel();
    const current = this.session.currentSegment;
    const seg = this.session.segments.find(s => s.index === current);
    if (seg) seg.status = "PENDING";
    this.startReading(current);
  }

  public restartReading() {
    if (!this.session) return;
    if (this.synth) this.synth.cancel();
    this.session.currentSegment = 1;
    this.session.completedSegments = 0;
    this.session.skippedSegments = 0;
    this.session.currentCharacterOffset = 0;
    this.session.currentWordOffset = 0;
    this.session.interrupted = false;
    this.session.verified = false;
    this.session.audioCompleted = false;
    this.session.status = "READY";
    this.session.segments.forEach(s => {
      s.status = "PENDING";
      s.retries = 0;
    });
    this.notify();
    this.speakNotice("Starting from the beginning.");
    setTimeout(() => {
      this.startReading(1);
    }, 1200);
  }

  public skipToSegment(targetIndex?: number) {
    if (!this.session) return;
    if (this.synth) this.synth.cancel();
    const current = this.session.currentSegment;
    const currentSeg = this.session.segments.find(s => s.index === current);
    if (currentSeg && currentSeg.status !== "COMPLETED") {
      currentSeg.status = "SKIPPED";
      this.session.skippedSegments = this.session.segments.filter(s => s.status === "SKIPPED").length;
    }

    const nextIdx = targetIndex || (current + 1);
    if (nextIdx <= this.session.totalSegments) {
      this.startReading(nextIdx);
    } else {
      this.verifyAndComplete();
    }
  }

  public retryCurrentSegment() {
    if (!this.session) return;
    const current = this.session.currentSegment;
    const seg = this.session.segments.find(s => s.index === current);
    if (seg) {
      seg.status = "PENDING";
      seg.retries = 0;
      this.startReading(current);
    }
  }
}

export const documentReaderController = typeof window !== "undefined" ? new DocumentReaderController() : (null as unknown as DocumentReaderController);
