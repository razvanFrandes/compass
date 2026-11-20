import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, Service, TemplateRef, afterRenderEffect, computed, inject, input, signal } from '@angular/core';
import { Theme } from '../theme';
import type { Rgb } from './contrast';
import { CONCEPT_ONLY } from './tokens';

/** What the lab compares the concept theme with, and a version that changes whenever anything must be re-read. */
@Service()
export class LabState {
  private readonly theme = inject(Theme);
  readonly compare = signal<'dark' | 'light'>('dark');
  /** Bumped when the web fonts finish loading: measured type changes with them. */
  private readonly fonts = signal(0);
  readonly version = computed(() => `${this.theme.id()}:${this.compare()}:${this.fonts()}`);

  constructor() {
    globalThis.document?.fonts?.ready.then(() => this.fonts.update((n) => n + 1));
  }
}

/** The themed pane an element sits in. */
export const paneOf = (el: Element): Element => el.closest('[data-theme]') ?? el.ownerDocument.documentElement;
export const isConceptPane = (el: Element) => paneOf(el).getAttribute('data-theme') === 'juyo-concept';

/** A custom property as the pane resolves it; empty when the theme does not set it. */
export const readToken = (el: Element, name: string) => getComputedStyle(el).getPropertyValue(name).trim();

let canvas: CanvasRenderingContext2D | null | undefined;
/** Any CSS colour as 8-bit sRGB, composited over a backdrop when it has alpha. Null when it is not a colour. */
export function rgbOf(value: string, backdrop: Rgb = [255, 255, 255]): Rgb | null {
  if (!value || !globalThis.CSS?.supports('color', value)) return null;
  canvas ??= globalThis.document?.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!canvas) return null;
  canvas.canvas.width = canvas.canvas.height = 1;
  canvas.fillStyle = `rgb(${backdrop.join(' ')})`;
  canvas.fillRect(0, 0, 1, 1);
  canvas.fillStyle = value;
  canvas.fillRect(0, 0, 1, 1);
  const [r, g, b] = canvas.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

const RESET = Object.fromEntries(CONCEPT_ONLY.map((name) => [name, 'initial']));

/**
 * The same content in two themes: the concept theme and a default one. Each pane sets `data-theme`, so every
 * token, and the bridge's donut scope, resolves for that pane alone.
 */
@Component({
  selector: 'app-lab-compare',
  imports: [NgTemplateOutlet],
  styles: `
    .lab-pane {
      min-width: 0; padding: 16px; border: 1px solid var(--border); border-radius: 8px;
      background: var(--background); color: var(--foreground);
      /* A pane starts from the browser's own type, not from the page around it. */
      font-family: var(--font-sans); font-size: 1rem; line-height: 1.5; font-weight: 400; font-stretch: normal;
      letter-spacing: normal; font-variant-numeric: normal; text-transform: none;
    }
    .lab-pane__name { margin: 0 0 12px; font-size: 12px; line-height: 16px; color: var(--muted-foreground); }
  `,
  template: `
    <div class="grid items-start gap-3" [class]="wide() ? '' : 'xl:grid-cols-2'">
      <div class="lab-pane light" data-theme="juyo-concept" role="group" aria-label="Juyo concept">
        <p class="lab-pane__name">Juyo concept</p>
        <ng-container [ngTemplateOutlet]="content()" [ngTemplateOutletContext]="{ $implicit: true }" />
      </div>
      <div class="lab-pane" [class]="lab.compare()" [attr.data-theme]="lab.compare()" [style]="reset" role="group" [attr.aria-label]="'Default theme, ' + lab.compare()">
        <p class="lab-pane__name">Default, {{ lab.compare() }}</p>
        <ng-container [ngTemplateOutlet]="content()" [ngTemplateOutletContext]="{ $implicit: false }" />
      </div>
    </div>
  `,
})
export class LabCompare {
  /** The specimen. Its context value is true in the concept pane. */
  readonly content = input.required<TemplateRef<{ $implicit: boolean }>>();
  /** Stack the panes at every width (for wide specimens such as tables and charts). */
  readonly wide = input(false);
  protected readonly lab = inject(LabState);
  protected readonly reset = RESET;
}

/** Shows a computed CSS property of the element projected into it, e.g. the radius a utility really produces. */
@Component({
  selector: 'app-lab-probe',
  host: { class: 'flex flex-col items-start gap-1.5' },
  template: `
    <ng-content />
    <span class="text-muted-foreground text-[12px] tabular-nums">{{ label() }}<span class="text-foreground ml-1.5">{{ value() }}</span></span>
  `,
})
export class LabProbe {
  readonly read = input.required<string>();
  readonly label = input('');
  protected readonly value = signal('');
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  constructor() {
    const lab = inject(LabState);
    afterRenderEffect(() => {
      lab.version();
      const target = this.host.nativeElement.firstElementChild;
      if (target) this.value.set(short(getComputedStyle(target).getPropertyValue(this.read())));
    });
  }
}

/** "0.3125rem" and "4.8px" both read better as "5px" / "4.8px"; long shadows are cut. */
export function short(value: string) {
  const v = value.trim();
  if (/^-?[\d.]+px$/.test(v)) return `${+Number.parseFloat(v).toFixed(2)}px`;
  if (v === 'none' || v === '') return 'none';
  return v.length > 64 ? `${v.slice(0, 61)}…` : v;
}
