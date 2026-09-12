"use client";

import React, { useEffect, useRef, useState } from "react";
import { GameLoop } from "../engine/GameLoop";
import { InputManager } from "../engine/InputManager";
import { soundEngine } from "../engine/SoundEngine";
import { CollisionEngine, Particle, FloatingText } from "../engine/CollisionEngine";
import { AIGameDirector, DifficultyLevel } from "../engine/AIGameDirector";
import { Shield, Zap, Trophy, ArrowLeft, Radio, AlertTriangle } from "lucide-react";

interface GameProps {
  difficulty: DifficultyLevel;
  onBack: () => void;
  onScoreSubmit: (gameId: string, score: number, difficulty: string, stats: Record<string, unknown>) => void;
}

type Turret = {
  id: string;
  x: number;
  y: number;
  type: "gatling" | "plasma" | "laser" | "emp";
  range: number;
  damage: number;
  fireRate: number;
  lastFired: number;
  angle: number;
  cost: number;
};

type Enemy = {
  id: string;
  x: number;
  y: number;
  pathIndex: number;
  type: "scout" | "tank" | "boss";
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  reward: number;
};

type Bullet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  color: string;
  radius: number;
};

export default function JarvisCommand({ difficulty, onBack, onScoreSubmit }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<"PLAYING" | "VICTORY" | "GAMEOVER">("PLAYING");
  const [score, setScore] = useState(0);
  const [energy, setEnergy] = useState(400);
  const [coreHp, setCoreHp] = useState(100);
  const [wave, setWave] = useState(1);
  const [selectedTurretType, setSelectedTurretType] = useState<"gatling" | "plasma" | "laser" | "emp">("gatling");

  const stateRef = useRef({
    score: 0,
    energy: 400,
    coreHp: 100,
    wave: 1,
    turrets: [] as Turret[],
    enemies: [] as Enemy[],
    bullets: [] as Bullet[],
    particles: [] as Particle[],
    floaters: [] as FloatingText[],
    waveEnemiesToSpawn: 10,
    spawnTimer: 0,
    radarAngle: 0,
    isVictory: false,
    isGameOver: false
  });

  const directorRef = useRef(new AIGameDirector(difficulty));

  const pathPoints = [
    { x: 50, y: 0 },
    { x: 50, y: 200 },
    { x: 300, y: 200 },
    { x: 300, y: 400 },
    { x: 600, y: 400 },
    { x: 600, y: 550 }
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const input = new InputManager(canvas);
    input.attach(canvas);

    const loop = new GameLoop((dt, timestamp) => {
      if (stateRef.current.isGameOver || stateRef.current.isVictory) return;

      const state = stateRef.current;
      const mult = directorRef.current.getDifficultyMultiplier();

      ctx.save();
      CollisionEngine.applyScreenShake(ctx, dt);

      // Radar Sweep Angle
      state.radarAngle += dt * 1.5;

      // Spawning enemy waves
      state.spawnTimer += dt;
      if (state.waveEnemiesToSpawn > 0 && state.spawnTimer >= 1.4 / mult) {
        state.spawnTimer = 0;
        state.waveEnemiesToSpawn--;

        const isBossWave = state.wave % 5 === 0 && state.waveEnemiesToSpawn === 0;
        const enemyType = isBossWave ? "boss" : Math.random() > 0.7 ? "tank" : "scout";

        let hp = enemyType === "boss" ? 850 * mult : enemyType === "tank" ? 260 * mult : 85 * mult;
        let speed = enemyType === "boss" ? 36 : enemyType === "tank" ? 48 : 95;
        let radius = enemyType === "boss" ? 22 : enemyType === "tank" ? 16 : 10;
        let reward = enemyType === "boss" ? 160 : enemyType === "tank" ? 45 : 18;

        state.enemies.push({
          id: "en_" + Math.random(),
          x: pathPoints[0].x,
          y: pathPoints[0].y,
          pathIndex: 0,
          type: enemyType,
          hp,
          maxHp: hp,
          speed,
          radius,
          reward
        });
      }

      // Next wave check
      if (state.waveEnemiesToSpawn === 0 && state.enemies.length === 0) {
        if (state.wave >= 10) {
          state.isVictory = true;
          setGameState("VICTORY");
          onScoreSubmit("jarvis-command", state.score, difficulty, { wavesCompleted: 10 });
          ctx.restore();
          return;
        }
        state.wave++;
        state.waveEnemiesToSpawn = 10 + state.wave * 3;
        setWave(state.wave);
        soundEngine.playTacticalPing();
      }

      // Move Enemies
      for (let i = state.enemies.length - 1; i >= 0; i--) {
        const en = state.enemies[i];
        const targetPoint = pathPoints[en.pathIndex + 1];

        if (!targetPoint) {
          state.coreHp -= en.type === "boss" ? 30 : 10;
          setCoreHp(Math.max(0, state.coreHp));
          CollisionEngine.createParticleBurst(state.particles, en.x, en.y, 20, ["#ef4444", "#f59e0b"]);
          CollisionEngine.triggerShake(8, 0.3);
          soundEngine.playExplosion();
          state.enemies.splice(i, 1);

          if (state.coreHp <= 0) {
            state.isGameOver = true;
            setGameState("GAMEOVER");
            onScoreSubmit("jarvis-command", state.score, difficulty, { wavesCompleted: state.wave });
            ctx.restore();
            return;
          }
          continue;
        }

        const dx = targetPoint.x - en.x;
        const dy = targetPoint.y - en.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const step = en.speed * dt;

        if (dist <= step) {
          en.x = targetPoint.x;
          en.y = targetPoint.y;
          en.pathIndex++;
        } else {
          en.x += (dx / dist) * step;
          en.y += (dy / dist) * step;
        }
      }

      // Turret Firing & Barrel Tracking
      state.turrets.forEach((turret) => {
        let target: Enemy | null = null;
        let minDist = turret.range;

        state.enemies.forEach((en) => {
          const d = CollisionEngine.getDistance(turret.x, turret.y, en.x, en.y);
          if (d <= minDist) {
            minDist = d;
            target = en;
          }
        });

        if (target) {
          turret.angle = Math.atan2((target as Enemy).y - turret.y, (target as Enemy).x - turret.x);
          const fireInterval = 1 / turret.fireRate;

          if (timestamp / 1000 - turret.lastFired >= fireInterval) {
            turret.lastFired = timestamp / 1000;
            const bSpeed = 460;

            state.bullets.push({
              x: turret.x,
              y: turret.y,
              vx: Math.cos(turret.angle) * bSpeed,
              vy: Math.sin(turret.angle) * bSpeed,
              damage: turret.damage,
              color: turret.type === "laser" ? "#10b981" : turret.type === "plasma" ? "#f59e0b" : "#e2e8f0",
              radius: turret.type === "plasma" ? 5 : 3
            });

            soundEngine.playTacticalPing();
          }
        }
      });

      // Move Bullets
      for (let b = state.bullets.length - 1; b >= 0; b--) {
        const bullet = state.bullets[b];
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;

        if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
          state.bullets.splice(b, 1);
          continue;
        }

        for (let e = state.enemies.length - 1; e >= 0; e--) {
          const enemy = state.enemies[e];
          if (CollisionEngine.checkCircleCollision(bullet.x, bullet.y, bullet.radius, enemy.x, enemy.y, enemy.radius)) {
            enemy.hp -= bullet.damage;
            CollisionEngine.createParticleBurst(state.particles, bullet.x, bullet.y, 4, [bullet.color]);
            state.bullets.splice(b, 1);

            if (enemy.hp <= 0) {
              state.score += enemy.reward * 10;
              state.energy += enemy.reward;
              setScore(state.score);
              setEnergy(state.energy);
              CollisionEngine.createFloatingText(state.floaters, enemy.x, enemy.y, `+${enemy.reward} ENERGY`, "#f59e0b");
              CollisionEngine.createParticleBurst(state.particles, enemy.x, enemy.y, 16, ["#10b981", "#f59e0b"]);
              soundEngine.playExplosion();
              state.enemies.splice(e, 1);
            }
            break;
          }
        }
      }

      // Mouse Clicks for Turret Placement
      if (input.mouse.justClicked) {
        const mx = input.mouse.canvasX;
        const my = input.mouse.canvasY;

        const costs = { gatling: 100, plasma: 200, laser: 350, emp: 250 };
        const selectedCost = costs[selectedTurretType];

        let onPath = false;
        for (let p = 0; p < pathPoints.length - 1; p++) {
          const p1 = pathPoints[p];
          const p2 = pathPoints[p + 1];
          const distToSegment = Math.hypot(mx - (p1.x + p2.x) / 2, my - (p1.y + p2.y) / 2);
          if (distToSegment < 30) {
            onPath = true;
            break;
          }
        }

        if (!onPath && state.energy >= selectedCost) {
          state.energy -= selectedCost;
          setEnergy(state.energy);

          const specs = {
            gatling: { range: 135, damage: 28, fireRate: 3.2 },
            plasma: { range: 155, damage: 65, fireRate: 1.3 },
            laser: { range: 210, damage: 130, fireRate: 0.85 },
            emp: { range: 115, damage: 45, fireRate: 1.6 }
          };

          state.turrets.push({
            id: "tur_" + Date.now(),
            x: mx,
            y: my,
            type: selectedTurretType,
            ...specs[selectedTurretType],
            lastFired: 0,
            angle: 0,
            cost: selectedCost
          });

          soundEngine.playTacticalPing();
        }
      }

      input.resetPerFrameInputs();

      // RENDER CANVAS — MILITARY COMMAND ENVIRONMENT (Charcoal/Steel/Tactical Green)
      ctx.fillStyle = "#0c1017";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Radar Sweep Cone Animation
      ctx.save();
      ctx.fillStyle = "rgba(16, 185, 129, 0.04)";
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, canvas.height / 2);
      ctx.arc(canvas.width / 2, canvas.height / 2, 450, state.radarAngle, state.radarAngle + 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Tactical Grid Lines
      ctx.strokeStyle = "rgba(16, 185, 129, 0.07)";
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 50) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      // Render Path Line
      ctx.strokeStyle = "rgba(245, 158, 11, 0.25)";
      ctx.lineWidth = 24;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      pathPoints.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      // Base Fortress Objective Core
      const coreP = pathPoints[pathPoints.length - 1];
      ctx.fillStyle = "rgba(16, 185, 129, 0.2)";
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(coreP.x, coreP.y, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Render Turrets with Barrels & Tracking
      state.turrets.forEach((t) => {
        // Base
        ctx.fillStyle = "#334155";
        ctx.strokeStyle = t.type === "laser" ? "#10b981" : t.type === "plasma" ? "#f59e0b" : "#94a3b8";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Barrel Line
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t.x + Math.cos(t.angle) * 20, t.y + Math.sin(t.angle) * 20);
        ctx.stroke();
      });

      // Render Enemies
      state.enemies.forEach((e) => {
        ctx.fillStyle = e.type === "boss" ? "#ef4444" : e.type === "tank" ? "#f59e0b" : "#38bdf8";
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Render Bullets
      state.bullets.forEach((b) => {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
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
  }, [selectedTurretType, difficulty, onScoreSubmit]);

  const handleOrbitalStrike = () => {
    const state = stateRef.current;
    if (state.energy >= 300) {
      state.energy -= 300;
      setEnergy(state.energy);
      CollisionEngine.triggerShake(12, 0.5);
      state.enemies.forEach((e) => {
        e.hp -= 450;
        CollisionEngine.createParticleBurst(state.particles, e.x, e.y, 25, ["#10b981", "#ffffff", "#ef4444"]);
      });
      soundEngine.playExplosion();
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#070b12] text-slate-200 select-none overflow-hidden p-4 font-mono">
      {/* Tactical Military HUD Header */}
      <div className="w-full max-w-4xl flex justify-between items-center bg-[#0f172a]/90 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-4 mb-3 text-xs shadow-2xl">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-emerald-400 border border-emerald-500/30 transition-all">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="font-bold text-emerald-400 uppercase tracking-widest text-sm flex items-center gap-2">
              <Radio size={16} className="animate-pulse" /> JARVIS DEFENSE TACTICAL COMMAND
            </h2>
            <span className="text-[10px] text-slate-400">Military Defense Simulator • Sector Grid</span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Trophy size={14} /> <span>{score} PTS</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-400 font-bold">
            <Zap size={14} /> <span>{energy} ENERGY</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Shield size={14} /> <span>BASE INTEGRITY: {coreHp}%</span>
          </div>
          <div className="text-amber-400 font-bold">WAVE {wave}/10</div>
        </div>
      </div>

      {/* Main Canvas View */}
      <div className="relative border border-emerald-500/30 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.15)]">
        <canvas ref={canvasRef} width={750} height={550} className="block cursor-crosshair bg-[#0c1017]" />

        {gameState === "GAMEOVER" && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <AlertTriangle size={48} className="text-red-500 mb-2 animate-bounce" />
            <h3 className="text-2xl font-bold text-red-500 tracking-widest mb-2 uppercase">Base Perimeter Breached</h3>
            <p className="text-xs text-slate-400 mb-6">Tactical Defense Failed at Wave {wave}. Score: {score}</p>
            <div className="flex gap-4">
              <button onClick={() => window.location.reload()} className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs">REENGAGE</button>
              <button onClick={onBack} className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs">ABORT</button>
            </div>
          </div>
        )}
      </div>

      {/* Turret Selection Toolbar */}
      <div className="w-full max-w-4xl mt-3 flex justify-between items-center bg-[#0f172a]/90 backdrop-blur-md border border-white/10 rounded-2xl p-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest mr-2">Turret Matrix:</span>
          {(["gatling", "plasma", "laser", "emp"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTurretType(t)}
              className={`px-3 py-1.5 rounded-xl border transition-all text-xs flex items-center gap-1.5 ${
                selectedTurretType === t ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              <span className="capitalize">{t}</span>
              <span className="text-[10px] text-amber-400 font-semibold">
                ${t === 'gatling' ? 100 : t === 'plasma' ? 200 : t === 'laser' ? 350 : 250}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={handleOrbitalStrike}
          disabled={energy < 300}
          className={`px-4 py-2 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition-all ${
            energy >= 300 ? 'bg-red-500/20 hover:bg-red-500/30 border-red-500/50 text-red-400 animate-pulse' : 'bg-white/5 border-white/5 text-slate-600 cursor-not-allowed'
          }`}
        >
          <Zap size={14} /> ORBITAL STRIKE ($300)
        </button>
      </div>
    </div>
  );
}
