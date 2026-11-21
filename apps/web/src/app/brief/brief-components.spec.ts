import { TestBed } from '@angular/core/testing';
import type { BriefFeed, BriefNights, BriefPulse, PulseTile } from '@compass/contracts';
import { HALCYON_HOTELS } from '../scope/hotels';
import { DataHealth } from './data-health';
import { FindingCard, type FindingView } from './finding-card';
import { NightsCalendar } from './nights-calendar';
import { PulseRail } from './pulse-rail';

const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

const tile = (key: PulseTile['key'], over: Partial<PulseTile> = {}): PulseTile => ({
  key,
  label: key,
  unit: 'eur',
  value: 100,
  compare: 90,
  delta: 4.2,
  deltaUnit: 'pct',
  period: 'Next 30 nights',
  basis: 'same time last year',
  definition: 'How it is computed.',
  series: [
    { x: '2026-11-20', value: 1, compare: 2 },
    { x: '2026-11-21', value: 2, compare: 2 },
  ],
  ...over,
});
const PULSE: BriefPulse = {
  from: '2026-11-20',
  to: '2026-12-19',
  month: '2026-10-01',
  tiles: [
    tile('occupancy', { label: 'Occupancy', unit: 'percent', value: 53, delta: 0.4, deltaUnit: 'pp' }),
    tile('adr', { label: 'ADR' }),
    tile('revpar', { label: 'RevPAR' }),
    tile('room_revenue', { label: 'Room revenue' }),
    tile('pace', { label: 'Pace', unit: 'count', value: 74_489, delta: 0.3 }),
    ...(['total_revenue', 'trevpar', 'gop', 'gop_margin'] as const).map((key) => tile(key, { label: key === 'gop' ? 'GOP' : key, period: 'Oct 2026', basis: 'Oct 2025', also: { delta: -2.1, deltaUnit: 'pct', basis: 'budget' } })),
  ],
};

describe('PulseRail', () => {
  function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(PulseRail);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows four tiles at most, each with its period, one value and a comparison that names its base', () => {
    const { el } = render({ pulse: PULSE, state: 'ready', scopeLabel: 'Asia · 3 hotels' });
    const tiles = [...el.querySelectorAll('button.pulse-tile')];
    expect(tiles).toHaveLength(4);
    expect(text(el.querySelector('#pulse-title'))).toBe('Pulse · Asia · 3 hotels');
    expect(text(tiles[0]!.querySelector('.pulse-period'))).toBe('· next 30 nights');
    expect(text(tiles[0]!.querySelector('.pulse-value'))).toBe('53%.');
    expect(text(tiles[0]!.querySelector('.pulse-delta'))).toBe('▲ +0.4 pts vs last year');
    // What a screen reader says is the tile's own text, with the symbols replaced by words.
    const spoken = (el: Element) => { const copy = el.cloneNode(true) as Element; copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove()); return text(copy).replace(/:(?=\S)/g, ': ').replace(/\.(?=[A-Z])/g, '. '); };
    expect(spoken(tiles[0]!)).toBe('Occupancy, next 30 nights: 53%. Up 0.4 pts against same time last year. Ask why.');
    // Pace is a sentence under the row, not a fifth tile.
    expect(text(el.querySelector('.pulse-pace'))).toContain('Pace: 74,489 room nights on the books');
  });

  it('“Ask why” sends the tile’s question at once', () => {
    const { fixture, el } = render({ pulse: PULSE, state: 'ready' });
    const asked: string[] = [];
    fixture.componentInstance.ask.subscribe((q) => asked.push(q));
    el.querySelectorAll<HTMLButtonElement>('button.pulse-tile')[1]!.click();
    expect(asked).toEqual(['What is driving ADR for the next 30 nights against the same time last year?']);
  });

  it('switches to the last closed month, where a tile is read against last year and against budget', () => {
    const { fixture, el } = render({ pulse: PULSE, state: 'ready' });
    const radios = el.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    expect([...radios].map(text)).toEqual(['Next 30 nights', 'Oct 2026']);
    radios[1]!.click();
    fixture.detectChanges();
    expect(radios[1]!.getAttribute('aria-checked')).toBe('true');
    const gop = [...el.querySelectorAll('button.pulse-tile')].find((t) => text(t.querySelector('.pulse-label')).startsWith('GOP'))!;
    expect([...gop.querySelectorAll('.pulse-delta')].map(text)).toEqual(['▲ +4.2% vs Oct 2025', '▼ −2.1% vs budget']);
    expect(el.querySelector('.pulse-pace')).toBeNull();
  });

  it('has no period switch when the scope has no closed month', () => {
    const { el } = render({ pulse: { ...PULSE, month: null, tiles: PULSE.tiles.slice(0, 5) }, state: 'ready' });
    expect(el.querySelector('[role="radiogroup"]')).toBeNull();
  });

  it('holds four placeholder tiles while loading, and offers Retry when the read failed', () => {
    const loading = render({ state: 'loading', scopeLabel: 'All 20 hotels' }).el;
    expect(loading.querySelectorAll('.pulse-tile')).toHaveLength(4);
    expect(text(loading.querySelector('[role="status"] .sr-only'))).toBe('Loading the numbers for All 20 hotels');
    const failed = render({ state: 'error', error: 'Could not reach the server.' });
    let retried = 0;
    failed.fixture.componentInstance.retry.subscribe(() => retried++);
    expect(text(failed.el.querySelector('[role="alert"] p'))).toBe('Could not reach the server.');
    failed.el.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    expect(retried).toBe(1);
  });
});

