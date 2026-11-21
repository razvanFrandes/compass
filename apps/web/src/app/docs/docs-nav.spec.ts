import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { CompassStore } from '../store';
import { DocsFab } from './docs-fab';
import { DocsHub } from './docs-hub';
import { DATAGEN_REPO, DOCS_PAGES } from './docs-pages';
import { DocsRouter } from './docs-router';
import { DocsArchitecture } from './pages/architecture';
import { EDGES, FLOWS, NODES, nodeHeight, placeRows } from './pages/architecture-map';
import { DocsSource } from './docs-kit';
import { DocsComponents } from './pages/components';
import { DocsData, SIZE_ROWS, STORIES } from './pages/data';
import { DocsDesignSystem } from './pages/design-system';

/** The heavy pages draw charts and WebGL; the navigation tests only need to know which page is on screen. */
@Component({ selector: 'docs-components', template: '<h1 id="docs-title" tabindex="-1">Components stub</h1>' })
class ComponentsStub {}
@Component({ selector: 'docs-design-system', template: '<h1 id="docs-title" tabindex="-1">Design system stub</h1>' })
class DesignSystemStub {}

function configure(url: string) {
  localStorage.clear();
  history.replaceState(null, '', url);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  TestBed.overrideComponent(DocsHub, { remove: { imports: [DocsComponents, DocsDesignSystem] }, add: { imports: [ComponentsStub, DesignSystemStub] } });
}

/** The hotels list and today's budget are asked of the API; here they are not there, and the docs do without. */
const answerApi = () =>
  TestBed.inject(HttpTestingController)
    .match(() => true)
    .forEach((request) => request.flush({ error: 'Not found.' }, { status: 404, statusText: 'Not Found' }));

const settle = async (fixture: ComponentFixture<unknown>) => {
  fixture.detectChanges();
  answerApi();
  await fixture.whenStable();
  answerApi();
  fixture.detectChanges();
};
const key = (key: string, target: EventTarget = document.body) => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

describe('DocsFab: the floating Docs button', () => {
  let fixture: ComponentFixture<DocsFab>;
  let root: HTMLElement;
  const button = () => root.querySelector<HTMLButtonElement>('button.fab__btn')!;
  const panel = () => root.querySelector<HTMLElement>('#docs-fab-panel');

  beforeEach(async () => {
    configure('/');
    fixture = TestBed.createComponent(DocsFab);
    root = fixture.nativeElement as HTMLElement;
    document.body.append(root);
    await settle(fixture);
  });
  afterEach(() => {
    root.remove();
    document.body.replaceChildren();
    history.replaceState(null, '', '/');
  });

  it('is a labelled button that says what it opens, closed at first', () => {
    expect(button().getAttribute('aria-label')).toBe('Docs: how this demo is built');
    expect(button().textContent).toContain('Docs');
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(button().getAttribute('aria-keyshortcuts')).toBe('?');
    expect(panel()).toBeNull();
  });

  it('opens a panel with the eight sections, each a link to its docs page', async () => {
    button().click();
    await settle(fixture);
    expect(button().getAttribute('aria-expanded')).toBe('true');
    expect(button().getAttribute('aria-controls')).toBe('docs-fab-panel');
    expect(panel()!.getAttribute('aria-label')).toBe('Documentation');
    const links = [...panel()!.querySelectorAll<HTMLAnchorElement>('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(DOCS_PAGES.map((p) => `/docs/${p.id}`));
    expect(links.map((a) => a.querySelector('span')!.textContent)).toEqual(['Architecture', 'Components', 'Design system', 'Kassandra & agents', 'Data & MCP', 'Security', 'Decisions', 'About this build']);
  });

  it('opens with "?" and closes with Escape, returning the focus to the button', async () => {
    key('?');
    await settle(fixture);
    expect(panel()).not.toBeNull();
    key('Escape');
    await settle(fixture);
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(button());
  });

  it('leaves "?" alone while a question is being typed', async () => {
    const field = document.createElement('textarea');
    document.body.append(field);
    key('?', field);
    await settle(fixture);
    expect(panel()).toBeNull();
  });

  it('leaves "?" alone with a modifier key', async () => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '?', metaKey: true, bubbles: true }));
    await settle(fixture);
    expect(panel()).toBeNull();
  });

  it('closes on a click outside', async () => {
    button().click();
    await settle(fixture);
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await settle(fixture);
    expect(panel()).toBeNull();
  });

  it('a link opens its page in the app and closes the panel', async () => {
    button().click();
    await settle(fixture);
    panel()!.querySelector<HTMLAnchorElement>('a[href="/docs/security"]')!.click();
    await settle(fixture);
    expect(TestBed.inject(CompassStore).view()).toBe('docs');
    expect(TestBed.inject(DocsRouter).page()).toBe('security');
    expect(location.pathname).toBe('/docs/security');
    expect(panel()).toBeNull();
  });

  it('marks the page that is open', async () => {
    TestBed.inject(DocsRouter).open('data');
    button().click();
    await settle(fixture);
    const current = [...panel()!.querySelectorAll('a[aria-current="page"]')];
    expect(current.map((a) => a.getAttribute('href'))).toEqual(['/docs/data']);
  });
});

