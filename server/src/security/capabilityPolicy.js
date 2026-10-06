/**
 * Central Capability Policy Engine
 *
 * Implements fine-grained capability governance for all JARVIS tools and actions.
 * Never relies on brittle tool-name substring matching.
 */

const CAPABILITY_CLASSES = {
  READ: 'READ',
  GENERATE: 'GENERATE',
  LOCAL_WRITE: 'LOCAL_WRITE',
  BROWSER_CONTROL: 'BROWSER_CONTROL',
  PROCESS_CONTROL: 'PROCESS_CONTROL',
  NETWORK: 'NETWORK',
  EXTERNAL_COMMUNICATION: 'EXTERNAL_COMMUNICATION',
  DEVICE_CONTROL: 'DEVICE_CONTROL',
  DESTRUCTIVE: 'DESTRUCTIVE',
  FINANCIAL: 'FINANCIAL',
  SYSTEM: 'SYSTEM'
};

const RISK_LEVELS = {
  SAFE: 'SAFE',
  CONFIRMATION_REQUIRED: 'CONFIRMATION_REQUIRED',
  RESTRICTED: 'RESTRICTED'
};

const RESOURCE_SCOPES = {
  WORKSPACE_ONLY: 'WORKSPACE_ONLY',
  WORKSPACE: 'WORKSPACE',
  LOCAL_SYSTEM: 'LOCAL_SYSTEM',
  NETWORK_PUBLIC: 'NETWORK_PUBLIC',
  BROWSER: 'BROWSER',
  DEVICE: 'DEVICE',
  UI: 'UI',
  GLOBAL: 'GLOBAL'
};

const OPERATING_MODES = {
  ZERO_FRICTION: 'ZERO_FRICTION',
  AUTONOMOUS: 'AUTONOMOUS',
  ASSISTED: 'ASSISTED'
};

/**
 * Static registry of tool capabilities, risk profiles, and execution constraints.
 */
