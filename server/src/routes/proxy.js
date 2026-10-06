const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { requestGuarded, safeFetchText, vetTargetUrl, NetworkSecurityError } = require('../security/netProxy');
const { resolveAndValidatePath } = require('../security/fsGuard');

const router = express.Router();

const SCROLL_SHIM = `
addEventListener('message', function (e) {
  var d = e.data;
  if (!d || d.jarvis !== 'scroll') return;
  if (d.to === 'top') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if (d.to === 'bottom') { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); return; }
  window.scrollBy({ top: d.dy || 0, behavior: d.smooth ? 'smooth' : 'auto' });
});
try { parent.postMessage({ jarvis: 'ready' }, '*'); } catch (e) {}
`;

/**
 * 1. Secure Image Proxy: GET /api/proxy/image?url=...
 */
router.get('/image', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'url parameter required' });

  try {
    const { response, finalUrl } = await requestGuarded(targetUrl, {
      accept: 'image/webp,image/avif,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5',
      timeoutMs: 15000
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Proxied-Url', encodeURI(finalUrl));

    response.pipe(res);
  } catch (err) {
    const status = err.statusCode || 502;
    res.status(status).json({ error: `Image proxy failure: ${err.message}` });
  }
});

/**
 * 2. Secure Media Proxy (Audio / Video): GET /api/proxy/media?url=...
 */
router.get('/media', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'url parameter required' });

  try {
    const { response, finalUrl } = await requestGuarded(targetUrl, {
      accept: 'video/*,audio/*;q=0.9,*/*;q=0.5',
      timeoutMs: 25000
    });

    const contentType = response.headers['content-type'] || 'video/mp4';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    response.pipe(res);
  } catch (err) {
    const status = err.statusCode || 502;
    res.status(status).json({ error: `Media proxy failure: ${err.message}` });
  }
});

/**
 * 3. Local File Proxy: GET /api/proxy/file?path=...
 * Serves local images/screenshots strictly within allowed roots; blocks SVG scripts.
 */
router.get('/file', (req, res) => {
  const targetPath = req.query.path;
  if (!targetPath) return res.status(400).json({ error: 'path parameter required' });

  try {
    const validated = resolveAndValidatePath(targetPath, { mustExist: true });
    const ext = path.extname(validated).toLowerCase();

    // Prohibit SVGs from origin execution
    if (ext === '.svg') {
      return res.status(403).json({ error: 'SVG files are restricted for security.' });
    }

    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.txt': 'text/plain; charset=utf-8',
      '.json': 'application/json'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(validated).pipe(res);
  } catch (err) {
    res.status(403).json({ error: `File access error: ${err.message}` });
  }
});

/**
 * 4. Reader Mode Page Extraction: GET /api/proxy/reader?url=...
 */
