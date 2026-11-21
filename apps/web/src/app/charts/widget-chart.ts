import { Component, DestroyRef, ElementRef, InjectionToken, type Signal, ViewEncapsulation, afterNextRender, afterRenderEffect, computed, inject, input, linkedSignal, output, signal, untracked, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorArrowsDownUpLight, phosphorCaretDownLight, phosphorCaretUpLight, phosphorChartBarLight, phosphorTableLight } from '@ng-icons/phosphor-icons/light';
import { type Built, type TableModel, bodyHeight, buildWidget, kpiColumns, kpiCount, summaryHead } from './builders';
import { skeletonPlan } from './builders/skeleton';
import { EChartHost } from './echart-host';
import { type KindOption, compatibleKinds } from './kinds';
import { readTokens } from './tokens';
import { ViewAs } from './view-as';
import { ViewAsMemory } from './view-memory';
import { hotelCatalog } from './hotel-names';
import { sameData } from './same';
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

/**
 * A subtitle with the unit of the amounts said once ("… · In local currency"), for charts whose numbers carry
 * none of their own. A subtitle that already names it is left as it is.
 */
export function subtitleWithUnit(subtitle: string | null | undefined, unitNote: string | null | undefined): string {
  const text = subtitle?.trim() ?? '';
  if (!unitNote) return text;
  const unit = unitNote.replace(/^in\s+/i, '');
  if (text.toLowerCase().includes(unit.toLowerCase())) return text;
  return text ? `${text} · ${unitNote}` : unitNote;
}

let nextId = 0;

/** Two specs that draw the same marks: only the words around the chart (title, subtitle) may differ. */
function sameDrawing(a: WidgetSpec, b: WidgetSpec): boolean {
  return a.kind === b.kind && a.x === b.x && a.group === b.group && a.compare === b.compare && a.forecast === b.forecast && a.target === b.target && a.limit === b.limit && (a.band ?? []).join('\u0000') === (b.band ?? []).join('\u0000') && a.format === b.format && a.sourceCallId === b.sourceCallId && (a.y ?? []).join('\u0000') === (b.y ?? []).join('\u0000');
}

/**
 * The one way to draw a widget (contract §3): every WidgetKind, from rows the backend sent.
 *
 *   <juyo-widget-chart [spec]="w" [rows]="w.rows" [columns]="w.columns" />
 *
 * While it loads (`[loading]`, or rows that are null or undefined) it shows a skeleton of its own kind, in the
 * box the finished widget will have. Every chart can be read as a table ("View as table"), reached and stepped through with the keyboard,
 * and follows the theme and prefers-reduced-motion.
 *
 * With `[switcher]` it has "View as" in its header, top right: an icon per kind these rows can be shown as
 * (`compatibleKinds`), the one the widget came with marked by a dot. Without a header, the host places it in its own
 * (`[controls]="'external'"` and `<juyo-view-as [for]="chart" />`), or it sits in a one-line row under the body. A switch is instant and reads the same rows; `[viewKey]` remembers
 * it for this widget. The host reads the spec on screen with `specAs(spec, memory.kind(key), rows, columns)`.
 */