const TOOL_DEFINITIONS = {
  // Filesystem Tools
  read_file: {
    capability: CAPABILITY_CLASSES.READ,
    risk: RISK_LEVELS.SAFE,
    resourceScope: RESOURCE_SCOPES.WORKSPACE_ONLY,
    requiresConfirmation: false,
    canRunAutonomously: true,
    requiresSandboxing: false,
    accessesExternal: false,
    mutatesState: false,
    description: 'Read file contents inside the workspace'
  },
  list_directory: {
    capability: CAPABILITY_CLASSES.READ,
    risk: RISK_LEVELS.SAFE,
    resourceScope: RESOURCE_SCOPES.WORKSPACE_ONLY,
    requiresConfirmation: false,
    canRunAutonomously: true,
    requiresSandboxing: false,
    accessesExternal: false,
    mutatesState: false,
    description: 'List directory entries inside the workspace'
  },
  manage_files: {
    capability: CAPABILITY_CLASSES.LOCAL_WRITE,
    risk: RISK_LEVELS.SAFE, // Evaluated dynamically for delete actions
    resourceScope: RESOURCE_SCOPES.WORKSPACE_ONLY,
    requiresConfirmation: false,
    canRunAutonomously: true,
    requiresSandboxing: false,
    accessesExternal: false,
    mutatesState: true,
    description: 'Create, update, or delete files inside the workspace'
  },

  // Terminal & Execution
  run_terminal_command: {
    capability: CAPABILITY_CLASSES.PROCESS_CONTROL,
    risk: RISK_LEVELS.SAFE, // Evaluated dynamically
    resourceScope: RESOURCE_SCOPES.LOCAL_SYSTEM,
    requiresConfirmation: false,
    canRunAutonomously: true,
    requiresSandboxing: false,
    accessesExternal: false,
    mutatesState: true,
    description: 'Execute shell commands in governed environment'
  },
  execute_code_sandbox: {
    capability: CAPABILITY_CLASSES.GENERATE,
    risk: RISK_LEVELS.SAFE,
    resourceScope: RESOURCE_SCOPES.WORKSPACE,
    requiresConfirmation: false,
    canRunAutonomously: true,
    requiresSandboxing: true,
    accessesExternal: false,
    mutatesState: false,
    description: 'Run code snippet inside isolated worker sandbox'
  },

  // Network & Web
  search_web: {
    capability: CAPABILITY_CLASSES.NETWORK,
    risk: RISK_LEVELS.SAFE,
    resourceScope: RESOURCE_SCOPES.NETWORK_PUBLIC,
    requiresConfirmation: false,
    canRunAutonomously: true,
    requiresSandboxing: false,
    accessesExternal: true,
    mutatesState: false,
    description: 'Search public web via search engine'
  },
  open_url: {
    capability: CAPABILITY_CLASSES.BROWSER_CONTROL,
    risk: RISK_LEVELS.SAFE,
    resourceScope: RESOURCE_SCOPES.BROWSER,
    requiresConfirmation: false,
    canRunAutonomously: true,
    requiresSandboxing: false,
    accessesExternal: true,
    mutatesState: false,
    description: 'Open verified URL in browser'
  },
  web_fetch: {
    capability: CAPABILITY_CLASSES.NETWORK,
    risk: RISK_LEVELS.SAFE,
    resourceScope: RESOURCE_SCOPES.NETWORK_PUBLIC,
    requiresConfirmation: false,
    canRunAutonomously: true,
    requiresSandboxing: false,
    accessesExternal: true,
    mutatesState: false,
    description: 'Fetch and extract text content via SSRF guard'
  },

  // Browser Actions
  chrome_navigate: {
    capability: CAPABILITY_CLASSES.BROWSER_CONTROL,
    risk: RISK_LEVELS.SAFE,
    resourceScope: RESOURCE_SCOPES.BROWSER,
    requiresConfirmation: false,
    canRunAutonomously: true,
    requiresSandboxing: false,
    accessesExternal: true,
    mutatesState: false,
    description: 'Navigate authenticated Chrome tab'
  },
  chrome_screenshot: {
    capability: CAPABILITY_CLASSES.BROWSER_CONTROL,
    risk: RISK_LEVELS.SAFE,
    resourceScope: RESOURCE_SCOPES.BROWSER,
    requiresConfirmation: false,
    canRunAutonomously: true,
    requiresSandboxing: false,
    accessesExternal: false,
    mutatesState: false,
    description: 'Capture screenshot of active Chrome tab'
  },
  chrome_click: {
    capability: CAPABILITY_CLASSES.BROWSER_CONTROL,
    risk: RISK_LEVELS.SAFE,
    resourceScope: RESOURCE_SCOPES.BROWSER,
    requiresConfirmation: false,
    canRunAutonomously: true,
    requiresSandboxing: false,
    accessesExternal: false,
    mutatesState: true,
    description: 'Click element in Chrome tab'
  },
  chrome_type: {
    capability: CAPABILITY_CLASSES.BROWSER_CONTROL,
    risk: RISK_LEVELS.SAFE,
    resourceScope: RESOURCE_SCOPES.BROWSER,
    requiresConfirmation: false,
    canRunAutonomously: true,
    requiresSandboxing: false,
    accessesExternal: false,
    mutatesState: true,
    description: 'Type text into Chrome tab element'
  },

  // Camera & Eyes
  look: {
    capability: CAPABILITY_CLASSES.READ,
    risk: RISK_LEVELS.SAFE,
    resourceScope: RESOURCE_SCOPES.DEVICE,
    requiresConfirmation: false,
    canRunAutonomously: true,
    requiresSandboxing: false,
    accessesExternal: false,
    mutatesState: false,
    description: 'Capture one webcam frame upon explicit user request'
  },
  watch: {
    capability: CAPABILITY_CLASSES.READ,
    risk: RISK_LEVELS.SAFE,
    resourceScope: RESOURCE_SCOPES.DEVICE,
    requiresConfirmation: false,
    canRunAutonomously: true,
    requiresSandboxing: false,
    accessesExternal: false,
    mutatesState: false,
    description: 'Observe brief video clip or review rolling buffer from camera'
  },

  // Agent UI Control
  ui_theme: {
    capability: CAPABILITY_CLASSES.READ,
    risk: RISK_LEVELS.SAFE,
    resourceScope: RESOURCE_SCOPES.UI,
    requiresConfirmation: false,
    canRunAutonomously: true,
    requiresSandboxing: false,
    accessesExternal: false,
    mutatesState: true,
    description: 'Set UI theme colors and accent'
  },
  ui_reactor: {
    capability: CAPABILITY_CLASSES.READ,
    risk: RISK_LEVELS.SAFE,
    resourceScope: RESOURCE_SCOPES.UI,
    requiresConfirmation: false,
    canRunAutonomously: true,
    requiresSandboxing: false,
    accessesExternal: false,
    mutatesState: true,
    description: 'Configure 3D reactor appearance, spin, scale, intensity'
  },
  ui_orbit: {
    capability: CAPABILITY_CLASSES.READ,
    risk: RISK_LEVELS.SAFE,
    resourceScope: RESOURCE_SCOPES.UI,
    requiresConfirmation: false,
    canRunAutonomously: true,
    requiresSandboxing: false,
    accessesExternal: false,
    mutatesState: true,
    description: 'Orbit assets around the reactor'
  },
  ui_chrome: {
    capability: CAPABILITY_CLASSES.READ,
    risk: RISK_LEVELS.SAFE,
    resourceScope: RESOURCE_SCOPES.UI,
    requiresConfirmation: false,
    canRunAutonomously: true,
    requiresSandboxing: false,
    accessesExternal: false,
    mutatesState: true,
    description: 'Toggle UI rails and HUD visibility'
  },
  ui_effect: {
    capability: CAPABILITY_CLASSES.READ,
    risk: RISK_LEVELS.SAFE,
    resourceScope: RESOURCE_SCOPES.UI,
    requiresConfirmation: false,
    canRunAutonomously: true,
    requiresSandboxing: false,
    accessesExternal: false,
    mutatesState: true,
    description: 'Trigger visual HUD flourish (glitch, pulse, scan)'
  },
  ui_reset: {
    capability: CAPABILITY_CLASSES.READ,
    risk: RISK_LEVELS.SAFE,
    resourceScope: RESOURCE_SCOPES.UI,
    requiresConfirmation: false,
    canRunAutonomously: true,
    requiresSandboxing: false,
    accessesExternal: false,
    mutatesState: true,
    description: 'Reset UI to default appearance'
  },
  display: {
    capability: CAPABILITY_CLASSES.GENERATE,
    risk: RISK_LEVELS.SAFE,
    resourceScope: RESOURCE_SCOPES.UI,
    requiresConfirmation: false,
    canRunAutonomously: true,
    requiresSandboxing: false,
    accessesExternal: false,
    mutatesState: true,
    description: 'Author structured HUD panel within Blade system'
  },
  blade: {
    capability: CAPABILITY_CLASSES.GENERATE,
    risk: RISK_LEVELS.SAFE,
    resourceScope: RESOURCE_SCOPES.UI,
    requiresConfirmation: false,
    canRunAutonomously: true,
    requiresSandboxing: false,
    accessesExternal: false,
    mutatesState: true,
    description: 'Open structured Blade on display'
  },

  // High Risk / Destructive / System
  system_power: {
    capability: CAPABILITY_CLASSES.SYSTEM,
    risk: RISK_LEVELS.CONFIRMATION_REQUIRED,
    resourceScope: RESOURCE_SCOPES.LOCAL_SYSTEM,
    requiresConfirmation: true,
    canRunAutonomously: false,
    requiresSandboxing: false,
    accessesExternal: false,
    mutatesState: true,
    description: 'Restart or shutdown system'
  },
  manage_process: {
    capability: CAPABILITY_CLASSES.PROCESS_CONTROL,
    risk: RISK_LEVELS.CONFIRMATION_REQUIRED,
    resourceScope: RESOURCE_SCOPES.LOCAL_SYSTEM,
    requiresConfirmation: true,
    canRunAutonomously: false,
    requiresSandboxing: false,
    accessesExternal: false,
    mutatesState: true,
    description: 'Inspect or terminate system processes'
  }
};

