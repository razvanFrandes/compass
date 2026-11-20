import { Component, ElementRef, afterRenderEffect, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorArrowDownLight, phosphorArrowUpLight, phosphorArrowsDownUpLight } from '@ng-icons/phosphor-icons/light';
import { columnHeader, formatCell, formatNumber, isHidden, isNumericKind, resolveColumns, sortRows, visibleColumns, yearOf, type FormatContext, type SortDirection } from './format';
import { HotelDirectory } from './hotel-directory';
import type { EvidenceColumn, EvidenceRow } from './types';

/** Above this many rows "Show all" still stops: a table is for reading, and the full result is in the SQL. */
const MAX_ROWS = 1000;
/** Text longer than this wraps instead of stretching the table. */
const LONG_TEXT = 48;

/**
 * The first column is frozen, so it should tell the rows apart. When it holds one value for every row (one hotel,
 * 193 stay dates) and a later naming column varies, that column leads instead.
 */
export function leadWithWhatVaries(columns: EvidenceColumn[], rows: readonly EvidenceRow[]): EvidenceColumn[] {
  const first = columns[0];
  if (!first || rows.length < 2 || isNumericKind(first.kind)) return columns;
  const varies = (column: EvidenceColumn) => rows.some((row) => row[column.key] !== rows[0]![column.key]);
  if (varies(first)) return columns;
  const lead = columns.find((column) => !isNumericKind(column.kind) && varies(column));
  return lead ? [lead, ...columns.filter((column) => column !== lead)] : columns;
}

interface Cell {
  key: string;
  text: string;
  numeric: boolean;
  long: boolean;
  empty: boolean;
}

/**
 * Rows a person can read: human headers, hotel names instead of codes, numbers, percentages, money and dates
 * formatted with tabular figures, numeric columns right-aligned. Internal columns (ids, kinds) are hidden until
 * asked for. The table scrolls sideways inside its own box, with the first column frozen and a fade on the edge
 * that has more; it starts with a few rows and "Show all N rows" opens the rest. Headers sort.
 */
