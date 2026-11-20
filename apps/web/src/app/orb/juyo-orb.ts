import { Component, computed, input } from '@angular/core';
import { KassandraOrb } from '../orb';

export type JuyoOrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

/**
 * PLACEHOLDER (r2/fe-kassandra): a thin adapter with the selector and inputs of the WebGL orb another branch builds
 * at this path (`level` 0..1, `state`, optional `bands`). It draws the existing shader orb while Kassandra listens
 * or speaks, and the quiet CSS mark at rest and while she thinks, so a composer at rest holds no WebGL context.
 * Replace this file with the real one; nothing else changes.
 */
@Component({
  selector: 'juyo-orb',
  imports: [KassandraOrb],
  host: { class: 'relative block', 'aria-hidden': 'true' },
  template: `
    @if (voiced()) {
      <app-kassandra-orb class="size-full" [levelSource]="read" [active]="true" />
    } @else {
      <span class="orb-mark absolute inset-0 !size-auto" [class.orb-mark--busy]="state() === 'thinking'"></span>
    }
  `,
})
export class JuyoOrb {
  /** Loudness of the voice, 0..1. */
  readonly level = input(0);
  readonly state = input<JuyoOrbState>('idle');
  /** Spectrum of the voice, low to high, each 0..1. The adapter ignores it. */
  readonly bands = input<readonly number[] | undefined>(undefined);

  protected readonly voiced = computed(() => this.state() === 'listening' || this.state() === 'speaking');
  protected readonly read = () => this.level();
}
