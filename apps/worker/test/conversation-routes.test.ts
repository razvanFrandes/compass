import type { ThreadMeta } from '@compass/contracts';
import { describe, expect, it } from 'vitest';
import { renameMeta } from '../src/application/thread-summary.ts';
import { err, ok } from '../src/domain/result.ts';
import { conversationRoutes, isConversationsPath, type ConversationsApi } from '../src/presentation/http/conversation-routes.ts';

// The conversations API over an in-memory stand-in for the Kassandra objects: status codes, body rules, guard order.
const HOST = 'https://juyo.razvanfrandes.com';
const META: ThreadMeta = { title: 'Tessera Dubai: business mix', summary: 'Corporate down 12% vs last year', kind: 'chart', hotel: 'DXB2', renamed: false };

function api(guards: { rateLimited?: boolean } = {}) {
  const store = new Map<string, ThreadMeta>([['c-1', META]]);
  const calls: string[] = [];
  const threads: ConversationsApi = {
    async meta(id) {
      calls.push(`meta:${id}`);
      return store.get(id) ?? null;
    },
    async rename(id, title) {
      calls.push(`rename:${id}`);
      const next = renameMeta(store.get(id) ?? null, title);
      if (!next.ok) return err(next.error);
      store.set(id, next.value);
      return ok(next.value);
    },
    async forget(id) {
      calls.push(`forget:${id}`);
      store.delete(id);
    },
  };
  const deps = {
    threads,
    rateLimited: async () => {
      calls.push('rate');
      return guards.rateLimited ? Response.json({ error: 'slow down' }, { status: 429 }) : null;
    },
  };
  const send = (method: string, path: string, body?: unknown) => {
    const url = new URL(HOST + path);
    const init = body === undefined ? { method } : { method, body: typeof body === 'string' ? body : JSON.stringify(body) };
    return conversationRoutes(new Request(url, init), url, deps);
  };
  return { send, calls, store };
}

describe('isConversationsPath', () => {
  it.each([
    ['/api/kassandra/conversations', true],
    ['/api/kassandra/conversations/c-1', true],
    ['/api/kassandra/conversationsx', false],
    ['/api/kassandra/ask', false],
  ])('%s → %s', (path, yes) => expect(isConversationsPath(path)).toBe(yes));
});

describe('GET /api/kassandra/conversations?ids=', () => {
  it('returns the meta of each conversation that has one', async () => {
    const { send } = api();
    const response = await send('GET', '/api/kassandra/conversations?ids=c-1,c-2');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ 'c-1': META });
  });

  it('refuses a missing, malformed or too long list of ids', async () => {
    const { send, calls } = api();
    expect((await send('GET', '/api/kassandra/conversations')).status).toBe(400);
    expect((await send('GET', '/api/kassandra/conversations?ids=bad%20id')).status).toBe(400);
    const many = Array.from({ length: 31 }, (_, i) => `c-${i}`).join(',');
    expect((await send('GET', `/api/kassandra/conversations?ids=${many}`)).status).toBe(400);
    expect(calls.filter((c) => c.startsWith('meta'))).toEqual([]);
  });

  it('is rate-limited before any object is asked', async () => {
    const { send, calls } = api({ rateLimited: true });
    expect((await send('GET', '/api/kassandra/conversations?ids=c-1')).status).toBe(429);
    expect(calls).toEqual(['rate']);
  });
});

describe('PATCH /api/kassandra/conversations/:id', () => {
  it('renames, and the title is kept as the person’s', async () => {
    const { send, store } = api();
    const response = await send('PATCH', '/api/kassandra/conversations/c-1', { title: '  Dubai corporate ' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...META, title: 'Dubai corporate', renamed: true });
    expect(store.get('c-1')?.renamed).toBe(true);
  });

  it('refuses a body that is not { title } or a title that is empty', async () => {
    const { send } = api();
    expect((await send('PATCH', '/api/kassandra/conversations/c-1', 'not json')).status).toBe(400);
    expect((await send('PATCH', '/api/kassandra/conversations/c-1', { name: 'x' })).status).toBe(400);
    expect((await send('PATCH', '/api/kassandra/conversations/c-1', { title: '   ' })).status).toBe(400);
  });

  it('refuses a body over the limit with 413', async () => {
    const { send } = api();
    expect((await send('PATCH', '/api/kassandra/conversations/c-1', { title: 'x'.repeat(20_000) })).status).toBe(413);
  });

  it('checks the rate limit before reading the body', async () => {
    const { send, calls } = api({ rateLimited: true });
    expect((await send('PATCH', '/api/kassandra/conversations/c-1', { title: 'x' })).status).toBe(429);
    expect(calls).toEqual(['rate']);
  });
});

describe('DELETE /api/kassandra/conversations/:id', () => {
  it('forgets the conversation on the server', async () => {
    const { send, store } = api();
    expect((await send('DELETE', '/api/kassandra/conversations/c-1')).status).toBe(204);
    expect(store.has('c-1')).toBe(false);
  });

  it('is rate-limited', async () => {
    const { send, calls } = api({ rateLimited: true });
    expect((await send('DELETE', '/api/kassandra/conversations/c-1')).status).toBe(429);
    expect(calls).toEqual(['rate']);
  });
});

describe('anything else', () => {
  it.each([
    ['POST', '/api/kassandra/conversations'],
    ['GET', '/api/kassandra/conversations/c-1'],
    ['PATCH', '/api/kassandra/conversations/bad%20id'],
    ['DELETE', '/api/kassandra/conversations/c-1/extra'],
  ])('%s %s → 404', async (method, path) => {
    expect((await api().send(method, path, method === 'PATCH' ? { title: 'x' } : undefined)).status).toBe(404);
  });
});
