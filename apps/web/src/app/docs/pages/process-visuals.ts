import { Component, computed, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
// The one place Lucide appears in the app: beside Phosphor, to show why it was not chosen.
import { lucideDatabase, lucideInbox, lucideLayoutGrid, lucideZap } from '@ng-icons/lucide';
import { phosphorDatabaseBold, phosphorLightningBold, phosphorSquaresFourBold, phosphorTrayBold } from '@ng-icons/phosphor-icons/bold';
import { phosphorDatabaseFill, phosphorLightningFill, phosphorSquaresFourFill, phosphorTrayFill } from '@ng-icons/phosphor-icons/fill';
import { phosphorDatabaseLight, phosphorLightningLight, phosphorSquaresFourLight, phosphorTrayLight } from '@ng-icons/phosphor-icons/light';
import { type PairKind, REQUIRED, type Rgb, wcagRatio } from '../../theme-lab/contrast';
import { CONCEPT_ONLY } from '../../theme-lab/tokens';

/* The small pictures on /docs/process. Each one is drawn from data and from the app's own tokens and icons. */

/** "#8556C9" → [133, 86, 201]. */
export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16)) as unknown as Rgb;
}

/** The WCAG 2 contrast of two hex colours, to one decimal, computed by the same function the theme lab uses. */
export function contrastOf(a: string, b: string): number {
  return Math.round(wcagRatio(hexToRgb(a), hexToRgb(b)) * 10) / 10;
}

export interface ColourShift {
  role: string;
  /** The colour sampled from Juyo's app, and the adjusted value of the Compass token. */
  from: string;
  to: string;
  /** The token that holds the adjusted value, and the theme it belongs to. */
  token: string;
  /** What the colour is measured against: the text on it, or the surface under it. */
  against: string;
  /** `text` must reach 4.5:1; `graphic` (a chart mark) 3:1. */
  kind: PairKind;
  /** The colour is a fill with text on it (a button), text on a surface, or a mark on a surface (a chart line). */
  as: 'fill' | 'text' | 'mark';
  note: string;
}

/**
 * The palette is inspired by Juyo's mobile app colours, then adjusted for WCAG AA. Each row is a colour sampled from
 * Juyo's app (screenshots of the app on Google Play, and the CSS of their web app: docs/research/ui-refinement/
 * juyo_brand.md) and the token Compass uses in its place. The ratios are computed from these values, not typed.
 */
export const JUYO_COLOUR_SHIFTS: readonly ColourShift[] = [
  { role: 'Purple button', from: '#996AD5', to: '#8556C9', token: '--primary · dark', against: '#FFFFFF', kind: 'text', as: 'fill', note: 'A white label on Juyo’s purple misses 4.5:1. One step darker, it passes.' },
  { role: 'Purple as text', from: '#996AD5', to: '#A97EE6', token: '--brand · dark', against: '#161C22', kind: 'text', as: 'text', note: 'On the dark card the same purple just misses as text, so text and focus take a lighter one.' },
  { role: 'Chart blue, dark surfaces', from: '#477EE3', to: '#5B8DEB', token: '--series · dark', against: '#161C22', kind: 'text', as: 'mark', note: 'Both pass 3:1 as a chart mark. The lighter one also clears 4.5:1, which a thin line and its label need.' },
  { role: 'Chart blue, light theme', from: '#477EE3', to: '#2F66D0', token: '--series · light', against: '#FFFFFF', kind: 'text', as: 'mark', note: 'On white the blue goes the other way: deeper, until it passes.' },
  { role: 'Decision orange, light theme', from: '#FE7637', to: '#C2410C', token: '--decision · light', against: '#FFFFFF', kind: 'text', as: 'text', note: 'Juyo’s orange is fine on dark. On white it fails as text, so the light theme takes a deeper orange.' },
  { role: 'Secondary text', from: '#5C636B', to: '#9BA3AD', token: '--muted-foreground · dark', against: '#161C22', kind: 'text', as: 'text', note: 'Juyo’s own muted grey is 2.8:1 on its dark surface. Secondary text here is a lighter grey.' },
];

