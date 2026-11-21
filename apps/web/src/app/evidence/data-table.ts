import { Component, ElementRef, afterRenderEffect, computed, effect, inject, input, linkedSignal, signal, untracked, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorArrowDownLight, phosphorArrowUpLight, phosphorArrowsDownUpLight } from '@ng-icons/phosphor-icons/light';
import { columnDecimals, columnHeader, formatCell, formatNumber, isNumericKind, resolveColumns, sortRows, yearOf, type FormatContext, type SortDirection } from './format';
import { HotelDirectory } from './hotel-directory';
import { MAX_COLUMNS, planColumns } from './relevance';
import type { EvidenceColumn, EvidenceRow } from './types';

/** Above this many rows "Show all" still stops: a table is for reading, and the full result is in the SQL. */
const MAX_ROWS = 1000;
/** Text longer than this wraps instead of stretching the table. */
const LONG_TEXT = 48;
/** The rows an answer quotes are all shown, up to this many. */
const MAX_QUOTED_ROWS = 12;
/** What a column needs to read well (px): the one that names the row, and each one after it. */
const LEAD_WIDTH = 150;
const COLUMN_WIDTH = 104;
/** However narrow the box, the row's name and three columns are shown; they scroll if they must. */
const MIN_COLUMNS = 4;

/** How many columns fit a box this wide without scrolling, between `MIN_COLUMNS` and `MAX_COLUMNS`. An unmeasured box gets the most. */
export function columnsThatFit(width: number): number {
  if (!(width > 0)) return MAX_COLUMNS;
  return Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, 1 + Math.floor((width - LEAD_WIDTH) / COLUMN_WIDTH)));
}

/** On its side, a table needs this much (px) for the names of the columns, and this much for each row. */
const FIELD_WIDTH = 190;
const RECORD_WIDTH = 124;
/** More rows than this never read well side by side. */
const MAX_TURNED_ROWS = 3;

/**
 * Whether a few rows read better on their side: the rows across, their columns down. So when the columns do not
 * fit the box as a table, and the rows do fit it side by side. Two quoted accounts with six figures each then show
 * every figure, with nothing to scroll to.
 */
export function turnsOnSide(width: number, rows: number, columns: number): boolean {
  if (!(width > 0) || rows < 1 || rows > MAX_TURNED_ROWS || columns < 3) return false;
  return LEAD_WIDTH + (columns - 1) * COLUMN_WIDTH > width && FIELD_WIDTH + rows * RECORD_WIDTH <= width;
}

/**
 * The rows on screen before "Show all": the ones the answer quotes when it quotes some of them (not all), else the
 * first `pageSize`. Indices into the result, in its order.
 */
export function rowsToStartWith(total: number, quoted: readonly number[], pageSize: number): { indices: number[]; quotedOnly: boolean } {
  const valid = [...new Set(quoted)].filter((index) => Number.isInteger(index) && index >= 0 && index < total).sort((a, b) => a - b);
  if (valid.length && valid.length < total) return { indices: valid.slice(0, MAX_QUOTED_ROWS), quotedOnly: true };
  return { indices: Array.from({ length: Math.min(total, pageSize) }, (_, index) => index), quotedOnly: false };
}

interface Cell {
  key: string;
  text: string;
  numeric: boolean;
  long: boolean;
  empty: boolean;
}

/**
 * Rows a person can read, never a dump of the result. It starts with the rows the answer quotes (the rest behind
 * "Show all N rows") and the columns worth the space (the rest behind "Show N more columns"): the one that tells the rows
 * apart, the ones the answer quotes, then as many as fit, six at most. Human headers, hotel names instead of
 * codes, and every number of a column written the same way, right-aligned in tabular figures. Hairlines between
 * rows and nothing else. A few quoted rows with more columns than fit are turned on their side (rows across,
 * columns down), so every quoted figure shows. Otherwise it scrolls sideways only when the columns that must show
 * do not fit, with the first column frozen and a fade on the edge that has more. Headers sort.
 */
