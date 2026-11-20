# Juyo concept theme: direction and specification

The third Compass theme, selected with `data-theme="juyo-concept"`. The research behind it is in [juyo-concept-research.md](juyo-concept-research.md). The living version of this document is the app's `/theme-lab` view, which reads every value from the rendered CSS.

## 1. The direction: "Ledger"

Juyo runs two design systems that share no tokens: a light marketing site and a dark product. The concept is one system for both. It keeps the brand's own colours (ink #101418, off-white, blue #477EE3, violet, orange #FE7637, slate #4F5E7D) and reorganises them so that each has one job. The product becomes a light working surface framed by Juyo's ink, set like a well-kept ledger: figures first, quiet rules, nothing decorative.

Five decisions carry it:

1. **Paper for work, ink for the frame.** The workspace is light because revenue managers read 12–13px figures for hours, and dark text on a light surface is read more accurately, more so as type gets smaller (research §4). The rail is Juyo's near-black, so the product still opens on the brand and keeps a link to the dark product people know.
2. **Colour has three jobs.** Blue is this period's data. Violet is Kassandra: anything the model wrote. Orange is a decision that waits for a person. Buttons, selection and text are ink. A colour on screen therefore always means one of three things, which is Few's rule that colour changes only when meaning changes (research §2), and it makes the product's promise visible: the model never computes a number, so numbers are never violet.
3. **Figures are the display type.** One variable family, Archivo, does three jobs on its width axis: wide for headings, normal for text, condensed tabular figures for numbers. Money is set as carefully as a headline. Density comes from the type's width, not from shrinking it: a 13px column of figures takes the room an 11.5px one did.
4. **Lines before shadows.** Layers are separated by tone and a hairline, as Carbon, Atlassian and Juyo's own marketing site do. A shadow means one thing: this floats. Radius follows the size of the thing, from 2px marks to 10px dialogs, so nothing is a pill unless it is a switch.
5. **Fast and quiet.** A state change takes 110 ms on one curve (Carbon's productive set). Nothing blurs, bounces or scales. A chart draws once, in 400 ms.

What this is a reaction to, in the current themes: 21 font sizes, 11 radii, five focus rings and twelve durations, none of them tokens (research §7).

### Why it fits Juyo

- **Hospitality.** The reference is the hotel's own paperwork: the folio and the night audit. A total row takes the accountant's rules, a single rule above and a double rule below, which every finance reader recognises.
- **Money, not percentages.** Money figures get the type system's best treatment: tabular, lining, condensed where they stack, with a real minus sign.
- **Calm confidence.** Juyo sets its headlines large at regular weight. The concept sets nothing in bold: headings are medium (500), metrics are book (450), and emphasis in text is semibold (600).
- **Data first.** Chart chrome recedes to hairlines, and the comparison period loses its colour so this period stands alone.

## 2. Alternatives considered

### A. "Graphite and brass": warm neutrals, a brass accent, a serif for titles

Proposed in the earlier colour study (`../ui-refinement/color_type.md`, direction B). Warm low-chroma greys, ink buttons and a brass accent for decisions, with a quiet serif for page titles.

Rejected because:

- It leaves Juyo's brand. Their palette is cool: ink at hue 250, a blue, a violet. A warm paper with a serif reads as a boutique hotel's website, not as Juyo's product.
- Brass sits two hue steps from Juyo's orange, so "decision" and "warning" would have been neighbours and hard to tell apart.
- Warm paper with a serif and a clay accent is also the most common look of machine-made design today. The theme would have looked generated however well it was built.

### B. "Night audit": a refined dark theme

Keep the product dark, as Juyo ships it, and fix its structure: a proper elevation ramp (lighter per layer, as Carbon and Material do), dimmed series colours, the same type and density work.

Rejected because:

- Compass already has a dark theme on Juyo's palette. A second dark theme would differ in details only, and the brief is a theme that changes the whole system visibly.
- The evidence favours a light surface for small figures (research §4), and this product is mostly small figures.
- Juyo's light theme exists in their CSS, and none of their screenshots show it. A considered light product is the more useful thing to put in front of them.

The dark rail keeps what was right about this direction.

### Also weighed and dropped

- **Violet for last year**, as Juyo's charts do today. Kept blue for this period, but moved the comparison to slate. Violet cannot mean both "Kassandra wrote this" and "last year", and last year is context, which the research says should be grey (Datawrapper, Few).
- **A serif for Kassandra's prose**, to separate the model's voice from the data by typeface. Dropped: it would have made answers look like a different product, and colour already carries provenance.
- **Instrument Sans**, the closest free relative of Aeonik. Its digits are 16% wider than Archivo's (0.666 em against 0.573 em), labels wrapped in the comp, and it has no weight under 400 or over 700.

## 3. Token architecture

### Three tiers

| Tier | Prefix | Holds | Example | Who may read it |
|---|---|---|---|---|
| 1. Primitive | `--jc-` | A raw value | `--jc-ink-10: #575e67` | Semantic tokens only |
| 2. Semantic | none | A role | `--muted-foreground: var(--jc-ink-10)` | Components, component tokens |
| 3. Component | the component's name | One component's decision | `--card-radius: var(--radius-container)` | That component |

References go one way: component → semantic → primitive. A component never reads a primitive (Primer: base tokens "should never be used directly in code or design").

A theme is a new mapping of the semantic tier. The 47 colour roles that the Light and Dark themes define keep their names, so every existing component follows the theme without an edit. The concept adds the roles the default themes never had as tokens: type, radius, elevation, focus, motion, density and chart styling.

### Naming

- Primitives: `--jc-<scale>-<step>`. Colour scales count up from light to dark; other scales count up from small to large or short to long. Names say what the value is (`--jc-blue-6`, `--jc-duration-2`).
- Semantic: element, then role, then state, never a hue (Carbon, Primer, Atlassian). `--border-control`, `--surface-sunken`, `--elevation-overlay`, `--motion-fast`, `--type-dense-size`, `--radius-container`.
- Component: `--<component>-<property>`: `--button-radius`, `--table-total-rule`, `--chart-line-width`.
- The existing role names are kept as they are (`--background`, `--card`, `--muted-foreground`, `--series`, `--decision` and the rest), even where the grammar would name them differently. Renaming them would mean editing every component, which is the opposite of the point.

### Files

| File | Holds |
|---|---|
| `apps/web/src/themes/juyo-concept/tokens.css` | All three tiers, and the inverse scope for the rail |
| `apps/web/src/themes/juyo-concept/bridge.css` | Maps the literals components still carry onto the tokens |
| `apps/web/src/themes/juyo-concept/index.css` | Imports the two; listed after `styles.css` in `angular.json` |
| `apps/web/src/app/theme.ts` | The theme signal, the list of themes, the storage key |
| `apps/web/src/app/theme-lab/` | The `/theme-lab` view |

### How a theme is selected

`<html data-theme="light | dark | juyo-concept">`. The inline script in `index.html` reads the saved choice (`localStorage["compass-theme"]`) before the first paint and maps it to the `.dark` or `.light` class that Spartan's `dark:` variant reads. `juyo-concept` is a light theme. `data-theme` also works on any element, which is how the theme lab shows two themes side by side.

### The bridge

The components predate the token contract: they write `text-[13.5px]`, `rounded-[10px]` and `duration-[175ms]`, and `styles.css` writes its own radii, shadows and timings. Editing 30 components that other people are changing would have caused conflicts for no visible gain, so `bridge.css` maps each literal onto a token, inside the theme's scope:

- 20 literal font sizes → 8 type steps.
- 11 radii and 8 `rounded-*` utilities → 4 radius steps.
- 5 focus recipes → 1 ring.
- 12 durations and 3 curves → 5 durations and 3 curves.
- 4 drop shadows → 3 elevation levels.

It is a migration aid, and it says so at the top of the file. When a component adopts a token, its line in the bridge goes. The bridge uses a CSS donut scope, `@scope ([data-theme='juyo-concept']) to ([data-theme]:not([data-theme='juyo-concept']))`, so it stops at a nested default-theme pane. `@scope` is in Chrome 118, Safari 17.4 and Firefox 146 and later; a browser without it gets the concept's colours and fonts and the default theme's sizes and shapes.

### In the W3C Design Tokens format

The CSS is the source of truth today. The same tokens map directly onto the DTCG format (Format Module 2025.10), which is how they would be shared with a design tool:

```json
{
  "jc": {
    "ink": { "$type": "color", "10": { "$value": "#575e67" } },
    "duration": { "$type": "duration", "2": { "$value": { "value": 110, "unit": "ms" } } }
  },
  "muted-foreground": { "$type": "color", "$value": "{jc.ink.10}", "$description": "Secondary text. 4.5:1 or more on surfaces 0 to 3." },
  "motion-fast": { "$type": "duration", "$value": "{jc.duration.2}" }
}
```

Light, Dark and Juyo concept would be three contexts of one `theme` modifier in a DTCG resolver file, with density as a second, independent modifier.

## 4. Colour

### Method

Every scale is built in OKLCH with one hue and a hand-set lightness and chroma per step, then converted to sRGB. A step has the same job in every hue scale, so the step number carries the contrast promise (Radix, Stripe, Material's tone gaps):

| Step | Job | Contrast on white |
|---|---|---|
| 1–3 | Tinted surfaces and their borders | 1.1–1.5 |
| 4 | Soft fills; text and marks on the dark rail | 2.0–2.3 |
| 5 | Graphics: lines, bars, icons | 3:1 or more (3.3–4.5) |
| 6 | Text | 4.5:1 or more (5.1–6.5) |
| 7 | Strong text | 7:1 or more (7.5–9.3) |
| 8 | Text on the scale's own tint | 11 or more |

Ink, the neutral, has more steps because it does more jobs: 0 raised surface, 1–2 canvas, 3–5 fills, 5–7 hairlines, 8 control borders, 9 quiet icons, 10–11 secondary text, 12 text.

Three values are Juyo's own, placed where they fall: ink-12 is #101418, blue-5 is #477EE3, slate-6 is #4F5E7D. The signal orange #FE7637 is kept as a fill for ink text only, because white on it is 2.67:1.

### Primitive scales

**ink** (hue 250)

| Step | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Hex | `#ffffff` | `#f9fafb` | `#f4f6f8` | `#edf0f2` | `#e5e8eb` | `#dde0e3` | `#d4d8dc` | `#c0c5ca` | `#82888f` | `#6e757d` | `#575e67` | `#394149` | `#101418` |
| L / C | 1 / 0 | 0.985 / 0.002 | 0.972 / 0.003 | 0.953 / 0.004 | 0.93 / 0.005 | 0.905 / 0.006 | 0.88 / 0.007 | 0.82 / 0.009 | 0.625 / 0.012 | 0.56 / 0.014 | 0.48 / 0.016 | 0.37 / 0.018 | 0.189 / 0.01 |
| On white | 1.00 | 1.05 | 1.08 | 1.14 | 1.23 | 1.33 | 1.43 | 1.74 | 3.58 | 4.66 | 6.56 | 10.36 | 18.50 |

**night** (hue 255)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| Hex | `#101418` | `#161b22` | `#1f2630` | `#2b343e` | `#414853` | `#6e757e` | `#999fa7` | `#b9bec4` | `#fafafa` |
| L / C | 0.189 / 0.01 | 0.22 / 0.016 | 0.266 / 0.021 | 0.32 / 0.022 | 0.4 / 0.02 | 0.56 / 0.016 | 0.7 / 0.014 | 0.8 / 0.01 | 0.985 / 0 |
| On night-1 | 1.00 | 1.07 | 1.21 | 1.47 | 2.01 | 3.97 | 6.93 | 9.89 | 17.72 |

**blue** (hue 261)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Hex | `#f1f6ff` | `#dfecff` | `#c1d9ff` | `#87b1fa` | `#477ee3` | `#2261d1` | `#114aae` | `#0f3375` |
| L / C | 0.972 / 0.014 | 0.94 / 0.032 | 0.88 / 0.062 | 0.76 / 0.115 | 0.607 / 0.164 | 0.52 / 0.185 | 0.44 / 0.17 | 0.34 / 0.12 |
| On white | 1.08 | 1.19 | 1.43 | 2.17 | 3.92 | 5.68 | 8.03 | 12.00 |

**violet** (hue 290)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Hex | `#f5f4ff` | `#eae8ff` | `#d6d2fc` | `#b0a6ef` | `#8470d6` | `#684dbf` | `#52379f` | `#372769` |
| L / C | 0.972 / 0.014 | 0.94 / 0.03 | 0.88 / 0.058 | 0.76 / 0.105 | 0.61 / 0.15 | 0.51 / 0.17 | 0.43 / 0.16 | 0.33 / 0.11 |
| On white | 1.09 | 1.20 | 1.45 | 2.20 | 3.98 | 6.17 | 8.73 | 12.68 |

**orange** (hue 45)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Hex | `#fff3ed` | `#ffe4d6` | `#ffc8ac` | `#ff9c6b` | `#e86518` | `#b64700` | `#923800` | `#612605` |
| L / C | 0.972 / 0.016 | 0.94 / 0.04 | 0.88 / 0.08 | 0.79 / 0.14 | 0.66 / 0.18 | 0.54 / 0.16 | 0.46 / 0.135 | 0.35 / 0.095 |
| On white | 1.09 | 1.21 | 1.49 | 2.05 | 3.33 | 5.40 | 7.53 | 11.75 |

**teal** (hue 196)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Hex | `#edf8f8` | `#d7f1f1` | `#b0e3e3` | `#64c3c4` | `#009395` | `#007374` | `#00595b` | `#003e3f` |
| L / C | 0.972 / 0.012 | 0.94 / 0.028 | 0.88 / 0.052 | 0.76 / 0.09 | 0.6 / 0.105 | 0.5 / 0.09 | 0.42 / 0.076 | 0.33 / 0.058 |
| On white | 1.08 | 1.18 | 1.41 | 2.07 | 3.75 | 5.67 | 8.14 | 11.93 |

**green** (hue 160)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Hex | `#eef9f3` | `#d9f3e3` | `#b5e5ca` | `#71c69a` | `#229666` | `#03734a` | `#025939` | `#063d26` |
| L / C | 0.972 / 0.014 | 0.94 / 0.034 | 0.88 / 0.062 | 0.76 / 0.105 | 0.6 / 0.125 | 0.49 / 0.11 | 0.41 / 0.092 | 0.32 / 0.068 |
| On white | 1.08 | 1.17 | 1.40 | 2.05 | 3.74 | 5.91 | 8.43 | 12.33 |

**red** (hue 25)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Hex | `#fef3f2` | `#ffe4e1` | `#fdc9c4` | `#f4928a` | `#e44645` | `#c02b2f` | `#9b1e22` | `#651818` |
| L / C | 0.972 / 0.012 | 0.94 / 0.03 | 0.88 / 0.06 | 0.76 / 0.12 | 0.62 / 0.195 | 0.53 / 0.185 | 0.45 / 0.16 | 0.34 / 0.11 |
| On white | 1.09 | 1.20 | 1.47 | 2.25 | 3.99 | 5.79 | 8.07 | 12.37 |

**ochre** (hue 82)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Hex | `#fbf5ea` | `#f9e9ce` | `#f0d39f` | `#dcb05b` | `#b28319` | `#8e670b` | `#6e4f06` | `#4c3709` |
| L / C | 0.972 / 0.016 | 0.94 / 0.04 | 0.88 / 0.075 | 0.78 / 0.115 | 0.64 / 0.125 | 0.54 / 0.108 | 0.45 / 0.09 | 0.35 / 0.066 |
| On white | 1.09 | 1.19 | 1.45 | 2.02 | 3.41 | 5.13 | 7.54 | 11.30 |

**slate** (hue 264)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Hex | `#f4f6fa` | `#e7ebf3` | `#d0d8e7` | `#a4b1cb` | `#65779d` | `#4f5e7d` | `#3a4763` | `#263045` |
| L / C | 0.972 / 0.006 | 0.94 / 0.012 | 0.88 / 0.022 | 0.76 / 0.04 | 0.57 / 0.062 | 0.482 / 0.054 | 0.4 / 0.05 | 0.31 / 0.04 |
| On white | 1.08 | 1.19 | 1.43 | 2.16 | 4.49 | 6.50 | 9.29 | 13.20 |

**plum** (hue 345)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Hex | `#fcf3f8` | `#fae4ef` | `#f3cae0` | `#e196c0` | `#bc5694` | `#9b3876` | `#7b285d` | `#551d40` |
| L / C | 0.972 / 0.012 | 0.94 / 0.028 | 0.88 / 0.055 | 0.76 / 0.105 | 0.6 / 0.15 | 0.5 / 0.15 | 0.42 / 0.13 | 0.33 / 0.095 |
| On white | 1.09 | 1.21 | 1.46 | 2.25 | 4.29 | 6.52 | 9.12 | 12.84 |

All values are in `tokens.css`. The lightness and chroma rows are the OKLCH inputs.

### Semantic mapping

| Role | Token | Value |
|---|---|---|
| Canvas | `--background` | ink-2 `#f4f6f8` |
| Text | `--foreground`, `--text-1` | ink-12 `#101418` |
| Raised surface | `--card`, `--popover`, `--field` | ink-0 `#ffffff` |
| Sunken surface | `--surface-sunken`, `--muted`, `--secondary`, `--accent` | ink-3 `#edf0f2` |
| Inverse surface | `--rail`, `--surface-inverse` | night-1 `#101418` |
| Action | `--primary` / `--primary-foreground` | ink-12 / ink-0 |
| Secondary text, quiet icons | `--muted-foreground`, `--text-secondary`, `--icon-quiet` | ink-10 `#575e67` |
| Hairline | `--border` | ink-5 `#dde0e3` |
| Card outline | `--field-border`, `--card-border` | ink-6 `#d4d8dc` |
| Divider on a fill | `--border-strong` | ink-7 `#c0c5ca` |
| Control border | `--border-control`, `--input`, `--field-border-hover` | ink-8 `#82888f` |
| Focus | `--ring`, `--focus-brand` | blue-6 `#2261d1` |
| Link | `--link` | blue-6 `#2261d1` |
| Selected | `--selected` / `--selected-border` | blue-1 / blue-6 |
| Kassandra | `--kassandra`, `--brand` / `--kassandra-tint` / `--kassandra-border` | violet-6 / violet-1 / violet-3 |
| Decision, text | `--decision`, `--brass-ink` | orange-6 `#b64700` |
| Decision, mark | `--brass` | orange-5 `#e86518` |
| Decision, surface | `--decision-tint`, `--brass-wash` / `--decision-border` | orange-1 / orange-3 |
| Ahead | `--positive` | green-6 `#03734a` |
| Behind, destructive | `--negative`, `--destructive` | red-6 `#c02b2f` |
| Hover, press | `--overlay-hover` / `--overlay-pressed` | ink at 5% / 10% |
| Scrim | `--scrim` | ink at 45% |

Ahead and behind are never colour alone: the app writes a sign and an arrow beside every delta.

### The rail is an inverse scope

The rail does not get its own component styles. `nav[aria-label='Main']` (and any element with `data-surface="inverse"`) redeclares the same semantic names against the night scale, so the nav's existing classes (`text-foreground`, `text-muted-foreground`, `bg-foreground/6`) resolve to light-on-dark values:

| Token in the rail | Value |
|---|---|
| `--background`, `--rail` | night-1 `#101418` |
| `--foreground`, `--text-1` | night-9 `#fafafa` |
| `--muted-foreground` | night-7 `#999fa7` |
| `--muted`, `--field` | night-2 `#161b22` |
| `--secondary`, `--accent` | night-3 `#1f2630` |
| `--card` (the selected segment) | night-4 `#2b343e` |
| `--border` | white at 10% |
| `--ring` | blue-4 `#87b1fa` |
| `--brass-ink` (the decision count) | orange-4 `#ff9c6b` |

### Contrast: text (WCAG 1.4.3, 4.5:1)

Computed with the WCAG 2 formula, unrounded, and with APCA 0.0.98G-4g. The theme lab recomputes the same pairs in the browser from the rendered tokens.

| Pair | Foreground | Background | WCAG | APCA Lc | Needs | Result |
|---|---|---|---|---|---|---|
| Text on the canvas | `#101418` ink-12 | `#f4f6f8` ink-2 | 17.07:1 | 100 | 4.5 | pass |
| Text on a card | `#101418` ink-12 | `#ffffff` ink-0 | 18.50:1 | 105 | 4.5 | pass |
| Text on a muted fill | `#101418` ink-12 | `#edf0f2` ink-3 | 16.16:1 | 96 | 4.5 | pass |
| Secondary text on the canvas | `#575e67` ink-10 | `#f4f6f8` ink-2 | 6.05:1 | 77 | 4.5 | pass |
| Secondary text on a card | `#575e67` ink-10 | `#ffffff` ink-0 | 6.56:1 | 82 | 4.5 | pass |
| Secondary text on a muted fill | `#575e67` ink-10 | `#edf0f2` ink-3 | 5.73:1 | 73 | 4.5 | pass |
| Secondary text on a table header | `#575e67` ink-10 | `#f9fafb` ink-1 | 6.28:1 | 79 | 4.5 | pass |
| Primary button label | `#ffffff` ink-0 | `#101418` ink-12 | 18.50:1 | 107 | 4.5 | pass |
| Destructive button label | `#ffffff` ink-0 | `#c02b2f` red-6 | 5.79:1 | 83 | 4.5 | pass |
| Link on a card | `#2261d1` blue-6 | `#ffffff` ink-0 | 5.68:1 | 78 | 4.5 | pass |
| Link on the canvas | `#2261d1` blue-6 | `#f4f6f8` ink-2 | 5.24:1 | 72 | 4.5 | pass |
| Decision text on its tint | `#b64700` orange-6 | `#fff3ed` orange-1 | 4.96:1 | 70 | 4.5 | pass |
| Decision text on a card | `#b64700` orange-6 | `#ffffff` ink-0 | 5.40:1 | 76 | 4.5 | pass |
| Decision button: ink on signal orange | `#101418` ink-12 | `#fe7637` orange-signal | 6.92:1 | 52 | 4.5 | pass |
| Ahead (positive) on a card | `#03734a` green-6 | `#ffffff` ink-0 | 5.91:1 | 79 | 4.5 | pass |
| Ahead on the canvas | `#03734a` green-6 | `#f4f6f8` ink-2 | 5.45:1 | 73 | 4.5 | pass |
| Behind (negative) on a card | `#c02b2f` red-6 | `#ffffff` ink-0 | 5.79:1 | 77 | 4.5 | pass |
| Behind on the canvas | `#c02b2f` red-6 | `#f4f6f8` ink-2 | 5.34:1 | 72 | 4.5 | pass |
| Failed chip: red on its tint | `#c02b2f` red-6 | `#fef3f2` red-1 | 5.32:1 | 72 | 4.5 | pass |
| Kassandra tag on its tint | `#684dbf` violet-6 | `#f5f4ff` violet-1 | 5.66:1 | 74 | 4.5 | pass |
| Kassandra text on a card | `#684dbf` violet-6 | `#ffffff` ink-0 | 6.17:1 | 80 | 4.5 | pass |
| Selected row: text on the blue tint | `#101418` ink-12 | `#f1f6ff` blue-1 | 17.06:1 | 100 | 4.5 | pass |
| Selected row: secondary text | `#575e67` ink-10 | `#f1f6ff` blue-1 | 6.05:1 | 77 | 4.5 | pass |
| Rail: current item | `#fafafa` night-9 | `#101418` night-1 | 17.72:1 | 104 | 4.5 | pass |
| Rail: other items | `#999fa7` night-7 | `#101418` night-1 | 6.93:1 | 49 | 4.5 | pass |
| Rail: decision count | `#ff9c6b` orange-4 | `#101418` night-1 | 9.00:1 | 62 | 4.5 | pass |
| Rail: selected segment | `#fafafa` night-9 | `#2b343e` night-4 | 12.09:1 | 99 | 4.5 | pass |
| Rail: unselected segment | `#999fa7` night-7 | `#161b22` night-2 | 6.48:1 | 49 | 4.5 | pass |

### Contrast: graphics, borders and focus (WCAG 1.4.11, 3:1)

| Pair | Mark | Surface | WCAG | APCA Lc | Needs | Result |
|---|---|---|---|---|---|---|
| Field border on a card | `#82888f` ink-8 | `#ffffff` ink-0 | 3.58:1 | 63 | 3 | pass |
| Field border on the canvas | `#82888f` ink-8 | `#f4f6f8` ink-2 | 3.30:1 | 58 | 3 | pass |
| Switch, off, on a card | `#82888f` ink-8 | `#ffffff` ink-0 | 3.58:1 | 63 | 3 | pass |
| Focus ring on the canvas | `#2261d1` blue-6 | `#f4f6f8` ink-2 | 5.24:1 | 72 | 3 | pass |
| Focus ring on a card | `#2261d1` blue-6 | `#ffffff` ink-0 | 5.68:1 | 78 | 3 | pass |
| Focus ring beside an ink button | `#2261d1` blue-6 | `#101418` ink-12 | 3.26:1 | 23 | 3 | pass |
| Focus ring in the rail | `#87b1fa` blue-4 | `#101418` night-1 | 8.54:1 | 59 | 3 | pass |
| Series: this period, on a card | `#477ee3` blue-5 | `#ffffff` ink-0 | 3.92:1 | 66 | 3 | pass |
| Series: this period, on the canvas | `#477ee3` blue-5 | `#f4f6f8` ink-2 | 3.62:1 | 61 | 3 | pass |
| Series: comparison period | `#65779d` slate-5 | `#ffffff` ink-0 | 4.49:1 | 71 | 3 | pass |
| Series: reference (budget) | `#394149` ink-11 | `#ffffff` ink-0 | 10.36:1 | 94 | 3 | pass |
| Series: muted | `#82888f` ink-8 | `#ffffff` ink-0 | 3.58:1 | 63 | 3 | pass |
| Series: third | `#009395` teal-5 | `#ffffff` ink-0 | 3.75:1 | 64 | 3 | pass |
| Decision mark | `#e86518` orange-5 | `#ffffff` ink-0 | 3.33:1 | 60 | 3 | pass |
| Negative mark | `#c02b2f` red-6 | `#ffffff` ink-0 | 5.79:1 | 77 | 3 | pass |
| Category 1, blue | `#477ee3` blue-5 | `#ffffff` ink-0 | 3.92:1 | 66 | 3 | pass |
| Category 2, teal | `#00595b` teal-7 | `#ffffff` ink-0 | 8.14:1 | 88 | 3 | pass |
| Category 3, ochre | `#b28319` ochre-5 | `#ffffff` ink-0 | 3.41:1 | 61 | 3 | pass |
| Category 4, plum | `#7b285d` plum-7 | `#ffffff` ink-0 | 9.12:1 | 90 | 3 | pass |
| Category 5, green | `#229666` green-5 | `#ffffff` ink-0 | 3.74:1 | 64 | 3 | pass |
| Category 6, slate | `#3a4763` slate-7 | `#ffffff` ink-0 | 9.29:1 | 91 | 3 | pass |
| Sequential step 5 | `#477ee3` blue-5 | `#ffffff` ink-0 | 3.92:1 | 66 | 3 | pass |
| Sequential step 6 | `#2261d1` blue-6 | `#ffffff` ink-0 | 5.68:1 | 78 | 3 | pass |
| Sequential step 7 | `#0f3375` blue-8 | `#ffffff` ink-0 | 12.00:1 | 97 | 3 | pass |
| Diverging: far below | `#b64700` orange-6 | `#ffffff` ink-0 | 5.40:1 | 76 | 3 | pass |
| Diverging: far above | `#2261d1` blue-6 | `#ffffff` ink-0 | 5.68:1 | 78 | 3 | pass |

All 54 pairs pass WCAG 2.2 AA. Three APCA readings are worth knowing:

- **Secondary text in the rail is Lc 49.** WCAG gives the same pair 6.9:1. This is the dark-surface overstatement APCA describes. Lc 45–60 is APCA's range for larger or non-body text; rail items are 13–14px labels, not paragraphs, so the value stays, and the rail's current item is Lc 104.
- **Ink on the signal orange is Lc 52** (6.9:1 in WCAG). It is used for one short button label at medium weight.
- **The focus ring beside an ink button is Lc 23** (3.26:1 in WCAG). A 2px gap in the surface colour separates the two, so the ring is always read against the surface, where it is Lc 72–78.

## 5. Type

### Faces

| Role | Face | Setting | Why |
|---|---|---|---|
| Display | **Archivo** | width 112%, weight 500 | A grotesque, like Juyo's Aeonik, with a wide cut that gives headings a voice without a second family or a bold weight. |
| Text | **Archivo** | width 100%, weights 400, 500, 600 | Tall x-height (0.526 em) and open shapes hold up at 12–13px. It has a real minus sign and the euro. |
| Numeric | **Archivo** | width 88%, tabular lining figures | The width axis runs 62–125%. At 88% a figure is 12% narrower with the same height, so density comes from width, not from a smaller size. A 13px condensed figure is about as wide as an 11.5px normal one (13 × 0.88 = 11.4). |
| Mono | **Chivo Mono** | weights 400, 500 | From Archivo's foundry (Omnibus-Type), so the letterforms agree. Used only for code, SQL and identifiers, never for money. |

Both are on Google Fonts under the SIL Open Font License. Archivo's variable file is about 87 KB for Latin and serves every role; Chivo Mono is about 25 KB. They are requested in the same stylesheet as the default themes' fonts, and a browser downloads a font file only when a theme uses it.

Why not the obvious choices: Inter is the current face and the default of half the web. Geist and IBM Plex Sans have no width axis (and Plex has no proportional figures on Google Fonts). Mona Sans has the axis but slashes its tabular zero and belongs to GitHub. Research §5 has the full comparison.

A numeric face is not a monospaced face. Butterick and Ström both say columns need tabular figures, not monospace, and a monospaced face for small data labels is a tell of generated design. `font-variant-numeric: tabular-nums lining-nums` in the text face does the job.

Known limits of Archivo: no slashed zero, and capital I and lowercase l are close. Money and dates never mix them; identifiers and SQL are set in Chivo Mono, where they differ.

### Scale

Eight steps, picked by hand (Refactoring UI) around a 14px base (Carbon productive, Atlassian), with every line height on the 4px grid. A ninth step, hero, is defined for a single large figure and is not used by the app yet.

| Role | Token prefix | Size | Line | Tracking | Weight | Width | Used for |
|---|---|---|---|---|---|---|---|
| Micro | `--type-micro-*` | 11px | 16px | +0.02em | 400–600 | 100% | Badges |
| Label | `--type-label-*` | 12px | 16px | +0.01em | 400–500 | 100% | Captions, axis labels, column headers |
| Dense | `--type-dense-*` | 13px | 20px | 0 | 400–600 | 100%, figures 88% | Tables, rail, controls |
| Body | `--type-body-*` | 14px | 20px | 0 | 400–600 | 100% | Text, answers |
| Lead | `--type-lead-*` | 16px | 24px | −0.005em | 500–600 | 100% | Card titles, the composer |
| Title | `--type-title-*` | 20px | 28px | −0.01em | 500 | 112% | Section titles; metrics at 100%, weight 450 |
| Headline | `--type-headline-*` | 24px | 32px | −0.015em | 500 | 112% | Page titles; metrics at 100%, weight 450 |
| Display | `--type-display-*` | 32px | 38px | −0.02em | 500 | 112% | The brief's headline |
| Hero | `--type-hero-*` | 44px | 48px | −0.025em | 450 | 100% | One figure, alone |

Tracking opens as type gets small and closes as it grows, as Apple's tables and Carbon's `label-01` do.

How the 20 literal sizes map: 10, 11 → 11. 11.5, 12, 12.5 → 12. 13, 13.5 → 13. 14, 14.5, 15, 15.5 → 14. 16, 17, 18 → 16. 20, 22 → 20. 24, 26 → 24. 30, 34 → 32.

### Rules

- Nothing is bold. Headings are 500, metrics 450, emphasis 600, text 400. No weight under 400.
- Labels are sentence case. The theme removes `text-transform: uppercase` from labels; capitals are for acronyms such as ADR and RevPAR. Inputs that uppercase a code keep doing so.
- Figures are tabular and lining wherever they stack, and condensed where they sit in columns. From 20px up a figure is a metric: normal width, book weight.
- A total row is set off with a single rule above and a double rule below.
- Text that is already secondary is not faded further. `text-muted-foreground/80` measured 4.08:1 on a card, so the theme sets it back to the full secondary colour.

## 6. Space and density

The unit is 4px. The scale is non-linear above 16px, so no two steps are closer than 25% (Refactoring UI):

| Token | `--jc-space-1` | `-2` | `-3` | `-4` | `-5` | `-6` | `-7` | `-8` | `-9` |
|---|---|---|---|---|---|---|---|---|---|
| Value | 2px | 4px | 8px | 12px | 16px | 24px | 32px | 48px | 64px |

Tailwind's spacing utilities already sit on the 4px unit and are left alone: scaling `--spacing` by a fraction would put borders on half pixels. Density changes where it counts, through tokens the default themes never had:

| Token | Concept | Default themes | Applies to |
|---|---|---|---|
| `--control-height-xs` | 24px | 28px | Extra-small buttons, segments |
| `--control-height-sm` | 28px | 32px | Small buttons, chips, filter options |
| `--control-height-md` | 32px | 34–36px | Buttons, fields, filter buttons |
| `--control-height-lg` | 36px | 40px | Prominent actions |
| `--row-height` | 32px | 32px, as padding | Single-line table rows in answers |
| `--row-height-two-line` | 48px | 56px | Decision table rows |
| `--cell-padding-x` / `-y` | 12px / 6px | 12px / 10px | Table cells |

On a coarse pointer every control height becomes 44px (48px for large), and fields keep 16px text so iOS does not zoom. Pickers, popovers and dialogs are not made denser (Material, Angular Material).

## 7. Radius

| Token | Value | Used for |
|---|---|---|
| `--radius-mark` | 2px | Tags, bars, ticks, code, the selected segment |
| `--radius-control` | 4px | Buttons, fields, chips, rail items, calendar cells |
| `--radius-container` | 6px | Cards, panels, popovers, the ask bar |
| `--radius-overlay` | 10px | Dialogs and sheets |
| `--jc-radius-round` | full | Switches, avatars, status dots: things that are round, not rounded |

Radius grows with the size of the thing and stops at 10px. The default themes use 11 values and pills for chips and buttons.

## 8. Elevation and borders

| Level | Token | Value | Used for |
|---|---|---|---|
| 0, resting | none | 1px `--card-border` on the raised surface | Cards, panels, tables |
| 1, raised | `--elevation-raised` | `0 1px 2px rgb(16 20 24 / 0.07), 0 1px 1px rgb(16 20 24 / 0.04)` | A card under the pointer, the selected segment, the switch thumb |
| 2, overlay | `--elevation-overlay` | `0 6px 16px -4px rgb(16 20 24 / 0.14), 0 2px 4px -2px rgb(16 20 24 / 0.08)` | Popovers, menus, tips |
| 3, modal | `--elevation-modal` | `0 24px 48px -12px rgb(16 20 24 / 0.24), 0 8px 16px -8px rgb(16 20 24 / 0.12)` | Dialogs, the side panel, with `--scrim` behind |

Shadows are two-part, offset downward and tinted with ink, not black (Refactoring UI). A card at rest has none: the canvas is ink-2, the card is white and the outline is ink-6, which is Carbon's layering. Hover raises a card by one level and darkens its outline; nothing moves or scales.

Three borders, by job: hairline (`--border`, decorative, exempt from contrast), strong (`--border-strong`, for dividers on fills and outlined buttons) and control (`--border-control`, 3.58:1 on a card). A form field's border is how a person finds the field, so it must reach 3:1 (WCAG 1.4.11). The default dark theme's field border measures 1.54:1.

## 9. Focus

One ring for every component: `outline: 2px solid var(--ring)` with a 2px offset, so a gap in the surface colour always separates the ring from the control. Where an outside ring would be clipped (table rows, calendar cells, joined buttons) it is drawn inside, with the same width and colour. In the rail the ring is blue-4. The ask bar shows the ring on the field, not on the textarea inside it.

This replaces five recipes. The ring is 5.24:1 against the canvas, 5.68:1 against a card and 8.54:1 in the rail, and its 2px perimeter meets WCAG 2.4.13 (AAA) for size.

## 10. Motion

Carbon's productive durations and curves:

| Token | Value | Used for |
|---|---|---|
| `--motion-instant` | 70 ms | Hover fills |
| `--motion-fast` | 110 ms | Colour, border, selection, toggles |
| `--motion-moderate` | 180 ms | Popovers, content settling in |
| `--motion-slow` | 280 ms | Panels, sheets, dialogs |
| `--motion-chart` | 400 ms | A chart drawing once |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0.38, 0.9)` | State changes |
| `--ease-enter` | `cubic-bezier(0, 0, 0.38, 0.9)` | Things arriving |
| `--ease-exit` | `cubic-bezier(0.2, 0, 1, 0.9)` | Things leaving |

Generated content settles with opacity and 2px of travel in 180 ms. The default themes take 320 ms and add a blur. Buttons do not scale on press and cards do not shift on hover. With `prefers-reduced-motion`, entrances and chart drawing are removed, as before.

## 11. Charts

| | Default themes | Juyo concept |
|---|---|---|
| This period | Blue | Blue-5 `#477ee3`, 2px |
| Comparison period | Violet, dashed | Slate-5 `#65779d`, 1.5px, dashed 4 3. Same hue family as blue with the colour drained: last year is context, not a category |
| Reference (budget) | Light grey | Ink-11 `#394149`, a thin solid rule |
| Text set in a series colour | The series colour | The text step of the same hue (blue-6), so it reaches 4.5:1 |
| Gridlines | Translucent white or black | Ink-4 hairlines along the value axis only |
| Axis line and labels | Muted text colour | Ink-7 line, ink-10 labels, no ticks |
| Bar ends | 3px radius | 2px for bars, 1px for small marks such as bullet graphs |
| Chart text | Inter | Archivo at 88% width, tabular figures |
| Draw time (charts drawn in CSS) | 600–700 ms | 400 ms |
| Categories | Blue, grey, teal, orange, red (orange and red also mean decision and behind) | Six hues that mean nothing else, ordered light, dark, light, dark |
| Sequential | None: alpha steps of the series colour | Seven blue steps, light for low and dark for high |
| Diverging | None | Orange below, ink-3 at zero, blue above; no red with green |

Categorical order and the luminance contrast between neighbours:

| | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Token | `--cat-1` | `--cat-2` | `--cat-3` | `--cat-4` | `--cat-5` | `--cat-6` |
| Colour | blue-5 `#477ee3` | teal-7 `#00595b` | ochre-5 `#b28319` | plum-7 `#7b285d` | green-5 `#229666` | slate-7 `#3a4763` |
| On a card | 3.92 | 8.14 | 3.41 | 9.12 | 3.74 | 9.29 |
| Against the next | 2.08 | 2.39 | 2.67 | 2.44 | 2.49 | |

Neighbours differ by 2:1 or more in luminance, so a stacked bar survives a greyscale print and the common colour-vision deficiencies (Datawrapper: "get it right in black and white"; Carbon: order the palette for contrast between neighbours). Use at most five in one chart, and label the series directly.

A sequential ramp cannot hold 3:1 at every step (Datawrapper). Steps 1–4 of the ramp are below 3:1 on a card, so a heat map needs cell borders or the value on demand; from step 5 the fill alone carries it.

How it reaches the charts:

- `palette()` in `echart.ts` reads the series colours from the tokens, as before. It now takes an optional element, so a themed subtree can be read.
- `chartStyle()` is new: it reads line width, comparison dash, bar radius, axis and rule colours, the font and the category list from the tokens, with the default themes' values as fallbacks.
- A `compass-juyo-concept` ECharts theme is registered from those tokens the first time the theme is used. It sets the axis, grid, line and bar defaults for any option that does not set its own.
- The chart option builders still name `Inter` and some widths inline. The bridge sets the chart text face from CSS. Moving the builders to `chartStyle()` is the follow-up that removes that override.

## 12. Implementation notes

Edits outside the theme's own files, all small:

| File | Change |
|---|---|
| `apps/web/src/index.html` | Loads Archivo and Chivo Mono. The theme script reads the saved theme and maps `juyo-concept` to `.light`. |
| `apps/web/public/_headers` | The new hash of that script in the Content-Security-Policy. |
| `apps/web/angular.json` | Adds the theme stylesheet after `styles.css`. |
| `apps/web/src/styles.css` | The default token blocks also match `[data-theme='dark']` and `[data-theme='light']`, so a subtree can be themed. `dark:` follows the nearest themed ancestor. A `.seg--fill` variant for the theme switch. No value changed. |
| `apps/web/src/app/app.ts` | The two-way toggle becomes a three-way switch and a link to the lab; the `theme-lab` view. |
| `apps/web/src/app/store.ts`, `live.ts` | The `theme-lab` view and its address, `/theme-lab`. |
| `apps/web/src/app/echart.ts` | The concept ECharts theme, `chartStyle()`, a scope for `palette()`. |
| `apps/web/src/app/icons.ts` | One icon. |

Nothing under `charts/`, `kassandra/`, `evidence/`, `scope/` or `orb/` is touched, and no component template other than the shell's.

## 13. Follow-ups

1. Replace the literals in components with the tokens, one component at a time, and delete the matching lines from the bridge. The bridge lists them.
2. Move the chart option builders to `chartStyle()` and the theme's font, then drop the CSS override for chart text.
3. Give the default themes the tokens they lack (radius, elevation, focus, motion, type). Then all three themes are mappings of one contract and the bridge is not needed at all.
4. Fix in the default themes what the lab's audit found: the dark field border (1.54:1), the dark focus ring beside a primary button (1.63:1), white on the dark destructive red (3.16:1), and `text-muted-foreground/80` in light (3.73:1).
5. Emit the tokens as a DTCG file from the CSS, so a design tool can read the same source.
6. A dark mapping of the concept (the night scale already holds its surfaces).
