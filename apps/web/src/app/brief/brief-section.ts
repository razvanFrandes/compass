import { Component, input, output } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';

let next = 0;

/**
 * A labelled section of the brief: its title, one line on what it shows and its actions sit above a flat card.
 * While the numbers load the card holds a skeleton at the height the content will have; a failed read says so
 * with Retry; nothing to show is said in words. `bare` leaves the card to the content (a decision card).
 */
@Component({
  selector: 'app-brief-section',
  imports: [HlmButtonImports],
  host: { class: 'brief-section' },
  template: `
    <section class="brief-sec" [attr.aria-labelledby]="id">
      <header class="brief-sec-head">
        <div class="brief-sec-titles">
          <h2 class="brief-sec-title" [id]="id">
            {{ heading() }}@if (count() !== null) {<span class="brief-count" [class.brief-count--decision]="tone() === 'decision'">{{ count() }}</span>}
          </h2>
          @if (hint()) {
            <p class="brief-sec-hint">{{ hint() }}</p>
          }
        </div>
        <div class="brief-sec-actions"><ng-content select="[sectionActions]" /></div>
      </header>
      @switch (state()) {
        @case ('loading') {
          <div class="skeleton brief-sec-skel" [style.height.px]="height()" role="status"><span class="sr-only">Loading {{ heading() }}</span></div>
        }
        @case ('error') {
          <div class="brief-card brief-msg" [style.min-height.px]="height()" role="alert">
            <p>{{ error() }}</p>
            <button hlmBtn variant="outline" size="sm" (click)="retry.emit()">Retry</button>
          </div>
        }
        @case ('empty') {
          <div class="brief-card brief-msg"><p>{{ empty() }}</p></div>
        }
        @default {
          @if (bare()) {
            <ng-content />
          } @else {
            <div class="brief-card"><ng-content select="[sectionBody]" /></div>
          }
        }
      }
    </section>
  `,
})
export class BriefSection {
  readonly heading = input.required<string>();
  readonly hint = input('');
  /** A number next to the title: how many decisions wait, how many findings there are. */
  readonly count = input<number | null>(null);
  readonly tone = input<'neutral' | 'decision'>('neutral');
  readonly state = input<'loading' | 'error' | 'empty' | 'ready'>('ready');
  /** The height of the content, for the skeleton and the error box. */
  readonly height = input(220);
  readonly error = input('These numbers didn’t load.');
  readonly empty = input('Nothing to show here.');
  /** The content brings its own card. */
  readonly bare = input(false);
  readonly retry = output<void>();
  protected readonly id = `brief-sec-${next++}`;
}
