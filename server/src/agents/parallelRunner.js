const goalEngine = require('../goals/goalEngine');
const researchAgent = require('./researchAgent');
const codingAgent = require('./codingAgent');
const verificationAgent = require('./verificationAgent');
const worldModel = require('../world/worldModel');
const { securityGuard, OPERATING_MODES } = require('../security/securityGuard');

class ParallelRunner {
  constructor() {
    this.concurrencyLimit = 3;
  }

  async executeMissionParallel(missionId, memoryContextStr, orchestrator) {
    const mission = goalEngine.getMissionById(missionId);
    if (!mission) throw new Error(`Mission ${missionId} not found`);

    const currentMode = securityGuard.getOperatingMode();
    console.log(`[PARALLEL_RUNNER] Starting parallel execution (Mode: ${currentMode}) for Mission: "${mission.title}" (Subtasks: ${mission.subtasks.length})`);
    
    orchestrator.setState('EXECUTING', { missionId, title: mission.title, mode: currentMode });
    const executionResults = new Map(); // subtaskId -> result text
    let activeFailuresCount = 0;

    while (true) {
      // Check if all subtasks are finished
      const currentMission = goalEngine.getMissionById(missionId);
      const allCompleted = currentMission.subtasks.every(st => ['COMPLETED', 'SKIPPED', 'CANCELLED'].includes(st.status));
      if (allCompleted) break;

      const executable = goalEngine.getExecutableSubtasks(missionId);
      if (executable.length === 0) {
        // Check if blocked or deadlock
        const anyRunning = currentMission.subtasks.some(st => st.status === 'IN_PROGRESS');
        if (!anyRunning) {
          console.warn(`[PARALLEL_RUNNER] No executable subtasks remaining and none in progress. Completing mission graph.`);
          break;
        }
        // Wait a short interval for in-progress tasks to finish
        await new Promise(r => setTimeout(r, 400));
        continue;
      }

      // Take batch up to concurrency limit
      const batch = executable.slice(0, this.concurrencyLimit);
      console.log(`[PARALLEL_RUNNER] Dispatching batch of ${batch.length} subtasks: [${batch.map(b => b.title).join(', ')}]`);

      // Run batch concurrently
      const batchPromises = batch.map(async (subtask) => {
        goalEngine.updateSubtask(subtask.id, 'IN_PROGRESS');
        orchestrator.setState('EXECUTING', { missionId, subtask, parallel: true });

        // Gather dependency results into prompt context
        const depResultsStr = (subtask.dependencies || [])
          .map(depId => {
            const depTask = currentMission.subtasks.find(s => s.id === depId);
            return depTask ? `[Input from "${depTask.title}"]: ${depTask.result}` : '';
          })
          .filter(Boolean)
          .join('\n');

        const fullSubtaskContext = `${memoryContextStr}\n${depResultsStr ? `\nDependency Inputs:\n${depResultsStr}\n` : ''}`;

        const startTime = Date.now();
        let subtaskResult = "";

        try {
          if (subtask.agentType === 'research') {
            subtaskResult = await researchAgent.executeResearch(subtask.description || subtask.title, fullSubtaskContext);
          } else if (subtask.agentType === 'coding') {
            subtaskResult = await codingAgent.executeCodingTask(subtask.description || subtask.title, fullSubtaskContext);
          } else {
            // General, analysis, or multi-step execution
            const turnRes = await orchestrator.executeSingleTurnLoop(`${subtask.title}: ${subtask.description || ''}`, fullSubtaskContext);
            subtaskResult = turnRes.text;
          }

          // Verification step
          orchestrator.setState('VERIFYING', { subtask, result: subtaskResult });
          const verification = await verificationAgent.verifyResult(subtask.description || subtask.title, subtaskResult, fullSubtaskContext);

          if (verification.isSatisfied) {
            goalEngine.updateSubtask(subtask.id, 'COMPLETED', subtaskResult);
            executionResults.set(subtask.id, subtaskResult);
            worldModel.addObservation(`[SUBTASK COMPLETED] ${subtask.title} in ${Date.now() - startTime}ms (Confidence: ${verification.confidenceScore || 0.95})`);
          } else {
            // Fail Forward: Remediation retry with alternative strategy
            console.warn(`[PARALLEL_RUNNER] Subtask "${subtask.title}" failed verification: ${verification.remediationPlan}. Auto-remediating...`);
            orchestrator.setState('RECOVERING', { subtask, plan: verification.remediationPlan });
            
            const remediated = await codingAgent.executeCodingTask(
              `Fix and satisfy objective: ${subtask.description || subtask.title}.\nPrevious attempt output: ${subtaskResult}\nRemediation plan: ${verification.remediationPlan}`,
              fullSubtaskContext
            );

            // Re-verify remediated output
            const reVerification = await verificationAgent.verifyResult(subtask.description || subtask.title, remediated, fullSubtaskContext);
            
            goalEngine.updateSubtask(subtask.id, 'COMPLETED', remediated);
            executionResults.set(subtask.id, remediated);
            worldModel.addObservation(`[SUBTASK RECOVERED] ${subtask.title} after remediation (Passed: ${reVerification.isSatisfied}).`);
          }
        } catch (err) {
          activeFailuresCount++;
          console.error(`[PARALLEL_RUNNER] Error executing subtask "${subtask.title}":`, err.message);
          goalEngine.updateSubtask(subtask.id, 'FAILED', null, err.message);
          worldModel.recordFailure('ParallelRunner', err, { subtaskId: subtask.id });
        }
      });

      await Promise.all(batchPromises);
    }

    const finalMission = goalEngine.getMissionById(missionId);
    const completedCount = finalMission.subtasks.filter(st => st.status === 'COMPLETED').length;
    const summary = `Mission "${finalMission.title}" completed with ${completedCount}/${finalMission.subtasks.length} subtasks verified.`;
    
    goalEngine.completeMission(missionId, summary);
    orchestrator.setState('COMPLETED', { missionId, summary });

    return {
      mission: finalMission,
      completedCount,
      totalSubtasks: finalMission.subtasks.length,
      summary,
      results: Array.from(executionResults.entries()).map(([id, res]) => ({ id, result: res }))
    };
  }
}

const parallelRunner = new ParallelRunner();
module.exports = parallelRunner;
