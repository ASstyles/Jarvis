const assert = require('assert');
const taskEngine = require('../src/tasks/taskEngine');

async function runTaskEngineTests() {
  console.log("=========================================");
  console.log("  RUNNING BACKGROUND TASKS TEST SUITE    ");
  console.log("=========================================");

  // Test 1: Task Creation & Queueing
  console.log("\n[TEST 1] Testing Task Creation...");
  const task = taskEngine.createTask('GENERAL_JOB', 'Test Job 1', { description: 'Running validation' }, { timeoutMs: 10000 });
  assert(task.id, "Task ID must be generated.");
  assert(['QUEUED', 'RUNNING'].includes(task.status));
  console.log("  => PASSED ✅");

  // Test 2: Task Execution & Progress
  console.log("\n[TEST 2] Testing Asynchronous Execution & Progress...");
  let completed = false;
  
  await new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      const current = taskEngine.getTaskById(task.id);
      if (current.status === 'COMPLETED') {
        completed = true;
        clearInterval(checkInterval);
        resolve();
      }
    }, 300);
  });

  assert(completed, "Task should reach COMPLETED status.");
  const finalTask = taskEngine.getTaskById(task.id);
  assert.strictEqual(finalTask.progress, 100);
  console.log("  => PASSED ✅");

  // Test 3: Pause & Resume Lifecycle
  console.log("\n[TEST 3] Testing Task Pause and Resume Controls...");
  const task2 = taskEngine.createTask('GENERAL_JOB', 'Test Job 2', { description: 'Pause test' }, { timeoutMs: 15000 });
  // Wait until RUNNING
  await new Promise(r => setTimeout(r, 200));
  taskEngine.pauseTask(task2.id);
  assert.strictEqual(taskEngine.getTaskById(task2.id).status, 'PAUSED');

  taskEngine.resumeTask(task2.id);
  assert.strictEqual(taskEngine.getTaskById(task2.id).status, 'RUNNING');

  taskEngine.cancelTask(task2.id, "Manual cancel for test");
  assert.strictEqual(taskEngine.getTaskById(task2.id).status, 'CANCELLED');
  console.log("  => PASSED ✅");

  console.log("\n=========================================");
  console.log("  ALL BACKGROUND TASK TESTS PASSED! ⚡✅  ");
  console.log("=========================================");
}

runTaskEngineTests().catch(err => {
  console.error("Task Engine Tests Failed ❌:", err);
  process.exit(1);
});
