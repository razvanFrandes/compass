import { Component, ViewEncapsulation, computed, input, linkedSignal, output } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import type { BriefPulse } from '@compass/contracts';
import { pulseGroups } from './brief-model';

type PulseTab = 'forward' | 'month';

/**
 * Pulse: the scope's headline numbers, four to a row and one period at a time. On the books for the next 30
 * nights against the same time last year, or the last closed month of the P&L against a year earlier and budget.
 * A tile is a label with its period, one value with a sparkline, and its comparisons, each naming its base.
 * A tile is a button: "Ask why" sends the question to Kassandra at once.
 */
@Component({
  selector: 'app-pulse-rail',
  encapsulation: ViewEncapsulation.None,
  styleUrl: './pulse-rail.css',
  imports: [HlmButtonImports],
  host: { class: 'brief-section' },
  template: `
    @let g = groups();
    <section class="brief-sec" aria-labelledby="pulse-title">
      <header class="brief-sec-head">
        <div class="brief-sec-titles">
          <h2 id="pulse-title" class="brief-sec-title">Pulse · {{ scopeLabel() }}</h2>
          <p class="brief-sec-hint">
            @if (state() !== 'ready') {
              The numbers for the hotels you are working on
            } @else if (tab() === 'month') {
              {{ g.monthLabel }}, the last closed month, against {{ g.monthBasis }} and against budget
            } @else {
              On the books for the next 30 nights, against the same time last year (STLY)
            }
          </p>
        </div>
        @if (state() === 'ready' && g.forward.length && g.month.length) {
          <div class="brief-sec-actions">
            <div class="seg" role="radiogroup" aria-label="Period">
              <button type="button" role="radio" [attr.aria-checked]="tab() === 'forward'" [attr.tabindex]="tab() === 'forward' ? 0 : -1" (click)="tab.set('forward')" (keydown)="key($event)">Next 30 nights</button>
              <button type="button" role="radio" [attr.aria-checked]="tab() === 'month'" [attr.tabindex]="tab() === 'month' ? 0 : -1" (click)="tab.set('month')" (keydown)="key($event)">{{ g.monthLabel }}</button>
            </div>
          </div>
        }
      </header>

      @switch (state()) {
        @case ('loading') {
          <div class="brief-card pulse-row" role="status">
            <span class="sr-only">Loading the numbers for {{ scopeLabel() }}</span>
            @for (i of placeholders; track i) {
              <div class="pulse-tile" aria-hidden="true">
                <span class="skeleton pulse-skel" style="width: 62%; height: 12px; margin-block: 2px"></span>
                <span class="pulse-main"><span class="skeleton pulse-skel pulse-skel--value"></span></span>
                <span class="pulse-deltas"><span class="skeleton pulse-skel" style="width: 52%; height: 12px; margin-block: 2px"></span></span>
              </div>
            }
          </div>
          <!-- The pace line's place, so the findings below do not move when the numbers arrive -->
          <p class="pulse-pace" aria-hidden="true"><span class="skeleton pulse-skel pulse-skel--pace"></span></p>
        }
        @case ('error') {
          <div class="brief-card brief-msg pulse-error" role="alert">
            <p>{{ error() || 'The numbers didn’t load.' }}</p>
            <button hlmBtn variant="outline" size="sm" (click)="retry.emit()">Retry</button>
          </div>
        }
        @default {
          <ul class="brief-card pulse-row">
            @for (t of tiles(); track t.key) {
              <li class="pulse-cell">
                <!-- Its name is its own text: label, value, then each comparison in words. The period is in the section's line. -->
                <button type="button" class="pulse-tile" [attr.title]="t.definition" (click)="ask.emit(t.question)">
                  <span class="pulse-label">{{ t.label }}<span class="pulse-period" aria-hidden="true"> · {{ t.period }}</span><span class="sr-only">, {{ t.period }}:</span></span>
                  <span class="pulse-main">
                    <span class="pulse-value">{{ t.value }}<span class="sr-only">.</span></span>
                    <span class="pulse-spark" aria-hidden="true">
                      <svg viewBox="0 0 80 24" preserveAspectRatio="none">
                        <path [attr.d]="t.spark.compare" class="pulse-spark-ly" vector-effect="non-scaling-stroke" />
                        <path [attr.d]="t.spark.line" class="pulse-spark-ty" vector-effect="non-scaling-stroke" />
                      </svg>
                    </span>
                  </span>
                  <span class="pulse-deltas">
                    @for (d of t.deltas; track d.basis) {
                      <span class="pulse-delta" [attr.data-tone]="d.tone" aria-hidden="true"><span class="pulse-delta-figure">{{ d.arrow }} {{ d.text }}</span> vs {{ d.basis }}</span>
                      <span class="sr-only">{{ d.spoken }}</span>
                    }
                    <span class="pulse-ask" aria-hidden="true">Ask why →</span>
                    <span class="sr-only">Ask why.</span>
                  </span>
                </button>
              </li>
            }
          </ul>
          @if (tab() === 'forward' && g.pace; as p) {
            <p class="pulse-pace">
              <button type="button" class="pulse-pace-btn" [attr.title]="p.definition" (click)="ask.emit(p.question)">
                <span>Pace: {{ p.value }} room nights on the books,</span>
                @for (d of p.deltas; track d.basis) {
                  <span class="pulse-delta" [attr.data-tone]="d.tone" aria-hidden="true"><span class="pulse-delta-figure">{{ d.arrow }} {{ d.text }}</span> vs {{ d.basis }}</span>
                  <span class="sr-only">{{ d.spoken }}</span>
                }
                <span class="pulse-ask" aria-hidden="true">Ask why →</span>
                <span class="sr-only">Ask why.</span>
              </button>
            </p>
          }
        }
      }
    </section>
  `,
})
export class PulseRail {
  readonly pulse = input<BriefPulse | null>(null);
  readonly state = input<'loading' | 'ready' | 'error'>('loading');
  readonly error = input<string | null>(null);
  readonly scopeLabel = input('');
  readonly ask = output<string>();
  readonly retry = output<void>();

  protected readonly placeholders = [0, 1, 2, 3];
  protected readonly groups = computed(() => pulseGroups(this.pulse()?.tiles ?? []));
  /** The period on screen. A scope without a closed month has only what is on the books. */
  protected readonly tab = linkedSignal<boolean, PulseTab>({ source: () => this.groups().month.length > 0, computation: (hasMonth, previous) => (hasMonth && previous?.value === 'month' ? 'month' : 'forward') });
  protected readonly tiles = computed(() => (this.tab() === 'month' ? this.groups().month : this.groups().forward));

  /** The two periods are a radio group: the arrow keys move between them. */
  protected key(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    this.tab.set(event.key === 'Home' ? 'forward' : event.key === 'End' ? 'month' : this.tab() === 'forward' ? 'month' : 'forward');
    const group = (event.currentTarget as HTMLElement).parentElement;
    queueMicrotask(() => group?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  }
}
