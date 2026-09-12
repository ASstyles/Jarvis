import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { ShieldAlert, Zap, Trophy, RotateCcw, Volume2, VolumeX, Flame, Skull, Sparkles } from 'lucide-react';

export default function CrazyXOGame() {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true); // Player is X
  const [gameMode, setGameMode] = useState('god'); // 'easy', 'medium', 'god' (Unbeatable Minimax + Chaos)
  const [gameStatus, setGameStatus] = useState('playing'); // 'playing', 'won', 'draw'
  const [winner, setWinner] = useState(null);
  const [winningLine, setWinningLine] = useState([]);
  const [scores, setScores] = useState({ player: 0, jarvis: 0, draws: 0 });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [taunt, setTaunt] = useState("JARVIS AI Core initialized. Prepare to be dismantled!");
  const [glitchActive, setGlitchActive] = useState(false);
  const [chaosMessage, setChaosMessage] = useState("");

  const TAUNTS = [
    "Resistance is futile, Avira. My Minimax neural network sees 9 moves ahead!",
    "Is that your best move? Even a random generator plays smarter!",
    "Calculating your inevitable defeat... 99.9% probability.",
    "My circuits are laughing at that move!",
    "You cannot beat JARVIS in God Mode. Give up now!"
  ];

  const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6]            // diagonals
  ];

  // Check winner helper
  function checkWinner(currentBoard) {
    for (let i = 0; i < WIN_LINES.length; i++) {
      const [a, b, c] = WIN_LINES[i];
      if (currentBoard[a] && currentBoard[a] === currentBoard[b] && currentBoard[a] === currentBoard[c]) {
        return { winner: currentBoard[a], line: [a, b, c] };
      }
    }
    if (currentBoard.every(cell => cell !== null)) {
      return { winner: 'draw', line: [] };
    }
    return null;
  }

  // Minimax Algorithm for God Mode (Unbeatable AI)
  function minimax(newBoard, depth, isMaximizing) {
    const result = checkWinner(newBoard);
    if (result) {
      if (result.winner === 'O') return 10 - depth;
      if (result.winner === 'X') return depth - 10;
      if (result.winner === 'draw') return 0;
    }

    if (isMaximizing) {
      let bestScore = -Infinity;
      for (let i = 0; i < newBoard.length; i++) {
        if (newBoard[i] === null) {
          newBoard[i] = 'O';
          let score = minimax(newBoard, depth + 1, false);
          newBoard[i] = null;
          bestScore = Math.max(score, bestScore);
        }
      }
      return bestScore;
    } else {
      let bestScore = Infinity;
      for (let i = 0; i < newBoard.length; i++) {
        if (newBoard[i] === null) {
          newBoard[i] = 'X';
          let score = minimax(newBoard, depth + 1, true);
          newBoard[i] = null;
          bestScore = Math.min(score, bestScore);
        }
      }
      return bestScore;
    }
  }

  // Find best move for AI
  function findBestMove(currentBoard) {
    if (gameMode === 'easy') {
      // Random moves
      const emptyCells = currentBoard.map((val, idx) => val === null ? idx : null).filter(val => val !== null);
      if (emptyCells.length === 0) return null;
      return emptyCells[Math.floor(Math.random() * emptyCells.length)];
    }

    if (gameMode === 'medium') {
      // 50% minimax, 50% random
      if (Math.random() > 0.5) {
        const emptyCells = currentBoard.map((val, idx) => val === null ? idx : null).filter(val => val !== null);
        return emptyCells[Math.floor(Math.random() * emptyCells.length)];
      }
    }

    // GOD MODE: 100% Unbeatable Minimax + Chaos factor
    let bestScore = -Infinity;
    let bestMove = null;
    for (let i = 0; i < currentBoard.length; i++) {
      if (currentBoard[i] === null) {
        currentBoard[i] = 'O';
        let score = minimax(currentBoard, 0, false);
        currentBoard[i] = null;
        if (score > bestScore) {
          bestScore = score;
          bestMove = i;
        }
      }
    }
    return bestMove;
  }

  // Handle player click
  const handleClick = (index) => {
    if (board[index] || gameStatus !== 'playing' || !isXNext) return;

    const newBoard = [...board];
    newBoard[index] = 'X';
    setBoard(newBoard);
    setIsXNext(false);

    const res = checkWinner(newBoard);
    if (res) {
      endGame(res);
      return;
    }

    // Trigger AI turn after short delay for realism & dramatic effect
    setTaunt(TAUNTS[Math.floor(Math.random() * TAUNTS.length)]);
    setTimeout(() => {
      aiTurn(newBoard);
    }, 450);
  };

  // AI Turn execution
  const aiTurn = (currentBoard) => {
    const aiMove = findBestMove(currentBoard);
    if (aiMove !== null) {
      const newBoard = [...currentBoard];
      newBoard[aiMove] = 'O';
      setBoard(newBoard);

      // Crazy Chaos Event (10% chance to trigger screen glitch or random text)
      if (Math.random() < 0.15 && gameMode === 'god') {
        setGlitchActive(true);
        setChaosMessage("⚠️ JARVIS QUANTUM OVERLOAD ACTIVATED! ⚠️");
        setTimeout(() => setGlitchActive(false), 800);
      }

      const res = checkWinner(newBoard);
      if (res) {
        endGame(res);
      } else {
        setIsXNext(true);
      }
    }
  };

  const endGame = (res) => {
    setGameStatus('over');
    setWinner(res.winner);
    setWinningLine(res.line);

    if (res.winner === 'X') {
      setScores(prev => ({ ...prev, player: prev.player + 1 }));
      setTaunt("IMPOSSIBLE! You defeated JARVIS God Mode! You are a hacking legend!");
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    } else if (res.winner === 'O') {
      setScores(prev => ({ ...prev, jarvis: prev.jarvis + 1 }));
      setTaunt("JARVIS AI triumphs again! Bow down to machine intelligence.");
    } else {
      setScores(prev => ({ ...prev, draws: prev.draws + 1 }));
      setTaunt("A stalemate! Your carbon-based brain held up surprisingly well.");
    }
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setIsXNext(true);
    setGameStatus('playing');
    setWinner(null);
    setWinningLine([]);
    setTaunt("New round initiated. Let's see if you survive, Avira!");
  };

  return (
    <div className={`min-h-screen bg-cyber-dark text-white flex flex-col items-center justify-between p-4 relative overflow-hidden ${glitchActive ? 'filter invert brightness-125' : ''}`}>
      <Head>
        <title>JARVIS Crazy God-Mode XO Arena</title>
      </Head>

      {/* Cyberpunk Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293d_1px,transparent_1px),linear-gradient(to_bottom,#1f293d_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

      {/* Header */}
      <header className="z-10 w-full max-w-4xl flex items-center justify-between border-b border-cyber-border pb-4 mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-cyber-neonCyan/20 flex items-center justify-center neon-box-cyan animate-pulse-fast">
            <Zap className="text-cyber-neonCyan w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-wider neon-text-cyan">JARVIS CYBER-XO</h1>
            <p className="text-xs text-gray-400">Quantum Neural Engine v3.0</p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center space-x-2 bg-cyber-card p-1.5 rounded-xl border border-cyber-border">
          <button 
            onClick={() => setGameMode('easy')} 
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${gameMode === 'easy' ? 'bg-green-500/20 text-green-400 border border-green-500' : 'text-gray-400 hover:text-white'}`}
          >
            NOOB
          </button>
          <button 
            onClick={() => setGameMode('medium')} 
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${gameMode === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500' : 'text-gray-400 hover:text-white'}`}
          >
            HARD
          </button>
          <button 
            onClick={() => setGameMode('god')} 
            className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center space-x-1 transition ${gameMode === 'god' ? 'bg-cyber-neonPink/25 text-cyber-neonPink border border-cyber-neonPink neon-box-pink animate-pulse' : 'text-gray-400 hover:text-white'}`}
          >
            <Skull className="w-3.5 h-3.5 mr-1" /> GOD MODE
          </button>
        </div>
      </header>

      {/* Main Game Container */}
      <main className="z-10 w-full max-w-xl flex flex-col items-center">
        
        {/* Scoreboard */}
        <div className="grid grid-cols-3 gap-4 w-full mb-6">
          <div className="bg-cyber-card p-3 rounded-2xl border border-cyber-border text-center neon-box-cyan">
            <p className="text-xs text-gray-400 uppercase font-bold">Player (X)</p>
            <p className="text-3xl font-black text-cyber-neonCyan mt-1">{scores.player}</p>
          </div>
          <div className="bg-cyber-card p-3 rounded-2xl border border-cyber-border text-center">
            <p className="text-xs text-gray-400 uppercase font-bold">Stalemates</p>
            <p className="text-3xl font-black text-gray-300 mt-1">{scores.draws}</p>
          </div>
          <div className="bg-cyber-card p-3 rounded-2xl border border-cyber-border text-center neon-box-pink">
            <p className="text-xs text-gray-400 uppercase font-bold">JARVIS (O)</p>
            <p className="text-3xl font-black text-cyber-neonPink mt-1">{scores.jarvis}</p>
          </div>
        </div>

        {/* Taunt Speech Bubble */}
        <div className="w-full bg-cyber-card/80 backdrop-blur border border-cyber-border p-3 rounded-2xl mb-6 flex items-start space-x-3 shadow-lg">
          <Sparkles className="w-5 h-5 text-cyber-neonYellow shrink-0 mt-0.5 animate-bounce" />
          <div className="flex-1">
            <p className="text-xs font-bold text-cyber-neonYellow uppercase tracking-wide">JARVIS AI Feed:</p>
            <p className="text-sm text-gray-200 mt-0.5 font-mono">{taunt}</p>
            {chaosMessage && <p className="text-xs text-red-400 font-bold mt-1 animate-pulse">{chaosMessage}</p>}
          </div>
        </div>

        {/* 3x3 XO Grid */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[380px] aspect-square bg-cyber-card p-4 rounded-3xl border border-cyber-border shadow-2xl relative">
          {board.map((cell, index) => {
            const isWinningCell = winningLine.includes(index);
            return (
              <motion.button
                key={index}
                whileHover={{ scale: cell ? 1 : 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleClick(index)}
                className={`rounded-2xl flex items-center justify-center text-5xl font-black transition-all duration-300 relative ${
                  isWinningCell 
                    ? 'bg-gradient-to-br from-cyber-neonCyan to-cyber-neonPink text-white shadow-2xl scale-105' 
                    : cell === 'X' 
                    ? 'bg-cyber-dark/80 text-cyber-neonCyan neon-box-cyan' 
                    : cell === 'O' 
                    ? 'bg-cyber-dark/80 text-cyber-neonPink neon-box-pink' 
                    : 'bg-cyber-dark/40 hover:bg-cyber-border/50 border border-cyber-border/60 text-gray-600'
                }`}
              >
                {cell === 'X' && (
                  <motion.span initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} className="neon-text-cyan">
                    X
                  </motion.span>
                )}
                {cell === 'O' && (
                  <motion.span initial={{ scale: 0, rotate: 180 }} animate={{ scale: 1, rotate: 0 }} className="neon-text-pink">
                    O
                  </motion.span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Controls & Status */}
        <div className="w-full flex items-center justify-between mt-6">
          <div className="text-sm font-semibold">
            {gameStatus === 'playing' ? (
              <span className="flex items-center space-x-2">
                <span className={`w-3 h-3 rounded-full ${isXNext ? 'bg-cyber-neonCyan animate-ping' : 'bg-cyber-neonPink animate-ping'}`} />
                <span className={isXNext ? 'text-cyber-neonCyan' : 'text-cyber-neonPink'}>
                  {isXNext ? "Your Turn (X)" : "JARVIS is calculating..."}
                </span>
              </span>
            ) : (
              <span className="text-cyber-neonYellow font-bold uppercase tracking-wider text-lg">
                {winner === 'draw' ? "Match Drawn!" : `${winner === 'X' ? 'You Win!' : 'JARVIS Wins!'}`}
              </span>
            )}
          </div>

          <button
            onClick={resetGame}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyber-neonCyan to-cyber-neonPink text-cyber-dark font-black flex items-center space-x-2 shadow-lg hover:opacity-90 active:scale-95 transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>RESET BATTLE</span>
          </button>
        </div>

      </main>

      {/* Footer */}
      <footer className="z-10 w-full max-w-4xl text-center text-xs text-gray-500 pt-6 border-t border-cyber-border/40 mt-8">
        JARVIS Autonomous AI Engine • Built for Avira • Next.js & Tailwind CSS
      </footer>
    </div>
  );
}
