"use client";

import { useState, useEffect, FormEvent } from "react";
import JarvisOrb from "@/components/JarvisOrb";
import TerminalLog, { LogEntry } from "@/components/TerminalLog";
import MissionTracker, { Mission } from "@/components/MissionTracker";
import ToolActivityFeed, { ToolLogItem } from "@/components/ToolActivityFeed";
import MemoryMatrixView, { MemoryFact } from "@/components/MemoryMatrixView";
import SecurityApprovalModal, { SecurityConfirmation } from "@/components/SecurityApprovalModal";
import MissionControl from "@/components/MissionControl";
import PermissionCenter from "@/components/PermissionCenter";
import DeveloperMode from "@/components/DeveloperMode";
import SkillsHub from "@/components/SkillsHub";
import KnowledgeVaultView from "@/components/KnowledgeVaultView";
import GameverseHub from "@/gameverse/components/GameverseHub";
import DocumentReaderHUD from "@/components/DocumentReaderHUD";
import { documentReaderController, ReadingSessionState } from "@/lib/reading/DocumentReaderController";

import {
  Mic, Search, LogOut, ShieldAlert, Cpu, Flag, Brain, Gamepad2,
  LayoutDashboard, Shield, Terminal, Sparkles, BookOpen, Bell, ArrowRight, X, Volume2, MicOff, Sliders,
  Zap, Bot, Play, Pause, Square, ChevronDown
} from "lucide-react";
import { useSpeech } from "@/hooks/useSpeech";
import { useWakeWord } from "@/hooks/useWakeWord";
import VoiceSettingsModal from "@/components/VoiceSettingsModal";
import { auth, provider, signInWithPopup, signOut } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Cognitive State & Orb
  const [cognitiveState, setCognitiveState] = useState("IDLE");
  const [orbEmotion, setOrbEmotion] = useState("neutral");
  const [autonomyScore, setAutonomyScore] = useState(88);
  const [operatingMode, setOperatingMode] = useState("ZERO_FRICTION");
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState(false);

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "missions" | "skills" | "vault" | "permissions" | "dev" | "gameverse" | "memory"
  >("dashboard");

  // Proactive suggestions
  const [proactiveSuggestions, setProactiveSuggestions] = useState<any[]>([]);

  // Logs & Events
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: "1", type: "system", text: "JARVIS 3.0 Perception, Voice 2.0 & Compute Fabric online." },
    { id: "2", type: "system", text: "Natural Acoustic Voice & Prosody Engine initialized." },
    { id: "3", type: "system", text: "Offline Wake-Word Detector & Distributed Compute Fabric active." },
  ]);

  const [toolLogs, setToolLogs] = useState<ToolLogItem[]>([]);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [missionsList, setMissionsList] = useState<Mission[]>([]);
  const [memoryFacts, setMemoryFacts] = useState<MemoryFact[]>([]);
  const [memoryPreferences, setMemoryPreferences] = useState<Record<string, string>>({});
  const [pendingConfirmation, setPendingConfirmation] = useState<SecurityConfirmation | null>(null);

  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [readingSession, setReadingSession] = useState<ReadingSessionState | null>(null);
  const [isReadingHudVisible, setIsReadingHudVisible] = useState(false);

  const { isListening, isSpeaking, speechLevel, toggleListening, transcript, speak, interrupt } = useSpeech({
    onError: (err) => {
      setLogs(prev => [...prev, { id: Date.now().toString() + "_err", type: "system", text: `[SPEECH_ERR] ${err}` }]);
    }
  });

  // Subscribe to Document Reader Controller
  useEffect(() => {
    if (!documentReaderController) return;
    const unsub = documentReaderController.subscribe((s) => {
      setReadingSession(s);
      if (s.status === "READING" || s.status === "PAUSED" || s.status === "VERIFYING") {
        setIsReadingHudVisible(true);
      }
    });
    return unsub;
  }, []);

  // Offline Wake-Word Hook
  const { isMicMuted, voiceState, toggleMicMute, audioLevel } = useWakeWord({
    onWakeWord: (phrase) => {
      // Natural interruption: cancel any active speech output
      interrupt();
      setLogs(prev => [...prev, { id: Date.now().toString() + "_wake", type: "system", text: `[OFFLINE_WAKE] Detected "${phrase}". Listening for command...` }]);
      setCognitiveState("LISTENING");
    },
    onVoiceCommand: (cmd) => {
      interrupt();
      setLogs(prev => [...prev, { id: Date.now().toString() + "_vcmd", type: "system", text: `[VOICE_CONTROL] Interruption executed: "${cmd}"` }]);

      // Direct reading session voice controls
      const lower = cmd.toLowerCase().trim();
      if (documentReaderController && (documentReaderController.isReading || documentReaderController.isPaused)) {
        if (lower.includes("pause") || lower.includes("hold on")) {
          documentReaderController.pauseReading();
        } else if (lower.includes("continue") || lower.includes("resume") || lower.includes("keep reading")) {
          documentReaderController.resumeReading();
        } else if (lower.includes("stop") || lower.includes("halt") || lower.includes("cancel")) {
          documentReaderController.stopReading("User voice stop command");
        } else if (lower.includes("repeat") || lower.includes("replay")) {
          documentReaderController.repeatCurrentSegment();
        } else if (lower.includes("skip") || lower.includes("next")) {
          documentReaderController.skipToSegment();
        } else if (lower.includes("start over") || lower.includes("restart")) {
          documentReaderController.restartReading();
        } else if (lower.includes("retry")) {
          documentReaderController.retryCurrentSegment();
        }
      }

      refreshMissions();
    }
  });

  // Fetch initial system data
  const refreshMemory = async () => {
    try {
      const res = await fetch("http://localhost:4000/api/memory");
      if (res.ok) {
        const data = await res.json();
        setMemoryFacts(data.facts || []);
        setMemoryPreferences(data.preferences || {});
      }
    } catch (_) {}
  };

  const refreshMissions = async () => {
    try {
      const res = await fetch("http://localhost:4000/api/missions");
      if (res.ok) {
        const data = await res.json();
        setActiveMission(data.active || null);
        setMissionsList(data.missions || []);
      }
    } catch (_) {}
  };

  const refreshProactive = async () => {
    try {
      const res = await fetch("http://localhost:4000/api/proactive");
      if (res.ok) {
        const data = await res.json();
        setProactiveSuggestions(data.suggestions || []);
      }
    } catch (_) {}
  };

  const refreshStatus = async () => {
    try {
      const res = await fetch("http://localhost:4000/api/status");
      if (res.ok) {
        const data = await res.json();
        if (typeof data.autonomyScore === 'number') setAutonomyScore(data.autonomyScore);
        if (data.operatingMode) setOperatingMode(data.operatingMode);
      }
    } catch (_) {}
  };

  const handleSwitchMode = async (mode: string) => {
    try {
      const res = await fetch("http://localhost:4000/api/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode })
      });
      if (res.ok) {
        const data = await res.json();
        setOperatingMode(data.mode);
        setIsModeDropdownOpen(false);
        setLogs(prev => [...prev, { id: Date.now().toString() + "_mode", type: "system", text: `[OPERATING_MODE] Switched to ${data.mode}` }]);
      }
    } catch (_) {}
  };

  const handleEmergencyOverride = async (action: string) => {
    try {
      const res = await fetch("http://localhost:4000/api/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(prev => [...prev, { id: Date.now().toString() + "_ovr", type: "system", text: `[USER_OVERRIDE] ${data.message || action}` }]);
        refreshMissions();
      }
    } catch (_) {}
  };

  useEffect(() => {
    refreshMemory();
    refreshMissions();
    refreshProactive();
    refreshStatus();

    const eventSource = new EventSource("http://localhost:4000/api/events");
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'STATE_CHANGE') {
          setCognitiveState(data.state);
          if (data.payload?.tool) {
            setToolLogs(prev => [
              {
                id: Date.now().toString(),
                toolName: data.payload.tool,
                args: data.payload.args,
                status: "EXECUTING",
                timestamp: new Date().toISOString()
              },
              ...prev
            ]);
          }
          if (data.payload?.subtask) {
            refreshMissions();
          }
        } else if (data.type === 'TASK_EVENT' || data.type === 'JOBS_UPDATED') {
          refreshMissions();
        } else if (data.type === 'WORLD_MODEL_UPDATED') {
          refreshProactive();
          refreshStatus();
        } else if (data.type === 'VOICE_STATE_CHANGE') {
          if (data.state === 'WAKE_WORD_DETECTED') setCognitiveState('LISTENING');
        }
      } catch (_) {}
    };

    return () => eventSource.close();
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      setAuthLoading(false);
      if (usr) {
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
        setLogs(prev => [...prev, { id: "auth_" + Date.now(), type: "ai", text: `${greeting}, ${usr.displayName || 'Sir'}. JARVIS 3.0 AI OS is fully online. Vision, Voice & Compute ready.` }]);
      }
    });
    return unsub;
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      alert("Authentication Failed:\n" + err.message);
    }
  };

  useEffect(() => {
    if (transcript) {
      const lower = transcript.toLowerCase();
      if (lower.startsWith("jarvis") || lower.startsWith("hey jarvis")) {
        const cleaned = transcript.replace(/^(hey\s+)?jarvis,?\s*/i, '');
        setInputText(cleaned);
      } else {
        setInputText(transcript);
      }
    }
  }, [transcript]);

  // Execute Command
  const handleCommand = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const command = inputText.trim();
    if (!command) return;

    setLogs(prev => [...prev, { id: Date.now().toString(), type: "user", text: command }]);
    setInputText("");
    setIsLoading(true);

    const lowerCmd = command.toLowerCase();
    if (lowerCmd.includes("gameverse") || lowerCmd.includes("launch game") || lowerCmd.includes("play ")) {
      setActiveTab("gameverse");
    }

    try {
      const response = await fetch("http://localhost:4000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: command })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Network error");
      }

      const data = await response.json();

      if (data.emotion) setOrbEmotion(data.emotion);

      if (data.confirmationRequired) {
        setPendingConfirmation(data.confirmationRequired);
        setLogs(prev => [...prev, { id: Date.now().toString() + "_sec", type: "system", text: `[SECURITY_HOLD] Action requires human authorization: ${data.confirmationRequired.toolName}` }]);
      }

      if (data.action) {
        if (data.action.type === "DOCUMENT_READING_START" && data.action.document) {
          if (documentReaderController) {
            documentReaderController.loadDocument(data.action.document);
            setIsReadingHudVisible(true);
            // Speak brief acknowledgment first, then begin verbatim reading session
            speak(data.spokenText || "Of course. I'll read it.", data.voiceProsody);
            setTimeout(() => {
              documentReaderController.startReading(1);
            }, 1200);
          }
        } else if (data.action.type === "READING_CONTROL") {
          const cmd = data.action.command;
          if (documentReaderController) {
            if (cmd === "PAUSE") documentReaderController.pauseReading();
            else if (cmd === "RESUME") documentReaderController.resumeReading();
            else if (cmd === "STOP") documentReaderController.stopReading("Direct stop command");
            else if (cmd === "REPEAT") documentReaderController.repeatCurrentSegment();
            else if (cmd === "SKIP") documentReaderController.skipToSegment(data.action.nextSegment);
            else if (cmd === "RESTART") documentReaderController.restartReading();
            else if (cmd === "RETRY") documentReaderController.retryCurrentSegment();
          }
          if (data.spokenText) {
            speak(data.spokenText, data.voiceProsody);
          }
        } else {
          setToolLogs(prev => [
            {
              id: Date.now().toString(),
              toolName: data.action.name,
              args: data.action.args,
              status: "COMPLETED",
              timestamp: new Date().toISOString()
            },
            ...prev
          ]);
          const spokenDelivery = data.spokenText || data.text;
          speak(spokenDelivery, data.voiceProsody);
        }
      } else {
        const spokenDelivery = data.spokenText || data.text;
        speak(spokenDelivery, data.voiceProsody);
      }

      setLogs(prev => [...prev, { id: Date.now().toString() + "_ai", type: "ai", text: data.text }]);
      refreshMissions();
      refreshMemory();
      refreshProactive();
      refreshStatus();

    } catch (error: unknown) {
      console.error(error);
      const errorText = error instanceof Error ? error.message : String(error);
      setLogs(prev => [...prev, { id: Date.now().toString() + "_err", type: "system", text: `[SYS_ERR] ${errorText}` }]);
    }
    setIsLoading(false);
  };

  const handleSecurityDecision = async (id: string, approved: boolean) => {
    try {
      const res = await fetch("http://localhost:4000/api/security/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, approved })
      });
      const data = await res.json();
      setPendingConfirmation(null);
      
      setLogs(prev => [...prev, {
        id: Date.now().toString() + "_sec_res",
        type: "system",
        text: approved ? `[SECURITY_APPROVED] Execution output: ${data.result}` : `[SECURITY_DENIED] Action blocked by user.`
      }]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDismissProactive = async (id: string) => {
    try {
      await fetch("http://localhost:4000/api/proactive/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      refreshProactive();
    } catch (_) {}
  };

  if (authLoading) {
    return <div className="h-screen w-full bg-[#070913] flex items-center justify-center text-cyan-400 font-mono text-sm animate-pulse">SYNCHRONIZING NEURAL CORE 3.0...</div>;
  }

  if (!user) {
    return (
      <div className="h-screen w-full bg-[#070913] flex flex-col items-center justify-center text-white relative font-sans">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="z-10 p-10 glass-panel border border-cyan-500/30 rounded-3xl flex flex-col items-center max-w-sm w-full text-center shadow-[0_0_50px_rgba(0,240,255,0.15)]">
          <ShieldAlert size={48} className="text-cyan-400 mb-4 animate-pulse" />
          <h1 className="text-lg font-bold tracking-[0.3em] font-mono uppercase text-cyan-300 mb-2">JARVIS 3.0 AI OS</h1>
          <p className="text-xs text-white/60 mb-6">Biometric clearance required to initiate central neural operating system.</p>
          <button 
            onClick={handleLogin}
            className="w-full bg-cyan-600/30 hover:bg-cyan-500/40 text-cyan-300 border border-cyan-400/50 py-3 rounded-xl font-mono text-xs transition-all shadow-[0_0_20px_rgba(0,240,255,0.2)] font-semibold"
          >
            INITIALIZE AUTHENTICATION
          </button>
          <button 
            onClick={() => setUser({ uid: "dev-override", email: "admin@jarvis.local", displayName: "Creator" } as unknown as User)}
            className="w-full mt-3 bg-white/5 hover:bg-white/10 text-white/40 border border-white/10 py-2 rounded-xl font-mono text-[10px] transition-all"
          >
            [DEV OVERRIDE] BYPASS SECRETS
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="h-screen w-full bg-[#070913] text-white flex flex-col overflow-hidden font-sans selection:bg-cyan-500/30 relative">
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-cyan-500/5 rounded-full blur-[180px] pointer-events-none" />

      {/* Security Approval Modal */}
      <SecurityApprovalModal 
        confirmation={pendingConfirmation}
        onApprove={(id) => handleSecurityDecision(id, true)}
        onDeny={(id) => handleSecurityDecision(id, false)}
      />

      {/* Voice 2.0 Settings Modal */}
      <VoiceSettingsModal
        isOpen={isVoiceSettingsOpen}
        onClose={() => setIsVoiceSettingsOpen(false)}
      />

      {/* Top Navbar */}
      <header className="h-14 border-b border-white/10 px-6 flex justify-between items-center z-20 glass-panel flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_#00f0ff]" />
          <h1 className="font-mono text-xs tracking-[0.3em] font-bold text-cyan-300 uppercase">JARVIS 3.0 AI OS</h1>
          <span className="text-[9px] font-mono bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/20">
            SCORE: {autonomyScore}/100
          </span>
          <button
            onClick={toggleMicMute}
            className={`text-[9px] font-mono px-2 py-0.5 rounded border flex items-center gap-1 transition-all ${
              isMicMuted 
                ? 'bg-red-500/20 text-red-400 border-red-500/40' 
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            }`}
            title="Toggle Microphone Mute"
          >
            {isMicMuted ? <MicOff size={10} /> : <Mic size={10} />}
            {isMicMuted ? 'MIC MUTED' : 'WAKE WORD ONLINE'}
          </button>
          <button
            onClick={() => setIsVoiceSettingsOpen(true)}
            className="text-[9px] font-mono px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 flex items-center gap-1 hover:bg-cyan-500/20 transition-all cursor-pointer shadow-[0_0_10px_rgba(0,240,255,0.15)]"
            title="Calibrate JARVIS Voice 2.0 Settings"
          >
            <Sliders size={10} /> VOICE 2.0
          </button>

          {/* Mode Switcher Pill */}
          <div className="relative">
            <button
              onClick={() => setIsModeDropdownOpen(prev => !prev)}
              className={`text-[9px] font-mono px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all shadow-sm ${
                operatingMode === 'ZERO_FRICTION'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                  : operatingMode === 'AUTONOMOUS'
                  ? 'bg-blue-500/20 text-blue-300 border-blue-400/50 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                  : 'bg-purple-500/20 text-purple-300 border-purple-400/50'
              }`}
              title="Change Operating Autonomy Mode"
            >
              {operatingMode === 'ZERO_FRICTION' ? (
                <Zap size={10} className="text-amber-400 fill-amber-400/30 animate-pulse" />
              ) : operatingMode === 'AUTONOMOUS' ? (
                <Bot size={10} className="text-blue-400" />
              ) : (
                <Shield size={10} className="text-purple-400" />
              )}
              <span className="font-bold tracking-wide">
                {operatingMode === 'ZERO_FRICTION' ? '⚡ ZERO-FRICTION' : operatingMode === 'AUTONOMOUS' ? '🤖 AUTONOMOUS' : '🛡️ ASSISTED'}
              </span>
              <ChevronDown size={10} className={`transition-transform ${isModeDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isModeDropdownOpen && (
              <div className="absolute left-0 mt-1.5 w-52 bg-[#090d1a] border border-cyan-500/30 rounded-xl p-1.5 shadow-2xl z-50 flex flex-col gap-1 font-mono text-[10px]">
                <button
                  onClick={() => handleSwitchMode('ZERO_FRICTION')}
                  className={`p-2 rounded-lg flex items-center gap-2 text-left transition-colors ${operatingMode === 'ZERO_FRICTION' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-white/70 hover:bg-white/5'}`}
                >
                  <Zap size={12} className="text-amber-400" />
                  <div>
                    <div className="text-white font-semibold">Zero-Friction Mode</div>
                    <div className="text-[9px] text-white/40">Direct, decisive, maximum speed</div>
                  </div>
                </button>
                <button
                  onClick={() => handleSwitchMode('AUTONOMOUS')}
                  className={`p-2 rounded-lg flex items-center gap-2 text-left transition-colors ${operatingMode === 'AUTONOMOUS' ? 'bg-blue-500/20 text-blue-300 font-bold' : 'text-white/70 hover:bg-white/5'}`}
                >
                  <Bot size={12} className="text-blue-400" />
                  <div>
                    <div className="text-white font-semibold">Autonomous Mode</div>
                    <div className="text-[9px] text-white/40">Balanced multi-step execution</div>
                  </div>
                </button>
                <button
                  onClick={() => handleSwitchMode('ASSISTED')}
                  className={`p-2 rounded-lg flex items-center gap-2 text-left transition-colors ${operatingMode === 'ASSISTED' ? 'bg-purple-500/20 text-purple-300 font-bold' : 'text-white/70 hover:bg-white/5'}`}
                >
                  <Shield size={12} className="text-purple-400" />
                  <div>
                    <div className="text-white font-semibold">Assisted Mode</div>
                    <div className="text-[9px] text-white/40">Guided step-by-step confirmation</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Live Mission Emergency Control Buttons */}
          {activeMission && (
            <div className="flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-lg border border-amber-500/40 animate-pulse">
              <span className="text-[9px] font-mono text-amber-400 font-bold mr-1">MISSION IN PROGRESS</span>
              <button
                onClick={() => handleEmergencyOverride(activeMission.status === 'PAUSED' ? 'resume' : 'pause')}
                className="p-1 hover:bg-white/10 rounded text-amber-300 transition-colors"
                title={activeMission.status === 'PAUSED' ? "Resume Mission" : "Pause Mission"}
              >
                {activeMission.status === 'PAUSED' ? <Play size={10} /> : <Pause size={10} />}
              </button>
              <button
                onClick={() => handleEmergencyOverride('cancel')}
                className="p-1 hover:bg-red-500/20 rounded text-red-400 transition-colors"
                title="Stop / Abort Mission"
              >
                <Square size={10} />
              </button>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 font-mono text-xs overflow-x-auto">
          <button 
            onClick={() => setActiveTab("dashboard")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${activeTab === 'dashboard' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold' : 'text-white/50 hover:text-white'}`}
          >
            <LayoutDashboard size={13} /> Command
          </button>
          <button 
            onClick={() => setActiveTab("missions")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${activeTab === 'missions' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold' : 'text-white/50 hover:text-white'}`}
          >
            <Flag size={13} /> Mission Control
          </button>
          <button 
            onClick={() => setActiveTab("skills")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${activeTab === 'skills' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold' : 'text-white/50 hover:text-white'}`}
          >
            <Sparkles size={13} /> Skills Hub
          </button>
          <button 
            onClick={() => setActiveTab("vault")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${activeTab === 'vault' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold' : 'text-white/50 hover:text-white'}`}
          >
            <BookOpen size={13} /> Knowledge Vault
          </button>
          <button 
            onClick={() => setActiveTab("permissions")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${activeTab === 'permissions' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold' : 'text-white/50 hover:text-white'}`}
          >
            <Shield size={13} /> Security
          </button>
          <button 
            onClick={() => setActiveTab("dev")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${activeTab === 'dev' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold' : 'text-white/50 hover:text-white'}`}
          >
            <Terminal size={13} /> Dev Mode
          </button>
          <button 
            onClick={() => setActiveTab("gameverse")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${activeTab === 'gameverse' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold' : 'text-white/50 hover:text-white'}`}
          >
            <Gamepad2 size={13} className="text-purple-400 animate-pulse" /> GAMEVERSE
          </button>
          <button 
            onClick={() => setActiveTab("memory")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${activeTab === 'memory' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold' : 'text-white/50 hover:text-white'}`}
          >
            <Brain size={13} /> Memory 2.0
          </button>
        </div>

        <button 
          onClick={() => signOut(auth)} 
          className="text-white/40 hover:text-red-400 p-2 transition-colors flex items-center gap-1 font-mono text-xs"
        >
          <LogOut size={14} />
        </button>
      </header>

      {/* Proactive Intelligence Suggestion Banner */}
      {proactiveSuggestions.length > 0 && (
        <div className="bg-cyan-500/10 border-b border-cyan-500/30 px-6 py-2 flex items-center justify-between z-10 font-mono text-xs flex-shrink-0 animate-fade-in">
          <div className="flex items-center gap-2 text-cyan-300">
            <Bell size={14} className="text-cyan-400 animate-bounce" />
            <span className="font-bold">[PROACTIVE INTEL]:</span>
            <span className="text-white/80">{proactiveSuggestions[0].description}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setInputText(`Execute proactive suggestion: ${proactiveSuggestions[0].title}`);
                handleDismissProactive(proactiveSuggestions[0].id);
              }}
              className="px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
            >
              EXECUTE <ArrowRight size={10} />
            </button>
            <button
              onClick={() => handleDismissProactive(proactiveSuggestions[0].id)}
              className="p-1 text-white/40 hover:text-white transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 p-6 relative z-10 flex overflow-hidden">
        
        {/* Tab 1: Central Command Dashboard */}
        {activeTab === "dashboard" && (
          <div className="w-full h-full flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-80 flex flex-col gap-6 flex-shrink-0">
              <div className="h-1/2">
                <MissionTracker activeMission={activeMission} missionsList={missionsList} />
              </div>
              <div className="h-1/2">
                <ToolActivityFeed logs={toolLogs} />
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center relative min-h-[450px]">
              {/* Active Document Reader Visual HUD */}
              {isReadingHudVisible && readingSession && (
                <div className="absolute top-0 left-0 right-0 z-40 max-w-2xl mx-auto w-full px-2 animate-fade-in">
                  <DocumentReaderHUD onClose={() => setIsReadingHudVisible(false)} />
                </div>
              )}

              <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${isReadingHudVisible ? 'opacity-30 scale-90 pointer-events-none' : 'opacity-100 scale-100'}`}>
                <JarvisOrb 
                  isListening={isListening || isLoading}
                  isSpeaking={isSpeaking || (readingSession?.status === 'READING')}
                  speechLevel={speechLevel}
                  audioLevel={audioLevel}
                  emotion={orbEmotion} 
                  cognitiveState={cognitiveState} 
                />
              </div>

              <div className="absolute bottom-4 w-full max-w-xl px-4 z-50">
                <form onSubmit={handleCommand} className="relative group flex items-center shadow-2xl">
                  <Search size={16} className="absolute left-5 text-white/30 group-focus-within:text-cyan-400 transition-colors" />
                  <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Awaiting directive (e.g. 'Click Submit button', 'Run data analysis on compute cluster')..."
                    disabled={isLoading}
                    className="w-full bg-black/60 border border-white/10 rounded-full py-4 pl-12 pr-14 text-sm outline-none focus:border-cyan-500/60 focus:bg-black/80 transition-all placeholder:text-white/30 font-light backdrop-blur-xl"
                  />
                  <button 
                    type="button" 
                    onClick={toggleListening}
                    className={`absolute right-4 p-2 rounded-full transition-all ${isListening ? 'bg-cyan-500/30 text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.4)]' : 'hover:bg-cyan-500/20 text-cyan-400'}`}
                  >
                    <Mic size={18} />
                  </button>
                </form>
              </div>
            </div>

            <div className="w-full md:w-96 flex-shrink-0 h-full">
              <TerminalLog logs={logs} />
            </div>
          </div>
        )}

        {/* Tab 2: Mission Control */}
        {activeTab === "missions" && (
          <div className="w-full h-full max-w-6xl mx-auto">
            <MissionControl 
              activeMission={activeMission} 
              missionsList={missionsList} 
              autonomyScore={autonomyScore}
              onRefresh={refreshMissions}
            />
          </div>
        )}

        {/* Tab 3: Skills Hub */}
        {activeTab === "skills" && (
          <div className="w-full h-full max-w-6xl mx-auto">
            <SkillsHub />
          </div>
        )}

        {/* Tab 4: Knowledge Vault */}
        {activeTab === "vault" && (
          <div className="w-full h-full max-w-6xl mx-auto">
            <KnowledgeVaultView />
          </div>
        )}

        {/* Tab 5: Permission Center */}
        {activeTab === "permissions" && (
          <div className="w-full h-full max-w-6xl mx-auto">
            <PermissionCenter />
          </div>
        )}

        {/* Tab 6: Developer Mode */}
        {activeTab === "dev" && (
          <div className="w-full h-full max-w-6xl mx-auto">
            <DeveloperMode />
          </div>
        )}

        {/* Tab 7: Gameverse Platform */}
        {activeTab === "gameverse" && (
          <div className="w-full h-full max-w-6xl mx-auto">
            <GameverseHub />
          </div>
        )}

        {/* Tab 8: Memory Matrix 2.0 */}
        {activeTab === "memory" && (
          <div className="w-full h-full max-w-4xl mx-auto">
            <MemoryMatrixView facts={memoryFacts} preferences={memoryPreferences} onRefresh={refreshMemory} />
          </div>
        )}

      </div>
    </main>
  );
}
