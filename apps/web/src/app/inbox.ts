import { Component, DestroyRef, ViewEncapsulation, computed, effect, inject, linkedSignal, signal, untracked } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import type { BriefFeed } from '@compass/contracts';
import type { WorkflowDetail } from './api';
import { AgentsOvernight } from './brief/agents-overnight';
import {
  type FindingFilter,
  agentRows,
  agentsSummary,
  eurShort,
  headline,
  hotelMentions,
  matchesFilter,
  moneyAtStake,
  moneyMovers,
  moneyOnTheBooks,
  pickupByDay,
  pickupByHotel,
  placeholderSpec,
  stakes,
  watchPrompt,
} from './brief/brief-model';
import { BriefOverviewApi } from './brief/brief-overview-api';
import { BriefSection } from './brief/brief-section';
import { DataHealth } from './brief/data-health';
import { CHART_H, FindingCard, type FindingView } from './brief/finding-card';
import { NIGHTS_OPEN_WITH, NightsCalendar } from './brief/nights-calendar';
import { PulseRail } from './brief/pulse-rail';
import { WidgetChart } from './charts/widget-chart';
import { BUSINESS_DAY } from './data';
import * as icons from './icons';
import { KassandraComposer } from './kassandra/kassandra-composer';
import { Live, ago } from './live';
import { ProposalCard } from './proposal-card';
import { plainText } from './proposal-text';
import { ScopeSwitcher } from './scope/scope-switcher';
import { ScopeService } from './scope/scope.service';
import { BriefRow, CompassStore, PORTFOLIO_BOARD, shortHotel } from './store';

const dayLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
type Seg<T extends string> = readonly { key: T; label: string }[];
/** How many findings sit above the fold, one row of cards. */
const TOP_FINDINGS = 3;

