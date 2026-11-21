import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, Service, TemplateRef, afterRenderEffect, computed, inject, input, signal } from '@angular/core';
import { Theme } from '../theme';
import type { Rgb } from './contrast';
import { CONCEPT_ONLY } from './tokens';

/**
 * The four combinations the lab puts side by side: two themes, each in two modes. A pane wears a combination the
 * way `<html>` does: `data-theme` selects the tokens and the class is the mode. For the default themes the
 * attribute is the mode's name (styles.css accepts `[data-theme='light']` and `[data-theme='dark']` on any element).
 */
export const LAB_PANES = [
  { id: 'concept-light', concept: true, scheme: 'light', attr: 'juyo-concept', name: 'Juyo concept, light' },
  { id: 'concept-dark', concept: true, scheme: 'dark', attr: 'juyo-concept', name: 'Juyo concept, dark' },
  { id: 'default-light', concept: false, scheme: 'light', attr: 'light', name: 'Default, light' },
  { id: 'default-dark', concept: false, scheme: 'dark', attr: 'dark', name: 'Default, dark' },
] as const;
export type LabPane = (typeof LAB_PANES)[number];

/** Which of the four are on the page. */
export const LAB_VIEWS = [
  { id: 'all', label: 'All four' },
  { id: 'concept', label: 'Concept' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
] as const;
export type LabView = (typeof LAB_VIEWS)[number]['id'];

/** What the specimen templates get: `let-concept` (the implicit value) and `let-pane="pane"`. */
export interface LabContext {
  $implicit: boolean;
  pane: LabPane;
}

/** Which panes the lab shows, and a version that changes whenever anything must be re-read. */
@Service()
export class LabState {
  private readonly theme = inject(Theme);
  readonly show = signal<LabView>('all');
  readonly panes = computed(() => {
    const show = this.show();
    return LAB_PANES.filter((p) => show === 'all' || (show === 'concept' ? p.concept : p.scheme === show));
  });
  /** Bumped when the web fonts finish loading: measured type changes with them. */
  private readonly fonts = signal(0);
  readonly version = computed(() => `${this.theme.id()}:${this.theme.scheme()}:${this.show()}:${this.fonts()}`);

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
 * The same content in every combination of theme and mode on show. Each pane sets `data-theme` and the mode's
 * class, so every token, and the bridge's donut scope, resolves for that pane alone.
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
    <div class="grid items-start gap-3" [class]="wide() && lab.panes().length < 4 ? '' : 'xl:grid-cols-2'">
      @for (p of lab.panes(); track p.id) {
        <div class="lab-pane @container" [class]="p.scheme" [attr.data-theme]="p.attr" [style]="p.concept ? null : reset" role="group" [attr.aria-label]="p.name">
          <p class="lab-pane__name">{{ p.name }}</p>
          <ng-container [ngTemplateOutlet]="content()" [ngTemplateOutletContext]="{ $implicit: p.concept, pane: p }" />
        </div>
      }
    </div>
  `,
})
export class LabCompare {
  /** The specimen. Its implicit context value is true in a concept pane; `pane` is the combination. */
  readonly content = input.required<TemplateRef<LabContext>>();
  /** A wide specimen (charts): two panes stack instead of sharing a row. Four always make a two-by-two grid. */
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