router.get('/reader', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'url parameter required' });

  try {
    const { text, finalUrl } = await safeFetchText(targetUrl, 6 * 1024 * 1024, 15000);

    // Basic article extraction: title and prose
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(text);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Document Reader';

    // Remove scripts, styles, forms, iframes
    let body = text
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script\b[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '')
      .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '')
      .replace(/<form\b[\s\S]*?<\/form>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '');

    // Extract main or article or body
    const articleMatch = /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(body) ||
                         /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(body);
    const content = articleMatch ? articleMatch[1] : body;

    const nonce = crypto.randomBytes(16).toString('base64');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.7;
      color: #e2e8f0;
      background: #0b1120;
      padding: 2.5rem 1.5rem;
      max-width: 48rem;
      margin: 0 auto;
    }
    h1 { color: #00f0ff; margin-bottom: 0.5rem; font-size: 1.8rem; }
    a { color: #38bdf8; text-decoration: none; }
    p { margin-bottom: 1.25rem; font-size: 1.05rem; }
    img { max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #1e293b; margin: 1rem 0; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="content">${content}</div>
  <script nonce="${nonce}">${SCROLL_SHIM}</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src 'self' data: https:;`);
    res.send(html);
  } catch (err) {
    res.status(502).send(`<h3>Reader Mode Error</h3><p>${err.message}</p>`);
  }
});

/**
 * 5. General Web Page Surface (Reader & Live Mode): GET /api/proxy/page?mode=reader|live&url=...
 */
router.get('/page', async (req, res) => {
  const targetUrl = req.query.url;
  const mode = req.query.mode === 'live' ? 'live' : 'reader';
  if (!targetUrl) return res.status(400).json({ error: 'url parameter required' });

  try {
    const { text, finalUrl } = await safeFetchText(targetUrl, 8 * 1024 * 1024, 15000);
    const nonce = crypto.randomBytes(16).toString('base64');

    if (mode === 'live') {
      // Live mode: strip scripts, forms, and hazardous schemes while preserving stylesheets
      let sanitizedLive = text
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<script\b[\s\S]*?<\/script>/gi, '')
        .replace(/<script\b[^>]*>/gi, '')
        .replace(/on\w+\s*=\s*(["'])[\s\S]*?\1/gi, '')
        .replace(/on\w+\s*=\s*[^\s>]+/gi, '')
        .replace(/(href|src|action)\s*=\s*(["'])\s*(javascript|data:text\/html|vbscript):[\s\S]*?\2/gi, '$1="#"');

      // Inject base tag so relative stylesheets/images resolve correctly to remote host
      const baseTag = `<base href="${finalUrl}">`;
      if (/<head\b[^>]*>/i.test(sanitizedLive)) {
        sanitizedLive = sanitizedLive.replace(/<head\b[^>]*>/i, `$&${baseTag}`);
      } else {
        sanitizedLive = `${baseTag}${sanitizedLive}`;
      }

      // Inject scroll listener shim
      const shimScript = `<script nonce="${nonce}">${SCROLL_SHIM}</script>`;
      if (/<\/body>/i.test(sanitizedLive)) {
        sanitizedLive = sanitizedLive.replace(/<\/body>/i, `${shimScript}</body>`);
      } else {
        sanitizedLive += shimScript;
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' https: http:; img-src https: http: data: blob:; font-src https: data:; media-src https: http:; connect-src 'none';`);
      return res.send(sanitizedLive);
    } else {
      // Reader mode
      const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(text);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Document Reader';

      let body = text
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<script\b[\s\S]*?<\/script>/gi, '')
        .replace(/<style\b[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '')
        .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '')
        .replace(/<form\b[\s\S]*?<\/form>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '');

      const articleMatch = /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(body) ||
                           /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(body);
      const content = articleMatch ? articleMatch[1] : body;

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.7;
      color: #e2e8f0;
      background: #0b1120;
      padding: 2.5rem 1.5rem;
      max-width: 48rem;
      margin: 0 auto;
    }
    h1 { color: #00f0ff; margin-bottom: 0.5rem; font-size: 1.8rem; }
    a { color: #38bdf8; text-decoration: none; }
    p { margin-bottom: 1.25rem; font-size: 1.05rem; }
    img { max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #1e293b; margin: 1rem 0; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="content">${content}</div>
  <script nonce="${nonce}">${SCROLL_SHIM}</script>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Security-Policy', `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src 'self' data: https:;`);
      return res.send(html);
    }
  } catch (err) {
    res.status(502).send(`<h3>Page Proxy Error</h3><p>${err.message}</p>`);
  }
});

/**
 * 6. URL Probe Endpoint: GET /api/proxy/probe?url=...
 */
router.get('/probe', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'url parameter required' });

  try {
    const { response, finalUrl } = await requestGuarded(targetUrl, { method: 'HEAD', timeoutMs: 8000 });
    const contentType = response.headers['content-type'] || '';
    const contentLength = Number(response.headers['content-length'] || 0);

    let kind = 'article';
    if (contentType.startsWith('image/')) kind = 'image';
    else if (contentType.startsWith('video/')) kind = 'video';
    else if (contentType.startsWith('audio/')) kind = 'audio';
    else if (contentType.includes('application/pdf')) kind = 'document';

    res.json({
      url: finalUrl,
      kind,
      contentType,
      contentLength,
      ok: true
    });
  } catch (err) {
    res.status(502).json({ error: err.message, ok: false });
  }
});

module.exports = router;

