import { describe, expect, it } from 'vitest';
import { isDraftId, routeOf } from '../src/presentation/http/routes.ts';

describe('routeOf', () => {
  it.each([
    ['/mcp', 'mcp'],
    ['/mcp/', 'assets'],
    ['/', 'assets'],
    ['/index.html', 'assets'],
    ['/main-ABC123.js', 'assets'],
    ['/boards/portfolio', 'assets'],
    ['/api', 'assets'],
    ['/apix', 'assets'],
    ['/api/', 'api'],
    ['/api/nope', 'api'],
    ['/api/kassandra/ws', 'kassandra_ws'],
    ['/api/workflows/builder/ws', 'builder'],
    ['/api/workflows', 'workflows'],
    ['/api/workflows/wf-1', 'workflows'],
    ['/api/workflows/wf-1/run', 'workflows'],
    ['/api/workflows/builder', 'workflows'],
    ['/api/proposals/p-1/decision', 'workflows'],
    ['/api/audit', 'workflows'],
    ['/api/runs/run-1', 'workflows'],
    ['/api/brief', 'api'],
    ['/api/health', 'api'],
  ])('%s → %s', (pathname, route) => {
    expect(routeOf(pathname)).toBe(route);
  });
});

describe('isDraftId', () => {
  it.each([
    ['3f2b6c1e-0a4d-4b7e-9a51-2f1c0d9e8b7a', true],
    ['a_b-C9a_b-C9a_b-C9', true],
    ['x'.repeat(16), true],
    ['x'.repeat(64), true],
    ['x'.repeat(65), false],
    ['x'.repeat(15), false],
    ['d', false],
    ['', false],
    ['a b'.repeat(8), false],
    ['a/b'.repeat(8), false],
    ['é'.repeat(20), false],
  ])('%s → %s', (id, valid) => {
    expect(isDraftId(id)).toBe(valid);
  });
});
