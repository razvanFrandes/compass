import { Component, DOCUMENT, inject, signal } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { LabCharts } from './lab-charts';
import { LabContrast, LabPalette } from './lab-colour';
import { LabDensity } from './lab-density';
import { LAB_VIEWS, LabCompare, LabProbe, LabState } from './lab-kit';
import { LabTokenTable } from './lab-token-table';
import { LabType } from './lab-type';
import { COLOR_ROLES, CONCEPT_ROLES, CONTRAST_PAIRS, PRIMITIVES, RAIL_PAIRS } from './tokens';

const SECTIONS = [
  { id: 'direction', label: 'Direction' },
  { id: 'colour', label: 'Colour' },
  { id: 'type', label: 'Type' },
  { id: 'density', label: 'Density' },
  { id: 'shape', label: 'Shape' },
  { id: 'elevation', label: 'Elevation' },
  { id: 'motion', label: 'Motion' },
  { id: 'components', label: 'Components' },
  { id: 'charts', label: 'Charts' },
  { id: 'tokens', label: 'Tokens' },
] as const;

const PRINCIPLES = [
  { name: 'Paper for work, ink for the frame', text: 'Revenue managers read small figures for hours, and dark text on a light surface is the easier read. Juyo’s near-black keeps the rail, so the product still opens on the brand.' },
  { name: 'Colour has three jobs', text: 'Blue is this period’s data. Violet is Kassandra. Orange is a decision that waits for you. Buttons, selection and text are ink, so a colour on screen always means one of the three.' },
  { name: 'Figures are the display type', text: 'One family, Archivo, on its width axis: wide for headings, normal for text, condensed tabular figures for numbers. A 13px column takes the room an 11.5px one did.' },
  { name: 'Lines before shadows', text: 'Layers are separated by tone and a hairline. A shadow means one thing: this floats above the page. Radius follows size, from 2px marks to 10px dialogs.' },
  { name: 'Fast and quiet', text: 'A state change takes 110 ms on one curve. Nothing blurs, bounces or scales. Charts draw once, in 400 ms.' },
  { name: 'Dark is the same ledger in ink', text: 'Not an inversion: every scale has a dark column built for the same jobs, so step 5 is a chart mark and step 6 is text in both modes. The rail keeps Juyo’s ink; the workspace is graphite, one step above it, and each layer is lighter than the one under it.' },
] as const;

/** The motion the default themes write in their components, for the comparison. */
const DEFAULT_MOTION = [
  { name: 'Hover and press', value: '120–175 ms, ease', ms: 175 },
  { name: 'Popover, sheet', value: '200–260 ms', ms: 260 },
  { name: 'Generated content', value: '320 ms, with blur', ms: 320 },
  { name: 'Chart draw', value: '600–700 ms', ms: 700 },
] as const;
const CONCEPT_MOTION = [
  { name: 'Instant: hover', token: '--motion-instant', ms: 70 },
  { name: 'Fast: toggles, selection', token: '--motion-fast', ms: 110 },
  { name: 'Moderate: popover, content', token: '--motion-moderate', ms: 180 },
  { name: 'Slow: panel, sheet', token: '--motion-slow', ms: 280 },
  { name: 'Chart draw', token: '--motion-chart', ms: 400 },
] as const;

const NIGHTS = [
  { hotel: 'Dubai Business Bay', night: 'Tue 16 Dec', otb: '€184,300', ly: '€143,100', gap: '+€41,200', fill: 86, tick: 67, up: true },
  { hotel: 'Lisbon Chiado', night: 'Wed 17 Dec', otb: '€96,010', ly: '€101,875', gap: '−€5,865', fill: 58, tick: 62, up: false },
  { hotel: 'Vienna Ring', night: 'Thu 18 Dec', otb: '€211,746', ly: '€208,900', gap: '+€2,846', fill: 74, tick: 73, up: true },
] as const;

