import { TestBed } from '@angular/core/testing';
import { WidgetChart } from './widget-chart';
import type { EvidenceColumn, WidgetRow, WidgetSpec } from './widget-types';

const COLUMNS: EvidenceColumn[] = [
  { key: 'hotel', label: 'Hotel', kind: 'hotel' },
  { key: 'revpar', label: 'RevPAR', kind: 'currency', unit: 'EUR' },
  { key: 'revpar_ly', label: 'Last year', kind: 'currency', unit: 'EUR' },
];
const ROWS: WidgetRow[] = [
  { hotel: 'Kestrel London Mayfair', revpar: 252.8, revpar_ly: 236.1 },
  { hotel: 'Arbor New York Midtown', revpar: 261.4, revpar_ly: 289.2 },
  { hotel: 'Tessera Berlin Mitte', revpar: 97.6, revpar_ly: null },
];
const spec = (over: Partial<WidgetSpec>): WidgetSpec => ({ kind: 'table', title: 'RevPAR by hotel', subtitle: 'November to date', sourceCallId: 'call_1', ...over });

function render(inputs: { spec: WidgetSpec; rows?: readonly object[] | null; columns?: EvidenceColumn[]; compact?: boolean; header?: boolean; loading?: boolean }) {
  const fixture = TestBed.createComponent(WidgetChart);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, text: () => (el.textContent ?? '').replace(/\s+/g, ' ').trim() };
}
const bodyHeight = (el: HTMLElement) => el.querySelector<HTMLElement>('.wc-body')!.style.height;
const column = (el: HTMLElement, i: number) => [...el.querySelectorAll('tbody tr')].map((tr) => tr.children[i].textContent?.trim());

