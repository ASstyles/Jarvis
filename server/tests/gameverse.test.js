const assert = require('assert');
const { processGameScore, getPlayerProfile, getLeaderboard, ACHIEVEMENTS } = require('../src/gameverse/progression');

async function runGameverseTests() {
  console.log("=========================================");
  console.log("  RUNNING GAMEVERSE SYSTEM TEST SUITE    ");
  console.log("=========================================");

  // Test 1: Initial Profile & Achievements
  console.log("\n[TEST 1] Testing Player Profile & Achievement Lists...");
  const initialProfile = getPlayerProfile();
  assert(typeof initialProfile.level === 'number');
  assert(Array.isArray(ACHIEVEMENTS) && ACHIEVEMENTS.length > 5);
  console.log("  => PASSED ✅");

  // Test 2: Process Game Score Submission
  console.log("\n[TEST 2] Testing Score Processing, XP Earned & Leveling...");
  const res = processGameScore("boss-protocol", 15000, "NIGHTMARE", { victory: true });
  assert(res.success !== false);
  assert(res.earnedXp > 0, "XP should be awarded for score.");
  assert(res.profile.totalScore >= 15000, "Total score should accumulate.");
  console.log("  => PASSED ✅");

  // Test 3: Achievement Unlocking
  console.log("\n[TEST 3] Testing Achievement Unlocks on High Score & Nightmare Victory...");
  assert(res.profile.unlockedAchievements.includes("FIRST_VICTORY"), "First victory achievement should unlock.");
  assert(res.profile.unlockedAchievements.includes("HIGH_SCORER"), "High scorer achievement should unlock.");
  assert(res.profile.unlockedAchievements.includes("BOSS_SLAYER"), "Boss slayer achievement should unlock.");
  console.log("  => PASSED ✅");

  // Test 4: Leaderboard Top Scores
  console.log("\n[TEST 4] Testing Leaderboard Persistence & Top Ranking...");
  const lb = getLeaderboard("boss-protocol");
  assert(lb.length > 0, "Leaderboard should record score.");
  assert.strictEqual(lb[0].score, 15000, "Top score should match submitted high score.");
  console.log("  => PASSED ✅");

  console.log("\n=========================================");
  console.log("  ALL GAMEVERSE TESTS PASSED! 🎮🎉      ");
  console.log("=========================================");
}

runGameverseTests().catch(err => {
  console.error("Gameverse Tests Failed ❌:", err);
  process.exit(1);
});