/*
  Home: the morning brief for the hotels in scope, laid out as docs/research/layout/layout-and-density.md asks:
  airy by having little chrome, not by having little data.

  Above the fold: what needs the reader and the money in it, the scope's numbers (Pulse, four tiles), and the top
  three findings, each with one chart. Below, as labelled sections with "View all": the decisions that wait on a
  person, what the agents did overnight, the next 14 nights, the last 7 days of pickup, where the revenue is, and
  the data feeds behind it all. Detail is at most one step away (a thread, a board, Agent Studio).

  Two reads feed it: the brief itself (GET /api/brief: SQL detectors, with the model's sentence per finding) and
  the overview (GET /api/brief/overview?hotels=: every other number, computed in SQL for the scope). Each part
  has a skeleton at its final size, says so when it could not load, and says so when it has nothing to show.
*/
@Component({
  selector: 'app-inbox',
  imports: [NgIcon, KassandraComposer, ProposalCard, ScopeSwitcher, HlmButtonImports, PulseRail, FindingCard, BriefSection, NightsCalendar, DataHealth, AgentsOvernight, WidgetChart],
  providers: [provideIcons({ ...icons })],
  encapsulation: ViewEncapsulation.None,
  styleUrl: './brief/brief.css',
  host: { class: 'block' },
  template: `
    <div class="brief-shell">
      <div class="brief">
        <!-- Above the fold: what needs the reader and the money in it, the scope's numbers, the top findings -->
        <header class="brief-hero">
          <div class="brief-hero-text">
            <div class="brief-hero-meta">
              <p class="brief-eyebrow">{{ today() }} · Morning brief</p>
              <!-- The hotel scope; on phones it sits in the top bar -->
              <app-scope-switcher class="max-lg:hidden" />
            </div>
            <h1 id="brief-title" class="brief-headline">{{ headline() }}</h1>
            @if (leadLine(); as l) {
              <p class="brief-lead">{{ l }}</p>
            }
            @if (st().findings || st().decisions) {
              <div class="brief-chips" role="group" aria-label="What is at stake">
                @if (st().atRisk) {
                  <button type="button" class="brief-chip" data-tone="risk" [attr.aria-pressed]="filter() === 'risk'" (click)="toggleFilter('risk')">
                    <span class="brief-chip-arrow" aria-hidden="true">▼</span>{{ eur(st().atRisk) }} at risk<span class="brief-chip-sub">{{ plural(st().atRiskHotels, 'hotel') }}</span>
                  </button>
                }
                @if (st().upside) {
                  <button type="button" class="brief-chip" data-tone="upside" [attr.aria-pressed]="filter() === 'upside'" (click)="toggleFilter('upside')">
                    <span class="brief-chip-arrow" aria-hidden="true">▲</span>{{ eur(st().upside) }} upside<span class="brief-chip-sub">{{ plural(st().upsideHotels, 'hotel') }}</span>
                  </button>
                }
                @if (st().decisions) {
                  <button type="button" class="brief-chip" data-tone="decision" (click)="jump('brief-decisions', true)">
                    <i class="brief-chip-dot" aria-hidden="true"></i>{{ st().decisions }} {{ st().decisions === 1 ? 'needs' : 'need' }} your decision
                  </button>
                }
                @if (st().feeds) {
                  <button type="button" class="brief-chip" data-tone="feed" (click)="jump('brief-health', true)"><i class="brief-chip-dot" aria-hidden="true"></i>{{ plural(st().feeds, 'data feed') }} behind</button>
                }
              </div>
            }
          </div>
          <div class="brief-hero-ask">
            <div class="brief-ask">
              <kassandra-composer inputId="global-ask" [shortcut]="true" placeholder="Ask about any hotel, night or number…" [(mode)]="live.mode" (submitted)="live.askNew($event)" />
            </div>
            <p class="brief-status" role="status">
              @switch (live.briefState()) {
                @case ('live') {
                  <span>Brief written at {{ live.briefMeta()?.generated }}@if (live.briefMeta()?.model) {<span>. Numbers from SQL; the sentence on each finding by AI.</span>}</span>
                  <button type="button" class="brief-link brief-link--quiet" title="Writes a new brief now (counts against today’s budget)" [disabled]="live.refreshing()" (click)="live.refreshBrief()">{{ live.refreshing() ? 'Refreshing…' : 'Refresh' }}</button>
                }
                @case ('loading') {
                  <span>Reading this morning’s brief…</span>
                }
                @default {
                  <span><span class="text-foreground">The live brief didn’t load{{ live.briefError() ? ' (' + live.briefError() + ')' : '' }}.</span> These are the findings saved on {{ today() }}, 07:00.</span>
                  <button type="button" class="brief-link" (click)="live.briefApi.brief.reload()">Try again</button>
                }
              }
            </p>
          </div>
        </header>

        <app-pulse-rail [pulse]="overview()?.pulse ?? null" [state]="api.part('pulse')" [error]="api.error()" [scopeLabel]="scope.label()" (ask)="live.askAbout($event)" (retry)="api.retry()" />

        <app-brief-section id="brief-findings" tabindex="-1" class="outline-none" heading="Findings" [count]="open().length || null" [hint]="findingsHint()" [bare]="true">
          @if (filter() !== 'all') {
            <button sectionActions type="button" class="brief-link brief-link--quiet" (click)="filter.set('all')">Show all {{ open().length }}</button>
          } @else if (more() > 0 || showAllFindings()) {
            <button sectionActions type="button" class="brief-link brief-link--quiet" [attr.aria-expanded]="showAllFindings()" (click)="showAllFindings.set(!showAllFindings())">
              {{ showAllFindings() ? 'Show the top ' + topCount : 'View all ' + findings().length }}
            </button>
          }

          @if (api.state() === 'error' && findings().length) {
            <div class="brief-notice" role="alert">
              <p>The charts and the numbers around the brief didn’t load{{ api.error() ? ' (' + api.error() + ')' : '' }}.</p>
              <button hlmBtn variant="outline" size="sm" (click)="api.retry()">Try again</button>
            </div>
          }

          <div class="brief-cards">
            @for (f of shown(); track f.id; let i = $index) {
              <app-finding-card
                [finding]="f"
                [chart]="chartOf(f.id)"
                [chartState]="chartState(f.id)"
                [showChart]="!phone() || i === 0"
                (explore)="explore(f.id)"
                (watch)="watch(f.id)"
                (snooze)="store.snoozeItem(f.id)"
                (dismiss)="store.dismissItem(f.id)"
                (retry)="api.retry()"
              />
            }
            @if (live.briefState() === 'loading') {
              <div class="skeleton brief-card-skel" role="status"><span class="sr-only">Loading the findings</span></div>
              <div class="skeleton brief-card-skel" aria-hidden="true"></div>
              <div class="skeleton brief-card-skel" aria-hidden="true"></div>
            } @else if (!findings().length) {
              <div class="brief-card brief-empty">
                <ng-icon name="phosphorCheckCircleLight" aria-hidden="true" />
                @if (open().length) {
                  <p>No finding on that side of the money. <button type="button" class="brief-link" (click)="filter.set('all')">Show all {{ open().length }}</button></p>
                } @else {
                  <p>No findings for {{ scope.phrase() }} this morning. The detectors run again with tomorrow’s brief, at 07:00.</p>
                }
              </div>
            }
          </div>

          @if (more() > 0 && !showAllFindings()) {
            <button type="button" class="brief-more" (click)="showAllFindings.set(true)">
              View all {{ findings().length }} findings<span class="brief-more-sub">{{ more() }} more, smaller in money</span>
            </button>
          }

          @if (store.earlier().length) {
            <div class="brief-resolved">
              <button type="button" class="brief-resolved-toggle" [attr.aria-expanded]="showResolved()" (click)="showResolved.set(!showResolved())">
                <ng-icon name="phosphorCheckLight" aria-hidden="true" />{{ store.earlier().length }} set aside today
                <span class="ml-auto inline-flex items-center gap-1">{{ showResolved() ? 'Hide' : 'Show' }}<ng-icon name="phosphorCaretDownLight" class="transition-transform" [class.rotate-180]="showResolved()" aria-hidden="true" /></span>
              </button>
              @if (showResolved()) {
                <ul class="brief-resolved-list gen-in">
                  @for (r of store.earlier(); track r.id) {
                    <li>
                      <span class="min-w-0 flex-1">
                        <span class="block">{{ r.title }}</span>
                        <span class="brief-resolved-why">{{ r.resolution }}</span>
                      </span>
                      <button hlmBtn variant="ghost" size="sm" (click)="store.restoreItem(r.id)">Put back<span class="sr-only">: {{ r.title }}</span></button>
                    </li>
                  }
                </ul>
              }
            </div>
          }
        </app-brief-section>

        <!-- Below the fold: the rest of the morning, as labelled sections -->
        <div class="brief-below">
          <!-- Decisions: proposals from the agents, waiting on a person -->
          <app-brief-section
            id="brief-decisions"
            tabindex="-1"
            class="brief-wide outline-none"
            heading="Decisions waiting"
            [count]="live.pendingList().length || null"
            tone="decision"
            hint="What an agent suggests, and why. You send it to the revenue manager or dismiss it."
            [state]="decisionsState()"
            [height]="280"
            error="The decisions didn’t load."
            [bare]="true"
            (retry)="live.pending.reload()"
          >
            @if (live.pendingList().length > decisionsShown) {
              <button sectionActions type="button" class="brief-link brief-link--quiet" (click)="store.go('watchers')">View all {{ live.pendingList().length }}</button>
            }
            @for (p of live.pendingList().slice(0, decisionsShown); track p.id) {
              <app-proposal-card class="brief-decision" [proposal]="p" />
            } @empty {
              <div class="brief-card brief-decision-empty">
                <ng-icon name="phosphorCheckCircleLight" class="brief-decision-ok" aria-hidden="true" />
                <div>
                  <p class="brief-decision-none">Nothing waits for your decision.</p>
                  <p class="brief-decision-how">When an agent suggests a change to a rate or a channel at {{ scope.phrase() }}, it shows here for you to send to the revenue manager or dismiss. Compass never changes them itself.</p>
                </div>
              </div>
            }
          </app-brief-section>

          <app-brief-section
            class="brief-narrow"
            heading="Agents overnight"
            [hint]="agentsHint()"
            [state]="agentsState()"
            [height]="280"
            error="The agents didn’t load."
            [empty]="'No agent watches ' + scope.phrase() + ' yet. “Watch this” on a finding sets one up.'"
            (retry)="live.workflows.reload()"
          >
            <button sectionActions type="button" class="brief-link brief-link--quiet" (click)="store.go('watchers')">View all<span class="sr-only"> agents in Agent Studio</span></button>
            <app-agents-overnight sectionBody [rows]="agents().slice(0, listCap)" [nameOf]="nameOf" [ago]="agoText" (open)="store.openWatcher($event)" />
          </app-brief-section>

          <!-- The next 14 nights -->
          <app-brief-section class="brief-wide" heading="Next 14 nights" hint="Occupancy on the books, with city events and rates to check" [state]="api.part('nights')" [height]="nightsHeight()" error="The next 14 nights didn’t load." (retry)="api.retry()">
            @if (scope.count() > nightsOpenWith) {
              <button sectionActions type="button" class="brief-link brief-link--quiet" [attr.aria-expanded]="allHotels()" (click)="allHotels.set(!allHotels())">{{ allHotels() ? 'Show fewer' : 'View all ' + scope.count() + ' hotels' }}</button>
            }
            @if (overview()?.nights; as nights) {
              <app-nights-calendar sectionBody [nights]="nights" [hotels]="scope.catalog()" [scopeLabel]="scope.label()" [showAll]="allHotels()" (ask)="live.askAbout($event)" />
            }
          </app-brief-section>

          <app-brief-section class="brief-narrow" heading="Pickup, last 7 days" [hint]="pickupHint()" [state]="api.part('pickup') === 'error' ? 'error' : 'ready'" [height]="chartBlock" error="Pickup didn’t load." (retry)="api.retry()">
            @if (pickupDay() && pickupHotel()) {
              <div sectionActions class="seg" role="radiogroup" aria-label="Pickup by">
                @for (o of pickupViews; track o.key) {
                  <button type="button" role="radio" [attr.aria-checked]="pickupView() === o.key" [attr.tabindex]="pickupView() === o.key ? 0 : -1" (click)="pickupView.set(o.key)" (keydown)="segKey($event, pickupViews, pickupView)">{{ o.label }}</button>
                }
              </div>
            }
            <div sectionBody>
              @if (pickupShown(); as v) {
                <p class="brief-figure">
                  <strong>{{ number(pickupDay()!.net) }}</strong> room nights net
                  @if (pickupDay()!.change) {
                    <span class="brief-figure-delta" [attr.data-tone]="pickupDay()!.net >= pickupDay()!.netLy ? 'up' : 'down'"><span aria-hidden="true">{{ pickupDay()!.net >= pickupDay()!.netLy ? '▲' : '▼' }}</span> {{ pickupDay()!.change }}</span>
                    <span>vs the same days last year</span>
                  }
                </p>
                <juyo-widget-chart [spec]="v.spec" [rows]="v.rows" [columns]="v.columns" [compact]="true" [header]="false" [height]="chartH" />
              } @else {
                <p class="brief-figure" aria-hidden="true"><span class="skeleton brief-figure-skel"></span></p>
                <juyo-widget-chart [spec]="barPlaceholder" [rows]="null" loading="skeleton" [compact]="true" [header]="false" [height]="chartH" />
              }
            </div>
          </app-brief-section>

          <!-- Where the money is -->
          <app-brief-section class="brief-wide" heading="Where the money is" [hint]="moneyHint()" [state]="api.part('money') === 'error' ? 'error' : 'ready'" [height]="heroBlock" error="The revenue on the books didn’t load." (retry)="api.retry()">
            <div sectionActions class="brief-sec-tools">
              @if (moneyBooks() && moneyStake()) {
                <div class="seg" role="radiogroup" aria-label="Money">
                  @for (o of moneyViews; track o.key) {
                    <button type="button" role="radio" [attr.aria-checked]="moneyView() === o.key" [attr.tabindex]="moneyView() === o.key ? 0 : -1" (click)="moneyView.set(o.key)" (keydown)="segKey($event, moneyViews, moneyView)">{{ o.label }}</button>
                  }
                </div>
              }
              <button type="button" class="brief-link brief-link--quiet" (click)="store.openBoard(portfolioBoard)">View all<span class="sr-only"> hotels on the portfolio board</span></button>
            </div>
            <div sectionBody>
              @if (moneyBooks(); as books) {
                @if (moneyShown(); as v) {
                  <p class="brief-figure">
                    @if (moneyView() === 'stake' && moneyStake()) {
                      <strong>{{ eur(st().atRisk + st().upside) }}</strong> in today’s findings <span>· {{ eur(st().atRisk) }} at risk, {{ eur(st().upside) }} upside</span>
                    } @else {
                      <strong>{{ eur(books.total) }}</strong> room revenue on the books
                      @if (books.change) {
                        <span class="brief-figure-delta" [attr.data-tone]="books.change.startsWith('+') ? 'up' : 'down'"><span aria-hidden="true">{{ books.change.startsWith('+') ? '▲' : '▼' }}</span> {{ books.change }}</span>
                        <span>vs last year</span>
                      }
                    }
                  </p>
                  <juyo-widget-chart [spec]="v.spec" [rows]="v.rows" [columns]="v.columns" [header]="false" [height]="heroH" />
                }
                @if (movers().length) {
                  <div class="brief-movers">
                    <p class="brief-movers-label">Furthest from last year</p>
                    <ul>
                      @for (h of movers(); track h.code) {
                        <li>
                          <button type="button" class="brief-mover" [attr.data-tone]="h.tone" (click)="askMover(h.code)">
                            <span>{{ h.name }}</span><span class="brief-mover-value"><span aria-hidden="true">{{ h.tone === 'up' ? '▲' : '▼' }}</span> {{ h.change }}</span><span class="sr-only">. Ask why.</span>
                          </button>
                        </li>
                      }
                    </ul>
                  </div>
                }
              } @else {
                <p class="brief-figure" aria-hidden="true"><span class="skeleton brief-figure-skel"></span></p>
                <juyo-widget-chart [spec]="treemapPlaceholder" [rows]="null" loading="skeleton" [header]="false" [height]="heroH" />
              }
            </div>
          </app-brief-section>

          <app-brief-section id="brief-health" tabindex="-1" class="brief-narrow outline-none" heading="Data health" hint="The feeds behind every number on this page" [state]="healthState()" [height]="280" error="The data feeds didn’t load." empty="No data feeds are set up for these hotels." (retry)="api.retry()">
            @if (systemCount() > listCap) {
              <button sectionActions type="button" class="brief-link brief-link--quiet" [attr.aria-expanded]="allSystems()" (click)="allSystems.set(!allSystems())">{{ allSystems() ? 'Show fewer' : 'View all ' + systemCount() }}</button>
            }
            @if (overview()?.health; as feeds) {
              <app-data-health sectionBody [feeds]="feeds" [limit]="allSystems() ? null : listCap" [nameOf]="shortNameOf" (explore)="exploreFeed($event)" />
            }
          </app-brief-section>
        </div>
      </div>
    </div>

    <!-- Phones and tablets: the ask bar docks above the tab bar -->
    <div class="dock-fade fixed inset-x-0 bottom-[calc(57px+env(safe-area-inset-bottom,0px))] z-20 px-3 pt-6 pb-2 lg:hidden">
      <kassandra-composer inputId="global-ask-m" placeholder="Ask about any hotel" [showMode]="false" [showScope]="false" (submitted)="live.askNew($event)" />
    </div>
  `,
})
export class InboxView {
  protected readonly store = inject(CompassStore);
  protected readonly live = inject(Live);
  protected readonly scope = inject(ScopeService);
  protected readonly api = inject(BriefOverviewApi);
  protected readonly overview = this.api.value;
  protected readonly showResolved = signal(false);
  protected readonly filter = signal<FindingFilter>('all');
  protected readonly portfolioBoard = PORTFOLIO_BOARD;
  /** Above the fold: the top findings, three to a row. The rest are one "View all" away. */
  protected readonly topCount = TOP_FINDINGS;
  protected readonly showAllFindings = signal(false);
  /** A list inside a section shows five rows; the section's "View all" has the rest. */
  protected readonly listCap = 5;
  protected readonly decisionsShown = 2;
  protected readonly nightsOpenWith = NIGHTS_OPEN_WITH;
  protected readonly allHotels = linkedSignal({ source: () => this.scope.hotels().join(','), computation: () => false });
  protected readonly allSystems = signal(false);
  /** Charts: 180 px in a row of the overview, 320 px for the one that is the section's subject. */
  protected readonly chartH = CHART_H;
  protected readonly heroH = 320;
  /** The body of a chart section before it loads: the figure line, the chart and its toolbar. */
  protected readonly chartBlock = CHART_H + 70;
  protected readonly heroBlock = 320 + 70;
  /** On a phone the findings after the first are rows; their chart is one tap away, in Explore. */
  protected readonly phone = signal(false);
  protected readonly eur = eurShort;
  protected readonly number = (n: number) => n.toLocaleString('en-GB');
  protected readonly plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  protected readonly nameOf = (code: string) => this.scope.nameOf(code);
  protected readonly shortNameOf = (code: string) => shortHotel(this.scope.nameOf(code));

