"use client";

import React, { useState, useEffect } from "react";
import AchievementToast, { Achievement } from "./AchievementToast";
import GameCardPreview from "./GameCardPreview";
import GameLaunchModal from "./GameLaunchModal";
import GamerProfileModal from "./GamerProfileModal";
import { soundEngine } from "../engine/SoundEngine";
import { DifficultyLevel } from "../engine/AIGameDirector";
import { GAME_REGISTRY, REGISTERED_GAME_LIST, GameDefinition, getGameById } from "../engine/gameRegistry";
import { Gamepad2, Trophy, Play, Award, Sparkles, User, Flame } from "lucide-react";

export default function GameverseHub() {
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [pendingLaunchGame, setPendingLaunchGame] = useState<GameDefinition | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("MEDIUM");
  const [activeTab, setActiveTab] = useState<"library" | "achievements" | "leaderboard">("library");
  const [showProfileModal, setShowProfileModal] = useState(false);

  const [profile, setProfile] = useState<{ level: number; xp: number; nextLevelXp: number; gamesPlayed: number; totalScore: number; unlockedAchievements: string[] }>({
    level: 1, xp: 0, nextLevelXp: 500, gamesPlayed: 0, totalScore: 0, unlockedAchievements: []
  });

  const [allAchievements, setAllAchievements] = useState<Achievement[]>([]);
  const [leaderboard, setLeaderboard] = useState<{ playerName: string; score: number; difficulty: string }[]>([]);
  const [toastAchievement, setToastAchievement] = useState<Achievement | null>(null);

  const fetchProfile = async () => {
    try {
      const res = await fetch("http://localhost:4000/api/gameverse/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile || {});
        setAllAchievements(data.achievements || []);
      }
    } catch (_) {}
  };

  const fetchLeaderboard = async (gameId: string) => {
    try {
      const res = await fetch(`http://localhost:4000/api/gameverse/leaderboard/${gameId}`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchProfile();
    fetchLeaderboard("boss-protocol");
  }, []);

  const handleScoreSubmit = async (gameId: string, score: number, diff: string, stats: Record<string, unknown>) => {
    try {
      const res = await fetch("http://localhost:4000/api/gameverse/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, score, difficulty: diff, stats })
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        if (data.newAchievements && data.newAchievements.length > 0) {
          setToastAchievement(data.newAchievements[0]);
          soundEngine.playLevelUp();
        }
      }
    } catch (_) {}
  };

  const openLaunchModal = (game: GameDefinition) => {
    console.log(`[GAMEVERSE] Selected game: ${game.title} | Game ID: ${game.id}`);
    soundEngine.playPickup();
    setPendingLaunchGame(game);
  };

  const confirmLaunch = () => {
    if (pendingLaunchGame) {
      console.log(`[GAMEVERSE] Launcher called for: ${pendingLaunchGame.title} (ID: ${pendingLaunchGame.id})`);
      setActiveGameId(pendingLaunchGame.id);
      setPendingLaunchGame(null);
    }
  };

  // Dynamic Component Selection via Registry
  if (activeGameId) {
    const gameDef = getGameById(activeGameId);
    if (gameDef) {
      console.log(`[GAMEVERSE] Resolved component for ID ${activeGameId}: ${gameDef.component.name}`);
      console.log(`[GAMEVERSE] Mount started for: ${gameDef.title}`);
      
      const TargetComponent = gameDef.component;
      const props = {
        difficulty,
        onBack: () => { 
          console.log(`[GAMEVERSE] Exiting game ${activeGameId}, returning to Hub`);
          setActiveGameId(null); 
          fetchProfile(); 
        },
        onScoreSubmit: handleScoreSubmit
      };

      return <TargetComponent {...props} />;
    } else {
      console.error(`[GAMEVERSE] ERROR: Game ID '${activeGameId}' not found in registry!`);
    }
  }

  const xpPct = Math.min(100, Math.round((profile.xp / profile.nextLevelXp) * 100));
  const featuredGame = GAME_REGISTRY["boss-protocol"] || REGISTERED_GAME_LIST[0];

  return (
    <div className="w-full h-full glass-panel rounded-3xl p-6 flex flex-col overflow-y-auto border border-cyan-500/20 font-sans relative min-h-0">
      <AchievementToast achievement={toastAchievement} onClose={() => setToastAchievement(null)} />

      {/* Cinematic Game Start Modal */}
      <GameLaunchModal 
        game={pendingLaunchGame}
        difficulty={difficulty}
        onConfirmLaunch={confirmLaunch}
        onCancel={() => setPendingLaunchGame(null)}
      />

      {/* Gamer Profile Modal */}
      <GamerProfileModal 
        isOpen={showProfileModal}
        profile={profile}
        onClose={() => setShowProfileModal(false)}
      />

      {/* Header Banner */}
      <div className="flex justify-between items-center pb-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_20px_rgba(0,240,255,0.2)]">
            <Gamepad2 size={24} />
          </div>
          <div>
            <h2 className="text-base font-mono font-bold tracking-[0.2em] uppercase text-cyan-300 flex items-center gap-2">
              JARVIS GAMEVERSE <Sparkles size={16} className="text-amber-400 animate-pulse" />
            </h2>
            <span className="text-xs text-white/50">High-End Futuristic Gaming System • 8 Fully Playable Games</span>
          </div>
        </div>

        {/* Player Profile Summary Button */}
        <button 
          onClick={() => setShowProfileModal(true)}
          className="flex items-center gap-6 bg-black/40 border border-white/10 hover:border-amber-500/40 rounded-2xl p-3 font-mono text-xs shadow-xl transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Award size={18} className="text-amber-400" />
            <div className="text-left">
              <div className="text-[10px] text-white/40 uppercase">LEVEL</div>
              <div className="text-sm font-bold text-amber-300">{profile.level}</div>
            </div>
          </div>

          <div className="w-28">
            <div className="flex justify-between text-[9px] text-cyan-400 mb-1 font-bold">
              <span>XP</span>
              <span>{profile.xp}/{profile.nextLevelXp}</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-400 rounded-full transition-all duration-500 shadow-[0_0_10px_#00f0ff]" style={{ width: `${xpPct}%` }} />
            </div>
          </div>
        </button>
      </div>

      {/* Featured Showcase Hero Banner */}
      {activeTab === "library" && (
        <div className="my-4 p-5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-red-950/20 to-[#070913] border border-purple-500/30 flex justify-between items-center shadow-[0_0_40px_rgba(168,85,247,0.15)] relative overflow-hidden flex-shrink-0">
          <div className="max-w-xl z-10">
            <span className="text-[10px] font-mono font-bold text-purple-400 bg-purple-500/20 border border-purple-500/40 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
              FEATURED FLAGSHIP EXPERIENCE
            </span>
            <h3 className="text-xl font-mono font-bold text-white uppercase mt-2">{featuredGame.title}</h3>
            <p className="text-xs text-white/70 mt-1 leading-relaxed">{featuredGame.description}</p>

            <div className="flex items-center gap-3 mt-4">
              <button 
                onClick={() => openLaunchModal(featuredGame)}
                className="bg-purple-600 hover:bg-purple-500 text-white font-mono font-bold text-xs px-6 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)] cursor-pointer"
              >
                <Play size={14} /> LAUNCH SHOWCASE
              </button>
            </div>
          </div>

          <div className="w-48 h-32 hidden md:block">
            <GameCardPreview gameId={featuredGame.id} />
          </div>
        </div>
      )}

      {/* Nav Sub-Tabs & Difficulty Selection */}
      <div className="flex justify-between items-center mb-3 flex-shrink-0">
        <div className="flex gap-2 bg-black/40 p-1 rounded-xl border border-white/10 font-mono text-xs">
          <button 
            onClick={() => setActiveTab("library")}
            className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'library' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold' : 'text-white/50 hover:text-white'}`}
          >
            Game Library
          </button>
          <button 
            onClick={() => setActiveTab("achievements")}
            className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'achievements' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold' : 'text-white/50 hover:text-white'}`}
          >
            Achievements
          </button>
          <button 
            onClick={() => setActiveTab("leaderboard")}
            className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'leaderboard' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold' : 'text-white/50 hover:text-white'}`}
          >
            Leaderboards
          </button>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-[10px] text-white/40 uppercase tracking-widest">Difficulty:</span>
          {(["EASY", "MEDIUM", "HARD", "NIGHTMARE"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                difficulty === d ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content 1: Game Library Grid */}
      {activeTab === "library" && (
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pr-1 min-h-0">
          {REGISTERED_GAME_LIST.map((game) => (
            <div 
              key={game.id}
              onClick={() => openLaunchModal(game)}
              className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col justify-between group hover:border-cyan-500/50 transition-all hover:shadow-[0_0_35px_rgba(0,240,255,0.2)] relative overflow-hidden cursor-pointer min-h-[260px]"
            >
              <div>
                <div className="mb-3">
                  <GameCardPreview gameId={game.id} />
                </div>
                <div className="text-[10px] font-mono text-cyan-400 font-semibold uppercase tracking-wider">{game.category}</div>
                <h3 className="text-sm font-bold text-white mt-0.5">{game.title}</h3>
                <p className="text-xs text-white/60 mt-1 line-clamp-2">{game.description}</p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openLaunchModal(game);
                }}
                className="mt-4 w-full bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(0,240,255,0.4)] cursor-pointer"
              >
                <Play size={14} /> PLAY NOW
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tab Content 2: Achievements Grid */}
      {activeTab === "achievements" && (
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pr-1 min-h-0">
          {allAchievements.map((ach) => {
            const isUnlocked = profile.unlockedAchievements?.includes(ach.id);
            return (
              <div key={ach.id} className={`p-4 rounded-2xl border flex items-center gap-3 font-sans ${
                isUnlocked ? 'bg-amber-500/10 border-amber-500/30 text-white shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'bg-white/[0.02] border-white/5 opacity-40'
              }`}>
                <div className="text-2xl p-2 bg-black/40 rounded-xl">{ach.icon || "🏆"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold truncate">{ach.title}</h4>
                    <span className="text-[10px] font-mono text-amber-400 font-bold">+{ach.xp} XP</span>
                  </div>
                  <p className="text-[11px] text-white/60 mt-0.5">{ach.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab Content 3: Leaderboards */}
      {activeTab === "leaderboard" && (
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 font-mono text-xs min-h-0">
          <div className="flex gap-2 mb-3">
            {REGISTERED_GAME_LIST.map((g) => (
              <button
                key={g.id}
                onClick={() => fetchLeaderboard(g.id)}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-white/70 text-[11px] transition-all hover:text-cyan-300 cursor-pointer"
              >
                {g.title}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {leaderboard.length === 0 ? (
              <div className="text-center text-white/40 py-8">No high scores registered yet. Play a game to set a record!</div>
            ) : (
              leaderboard.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-amber-400 font-mono">#{idx + 1}</span>
                    <span className="text-white">{item.playerName}</span>
                    <span className="text-[10px] text-white/40">[{item.difficulty}]</span>
                  </div>
                  <span className="font-bold text-cyan-300">{item.score} PTS</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
