import { Component, ElementRef, afterRenderEffect, inject, input, signal } from '@angular/core';
import { type PairKind, REQUIRED, apcaLc, passes, toHex, wcagRatio } from './contrast';
import { LabState, isConceptPane, paneOf, readToken, rgbOf } from './lab-kit';
import { COLOR_ROLES, type ContrastPair, SCALES, STEP_JOBS } from './tokens';

interface Swatch {
  name: string;
  step: string;
  hex: string;
  /** WCAG ratio against the raised surface (white in the concept theme). */
  ratio: number;
}

/**
 * The palette a pane has. The concept theme has scales, so each step is shown with its contrast on the raised
 * surface; the default themes have a flat list of hand-picked roles, shown as that.
 */
@Component({
  selector: 'app-lab-palette',
  host: { class: 'block' },
  template: `
    @if (scales().length) {
      <div class="flex flex-col gap-2">
        @for (s of scales(); track s.name) {
          <div class="grid grid-cols-[52px_minmax(0,1fr)] items-start gap-3">
            <div class="min-w-0">
              <p class="text-[13px] font-medium capitalize">{{ s.name }}</p>
            </div>
            <div class="flex gap-px">
              @for (w of s.swatches; track w.name) {
                <div class="min-w-0 flex-1" [attr.title]="w.name + ' ' + w.hex + ', ' + w.ratio.toFixed(2) + ':1 on the raised surface'">
                  <span class="block h-7" [class]="$first ? 'rounded-l-[4px]' : $last ? 'rounded-r-[4px]' : ''" [style.background]="w.hex" [style.box-shadow]="w.ratio < 1.25 ? 'inset 0 0 0 1px var(--border)' : null"></span>
                  <span class="mt-1 flex justify-between gap-1 px-0.5 text-[11px] leading-none tabular-nums"><span class="font-medium">{{ w.step }}</span><span class="text-muted-foreground truncate">{{ w.ratio.toFixed(1) }}</span></span>
                </div>
              }
            </div>
          </div>
        }
      </div>
      <p class="text-muted-foreground mt-3 text-[12px]">Under each step: its number, then its WCAG contrast on the raised surface. A step has the same job in every hue scale:</p>
      <dl class="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[12px]">
        @for (j of jobs; track j.steps) {
          <dt class="font-medium tabular-nums">{{ j.steps }}</dt>
          <dd class="text-muted-foreground">{{ j.job }}</dd>
        }
      </dl>
    } @else {
      <ul class="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        @for (r of roles(); track r.name) {
          <li class="flex min-w-0 items-center gap-2">
            <span class="size-5 shrink-0 rounded-[4px] border border-border" [style.background]="r.value"></span>
            <span class="min-w-0">
              <span class="block truncate text-[12px]">{{ r.name }}</span>
              <span class="text-muted-foreground block truncate text-[11.5px] tabular-nums">{{ r.hex }}</span>
            </span>
          </li>
        }
      </ul>
      <p class="text-muted-foreground mt-3 text-[12px]">Each role is picked by hand. There is no scale behind them, so a new tint or border has to be invented each time.</p>
    }
  `,
})
export class LabPalette {
  protected readonly jobs = STEP_JOBS;
  protected readonly scales = signal<{ name: string; swatches: Swatch[] }[]>([]);
  protected readonly roles = signal<{ name: string; value: string; hex: string }[]>([]);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  constructor() {
    const lab = inject(LabState);
    afterRenderEffect(() => {
      lab.version();
      const el = this.host.nativeElement;
      const surface = rgbOf(readToken(el, '--card')) ?? [255, 255, 255];
      if (isConceptPane(el)) {
        this.scales.set(
          SCALES.map((s) => ({
            name: s.name,
            swatches: s.steps.map((step) => {
              const rgb = rgbOf(readToken(el, `--jc-${s.name}-${step}`)) ?? [0, 0, 0];
              return { name: `${s.name}-${step}`, step: String(step), hex: toHex(rgb), ratio: wcagRatio(rgb, surface) };
            }),
          })),
        );
        this.roles.set([]);
      } else {
        const canvas = rgbOf(readToken(el, '--background')) ?? [0, 0, 0];
        this.scales.set([]);
        this.roles.set(
          COLOR_ROLES.map((name) => {
            const value = readToken(el, name);
            const rgb = rgbOf(value, canvas);
            return { name, value, hex: rgb ? toHex(rgb) : 'not set' };
          }),
        );
      }
    });
  }
}

interface Row {
  label: string;
  fg: string;
  bg: string;
  fgHex: string;
  bgHex: string;
  kind: PairKind;
  ratio: number;
  lc: number;
  pass: boolean;
  missing: boolean;
}