  /** The brief's rows (live, or the saved copy when the API is down), by id. */
  private readonly rows = computed(() => new Map(this.store.briefRows().map((r) => [r.id, r])));
  /** Findings in scope that the reader has not set aside, in the brief's order. */
  protected readonly open = computed(() => this.store.needsYou().filter((i) => this.rows().has(i.id)));
  private readonly openRows = computed(() => this.open().map((i) => this.rows().get(i.id)!));

  protected readonly today = computed(() => {
    const iso = this.overview()?.businessDate || (this.live.briefApi.brief.hasValue() ? this.live.briefApi.brief.value().businessDate : '');
    return dayLabel.format(iso ? Date.parse(`${iso}T00:00:00Z`) : BUSINESS_DAY);
  });

  protected readonly st = computed(() => stakes(this.openRows(), this.live.pendingList().length));
  protected readonly headline = computed(() => headline(this.st(), this.live.briefState() === 'loading' ? 'loading' : 'ready'));
  /** Under the headline: the largest priced finding, by name. */
  protected readonly leadLine = computed(() => {
    const top = this.open().find((i) => this.rows().get(i.id)?.impact_eur);
    if (!top || this.open().length < 2) return '';
    const r = this.rows().get(top.id)!;
    return `The largest: ${top.title} (${eurShort(r.impact_eur!)} ${r.impact_eur! < 0 ? 'at risk' : 'upside'}).`;
  });