const FINDING: FindingView = {
  id: 'pace_behind:LIS',
  kind: 'pace_behind',
  hotel: 'Lisbon Chiado',
  title: 'Lisbon Chiado is 17.4% behind last year for the next 45 nights',
  summary: 'Arbor Lisbon Chiado is 17.4% behind last year.',
  impact_eur: -38_187,
  impact_basis: 'room revenue on the books vs the same point last year, next 45 nights',
  sources: ['hotel.pace_vs_stly()'],
  seen: false,
};

describe('FindingCard', () => {
  function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(FindingCard);
    for (const [name, value] of Object.entries({ finding: FINDING, ...inputs })) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('says what happened, the money in it and where the numbers come from', () => {
    const { el } = render({});
    expect(text(el.querySelector('.finding-eyebrow'))).toBe('New. Pace· Lisbon Chiado');
    expect(text(el.querySelector('h3'))).toBe(FINDING.title);
    expect(text(el.querySelector('.finding-stake'))).toBe('▼ €38k at risk');
    expect(text(el.querySelector('.finding-summary'))).toBe('Arbor Lisbon Chiado is 17.4% behind last year. AI');
    expect(text(el.querySelector('.finding-evidence'))).toBe('Room revenue on the books vs the same point last year, next 45 nights · From bookings');
  });

  it('has the four actions, each named for its finding', () => {
    const { fixture, el } = render({});
    const done: string[] = [];
    for (const name of ['explore', 'watch', 'snooze', 'dismiss'] as const) fixture.componentInstance[name].subscribe(() => done.push(name));
    const buttons = [...el.querySelectorAll<HTMLButtonElement>('.finding-actions button')];
    expect(buttons.map(text)).toEqual(['Explore', 'Watch this', `Snooze until tomorrow: ${FINDING.title}`, `Not useful: ${FINDING.title}`]);
    buttons.forEach((button) => button.click());
    expect(done).toEqual(['explore', 'watch', 'snooze', 'dismiss']);
  });

  it('holds a skeleton of its kind’s chart at 180 px while the chart loads, and the chart at the same height after', () => {
    const loading = render({ chartState: 'loading' }).el;
    expect(loading.querySelector<HTMLElement>('.wc-body')!.style.height).toBe('180px');
    expect(loading.querySelector('juyo-widget-chart')!.getAttribute('data-kind')).toBe('line');
    const chart = { kind: 'line' as const, title: 'Room nights on the books, by booking day', x: 'booking_date', y: ['rooms_otb'], compare: 'rooms_otb_stly', rows: [{ booking_date: '2026-11-19', rooms_otb: 2200, rooms_otb_stly: 2650 }, { booking_date: '2026-11-20', rooms_otb: 2231, rooms_otb_stly: 2700 }], columns: [], sources: ['hotel.reservations'] };
    const ready = render({ chart }).el;
    expect(ready.querySelector<HTMLElement>('.wc-body')!.style.height).toBe('180px');
    expect(text(ready.querySelector('.wc-title'))).toBe('Room nights on the books, by booking day');
  });

  it('says so when its chart failed, and has no chart area where it is a row of a list', () => {
    const failed = render({ chartState: 'error' });
    let retried = 0;
    failed.fixture.componentInstance.retry.subscribe(() => retried++);
    failed.el.querySelector<HTMLButtonElement>('.finding-nochart button')!.click();
    expect(retried).toBe(1);
    expect(render({ chartState: 'loading', showChart: false }).el.querySelector('.finding-chart')).toBeNull();
  });
});

