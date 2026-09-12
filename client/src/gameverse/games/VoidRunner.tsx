"use client";

import React, { useEffect, useRef, useState } from "react";
import { GameLoop } from "../engine/GameLoop";
import { InputManager } from "../engine/InputManager";
import { soundEngine } from "../engine/SoundEngine";
import { CollisionEngine, Particle, FloatingText } from "../engine/CollisionEngine";
import { DifficultyLevel } from "../engine/AIGameDirector";
import { ArrowLeft, Trophy, Rocket, Shield, Zap } from "lucide-react";

interface GameProps {
  difficulty: DifficultyLevel;
  onBack: () => void;
  onScoreSubmit: (gameId: string, score: number, difficulty: string, stats: Record<string, unknown>) => void;
}

type Asteroid = {
  x: number;
  y: number;
  radius: number;
  speed: number;
};

type PlasmaCell = {
  x: number;
  y: number;
  radius: number;
};

export default function VoidRunner({ difficulty, onBack, onScoreSubmit }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<"PLAYING" | "GAMEOVER">("PLAYING");
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [boostEnergy, setBoostEnergy] = useState(100);

  const stateRef = useRef({
    score: 0,
    distance: 0,
    boost: 100,
    ship: { x: 375, y: 450, radius: 18, speed: 400 },
    asteroids: [] as Asteroid[],
    cells: [] as PlasmaCell[],
    particles: [] as Particle[],
    floaters: [] as FloatingText[],
    spawnTimer: 0,
    isBoosting: false,
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
      const s = state.ship;

      ctx.save();
      CollisionEngine.applyScreenShake(ctx, dt);

      // Controls
      let dx = 0, dy = 0;
      if (input.isKeyDown("w") || input.isKeyDown("arrowup")) dy -= 1;
      if (input.isKeyDown("s") || input.isKeyDown("arrowdown")) dy += 1;
      if (input.isKeyDown("a") || input.isKeyDown("arrowleft")) dx -= 1;
      if (input.isKeyDown("d") || input.isKeyDown("arrowright")) dx += 1;

      state.isBoosting = input.isKeyDown("space") && state.boost > 0;
      const currentSpeed = state.isBoosting ? s.speed * 1.6 : s.speed;

      if (state.isBoosting) {
        state.boost = Math.max(0, state.boost - 32 * dt);
        setBoostEnergy(Math.floor(state.boost));
        soundEngine.playWhoosh();
        CollisionEngine.createParticleBurst(state.particles, s.x, s.y + 16, 4, ["#00f0ff", "#3b82f6"]);
      } else {
        state.boost = Math.min(100, state.boost + 12 * dt);
        setBoostEnergy(Math.floor(state.boost));
      }

      s.x += dx * currentSpeed * dt;
      s.y += dy * currentSpeed * dt;
      s.x = Math.max(s.radius, Math.min(canvas.width - s.radius, s.x));
      s.y = Math.max(s.radius, Math.min(canvas.height - s.radius, s.y));

      // Distance & Score
      const travelStep = (state.isBoosting ? 220 : 110) * dt;
      state.distance += travelStep;
      state.score += Math.floor(travelStep);
      setDistance(Math.floor(state.distance));
      setScore(state.score);

      // Spawning
      state.spawnTimer += dt;
      if (state.spawnTimer >= 0.38) {
        state.spawnTimer = 0;
        state.asteroids.push({
          x: Math.random() * (canvas.width - 40) + 20,
          y: -30,
          radius: Math.random() * 22 + 12,
          speed: Math.random() * 160 + 220
        });

        if (Math.random() > 0.45) {
          state.cells.push({
            x: Math.random() * (canvas.width - 30) + 15,
            y: -20,
            radius: 11
          });
        }
      }

      // Move Asteroids
      for (let a = state.asteroids.length - 1; a >= 0; a--) {
        const ast = state.asteroids[a];
        ast.y += (ast.speed + (state.isBoosting ? 160 : 0)) * dt;

        if (ast.y > canvas.height + 40) {
          state.asteroids.splice(a, 1);
          continue;
        }

        if (CollisionEngine.checkCircleCollision(s.x, s.y, s.radius, ast.x, ast.y, ast.radius)) {
          state.isGameOver = true;
          setGameState("GAMEOVER");
          CollisionEngine.createParticleBurst(state.particles, s.x, s.y, 40, ["#ef4444", "#f59e0b"]);
          CollisionEngine.triggerShake(10, 0.4);
          soundEngine.playExplosion();
          onScoreSubmit("void-runner", state.score, difficulty, { distance: Math.floor(state.distance) });
          ctx.restore();
          return;
        }
      }

      // Move Plasma Cells
      for (let c = state.cells.length - 1; c >= 0; c--) {
        const cell = state.cells[c];
        cell.y += 240 * dt;

        if (cell.y > canvas.height + 30) {
          state.cells.splice(c, 1);
          continue;
        }

        if (CollisionEngine.checkCircleCollision(s.x, s.y, s.radius, cell.x, cell.y, cell.radius)) {
          state.boost = Math.min(100, state.boost + 30);
          state.score += 250;
          CollisionEngine.createFloatingText(state.floaters, cell.x, cell.y - 10, "+250 BOOST", "#00f0ff");
          soundEngine.playPickup();
          CollisionEngine.createParticleBurst(state.particles, cell.x, cell.y, 12, ["#00f0ff"]);
          state.cells.splice(c, 1);
        }
      }

      input.resetPerFrameInputs();

      // RENDER CANVAS
      ctx.fillStyle = "#070913";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Deep Space Parallax Nebulae
      const grad = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 50, canvas.width / 2, canvas.height / 2, 400);
      grad.addColorStop(0, "rgba(59, 130, 246, 0.08)");
      grad.addColorStop(1, "rgba(7, 9, 19, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Starfield Speed Streak Lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = state.isBoosting ? 2.5 : 1;
      for (let i = 0; i < 35; i++) {
        const sx = (i * 37) % canvas.width;
        const sy = (timestamp * 0.6 + i * 45) % canvas.height;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy + (state.isBoosting ? 30 : 12));
        ctx.stroke();
      }

      // Render Starship
      ctx.fillStyle = "#00f0ff";
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - s.radius);
      ctx.lineTo(s.x - s.radius, s.y + s.radius);
      ctx.lineTo(s.x + s.radius, s.y + s.radius);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Render Asteroids
      state.asteroids.forEach((ast) => {
        ctx.fillStyle = "#475569";
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ast.x, ast.y, ast.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      // Render Cells
      state.cells.forEach((cell) => {
        ctx.fillStyle = "#00f0ff";
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(cell.x, cell.y, cell.radius, 0, Math.PI * 2);
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
      <div className="w-full max-w-3xl flex justify-between items-center bg-black/60 backdrop-blur-md border border-blue-500/30 rounded-2xl p-4 mb-3 font-mono text-xs shadow-xl">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-blue-400 border border-blue-500/30 transition-all">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="font-bold text-blue-300 uppercase tracking-widest text-sm">Void Runner</h2>
            <span className="text-[10px] text-white/50">Cosmic Deep Space Flight</span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-1.5 text-blue-300">
            <Trophy size={14} /> <span>{score} PTS</span>
          </div>
          <div className="flex items-center gap-1.5 text-purple-400 font-bold">
            <Rocket size={14} /> <span>DIST: {distance}m</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-400">
            <Zap size={14} /> <span>BOOST: {boostEnergy}%</span>
          </div>
        </div>
      </div>

      {/* Main Canvas View */}
      <div className="relative border border-blue-500/40 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(59,130,246,0.15)]">
        <canvas ref={canvasRef} width={750} height={550} className="block cursor-crosshair bg-[#070913]" />

        {gameState === "GAMEOVER" && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <h3 className="text-2xl font-mono font-bold text-red-500 tracking-widest mb-2 uppercase">Ship Destroyed!</h3>
            <p className="text-xs text-white/60 mb-6">Distance Traveled: {distance}m. Score: {score}</p>
            <div className="flex gap-4">
              <button onClick={() => window.location.reload()} className="px-6 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-black font-mono font-bold text-xs">RETRY RUN</button>
              <button onClick={onBack} className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-xs">EXIT</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
