"use client";

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { sanitizeHudMarkup, rewriteUrl } from "@/lib/sanitise";
import CONFIG from "@/lib/config";
import {
  X,
  Maximize2,
  Minimize2,
  ExternalLink,
  Camera,
  Layers,
  FileText,
  Move,
  RefreshCw,
  Eye,
  Film,
  Image as ImageIcon
} from "lucide-react";

export interface BladeData {
  id: string;
  title: string;
  type: "article" | "image" | "gallery" | "video" | "embed" | "camera" | "web_reader" | "live_page" | "mission" | "markup";
  content?: string;
  url?: string;
  mediaUrl?: string;
  images?: string[];
  mode?: "reader" | "live";
  metadata?: Record<string, any>;
}

interface BladesContainerProps {
  blades: BladeData[];
  onCloseBlade: (id: string) => void;
  onFocusBlade?: (id: string) => void;
}

const DISK_PATH = /^\/(Users|home|root|Volumes|Applications|System|Library|private|tmp|var|opt|mnt|media|srv|data)\//;

function viaProxy(raw: string, route: "image" | "media" = "image"): string {
  const src = String(raw || "").trim();
  if (!src) return "";
  const path = src.replace(/^file:\/\//, "");
  if (DISK_PATH.test(path)) {
    return `${CONFIG.PROXY_URL}/file?path=${encodeURIComponent(path)}`;
  }
  if (!/^https?:\/\//i.test(src)) return src;
  if (src.startsWith(`${CONFIG.API_BASE_URL}/`)) return src;
  return `${CONFIG.PROXY_URL}/${route}?url=${encodeURIComponent(src)}`;
}

function pageUrl(url: string, mode: "reader" | "live" = "reader") {
  return `${CONFIG.PROXY_URL}/page?mode=${mode}&url=${encodeURIComponent(url)}`;
}

const CameraBladeView = memo(function CameraBladeView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let mounted = true;

    navigator.mediaDevices?.getUserMedia({ video: { width: 1280, height: 720 }, audio: false })
      .then((s) => {
        if (!mounted) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      })
      .catch((err) => {
        setError(`Webcam unavailable: ${err.message || "Permission denied"}`);
      });

    return () => {
      mounted = false;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-red-400 font-mono text-xs h-full">
        <Camera className="w-8 h-8 mb-2 opacity-50" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
      <div className="absolute top-3 left-3 bg-red-500/80 text-white px-2 py-0.5 rounded-full text-[10px] font-mono tracking-widest flex items-center gap-1.5 shadow-lg animate-pulse">
        <span className="w-2 h-2 rounded-full bg-white" /> LIVE OBSERVATION
      </div>
    </div>
  );
});

const BladeBody = memo(function BladeBody({ blade }: { blade: BladeData }) {
  if (blade.type === "camera") {
    return <CameraBladeView />;
  }

  if ((blade.type === "article" || blade.type === "web_reader" || blade.type === "live_page") && blade.url) {
    const mode = blade.type === "live_page" ? "live" : (blade.mode || "reader");
    return (
      <iframe
        className="w-full h-full border-0 bg-[#080d1a]"
        src={pageUrl(blade.url, mode)}
        sandbox={mode === "live" ? "allow-scripts" : "allow-scripts"}
        referrerPolicy="no-referrer"
        title={blade.title}
      />
    );
  }

  if (blade.type === "embed" && blade.url) {
    return (
      <iframe
        className="w-full h-full border-0 bg-black"
        src={blade.url}
        sandbox="allow-scripts allow-same-origin allow-presentation"
        allow="accelerometer; encrypted-media; picture-in-picture; fullscreen"
        referrerPolicy="no-referrer"
        allowFullScreen
        title={blade.title}
      />
    );
  }

  if (blade.type === "video" && (blade.mediaUrl || blade.url)) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <video
          className="max-w-full max-h-full"
          src={viaProxy(blade.mediaUrl || blade.url || "", "media")}
          controls
          playsInline
          preload="metadata"
        />
      </div>
    );
  }

  if (blade.type === "image" && (blade.mediaUrl || blade.url)) {
    return (
      <div className="w-full h-full bg-black/60 flex items-center justify-center p-2 overflow-auto">
        <img
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-cyan-500/20"
          src={viaProxy(blade.mediaUrl || blade.url || "", "image")}
          alt={blade.title}
        />
      </div>
    );
  }

  if (blade.type === "gallery" && blade.images) {
    return (
      <div className="w-full h-full overflow-y-auto p-4 grid grid-cols-2 gap-3 bg-[#0a0e1a]">
        {blade.images.map((src, i) => (
          <img
            key={`${src}-${i}`}
            className="w-full h-44 object-cover rounded-lg border border-cyan-500/20 hover:border-cyan-400 transition-colors"
            src={viaProxy(src, "image")}
            alt={`Gallery ${i}`}
          />
        ))}
      </div>
    );
  }

  if ((blade.type === "markup" || blade.content) && blade.content) {
    return (
      <div
        className="w-full h-full overflow-y-auto p-6 text-sm text-slate-200 font-sans leading-relaxed bg-[#0b0f1d]"
        dangerouslySetInnerHTML={{ __html: sanitizeHudMarkup(blade.content) }}
      />
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center text-slate-400 font-mono text-xs">
      No content stream active for this blade.
    </div>
  );
});

