const { getCollection, setCollection } = require('../db/database');

const OPERATING_MODES = {
  ASSISTED: 'ASSISTED',
  AUTONOMOUS: 'AUTONOMOUS',
  ZERO_FRICTION: 'ZERO_FRICTION'
};

const RISK_LEVELS = {
  SAFE: 'SAFE',
  CONFIRMATION_REQUIRED: 'CONFIRMATION_REQUIRED',
  RESTRICTED: 'RESTRICTED'
};

class SecurityGuard {
  constructor() {
    this.pendingConfirmations = new Map();
    
    // Default tool risk categories
    this.toolRiskMap = {
      read_file: RISK_LEVELS.SAFE,
      list_directory: RISK_LEVELS.SAFE,
      save_memory: RISK_LEVELS.SAFE,
      recall_memory: RISK_LEVELS.SAFE,
      search_web: RISK_LEVELS.SAFE,
      search_media: RISK_LEVELS.SAFE,
      play_media_url: RISK_LEVELS.SAFE,
      open_url: RISK_LEVELS.SAFE,
      write_notepad: RISK_LEVELS.SAFE,
      read_active_window: RISK_LEVELS.SAFE,
      get_git_status: RISK_LEVELS.SAFE,
      get_git_log: RISK_LEVELS.SAFE,
      web_fetch: RISK_LEVELS.SAFE,
      
      // Computer Use Tools
      capture_screen: RISK_LEVELS.SAFE,
      inspect_ui_elements: RISK_LEVELS.SAFE,
      wait_for_ui_state: RISK_LEVELS.SAFE,
      verify_ui_state: RISK_LEVELS.SAFE,
      mouse_click: RISK_LEVELS.SAFE,
      type_text: RISK_LEVELS.SAFE,
      keyboard_press: RISK_LEVELS.SAFE,

      // Skills & Vault & Tasks
      run_skill: RISK_LEVELS.SAFE,
      save_workflow_skill: RISK_LEVELS.SAFE,
      query_knowledge_vault: RISK_LEVELS.SAFE,
      ingest_vault_document: RISK_LEVELS.SAFE,
      create_background_task: RISK_LEVELS.SAFE,
      manage_background_task: RISK_LEVELS.SAFE,
      run_sandbox_experiment: RISK_LEVELS.SAFE,

      // JARVIS 3.0 Perception & Compute Ops
      ground_ui_element: RISK_LEVELS.SAFE,
      read_screen_text: RISK_LEVELS.SAFE,
      visually_verify_action: RISK_LEVELS.SAFE,
      click_semantic_element: RISK_LEVELS.SAFE,
      dispatch_distributed_job: RISK_LEVELS.SAFE,
      query_compute_fabric: RISK_LEVELS.SAFE,
      manage_distributed_job: RISK_LEVELS.SAFE,

      // Confirmation / Dynamic evaluation tools
      run_terminal_command: RISK_LEVELS.SAFE, // Evaluated dynamically based on command & mode
      manage_files: RISK_LEVELS.SAFE,          // Evaluated dynamically based on action & mode
      system_power: RISK_LEVELS.CONFIRMATION_REQUIRED,
      manage_process: RISK_LEVELS.CONFIRMATION_REQUIRED,
      execute_code_sandbox: RISK_LEVELS.SAFE,
      git_commit: RISK_LEVELS.SAFE
    };
  }

  // --- Operating Mode Governance ---
  getOperatingMode() {
    const persisted = getCollection('operatingMode');
    if (persisted && typeof persisted === 'string') return persisted;
    if (persisted && persisted.mode) return persisted.mode;
    return OPERATING_MODES.ZERO_FRICTION; // Default to Zero-Friction mode
  }

