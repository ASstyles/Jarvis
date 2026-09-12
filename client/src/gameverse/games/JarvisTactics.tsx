"use client";

import React, { useState } from "react";
import { soundEngine } from "../engine/SoundEngine";
import { DifficultyLevel } from "../engine/AIGameDirector";
import { ArrowLeft, Trophy, CheckCircle2, User } from "lucide-react";

interface GameProps {
  difficulty: DifficultyLevel;
  onBack: () => void;
  onScoreSubmit: (gameId: string, score: number, difficulty: string, stats: Record<string, unknown>) => void;
}

type Unit = {
  id: string;
  name: string;
  isEnemy: boolean;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attack: number;
  range: number;
  moveRange: number;
  ap: number;
  maxAp: number;
};

export default function JarvisTactics({ difficulty, onBack, onScoreSubmit }: GameProps) {
  const gridSize = 8;
  const [turn, setTurn] = useState<"PLAYER" | "AI">("PLAYER");
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<"PLAYING" | "VICTORY" | "GAMEOVER">("PLAYING");

  const [units, setUnits] = useState<Unit[]>([
    { id: "p1", name: "Assault", isEnemy: false, x: 1, y: 6, hp: 100, maxHp: 100, attack: 35, range: 2, moveRange: 2, ap: 2, maxAp: 2 },
    { id: "p2", name: "Sniper", isEnemy: false, x: 2, y: 7, hp: 70, maxHp: 70, attack: 55, range: 4, moveRange: 1, ap: 2, maxAp: 2 },
    { id: "p3", name: "Support", isEnemy: false, x: 0, y: 7, hp: 90, maxHp: 90, attack: 25, range: 3, moveRange: 2, ap: 2, maxAp: 2 },

    { id: "e1", name: "Drone A", isEnemy: true, x: 6, y: 1, hp: 80, maxHp: 80, attack: 25, range: 2, moveRange: 2, ap: 2, maxAp: 2 },
    { id: "e2", name: "Mech B", isEnemy: true, x: 5, y: 0, hp: 120, maxHp: 120, attack: 35, range: 2, moveRange: 1, ap: 2, maxAp: 2 },
    { id: "e3", name: "Sniper C", isEnemy: true, x: 7, y: 0, hp: 60, maxHp: 60, attack: 45, range: 4, moveRange: 1, ap: 2, maxAp: 2 }
  ]);

  const handleCellClick = (gx: number, gy: number) => {
    if (turn !== "PLAYER" || gameState !== "PLAYING") return;

    const clickedUnit = units.find((u) => u.x === gx && u.y === gy);

    if (clickedUnit && !clickedUnit.isEnemy && clickedUnit.ap > 0) {
      setSelectedUnit(clickedUnit);
      soundEngine.playPickup();
      return;
    }

    if (selectedUnit && selectedUnit.ap > 0) {
      const dist = Math.abs(selectedUnit.x - gx) + Math.abs(selectedUnit.y - gy);

      // Attack enemy in range
      if (clickedUnit && clickedUnit.isEnemy && dist <= selectedUnit.range) {
        soundEngine.playLaser();
        setUnits((prev) => {
          const updated = prev.map((u) => {
            if (u.id === clickedUnit.id) {
              const newHp = u.hp - selectedUnit.attack;
              return { ...u, hp: Math.max(0, newHp) };
            }
            if (u.id === selectedUnit.id) {
              return { ...u, ap: u.ap - 1 };
            }
            return u;
          }).filter((u) => u.hp > 0);

          const remainingEnemies = updated.filter((u) => u.isEnemy);
          if (remainingEnemies.length === 0) {
            setGameState("VICTORY");
            onScoreSubmit("jarvis-tactics", score + 1500, difficulty, { victory: true });
          }

          return updated;
        });

        setSelectedUnit((u) => u ? { ...u, ap: u.ap - 1 } : null);
        return;
      }

      // Move unit to empty cell
      if (!clickedUnit && dist <= selectedUnit.moveRange) {
        soundEngine.playWhoosh();
        setUnits((prev) =>
          prev.map((u) => (u.id === selectedUnit.id ? { ...u, x: gx, y: gy, ap: u.ap - 1 } : u))
        );
        setSelectedUnit((u) => u ? { ...u, x: gx, y: gy, ap: u.ap - 1 } : null);
      }
    }
  };

  const handleEndTurn = () => {
    if (turn !== "PLAYER") return;
    setTurn("AI");
    setSelectedUnit(null);

    setTimeout(() => {
      setUnits((prev) => {
        let copy = prev.map((u) => u.isEnemy ? { ...u, ap: u.maxAp } : u);

        const aiUnits = copy.filter((u) => u.isEnemy);
        const playerUnits = copy.filter((u) => !u.isEnemy);

        aiUnits.forEach((ai) => {
          if (playerUnits.length === 0) return;
          let target = playerUnits[0];
          let minDist = 999;
          playerUnits.forEach((pu) => {
            const d = Math.abs(ai.x - pu.x) + Math.abs(ai.y - pu.y);
            if (d < minDist) { minDist = d; target = pu; }
          });

          if (minDist <= ai.range) {
            target.hp = Math.max(0, target.hp - ai.attack);
            soundEngine.playHit();
          } else {
            const dx = target.x > ai.x ? 1 : target.x < ai.x ? -1 : 0;
            const dy = target.y > ai.y ? 1 : target.y < ai.y ? -1 : 0;
            ai.x += dx;
            ai.y += dy;
          }
        });

        copy = copy.filter((u) => u.hp > 0);

        const remainingPlayers = copy.filter((u) => !u.isEnemy);
        if (remainingPlayers.length === 0) {
          setGameState("GAMEOVER");
          onScoreSubmit("jarvis-tactics", score, difficulty, { victory: false });
        } else {
          copy = copy.map((u) => !u.isEnemy ? { ...u, ap: u.maxAp } : u);
          setTurn("PLAYER");
        }

        return copy;
      });
    }, 1000);
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#070913] text-white select-none overflow-hidden p-4 font-sans">
      {/* Header Bar */}
      <div className="w-full max-w-xl flex justify-between items-center bg-black/60 backdrop-blur-md border border-cyan-500/30 rounded-2xl p-4 mb-4 font-mono text-xs shadow-xl">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-cyan-400 border border-cyan-500/30 transition-all">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="font-bold text-cyan-300 uppercase tracking-widest text-sm">JARVIS Tactics</h2>
            <span className="text-[10px] text-white/50">Holographic Battle Grid Mesh</span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs">
          <span className={`px-3 py-1 rounded font-bold ${turn === 'PLAYER' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400' : 'bg-red-500/20 text-red-400 animate-pulse'}`}>
            {turn} TURN
          </span>
          <button onClick={handleEndTurn} disabled={turn !== 'PLAYER'} className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-xs">
            END TURN
          </button>
        </div>
      </div>

      {/* Grid Canvas */}
      <div className="p-4 bg-black/60 backdrop-blur-md border border-cyan-500/40 rounded-3xl shadow-[0_0_50px_rgba(0,240,255,0.15)] relative">
        <div className="grid grid-cols-8 gap-1.5">
          {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
            const gx = idx % gridSize;
            const gy = Math.floor(idx / gridSize);
            const unit = units.find((u) => u.x === gx && u.y === gy);
            const isSelected = selectedUnit && selectedUnit.x === gx && selectedUnit.y === gy;

            return (
              <button
                key={idx}
                onClick={() => handleCellClick(gx, gy)}
                className={`w-14 h-14 rounded-xl border flex flex-col items-center justify-center relative transition-all ${
                  isSelected ? 'bg-cyan-500/30 border-cyan-400 shadow-[0_0_15px_#00f0ff]' :
                  unit ? (unit.isEnemy ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300') :
                  'bg-white/[0.02] border-white/5 hover:border-white/20'
                }`}
              >
                {unit && (
                  <>
                    <User size={18} />
                    <span className="text-[9px] font-mono font-bold mt-0.5">{unit.name}</span>
                    <div className="w-10 h-1 bg-black/60 rounded-full mt-0.5 overflow-hidden">
                      <div className="h-full bg-emerald-400" style={{ width: `${(unit.hp / unit.maxHp) * 100}%` }} />
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {gameState === "GAMEOVER" && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-6 text-center">
            <h3 className="text-xl font-mono font-bold text-red-500 tracking-widest mb-2 uppercase">Squad Defeated</h3>
            <button onClick={() => window.location.reload()} className="px-6 py-2.5 rounded-xl bg-cyan-500 text-black font-mono font-bold text-xs mt-4">RETRY MATCH</button>
          </div>
        )}

        {gameState === "VICTORY" && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-6 text-center">
            <CheckCircle2 size={48} className="text-emerald-400 mb-3 animate-bounce" />
            <h3 className="text-xl font-mono font-bold text-emerald-400 tracking-widest mb-2 uppercase">Tactical Victory!</h3>
            <button onClick={onBack} className="px-6 py-2.5 rounded-xl bg-emerald-500 text-black font-mono font-bold text-xs mt-4">RETURN TO GAMEVERSE</button>
          </div>
        )}
      </div>
    </div>
  );
}
