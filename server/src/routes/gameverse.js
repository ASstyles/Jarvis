const express = require('express');
const { getPlayerProfile, processGameScore, getLeaderboard, ACHIEVEMENTS } = require('../gameverse/progression');

const router = express.Router();

// GET profile & progression
router.get('/profile', (req, res) => {
  const profile = getPlayerProfile();
  res.json({ profile, achievements: ACHIEVEMENTS });
});

// POST score submission
router.post('/score', (req, res) => {
  const { gameId, score, difficulty, stats } = req.body;
  if (!gameId) {
    return res.status(400).json({ error: "gameId is required" });
  }

  const result = processGameScore(gameId, score, difficulty || 'MEDIUM', stats || {});
  res.json({ success: true, ...result });
});

// GET leaderboard for a specific game
router.get('/leaderboard/:gameId', (req, res) => {
  const { gameId } = req.params;
  const leaderboard = getLeaderboard(gameId);
  res.json({ gameId, leaderboard });
});

// GET all achievements list
router.get('/achievements', (req, res) => {
  res.json({ achievements: ACHIEVEMENTS });
});

module.exports = router;
