const { getCollection, setCollection } = require('../db/database');

const ACHIEVEMENTS = [
  { id: 'FIRST_VICTORY', title: 'First Blood', description: 'Win your first game in Gameverse.', xp: 200, icon: '🏆' },
  { id: 'HIGH_SCORER', title: 'High Scorer', description: 'Achieve a score of over 10,000 in any game.', xp: 500, icon: '⭐' },
  { id: 'COMMAND_DEFENDER', title: 'Tactical Mastermind', description: 'Survive wave 10 in JARVIS Command.', xp: 400, icon: '🛡️' },
  { id: 'NEURAL_SPEEDSTER', title: 'Speed Demon', description: 'Survive 2 minutes in Neural Rush.', xp: 350, icon: '⚡' },
  { id: 'STEALTH_GHOST', title: 'Ghost Operative', description: 'Complete Cyber Heist without raising security alerts.', xp: 450, icon: '🕵️' },
  { id: 'ARENA_WARRIOR', title: 'Arena Champion', description: 'Defeat 50 drone units in AI Arena.', xp: 400, icon: '⚔️' },
  { id: 'CODE_MASTER', title: 'Cryptographer', description: 'Solve 5 circuit matrices in Codebreak.', xp: 300, icon: '🧩' },
  { id: 'VOID_NAVIGATOR', title: 'Starship Ace', description: 'Pilot 10,000 meters in Void Runner.', xp: 400, icon: '🚀' },
  { id: 'TACTICAL_GENIUS', title: 'Grandmaster', description: 'Win a match in JARVIS Tactics on Hard/Nightmare.', xp: 500, icon: '♟️' },
  { id: 'BOSS_SLAYER', title: 'Corrupted Core Slayer', description: 'Defeat the Boss in Boss Protocol.', xp: 1000, icon: '👾' },
  { id: 'NIGHTMARE_LEGEND', title: 'Nightmare Legend', description: 'Complete any game on Nightmare difficulty.', xp: 800, icon: '🔥' }
];

function getPlayerProfile() {
  const gData = getCollection('gameverse');
  const profile = gData.profile || {
    level: 1,
    xp: 0,
    nextLevelXp: 500,
    gamesPlayed: 0,
    totalScore: 0,
    unlockedAchievements: []
  };
  return profile;
}

function updatePlayerProfile(profile) {
  const gData = getCollection('gameverse');
  gData.profile = profile;
  setCollection('gameverse', gData);
}

function processGameScore(gameId, rawScore, difficulty = 'MEDIUM', stats = {}) {
  const score = Math.max(0, Math.floor(Number(rawScore) || 0));
  
  // Calculate XP earned from score & difficulty
  let diffMult = 1.0;
  if (difficulty === 'HARD') diffMult = 1.5;
  if (difficulty === 'NIGHTMARE') diffMult = 2.0;

  const earnedXp = Math.floor((score / 10) * diffMult) + 50;

  const profile = getPlayerProfile();
  profile.xp += earnedXp;
  profile.gamesPlayed += 1;
  profile.totalScore += score;

  // Level Up Check
  while (profile.xp >= profile.nextLevelXp) {
    profile.xp -= profile.nextLevelXp;
    profile.level += 1;
    profile.nextLevelXp = profile.level * 500;
  }

  // Achievement Check
  const newAchievements = [];
  const existingIds = new Set(profile.unlockedAchievements);

  function tryUnlock(achId) {
    if (!existingIds.has(achId)) {
      const ach = ACHIEVEMENTS.find(a => a.id === achId);
      if (ach) {
        profile.unlockedAchievements.push(achId);
        newAchievements.push(ach);
        profile.xp += ach.xp;
      }
    }
  }

  tryUnlock('FIRST_VICTORY');
  if (score >= 10000) tryUnlock('HIGH_SCORER');
  if (difficulty === 'NIGHTMARE') tryUnlock('NIGHTMARE_LEGEND');

  if (gameId === 'jarvis-command' && stats.wavesCompleted >= 10) tryUnlock('COMMAND_DEFENDER');
  if (gameId === 'neural-rush' && stats.survivalTime >= 120) tryUnlock('NEURAL_SPEEDSTER');
  if (gameId === 'cyber-heist' && stats.alerts === 0 && stats.victory) tryUnlock('STEALTH_GHOST');
  if (gameId === 'ai-arena' && stats.kills >= 50) tryUnlock('ARENA_WARRIOR');
  if (gameId === 'codebreak' && stats.puzzlesSolved >= 5) tryUnlock('CODE_MASTER');
  if (gameId === 'void-runner' && stats.distance >= 10000) tryUnlock('VOID_NAVIGATOR');
  if (gameId === 'jarvis-tactics' && stats.victory && ['HARD', 'NIGHTMARE'].includes(difficulty)) tryUnlock('TACTICAL_GENIUS');
  if (gameId === 'boss-protocol' && stats.victory) tryUnlock('BOSS_SLAYER');

  updatePlayerProfile(profile);

  // Update Leaderboards
  const gData = getCollection('gameverse');
  if (!gData.leaderboards) gData.leaderboards = {};
  if (!gData.leaderboards[gameId]) gData.leaderboards[gameId] = [];

  const leaderboards = gData.leaderboards[gameId];
  leaderboards.push({
    id: 'lb_' + Date.now(),
    playerName: 'Creator',
    score,
    difficulty,
    timestamp: new Date().toISOString()
  });

  // Sort descending & keep top 20
  gData.leaderboards[gameId] = leaderboards
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  setCollection('gameverse', gData);

  return {
    profile,
    earnedXp,
    newAchievements,
    isHighScore: leaderboards[0]?.score === score
  };
}

function getLeaderboard(gameId) {
  const gData = getCollection('gameverse');
  return (gData.leaderboards && gData.leaderboards[gameId]) || [];
}

module.exports = {
  ACHIEVEMENTS,
  getPlayerProfile,
  processGameScore,
  getLeaderboard
};