@Component({
  selector: 'juyo-data-table',
  imports: [NgIcon],
  providers: [provideIcons({ phosphorArrowDownLight, phosphorArrowUpLight, phosphorArrowsDownUpLight })],
  host: { class: 'block min-w-0' },
  styles: `
    /* The rows reach a little past the text on both sides, so a tinted row has air and the text still lines up with the card's. */
    .dt-frame {
      position: relative;
      margin-inline: calc(var(--dt-gutter, 10px) * -1);
      border-radius: var(--radius-control, 8px);
      overflow: hidden;
      background: var(--dt-bg, var(--card));
    }
    .dt-scroll {
      overflow: auto;
      overscroll-behavior-x: contain;
      scrollbar-width: thin;
      outline: none;
    }
    .dt-scroll:focus-visible {
      box-shadow: inset 0 0 0 2px var(--ring);
    }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 12.5px;
      line-height: 18px;
    }
    th,
    td {
      padding: 7px 10px;
      text-align: left;
      white-space: nowrap;
      border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
      background: var(--dt-row, var(--dt-bg, var(--card)));
    }
    tbody tr:last-child > * {
      border-bottom: 0;
    }
    thead th {
      position: sticky;
      top: 0;
      z-index: 2;
      padding: 0;
      vertical-align: bottom;
      font-size: 11.5px;
      line-height: 15px;
      font-weight: 500;
      color: var(--muted-foreground);
      background: var(--dt-bg, var(--card));
      border-bottom-color: var(--input);
    }
    tbody th {
      font-weight: 500;
      color: var(--foreground);
    }
    .dt-first {
      position: sticky;
      left: 0;
      z-index: 1;
    }
    /* A table cell ignores max-width, so the frozen column is kept narrow by what is inside it. */
    .dt-clip {
      display: block;
      min-width: 5.5rem;
      max-width: min(38vw, 14rem);
      overflow: hidden;
      text-overflow: ellipsis;
    }
    thead .dt-first {
      z-index: 3;
    }
    /* The frozen column casts a soft edge once the rest has moved under it. */
    .dt-first::after {
      content: '';
      position: absolute;
      inset: 0 0 0 auto;
      width: 1px;
      background: var(--input);
      opacity: 0;
      transition: opacity 150ms ease;
    }
    .dt-scrolled .dt-first::after {
      opacity: 1;
    }
    .dt-num {
      text-align: right;
      font-variant-numeric: tabular-nums lining-nums;
    }
    .dt-long {
      white-space: normal;
      min-width: 28ch;
      max-width: 56ch;
    }
    .dt-empty {
      color: var(--muted-foreground);
    }
    @media (hover: hover) {
      tbody tr:hover {
        --dt-row: color-mix(in srgb, var(--foreground) 4%, var(--dt-bg, var(--card)));
      }
    }
    /* A row the answer quotes, among the others. */
    tbody tr.dt-quoted {
      --dt-row: color-mix(in srgb, var(--focus-brand) 9%, var(--dt-bg, var(--card)));
    }
    /* The row of the figure the person asked about. */
    tbody tr.dt-hit {
      --dt-row: color-mix(in srgb, var(--focus-brand) 16%, var(--dt-bg, var(--card)));
    }
    td.dt-hit-cell {
      font-weight: 600;
      color: var(--foreground);
      box-shadow: inset 0 0 0 1px var(--focus-brand);
    }
    .dt-sort {
      display: flex;
      width: max-content;
      align-items: flex-end;
      gap: 3px;
      padding: 6px 10px;
      font: inherit;
      color: inherit;
      text-align: left;
      white-space: normal;
      text-wrap: balance;
      max-width: 15ch;
      min-height: 28px;
      cursor: pointer;
      outline: none;
      transition: color 120ms ease;
    }
    .dt-num .dt-sort {
      flex-direction: row-reverse;
      text-align: right;
      margin-left: auto;
    }
    .dt-sort:hover,
    [aria-sort='ascending'] .dt-sort,
    [aria-sort='descending'] .dt-sort {
      color: var(--foreground);
    }
    .dt-sort:focus-visible {
      box-shadow: inset 0 0 0 2px var(--ring);
      border-radius: 4px;
    }
    /* The arrow takes no room until the column is sorted, so a narrow header keeps its width for words. */
    .dt-sort ng-icon {
      flex: none;
      width: 0;
      font-size: 11px;
      margin-bottom: 2px;
      opacity: 0;
      overflow: hidden;
      transition: opacity 120ms ease;
    }
    .dt-sort:hover ng-icon,
    .dt-sort:focus-visible ng-icon {
      width: auto;
      opacity: 0.7;
    }
    [aria-sort='ascending'] .dt-sort ng-icon,
    [aria-sort='descending'] .dt-sort ng-icon {
      width: auto;
      opacity: 1;
      color: var(--brand);
    }
    /* On its side: the names of the rows across the top, the columns down the left. Words wrap, so it always fits. */
    .dt-turned thead th {
      padding: 6px 10px;
      white-space: normal;
      text-wrap: balance;
    }
    .dt-turned thead th.dt-record {
      color: var(--foreground);
    }
    .dt-turned tbody th {
      font-weight: 400;
      color: var(--muted-foreground);
      white-space: normal;
    }
    .dt-fade {
      position: absolute;
      inset: 0 0 0 auto;
      width: 36px;
      pointer-events: none;
      background: linear-gradient(to right, transparent, var(--dt-bg, var(--card)));
      opacity: 0;
      transition: opacity 150ms ease;
      z-index: 4;
    }
    .dt-more-end .dt-fade {
      opacity: 1;
    }
    .dt-link {
      border-radius: 4px;
      color: color-mix(in srgb, var(--foreground) 90%, transparent);
      text-decoration: underline;
      text-decoration-color: var(--input);
      text-underline-offset: 3px;
      outline: none;
      cursor: pointer;
      transition:
        color 120ms ease,
        text-decoration-color 120ms ease;
    }
    .dt-link:hover {
      color: var(--foreground);
      text-decoration-color: currentColor;
    }
    .dt-link:focus-visible {
      box-shadow: 0 0 0 2px var(--ring);
    }
    @media (pointer: coarse) {
      .dt-sort {
        min-height: 40px;
      }
      th,
      td {
        padding-block: 9px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .dt-fade,
      .dt-first::after,
      .dt-link,
      .dt-sort,
      .dt-sort ng-icon {
        transition: none;
      }
    }
  `,
  template: `
    @if (shown().length && rows().length) {
      @if (shared().length && !showMore()) {
        <p class="text-muted-foreground mb-2 text-[12.5px]/[18px]" data-shared>
          Every row ·
          @for (s of shared(); track s.label; let last = $last) {
            {{ s.label }}: <span class="text-foreground">{{ s.value }}</span>{{ last ? '' : ' · ' }}
          }
        </p>
      }
      <div class="dt-frame" [class.dt-more-end]="moreEnd()" [class.dt-scrolled]="scrolled()">
        <div
          #scroller
          class="dt-scroll"
          [style.max-height]="expanded() ? 'min(26rem, 60dvh)' : null"
          [attr.tabindex]="overflowing() ? 0 : null"
          [attr.role]="overflowing() ? 'region' : null"
          [attr.aria-label]="overflowing() ? caption() + ', scrollable table' : null"
          (scroll)="measure()"
        >
          @if (turned()) {
            <table class="dt-turned">
              <caption class="sr-only">
                {{ caption() }}: {{ summary() }}, one column for each
              </caption>
              <thead>
                <tr>
                  <th scope="col" class="dt-first">{{ header(shown()[0]!) }}</th>
                  @for (r of page(); track r.index) {
                    <th scope="col" class="dt-num dt-record">{{ r.cells[0]!.text }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (c of shown().slice(1); track c.key; let at = $index) {
                  <tr>
                    <th scope="row" class="dt-first">{{ header(c) }}</th>
                    @for (r of page(); track r.index) {
                      @let cell = r.cells[at + 1]!;
                      <td class="dt-num" [class.dt-empty]="cell.empty" [class.dt-hit-cell]="r.index === highlight()?.rowIndex && cell.key === highlight()?.key" [attr.data-row]="r.index">{{ cell.text }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          } @else {
          <table>
            <caption class="sr-only">
              {{ caption() }}: {{ summary() }}
            </caption>
            <thead>
              <tr>
                @for (c of shown(); track c.key; let first = $first) {
                  <th scope="col" [class.dt-first]="first" [class.dt-num]="numeric(c)" [attr.aria-sort]="ariaSort(c)">
                    <button type="button" class="dt-sort" (click)="toggleSort(c)">
                      <span>{{ header(c) }}</span>
                      <ng-icon [name]="sortIcon(c)" aria-hidden="true" />
                    </button>
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (r of page(); track r.index) {
                <tr [class.dt-quoted]="r.quoted && mixed()" [class.dt-hit]="r.index === highlight()?.rowIndex" [attr.data-row]="r.index">
                  @for (cell of r.cells; track cell.key; let first = $first) {
                    @if (first && !cell.numeric) {
                      <th scope="row" class="dt-first" [class.dt-empty]="cell.empty">
                        <span class="dt-clip" [attr.title]="cell.text">{{ cell.text }}</span>
                        @if (r.quoted && mixed()) {
                          <span class="sr-only"> (quoted in the answer)</span>
                        }
                      </th>
                    } @else {
                      <td
                        [class.dt-first]="first"
                        [class.dt-num]="cell.numeric"
                        [class.dt-long]="cell.long"
                        [class.dt-empty]="cell.empty"
                        [class.dt-hit-cell]="r.index === highlight()?.rowIndex && cell.key === highlight()?.key"
                      >
                        {{ cell.text }}
                      </td>
                    }
                  }
                </tr>
              }
            </tbody>
          </table>
          }
        </div>
        <div class="dt-fade" aria-hidden="true"></div>
      </div>

      @if (canExpand() || moreCount()) {
        <div class="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
          @if (canExpand()) {
            <button type="button" class="dt-link" [attr.aria-expanded]="expanded()" (click)="expanded.set(!expanded())">{{ rowsToggle() }}</button>
            <span>{{ summary() }}</span>
          }
          @if (moreCount()) {
            <button type="button" class="dt-link ml-auto" [attr.aria-expanded]="showMore()" (click)="showMore.set(!showMore())">
              {{ showMore() ? 'Show fewer columns' : moreText() }}
            </button>
          }
        </div>
      }
    } @else {
      <p class="text-muted-foreground text-[12.5px]">Nothing came back for this. Try a wider period or more hotels.</p>
    }
  `,
})
export class DataTable {
  /** The rows of one result. */
  readonly rows = input.required<readonly EvidenceRow[]>();
  /** The server's column metadata. Without it, labels and kinds are read from the keys and values. */
  readonly columns = input<readonly EvidenceColumn[] | null | undefined>(null);
  /** What the table holds, for the caption screen readers hear ("Pace vs last year"). */
  readonly caption = input('Result');
  /** The data's "today" (ISO): dates in its year are written without the year. */
  readonly businessDate = input<string | undefined>(undefined);
  /** Rows shown before "Show all", when the answer quotes none of them. */
  readonly pageSize = input(8);
  /** The rows (by index) that back numbers the answer quotes: the table starts with these alone. */
  readonly quotedRows = input<readonly number[]>([]);
  /** Column keys that must stay on screen: the ones the answer quotes, the ones a chart draws. */
  readonly prefer = input<readonly string[]>([]);
  /** Column keys whose value, the same on every row, is already said beside the table (the hotel in a card's title). */
  readonly stated = input<readonly string[]>([]);
  /** Start with every row (a chart draws all of them). */
  readonly allRows = input(false);
  /** A cell to point at (a figure quoted in the answer): its row is tinted and brought into view. */
  readonly highlight = input<{ rowIndex: number; key?: string } | null>(null);

