const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { getCollection, setCollection } = require('../db/database');
const worldModel = require('../world/worldModel');

class SelfTestingEngine {
  constructor() {
    this.sandboxBaseDir = path.join(__dirname, '../../../.jarvis_sandbox');
    this.ensureDir(this.sandboxBaseDir);
  }

  ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  // Create isolated sandbox experiment
  createExperiment(name) {
    const runId = 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const experimentDir = path.join(this.sandboxBaseDir, runId);
    this.ensureDir(experimentDir);

    const experiment = {
      id: runId,
      name,
      dirPath: experimentDir,
      status: 'INITIALIZED',
      files: [],
      testResults: null,
      passed: false,
      createdAt: new Date().toISOString()
    };

    const runs = getCollection('sandboxRuns');
    runs.unshift(experiment);
    setCollection('sandboxRuns', runs);
    worldModel.addObservation(`Created isolated sandbox experiment: "${name}" (${runId})`);

    return experiment;
  }

  // Write file inside the isolated sandbox
  writeExperimentFile(runId, relativeFilePath, content) {
    const experimentDir = path.join(this.sandboxBaseDir, runId);
    if (!fs.existsSync(experimentDir)) {
      throw new Error(`Experiment ${runId} directory does not exist.`);
    }

    const fullPath = path.join(experimentDir, relativeFilePath);
    this.ensureDir(path.dirname(fullPath));
    fs.writeFileSync(fullPath, content, 'utf8');

    const runs = getCollection('sandboxRuns');
    const exp = runs.find(r => r.id === runId);
    if (exp) {
      if (!exp.files.includes(relativeFilePath)) exp.files.push(relativeFilePath);
      setCollection('sandboxRuns', runs);
    }

    return { success: true, filePath: fullPath };
  }

  // Execute test / script within sandbox
  async runExperimentScript(runId, scriptCommand, timeoutMs = 15000) {
    const experimentDir = path.join(this.sandboxBaseDir, runId);
    if (!fs.existsSync(experimentDir)) {
      throw new Error(`Experiment ${runId} does not exist.`);
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({ success: false, error: `Execution timed out after ${timeoutMs}ms`, runId });
      }, timeoutMs);

      exec(scriptCommand, { cwd: experimentDir }, (err, stdout, stderr) => {
        clearTimeout(timer);
        const passed = !err;
        const runs = getCollection('sandboxRuns');
        const exp = runs.find(r => r.id === runId);
        if (exp) {
          exp.status = passed ? 'COMPLETED' : 'FAILED';
          exp.passed = passed;
          exp.testResults = {
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: err ? (err.code || 1) : 0
          };
          exp.completedAt = new Date().toISOString();
          setCollection('sandboxRuns', runs);
        }

        worldModel.addObservation(`Sandbox experiment "${exp?.name || runId}" run result: ${passed ? 'PASSED' : 'FAILED'}`);
        resolve({
          success: passed,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          runId
        });
      });
    });
  }

  // Clean up and discard failed experiment
  discardExperiment(runId) {
    const experimentDir = path.join(this.sandboxBaseDir, runId);
    if (fs.existsSync(experimentDir)) {
      try {
        fs.rmSync(experimentDir, { recursive: true, force: true });
      } catch (_) {}
    }

    const runs = getCollection('sandboxRuns');
    const exp = runs.find(r => r.id === runId);
    if (exp) {
      exp.status = 'DISCARDED';
      setCollection('sandboxRuns', runs);
    }
    worldModel.addObservation(`Discarded sandbox experiment: ${runId}`);
    return { success: true, discarded: runId };
  }

  // Promote / apply successful experiment files to target directory
  promoteExperiment(runId, targetBaseDir) {
    const experimentDir = path.join(this.sandboxBaseDir, runId);
    if (!fs.existsSync(experimentDir)) throw new Error(`Experiment ${runId} not found`);

    const runs = getCollection('sandboxRuns');
    const exp = runs.find(r => r.id === runId);
    if (!exp) throw new Error(`Experiment record not found`);

    const copiedFiles = [];
    for (const relFile of exp.files) {
      const src = path.join(experimentDir, relFile);
      const dest = path.join(targetBaseDir, relFile);
      this.ensureDir(path.dirname(dest));
      fs.copyFileSync(src, dest);
      copiedFiles.push(relFile);
    }

    exp.status = 'PROMOTED';
    exp.promotedAt = new Date().toISOString();
    setCollection('sandboxRuns', runs);
    worldModel.addObservation(`Promoted sandbox experiment "${exp.name}" to workspace (${copiedFiles.length} files).`);

    return { success: true, copiedFiles };
  }

  getExperiments() {
    return getCollection('sandboxRuns');
  }
}

const selfTestingEngine = new SelfTestingEngine();
module.exports = selfTestingEngine;
