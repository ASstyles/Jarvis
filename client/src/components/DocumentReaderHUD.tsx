"use client";

import React, { useState, useEffect } from "react";
import {
  BookOpen, Play, Pause, Square, RotateCcw, SkipForward, Volume2,
  CheckCircle2, AlertCircle, Sparkles, X, FileText
} from "lucide-react";
import {
  documentReaderController,
  ReadingSessionState
} from "@/lib/reading/DocumentReaderController";

interface DocumentReaderHUDProps {
  onClose?: () => void;
}

export default function DocumentReaderHUD({ onClose }: DocumentReaderHUDProps) {
  const [session, setSession] = useState<ReadingSessionState | null>(null);

  useEffect(() => {
    if (!documentReaderController) return;
    const unsub = documentReaderController.subscribe((s) => {
      setSession(s);
    });
    return unsub;
  }, []);

  if (!session) return null;

  const currentSegmentObj = session.segments.find(s => s.index === session.currentSegment);
  const progressPct = session.totalSegments > 0
    ? Math.round(((session.completedSegments + session.skippedSegments) / session.totalSegments) * 100)
    : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "READING": return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
      case "PAUSED": return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "COMPLETED": return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      case "STOPPED": return "bg-red-500/20 text-red-300 border-red-500/40";
      case "VERIFYING": return "bg-purple-500/20 text-purple-300 border-purple-500/40";
      default: return "bg-white/10 text-white/70 border-white/20";
    }
  };

  return (
    <div className="w-full bg-black/80 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl p-5 shadow-[0_0_30px_rgba(0,240,255,0.15)] flex flex-col gap-4 font-mono text-xs transition-all">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <BookOpen size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase text-cyan-400 font-bold tracking-wider">DOCUMENT READER</span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${getStatusColor(session.status)}`}>
                {session.status}
              </span>
              {session.verified && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                  <CheckCircle2 size={12} /> VERIFIED COMPLETE
                </span>
              )}
            </div>
            <h3 className="text-sm font-sans font-bold text-white mt-0.5 truncate max-w-md">
              {session.documentTitle}
            </h3>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {session.status === "READING" ? (
            <button
              onClick={() => documentReaderController.pauseReading()}
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl flex items-center gap-1.5 font-bold transition-all"
              title="Pause Reading"
            >
              <Pause size={13} /> PAUSE
            </button>
          ) : session.status === "PAUSED" ? (
            <button
              onClick={() => documentReaderController.resumeReading()}
              className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl flex items-center gap-1.5 font-bold transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)]"
              title="Resume Reading"
            >
              <Play size={13} /> RESUME
            </button>
          ) : session.status === "COMPLETED" || session.status === "STOPPED" ? (
            <button
              onClick={() => documentReaderController.restartReading()}
              className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl flex items-center gap-1.5 font-bold transition-all"
              title="Read Again"
            >
              <RotateCcw size={13} /> READ AGAIN
            </button>
          ) : null}

          <button
            onClick={() => documentReaderController.repeatCurrentSegment()}
            className="p-2 hover:bg-white/10 text-white/70 hover:text-white rounded-xl transition-colors"
            title="Repeat Current Section"
          >
            <RotateCcw size={14} />
          </button>

          <button
            onClick={() => documentReaderController.skipToSegment()}
            className="p-2 hover:bg-white/10 text-white/70 hover:text-white rounded-xl transition-colors"
            title="Skip Section"
          >
            <SkipForward size={14} />
          </button>

          <button
            onClick={() => documentReaderController.stopReading("User closed HUD")}
            className="p-2 hover:bg-red-500/20 text-white/40 hover:text-red-400 rounded-xl transition-colors"
            title="Stop Reading"
          >
            <Square size={14} />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-white/40 hover:text-white rounded-xl transition-colors ml-1"
              title="Hide Overlay"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Progress & Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
        <div className="bg-white/5 p-2.5 rounded-xl border border-white/5 flex flex-col">
          <span className="text-white/40 text-[9px] uppercase">SECTION PROGRESS</span>
          <span className="text-cyan-300 font-bold text-sm mt-0.5">
            {session.currentSegment} / {session.totalSegments}
          </span>
        </div>

        <div className="bg-white/5 p-2.5 rounded-xl border border-white/5 flex flex-col">
          <span className="text-white/40 text-[9px] uppercase">WORDS RECITED</span>
          <span className="text-white font-bold text-sm mt-0.5">
            {session.currentWordOffset} / {session.totalWords}
          </span>
        </div>

        <div className="bg-white/5 p-2.5 rounded-xl border border-white/5 flex flex-col">
          <span className="text-white/40 text-[9px] uppercase">PLAYBACK TRACKING</span>
          <span className="text-emerald-400 font-bold text-sm mt-0.5">
            {session.completedSegments} Completed ({session.skippedSegments} skipped)
          </span>
        </div>

        <div className="bg-white/5 p-2.5 rounded-xl border border-white/5 flex flex-col">
          <span className="text-white/40 text-[9px] uppercase">COMPLETION STATUS</span>
          <span className={`font-bold text-sm mt-0.5 ${session.verified ? 'text-emerald-400' : 'text-amber-300'}`}>
            {progressPct}% {session.verified ? '• Verified' : ''}
          </span>
        </div>
      </div>

      {/* Visual Progress Bar */}
      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/10 relative">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Synchronized Highlighted Spoken Text Viewport */}
      <div className="max-h-48 overflow-y-auto bg-black/60 p-4 rounded-xl border border-white/10 space-y-3 font-sans text-sm leading-relaxed select-text">
        {session.segments.map((seg) => {
          const isCurrent = seg.index === session.currentSegment;
          const isCompleted = seg.status === "COMPLETED";
          const isSkipped = seg.status === "SKIPPED";
          const isFailed = seg.status === "FAILED";

          return (
            <div
              key={seg.index}
              className={`p-2.5 rounded-xl transition-all duration-200 ${
                isCurrent
                  ? "bg-cyan-500/20 border border-cyan-400/60 shadow-[0_0_15px_rgba(0,240,255,0.2)] text-white font-medium pl-3 border-l-4 border-l-cyan-400"
                  : isCompleted
                  ? "text-white/60 hover:text-white/90"
                  : isSkipped
                  ? "text-white/30 line-through"
                  : isFailed
                  ? "bg-red-500/10 text-red-300 border border-red-500/30"
                  : "text-white/40"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-white/30 mb-1">
                <span>Section {seg.index} (Para {seg.paragraphIndex}) • {seg.wordCount} words</span>
                {isCurrent && (
                  <span className="text-cyan-400 font-bold flex items-center gap-1 animate-pulse">
                    <Volume2 size={11} /> SPEAKING NOW
                  </span>
                )}
                {isCompleted && <span className="text-emerald-400/70">✓ Spoken</span>}
                {isSkipped && <span className="text-white/40">Skipped</span>}
                {isFailed && <span className="text-red-400">Failed</span>}
              </div>
              <p className="text-[13px]">{seg.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
