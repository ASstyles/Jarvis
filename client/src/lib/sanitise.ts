import DOMPurify from 'dompurify';
import { CONFIG } from './config';

/**
 * Strict Model-Generated HUD Markup Sanitizer
 *
 * Implements full security pipeline:
 * LLM Output -> Schema Validation -> HTML Sanitization -> Class Allowlist ->
 * Attribute Allowlist -> Iframe Host & Path Allowlist -> Proxy URL Rewriting -> CSP Enforcement.
 */

const ALLOWED_CLASSES = new Set([
  'hud-rows',
  'hud-row',
  'hud-idx',
  'hud-main',
  'hud-label',
  'hud-sub',
  'hud-tag',
  'hud-metric',
  'hud-unit',
  'hud-note',
  'hud-img',
  'hud-caption',
  'hud-grid',
  'hud-bar',
  'hud-dim',
  'hud-hot',
  'hud-gallery',
  'hud-thumb',
  'hud-video',
  'hud-embed',
  'hud-figure'
]);

const EMBED_HOSTS: Record<string, RegExp> = {
  'www.youtube-nocookie.com': /^\/embed\/[\w-]+/,
  'www.youtube.com': /^\/embed\/[\w-]+/,
  'youtube.com': /^\/embed\/[\w-]+/,
  'player.vimeo.com': /^\/video\/\d+/,
};

const YT_ID = /^[\w-]{6,20}$/;

const DISK_PATH = /^\/(Users|home|root|Volumes|Applications|System|Library|private|tmp|var|opt|mnt|media|srv|data)\//;

function toEmbedUrl(url: URL): URL | null {
  const host = url.hostname.toLowerCase().replace(/^(?:www|m|music)\./, '');
  let id = '';
  if (host === 'youtube.com' && url.pathname === '/watch') id = url.searchParams.get('v') ?? '';
  else if (host === 'youtu.be') id = url.pathname.slice(1);
  if (!YT_ID.test(id)) return null;
  return new URL(`https://www.youtube-nocookie.com/embed/${id}`);
}

export function rewriteUrl(src: string, route: 'image' | 'media' | 'file'): string {
  const clean = String(src || '').trim();
  if (!clean) return '';
  const disk = clean.replace(/^file:\/\//, '');
  if (DISK_PATH.test(disk)) {
    return `${CONFIG.PROXY_URL}/file?path=${encodeURIComponent(disk)}`;
  }
  if (!/^https?:\/\//i.test(clean)) return clean;
  if (clean.startsWith(`${CONFIG.API_BASE_URL}/`)) return clean;
  return `${CONFIG.PROXY_URL}/${route}?url=${encodeURIComponent(clean)}`;
}

export function sanitizeHudMarkup(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  const clean = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'div', 'span', 'p', 'ul', 'ol', 'li', 'img', 'b', 'strong', 'em', 'i',
      'br', 'small', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'code', 'pre',
      'video', 'source', 'iframe', 'h1', 'h2', 'h3'
    ],
    ALLOWED_ATTR: [
      'class', 'src', 'alt', 'style', 'controls', 'poster', 'loop', 'muted',
      'playsinline', 'preload', 'width', 'height', 'allow', 'allowfullscreen',
      'referrerpolicy', 'type', 'title'
    ],
    ADD_URI_SAFE_ATTR: [
      'controls', 'loop', 'muted', 'playsinline', 'preload', 'width',
      'height', 'allow', 'allowfullscreen', 'referrerpolicy', 'type'
    ],
    ALLOWED_URI_REGEXP: /^(?:data:(?:image|video|audio)\/|file:\/\/|https?:\/\/|\/)/i
  });

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return clean;
  }

  const doc = new DOMParser().parseFromString(`<div>${clean}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement;
  if (!root) return '';

  // 1. Narrow classes
  root.querySelectorAll('[class]').forEach((el) => {
    const kept = (el.getAttribute('class') ?? '')
      .split(/\s+/)
      .filter((c) => ALLOWED_CLASSES.has(c));
    if (kept.length) el.setAttribute('class', kept.join(' '));
    else el.removeAttribute('class');
  });

  // 2. Narrow styles to CSS variables only
  root.querySelectorAll('[style]').forEach((el) => {
    const style = el.getAttribute('style') ?? '';
    const vMatch = /--v\s*:\s*([\d.]+)/.exec(style);
    if (vMatch) el.setAttribute('style', `--v:${vMatch[1]}`);
    else el.removeAttribute('style');
  });

  // 3. Rewrite Media
  root.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src');
    if (src) img.setAttribute('src', rewriteUrl(src, 'image'));
    img.setAttribute('referrerpolicy', 'no-referrer');
  });

  root.querySelectorAll('video').forEach((video) => {
    const src = video.getAttribute('src');
    if (src) video.setAttribute('src', rewriteUrl(src, 'media'));
    const poster = video.getAttribute('poster');
    if (poster) video.setAttribute('poster', rewriteUrl(poster, 'image'));
    video.setAttribute('referrerpolicy', 'no-referrer');
    video.setAttribute('controls', '');
    video.setAttribute('preload', 'metadata');
    video.setAttribute('playsinline', '');
  });

  root.querySelectorAll('source').forEach((source) => {
    const src = source.getAttribute('src');
    const type = source.getAttribute('type') ?? '';
    if (src) source.setAttribute('src', rewriteUrl(src, /^image\//i.test(type) ? 'image' : 'media'));
  });

  // 4. Validate & Rewrite Embed Iframes
  root.querySelectorAll('iframe').forEach((frame) => {
    let url: URL;
    try {
      url = new URL(frame.getAttribute('src') ?? '', document.baseURI);
    } catch {
      frame.remove();
      return;
    }
    const embed = toEmbedUrl(url) ?? url;
    const pathRegex = EMBED_HOSTS[embed.hostname.toLowerCase()];
    if (!pathRegex || !pathRegex.test(embed.pathname)) {
      frame.remove();
      return;
    }
    embed.protocol = 'https:';
    frame.setAttribute('src', embed.toString());
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
    frame.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture');
  });

  return root.innerHTML;
}

export const sanitisePanelHtml = sanitizeHudMarkup;