const night = (hotel_code: string, stay_date: string, occupancy_pct: number, rate_flag: 'underpriced' | 'overpriced' | null = null, event: string | null = null) => ({
  hotel_code,
  stay_date,
  rooms_available: 100,
  rooms_otb: occupancy_pct,
  rooms_otb_stly: 60,
  occupancy_pct,
  occupancy_stly_pct: 60,
  bar_rate: 200,
  currency: 'EUR',
  bar_vs_comp: rate_flag === 'underpriced' ? 0.8 : 1,
  comps_sold_out: 0,
  event,
  rate_flag,
});
const NIGHTS: BriefNights = {
  from: '2026-11-27',
  to: '2026-11-28',
  total: [
    { stay_date: '2026-11-27', rooms_available: 200, rooms_otb: 130, rooms_otb_stly: 120, occupancy_pct: 65, occupancy_stly_pct: 60, events: 1, rate_flags: 0 },
    { stay_date: '2026-11-28', rooms_available: 200, rooms_otb: 172, rooms_otb_stly: 120, occupancy_pct: 86, occupancy_stly_pct: 60, events: 0, rate_flags: 1 },
  ],
  hotels: [night('LIS', '2026-11-27', 40, null, 'Atlantic Web Forum'), night('LIS', '2026-11-28', 82), night('DXB1', '2026-11-27', 90), night('DXB1', '2026-11-28', 90, 'underpriced')],
};

