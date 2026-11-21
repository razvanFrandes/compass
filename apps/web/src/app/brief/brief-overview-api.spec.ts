import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { BriefOverview } from '@compass/contracts';
import { ScopeService } from '../scope/scope.service';
import { BriefOverviewApi } from './brief-overview-api';

const overview = (over: Partial<BriefOverview> = {}): BriefOverview => ({
  businessDate: '2026-11-20',
  hotels: [],
  pulse: { from: '2026-11-20', to: '2026-12-19', month: null, tiles: [] },
  nights: { from: '2026-11-20', to: '2026-12-03', total: [], hotels: [] },
  pickup: { from: '2026-11-14', to: '2026-11-20', byDay: [], byHotel: [] },
  money: { from: '2026-11-20', to: '2026-12-19', byHotel: [], byWeek: [] },
  health: [],
  charts: {},
  failed: [],
  ...over,
});

describe('BriefOverviewApi', () => {
  let http: HttpTestingController;
  let api: BriefOverviewApi;
  let scope: ScopeService;

  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, '', '/');
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    scope = TestBed.inject(ScopeService);
    api = TestBed.inject(BriefOverviewApi);
    TestBed.tick();
    http.match('/api/hotels').forEach((request) => request.flush({ error: 'Not found.' }, { status: 404, statusText: 'Not Found' }));
  });

  const settle = async () => {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  };

  it('reads the whole group without a scope in the address, and loads until it answers', async () => {
    expect(api.state()).toBe('loading');
    expect(api.part('pulse')).toBe('loading');
    http.expectOne('/api/brief/overview').flush(overview());
    await settle();
    expect(api.state()).toBe('ready');
    expect(api.value()?.businessDate).toBe('2026-11-20');
  });

  it('follows the scope: a narrower scope is read again, with its hotels in the address', async () => {
    http.expectOne('/api/brief/overview').flush(overview());
    await settle();
    scope.set(['TYO', 'SIN', 'DPS']);
    await settle();
    // The numbers of the old scope are gone while the new ones load: the page shows its skeletons.
    expect(api.state()).toBe('loading');
    expect(api.value()).toBeNull();
    http.expectOne('/api/brief/overview?hotels=TYO%2CSIN%2CDPS').flush(overview({ hotels: ['DPS', 'SIN', 'TYO'] }));
    await settle();
    expect(api.value()?.hotels).toEqual(['DPS', 'SIN', 'TYO']);
  });

  it('a part the server could not read is an error of its own; the rest is ready', async () => {
    http.expectOne('/api/brief/overview').flush(overview({ pickup: null, failed: ['pickup', 'chart:pace_behind:LIS'] }));
    await settle();
    expect(api.part('pickup')).toBe('error');
    expect(api.part('pulse')).toBe('ready');
    expect(api.part('health')).toBe('ready');
  });

  it('when the read fails, every part says so with the server’s words, and Retry reads again', async () => {
    http.expectOne('/api/brief/overview').flush({ error: 'Too many requests. Try again in a minute.' }, { status: 429, statusText: 'Too Many Requests' });
    await settle();
    expect(api.state()).toBe('error');
    expect(api.part('nights')).toBe('error');
    expect(api.error()).toBe('Too many requests. Try again in a minute.');
    api.retry();
    await settle();
    http.expectOne('/api/brief/overview').flush(overview());
    await settle();
    expect(api.state()).toBe('ready');
  });
});
