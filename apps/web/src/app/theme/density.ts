import { DOCUMENT, Service, computed, inject, signal } from '@angular/core';

/**
 * The densities the app ships. `id` is the value of `data-density`, on `<html>` for the person's choice and on
 * any region that is denser than its page. Density is separate from the theme: it changes heights, padding and
 * gaps, never colour and never a font size. The values live in src/density.css.
 */
export const DENSITIES = [
  { id: 'comfortable', label: 'Comfortable', short: 'Comfortable', icon: 'phosphorArrowsOutLineVerticalLight', hint: 'More room around every figure' },
  { id: 'compact', label: 'Compact', short: 'Compact', icon: 'phosphorArrowsInLineVerticalLight', hint: 'More rows and charts on a screen' },
] as const;

export type DensityId = (typeof DENSITIES)[number]['id'];

export const DEFAULT_DENSITY: DensityId = 'comfortable';

/** Where the choice is remembered. */
export const DENSITY_STORAGE_KEY = 'compass.density';

export const isDensityId = (value: unknown): value is DensityId => DENSITIES.some((d) => d.id === value);

/**
 * The density tokens: the same names and values as src/density.css (density-tokens.spec.ts compares the two).
 * The theme lab lists them, and reads the value in force from the page.
 */
export const DENSITY_TOKENS = [
  { name: '--space-page-x', utility: 'px-page-x', comfortable: '1.5rem', compact: '1rem', use: 'Page gutter' },
  { name: '--space-section', utility: 'gap-section', comfortable: '2rem', compact: '1.5rem', use: 'Between the sections of a page' },
  { name: '--space-section-lg', utility: 'gap-section-lg', comfortable: '3rem', compact: '2rem', use: 'Around a page’s hero, such as the brief’s summary' },
  { name: '--space-card-gap', utility: 'gap-card-gap', comfortable: '1rem', compact: '0.5rem', use: 'Between cards in a grid' },
  { name: '--space-card-pad', utility: 'p-card-pad', comfortable: '1.5rem', compact: '1rem', use: 'Inside a card' },
  { name: '--space-stack', utility: 'gap-stack', comfortable: '0.75rem', compact: '0.5rem', use: 'A title to its content' },
  { name: '--space-inline', utility: 'gap-inline', comfortable: '0.5rem', compact: '0.25rem', use: 'Items on one line' },
  { name: '--row-h', utility: 'h-row', comfortable: '2.5rem', compact: '2rem', use: 'Table and list rows' },
  { name: '--control-h-xs', utility: 'h-control-xs', comfortable: '1.75rem', compact: '1.5rem', use: 'Extra-small buttons, segments' },
  { name: '--control-h-sm', utility: 'h-control-sm', comfortable: '2rem', compact: '1.75rem', use: 'Small buttons, chips' },
  { name: '--control-h', utility: 'h-control', comfortable: '2.25rem', compact: '2rem', use: 'Buttons, fields, selects' },
  { name: '--control-h-lg', utility: 'h-control-lg', comfortable: '2.5rem', compact: '2.25rem', use: 'Prominent actions' },
  { name: '--cell-pad-x', utility: 'px-cell-x', comfortable: '1rem', compact: '0.75rem', use: 'Table cells' },
  { name: '--leading-body', utility: 'text-body', comfortable: '1.25rem', compact: '1.125rem', use: 'Line height of 14 px text in rows' },
] as const;

/** Layout constants: the same in both densities. */
export const LAYOUT_CONSTANTS = [
  { name: '--chart-h', utility: 'h-chart', value: '180px', use: 'A chart in an overview' },
  { name: '--chart-h-hero', utility: 'h-chart-hero', value: '320px', use: 'The featured chart of a page' },
  { name: '--spark-w', utility: '', value: '80px', use: 'Sparkline width' },
  { name: '--spark-h', utility: '', value: '24px', use: 'Sparkline height' },
  { name: '--content-max', utility: 'max-w-content', value: '1280px', use: 'Reading pages; boards and the builder are full width' },
  { name: '--measure', utility: 'max-w-measure', value: '68ch', use: 'A line of prose' },
  { name: '--tile-min', utility: 'min-w-tile', value: '200px', use: 'The least width of a KPI tile or a chart' },
  { name: '--pane-evidence', utility: 'w-evidence', value: '400px', use: '“Behind the numbers” beside a conversation' },
] as const;

/** Chart heights in px, for charts drawn on a canvas: the same numbers as --chart-h and --chart-h-hero. */
export const CHART_HEIGHT = { overview: 180, hero: 320 } as const;
export type ChartSize = keyof typeof CHART_HEIGHT;

/** The density a page starts with: an explicit `data-density`, else the remembered choice, else comfortable. */
export function densityOf(root: Pick<HTMLElement, 'getAttribute'>, stored: string | null = null): DensityId {
  const attr = root.getAttribute('data-density');
  if (isDensityId(attr)) return attr;
  return isDensityId(stored) ? stored : DEFAULT_DENSITY;
}

/** The app's density: one signal, written to `<html data-density>` and remembered in local storage. */
@Service()
export class Density {
  private readonly doc = inject(DOCUMENT);
  private readonly current = signal<DensityId>(densityOf(this.doc.documentElement, this.restore()));

  readonly id = this.current.asReadonly();
  readonly option = computed(() => DENSITIES.find((d) => d.id === this.current()) ?? DENSITIES[0]);
  readonly compact = computed(() => this.current() === 'compact');

  constructor() {
    // The page carries the attribute from the first render on, so a region can always read its parent's density.
    this.doc.documentElement.setAttribute('data-density', this.current());
  }

  set(id: DensityId) {
    this.doc.documentElement.setAttribute('data-density', id);
    this.current.set(id);
    try {
      this.doc.defaultView?.localStorage.setItem(DENSITY_STORAGE_KEY, id);
    } catch {
      // Private mode or blocked storage: the density still applies for this visit.
    }
  }

  private restore(): string | null {
    try {
      return this.doc.defaultView?.localStorage.getItem(DENSITY_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }
}
