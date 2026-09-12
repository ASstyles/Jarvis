const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const skillsManager = require("../skills/skillsManager");

const runSkillTool = tool(async ({ skillId, parameters = "{}" }) => {
  try {
    let parsedParams = {};
    if (typeof parameters === 'string') {
      try { parsedParams = JSON.parse(parameters); } catch (_) { parsedParams = {}; }
    } else if (typeof parameters === 'object' && parameters !== null) {
      parsedParams = parameters;
    }
    const result = await skillsManager.executeSkill(skillId, parsedParams);
    return JSON.stringify(result);
  } catch (err) {
    return JSON.stringify({ success: false, error: err.message });
  }
}, {
  name: "run_skill",
  description: "Execute a reusable workflow skill (e.g. 'skill-project-presentation', 'skill-website-launch', 'skill-code-review', 'skill-research-report', 'skill-git-cleanup', 'skill-deployment-check', 'skill-data-analysis', 'skill-hackathon-prep').",
  schema: z.object({
    skillId: z.string().describe("The ID of the registered skill to execute."),
    parameters: z.string().optional().default("{}").describe("Optional JSON string of parameters.")
  })
});

const saveWorkflowSkillTool = tool(async ({ name, description, trigger, requiredTools = [], workflow = [] }) => {
  const skill = skillsManager.saveCustomSkill({
    name,
    description,
    trigger,
    requiredTools,
    workflow
  });
  return JSON.stringify({ success: true, skill, message: `Skill "${name}" saved to reusable skills library.` });
}, {
  name: "save_workflow_skill",
  description: "Save a successful sequence of actions or workflow as a new reusable skill.",
  schema: z.object({
    name: z.string().describe("Descriptive name of the skill."),
    description: z.string().describe("What the skill accomplishes."),
    trigger: z.string().describe("Natural language trigger query."),
    requiredTools: z.array(z.string()).optional().default([]).describe("List of tool names needed."),
    workflow: z.array(z.object({
      step: z.number(),
      action: z.string()
    })).describe("Step-by-step workflow actions.")
  })
});

module.exports = {
  runSkillTool,
  saveWorkflowSkillTool
};