  private readonly hotels = inject(HotelDirectory);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  protected readonly expanded = linkedSignal(() => this.allRows());
  protected readonly showMore = signal(false);
  protected readonly sort = signal<{ key: string; direction: SortDirection } | null>(null);
  protected readonly moreEnd = signal(false);
  protected readonly scrolled = signal(false);
  protected readonly overflowing = signal(false);
  /** The width of the table's box, 0 until it is measured. */
  private readonly width = signal(0);
  private shownHit: { rowIndex: number; key?: string } | null = null;

  private readonly context = computed<FormatContext>(() => ({ hotelName: this.hotels.name, baseYear: yearOf(this.businessDate()) }));
  private readonly all = computed(() => resolveColumns(this.rows(), this.columns(), this.hotels.has));
  private readonly plan = computed(() => {
    const pointed = this.highlight()?.key;
    return planColumns(this.all(), this.rows(), { prefer: pointed ? [pointed, ...this.prefer()] : this.prefer(), max: columnsThatFit(this.width()) });
  });
  protected readonly shown = computed(() => (this.showMore() ? [...this.plan().shown, ...this.plan().more] : this.plan().shown));
  protected readonly moreCount = computed(() => this.plan().more.length);
  protected readonly moreText = computed(() => `Show ${this.moreCount()} more ${this.moreCount() === 1 ? 'column' : 'columns'}`);
  /** What every row says alike, said once above the table instead of in a column of its own. */
  protected readonly shared = computed(() => {
    const row = this.rows()[0];
    const stated = this.stated();
    if (!row) return [];
    return this.plan()
      .shared.filter((column) => !stated.includes(column.key))
      .map((column) => ({ label: column.label, value: formatCell(row[column.key], column, this.context()) }));
  });
  private readonly decimals = computed(() => new Map(this.all().map((column) => [column.key, columnDecimals(column, this.rows())])));
  protected readonly total = computed(() => formatNumber(this.rows().length, 0));
  private readonly start = computed(() => rowsToStartWith(this.rows().length, this.quotedRows(), this.pageSize()));
  private readonly quotedSet = computed(() => new Set(this.start().quotedOnly ? this.quotedRows() : []));
  protected readonly canExpand = computed(() => this.rows().length > this.start().indices.length);
  /** Quoted rows and others are on screen together, so the quoted ones are marked. */
  protected readonly mixed = computed(() => this.start().quotedOnly && this.expanded());

