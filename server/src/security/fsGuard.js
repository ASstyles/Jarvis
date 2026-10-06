const fs = require('fs');
const path = require('path');

/**
 * Filesystem Security Guard
 *
 * Enforces strict workspace containment at the tool execution layer.
 * Rejects path traversal, symlink escapes, junction points, UNC paths, and Windows device paths.
 */

// Reserved Windows device names
const WINDOWS_DEVICE_NAMES = new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'
]);

/**
 * Default allowed workspace root directories
 */
function getDefaultAllowedRoots() {
  const workspaceRoot = path.resolve(__dirname, '../../../');
  const tempDir = path.resolve(workspaceRoot, '.jarvis_sandbox');
  if (!fs.existsSync(tempDir)) {
    try { fs.mkdirSync(tempDir, { recursive: true }); } catch (_) {}
  }

  const roots = [workspaceRoot];
  if (process.env.JARVIS_EXTRA_ROOTS) {
    const extra = process.env.JARVIS_EXTRA_ROOTS.split(',').map(s => s.trim()).filter(Boolean);
    roots.push(...extra);
  }

  return roots.map(r => {
    try {
      return fs.realpathSync(r);
    } catch {
      return path.resolve(r);
    }
  });
}

class FilesystemSecurityError extends Error {
  constructor(message, code = 'E_FS_SECURITY') {
    super(message);
    this.name = 'FilesystemSecurityError';
    this.code = code;
  }
}

/**
 * Validates and resolves a target path, guaranteeing it resides strictly inside allowed roots.
 *
 * @param {string} inputPath - The target file or directory path requested.
 * @param {Object} options - Validation options.
 * @param {string[]} [options.allowedRoots] - Explicit array of allowed root directories.
 * @param {boolean} [options.mustExist=false] - Whether the file/dir must already exist.
 * @param {boolean} [options.allowDirectory=true] - Whether directories are allowed.
 * @returns {string} - Canonical, realpath-validated absolute path.
 */
function resolveAndValidatePath(inputPath, options = {}) {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new FilesystemSecurityError('Path argument must be a non-empty string.', 'E_INVALID_PATH');
  }

  const clean = inputPath.trim();

  // 1. Detect and reject UNC paths (e.g., \\server\share) and device namespace paths (\\.\, \\?\)
  if (clean.startsWith('\\\\') || clean.startsWith('//')) {
    throw new FilesystemSecurityError(`UNC and device namespace paths are strictly prohibited: "${clean}"`, 'E_UNC_PROHIBITED');
  }

  // 2. Reject Windows DOS device names (CON, NUL, AUX, PRN, COM1-9, LPT1-9)
  const baseName = path.basename(clean).split('.')[0].toLowerCase();
  if (WINDOWS_DEVICE_NAMES.has(baseName)) {
    throw new FilesystemSecurityError(`Windows reserved device name prohibited: "${baseName}"`, 'E_DEVICE_NAME');
  }

  // 3. Resolve path against workspace base
  const allowedRoots = options.allowedRoots || getDefaultAllowedRoots();
  const primaryRoot = allowedRoots[0];
  const resolvedPath = path.isAbsolute(clean) ? path.resolve(clean) : path.resolve(primaryRoot, clean);

  // 4. Canonicalize via realpath (handling non-existent targets by checking existing ancestor)
  let canonicalPath = resolvedPath;
  if (fs.existsSync(resolvedPath)) {
    canonicalPath = fs.realpathSync(resolvedPath);
  } else {
    if (options.mustExist) {
      throw new FilesystemSecurityError(`Target path does not exist: "${resolvedPath}"`, 'E_NOT_FOUND');
    }

    // Walk up to closest existing ancestor directory to resolve any symlinks along the tree
    let current = path.dirname(resolvedPath);
    let subSegments = [path.basename(resolvedPath)];

    while (!fs.existsSync(current)) {
      const parent = path.dirname(current);
      if (parent === current) break;
      subSegments.unshift(path.basename(current));
      current = parent;
    }

    if (fs.existsSync(current)) {
      const canonicalAncestor = fs.realpathSync(current);
      canonicalPath = path.join(canonicalAncestor, ...subSegments);
    }
  }

  // 5. Verify containment within at least one allowed root
  const isContained = allowedRoots.some(root => {
    const rel = path.relative(root, canonicalPath);
    return !rel.startsWith('..') && !path.isAbsolute(rel);
  });

  if (!isContained) {
    throw new FilesystemSecurityError(
      `Access denied: path "${clean}" resolves outside allowed workspace root (${allowedRoots[0]}).`,
      'E_WORKSPACE_ESCAPE'
    );
  }

  return canonicalPath;
}

module.exports = {
  resolveAndValidatePath,
  FilesystemSecurityError,
  getDefaultAllowedRoots
};
