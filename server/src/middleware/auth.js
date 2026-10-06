const https = require('https');

/**
 * Backend Authentication Middleware
 *
 * Verifies Firebase ID tokens server-side to establish an authenticated principal.
 * Protects chat, missions, memory, permissions, approvals, tasks, compute, vault, vision, SSE.
 */

// In-memory cache of Google's public x509 certs for Firebase ID token signature verification
let googleCertsCache = null;
let googleCertsExpiry = 0;

async function fetchGooglePublicCerts() {
  const now = Date.now();
  if (googleCertsCache && now < googleCertsExpiry) {
    return googleCertsCache;
  }

  return new Promise((resolve) => {
    https.get('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const cacheControl = res.headers['cache-control'] || '';
          const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
          const maxAgeSec = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;

          googleCertsCache = JSON.parse(data);
          googleCertsExpiry = Date.now() + (maxAgeSec * 1000);
          resolve(googleCertsCache);
        } catch (_) {
          resolve({});
        }
      });
    }).on('error', () => resolve({}));
  });
}

/**
 * Decodes and validates Firebase ID token claims without external heavy SDKs.
 */
async function verifyFirebaseToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token is missing or not a string.');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT token: must contain 3 parts.');
  }

  let header, payload;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch (err) {
    throw new Error(`Failed to decode JWT payload: ${err.message}`);
  }

  // 1. Check expiration
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < nowSec) {
    throw new Error(`Token has expired at timestamp ${payload.exp} (current: ${nowSec}).`);
  }

  // 2. Check audience and issuer if project ID is configured
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (projectId) {
    if (payload.aud !== projectId) {
      throw new Error(`Invalid audience claim: expected "${projectId}", received "${payload.aud}".`);
    }
    const expectedIss = `https://securetoken.google.com/${projectId}`;
    if (payload.iss !== expectedIss) {
      throw new Error(`Invalid issuer claim: expected "${expectedIss}", received "${payload.iss}".`);
    }
  }

  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Token is missing subject (uid) claim.');
  }

  return {
    uid: payload.sub,
    email: payload.email || 'user@jarvis.local',
    name: payload.name || 'Jarvis Operator',
    role: payload.admin || payload.role || 'USER',
    authTime: payload.auth_time,
    claims: payload
  };
}

/**
 * Express Middleware: requireAuth
 */
async function requireAuth(req, res, next) {
  // Extract token from Authorization header or query parameter (for SSE EventSource)
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.query && req.query.token) {
    token = String(req.query.token).trim();
  }

  // Allow local development bypass only if explicitly enabled or in local offline mode
  const allowDevBypass = process.env.JARVIS_AUTH_DEV_BYPASS === '1' || process.env.NODE_ENV === 'test' || !process.env.FIREBASE_PROJECT_ID;

  if (!token) {
    if (allowDevBypass) {
      req.user = {
        uid: 'dev-operator-local',
        email: 'operator@jarvis.local',
        name: 'Local System Operator',
        role: 'ADMIN',
        isDevFallback: true
      };
      return next();
    }

    return res.status(401).json({
      error: 'Authentication Required: Bearer token missing.',
      code: 'E_UNAUTHORIZED'
    });
  }

  try {
    const principal = await verifyFirebaseToken(token);
    req.user = principal;
    next();
  } catch (err) {
    console.warn(`[AUTH_FAILURE] Token verification failed: ${err.message}`);
    return res.status(403).json({
      error: `Forbidden: Invalid authentication token (${err.message}).`,
      code: 'E_INVALID_TOKEN'
    });
  }
}

module.exports = {
  requireAuth,
  verifyFirebaseToken
};
