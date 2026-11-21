import { Component, ViewEncapsulation } from '@angular/core';
import { DensitySwitch } from '../theme/density-switch';
import { ThemeSwitcher } from '../theme/theme-switcher';

/**
 * The appearance controls at the foot of the phone menu: the same two components as the desktop sidebar,
 * `<app-theme-switcher>` (Theme × Mode) and `<app-density-switch>` (Comfortable or Compact).
 *
 * Both are self-contained and take the colours of where they sit. `.ap` gives every segment the 44 px a finger
 * needs, whatever height the switchers have in the sidebar, and a focus ring that shows on the sheet.
 */
@Component({
  selector: 'app-appearance-controls',
  imports: [ThemeSwitcher, DensitySwitch],
  host: { class: 'ap flex flex-col gap-3' },
  // The segments belong to the two switchers: their styles are reached from here, under `.ap`.
  encapsulation: ViewEncapsulation.None,
  styles: `
    /* min-height, not height: the themes set the height of a segment for the desktop sidebar. */
    .ap .seg > button { min-height: 44px; outline: none; }
    .ap .seg > button:focus-visible { box-shadow: 0 0 0 2px var(--ring); }
  `,
  template: `
    <app-theme-switcher />
    <app-density-switch />
  `,
})
export class AppearanceControls {}