/**
 * /theme-lab: the design system of the "Juyo concept" theme, documented next to the default theme, each in its
 * light and dark mode: four panes. The page is built from the app's own classes and components, and its tables
 * read the rendered CSS.
 */
@Component({
  selector: 'app-theme-lab',
  imports: [NgIcon, HlmButtonImports, LabCompare, LabProbe, LabPalette, LabContrast, LabType, LabTokenTable, LabCharts, LabDensity],
  providers: [LabState],
  host: { class: 'block' },
  styles: `
    .lab-h2 { scroll-margin-top: 72px; outline: none; }
    .lab-section { padding-top: 40px; }
    .lab-swatch-box { width: 64px; height: 44px; border: 1px solid var(--field-border); background: var(--card); }
    .lab-bar { height: 6px; border-radius: 1px; background: var(--foreground); }
  `,
  template: `
    <div class="page pt-section pb-28 lg:pb-section-lg">
      <header class="max-w-[72ch]">
        <h1 class="text-[26px] font-semibold tracking-[-0.02em]">Theme lab</h1>
        <p class="text-muted-foreground mt-2 text-[14px]">Compass has two themes, Default and Juyo concept, and each has a light and a dark mode: four combinations that share one set of token names. This page puts the four side by side. Every value on it is read from the pane it sits in as it renders, so the tables cannot drift from the CSS.</p>
      </header>

      <div class="bg-background border-border sticky top-0 z-20 -mx-page-x mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-page-x py-2">
        <nav aria-label="Sections of this page" class="flex flex-wrap gap-0.5">
          @for (s of sections; track s.id) {
            <button hlmBtn variant="ghost" size="sm" (click)="jump(s.id)">{{ s.label }}</button>
          }
        </nav>
        <div class="ml-auto flex items-center gap-2">
          <span id="lab-show-label" class="text-muted-foreground text-[12.5px]">Show</span>
          <div class="seg" role="radiogroup" aria-labelledby="lab-show-label">
            @for (v of views; track v.id) {
              <button type="button" role="radio" [attr.aria-checked]="lab.show() === v.id" (click)="lab.show.set(v.id)">{{ v.label }}</button>
            }
          </div>
        </div>
      </div>

      <section class="lab-section" aria-labelledby="direction">
        <h2 id="direction" tabindex="-1" class="lab-h2 text-[20px] font-semibold tracking-[-0.01em]">Direction</h2>
        <p class="text-muted-foreground mt-1 max-w-[72ch] text-[14px]">Juyo runs two design systems: a light marketing site and a dark product, with different tokens. The concept is one system for both, built from the brand’s own ink, off-white, blue, violet and orange.</p>
        <dl class="mt-5 grid gap-x-10 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
          @for (p of principles; track p.name) {
            <div>
              <dt class="text-[14px] font-semibold">{{ p.name }}</dt>
              <dd class="text-muted-foreground mt-1 text-[13.5px]">{{ p.text }}</dd>
            </div>
          }
        </dl>
      </section>

      <section class="lab-section" aria-labelledby="colour">
        <h2 id="colour" tabindex="-1" class="lab-h2 text-[20px] font-semibold tracking-[-0.01em]">Colour</h2>
        <p class="text-muted-foreground mt-1 mb-4 max-w-[72ch] text-[14px]">Juyo’s palette, rebuilt as scales in OKLCH. A step has the same job in every scale and in both modes, so contrast follows from the step number and does not have to be checked by eye each time. The dark column is not the light one reversed: its tints carry about a quarter of the chroma of its marks, and its text steps are the ones the rail already used on ink.</p>
        <ng-template #paletteSpec><app-lab-palette /></ng-template>
        <app-lab-compare [content]="paletteSpec" />

        <h3 class="mt-8 text-[16px] font-semibold">Roles and contrast</h3>
        <p class="text-muted-foreground mt-1 mb-4 max-w-[72ch] text-[14px]">WCAG 2.2 AA is the gate: 4.5:1 for text, 3:1 for chart marks, field borders and the focus ring. APCA is shown as a second reading, because it tracks small text and dark surfaces more closely. Each pair is measured live in the pane it sits in, so the four tables are the four combinations’ own values.</p>
        <ng-template #contrastSpec>
          <app-lab-contrast [pairs]="pairs" caption="Contrast of text and chart colours on their surfaces" />
          <div class="mt-4 rounded-[6px] p-3" data-surface="inverse" style="background: var(--rail); color: var(--foreground)">
            <p class="mb-2 text-[12.5px] font-medium">The rail</p>
            <app-lab-contrast [pairs]="railPairs" caption="Contrast of the rail’s text on the rail" />
          </div>
        </ng-template>
        <app-lab-compare [content]="contrastSpec" />
      </section>

      <section class="lab-section" aria-labelledby="type">
        <h2 id="type" tabindex="-1" class="lab-h2 text-[20px] font-semibold tracking-[-0.01em]">Type</h2>
        <p class="text-muted-foreground mt-1 mb-4 max-w-[72ch] text-[14px]">The components write 20 literal font sizes; 17 of them are below. The concept theme maps them onto eight steps on a 4px line grid, without editing a component. Left column: the text as rendered. Right column: size over line height, weight, width and tracking as measured, then the size the component wrote.</p>
        <ng-template #typeSpec><app-lab-type /></ng-template>
        <app-lab-compare [content]="typeSpec" />

        <h3 class="mt-8 text-[16px] font-semibold">Figures</h3>
        <p class="text-muted-foreground mt-1 mb-4 max-w-[72ch] text-[14px]">Money is set in tabular lining figures, right-aligned, with a real minus sign. The width axis condenses figures by 12% where columns stack. A total takes the accountant’s rules: one above, a double rule below.</p>
        <ng-template #figureSpec>
          <table class="w-full text-[13px] tabular-nums">
            <caption class="sr-only">Room revenue on the books for three nights, against last year</caption>
            <thead>
              <tr class="text-muted-foreground text-[12px]">
                <th scope="col" class="border-border border-b py-1.5 text-left font-medium">Hotel</th>
                <th scope="col" class="border-border border-b py-1.5 text-left font-medium">Night</th>
                <th scope="col" class="border-border border-b py-1.5 text-right font-medium">On the books</th>
                <th scope="col" class="border-border border-b py-1.5 text-right font-medium">Last year</th>
                <th scope="col" class="border-border border-b py-1.5 text-right font-medium">Gap</th>
              </tr>
            </thead>
            <tbody>
              @for (n of nights; track n.hotel) {
                <tr>
                  <th scope="row" class="border-border border-b py-1.5 text-left font-normal">{{ n.hotel }}</th>
                  <td class="text-muted-foreground border-border border-b py-1.5">{{ n.night }}</td>
                  <td class="border-border border-b py-1.5 text-right">{{ n.otb }}</td>
                  <td class="text-muted-foreground border-border border-b py-1.5 text-right">{{ n.ly }}</td>
                  <td class="border-border border-b py-1.5 text-right" [class]="n.up ? 'text-(--positive)' : 'text-(--negative)'"><span aria-hidden="true">{{ n.up ? '▲' : '▼' }} </span>{{ n.gap }}</td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr data-total>
                <th scope="row" class="py-1.5 text-left font-semibold">Total</th>
                <td class="py-1.5"></td>
                <td class="py-1.5 text-right font-semibold">€492,056</td>
                <td class="py-1.5 text-right font-semibold">€453,875</td>
                <td class="py-1.5 text-right font-semibold text-(--positive)"><span aria-hidden="true">▲ </span>+€38,181</td>
              </tr>
            </tfoot>
          </table>
          <dl class="mt-5 grid grid-cols-3 gap-3">
            @for (w of widths; track w.pct) {
              <div class="min-w-0">
                <dt class="text-muted-foreground text-[12px]">{{ w.name }}, {{ w.pct }}%</dt>
                <dd class="truncate text-[24px] font-medium" [style.font-stretch]="w.pct + '%'" style="font-variant-numeric: tabular-nums lining-nums">€1,284,560</dd>
              </div>
            }
          </dl>
          <p class="mt-4 font-mono text-[12.5px]">select sum(room_revenue) from otb where stay_date between '2026-12-16' and '2026-12-18'</p>
        </ng-template>
        <app-lab-compare [content]="figureSpec" />
      </section>

      <section class="lab-section" aria-labelledby="density">
        <h2 id="density" tabindex="-1" class="lab-h2 text-[20px] font-semibold tracking-[-0.01em]">Density</h2>
        <p class="text-muted-foreground mt-1 mb-4 max-w-[72ch] text-[14px]">Density is its own setting, next to the theme: Comfortable or Compact. It changes heights, padding and gaps, and never a font size or a colour. Comfortable is the default. Compact is the person’s choice for the whole app, and the standing choice for regions that are scanned and compared: tables, filter bars and the Behind the numbers panel. Dialogs, menus and popovers stay comfortable, and touch keeps 44px targets at both densities.</p>
        <app-lab-density />
      </section>

      <section class="lab-section" aria-labelledby="shape">
        <h2 id="shape" tabindex="-1" class="lab-h2 text-[20px] font-semibold tracking-[-0.01em]">Shape</h2>
        <p class="text-muted-foreground mt-1 mb-4 max-w-[72ch] text-[14px]">Control heights come from the density, so they are the same in every theme. Radius follows the size of the thing: the concept theme keeps marks at 2px and dialogs at 10px, where the default themes round more.</p>
        <ng-template #shapeSpec>
          <p class="mb-2 text-[12.5px] font-medium">Control heights</p>
          <div class="flex flex-wrap items-start gap-4">
            <app-lab-probe read="height" label="xs"><button hlmBtn variant="secondary" size="xs">Filter</button></app-lab-probe>
            <app-lab-probe read="height" label="sm"><button hlmBtn variant="secondary" size="sm">Export</button></app-lab-probe>
            <app-lab-probe read="height" label="default"><button hlmBtn>Review 3 nights</button></app-lab-probe>
            <app-lab-probe read="height" label="lg"><button hlmBtn size="lg">New agent</button></app-lab-probe>
            <app-lab-probe read="height" label="filter"><span class="filter-btn">Stay dates <span class="font-medium">Next 30 nights</span></span></app-lab-probe>
            <app-lab-probe read="height" label="field"><span class="field-input inline-flex w-28 items-center">Lisbon</span></app-lab-probe>
          </div>
          <p class="mt-5 mb-2 text-[12.5px] font-medium">Radius</p>
          <div class="flex flex-wrap items-start gap-4">
            <app-lab-probe read="border-top-left-radius" label="mark"><span class="lab-swatch-box block rounded-sm"></span></app-lab-probe>
            <app-lab-probe read="border-top-left-radius" label="control"><span class="lab-swatch-box block rounded-md"></span></app-lab-probe>
            <app-lab-probe read="border-top-left-radius" label="container"><span class="lab-swatch-box block rounded-xl"></span></app-lab-probe>
            <app-lab-probe read="border-top-left-radius" label="overlay"><span class="lab-swatch-box block rounded-2xl"></span></app-lab-probe>
            <app-lab-probe read="border-top-left-radius" label="chip"><span class="filter-chip" aria-hidden="true">Corporate</span></app-lab-probe>
            <app-lab-probe read="border-top-left-radius" label="card"><span class="insight-card block h-11 w-16"></span></app-lab-probe>
            <app-lab-probe read="border-top-left-radius" label="dialog"><span class="confirm-dialog block h-11 w-16 p-0!"></span></app-lab-probe>
          </div>
        </ng-template>
        <app-lab-compare [content]="shapeSpec" />
      </section>

      <section class="lab-section" aria-labelledby="elevation">
        <h2 id="elevation" tabindex="-1" class="lab-h2 text-[20px] font-semibold tracking-[-0.01em]">Elevation</h2>
        <p class="text-muted-foreground mt-1 mb-4 max-w-[72ch] text-[14px]">Three levels above the canvas. A card is the surface tone and a hairline, with no shadow. A popover floats, so it takes the overlay shadow. A dialog takes the modal shadow and a scrim. Shadows are two-part and tinted with ink, not black. In the dark mode a shadow reads weakly, so what floats is also one tone lighter than the card under it.</p>
        <ng-template #elevationSpec>
          <div class="grid gap-5 sm:grid-cols-3">
            <app-lab-probe read="box-shadow" label="shadow"><div class="insight-card w-full p-3"><p class="text-[13px] font-medium">Card</p><p class="text-muted-foreground text-[12px]">Sits on the canvas</p></div></app-lab-probe>
            <app-lab-probe read="box-shadow" label="shadow"><div class="filter-pop static! w-full"><p class="text-[13px] font-medium">Popover</p><p class="text-muted-foreground text-[12px]">Floats over a card</p></div></app-lab-probe>
            <app-lab-probe read="box-shadow" label="shadow"><div class="confirm-dialog w-full p-3!"><p class="text-[13px] font-medium">Dialog</p><p class="text-muted-foreground text-[12px]">Takes over the page</p></div></app-lab-probe>
          </div>
        </ng-template>
        <app-lab-compare [content]="elevationSpec" />
      </section>

      <section class="lab-section" aria-labelledby="motion">
        <h2 id="motion" tabindex="-1" class="lab-h2 text-[20px] font-semibold tracking-[-0.01em]">Motion</h2>
        <p class="text-muted-foreground mt-1 mb-4 max-w-[72ch] text-[14px]">Motion answers an action and then gets out of the way. Durations and curves follow Carbon’s productive set. The panes play together; with reduced motion on, none animates.</p>
        <button hlmBtn variant="secondary" size="sm" class="mb-3" (click)="run.set(run() + 1)"><ng-icon name="phosphorArrowClockwiseLight" />Play all</button>
        <ng-template #motionSpec let-concept>
          <div class="grid gap-5 sm:grid-cols-2">
            <ul class="flex flex-col gap-2">
              @for (m of concept ? conceptMotion : defaultMotion; track m.name) {
                <li>
                  <span class="flex justify-between text-[12.5px]"><span>{{ m.name }}</span><span class="text-muted-foreground tabular-nums">{{ concept ? m.ms + ' ms' : $any(m).value }}</span></span>
                  <span class="lab-bar mt-1 block" [style.width.%]="m.ms / 7"></span>
                </li>
              }
            </ul>
            @for (r of [run()]; track r) {
              <div class="flex flex-col gap-3">
                <div class="gen-in insight-card p-3"><p class="text-[13px] font-medium">An answer settles in</p><p class="text-muted-foreground text-[12px]">{{ concept ? 'Opacity and 2px of travel' : 'Opacity, 3px and a blur' }}</p></div>
                <div class="flex flex-col gap-1.5" role="img" aria-label="Three bars growing from the left">
                  <span class="bar-grow block h-2 w-[86%] rounded-[2px] bg-(--series)"></span>
                  <span class="bar-grow block h-2 w-[58%] rounded-[2px] bg-(--series)"></span>
                  <span class="bar-grow block h-2 w-[74%] rounded-[2px] bg-(--series)"></span>
                </div>
              </div>
            }
          </div>
        </ng-template>
        <app-lab-compare [content]="motionSpec" />
      </section>

      <section class="lab-section" aria-labelledby="components">
        <h2 id="components" tabindex="-1" class="lab-h2 text-[20px] font-semibold tracking-[-0.01em]">Components</h2>
        <p class="text-muted-foreground mt-1 mb-4 max-w-[72ch] text-[14px]">The same components and classes the app renders, in every combination. Press Tab through a pane to see its focus ring: the concept theme draws one ring on every control, a 2px line with a 2px gap.</p>
        <ng-template #componentSpec let-pane="pane">
          <p class="mb-2 text-[12.5px] font-medium">Buttons</p>
          <div class="flex flex-wrap items-center gap-2">
            <button hlmBtn>Review 3 nights</button>
            <button hlmBtn variant="secondary">Export</button>
            <button hlmBtn variant="outline">Edit filters</button>
            <button hlmBtn variant="ghost">Undo</button>
            <button hlmBtn disabled>Running…</button>
            <button hlmBtn variant="ghost" size="icon" aria-label="Refresh"><ng-icon name="phosphorArrowClockwiseLight" /></button>
          </div>

          <p class="mt-5 mb-2 text-[12.5px] font-medium">Fields and selection</p>
          <div class="flex flex-wrap items-end gap-3">
            <label class="flex flex-col gap-1"><span class="field-label">Agent name</span><input class="field-input w-44" value="Lisbon pace alert" /></label>
            <label class="flex flex-col gap-1"><span class="field-label">Runs</span>
              <select class="field-select w-40"><option>Every morning</option><option>Every hour</option></select>
            </label>
            <div class="seg" role="radiogroup" aria-label="View">
              <button type="button" role="radio" aria-checked="true">List</button>
              <button type="button" role="radio" aria-checked="false">Calendar</button>
            </div>
            <button type="button" class="toggle" role="switch" aria-checked="true" aria-label="Pace guard is on"><i></i></button>
            <button type="button" class="toggle" role="switch" aria-checked="false" aria-label="Key account watch is off"><i></i></button>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Segment">
            <button type="button" role="radio" class="filter-chip" aria-checked="true">All segments</button>
            <button type="button" role="radio" class="filter-chip" aria-checked="false">Corporate</button>
            <button type="button" role="radio" class="filter-chip" aria-checked="false">Leisure</button>
          </div>

          <p class="mt-5 mb-2 text-[12.5px] font-medium">Chips and status</p>
          <div class="flex flex-wrap items-center gap-2">
            <span class="stake-chip">€1.34M at stake</span>
            <span class="stake-chip stake-chip--decision">3 need your decision</span>
            <span class="money-chip">−€115k</span>
            <span class="status-chip">Done</span>
            <span class="status-chip status-chip--needs">Needs your decision</span>
            <span class="status-chip status-chip--failed">Failed</span>
            <span class="scope-chip">All 20 hotels</span>
            <span class="schedule-chip">06:00 daily</span>
            <span class="ai-tag">AI</span>
          </div>

          <p class="mt-5 mb-2 text-[12.5px] font-medium">Ask bar</p>
          <div class="ask-field">
            <div class="flex min-h-[inherit] items-center gap-3 px-4">
              <span class="orb-mark block shrink-0" aria-hidden="true"></span>
              <span class="text-muted-foreground flex-1 text-[15px]">Ask about any hotel, night or metric</span>
            </div>
          </div>

          <p class="mt-5 mb-2 text-[12.5px] font-medium">Finding and decision</p>
          <div class="grid gap-3 sm:grid-cols-2">
            <article class="insight-card p-4">
              <div class="flex items-start justify-between gap-3"><h3 class="text-[15px] font-semibold">Barcelona Mar has 26 of 300 rooms out of order</h3><span class="money-chip shrink-0">−€115k</span></div>
              <p class="text-muted-foreground mt-1.5 text-[13.5px]">An average of 25.7 rooms are out of order over the next 30 days, which puts about €115k of revenue at risk. <span class="ai-tag">AI</span></p>
              <button hlmBtn variant="secondary" size="sm" class="mt-3">Explore</button>
            </article>
            <article class="decision-card p-4">
              <h3 class="text-[15px] font-semibold">Raise Dubai Business Bay to the comp set median for 16–18 Dec</h3>
              <p class="mt-1.5 text-[13.5px]">Gulf Tech Week: BAR is 22% under the comp set median and 3 comp set hotels are sold out.</p>
              <button type="button" class="decision-btn mt-3 inline-flex h-8 items-center px-3 text-[13px] font-medium">Review 3 nights</button>
            </article>
          </div>

          <p class="mt-5 mb-2 text-[12.5px] font-medium">Decision table</p>
          <div class="border-border bg-card overflow-x-auto rounded-lg border pt-3" tabindex="0" role="region" [attr.aria-label]="'Decision table sample, ' + pane.name">
            <table class="dec-table w-full min-w-[460px]">
              <caption class="sr-only">Nights that need a rate decision</caption>
              <thead>
                <tr><th scope="col" class="text-left">Night</th><th scope="col" class="text-left">On the books</th><th scope="col" class="text-right">Gap to last year</th></tr>
              </thead>
              <tbody>
                @for (n of nights; track n.hotel; let first = $first) {
                  <tr [class.is-selected]="first" tabindex="0">
                    <td><span class="cell-1">{{ n.hotel }}</span><span class="cell-2">{{ n.night }}</span></td>
                    <td>
                      <span class="flex items-center gap-3">
                        <span class="bullet" role="img" [attr.aria-label]="n.fill + '% sold, ' + n.tick + '% last year'"><span class="bullet-fill" [style.width.%]="n.fill"></span><span class="bullet-tick" [style.left.%]="n.tick"></span></span>
                        <span class="cell-1 tabular-nums">{{ n.otb }}</span>
                      </span>
                    </td>
                    <td class="text-right"><span class="cell-1 tabular-nums" [class]="n.up ? 'text-(--positive)' : 'text-(--negative)'"><span aria-hidden="true">{{ n.up ? '▲' : '▼' }} </span>{{ n.gap }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <p class="mt-5 mb-2 text-[12.5px] font-medium">A Kassandra answer</p>
          <div class="flex flex-col gap-3">
            <p class="bubble-user self-end">Why is Lisbon Chiado behind for 17 Dec?</p>
            <div class="md text-[15px]">
              <div>
                <p>Lisbon Chiado is <strong>€5,865 behind</strong> last year for Wed 17 Dec. Two things explain most of it:</p>
                <ul>
                  <li>Corporate pickup stopped after 12 Nov, when two comp set hotels cut their rates.</li>
                  <li>Your BAR is 9% above the comp set median for that night.</li>
                </ul>
                <div class="md-table">
                  <table>
                    <thead><tr><th scope="col">Segment</th><th scope="col">On the books</th><th scope="col">Last year</th></tr></thead>
                    <tbody><tr><td>Corporate</td><td>€31,200</td><td>€38,940</td></tr><tr><td>Leisure</td><td>€64,810</td><td>€62,935</td></tr></tbody>
                  </table>
                </div>
                <p>Figures are on the books as of <code>20 Nov, 07:00</code>.</p>
              </div>
            </div>
            <div><span class="evidence-chip">Behind the numbers</span></div>
          </div>
        </ng-template>
        <app-lab-compare [content]="componentSpec" />
      </section>

      <section class="lab-section" aria-labelledby="charts">
        <h2 id="charts" tabindex="-1" class="lab-h2 text-[20px] font-semibold tracking-[-0.01em]">Charts</h2>
        <p class="text-muted-foreground mt-1 mb-4 max-w-[72ch] text-[14px]">This period is blue. The comparison period keeps the hue and loses its colour, because last year is context, not a category; a dash tells the two apart without colour. Series are labelled at their ends, gridlines are horizontal hairlines, and bars are square-cut. Every mark is 3:1 or more against its card (see the contrast table above).</p>
        <ng-template #chartSpec><app-lab-charts /></ng-template>
        <app-lab-compare [content]="chartSpec" [wide]="true" />
      </section>

      <section class="lab-section" aria-labelledby="tokens">
        <h2 id="tokens" tabindex="-1" class="lab-h2 text-[20px] font-semibold tracking-[-0.01em]">Tokens</h2>
        <p class="text-muted-foreground mt-1 mb-4 max-w-[72ch] text-[14px]">Three tiers: primitives hold raw values, semantic tokens give them a role, component tokens make one component’s decision. A component reads semantic or component tokens, never a primitive. A theme is a new mapping of the semantic tier; a mode is a second column of the primitive scales, with the few roles whose step changes mapped again.</p>
        <ng-template #tokenSpec let-concept>
          <details open class="mb-2">
            <summary class="cursor-pointer py-1.5 text-[13.5px] font-medium">Semantic colour roles, shared by both themes in both modes ({{ roles.length }})</summary>
            <app-lab-token-table [names]="roles" caption="Semantic colour roles" />
          </details>
          @if (concept) {
            @for (g of groups; track g.title) {
              <details class="mb-2">
                <summary class="cursor-pointer py-1.5 text-[13.5px] font-medium">{{ g.title }} ({{ g.names.length }})</summary>
                <app-lab-token-table [names]="g.names" [caption]="g.title" />
              </details>
            }
          } @else {
            <p class="text-muted-foreground mt-3 text-[13px]">The default themes stop here. Radius, elevation, focus, motion, the type scale and density have no tokens: their values are written in each component and in styles.css.</p>
          }
        </ng-template>
        <app-lab-compare [content]="tokenSpec" />
      </section>
    </div>
  `,
})
export class ThemeLab {
  protected readonly lab = inject(LabState);
  private readonly doc = inject(DOCUMENT);
  protected readonly sections = SECTIONS;
  protected readonly views = LAB_VIEWS;
  protected readonly principles = PRINCIPLES;
  protected readonly pairs = CONTRAST_PAIRS;
  protected readonly railPairs = RAIL_PAIRS;
  protected readonly roles = COLOR_ROLES;
  protected readonly nights = NIGHTS;
  protected readonly conceptMotion = CONCEPT_MOTION;
  protected readonly defaultMotion = DEFAULT_MOTION;
  protected readonly widths = [
    { name: 'Condensed', pct: 88 },
    { name: 'Normal', pct: 100 },
    { name: 'Wide', pct: 112 },
  ];
  /** Bumped by "Play all": the motion samples are re-created, so their animations run again. */
  protected readonly run = signal(0);
  protected readonly groups = [
    { title: 'Semantic roles the concept theme adds: colour', names: CONCEPT_ROLES.colour },
    { title: 'Semantic: type', names: CONCEPT_ROLES.type },
    { title: 'Semantic: shape and focus', names: CONCEPT_ROLES.shape },
    { title: 'Semantic: elevation', names: CONCEPT_ROLES.elevation },
    { title: 'Semantic: motion', names: CONCEPT_ROLES.motion },
    { title: 'Semantic: density', names: CONCEPT_ROLES.density },
    { title: 'Component tokens', names: CONCEPT_ROLES.component },
    { title: 'Primitives: type', names: PRIMITIVES.type },
    { title: 'Primitives: space', names: PRIMITIVES.space },
    { title: 'Primitives: radius', names: PRIMITIVES.radius },
    { title: 'Primitives: motion', names: PRIMITIVES.motion },
  ];

  /** Scrolls to a section and moves focus to its heading, so keyboard and screen-reader users land there too. */
  protected jump(id: string) {
    const heading = this.doc.getElementById(id);
    if (!heading) return;
    const reduce = this.doc.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;
    heading.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    heading.focus({ preventScroll: true });
  }
}
