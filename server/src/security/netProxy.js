const http = require('http');
const https = require('https');
const dns = require('dns');
const net = require('net');

/**
 * Secure Network Proxy & SSRF Defense Layer
 *
 * Implements strict SSRF protection:
 * - Scheme restriction (only http and https)
 * - Blocked IP ranges: Loopback (127.0.0.0/8, ::1), Private RFC 1918 (10/8, 172.16/12, 192.168/16),
 *   CGNAT (100.64/10), Link-local & cloud metadata (169.254.169.254, fe80::/10), IPv4-mapped IPv6,
 *   Unique Local (fc00::/7), Multicast (224.0.0.0/4, ff00::/8)
 * - Custom DNS resolution via guardedLookup to block DNS rebinding attacks
 * - Strict redirect re-validation up to MAX_REDIRECTS (4)
 * - Connection and idle timeouts
 * - Response size capping
 */

const MAX_REDIRECTS = 4;
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_BODY_BYTES = 25 * 1024 * 1024; // 25 MB max

const PROXY_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const BLOCKED_HOSTNAMES = /(^|\.)(localhost|local|internal|intranet|home\.arpa)(\.|$)/i;

class NetworkSecurityError extends Error {
  constructor(message, statusCode = 403, code = 'E_SSRF_BLOCKED') {
    super(message);
    this.name = 'NetworkSecurityError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Checks if a resolved IP address belongs to private/internal/cloud-metadata space.
 */
function isBlockedAddress(ip) {
  let addr = String(ip || '').toLowerCase().split('%')[0];

  // Unwrap IPv4-mapped IPv6 (::ffff:127.0.0.1)
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(addr);
  if (mapped) addr = mapped[1];

  if (addr.includes('.')) {
    const parts = addr.split('.').map(Number);
    if (parts.length !== 4) return true;
    if (parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
    const [a, b] = parts;

    if (a === 0) return true; // 0.0.0.0/8 (current network, routes to localhost)
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 (loopback)
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local & AWS/GCP cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 192 && b === 0) return true; // 192.0.0.0/24 (IETF assignments)
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT / Tailscale)
    if (a === 198 && (b === 18 || b === 19)) return true; // Benchmark network
    if (a >= 224) return true; // Multicast and reserved (224.0.0.0 - 255.255.255.255)
    return false;
  }

  // IPv6 checks
  if (addr === '::' || addr === '::1') return true;
  if (/^::ffff:/.test(addr)) {
    const hex = addr.slice(7).split(':');
    if (hex.length === 2) {
      const high = parseInt(hex[0], 16);
      const low = parseInt(hex[1], 16);
      if (Number.isFinite(high) && Number.isFinite(low)) {
        return isBlockedAddress([high >> 8, high & 0xff, low >> 8, low & 0xff].join('.'));
      }
    }
    return true;
  }
  if (/^f[cd]/.test(addr)) return true; // fc00::/7 (unique local)
  if (/^fe[89ab]/.test(addr)) return true; // fe80::/10 (link-local)
  if (/^ff/.test(addr)) return true; // ff00::/8 (multicast)

  return false;
}

/**
 * Guarded DNS lookup hook passed to http(s).request
 */
function guardedLookup(hostname, options, callback) {
  const opts = typeof options === 'function' ? {} : (options || {});
  const done = typeof options === 'function' ? options : callback;

  dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
    if (err) return done(err);
    const list = Array.isArray(addresses) ? addresses : [addresses];
    if (!list.length) return done(new Error('DNS resolution returned no addresses.'));

    for (const entry of list) {
      if (isBlockedAddress(entry.address)) {
        const error = new NetworkSecurityError(
          `SSRF Refusal: ${hostname} resolves to blocked private address ${entry.address}`,
          403,
          'E_BLOCKED_ADDRESS'
        );
        return done(error);
      }
    }

    if (opts.all) return done(null, list);
    return done(null, list[0].address, list[0].family);
  });
}

/**
 * Validates a target URL against protocol and hostname restrictions.
 */
function vetTargetUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch {
    throw new NetworkSecurityError('Invalid URL: absolute http(s) URL required.', 400, 'E_INVALID_URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new NetworkSecurityError(`Unsupported protocol "${parsed.protocol}": only http and https are permitted.`, 400, 'E_INVALID_PROTOCOL');
  }

  if (!parsed.hostname) {
    throw new NetworkSecurityError('URL must contain a valid hostname.', 400, 'E_MISSING_HOSTNAME');
  }

  if (BLOCKED_HOSTNAMES.test(parsed.hostname)) {
    throw new NetworkSecurityError(`SSRF Refusal: host "${parsed.hostname}" is blocked.`, 403, 'E_BLOCKED_HOST');
  }

  const literal = parsed.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(literal) && isBlockedAddress(literal)) {
    throw new NetworkSecurityError(`SSRF Refusal: IP literal "${literal}" is blocked.`, 403, 'E_BLOCKED_IP');
  }

  return parsed;
}

/**
 * Performs a guarded HTTP/HTTPS request, handling redirects securely.
 */
function requestGuarded(targetUrl, options = {}, redirectHop = 0) {
  return new Promise((resolve, reject) => {
    if (redirectHop > MAX_REDIRECTS) {
      return reject(new NetworkSecurityError('Exceeded maximum redirect limit (4).', 508, 'E_TOO_MANY_REDIRECTS'));
    }

    let url;
    try {
      url = vetTargetUrl(targetUrl);
    } catch (vetErr) {
      return reject(vetErr);
    }

    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    const client = url.protocol === 'https:' ? https : http;

    const req = client.request(url, {
      method: options.method || 'GET',
      headers: {
        'User-Agent': PROXY_UA,
        'Accept': options.accept || '*/*',
        ...(options.headers || {})
      },
      lookup: guardedLookup
    });

    const timer = setTimeout(() => {
      req.destroy(new NetworkSecurityError('Upstream connection timed out.', 504, 'E_TIMEOUT'));
    }, timeoutMs);

    req.setTimeout(timeoutMs, () => {
      req.destroy(new NetworkSecurityError('Upstream socket idle timeout.', 504, 'E_SOCKET_TIMEOUT'));
    });

    req.on('response', (res) => {
      clearTimeout(timer);

      // Handle Redirects (301, 302, 303, 307, 308)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const nextUrl = new URL(res.headers.location, url).href;
        res.resume(); // consume response body to free socket
        return resolve(requestGuarded(nextUrl, options, redirectHop + 1));
      }

      resolve({ response: res, finalUrl: url.href });
    });

    req.on('error', (err) => {
      clearTimeout(timer);
      if (err.code === 'E_BLOCKED_ADDRESS' || err instanceof NetworkSecurityError) {
        return reject(err);
      }
      reject(new NetworkSecurityError(`Upstream network error: ${err.message}`, 502, 'E_UPSTREAM_ERROR'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Fetches text content from a remote URL with SSRF protection.
 */
async function safeFetchText(url, maxBytes = 5 * 1024 * 1024, timeoutMs = 12000) {
  const { response, finalUrl } = await requestGuarded(url, {
    timeoutMs,
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5'
  });

  return new Promise((resolve, reject) => {
    let bytesRead = 0;
    const chunks = [];

    response.on('data', (chunk) => {
      bytesRead += chunk.length;
      if (bytesRead > maxBytes) {
        response.destroy();
        return reject(new NetworkSecurityError(`Response body exceeded maximum allowed size of ${maxBytes} bytes.`, 413, 'E_PAYLOAD_TOO_LARGE'));
      }
      chunks.push(chunk);
    });

    response.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve({
        text: buffer.toString('utf-8'),
        contentType: response.headers['content-type'] || 'text/plain',
        statusCode: response.statusCode,
        finalUrl
      });
    });

    response.on('error', (err) => {
      reject(new NetworkSecurityError(`Stream reading error: ${err.message}`, 502, 'E_STREAM_ERROR'));
    });
  });
}

module.exports = {
  isBlockedAddress,
  guardedLookup,
  vetTargetUrl,
  requestGuarded,
  safeFetchText,
  NetworkSecurityError,
  MAX_REDIRECTS,
  MAX_BODY_BYTES,
  PROXY_UA
};
