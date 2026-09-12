const assert = require('assert');
const skillsManager = require('../src/skills/skillsManager');
const knowledgeVault = require('../src/vault/knowledgeVault');

async function runSkillsAndVaultTests() {
  console.log("=========================================");
  console.log("  RUNNING SKILLS & KNOWLEDGE VAULT TESTS ");
  console.log("=========================================");

  // Test 1: Pre-loaded 8 Skills Completeness
  console.log("\n[TEST 1] Testing Pre-loaded Production Skills (8 Core Skills)...");
  const skills = skillsManager.getAllSkills();
  assert(skills.length >= 8, `Expected at least 8 skills, found ${skills.length}`);
  
  const expectedSkillIds = [
    'skill-project-presentation',
    'skill-website-launch',
    'skill-code-review',
    'skill-research-report',
    'skill-git-cleanup',
    'skill-deployment-check',
    'skill-data-analysis',
    'skill-hackathon-prep'
  ];

  expectedSkillIds.forEach(id => {
    const s = skillsManager.getSkillById(id);
    assert(s, `Skill "${id}" must exist.`);
    assert(s.workflow.length > 0, `Skill "${id}" must have workflow steps.`);
    console.log(`  - Validated Skill: ${s.name} (${s.workflow.length} steps) => OK`);
  });
  console.log("  => PASSED ✅");

  // Test 2: Custom Skill Recording
  console.log("\n[TEST 2] Testing Custom Reusable Skill Creation...");
  const custom = skillsManager.saveCustomSkill({
    name: "Custom Deployment Skill",
    description: "Custom automated deployment sequence",
    trigger: "run custom deployment",
    workflow: [
      { step: 1, action: "Run build" },
      { step: 2, action: "Verify endpoint" }
    ]
  });
  assert(custom.id);
  assert.strictEqual(custom.author, "User Saved");
  console.log("  => PASSED ✅");

  // Test 3: Knowledge Vault Document Ingestion & Search
  console.log("\n[TEST 3] Testing Knowledge Vault Ingestion & Semantic Querying...");
  knowledgeVault.ingestDocument(
    "Vite React Architecture Notes",
    "Vite uses Rollup under the hood for production builds and esbuild for rapid development module bundling.",
    "document",
    ["react", "bundling", "vite"],
    "notes/vite_react.md"
  );

  const searchResults = knowledgeVault.queryKnowledge("Rollup esbuild bundling", 2);
  assert(searchResults.length > 0, "Query should find indexed document.");
  assert.strictEqual(searchResults[0].title, "Vite React Architecture Notes");
  assert.strictEqual(searchResults[0].source, "notes/vite_react.md");
  console.log(`  => Retrieved: "${searchResults[0].title}" (Score: ${searchResults[0].score})`);
  console.log("  => PASSED ✅");

  console.log("\n=========================================");
  console.log("  ALL SKILLS & VAULT TESTS PASSED! 📚✨   ");
  console.log("=========================================");
}

runSkillsAndVaultTests().catch(err => {
  console.error("Skills & Vault Tests Failed ❌:", err);
  process.exit(1);
});
