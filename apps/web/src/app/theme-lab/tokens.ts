import type { PairKind } from './contrast';

/*
  The catalogue of token names the theme lab documents. Names and roles only: every value on the page is read
  from the rendered CSS (getComputedStyle), so this file cannot disagree with src/themes/juyo-concept/tokens.css
  about a value. A name that is missing from the CSS shows up in the lab as "not set".
*/

/** Primitive colour scales of the concept theme: `--jc-<scale>-<step>`. */
export const SCALES = [
  { name: 'ink', steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], note: 'Neutral, tinted toward Juyo’s #101418' },
  { name: 'blue', steps: [1, 2, 3, 4, 5, 6, 7, 8], note: 'This period’s data, links, focus' },
  { name: 'slate', steps: [1, 2, 3, 4, 5, 6, 7, 8], note: 'The comparison period' },
  { name: 'violet', steps: [1, 2, 3, 4, 5, 6, 7, 8], note: 'Kassandra' },
  { name: 'orange', steps: [1, 2, 3, 4, 5, 6, 7, 8], note: 'A decision is waiting' },
  { name: 'green', steps: [1, 2, 3, 4, 5, 6, 7, 8], note: 'Ahead; category' },
  { name: 'red', steps: [1, 2, 3, 4, 5, 6, 7, 8], note: 'Behind, errors' },
  { name: 'teal', steps: [1, 2, 3, 4, 5, 6, 7, 8], note: 'Category' },
  { name: 'ochre', steps: [1, 2, 3, 4, 5, 6, 7, 8], note: 'Category' },
  { name: 'plum', steps: [1, 2, 3, 4, 5, 6, 7, 8], note: 'Category' },
  { name: 'night', steps: [1, 2, 3, 4, 5, 6, 7, 8, 9], note: 'The inverse rail' },
] as const;

/** What each step of a hue scale is for. The same job in every scale, so contrast is known from the step. */
export const STEP_JOBS = [
  { steps: '1–3', job: 'Tinted surfaces and their borders' },
  { steps: '4', job: 'Soft fills; text on the dark rail' },
  { steps: '5', job: 'Graphics: lines, bars, icons (3:1 or more on surfaces 0–2)' },
  { steps: '6', job: 'Text (4.5:1 or more on surfaces 0–3)' },
  { steps: '7', job: 'Strong text (7:1 or more)' },
  { steps: '8', job: 'Text on the scale’s own tint' },
] as const;

/** Semantic colour roles shared by every theme (the contract the components read). */
export const COLOR_ROLES = [
  '--background', '--foreground', '--card', '--popover', '--primary', '--primary-foreground', '--secondary', '--muted',
  '--muted-foreground', '--accent', '--destructive', '--border', '--input', '--ring', '--field', '--field-border',
  '--field-border-hover', '--focus-brand', '--icon-quiet', '--text-1', '--decision', '--decision-tint', '--rail', '--grid',
  '--brand', '--series', '--series-cmp', '--series-ref', '--series-muted', '--series-3', '--brass', '--brass-ink',
  '--positive', '--negative',
] as const;

/** Roles the concept theme adds. The default themes never had them as tokens: the values sat in components. */
export const CONCEPT_ROLES = {
  colour: [
    '--surface-sunken', '--surface-inverse', '--text-secondary', '--link', '--border-strong', '--border-control',
    '--kassandra', '--kassandra-tint', '--kassandra-border', '--decision-border', '--selected', '--selected-border',
    '--chart-axis', '--chart-rule', '--cat-1', '--cat-2', '--cat-3', '--cat-4', '--cat-5', '--cat-6',
    '--seq-1', '--seq-2', '--seq-3', '--seq-4', '--seq-5', '--seq-6', '--seq-7',
    '--div-neg-3', '--div-neg-2', '--div-neg-1', '--div-zero', '--div-pos-1', '--div-pos-2', '--div-pos-3', '--scrim',
  ],
  type: [
    '--font-display', '--font-numeric', '--font-width-text', '--font-width-display', '--font-width-numeric',
    '--type-micro-size', '--type-micro-line', '--type-micro-tracking', '--type-label-size', '--type-label-line', '--type-label-tracking',
    '--type-dense-size', '--type-dense-line', '--type-dense-tracking', '--type-body-size', '--type-body-line', '--type-body-tracking',
    '--type-lead-size', '--type-lead-line', '--type-lead-tracking', '--type-title-size', '--type-title-line', '--type-title-tracking',
    '--type-headline-size', '--type-headline-line', '--type-headline-tracking', '--type-display-size', '--type-display-line', '--type-display-tracking',
    '--type-hero-size', '--type-hero-line', '--type-hero-tracking', '--type-display-weight', '--type-metric-weight', '--type-strong-weight',
  ],
  shape: ['--radius-mark', '--radius-control', '--radius-container', '--radius-overlay', '--focus-width', '--focus-offset'],
  elevation: ['--elevation-raised', '--elevation-overlay', '--elevation-modal'],
  motion: ['--motion-instant', '--motion-fast', '--motion-moderate', '--motion-slow', '--motion-chart', '--ease-standard', '--ease-enter', '--ease-exit'],
  density: ['--control-height-xs', '--control-height-sm', '--control-height-md', '--control-height-lg', '--row-height', '--row-height-two-line', '--cell-padding-x', '--cell-padding-y'],
  component: [
    '--button-radius', '--input-radius', '--chip-radius', '--tag-radius', '--nav-item-radius', '--card-radius', '--card-border',
    '--card-shadow-hover', '--popover-radius', '--popover-shadow', '--dialog-radius', '--dialog-shadow', '--ask-radius',
    '--table-header-surface', '--table-rule', '--table-total-rule', '--chart-line-width', '--chart-cmp-dash', '--chart-bar-radius',
  ],
} as const;

