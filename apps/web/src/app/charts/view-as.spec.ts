import { TestBed } from '@angular/core/testing';
import { KIND_LABELS, KIND_ORDER, compatibleKinds } from './kinds';
import { KIND_ICONS, ViewAs } from './view-as';
import { ViewAsMemory } from './view-memory';
import { WidgetChart } from './widget-chart';
import type { EvidenceColumn, WidgetKind, WidgetRow, WidgetSpec } from './widget-types';

const COLUMNS: EvidenceColumn[] = [
  { key: 'segment', label: 'Segment', kind: 'text' },
  { key: 'room_nights', label: 'Room nights', kind: 'count' },
];
const ROWS: WidgetRow[] = [
  { segment: 'Corporate', room_nights: 412 },
  { segment: 'Leisure', room_nights: 980 },
  { segment: 'Group', room_nights: 310 },
];
const SPEC: WidgetSpec = { kind: 'bar', title: 'Leisure is half of December', subtitle: 'Arbor Lisbon Chiado', sourceCallId: 'c1', x: 'segment', y: ['room_nights'] };
const OPTIONS = compatibleKinds(SPEC, ROWS, COLUMNS);

function renderRow(inputs: { value: WidgetKind; recommended?: WidgetKind | null; of?: string }) {
  const fixture = TestBed.createComponent(ViewAs);
  fixture.componentRef.setInput('options', OPTIONS);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  const picked: WidgetKind[] = [];
  fixture.componentInstance.picked.subscribe((kind) => {
    picked.push(kind);
    fixture.componentRef.setInput('value', kind);
    fixture.detectChanges();
  });
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const radios = () => [...el.querySelectorAll<HTMLButtonElement>('[role=radio]')];
  const name = (button: Element) => button.getAttribute('aria-label') ?? '';
  return { fixture, el, radios, name, picked };
}
const press = (target: HTMLElement, key: string) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
};

