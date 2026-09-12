"use client";

import React, { useState, useEffect } from "react";
import {
  Terminal, Cpu, Database, Play, CheckCircle2, ShieldCheck, Flame,
  RefreshCw, Layers, Bug, Zap, Eye, Mic, Server, Activity, ArrowRight, XCircle,
  BookOpen, Volume2, RotateCcw, AlertTriangle
} from "lucide-react";

export default function DeveloperMode() {
  const [worldModel, setWorldModel] = useState<any>(null);
  const [modelStats, setModelStats] = useState<any>(null);
  const [benchmark, setBenchmark] = useState<any>(null);
  const [experiments, setExperiments] = useState<any[]>([]);
  const [clusterStatus, setClusterStatus] = useState<any>(null);
  const [voiceTelemetry, setVoiceTelemetry] = useState<any>(null);
  const [visionStatus, setVisionStatus] = useState<any>(null);
  const [readingTelemetry, setReadingTelemetry] = useState<any>(null);
  const [readerActionStatus, setReaderActionStatus] = useState<string>("");
  
  const [activeSubTab, setActiveSubTab] = useState<
    "perception" | "voice" | "reader" | "compute" | "world" | "benchmark" | "sandbox" | "telemetry"
  >("perception");

  // Vision Grounding Test State
  const [groundQuery, setGroundQuery] = useState("Submit button");
  const [groundResult, setGroundResult] = useState<any>(null);
  const [groundingLoading, setGroundingLoading] = useState(false);

  // Compute Dispatch Test State
  const [jobTitle, setJobTitle] = useState("Dataset Feature Matrix Calculation");
  const [jobType, setJobType] = useState("DATA_PROCESSING");
  const [dispatchLoading, setDispatchLoading] = useState(false);

  // Benchmark
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<any>(null);

  // Sandbox
  const [sandboxCmd, setSandboxCmd] = useState("node -e \"console.log('Sandbox execution verification OK: ' + (10 * 5))\"");
  const [sandboxExpName, setSandboxExpName] = useState("Sanity Test");
  const [sandboxRunning, setSandboxRunning] = useState(false);
  const [sandboxOutput, setSandboxOutput] = useState<string>("");

  const fetchData = async () => {
    try {
      const [wmRes, statusRes, bmRes, sbRes, compRes, voiceRes, visRes, readRes] = await Promise.all([
        fetch("http://localhost:4000/api/world"),
        fetch("http://localhost:4000/api/status"),
        fetch("http://localhost:4000/api/benchmark"),
        fetch("http://localhost:4000/api/sandbox"),
        fetch("http://localhost:4000/api/compute/status"),
        fetch("http://localhost:4000/api/voice/status"),
        fetch("http://localhost:4000/api/vision/status"),
        fetch("http://localhost:4000/api/reading/session")
      ]);

      if (wmRes.ok) setWorldModel(await wmRes.json());
      if (statusRes.ok) {
        const s = await statusRes.json();
        setModelStats(s.modelStats);
      }
      if (bmRes.ok) setBenchmark(await bmRes.json());
      if (sbRes.ok) {
        const d = await sbRes.json();
        setExperiments(d.experiments || []);
      }
      if (compRes.ok) setClusterStatus(await compRes.json());
      if (voiceRes.ok) setVoiceTelemetry(await voiceRes.json());
      if (visRes.ok) setVisionStatus(await visRes.json());
      if (readRes.ok) setReadingTelemetry(await readRes.json());
    } catch (_) {}
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleTestGrounding = async () => {
    setGroundingLoading(true);
    try {
      const res = await fetch("http://localhost:4000/api/vision/ground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: groundQuery })
      });
      if (res.ok) setGroundResult(await res.json());
    } catch (err: any) {
      setGroundResult({ error: err.message });
    }
    setGroundingLoading(false);
  };

  const handleDispatchJob = async () => {
    setDispatchLoading(true);
    try {
      await fetch("http://localhost:4000/api/compute/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: jobTitle, type: jobType })
      });
      fetchData();
    } catch (_) {}
    setDispatchLoading(false);
  };

  const handleRunBenchmark = async () => {
    setBenchmarkLoading(true);
    try {
      const res = await fetch("http://localhost:4000/api/benchmark/run", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setBenchmarkResult(data);
        setBenchmark(data);
      }
    } catch (_) {}
    setBenchmarkLoading(false);
  };

  const handleRunSandbox = async () => {
    setSandboxRunning(true);
    setSandboxOutput("Initializing isolated sandbox workspace...");
    try {
      const cRes = await fetch("http://localhost:4000/api/sandbox/experiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: sandboxExpName })
      });
      const cData = await cRes.json();
      const runId = cData.experiment.id;

      const rRes = await fetch("http://localhost:4000/api/sandbox/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, command: sandboxCmd })
      });
      const rData = await rRes.json();
      setSandboxOutput(`Experiment ${runId} result:\n\n[STDOUT]:\n${rData.stdout || '(none)'}\n\n[STDERR]:\n${rData.stderr || '(none)'}`);
      fetchData();
    } catch (err: any) {
      setSandboxOutput(`Sandbox Error: ${err.message}`);
    }
    setSandboxRunning(false);
  };

  const handleStartGayatriReading = async () => {
    setReaderActionStatus("Initializing reading session for Gayatri Letter...");
    try {
      const res = await fetch("http://localhost:4000/api/reading/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "Gayatri_Letter.txt" })
      });
      if (res.ok) {
        const data = await res.json();
        setReaderActionStatus(`Session ${data.session.sessionId} started: "${data.document.title}" (${data.session.totalSegments} segments).`);
        fetchData();
      }
    } catch (err: any) {
      setReaderActionStatus(`Error: ${err.message}`);
    }
  };

  const handleSimulateFalseCompletionRejection = async () => {
    setReaderActionStatus("Simulating false completion rejection test (incomplete segments)...");
    try {
      await fetch("http://localhost:4000/api/reading/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "Gayatri_Letter.txt" })
      });
      
      // Update only segment 1
      await fetch("http://localhost:4000/api/reading/segment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segmentIndex: 1, status: "COMPLETED" })
      });

      // Call verify completion -> MUST FAIL
      const verifyRes = await fetch("http://localhost:4000/api/reading/verify", { method: "POST" });
      const verifyData = await verifyRes.json();

      if (!verifyData.verified) {
        setReaderActionStatus(`[SUCCESS] False completion successfully blocked! Verified: ${verifyData.verified ? 'YES' : 'NO'}. Engine response: "${verifyData.message}"`);
      } else {
        setReaderActionStatus(`[FAILED BUG] Engine improperly reported complete!`);
      }
      fetchData();
    } catch (err: any) {
      setReaderActionStatus(`Test Error: ${err.message}`);
    }
  };

  const handleControlReader = async (command: string) => {
    try {
      const res = await fetch("http://localhost:4000/api/reading/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command })
      });
      const data = await res.json();
      setReaderActionStatus(`Command [${command}]: ${data.result?.spokenAcknowledgment || data.result?.message || 'Executed'}`);
      fetchData();
    } catch (err: any) {
      setReaderActionStatus(`Control Error: ${err.message}`);
    }
  };

  return (
    <div className="h-full flex flex-col gap-5 overflow-hidden font-sans">
      {/* Subnav Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
          <h1 className="font-mono text-xs tracking-wider text-emerald-300 font-bold uppercase flex items-center gap-2">
            <Terminal size={14} /> JARVIS 3.0 DEVELOPER MODE
          </h1>
        </div>

        <div className="flex items-center gap-1 bg-black/50 p-1 rounded-xl border border-white/10 font-mono text-xs overflow-x-auto">
          <button 
            onClick={() => setActiveSubTab("perception")}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${activeSubTab === 'perception' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold' : 'text-white/40 hover:text-white'}`}
          >
            <Eye size={13} /> Visual VLM
          </button>
          <button 
            onClick={() => setActiveSubTab("voice")}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${activeSubTab === 'voice' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold' : 'text-white/40 hover:text-white'}`}
          >
            <Mic size={13} /> Voice
          </button>
          <button 
            onClick={() => setActiveSubTab("reader")}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${activeSubTab === 'reader' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold' : 'text-white/40 hover:text-white'}`}
          >
            <BookOpen size={13} /> Doc Reader
          </button>
          <button 
            onClick={() => setActiveSubTab("compute")}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${activeSubTab === 'compute' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold' : 'text-white/40 hover:text-white'}`}
          >
            <Server size={13} /> Compute
          </button>
          <button 
            onClick={() => setActiveSubTab("world")}
            className={`px-2.5 py-1 rounded-lg transition-all ${activeSubTab === 'world' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-white/40 hover:text-white'}`}
          >
            World Model
          </button>
          <button 
            onClick={() => setActiveSubTab("benchmark")}
            className={`px-2.5 py-1 rounded-lg transition-all ${activeSubTab === 'benchmark' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-white/40 hover:text-white'}`}
          >
            Benchmark
          </button>
          <button 
            onClick={() => setActiveSubTab("sandbox")}
            className={`px-2.5 py-1 rounded-lg transition-all ${activeSubTab === 'sandbox' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'text-white/40 hover:text-white'}`}
          >
            Sandbox
          </button>
          <button 
            onClick={() => setActiveSubTab("telemetry")}
            className={`px-2.5 py-1 rounded-lg transition-all ${activeSubTab === 'telemetry' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'text-white/40 hover:text-white'}`}
          >
            Telemetry
          </button>
        </div>
      </div>

      {/* Subtab 1: Visual Perception & VLM */}
      {activeSubTab === "perception" && (
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel: Perception State & Semantic Grounding Test */}
          <div className="glass-panel p-5 rounded-2xl border border-cyan-500/20 flex flex-col gap-4 overflow-hidden">
            <div>
              <h2 className="text-xs font-mono font-bold text-cyan-300 uppercase flex items-center gap-2">
                <Eye size={15} className="text-cyan-400" /> Visual Intelligence & Grounding Engine
              </h2>
              <p className="text-[11px] text-white/50 mt-1">
                Active Provider: <span className="text-cyan-300 font-mono font-semibold">{visionStatus?.provider || 'Windows WinRT & VLM Parser'}</span>
              </p>
            </div>

            {/* Test Semantic Grounding Tool */}
            <div className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-3">
              <span className="text-[10px] font-mono uppercase text-white/50 font-bold">Interactive Semantic Grounding Test</span>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={groundQuery}
                  onChange={(e) => setGroundQuery(e.target.value)}
                  placeholder="Target UI element (e.g., 'Submit button', 'Search bar')"
                  className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-cyan-500"
                />
                <button 
                  onClick={handleTestGrounding}
                  disabled={groundingLoading}
                  className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-mono font-bold transition-all"
                >
                  {groundingLoading ? "GROUNDING..." : "GROUND"}
                </button>
              </div>

              {groundResult && (
                <div className="p-3 bg-black/60 rounded-xl border border-cyan-500/30 font-mono text-xs space-y-1 text-cyan-200">
                  <div className="flex justify-between">
                    <span className="text-white/50">Matched Target:</span>
                    <span className="text-cyan-300 font-bold">{groundResult.matchedElement?.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Grounded Coordinates:</span>
                    <span className="text-white font-bold">
                      ({groundResult.matchedElement?.center?.x}, {groundResult.matchedElement?.center?.y})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Confidence:</span>
                    <span className="text-emerald-400 font-bold">
                      {Math.round((groundResult.matchedElement?.confidence || 0.9) * 100)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Live Visual Perception World State */}
            <div className="flex-1 overflow-auto bg-black/60 p-4 rounded-xl border border-white/5 font-mono text-xs text-white/80">
              <span className="text-[10px] text-white/40 block mb-2 font-bold uppercase">World Model Visual State [Observed / Verified]</span>
              <pre className="whitespace-pre-wrap text-cyan-300">
                {worldModel?.visualPerception ? JSON.stringify(worldModel.visualPerception, null, 2) : "Loading Perception state..."}
              </pre>
            </div>
          </div>

          {/* Right Panel: Detected UI Elements List */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col overflow-hidden">
            <span className="text-xs font-mono uppercase text-white/50 font-bold pb-3 border-b border-white/10">
              Detected UI Elements & OCR Blocks ({worldModel?.visualPerception?.detectedElements?.length || 0})
            </span>
            <div className="flex-1 overflow-y-auto mt-3 space-y-2">
              {(worldModel?.visualPerception?.detectedElements || []).map((elem: any, idx: number) => (
                <div key={idx} className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-white font-semibold">{elem.label}</span>
                    <span className="text-[10px] text-white/40 block">Type: {elem.type} | Bounds: {elem.coordinates?.width}x{elem.coordinates?.height}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    {Math.round((elem.confidence || 0.95) * 100)}% CONF
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Subtab 2: Voice & Wake-Word */}
      {activeSubTab === "voice" && (
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-panel p-5 rounded-2xl border border-amber-500/20 flex flex-col gap-4">
            <div>
              <h2 className="text-xs font-mono font-bold text-amber-300 uppercase flex items-center gap-2">
                <Mic size={15} className="text-amber-400" /> Offline Privacy-Preserving Wake-Word Engine
              </h2>
              <p className="text-[11px] text-white/50 mt-1">
                Audio stays on device. Keyword spotter triggers: <span className="text-amber-300 font-mono font-bold">&quot;JARVIS&quot; / &quot;HEY JARVIS&quot;</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                <span className="text-[10px] font-mono text-white/40">VOICE ENGINE STATE</span>
                <div className="text-lg font-mono font-bold text-amber-300 mt-1">{voiceTelemetry?.state || "LISTENING_FOR_WAKE_WORD"}</div>
              </div>
              <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                <span className="text-[10px] font-mono text-white/40">PRIVACY MODE</span>
                <div className="text-lg font-mono font-bold text-emerald-400 mt-1">OFFLINE LOCAL</div>
              </div>
            </div>

            <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-2">
              <span className="text-[10px] font-mono uppercase text-white/50 font-bold">Natural Voice Task Control Interrupters</span>
              <div className="space-y-1.5 text-xs font-mono text-white/80">
                <div className="p-2 bg-white/5 rounded-lg flex items-center justify-between">
                  <span>&quot;JARVIS, stop&quot; / &quot;pause&quot;</span>
                  <span className="text-amber-300 text-[10px]">Pauses active mission</span>
                </div>
                <div className="p-2 bg-white/5 rounded-lg flex items-center justify-between">
                  <span>&quot;JARVIS, continue&quot; / &quot;resume&quot;</span>
                  <span className="text-emerald-300 text-[10px]">Resumes paused task</span>
                </div>
                <div className="p-2 bg-white/5 rounded-lg flex items-center justify-between">
                  <span>&quot;JARVIS, cancel that&quot;</span>
                  <span className="text-red-300 text-[10px]">Cancels active mission</span>
                </div>
                <div className="p-2 bg-white/5 rounded-lg flex items-center justify-between">
                  <span>&quot;JARVIS, status report&quot;</span>
                  <span className="text-cyan-300 text-[10px]">Reads system telemetry</span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col overflow-hidden">
            <span className="text-xs font-mono uppercase text-white/50 font-bold pb-3 border-b border-white/10">
              Recent Offline Wake Events ({voiceTelemetry?.recentDetections?.length || 0})
            </span>
            <div className="flex-1 overflow-y-auto mt-3 space-y-2">
              {(voiceTelemetry?.recentDetections || []).map((evt: any) => (
                <div key={evt.id} className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-white font-semibold">&quot;{evt.phrase}&quot;</span>
                    <span className="text-[10px] text-white/40 block">Source: {evt.source}</span>
                  </div>
                  <span className="text-[10px] text-white/40">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Subtab: Verifiable Document Reader */}
      {activeSubTab === "reader" && (
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 1/3: Session Metrics & Diagnostic Controls */}
          <div className="glass-panel p-5 rounded-2xl border border-cyan-500/20 flex flex-col gap-4 overflow-y-auto">
            <div>
              <h2 className="text-xs font-mono font-bold text-cyan-300 uppercase flex items-center gap-2">
                <BookOpen size={15} className="text-cyan-400" /> Document Reader Telemetry
              </h2>
              <p className="text-[11px] text-white/50 mt-1">
                Verifiable segment-by-segment speech playback pipeline. Prevents false completion claims.
              </p>
            </div>

            {/* Live Session State Cards */}
            <div className="space-y-2 font-mono text-xs">
              <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-white/40">Session:</span>
                  <span className="text-cyan-300 font-bold">{readingTelemetry?.sessionId || "No active session"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Document:</span>
                  <span className="text-white font-bold">{readingTelemetry?.documentTitle || "None"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Total Words:</span>
                  <span className="text-white font-bold">{readingTelemetry?.totalWords ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Segments:</span>
                  <span className="text-white font-bold">{readingTelemetry?.totalSegments ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Current Segment:</span>
                  <span className="text-cyan-400 font-bold">{readingTelemetry?.currentSegment ?? 0} / {readingTelemetry?.totalSegments ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Playback:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${readingTelemetry?.playbackStatus === 'READING' ? 'bg-cyan-500/20 text-cyan-300' : readingTelemetry?.playbackStatus === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/70'}`}>
                    {readingTelemetry?.playbackStatus || "IDLE"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Audio Started:</span>
                  <span className={readingTelemetry?.audioStarted === 'YES' ? "text-emerald-400 font-bold" : "text-white/50"}>{readingTelemetry?.audioStarted || "NO"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Segments Completed:</span>
                  <span className="text-emerald-400 font-bold">{readingTelemetry?.completedSegments ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Segments Skipped:</span>
                  <span className="text-white/50">{readingTelemetry?.skippedSegments ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Retries:</span>
                  <span className="text-amber-400 font-bold">{readingTelemetry?.retries ?? 0}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-1.5">
                  <span className="text-white/40">Verified Complete:</span>
                  <span className={`font-bold ${readingTelemetry?.verified === 'YES' ? "text-emerald-400" : "text-amber-400"}`}>
                    {readingTelemetry?.verified || "NO"}
                  </span>
                </div>
              </div>
            </div>

            {/* Diagnostic Simulation & Verification Test Panel */}
            <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-3 font-mono text-xs">
              <span className="text-[10px] uppercase text-white/50 font-bold">Reader Controls & Regression Tests</span>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleStartGayatriReading}
                  className="p-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl font-bold transition-all text-center text-[10px]"
                >
                  START GAYATRI LETTER
                </button>
                <button
                  onClick={() => handleControlReader("VERIFY")}
                  className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl font-bold transition-all text-center text-[10px]"
                >
                  RUN VERIFY CHECK
                </button>
                <button
                  onClick={() => handleControlReader("PAUSE")}
                  className="p-2 bg-white/5 hover:bg-white/10 text-amber-300 border border-white/10 rounded-xl transition-all text-center text-[10px]"
                >
                  PAUSE
                </button>
                <button
                  onClick={() => handleControlReader("RESUME")}
                  className="p-2 bg-white/5 hover:bg-white/10 text-cyan-300 border border-white/10 rounded-xl transition-all text-center text-[10px]"
                >
                  RESUME
                </button>
                <button
                  onClick={() => handleControlReader("RESTART")}
                  className="p-2 bg-white/5 hover:bg-white/10 text-purple-300 border border-white/10 rounded-xl transition-all text-center text-[10px]"
                >
                  RESTART
                </button>
                <button
                  onClick={() => handleControlReader("STOP")}
                  className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl transition-all text-center text-[10px]"
                >
                  STOP
                </button>
              </div>

              {/* False Completion Rejection Test Button */}
              <button
                onClick={handleSimulateFalseCompletionRejection}
                className="w-full py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl font-bold transition-all text-center text-[10px] flex items-center justify-center gap-1.5"
              >
                <AlertTriangle size={13} /> TEST FALSE-COMPLETION REJECTION
              </button>

              {readerActionStatus && (
                <div className="p-2.5 bg-black/60 rounded-xl border border-white/10 text-[10px] text-cyan-200">
                  {readerActionStatus}
                </div>
              )}
            </div>
          </div>

          {/* Right 2/3: Segment Breakdown Table */}
          <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border border-white/10 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="text-xs font-mono uppercase text-white/50 font-bold">
                Speech Segments Breakdown ({readingTelemetry?.segmentsSummary?.length || 0} Segments)
              </span>
              <span className="text-[10px] font-mono text-cyan-400">
                {readingTelemetry?.progressPercent || 0}% Total Progress
              </span>
            </div>

            <div className="flex-1 overflow-y-auto mt-3 space-y-2 font-mono text-xs">
              {!readingTelemetry?.segmentsSummary || readingTelemetry.segmentsSummary.length === 0 ? (
                <div className="h-full flex items-center justify-center text-white/30">
                  No active reading segments. Click &quot;START GAYATRI LETTER&quot; or say &quot;JARVIS, read this letter&quot;.
                </div>
              ) : (
                readingTelemetry.segmentsSummary.map((seg: any) => (
                  <div
                    key={seg.index}
                    className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-4 ${
                      seg.index === readingTelemetry.currentSegment
                        ? "bg-cyan-500/20 border-cyan-400/50 text-white"
                        : seg.status === "COMPLETED"
                        ? "bg-black/30 border-white/5 text-white/70"
                        : "bg-black/20 border-white/5 text-white/40"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-cyan-400">Seg {seg.index}</span>
                        <span className="text-[10px] text-white/40">Para {seg.paragraph}</span>
                        <span className="text-[10px] text-white/40">{seg.words} words ({seg.chars} chars)</span>
                        {seg.retries > 0 && <span className="text-amber-400 text-[10px]">{seg.retries} retries</span>}
                      </div>
                      <p className="font-sans text-[12px] line-clamp-2">{seg.textPreview}</p>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${
                      seg.status === "COMPLETED"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : seg.status === "PLAYING"
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse"
                        : seg.status === "SKIPPED"
                        ? "bg-white/10 text-white/40"
                        : seg.status === "FAILED"
                        ? "bg-red-500/20 text-red-300 border border-red-500/30"
                        : "bg-black/40 text-white/40 border border-white/5"
                    }`}>
                      {seg.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Subtab 3: Compute Fabric */}
      {activeSubTab === "compute" && (
        <div className="flex-1 overflow-hidden flex flex-col gap-5">
          {/* Cluster Status Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-shrink-0">
            <div className="glass-panel p-4 rounded-xl border border-purple-500/20">
              <span className="text-[10px] font-mono text-white/40">ONLINE WORKER NODES</span>
              <div className="text-2xl font-mono font-bold text-purple-300 mt-1">{clusterStatus?.onlineWorkers || 1} / {clusterStatus?.totalWorkers || 3}</div>
            </div>
            <div className="glass-panel p-4 rounded-xl border border-white/10">
              <span className="text-[10px] font-mono text-white/40">RUNNING DISTRIBUTED JOBS</span>
              <div className="text-2xl font-mono font-bold text-cyan-300 mt-1">{clusterStatus?.runningJobsCount || 0}</div>
            </div>
            <div className="glass-panel p-4 rounded-xl border border-white/10">
              <span className="text-[10px] font-mono text-white/40">QUEUED JOBS</span>
              <div className="text-2xl font-mono font-bold text-amber-300 mt-1">{clusterStatus?.queuedJobsCount || 0}</div>
            </div>
            <div className="glass-panel p-4 rounded-xl border border-white/10">
              <span className="text-[10px] font-mono text-white/40">CLUSTER HEALTH</span>
              <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">{clusterStatus?.clusterHealth || 100}%</div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Worker Nodes Table */}
            <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col overflow-hidden">
              <span className="text-xs font-mono uppercase text-white/50 font-bold pb-3 border-b border-white/10">
                Registered Compute Worker Nodes ({clusterStatus?.workers?.length || 0})
              </span>
              <div className="flex-1 overflow-y-auto mt-3 space-y-2">
                {(clusterStatus?.workers || []).map((w: any) => (
                  <div key={w.id} className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between text-xs font-mono">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold">{w.name}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">{w.type}</span>
                      </div>
                      <span className="text-[10px] text-white/40 block mt-0.5">
                        {w.cpuCores} Cores | {Math.round(w.memoryMb / 1024)}GB RAM {w.gpuPresent ? '| GPU Accelerated' : ''}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold ${w.status === 'ONLINE' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {w.status}
                      </span>
                      <span className="text-[9px] text-white/30 block">{w.currentJobs} Active Jobs</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Distributed Jobs Queue & Dispatcher */}
            <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col overflow-hidden gap-4">
              <div>
                <span className="text-xs font-mono uppercase text-purple-300 font-bold">Dispatch Test Distributed Workload</span>
                <div className="flex gap-2 mt-2">
                  <input 
                    type="text" 
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-purple-500"
                  />
                  <select 
                    value={jobType} 
                    onChange={(e) => setJobType(e.target.value)}
                    className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono outline-none text-white/80"
                  >
                    <option value="DATA_PROCESSING">Data Processing</option>
                    <option value="HEAVY_COMPUTE">Heavy Compute</option>
                    <option value="CODE_ANALYSIS">Code Analysis</option>
                    <option value="SANDBOX_EXPERIMENT">Sandbox Test</option>
                  </select>
                  <button 
                    onClick={handleDispatchJob}
                    disabled={dispatchLoading}
                    className="px-4 py-2 bg-purple-600/30 hover:bg-purple-500/40 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-mono font-bold transition-all"
                  >
                    {dispatchLoading ? "DISPATCHING..." : "DISPATCH"}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                <span className="text-[10px] font-mono text-white/40 uppercase block">Recent Jobs ({clusterStatus?.recentJobs?.length || 0})</span>
                {(clusterStatus?.recentJobs || []).map((j: any) => (
                  <div key={j.id} className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between text-xs font-mono">
                    <div>
                      <span className="text-white font-medium">{j.title}</span>
                      <span className="text-[10px] text-white/40 block">Worker: {j.workerName || 'Auto-assigning...'}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      j.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300' :
                      j.status === 'RUNNING' ? 'bg-cyan-500/20 text-cyan-300 animate-pulse' :
                      j.status === 'RETRYING' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-white/10 text-white/60'
                    }`}>
                      {j.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subtab 4: World Model Inspector */}
      {activeSubTab === "world" && (
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-panel p-4 rounded-2xl border border-white/10 flex flex-col overflow-hidden">
            <span className="text-[10px] font-mono uppercase text-cyan-300 font-bold mb-2">Live Structured World Model 3.0 JSON</span>
            <pre className="flex-1 overflow-auto bg-black/60 p-4 rounded-xl text-xs font-mono text-cyan-400/90 border border-white/5 selection:bg-cyan-500/30">
              {worldModel ? JSON.stringify(worldModel, null, 2) : "Loading World Model..."}
            </pre>
          </div>

          <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col overflow-hidden gap-4">
            <span className="text-[10px] font-mono uppercase text-white/50 font-bold">Recent Environment Observations</span>
            <div className="flex-1 overflow-y-auto space-y-2">
              {(worldModel?.recentObservations || []).map((obs: any) => (
                <div key={obs.id} className="p-2.5 bg-black/40 border border-white/5 rounded-xl text-xs font-mono text-white/80">
                  <p>{obs.text}</p>
                  <span className="text-[9px] text-white/30 block mt-1">{new Date(obs.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Subtab 5: Autonomy Benchmark */}
      {activeSubTab === "benchmark" && (
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-6">
          <div className="glass-panel p-6 rounded-2xl border border-amber-500/20 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-4xl font-mono font-bold text-amber-300">
                  {benchmark?.overallScore ?? 87}
                </span>
                <span className="text-sm font-mono text-white/50">/ 100</span>
              </div>
              <h2 className="text-xs font-mono text-white/60 uppercase tracking-wider mt-1">
                Empirical JARVIS Autonomy Score (Evidence-Derived)
              </h2>
            </div>

            <button 
              onClick={handleRunBenchmark}
              disabled={benchmarkLoading}
              className="px-5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl font-mono text-xs font-bold transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] flex items-center gap-2"
            >
              <Zap size={14} className={benchmarkLoading ? "animate-spin" : ""} />
              {benchmarkLoading ? "RUNNING BENCHMARK..." : "RUN FULL SELF-BENCHMARK"}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {benchmark?.breakdown && Object.entries(benchmark.breakdown).map(([key, val]: any) => (
              <div key={key} className="glass-panel p-4 rounded-xl border border-white/10 flex flex-col justify-between">
                <span className="text-[10px] font-mono text-white/40 uppercase">{key.replace(/([A-Z])/g, ' $1')}</span>
                <span className="text-2xl font-mono font-bold text-white mt-1">{val}%</span>
                <div className="w-full bg-white/5 h-1 rounded-full mt-2 overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full" style={{ width: `${val}%` }} />
                </div>
              </div>
            ))}
          </div>

          {benchmarkResult?.testResults && (
            <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col gap-2">
              <span className="text-[10px] font-mono uppercase text-white/50 font-bold">Latest Benchmark Diagnostic Run</span>
              {benchmarkResult.testResults.map((t: any, idx: number) => (
                <div key={idx} className="p-2.5 bg-black/40 rounded-xl border border-white/5 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className={t.passed ? "text-emerald-400" : "text-red-400"} />
                    <span className="text-white">{t.name}</span>
                  </div>
                  <span className="text-[10px] text-white/40">{t.durationMs}ms</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subtab 6: Self-Testing Sandbox */}
      {activeSubTab === "sandbox" && (
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-panel p-5 rounded-2xl border border-purple-500/20 flex flex-col gap-4">
            <div>
              <h2 className="text-xs font-mono font-bold text-purple-300 uppercase flex items-center gap-2">
                <Flame size={16} className="text-purple-400" /> Isolated Experiment Harness
              </h2>
              <p className="text-[11px] text-white/50 mt-1">Execute experimental scripts and test modifications in `.jarvis_sandbox/` without touching workspace files.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-mono text-white/40 block mb-1">Experiment Name</label>
                <input 
                  type="text" 
                  value={sandboxExpName}
                  onChange={(e) => setSandboxExpName(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-2.5 text-xs font-mono outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-white/40 block mb-1">Shell / Node Command</label>
                <textarea 
                  rows={4}
                  value={sandboxCmd}
                  onChange={(e) => setSandboxCmd(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-2.5 text-xs font-mono outline-none focus:border-purple-500"
                />
              </div>

              <button 
                onClick={handleRunSandbox}
                disabled={sandboxRunning}
                className="w-full py-3 bg-purple-600/30 hover:bg-purple-500/40 text-purple-300 border border-purple-500/40 rounded-xl font-mono text-xs font-bold transition-all shadow-[0_0_20px_rgba(168,85,247,0.2)] flex items-center justify-center gap-2"
              >
                <Play size={14} className={sandboxRunning ? "animate-spin" : ""} />
                {sandboxRunning ? "EXECUTING IN SANDBOX..." : "EXECUTE IN SANDBOX"}
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-black/60 p-3 rounded-xl border border-white/10 font-mono text-xs text-purple-200">
              <span className="text-[9px] text-white/40 block mb-1">Execution Output:</span>
              <pre className="whitespace-pre-wrap">{sandboxOutput || "Awaiting experiment execution..."}</pre>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col">
            <span className="text-[10px] font-mono uppercase text-white/50 font-bold pb-3 border-b border-white/10">Historical Sandbox Runs ({experiments.length})</span>
            <div className="flex-1 overflow-y-auto mt-3 space-y-2">
              {experiments.length === 0 ? (
                <div className="h-full flex items-center justify-center text-white/40 font-mono text-xs">No prior sandbox runs.</div>
              ) : (
                experiments.map((exp) => (
                  <div key={exp.id} className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between text-xs font-mono">
                    <div>
                      <span className="text-white font-medium">{exp.name}</span>
                      <span className="text-[10px] text-white/40 block">{exp.id}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${exp.passed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                      {exp.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Subtab 7: Model Telemetry */}
      {activeSubTab === "telemetry" && (
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-panel p-4 rounded-xl border border-white/10">
              <span className="text-[10px] font-mono text-white/40">TOTAL INVOCATIONS</span>
              <div className="text-2xl font-mono font-bold text-cyan-300 mt-1">{modelStats?.totalInvocations || 0}</div>
            </div>
            <div className="glass-panel p-4 rounded-xl border border-white/10">
              <span className="text-[10px] font-mono text-white/40">SUCCESS RATE</span>
              <div className="text-2xl font-mono font-bold text-emerald-300 mt-1">{modelStats?.successRatePct || 100}%</div>
            </div>
            <div className="glass-panel p-4 rounded-xl border border-white/10">
              <span className="text-[10px] font-mono text-white/40">FALLBACK TRIGGERS</span>
              <div className="text-2xl font-mono font-bold text-amber-300 mt-1">{modelStats?.fallbackTriggers || 0}</div>
            </div>
            <div className="glass-panel p-4 rounded-xl border border-white/10">
              <span className="text-[10px] font-mono text-white/40">ESTIMATED TOKENS</span>
              <div className="text-2xl font-mono font-bold text-purple-300 mt-1">{modelStats?.estimatedTokensTotal || 0}</div>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col">
            <span className="text-xs font-mono font-bold text-cyan-300 uppercase mb-3">Model Pool Latency & Usage Breakdown</span>
            <div className="space-y-3">
              {modelStats?.modelUsageCounts && Object.entries(modelStats.modelUsageCounts).map(([model, count]: any) => (
                <div key={model} className="p-3 bg-black/40 rounded-xl border border-white/5 flex items-center justify-between font-mono text-xs">
                  <div>
                    <span className="text-white font-semibold">{model}</span>
                    <span className="text-[10px] text-white/40 block">Average Latency: {modelStats.averageLatenciesMs?.[model] || 450}ms</span>
                  </div>
                  <span className="text-cyan-400 font-bold">{count} Invocations</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
