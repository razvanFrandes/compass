import { describe, expect, it } from 'vitest';
import { isDraftId, routeOf } from '../src/presentation/http/routes.ts';

describe('routeOf', () => {
  it.each([
    ['/mcp', 'mcp'],
    ['/', 'not_found'],
    ['/apix', 'not_found'],
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
    ['d', true],
    ['3f2b6c1e-0a4d-4b7e-9a51-2f1c0d9e8b7a', true],
    ['a_b-C9', true],
    ['x'.repeat(64), true],
    ['x'.repeat(65), false],
    ['', false],
    ['a b', false],
    ['a/b', false],
    ['é', false],
  ])('%s → %s', (id, valid) => {
    expect(isDraftId(id)).toBe(valid);
  });
});