  private readonly sorted = computed(() => {
    const indexed = this.rows().map((row, index) => ({ ...row, __index: index }));
    const sort = this.sort();
    const column = sort ? this.all().find((candidate) => candidate.key === sort.key) : undefined;
    return sort && column ? sortRows(indexed, column, sort.direction, this.context()) : indexed;
  });

  /** The rows on screen, already formatted. */
  protected readonly page = computed(() => {
    const columns = this.shown();
    const context = this.context();
    const decimals = this.decimals();
    const quoted = this.quotedSet();
    const start = new Set(this.start().indices);
    const rows = this.expanded() ? this.sorted().slice(0, MAX_ROWS) : this.sorted().filter((row) => start.has(row.__index));
    return rows.map((row) => ({
      index: row.__index,
      quoted: quoted.has(row.__index),
      cells: columns.map((column): Cell => {
        const text = formatCell((row as EvidenceRow)[column.key], column, context, decimals.get(column.key));
        const numeric = isNumericKind(column.kind);
        return { key: column.key, text, numeric, long: !numeric && text.length > LONG_TEXT, empty: text === '–' };
      }),
    }));
  });

  /** The few quoted rows are shown on their side, because their columns do not fit the box as a table. */
  protected readonly turned = computed(() => {
    const lead = this.shown()[0];
    if (this.expanded() || !this.start().quotedOnly || !lead || isNumericKind(lead.kind)) return false;
    return turnsOnSide(this.width(), this.page().length, this.shown().length);
  });

