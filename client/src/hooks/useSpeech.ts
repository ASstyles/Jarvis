"use client";
import { useState, useCallback, useRef, useEffect } from 'react';
import { voiceEngine, VoiceProsody } from '@/lib/voice/VoiceEngine';
import { fetchApi } from '@/lib/api';

export const useSpeech = (options?: { onError?: (error: string) => void }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechLevel, setSpeechLevel] = useState(0);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<any>(null);
  
  // Use a ref to store the latest onError callback so toggleListening's identity is stable
  const onErrorRef = useRef(options?.onError);
  useEffect(() => {
    onErrorRef.current = options?.onError;
  }, [options?.onError]);

  useEffect(() => {
    if (voiceEngine) {
      voiceEngine.setAudioLevelCallback((level) => {
        setSpeechLevel(level);
      });
      voiceEngine.setSpeakingStateCallback((speaking) => {
        setIsSpeaking(speaking);
      });
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (voiceEngine) {
        voiceEngine.interrupt();
      }
    };
  }, []);

  const interrupt = useCallback(() => {
    if (voiceEngine) {
      voiceEngine.interrupt();
    }
    try {
      fetchApi('/api/voice/interrupt', { method: 'POST', body: JSON.stringify({ reason: 'User manual interrupt' }) }).catch(() => {});
    } catch (_) {}
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
    } else {
      // Natural Interruption: User starts speaking -> Stop AI speech immediately
      if (voiceEngine && voiceEngine.isSpeaking) {
        voiceEngine.interrupt();
        try {
          fetchApi('/api/voice/interrupt', { method: 'POST', body: JSON.stringify({ reason: 'Voice barge-in' }) }).catch(() => {});
        } catch (_) {}
      }

      setTranscript("");
      setIsListening(true);
      
      const SpeechRecognition = 
        (window as any).SpeechRecognition || 
        (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        const errorMsg = "Speech Recognition is not supported in this browser.";
        console.error(errorMsg);
        if (onErrorRef.current) {
          onErrorRef.current(errorMsg);
        }
        setIsListening(false);
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognitionRef.current = recognition;

      recognition.onresult = (event: any) => {
        const currentTranscript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setTranscript(currentTranscript);

        // Check for quick natural interruption commands
        const lower = currentTranscript.toLowerCase().trim();
        if (lower === "stop" || lower === "cancel" || lower === "pause" || lower === "hold on") {
          if (voiceEngine) voiceEngine.interrupt();
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        let errorMsg = "";
        
        switch (event.error) {
          case 'not-allowed':
            errorMsg = "Microphone blocked! Please allow microphone access in your browser settings.";
            alert("Microphone blocked! Please click the camera/mic icon in your browser's address bar to allow microphone access.");
            break;
          case 'network':
            errorMsg = "Network error: Connection to the browser's speech recognition service failed.";
            break;
          case 'no-speech':
            errorMsg = "No speech was detected.";
            break;
          case 'audio-capture':
            errorMsg = "Audio capture failed. Ensure your microphone is plugged in and working.";
            break;
          default:
            errorMsg = `Speech recognition error: ${event.error}`;
        }

        if (onErrorRef.current) {
          onErrorRef.current(errorMsg);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognition.start();
    }
  }, [isListening]);

  const speak = useCallback((text: string, prosody?: VoiceProsody) => {
    if (voiceEngine) {
      voiceEngine.speak(text, prosody);
    }
  }, []);

  return {
    isListening,
    isSpeaking,
    speechLevel,
    transcript,
    toggleListening,
    speak,
    interrupt
  };
};