  setOperatingMode(mode) {
    const validModes = Object.values(OPERATING_MODES);
    const normalized = String(mode || '').trim().toUpperCase().replace(/[-\s]/g, '_');
    
    let targetMode = OPERATING_MODES.ZERO_FRICTION;
    if (normalized.includes('ASSIST')) targetMode = OPERATING_MODES.ASSISTED;
    else if (normalized.includes('ZERO') || normalized.includes('FRICTION')) targetMode = OPERATING_MODES.ZERO_FRICTION;
    else if (normalized.includes('AUTO')) targetMode = OPERATING_MODES.AUTONOMOUS;
    else if (validModes.includes(normalized)) targetMode = normalized;

    setCollection('operatingMode', { mode: targetMode, updatedAt: new Date().toISOString() });
    this.logSecurityEvent('OPERATING_MODE_CHANGED', { mode: targetMode });

    try {
      const worldModel = require('../world/worldModel');
      worldModel.addObservation(`Operating Mode set to ${targetMode}`);
      worldModel.saveState();
    } catch (_) {}

    return targetMode;
  }

  // --- Remembered & Scoped Permissions System ---
  getRememberedPermissions() {
    const raw = getCollection('rememberedPermissions');
    const list = Array.isArray(raw) ? raw : [];
    const now = Date.now();
    // Filter out expired permissions
    return list.filter(p => !p.revoked && (!p.expiresAt || new Date(p.expiresAt).getTime() > now));
  }

  grantPermission({ scope = 'WORKSPACE', action = '*', context = '', expiresAt = null, description = '' }) {
    const raw = getCollection('rememberedPermissions');
    const list = Array.isArray(raw) ? raw : [];
    const id = 'perm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    
    const permission = {
      id,
      scope,          // e.g. 'WORKSPACE', 'REPOSITORY', 'SYSTEM', 'TERMINAL_TESTS'
      action,         // e.g. 'run_terminal_command:test', 'manage_files:write', '*'
      context: context || description || 'User granted permission preference',
      description: description || `Granted permission for ${action} in scope ${scope}`,
      grantedAt: new Date().toISOString(),
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      revoked: false,
      auditLog: [
        { event: 'GRANTED', timestamp: new Date().toISOString(), details: 'Explicit permission authorized' }
      ]
    };

    list.unshift(permission);
    setCollection('rememberedPermissions', list);
    this.logSecurityEvent('PERMISSION_REMEMBERED', permission);

    try {
      const worldModel = require('../world/worldModel');
      worldModel.addObservation(`[SECURITY] Remembered permission granted: ${permission.description}`);
    } catch (_) {}

    return permission;
  }

  revokePermission(permissionId) {
    const raw = getCollection('rememberedPermissions');
    const list = Array.isArray(raw) ? raw : [];
    const target = list.find(p => p.id === permissionId);
    if (target) {
      target.revoked = true;
      target.revokedAt = new Date().toISOString();
      target.auditLog.push({ event: 'REVOKED', timestamp: new Date().toISOString() });
      setCollection('rememberedPermissions', list);
      this.logSecurityEvent('PERMISSION_REVOKED', { id: permissionId });
      return true;
    }
    return false;
  }

  isPermissionGranted(toolName, args = {}) {
    const permissions = this.getRememberedPermissions();
    if (permissions.length === 0) return false;

    for (const perm of permissions) {
      if (perm.action === '*' || perm.action === toolName) {
        // Log audit usage
        perm.auditLog.push({
          event: 'USED',
          toolName,
          argsSummary: JSON.stringify(args).substring(0, 100),
          timestamp: new Date().toISOString()
        });
        if (perm.auditLog.length > 50) perm.auditLog.shift();
        setCollection('rememberedPermissions', permissions);
        return true;
      }

      // Check scoped sub-actions (e.g. terminal execution of safe test/build patterns)
      if (toolName === 'run_terminal_command' && args.command) {
        const cmd = String(args.command).toLowerCase();
        if (perm.action === 'terminal:tests' && (cmd.includes('test') || cmd.includes('jest') || cmd.includes('pytest') || cmd.includes('npm test'))) {
          return true;
        }
        if (perm.action === 'terminal:build' && (cmd.includes('build') || cmd.includes('npm run') || cmd.includes('tsc'))) {
          return true;
        }
        if (perm.action === 'terminal:safe' && !cmd.includes('rm -rf') && !cmd.includes('format')) {
          return true;
        }
      }

      if (toolName === 'manage_files' && perm.action.startsWith('files:')) {
        return true;
      }
    }

    return false;
  }

