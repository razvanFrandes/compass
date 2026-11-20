import { describe, expect, it } from 'vitest';
import { corsHeaders, preflight, withoutCors } from '../src/presentation/http/cors.ts';
import { readJson, withBodyLimit } from '../src/presentation/http/body.ts';
import { constantTimeEqual, hasAdminKey } from '../src/presentation/http/admin.ts';
import { isAllowedOrigin, rejectCrossSite } from '../src/presentation/http/origin.ts';
import { internalError, PublicError, publicMessage } from '../src/presentation/http/errors.ts';

const HOST = 'juyo.razvanfrandes.com';
const post = (path: string, headers: Record<string, string> = {}, body?: string) =>
  new Request(`https://${HOST}${path}`, { method: 'POST', headers, ...(body !== undefined ? { body } : {}) });

describe('isAllowedOrigin', () => {
  it.each([
    ['https://juyo.razvanfrandes.com', true],
    ['http://localhost:4200', true],
    ['http://127.0.0.1:8787', true],
    ['https://evil.example', false],
    ['https://juyo.razvanfrandes.com.evil.example', false],
    ['null', false],
    ['not a url', false],
  ])('%s → %s', (origin, allowed) => {
    expect(isAllowedOrigin(origin)).toBe(allowed);
  });
});

describe('rejectCrossSite', () => {
  it('blocks a mutating request from another site', () => {
    const response = rejectCrossSite(post('/api/workflows/wf-1/run', { Origin: 'https://evil.example' }));
    expect(response?.status).toBe(403);
  });

  it('lets the app itself and local development through', () => {
    expect(rejectCrossSite(post('/api/kassandra/ask', { Origin: `https://${HOST}` }))).toBeNull();
    expect(rejectCrossSite(post('/api/kassandra/ask', { Origin: 'http://localhost:4200' }))).toBeNull();
  });

  it('lets scripts without an Origin through (they still meet the rate limits and the daily budget)', () => {
    expect(rejectCrossSite(post('/api/kassandra/ask'))).toBeNull();
  });

  it('blocks a browser request marked cross-site even without an Origin', () => {
    expect(rejectCrossSite(post('/api/kassandra/ask', { 'Sec-Fetch-Site': 'cross-site' }))?.status).toBe(403);
  });

  it('does not check reads', () => {
    const get = new Request(`https://${HOST}/api/brief`, { headers: { Origin: 'https://evil.example' } });
    expect(rejectCrossSite(get)).toBeNull();
  });
});