function BladeCard({
  blade,
  depth,
  focused,
  expanded,
  onFocus,
  onExpand,
  onClose
}: {
  blade: BladeData;
  depth: number;
  focused: boolean;
  expanded: boolean;
  onFocus: () => void;
  onExpand: () => void;
  onClose: () => void;
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Drag handler through native PointerEvent on window
  const handleDragStart = (e: React.PointerEvent) => {
    if (expanded) return;
    e.preventDefault();
    e.stopPropagation();
    onFocus();

    const startX = e.clientX;
    const startY = e.clientY;
    const initX = pos.x;
    const initY = pos.y;

    const handlePointerMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      setPos({ x: initX + dx, y: initY + dy });
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  // Resize handler
  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFocus();

    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startW = size?.w || rect.width;
    const startH = size?.h || rect.height;
    const startX = e.clientX;
    const startY = e.clientY;

    const handlePointerMove = (ev: PointerEvent) => {
      const nw = Math.max(340, Math.min(window.innerWidth - 60, startW + (ev.clientX - startX)));
      const nh = Math.max(260, Math.min(window.innerHeight - 80, startH + (ev.clientY - startY)));
      setSize({ w: nw, h: nh });
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const zIndex = 50 - depth;
  const scale = expanded ? 1 : Math.max(0.85, 1 - depth * 0.04);
  const opacity = expanded ? 1 : Math.max(0.65, 1 - depth * 0.12);

  return (
    <motion.div
      ref={cardRef}
      onPointerDown={onFocus}
      layout={!pos.x && !pos.y}
      initial={{ opacity: 0, scale: 0.9, y: 30 }}
      animate={{
        opacity,
        scale,
        x: expanded ? 0 : pos.x,
        y: expanded ? 0 : pos.y,
        transition: { type: "spring", stiffness: 350, damping: 30 }
      }}
      exit={{ opacity: 0, scale: 0.85, y: 20, transition: { duration: 0.2 } }}
      style={{
        zIndex,
        width: expanded ? "calc(100vw - 48px)" : (size?.w ? `${size.w}px` : "520px"),
        height: expanded ? "calc(100vh - 84px)" : (size?.h ? `${size.h}px` : "480px"),
        top: expanded ? "16px" : undefined,
        left: expanded ? "24px" : undefined,
      }}
      className={`absolute rounded-2xl overflow-hidden flex flex-col backdrop-blur-2xl shadow-2xl transition-shadow ${
        focused
          ? "border border-cyan-400/50 shadow-[0_12px_45px_rgba(0,240,255,0.22)] ring-1 ring-cyan-500/30"
          : "border border-cyan-500/20 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
      } bg-[#070b16]/95`}
    >
      {/* Blade Header & Grab Bar */}
      <div
        onPointerDown={handleDragStart}
        className={`h-11 px-4 flex items-center justify-between select-none cursor-grab active:cursor-grabbing border-b ${
          focused
            ? "bg-cyan-950/40 border-cyan-500/30 text-cyan-200"
            : "bg-black/40 border-white/5 text-slate-300"
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden mr-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-wider font-semibold truncate">
            {blade.title || "BLADE CONTENT"}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase">
            {blade.type}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onExpand(); }}
            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-cyan-300 transition-colors"
            title={expanded ? "Restore" : "Fullscreen"}
          >
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-1.5 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
            title="Close Blade"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Blade Content Surface */}
      <div className="flex-1 relative overflow-hidden">
        <BladeBody blade={blade} />
      </div>

      {/* Bottom Resize Grip */}
      {!expanded && (
        <div
          onPointerDown={handleResizeStart}
          className="absolute bottom-1 right-1 w-4 h-4 cursor-se-resize flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity"
          title="Drag to resize blade"
        >
          <div className="w-2 h-2 border-r-2 border-b-2 border-cyan-400 rounded-br-sm" />
        </div>
      )}
    </motion.div>
  );
}

export default function Blades({
  blades,
  onCloseBlade,
  onFocusBlade
}: BladesContainerProps) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (blades.length > 0 && (!focusedId || !blades.find(b => b.id === focusedId))) {
      setFocusedId(blades[blades.length - 1].id);
    }
  }, [blades, focusedId]);

  if (blades.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-40 flex items-center justify-center p-6 overflow-hidden">
      <div className="relative w-full h-full flex items-center justify-center pointer-events-auto">
        <AnimatePresence>
          {blades.map((blade, index) => {
            const depth = blades.length - 1 - index;
            const isFocused = blade.id === (focusedId || blades[blades.length - 1]?.id);
            const isExpanded = blade.id === expandedId;

            return (
              <BladeCard
                key={blade.id}
                blade={blade}
                depth={isExpanded ? 0 : (isFocused ? 0 : depth + 1)}
                focused={isFocused}
                expanded={isExpanded}
                onFocus={() => {
                  setFocusedId(blade.id);
                  if (onFocusBlade) onFocusBlade(blade.id);
                }}
                onExpand={() => {
                  setExpandedId(prev => prev === blade.id ? null : blade.id);
                  setFocusedId(blade.id);
                }}
                onClose={() => {
                  if (expandedId === blade.id) setExpandedId(null);
                  onCloseBlade(blade.id);
                }}
              />
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