describe('ViewAs: the row of kinds under a chart', () => {
  it('is a radio group named after what it switches, with one radio per kind and exactly one checked', () => {
    const { el, radios, name } = renderRow({ value: 'bar', recommended: 'bar', of: SPEC.title });
    expect(el.getAttribute('role')).toBe('radiogroup');
    expect(el.getAttribute('aria-label')).toBe('View as: Leisure is half of December');
    expect(OPTIONS.map((o) => o.kind)).toEqual(['kpi_row', 'bar', 'donut', 'pie', 'treemap', 'table']);
    expect(radios().map(name)).toEqual(['Tiles', 'Bar, recommended', 'Donut', 'Pie', 'Treemap', 'Table']);
    expect(radios().map((radio) => radio.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false', 'false', 'false', 'false']);
    expect(radios().every((radio) => radio.type === 'button')).toBe(true);
  });

  it('shows only each kind’s icon, hidden from assistive tech, with its name and why it fits as the tooltip', () => {
    const { radios } = renderRow({ value: 'bar' });
    for (const radio of radios()) {
      const icon = radio.querySelector('ng-icon')!;
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      expect(radio.getAttribute('title')).toBeTruthy();
    }
    expect(radios()[2]!.getAttribute('title')).toBe('Donut\n3 parts of one whole.');
    expect(radios()[2]!.textContent?.trim()).toBe(''); // icon only: the card body is the chart
    expect(Object.keys(KIND_ICONS).sort()).toEqual([...KIND_ORDER].sort());
    expect(new Set(Object.values(KIND_ICONS)).size).toBe(KIND_ORDER.length); // no two kinds share a picture
    expect(Object.values(KIND_ICONS).every((icon) => /^phosphor[A-Z]\w+Light$/.test(icon))).toBe(true);
  });

  it('marks the recommended kind with a dot and in its name, whether or not it is the one on screen', () => {
    const { el, radios, name } = renderRow({ value: 'donut', recommended: 'bar' });
    expect(el.querySelectorAll('.wc-view-rec')).toHaveLength(1);
    expect(name(radios()[1]!)).toBe('Bar, recommended');
    expect(radios()[1]!.getAttribute('title')).toContain('Bar · Recommended');
    expect(radios()[1]!.getAttribute('aria-checked')).toBe('false');
    expect(radios()[2]!.getAttribute('aria-checked')).toBe('true');
  });

  it('is one tab stop, on the chosen kind', () => {
    const { radios } = renderRow({ value: 'donut' });
    expect(radios().map((radio) => radio.getAttribute('tabindex'))).toEqual(['-1', '-1', '0', '-1', '-1', '-1']);
  });

  it('keeps a tab stop when the kind on screen is not one of the options', () => {
    const { radios } = renderRow({ value: 'sankey' });
    expect(radios().map((radio) => radio.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1', '-1', '-1']);
  });

  it('reports a click, and moves and chooses with the arrow keys, Home and End, wrapping at the ends', () => {
    const { radios, picked, fixture } = renderRow({ value: 'bar' });
    document.body.appendChild(fixture.nativeElement);
    radios()[3]!.click();
    expect(picked).toEqual(['pie']);

    radios()[3]!.focus();
    expect(press(radios()[3]!, 'ArrowRight').defaultPrevented).toBe(true);
    expect(picked.at(-1)).toBe('treemap');
    expect(document.activeElement).toBe(radios()[4]);
    press(radios()[4]!, 'ArrowDown');
    press(radios()[5]!, 'ArrowRight'); // past the last: back to the first
    expect(picked.slice(-2)).toEqual(['table', 'kpi_row']);
    expect(document.activeElement).toBe(radios()[0]);
    press(radios()[0]!, 'ArrowLeft'); // before the first: the last
    expect(picked.at(-1)).toBe('table');
    press(radios()[5]!, 'ArrowUp');
    press(radios()[4]!, 'Home');
    press(radios()[0]!, 'End');
    expect(picked.slice(-3)).toEqual(['treemap', 'kpi_row', 'table']);
    expect(radios().map((radio) => radio.getAttribute('aria-checked')).filter((checked) => checked === 'true')).toHaveLength(1);
    expect(radios()[5]!.getAttribute('tabindex')).toBe('0');
    fixture.nativeElement.remove();
  });

  it('leaves other keys alone: Tab moves on, Space and Enter are the button’s own click', () => {
    const { radios, picked } = renderRow({ value: 'bar' });
    for (const key of ['Tab', ' ', 'Enter', 'a']) expect(press(radios()[1]!, key).defaultPrevented).toBe(false);
    expect(picked).toEqual([]);
  });

  it('names every kind in words a hotelier reads', () => {
    expect(KIND_LABELS).toMatchObject({ kpi: 'Number', kpi_row: 'Tiles', stacked_bar: 'Stacked bar', calendar_heatmap: 'Calendar', sankey: 'Flow', sparkline_list: 'Sparklines' });
    expect(Object.values(KIND_LABELS).every((label) => !label.includes('_'))).toBe(true);
  });
});

describe('WidgetChart with the switcher', () => {
  beforeEach(() => globalThis.localStorage?.clear());

  function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(WidgetChart);
    for (const [name, value] of Object.entries({ spec: SPEC, rows: ROWS, columns: COLUMNS, switcher: true, ...inputs })) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const radio = (label: string) => [...el.querySelectorAll<HTMLButtonElement>('[role=radio]')].find((button) => button.getAttribute('aria-label')?.startsWith(label))!;
    const checked = () => el.querySelector('[role=radio][aria-checked=true]')?.getAttribute('data-kind');
    return { fixture, el, radio, checked };
  }

  it('offers only the kinds these rows fit, with the widget’s own kind chosen and marked recommended', () => {
    const { el, checked } = render({});
    expect([...el.querySelectorAll('[role=radio]')].map((radio) => radio.getAttribute('data-kind'))).toEqual(['kpi_row', 'bar', 'donut', 'pie', 'treemap', 'table']);
    expect(checked()).toBe('bar');
    expect(el.querySelector('.wc-view-rec')?.parentElement?.getAttribute('data-kind')).toBe('bar');
    expect(el.querySelector('[role=radiogroup]')?.getAttribute('aria-label')).toBe('View as: Leisure is half of December');
  });

  it('switches at once, on the same rows, and back', () => {
    const { fixture, el, radio, checked } = render({});
    expect(el.getAttribute('data-kind')).toBe('bar');
    radio('Table').click();
    fixture.detectChanges();
    expect(el.getAttribute('data-kind')).toBe('table');
    expect(checked()).toBe('table');
    expect([...el.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((cell) => cell.textContent?.trim()).join(' '))).toEqual(['Corporate 412', 'Leisure 980', 'Group 310']);

    radio('Tiles').click();
    fixture.detectChanges();
    expect([...el.querySelectorAll('.wc-tile-value')].map((value) => value.textContent)).toEqual(['412', '980', '310']);

    radio('Bar').click();
    fixture.detectChanges();
    expect(el.getAttribute('data-kind')).toBe('bar');
    expect(el.querySelector('.wc-plot')).not.toBeNull();
  });

  it('takes the place of "View as table": the table is one of the kinds', () => {
    expect(render({}).el.querySelector('.wc-toggle')).toBeNull();
    expect(render({ switcher: false }).el.querySelector('.wc-toggle')).not.toBeNull();
    expect(render({ switcher: false }).el.querySelector('[role=radiogroup]')).toBeNull();
    expect(render({}).el.querySelector('.wc-plot + .sr-only')?.textContent).toContain('“View as”, Table');
  });

  it('remembers the choice per widget, under its key, across instances and visits', () => {
    const first = render({ viewKey: 'answer:c1' });
    first.radio('Donut').click();
    first.fixture.detectChanges();
    expect(first.checked()).toBe('donut');
    expect(JSON.parse(localStorage.getItem('compass.view-as.v1')!)).toEqual({ 'answer:c1': 'donut' });

    expect(render({ viewKey: 'answer:c1' }).checked()).toBe('donut'); // the same widget, drawn again
    expect(render({ viewKey: 'answer:c2' }).checked()).toBe('bar'); // another widget keeps its own
    expect(render({}).checked()).toBe('bar');

    // A new visit reads the store.
    TestBed.resetTestingModule();
    expect(render({ viewKey: 'answer:c1' }).el.getAttribute('data-kind')).toBe('donut');
  });

  it('forgets the choice when the person goes back to the kind the widget came with', () => {
    const { fixture, radio } = render({ viewKey: 'board:w1' });
    radio('Pie').click();
    radio('Bar').click();
    fixture.detectChanges();
    expect(TestBed.inject(ViewAsMemory).kind('board:w1')).toBeNull();
    expect(localStorage.getItem('compass.view-as.v1')).toBe('{}');
  });

  it('falls back to the widget’s own kind when a remembered one no longer fits its rows', () => {
    TestBed.inject(ViewAsMemory).set('answer:c1', 'donut');
    const eight = Array.from({ length: 8 }, (_, i) => ({ segment: `Segment ${i}`, room_nights: 100 + i }));
    const { el, checked } = render({ viewKey: 'answer:c1', rows: eight });
    expect(el.getAttribute('data-kind')).toBe('bar');
    expect(checked()).toBe('bar');
  });

  it('keeps a remembered kind through a new title, and follows the new columns when it still fits', () => {
    const { fixture, el } = render({ viewKey: 'answer:c1' });
    TestBed.inject(ViewAsMemory).set('answer:c1', 'table');
    fixture.componentRef.setInput('spec', { ...SPEC, title: 'Leisure is 49% of room nights' });
    fixture.detectChanges();
    expect(el.getAttribute('data-kind')).toBe('table');
    expect(el.querySelector('caption')?.textContent?.trim()).toBe('Leisure is 49% of room nights');
  });

  it('sits in the header, top right, and holds its place there while the widget loads', () => {
    const { el } = render({});
    expect(el.querySelector('.wc-head .wc-head-tools [role=radiogroup]')).not.toBeNull();
    expect(el.querySelector('.wc-view-row')).toBeNull();
    const loading = render({ rows: null });
    expect(loading.el.querySelector('.wc-head-tools .wc-view--stub')?.getAttribute('aria-hidden')).toBe('true');
    expect(loading.el.querySelector('[role=radiogroup]')).toBeNull();
  });

  it('without a header, sits in a one-line row under the body, or nowhere when the host places it', () => {
    const own = render({ header: false });
    expect(own.el.querySelector('.wc-view-row [role=radiogroup]')).not.toBeNull();
    expect(render({ header: false, controls: 'external' }).el.querySelector('[role=radiogroup]')).toBeNull();
  });

  it('holds the row’s place while the widget loads, and drops it when there is nothing to switch to', () => {
    const loading = render({ rows: null, header: false });
    expect(loading.el.querySelector('.wc-view-row .wc-view--stub')?.getAttribute('aria-hidden')).toBe('true');
    expect(loading.el.querySelector('[role=radiogroup]')).toBeNull();
    expect(render({ loading: 'skeleton' }).el.querySelector('.wc-view--stub')).not.toBeNull();

    const prose = render({ header: false, spec: { ...SPEC, kind: 'table', x: undefined, y: undefined }, rows: [{ note: 'Rates were loaded late.' }, { note: 'The comp set changed.' }], columns: [{ key: 'note', label: 'Note', kind: 'text' }] });
    expect(prose.el.querySelector('.wc-view-row')).toBeNull();
    expect(render({ rows: [], header: false }).el.querySelector('.wc-view-row')).toBeNull();
  });

  it('does not rebuild the chart when only its title changes', () => {
    const { fixture } = render({});
    const chart = fixture.componentInstance as unknown as { built(): unknown; summary(): string };
    const before = chart.built();
    fixture.componentRef.setInput('spec', { ...SPEC, title: 'Leisure is 49% of room nights' });
    fixture.detectChanges();
    expect(chart.built()).toBe(before);
    expect(chart.summary()).toMatch(/^Leisure is 49% of room nights\. Arbor Lisbon Chiado\./);
    fixture.componentRef.setInput('spec', { ...SPEC, y: ['room_nights'], kind: 'treemap', group: 'segment', x: undefined });
    fixture.detectChanges();
    expect(chart.built()).not.toBe(before);
  });
});
