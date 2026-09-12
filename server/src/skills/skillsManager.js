const { getCollection, setCollection } = require('../db/database');
const worldModel = require('../world/worldModel');

class SkillsManager {
  constructor() {
    this.initDefaultSkills();
  }

  initDefaultSkills() {
    const persisted = getCollection('skills') || [];
    if (persisted.length === 0) {
      const defaultSkills = [
        {
          id: 'skill-project-presentation',
          name: 'Project Presentation',
          description: 'Generates structured presentation slides and executive summary draft in Notepad.',
          trigger: 'prepare presentation for project',
          requiredTools: ['write_notepad', 'read_file'],
          permissions: ['fileAccess'],
          version: '1.0.0',
          author: 'JARVIS Core',
          workflow: [
            { step: 1, action: 'Read project overview and package.json' },
            { step: 2, action: 'Draft slide deck narrative with key highlights' },
            { step: 3, action: 'Write and open presentation document in Notepad' }
          ]
        },
        {
          id: 'skill-website-launch',
          name: 'Website Launch & Verification',
          description: 'Runs build check, verifies web endpoint, and captures screen for UI confirmation.',
          trigger: 'launch website and verify',
          requiredTools: ['run_terminal_command', 'capture_screen', 'open_url'],
          permissions: ['terminalExecution', 'networkAccess'],
          version: '1.0.0',
          author: 'JARVIS Core',
          workflow: [
            { step: 1, action: 'Validate local server is listening' },
            { step: 2, action: 'Launch web browser to application URL' },
            { step: 3, action: 'Capture screen and verify visual elements' }
          ]
        },
        {
          id: 'skill-code-review',
          name: 'Code Review & Security Audit',
          description: 'Performs static analysis, checks code quality standards, and verifies test suites.',
          trigger: 'run code review',
          requiredTools: ['read_file', 'list_directory', 'get_git_status'],
          permissions: ['fileAccess'],
          version: '1.0.0',
          author: 'JARVIS Core',
          workflow: [
            { step: 1, action: 'Inspect git diff and modified files' },
            { step: 2, action: 'Evaluate code safety, security bounds, and readability' },
            { step: 3, action: 'Generate prioritized review recommendations' }
          ]
        },
        {
          id: 'skill-research-report',
          name: 'Deep Research Report',
          description: 'Performs multi-angle web research and synthesizes a comprehensive briefing.',
          trigger: 'research topic in depth',
          requiredTools: ['search_web', 'web_fetch', 'save_memory'],
          permissions: ['networkAccess'],
          version: '1.0.0',
          author: 'JARVIS Core',
          workflow: [
            { step: 1, action: 'Execute multi-query web search' },
            { step: 2, action: 'Extract content and facts from top references' },
            { step: 3, action: 'Store key findings in Memory 2.0 and formulate briefing' }
          ]
        },
        {
          id: 'skill-git-cleanup',
          name: 'Git Branch & Workspace Cleanup',
          description: 'Inspects git status, checks uncommitted changes, and formats clean commit messages.',
          trigger: 'cleanup git workspace',
          requiredTools: ['get_git_status', 'get_git_log'],
          permissions: ['fileAccess'],
          version: '1.0.0',
          author: 'JARVIS Core',
          workflow: [
            { step: 1, action: 'Read current branch and working tree state' },
            { step: 2, action: 'Identify untracked and modified files' },
            { step: 3, action: 'Suggest structured commit messages and branch cleanup' }
          ]
        },
        {
          id: 'skill-deployment-check',
          name: 'Deployment Health Check',
          description: 'Monitors server health, response latencies, and error rates.',
          trigger: 'check deployment health',
          requiredTools: ['web_fetch', 'create_background_task'],
          permissions: ['networkAccess'],
          version: '1.0.0',
          author: 'JARVIS Core',
          workflow: [
            { step: 1, action: 'Send HTTP health check request' },
            { step: 2, action: 'Measure latency and verify status 200 OK' },
            { step: 3, action: 'Queue continuous background monitoring worker' }
          ]
        },
        {
          id: 'skill-data-analysis',
          name: 'Data & Metrics Analysis',
          description: 'Analyzes JSON/tabular datasets, computes key performance indicators, and generates charts/summaries.',
          trigger: 'analyze data dataset',
          requiredTools: ['read_file', 'execute_code_sandbox'],
          permissions: ['fileAccess'],
          version: '1.0.0',
          author: 'JARVIS Core',
          workflow: [
            { step: 1, action: 'Ingest data payload or file' },
            { step: 2, action: 'Run analytical aggregation in sandbox' },
            { step: 3, action: 'Formulate summary metrics table' }
          ]
        },
        {
          id: 'skill-hackathon-prep',
          name: 'Hackathon Sprint Preparation',
          description: 'Outlines rapid MVP architecture, sets up mission subtasks, and generates kickoff documentation.',
          trigger: 'prepare for hackathon sprint',
          requiredTools: ['write_notepad', 'save_memory'],
          permissions: ['fileAccess'],
          version: '1.0.0',
          author: 'JARVIS Core',
          workflow: [
            { step: 1, action: 'Decompose hackathon theme into 3 core MVP pillars' },
            { step: 2, action: 'Generate rapid development timeline and goal subtasks' },
            { step: 3, action: 'Draft project README and kickoff plan' }
          ]
        }
      ];

      setCollection('skills', defaultSkills);
    }
  }

  getAllSkills() {
    return getCollection('skills');
  }

  getSkillById(id) {
    const skills = this.getAllSkills();
    return skills.find(s => s.id === id) || null;
  }

  saveCustomSkill(skillData) {
    const skills = this.getAllSkills();
    const id = skillData.id || 'skill-' + Date.now();
    const newSkill = {
      id,
      name: skillData.name || 'Custom Skill',
      description: skillData.description || '',
      trigger: skillData.trigger || '',
      requiredTools: skillData.requiredTools || [],
      permissions: skillData.permissions || ['fileAccess'],
      workflow: skillData.workflow || [],
      version: '1.0.0',
      author: 'User Saved',
      createdAt: new Date().toISOString()
    };

    const existingIdx = skills.findIndex(s => s.id === id);
    if (existingIdx >= 0) {
      skills[existingIdx] = newSkill;
    } else {
      skills.unshift(newSkill);
    }

    setCollection('skills', skills);
    worldModel.addObservation(`Saved reusable skill: "${newSkill.name}"`);
    return newSkill;
  }

  // Executes a skill by delegating its workflow to goal autopilot
  async executeSkill(skillId, parameters = {}) {
    const skill = this.getSkillById(skillId);
    if (!skill) throw new Error(`Skill with ID "${skillId}" not found.`);

    console.log(`[SKILLS_MANAGER] Executing skill: "${skill.name}"`);
    worldModel.addObservation(`Executing skill: "${skill.name}"`);

    const goalEngine = require('../goals/goalEngine');
    const subtasks = skill.workflow.map((w, idx) => ({
      title: `${skill.name} Step ${idx + 1}: ${w.action}`,
      description: `Action: ${w.action}. Parameters: ${JSON.stringify(parameters)}`,
      agentType: 'general'
    }));

    const mission = goalEngine.createMission(
      `Skill: ${skill.name}`,
      `Executing reusable skill workflow: ${skill.description}`,
      subtasks
    );

    return { success: true, skill, mission };
  }
}

const skillsManager = new SkillsManager();
module.exports = skillsManager;
