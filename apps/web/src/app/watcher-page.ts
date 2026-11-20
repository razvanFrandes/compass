import { Component, DOCUMENT, ElementRef, afterNextRender, computed, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { formatEur, formatLocal } from './data';
import { CompassStore, DECISIONS, DECISION_DATES, DECISION_ID, DECISION_UNSOLD, DECISION_UPSIDE, TOPICS, Watcher } from './store';
import { DEFAULT_SETTINGS, LEVELS, OUTCOME_LABEL, RunRecord, STATUS, WATCHER_SETTINGS, runDay, runHistory, runTime, runWhen } from './watcher-data';
import * as icons from './icons';

type Notify = 'needs' | 'every' | 'never';

/*
  The watcher page (docs/research/ui-round3/agents_pattern.md §5.7): a full page, not a drawer,
  because run history and settings need room. Order: header → pending decision → four stat tiles →
  run history (strip + run log) → activity → settings. The strip uses the card's encoding
  (height = found something), and each bar is reachable with the arrow keys (one tab stop).
*/
@Component({
  selector: 'app-watcher-page',
  imports: [NgIcon, HlmButtonImports, HlmDropdownMenuImports, HlmSwitchImports],
  providers: [provideIcons({ ...icons })],
  host: { class: 'block' },
  template: `
    @if (w(); as w) {
      <div class="mx-auto flex max-w-[1180px] flex-col gap-6 px-[max(16px,env(safe-area-inset-left,0px))] pt-3 pb-28 sm:px-8 lg:pt-6">
        <nav aria-label="Breadcrumb" class="flex min-w-0 items-center gap-1 text-[14px]">
          <button hlmBtn variant="ghost" size="sm" class="text-muted-foreground -ml-2.5" (click)="store.go('watchers')"><ng-icon name="phosphorArrowLeftLight" />Watchers</button>
          <span class="text-muted-foreground" aria-hidden="true">/</span>
          <span class="truncate px-1.5" aria-current="page">{{ w.name }}</span>
        </nav>

        <header class="flex flex-wrap items-start gap-4">
          <span class="watcher-glyph grid size-12 shrink-0 place-items-center rounded-[14px]"><ng-icon [name]="w.glyph" class="text-[26px]" /></span>
          <div class="min-w-0 flex-1 basis-[260px]">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 class="text-[24px]/tight font-semibold tracking-[-0.02em] sm:text-[28px]/tight">{{ w.name }}</h1>
              <span class="status-chip" [class]="status[w.status].cls">
                @if (w.status === 'running') {
                  <ng-icon name="phosphorCircleNotchLight" class="motion-safe:animate-spin" />
                } @else if (w.status === 'paused') {
                  <ng-icon name="phosphorPauseFill" class="text-[10px]" />
                } @else {
                  <i class="size-1.5 rounded-full bg-current"></i>
                }
                {{ status[w.status].label }}
              </span>
            </div>
            <p class="mt-2 max-w-[62ch] text-[15px]/relaxed">
              @for (s of w.sentence; track $index) {
                @if (s.b) {
                  <strong class="font-semibold">{{ s.t }}</strong>
                } @else {
                  <span class="text-muted-foreground">{{ s.t }}</span>
                }
              }
            </p>
          </div>
          <div class="flex w-full items-center gap-2 sm:w-auto">
            <label class="mr-1 flex items-center gap-2 text-[13px] [@media(pointer:coarse)]:min-h-11">
              <hlm-switch [checked]="w.enabled" (checkedChange)="store.setEnabled(w.id, $event)" [attr.aria-label]="w.name + ' watcher'" />
              <span [class.text-muted-foreground]="!w.enabled">{{ w.enabled ? 'On' : 'Paused' }}</span>
            </label>
            <span class="flex-1 sm:hidden"></span>
            @if (w.status !== 'needs') {
              <button hlmBtn variant="outline" [disabled]="w.status === 'running'" (click)="store.runNow(w.id)">
                <ng-icon [name]="w.status === 'running' ? 'phosphorCircleNotchLight' : 'phosphorPlayLight'" [class]="w.status === 'running' ? 'motion-safe:animate-spin' : ''" />{{ w.status === 'running' ? 'Running…' : 'Run now' }}
              </button>
            }
            <button hlmBtn variant="ghost" size="icon" [attr.aria-label]="'More for ' + w.name" [hlmDropdownMenuTrigger]="more" align="end"><ng-icon name="phosphorDotsThreeBold" class="text-[18px]" /></button>
            <ng-template #more>
              <hlm-dropdown-menu class="w-56">
                <button hlmDropdownMenuItem (triggered)="store.askNew('Explain what the ' + w.name + ' watcher checks and why')"><ng-icon name="phosphorSparkleFill" class="text-(--brand)" />Ask about this watcher</button>
                @if (w.enabled) {
                  <button hlmDropdownMenuItem (triggered)="store.pauseUntil(w.id, 'Tue 1 Dec')"><ng-icon name="phosphorPauseLight" />Pause until 1 Dec</button>
                }
                <button hlmDropdownMenuItem (triggered)="store.duplicateWatcher(w.id)"><ng-icon name="phosphorCopyLight" />Duplicate</button>
                <hlm-dropdown-menu-separator />
                <button hlmDropdownMenuItem variant="destructive" (triggered)="store.deleteWatcher(w.id)"><ng-icon name="phosphorTrashLight" />Delete</button>
              </hlm-dropdown-menu>
            </ng-template>
          </div>
        </header>

        <!-- Pending decision, pinned at the top (the approval card from ai-ux/README.md) -->
        @if (w.id === 'rate') {
          @if (decided(); as d) {
            <section class="watcher-card flex flex-wrap items-center gap-3 p-4" aria-live="polite">
              <ng-icon name="phosphorCheckCircleLight" class="shrink-0 text-[20px]" />
              <p class="min-w-0 flex-1 text-[14px]">
                @if (d.accepted) {
                  Approved {{ d.accepted }} rates for Dubai Business Bay, 16–18 Dec · sent to the revenue manager as RMS tasks · {{ d.time }}
                } @else {
                  Kept today’s rates for Dubai Business Bay, 16–18 Dec · logged {{ d.time }}
                }
              </p>
              <button hlmBtn variant="ghost" size="sm" (click)="store.decideNights(dates, null)">Undo</button>
            </section>
          } @else if (w.status === 'needs') {
            <section class="decision-card rounded-[16px] p-5" aria-labelledby="w-decision">
              <p class="text-[12px] font-medium tracking-[0.06em] text-(--decision) uppercase">Needs your decision</p>
              <div class="mt-2 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h2 id="w-decision" class="text-[18px] font-semibold">Dubai Business Bay · {{ proposal.title }}</h2>
                <p class="text-muted-foreground text-[13px] tabular-nums">Up to +€{{ (upside() / 1000).toFixed(1) }}k if the {{ unsold }} unsold rooms sell</p>
              </div>
              <ul class="mt-4 grid grid-cols-3 gap-2" aria-label="Nights and rates">
                @for (n of nightsView(); track n.date) {
                  <li class="rounded-[10px] bg-(--card) p-3 ring-1 ring-(--field-border)">
                    <p class="text-muted-foreground text-[12px]">{{ n.day }}</p>
                    <p class="mt-1 text-[15px] font-semibold tabular-nums"><span class="text-muted-foreground font-normal">{{ n.from }} →</span> {{ n.to }}</p>
                    <p class="text-muted-foreground text-[12px] tabular-nums">{{ n.full }}% full · {{ n.local }}</p>
                  </li>
                }
              </ul>
              <ul class="mt-3 flex flex-wrap gap-2" aria-label="Why">
                @for (e of evidence; track e) {
                  <li class="evidence-chip">{{ e }}</li>
                }
              </ul>
              <div class="mt-5 flex flex-wrap items-center gap-2">
                @if (adjusting()) {
                  <div class="flex items-center gap-1 rounded-[10px] border border-(--field-border) p-1" role="group" aria-label="Adjust every night by €5">
                    <button hlmBtn variant="ghost" size="icon-sm" aria-label="€5 lower on every night" (click)="delta.set(delta() - 5)"><ng-icon name="phosphorMinusLight" /></button>
                    <span class="w-14 text-center text-[14px] font-semibold tabular-nums" aria-live="polite">{{ delta() >= 0 ? '+' : '−' }}€{{ abs(delta()) }}</span>
                    <button hlmBtn variant="ghost" size="icon-sm" aria-label="€5 higher on every night" (click)="delta.set(delta() + 5)"><ng-icon name="phosphorPlusLight" /></button>
                  </div>
                }
                <button hlmBtn class="w-full sm:w-auto [@media(pointer:coarse)]:h-11" (click)="approve()">Approve {{ dates.length }} rates</button>
                @if (!adjusting()) {
                  <button hlmBtn variant="outline" (click)="adjusting.set(true)">Adjust</button>
                }
                <button hlmBtn variant="ghost" (click)="dismiss()">Keep today’s rates</button>
                <button type="button" class="text-muted-foreground hover:text-foreground text-[13px] underline underline-offset-2 sm:ml-auto" (click)="store.openItem(decisionId)">How this was computed ›</button>
              </div>
              <p class="text-muted-foreground mt-3 text-[12px]">Compass only reads your data. Approving sends each rate to the revenue manager as an RMS task.</p>
            </section>
          }
        }

        <!-- Four stat tiles -->
        <ul class="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
          @for (s of stats(); track s.label) {
            <li class="watcher-card p-4">
              <p class="text-muted-foreground text-[12px]">{{ s.label }}</p>
              <p class="mt-1 text-[20px]/tight font-semibold tracking-[-0.01em] tabular-nums">{{ s.value }}</p>
              <p class="text-muted-foreground mt-0.5 text-[12px]">{{ s.sub }}</p>
            </li>
          }
        </ul>

        <!-- Run history -->
        <section id="w-history" class="watcher-card scroll-mt-6 p-5" aria-labelledby="w-history-title">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="w-history-title" class="text-[16px] font-semibold">Run history</h2>
              <p class="text-muted-foreground mt-0.5 text-[13px]">{{ summary() }}</p>
            </div>
            @if (history().length > 30) {
              <div class="seg" role="radiogroup" aria-label="How many runs">
                @for (o of ranges; track o.v) {
                  <button type="button" role="radio" [attr.aria-checked]="range() === o.v" (click)="setRange(o.v)">{{ o.label }}</button>
                }
              </div>
            }
          </div>

          @if (!history().length) {
            <div class="latest-panel mt-4 flex flex-wrap items-center gap-3 rounded-[12px] p-4">
              <p class="min-w-0 flex-1 text-[14px]">No runs yet · {{ w.next ?? 'paused' }}. Run it once now to see what it finds.</p>
              <button hlmBtn variant="outline" size="sm" [disabled]="w.status === 'running'" (click)="store.runNow(w.id)"><ng-icon name="phosphorPlayLight" />Run now</button>
            </div>
          } @else {
            <div class="relative mt-7">
              @if (tip(); as t) {
                <div class="run-tip" [style.left]="'clamp(110px, ' + t.x + '%, calc(100% - 110px))'" aria-hidden="true">{{ t.label }}</div>
              }
              <div #strip class="run-strip run-strip--lg" role="group" aria-label="Runs, oldest to newest. Use the arrow keys to move between runs.">
                @for (r of shown(); track r.i) {
                  <button
                    type="button"
                    class="run-hit"
                    [attr.tabindex]="r.i === focusIdx() ? 0 : -1"
                    [attr.aria-label]="runLabel(r)"
                    [attr.aria-pressed]="selected() === r.i"
                    (click)="pick(r.i)"
                    (mouseenter)="hovered.set(r.i)"
                    (mouseleave)="hovered.set(null)"
                    (focus)="hovered.set(r.i)"
                    (blur)="hovered.set(null)"
                    (keydown)="onStripKey($event)"
                  >
                    <i [class]="'run run--' + r.outcome"></i>
                  </button>
                }
              </div>
              <div class="text-muted-foreground mt-2 flex justify-between text-[12px] tabular-nums">
                <span>{{ when(shown()[0].at) }}</span>
                <span>{{ when(shown()[shown().length - 1].at) }}</span>
              </div>
            </div>
            <ul class="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px]" aria-label="Legend">
              <li class="flex items-center gap-1.5"><i class="legend-run run"></i>No change</li>
              <li class="flex items-center gap-1.5"><i class="legend-run run run--finding"></i>Found something</li>
              <li class="flex items-center gap-1.5"><i class="legend-run run run--pending"></i>Needs you</li>
              <li class="flex items-center gap-1.5"><i class="legend-run run run--failed"></i>Couldn’t run</li>
              <li class="flex items-center gap-1.5"><i class="legend-run run run--skipped"></i>Skipped</li>
            </ul>

            <div class="mt-5 border-t border-(--border) pt-1">
              @if (selected() !== null) {
                <div class="flex items-center justify-between gap-2 py-1.5 text-[13px]">
                  <span class="text-muted-foreground">One run selected</span>
                  <button hlmBtn variant="ghost" size="sm" (click)="pick(null)">Show latest runs</button>
                </div>
              }
              <ul>
                @for (r of logRows(); track r.i) {
                  <li class="border-b border-(--border) last:border-b-0">
                    <button type="button" class="run-row" [attr.aria-expanded]="open() === r.i" (click)="open.set(open() === r.i ? null : r.i)">
                      <span class="run-row__when">{{ when(r.at) }}</span>
                      <span class="run-row__what"><i [class]="'run-dot run-dot--' + r.outcome" aria-hidden="true"></i><span class="sr-only">{{ outcome[r.outcome] }}:</span><span class="truncate max-sm:line-clamp-2 max-sm:whitespace-normal">{{ r.text }}</span></span>
                      <span class="run-row__dur">{{ r.duration }}</span>
                      <ng-icon name="phosphorCaretDownLight" class="text-muted-foreground transition-transform" [class.rotate-180]="open() === r.i" />
                    </button>
                    @if (open() === r.i) {
                      <ol class="run-steps" [attr.aria-label]="'Steps for the run on ' + when(r.at)">
                        @for (st of r.steps; track $index) {
                          <li>{{ st }}</li>
                        }
                      </ol>
                    }
                  </li>
                }
              </ul>
              @if (selected() === null && logLimit() < shown().length) {
                <button hlmBtn variant="ghost" size="sm" class="mt-2" (click)="logLimit.set(logLimit() + 10)">Show 10 more</button>
              }
            </div>
          }
        </section>

        <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <!-- Activity: this watcher's runs and people's actions in one timeline -->
          <section class="watcher-card p-5" aria-labelledby="w-activity-title">
            <h2 id="w-activity-title" class="text-[16px] font-semibold">Activity</h2>
            <p class="text-muted-foreground mt-0.5 text-[13px]">What it did and what people changed. Every action is logged.</p>
            <div class="mt-3 flex flex-col gap-2">
              @for (g of activity(); track g.day) {
                <div>
                  <h3 class="timeline-day">{{ g.day }}</h3>
                  <ol class="timeline-items">
                    @for (a of g.items; track $index) {
                      <li class="timeline-item">
                        @if (a.by) {
                          <span class="timeline-node timeline-node--you" aria-label="You">Y</span>
                        } @else {
                          <span class="timeline-node" aria-hidden="true"><ng-icon [name]="w.glyph" class="text-[16px]" /></span>
                        }
                        <div class="min-w-0 flex-1">
                          <p class="text-[13.5px]/snug">{{ a.text }}</p>
                          <p class="text-muted-foreground text-[12px] tabular-nums">{{ a.time }}</p>
                        </div>
                      </li>
                    }
                  </ol>
                </div>
              }
            </div>
          </section>

          <!-- Settings, as sections on the same page -->
          <section id="w-settings" class="watcher-card scroll-mt-6 p-5" aria-labelledby="w-settings-title">
            <div class="flex items-baseline justify-between gap-3">
              <h2 id="w-settings-title" class="text-[16px] font-semibold">Settings</h2>
              <p class="text-muted-foreground text-[12px]" aria-live="polite">{{ saved() ? 'Saved · applies from the next run' : 'Changes apply from the next run' }}</p>
            </div>

            <div class="settings-row">
              <div>
                <h3 class="settings-label">Schedule</h3>
                <p class="settings-help">When Kassandra runs this check.</p>
              </div>
              <div>
                @if (isDays()) {
                  <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Days">
                    @for (d of dayNames; track d; let i = $index) {
                      <button type="button" class="day-toggle" [attr.aria-pressed]="days()[i]" [attr.aria-label]="d" (click)="toggleDay(i)">{{ d[0] }}</button>
                    }
                  </div>
                  <label class="mt-3 flex items-center gap-2 text-[13px]">
                    <span class="text-muted-foreground">at</span>
                    <select class="field-select" (change)="time.set($any($event.target).value); markSaved()">
                      @for (t of times; track t) {
                        <option [value]="t" [selected]="t === time()">{{ t }}</option>
                      }
                    </select>
                  </label>
                } @else {
                  <label class="flex items-center gap-2 text-[13px]">
                    <span class="text-muted-foreground">Every</span>
                    <select class="field-select" (change)="hours.set(+$any($event.target).value); markSaved()">
                      @for (h of intervals; track h) {
                        <option [value]="h" [selected]="h === hours()">{{ h }} h</option>
                      }
                    </select>
                  </label>
                }
              </div>
            </div>

            <div class="settings-row">
              <div>
                <h3 class="settings-label">Scope</h3>
                <p class="settings-help">What it looks at.</p>
              </div>
              <ul class="flex flex-wrap gap-2">
                @for (x of settings().scope; track x) {
                  <li class="scope-chip">{{ x }}</li>
                }
              </ul>
            </div>

            <div class="settings-row">
              <div>
                <h3 class="settings-label">Threshold</h3>
                <p class="settings-help">{{ settings().threshold.label }}</p>
              </div>
              <div class="flex items-center gap-1" role="group" [attr.aria-label]="settings().threshold.label">
                <button hlmBtn variant="outline" size="icon-sm" aria-label="Lower" (click)="nudge(-1)"><ng-icon name="phosphorMinusLight" /></button>
                <span class="min-w-[72px] text-center text-[15px] font-semibold tabular-nums" aria-live="polite">{{ threshold() }} {{ settings().threshold.unit }}</span>
                <button hlmBtn variant="outline" size="icon-sm" aria-label="Higher" (click)="nudge(1)"><ng-icon name="phosphorPlusLight" /></button>
              </div>
            </div>

            <div class="settings-row">
              <div>
                <h3 class="settings-label">Autonomy</h3>
                <p class="settings-help">How far it goes before stopping for you.</p>
              </div>
              <div class="flex flex-col gap-2" role="radiogroup" aria-label="Autonomy">
                @for (l of levels; track l.level) {
                  <label class="option-card">
                    <input type="radio" class="sr-only" [name]="'autonomy-' + w.id" [checked]="autonomyView() === l.level" [disabled]="l.level === 3" (change)="chooseAutonomy(w, l.level)" />
                    <span class="option-radio" aria-hidden="true"></span>
                    <span class="min-w-0 flex-1">
                      <span class="flex items-center gap-1.5 text-[14px] font-medium">{{ l.name }}
                        @if (l.level === 3) {
                          <ng-icon name="phosphorLockSimpleLight" aria-label="Locked" />
                        }
                      </span>
                      <span class="text-muted-foreground block text-[12.5px]/snug">{{ l.text }}</span>
                    </span>
                    <span class="flex shrink-0 gap-[3px] pt-1.5" aria-hidden="true">
                      @for (sg of segs; track sg) {
                        <i class="meter-seg" [class.is-on]="sg <= l.level"></i>
                      }
                    </span>
                  </label>
                }
              </div>
            </div>

            <div class="settings-row">
              <div>
                <h3 class="settings-label">Notifications</h3>
                <p class="settings-help">Routine runs never notify you.</p>
              </div>
              <div class="flex flex-col gap-2" role="radiogroup" aria-label="Notifications">
                @for (n of notifyOptions; track n.v) {
                  <label class="option-card">
                    <input type="radio" class="sr-only" [name]="'notify-' + w.id" [checked]="notify() === n.v" (change)="notify.set(n.v); markSaved()" />
                    <span class="option-radio" aria-hidden="true"></span>
                    <span class="min-w-0 flex-1 text-[14px]">{{ n.label }}
                      @if (n.hint) {
                        <span class="text-muted-foreground block text-[12.5px]/snug">{{ n.hint }}</span>
                      }
                    </span>
                  </label>
                }
              </div>
            </div>

            <div class="settings-row">
              <div>
                <h3 class="settings-label">Data it reads</h3>
                <p class="settings-help">Read-only, from the isolated analytics copy. Never your live systems.</p>
              </div>
              <ul class="flex flex-wrap gap-2">
                @for (t of settings().reads; track t) {
                  <li class="scope-chip font-mono text-[12.5px]"><ng-icon name="phosphorDatabaseLight" class="text-muted-foreground" />{{ t }}</li>
                }
              </ul>
            </div>
          </section>
        </div>
      </div>

      <!-- Raising autonomy asks first, in one sentence (Mercury's rule confirmation) -->
      <dialog #confirm class="confirm-dialog" aria-labelledby="w-confirm-title" (close)="cancelAutonomy()">
        <h2 id="w-confirm-title" class="text-[16px] font-semibold">Let {{ w.name }} recommend rates?</h2>
        <p class="text-muted-foreground mt-2 text-[14px]/relaxed">It will propose a rate with its reasons when it finds something. Nothing changes until you approve, and approving only logs a task for the revenue manager.</p>
        <div class="mt-5 flex justify-end gap-2">
          <button hlmBtn variant="ghost" (click)="confirmEl()?.nativeElement?.close()">Cancel</button>
          <button hlmBtn (click)="applyAutonomy(w)">Allow recommendations</button>
        </div>
      </dialog>
    } @else {
      <div class="mx-auto max-w-[1180px] px-8 py-10">
        <p class="text-muted-foreground">This watcher no longer exists.</p>
        <button hlmBtn variant="outline" class="mt-4" (click)="store.go('watchers')">Back to Watchers</button>
      </div>
    }
  `,
})
export class WatcherPage {
  protected readonly store = inject(CompassStore);
  private readonly doc = inject(DOCUMENT);
  protected readonly status = STATUS;
  protected readonly levels = LEVELS;
  protected readonly outcome = OUTCOME_LABEL;
  protected readonly segs = [1, 2, 3];
  protected readonly dates = DECISION_DATES;
  protected readonly decisionId = DECISION_ID;
  protected readonly unsold = DECISION_UNSOLD;
  protected readonly proposal = TOPICS[DECISION_ID].proposal!;
  protected readonly evidence = [
    '✦ Gulf Tech Week · 15–19 Dec',
    `${(DECISIONS.reduce((s, d) => s + d.night.barLocal / (d.night.compLocal ?? 1), 0) / DECISIONS.length).toFixed(2)}× the comp set`,
    `${Math.max(...DECISIONS.map((d) => d.night.compsSoldOut))} competitors sold out`,
    `${Math.round(Math.max(...DECISIONS.map((d) => d.occ)))}% full at the peak`,
  ];
  protected readonly abs = Math.abs;
  protected readonly dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  protected readonly times = ['05:00', '06:00', '07:00', '08:00', '09:00'];
  protected readonly intervals = [1, 2, 4, 6];
  protected readonly ranges = [
    { v: 30 as const, label: '30' },
    { v: 90 as const, label: '90' },
    { v: 0 as const, label: 'All' },
  ];
  protected readonly notifyOptions: { v: Notify; label: string; hint?: string }[] = [
    { v: 'needs', label: 'Only when it needs you or can’t run', hint: 'Recommended' },
    { v: 'every', label: 'After every run' },
    { v: 'never', label: 'Never', hint: 'Check this page yourself' },
  ];
  protected readonly when = runWhen;
  protected readonly eur = formatEur;

  protected readonly w = computed(() => this.store.watchers().find((x) => x.id === this.store.activeWatcherId()) ?? null);
  protected readonly settings = computed(() => WATCHER_SETTINGS[this.w()?.id ?? ''] ?? DEFAULT_SETTINGS);
  protected readonly history = computed(() => {
    const w = this.w();
    return w ? runHistory(w) : [];
  });

  // Run history: phones start with 30 runs, wider screens with 90.
  protected readonly range = signal<30 | 90 | 0>(this.doc.defaultView?.matchMedia('(max-width: 639px)').matches ? 30 : 90);
  protected readonly shown = computed(() => {
    const h = this.history();
    const r = this.range();
    return r ? h.slice(-r) : h;
  });
  protected readonly selected = signal<number | null>(null);
  protected readonly hovered = signal<number | null>(null);
  protected readonly open = signal<number | null>(null);
  protected readonly logLimit = signal(6);
  protected readonly focusIdx = computed(() => this.selected() ?? this.shown().at(-1)?.i ?? 0);
  private readonly strip = viewChild<ElementRef<HTMLElement>>('strip');
  protected readonly confirmEl = viewChild<ElementRef<HTMLDialogElement>>('confirm');

  protected readonly tip = computed(() => {
    const i = this.hovered();
    if (i === null) return null;
    const list = this.shown();
    const k = list.findIndex((r) => r.i === i);
    if (k < 0) return null;
    const r = list[k];
    return { x: ((k + 0.5) / list.length) * 100, label: `${runWhen(r.at)} · ${this.outcome[r.outcome]} · ${r.duration}` };
  });
  protected readonly logRows = computed(() => {
    const sel = this.selected();
    if (sel !== null) return this.history().filter((r) => r.i === sel);
    return [...this.shown()].reverse().slice(0, this.logLimit());
  });
  protected readonly summary = computed(() => {
    const s = this.shown();
    if (!s.length) return 'Nothing has run yet.';
    const found = s.filter((r) => r.outcome === 'finding' || r.outcome === 'pending').length;
    const failed = s.filter((r) => r.outcome === 'failed').length;
    return `${s.length} runs · ${found} ${found === 1 ? 'finding' : 'findings'} · ${failed} couldn’t run`;
  });
  protected readonly stats = computed(() => {
    const w = this.w();
    if (!w) return [];
    const h = this.history();
    const last = h.filter((r) => r.outcome !== 'skipped').at(-1);
    const last30 = h.slice(-30);
    const found = last30.filter((r) => r.outcome === 'finding' || r.outcome === 'pending').length;
    const recs = last30.filter((r) => r.verdict);
    const yes = recs.filter((r) => r.verdict === 'approved').length;
    const failed = last30.filter((r) => r.outcome === 'failed').length;
    const nextRaw = w.status === 'running' ? 'running now' : w.enabled ? (w.next ?? '—') : 'Paused';
    const next = nextRaw.replace(/^next /, '').replace(/^first run /, '');
    return [
      { label: 'Last run', value: last ? runTime(last.at) : '—', sub: last ? `${runDay(last.at)} · took ${last.duration}` : 'not run yet' },
      { label: 'Next run', value: next.charAt(0).toUpperCase() + next.slice(1), sub: w.cadence },
      { label: 'Findings', value: String(found), sub: h.length ? `in the last ${last30.length} runs` : 'no runs yet' },
      w.autonomy >= 2
        ? { label: 'You agreed', value: recs.length ? `${yes} of ${recs.length}` : '—', sub: recs.length ? `recommendations approved · ${Math.round((yes / recs.length) * 100)}%` : 'no decisions yet' }
        : { label: 'Couldn’t run', value: String(failed), sub: h.length ? `in the last ${last30.length} runs` : 'no runs yet' },
    ];
  });
  protected readonly activity = computed(() => {
    const w = this.w();
    if (!w) return [];
    const recent = this.store.activity().filter((a) => a.watcher === w.id);
    const groups = (['Today', 'Yesterday'] as const)
      .map((day) => ({ day: day as string, items: recent.filter((a) => a.day === day).map((a) => ({ time: a.time, text: a.text, by: !!a.by })) }))
      .filter((g) => g.items.length);
    const older = this.settings().older.map((o) => ({ time: o.when, text: o.text, by: !!o.by }));
    return older.length ? [...groups, { day: 'Earlier', items: older }] : groups;
  });

  // Decision
  protected readonly decided = computed(() => {
    const m = this.store.nightDecisions();
    if (!DECISION_DATES.every((d) => m[d])) return null;
    return { accepted: DECISION_DATES.filter((d) => m[d].status === 'accepted').length, time: m[DECISION_DATES[0]].time };
  });
  /** An adjustment moves every night by the same amount, in €5 steps. */
  protected readonly delta = signal(0);
  protected readonly upside = computed(() => Math.max(0, DECISION_UPSIDE + this.delta() * DECISION_UNSOLD));
  protected readonly nightsView = computed(() =>
    DECISIONS.map((d) => ({
      date: d.night.date,
      day: new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d.night.date),
      from: formatEur(d.night.bar),
      to: formatEur((d.target ?? 0) + this.delta()),
      local: formatLocal((d.targetLocal ?? 0) + this.delta() / 0.25),
      full: Math.round(d.occ),
    })),
  );
  protected readonly adjusting = signal(false);

  // Settings (local to the prototype; autonomy goes through the store)
  protected readonly isDays = computed(() => this.settings().schedule.kind === 'days');
  protected readonly days = linkedSignal(() => {
    const s = this.settings().schedule;
    return s.kind === 'days' ? [...s.days] : [];
  });
  protected readonly time = linkedSignal(() => {
    const s = this.settings().schedule;
    return s.kind === 'days' ? s.time : '07:00';
  });
  protected readonly hours = linkedSignal(() => {
    const s = this.settings().schedule;
    return s.kind === 'interval' ? s.hours : 2;
  });
  protected readonly threshold = linkedSignal(() => this.settings().threshold.value);
  protected readonly notify = signal<Notify>('needs');
  protected readonly autonomyView = linkedSignal(() => this.w()?.autonomy ?? 1);
  protected readonly saved = signal(false);
  private pendingLevel: 2 | null = null;

  constructor() {
    afterNextRender(() => {
      const section = this.store.watcherSection();
      if (section === 'top') {
        this.doc.getElementById('content')?.scrollTo({ top: 0 });
        this.doc.defaultView?.scrollTo({ top: 0 });
      } else {
        this.doc.getElementById(`w-${section}`)?.scrollIntoView({ block: 'start' });
      }
    });
  }

  protected runLabel(r: RunRecord) {
    return `${runWhen(r.at)}: ${this.outcome[r.outcome]}. ${r.text}`;
  }
  protected setRange(v: 30 | 90 | 0) {
    this.range.set(v);
    this.selected.set(null);
    this.logLimit.set(6);
  }
  protected pick(i: number | null) {
    const next = i === null || this.selected() === i ? null : i;
    this.selected.set(next);
    this.open.set(next);
  }
  /** Roving focus: one tab stop for the strip, arrows move between runs (Home/End jump). */
  protected onStripKey(e: KeyboardEvent) {
    const list = this.shown();
    const cur = list.findIndex((r) => r.i === this.focusIdx());
    const to = e.key === 'ArrowLeft' ? cur - 1 : e.key === 'ArrowRight' ? cur + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    const k = Math.max(0, Math.min(list.length - 1, to));
    this.selected.set(list[k].i);
    this.open.set(list[k].i);
    this.hovered.set(list[k].i);
    queueMicrotask(() => (this.strip()?.nativeElement.querySelectorAll('button')[k] as HTMLButtonElement | undefined)?.focus());
  }

  protected approve() {
    this.store.decideBatch(DECISIONS.map((d) => ({ date: d.night.date, price: (d.target ?? 0) + this.delta() })));
    this.adjusting.set(false);
  }
  protected dismiss() {
    this.store.decideNights(DECISION_DATES, { status: 'kept', time: '08:20', reason: 'Kept on the watcher page' });
  }

  protected markSaved() {
    this.saved.set(true);
  }
  protected toggleDay(i: number) {
    this.days.update((d) => d.map((on, k) => (k === i ? !on : on)));
    this.markSaved();
  }
  protected nudge(dir: 1 | -1) {
    this.threshold.update((v) => Math.max(1, v + dir * this.settings().threshold.step));
    this.markSaved();
  }
  /** Raising autonomy asks first; lowering is immediate with Undo (the store's toast). */
  protected chooseAutonomy(w: Watcher, level: 1 | 2 | 3) {
    if (level === 3 || level === w.autonomy) return;
    this.autonomyView.set(level);
    if (level > w.autonomy) {
      this.pendingLevel = 2;
      this.confirmEl()?.nativeElement.showModal();
    } else {
      this.store.setAutonomy(w.id, 1);
    }
  }
  protected applyAutonomy(w: Watcher) {
    if (this.pendingLevel) this.store.setAutonomy(w.id, this.pendingLevel);
    this.pendingLevel = null;
    this.confirmEl()?.nativeElement.close();
  }
  protected cancelAutonomy() {
    if (this.pendingLevel) this.autonomyView.set(this.w()?.autonomy ?? 1);
    this.pendingLevel = null;
  }
}