  // --- Base Permission Config ---
  getPermissions() {
    const persisted = getCollection('permissionsConfig') || {};
    const defaultPermissions = {
      fileAccess: { scope: 'WORKSPACE_ONLY', confirmationRequired: false },
      terminalExecution: { scope: 'SAFE_COMMANDS', confirmationRequired: false },
      computerUse: { scope: 'FULL_CONTROL', confirmationRequired: false, requireConfirmationForKeys: false },
      backgroundTasks: { scope: 'ALLOWED', maxWorkers: 4 },
      networkAccess: { scope: 'INTERNET_ENABLED', confirmationRequired: false },
      systemPower: { scope: 'RESTRICTED', confirmationRequired: true }
    };
    return { ...defaultPermissions, ...persisted };
  }

  updatePermissions(newConfig) {
    const current = this.getPermissions();
    const updated = { ...current, ...newConfig };
    setCollection('permissionsConfig', updated);
    this.logSecurityEvent('PERMISSIONS_UPDATED', updated);
    return updated;
  }

  // --- Mode-Aware Risk Assessment ---
  evaluateToolRisk(toolName, args = {}) {
    const mode = this.getOperatingMode();
    const permissions = this.getPermissions();

    // 1. Check if user already granted remembered permission
    if (this.isPermissionGranted(toolName, args)) {
      return RISK_LEVELS.SAFE;
    }

    // 2. Absolute Restricted / Dangerous Operations (enforced in all modes)
    const dangerousShellPatterns = [
      'format ', 'diskpart', 'drop database', 'rm -rf /', 'del /f /s /q c:\\',
      'shutdown /s', 'shutdown -s', 'stop-computer', 'netsh firewall reset', 'reg delete hklm'
    ];

    if (toolName === 'run_terminal_command' && args.command) {
      const cmd = String(args.command).toLowerCase();
      if (dangerousShellPatterns.some(p => cmd.includes(p))) {
        return RISK_LEVELS.CONFIRMATION_REQUIRED;
      }
    }

    if (toolName === 'system_power') {
      return RISK_LEVELS.CONFIRMATION_REQUIRED;
    }

    if (toolName === 'manage_process' && args.action === 'kill') {
      const targetProc = String(args.processName || args.pid || '').toLowerCase();
      const criticalSystemProcs = ['explorer', 'system', 'csrss', 'winlogon', 'services', 'lsass', 'smss', 'svchost'];
      if (criticalSystemProcs.some(p => targetProc.includes(p))) {
        return RISK_LEVELS.RESTRICTED;
      }
    }

    // 3. ZERO-FRICTION MODE: Maximum useful autonomy with minimal unnecessary interruption
    if (mode === OPERATING_MODES.ZERO_FRICTION) {
      // Ordinary development, file management, terminal runs, git, sandbox, and computer use auto-execute safely
      if (toolName === 'run_terminal_command') {
        return RISK_LEVELS.SAFE;
      }

      if (toolName === 'manage_files') {
        // Safe file creation, editing, reading, listing, and workspace reorganization auto-execute
        return RISK_LEVELS.SAFE;
      }

      if (toolName === 'manage_process') {
        // Normal dev process restart / kill is allowed in Zero-Friction
        return RISK_LEVELS.SAFE;
      }

      if (['mouse_click', 'type_text', 'keyboard_press'].includes(toolName)) {
        if (toolName === 'keyboard_press' && args.shortcut) {
          const lower = String(args.shortcut).toLowerCase();
          if (lower.includes('f4') || lower.includes('delete') || lower.includes('shutdown')) {
            return RISK_LEVELS.CONFIRMATION_REQUIRED;
          }
        }
        return RISK_LEVELS.SAFE;
      }

      return this.toolRiskMap[toolName] || RISK_LEVELS.SAFE;
    }

    // 4. AUTONOMOUS MODE: Standard multi-step autonomy with balanced confirmation gates
    if (mode === OPERATING_MODES.AUTONOMOUS) {
      if (toolName === 'manage_files' && args.action === 'delete') {
        return RISK_LEVELS.CONFIRMATION_REQUIRED;
      }

      if (toolName === 'manage_process') {
        return RISK_LEVELS.CONFIRMATION_REQUIRED;
      }

      if (['mouse_click', 'type_text', 'keyboard_press'].includes(toolName)) {
        if (permissions.computerUse?.confirmationRequired) {
          return RISK_LEVELS.CONFIRMATION_REQUIRED;
        }
      }

      return this.toolRiskMap[toolName] || RISK_LEVELS.SAFE;
    }

    // 5. ASSISTED MODE: High-interaction mode (confirms any state-changing operations)
    if (mode === OPERATING_MODES.ASSISTED) {
      const stateChangingTools = [
        'run_terminal_command', 'manage_files', 'manage_process', 'system_power',
        'mouse_click', 'type_text', 'keyboard_press', 'execute_code_sandbox'
      ];
      if (stateChangingTools.includes(toolName)) {
        return RISK_LEVELS.CONFIRMATION_REQUIRED;
      }
      return this.toolRiskMap[toolName] || RISK_LEVELS.SAFE;
    }

    return this.toolRiskMap[toolName] || RISK_LEVELS.SAFE;
  }

