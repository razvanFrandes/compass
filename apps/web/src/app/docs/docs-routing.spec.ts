import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SOCKET_FACTORY } from '../api';
import { FakeSocket } from '../api/testing';
import { pageTitle } from '../app';
import { Live } from '../live';
import { CompassStore } from '../store';
import { DOCS_PAGES, SHOWCASES, docsLabel, docsPageOf, docsPath, docsTitle } from './docs-pages';
import { DocsRouter } from './docs-router';

function setup(url: string) {
  history.replaceState(null, '', url);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: SOCKET_FACTORY, useValue: (socketUrl: string) => new FakeSocket(socketUrl) }] });
  const live = TestBed.inject(Live);
  TestBed.tick();
  return { live, store: TestBed.inject(CompassStore), router: TestBed.inject(DocsRouter) };
}

describe('docs pages', () => {
  it('lists the eight sections, in the order the Docs panel shows them', () => {
    expect(DOCS_PAGES.map((p) => p.label)).toEqual(['Architecture', 'Components', 'Design system', 'Kassandra & agents', 'Data & MCP', 'Security', 'Decisions', 'About this build']);
    expect(new Set(DOCS_PAGES.map((p) => p.id)).size).toBe(DOCS_PAGES.length);
    for (const p of DOCS_PAGES) {
      expect(p.blurb.length).toBeGreaterThan(20);
      expect(p.icon).toMatch(/^phosphor[A-Z]\w+Light$/);
    }
  });

  it('gives every page an address under /docs', () => {
    expect(docsPath('index')).toBe('/docs');
    expect(docsPath('architecture')).toBe('/docs/architecture');
    expect(DOCS_PAGES.map((p) => docsPath(p.id))).toEqual(['/docs/architecture', '/docs/components', '/docs/design-system', '/docs/kassandra', '/docs/data', '/docs/security', '/docs/decisions', '/docs/about']);
  });

  it('reads the page from an address, with or without a trailing slash', () => {
    expect(docsPageOf('/docs')).toBe('index');
    expect(docsPageOf('/docs/')).toBe('index');
    expect(docsPageOf('/docs/security')).toBe('security');
    expect(docsPageOf('/docs/design-system/')).toBe('design-system');
    for (const p of DOCS_PAGES) expect(docsPageOf(docsPath(p.id))).toBe(p.id);
  });

  it('knows no page for any other address', () => {
    for (const path of ['/', '/boards', '/docs/nothing', '/docs/security/more', '/docsx', '/documents', '/catalog']) expect(docsPageOf(path)).toBeNull();
  });

  it('titles a page with its name, then Docs, then the brand', () => {
    expect(docsTitle('index')).toBe('Docs · Juyo');
    expect(docsTitle('kassandra')).toBe('Kassandra & agents · Docs · Juyo');
    expect(docsLabel('about')).toBe('About this build');
  });

  it('points to the three showcase views', () => {
    expect(SHOWCASES.map((s) => s.href)).toEqual(['/catalog', '/theme-lab', '/orb-lab']);
  });
});

describe('docs routing', () => {
  beforeEach(() => {
    FakeSocket.reset();
    localStorage.clear();
  });
  afterEach(() => history.replaceState(null, '', '/'));

  it('opens the docs view on the page a deep link names, as after a reload', () => {
    const { store, router } = setup('/docs/security');
    expect(store.view()).toBe('docs');
    expect(router.page()).toBe('security');
    expect(router.title()).toBe('Security · Docs · Juyo');
    // The app does not rewrite a docs address to "/".
    expect(location.pathname).toBe('/docs/security');
  });

  it('opens the index at /docs', () => {
    const { store, router } = setup('/docs');
    expect(store.view()).toBe('docs');
    expect(router.page()).toBe('index');
  });

  it('answers an unknown docs address with "not found"', () => {
    const { store } = setup('/docs/nothing');
    expect(store.view()).toBe('notfound');
  });

  it('opens a page from anywhere: the view, the page and the address change together', () => {
    const { store, router } = setup('/');
    expect(store.view()).toBe('inbox');
    router.open('architecture');
    TestBed.tick();
    expect(store.view()).toBe('docs');
    expect(router.page()).toBe('architecture');
    expect(location.pathname).toBe('/docs/architecture');
    router.open('data');
    TestBed.tick();
    expect(location.pathname).toBe('/docs/data');
    expect(router.title()).toBe('Data & MCP · Docs · Juyo');
  });

  it('keeps the hotel scope in the address of a docs page', () => {
    const { router } = setup('/?hotels=AMS,LIS');
    router.open('components');
    expect(location.pathname).toBe('/docs/components');
    expect(new URLSearchParams(location.search).get('hotels')).toBe('AMS,LIS');
  });

  it('follows Back and Forward', () => {
    const { store, router } = setup('/docs/architecture');
    router.open('decisions');
    TestBed.tick();
    history.replaceState(null, '', '/docs/architecture');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(router.page()).toBe('architecture');
    expect(store.view()).toBe('docs');
    // Back out of the docs: the page stays remembered, the view follows the address.
    history.replaceState(null, '', '/boards');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(store.view()).toBe('boards');
  });

  it('leaves the docs when the app navigates elsewhere', () => {
    const { store } = setup('/docs/about');
    store.go('boards');
    TestBed.tick();
    expect(location.pathname).toBe('/boards');
  });

  it('leaves the other page titles as they were', () => {
    expect(pageTitle('inbox', '', '')).toBe('Morning brief · Juyo');
    expect(pageTitle('catalog', '', '')).toBe('Chart catalogue · Juyo');
  });
});