describe('DocsHub: the docs navigation', () => {
  let fixture: ComponentFixture<DocsHub>;
  let root: HTMLElement;
  const navLinks = () => [...root.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Docs"] a')];
  const select = () => root.querySelector<HTMLSelectElement>('select#docs-page')!;
  const heading = () => root.querySelector<HTMLElement>('#docs-title')!.textContent!.trim();

  async function render(url: string) {
    configure(url);
    fixture = TestBed.createComponent(DocsHub);
    root = fixture.nativeElement as HTMLElement;
    await settle(fixture);
  }
  afterEach(() => history.replaceState(null, '', '/'));

  it('shows the page the address names, and marks it in the left navigation', async () => {
    await render('/docs/about');
    expect(heading()).toBe('A hotel analytics app that tells you first');
    expect(navLinks().filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.textContent!.trim())).toEqual(['About this build']);
  });

  it('lists the overview, the eight pages and the three showcases', async () => {
    await render('/docs');
    expect(heading()).toBe('How Compass is designed and built');
    expect(navLinks().map((a) => a.getAttribute('href'))).toEqual(['/docs', ...DOCS_PAGES.map((p) => `/docs/${p.id}`), '/catalog', '/theme-lab', '/orb-lab']);
  });

  it('a link in the left navigation changes the page and the address', async () => {
    await render('/docs');
    navLinks().find((a) => a.getAttribute('href') === '/docs/decisions')!.click();
    await settle(fixture);
    expect(location.pathname).toBe('/docs/decisions');
    expect(heading()).toBe('Twenty decisions, each with its reason');
    expect(root.querySelectorAll('h1')).toHaveLength(1);
  });

  it('offers the same pages in a labelled selector for a phone', async () => {
    await render('/docs/data');
    expect(root.querySelector('label[for="docs-page"]')!.textContent).toBe('Docs page');
    expect([...select().options].map((o) => o.value)).toEqual(['index', ...DOCS_PAGES.map((p) => p.id)]);
    expect(select().value).toBe('data');
    select().value = 'security';
    select().dispatchEvent(new Event('change'));
    await settle(fixture);
    expect(location.pathname).toBe('/docs/security');
    expect(heading()).toBe('A public demo with no login, and a bounded bad day');
  });

  it('opens a showcase as a view of the app', async () => {
    await render('/docs');
    navLinks().find((a) => a.getAttribute('href') === '/theme-lab')!.click();
    expect(TestBed.inject(CompassStore).view()).toBe('theme-lab');
  });

  it('renders every text page under one heading', async () => {
    for (const id of ['architecture', 'kassandra', 'data', 'security', 'decisions', 'about'] as const) {
      await render(`/docs/${id}`);
      expect(root.querySelectorAll('h1'), id).toHaveLength(1);
      expect(root.querySelectorAll('h2').length, id).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('the architecture map', () => {
  const flowIds = FLOWS.map((f) => f.id).filter(Boolean);

  it('has the parts of the current system', () => {
    const titles = NODES.map((n) => n.title);
    for (const part of ['Worker', 'Kassandra', 'WorkflowBuilder', 'WorkflowAgents', 'Briefs', 'Budget', 'Boards', 'Data tools', 'Hyperdrive', 'Cloudflare Tunnel', 'Postgres 17 + pgvector', 'AI Gateway', 'Claude API', 'Workers AI', 'Email Service', 'Soniox', 'MCP clients', 'Web app', 'Cron trigger']) {
      expect(titles, part).toContain(part);
    }
    expect(new Set(NODES.map((n) => n.id)).size).toBe(NODES.length);
    expect(NODES.filter((n) => n.pi).map((n) => n.title)).toEqual(['Kassandra', 'WorkflowBuilder', 'WorkflowAgents']);
  });

  it('keeps the five flows, each with steps and parts that light up', () => {
    expect(flowIds).toEqual(['ask', 'brief', 'mcp', 'build', 'approve']);
    for (const f of FLOWS) expect(f.steps.length, f.tab).toBeGreaterThanOrEqual(5);
    for (const id of flowIds) {
      expect(NODES.some((n) => (n.flows as readonly string[]).includes(id)), id).toBe(true);
      expect(EDGES.some((e) => (e.flows as readonly string[]).includes(id)), id).toBe(true);
    }
    for (const part of [...NODES, ...EDGES]) for (const f of part.flows) expect(flowIds).toContain(f);
  });

  it('lays rows out below the header, one line apart unless a row names its place', () => {
    const budget = NODES.find((n) => n.id === 'budget')!;
    expect(nodeHeight(budget)).toBe(94 + 21);
    expect(placeRows(budget).map((r) => r.y)).toEqual([budget.y + 80, budget.y + 101]);
    const worker = NODES.find((n) => n.id === 'worker')!;
    const rows = placeRows(worker);
    expect(rows.find((r) => r.text === '/mcp')!.y).toBe(worker.y + 80);
    expect(rows.filter((r) => r.kind === 'group').map((r) => r.text)).toEqual(['GUARDS', 'RATE LIMITS · PER CLIENT']);
    // No row falls outside its box.
    for (const n of NODES) for (const r of placeRows(n)) expect(r.y, `${n.id}: ${r.text}`).toBeLessThan(n.y + nodeHeight(n));
  });

  it('draws every node and switches flows from the tabs', async () => {
    configure('/docs/architecture');
    const fixture = TestBed.createComponent(DocsArchitecture);
    const root = fixture.nativeElement as HTMLElement;
    await settle(fixture);
    expect(root.querySelectorAll('svg .node')).toHaveLength(NODES.length);
    expect(root.querySelectorAll('svg .edge')).toHaveLength(EDGES.length);
    const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role=tab]')];
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false', 'false', 'false']);
    tabs[1]!.click();
    await settle(fixture);
    expect(root.querySelector('svg')!.getAttribute('data-flow')).toBe('ask');
    expect(root.querySelector('[role=tabpanel] h2')!.textContent).toBe('A question in the chat');
    expect(root.querySelectorAll('svg .node.on')).toHaveLength(NODES.filter((n) => (n.flows as readonly string[]).includes('ask')).length);
    // Arrow keys move along the tab list.
    tabs[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await settle(fixture);
    expect(root.querySelector('svg')!.getAttribute('data-flow')).toBe('brief');
  });
});

describe('the data page', () => {
  it('counts the rows of the loaded database', () => {
    expect(SIZE_ROWS).toHaveLength(21);
    expect(new Set(SIZE_ROWS.map((r) => r.table)).size).toBe(21);
    // About 5.76 million rows, four fifths of them bookings and guests.
    const total = SIZE_ROWS.reduce((sum, r) => sum + r.rows, 0);
    expect(total).toBe(5_759_543);
    const bookings = SIZE_ROWS.filter((r) => ['reservation_nights', 'reservations', 'guests'].includes(r.table)).reduce((sum, r) => sum + r.rows, 0);
    expect(Math.round((bookings / total) * 100)).toBe(80);
    expect([...new Set(SIZE_ROWS.map((r) => r.system))]).toEqual(['PMS', 'RMS', 'Market', 'Operations', 'Finance', 'Reference']);
  });

  it('tells the seven planted stories, each with its plant, its check and its eval', () => {
    expect(STORIES.map((s) => s.id)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7']);
    for (const s of STORIES) {
      for (const text of [s.hotel, s.title, s.planted, s.shows, s.check, s.question]) expect(text.length, s.id).toBeGreaterThan(8);
      expect(s.seconds, s.id).toMatch(/^\d+\.\d s$/);
    }
  });

  it('shows how the data was made, what is in it and how to regenerate it', async () => {
    configure('/docs/data');
    const fixture = TestBed.createComponent(DocsData);
    const root = fixture.nativeElement as HTMLElement;
    await settle(fixture);
    const headings = [...root.querySelectorAll('h2')].map((h) => h.textContent!.trim());
    expect(headings).toEqual(['How the data was made', 'What is in the database', 'Regenerate it', 'Definitions live in SQL', 'Seven planted stories, seven evals: 7 of 7', 'What guests say: semantic search', 'Connect your own AI']);
    const made = root.querySelector('#made')!;
    expect([...made.querySelectorAll('.docs-flow > li strong')].map((e) => e.textContent)).toEqual(['Config', 'World', 'Bookings simulation', 'Market, operations, finance', 'Postgres', 'Views']);
    expect(made.querySelector('a[href="https://github.com/chadwambles/isla-velaluz"]')).not.toBeNull();
    // The generator is its own repository: the page links to it, and says so while it is private.
    expect(made.querySelector('a[href="https://github.com/razvanFrandes/compass-datagen"]')!.textContent).toContain('compass-datagen');
    expect(made.textContent!.includes('private for now')).toBe(!DATAGEN_REPO.public);
    expect([...root.querySelectorAll('#evals docs-source a')].map((a) => a.getAttribute('href'))).toEqual([
      'https://github.com/razvanFrandes/compass-datagen/blob/HEAD/datagen/config.py',
      'https://github.com/razvanFrandes/compass-datagen/blob/HEAD/tests/check.py',
    ]);
    expect(root.querySelector('#tables juyo-widget-chart')).not.toBeNull();
    expect(root.querySelectorAll('#tables .docs-cells > li')).toHaveLength(12);
    const commands = root.querySelector('#regenerate pre')!.textContent!;
    for (const line of ['git clone https://github.com/razvanFrandes/compass-datagen.git', 'cd compass-datagen', 'uv sync', 'uv run python -m datagen', 'db/load.sh', 'uv run python tests/check.py']) expect(commands).toContain(line);
    expect(root.querySelectorAll('#evals li.docs-panel')).toHaveLength(7);
  });

  it('names a source path as text, and as a link once its repository has an address', async () => {
    configure('/docs/data');
    const fixture = TestBed.createComponent(DocsSource);
    fixture.componentRef.setInput('path', 'docs/decisions.md');
    fixture.componentRef.setInput('repo', '');
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('a')).toBeNull();
    expect(root.textContent!.trim()).toBe('docs/decisions.md');
    fixture.componentRef.setInput('repo', 'https://github.com/owner/compass-mvp');
    await settle(fixture);
    expect(root.querySelector('a')!.getAttribute('href')).toBe('https://github.com/owner/compass-mvp/tree/HEAD/docs/decisions.md');
  });
});