  createConfirmationRequest(toolName, args, reason = 'Requires user authorization') {
    const id = 'sec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const confirmation = {
      id,
      toolName,
      args,
      reason,
      status: 'PENDING',
      timestamp: new Date().toISOString()
    };
    this.pendingConfirmations.set(id, confirmation);
    this.logSecurityEvent('CONFIRMATION_REQUESTED', confirmation);
    
    // Update world model
    try {
      const worldModel = require('../world/worldModel');
      worldModel.updatePendingApprovals(this.getPendingConfirmations());
    } catch (_) {}

    return confirmation;
  }

  approveConfirmation(id) {
    const conf = this.pendingConfirmations.get(id);
    if (conf) {
      conf.status = 'APPROVED';
      this.pendingConfirmations.delete(id);
      this.logSecurityEvent('CONFIRMATION_APPROVED', conf);
      
      try {
        const worldModel = require('../world/worldModel');
        worldModel.updatePendingApprovals(this.getPendingConfirmations());
      } catch (_) {}

      return conf;
    }
    return null;
  }

  denyConfirmation(id, reason = 'User denied request') {
    const conf = this.pendingConfirmations.get(id);
    if (conf) {
      conf.status = 'DENIED';
      conf.denialReason = reason;
      this.pendingConfirmations.delete(id);
      this.logSecurityEvent('CONFIRMATION_DENIED', conf);
      
      try {
        const worldModel = require('../world/worldModel');
        worldModel.updatePendingApprovals(this.getPendingConfirmations());
      } catch (_) {}

      return conf;
    }
    return null;
  }

  getPendingConfirmations() {
    return Array.from(this.pendingConfirmations.values());
  }

  logSecurityEvent(eventType, payload) {
    const logs = getCollection('securityLogs');
    logs.push({
      eventType,
      payload,
      timestamp: new Date().toISOString()
    });
    if (logs.length > 200) logs.shift();
    setCollection('securityLogs', logs);
  }

  getSecurityLogs() {
    return getCollection('securityLogs');
  }
}

const securityGuard = new SecurityGuard();
module.exports = { securityGuard, RISK_LEVELS, OPERATING_MODES };
