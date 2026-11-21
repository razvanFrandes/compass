import { TestBed } from '@angular/core/testing';
import * as echarts from 'echarts/core';
import { WidgetChart } from './widget-chart';
import type { EvidenceColumn, WidgetRow, WidgetSpec } from './widget-types';

/*
  A chart is drawn again (setOption) only when what it draws changes. A tooltip lives inside the drawing, so a
  redraw hides it under a pointer that has not moved: anything else that ticks (a live conversation re-sending the
  same rows, a class on <html>, a new title) must leave the chart alone.
*/

const COLUMNS: EvidenceColumn[] = [
  { key: 'stay_date', label: 'Stay date', kind: 'date' },
  { key: 'bar_rate', label: 'Our BAR', kind: 'currency', unit: 'AED' },
  { key: 'comp_median', label: 'Comp set median', kind: 'currency', unit: 'AED' },
];
const ROWS: WidgetRow[] = Array.from({ length: 12 }, (_, i) => ({ stay_date: `2026-12-${String(i + 1).padStart(2, '0')}`, bar_rate: 500 + i * 10, comp_median: 480 + i * 7 }));
const SPEC: WidgetSpec = { kind: 'line', title: 'Our BAR against the comp-set median', subtitle: 'Next 12 nights', sourceCallId: 'call_1', x: 'stay_date', y: ['bar_rate', 'comp_median'], format: 'currency' };
const copy = <T>(v: T): T => structuredClone(v);

describe('EChartHost redraws', () => {
  let restore: (() => void)[] = [];
  beforeEach(() => {
    // The test DOM has no layout: give every element a box, so the chart is created as in a browser.
    for (const prop of ['clientWidth', 'clientHeight'] as const) {
      Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => (prop === 'clientWidth' ? 600 : 240) });
      restore.push(() => delete (HTMLElement.prototype as unknown as Record<string, unknown>)[prop]);
    }
  });
  afterEach(() => {
    restore.forEach((r) => r());
    restore = [];
    document.documentElement.classList.remove('k-unrelated');
  });

  async function mount() {
    const fixture = TestBed.createComponent(WidgetChart);
    fixture.componentRef.setInput('spec', SPEC);
    fixture.componentRef.setInput('rows', ROWS);
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.detectChanges();
    await fixture.whenStable();
    const dom = fixture.nativeElement.querySelector('juyo-echart div') as HTMLDivElement;
    const chart = echarts.getInstanceByDom(dom);
    expect(chart, 'the chart was created').toBeTruthy();
    const setOption = vi.spyOn(chart!, 'setOption');
    const clear = vi.spyOn(chart!, 'clear');
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r));
      fixture.detectChanges();
    };
    return { fixture, chart: chart!, setOption, clear, settle };
  }

  it('is not drawn again when the same rows arrive as new objects (a live conversation re-sends them)', async () => {
    const { fixture, setOption, clear, settle } = await mount();
    for (let i = 0; i < 5; i++) {
      fixture.componentRef.setInput('rows', copy(ROWS));
      fixture.componentRef.setInput('columns', copy(COLUMNS));
      fixture.componentRef.setInput('spec', copy(SPEC));
      await settle();
    }
    expect(setOption).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });

  it('is not drawn again for an unrelated class on <html>, or a new title over the same marks', async () => {
    const { fixture, setOption, settle } = await mount();
    document.documentElement.classList.add('k-unrelated');
    await settle();
    fixture.componentRef.setInput('spec', { ...SPEC, title: 'Business Bay is under the comp set on its busiest nights' });
    await settle();
    expect(setOption).not.toHaveBeenCalled();
  });

  it('is drawn again, once, when the numbers change', async () => {
    const { fixture, setOption, settle } = await mount();
    fixture.componentRef.setInput('rows', ROWS.map((r, i) => (i === 3 ? { ...r, bar_rate: 999 } : r)));
    await settle();
    expect(setOption).toHaveBeenCalledTimes(1);
  });
});