  protected readonly findings = computed<FindingView[]>(() =>
    this.open()
      .map((item) => ({ item, row: this.rows().get(item.id)! }))
      .filter(({ row }) => matchesFilter(row.impact_eur, this.filter()))
      .map(({ item, row }) => ({
        id: item.id,
        kind: row.kind,
        hotel: shortHotel(row.hotel_name),
        title: item.title,
        summary: item.summary,
        impact_eur: row.impact_eur,
        impact_basis: row.impact_basis,
        sources: row.sources,
        seen: item.status !== 'new',
      })),
  );

  protected readonly shown = computed(() => (this.showAllFindings() || this.filter() !== 'all' ? this.findings() : this.findings().slice(0, TOP_FINDINGS)));
  protected readonly more = computed(() => this.findings().length - this.shown().length);
  protected readonly findingsHint = computed(() => {
    if (this.filter() !== 'all') return this.filter() === 'risk' ? 'Only what is at risk' : 'Only the upside';
    const n = this.findings().length;
    if (!n) return '';
    return n > TOP_FINDINGS && !this.showAllFindings() ? `The top ${TOP_FINDINGS} of ${n}, largest in money first; a broken data feed leads` : 'Largest in money first; a broken data feed leads';
  });
  protected readonly systemCount = computed(() => new Set((this.overview()?.health ?? []).map((f) => f.system)).size);