@Component({
  selector: 'juyo-widget-chart',
  imports: [EChartHost, NgIcon, ViewAs, WidgetSkeleton],
  providers: [provideIcons({ phosphorArrowsDownUpLight, phosphorCaretDownLight, phosphorCaretUpLight, phosphorChartBarLight, phosphorTableLight })],
  encapsulation: ViewEncapsulation.None,
  styleUrl: './widget-chart.css',
  templateUrl: './widget-chart.html',
  host: { class: 'juyo-wc', '[class.juyo-wc--compact]': 'compact()', '[attr.data-kind]': 'view().kind' },
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
  /** Shows "View as" under the widget: the other kinds its rows can be drawn as. It takes the place of "View as table". */
  readonly switcher = input(false);
  /** Remembers the kind chosen in "View as" under this key (see ViewAsMemory). Without one the choice lasts while the widget does. */
  readonly viewKey = input<string | null>(null);
  /** The kind marked "Recommended". By default the one the widget came with: Kassandra's choice, or the first look at the rows. */
  readonly recommended = input<WidgetKind | null>(null);
  /**
   * Where "View as" goes when the widget has no header of its own: `auto` puts it in a one-line row under the
   * body; `external` leaves it to the host, which places `<juyo-view-as [for]="chart" />` in its own header.
   */
  readonly controls = input<'auto' | 'external'>('auto');

  private readonly memory = inject(ViewAsMemory);
  /** The choice of a widget nobody gave a key: it lasts until the widget shows other data. */
  private readonly unkeyed = linkedSignal<string, WidgetKind | null>({ source: () => this.spec().sourceCallId, computation: () => null });
  /** The kinds these rows can be shown as; empty until there are rows, or when nobody asked for the switcher. */
  readonly options = computed<KindOption[]>(() => {
    const rows = this.data();
    return this.switcher() && rows ? compatibleKinds(this.spec(), rows as readonly WidgetRow[], this.cols()) : [];
  });
  private readonly chosen = computed(() => (this.viewKey() ? this.memory.kind(this.viewKey()) : this.unkeyed()));
  /** The spec on screen: the widget's own, or the one for the kind chosen in "View as" when these rows still allow it. */
  readonly view = computed<WidgetSpec>(() => this.options().find((option) => option.kind === this.chosen())?.spec ?? this.spec());
  readonly recommendedKind = computed(() => this.recommended() ?? this.spec().kind);
  /** The row keeps its place while the widget loads, and goes when there is nothing to switch to. */
  protected readonly switcherSlot = computed(() => this.switcher() && !this.header() && this.controls() === 'auto' && (this.state() !== 'none' || !this.rows() || this.options().length > 1 || this.rowFloor() > 0));
  private readonly viewRow = viewChild<ElementRef<HTMLElement>>('viewRow');
  /**
   * The tallest the "View as" row has been at this width. The row never gets shorter than that: when a preview
   * becomes Kassandra's chart and fewer kinds fit, nothing under the chart moves up.
   */
  protected readonly rowFloor = linkedSignal<number, number>({ source: () => this.width(), computation: () => 0 });
  /**
   * The height of the chart's body in px, for a host with a rhythm of its own (180 in an overview row, 320 for a
   * featured chart). Null keeps the catalogue's height for the kind. KPI tiles size themselves and ignore it.
   */
  readonly height = input<number | null>(null);
  /** A click on a mark: the row it stands for (a host turns it into a drill). */
  readonly picked = output<WidgetRow>();

  protected readonly uid = `wc${nextId++}`;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly scope = inject(WIDGET_THEME_SCOPE, { optional: true });
  private readonly echart = viewChild(EChartHost);

  private readonly width = signal(640);
  private readonly mounted = signal(false);
  private readonly reducedMotion = signal(false);

  /* What the marks are drawn from, compared by value: the same rows, columns or colours arriving again as new
     objects (a live conversation re-sending its turn, a class on <html> that is not the theme) draw nothing again. */
  private readonly tokens = computed(
    () => {
      appTheme();
      this.scope?.();
      this.mounted();
      return readTokens(this.host);
    },
    { equal: sameData },
  );
  private readonly data = computed(() => this.rows(), { equal: sameData });
  private readonly cols = computed(() => this.columns(), { equal: sameData });

  /** KPI tiles: how many there are (known from the spec before the rows arrive) and how many sit in a row. */
  private readonly tiles = computed(() => {
    const b = this.built();
    return b?.render === 'kpi_row' ? b.tiles.length : kpiCount(this.view());
  });
  protected readonly tileCols = computed(() => kpiColumns(this.tiles(), this.width()));
  /** The host's height where it applies; every state of the widget uses it, so nothing moves when the rows arrive. */
  private readonly fixed = computed(() => {
    const kind = this.view().kind;
    const h = this.height();
    return h && h > 0 && kind !== 'kpi' && kind !== 'kpi_row' ? Math.round(h) : null;
  });
  /** The drawing's own height when it needs one (a bridge lying down sizes itself by its steps); else the host's or the kind's. */
  protected readonly bodyH = computed(() => this.built()?.height ?? this.fixed() ?? bodyHeight(this.view(), this.compact(), this.width(), this.tiles()));
  protected readonly narrow = computed(() => this.width() < 480);
  /** The state on screen: the one asked for, or `title` while there are no rows to draw. */
  protected readonly state = computed<WidgetLoading>(() => (this.loading() !== 'none' ? this.loading() : this.rows() ? 'none' : 'title'));
  protected readonly plan = computed(() => skeletonPlan(this.view(), this.columns() ?? [], this.width()));
  protected readonly nbsp = '\u00a0';

  /**
   * The spec the marks are built from. A new title over the same columns (Kassandra's conclusion replacing the
   * preview's label) keeps it, so the chart is not drawn again for words that sit outside it.
   */
  private readonly drawn = computed(() => this.view(), { equal: sameDrawing });

  protected readonly built = computed<Built | null>(() => {
    const rows = this.data();
    if (!rows || this.state() !== 'none') return null;
    hotelCatalog();
    return buildWidget({ spec: this.drawn(), rows: rows as readonly WidgetRow[], columns: this.cols() ?? [], tokens: this.tokens(), width: this.width(), compact: this.compact(), motion: !this.reducedMotion(), ...(this.fixed() ? { height: this.fixed()! } : {}) });
  });

  /** The unit of the amounts when they carry none ("In local currency"); a host with its own header shows it under the title. */
  readonly unitNote = computed(() => this.built()?.unitNote ?? null);
  protected readonly subtitle = computed(() => subtitleWithUnit(this.view().subtitle, this.unitNote()));

  /** The chart's text alternative, opening with the title on screen (the marks may have been built under an earlier one). */
  protected readonly summary = computed(() => {
    const text = this.built()?.summary ?? '';
    const was = summaryHead(this.drawn());
    const now = summaryHead(this.view());
    return was !== now && text.startsWith(was) ? now + text.slice(was.length) : text;
  });

  /** "View as table" resets when the widget becomes a different kind of chart. */
  protected readonly asTable = linkedSignal<WidgetKind, boolean>({ source: () => this.view().kind, computation: () => false });
  /**
   * "View as table" has a place in the header for every kind but `table`, and keeps it while loading and when
   * the result turns out empty, so the title wraps the same way in every state. It is only shown when it can do something.
   */
  protected readonly toggleSlot = computed(() => !this.switcher() && this.spec().kind !== 'table');
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
    afterRenderEffect(() => this.measureRow());
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

  /** "View as": the kind the widget came with needs no remembering. */
  viewAs(kind: WidgetKind) {
    const pick = kind === this.spec().kind ? null : kind;
    const key = this.viewKey();
    if (key) this.memory.set(key, pick);
    else this.unkeyed.set(pick);
    this.leave();
  }

  /** "+12 more": the whole list, as the table. */
  protected showAll() {
    if (this.switcher() && this.options().some((o) => o.kind === 'table')) this.viewAs('table');
    else this.asTable.set(true);
  }

  private measureRow() {
    this.options();
    this.mounted();
    const content = this.viewRow()?.nativeElement.firstElementChild;
    const height = Math.ceil(content?.getBoundingClientRect().height ?? 0);
    if (height > untracked(this.rowFloor)) this.rowFloor.set(height);
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

  protected onPick(e: { seriesIndex: number; dataIndex: number }) {
    const b = this.built();
    const rows = this.data();
    if (!b || !rows || e.seriesIndex !== 0) return;
    const row = rows[b.rows?.[e.dataIndex] ?? e.dataIndex];
    if (row) this.picked.emit(row as WidgetRow);
  }

  protected leave() {
    this.cursor.set(-1);
    this.announce.set('');
    this.echart()?.hideTip();
  }
}
