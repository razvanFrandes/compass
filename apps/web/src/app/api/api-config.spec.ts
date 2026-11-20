import { apiUrl, wsUrl } from './api-config';

describe('apiUrl', () => {
  it('joins the base and the path', () => {
    expect(apiUrl('/api', 'brief')).toBe('/api/brief');
    expect(apiUrl('/api/', '/workflows/w1/run')).toBe('/api/workflows/w1/run');
    expect(apiUrl('http://localhost:8787/api', 'audit')).toBe('http://localhost:8787/api/audit');
  });

  it('adds the query, skipping empty values and encoding the rest', () => {
    expect(apiUrl('/api', 'proposals', { status: 'pending' })).toBe('/api/proposals?status=pending');
    expect(apiUrl('/api', 'proposals', { status: undefined, other: null })).toBe('/api/proposals');
    expect(apiUrl('/api', 'x', { q: 'a b&c', n: 2 })).toBe('/api/x?q=a%20b%26c&n=2');
  });
});

describe('wsUrl', () => {
  it('follows the page for a relative base: wss on https', () => {
    const page = { protocol: 'https:', host: 'juyo.razvanfrandes.com' };
    expect(wsUrl('/api', 'kassandra/ws', { conversation: 'abc-1' }, page)).toBe('wss://juyo.razvanfrandes.com/api/kassandra/ws?conversation=abc-1');
  });

  it('uses ws through the dev server, port included', () => {
    const page = { protocol: 'http:', host: 'localhost:4200' };
    expect(wsUrl('/api', 'kassandra/ws', { conversation: 'c' }, page)).toBe('ws://localhost:4200/api/kassandra/ws?conversation=c');
  });

  it('keeps the host of an absolute base', () => {
    const page = { protocol: 'https:', host: 'ignored' };
    expect(wsUrl('http://localhost:8787/api', 'kassandra/ws', undefined, page)).toBe('ws://localhost:8787/api/kassandra/ws');
    expect(wsUrl('https://juyo.razvanfrandes.com/api', 'workflows/builder/ws', { draft: 'd' }, page)).toBe(
      'wss://juyo.razvanfrandes.com/api/workflows/builder/ws?draft=d',
    );
  });

  it('defaults to window.location', () => {
    expect(wsUrl('/api', 'kassandra/ws')).toBe(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/kassandra/ws`);
  });
});