  protected readonly decisionsState = computed<'loading' | 'ready' | 'error'>(() => {
    if (this.live.pending.error()) return 'error';
    return this.live.pending.isLoading() && !this.live.pendingList().length && !this.pendingLoaded() ? 'loading' : 'ready';
  });
  /** True once the approval inbox has answered: later polls must not flash a skeleton. */
  private readonly pendingLoaded = signal(false);

  /* ── Charts of the findings ── */
  protected chartOf(id: string) {
    return this.overview()?.charts[id] ?? null;
  }
  protected chartState(id: string): 'loading' | 'ready' | 'error' {
    const o = this.overview();
    // When the whole overview failed, one notice above the cards says so; the cards keep their text.
    if (!o) return this.api.state() === 'loading' ? 'loading' : 'ready';
    return o.failed.includes(`chart:${id}`) ? 'error' : 'ready';
  }

  /* ── Pickup ── */
  protected readonly pickupViews: Seg<'day' | 'hotel'> = [
    { key: 'day', label: 'By day' },
    { key: 'hotel', label: 'By hotel' },
  ];
  protected readonly pickupView = signal<'day' | 'hotel'>('day');
  protected readonly pickupDay = computed(() => {
    const p = this.overview()?.pickup;
    return p ? pickupByDay(p) : null;
  });
  protected readonly pickupHotel = computed(() => {
    const p = this.overview()?.pickup;
    return p ? pickupByHotel(p, this.scope.catalog()) : null;
  });
  protected readonly pickupShown = computed(() => (this.pickupView() === 'hotel' ? (this.pickupHotel() ?? this.pickupDay()) : this.pickupDay()));
  protected readonly pickupHint = computed(() => (this.pickupView() === 'hotel' && this.pickupHotel() ? 'Room nights booked less cancelled, per hotel' : 'Room nights booked less cancelled, per booking day'));
  protected readonly barPlaceholder = placeholderSpec('bar', 'pickup');
  protected readonly treemapPlaceholder = placeholderSpec('treemap', 'money');