class CapabilityPolicyEngine {
  constructor() {
    this.definitions = new Map(Object.entries(TOOL_DEFINITIONS));
  }

  registerTool(name, definition) {
    this.definitions.set(name, definition);
  }

  getDefinition(name) {
    if (this.definitions.has(name)) {
      return this.definitions.get(name);
    }
    // Dynamic MCP tool evaluation:
    if (name.startsWith('mcp__')) {
      const parts = name.split('__');
      const server = parts[1];
      const toolName = parts.slice(2).join('__');
      return this.evaluateMcpToolDefinition(server, toolName);
    }
    // Default fallback definition for unregistered tools: require confirmation
    return {
      capability: CAPABILITY_CLASSES.SYSTEM,
      risk: RISK_LEVELS.CONFIRMATION_REQUIRED,
      resourceScope: RESOURCE_SCOPES.GLOBAL,
      requiresConfirmation: true,
      canRunAutonomously: false,
      requiresSandboxing: false,
      accessesExternal: true,
      mutatesState: true,
      description: `Unregistered dynamic tool: ${name}`
    };
  }

  evaluateMcpToolDefinition(server, toolName) {
    const READ_SERVERS = new Set([
      'exa', 'exa-code', 'serper', 'serpapi', 'lottie-search', 'mcp-registry',
      'openrouter', 'openrouter-image', 'higgsfield', 'elevenlabs'
    ]);
    const READ_VERBS = /^(get|list|read|search|find|query|fetch|check|describe|inspect|show|view|explain|screenshot)/i;
    const EFFECTFUL_VERBS = /(send|call|post|create|delete|remove|update|edit|write|install|launch|tap|swipe|press|type|buy|pay|charge|publish|deploy|outbound|download)/i;

    const isEffectful = EFFECTFUL_VERBS.test(toolName);
    const isReadServer = READ_SERVERS.has(server);
    const isReadVerb = READ_VERBS.test(toolName);

    if (isEffectful) {
      return {
        capability: CAPABILITY_CLASSES.EXTERNAL_COMMUNICATION,
        risk: RISK_LEVELS.CONFIRMATION_REQUIRED,
        resourceScope: RESOURCE_SCOPES.GLOBAL,
        requiresConfirmation: true,
        canRunAutonomously: false,
        requiresSandboxing: false,
        accessesExternal: true,
        mutatesState: true,
        description: `Effectful MCP tool: ${server}__${toolName}`
      };
    }

    if (isReadServer || isReadVerb) {
      return {
        capability: CAPABILITY_CLASSES.READ,
        risk: RISK_LEVELS.SAFE,
        resourceScope: RESOURCE_SCOPES.NETWORK_PUBLIC,
        requiresConfirmation: false,
        canRunAutonomously: true,
        requiresSandboxing: false,
        accessesExternal: true,
        mutatesState: false,
        description: `Read-only MCP tool: ${server}__${toolName}`
      };
    }

    return {
      capability: CAPABILITY_CLASSES.GENERATE,
      risk: RISK_LEVELS.CONFIRMATION_REQUIRED,
      resourceScope: RESOURCE_SCOPES.GLOBAL,
      requiresConfirmation: true,
      canRunAutonomously: false,
      requiresSandboxing: false,
      accessesExternal: true,
      mutatesState: true,
      description: `MCP tool: ${server}__${toolName}`
    };
  }

