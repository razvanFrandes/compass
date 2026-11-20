import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { KassandraComposer } from './kassandra/kassandra-composer';
import { PickupBars, Spark } from './brief-charts';
import { GROUP, NIGHTS, formatEur, utc } from './data';
import { AMS_CONVERSION, BCN_OUT_OF_ORDER, DPS_KITCHEN, LIS_PACE, NYC_ACCOUNT, PULSE } from './halcyon-data';
import { BriefRow, CompassStore, InboxItem, briefTitle, gopMonths, isoDay, shortHotel } from './store';
import { Live } from './live';
import { ProposalCard } from './proposal-card';
import { ScopeSwitcher } from './scope/scope-switcher';
import { ScopeService } from './scope/scope.service';
import * as icons from './icons';

function spark(values: number[], w = 120, h = 40) {
  return values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - v * (h - 4)).toFixed(1)}`).join('');
}
const month = (ym: string) => new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(utc(`${ym}-01`));

/*
  Home: the morning brief on real data (compass_hotels, Halcyon Hospitality Group, Fri 20 Nov 2026).
  Same order as the backend's brief: a broken data feed first, then by money. Quiet by design:
  one data hue (blue), grey for last year, orange only for the one decision, no money in red or green.
  Text is cut to a title and one fact per card; the reasoning lives in the thread ("Ask about this").
*/
@Component({
  selector: 'app-inbox',
  imports: [NgIcon, NgTemplateOutlet, KassandraComposer, PickupBars, Spark, ProposalCard, ScopeSwitcher, HlmButtonImports, HlmDropdownMenuImports],
  providers: [provideIcons({ ...icons })],
  host: { class: 'block' },
  template: `
    <div class="mx-auto grid max-w-[1240px] gap-x-8 gap-y-6 px-[max(16px,env(safe-area-inset-left,0px))] pt-5 pb-44 sm:px-8 lg:grid-cols-12 lg:pt-8 lg:pb-16">
      <!-- Hero brief -->
      <section class="relative lg:col-span-8" aria-labelledby="brief-title">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p class="text-muted-foreground text-[12px] font-medium tracking-[0.06em] uppercase">Fri 20 Nov · Morning brief</p>
          <!-- The hotel scope; on phones it sits in the top bar -->
          <app-scope-switcher class="max-lg:hidden" />
        </div>
        <h1 id="brief-title" class="mt-3 max-w-[30ch] text-[26px]/[1.2] font-semibold tracking-[-0.015em] text-balance sm:text-[30px]/[1.2]">{{ headline() }}</h1>
        <div class="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]">
          <span>{{ open().length }} {{ open().length === 1 ? 'finding' : 'findings' }} {{ scope.count() === 1 ? 'at' : 'across' }} {{ scope.phrase() }}, ranked by money</span>
          @if (decisionCount()) {
            <button type="button" class="stake-chip stake-chip--decision" (click)="focusDecision()">● {{ decisionCount() }} {{ decisionCount() === 1 ? 'needs' : 'need' }} your decision</button>
          }
        </div>
        <p class="text-muted-foreground mt-2 text-[12.5px]" role="status">
          @switch (live.briefState()) {
            @case ('live') {
              Live brief · generated {{ live.briefMeta()?.generated }}@if (live.briefMeta()?.model) {<span> · summaries by AI</span>}
              <button hlmBtn variant="ghost" size="sm" class="ml-1 h-7 px-2" title="Writes a new brief now (counts against today’s budget)" [disabled]="live.refreshing()" (click)="live.refreshBrief()">{{ live.refreshing() ? 'Refreshing…' : 'Refresh' }}</button>
            }
            @case ('loading') {
              Reading this morning’s brief…
            }
            @default {
              <span class="text-foreground">The live brief didn’t load{{ live.briefError() ? ' (' + live.briefError() + ')' : '' }}.</span> Showing the saved copy from Fri 20 Nov, 07:00.
              <button hlmBtn variant="outline" size="sm" class="ml-1 h-7" (click)="live.briefApi.brief.reload()">Retry</button>
            }
          }
        </p>
        <div class="mt-6 hidden lg:block">
          <kassandra-composer inputId="global-ask" [shortcut]="true" placeholder="Ask about any hotel, night or metric…" [(mode)]="live.mode" (submitted)="live.askNew($event)" />
        </div>
      </section>

      <!-- Pulse: the portfolio's next 30 nights against the same time last year -->
      <aside class="max-lg:order-3 lg:col-span-4 lg:row-span-2" aria-labelledby="pulse-title">
        <div class="lg:sticky lg:top-6">
          <h2 id="pulse-title" class="text-muted-foreground mb-2 text-[12px] font-medium tracking-[0.06em] uppercase">Portfolio · next 30 nights</h2>
          <ul class="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-2">
            @for (m of pulse; track m.key) {
              <li>
                <button type="button" class="clickable-card grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 p-3 text-left sm:flex sm:flex-col sm:items-stretch sm:gap-1 sm:p-3.5" (click)="live.askAbout('What drove the portfolio’s ' + m.label.toLowerCase() + ' for the next 30 nights?')">
                  <span class="text-muted-foreground col-span-2 text-[12px]">{{ m.label }}</span>
                  <span class="text-[20px]/tight font-semibold tracking-[-0.02em] tabular-nums sm:text-[24px]/tight">{{ m.value }}</span>
                  <svg viewBox="0 0 120 40" preserveAspectRatio="none" class="row-span-2 h-8 w-14 sm:order-last sm:mt-1 sm:h-10 sm:w-full" aria-hidden="true">
                    <path [attr.d]="m.ly" fill="none" class="stroke-(--series-muted)" stroke-width="1.25" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" />
                    <path [attr.d]="m.ty" fill="none" class="stroke-(--series)" stroke-width="1.75" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
                  </svg>
                  <span class="text-muted-foreground text-[12px] tabular-nums">{{ m.arrow }} {{ m.deltaText }}</span>
                  <span class="text-muted-foreground col-span-2 flex items-center gap-1 text-[12px] group-hover:text-foreground"><span class="sr-only">versus last year.</span>Ask why <span aria-hidden="true">→</span></span>
                </button>
              </li>
            }
          </ul>
          <p class="text-muted-foreground mt-2.5 text-[12px]">On the books vs last year · <button type="button" class="hover:text-foreground underline underline-offset-2" (click)="store.openBoard('portfolio')">Open the portfolio →</button></p>
        </div>
      </aside>

      <!-- The brief -->
      <section class="grid min-w-0 gap-4 max-lg:order-2 sm:grid-cols-2 lg:col-span-8" aria-label="Morning brief">
        @if (feed(); as f) {
          <div class="feed-banner sm:col-span-2" role="status">
            <i class="feed-dot" aria-hidden="true"></i>
            <p class="min-w-0 flex-1 text-[14px]">
              @if (f.item.summary) {
                <span>{{ f.item.summary }}</span> <span class="ai-tag">AI</span>
              } @else {
                <span class="font-medium">{{ f.item.title }}.</span>
              }
            </p>
            <button hlmBtn variant="ghost" size="sm" (click)="explore(f.item)">Explore</button>
          </div>
        }

        @if (lead(); as c) {
          <article class="insight-card relative grid gap-5 p-5 sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <div class="flex min-w-0 flex-col">
              <div class="flex items-start justify-between gap-3">
                <h3 class="text-[17px]/[1.35] font-semibold tracking-[-0.01em]">
                  <button type="button" class="text-left after:absolute after:inset-0 after:rounded-[inherit] after:content-['']" (click)="explore(c.item)">{{ c.item.title }}</button>
                </h3>
                <span class="money-chip shrink-0">{{ c.item.impact }}</span>
              </div>
              <p class="text-muted-foreground mt-2 text-[14px]">{{ c.item.summary ?? c.fact }}@if (c.item.summary) {<span class="ai-tag ml-1.5">AI</span>}</p>
              <div class="relative z-10 mt-auto flex items-center gap-2 pt-4">
                <button hlmBtn variant="secondary" size="sm" (click)="explore(c.item)">Explore</button>
                <ng-container *ngTemplateOutlet="more; context: { $implicit: c.item }" />
              </div>
            </div>
            <app-pickup-bars class="self-end" [bars]="c.bars" [highlight]="[]" [startLabel]="c.start" [endLabel]="c.end" [caption]="c.caption" [height]="112" />
          </article>
        }

        <!-- Decisions: proposals from the workflows, waiting on a person (WorkflowsApi, polled) -->
        @for (p of live.pendingList(); track p.id; let first = $first) {
          <app-proposal-card [id]="first ? 'decision-card' : null" tabindex="-1" class="outline-none" [proposal]="p" />
        }

        @if (third(); as c) {
          <article class="insight-card relative flex flex-col p-5" [class]="live.pendingList().length ? '' : 'sm:col-span-2'">
            <div class="flex items-start justify-between gap-3">
              <h3 class="text-[17px]/[1.35] font-semibold tracking-[-0.01em]">
                <button type="button" class="text-left after:absolute after:inset-0 after:rounded-[inherit] after:content-['']" (click)="explore(c.item)">{{ c.item.title }}</button>
              </h3>
              <span class="money-chip shrink-0">{{ c.item.impact }}</span>
            </div>
            @if (c.line.length) {
              <app-spark class="mt-6 block h-24" [values]="c.line" [compare]="c.compare" />
              <div class="text-muted-foreground mt-1.5 flex justify-between text-[11.5px]"><span>{{ c.start }}</span><span>{{ c.caption }}</span><span>{{ c.end }}</span></div>
            } @else {
              <app-pickup-bars class="mt-7" [bars]="c.bars" [highlight]="c.highlight" [bandLabel]="c.band" [startLabel]="c.start" [endLabel]="c.end" [caption]="c.caption" [height]="96" />
            }
            <p class="text-muted-foreground mt-4 text-[13.5px]">{{ c.item.summary ?? c.fact }}@if (c.item.summary) {<span class="ai-tag ml-1.5">AI</span>}</p>
            <div class="relative z-10 mt-auto flex items-center gap-2 pt-4">
              <button hlmBtn variant="secondary" size="sm" (click)="explore(c.item)">Explore</button>
              <ng-container *ngTemplateOutlet="more; context: { $implicit: c.item }" />
            </div>
          </article>
        }

        <!-- The rest of the brief: compact tiles, one line and a trend each -->
        @if (rest().length) {
          <h2 class="text-muted-foreground mt-2 text-[12px] font-medium tracking-[0.06em] uppercase sm:col-span-2">Also in today’s brief</h2>
          <ul class="grid gap-3 sm:col-span-2 sm:grid-cols-2">
            @for (t of rest(); track t.item.id) {
              <li class="min-w-0">
                <button type="button" class="clickable-card brief-tile h-full w-full text-left" (click)="explore(t.item)">
                  <span class="flex items-center justify-between gap-2">
                    <span class="text-muted-foreground truncate text-[12px]">{{ t.hotel }}</span>
                    <span class="text-[12.5px] font-semibold tabular-nums">{{ t.item.impact }}</span>
                  </span>
                  <span class="text-[14px]/snug font-medium">{{ t.label }}</span>
                  @if (t.values.length) {
                    <app-spark class="mt-auto h-8 pt-1" [values]="t.values" [compare]="t.compare" />
                  }
                </button>
              </li>
            }
          </ul>
        }

        @if (live.briefState() === 'loading') {
          <div class="sm:col-span-2 grid gap-4 sm:grid-cols-2" aria-hidden="true">
            <div class="skeleton h-[220px] rounded-[14px] sm:col-span-2"></div>
            <div class="skeleton h-[200px] rounded-[14px]"></div>
            <div class="skeleton h-[200px] rounded-[14px]"></div>
          </div>
        }
        @if (live.briefState() !== 'loading' && !lead() && !live.pendingList().length && !third() && !rest().length && !feed()) {
          <div class="insight-card text-muted-foreground flex items-center gap-2 p-6 text-[14px] sm:col-span-2"><ng-icon name="phosphorCheckLight" />You’re up to date. New findings land here every morning.</div>
        }

        <!-- Resolved -->
        @if (store.earlier().length) {
          <div class="border-border rounded-[12px] border sm:col-span-2">
            <button type="button" class="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 px-4 py-3 text-left text-[13.5px]" [attr.aria-expanded]="showResolved()" (click)="showResolved.set(!showResolved())">
              <ng-icon name="phosphorCheckLight" />{{ store.earlier().length }} resolved today
              <span class="ml-auto inline-flex items-center gap-1">{{ showResolved() ? 'Hide' : 'Show' }}<ng-icon name="phosphorCaretDownLight" class="transition-transform" [class.rotate-180]="showResolved()" /></span>
            </button>
            @if (showResolved()) {
              <ul class="border-border divide-border gen-in divide-y border-t">
                @for (r of store.earlier(); track r.id) {
                  <li class="flex items-start gap-3 px-4 py-3">
                    <span class="min-w-0 flex-1">
                      <span class="block text-[13.5px]">{{ r.title }}</span>
                      <span class="text-muted-foreground block text-[12.5px]">{{ r.resolution }}</span>
                    </span>
                    <button hlmBtn variant="ghost" size="sm" (click)="undo(r)">Undo</button>
                  </li>
                }
              </ul>
            }
          </div>
        }
      </section>
    </div>

    <!-- Phones and tablets: the ask bar docks above the tab bar -->
    <div class="dock-fade fixed inset-x-0 bottom-[calc(57px+env(safe-area-inset-bottom,0px))] z-20 px-3 pt-6 pb-2 lg:hidden">
      <kassandra-composer inputId="global-ask-m" placeholder="Ask about any hotel" [showMode]="false" [showScope]="false" (submitted)="live.askNew($event)" />
    </div>

    <ng-template #more let-item>
      <button hlmBtn variant="ghost" size="icon-sm" class="text-muted-foreground ml-auto" [attr.aria-label]="'More for ' + item.title" [hlmDropdownMenuTrigger]="moreMenu" [hlmDropdownMenuTriggerData]="{ $implicit: item }" align="end">
        <ng-icon name="phosphorDotsThreeBold" class="text-[18px]" />
      </button>
    </ng-template>
    <ng-template #moreMenu let-item>
      <hlm-dropdown-menu class="w-52">
        <button hlmDropdownMenuItem (triggered)="store.snoozeItem(item.id)"><ng-icon name="phosphorClockLight" />Snooze until tomorrow</button>
        <button hlmDropdownMenuItem (triggered)="store.dismissItem(item.id)"><ng-icon name="phosphorThumbsDownLight" />Not useful</button>
      </hlm-dropdown-menu>
    </ng-template>
  `,
})
export class InboxView {
  protected readonly store = inject(CompassStore);
  protected readonly live = inject(Live);
  protected readonly scope = inject(ScopeService);
  protected readonly group = GROUP;
  protected readonly showResolved = signal(false);

  /** The brief's rows (live, or the snapshot when the API is down), by id. */
  private readonly rows = computed(() => new Map(this.store.briefRows().map((r) => [r.id, r])));
  private readonly kindOf = (i: InboxItem) => this.rows().get(i.id)?.kind ?? '';
  protected readonly open = computed(() => this.store.needsYou());

  /** One sentence for the top of the page, from the first two items of the ranked brief. */
  protected readonly headline = computed(() => {
    const [a, b] = this.store.briefRows();
    if (!a) return this.live.briefState() === 'loading' ? 'This morning’s brief' : 'Nothing needs you this morning.';
    const first = a.kind === 'data_stale' ? `${shortHotel(a.hotel_name)}’s ${a.facts['system']} feed is down` : `${shortHotel(a.hotel_name)} needs attention`;
    const second = b?.kind === 'account_loss' ? `${shortHotel(b.hotel_name)} has lost its biggest corporate account` : b ? `${shortHotel(b.hotel_name)} needs attention` : '';
    return second ? `${first}, and ${second}.` : `${first}.`;
  });

  protected readonly feed = computed(() => {
    const item = this.open().find((i) => this.kindOf(i) === 'data_stale');
    return item ? { item } : null;
  });
  private readonly money = computed(() => this.open().filter((i) => this.kindOf(i) !== 'data_stale'));

  protected readonly lead = computed(() => {
    const item = this.money()[0];
    if (!item) return null;
    return { item, ...this.evidence(this.rows().get(item.id)!) };
  });
  protected readonly third = computed(() => {
    const item = this.money()[1];
    if (!item) return null;
    return { item, ...this.evidence(this.rows().get(item.id)!) };
  });
  protected readonly rest = computed(() =>
    this.money()
      .slice(2)
      .map((item) => ({ item, ...this.tile(this.rows().get(item.id)!) })),
  );
  protected readonly decisionCount = computed(() => this.live.pendingList().length);

  /** "Explore": the item's thread opens and its question is sent; a second click reopens the same thread. */
  protected explore(item: InboxItem) {
    this.store.markSeen(item.id);
    const row = this.rows().get(item.id);
    if (row) this.live.exploreRow({ ...row, question: item.question });
    else this.live.explore(item.question, undefined, `brief:${item.id}`);
  }

  /** Chart and one fact for a full card. */
  private evidence(r: BriefRow) {
    switch (r.kind) {
      case 'account_loss': {
        const m = NYC_ACCOUNT as readonly { month: string; nights: number }[];
        return {
          line: [] as number[],
          compare: null as number[] | null,
          bars: m.map((x) => x.nights),
          highlight: [] as number[],
          band: '',
          start: `${month(m[0].month)} 2025`,
          end: month(m[m.length - 1].month),
          caption: `${r.facts['account']} · room nights a month`,
          fact: `${Number(r.facts['room_nights_previous_6m']).toLocaleString('en-GB')} room nights in the six months before, ${r.facts['room_nights_last_6m']} since.`,
        };
      }
      case 'rooms_out_of_order': {
        const w = BCN_OUT_OF_ORDER as readonly { week: string; rooms_out: number }[];
        return {
          line: [] as number[],
          compare: null as number[] | null,
          bars: w.map((x) => x.rooms_out),
          highlight: w.map((x, i) => (x.rooms_out >= 10 ? i : -1)).filter((i) => i >= 0),
          band: 'Renovation',
          start: isoDay(w[0].week).slice(4),
          end: isoDay(w[w.length - 1].week).slice(4),
          caption: 'rooms out of order, weekly',
          fact: `${Number(r.facts['out_of_order_nights']).toLocaleString('en-GB')} room nights it can’t sell in the next 30 days.`,
        };
      }
      case 'gop_miss': {
        const g = gopMonths(r.hotel_code);
        return {
          line: g.map((x) => x.gop),
          compare: g.map((x) => x.gop_budget),
          bars: [] as number[],
          highlight: [] as number[],
          band: '',
          start: g.length ? `${month(g[0].month)} 2025` : '',
          end: g.length ? month(g[g.length - 1].month) : '',
          caption: 'GOP per month · budget dashed',
          fact: `${r.facts['gop_margin_pct']}% GOP margin against ${r.facts['gop_margin_budget_pct']}% budgeted; revenue ${Math.abs(Number(r.facts['revenue_var_pct']))}% under.`,
        };
      }
      case 'underpriced_demand': {
        const n = NIGHTS.forward.filter((x) => x.date >= utc('2026-12-09') && x.date <= utc('2026-12-23'));
        return {
          line: n.map((x) => x.barLocal),
          compare: n.map((x) => x.compLocal ?? x.barLocal),
          bars: [] as number[],
          highlight: [] as number[],
          band: '',
          start: '9 Dec',
          end: '23 Dec',
          caption: 'BAR · comp-set median dashed',
          fact: r.impact_basis,
        };
      }
      default:
        return { line: [] as number[], compare: null as number[] | null, bars: [] as number[], highlight: [] as number[], band: '', start: '', end: '', caption: '', fact: r.impact_basis };
    }
  }

  /** A short label and a trend for a compact tile. */
  private tile(r: BriefRow) {
    const hotel = shortHotel(r.hotel_name);
    switch (r.kind) {
      case 'web_conversion_drop': {
        const w = AMS_CONVERSION as readonly { mobile: number; desktop: number }[];
        return { hotel, label: `Mobile conversion ${r.facts['conversion_pct_previous_60d']}% → ${r.facts['conversion_pct_last_30d']}%`, values: w.map((x) => x.mobile), compare: null };
      }
      case 'staffing_gap': {
        const w = DPS_KITCHEN as readonly { pct: number }[];
        return { hotel, label: `Kitchen at ${Math.round(Number(r.facts['staffing_pct']))}% of the hours needed`, values: w.map((x) => x.pct), compare: null };
      }
      case 'pace_behind': {
        const n = LIS_PACE as readonly { rooms: number; rooms_stly: number }[];
        return { hotel, label: `${Math.abs(Number(r.facts['pace_pct']))}% behind last year, next 45 nights`, values: n.map((x) => x.rooms), compare: n.map((x) => x.rooms_stly) };
      }
      case 'rooms_out_of_order': {
        const w = BCN_OUT_OF_ORDER as readonly { rooms_out: number }[];
        return { hotel, label: `${Math.round(Number(r.facts['avg_rooms_out']))} rooms out of order`, values: w.map((x) => x.rooms_out), compare: null };
      }
      case 'account_loss': {
        const m = NYC_ACCOUNT as readonly { nights: number }[];
        return { hotel, label: `Lost most of ${r.facts['account']}`, values: m.map((x) => x.nights), compare: null };
      }
      case 'gop_miss': {
        const g = gopMonths(r.hotel_code);
        return { hotel, label: `GOP ${Math.abs(Number(r.facts['gop_var_pct']))}% under budget in ${month(String(r.facts['month']))}`, values: g.map((x) => x.gop), compare: g.map((x) => x.gop_budget) };
      }
      default:
        return { hotel, label: briefTitle(r), values: [] as number[], compare: null };
    }
  }

  /** Portfolio Pulse: the 30 nights after today, all 20 hotels, in EUR. */
  protected readonly pulse = (() => {
    const p = (PULSE as readonly { rooms: number; rooms_stly: number; avail: number; rev: number; rev_stly: number }[]).slice(1);
    const sum = (f: (x: (typeof p)[number]) => number) => p.reduce((s, x) => s + f(x), 0);
    const rooms = sum((x) => x.rooms);
    const roomsLy = sum((x) => x.rooms_stly);
    const avail = sum((x) => x.avail);
    const rev = sum((x) => x.rev);
    const revLy = sum((x) => x.rev_stly);
    const series = {
      occupancy: [p.map((x) => (x.rooms / x.avail) * 100), p.map((x) => (x.rooms_stly / x.avail) * 100)],
      adr: [p.map((x) => x.rev / x.rooms), p.map((x) => x.rev_stly / x.rooms_stly)],
      revpar: [p.map((x) => x.rev / x.avail), p.map((x) => x.rev_stly / x.avail)],
      revenue: [p.map((x) => x.rev), p.map((x) => x.rev_stly)],
    };
    const tiles = [
      { key: 'occupancy', label: 'Occupancy', value: `${((rooms / avail) * 100).toFixed(1)}%`, delta: ((rooms - roomsLy) / avail) * 100, unit: ' pp' },
      { key: 'adr', label: 'ADR', value: formatEur(rev / rooms), delta: ((rev / rooms) / (revLy / roomsLy) - 1) * 100, unit: '%' },
      { key: 'revpar', label: 'RevPAR', value: formatEur(rev / avail), delta: (rev / revLy - 1) * 100, unit: '%' },
      { key: 'revenue', label: 'Room revenue', value: `€${(rev / 1e6).toFixed(1)}M`, delta: (rev / revLy - 1) * 100, unit: '%' },
    ] as const;
    return tiles.map((t) => {
      const [ty, ly] = series[t.key];
      const all = [...ty, ...ly];
      const min = Math.min(...all);
      const max = Math.max(...all);
      const norm = (v: number[]) => spark(v.map((x) => (x - min) / (max - min || 1)));
      const flat = Math.abs(t.delta) < 0.05;
      return { ...t, arrow: flat ? '' : t.delta > 0 ? '▲' : '▼', deltaText: flat ? `±0.0${t.unit}` : `${t.delta > 0 ? '+' : '−'}${Math.abs(t.delta).toFixed(1)}${t.unit}`, ty: norm(ty), ly: norm(ly) };
    });
  })();

  protected focusDecision() {
    const el = document.getElementById('decision-card');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.focus({ preventScroll: true });
  }

  protected undo(r: InboxItem) {
    this.store.restoreItem(r.id);
  }
}
