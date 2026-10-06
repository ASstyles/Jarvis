"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { fetchApi } from "@/lib/api";

export type VoiceState =
  | "IDLE"
  | "LISTENING_FOR_WAKE_WORD"
  | "WAKE_WORD_DETECTED"
  | "LISTENING"
  | "UNDERSTANDING"
  | "PLANNING"
  | "EXECUTING"
  | "RESPONDING"
  | "MUTED";

interface UseWakeWordOptions {
  onWakeWord?: (phrase: string) => void;
  onVoiceCommand?: (command: string) => void;
  sensitivity?: number;
}

export function useWakeWord({ onWakeWord, onVoiceCommand, sensitivity = 0.65 }: UseWakeWordOptions = {}) {
  const [isWakeWordActive, setIsWakeWordActive] = useState(true);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceState, setVoiceState] = useState<VoiceState>("LISTENING_FOR_WAKE_WORD");
  const [lastWakeTimestamp, setLastWakeTimestamp] = useState<number | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize offline audio analyzer & local keyword spotting
  const initLocalAudioPipeline = useCallback(async () => {
    if (typeof window === "undefined" || isMicMuted) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const checkAudioLevels = () => {
          if (analyserRef.current && !isMicMuted) {
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const normalized = Math.min(100, Math.round((avg / 128) * 100));
            setAudioLevel(normalized);
          }
          animFrameRef.current = requestAnimationFrame(checkAudioLevels);
        };

        checkAudioLevels();
      }

      // Offline Web Speech API local continuous matcher
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          const current = event.resultIndex;
          const transcript = event.results[current][0].transcript.toLowerCase().trim();

          // Check for Wake Words: "jarvis", "hey jarvis"
          if (transcript.includes("jarvis") || transcript.includes("hey jarvis")) {
            setVoiceState("WAKE_WORD_DETECTED");
            setLastWakeTimestamp(Date.now());
            if (onWakeWord) onWakeWord(transcript);

            // Report to backend telemetry
            fetchApi("/api/voice/wakeword", {
              method: "POST",
              body: JSON.stringify({ phrase: transcript, source: "WebAudio_Local" })
            }).catch(() => {});

            setTimeout(() => setVoiceState("LISTENING"), 500);
          }

          // Check for natural control interruptions & Document Reading Session controls
          const isStop = transcript === "jarvis stop" || transcript === "stop" || transcript === "cancel that" || transcript === "halt";
          const isPause = transcript === "jarvis pause" || transcript === "pause" || transcript === "hold on";
          const isResume = transcript === "jarvis continue" || transcript === "continue" || transcript === "jarvis resume" || transcript === "resume" || transcript === "keep reading";
          const isRepeat = transcript === "repeat that" || transcript === "repeat" || transcript === "replay";
          const isSkip = transcript === "skip this" || transcript === "skip" || transcript === "next section";
          const isRestart = transcript === "start over" || transcript === "restart" || transcript === "read from beginning";
          const isRetry = transcript === "retry" || transcript === "retry section";

          if (isStop || isPause || isResume || isRepeat || isSkip || isRestart || isRetry) {
            if (onVoiceCommand) onVoiceCommand(transcript);

            fetchApi("/api/voice/command", {
              method: "POST",
              body: JSON.stringify({ command: transcript })
            }).catch(() => {});
          }
        };

        recognition.onerror = () => {};
        recognition.onend = () => {
          if (!isMicMuted && isWakeWordActive) {
            try {
              recognition.start();
            } catch (_) {}
          }
        };

        try {
          recognition.start();
          recognitionRef.current = recognition;
        } catch (_) {}
      }

    } catch (err) {
      console.warn("[USE_WAKE_WORD] Local audio initialization warning:", err);
    }
  }, [isMicMuted, isWakeWordActive, onWakeWord, onVoiceCommand]);

  useEffect(() => {
    initLocalAudioPipeline();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
    };
  }, [initLocalAudioPipeline]);

  const toggleMicMute = useCallback(() => {
    setIsMicMuted((prev) => {
      const next = !prev;
      setVoiceState(next ? "MUTED" : "LISTENING_FOR_WAKE_WORD");
      if (next && streamRef.current) {
        streamRef.current.getTracks().forEach((t) => (t.enabled = false));
      } else if (!next && streamRef.current) {
        streamRef.current.getTracks().forEach((t) => (t.enabled = true));
      }
      fetchApi("/api/voice/mute", {
        method: "POST",
        body: JSON.stringify({ muted: next })
      }).catch(() => {});
      return next;
    });
  }, []);

  const triggerManualWake = useCallback(() => {
    setVoiceState("WAKE_WORD_DETECTED");
    if (onWakeWord) onWakeWord("Manual Wake Trigger");
    setTimeout(() => setVoiceState("LISTENING"), 500);
  }, [onWakeWord]);

  return {
    isWakeWordActive,
    isMicMuted,
    audioLevel,
    voiceState,
    lastWakeTimestamp,
    toggleMicMute,
    triggerManualWake
  };
}