/** A colour before and after: Juyo's sampled value, the Compass token, and the contrast of each against its pair. */
@Component({
  selector: 'docs-colour-shifts',
  host: { class: 'block' },
  styles: `
    .chip {
      display: grid;
      place-items: center;
      height: 44px;
      border: 1px solid var(--border);
      border-radius: var(--radius-control, 8px);
    }
    .mark {
      display: block;
      width: 62%;
      height: 4px;
      border-radius: 2px;
    }
    /* Two short bars stand for a label: the colour is shown at the weight of text without being text. */
    .lines {
      display: grid;
      gap: 5px;
      width: 46%;
    }
    .lines > i {
      display: block;
      height: 3px;
      border-radius: 2px;
    }
    .lines > i:last-child {
      width: 62%;
    }
  `,
  template: `
    <ul class="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
      @for (s of rows(); track s.role) {
        <li class="docs-panel flex flex-col gap-3 p-4">
          <p class="text-[14px] font-semibold">{{ s.role }}</p>
          <div class="grid grid-cols-2 gap-3">
            @for (side of s.sides; track side.label) {
              <div class="min-w-0">
                <!-- A drawing, not text: the "before" colours fail contrast on purpose, and real text in them would too. -->
                <span class="chip" [style.background]="s.as === 'fill' ? side.value : s.against" aria-hidden="true">
                  @if (s.as === 'mark') {
                    <i class="mark" [style.background]="side.value"></i>
                  } @else {
                    <span class="lines"><i [style.background]="s.as === 'fill' ? s.against : side.value"></i><i [style.background]="s.as === 'fill' ? s.against : side.value"></i></span>
                  }
                </span>
                <span class="text-muted-foreground mt-1.5 block truncate text-[12px]" [attr.title]="side.label">{{ side.label }}</span>
                <span class="block font-mono text-[12px]">{{ side.value }}</span>
                <span class="flex flex-wrap gap-x-1.5 text-[12.5px] tabular-nums"><span class="font-medium">{{ side.ratio }}:1</span><span class="text-muted-foreground">{{ side.pass ? 'passes' : 'under ' + s.need + ':1' }}</span></span>
              </div>
            }
          </div>
          <p class="text-muted-foreground text-[12.5px]/snug">{{ s.note }}</p>
        </li>
      }
    </ul>
  `,
})
export class DocsColourShifts {
  readonly shifts = input.required<readonly ColourShift[]>();
  protected readonly rows = computed(() =>
    this.shifts().map((s) => {
      const need = REQUIRED[s.kind];
      const side = (label: string, value: string) => {
        const ratio = contrastOf(value, s.against);
        return { label, value, ratio, pass: ratio >= need };
      };
      return { ...s, need, sides: [side('Juyo’s app', s.from), side(s.token, s.to)] };
    }),
  );
}

