import { Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorCompassLight, phosphorMoonLight, phosphorSunLight } from '@ng-icons/phosphor-icons/light';
import { THEMES, Theme } from '../theme';

let nextId = 0;

/**
 * The appearance controls at the foot of the phone menu: today one choice, the theme (Light, Dark, Juyo concept).
 *
 * It is a wrapper on purpose, so the menu does not change when the real switchers arrive. When
 * `src/app/theme/theme-switcher.ts` (Theme × Mode, branch r3/concept-dark) and `src/app/theme/density-switch.ts`
 * (branch r3/density) are on main, import them here and make the template:
 *
 *     <app-theme-switcher />
 *     <app-density-switch />
 *
 * Both are self-contained and take the colours of where they sit. Keep `.ap` around them: it gives every segment
 * the 44 px a finger needs, whatever height the switchers have in the sidebar.
 */
@Component({
  selector: 'app-appearance-controls',
  imports: [NgIcon],
  providers: [provideIcons({ phosphorCompassLight, phosphorMoonLight, phosphorSunLight })],
  host: { class: 'ap block' },
  styles: `
    .ap-label { padding-bottom: 6px; color: var(--muted-foreground); font-size: 13px; font-weight: 500; }
    /* min-height, not height: the themes set the height of a segment for the desktop sidebar. */
    .ap-seg > button { min-height: 44px; gap: 7px; font-size: 14px; outline: none; }
    .ap-seg > button ng-icon { flex-shrink: 0; font-size: 17px; }
    .ap-seg > button:focus-visible { box-shadow: 0 0 0 2px var(--ring); }
    .ap-seg { border-radius: 10px; }
    .ap-seg > button { border-radius: 8px; }
  `,
  template: `
    <p class="ap-label" [id]="uid">Theme</p>
    <div class="seg seg--fill ap-seg" role="radiogroup" [attr.aria-labelledby]="uid">
      @for (t of themes; track t.id) {
        <button type="button" role="radio" [attr.aria-checked]="theme.id() === t.id" [attr.aria-label]="t.label" (click)="theme.set(t.id)">
          <ng-icon [name]="t.icon" aria-hidden="true" />
          {{ t.short }}
        </button>
      }
    </div>
  `,
})
export class AppearanceControls {
  protected readonly theme = inject(Theme);
  protected readonly themes = THEMES;
  protected readonly uid = `appearance-${nextId++}`;
}