  /* ── Money ── */
  protected readonly moneyViews: Seg<'books' | 'stake'> = [
    { key: 'books', label: 'On the books' },
    { key: 'stake', label: 'In the findings' },
  ];
  protected readonly moneyView = signal<'books' | 'stake'>('books');
  protected readonly moneyBooks = computed(() => {
    const m = this.overview()?.money;
    return m ? moneyOnTheBooks(m, this.scope.catalog()) : null;
  });
  protected readonly moneyStake = computed(() => moneyAtStake(this.openRows(), this.scope.catalog()));
  protected readonly moneyShown = computed(() => (this.moneyView() === 'stake' ? (this.moneyStake() ?? this.moneyBooks()) : this.moneyBooks()));
  protected readonly moneyHint = computed(() =>
    this.moneyView() === 'stake' && this.moneyStake() ? 'The money in today’s findings, per hotel' : this.scope.count() === 1 ? 'Room revenue on the books for the next 30 nights, per stay week' : 'Room revenue on the books for the next 30 nights, per hotel',
  );
  protected readonly movers = computed(() => {
    const m = this.overview()?.money;
    return m && m.byHotel.length > 2 ? moneyMovers(m, this.scope.catalog()) : [];
  });

  /* ── Nights, health ── */
  /** The calendar's height before it loads: its header, the scope's row, and up to eight hotel rows. */
  protected readonly nightsHeight = computed(() => 150 + (this.scope.count() > 1 ? Math.min(this.scope.count(), NIGHTS_OPEN_WITH) * 26 : 0));
  protected readonly healthState = computed<'loading' | 'error' | 'empty' | 'ready'>(() => {
    const part = this.api.part('health');
    return part === 'ready' && !this.overview()?.health?.length ? 'empty' : part;
  });

