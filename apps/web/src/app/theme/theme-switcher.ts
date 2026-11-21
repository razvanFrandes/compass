import { Component, computed, inject, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorDesktopLight, phosphorMoonLight, phosphorSunLight } from '@ng-icons/phosphor-icons/light';
import type { MenuAlign, MenuSide } from '@spartan-ng/brain/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { MODES, THEMES, Theme } from '../theme';

let nextId = 0;

/**
 * The theme switch: two independent choices, Theme (Default or Concept) and Mode (Light, Dark or System).
 *
 * It is self-contained (its own icons and styles, no inputs from the shell) and comes in two shapes:
 * - `rows` (the default): two labelled segmented controls that fill the width they are given. In the sidebar's
 *   footer (192px) the modes are icons with tooltips; from 256px up, as in a phone's menu sheet, each icon gets
 *   its word beside it. On touch every segment is 44px tall;
 * - `menu`: one icon button that opens the same two choices as a menu, for a collapsed rail or a phone's header.
 *   `side` and `align` place the menu against the button.
 *
 * It takes the colours of where it sits, so it needs no variant for the dark rail. A visitor who has chosen
 * nothing sees Default and Dark selected.
 */
@Component({
  selector: 'app-theme-switcher',
  imports: [NgIcon, HlmButtonImports, HlmDropdownMenuImports, HlmTooltipImports],
  providers: [provideIcons({ phosphorDesktopLight, phosphorMoonLight, phosphorSunLight })],
  host: { class: 'block', '[class.inline-flex]': "variant() === 'menu'" },
  styles: `
    /* Its own width decides whether the modes have room for their words: the rail does not, a sheet does. */
    .ts-rows { container-type: inline-size; }
    /* styles.css mutes any span in a segment (it is meant for counts); a mode's word takes its segment's colour. */
    .ts-word { display: none; color: inherit; }
    @container (min-width: 16rem) {
      .ts-word { display: inline; }
    }
    /* Touch: every segment is a 44px target, in either theme (WCAG 2.5.8, Apple HIG). */
    @media (pointer: coarse) {
      .ts-rows .seg > button { height: 44px; }
    }
  `,
  template: `
    @if (variant() === 'menu') {
      <button hlmBtn type="button" variant="ghost" size="icon" [attr.aria-label]="summary() + '. Change theme or mode'" [hlmDropdownMenuTrigger]="menu" [side]="side()" [align]="align()">
        <ng-icon [name]="theme.modeOption().icon" aria-hidden="true" />
      </button>
      <ng-template #menu>
        <hlm-dropdown-menu class="w-44">
          <hlm-dropdown-menu-group>
            <hlm-dropdown-menu-label>Theme</hlm-dropdown-menu-label>
            @for (t of themes; track t.id) {
              <button hlmDropdownMenuRadio [checked]="theme.id() === t.id" (triggered)="theme.set(t.id)">{{ t.label }}<hlm-dropdown-menu-radio-indicator /></button>
            }
          </hlm-dropdown-menu-group>
          <hlm-dropdown-menu-separator />
          <hlm-dropdown-menu-group>
            <hlm-dropdown-menu-label>Mode</hlm-dropdown-menu-label>
            @for (m of modes; track m.id) {
              <button hlmDropdownMenuRadio [checked]="theme.mode() === m.id" (triggered)="theme.setMode(m.id)"><ng-icon [name]="m.icon" aria-hidden="true" />{{ m.label }}<hlm-dropdown-menu-radio-indicator /></button>
            }
          </hlm-dropdown-menu-group>
        </hlm-dropdown-menu>
      </ng-template>
    } @else {
      <div class="ts-rows">
      <div class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-1">
        <span [id]="uid + '-theme'" class="text-[12px] font-medium">Theme</span>
        <div class="seg seg--fill" role="radiogroup" [attr.aria-labelledby]="uid + '-theme'" (keydown)="onArrow($event)">
          @for (t of themes; track t.id) {
            <button type="button" role="radio" [attr.aria-checked]="theme.id() === t.id" [attr.tabindex]="theme.id() === t.id ? 0 : -1" (click)="theme.set(t.id)">{{ t.label }}</button>
          }
        </div>
        <span [id]="uid + '-mode'" class="text-[12px] font-medium">Mode</span>
        <div class="seg seg--fill" role="radiogroup" [attr.aria-labelledby]="uid + '-mode'" (keydown)="onArrow($event)">
          @for (m of modes; track m.id) {
            <button type="button" role="radio" [attr.aria-checked]="theme.mode() === m.id" [attr.tabindex]="theme.mode() === m.id ? 0 : -1" [attr.aria-label]="m.hint" [hlmTooltip]="m.hint" (click)="theme.setMode(m.id)">
              <ng-icon [name]="m.icon" class="text-[15px]" aria-hidden="true" /><span class="ts-word" aria-hidden="true">{{ m.label }}</span>
            </button>
          }
        </div>
      </div>
      </div>
    }
  `,
})
export class ThemeSwitcher {
  /** `rows` for a place with room (the sidebar's footer), `menu` for one icon button. */
  readonly variant = input<'rows' | 'menu'>('rows');
  /** Where the menu opens, for the `menu` shape: a collapsed rail wants `right`. */
  readonly side = input<MenuSide>('bottom');
  readonly align = input<MenuAlign>('end');

  protected readonly theme = inject(Theme);
  protected readonly themes = THEMES;
  protected readonly modes = MODES;
  protected readonly uid = `theme-switcher-${nextId++}`;
  /** "Theme: Concept, dark" or "Theme: Default, system (light)". */
  protected readonly summary = computed(() => {
    const mode = this.theme.mode();
    return `Theme: ${this.theme.option().label}, ${mode === 'system' ? `system (${this.theme.scheme()})` : mode}`;
  });

  /** A radio group is one tab stop: the arrow keys move through it and choose, as native radios do. */
  protected onArrow(event: KeyboardEvent) {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    const radios = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    const from = radios.indexOf(event.target as HTMLButtonElement);
    if (from < 0) return;
    event.preventDefault();
    const next = radios[(from + step + radios.length) % radios.length];
    next.click();
    next.focus();
  }
}