describe('readJson', () => {
  it('parses a small JSON body', async () => {
    const result = await readJson(post('/x', { 'content-type': 'application/json' }, '{"question":"hi"}'), 1024);
    expect(result).toEqual({ ok: true, value: { question: 'hi' } });
  });

  it('refuses a body larger than the limit with 413, by header', async () => {
    const result = await readJson(post('/x', { 'content-length': '999999' }, '{}'), 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(413);
  });

  it('refuses a body larger than the limit with 413, by actual size', async () => {
    const big = JSON.stringify({ question: 'x'.repeat(5000) });
    const stream = new Blob([big]).stream();
    const request = new Request(`https://${HOST}/x`, { method: 'POST', body: stream, duplex: 'half' } as RequestInit);
    const result = await readJson(request, 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(413);
  });

  it('refuses invalid JSON with 400', async () => {
    const result = await readJson(post('/x', {}, '{nope'), 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(400);
  });

  it('treats an empty body as an empty object', async () => {
    expect(await readJson(post('/x'), 1024)).toEqual({ ok: true, value: {} });
  });
});

describe('withBodyLimit', () => {
  it('passes a small body on unchanged', async () => {
    const result = await withBodyLimit(post('/mcp', { 'content-type': 'application/json' }, '{"a":1}'), 1024);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(await result.value.text()).toBe('{"a":1}');
      expect(result.value.headers.get('content-type')).toBe('application/json');
    }
  });

  it('refuses a large body with 413', async () => {
    const result = await withBodyLimit(post('/mcp', {}, 'x'.repeat(2048)), 1024);
    expect(result.ok).toBe(false);
  });

  it('leaves bodiless requests alone', async () => {
    const get = new Request(`https://${HOST}/mcp`);
    const result = await withBodyLimit(get, 1024);
    expect(result.ok && result.value).toBe(get);
  });
});

describe('CORS', () => {
  it('strips every CORS header from an /mcp response: MCP clients are not browsers', async () => {
    const response = new Response('{"ok":true}', {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, mcp-session-id',
        'Access-Control-Expose-Headers': 'mcp-session-id',
        'Access-Control-Max-Age': '86400',
        'mcp-session-id': 'abc',
      },
    });
    const stripped = withoutCors(response);
    expect([...stripped.headers.keys()].filter((name) => name.startsWith('access-control-'))).toEqual([]);
    expect(stripped.headers.get('access-control-allow-origin')).toBeNull();
    expect(stripped.headers.get('content-type')).toBe('application/json');
    expect(stripped.headers.get('mcp-session-id')).toBe('abc');
    expect(stripped.status).toBe(200);
    expect(await stripped.text()).toBe('{"ok":true}');
  });

  it('returns a response without CORS headers as it is', () => {
    const response = new Response('ok');
    expect(withoutCors(response)).toBe(response);
  });

  it('adds no CORS headers in production: the app is same-origin', () => {
    expect(corsHeaders(`https://${HOST}`)).toEqual({});
    expect(corsHeaders('https://evil.example')).toEqual({});
  });

  it('allows the Angular dev server', () => {
    expect(corsHeaders('http://localhost:4200')).toMatchObject({ 'Access-Control-Allow-Origin': 'http://localhost:4200', Vary: 'Origin' });
  });

  it('answers a preflight from the dev server and refuses other preflights', () => {
    const ok = preflight(new Request(`https://${HOST}/api/kassandra/ask`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:4200' } }));
    expect(ok?.status).toBe(204);
    expect(ok?.headers.get('Access-Control-Allow-Methods')).toContain('PATCH');
    // Boards and workflows are deleted with DELETE.
    expect(ok?.headers.get('Access-Control-Allow-Methods')).toContain('DELETE');
    const bad = preflight(new Request(`https://${HOST}/api/kassandra/ask`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }));
    expect(bad?.status).toBe(403);
    expect(preflight(post('/api/kassandra/ask'))).toBeNull();
  });
});

describe('admin key', () => {
  it('compares in constant time', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });

  it('is off when no key is configured', () => {
    expect(hasAdminKey(post('/x', { 'x-compass-admin-key': '' }), undefined)).toBe(false);
    expect(hasAdminKey(post('/x', { 'x-compass-admin-key': 'anything' }), '')).toBe(false);
  });

  it('accepts the configured key only', () => {
    const key = 'k'.repeat(32);
    expect(hasAdminKey(post('/x', { 'x-compass-admin-key': key }), key)).toBe(true);
    expect(hasAdminKey(post('/x', { 'x-compass-admin-key': 'wrong' }), key)).toBe(false);
    expect(hasAdminKey(post('/x'), key)).toBe(false);
  });
});

describe('errors', () => {
  it('shows the message of a PublicError and hides any other', () => {
    expect(publicMessage(new PublicError('Send a question.'))).toBe('Send a question.');
    expect(publicMessage(new Error('connect ECONNREFUSED postgres://compass_ro:secret@10.0.0.1:5433'))).not.toMatch(/secret|5433|ECONN/);
  });

  it('answers an unexpected error with a generic 500 and no internals', async () => {
    const response = internalError(new Error('TypeError at /src/index.ts:42 postgres://u:p@h/db'));
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toMatch(/index\.ts|postgres:|TypeError/);
  });
});
