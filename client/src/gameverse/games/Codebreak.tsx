"use client";

import React, { useState, useEffect } from "react";
import { soundEngine } from "../engine/SoundEngine";
import { DifficultyLevel } from "../engine/AIGameDirector";
import { ArrowLeft, Trophy, Clock, Cpu, CheckCircle2, Zap } from "lucide-react";

interface GameProps {
  difficulty: DifficultyLevel;
  onBack: () => void;
  onScoreSubmit: (gameId: string, score: number, difficulty: string, stats: Record<string, unknown>) => void;
}

type NodeTile = {
  id: number;
  rotation: number;
  type: "line" | "corner" | "t-shape" | "cross";
  powered: boolean;
};

export default function Codebreak({ difficulty, onBack, onScoreSubmit }: GameProps) {
  const gridSize = 4;
  const [tiles, setTiles] = useState<NodeTile[]>([]);
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(45);
  const [isVictory, setIsVictory] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [puzzlesSolved, setPuzzlesSolved] = useState(0);

  const generateLevel = () => {
    const types: ("line" | "corner" | "t-shape" | "cross")[] = ["line", "corner", "t-shape", "cross"];
    const newTiles: NodeTile[] = [];
    for (let i = 0; i < gridSize * gridSize; i++) {
      newTiles.push({
        id: i,
        rotation: Math.floor(Math.random() * 4) * 90,
        type: types[Math.floor(Math.random() * types.length)],
        powered: i === 0
      });
    }
    setTiles(newTiles);
    setTimeLeft(Math.max(20, 50 - level * 3));
  };

  useEffect(() => {
    generateLevel();
  }, [level]);

  useEffect(() => {
    if (isGameOver || isVictory) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsGameOver(true);
          onScoreSubmit("codebreak", score, difficulty, { puzzlesSolved });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isGameOver, isVictory, score, puzzlesSolved, difficulty, onScoreSubmit]);

  const handleTileClick = (index: number) => {
    if (isGameOver || isVictory) return;

    soundEngine.playWhoosh();
    setTiles((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        rotation: (copy[index].rotation + 90) % 360
      };

      const allAligned = copy.every((t) => t.rotation % 180 === 0);
      if (allAligned) {
        soundEngine.playLevelUp();
        const newScore = score + 500 + timeLeft * 10;
        setScore(newScore);
        setPuzzlesSolved((p) => p + 1);

        if (level >= 5) {
          setIsVictory(true);
          onScoreSubmit("codebreak", newScore, difficulty, { puzzlesSolved: 5 });
        } else {
          setLevel((l) => l + 1);
        }
      }

      return copy;
    });
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#070913] text-white select-none overflow-hidden p-4 font-sans">
      {/* Header Bar */}
      <div className="w-full max-w-xl flex justify-between items-center bg-black/60 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-4 mb-4 font-mono text-xs shadow-xl">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-emerald-400 border border-emerald-500/30 transition-all">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="font-bold text-emerald-300 uppercase tracking-widest text-sm">Codebreak</h2>
            <span className="text-[10px] text-white/50">Digital Neural Matrix Decoder</span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-300">
            <Trophy size={14} /> <span>{score} PTS</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-400 font-bold">
            <Clock size={14} /> <span>{timeLeft}s</span>
          </div>
          <div className="text-purple-400 font-bold">LEVEL {level}/5</div>
        </div>
      </div>

      {/* Main Puzzle Board Grid */}
      <div className="p-6 bg-black/60 backdrop-blur-md border border-emerald-500/40 rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.15)] relative">
        <div className="grid grid-cols-4 gap-3">
          {tiles.map((t, idx) => (
            <button
              key={t.id}
              onClick={() => handleTileClick(idx)}
              style={{ transform: `rotate(${t.rotation}deg)` }}
              className={`w-20 h-20 rounded-2xl border transition-all duration-300 flex items-center justify-center ${
                idx === 0 ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_20px_#10b981]' :
                'bg-white/5 border-white/10 text-white/70 hover:border-emerald-500/50 hover:bg-white/10'
              }`}
            >
              <Cpu size={32} className={idx === 0 ? "animate-pulse" : ""} />
            </button>
          ))}
        </div>

        {isGameOver && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-6 text-center">
            <h3 className="text-xl font-mono font-bold text-red-500 tracking-widest mb-2 uppercase">Time Expired</h3>
            <p className="text-xs text-white/60 mb-6">Puzzles Solved: {puzzlesSolved}. Score: {score}</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs">RETRY</button>
          </div>
        )}

        {isVictory && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-6 text-center">
            <CheckCircle2 size={48} className="text-emerald-400 mb-3 animate-bounce" />
            <h3 className="text-xl font-mono font-bold text-emerald-400 tracking-widest mb-2 uppercase">Matrix Decrypted!</h3>
            <p className="text-xs text-white/60 mb-6">All 5 circuit decoders solved! Score: {score}</p>
            <button onClick={onBack} className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs">RETURN TO GAMEVERSE</button>
          </div>
        )}
      </div>
    </div>
  );
}
