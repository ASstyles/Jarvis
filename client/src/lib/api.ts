/**
 * JARVIS Centralized API & Authentication Client
 *
 * Automatically resolves API base URL from CONFIG and attaches Firebase Bearer token.
 * Prevents hardcoding of 'http://localhost:4000' across frontend components.
 */

import { auth } from './firebase';
import CONFIG from './config';

export async function getAuthToken(): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
  } catch (err) {
    console.warn('[API_CLIENT] Could not retrieve Firebase ID token:', err);
  }
  return null;
}

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${CONFIG.API_BASE_URL}${cleanEndpoint}`;

  const token = await getAuthToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers
    });

    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json() : await res.text();

    if (!res.ok) {
      const errorMsg = (typeof data === 'object' && data?.error) ? data.error : `HTTP ${res.status}: ${res.statusText}`;
      return { ok: false, status: res.status, error: errorMsg, data };
    }

    return { ok: true, status: res.status, data };
  } catch (err: any) {
    console.error(`[API_CLIENT] Network error reaching ${url}:`, err.message);
    return { ok: false, status: 0, error: err.message || 'Network unreachable' };
  }
}

export { CONFIG };
