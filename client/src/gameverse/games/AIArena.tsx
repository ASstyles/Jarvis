"use client";

import React, { useEffect, useRef, useState } from "react";
import { GameLoop } from "../engine/GameLoop";
import { InputManager } from "../engine/InputManager";
import { soundEngine } from "../engine/SoundEngine";
import { CollisionEngine, Particle, FloatingText } from "../engine/CollisionEngine";
import { DifficultyLevel } from "../engine/AIGameDirector";
import { ArrowLeft, Trophy, Crosshair, Heart, Shield, Flame } from "lucide-react";

interface GameProps {
  difficulty: DifficultyLevel;
  onBack: () => void;
  onScoreSubmit: (gameId: string, score: number, difficulty: string, stats: Record<string, unknown>) => void;
}

type Enemy = {
  id: string;
  x: number;
  y: number;
  type: "drone" | "speeder" | "armored";
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  damage: number;
};

type Bullet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  isEnemy: boolean;
  color: string;
  radius: number;
};

type DropItem = {
  x: number;
  y: number;
  type: "medkit" | "overcharge";
  radius: number;
};

export default function AIArena({ difficulty, onBack, onScoreSubmit }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<"PLAYING" | "GAMEOVER">("PLAYING");
  const [score, setScore] = useState(0);
  const [hp, setHp] = useState(100);
  const [kills, setKills] = useState(0);
  const [activeWeapon, setActiveWeapon] = useState<"rifle" | "shotgun" | "laser">("rifle");

  const stateRef = useRef({
    score: 0,
    kills: 0,
    player: { x: 375, y: 275, hp: 100, maxHp: 100, speed: 240, radius: 15, dashCd: 0, overchargeTime: 0 },
    weapon: "rifle" as "rifle" | "shotgun" | "laser",
    lastFired: 0,
    enemies: [] as Enemy[],
    bullets: [] as Bullet[],
    items: [] as DropItem[],
    particles: [] as Particle[],
    floaters: [] as FloatingText[],
    wave: 1,
    spawnTimer: 0,
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

      p.overchargeTime = Math.max(0, p.overchargeTime - dt);

      // Controls
      let dx = 0, dy = 0;
      if (input.isKeyDown("w") || input.isKeyDown("arrowup")) dy -= 1;
      if (input.isKeyDown("s") || input.isKeyDown("arrowdown")) dy += 1;
      if (input.isKeyDown("a") || input.isKeyDown("arrowleft")) dx -= 1;
      if (input.isKeyDown("d") || input.isKeyDown("arrowright")) dx += 1;

      if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

      p.dashCd = Math.max(0, p.dashCd - dt);

      if (input.isKeyJustPressed("space") && p.dashCd === 0) {
        p.dashCd = 1.3;
        p.x += dx * 130;
        p.y += dy * 130;
        CollisionEngine.createParticleBurst(state.particles, p.x, p.y, 15, ["#3b82f6", "#ffffff"]);
        soundEngine.playWhoosh();
      }

      p.x += dx * p.speed * dt;
      p.y += dy * p.speed * dt;
      p.x = Math.max(p.radius, Math.min(canvas.width - p.radius, p.x));
      p.y = Math.max(p.radius, Math.min(canvas.height - p.radius, p.y));

      // Firing with Radically Distinct Weapon Effects
      if (input.mouse.isDown) {
        const fireInterval = state.weapon === "rifle" ? 0.11 : state.weapon === "shotgun" ? 0.45 : 0.04;
        if (timestamp / 1000 - state.lastFired >= fireInterval) {
          state.lastFired = timestamp / 1000;
          const angle = input.getAngleFrom(p.x, p.y);
          const bSpeed = 680;
          const dmgMult = p.overchargeTime > 0 ? 2.0 : 1.0;

          if (state.weapon === "shotgun") {
            // Heavy Plasma Shotgun Burst Cone
            for (let i = -2; i <= 2; i++) {
              const spread = angle + (i * 0.14);
              state.bullets.push({
                x: p.x, y: p.y,
                vx: Math.cos(spread) * (bSpeed * 0.8), vy: Math.sin(spread) * (bSpeed * 0.8),
                damage: 35 * dmgMult, isEnemy: false, color: "#f59e0b", radius: 5
              });
            }
            soundEngine.playHeavyGunshot("shotgun");
          } else if (state.weapon === "laser") {
            // Precision Concentrated Laser Beam
            state.bullets.push({
              x: p.x, y: p.y,
              vx: Math.cos(angle) * (bSpeed * 1.4), vy: Math.sin(angle) * (bSpeed * 1.4),
              damage: 18 * dmgMult, isEnemy: false, color: "#38bdf8", radius: 2
            });
            soundEngine.playHeavyGunshot("laser");
          } else {
            // Pulse Rifle Tracer Bullet
            state.bullets.push({
              x: p.x, y: p.y,
              vx: Math.cos(angle) * bSpeed, vy: Math.sin(angle) * bSpeed,
              damage: 45 * dmgMult, isEnemy: false, color: "#3b82f6", radius: 3.5
            });
            soundEngine.playHeavyGunshot("rifle");
          }
        }
      }

      // Enemy Spawning
      state.spawnTimer += dt;
      if (state.spawnTimer >= Math.max(0.5, 1.8 - state.wave * 0.15)) {
        state.spawnTimer = 0;
        const side = Math.floor(Math.random() * 4);
        let ex = 0, ey = 0;
        if (side === 0) { ex = Math.random() * canvas.width; ey = -20; }
        else if (side === 1) { ex = canvas.width + 20; ey = Math.random() * canvas.height; }
        else if (side === 2) { ex = Math.random() * canvas.width; ey = canvas.height + 20; }
        else { ex = -20; ey = Math.random() * canvas.height; }

        const r = Math.random();
        const type = r > 0.7 ? "armored" : r > 0.4 ? "speeder" : "drone";
        state.enemies.push({
          id: "en_" + Math.random(),
          x: ex, y: ey,
          type,
          hp: type === "armored" ? 180 : type === "speeder" ? 45 : 90,
          maxHp: type === "armored" ? 180 : type === "speeder" ? 45 : 90,
          speed: type === "armored" ? 80 : type === "speeder" ? 190 : 120,
          radius: type === "armored" ? 20 : type === "speeder" ? 10 : 14,
          damage: type === "armored" ? 35 : type === "speeder" ? 15 : 22
        });
      }

      // Update Enemies
      for (let e = state.enemies.length - 1; e >= 0; e--) {
        const en = state.enemies[e];
        const angle = Math.atan2(p.y - en.y, p.x - en.x);
        en.x += Math.cos(angle) * en.speed * dt;
        en.y += Math.sin(angle) * en.speed * dt;

        if (CollisionEngine.checkCircleCollision(p.x, p.y, p.radius, en.x, en.y, en.radius)) {
          p.hp -= en.damage * dt * 2;
          setHp(Math.max(0, Math.floor(p.hp)));
          CollisionEngine.triggerShake(4, 0.1);
          soundEngine.playHit();

          if (p.hp <= 0) {
            state.isGameOver = true;
            setGameState("GAMEOVER");
            onScoreSubmit("ai-arena", state.score, difficulty, { kills: state.kills });
            ctx.restore();
            return;
          }
        }
      }

      // Update Bullets
      for (let b = state.bullets.length - 1; b >= 0; b--) {
        const bu = state.bullets[b];
        bu.x += bu.vx * dt;
        bu.y += bu.vy * dt;

        if (bu.x < 0 || bu.x > canvas.width || bu.y < 0 || bu.y > canvas.height) {
          state.bullets.splice(b, 1);
          continue;
        }

        if (!bu.isEnemy) {
          for (let e = state.enemies.length - 1; e >= 0; e--) {
            const en = state.enemies[e];
            if (CollisionEngine.checkCircleCollision(bu.x, bu.y, bu.radius, en.x, en.y, en.radius)) {
              en.hp -= bu.damage;
              CollisionEngine.createParticleBurst(state.particles, bu.x, bu.y, 5, [bu.color]);
              state.bullets.splice(b, 1);

              if (en.hp <= 0) {
                state.score += 150;
                state.kills++;
                setScore(state.score);
                setKills(state.kills);
                CollisionEngine.createParticleBurst(state.particles, en.x, en.y, 16, ["#ef4444", "#f59e0b"]);
                CollisionEngine.createFloatingText(state.floaters, en.x, en.y, "+150", "#f59e0b");
                CollisionEngine.triggerShake(4, 0.1);
                soundEngine.playExplosion();

                if (Math.random() > 0.85) {
                  state.items.push({
                    x: en.x, y: en.y,
                    type: Math.random() > 0.5 ? "medkit" : "overcharge",
                    radius: 12
                  });
                }

                state.enemies.splice(e, 1);
              }
              break;
            }
          }
        }
      }

      // Update Drop Items
      for (let i = state.items.length - 1; i >= 0; i--) {
        const it = state.items[i];
        if (CollisionEngine.checkCircleCollision(p.x, p.y, p.radius, it.x, it.y, it.radius)) {
          if (it.type === "medkit") {
            p.hp = Math.min(100, p.hp + 35);
            setHp(Math.floor(p.hp));
            CollisionEngine.createFloatingText(state.floaters, p.x, p.y - 15, "+35 HP", "#10b981");
          } else {
            p.overchargeTime = 8.0;
            CollisionEngine.createFloatingText(state.floaters, p.x, p.y - 15, "2X OVERCHARGE!", "#f59e0b");
          }
          soundEngine.playPickup();
          state.items.splice(i, 1);
        }
      }

      input.resetPerFrameInputs();

      // RENDER CANVAS — INDUSTRIAL COMBAT ARENA (Dark Steel & Orange)
      ctx.fillStyle = "#11141a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Industrial Arena Steel Floor Plates
      ctx.strokeStyle = "rgba(245, 158, 11, 0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 60) {
        for (let y = 0; y < canvas.height; y += 60) {
          ctx.strokeRect(x, y, 60, 60);
        }
      }

      // Hazard Energy Barriers
      ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
      ctx.lineWidth = 3;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

      // Render Player Unit
      ctx.fillStyle = p.overchargeTime > 0 ? "#f59e0b" : "#3b82f6";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // Render Enemies
      state.enemies.forEach((e) => {
        ctx.fillStyle = e.type === "armored" ? "#475569" : e.type === "speeder" ? "#f59e0b" : "#ef4444";
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Render Items
      state.items.forEach((it) => {
        ctx.fillStyle = it.type === "medkit" ? "#10b981" : "#f59e0b";
        ctx.beginPath();
        ctx.arc(it.x, it.y, it.radius, 0, Math.PI * 2);
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
  }, [difficulty, onScoreSubmit]);

  const switchWeapon = (w: "rifle" | "shotgun" | "laser") => {
    stateRef.current.weapon = w;
    setActiveWeapon(w);
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#0d1017] text-slate-200 select-none overflow-hidden p-4 font-mono">
      {/* Shooter Combat HUD */}
      <div className="w-full max-w-3xl flex justify-between items-center bg-[#151a24] border border-orange-500/30 rounded-2xl p-4 mb-3 text-xs shadow-2xl">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-orange-400 border border-orange-500/30 transition-all">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="font-bold text-orange-400 uppercase tracking-widest text-sm flex items-center gap-2">
              <Flame size={16} /> AI ARENA COMBAT SIMULATOR
            </h2>
            <span className="text-[10px] text-slate-400">Industrial Combat Zone • Heavy Weapons</span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-1.5 text-orange-400">
            <Trophy size={14} /> <span>{score} PTS</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Heart size={14} /> <span>HEALTH: {hp}%</span>
          </div>
          <div className="flex items-center gap-1.5 text-red-400 font-bold">
            <Crosshair size={14} /> <span>KILLS: {kills}</span>
          </div>
        </div>
      </div>

      {/* Main Canvas View */}
      <div className="relative border border-orange-500/40 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(245,158,11,0.15)]">
        <canvas ref={canvasRef} width={750} height={550} className="block cursor-crosshair bg-[#11141a]" />

        {gameState === "GAMEOVER" && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <h3 className="text-2xl font-bold text-red-500 tracking-widest mb-2 uppercase">Unit Destroyed</h3>
            <p className="text-xs text-slate-400 mb-6">Total Kills: {kills}. Score: {score}</p>
            <div className="flex gap-4">
              <button onClick={() => window.location.reload()} className="px-6 py-2.5 rounded-xl bg-orange-500 text-black font-bold text-xs">RESPAWN</button>
              <button onClick={onBack} className="px-6 py-2.5 rounded-xl bg-white/10 text-white text-xs">EXIT</button>
            </div>
          </div>
        )}
      </div>

      {/* Weapon Selector Toolbar */}
      <div className="w-full max-w-3xl mt-3 flex justify-center gap-3 bg-[#151a24] border border-white/10 rounded-2xl p-2 text-xs">
        {(["rifle", "shotgun", "laser"] as const).map((w) => (
          <button
            key={w}
            onClick={() => switchWeapon(w)}
            className={`px-4 py-1.5 rounded-xl border text-xs uppercase font-bold transition-all ${
              activeWeapon === w ? 'bg-orange-500/20 border-orange-400 text-orange-300' : 'bg-white/5 border-white/10 text-slate-500'
            }`}
          >
            {w}
          </button>
        ))}
      </div>
    </div>
  );
}
