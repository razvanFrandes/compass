import { Component, DestroyRef, ElementRef, InjectionToken, type Signal, ViewEncapsulation, afterNextRender, computed, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorArrowsDownUpLight, phosphorCaretDownLight, phosphorCaretUpLight, phosphorChartBarLight, phosphorTableLight } from '@ng-icons/phosphor-icons/light';
import { type Built, type TableModel, bodyHeight, buildWidget, kpiColumns, kpiCount } from './builders';
import { skeletonPlan } from './builders/skeleton';
import { EChartHost } from './echart-host';
import { readTokens } from './tokens';
import { WidgetSkeleton } from './widget-skeleton';
import type { EvidenceColumn, WidgetKind, WidgetRow, WidgetSpec } from './widget-types';

/**
 * Provide a signal here when a subtree gets its own theme (a preview, an embed): widgets under it re-read
 * their colours whenever it changes. The app-wide light/dark switch needs nothing.
 */
export const WIDGET_THEME_SCOPE = new InjectionToken<Signal<unknown>>('WIDGET_THEME_SCOPE');

/** Ticks when the app switches between light and dark (the `light` / `dark` class on <html>). */
const appTheme = signal(0);
if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  new MutationObserver(() => appTheme.update((n) => n + 1)).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
}

/**
 * What to show while a widget is on its way (generative UI streams the spec before the rows):
 * - `skeleton`: the whole widget as a placeholder for the spec's kind, at its final dimensions;
 * - `title`: the real title and subtitle, with the chart area still a placeholder;
 * - `none`: the widget itself (rows that are null or undefined still show the `title` state).
 */
export type WidgetLoading = 'none' | 'skeleton' | 'title';

let nextId = 0;

/**
 * The one way to draw a widget (contract §3): every WidgetKind, from rows the backend sent.
 *
 *   <juyo-widget-chart [spec]="w" [rows]="w.rows" [columns]="w.columns" />
 *
 * While it loads (`[loading]`, or rows that are null or undefined) it shows a skeleton of its own kind, in the
 * box the finished widget will have. Every chart can be read as a table ("View as table"), reached and stepped through with the keyboard,
 * and follows the theme and prefers-reduced-motion.
 */
@Component({
  selector: 'juyo-widget-chart',
  imports: [EChartHost, NgIcon, WidgetSkeleton],
  providers: [provideIcons({ phosphorArrowsDownUpLight, phosphorCaretDownLight, phosphorCaretUpLight, phosphorChartBarLight, phosphorTableLight })],
  encapsulation: ViewEncapsulation.None,
  styleUrl: './widget-chart.css',
  templateUrl: './widget-chart.html',
  host: { class: 'juyo-wc', '[class.juyo-wc--compact]': 'compact()', '[attr.data-kind]': 'spec().kind' },
})
export class WidgetChart {
  readonly spec = input.required<WidgetSpec>();
  /** The rows of the tool result the spec points at. Null or undefined while they load. */
  readonly rows = input<readonly object[] | null | undefined>(null);
  readonly columns = input<readonly EvidenceColumn[] | null | undefined>(null);
  /** Denser: shorter body, smaller type. For chat answers and board tiles. */
  readonly compact = input(false);
  /** Shows the spec's title and subtitle above the widget (turn off when the host card already shows them). */
  readonly header = input(true);
  /** The loading state to show; see WidgetLoading. Kassandra drives it from the streaming tool call. */
  readonly loading = input<WidgetLoading>('none');
  /**
   * The height of the chart's body in px, for a host with a rhythm of its own (180 in an overview row, 320 for a
   * featured chart). Null keeps the catalogue's height for the kind. KPI tiles size themselves and ignore it.
   */
  readonly height = input<number | null>(null);

  protected readonly uid = `wc${nextId++}`;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly scope = inject(WIDGET_THEME_SCOPE, { optional: true });
  private readonly echart = viewChild(EChartHost);

  private readonly width = signal(640);
  private readonly mounted = signal(false);
  private readonly reducedMotion = signal(false);

  private readonly tokens = computed(() => {
    appTheme();
    this.scope?.();
    this.mounted();
    return readTokens(this.host);
  });

