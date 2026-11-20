import { TestBed } from '@angular/core/testing';
import { skeletonPlan, wordyAxis } from './builders/skeleton';
import { WidgetChart, type WidgetLoading } from './widget-chart';
import { WIDGET_KINDS } from './widget-types';
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

function render(inputs: { spec: WidgetSpec; rows?: readonly object[] | null; columns?: EvidenceColumn[]; compact?: boolean; header?: boolean; loading?: WidgetLoading }) {
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
    const regular = render({ spec: spec({ kind: 'bar', x: 'hotel', y: ['revpar'] }), rows: ROWS, columns: COLUMNS, loading: 'title' });
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
    // The button keeps its place (hidden and disabled), so the title wraps as it did while loading.
    expect(empty.el.querySelector<HTMLButtonElement>('.wc-toggle')?.disabled).toBe(true);
    expect(empty.el.querySelector('.wc-toggle')!.classList.contains('wc-toggle--stub')).toBe(true);
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

  describe('loading states', () => {
    const bar = spec({ kind: 'bar', x: 'hotel', y: ['revpar'], compare: 'revpar_ly' });

    it('"title" shows the real title and subtitle over a skeleton of the chart', () => {
      const { el } = render({ spec: bar, rows: ROWS, columns: COLUMNS, loading: 'title' });
      expect(el.querySelector('.wc-title')?.textContent).toBe('RevPAR by hotel');
      expect(el.querySelector('.wc-subtitle')?.textContent).toBe('November to date');
      expect(el.querySelector('.wc-ink')).toBeNull();
      expect(el.querySelector('juyo-widget-skeleton')?.getAttribute('data-kind')).toBe('bar');
      expect(el.querySelector('.wc-plot')).toBeNull();
      expect(el.querySelector<HTMLButtonElement>('.wc-toggle')?.disabled).toBe(true);
      // Only the chart area shimmers; the title is already real.
      expect(el.querySelector('figure')!.classList.contains('wc-shimmer')).toBe(false);
      expect(el.querySelector('.wc-sk-host')!.classList.contains('wc-shimmer')).toBe(true);
    });

    it('"skeleton" replaces the words with bars of the same size and hides them from assistive tech', () => {
      const { el } = render({ spec: bar, rows: ROWS, columns: COLUMNS, loading: 'skeleton' });
      const title = el.querySelector('.wc-title')!;
      // The text is still there, transparent, so the header already has its final height.
      expect(title.querySelector('.wc-ink')?.textContent).toBe('RevPAR by hotel');
      expect(title.getAttribute('aria-hidden')).toBe('true');
      expect(el.querySelector('.wc-subtitle .wc-ink')?.textContent).toBe('November to date');
      expect(el.querySelector('.wc-toggle')!.classList.contains('wc-toggle--stub')).toBe(true);
      expect(el.querySelector('figure')!.classList.contains('wc-shimmer')).toBe(true);
      expect(el.querySelector('figure')!.getAttribute('aria-label')).toBe('RevPAR by hotel');
      expect(el.querySelector('figure')!.getAttribute('aria-labelledby')).toBeNull();
      expect(el.querySelector('[role=status]')?.textContent).toContain('Loading RevPAR by hotel');
      expect(el.querySelector('juyo-widget-skeleton')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('"skeleton" works before the title has streamed in', () => {
      const { el } = render({ spec: { kind: 'donut', title: '', sourceCallId: 'call_1' }, rows: null, loading: 'skeleton' });
      expect(el.querySelector('.wc-title .wc-ink--stub')).not.toBeNull();
      expect(el.querySelector('.wc-subtitle .wc-ink--stub')).not.toBeNull();
      expect(el.querySelector('[role=status]')?.textContent).toContain('Loading chart');
      expect(el.querySelector('figure')!.getAttribute('aria-label')).toBe('Chart');
      expect(el.querySelector('juyo-widget-skeleton')?.getAttribute('data-kind')).toBe('donut');
    });

    it('"none" draws the widget, and falls back to "title" while there are no rows', () => {
      expect(render({ spec: bar, rows: ROWS, columns: COLUMNS, loading: 'none' }).el.querySelector('.wc-plot')).not.toBeNull();
      const waiting = render({ spec: bar, rows: undefined, columns: COLUMNS, loading: 'none' });
      expect(waiting.el.querySelector('juyo-widget-skeleton')).not.toBeNull();
      expect(waiting.el.querySelector('.wc-title')?.textContent).toBe('RevPAR by hotel');
    });

    it('keeps the same body height through skeleton → title → loaded, for every kind', () => {
      for (const kind of WIDGET_KINDS) {
        const s = spec({ kind, x: 'hotel', y: ['revpar'], group: 'hotel' });
        const heights = (['skeleton', 'title', 'none'] as const).map((loading) => bodyHeight(render({ spec: s, rows: ROWS, columns: COLUMNS, loading }).el));
        expect(new Set(heights).size, `${kind}: ${heights.join(' → ')}`).toBe(1);
      }
    });

    it('draws a different skeleton for each kind, with the parts that kind will have', () => {
      const sk = (kind: WidgetSpec['kind'], over: Partial<WidgetSpec> = {}) => render({ spec: spec({ kind, ...over }), rows: null, columns: COLUMNS }).el.querySelector('juyo-widget-skeleton')!;
      expect(sk('donut').querySelectorAll('circle').length).toBe(5);
      expect(sk('pie').querySelectorAll('circle').length).toBe(4);
      expect(sk('gauge').querySelector('svg path')).not.toBeNull();
      expect(sk('radar').querySelectorAll('polygon').length).toBe(4);
      expect(sk('table').querySelectorAll('.wc-sk-tr').length).toBe(8);
      expect(sk('kpi_row', { x: 'stay_date', y: ['a', 'b', 'c'] }).querySelectorAll('.wc-sk-tile').length).toBe(3);
      expect(sk('kpi').querySelector('.wc-sk-kpi')).not.toBeNull();
      expect(sk('line', { x: 'stay_date', y: ['a'], compare: 'b' }).querySelectorAll('path.wc-sk-stroke').length).toBe(2);
      expect(sk('area', { x: 'stay_date', y: ['a'] }).querySelector('.wc-sk-wash')).not.toBeNull();
      expect(sk('scatter').querySelectorAll('.wc-sk-point').length).toBeGreaterThan(8);
      expect(sk('waterfall').querySelectorAll('.wc-sk-float').length).toBe(7);
      expect(sk('funnel').querySelectorAll('.wc-sk-funnel-step').length).toBe(5);
      expect(sk('treemap').querySelectorAll('.wc-sk-tree > i').length).toBe(7);
      expect(sk('sankey').querySelectorAll('.wc-sk-band').length).toBe(8);
      expect(sk('heatmap').querySelectorAll('.wc-sk-heat-row').length).toBe(9);
      expect(sk('calendar_heatmap').querySelectorAll('.wc-sk-cal > i').length % 7).toBe(0);
      expect(sk('sparkline_list').querySelectorAll('.wc-sk-spark-row').length).toBe(8);
      expect(sk('bullet', { x: 'hotel', y: ['revpar'], compare: 'revpar_ly' }).querySelectorAll('.wc-sk-tick').length).toBe(8);
      // Bars lie down for names and stand up for dates, as the finished chart will.
      expect(sk('bar', { x: 'hotel', y: ['revpar'] }).querySelector('.wc-sk-rows')).not.toBeNull();
      expect(sk('bar', { x: 'stay_date', y: ['revpar'] }).querySelector('.wc-sk-xy')).not.toBeNull();
      expect(sk('stacked_bar', { x: 'month', y: ['nights'], group: 'segment' }).querySelectorAll('.wc-sk-col--stack').length).toBe(6);
      expect(sk('grouped_bar', { x: 'month', y: ['revenue'], compare: 'budget' }).querySelectorAll('.wc-sk-col--pair').length).toBe(6);
    });
  });
});

describe('skeletonPlan', () => {
  it('knows which way bars will run, from the column kind or else the key', () => {
    expect(wordyAxis({ x: 'hotel' })).toBe(true);
    expect(wordyAxis({ x: 'stay_date' })).toBe(false);
    expect(wordyAxis({ x: 'period' }, [{ key: 'period', label: 'Segment', kind: 'text' }])).toBe(true);
    expect(wordyAxis({ x: 'bucket' }, [{ key: 'bucket', label: 'Month', kind: 'month' }])).toBe(false);
    expect(skeletonPlan({ kind: 'bar', x: 'hotel', y: ['revpar'] }).horizontal).toBe(true);
    expect(skeletonPlan({ kind: 'bar', x: 'stay_date', y: ['revpar'] }).horizontal).toBe(false);
    expect(skeletonPlan({ kind: 'bullet', x: 'stay_date', y: ['revpar'] }).horizontal).toBe(true);
    expect(skeletonPlan({ kind: 'line', x: 'hotel', y: ['revpar'] }).horizontal).toBe(false);
  });

  it('reserves a legend row only where the finished chart will have one', () => {
    expect(skeletonPlan({ kind: 'bar', x: 'hotel', y: ['revpar'] }).legend).toBe(0);
    expect(skeletonPlan({ kind: 'bar', x: 'hotel', y: ['revpar'], compare: 'revpar_ly' }).legend).toBe(2);
    expect(skeletonPlan({ kind: 'stacked_bar', x: 'month', y: ['nights'], group: 'segment' }).legend).toBe(3);
    expect(skeletonPlan({ kind: 'waterfall', x: 'step', y: ['amount'] }).legend).toBe(3);
    // Lines name their series on the line ends when wide, and in a legend on a phone.
    expect(skeletonPlan({ kind: 'line', x: 'stay_date', y: ['a'], compare: 'b' }, [], 640).legend).toBe(0);
    expect(skeletonPlan({ kind: 'line', x: 'stay_date', y: ['a'], compare: 'b' }, [], 340).legend).toBe(2);
    expect(skeletonPlan({ kind: 'donut', group: 'channel', y: ['revenue'] }, [], 640).legend).toBe(0);
    expect(skeletonPlan({ kind: 'donut', group: 'channel', y: ['revenue'] }, [], 340).legend).toBe(4);
    expect(skeletonPlan({ kind: 'heatmap', x: 'weekday', group: 'hotel', y: ['occ'] })).toMatchObject({ ramp: true, legend: 0 });
  });

  it('plans KPI tiles from the spec: one per y column, wrapping when narrow', () => {
    expect(skeletonPlan({ kind: 'kpi_row', x: 'stay_date', y: ['a', 'b', 'c', 'd'] }, [], 900)).toMatchObject({ tiles: 4, tileColumns: 4, spark: true });
    expect(skeletonPlan({ kind: 'kpi_row', x: 'stay_date', y: ['a', 'b', 'c', 'd'] }, [], 360)).toMatchObject({ tiles: 4, tileColumns: 2 });
    expect(skeletonPlan({ kind: 'kpi_row', x: 'metric', y: ['value'] })).toMatchObject({ tiles: 4, spark: false });
    expect(skeletonPlan({ kind: 'kpi', y: ['revpar'] }).spark).toBe(false);
    expect(skeletonPlan({ kind: 'kpi', x: 'stay_date', y: ['revpar'] }).spark).toBe(true);
  });
});
