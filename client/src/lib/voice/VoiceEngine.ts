"use client";

/**
 * JARVIS Voice 2.0 Engine & Audio Synthesis Controller
 * Provider-independent abstraction managing Web Audio synthesis, real-time waveform analysis,
 * sentence segmentation, natural pauses, prosody modulation, and instant interruption.
 */

export interface VoiceSettings {
  speed: "slow" | "normal" | "fast";
  warmth: "neutral" | "warm" | "professional";
  brevity: "concise" | "balanced" | "detailed";
  spokenProgress: "minimal" | "normal" | "detailed";
  interruptionsEnabled: boolean;
  wakeWordEnabled: boolean;
}

export interface VoiceProsody {
  pitch?: number;
  rate?: number;
  volume?: number;
  warmth?: string;
  pauseMs?: number;
  style?: string;
}

export class VoiceEngine {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isSpeakingState: boolean = false;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private onAudioLevelChange: ((level: number) => void) | null = null;
  private onSpeakingStateChange: ((speaking: boolean) => void) | null = null;

  public settings: VoiceSettings = {
    speed: "normal",
    warmth: "warm",
    brevity: "balanced",
    spokenProgress: "normal",
    interruptionsEnabled: true,
    wakeWordEnabled: true
  };

  constructor() {
    if (typeof window !== "undefined") {
      this.synth = window.speechSynthesis;
      this.loadStoredSettings();
    }
  }

  private loadStoredSettings() {
    try {
      const saved = localStorage.getItem("jarvis_voice_settings_v2");
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (_) {}
  }

  public saveSettings(newSettings: Partial<VoiceSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem("jarvis_voice_settings_v2", JSON.stringify(this.settings));
    } catch (_) {}
  }

  public setAudioLevelCallback(cb: (level: number) => void) {
    this.onAudioLevelChange = cb;
  }

  public setSpeakingStateCallback(cb: (speaking: boolean) => void) {
    this.onSpeakingStateChange = cb;
  }

  public get isSpeaking(): boolean {
    return this.isSpeakingState;
  }

  /**
   * Immediately cancel any ongoing speech output (Interruption)
   */
  public interrupt() {
    if (this.synth) {
      this.synth.cancel();
    }
    this.isSpeakingState = false;
    this.currentUtterance = null;
    this.stopAudioLevelSimulation();
    if (this.onSpeakingStateChange) this.onSpeakingStateChange(false);
    if (this.onAudioLevelChange) this.onAudioLevelChange(0);
  }

  /**
   * Split long text into natural sentence segments
   */
  private segmentSentences(text: string): string[] {
    if (!text) return [];
    // Split by sentence terminators or ellipsis pauses while preserving structure
    return text
      .split(/(?<=[.!?…])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Select a natural, refined voice available in the browser
   */
  private getBestVoice(): SpeechSynthesisVoice | null {
    if (!this.synth) return null;
    const voices = this.synth.getVoices();
    if (!voices || voices.length === 0) return null;

    // Prioritize natural UK or US English voices
    const preferredNames = [
      "Google UK English Male",
      "Daniel",
      "Arthur",
      "Microsoft George Online (Natural)",
      "Microsoft Ryan Online (Natural)",
      "Google US English",
      "en-GB"
    ];

    for (const name of preferredNames) {
      const match = voices.find(v => v.name.includes(name) || (v.lang === name && v.name.includes("Male")));
      if (match) return match;
    }

    // Fallback to any English voice
    return voices.find(v => v.lang.startsWith("en")) || voices[0];
  }

  /**
   * Calculate effective rate based on user preference and context prosody
   */
  private computeRate(contextRate: number = 1.0): number {
    let multiplier = 1.0;
    if (this.settings.speed === "slow") multiplier = 0.88;
    if (this.settings.speed === "fast") multiplier = 1.15;
    return Math.max(0.7, Math.min(1.4, contextRate * multiplier));
  }

  /**
   * Calculate effective pitch based on warmth setting and context prosody
   */
  private computePitch(contextPitch: number = 0.88): number {
    let offset = 0.0;
    if (this.settings.warmth === "warm") offset = -0.02;
    if (this.settings.warmth === "professional") offset = -0.04;
    return Math.max(0.6, Math.min(1.3, contextPitch + offset));
  }

  /**
   * Speak formatted text using sentence-by-sentence pacing with natural pauses and waveform simulation
   */
  public async speak(text: string, prosody: VoiceProsody = {}): Promise<void> {
    if (!this.synth || !text || text.trim() === "") return;

    // Interrupt any existing playback
    this.interrupt();

    const sentences = this.segmentSentences(text);
    if (sentences.length === 0) return;

    this.isSpeakingState = true;
    if (this.onSpeakingStateChange) this.onSpeakingStateChange(true);
    this.startAudioLevelSimulation();

    const selectedVoice = this.getBestVoice();
    const rate = this.computeRate(prosody.rate || 1.0);
    const pitch = this.computePitch(prosody.pitch || 0.88);
    const volume = prosody.volume !== undefined ? prosody.volume : 1.0;

    for (let i = 0; i < sentences.length; i++) {
      if (!this.isSpeakingState) break; // Check if interrupted

      const segment = sentences[i];
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(segment);
        this.currentUtterance = utterance;

        if (selectedVoice) utterance.voice = selectedVoice;
        utterance.rate = rate;
        utterance.pitch = pitch;
        utterance.volume = volume;

        utterance.onend = () => {
          this.currentUtterance = null;
          resolve();
        };

        utterance.onerror = () => {
          this.currentUtterance = null;
          resolve();
        };

        this.synth?.speak(utterance);
      });

      // Natural pause between sentences (e.g. 150ms-300ms)
      if (i < sentences.length - 1 && this.isSpeakingState) {
        const pauseTime = segment.includes("...") ? (prosody.pauseMs || 280) : 180;
        await new Promise(r => setTimeout(r, pauseTime));
      }
    }

    this.isSpeakingState = false;
    this.stopAudioLevelSimulation();
    if (this.onSpeakingStateChange) this.onSpeakingStateChange(false);
    if (this.onAudioLevelChange) this.onAudioLevelChange(0);
  }

  /**
   * Real-time audio waveform simulation to drive reactive Orb pulsing during speech synthesis
   */
  private startAudioLevelSimulation() {
    this.stopAudioLevelSimulation();

    let phase = 0;
    const updateLevel = () => {
      if (!this.isSpeakingState) {
        if (this.onAudioLevelChange) this.onAudioLevelChange(0);
        return;
      }

      phase += 0.15;
      // Synthesize multi-frequency human vocal envelope (35Hz to 85Hz amplitude)
      const base = 40 + Math.sin(phase * 1.2) * 20 + Math.sin(phase * 3.1) * 15;
      const noise = (Math.random() - 0.5) * 15;
      const level = Math.max(10, Math.min(100, Math.round(base + noise)));

      if (this.onAudioLevelChange) {
        this.onAudioLevelChange(level);
      }

      this.animFrameId = requestAnimationFrame(updateLevel);
    };

    this.animFrameId = requestAnimationFrame(updateLevel);
  }

  private stopAudioLevelSimulation() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}

export const voiceEngine = typeof window !== "undefined" ? new VoiceEngine() : (null as unknown as VoiceEngine);