/**
 * A live contrast audit of the pane it sits in: each pair is read from the rendered tokens, then measured with
 * WCAG 2 (the gate) and APCA (the second reading). Pass and fail are words, never colour alone.
 */
@Component({
  selector: 'app-lab-contrast',
  host: { class: 'block' },
  template: `
    <div class="overflow-x-auto" tabindex="0" role="region" [attr.aria-label]="caption() + ', ' + pane()">
      <table class="w-full min-w-[420px] text-[12.5px]">
        <caption class="sr-only">{{ caption() }}</caption>
        <thead>
          <tr class="text-muted-foreground text-left">
            <th scope="col" class="border-b border-border py-1.5 pr-2 font-medium">Pair</th>
            <th scope="col" class="border-b border-border px-2 py-1.5 font-medium">Sample</th>
            <th scope="col" class="border-b border-border px-2 py-1.5 text-right font-medium">WCAG</th>
            <th scope="col" class="border-b border-border px-2 py-1.5 text-right font-medium">APCA</th>
            <th scope="col" class="border-b border-border py-1.5 pl-2 font-medium">Needs</th>
          </tr>
        </thead>
        <tbody>
          @for (r of rows(); track r.label) {
            <tr>
              <th scope="row" class="border-b border-border py-1.5 pr-2 text-left font-normal">
                {{ r.label }}
                <span class="text-muted-foreground block text-[11.5px]">{{ r.fg }} on {{ r.bg }}</span>
              </th>
              <td class="border-b border-border px-2 py-1.5">
                @if (r.missing) {
                  <span class="text-muted-foreground">not set</span>
                } @else {
                  <!-- A drawn sample, not live text: a failing pair is shown without putting unreadable text on the page -->
                  <span class="inline-flex h-6 w-14 flex-col justify-center gap-[3px] rounded-[4px] px-1.5" [style.background]="r.bgHex" role="img" [attr.aria-label]="r.fgHex + ' on ' + r.bgHex">
                    @if (r.kind === 'text') {
                      <span class="h-[3px] w-full rounded-[1px]" [style.background]="r.fgHex"></span>
                      <span class="h-[3px] w-3/5 rounded-[1px]" [style.background]="r.fgHex"></span>
                    } @else {
                      <span class="h-[3px] w-full rounded-[1px]" [style.background]="r.fgHex"></span>
                    }
                  </span>
                }
              </td>
              <td class="border-b border-border px-2 py-1.5 text-right tabular-nums">{{ r.missing ? '' : r.ratio.toFixed(2) + ':1' }}</td>
              <td class="border-b border-border px-2 py-1.5 text-right tabular-nums">{{ r.missing ? '' : 'Lc ' + r.lc.toFixed(0) }}</td>
              <td class="border-b border-border py-1.5 pl-2 whitespace-nowrap">
                @if (!r.missing) {
                  <span class="tabular-nums">{{ need[r.kind] }}:1</span>
                  <span class="ml-1.5 font-medium" [class]="r.pass ? '' : 'underline decoration-2 underline-offset-2'">{{ r.pass ? 'pass' : 'fail' }}</span>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <p class="text-muted-foreground mt-2 text-[12px]" role="status">{{ summary() }}</p>
  `,
})
export class LabContrast {
  readonly pairs = input.required<readonly ContrastPair[]>();
  readonly caption = input('Contrast of each colour pair');
  protected readonly need = REQUIRED;
  protected readonly rows = signal<Row[]>([]);
  protected readonly summary = signal('');
  /** The pane's name, so the two scrollable regions of a comparison have different labels. */
  protected readonly pane = signal('');
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  constructor() {
    const lab = inject(LabState);
    afterRenderEffect(() => {
      lab.version();
      const el = this.host.nativeElement;
      this.pane.set(paneOf(el).getAttribute('aria-label') ?? '');
      const rows = this.pairs().map((p): Row => {
        const value = (name: string) => (name.startsWith('--') ? readToken(el, name) : name);
        const bg = rgbOf(value(p.bg));
        const fg = bg && rgbOf(value(p.fg), bg);
        if (!bg || !fg) return { ...p, fgHex: '', bgHex: '', ratio: 0, lc: 0, pass: false, missing: true };
        const ratio = wcagRatio(fg, bg);
        return { ...p, fgHex: toHex(fg), bgHex: toHex(bg), ratio, lc: Math.abs(apcaLc(fg, bg)), pass: passes(ratio, p.kind), missing: false };
      });
      this.rows.set(rows);
      const measured = rows.filter((r) => !r.missing);
      const failed = measured.filter((r) => !r.pass);
      this.summary.set(failed.length ? `${measured.length - failed.length} of ${measured.length} pairs pass. Failing: ${failed.map((r) => r.label.toLowerCase()).join('; ')}.` : `All ${measured.length} pairs pass.`);
    });
  }
}
