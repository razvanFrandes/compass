import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Brief, Proposal, Workflow } from '@compass/contracts';
import { API_BASE } from './api-config';
import { BriefApi } from './brief-api';
import { WorkflowsApi } from './workflows-api';

const brief = (date: string): Brief => ({ businessDate: date, generatedAt: `${date}T05:00:00Z`, items: [], model: null, usage: { tokens: 0, costUsd: 0 } });

describe('HTTP clients', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('WorkflowsApi', () => {
    it('lists workflows', async () => {
      const call = TestBed.inject(WorkflowsApi).list();
      const request = http.expectOne('/api/workflows');
      expect(request.request.method).toBe('GET');
      request.flush([{ id: 'w1' }]);
      expect(await call).toEqual({ ok: true, value: [{ id: 'w1' }] });
    });

    it('gets, creates, patches and runs with the right method, path and body', async () => {
      const api = TestBed.inject(WorkflowsApi);

      const got = api.get('w 1');
      http.expectOne({ method: 'GET', url: '/api/workflows/w%201' }).flush({ workflow: { id: 'w 1' }, runs: [], proposals: [] });
      expect((await got).ok).toBe(true);

      const spec = { name: 'Watch pace', hotels: ['LIS'], trigger: { kind: 'manual' as const }, goal: 'Watch the pace of Lisbon', action: { type: 'notify' as const } };
      const created = api.create(spec);
      const post = http.expectOne({ method: 'POST', url: '/api/workflows' });
      expect(post.request.body).toEqual(spec);
      post.flush({ id: 'w2', ...spec } as Partial<Workflow>);
      expect(await created).toMatchObject({ ok: true, value: { id: 'w2' } });

      const patched = api.patch('w2', { enabled: false });
      const patch = http.expectOne({ method: 'PATCH', url: '/api/workflows/w2' });
      expect(patch.request.body).toEqual({ enabled: false });
      patch.flush({ id: 'w2', enabled: false });
      expect(await patched).toMatchObject({ ok: true, value: { enabled: false } });

      const ran = api.run('w2');
      http.expectOne({ method: 'POST', url: '/api/workflows/w2/run' }).flush({ id: 'r1', status: 'running' });
      expect(await ran).toMatchObject({ ok: true, value: { id: 'r1' } });

      const log = api.runLog('r1');
      http.expectOne({ method: 'GET', url: '/api/runs/r1' }).flush({ run: { id: 'r1' }, entries: [] });
      expect(await log).toMatchObject({ ok: true, value: { entries: [] } });
    });

    it('reads the inbox, decides, undoes and reads the audit log', async () => {
      const api = TestBed.inject(WorkflowsApi);

      const inbox = api.proposals('pending');
      http.expectOne({ method: 'GET', url: '/api/proposals?status=pending' }).flush([]);
      expect(await inbox).toEqual({ ok: true, value: [] });

      const all = api.proposals();
      http.expectOne('/api/proposals').flush([]);
      await all;

      const decided = api.decide('p1', { approved: true, by: 'Ana Pop (RM)' });
      const decision = http.expectOne({ method: 'POST', url: '/api/proposals/p1/decision' });
      expect(decision.request.body).toEqual({ approved: true, by: 'Ana Pop (RM)', note: '' });
      decision.flush({ id: 'p1', status: 'approved' } as Partial<Proposal>);
      expect(await decided).toMatchObject({ ok: true, value: { status: 'approved' } });

      const undone = api.undo('p1', 'Ana Pop (RM)');
      const undo = http.expectOne({ method: 'POST', url: '/api/proposals/p1/undo' });
      expect(undo.request.body).toEqual({ by: 'Ana Pop (RM)' });
      undo.flush({ id: 'p1', status: 'undone' });
      await undone;

      const audit = api.audit();
      http.expectOne({ method: 'GET', url: '/api/audit' }).flush([]);
      expect(await audit).toEqual({ ok: true, value: [] });
    });

    it('returns the server error as a value, with resetsAt on 429', async () => {
      const api = TestBed.inject(WorkflowsApi);

      const conflict = api.run('w1');
      http.expectOne('/api/workflows/w1/run').flush({ error: 'This workflow is already running.' }, { status: 409, statusText: 'Conflict' });
      expect(await conflict).toEqual({ ok: false, error: { status: 409, message: 'This workflow is already running.' } });

      const budget = api.run('w1');
      http
        .expectOne('/api/workflows/w1/run')
        .flush({ error: 'The demo reached its daily limit.', resetsAt: '2026-11-21T00:00:00.000Z' }, { status: 429, statusText: 'Too Many Requests' });
      expect(await budget).toEqual({ ok: false, error: { status: 429, message: 'The demo reached its daily limit.', resetsAt: '2026-11-21T00:00:00.000Z' } });
    });

    it('returns a readable error when the server cannot be reached or answers without a body', async () => {
      const api = TestBed.inject(WorkflowsApi);

      const offline = api.list();
      http.expectOne('/api/workflows').error(new ProgressEvent('error'));
      const failed = await offline;
      expect(failed).toMatchObject({ ok: false, error: { status: 0 } });
      expect(failed.ok === false && failed.error.message).toContain('Couldn’t reach Compass');

      const broken = api.list();
      http.expectOne('/api/workflows').flush('<html>', { status: 502, statusText: 'Bad Gateway' });
      expect(await broken).toEqual({ ok: false, error: { status: 502, message: 'Something went wrong on our side. Try again in a moment.' } });
    });

    it('gives resources that stay idle without an id and load with one', async () => {
      const api = TestBed.inject(WorkflowsApi);
      const { detail, inbox } = TestBed.runInInjectionContext(() => ({
        detail: api.detailResource(() => undefined),
        inbox: api.proposalsResource(),
      }));
      TestBed.tick();
      expect(detail.value()).toBeUndefined();
      expect(inbox.value()).toEqual([]);
      http.expectOne('/api/proposals?status=pending').flush([{ id: 'p1' }]);
      await Promise.resolve();
      TestBed.tick();
      expect(inbox.value()).toEqual([{ id: 'p1' }]);
    });
  });

  describe('BriefApi', () => {
    it('loads the brief as a resource and replaces it after a refresh', async () => {
      const api = TestBed.inject(BriefApi);
      TestBed.tick();
      http.expectOne({ method: 'GET', url: '/api/brief' }).flush(brief('2026-11-20'));
      await Promise.resolve();
      TestBed.tick();
      expect(api.brief.value()?.businessDate).toBe('2026-11-20');
      expect(api.error()).toBeNull();

      const refreshed = api.refresh();
      http.expectOne({ method: 'POST', url: '/api/brief/refresh' }).flush(brief('2026-11-21'));
      expect(await refreshed).toMatchObject({ ok: true });
      expect(api.brief.value()?.businessDate).toBe('2026-11-21');
    });

    it('surfaces a failed load as a value', async () => {
      const api = TestBed.inject(BriefApi);
      TestBed.tick();
      http.expectOne('/api/brief').flush({ error: 'The brief is not ready yet.' }, { status: 503, statusText: 'Unavailable' });
      await Promise.resolve();
      TestBed.tick();
      expect(api.error()).toEqual({ status: 503, message: 'The brief is not ready yet.' });
    });

    it('reads the budget from the configured base', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE, useValue: 'http://localhost:8787/api' }] });
      http = TestBed.inject(HttpTestingController);
      const api = TestBed.inject(BriefApi);
      TestBed.tick();
      http.expectOne('http://localhost:8787/api/brief').flush(brief('2026-11-20'));

      const budget = api.budget();
      http.expectOne('http://localhost:8787/api/budget').flush({ question: { used: 3, limit: 200 } });
      expect(await budget).toMatchObject({ ok: true, value: { question: { used: 3, limit: 200 } } });
    });
  });
});