/** Lucide beside Phosphor: one weight against a family of weights, on the same four glyphs. */
@Component({
  selector: 'docs-icon-sets',
  imports: [NgIcon],
  providers: [
    provideIcons({
      lucideDatabase,
      lucideInbox,
      lucideLayoutGrid,
      lucideZap,
      phosphorDatabaseBold,
      phosphorDatabaseFill,
      phosphorDatabaseLight,
      phosphorLightningBold,
      phosphorLightningFill,
      phosphorLightningLight,
      phosphorSquaresFourBold,
      phosphorSquaresFourFill,
      phosphorSquaresFourLight,
      phosphorTrayBold,
      phosphorTrayFill,
      phosphorTrayLight,
    }),
  ],
  host: { class: 'block' },
  template: `
    <div class="docs-panel overflow-hidden">
      <table class="w-full text-[13px]">
        <caption class="sr-only">The same four icons in Lucide and in three weights of Phosphor</caption>
        <thead class="sr-only">
          <tr><th scope="col">Set and weight</th><th scope="col">Icons</th><th scope="col">Used for</th></tr>
        </thead>
        <tbody>
          @for (r of rows; track r.name) {
            <tr class="border-border border-b last:border-b-0">
              <th scope="row" class="w-[132px] px-4 py-3 text-left align-middle font-medium">{{ r.name }}</th>
              <td class="px-2 py-3 align-middle">
                <span class="flex items-center gap-4 text-[22px]" role="img" [attr.aria-label]="r.name + ': inbox, boards, agents and data icons'">
                  @for (i of r.icons; track i) {
                    <ng-icon [name]="i" aria-hidden="true" />
                  }
                </span>
              </td>
              <td class="text-muted-foreground px-4 py-3 align-middle text-[12.5px]/snug max-sm:hidden">{{ r.use }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class DocsIconSets {
  protected readonly rows = [
    { name: 'Lucide', icons: ['lucideInbox', 'lucideLayoutGrid', 'lucideZap', 'lucideDatabase'], use: 'One weight. The default of most shadcn-style apps, so it reads as a template.' },
    { name: 'Phosphor Light', icons: ['phosphorTrayLight', 'phosphorSquaresFourLight', 'phosphorLightningLight', 'phosphorDatabaseLight'], use: 'Navigation and calm UI.' },
    { name: 'Phosphor Bold', icons: ['phosphorTrayBold', 'phosphorSquaresFourBold', 'phosphorLightningBold', 'phosphorDatabaseBold'], use: 'Small, high-emphasis marks.' },
    { name: 'Phosphor Fill', icons: ['phosphorTrayFill', 'phosphorSquaresFourFill', 'phosphorLightningFill', 'phosphorDatabaseFill'], use: 'The current place, and a chosen state.' },
  ];
}

const RESET = Object.fromEntries(CONCEPT_ONLY.map((name) => [name, 'initial']));
const STRIP = [
  ['--background', 'Canvas'],
  ['--card', 'Card'],
  ['--foreground', 'Text'],
  ['--primary', 'Action'],
  ['--series', 'Data'],
  ['--decision', 'Decision'],
] as const;

/**
 * The two themes in their two modes, as four strips of the same six roles. Each strip wears a theme the way <html>
 * does (`data-theme` and the mode's class, as in charts/catalog.ts), so the colours are its own.
 */
const STRIPS = [
  { id: 'dark', label: 'Default · Dark', theme: 'dark', mode: 'dark', note: 'Inter · the first look' },
  { id: 'light', label: 'Default · Light', theme: 'light', mode: 'light', note: 'Inter' },
  { id: 'juyo-concept', label: 'Concept · Light', theme: 'juyo-concept', mode: 'light', note: 'Archivo · “Ledger”' },
  { id: 'juyo-concept-dark', label: 'Concept · Dark', theme: 'juyo-concept', mode: 'dark', note: 'Archivo · “Ink ledger”' },
] as const;

@Component({
  selector: 'docs-theme-strips',
  host: { class: 'block' },
  styles: `
    .pane {
      min-width: 0;
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius-container, 14px);
      background: var(--background);
      color: var(--foreground);
      font-family: var(--font-sans);
    }
    .sw {
      height: 30px;
      border: 1px solid var(--border);
    }
    .sw:first-child {
      border-radius: var(--radius-control, 6px) 0 0 var(--radius-control, 6px);
    }
    .sw:last-child {
      border-radius: 0 var(--radius-control, 6px) var(--radius-control, 6px) 0;
    }
  `,
  template: `
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      @for (t of themes; track t.id) {
        <div class="pane" [class]="t.mode" [attr.data-theme]="t.theme" [style]="t.theme === 'juyo-concept' ? null : reset">
          <p class="flex items-baseline justify-between gap-2"><span class="text-[14px] font-semibold">{{ t.label }}</span><span class="text-muted-foreground text-[12px]">{{ t.note }}</span></p>
          <div class="mt-3 grid grid-cols-6" role="img" [attr.aria-label]="t.label + ': canvas, card, text, action, data and decision colours'">
            @for (s of strip; track s[0]) {
              <i class="sw" [style.background]="'var(' + s[0] + ')'"></i>
            }
          </div>
          <p class="text-muted-foreground mt-2 grid grid-cols-6 text-[10.5px]" aria-hidden="true">
            @for (s of strip; track s[0]) {
              <span class="truncate">{{ s[1] }}</span>
            }
          </p>
          <p class="mt-3 text-[20px]/tight font-semibold tracking-[-0.02em] tabular-nums">€1,284,560</p>
        </div>
      }
    </div>
  `,
})
export class DocsThemeStrips {
  protected readonly themes = STRIPS;
  protected readonly strip = STRIP;
  protected readonly reset = RESET;
}

/** Two small wireframes: the layout that was rejected and the one that was built. */
@Component({
  selector: 'docs-model-wireframes',
  host: { class: 'block' },
  styles: `
    .frame {
      display: grid;
      gap: 6px;
      height: 148px;
      padding: 8px;
      border: 1px solid var(--field-border-hover);
      border-radius: var(--radius-control, 8px);
      background: var(--background);
    }
    .box {
      display: grid;
      place-items: center;
      min-width: 0;
      padding: 4px;
      border: 1px solid var(--field-border-hover);
      border-radius: var(--radius-mark, 5px);
      background: var(--card);
      color: var(--muted-foreground);
      font-size: 11.5px;
      line-height: 1.25;
      text-align: center;
    }
    .box--main {
      color: var(--foreground);
      font-weight: 500;
    }
    .box--dim {
      border-style: dashed;
      background: transparent;
    }
  `,
  template: `
    <div class="grid gap-4 md:grid-cols-2">
      <figure class="docs-panel p-4">
        <div class="frame grid-cols-[1fr_32%]" role="img" aria-label="Rejected layout: a dashboard fills the screen and an assistant is docked on the right">
          <div class="grid grid-cols-2 grid-rows-2 gap-1.5">
            <span class="box">KPI</span><span class="box">Chart</span><span class="box">Chart</span><span class="box">Table</span>
          </div>
          <span class="box box--dim">Assistant, docked</span>
        </div>
        <figcaption class="mt-3 text-[13px]/snug"><span class="block font-medium">Rejected: a dashboard with a chat on the side.</span><span class="text-muted-foreground mt-0.5 block">You still have to find the problem yourself. The AI waits to be asked.</span></figcaption>
      </figure>
      <figure class="docs-panel p-4">
        <div class="frame grid-cols-3" role="img" aria-label="Built layout: an inbox of findings, then a thread that explains one, then a board that keeps what matters">
          <span class="box box--main">Inbox<br />what changed, by money</span>
          <span class="box box--main">Thread<br />why, with evidence</span>
          <span class="box box--main">Board<br />what you keep</span>
        </div>
        <figcaption class="mt-3 text-[13px]/snug"><span class="block font-medium">Built: Inbox → Thread → Board.</span><span class="text-muted-foreground mt-0.5 block">The answer comes first. A dashboard is something you reach from an answer.</span></figcaption>
      </figure>
    </div>
  `,
})
export class DocsModelWireframes {}

export interface TimelinePhase {
  when: string;
  title: string;
  text: string;
  /** Short facts under the text: a commit, a count, a file. */
  evidence?: readonly string[];
}

/** A vertical timeline: a date on the rail, a phase beside it. An ordered list, so it reads in order without CSS. */
@Component({
  selector: 'docs-timeline',
  host: { class: 'block' },
  styles: `
    ol {
      position: relative;
      display: grid;
      gap: 22px;
    }
    li {
      position: relative;
      padding-left: 26px;
    }
    li::before {
      content: '';
      position: absolute;
      left: 0;
      top: 5px;
      width: 11px;
      height: 11px;
      border: 2px solid var(--series);
      border-radius: 9999px;
      background: var(--background);
    }
    li:not(:last-child)::after {
      content: '';
      position: absolute;
      left: 5px;
      top: 20px;
      bottom: -24px;
      width: 1px;
      background: var(--input);
    }
    .when {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--muted-foreground);
    }
    .fact {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      padding: 0 8px;
      border: 1px solid var(--border);
      border-radius: var(--chip-radius, 9999px);
      font-size: 12px;
      color: var(--muted-foreground);
    }
  `,
  template: `
    <ol>
      @for (p of phases(); track p.title) {
        <li>
          <p class="when">{{ p.when }}</p>
          <h3 class="mt-0.5 text-[16px] font-semibold tracking-[-0.01em]">{{ p.title }}</h3>
          <p class="text-muted-foreground mt-1 max-w-[72ch] text-[14px]/relaxed">{{ p.text }}</p>
          @if (p.evidence?.length) {
            <p class="mt-2 flex flex-wrap gap-1.5">
              @for (e of p.evidence; track e) {
                <span class="fact">{{ e }}</span>
              }
            </p>
          }
        </li>
      }
    </ol>
  `,
})
export class DocsTimeline {
  readonly phases = input.required<readonly TimelinePhase[]>();
}

export const PROCESS_VISUALS = [DocsColourShifts, DocsIconSets, DocsThemeStrips, DocsModelWireframes, DocsTimeline] as const;