  /** KPI tiles: how many there are (known from the spec before the rows arrive) and how many sit in a row. */
  private readonly tiles = computed(() => {
    const b = this.built();
    return b?.render === 'kpi_row' ? b.tiles.length : kpiCount(this.spec());
  });
  protected readonly tileCols = computed(() => kpiColumns(this.tiles(), this.width()));
  /** The host's height where it applies; every state of the widget uses it, so nothing moves when the rows arrive. */
  private readonly fixed = computed(() => {
    const kind = this.spec().kind;
    const h = this.height();
    return h && h > 0 && kind !== 'kpi' && kind !== 'kpi_row' ? Math.round(h) : null;
  });
  protected readonly bodyH = computed(() => this.fixed() ?? bodyHeight(this.spec(), this.compact(), this.width(), this.tiles()));
  protected readonly narrow = computed(() => this.width() < 480);
  /** The state on screen: the one asked for, or `title` while there are no rows to draw. */
  protected readonly state = computed<WidgetLoading>(() => (this.loading() !== 'none' ? this.loading() : this.rows() ? 'none' : 'title'));
  protected readonly plan = computed(() => skeletonPlan(this.spec(), this.columns() ?? [], this.width()));
  protected readonly nbsp = '\u00a0';

  protected readonly built = computed<Built | null>(() => {
    const rows = this.rows();
    if (!rows || this.state() !== 'none') return null;
    return buildWidget({ spec: this.spec(), rows: rows as readonly WidgetRow[], columns: this.columns() ?? [], tokens: this.tokens(), width: this.width(), compact: this.compact(), motion: !this.reducedMotion(), ...(this.fixed() ? { height: this.fixed()! } : {}) });
  });

  /** "View as table" resets when the widget becomes a different kind of chart. */
  protected readonly asTable = linkedSignal<WidgetKind, boolean>({ source: () => this.spec().kind, computation: () => false });
  /**
   * "View as table" has a place in the header for every kind but `table`, and keeps it while loading and when
   * the result turns out empty, so the title wraps the same way in every state. It is only shown when it can do something.
   */
  protected readonly toggleSlot = computed(() => this.spec().kind !== 'table');
  protected readonly canToggle = computed(() => {
    const b = this.built();
    return !!b && b.render !== 'table' && b.render !== 'empty';
  });
  protected readonly showTable = computed(() => {
    const b = this.built();
    return !!b && b.render !== 'empty' && (b.render === 'table' || this.asTable());
  });

  /* Table sorting: none → ascending → descending → none. */
  protected readonly sort = linkedSignal<TableModel | undefined, { col: number; dir: 'asc' | 'desc' } | null>({ source: () => this.built()?.table, computation: (table, prev) => (prev?.value && table && prev.value.col < table.columns.length ? prev.value : null) });
  protected readonly sortedRows = computed(() => {
    const table = this.built()?.table;
    if (!table) return [];
    const s = this.sort();
    if (!s) return table.rows;
    const sign = s.dir === 'asc' ? 1 : -1;
    return [...table.rows].sort((a, b) => {
      const x = a[s.col].sort;
      const y = b[s.col].sort;
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1; // empty cells stay last
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sign;
    });
  });

  /* Keyboard: the arrow keys step through the marks; the tooltip and a live region follow. */
  private readonly cursor = signal(-1);
  protected readonly announce = signal('');

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      this.mounted.set(true);
      const measure = (w: number) => this.width.set(Math.max(240, Math.round(w / 20) * 20));
      measure(this.host.getBoundingClientRect().width || 640);
      const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(([e]) => measure(e.contentRect.width));
      ro?.observe(this.host);
      const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
      const onMotion = () => this.reducedMotion.set(!!mq?.matches);
      onMotion();
      mq?.addEventListener?.('change', onMotion);
      destroy.onDestroy(() => {
        ro?.disconnect();
        mq?.removeEventListener?.('change', onMotion);
      });
    });
  }

  protected sortBy(col: number) {
    const s = this.sort();
    this.sort.set(!s || s.col !== col ? { col, dir: 'asc' } : s.dir === 'asc' ? { col, dir: 'desc' } : null);
  }
  protected ariaSort(col: number): 'ascending' | 'descending' | 'none' {
    const s = this.sort();
    return s?.col === col ? (s.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  }
  protected sortIcon(col: number) {
    const s = this.sort();
    return s?.col === col ? (s.dir === 'asc' ? 'phosphorCaretUpLight' : 'phosphorCaretDownLight') : 'phosphorArrowsDownUpLight';
  }

  protected onKey(e: KeyboardEvent) {
    const b = this.built();
    if (!b || b.render !== 'echarts' || !b.points.length) return;
    const n = b.points.length;
    const at = this.cursor();
    let next: number;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = at < 0 ? 0 : (at + 1) % n;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = at < 0 ? n - 1 : (at - 1 + n) % n;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = n - 1;
        break;
      case 'Escape':
        this.leave();
        return;
      default:
        return;
    }
    e.preventDefault();
    const p = b.points[next];
    this.cursor.set(next);
    this.announce.set(p.text);
    this.echart()?.showTip(p.seriesIndex, p.dataIndex);
  }

  protected leave() {
    this.cursor.set(-1);
    this.announce.set('');
    this.echart()?.hideTip();
  }
}
