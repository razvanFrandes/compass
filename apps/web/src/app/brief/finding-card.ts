import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import type { BriefChart } from '@compass/contracts';
import { WidgetChart } from '../charts/widget-chart';
import * as icons from '../icons';
import { chartSpec, evidenceLine, findingKind, placeholderSpec, stakeLabel } from './brief-model';

/** The chart of a card in an overview row (layout research: 180 px in an overview, 320 px when featured). */
export const CHART_H = 180;

/** What a card needs from a finding: the brief's row with the page's own short title. */
export interface FindingView {
  id: string;
  kind: string;
  hotel: string;
  title: string;
  /** The model's sentence, when the brief has one. */
  summary?: string;
  impact_eur: number | null;
  impact_basis: string;
  sources: readonly string[];
  seen: boolean;
}

/**
 * One finding of the brief: what happened, the money in it, one chart of its own kind from the catalogue, where the
 * numbers come from, and what to do next (Explore, Watch this, Snooze, Not useful). The reasoning is one level down,
 * in the thread that Explore opens.
 */
@Component({
  selector: 'app-finding-card',
  encapsulation: ViewEncapsulation.None,
  styleUrl: './finding-card.css',
  imports: [NgIcon, HlmButtonImports, WidgetChart],
  providers: [provideIcons({ ...icons })],
  host: { class: 'finding-host' },
  template: `
    @let f = finding();
    @let k = kind();
    @let s = stake();
    <article class="brief-card finding" [attr.aria-labelledby]="'f-' + uid">
      <div class="finding-text">
        <p class="finding-eyebrow">
          @if (!f.seen) {
            <i class="finding-new" aria-hidden="true"></i><span class="sr-only">New. </span>
          }
          <span class="finding-kind">{{ k.label }}</span>
          <span>· {{ f.hotel }}</span>
        </p>
        <h3 class="finding-title" [id]="'f-' + uid">{{ f.title }}</h3>
        <p class="finding-stake" [attr.data-tone]="s.tone">
          @if (s.arrow) {
            <span class="finding-arrow" aria-hidden="true">{{ s.arrow }}</span>
          }
          {{ s.text }}
        </p>
        @if (f.summary) {
          <p class="finding-summary" [attr.title]="f.summary">{{ f.summary }} <span class="ai-tag">AI</span></p>
        }
      </div>

      @if (showChart()) {
        <div class="finding-chart">
          @if (chart(); as c) {
            <juyo-widget-chart [spec]="spec()!" [rows]="c.rows" [columns]="c.columns" [compact]="true" [height]="chartH" />
          } @else if (chartState() === 'loading' && k.chart) {
            <juyo-widget-chart [spec]="placeholder()!" [rows]="null" loading="skeleton" [compact]="true" [height]="chartH" />
          } @else if (chartState() === 'error') {
            <div class="finding-nochart" role="alert">
              <p>The chart didn’t load.</p>
              <button hlmBtn variant="outline" size="sm" (click)="retry.emit()">Try again</button>
            </div>
          }
        </div>
      }

      <div class="finding-foot">
        <p class="finding-evidence">{{ evidence() }}</p>
        <div class="finding-actions">
          <button hlmBtn variant="secondary" size="sm" (click)="explore.emit()">Explore</button>
          <button hlmBtn variant="ghost" size="sm" (click)="watch.emit()">Watch this</button>
          <span class="finding-quiet">
            <button hlmBtn variant="ghost" size="icon-sm" title="Snooze until tomorrow" (click)="snooze.emit()">
              <ng-icon name="phosphorClockLight" aria-hidden="true" /><span class="sr-only">Snooze until tomorrow: {{ f.title }}</span>
            </button>
            <button hlmBtn variant="ghost" size="icon-sm" title="Not useful" (click)="dismiss.emit()">
              <ng-icon name="phosphorThumbsDownLight" aria-hidden="true" /><span class="sr-only">Not useful: {{ f.title }}</span>
            </button>
          </span>
        </div>
      </div>
    </article>
  `,
})
export class FindingCard {
  readonly finding = input.required<FindingView>();
  /** The finding's chart; null while it loads, when it failed, and when its kind has none. */
  readonly chart = input<BriefChart | null>(null);
  readonly chartState = input<'loading' | 'ready' | 'error'>('ready');
  /** False where the card is a row of a list (a phone, after the first card): the chart is one tap away, in Explore. */
  readonly showChart = input(true);
  readonly explore = output<void>();
  readonly watch = output<void>();
  readonly snooze = output<void>();
  readonly dismiss = output<void>();
  readonly retry = output<void>();

  private static next = 0;
  protected readonly uid = FindingCard.next++;
  protected readonly chartH = CHART_H;
  protected readonly kind = computed(() => findingKind(this.finding().kind));
  protected readonly stake = computed(() => stakeLabel(this.finding().impact_eur));
  protected readonly evidence = computed(() => evidenceLine(this.finding().impact_basis, this.finding().sources));
  /** The chart keeps its own short title as a caption; the card's title is the conclusion. */
  protected readonly spec = computed(() => {
    const chart = this.chart();
    if (!chart) return null;
    const { subtitle: _subtitle, ...spec } = chartSpec(chart, this.finding().id);
    return spec;
  });
  protected readonly placeholder = computed(() => {
    const kind = this.kind().chart;
    return kind ? placeholderSpec(kind, this.finding().id) : null;
  });
}
