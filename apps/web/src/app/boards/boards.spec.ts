import { TestBed } from '@angular/core/testing';
import { DEFAULTS } from '../filters';
import { PORTFOLIO_SPECS } from '../portfolio';
import { pageTitle } from '../app';
import { BoardsService } from './boards.service';
import { chartToWidget } from './catalogue-widget';

const notFound = () => Promise.resolve(new Response('<!doctype html><html></html>', { status: 200, headers: { 'content-type': 'text/html' } }));

describe('BoardsService (until /api/boards is deployed)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(globalThis, 'fetch').mockImplementation(notFound);
  });
  afterEach(() => vi.restoreAllMocks());

  async function service() {
    const s = TestBed.inject(BoardsService);
    await s.load();
    return s;
  }

  it('falls back to this browser when the endpoint answers with the app shell', async () => {
    const s = await service();
    expect(s.mode()).toBe('local');
    expect(s.boards()).toEqual([]);
  });

  it('creates, renames, reorders, removes and deletes, and keeps it across a reload', async () => {
    const s = await service();
    const made = await s.create({ name: 'Lisbon recovery' });
    expect(made.ok).toBe(true);
    const id = made.ok ? made.value.id : '';
    const payload = chartToWidget(PORTFOLIO_SPECS[0], DEFAULTS)!;
    const a = await s.addWidget(id, payload);
    const b = await s.addWidget(id, { ...payload, spec: { ...payload.spec, title: 'Second' } });
    expect(a.ok && b.ok).toBe(true);
    await s.update(id, { name: 'Lisbon pace', order: [b.ok ? b.value.id : '', a.ok ? a.value.id : ''] });
    expect(s.boards()[0].name).toBe('Lisbon pace');
    expect(s.boards()[0].widgets.map((w) => w.spec.title)[0]).toBe('Second');
    await s.removeWidget(id, b.ok ? b.value.id : '');
    expect(s.boards()[0].widgets).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('compass.boards.v1')!)[0].name).toBe('Lisbon pace');
    const copy = await s.duplicate(id);
    expect(copy.ok && copy.value.name).toBe('Lisbon pace (copy)');
    expect(copy.ok && copy.value.widgets).toHaveLength(1);
    await s.remove(id);
    expect(s.boards().map((x) => x.name)).toEqual(['Lisbon pace (copy)']);
  });

  it('names new boards without clashing', async () => {
    const s = await service();
    await s.create({ name: 'Untitled board' });
    expect(s.freshName()).toBe('Untitled board 2');
  });
});

describe('chartToWidget', () => {
  it('turns every catalogue chart into rows with labelled columns and evidence', () => {
    for (const spec of PORTFOLIO_SPECS) {
      const w = chartToWidget(spec, DEFAULTS);
      expect(w, spec.kind).not.toBeNull();
      expect(w!.rows.length).toBeGreaterThan(0);
      for (const c of w!.columns) expect(Object.keys(w!.rows[0])).toContain(c.key);
      expect(w!.evidence.businessDate).toBe('2026-11-20');
      expect(w!.spec.title).toBeTruthy();
    }
  });

  it('keeps numbers as numbers', () => {
    const w = chartToWidget(PORTFOLIO_SPECS.find((s) => s.kind === 'pace')!, DEFAULTS)!;
    expect(typeof w.rows[0]['last_year']).toBe('number');
  });
});

describe('pageTitle', () => {
  it('names each place for the tab and the link preview', () => {
    expect(pageTitle('inbox', '', '')).toBe('Morning brief · Juyo');
    expect(pageTitle('watchers', '', '')).toBe('Agent Studio · Juyo');
    expect(pageTitle('board', '', 'Portfolio')).toBe('Portfolio · Juyo');
    expect(pageTitle('thread', 'Why is Lisbon behind?', '')).toBe('Why is Lisbon behind? · Kassandra');
  });
});