describe('WidgetChart', () => {
  it('shows the title and subtitle, and names the figure by its title', () => {
    const { el } = render({ spec: spec({}), rows: ROWS, columns: COLUMNS });
    const figure = el.querySelector('figure')!;
    expect(el.querySelector('.wc-title')?.textContent).toBe('RevPAR by hotel');
    expect(el.querySelector('.wc-subtitle')?.textContent).toBe('November to date');
    expect(figure.getAttribute('aria-labelledby')).toBe(el.querySelector('.wc-title')!.id);
  });

  it('keeps an accessible name when the host card shows the title itself', () => {
    const { el } = render({ spec: spec({}), rows: ROWS, columns: COLUMNS, header: false });
    expect(el.querySelector('.wc-title')).toBeNull();
    expect(el.querySelector('figure')!.getAttribute('aria-label')).toBe('RevPAR by hotel');
  });

  it('shows a skeleton with the same dimensions while rows are missing', () => {
    for (const kind of ['line', 'kpi', 'table', 'donut', 'heatmap', 'kpi_row'] as const) {
      const loading = render({ spec: spec({ kind, x: 'hotel', y: ['revpar'], group: 'hotel' }), rows: null, columns: COLUMNS });
      const loaded = render({ spec: spec({ kind, x: 'hotel', y: ['revpar'], group: 'hotel' }), rows: ROWS, columns: COLUMNS });
      expect(loading.el.querySelector('.wc-sk'), kind).not.toBeNull();
      expect(loading.el.querySelector('[role=status]')?.textContent).toContain('Loading RevPAR by hotel');
      expect(loading.el.querySelector('figure')!.getAttribute('aria-busy')).toBe('true');
      expect(loaded.el.querySelector('.wc-sk'), kind).toBeNull();
      expect(bodyHeight(loading.el), kind).toBe(bodyHeight(loaded.el));
      expect(bodyHeight(loading.el)).toMatch(/^\d+px$/);
    }
  });

  it('can be held in the skeleton with loading, and is shorter when compact', () => {
    const regular = render({ spec: spec({ kind: 'bar', x: 'hotel', y: ['revpar'] }), rows: ROWS, columns: COLUMNS, loading: true });
    const compact = render({ spec: spec({ kind: 'bar', x: 'hotel', y: ['revpar'] }), rows: ROWS, columns: COLUMNS, compact: true });
    expect(regular.el.querySelector('.wc-sk')).not.toBeNull();
    expect(parseInt(bodyHeight(compact.el))).toBeLessThan(parseInt(bodyHeight(regular.el)));
    expect(compact.el.querySelector('juyo-widget-chart, .juyo-wc--compact') ?? compact.el.classList.contains('juyo-wc--compact')).toBeTruthy();
  });

  it('renders a table formatted by column kind, with a sticky row header per row', () => {
    const { el } = render({ spec: spec({}), rows: ROWS, columns: COLUMNS });
    expect([...el.querySelectorAll('thead th')].map((th) => th.textContent?.trim())).toEqual(['Hotel', 'RevPAR', 'Last year']);
    expect(el.querySelectorAll('tbody th[scope=row]')).toHaveLength(3);
    expect(column(el, 1)).toEqual(['€253', '€261', '€97.60']);
    expect(column(el, 2)).toEqual(['€236', '€289', '–']);
    expect(el.querySelector('caption')?.textContent?.trim()).toBe('RevPAR by hotel');
    // A table needs no "View as table".
    expect(el.querySelector('.wc-toggle')).toBeNull();
  });

  it('sorts a column ascending, then descending, then back to the given order, with empty cells last', () => {
    const { el, fixture } = render({ spec: spec({}), rows: ROWS, columns: COLUMNS });
    const header = (i: number) => el.querySelectorAll('thead th')[i];
    const click = (i: number) => {
      header(i).querySelector('button')!.click();
      fixture.detectChanges();
    };
    expect(header(1).getAttribute('aria-sort')).toBe('none');
    click(1);
    expect(header(1).getAttribute('aria-sort')).toBe('ascending');
    expect(column(el, 0)).toEqual(['Tessera Berlin Mitte', 'Kestrel London Mayfair', 'Arbor New York Midtown']);
    click(1);
    expect(header(1).getAttribute('aria-sort')).toBe('descending');
    expect(column(el, 0)).toEqual(['Arbor New York Midtown', 'Kestrel London Mayfair', 'Tessera Berlin Mitte']);
    click(1);
    expect(header(1).getAttribute('aria-sort')).toBe('none');
    expect(column(el, 0)).toEqual(['Kestrel London Mayfair', 'Arbor New York Midtown', 'Tessera Berlin Mitte']);
    click(2);
    click(2);
    expect(column(el, 2)).toEqual(['€289', '€236', '–']);
    click(0);
    expect(column(el, 0)).toEqual(['Arbor New York Midtown', 'Kestrel London Mayfair', 'Tessera Berlin Mitte']);
    expect(header(2).getAttribute('aria-sort')).toBe('none');
  });

  it('renders a KPI with its change as an arrow and as words', () => {
    const { el, text } = render({ spec: spec({ kind: 'kpi', y: ['revpar'], compare: 'revpar_ly' }), rows: ROWS, columns: COLUMNS });
    expect(el.querySelector('.wc-kpi-value')?.textContent).toBe('€253');
    expect(el.querySelector('.wc-delta')?.getAttribute('data-tone')).toBe('good');
    expect(el.querySelector('.wc-delta [aria-hidden=true]')?.textContent).toBe('▲ 7.1%');
    expect(el.querySelector('.wc-delta .sr-only')?.textContent).toBe('up 7.1%');
    expect(text()).toContain('vs last year');
  });

  it('draws a chart as a focusable image with a text alternative, and offers it as a table', () => {
    const { el, fixture } = render({ spec: spec({ kind: 'bar', x: 'hotel', y: ['revpar'], compare: 'revpar_ly' }), rows: ROWS, columns: COLUMNS });
    const plot = el.querySelector<HTMLElement>('.wc-plot')!;
    expect(plot.getAttribute('role')).toBe('img');
    expect(plot.tabIndex).toBe(0);
    expect(plot.getAttribute('aria-label')).toContain('RevPAR by hotel. November to date. Bar chart with 3 points');
    expect(plot.getAttribute('aria-label')).toContain('Highest: Arbor New York Midtown (€261).');
    expect(el.querySelector('.wc-legend')?.textContent).toContain('Last year');
    expect(el.querySelector('table')).toBeNull();

    const toggle = el.querySelector<HTMLButtonElement>('.wc-toggle')!;
    expect(toggle.getAttribute('aria-label')).toBe('View as table: RevPAR by hotel');
    toggle.click();
    fixture.detectChanges();
    expect(el.querySelector('.wc-plot')).toBeNull();
    expect(column(el, 0)).toEqual(['Kestrel London Mayfair', 'Arbor New York Midtown', 'Tessera Berlin Mitte']);
    expect(el.querySelector('.wc-table-wrap')?.getAttribute('tabindex')).toBe('0');
    expect(el.querySelector('.wc-toggle')?.getAttribute('aria-label')).toBe('View as chart: RevPAR by hotel');
  });

  it('announces the point the arrow keys land on', () => {
    const { el, fixture } = render({ spec: spec({ kind: 'bar', x: 'hotel', y: ['revpar'] }), rows: ROWS, columns: COLUMNS });
    const plot = el.querySelector<HTMLElement>('.wc-plot')!;
    const live = el.querySelector('[aria-live=polite]')!;
    const press = (key: string) => {
      plot.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      fixture.detectChanges();
    };
    press('ArrowRight');
    expect(live.textContent).toBe('Kestrel London Mayfair: RevPAR €253');
    press('ArrowRight');
    expect(live.textContent).toBe('Arbor New York Midtown: RevPAR €261');
    press('End');
    expect(live.textContent).toBe('Tessera Berlin Mitte: RevPAR €97.60');
    press('ArrowRight');
    expect(live.textContent).toBe('Kestrel London Mayfair: RevPAR €253');
    press('Escape');
    expect(live.textContent).toBe('');
  });

  it('says why a chart was drawn differently, and says so when there is nothing to draw', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ hotel: `Hotel ${i + 1}`, revpar: 100 + i }));
    const fallback = render({ spec: spec({ kind: 'donut', group: 'hotel', y: ['revpar'] }), rows: many, columns: COLUMNS });
    expect(fallback.el.querySelector('.wc-note')?.textContent).toBe('9 parts are too many for a donut (it reads for 2 to 7), so this is shown as bars.');
    const empty = render({ spec: spec({ kind: 'line', x: 'hotel', y: ['revpar'] }), rows: [], columns: COLUMNS });
    expect(empty.el.querySelector('.wc-empty')?.textContent).toBe('No data to plot for this period.');
    expect(empty.el.querySelector('.wc-toggle')).toBeNull();
  });

  it('goes back to the chart when the widget becomes another kind', () => {
    const { el, fixture } = render({ spec: spec({ kind: 'bar', x: 'hotel', y: ['revpar'] }), rows: ROWS, columns: COLUMNS });
    el.querySelector<HTMLButtonElement>('.wc-toggle')!.click();
    fixture.detectChanges();
    expect(el.querySelector('table')).not.toBeNull();
    fixture.componentRef.setInput('spec', spec({ kind: 'donut', group: 'hotel', y: ['revpar'] }));
    fixture.detectChanges();
    expect(el.querySelector('table')).toBeNull();
    expect(el.querySelector('.wc-plot')).not.toBeNull();
  });
});