  /* ── Agents ── */
  private readonly details = signal<Record<string, WorkflowDetail>>({});
  private readonly asked = new Map<string, string>();
  private readonly now = signal(Date.now());
  protected readonly agoText = (iso: string) => ago(iso, this.now());
  /** What an agent found, in the same plain words as the decision card beside it (no hotel codes, no ISO dates). */
  protected readonly agents = computed(() => this.agentList().map((row) => (row.finding ? { ...row, finding: plainText(row.finding, this.scope.catalog()) } : row)));
  private readonly agentList = computed(() =>
    agentRows(this.live.workflowList(), this.details(), this.live.audit.hasValue() ? this.live.audit.value() : [], (code) => this.scope.includes(code), this.scope.isAll() ? undefined : hotelMentions(this.scope.catalog().filter((h) => this.scope.includes(h.code)))),
  );
  protected readonly agentsHint = computed(() => agentsSummary(this.agents()) || 'What Agent Studio ran since the last brief');
  protected readonly agentsState = computed<'loading' | 'error' | 'empty' | 'ready'>(() => {
    if (this.live.workflowsError()) return 'error';
    if (this.live.workflows.isLoading() && !this.live.workflowList().length) return 'loading';
    return this.agents().length ? 'ready' : 'empty';
  });

  constructor() {
    const narrow = typeof matchMedia === 'function' ? matchMedia('(max-width: 599.98px)') : null;
    if (narrow) {
      const onChange = () => this.phone.set(narrow.matches);
      onChange();
      narrow.addEventListener?.('change', onChange);
      inject(DestroyRef).onDestroy(() => narrow.removeEventListener?.('change', onChange));
    }
    effect(() => {
      if (!this.live.pending.isLoading() && (this.live.pending.hasValue() || this.live.pending.error())) untracked(() => this.pendingLoaded.set(true));
    });
    // Each agent's runs and proposals, read once per run: what it found is in them, not in the list.
    effect(() => {
      const pending = this.live.pendingList();
      for (const w of this.live.workflowList()) {
        const key = `${w.lastRun?.runId ?? ''}|${w.lastRun?.status ?? ''}|${pending.filter((p) => p.workflowId === w.id).length}`;
        if (!w.lastRun || this.asked.get(w.id) === key) continue;
        this.asked.set(w.id, key);
        void this.live.workflowsApi.get(w.id).then((result) => {
          if (result.ok) this.details.update((details) => ({ ...details, [w.id]: result.value }));
          else this.asked.delete(w.id);
        });
      }
      untracked(() => this.now.set(Date.now()));
    });
  }

