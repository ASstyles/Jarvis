"use client";

import React, { useState, useEffect } from "react";
import { X, Volume2, Mic, Sliders, Zap, Shield, Sparkles } from "lucide-react";
import { voiceEngine, VoiceSettings } from "@/lib/voice/VoiceEngine";

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VoiceSettingsModal({ isOpen, onClose }: VoiceSettingsModalProps) {
  const [settings, setSettings] = useState<VoiceSettings>({
    speed: "normal",
    warmth: "warm",
    brevity: "balanced",
    spokenProgress: "normal",
    interruptionsEnabled: true,
    wakeWordEnabled: true
  });

  useEffect(() => {
    if (voiceEngine) {
      setSettings(voiceEngine.settings);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const updateSetting = <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    if (voiceEngine) {
      voiceEngine.saveSettings(updated);
    }
  };

  const handleTestVoice = () => {
    if (voiceEngine) {
      voiceEngine.speak("Voice systems nominal. Pacing, prosody, and natural acoustic resonance calibrated.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-[#0b0f19] border border-cyan-500/30 rounded-2xl w-full max-w-lg overflow-hidden shadow-[0_0_50px_rgba(0,240,255,0.15)] flex flex-col font-sans">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-black/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Sliders size={18} />
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold text-cyan-300 tracking-wider uppercase">
                JARVIS VOICE 2.0 CONFIGURATION
              </h2>
              <p className="text-[10px] text-white/50">Acoustic prosody, brevity, and natural delivery calibration</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[70vh]">
          
          {/* 1. Speech Speed */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono text-cyan-400 font-semibold flex items-center gap-1.5">
              <Zap size={14} /> SPEECH SPEED
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["slow", "normal", "fast"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => updateSetting("speed", s)}
                  className={`py-2 px-3 rounded-xl border font-mono text-xs capitalize transition-all ${
                    settings.speed === s
                      ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                      : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Voice Warmth & Tone */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono text-cyan-400 font-semibold flex items-center gap-1.5">
              <Sparkles size={14} /> VOICE WARMTH & TONE
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["neutral", "warm", "professional"] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => updateSetting("warmth", w)}
                  className={`py-2 px-3 rounded-xl border font-mono text-xs capitalize transition-all ${
                    settings.warmth === w
                      ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                      : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Spoken Brevity */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono text-cyan-400 font-semibold flex items-center gap-1.5">
              <Volume2 size={14} /> RESPONSE BREVITY
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["concise", "balanced", "detailed"] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => updateSetting("brevity", b)}
                  className={`py-2 px-3 rounded-xl border font-mono text-xs capitalize transition-all ${
                    settings.brevity === b
                      ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                      : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Toggles */}
          <div className="flex flex-col gap-3 pt-2 border-t border-white/10">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-mono text-white font-medium">Natural Voice Interruption</span>
                <p className="text-[10px] text-white/40">Immediately stops speech when user begins speaking or says "stop"</p>
              </div>
              <input
                type="checkbox"
                checked={settings.interruptionsEnabled}
                onChange={(e) => updateSetting("interruptionsEnabled", e.target.checked)}
                className="w-4 h-4 accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-mono text-white font-medium">Offline Wake-Word Detection</span>
                <p className="text-[10px] text-white/40">Continuous local listening for "JARVIS" / "Hey JARVIS"</p>
              </div>
              <input
                type="checkbox"
                checked={settings.wakeWordEnabled}
                onChange={(e) => updateSetting("wakeWordEnabled", e.target.checked)}
                className="w-4 h-4 accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/40 flex justify-between items-center">
          <button
            onClick={handleTestVoice}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-mono text-xs text-white/80 transition-all flex items-center gap-1.5"
          >
            <Volume2 size={13} className="text-cyan-400" /> TEST VOICE DELIVERY
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 rounded-xl font-mono text-xs font-bold transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)]"
          >
            APPLY CALIBRATION
          </button>
        </div>

      </div>
    </div>
  );
}