  protected readonly summary = computed(() => {
    const count = this.rows().length;
    const shown = this.page().length;
    if (shown >= count) return `${this.total()} ${count === 1 ? 'row' : 'rows'}`;
    if (this.start().quotedOnly) return `${formatNumber(shown, 0)} of ${this.total()} rows: ${shown === 1 ? 'the one' : 'the ones'} the answer quotes`;
    return `First ${formatNumber(shown, 0)} of ${this.total()} rows`;
  });

  protected readonly rowsToggle = computed(() => {
    if (!this.expanded()) return `Show all ${this.total()} rows`;
    const start = this.start();
    if (!start.quotedOnly) return `Show the first ${this.pageSize()}`;
    return start.indices.length === 1 ? 'Show only the quoted row' : `Show only the ${start.indices.length} quoted rows`;
  });

  constructor() {
    // A figure in a row that is not on screen opens the table, so its row is there to point at.
    effect(() => {
      const hit = this.highlight();
      if (!hit) return;
      if (!untracked(() => this.start().indices.includes(hit.rowIndex))) this.expanded.set(true);
    });
    afterRenderEffect(() => {
      // Re-read the edges whenever what is rendered changes.
      this.page();
      this.shown();
      const element = this.scroller()?.nativeElement;
      if (!element) return;
      const hit = this.highlight();
      if (hit && hit !== this.shownHit) {
        this.shownHit = hit;
        this.bringIntoView(element, hit.rowIndex);
      }
      this.measure();
    });
    afterRenderEffect((onCleanup) => {
      const element = this.host.nativeElement;
      this.width.set(element.clientWidth);
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => {
        this.width.set(element.clientWidth);
        this.measure();
      });
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    });
  }

  protected readonly numeric = (column: EvidenceColumn) => isNumericKind(column.kind);
  protected readonly header = columnHeader;

  protected ariaSort(column: EvidenceColumn): 'ascending' | 'descending' | 'none' {
    const sort = this.sort();
    if (sort?.key !== column.key) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  protected sortIcon(column: EvidenceColumn): string {
    const state = this.ariaSort(column);
    return state === 'ascending' ? 'phosphorArrowUpLight' : state === 'descending' ? 'phosphorArrowDownLight' : 'phosphorArrowsDownUpLight';
  }

  /** Numbers start largest first, everything else A to Z; a third click returns to the order the data came in. */
  protected toggleSort(column: EvidenceColumn): void {
    const first: SortDirection = isNumericKind(column.kind) ? 'desc' : 'asc';
    const second: SortDirection = first === 'asc' ? 'desc' : 'asc';
    const current = this.sort();
    if (current?.key !== column.key) this.sort.set({ key: column.key, direction: first });
    else if (current.direction === first) this.sort.set({ key: column.key, direction: second });
    else this.sort.set(null);
  }

  /**
   * Scrolls the table's own box (never the page) so the highlighted cell is clear of the frozen column and the
   * edge fade. The panel brings the card into view; doing both with scrollIntoView would have them fight.
   */
  private bringIntoView(scroller: HTMLElement, rowIndex: number): void {
    const row = scroller.querySelector<HTMLElement>(`tr[data-row="${rowIndex}"]`);
    if (!row) return;
    const cell = row.querySelector<HTMLElement>('.dt-hit-cell');
    const frozen = (row.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0;
    if (cell) {
      const left = cell.offsetLeft - frozen - 12;
      const right = cell.offsetLeft + cell.offsetWidth + 44 - scroller.clientWidth;
      if (scroller.scrollLeft > left) scroller.scrollLeft = Math.max(0, left);
      else if (scroller.scrollLeft < right) scroller.scrollLeft = right;
    }
    const head = scroller.querySelector<HTMLElement>('thead')?.offsetHeight ?? 0;
    if (row.offsetTop - head < scroller.scrollTop) scroller.scrollTop = row.offsetTop - head;
    else if (row.offsetTop + row.offsetHeight > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = row.offsetTop + row.offsetHeight - scroller.clientHeight;
  }

  /** Which edges have more to scroll to, for the fade and the frozen column's edge. */
  protected measure(): void {
    const element = this.scroller()?.nativeElement;
    if (!element) return;
    const overflow = element.scrollWidth - element.clientWidth;
    this.overflowing.set(overflow > 1 || element.scrollHeight - element.clientHeight > 1);
    this.scrolled.set(element.scrollLeft > 1);
    this.moreEnd.set(overflow - element.scrollLeft > 1);
  }
}
