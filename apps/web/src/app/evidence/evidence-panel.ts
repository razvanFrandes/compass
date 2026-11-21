import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, afterRenderEffect, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorCaretDownLight, phosphorCaretRightLight, phosphorWarningCircleLight } from '@ng-icons/phosphor-icons/light';
import { DataTable } from './data-table';
import { dataAsOf, formatNumber, formatPeriod, resolveColumns, yearOf, type FormatContext } from './format';
import { HotelDirectory } from './hotel-directory';
import { humanizeText } from '../text';
import { humanizeKey, isDataTool, proseKeys, sourceLabel, toolTitle } from './labels';
import { quotedFigures, type Figure, type FigureTable } from './quoted';
import { arrangeCalls, backedCounts, backingCells, figureSources, lookupSummary, toolRole } from './relevance';
import type { EvidenceColumn, EvidenceEntry, EvidenceRow, RichEvidence } from './types';

/** The figures the panel leads with. More of the answer's numbers may be traced: they still mark their rows. */
const FIGURES_SHOWN = 8;
const FIGURES_TRACED = 40;

interface Card {
  callId: string;
  /** The tool, e.g. `get_pace`. */
  name: string;
  title: string;
  /** "Arbor Lisbon Chiado · 1 Aug – 19 Nov 2026 · 7 rows". */
  meta: string;
  asOf: string;
  period: string | null;
  sources: { raw: string; label: string }[];
  definitions: { term: string; text: string }[];
  notes: string[];
  rows: readonly EvidenceRow[];
  columns: EvidenceColumn[];
  businessDate: string;
  /** Column keys the card's title already speaks for (the hotel the call was about). */
  stated: string[];
  sql: string;
  params: string | null;
}

