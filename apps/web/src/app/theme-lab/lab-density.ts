import { Component, ElementRef, afterRenderEffect, inject, signal, viewChild } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { Theme } from '../theme';
import { DENSITIES, DENSITY_TOKENS, Density, LAYOUT_CONSTANTS, type DensityId } from '../theme/density';
import { DensitySwitch } from '../theme/density-switch';

/** `1.5rem` → `24px`: a token as people talk about it. Anything that is not rem is shown as written. */
export function inPx(value: string, rootPx = 16): string {
  const rem = /^(-?[\d.]+)rem$/.exec(value.trim());
  return rem ? `${Math.round(parseFloat(rem[1]!) * rootPx * 100) / 100}px` : value.trim();
}

const NIGHTS = [
  { hotel: 'Dubai Business Bay', otb: '€184,300', gap: '▲ €41,200' },
  { hotel: 'Lisbon Chiado', otb: '€96,010', gap: '▼ €5,865' },
  { hotel: 'Vienna Ring', otb: '€211,746', gap: '▲ €2,846' },
] as const;

/**
 * The density section of the theme lab: the switch, the same content at both densities side by side, and the
 * tokens with the values each pane resolves them to (read from the page, like every other value in the lab).
 */
@Component({
  selector: 'app-lab-density',
  imports: [HlmButtonImports, DensitySwitch],
  host: { class: 'block' },
  styles: `
    .ld-pane { min-width: 0; border: 1px dashed var(--input); border-radius: 8px; padding: var(--space-card-pad); background: var(--background); }
    .ld-table { width: 100%; border-collapse: collapse; font-size: 13px; line-height: var(--leading-body); }
    .ld-table th, .ld-table td { height: var(--row-h); padding: 0 var(--cell-pad-x); border-bottom: 1px solid var(--border); text-align: left; font-weight: 400; }
    .ld-table thead th { font-size: 12px; font-weight: 500; color: var(--muted-foreground); }
    .ld-table th:first-child { padding-left: 0; }
    .ld-table td:last-child, .ld-table th:last-child { padding-right: 0; text-align: right; }
    .ld-table tbody tr:last-child > * { border-bottom: 0; }
    .ld-tokens { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    .ld-tokens th, .ld-tokens td { padding: 6px 12px 6px 0; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; font-weight: 400; }
    .ld-tokens thead th { font-size: 12px; font-weight: 500; color: var(--muted-foreground); }
  `,
  template: `
    <div class="gap-card-gap flex flex-wrap items-end">
      <app-density-switch class="w-56" />
      <p class="text-muted-foreground max-w-measure text-[13px]" role="status">The app is {{ density.option().label.toLowerCase() }} now. The switch is also in the sidebar, under the theme; the choice is remembered in this browser.</p>
    </div>

    <div class="mt-card-pad grid gap-4 lg:grid-cols-2">
      @for (d of densities; track d.id) {
        <section #pane class="ld-pane" [attr.data-density]="d.id" [attr.data-pane]="d.id" [attr.aria-label]="d.label + ' specimen'">
          <p class="text-muted-foreground mb-3 text-[12px]">{{ d.label }} · data-density="{{ d.id }}"</p>
          <div class="gap-stack flex flex-col">
            <div class="kpi-row">
              <div class="insight-card gap-stack flex min-w-0 flex-col p-card-pad">
                <p class="text-muted-foreground text-[12px]/4 font-medium">RevPAR · next 30 nights</p>
                <p class="text-kpi-sm font-semibold tabular-nums">€144</p>
                <p class="text-[12px]/4 tabular-nums">▲ 4.2% vs last year</p>
              </div>
              <div class="insight-card gap-stack flex min-w-0 flex-col p-card-pad">
                <p class="text-muted-foreground text-[12px]/4 font-medium">Occupancy · next 30 nights</p>
                <p class="text-kpi-sm font-semibold tabular-nums">51.4%</p>
                <p class="text-[12px]/4 tabular-nums">±0.0 pts vs last year</p>
              </div>
            </div>
            <div class="gap-inline flex flex-wrap items-center">
              <button hlmBtn type="button">Review 3 nights</button>
              <button hlmBtn type="button" variant="secondary" size="sm">Export</button>
              <span class="filter-btn">Stay dates <span class="font-medium">Next 30 nights</span></span>
              <span class="field-input inline-flex w-28 items-center">Lisbon</span>
            </div>
            <div class="insight-card px-card-pad py-1">
              <table class="ld-table">
                <caption class="sr-only">Three nights, at {{ d.label.toLowerCase() }} density</caption>
                <thead>
                  <tr><th scope="col">Hotel</th><th scope="col">On the books</th><th scope="col">vs last year</th></tr>
                </thead>
                <tbody>
                  @for (n of nights; track n.hotel) {
                    <tr><th scope="row">{{ n.hotel }}</th><td class="tabular-nums">{{ n.otb }}</td><td class="tabular-nums">{{ n.gap }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </section>
      }
    </div>

    <h3 class="mt-8 text-[16px] font-semibold">Density tokens</h3>
    <p class="text-muted-foreground max-w-measure mt-1 mb-4 text-[14px]">Each value is read from the specimen above it belongs to. The font sizes are not in this list: density never changes them.</p>
    <div class="overflow-x-auto" tabindex="0" role="region" aria-label="Density tokens">
      <table class="ld-tokens">
        <caption class="sr-only">Density tokens: the Tailwind utility, the value when comfortable, the value when compact, and what each is for</caption>
        <thead>
          <tr><th scope="col">Token</th><th scope="col">Utility</th><th scope="col">Comfortable</th><th scope="col">Compact</th><th scope="col">Used for</th></tr>
        </thead>
        <tbody>
          @for (t of tokens; track t.name) {
            <tr>
              <th scope="row" class="font-mono text-[12px] whitespace-nowrap">{{ t.name }}</th>
              <td class="font-mono text-[12px] whitespace-nowrap">{{ t.utility }}</td>
              <td class="tabular-nums" [attr.data-token]="t.name" data-density-value="comfortable">{{ read()[t.name]?.comfortable || 'not set' }}</td>
              <td class="tabular-nums" [attr.data-token]="t.name" data-density-value="compact">{{ read()[t.name]?.compact || 'not set' }}</td>
              <td class="text-muted-foreground">{{ t.use }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <h3 class="mt-8 text-[16px] font-semibold">Layout constants</h3>
    <p class="text-muted-foreground max-w-measure mt-1 mb-4 text-[14px]">The same at both densities: a 12-column grid, reading pages capped at 1280 px, at most four KPI tiles or three charts on a row, charts 180 px tall in an overview and 320 px when featured.</p>
    <div class="overflow-x-auto" tabindex="0" role="region" aria-label="Layout constants">
      <table class="ld-tokens">
        <caption class="sr-only">Layout constants: the token, the Tailwind utility, the value and what it is for</caption>
        <thead>
          <tr><th scope="col">Token</th><th scope="col">Utility</th><th scope="col">Value</th><th scope="col">Used for</th></tr>
        </thead>
        <tbody>
          @for (t of constants; track t.name) {
            <tr>
              <th scope="row" class="font-mono text-[12px] whitespace-nowrap">{{ t.name }}</th>
              <td class="font-mono text-[12px] whitespace-nowrap">{{ t.utility || '–' }}</td>
              <td class="tabular-nums">{{ read()[t.name]?.comfortable || 'not set' }}</td>
              <td class="text-muted-foreground">{{ t.use }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class LabDensity {
  protected readonly density = inject(Density);
  private readonly theme = inject(Theme);
  protected readonly densities = DENSITIES;
  protected readonly tokens = DENSITY_TOKENS;
  protected readonly constants = LAYOUT_CONSTANTS;
  protected readonly nights = NIGHTS;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly pane = viewChild<ElementRef<HTMLElement>>('pane');
  /** Each token as the two specimens resolve it. */
  protected readonly read = signal<Record<string, Record<DensityId, string>>>({});

  constructor() {
    afterRenderEffect(() => {
      // Read again when the theme or the app's density changes: neither should move a value, and the page shows it.
      void [this.theme.id(), this.density.id(), this.pane()];
      const root = this.host.nativeElement;
      const view = root.ownerDocument.defaultView;
      if (!view) return;
      const rootPx = parseFloat(view.getComputedStyle(root.ownerDocument.documentElement).fontSize) || 16;
      const next: Record<string, Record<DensityId, string>> = {};
      for (const d of DENSITIES) {
        const pane = root.querySelector(`[data-pane="${d.id}"]`);
        if (!pane) continue;
        const style = view.getComputedStyle(pane);
        for (const name of [...DENSITY_TOKENS, ...LAYOUT_CONSTANTS].map((t) => t.name)) {
          (next[name] ??= { comfortable: '', compact: '' })[d.id] = inPx(style.getPropertyValue(name), rootPx);
        }
      }
      if (JSON.stringify(next) !== JSON.stringify(this.read())) this.read.set(next);
    });
  }
}