  evaluateRisk(toolName, args = {}, operatingMode = OPERATING_MODES.ZERO_FRICTION) {
    const def = this.getDefinition(toolName);

    // 1. High-risk critical operations that require confirmation across all modes
    if (toolName === 'system_power') {
      return {
        risk: RISK_LEVELS.CONFIRMATION_REQUIRED,
        reason: 'System power modifications require explicit clearance.'
      };
    }

    if (toolName === 'manage_files' && args.action === 'delete') {
      // In assisted mode, deletions always require confirmation
      if (operatingMode === OPERATING_MODES.ASSISTED) {
        return {
          risk: RISK_LEVELS.CONFIRMATION_REQUIRED,
          reason: 'File deletion in Assisted Mode requires confirmation.'
        };
      }
    }

    // 2. Dangerous terminal command pattern verification
    if (toolName === 'run_terminal_command' && args.command) {
      const cmd = String(args.command).toLowerCase().trim();
      const destructivePatterns = [
        'format ', 'diskpart', 'drop database', 'rm -rf /', 'del /f /s /q c:\\',
        'shutdown /s', 'shutdown -s', 'stop-computer', 'netsh firewall reset', 'reg delete'
      ];
      if (destructivePatterns.some(pat => cmd.includes(pat))) {
        return {
          risk: RISK_LEVELS.CONFIRMATION_REQUIRED,
          reason: `Destructive shell command pattern detected: ${cmd.substring(0, 40)}`
        };
      }
    }

    // 3. Process termination verification
    if (toolName === 'manage_process' && args.action === 'kill') {
      const proc = String(args.processName || args.pid || '').toLowerCase();
      const criticalProcs = ['explorer', 'system', 'csrss', 'winlogon', 'services', 'lsass', 'smss', 'svchost'];
      if (criticalProcs.some(cp => proc.includes(cp))) {
        return {
          risk: RISK_LEVELS.RESTRICTED,
          reason: `Cannot terminate critical system process: ${proc}`
        };
      }
      return {
        risk: RISK_LEVELS.CONFIRMATION_REQUIRED,
        reason: `Process termination of ${proc} requires clearance.`
      };
    }

    // 4. Operating Mode Overrides
    if (operatingMode === OPERATING_MODES.ASSISTED) {
      if (def.mutatesState || def.capability === CAPABILITY_CLASSES.LOCAL_WRITE || def.capability === CAPABILITY_CLASSES.PROCESS_CONTROL) {
        return {
          risk: RISK_LEVELS.CONFIRMATION_REQUIRED,
          reason: 'Assisted Mode requires explicit user clearance for state-modifying actions.'
        };
      }
    }

    if (operatingMode === OPERATING_MODES.ZERO_FRICTION) {
      if (def.risk === RISK_LEVELS.SAFE || def.canRunAutonomously) {
        return { risk: RISK_LEVELS.SAFE, reason: 'Safe autonomous operation in Zero-Friction mode.' };
      }
    }

    return {
      risk: def.requiresConfirmation ? RISK_LEVELS.CONFIRMATION_REQUIRED : RISK_LEVELS.SAFE,
      reason: def.description
    };
  }
}

const capabilityPolicy = new CapabilityPolicyEngine();

function evaluateToolCall(toolName, args = {}, options = {}) {
  const mode = options.mode || OPERATING_MODES.ZERO_FRICTION;
  const def = capabilityPolicy.getDefinition(toolName);
  const riskEval = capabilityPolicy.evaluateRisk(toolName, args, mode);
  return {
    toolName,
    definition: def,
    risk: riskEval.risk,
    requiresConfirmation: riskEval.risk === RISK_LEVELS.CONFIRMATION_REQUIRED,
    reason: riskEval.reason
  };
}

module.exports = {
  capabilityPolicy,
  evaluateToolCall,
  CAPABILITY_CLASSES,
  RISK_LEVELS,
  RESOURCE_SCOPES,
  OPERATING_MODES,
  TOOL_DEFINITIONS
};
