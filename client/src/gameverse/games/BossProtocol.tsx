"use client";

import React, { useEffect, useRef, useState } from "react";
import { GameLoop } from "../engine/GameLoop";
import { InputManager } from "../engine/InputManager";
import { soundEngine } from "../engine/SoundEngine";
import { CollisionEngine, Particle, FloatingText } from "../engine/CollisionEngine";
import { AIGameDirector, DifficultyLevel } from "../engine/AIGameDirector";
import { ArrowLeft, Trophy, ShieldAlert, Skull, Zap, AlertTriangle } from "lucide-react";

interface GameProps {
  difficulty: DifficultyLevel;
  onBack: () => void;
  onScoreSubmit: (gameId: string, score: number, difficulty: string, stats: Record<string, unknown>) => void;
}

type Bullet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isEnemy: boolean;
  color: string;
};

export default function BossProtocol({ difficulty, onBack, onScoreSubmit }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<"PLAYING" | "VICTORY" | "GAMEOVER">("PLAYING");
  const [score, setScore] = useState(0);
  const [playerHp, setPlayerHp] = useState(100);
  const [bossHp, setBossHp] = useState(2500);
  const [bossPhase, setBossPhase] = useState<1 | 2 | 3>(1);

  const directorRef = useRef(new AIGameDirector(difficulty));

  const stateRef = useRef({
    score: 0,
    player: { x: 375, y: 480, hp: 100, maxHp: 100, radius: 16, speed: 270, dashCd: 0 },
    boss: { x: 375, y: 140, hp: 2500, maxHp: 2500, radius: 48, phase: 1 as 1 | 2 | 3, angle: 0 },
    bullets: [] as Bullet[],
    particles: [] as Particle[],
    floaters: [] as FloatingText[],
    lastFiredPlayer: 0,
    lastFiredBoss: 0,
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

    soundEngine.playApocalypticAlarm();

    const loop = new GameLoop((dt, timestamp) => {
      if (stateRef.current.isGameOver || stateRef.current.isVictory) return;

      const state = stateRef.current;
      const p = state.player;
      const b = state.boss;
      const mult = directorRef.current.getDifficultyMultiplier();

      ctx.save();
      CollisionEngine.applyScreenShake(ctx, dt);

      // WASD Controls
      let dx = 0, dy = 0;
      if (input.isKeyDown("w") || input.isKeyDown("arrowup")) dy -= 1;
      if (input.isKeyDown("s") || input.isKeyDown("arrowdown")) dy += 1;
      if (input.isKeyDown("a") || input.isKeyDown("arrowleft")) dx -= 1;
      if (input.isKeyDown("d") || input.isKeyDown("arrowright")) dx += 1;

      if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

      p.dashCd = Math.max(0, p.dashCd - dt);
      if (input.isKeyJustPressed("space") && p.dashCd === 0) {
        p.dashCd = 1.2;
        p.x += dx * 140;
        p.y += dy * 140;
        CollisionEngine.createParticleBurst(state.particles, p.x, p.y, 20, ["#a855f7", "#ffffff"]);
        soundEngine.playWhoosh();
      }

      p.x += dx * p.speed * dt;
      p.y += dy * p.speed * dt;
      p.x = Math.max(p.radius, Math.min(canvas.width - p.radius, p.x));
      p.y = Math.max(p.radius, Math.min(canvas.height - p.radius, p.y));

      // Player Firing
      if (input.mouse.isDown && timestamp / 1000 - state.lastFiredPlayer >= 0.1) {
        state.lastFiredPlayer = timestamp / 1000;
        const angle = input.getAngleFrom(p.x, p.y);
        const bSpeed = 680;

        state.bullets.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(angle) * bSpeed,
          vy: Math.sin(angle) * bSpeed,
          isEnemy: false,
          color: "#a855f7"
        });

        soundEngine.playHeavyGunshot("laser");
      }

      // Boss Phase Shifts
      b.angle += dt * 1.8;

      const bossPct = b.hp / b.maxHp;
      if (bossPct <= 0.35 && b.phase !== 3) {
        b.phase = 3;
        setBossPhase(3);
        soundEngine.playApocalypticAlarm();
        CollisionEngine.triggerShake(12, 0.5);
        CollisionEngine.createFloatingText(state.floaters, b.x, b.y - 60, "PHASE 3: TOTAL MELTDOWN!", "#ef4444");
      } else if (bossPct <= 0.70 && b.phase === 1) {
        b.phase = 2;
        setBossPhase(2);
        soundEngine.playApocalypticAlarm();
        CollisionEngine.triggerShake(8, 0.4);
        CollisionEngine.createFloatingText(state.floaters, b.x, b.y - 60, "PHASE 2: BULLET HELL MATRIX!", "#f59e0b");
      }

      // Boss Bullet Attacks
      const bossFireInterval = b.phase === 3 ? 0.07 / mult : b.phase === 2 ? 0.11 / mult : 0.22 / mult;

      if (timestamp / 1000 - state.lastFiredBoss >= bossFireInterval) {
        state.lastFiredBoss = timestamp / 1000;

        if (b.phase === 1) {
          for (let i = 0; i < 4; i++) {
            const a = b.angle + (i * Math.PI / 2);
            state.bullets.push({
              x: b.x, y: b.y,
              vx: Math.cos(a) * 230, vy: Math.sin(a) * 230,
              isEnemy: true, color: "#a855f7"
            });
          }
        } else if (b.phase === 2) {
          const a = b.angle * 3.5;
          state.bullets.push({
            x: b.x, y: b.y,
            vx: Math.cos(a) * 270, vy: Math.sin(a) * 270,
            isEnemy: true, color: "#f59e0b"
          });
          state.bullets.push({
            x: b.x, y: b.y,
            vx: Math.cos(a + Math.PI) * 270, vy: Math.sin(a + Math.PI) * 270,
            isEnemy: true, color: "#f59e0b"
          });
        } else if (b.phase === 3) {
          for (let i = 0; i < 10; i++) {
            const a = (i * Math.PI / 5) + b.angle;
            state.bullets.push({
              x: b.x, y: b.y,
              vx: Math.cos(a) * 320, vy: Math.sin(a) * 320,
              isEnemy: true, color: "#ef4444"
            });
          }
        }
      }

      // Bullets Update
      for (let i = state.bullets.length - 1; i >= 0; i--) {
        const bullet = state.bullets[i];
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;

        if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
          state.bullets.splice(i, 1);
          continue;
        }

        if (bullet.isEnemy && CollisionEngine.checkCircleCollision(bullet.x, bullet.y, 4, p.x, p.y, p.radius)) {
          p.hp -= 8;
          setPlayerHp(Math.max(0, Math.floor(p.hp)));
          CollisionEngine.createParticleBurst(state.particles, p.x, p.y, 8, ["#ef4444"]);
          CollisionEngine.triggerShake(5, 0.15);
          soundEngine.playHit();
          state.bullets.splice(i, 1);

          if (p.hp <= 0) {
            state.isGameOver = true;
            setGameState("GAMEOVER");
            onScoreSubmit("boss-protocol", state.score, difficulty, { victory: false });
            ctx.restore();
            return;
          }
        }

        if (!bullet.isEnemy && CollisionEngine.checkCircleCollision(bullet.x, bullet.y, 4, b.x, b.y, b.radius)) {
          const isCrit = Math.random() > 0.75;
          const damage = isCrit ? 40 : 20;

          b.hp -= damage;
          state.score += isCrit ? 100 : 50;
          setScore(state.score);
          setBossHp(Math.max(0, b.hp));

          if (isCrit) {
            soundEngine.playCritHit();
            CollisionEngine.createFloatingText(state.floaters, bullet.x, bullet.y - 10, "CRIT! " + damage, "#f59e0b");
            CollisionEngine.createParticleBurst(state.particles, bullet.x, bullet.y, 10, ["#f59e0b", "#ffffff"]);
          } else {
            CollisionEngine.createParticleBurst(state.particles, bullet.x, bullet.y, 5, ["#a855f7", "#ef4444"]);
          }

          state.bullets.splice(i, 1);

          if (b.hp <= 0) {
            state.isVictory = true;
            setGameState("VICTORY");
            soundEngine.playLevelUp();
            CollisionEngine.triggerShake(15, 0.8);
            CollisionEngine.createParticleBurst(state.particles, b.x, b.y, 90, ["#a855f7", "#ef4444", "#34d399"]);
            onScoreSubmit("boss-protocol", state.score + 5000, difficulty, { victory: true });
            ctx.restore();
            return;
          }
        }
      }

      input.resetPerFrameInputs();

      // RENDER CANVAS — 3-PHASE EVOLVING APOCALYPTIC ARENA
      ctx.fillStyle = b.phase === 3 ? "#12070a" : b.phase === 2 ? "#170f07" : "#0d0717";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Warning Telegraph Laser Line (Phase 3)
      if (b.phase === 3) {
        ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
        ctx.lineWidth = 5;
        ctx.setLineDash([12, 12]);
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x + Math.cos(b.angle) * 800, b.y + Math.sin(b.angle) * 800);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Render Corrupted Core Boss Body
      ctx.fillStyle = b.phase === 3 ? "#ef4444" : b.phase === 2 ? "#f59e0b" : "#a855f7";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();

      // Render Player Unit
      ctx.fillStyle = "#a855f7";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // Render Bullets
      state.bullets.forEach((bu) => {
        ctx.fillStyle = bu.color;
        ctx.beginPath();
        ctx.arc(bu.x, bu.y, 4, 0, Math.PI * 2);
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

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#0d0717] text-white select-none overflow-hidden p-4 font-mono">
      {/* Boss Protocol Header HUD */}
      <div className="w-full max-w-3xl bg-[#170a24] border border-purple-500/40 rounded-2xl p-4 mb-3 text-xs shadow-2xl space-y-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-purple-400 border border-purple-500/30 transition-all">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h2 className="font-bold text-purple-400 uppercase tracking-widest text-sm flex items-center gap-2">
                <Skull size={18} className="text-red-500 animate-pulse" /> BOSS PROTOCOL: ULTRA-JARVIS CORE
              </h2>
              <span className="text-[10px] text-white/40">Apocalyptic Boss Battle • Sector Chamber</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-amber-400 font-bold">PHASE {bossPhase}/3</span>
            <div className="text-emerald-400 font-bold">PLAYER HP: {playerHp}%</div>
          </div>
        </div>

        {/* Multilayer Boss HP Bar */}
        <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
          <div className={`h-full transition-all duration-300 ${bossPhase === 3 ? 'bg-red-500' : bossPhase === 2 ? 'bg-amber-500' : 'bg-purple-500'}`} style={{ width: `${(bossHp / 2500) * 100}%` }} />
        </div>
      </div>

      {/* Main Canvas View */}
      <div className="relative border border-purple-500/40 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(168,85,247,0.2)]">
        <canvas ref={canvasRef} width={750} height={550} className="block cursor-crosshair bg-[#0d0717]" />

        {gameState === "GAMEOVER" && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <AlertTriangle size={48} className="text-red-500 mb-2 animate-bounce" />
            <h3 className="text-2xl font-bold text-red-500 tracking-widest mb-2 uppercase">Corrupted Core Victory</h3>
            <p className="text-xs text-white/60 mb-6">Boss HP Remaining: {bossHp}. Score: {score}</p>
            <div className="flex gap-4">
              <button onClick={() => window.location.reload()} className="px-6 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-xs">REENGAGE BOSS</button>
              <button onClick={onBack} className="px-6 py-2.5 rounded-xl bg-white/10 text-white text-xs">EXIT</button>
            </div>
          </div>
        )}

        {gameState === "VICTORY" && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <Trophy size={48} className="text-amber-400 mb-3 animate-bounce" />
            <h3 className="text-2xl font-bold text-emerald-400 tracking-widest mb-2 uppercase">Corrupted Core Neutralized!</h3>
            <p className="text-xs text-white/60 mb-6">Showcase Boss Battle Defeated! Final Score: {score}</p>
            <button onClick={onBack} className="px-8 py-3 rounded-xl bg-emerald-500 text-black font-bold text-xs">RETURN TO GAMEVERSE</button>
          </div>
        )}
      </div>
    </div>
  );
}