@Component({
  selector: 'juyo-data-table',
  imports: [NgIcon],
  providers: [provideIcons({ phosphorArrowDownLight, phosphorArrowUpLight, phosphorArrowsDownUpLight })],
  host: { class: 'block min-w-0' },
  styles: `
    .dt-frame {
      position: relative;
      border: 1px solid var(--border);
      border-radius: var(--radius-container, 10px);
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
      padding: 6px 10px;
      text-align: left;
      white-space: nowrap;
      border-bottom: 1px solid var(--border);
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
      font-weight: 500;
      color: var(--muted-foreground);
      background: var(--dt-head, color-mix(in srgb, var(--foreground) 5%, var(--dt-bg, var(--card))));
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
      max-width: min(38vw, 15rem);
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
      min-width: 34ch;
      max-width: 60ch;
    }
    .dt-empty {
      color: var(--muted-foreground);
    }
    @media (hover: hover) {
      tbody tr:hover {
        --dt-row: color-mix(in srgb, var(--foreground) 5%, var(--dt-bg, var(--card)));
      }
    }
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
      gap: 4px;
      padding: 7px 10px 6px;
      font: inherit;
      color: inherit;
      text-align: left;
      white-space: normal;
      text-wrap: balance;
      max-width: 17ch;
      min-height: 32px;
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
    .dt-sort ng-icon {
      flex: none;
      font-size: 12px;
      margin-bottom: 3px;
      opacity: 0;
      transition: opacity 120ms ease;
    }
    .dt-sort:hover ng-icon,
    .dt-sort:focus-visible ng-icon {
      opacity: 0.7;
    }
    [aria-sort='ascending'] .dt-sort ng-icon,
    [aria-sort='descending'] .dt-sort ng-icon {
      opacity: 1;
      color: var(--brand);
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
      .dt-sort,
      .dt-sort ng-icon {
        transition: none;
      }
    }
  `,
  template: `
    @if (shown().length && rows().length) {
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
                <tr [class.dt-hit]="r.index === highlight()?.rowIndex" [attr.data-row]="r.index">
                  @for (cell of r.cells; track cell.key; let first = $first) {
                    @if (first && !cell.numeric) {
                      <th scope="row" class="dt-first" [class.dt-empty]="cell.empty"><span class="dt-clip" [attr.title]="cell.text">{{ cell.text }}</span></th>
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
        </div>
        <div class="dt-fade" aria-hidden="true"></div>
      </div>

      @if (canExpand() || hiddenCount()) {
        <div class="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
          @if (canExpand()) {
            <button type="button" class="text-foreground/90 hover:text-foreground rounded-[4px] underline decoration-(--input) underline-offset-[3px] outline-none transition-colors hover:decoration-current focus-visible:ring-2 focus-visible:ring-(--ring)" [attr.aria-expanded]="expanded()" (click)="expanded.set(!expanded())">
              {{ expanded() ? 'Show the first ' + pageSize() : 'Show all ' + total() + ' rows' }}
            </button>
            <span>{{ summary() }}</span>
          }
          @if (hiddenCount()) {
            <button type="button" class="text-foreground/90 hover:text-foreground rounded-[4px] underline decoration-(--input) underline-offset-[3px] outline-none transition-colors hover:decoration-current focus-visible:ring-2 focus-visible:ring-(--ring) ml-auto" [attr.aria-pressed]="showHidden()" (click)="showHidden.set(!showHidden())">
              {{ showHidden() ? 'Hide internal columns' : hiddenText() }}
            </button>
          }
        </div>
      }
    } @else {
      <p class="text-muted-foreground text-[12.5px]">No rows came back for this step.</p>
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
  /** Rows shown before "Show all". */
  readonly pageSize = input(8);
  /** A cell to point at (a figure quoted in the answer): its row is tinted and brought into view. */
  readonly highlight = input<{ rowIndex: number; key?: string } | null>(null);

  private readonly hotels = inject(HotelDirectory);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  protected readonly expanded = signal(false);
  protected readonly showHidden = signal(false);
  protected readonly sort = signal<{ key: string; direction: SortDirection } | null>(null);
  protected readonly moreEnd = signal(false);
  protected readonly scrolled = signal(false);
  protected readonly overflowing = signal(false);
  private shownHit: { rowIndex: number; key?: string } | null = null;

  private readonly context = computed<FormatContext>(() => ({ hotelName: this.hotels.name, baseYear: yearOf(this.businessDate()) }));
  private readonly all = computed(() => resolveColumns(this.rows(), this.columns(), this.hotels.has));
  protected readonly shown = computed(() => leadWithWhatVaries(this.showHidden() ? this.all() : visibleColumns(this.all()), this.rows()));
  protected readonly hiddenCount = computed(() => {
    const hidden = this.all().filter(isHidden).length;
    // When every column is internal, they are all shown already and there is nothing to toggle.
    return hidden < this.all().length ? hidden : 0;
  });
  protected readonly hiddenText = computed(() => `Show ${this.hiddenCount()} internal ${this.hiddenCount() === 1 ? 'column' : 'columns'}`);
  protected readonly total = computed(() => formatNumber(this.rows().length, 0));
  protected readonly canExpand = computed(() => this.rows().length > this.pageSize());

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
    const limit = this.expanded() ? MAX_ROWS : this.pageSize();
    return this.sorted()
      .slice(0, limit)
      .map((row) => ({
        index: row.__index,
        cells: columns.map((column): Cell => {
          const text = formatCell((row as EvidenceRow)[column.key], column, context);
          const numeric = isNumericKind(column.kind);
          return { key: column.key, text, numeric, long: !numeric && text.length > LONG_TEXT, empty: text === '–' };
        }),
      }));
  });

  protected readonly summary = computed(() => {
    const count = this.rows().length;
    const shown = this.page().length;
    if (shown >= count) return `${this.total()} ${count === 1 ? 'row' : 'rows'}`;
    return `First ${formatNumber(shown, 0)} of ${this.total()} rows`;
  });

  constructor() {
    // A quoted figure further down than the first page opens the table, so its row is there to point at.
    effect(() => {
      const hit = this.highlight();
      if (!hit) return;
      const position = untracked(() => this.sorted().findIndex((row) => row.__index === hit.rowIndex));
      if (position >= untracked(this.pageSize)) this.expanded.set(true);
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
      const element = this.scroller()?.nativeElement;
      if (!element || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.measure());
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