describe('NightsCalendar', () => {
  function render(nights: BriefNights) {
    const fixture = TestBed.createComponent(NightsCalendar);
    fixture.componentRef.setInput('nights', nights);
    fixture.componentRef.setInput('hotels', HALCYON_HOTELS);
    fixture.componentRef.setInput('scopeLabel', 'Lisbon Chiado + 1 more');
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('is a table: a column per night, a row for the scope and one per hotel', () => {
    const { el } = render(NIGHTS);
    expect([...el.querySelectorAll('thead th')].slice(1).map((th) => text(th.querySelector('.sr-only')))).toEqual(['Fri 27 Nov', 'Sat 28 Nov']);
    expect([...el.querySelectorAll('tbody th')].map(text)).toEqual(['Lisbon Chiado + 1 more', 'Lisbon Chiado', 'Dubai Marina']);
    const total = [...el.querySelectorAll('.nights-total .nights-cell')];
    expect(total.map((c) => c.getAttribute('data-step'))).toEqual(['2', '4']);
    expect(total.map((c) => text(c.querySelector('.nights-occ')))).toEqual(['65', '86']);
  });

  it('marks an event and a rate to check, and says both in words under the table', () => {
    const { el } = render(NIGHTS);
    const rows = [...el.querySelectorAll('tbody tr')];
    expect(rows[1]!.querySelector('.nights-event')).not.toBeNull();
    expect(rows[2]!.querySelectorAll('button.nights-cell--flagged')).toHaveLength(1);
    expect([...el.querySelectorAll('.nights-notes li > span')].map(text)).toEqual(['Dubai Marina: 1 night with the rate well under the comp set on a busy night (28 Nov)', 'Atlantic Web Forum: Lisbon Chiado, 27 Nov']);
  });

  it('a night of the scope asks about the night; a flagged night of a hotel asks about its rate', () => {
    const { fixture, el } = render(NIGHTS);
    const asked: string[] = [];
    fixture.componentInstance.ask.subscribe((q) => asked.push(q));
    el.querySelector<HTMLButtonElement>('.nights-total button')!.click();
    el.querySelector<HTMLButtonElement>('button.nights-cell--flagged')!.click();
    expect(asked[0]).toContain('How is Fri 27 Nov looking');
    expect(asked[1]).toBe("Should Kestrel Dubai Marina change its rate for Sat 28 Nov? Compare it with the comp set and with last year's pace.");
  });

  it('for a single hotel, the one row is the hotel’s own, with its flags', () => {
    const { fixture, el } = render({ ...NIGHTS, hotels: NIGHTS.hotels.filter((n) => n.hotel_code === 'DXB1') });
    expect([...el.querySelectorAll('tbody th')].map(text)).toEqual(['Dubai Marina']);
    const asked: string[] = [];
    fixture.componentInstance.ask.subscribe((q) => asked.push(q));
    el.querySelectorAll<HTMLButtonElement>('.nights-total button')[1]!.click();
    expect(asked[0]).toContain('Should Kestrel Dubai Marina change its rate for Sat 28 Nov?');
  });

  it('says so when the nights have no events and no rates to check', () => {
    const quiet = { ...NIGHTS, hotels: [night('LIS', '2026-11-27', 40), night('LIS', '2026-11-28', 50)] };
    expect(text(render(quiet).el.querySelector('.nights-none'))).toContain('No city events and no rates out of line');
  });
});

describe('DataHealth', () => {
  const feed = (hotel_code: string, system: string, status = 'ok', last_sync_at = '2026-11-20 05:30', days_behind = 0): BriefFeed => ({ hotel_code, system, vendor: 'Lightspeed', status, last_sync_at, days_behind });
  const feeds = [feed('BER', 'POS', 'stale', '2026-11-17 04:12', 3), feed('LIS', 'POS'), feed('BER', 'PMS'), feed('LIS', 'PMS'), feed('BER', 'RMS'), feed('LIS', 'RMS')];

  function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(DataHealth);
    for (const [name, value] of Object.entries({ feeds, nameOf: (code: string) => (code === 'BER' ? 'Berlin Mitte' : code), ...inputs })) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('leads with the feed that is behind, by hotel name, with when it last synced', () => {
    const { fixture, el } = render({});
    expect(text(el.querySelector('.health-sum'))).toBe('5 of 6 feeds synced this morning, 1 is behind');
    expect(text(el.querySelector('.health-stale-title'))).toBe('Berlin Mitte · POS (Lightspeed)');
    expect(text(el.querySelector('.health-stale-body'))).toContain('Last synced Tue 17 Nov, 04:12: 3 days behind.');
    const explored: BriefFeed[] = [];
    fixture.componentInstance.explore.subscribe((f) => explored.push(f));
    el.querySelector<HTMLButtonElement>('.health-stale button')!.click();
    expect(explored[0]).toMatchObject({ hotel_code: 'BER', system: 'POS' });
  });

  it('lists the systems, the one with a problem first, and as many as the limit allows', () => {
    expect([...render({}).el.querySelectorAll('tbody th')].map(text)).toEqual(['POS', 'PMS', 'RMS']);
    expect([...render({ limit: 2 }).el.querySelectorAll('tbody th')].map(text)).toEqual(['POS', 'PMS']);
  });

  it('follows the scope it is given: no callout when every feed is fresh', () => {
    const { el } = render({ feeds: feeds.filter((f) => f.hotel_code === 'LIS') });
    expect(text(el.querySelector('.health-sum'))).toBe('3 of 3 feeds synced this morning');
    expect(el.querySelector('.health-stale')).toBeNull();
  });
});
