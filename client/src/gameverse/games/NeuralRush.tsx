"use client";

import React, { useEffect, useRef, useState } from "react";
import { GameLoop } from "../engine/GameLoop";
import { InputManager } from "../engine/InputManager";
import { soundEngine } from "../engine/SoundEngine";
import { CollisionEngine, Particle, FloatingText } from "../engine/CollisionEngine";
import { DifficultyLevel } from "../engine/AIGameDirector";
import { ArrowLeft, Trophy, Shield, Zap, Flame } from "lucide-react";

interface GameProps {
  difficulty: DifficultyLevel;
  onBack: () => void;
  onScoreSubmit: (gameId: string, score: number, difficulty: string, stats: Record<string, unknown>) => void;
}

type Obstacle = {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  type: "wall" | "glitch";
};

type Item = {
  x: number;
  y: number;
  radius: number;
  type: "data" | "shield";
};

export default function NeuralRush({ difficulty, onBack, onScoreSubmit }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<"PLAYING" | "GAMEOVER">("PLAYING");
  const [score, setScore] = useState(0);
  const [survivalTime, setSurvivalTime] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [hasShield, setHasShield] = useState(false);

  const stateRef = useRef({
    score: 0,
    time: 0,
    multiplier: 1,
    hasShield: false,
    player: { x: 375, y: 480, radius: 16, speed: 480 },
    obstacles: [] as Obstacle[],
    items: [] as Item[],
    particles: [] as Particle[],
    floaters: [] as FloatingText[],
    spawnTimer: 0,
    itemTimer: 0,
    baseSpeed: 260,
    isGameOver: false
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const input = new InputManager(canvas);
    input.attach(canvas);

    const loop = new GameLoop((dt, timestamp) => {
      if (stateRef.current.isGameOver) return;

      const state = stateRef.current;
      const p = state.player;

      ctx.save();
      CollisionEngine.applyScreenShake(ctx, dt);

      // Survival & Speed Scaling
      state.time += dt;
      state.baseSpeed = 260 + state.time * 9;
      setSurvivalTime(Math.floor(state.time));

      // Controls
      if (input.isKeyDown("w") || input.isKeyDown("arrowup")) p.y -= p.speed * dt;
      if (input.isKeyDown("s") || input.isKeyDown("arrowdown")) p.y += p.speed * dt;
      if (input.isKeyDown("a") || input.isKeyDown("arrowleft")) p.x -= p.speed * dt;
      if (input.isKeyDown("d") || input.isKeyDown("arrowright")) p.x += p.speed * dt;

      p.x = Math.max(p.radius, Math.min(canvas.width - p.radius, p.x));
      p.y = Math.max(p.radius, Math.min(canvas.height - p.radius, p.y));

      // Spawn Obstacles
      state.spawnTimer += dt;
      if (state.spawnTimer >= Math.max(0.22, 0.85 - state.time * 0.008)) {
        state.spawnTimer = 0;
        const w = Math.random() * 85 + 40;
        const x = Math.random() * (canvas.width - w);
        state.obstacles.push({
          x,
          y: -40,
          w,
          h: 22,
          speed: state.baseSpeed + Math.random() * 60,
          type: Math.random() > 0.3 ? "wall" : "glitch"
        });
      }

      // Spawn Items
      state.itemTimer += dt;
      if (state.itemTimer >= 1.4) {
        state.itemTimer = 0;
        state.items.push({
          x: Math.random() * (canvas.width - 30) + 15,
          y: -20,
          radius: 12,
          type: Math.random() > 0.8 ? "shield" : "data"
        });
      }

      // Update Obstacles
      for (let o = state.obstacles.length - 1; o >= 0; o--) {
        const obs = state.obstacles[o];
        obs.y += obs.speed * dt;

        if (obs.y > canvas.height + 50) {
          state.obstacles.splice(o, 1);
          state.score += Math.floor(5 * state.multiplier);
          setScore(state.score);
          continue;
        }

        const closestX = Math.max(obs.x, Math.min(p.x, obs.x + obs.w));
        const closestY = Math.max(obs.y, Math.min(p.y, obs.y + obs.h));
        const dist = CollisionEngine.getDistance(p.x, p.y, closestX, closestY);

        if (dist < p.radius) {
          if (state.hasShield) {
            state.hasShield = false;
            setHasShield(false);
            CollisionEngine.createParticleBurst(state.particles, p.x, p.y, 25, ["#00f0ff", "#ffffff"]);
            CollisionEngine.triggerShake(8, 0.3);
            soundEngine.playExplosion();
            state.obstacles.splice(o, 1);
          } else {
            state.isGameOver = true;
            setGameState("GAMEOVER");
            CollisionEngine.createParticleBurst(state.particles, p.x, p.y, 45, ["#ef4444", "#f59e0b"]);
            soundEngine.playExplosion();
            onScoreSubmit("neural-rush", state.score, difficulty, { survivalTime: Math.floor(state.time) });
            ctx.restore();
            return;
          }
        }
      }

      // Update Items
      for (let i = state.items.length - 1; i >= 0; i--) {
        const it = state.items[i];
        it.y += state.baseSpeed * 0.85 * dt;

        if (it.y > canvas.height + 30) {
          state.items.splice(i, 1);
          continue;
        }

        if (CollisionEngine.checkCircleCollision(p.x, p.y, p.radius, it.x, it.y, it.radius)) {
          if (it.type === "shield") {
            state.hasShield = true;
            setHasShield(true);
            CollisionEngine.createFloatingText(state.floaters, p.x, p.y - 15, "EMP SHIELD ACTIVE", "#00f0ff");
            soundEngine.playPickup();
          } else {
            state.score += Math.floor(50 * state.multiplier);
            state.multiplier = Math.min(8, state.multiplier + 0.5);
            setMultiplier(state.multiplier);
            setScore(state.score);
            CollisionEngine.createFloatingText(state.floaters, p.x, p.y - 15, `+${Math.floor(50 * state.multiplier)}`, "#34d399");
            soundEngine.playCombo();
          }
          CollisionEngine.createParticleBurst(state.particles, it.x, it.y, 12, ["#00f0ff", "#34d399"]);
          state.items.splice(i, 1);
        }
      }

      input.resetPerFrameInputs();

      // RENDER CANVAS
      ctx.fillStyle = "#070913";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Speed Tunnel Perspective Lines
      ctx.strokeStyle = "rgba(0, 240, 255, 0.12)";
      ctx.lineWidth = 1.5;
      for (let x = 0; x <= canvas.width; x += 45) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // Speed Motion Streaks
      ctx.strokeStyle = "rgba(0, 240, 255, 0.2)";
      ctx.lineWidth = 2;
      for (let s = 0; s < 15; s++) {
        const sx = (s * 53) % canvas.width;
        const sy = (timestamp * 0.8 + s * 40) % canvas.height;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy + 25);
        ctx.stroke();
      }

      // Render Player Core
      ctx.fillStyle = state.hasShield ? "#00f0ff" : "#a855f7";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (state.hasShield) {
        ctx.strokeStyle = "rgba(0, 240, 255, 0.8)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Obstacles
      state.obstacles.forEach((obs) => {
        ctx.fillStyle = obs.type === "glitch" ? "#ef4444" : "#f59e0b";
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 12;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.shadowBlur = 0;
      });

      // Items
      state.items.forEach((it) => {
        ctx.fillStyle = it.type === "shield" ? "#00f0ff" : "#34d399";
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(it.x, it.y, it.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

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
      <div className="w-full max-w-3xl flex justify-between items-center bg-black/60 backdrop-blur-md border border-cyan-500/30 rounded-2xl p-4 mb-3 font-mono text-xs shadow-xl">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-cyan-400 border border-cyan-500/30 transition-all">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="font-bold text-cyan-300 uppercase tracking-widest text-sm">Neural Rush</h2>
            <span className="text-[10px] text-white/50">High-Octane Speed Cyber Runner</span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-1.5 text-cyan-300">
            <Trophy size={14} /> <span>{score} PTS</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-400 font-bold">
            <Flame size={14} /> <span>{multiplier}x MULT</span>
          </div>
          <div className="flex items-center gap-1.5 text-purple-400">
            <Zap size={14} /> <span>SURVIVAL: {survivalTime}s</span>
          </div>
        </div>
      </div>

      {/* Main Canvas View */}
      <div className="relative border border-cyan-500/40 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,240,255,0.15)]">
        <canvas ref={canvasRef} width={750} height={550} className="block cursor-crosshair bg-[#070913]" />

        {gameState === "GAMEOVER" && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <h3 className="text-2xl font-mono font-bold text-red-500 tracking-widest mb-2 uppercase">Neural Core Crashed!</h3>
            <p className="text-xs text-white/60 mb-6">Survived {survivalTime} seconds. Score: {score}</p>
            <div className="flex gap-4">
              <button onClick={() => window.location.reload()} className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs">TRY AGAIN</button>
              <button onClick={onBack} className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-xs">EXIT</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
