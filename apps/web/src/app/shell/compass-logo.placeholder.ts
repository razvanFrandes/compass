import { Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorCompassFill } from '@ng-icons/phosphor-icons/fill';

/**
 * PLACEHOLDER for the Compass logo, until `src/app/shell/compass-logo.ts` (branch r3/brand-compass) is on main.
 *
 * It has that component's contract: the selector `app-compass-logo`, `variant` ('full' is the mark and the
 * "Compass" wordmark, 'mark' is the mark alone) and `size` (the height of the mark, in px). So the swap is one
 * line in each file that imports it (app.ts, shell/mobile-menu.ts):
 *
 *     import { CompassLogo } from './compass-logo';   // was './compass-logo.placeholder'
 *
 * Then delete this file. Nothing in the templates changes.
 */
@Component({
  selector: 'app-compass-logo',
  imports: [NgIcon],
  providers: [provideIcons({ phosphorCompassFill })],
  host: { class: 'inline-flex items-center', role: 'img', 'aria-label': 'Compass', '[style.gap.px]': 'size() * 0.3' },
  template: `
    <ng-icon name="phosphorCompassFill" aria-hidden="true" [style.font-size.px]="size()" />
    @if (variant() === 'full') {
      <span aria-hidden="true" class="font-semibold tracking-[-0.02em]" [style.font-size.px]="size() * 0.82" [style.line-height.px]="size()">Compass</span>
    }
  `,
})
export class CompassLogo {
  readonly variant = input<'full' | 'mark'>('full');
  /** The height of the mark, in px; the wordmark follows it. */
  readonly size = input(22);
}
