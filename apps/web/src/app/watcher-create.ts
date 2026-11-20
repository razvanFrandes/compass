import { Component, ElementRef, afterRenderEffect, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { CompassStore, CreateStep, WatcherDraft } from './store';
import { LEVELS, TEMPLATES } from './watcher-data';
import * as icons from './icons';

type Nights = 'weekends' | 'all' | 'events';
type Step = CreateStep | 'q1' | 'q2';
type Metric = 'pickup' | 'occ' | 'comp' | 'ota';

const METRICS: Record<Metric, { label: string; phrase: string; unit: string; glyph: string; value: number }> = {
  pickup: { label: 'Pickup vs last year', phrase: 'pickup vs last year', unit: 'pts', glyph: 'phosphorTrendDownLight', value: 10 },
  occ: { label: 'Occupancy on the books', phrase: 'occupancy on the books', unit: 'pts', glyph: 'phosphorChartBarLight', value: 8 },
  comp: { label: 'Comp-set median rate', phrase: 'the comp-set median rate', unit: '%', glyph: 'phosphorBinocularsLight', value: 5 },
  ota: { label: 'OTA share of room nights', phrase: 'the OTA share of room nights', unit: '%', glyph: 'phosphorChartDonutLight', value: 40 },
};
const NIGHTS_TEXT: Record<Nights, string> = { weekends: 'weekends', all: 'every night', events: 'event nights' };
const FIRST_RUN: Record<string, string> = { 'Daily 06:00': 'tomorrow 06:00', 'Daily 07:00': 'tomorrow 07:00', 'Weekly, Mon 07:00': 'Mon 23 Nov 07:00' };

/*
  New watcher (docs/research/ui-round3/agents_pattern.md §5.8). Three ways in, one way out:
  describe it to Kassandra (at most two questions, recommended option first), start from a template,
  or set it up by hand. Every path ends on a review card that restates the watcher in one sentence,
  with the first run in bold, the autonomy level and one authorization line (Mercury, Unify, ChatGPT tasks).
  Nothing is created until "Create watcher". New watchers start at Alerts only or Recommends, never higher.
*/
@Component({
  selector: 'app-watcher-create',
  imports: [NgIcon, HlmButtonImports],
  providers: [provideIcons({ ...icons })],
  template: `
    @if (store.creating()) {
      <dialog #dlg class="create-dialog" aria-labelledby="create-title" (cancel)="$event.preventDefault(); close()">
        <header class="flex items-center gap-3 border-b border-(--border) px-5 py-3.5">
          <h2 id="create-title" class="flex-1 text-[16px] font-semibold">{{ title() }}</h2>
          <button hlmBtn variant="ghost" size="icon-sm" aria-label="Close" (click)="close()"><ng-icon name="phosphorXLight" /></button>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          @switch (step()) {
            @case ('describe') {
              <div class="flex items-start gap-3">
                <span class="orb-mark mt-0.5 shrink-0" aria-hidden="true"></span>
                <p class="text-[14px]/relaxed">Tell Kassandra what to watch. She’ll ask at most two questions, then show you the watcher before anything is created.</p>
              </div>
              <label class="mt-4 block">
                <span class="sr-only">What should the watcher check?</span>
                <textarea
                  class="field-input min-h-[104px] w-full resize-none py-2.5"
                  rows="3"
                  [value]="text()"
                  (input)="text.set($any($event.target).value)"
                  (keydown.meta.enter)="next()"
                  (keydown.control.enter)="next()"
                  placeholder="e.g. Every morning, check weekends in the next 60 days and tell me when pickup falls 10 pts behind last year"
                ></textarea>
              </label>
              <p class="text-muted-foreground mt-6 mb-2 text-[12px] font-medium tracking-[0.06em] uppercase">Or start from a template</p>
              <div class="grid gap-2 sm:grid-cols-3">
                @for (t of templates; track t.key) {
                  <button type="button" class="clickable-card flex flex-col items-start gap-1.5 p-3 text-left" (click)="useTemplate(t)">
                    <span class="watcher-glyph mb-1 grid size-8 place-items-center rounded-[9px]"><ng-icon [name]="t.glyph" class="text-[17px]" /></span>
                    <span class="text-[14px] font-medium">{{ t.name }}</span>
                    <span class="text-muted-foreground text-[12.5px]/snug">{{ t.blurb }}</span>
                    <span class="schedule-chip mt-1"><ng-icon name="phosphorClockLight" />{{ t.cadence }}</span>
                  </button>
                }
              </div>
              <button type="button" class="text-muted-foreground hover:text-foreground mt-5 text-[13px] underline underline-offset-2" (click)="go('manual')">Set up manually</button>
            }

            @case ('q1') {
              <div class="flex justify-end"><p class="bubble-user">{{ text() }}</p></div>
              <div class="mt-5 flex items-start gap-3">
                <span class="orb-mark mt-0.5 shrink-0" aria-hidden="true"></span>
                <fieldset class="min-w-0 flex-1">
                  <legend class="text-[14px]"><span class="text-muted-foreground mr-1.5 text-[12px] tabular-nums">1 of 2</span>Which nights should it watch?</legend>
                  <div class="mt-3 flex flex-col gap-2">
                    @for (o of nightOptions; track o.v) {
                      <label class="option-card">
                        <input type="radio" class="sr-only" name="create-nights" [checked]="nights() === o.v" (change)="nights.set(o.v)" />
                        <span class="option-radio" aria-hidden="true"></span>
                        <span class="min-w-0 flex-1 text-[14px]">{{ o.label }}
                          @if (o.hint) {
                            <span class="text-muted-foreground block text-[12.5px]/snug">{{ o.hint }}</span>
                          }
                        </span>
                        @if (o.recommended) {
                          <span class="rec-badge">Recommended</span>
                        }
                      </label>
                    }
                  </div>
                </fieldset>
              </div>
            }

            @case ('q2') {
              <div class="flex justify-end"><p class="bubble-user">{{ text() }}</p></div>
              <div class="mt-5 flex items-start gap-3">
                <span class="orb-mark mt-0.5 shrink-0" aria-hidden="true"></span>
                <fieldset class="min-w-0 flex-1">
                  <legend class="text-[14px]"><span class="text-muted-foreground mr-1.5 text-[12px] tabular-nums">2 of 2</span>How far should it go before stopping for you?</legend>
                  <div class="mt-3 flex flex-col gap-2">
                    @for (l of startLevels; track l.level) {
                      <label class="option-card">
                        <input type="radio" class="sr-only" name="create-level" [checked]="level() === l.level" (change)="level.set(l.level)" />
                        <span class="option-radio" aria-hidden="true"></span>
                        <span class="min-w-0 flex-1 text-[14px]">{{ l.name }}<span class="text-muted-foreground block text-[12.5px]/snug">{{ l.text }}</span></span>
                        @if (l.level === 1) {
                          <span class="rec-badge">Recommended</span>
                        }
                      </label>
                    }
                  </div>
                </fieldset>
              </div>
            }

            @case ('manual') {
              <div class="flex flex-col gap-4">
                <label class="flex flex-col gap-1.5">
                  <span class="field-label">Name</span>
                  <input class="field-input" [value]="mName()" (input)="mName.set($any($event.target).value)" />
                </label>
                <label class="flex flex-col gap-1.5">
                  <span class="field-label">What to watch</span>
                  <select class="field-select w-full" (change)="setMetric($any($event.target).value)">
                    @for (m of metricKeys; track m) {
                      <option [value]="m" [selected]="m === mMetric()">{{ metrics[m].label }}</option>
                    }
                  </select>
                </label>
                <fieldset>
                  <legend class="field-label mb-1.5">Nights</legend>
                  <div class="seg" role="radiogroup" aria-label="Nights">
                    @for (o of nightOptions; track o.v) {
                      <button type="button" role="radio" [attr.aria-checked]="mNights() === o.v" (click)="mNights.set(o.v)">{{ o.short }}</button>
                    }
                  </div>
                </fieldset>
                <div class="flex flex-col gap-1.5">
                  <span class="field-label" id="m-threshold">Alert when it moves more than</span>
                  <div class="flex items-center gap-1" role="group" aria-labelledby="m-threshold">
                    <button hlmBtn variant="outline" size="icon-sm" aria-label="Lower" (click)="mThreshold.set(mThreshold() > 1 ? mThreshold() - 1 : 1)"><ng-icon name="phosphorMinusLight" /></button>
                    <span class="min-w-[72px] text-center text-[15px] font-semibold tabular-nums" aria-live="polite">{{ mThreshold() }} {{ metrics[mMetric()].unit }}</span>
                    <button hlmBtn variant="outline" size="icon-sm" aria-label="Higher" (click)="mThreshold.set(mThreshold() + 1)"><ng-icon name="phosphorPlusLight" /></button>
                  </div>
                </div>
                <label class="flex flex-col gap-1.5">
                  <span class="field-label">Schedule</span>
                  <select class="field-select w-full" (change)="mSchedule.set($any($event.target).value)">
                    @for (s of schedules; track s) {
                      <option [value]="s" [selected]="s === mSchedule()">{{ s }}</option>
                    }
                  </select>
                </label>
                <fieldset>
                  <legend class="field-label mb-1.5">Autonomy</legend>
                  <div class="flex flex-col gap-2">
                    @for (l of startLevels; track l.level) {
                      <label class="option-card">
                        <input type="radio" class="sr-only" name="manual-level" [checked]="level() === l.level" (change)="level.set(l.level)" />
                        <span class="option-radio" aria-hidden="true"></span>
                        <span class="min-w-0 flex-1 text-[14px]">{{ l.name }}<span class="text-muted-foreground block text-[12.5px]/snug">{{ l.text }}</span></span>
                      </label>
                    }
                  </div>
                </fieldset>
              </div>
            }

            @case ('review') {
              @if (draft(); as d) {
                <div class="flex items-start gap-3">
                  <span class="orb-mark mt-0.5 shrink-0" aria-hidden="true"></span>
                  <p class="text-[14px]/relaxed">Here’s the watcher. Nothing is created until you confirm.</p>
                </div>
                <article class="watcher-card mt-4 flex flex-col gap-4 p-5" aria-labelledby="draft-name-label">
                  <header class="flex items-center gap-3">
                    <span class="watcher-glyph grid size-11 shrink-0 place-items-center rounded-[12px]"><ng-icon [name]="d.glyph" class="text-[22px]" /></span>
                    <div class="min-w-0 flex-1">
                      <label id="draft-name-label" for="draft-name" class="sr-only">Watcher name</label>
                      <input id="draft-name" class="name-input" [value]="d.name" (input)="rename($any($event.target).value)" />
                      <p class="text-muted-foreground text-[12.5px]">New watcher · Halcyon, all 20 hotels</p>
                    </div>
                  </header>
                  <p class="text-[14.5px]/relaxed">
                    @for (s of d.sentence; track $index) {
                      @if (s.b) {
                        <strong class="font-semibold">{{ s.t }}</strong>
                      } @else {
                        <span class="text-muted-foreground">{{ s.t }}</span>
                      }
                    }
                  </p>
                  <dl class="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 text-[13.5px]">
                    <dt class="text-muted-foreground">Schedule</dt>
                    <dd>{{ d.cadence }} · first run <strong class="font-semibold">{{ d.firstRun }}</strong></dd>
                    <dt class="text-muted-foreground">Autonomy</dt>
                    <dd class="flex items-center gap-2">
                      <span class="flex gap-[3px]" aria-hidden="true">
                        @for (sg of segs; track sg) {
                          <i class="meter-seg" [class.is-on]="sg <= d.autonomy"></i>
                        }
                      </span>
                      {{ levels[d.autonomy - 1].name }}
                    </dd>
                    <dt class="text-muted-foreground">Notifies you</dt>
                    <dd>Only when it needs you or can’t run</dd>
                  </dl>
                  <p class="latest-panel flex items-start gap-2 rounded-[10px] p-3 text-[13px]">
                    <ng-icon name="phosphorLockSimpleLight" class="text-muted-foreground mt-0.5 shrink-0" />
                    {{ d.autonomy === 2 ? 'Kassandra will only propose rates. Nothing changes until you approve.' : 'Kassandra will only alert you. Nothing changes in your systems.' }}
                  </p>
                </article>
              }
            }
          }
        </div>

        <footer class="flex items-center gap-2 border-t border-(--border) px-5 py-3.5">
          @if (canBack()) {
            <button hlmBtn variant="ghost" (click)="back()"><ng-icon name="phosphorArrowLeftLight" />Back</button>
          } @else {
            <button hlmBtn variant="ghost" (click)="close()">Cancel</button>
          }
          <span class="flex-1"></span>
          @switch (step()) {
            @case ('describe') {
              <button hlmBtn [disabled]="!text().trim()" (click)="next()">Continue</button>
            }
            @case ('q1') {
              <button hlmBtn (click)="go('q2')">Next</button>
            }
            @case ('q2') {
              <button hlmBtn (click)="reviewFromChat()">Review watcher</button>
            }
            @case ('manual') {
              <button hlmBtn [disabled]="!mName().trim()" (click)="reviewFromManual()">Review watcher</button>
            }
            @case ('review') {
              <button hlmBtn [disabled]="!draft()?.name?.trim()" (click)="create()">Create watcher</button>
            }
          }
        </footer>
      </dialog>
    }
  `,
})
export class WatcherCreate {
  protected readonly store = inject(CompassStore);
  protected readonly templates = TEMPLATES;
  protected readonly levels = LEVELS;
  protected readonly startLevels = LEVELS.filter((l) => l.level !== 3) as { level: 1 | 2; name: string; text: string }[];
  protected readonly segs = [1, 2, 3];
  protected readonly metrics = METRICS;
  protected readonly metricKeys = Object.keys(METRICS) as Metric[];
  protected readonly schedules = Object.keys(FIRST_RUN);
  protected readonly nightOptions: { v: Nights; label: string; short: string; hint?: string; recommended?: boolean }[] = [
    { v: 'weekends', label: 'Weekends · Friday and Saturday', short: 'Weekends', hint: 'Where most of your gap to last year is', recommended: true },
    { v: 'all', label: 'Every night', short: 'Every night' },
    { v: 'events', label: 'Only nights with an event', short: 'Event nights', hint: 'Uses the events calendar' },
  ];

  protected readonly step = signal<Step>('describe');
  private readonly trail = signal<Step[]>([]);
  protected readonly canBack = computed(() => this.trail().length > 0);
  protected readonly title = computed(() => (this.step() === 'manual' ? 'Set up a watcher' : this.step() === 'review' ? 'Review watcher' : 'New watcher'));

  protected readonly text = signal('');
  protected readonly nights = signal<Nights>('weekends');
  protected readonly level = signal<1 | 2>(1);
  protected readonly draft = signal<WatcherDraft | null>(null);
  protected readonly mName = signal('Weekend pickup');
  protected readonly mMetric = signal<Metric>('pickup');
  protected readonly mNights = signal<Nights>('weekends');
  protected readonly mThreshold = signal(10);
  protected readonly mSchedule = signal('Daily 07:00');

  private readonly dlg = viewChild<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    // Each time the flow opens, start clean at the requested step.
    effect(() => {
      const c = this.store.creating();
      if (!c) return;
      untracked(() => {
        this.trail.set([]);
        this.text.set('');
        this.nights.set('weekends');
        this.level.set(1);
        this.draft.set(c.draft ? { ...c.draft } : null);
        this.step.set(c.step === 'review' && !c.draft ? 'describe' : c.step);
      });
    });
    // A native modal dialog: top layer, focus trap, Esc, inert page behind.
    afterRenderEffect(() => {
      const d = this.dlg()?.nativeElement;
      if (d && !d.open) d.showModal();
    });
  }

  protected go(s: Step) {
    this.trail.update((t) => [...t, this.step()]);
    this.step.set(s);
  }
  protected back() {
    const t = this.trail();
    if (!t.length) return;
    this.step.set(t[t.length - 1]);
    this.trail.set(t.slice(0, -1));
  }
  protected close() {
    this.dlg()?.nativeElement.close();
    this.store.creating.set(null);
  }
  protected next() {
    if (this.text().trim()) this.go('q1');
  }
  protected useTemplate(t: WatcherDraft) {
    this.draft.set({ ...t });
    this.go('review');
  }
  protected setMetric(m: Metric) {
    this.mMetric.set(m);
    this.mThreshold.set(METRICS[m].value);
  }
  protected rename(name: string) {
    this.draft.update((d) => (d ? { ...d, name } : d));
  }

  protected reviewFromChat() {
    const t = this.text();
    const pts = /(\d+)\s*(pts|points|pp)/i.exec(t)?.[1] ?? '10';
    const days = /(\d+)\s*days/i.exec(t)?.[1] ?? '60';
    const n = this.nights();
    const act = this.level() === 2 ? ' and recommends a rate when pickup falls ' : ' and alerts you when pickup falls ';
    this.draft.set({
      name: n === 'weekends' ? 'Weekend pickup' : n === 'events' ? 'Event-night pickup' : 'Pickup pace',
      glyph: 'phosphorTrendDownLight',
      sentence: [{ t: 'Checks ' }, { t: NIGHTS_TEXT[n], b: true }, { t: ' in the next ' }, { t: `${days} days`, b: true }, { t: act }, { t: `${pts} pts behind last year`, b: true }, { t: '.' }],
      cadence: 'Daily 07:00',
      firstRun: FIRST_RUN['Daily 07:00'],
      autonomy: this.level(),
    });
    this.go('review');
  }
  protected reviewFromManual() {
    const m = METRICS[this.mMetric()];
    this.draft.set({
      name: this.mName().trim(),
      glyph: m.glyph,
      sentence: [{ t: 'Watches ' }, { t: m.phrase, b: true }, { t: ' for ' }, { t: NIGHTS_TEXT[this.mNights()], b: true }, { t: ' and alerts you when it moves more than ' }, { t: `${this.mThreshold()} ${m.unit}`, b: true }, { t: '.' }],
      cadence: this.mSchedule(),
      firstRun: FIRST_RUN[this.mSchedule()],
      autonomy: this.level(),
    });
    this.go('review');
  }
  protected create() {
    const d = this.draft();
    if (!d?.name.trim()) return;
    this.dlg()?.nativeElement.close();
    this.store.createWatcher({ ...d, name: d.name.trim() });
  }
}
