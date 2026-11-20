import { InjectionToken } from '@angular/core';

/**
 * Where the API lives. The app is served from the same origin as the API in production, and `ng serve` proxies
 * `/api` to it (proxy.conf.json), so the default is a relative path in both. Provide another value to point the
 * app at a local worker, e.g. `{ provide: API_BASE, useValue: 'http://localhost:8787/api' }`.
 */
export const API_BASE = new InjectionToken<string>('API_BASE', { providedIn: 'root', factory: () => '/api' });

/** The part of `window.location` a socket URL is built from. */
export type LocationLike = Pick<Location, 'protocol' | 'host'>;

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

function withQuery(url: string, query?: QueryParams): string {
  const pairs = Object.entries(query ?? {})
    .filter((pair): pair is [string, string | number | boolean] => pair[1] !== null && pair[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  return pairs.length ? `${url}${url.includes('?') ? '&' : '?'}${pairs.join('&')}` : url;
}

/** `apiUrl('/api', '/proposals', { status: 'pending' })` → `/api/proposals?status=pending`. */
export function apiUrl(base: string, path: string, query?: QueryParams): string {
  return withQuery(`${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`, query);
}

/**
 * The WebSocket URL of an API path. A relative base follows the page (`https:` → `wss:`, same host, so it goes
 * through the dev proxy too); an absolute base keeps its own host.
 */
export function wsUrl(base: string, path: string, query?: QueryParams, location: LocationLike = window.location): string {
  const url = apiUrl(base, path, query);
  if (/^wss?:\/\//i.test(url)) return url;
  if (/^https?:\/\//i.test(url)) return url.replace(/^http/i, 'ws');
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${location.host}${url.startsWith('/') ? '' : '/'}${url}`;
}
