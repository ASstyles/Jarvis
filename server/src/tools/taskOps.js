const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const taskEngine = require("../tasks/taskEngine");

const createBackgroundTaskTool = tool(async ({ type = 'GENERAL_JOB', title, description, timeoutMs = 60000 }) => {
  const task = taskEngine.createTask(type, title, { description }, { timeoutMs });
  return JSON.stringify({
    success: true,
    taskId: task.id,
    status: task.status,
    message: `Background task "${title}" queued successfully (ID: ${task.id}).`
  });
}, {
  name: "create_background_task",
  description: "Create and queue a persistent long-running background task (e.g. monitoring deployment, auditing code, or background analysis).",
  schema: z.object({
    type: z.enum(['DEPLOYMENT_MONITOR', 'CODE_AUDIT', 'GENERAL_JOB']).optional().default('GENERAL_JOB').describe("Type of background task."),
    title: z.string().describe("Descriptive title for the background task."),
    description: z.string().describe("Task objective and payload parameters."),
    timeoutMs: z.number().optional().default(60000).describe("Timeout limit in milliseconds.")
  })
});

const manageBackgroundTaskTool = tool(async ({ taskId, action }) => {
  let success = false;
  let message = "";

  if (action === 'pause') {
    success = taskEngine.pauseTask(taskId);
    message = success ? `Task ${taskId} paused.` : `Failed to pause task ${taskId}.`;
  } else if (action === 'resume') {
    success = taskEngine.resumeTask(taskId);
    message = success ? `Task ${taskId} resumed.` : `Failed to resume task ${taskId}.`;
  } else if (action === 'cancel') {
    success = taskEngine.cancelTask(taskId);
    message = success ? `Task ${taskId} cancelled.` : `Failed to cancel task ${taskId}.`;
  } else if (action === 'retry') {
    success = taskEngine.retryTask(taskId);
    message = success ? `Task ${taskId} re-queued.` : `Failed to retry task ${taskId}.`;
  } else if (action === 'status') {
    const task = taskEngine.getTaskById(taskId);
    return JSON.stringify(task || { error: "Task not found" });
  }

  return JSON.stringify({ success, action, taskId, message });
}, {
  name: "manage_background_task",
  description: "Manage or inspect a long-running background task (pause, resume, cancel, retry, status).",
  schema: z.object({
    taskId: z.string().describe("The ID of the background task."),
    action: z.enum(['pause', 'resume', 'cancel', 'retry', 'status']).describe("Action to perform on the task.")
  })
});

module.exports = {
  createBackgroundTaskTool,
  manageBackgroundTaskTool
};
