import { Component, ElementRef, inject, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorArrowsInLineVerticalLight, phosphorArrowsOutLineVerticalLight } from '@ng-icons/phosphor-icons/light';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { DENSITIES, Density, type DensityId } from './density';

let nextId = 0;

/**
 * Comfortable or Compact: the person's density, beside the theme controls. A radio group: one stop in the tab
 * order, the arrow keys move the choice. With `collapsed` (the sidebar's rail) it shows icons, stacked.
 */
@Component({
  selector: 'app-density-switch',
  imports: [NgIcon, HlmTooltipImports],
  providers: [provideIcons({ phosphorArrowsInLineVerticalLight, phosphorArrowsOutLineVerticalLight })],
  host: { class: 'block', '[attr.data-collapsed]': 'collapsed() ? "" : null' },
  styles: `
    .seg > button ng-icon { font-size: 16px; }
    :host([data-collapsed]) .seg { flex-direction: column; }
    :host([data-collapsed]) .seg > button { flex: none; height: 28px; padding: 0; }
  `,
  template: `
    <p [id]="labelId" class="pb-1 text-[12px] font-medium" [class.sr-only]="collapsed()">Density</p>
    <div class="seg seg--fill" role="radiogroup" [attr.aria-labelledby]="labelId" (keydown)="onKey($event)">
      @for (d of densities; track d.id) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="density.id() === d.id"
          [attr.aria-label]="d.label"
          [attr.tabindex]="density.id() === d.id ? 0 : -1"
          [attr.data-density-option]="d.id"
          [hlmTooltip]="collapsed() ? d.label : d.hint"
          [position]="collapsed() ? 'right' : 'top'"
          [sideOffset]="collapsed() ? tipGap() : 8"
          (click)="density.set(d.id)"
        >
          @if (collapsed()) {
            <ng-icon [name]="d.icon" aria-hidden="true" />
          } @else {
            {{ d.short }}
          }
        </button>
      }
    </div>
  `,
})
export class DensitySwitch {
  /** Icons only, stacked: the sidebar's rail. */
  readonly collapsed = input(false);
  /** How far a tooltip sits from the control when collapsed, in px. */
  readonly tipGap = input(20);

  protected readonly density = inject(Density);
  protected readonly densities = DENSITIES;
  protected readonly labelId = `density-label-${++nextId}`;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Arrow keys choose the next or the previous density and take the focus along; Home and End go to the ends. */
  protected onKey(event: KeyboardEvent) {
    const index = DENSITIES.findIndex((d) => d.id === this.density.id());
    const last = DENSITIES.length - 1;
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (index + 1) % DENSITIES.length : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (index + last) % DENSITIES.length : event.key === 'Home' ? 0 : event.key === 'End' ? last : -1;
    if (next < 0) return;
    event.preventDefault();
    this.choose(DENSITIES[next].id);
  }

  private choose(id: DensityId) {
    this.density.set(id);
    this.host.nativeElement.querySelector<HTMLElement>(`[data-density-option="${id}"]`)?.focus();
  }
}