/** Non-colour primitives of the concept theme. */
export const PRIMITIVES = {
  type: [
    '--jc-font-archivo', '--jc-font-chivo-mono', '--jc-width-condensed', '--jc-width-normal', '--jc-width-wide',
    '--jc-weight-regular', '--jc-weight-book', '--jc-weight-medium', '--jc-weight-semibold',
    '--jc-size-11', '--jc-size-12', '--jc-size-13', '--jc-size-14', '--jc-size-16', '--jc-size-20', '--jc-size-24', '--jc-size-32', '--jc-size-44',
  ],
  space: ['--jc-space-0', '--jc-space-1', '--jc-space-2', '--jc-space-3', '--jc-space-4', '--jc-space-5', '--jc-space-6', '--jc-space-7', '--jc-space-8', '--jc-space-9'],
  radius: ['--jc-radius-1', '--jc-radius-2', '--jc-radius-3', '--jc-radius-4', '--jc-radius-round'],
  motion: ['--jc-duration-1', '--jc-duration-2', '--jc-duration-3', '--jc-duration-4', '--jc-duration-5', '--jc-ease-standard', '--jc-ease-enter', '--jc-ease-exit'],
} as const;

const scaleTokens = SCALES.flatMap((s) => s.steps.map((step) => `--jc-${s.name}-${step}`));

/**
 * Every custom property only the concept theme declares. A default-theme pane nested in a concept page resets
 * them, so it reads what a default page would: nothing.
 */
export const CONCEPT_ONLY: readonly string[] = [...scaleTokens, '--jc-orange-signal', ...Object.values(PRIMITIVES).flat(), ...Object.values(CONCEPT_ROLES).flat()];

/** The contrast audit: a foreground role on the surface it is used on, and what the pair must reach. */
export interface ContrastPair {
  label: string;
  /** A token name, or a literal colour for a value a component hardcodes. */
  fg: string;
  bg: string;
  kind: PairKind;
}

export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  { label: 'Text on the canvas', fg: '--foreground', bg: '--background', kind: 'text' },
  { label: 'Text on a card', fg: '--foreground', bg: '--card', kind: 'text' },
  { label: 'Secondary text on the canvas', fg: '--muted-foreground', bg: '--background', kind: 'text' },
  { label: 'Secondary text on a card', fg: '--muted-foreground', bg: '--card', kind: 'text' },
  { label: 'Secondary text on a muted fill', fg: '--muted-foreground', bg: '--muted', kind: 'text' },
  { label: 'Primary button label', fg: '--primary-foreground', bg: '--primary', kind: 'text' },
  { label: 'Decision text on its tint', fg: '--decision', bg: '--decision-tint', kind: 'text' },
  { label: 'Decision text on a card', fg: '--decision', bg: '--card', kind: 'text' },
  { label: 'Destructive button label', fg: '#ffffff', bg: '--destructive', kind: 'text' },
  { label: 'Ahead (positive) on a card', fg: '--positive', bg: '--card', kind: 'text' },
  { label: 'Behind (negative) on a card', fg: '--negative', bg: '--card', kind: 'text' },
  { label: 'Link on a card', fg: '--link', bg: '--card', kind: 'text' },
  { label: 'Kassandra tag on its tint', fg: '--kassandra', bg: '--kassandra-tint', kind: 'text' },
  { label: 'Field border on a card', fg: '--input', bg: '--card', kind: 'graphic' },
  { label: 'Focus ring on the canvas', fg: '--ring', bg: '--background', kind: 'graphic' },
  { label: 'Focus ring beside a primary button', fg: '--ring', bg: '--primary', kind: 'graphic' },
  { label: 'Series: this period', fg: '--series', bg: '--card', kind: 'graphic' },
  { label: 'Series: comparison period', fg: '--series-cmp', bg: '--card', kind: 'graphic' },
  { label: 'Series: reference (budget)', fg: '--series-ref', bg: '--card', kind: 'graphic' },
  { label: 'Series: muted', fg: '--series-muted', bg: '--card', kind: 'graphic' },
  { label: 'Series: third', fg: '--series-3', bg: '--card', kind: 'graphic' },
  { label: 'Decision mark', fg: '--brass', bg: '--card', kind: 'graphic' },
  { label: 'Category 1', fg: '--chart-1', bg: '--card', kind: 'graphic' },
  { label: 'Category 2', fg: '--chart-2', bg: '--card', kind: 'graphic' },
  { label: 'Category 3', fg: '--chart-3', bg: '--card', kind: 'graphic' },
  { label: 'Category 4', fg: '--chart-4', bg: '--card', kind: 'graphic' },
  { label: 'Category 5', fg: '--chart-5', bg: '--card', kind: 'graphic' },
  { label: 'Series: this period, on the canvas', fg: '--series', bg: '--background', kind: 'graphic' },
];

/** The rail is its own surface (inverse in the concept theme), so its pairs are measured inside it. */
export const RAIL_PAIRS: readonly ContrastPair[] = [
  { label: 'Current item in the rail', fg: '--foreground', bg: '--rail', kind: 'text' },
  { label: 'Other items in the rail', fg: '--muted-foreground', bg: '--rail', kind: 'text' },
  { label: 'Decision count in the rail', fg: '--brass-ink', bg: '--rail', kind: 'text' },
  { label: 'Focus ring in the rail', fg: '--ring', bg: '--rail', kind: 'graphic' },
];
