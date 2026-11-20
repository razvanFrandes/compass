import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HALCYON_HOTELS, type HotelRef } from './hotels';
import { SCOPE_STORAGE_KEY, ScopeService } from './scope.service';

describe('ScopeService', () => {
  let http: HttpTestingController;

  function start(url: string, stored?: string[]): ScopeService {
    history.replaceState(null, '', url);
    if (stored) localStorage.setItem(SCOPE_STORAGE_KEY, JSON.stringify(stored));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const scope = TestBed.inject(ScopeService);
    TestBed.tick();
    return scope;
  }
  const address = () => `${location.pathname}${location.search}${location.hash}`;
  /** `GET /api/hotels` is not deployed everywhere yet: a 404 is the normal case for the fallback. */
  const missing = () => {
    http.expectOne('/api/hotels').flush({ error: 'Not found.' }, { status: 404, statusText: 'Not Found' });
    TestBed.tick();
  };

  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, '', '/');
  });

  it('starts on the whole group, with the built-in hotels until the API answers', () => {
    const scope = start('/');
    expect(scope.hotels()).toEqual([]);
    expect(scope.isAll()).toBe(true);
    expect(scope.label()).toBe('All 20 hotels');
    expect(scope.count()).toBe(20);
    expect(scope.catalog()).toBe(HALCYON_HOTELS);
    expect(scope.includes('LIS')).toBe(true);
    missing();
    expect(scope.source()).toBe('built-in');
    expect(scope.catalog()).toHaveLength(20);
    expect(address()).toBe('/');
  });

  it('uses the hotels of GET /api/hotels once they load, and drops a hotel the group no longer has', async () => {
    const scope = start('/?hotels=LIS,PAR');
    const live: HotelRef[] = HALCYON_HOTELS.filter((hotel) => hotel.code !== 'PAR').map((hotel) => ({ ...hotel }));
    http.expectOne('/api/hotels').flush(live);
    await TestBed.inject(ApplicationRef).whenStable();
    TestBed.tick();
    expect(scope.source()).toBe('api');
    expect(scope.catalog()).toHaveLength(19);
    expect(scope.hotels()).toEqual(['LIS']);
    expect(scope.label()).toBe('Arbor Lisbon Chiado');
    expect(address()).toBe('/?hotels=LIS');
  });

  it('reads the scope from the address, which wins over what was stored', () => {
    const scope = start('/studio?hotels=par,lis,nope', ['NYC']);
    missing();
    expect(scope.hotels()).toEqual(['LIS', 'PAR']);
    expect(scope.label()).toBe('Lisbon Chiado, Paris Opera');
    expect(scope.includes('LIS')).toBe(true);
    expect(scope.includes('NYC')).toBe(false);
    expect(scope.includes(null)).toBe(false);
    // Canonical in the address and remembered for the next visit.
    expect(address()).toBe('/studio?hotels=LIS,PAR');
    expect(JSON.parse(localStorage.getItem(SCOPE_STORAGE_KEY)!)).toEqual(['LIS', 'PAR']);
  });

  it('restores the stored scope when the address has none, and writes it to the address', () => {
    const scope = start('/ask?c=abc', ['DXB2']);
    missing();
    expect(scope.hotels()).toEqual(['DXB2']);
    expect(address()).toBe('/ask?c=abc&hotels=DXB2');
  });

  it('keeps the address and the storage in step with every change, and nothing else in the address moves', () => {
    const scope = start('/ask?c=abc#latest');
    missing();
    scope.set(['PAR', 'LIS']);
    TestBed.tick();
    expect(address()).toBe('/ask?c=abc&hotels=LIS,PAR#latest');
    expect(JSON.parse(localStorage.getItem(SCOPE_STORAGE_KEY)!)).toEqual(['LIS', 'PAR']);

    scope.toggle('LIS');
    TestBed.tick();
    expect(scope.hotels()).toEqual(['PAR']);
    expect(address()).toBe('/ask?c=abc&hotels=PAR#latest');

    scope.toggle('NYC');
    TestBed.tick();
    expect(scope.label()).toBe('Paris Opera, New York Midtown');

    scope.clear();
    TestBed.tick();
    expect(scope.isAll()).toBe(true);
    expect(address()).toBe('/ask?c=abc#latest');
    expect(JSON.parse(localStorage.getItem(SCOPE_STORAGE_KEY)!)).toEqual([]);
  });

  it('treats every hotel selected as the whole group', () => {
    const scope = start('/');
    missing();
    scope.set(HALCYON_HOTELS.map((hotel) => hotel.code));
    TestBed.tick();
    expect(scope.hotels()).toEqual([]);
    expect(address()).toBe('/');
  });

  it('puts the scope on any address the app writes, and back on the one Back lands on', () => {
    const scope = start('/?hotels=LIS');
    missing();
    expect(scope.href('/studio/wf-1')).toBe('/studio/wf-1?hotels=LIS');
    expect(scope.href('/ask?c=abc')).toBe('/ask?c=abc&hotels=LIS');
    // Back to an entry written before the scope changed: the scope stays, the address follows it.
    history.replaceState(null, '', '/boards?hotels=NYC');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(scope.hotels()).toEqual(['LIS']);
    expect(address()).toBe('/boards?hotels=LIS');
  });

  it('names a hotel by its code', () => {
    const scope = start('/');
    missing();
    expect(scope.nameOf('DXB2')).toBe('Tessera Dubai Business Bay');
    expect(scope.nameOf('OPO')).toBe('OPO');
  });
});
