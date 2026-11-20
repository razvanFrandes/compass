import { Component, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { PaceChart } from './brief-charts';
import { CompassStore, NightDecision } from './store';
import { BUSINESS_DAY, Decision, HOTEL, NIGHTS, Night, decisionNights, formatEur, paceFor } from './data';
import { FOCUS_COMPS, FOCUS_CURVES } from './halcyon-data';
import * as icons from './icons';

const DAY = 86_400_000;
const fmtShort = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtLong = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const BINS = ['#1c2532', '#212e42', '#293c5a', '#334b76', '#3f609b']; // blue #5B8DEB at α .08/.16/.28/.42/.60 over #161C22
const k = (n: number) => `€${(n / 1000).toFixed(1)}k`;

interface Row {
  d: Decision;
  state?: NightDecision;
}
interface Cell {
  day: number;
  date: number;
  night?: Night;
  past: boolean;
  today: boolean;
  decision?: Decision;
  state?: NightDecision;
}

/*
  Nights that need a decision (docs/research/ui-round3/tables_and_rate_calendar.md, Part C):
  one dataset, two views (decision list and rate calendar), one night panel.
  Each row reads like a sentence: night — recommendation — evidence — money at stake.
  Colour is restrained: orange only marks a pending decision; no green or red in this component.
  Compass never writes prices: accepting sends a task to the RMS and logs who decided.
*/
@Component({
  selector: 'app-decisions-widget',
  imports: [NgIcon, PaceChart, HlmButtonImports, HlmTooltipImports],
  providers: [provideIcons({ ...icons })],
  host: { class: 'block', '(document:keydown.escape)': 'close()' },
  template: `
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-[15px] font-semibold tracking-[-0.01em]">Nights that need a decision</h3>
        <p class="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-[12.5px] tabular-nums">
          @if (pending().length) {
            <i class="size-1.5 rounded-full bg-(--decision)"></i>{{ pending().length }} pending · up to {{ k(stake()) }} on unsold rooms
          } @else {
            Nothing pending in the next 45 nights · last checked 06:00
          }
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        @if (view() === 'list') {
          <div class="seg" role="tablist" aria-label="Status">
            <button type="button" role="tab" [attr.aria-selected]="tab() === 'pending'" (click)="tab.set('pending')">Pending <span class="tabular-nums">{{ pending().length }}</span></button>
            <button type="button" role="tab" [attr.aria-selected]="tab() === 'decided'" (click)="tab.set('decided')">Decided <span class="tabular-nums">{{ decided().length }}</span></button>
          </div>
        }
        <div class="seg" role="radiogroup" aria-label="View">
          <button type="button" role="radio" [attr.aria-checked]="view() === 'list'" (click)="view.set('list')"><ng-icon name="phosphorListLight" />List</button>
          <button type="button" role="radio" [attr.aria-checked]="view() === 'calendar'" (click)="view.set('calendar')"><ng-icon name="phosphorCalendarBlankLight" />Calendar</button>
        </div>
      </div>
    </header>

    @if (view() === 'list') {
      @let list = tab() === 'pending' ? pending() : decided();
      <!-- Desktop / tablet: a two-line table -->
      <div class="mt-4 hidden overflow-x-auto md:block">
        <table class="dec-table w-full min-w-[760px] text-left">
          <thead>
            <tr>
              <th scope="col" class="w-[176px]">Night</th>
              <th scope="col">Recommendation</th>
              <th scope="col" class="w-[200px]">On the books vs LY</th>
              <th scope="col" class="w-[112px] text-right">Up to</th>
              <th scope="col" class="w-[92px]"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (r of list; track r.d.night.date) {
              <tr tabindex="0" [class.is-selected]="selected() === r.d.night.date" (click)="open(r.d.night.date)" (keydown.enter)="open(r.d.night.date)" [attr.aria-label]="label(r)">
                <td>
                  <span class="cell-1">{{ short(r.d.night.date) }}</span>
                  <span class="cell-2">in {{ r.d.lead }} days{{ r.d.night.event ? ' · ✦ ' + r.d.night.event : '' }}</span>
                </td>
                <td>
                  @if (r.state) {
                    <span class="cell-1 flex items-center gap-1.5"><ng-icon [name]="r.state.status === 'accepted' ? 'phosphorCheckLight' : 'phosphorMinusLight'" class="text-muted-foreground" />{{ stateText(r) }}</span>
                    <span class="cell-2">{{ r.state.status === 'accepted' ? 'Task for the revenue manager · logged by you' : (r.state.reason ?? 'Logged by you') }}</span>
                  } @else {
                    <span class="cell-1 flex items-center gap-2"><i class="size-1.5 shrink-0 rounded-full bg-(--decision)"></i><span>{{ verb(r.d) }} @if (r.d.target) {<strong class="font-semibold tabular-nums">{{ eur(r.d.target) }}</strong>}</span></span>
                    <span class="cell-2 truncate">{{ r.d.reason }}</span>
                  }
                </td>
                <td>
                  <span class="cell-1 flex items-center gap-3">
                    <span class="bullet" aria-hidden="true"><span class="bullet-fill" [style.width.%]="r.d.occ"></span><span class="bullet-tick" [style.left.%]="r.d.occLy"></span></span>
                    <span class="tabular-nums">{{ r.d.occ.toFixed(0) }}%</span>
                  </span>
                  <span class="cell-2 tabular-nums">LY {{ r.d.occLy.toFixed(0) }}% · {{ r.d.pace >= 0 ? '+' : '−' }}{{ abs(r.d.pace).toFixed(0) }} pts</span>
                </td>
                <td class="text-right">
                  <span class="cell-1 font-medium tabular-nums">+{{ k(r.d.impact) }}</span>
                  <span class="cell-2">on unsold rooms</span>
                </td>
                <td class="text-right">
                  @if (r.state) {
                    <button hlmBtn variant="ghost" size="sm" (click)="$event.stopPropagation(); undo(r.d)">Undo</button>
                  } @else {
                    <span class="inline-flex gap-1">
                      <button hlmBtn variant="ghost" size="icon-sm" class="row-act" [attr.aria-label]="acceptLabel(r.d)" [hlmTooltip]="acceptLabel(r.d)" (click)="$event.stopPropagation(); accept(r.d)"><ng-icon name="phosphorCheckLight" class="text-[17px]" /></button>
                      <button hlmBtn variant="ghost" size="icon-sm" class="row-act" [attr.aria-label]="keepLabel(r.d)" [hlmTooltip]="keepLabel(r.d)" (click)="$event.stopPropagation(); keep(r.d)"><ng-icon name="phosphorXLight" class="text-[17px]" /></button>
                    </span>
                  }
                </td>
              </tr>
            } @empty {
              <tr class="is-empty"><td colspan="5" class="text-muted-foreground py-8 text-center text-[13.5px]">{{ tab() === 'pending' ? 'No nights need a decision in the next 45 days.' : 'Nothing decided yet.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
      <!-- Phone: three-line rows -->
      <ul class="divide-border mt-3 divide-y md:hidden">
        @for (r of list; track r.d.night.date) {
          <li>
            <button type="button" class="flex w-full items-start gap-3 py-3.5 text-left" (click)="open(r.d.night.date)">
              <span class="min-w-0 flex-1">
                <span class="flex items-baseline justify-between gap-2">
                  <span class="text-[15px] font-medium">{{ short(r.d.night.date) }}</span>
                  <span class="text-[14px] font-medium tabular-nums">+{{ k(r.d.impact) }}</span>
                </span>
                @if (r.state) {
                  <span class="text-muted-foreground mt-0.5 block text-[14px]">{{ stateText(r) }}</span>
                } @else {
                  <span class="mt-0.5 flex items-center gap-2 text-[14px]"><i class="size-1.5 shrink-0 rounded-full bg-(--decision)"></i>{{ r.d.action }}</span>
                }
                <span class="text-muted-foreground mt-1 flex items-center gap-2 text-[12.5px] tabular-nums">
                  <span class="bullet bullet--sm" aria-hidden="true"><span class="bullet-fill" [style.width.%]="r.d.occ"></span><span class="bullet-tick" [style.left.%]="r.d.occLy"></span></span>
                  {{ r.d.occ.toFixed(0) }}% · LY {{ r.d.occLy.toFixed(0) }}%
                </span>
              </span>
              <ng-icon name="phosphorCaretRightLight" class="text-muted-foreground mt-1" />
            </button>
          </li>
        }
      </ul>
    } @else {
      <!-- Rate calendar: fill = occupancy on the books; ● = waiting for a decision -->
      <div class="mt-4 flex items-center justify-between gap-2">
        <div class="flex items-center gap-1">
          <button hlmBtn variant="ghost" size="icon-sm" aria-label="Previous month" [disabled]="month() === 10" (click)="month.set(10)"><ng-icon name="phosphorCaretLeftLight" /></button>
          <span class="min-w-[124px] text-center text-[14px] font-medium">{{ month() === 10 ? 'November' : 'December' }} 2026</span>
          <button hlmBtn variant="ghost" size="icon-sm" aria-label="Next month" [disabled]="month() === 11" (click)="month.set(11)"><ng-icon name="phosphorCaretRightLight" /></button>
        </div>
        <button hlmBtn variant="outline" size="sm" (click)="month.set(10)">Today</button>
      </div>
      <!-- Phones (C6): 7 columns, one value per cell, as Turo, Skyscanner, IHG and IDeaS do: date, BAR, a corner dot for a decision -->
      <div class="mt-3 overflow-x-auto">
        <div class="sm:min-w-[560px]">
          <div class="text-muted-foreground grid grid-cols-7 gap-1 pb-1.5 text-[12px]">
            @for (d of weekdays; track d) {
              <span class="px-1 sm:px-2">{{ d }}</span>
            }
          </div>
          <div class="grid grid-cols-7 gap-1">
            @for (c of cells(); track $index) {
              @if (c) {
                <button
                  type="button"
                  class="cal-cell"
                  [class.is-past]="c.past"
                  [class.is-today]="c.today"
                  [class.is-selected]="selected() === c.date"
                  [style.background]="c.night && !c.past ? bin(c.night) : null"
                  [disabled]="!c.night || c.past"
                  [attr.aria-label]="cellLabel(c)"
                  (click)="open(c.date)"
                >
                  <span class="flex items-start gap-0.5 text-[11.5px] sm:justify-between sm:text-[12px]">
                    <span [class]="c.today ? 'font-semibold text-(--text-1)' : ''">{{ c.day }}</span>
                    @if (c.night?.event) {
                      <span class="text-muted-foreground" [hlmTooltip]="c.night!.event!">✦</span>
                    }
                  </span>
                  @if (c.decision && !c.state) {
                    <i class="cal-dot cal-dot--corner sm:hidden"></i>
                  }
                  @if (c.night) {
                    <span class="mt-auto block text-[12.5px] font-semibold tabular-nums sm:text-[15px] sm:font-medium" [class.text-muted-foreground]="c.past">{{ eur(c.night.bar) }}</span>
                    <span class="hidden items-center justify-between gap-1 text-[12px] tabular-nums sm:flex">
                      <span class="text-muted-foreground">{{ occ(c.night).toFixed(0) }}%</span>
                      @if (c.decision && !c.state && c.decision.target) {
                        <span class="flex items-center gap-1 text-(--text-1)">{{ c.decision.kind === 'lower' ? '↘' : '↗' }} {{ eur(c.decision.target) }}<i class="cal-dot"></i></span>
                      } @else if (c.decision && !c.state) {
                        <span class="flex items-center gap-1 text-(--text-1)">Pkg<i class="cal-dot"></i></span>
                      } @else if (c.state) {
                        <span class="text-muted-foreground">sent</span>
                      }
                    </span>
                  } @else {
                    <span class="text-muted-foreground mt-auto text-[13px]">—</span>
                  }
                </button>
              } @else {
                <span></span>
              }
            }
          </div>
        </div>
      </div>
      <div class="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]">
        <span class="flex items-center gap-1.5">On the books <span class="text-[11px]">0%</span>
          @for (b of bins; track b) {
            <i class="inline-block h-3 w-5 rounded-[3px]" [style.background]="b"></i>
          }
          <span class="text-[11px]">100%</span></span>
        <span class="flex items-center gap-1.5"><i class="cal-dot cal-dot--legend"></i>Needs a decision</span>
        <span>✦ Event</span>
        <span class="ml-auto">BAR, base room, EUR</span>
      </div>
    }

    <!-- Night panel: a sheet on desktop, a full page on phones -->
    @if (panel(); as p) {
      <div class="fixed inset-0 z-40 bg-black/40 md:bg-black/25" (click)="close()" aria-hidden="true"></div>
      <aside class="night-panel fixed inset-y-0 right-0 z-50 flex w-full flex-col md:w-[420px]" role="dialog" aria-modal="true" [attr.aria-label]="long(p.night.date)">
        <header class="border-border flex items-start gap-2 border-b px-5 pt-[max(16px,env(safe-area-inset-top,0px))] pb-4">
          <button hlmBtn variant="ghost" size="icon-sm" class="md:hidden" aria-label="Back" (click)="close()"><ng-icon name="phosphorArrowLeftLight" /></button>
          <div class="min-w-0 flex-1">
            <h4 class="text-[16px] font-semibold">{{ long(p.night.date) }}</h4>
            <p class="text-muted-foreground text-[12.5px]">in {{ p.lead }} days{{ p.night.event ? ' · ' + p.night.event : '' }}</p>
          </div>
          <button hlmBtn variant="ghost" size="icon-sm" aria-label="Previous night" [disabled]="!p.prev" (click)="p.prev && open(p.prev)"><ng-icon name="phosphorCaretLeftLight" /></button>
          <button hlmBtn variant="ghost" size="icon-sm" aria-label="Next night" [disabled]="!p.next" (click)="p.next && open(p.next)"><ng-icon name="phosphorCaretRightLight" /></button>
          <button #closeBtn hlmBtn variant="ghost" size="icon-sm" class="hidden md:inline-flex" aria-label="Close" (click)="close()"><ng-icon name="phosphorXLight" /></button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          @if (p.decision; as d) {
            <p class="text-muted-foreground text-[12px]">Recommendation</p>
            @if (p.state) {
              <p class="mt-1 text-[18px]/snug font-semibold">{{ stateText({ d: d, state: p.state }) }}</p>
              <p class="text-muted-foreground mt-1 text-[13px]">{{ p.state.status === 'accepted' ? 'Sent to the RMS as a task for the revenue manager.' : (p.state.reason ?? 'Logged by you.') }} <button type="button" class="text-foreground underline underline-offset-2" (click)="undo(d)">Undo</button></p>
            } @else if (d.target) {
              <p class="mt-1 text-[20px]/snug font-semibold">{{ d.kind === 'lower' ? 'Lower' : 'Raise' }} BAR from <span class="text-muted-foreground">{{ eur(d.night.bar) }}</span> to {{ eur(adjusted() ?? d.target) }}</p>
            } @else {
              <p class="mt-1 text-[20px]/snug font-semibold">Open a 2-night package</p>
            }
            @if (!p.state) {
              <p class="text-muted-foreground mt-1 text-[13px] tabular-nums">Up to +{{ k(d.impact) }} if the {{ p.night.avail - p.night.roomsSold }} unsold rooms sell</p>
            }
          } @else {
            <p class="text-muted-foreground text-[13.5px]">No recommendation for this night. Pace and price are within normal range.</p>
          }

          <dl class="border-border mt-5 divide-y divide-(--border) border-y text-[13.5px]">
            <div class="flex justify-between gap-4 py-2.5"><dt class="text-muted-foreground">On the books</dt><dd class="text-right tabular-nums">{{ p.occ.toFixed(0) }}% ({{ p.night.roomsSold }} of {{ p.night.avail }}) · LY {{ p.occLy.toFixed(0) }}%</dd></div>
            <div class="flex justify-between gap-4 py-2.5"><dt class="text-muted-foreground">Pickup, last 7 days</dt><dd class="text-right tabular-nums">+{{ p.pickup }} rooms · LY +{{ p.pickupLy }}</dd></div>
            <div class="flex justify-between gap-4 py-2.5"><dt class="text-muted-foreground">BAR vs market median</dt><dd class="text-right tabular-nums">{{ eur(p.night.bar) }} vs {{ p.night.compMedian === null ? 'no median' : eur(p.night.compMedian) }} · {{ p.market.soldOut }} of {{ p.market.count }} sold out</dd></div>
          </dl>

          <p class="text-muted-foreground mt-5 text-[12px]">Booking pace · this year vs same time last year</p>
          <app-pace-chart class="mt-2" [ty]="p.curve.ty" [ly]="p.curve.ly" [height]="120" [tyLabel]="p.occ.toFixed(0) + '%'" [lyLabel]="p.occLy.toFixed(0) + '%'" [gapLabel]="(p.occ >= p.occLy ? '+' : '−') + abs(p.occ - p.occLy).toFixed(0) + ' pts'" />

          <p class="text-muted-foreground mt-6 text-[12px]">Market for this night</p>
          <div class="relative mt-3 h-8">
            <div class="absolute inset-x-0 top-1/2 h-px bg-(--border)"></div>
            @for (c of p.market.comps; track $index) {
              <span class="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#6b7580]" [style.left.%]="c" ></span>
            }
            @if (p.market.median !== null) {
              <span class="absolute top-1 bottom-1 w-px bg-(--text-1)/50" [style.left.%]="p.market.median"></span>
            }
            <span class="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--text-1) ring-2 ring-(--card)" [style.left.%]="p.market.ours"></span>
            @if (p.market.rec !== null) {
              <span class="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-(--decision)" [style.left.%]="p.market.rec"></span>
            }
          </div>
          <div class="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
            <span class="flex items-center gap-1.5"><i class="size-2.5 rounded-full bg-[#6b7580]"></i>Competitors</span>
            <span class="flex items-center gap-1.5"><i class="h-3 w-px bg-(--text-1)/50"></i>Median {{ p.night.compMedian === null ? '—' : eur(p.night.compMedian) }}</span>
            <span class="flex items-center gap-1.5"><i class="size-2.5 rounded-full bg-(--text-1)"></i>You {{ eur(p.night.bar) }}</span>
            @if (p.decision?.target) {
              <span class="flex items-center gap-1.5"><i class="size-3 rounded-full ring-2 ring-(--decision) ring-inset"></i>Recommended</span>
            }
          </div>

          <p class="text-muted-foreground mt-6 text-[12px]">On the books as of Fri 20 Nov · latest rate shops · <button type="button" class="hover:text-foreground underline underline-offset-2" (click)="explain(p.night)">How this is calculated ›</button></p>
        </div>

        @if (p.decision && !p.state) {
          <footer class="border-border border-t bg-(--card) px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom,0px))]">
            @if (keeping()) {
              <p class="text-[13px] font-medium">Why keep {{ eur(p.night.bar) }}? <span class="text-muted-foreground font-normal">Optional</span></p>
              <div class="mt-2 flex flex-wrap gap-2">
                @for (r of keepReasons; track r) {
                  <button hlmBtn variant="secondary" size="sm" class="font-normal" (click)="keep(p.decision, r)">{{ r }}</button>
                }
              </div>
              <div class="mt-3 flex gap-2">
                <button hlmBtn variant="outline" size="sm" (click)="keep(p.decision)">Keep without a reason</button>
                <button hlmBtn variant="ghost" size="sm" (click)="keeping.set(false)">Back</button>
              </div>
            } @else {
              @if (adjusted() !== null && p.decision.target) {
                <div class="mb-3 flex items-center justify-between gap-3">
                  <span class="text-[13px]">Adjust price</span>
                  <span class="flex items-center gap-1">
                    <button hlmBtn variant="outline" size="icon-sm" aria-label="Lower by €5" (click)="nudge(-5)">−</button>
                    <span class="w-14 text-center text-[15px] font-semibold tabular-nums" aria-live="polite">{{ eur(adjusted()!) }}</span>
                    <button hlmBtn variant="outline" size="icon-sm" aria-label="Raise by €5" (click)="nudge(5)">+</button>
                  </span>
                </div>
              }
              <div class="flex flex-wrap gap-2">
                <button hlmBtn class="flex-1" (click)="accept(p.decision, adjusted() ?? undefined)">{{ p.decision.target ? 'Accept ' + eur(adjusted() ?? p.decision.target) : 'Accept package' }}</button>
                @if (p.decision.target) {
                  <button hlmBtn variant="outline" (click)="adjusted() === null ? adjusted.set(p.decision.target) : adjusted.set(null)">{{ adjusted() === null ? 'Adjust' : 'Reset' }}</button>
                }
                <button hlmBtn variant="ghost" (click)="keeping.set(true)">{{ p.decision.target ? 'Keep ' + eur(p.night.bar) : 'Dismiss' }}</button>
              </div>
            }
          </footer>
        }
      </aside>
    }
  `,
})
export class DecisionsWidget {
  protected readonly store = inject(CompassStore);
  protected readonly tab = signal<'pending' | 'decided'>('pending');
  protected readonly view = signal<'list' | 'calendar'>('list');
  protected readonly month = signal<10 | 11>(11);
  protected readonly selected = signal<number | null>(null);
  protected readonly adjusted = signal<number | null>(null);
  protected readonly keeping = signal(false);
  protected readonly weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  protected readonly bins = BINS;
  protected readonly keepReasons = ['Group block expected', 'Event not in data', 'Other'];
  protected readonly eur = formatEur;
  protected readonly k = k;
  protected readonly abs = Math.abs;

  private readonly all = decisionNights();
  private readonly byDate = new Map(this.all.map((d) => [d.night.date, d]));
  private readonly forward = NIGHTS.forward;

  protected readonly rows = computed<Row[]>(() => {
    const m = this.store.nightDecisions();
    return this.all.map((d) => ({ d, state: m[d.night.date] }));
  });
  protected readonly pending = computed(() => this.rows().filter((r) => !r.state));
  protected readonly decided = computed(() => this.rows().filter((r) => r.state));
  protected readonly stake = computed(() => this.pending().reduce((s, r) => s + r.d.impact, 0));

  protected readonly cells = computed<(Cell | null)[]>(() => {
    const m = this.store.nightDecisions();
    const month = this.month();
    const first = Date.UTC(2026, month, 1);
    const days = new Date(Date.UTC(2026, month + 1, 0)).getUTCDate();
    const lead = (new Date(first).getUTCDay() + 6) % 7; // Monday first
    const all = [...NIGHTS.past, ...NIGHTS.forward];
    const out: (Cell | null)[] = Array(lead).fill(null);
    for (let day = 1; day <= days; day++) {
      const date = Date.UTC(2026, month, day);
      out.push({
        day,
        date,
        night: all.find((n) => n.date === date),
        past: date < BUSINESS_DAY,
        today: date === BUSINESS_DAY,
        decision: this.byDate.get(date),
        state: m[date],
      });
    }
    return out;
  });

  protected readonly panel = computed(() => {
    const date = this.selected();
    if (date === null) return null;
    const idx = this.forward.findIndex((n) => n.date === date);
    if (idx < 0) return null;
    const night = this.forward[idx];
    const decision = this.byDate.get(date);
    const occ = (night.roomsSold / night.avail) * 100;
    const occLy = (night.roomsSoldStly / night.avail) * 100;
    const lead = Math.round((date - BUSINESS_DAY) / DAY);
    const iso = new Date(date).toISOString().slice(0, 10);
    // Pickup = rooms on the books today minus 7 days ago, at the same lead time last year (otb_as_of curves).
    const c = (FOCUS_CURVES as unknown as Record<string, { ty: (number | null)[]; ly: number[] }>)[iso];
    const at = (arr: (number | null)[], L: number) => (L <= 90 ? (arr[90 - L] ?? 0) : 0);
    const pickup = c ? at(c.ty, lead) - at(c.ty, lead + 7) : 0;
    const pickupLy = c ? at(c.ly, lead) - at(c.ly, lead + 7) : 0;
    // Competitors' latest shopped rates (AED → EUR); sold-out competitors have no rate.
    const shops = ((FOCUS_COMPS as unknown as Record<string, { name: string; rate: number | null }[]>)[iso] ?? []).map((x) => (x.rate === null ? null : x.rate * HOTEL.fx));
    const priced = shops.filter((v): v is number => v !== null);
    const rec = decision?.target ?? null;
    const vals = [...priced, night.bar, rec ?? night.bar];
    const lo = Math.min(...vals) * 0.92;
    const hi = Math.max(...vals) * 1.04;
    const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;
    const curve = paceFor(date) ?? { ty: [], ly: [], from: 90 };
    return {
      night,
      decision,
      state: this.store.nightDecisions()[date],
      occ,
      occLy,
      lead,
      pickup: Math.max(0, pickup),
      pickupLy: Math.max(0, pickupLy),
      curve,
      market: {
        comps: priced.map(pos),
        median: night.compMedian === null ? null : pos(night.compMedian),
        ours: pos(night.bar),
        rec: rec === null ? null : pos(rec),
        soldOut: shops.length - priced.length,
        count: shops.length,
      },
      prev: this.forward[idx - 1]?.date,
      next: this.forward[idx + 1]?.date,
    };
  });

  protected short(d: number) {
    return fmtShort.format(d);
  }
  protected long(d: number) {
    return fmtLong.format(d);
  }
  protected occ(n: Night) {
    return (n.roomsSold / n.avail) * 100;
  }
  protected bin(n: Night) {
    return BINS[Math.min(4, Math.floor(this.occ(n) / 20))];
  }
  protected verb(d: Decision) {
    return d.kind === 'package' ? 'Open a 2-night package' : `${d.kind === 'lower' ? 'Lower' : 'Raise'} BAR to`;
  }
  protected stateText(r: Row) {
    if (!r.state) return '';
    if (r.state.status === 'kept') return r.d.target ? `Kept ${formatEur(r.d.night.bar)}` : 'Dismissed';
    return r.d.target ? `Sent to RMS · ${formatEur(r.state.price ?? r.d.target)}${r.state.price && r.state.price !== r.d.target ? ' (adjusted)' : ''} · ${r.state.time}` : `Package sent to RMS · ${r.state.time}`;
  }
  protected label(r: Row) {
    return `${this.short(r.d.night.date)}: ${r.state ? this.stateText(r) : r.d.action}. ${r.d.reason}. Open details`;
  }
  protected cellLabel(c: Cell) {
    if (!c.night) return `${c.day}: no data`;
    const pending = c.decision && !c.state ? `, needs a decision: ${c.decision.action}` : '';
    return `${this.long(c.date)}, BAR ${formatEur(c.night.bar)}, ${this.occ(c.night).toFixed(0)}% on the books${c.night.event ? ', ' + c.night.event : ''}${pending}`;
  }
  protected acceptLabel(d: Decision) {
    return d.target ? `Accept ${formatEur(d.target)} for ${this.short(d.night.date)}` : `Accept the package for ${this.short(d.night.date)}`;
  }
  protected keepLabel(d: Decision) {
    return d.target ? `Keep ${formatEur(d.night.bar)} for ${this.short(d.night.date)}` : `Dismiss for ${this.short(d.night.date)}`;
  }

  protected open(date: number) {
    this.selected.set(date);
    this.adjusted.set(null);
    this.keeping.set(false);
  }
  close() {
    if (this.selected() !== null) this.selected.set(null);
  }
  protected nudge(by: number) {
    this.adjusted.update((v) => (v === null ? v : Math.max(80, v + by)));
  }
  protected accept(d: Decision, price?: number) {
    this.store.decideNights([d.night.date], { status: 'accepted', price: price ?? d.target, time: '08:20' });
    this.adjusted.set(null);
  }
  protected keep(d: Decision, reason?: string) {
    this.store.decideNights([d.night.date], { status: 'kept', time: '08:20', reason: reason && reason !== 'Other' ? reason : undefined });
    this.keeping.set(false);
  }
  protected undo(d: Decision) {
    this.store.decideNights([d.night.date], null);
  }
  protected explain(n: Night) {
    this.close();
    this.store.askNew(`How is the recommendation for ${this.short(n.date)} calculated?`);
  }
}