  /* ── Actions ── */
  /** "Explore": the finding's thread opens and its question is sent; a second click reopens the same thread. */
  protected explore(id: string) {
    const item = this.store.items().find((i) => i.id === id);
    const row = this.rows().get(id);
    if (!item) return;
    this.store.markSeen(id);
    if (row) this.live.exploreRow({ ...row, question: item.question });
    else this.live.explore(item.question, undefined, `brief:${id}`);
  }
  /** "Watch this": the agent builder opens with a description for this finding, ready to edit. Nothing is sent. */
  protected watch(id: string) {
    const row = this.rows().get(id);
    if (!row) return;
    this.store.markSeen(id);
    this.store.openBuilder(undefined, watchPrompt(row));
  }
  protected exploreFeed(feed: BriefFeed) {
    const row = this.store.briefRows().find((r: BriefRow) => r.kind === 'data_stale' && r.hotel_code === feed.hotel_code && r.facts['system'] === feed.system);
    const question = `Is anything wrong with the data at ${this.scope.nameOf(feed.hotel_code)}? What does the stale ${feed.system} feed affect?`;
    if (row) this.live.exploreRow({ ...row, question: row.question ?? question });
    else this.live.askAbout(question);
  }
  protected askMover(code: string) {
    this.live.askAbout(`Why is ${this.scope.nameOf(code)}'s room revenue on the books for the next 30 nights different from the same time last year?`);
  }

  protected toggleFilter(side: 'risk' | 'upside') {
    this.filter.update((now) => (now === side ? 'all' : side));
    this.jump('brief-findings');
  }
  /** Scrolls to a section of the page; with `focus`, moves the keyboard there too. */
  protected jump(id: string, focus = false) {
    const el = document.getElementById(id);
    const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    if (focus) el?.focus({ preventScroll: true });
  }

  /** A radio group moves with the arrow keys, Home and End. */
  protected segKey<T extends string>(event: KeyboardEvent, options: Seg<T>, value: { (): T; set(v: T): void }) {
    const i = options.findIndex((o) => o.key === value());
    const next = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? i + 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? i - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : -1;
    if (next === -1 && event.key !== 'ArrowLeft' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const target = options[(next + options.length) % options.length]!;
    value.set(target.key);
    const group = (event.currentTarget as HTMLElement).parentElement;
    queueMicrotask(() => group?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  }
}