/** Server prose for people: internal column names and ISO dates become words. */
const prose = (text: string) => humanizeText(proseKeys(text));
const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Scrolls the nearest scrolling ancestor, and only that one, so the card sits at its top. `scrollIntoView` would
 * also move every clipped ancestor (a sheet's header would slide out of its dialog).
 */
function bringToTop(card: HTMLElement): void {
  let scroller = card.parentElement;
  while (scroller && !(/(auto|scroll)/.test(getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight)) scroller = scroller.parentElement;
  if (!scroller) return;
  const top = card.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12;
  if (typeof scroller.scrollTo === 'function') scroller.scrollTo({ top: Math.max(0, top), behavior: reducedMotion() ? 'auto' : 'smooth' });
  else scroller.scrollTop = Math.max(0, top);
}

/**
 * "Behind the numbers", from the evidence every data tool returns. It leads with the numbers the answer
 * quotes, each one a button that opens the row it came from. Below, one card per result that fed the answer, the
 * one that backs the most of its numbers first and open: a human title, the period and the business date in
 * words, the sources by name, the definitions, and a table that starts with the rows and columns the answer
 * quotes. What Kassandra only looked up on the way (the hotel list, data freshness) waits in one closed
 * "Lookups" row at the end. Raw source names, the SQL and its parameters stay inside "Technical details".
 * Facts only, never the model's reasoning.
 */
@Component({
  selector: 'juyo-evidence-panel',
  imports: [NgIcon, NgTemplateOutlet, DataTable],
  providers: [provideIcons({ phosphorCaretDownLight, phosphorCaretRightLight, phosphorWarningCircleLight })],
  // A compact region wherever it is shown: its tables and figures are scanned and compared (docs/research/layout).
  host: { class: '@container block min-w-0', 'data-density': 'compact' },
  styles: `
    .ev-card {
      border-radius: var(--radius-container, 14px);
      border: 1px solid var(--border);
      background: var(--card);
      transition:
        border-color 175ms ease,
        box-shadow 175ms ease;
    }
    .ev-card.is-focus {
      border-color: var(--focus-brand);
      box-shadow: 0 0 0 1px var(--focus-brand);
    }
    .ev-head {
      display: flex;
      width: 100%;
      align-items: center;
      gap: var(--space-stack);
      padding: calc(var(--space-card-pad) - 4px) calc(var(--space-card-pad) - 4px) calc(var(--space-card-pad) - 4px) var(--space-card-pad);
      border-radius: var(--radius-container, 14px);
      text-align: left;
      outline: none;
      cursor: pointer;
    }
    .ev-head:focus-visible {
      box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--ring);
    }
    .ev-lookups {
      border-radius: var(--radius-container, 14px);
      border: 1px dashed var(--input);
    }
    .ev-lookups .ev-card {
      background: transparent;
    }
    .ev-caret {
      flex: none;
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: var(--radius-control, 8px);
      color: var(--muted-foreground);
      transition:
        background-color 130ms ease,
        color 130ms ease,
        transform 200ms cubic-bezier(0.2, 0, 0, 1);
    }
    .ev-head[aria-expanded='true'] .ev-caret {
      transform: rotate(180deg);
    }
    @media (hover: hover) {
      .ev-card:not(.is-focus):hover {
        border-color: var(--input);
      }
      .ev-head:hover .ev-caret {
        background: var(--overlay-hover);
        color: var(--foreground);
      }
    }
    .ev-figure {
      display: flex;
      width: 100%;
      min-height: 100%;
      flex-direction: column;
      gap: 1px;
      padding: calc(var(--space-card-pad) - 4px) var(--space-card-pad);
      border-radius: var(--radius-container, 12px);
      border: 1px solid var(--border);
      background: var(--card);
      text-align: left;
      outline: none;
      cursor: pointer;
      transition:
        border-color 175ms ease,
        background-color 175ms ease;
    }
    .ev-figure:focus-visible {
      box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--ring);
    }
    @media (hover: hover) {
      .ev-figure:hover {
        border-color: color-mix(in srgb, var(--brand) 55%, transparent);
      }
    }
    .ev-figure:active {
      background: color-mix(in srgb, var(--foreground) 4%, var(--card));
    }
    .ev-chip {
      display: inline-flex;
      align-items: center;
      border-radius: var(--radius-control, 6px);
      background: color-mix(in srgb, var(--foreground) 8%, transparent);
      padding: 2px 8px;
      font-size: 12px;
      line-height: 18px;
    }
    details > summary {
      list-style: none;
    }
    details > summary::-webkit-details-marker {
      display: none;
    }
    details[open] > summary ng-icon {
      transform: rotate(90deg);
    }
    @media (prefers-reduced-motion: reduce) {
      .ev-card,
      .ev-caret,
      .ev-figure {
        transition: none;
      }
    }
  `,
  template: `
    <ng-template #card let-c let-level="level">
      @let open = isOpen(c.callId);
      <li class="ev-card" [class.is-focus]="c.callId === focused()" [id]="'ev-' + c.callId" [attr.data-call]="c.callId">
        <div role="heading" [attr.aria-level]="level">
          <button type="button" class="ev-head" [attr.aria-expanded]="open" [attr.aria-controls]="uid + '-body-' + c.callId" (click)="toggle(c.callId)">
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[14px]/5 font-medium">{{ c.title }}</span>
              <span class="text-muted-foreground block truncate text-[12.5px]/[18px]">{{ c.meta }}</span>
            </span>
            <span class="ev-caret" aria-hidden="true"><ng-icon name="phosphorCaretDownLight" class="text-[15px]" /></span>
          </button>
        </div>
        @if (open) {
          <div class="flex flex-col gap-stack px-card-pad pb-card-pad" [id]="uid + '-body-' + c.callId">
            <p class="text-muted-foreground text-[12.5px]/[18px]">{{ c.asOf }}</p>

            <juyo-data-table
              [rows]="c.rows"
              [columns]="c.columns"
              [caption]="c.title"
              [businessDate]="c.businessDate"
              [quotedRows]="c.quotedRows"
              [prefer]="preferFor(c)"
              [stated]="c.stated"
              [allRows]="c.callId === focused() && focusColumns().length > 0"
              [highlight]="highlightFor(c.callId)"
            />

            @if (c.period || c.sources.length || c.definitions.length) {
              <dl class="grid grid-cols-1 text-[12.5px]/[18px] @[26rem]:grid-cols-[minmax(0,auto)_minmax(0,1fr)] @[26rem]:gap-x-4 @[26rem]:gap-y-2 [&>dd]:mb-2 @[26rem]:[&>dd]:mb-0 [&>dd:last-child]:mb-0 [&>dt]:max-w-[12rem]">
                @if (c.period) {
                  <dt class="text-muted-foreground">Period</dt>
                  <dd>{{ c.period }}</dd>
                }
                @if (c.sources.length) {
                  <dt class="text-muted-foreground pt-0.5">Sources</dt>
                  <dd class="flex flex-wrap gap-1">
                    @for (s of c.sources; track s.raw) {
                      <span class="ev-chip">{{ s.label }}</span>
                    }
                  </dd>
                }
                @for (d of c.definitions; track d.term) {
                  <dt class="text-muted-foreground">{{ d.term }}</dt>
                  <dd>{{ d.text }}</dd>
                }
              </dl>
            }

            @if (c.notes.length) {
              <ul class="text-muted-foreground flex flex-col gap-1 text-[12.5px]/[18px]">
                @for (n of c.notes; track $index) {
                  <li>{{ n }}</li>
                }
              </ul>
            }

            <details class="text-[12.5px]">
              <summary class="text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1 rounded-[4px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--ring)">
                <ng-icon name="phosphorCaretRightLight" class="text-[12px] transition-transform motion-reduce:transition-none" aria-hidden="true" />
                Technical details
              </summary>
              <div class="mt-2.5 flex flex-col gap-2.5">
                @if (c.sources.length) {
                  <div>
                    <p class="text-muted-foreground mb-1">Read from</p>
                    <p class="flex flex-wrap gap-1">
                      @for (s of c.sources; track s.raw) {
                        <code class="ev-chip font-mono text-[11.5px]">{{ s.raw }}</code>
                      }
                    </p>
                  </div>
                }
                <div>
                  <p class="text-muted-foreground mb-1">Query</p>
                  <pre class="latest-panel max-h-56 overflow-auto rounded-[8px] p-3 font-mono text-[11.5px]/relaxed whitespace-pre" tabindex="0" role="region" [attr.aria-label]="'SQL for ' + c.title">{{ c.sql }}</pre>
                </div>
                @if (c.params) {
                  <div>
                    <p class="text-muted-foreground mb-1">Parameters</p>
                    <p class="font-mono text-[11.5px] break-all">{{ c.params }}</p>
                  </div>
                }
              </div>
            </details>
          </div>
        }
      </li>
    </ng-template>

    @if (!cards().length && !waiting().length && !failed().length) {
      <p class="text-muted-foreground text-[13px]">{{ entries().length ? 'This answer read no data, so there is nothing to trace.' : empty() }}</p>
    } @else {
      @if (figures().length) {
        <section class="mb-section" [attr.aria-labelledby]="uid + '-figures'">
          <h3 class="card-eyebrow" [id]="uid + '-figures'">Numbers in this answer</h3>
          <ul class="mt-stack grid grid-cols-1 gap-card-gap @[20rem]:grid-cols-2">
            @for (f of figures(); track f.callId + f.rowIndex + f.key) {
              <li class="min-w-0">
                <button type="button" class="ev-figure" (click)="showFigure(f)">
                  <span class="text-[20px]/7 font-semibold tracking-[-0.01em] tabular-nums">{{ f.value }}</span>
                  <span class="text-[12.5px]/[18px]">{{ f.label }}</span>
                  <span class="text-muted-foreground truncate text-[12px]/[18px]">{{ f.context || f.source }}</span>
                  <span class="sr-only">Show this figure in {{ f.source }}</span>
                </button>
              </li>
            }
          </ul>
          <p class="text-muted-foreground mt-2 text-[12px]">
            Select a figure to see it in its table.
          </p>
        </section>
      }

      <section [attr.aria-labelledby]="uid + '-data'">
        <h3 class="card-eyebrow" [id]="uid + '-data'">Data behind this answer</h3>
        @if (arranged().answer.length || waiting().length || failed().length) {
          <ol class="mt-stack flex flex-col gap-card-gap">
            @for (c of arranged().answer; track c.callId) {
              <ng-container [ngTemplateOutlet]="card" [ngTemplateOutletContext]="{ $implicit: c, level: 4 }" />
            }
            @for (w of waiting(); track w.callId) {
              <li class="ev-card flex items-center gap-3 px-card-pad py-3" role="status">
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[14px]/5 font-medium">{{ w.title }}</span>
                  <span class="text-muted-foreground block text-[12.5px]/[18px]">Reading the data…</span>
                </span>
                <span class="bg-muted skeleton-wave h-2 w-16 rounded-full" aria-hidden="true"></span>
              </li>
            }
            @for (x of failed(); track x.callId) {
              <li class="ev-card flex items-center gap-3 px-card-pad py-3">
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[14px]/5 font-medium">{{ x.title }}</span>
                  <span class="text-muted-foreground block text-[12.5px]/[18px]">Couldn’t read this, so the answer doesn’t use it. Ask again to retry.</span>
                </span>
                <ng-icon name="phosphorWarningCircleLight" class="text-muted-foreground text-[18px]" aria-hidden="true" />
              </li>
            }
          </ol>
        }
        @if (arranged().lookups.length) {
          <div class="ev-lookups mt-card-gap" data-lookups>
            <h4>
              <button type="button" class="ev-head" [attr.aria-expanded]="lookupsOpen()" [attr.aria-controls]="uid + '-lookups'" (click)="lookupsOpen.set(!lookupsOpen())">
                <span class="min-w-0 flex-1">
                  <span class="block text-[13.5px]/5 font-medium">Lookups</span>
                  <span class="text-muted-foreground block text-[12.5px]/[18px]">{{ lookupText() }}</span>
                </span>
                <span class="ev-caret" aria-hidden="true"><ng-icon name="phosphorCaretDownLight" class="text-[15px]" /></span>
              </button>
            </h4>
            @if (lookupsOpen()) {
              <ol class="flex flex-col gap-2 px-2 pb-2" [id]="uid + '-lookups'">
                @for (c of arranged().lookups; track c.callId) {
                  <ng-container [ngTemplateOutlet]="card" [ngTemplateOutletContext]="{ $implicit: c, level: 5 }" />
                }
              </ol>
            }
          </div>
        }
      </section>
    }
  `,
})
export class EvidencePanel {
  /** The tool calls of one answer: `ChatStep[]`, or the `tool_result` entries of a transcript. */
  readonly entries = input.required<readonly EvidenceEntry[]>();
  /** The final answer (Markdown). Its numbers are matched to rows, and only those are listed as figures. */
  readonly answer = input<string | null | undefined>(null);
  /** A tool call to open and bring into view ("Behind the numbers" on one step or one chart). */
  readonly focusCallId = input<string | null>(null);
  /** The columns the chart that was asked about draws from that call: they stay on screen, with every row. */
  readonly focusColumns = input<readonly string[]>([]);
  readonly empty = input('Each number in the answer shows its source, period and definition here.');

  private static count = 0;
  protected readonly uid = `ev${++EvidencePanel.count}`;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly hotels = inject(HotelDirectory);

  /** Cards the person opened or closed themselves; the rest follow `openByDefault`. */
  private readonly toggled = signal<ReadonlyMap<string, boolean>>(new Map());
  protected readonly lookupsOpen = signal(false);
  protected readonly focused = signal<string | null>(null);
  private readonly highlight = signal<{ callId: string; rowIndex: number; key: string } | null>(null);
  private readonly scrollTo = signal<{ callId: string } | null>(null);

  private readonly withEvidence = computed(() => this.entries().filter((entry): entry is EvidenceEntry & { evidence: RichEvidence } => !!entry.evidence));
  /** A finished answer is being explained; false for a run in progress and for a log with no answer. */
  private readonly settled = computed(() => !!this.answer()?.trim());

  /** One card per result, in the order the calls were made. */
  protected readonly cards = computed<Card[]>(() =>
    this.withEvidence().map((entry) => {
      const evidence = entry.evidence;
      const rows = entry.rows ?? [];
      const period = evidence.period ? formatPeriod(evidence.period) : null;
      const count = evidence.rowCount ?? rows.length;
      const scope = this.scopeOf(entry.args);
      const asOf = dataAsOf(evidence.businessDate, evidence.period);
      const columns = resolveColumns(rows, evidence.columns, this.hotels.has);
      return {
        callId: entry.callId,
        name: entry.name,
        title: toolTitle(entry.name, entry.args, evidence.title),
        meta: [scope, period, `${formatNumber(count, 0)} ${count === 1 ? 'row' : 'rows'}`].filter(Boolean).join(' · '),
        // A lookup table has no stays: only the day it was read.
        asOf: toolRole(entry.name) === 'reference' ? asOf.split(' · ')[0]! : asOf,
        period,
        sources: (evidence.sources ?? []).map((raw) => ({ raw, label: sourceLabel(raw, evidence.sourceLabels) })),
        definitions: Object.entries(evidence.definitions ?? {}).map(([term, text]) => ({ term: humanizeKey(term), text: prose(text) })),
        notes: (evidence.notes ?? []).map(prose),
        rows,
        columns,
        businessDate: evidence.businessDate,
        stated: scope ? columns.filter((column) => column.kind === 'hotel').map((column) => column.key) : [],
        sql: evidence.sql,
        params: evidence.params?.length ? JSON.stringify(evidence.params) : null,
      };
    }),
  );

  /** Data calls still in flight: the card is on its way. */
  protected readonly waiting = computed(() =>
    this.entries()
      .filter((entry) => !entry.evidence && !entry.error && entry.status !== undefined && entry.status !== 'done' && entry.status !== 'error' && isDataTool(entry.name))
      .map((entry) => ({ callId: entry.callId, title: toolTitle(entry.name, entry.args) })),
  );

  protected readonly failed = computed(() =>
    this.entries()
      .filter((entry) => !entry.evidence && (entry.status === 'error' || !!entry.error) && isDataTool(entry.name))
      .map((entry) => ({ callId: entry.callId, title: toolTitle(entry.name, entry.args) })),
  );

  private readonly context = computed<FormatContext>(() => ({ hotelName: this.hotels.name, baseYear: yearOf(this.withEvidence()[0]?.evidence.businessDate) }));
  /** The results a number may be traced to: never a lookup table. */
  private readonly tables = computed<FigureTable[]>(() => figureSources(this.cards()).map((card) => ({ callId: card.callId, title: card.title, rows: card.rows, columns: card.columns })));
  /** Every number of the answer that is a cell of some result. */
  private readonly traced = computed(() => quotedFigures(this.answer(), this.tables(), this.context(), FIGURES_TRACED));
  /** Only numbers the answer states: a figure it does not use (the first cell of some table) is not evidence of anything. */
  protected readonly figures = computed<Figure[]>(() => this.traced().slice(0, FIGURES_SHOWN));

  /** The cards that fed the answer, the one backing most of its numbers first, and the lookups. Each knows its quoted rows and columns. */
  protected readonly arranged = computed(() => {
    const traced = this.traced();
    // A lookup is the answer's data only when it is all a finished answer read. When a data read failed, the lookup
    // was on the way to it (the hotel list, to find the hotel's code): it stays a lookup.
    const arranged = arrangeCalls(this.cards(), backedCounts(traced), this.settled() && !this.failed().length);
    const withCells = (card: Card) => {
      const cells = backingCells(traced, card.callId);
      return { ...card, quotedRows: cells.rows, quotedKeys: cells.keys };
    };
    return { answer: arranged.answer.map(withCells), lookups: arranged.lookups.map(withCells) };
  });
  protected readonly lookupText = computed(() => lookupSummary(this.arranged().lookups));

  /**
   * Open without being asked: the cards whose rows the answer quotes; when it quotes none we can trace, the first
   * card. Nothing while there is no answer yet, and never a lookup.
   */
  private readonly openByDefault = computed<ReadonlySet<string>>(() => {
    const answer = this.arranged().answer;
    if (!this.settled() || !answer.length) return new Set();
    const backing = answer.filter((card) => card.quotedRows.length > 0);
    return new Set((backing.length ? backing : answer.slice(0, 1)).map((card) => card.callId));
  });

  constructor() {
    // The card that was asked for is revealed once: now, or when its result lands if it was still on its way. Not
    // again each time another result arrives, which would pull the panel back to it while the person reads on.
    let revealed: string | null = null;
    effect(() => {
      const callId = this.focusCallId();
      if (!callId) {
        revealed = null;
        this.focused.set(null);
        return;
      }
      if (callId === revealed || !this.cards().some((card) => card.callId === callId)) return;
      revealed = callId;
      untracked(() => this.reveal(callId));
    });
    afterRenderEffect(() => {
      const target = this.scrollTo();
      if (!target) return;
      const card = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('[data-call]')).find((element) => element.dataset['call'] === target.callId);
      if (card) bringToTop(card);
    });
  }

  /** Opens a tool call's card and brings it into view. A lookup's card opens the lookups with it. */
  reveal(callId: string): void {
    if (untracked(this.arranged).lookups.some((card) => card.callId === callId)) this.lookupsOpen.set(true);
    this.toggled.update((map) => new Map(map).set(callId, true));
    this.focused.set(callId);
    this.scrollTo.set({ callId });
  }

  protected isOpen(callId: string): boolean {
    return this.toggled().get(callId) ?? this.openByDefault().has(callId);
  }

  protected toggle(callId: string): void {
    const open = this.isOpen(callId);
    this.toggled.update((map) => new Map(map).set(callId, !open));
  }

  /** A figure from the lead: open its card and point at the cell. */
  protected showFigure(figure: Figure): void {
    this.highlight.set({ callId: figure.callId, rowIndex: figure.rowIndex, key: figure.key });
    this.reveal(figure.callId);
  }

  protected highlightFor(callId: string): { rowIndex: number; key: string } | null {
    const hit = this.highlight();
    return hit?.callId === callId ? hit : null;
  }

  /** The columns a card keeps on screen: what the chart asked about draws, then what the answer quotes. */
  protected preferFor(card: { callId: string; quotedKeys: string[] }): string[] {
    return card.callId === this.focused() ? [...new Set([...this.focusColumns(), ...card.quotedKeys])] : card.quotedKeys;
  }

  /** Who the call was about, from its arguments: one or two hotel names, or how many. */
  private scopeOf(args: Record<string, unknown> | undefined): string {
    const raw = args?.['hotels'] ?? args?.['hotel'];
    const codes = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter((code): code is string => typeof code === 'string');
    if (!codes.length) return '';
    const names = codes.map((code) => this.hotels.name(code) ?? code);
    if (names.length <= 2) return names.join(' and ');
    return `${names.length} hotels`;
  }
}
