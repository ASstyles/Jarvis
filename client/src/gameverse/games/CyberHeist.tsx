"use client";

import React, { useEffect, useRef, useState } from "react";
import { GameLoop } from "../engine/GameLoop";
import { InputManager } from "../engine/InputManager";
import { soundEngine } from "../engine/SoundEngine";
import { CollisionEngine, Particle, FloatingText } from "../engine/CollisionEngine";
import { DifficultyLevel } from "../engine/AIGameDirector";
import { ArrowLeft, Trophy, Key, ShieldAlert, CheckCircle2 } from "lucide-react";

interface GameProps {
  difficulty: DifficultyLevel;
  onBack: () => void;
  onScoreSubmit: (gameId: string, score: number, difficulty: string, stats: Record<string, unknown>) => void;
}

type Guard = {
  x: number;
  y: number;
  angle: number;
  patrolPoints: { x: number; y: number }[];
  currentPointIndex: number;
  speed: number;
  fovAngle: number;
  fovRadius: number;
};

type Terminal = {
  id: string;
  x: number;
  y: number;
  hacked: boolean;
  progress: number;
};

export default function CyberHeist({ difficulty, onBack, onScoreSubmit }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<"PLAYING" | "VICTORY" | "GAMEOVER">("PLAYING");
  const [score, setScore] = useState(0);
  const [detectionLevel, setDetectionLevel] = useState(0);
  const [terminalsHacked, setTerminalsHacked] = useState(0);

  const stateRef = useRef({
    score: 0,
    detection: 0,
    alertsTriggered: 0,
    player: { x: 80, y: 480, radius: 14, speed: 190 },
    guards: [
      { x: 200, y: 150, angle: 0, patrolPoints: [{ x: 200, y: 150 }, { x: 550, y: 150 }], currentPointIndex: 0, speed: 105, fovAngle: Math.PI / 3, fovRadius: 160 },
      { x: 550, y: 350, angle: Math.PI, patrolPoints: [{ x: 550, y: 350 }, { x: 200, y: 350 }], currentPointIndex: 0, speed: 115, fovAngle: Math.PI / 3, fovRadius: 160 },
      { x: 375, y: 250, angle: Math.PI / 2, patrolPoints: [{ x: 375, y: 100 }, { x: 375, y: 450 }], currentPointIndex: 0, speed: 125, fovAngle: Math.PI / 3, fovRadius: 170 }
    ] as Guard[],
    terminals: [
      { id: "t1", x: 200, y: 80, hacked: false, progress: 0 },
      { id: "t2", x: 550, y: 480, hacked: false, progress: 0 },
      { id: "t3", x: 650, y: 100, hacked: false, progress: 0 }
    ] as Terminal[],
    particles: [] as Particle[],
    floaters: [] as FloatingText[],
    isGameOver: false,
    isVictory: false
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const input = new InputManager(canvas);
    input.attach(canvas);

    const loop = new GameLoop((dt) => {
      if (stateRef.current.isGameOver || stateRef.current.isVictory) return;

      const state = stateRef.current;
      const p = state.player;

      ctx.save();
      CollisionEngine.applyScreenShake(ctx, dt);

      // Player Movement
      let dx = 0, dy = 0;
      if (input.isKeyDown("w") || input.isKeyDown("arrowup")) dy -= 1;
      if (input.isKeyDown("s") || input.isKeyDown("arrowdown")) dy += 1;
      if (input.isKeyDown("a") || input.isKeyDown("arrowleft")) dx -= 1;
      if (input.isKeyDown("d") || input.isKeyDown("arrowright")) dx += 1;

      if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

      p.x += dx * p.speed * dt;
      p.y += dy * p.speed * dt;
      p.x = Math.max(p.radius, Math.min(canvas.width - p.radius, p.x));
      p.y = Math.max(p.radius, Math.min(canvas.height - p.radius, p.y));

      // Guard Patrol & FOV Detection Check
      let detectedThisFrame = false;

      state.guards.forEach((g) => {
        const target = g.patrolPoints[g.currentPointIndex];
        const gdx = target.x - g.x;
        const gdy = target.y - g.y;
        const dist = Math.sqrt(gdx * gdx + gdy * gdy);

        if (dist < 5) {
          g.currentPointIndex = (g.currentPointIndex + 1) % g.patrolPoints.length;
        } else {
          g.angle = Math.atan2(gdy, gdx);
          g.x += (gdx / dist) * g.speed * dt;
          g.y += (gdy / dist) * g.speed * dt;
        }

        const distToPlayer = CollisionEngine.getDistance(g.x, g.y, p.x, p.y);
        if (distToPlayer <= g.fovRadius) {
          const angleToPlayer = Math.atan2(p.y - g.y, p.x - g.x);
          let angleDiff = Math.abs(angleToPlayer - g.angle);
          if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

          if (angleDiff <= g.fovAngle / 2) {
            detectedThisFrame = true;
          }
        }
      });

      if (detectedThisFrame) {
        state.detection = Math.min(100, state.detection + 45 * dt);
        CollisionEngine.triggerShake(4, 0.1);
        soundEngine.playBossAlarm();
        if (state.detection >= 100) {
          state.isGameOver = true;
          state.alertsTriggered++;
          setGameState("GAMEOVER");
          onScoreSubmit("cyber-heist", state.score, difficulty, { victory: false, alerts: state.alertsTriggered });
          ctx.restore();
          return;
        }
      } else {
        state.detection = Math.max(0, state.detection - 16 * dt);
      }
      setDetectionLevel(Math.floor(state.detection));

      // Terminal Hacking Check
      let countHacked = 0;
      state.terminals.forEach((term) => {
        if (term.hacked) {
          countHacked++;
          return;
        }

        const distToTerm = CollisionEngine.getDistance(p.x, p.y, term.x, term.y);
        if (distToTerm <= 42) {
          term.progress = Math.min(100, term.progress + 38 * dt);
          if (term.progress >= 100) {
            term.hacked = true;
            state.score += 1000;
            setScore(state.score);
            CollisionEngine.createFloatingText(state.floaters, term.x, term.y - 20, "TERMINAL HACKED! +1000", "#10b981");
            soundEngine.playLevelUp();
            CollisionEngine.createParticleBurst(state.particles, term.x, term.y, 22, ["#10b981", "#00f0ff"]);
          }
        }
      });
      setTerminalsHacked(countHacked);

      // Victory Condition (All 3 terminals hacked + reach vault exit)
      if (countHacked === state.terminals.length) {
        const exitDist = CollisionEngine.getDistance(p.x, p.y, 700, 500);
        if (exitDist <= 42) {
          state.isVictory = true;
          setGameState("VICTORY");
          onScoreSubmit("cyber-heist", state.score + 2500, difficulty, { victory: true, alerts: state.alertsTriggered });
          ctx.restore();
          return;
        }
      }

      input.resetPerFrameInputs();

      // RENDER CANVAS
      ctx.fillStyle = "#070913";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Facility Grid
      ctx.strokeStyle = "rgba(16, 185, 129, 0.05)";
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        for (let y = 0; y < canvas.height; y += 40) {
          ctx.strokeRect(x, y, 40, 40);
        }
      }

      // Vault Exit Zone
      ctx.fillStyle = countHacked === state.terminals.length ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.04)";
      ctx.strokeStyle = countHacked === state.terminals.length ? "#10b981" : "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(700, 500, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Guard Vision Cones
      state.guards.forEach((g) => {
        ctx.save();
        ctx.fillStyle = detectedThisFrame ? "rgba(239, 68, 68, 0.35)" : "rgba(245, 158, 11, 0.15)";
        ctx.beginPath();
        ctx.moveTo(g.x, g.y);
        ctx.arc(g.x, g.y, g.fovRadius, g.angle - g.fovAngle / 2, g.angle + g.fovAngle / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Guard Body
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(g.x, g.y, 12, 0, Math.PI * 2);
        ctx.fill();
      });

      // Terminals
      state.terminals.forEach((term) => {
        ctx.fillStyle = term.hacked ? "#10b981" : "#00f0ff";
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 15;
        ctx.fillRect(term.x - 14, term.y - 14, 28, 28);
        ctx.shadowBlur = 0;

        if (!term.hacked && term.progress > 0) {
          ctx.fillStyle = "rgba(0,0,0,0.8)";
          ctx.fillRect(term.x - 20, term.y - 25, 40, 6);
          ctx.fillStyle = "#10b981";
          ctx.fillRect(term.x - 20, term.y - 25, 40 * (term.progress / 100), 6);
        }
      });

      // Ghost Agent Player
      ctx.fillStyle = "#10b981";
      ctx.shadowColor = "#10b981";
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Detection Vignette
      if (state.detection > 0) {
        CollisionEngine.renderDamageVignette(ctx, canvas.width, canvas.height, state.detection / 100);
      }

      // Particles & Floaters
      CollisionEngine.updateAndRenderParticles(ctx, state.particles, dt);
      CollisionEngine.updateAndRenderFloatingText(ctx, state.floaters, dt);

      ctx.restore();
    });

    loop.start();
    return () => {
      loop.stop();
      input.detach();
    };
  }, [difficulty, onScoreSubmit]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#070913] text-white select-none overflow-hidden p-4 font-sans">
      {/* Header Bar */}
      <div className="w-full max-w-3xl flex justify-between items-center bg-black/60 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-4 mb-3 font-mono text-xs shadow-xl">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-emerald-400 border border-emerald-500/30 transition-all">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="font-bold text-emerald-300 uppercase tracking-widest text-sm">Cyber Heist</h2>
            <span className="text-[10px] text-white/50">Dark Surveillance Stealth Protocol</span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-300">
            <Trophy size={14} /> <span>{score} PTS</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Key size={14} /> <span>TERMINALS: {terminalsHacked}/3</span>
          </div>
          <div className="flex items-center gap-1.5 text-red-400 font-bold">
            <ShieldAlert size={14} /> <span>DETECTION: {detectionLevel}%</span>
          </div>
        </div>
      </div>

      {/* Main Canvas View */}
      <div className="relative border border-emerald-500/40 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(16,185,129,0.15)]">
        <canvas ref={canvasRef} width={750} height={550} className="block cursor-crosshair bg-[#070913]" />

        {gameState === "GAMEOVER" && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <h3 className="text-2xl font-mono font-bold text-red-500 tracking-widest mb-2 uppercase">Agent Compromised!</h3>
            <p className="text-xs text-white/60 mb-6">Security alerts reached maximum threshold. Score: {score}</p>
            <div className="flex gap-4">
              <button onClick={() => window.location.reload()} className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs">RETRY MISSION</button>
              <button onClick={onBack} className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-xs">EXIT</button>
            </div>
          </div>
        )}

        {gameState === "VICTORY" && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <CheckCircle2 size={48} className="text-emerald-400 mb-3 animate-bounce" />
            <h3 className="text-2xl font-mono font-bold text-emerald-400 tracking-widest mb-2 uppercase">Vault Extracted!</h3>
            <p className="text-xs text-white/60 mb-6">Stealth protocol completed cleanly! Total Score: {score}</p>
            <button onClick={onBack} className="px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs">RETURN TO GAMEVERSE</button>
          </div>
        )}
      </div>
    </div>
  );
}
