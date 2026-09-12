const { DynamicStructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');
const distributedFabric = require('../compute/distributedFabric');
const jobScheduler = require('../compute/jobScheduler');

const dispatchDistributedJobTool = new DynamicStructuredTool({
  name: 'dispatch_distributed_job',
  description: 'Dispatches a compute-heavy task across the JARVIS Distributed Worker Fabric (e.g., data processing, heavy analysis, test suites, or multi-agent execution) with capability matching and automatic failure recovery.',
  schema: z.object({
    title: z.string().describe('Title / description of the distributed job to execute.'),
    type: z.enum(['HEAVY_COMPUTE', 'DATA_PROCESSING', 'CODE_ANALYSIS', 'SANDBOX_EXPERIMENT', 'RESEARCH_SYNTHESIS', 'GENERAL_COMPUTE']).describe('Job classification type.'),
    payload: z.string().optional().default("{}").describe('JSON string of input parameters for the job.'),
    requiresGpu: z.boolean().optional().describe('Whether this job strictly requires a GPU-enabled worker.'),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional().default('MEDIUM').describe('Job scheduling priority.')
  }),
  func: async ({ title, type, payload = "{}", requiresGpu = false, priority = 'MEDIUM' }) => {
    let parsedPayload = {};
    if (typeof payload === 'string') {
      try { parsedPayload = JSON.parse(payload); } catch (_) { parsedPayload = {}; }
    } else if (typeof payload === 'object' && payload !== null) {
      parsedPayload = payload;
    }
    const job = distributedFabric.dispatchJob(title, type, parsedPayload, { requiresGpu, priority });
    return JSON.stringify({
      success: true,
      jobId: job.id,
      status: job.status,
      assignedWorker: job.workerName,
      message: `Job "${title}" scheduled on distributed compute fabric (Status: ${job.status}).`
    });
  }
});

const queryComputeFabricTool = new DynamicStructuredTool({
  name: 'query_compute_fabric',
  description: 'Queries live worker cluster status, online nodes, CPU/Memory telemetry, active distributed jobs, and health metrics.',
  schema: z.object({}),
  func: async () => {
    const status = distributedFabric.getClusterStatus();
    return JSON.stringify(status);
  }
});

const manageDistributedJobTool = new DynamicStructuredTool({
  name: 'manage_distributed_job',
  description: 'Manages a distributed job in the compute fabric (cancel, check status, or check logs).',
  schema: z.object({
    jobId: z.string().describe('ID of the distributed job.'),
    action: z.enum(['STATUS', 'CANCEL']).describe('Action to perform on the job.')
  }),
  func: async ({ jobId, action }) => {
    if (action === 'CANCEL') {
      const success = distributedFabric.cancelJob(jobId, 'Cancelled via tool directive');
      return JSON.stringify({ success, message: success ? `Job ${jobId} cancelled.` : `Job ${jobId} not found or already completed.` });
    }

    const job = jobScheduler.getJobById(jobId);
    if (!job) {
      return JSON.stringify({ success: false, error: `Job ${jobId} not found.` });
    }
    return JSON.stringify({ success: true, job });
  }
});

module.exports = {
  dispatchDistributedJobTool,
  queryComputeFabricTool,
  manageDistributedJobTool
};
