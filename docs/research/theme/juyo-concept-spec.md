# Juyo concept theme: direction and specification

Compass's second theme, selected with `data-theme="juyo-concept"`, in a light and a dark mode. Sections 1 to 13 describe the system and its light mode; §14 is the dark mode. The research behind it is in [juyo-concept-research.md](juyo-concept-research.md). The living version of this document is the app's `/theme-lab` view, which reads every value from the rendered CSS and shows the four combinations of theme and mode side by side.

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

The dark rail keeps what was right about this direction. The dark mode of §14 came later and is a different thing: a second column of the same scales under the same roles, chosen by the person or their device, not a second theme with its own rules.

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

- Primitives: `--jc-<scale>-<step>`. Colour scales count up from the surface's end to the text's end, which is light to dark in the light mode; a step is a job, and each scale has a second column for the dark mode (§14.4). Other scales count up from small to large or short to long. Names say what the value is (`--jc-blue-6`, `--jc-duration-2`).
- Semantic: element, then role, then state, never a hue (Carbon, Primer, Atlassian). `--border-control`, `--surface-sunken`, `--elevation-overlay`, `--motion-fast`, `--type-dense-size`, `--radius-container`.
- Component: `--<component>-<property>`: `--button-radius`, `--table-total-rule`, `--chart-line-width`.
- The existing role names are kept as they are (`--background`, `--card`, `--muted-foreground`, `--series`, `--decision` and the rest), even where the grammar would name them differently. Renaming them would mean editing every component, which is the opposite of the point.

### Files

| File | Holds |
|---|---|
| `apps/web/src/themes/juyo-concept/tokens.css` | All three tiers, and the inverse scope for the rail |
| `apps/web/src/themes/juyo-concept/bridge.css` | Maps the literals components still carry onto the tokens |
| `apps/web/src/themes/juyo-concept/index.css` | Imports the two; listed after `styles.css` in `angular.json` |
| `apps/web/src/app/theme.ts` | The theme and mode signals, the lists of both, the storage keys |
| `apps/web/src/app/theme/theme-switcher.ts` | The switch for both, as rows or as a menu (§14.11) |
| `apps/web/src/app/theme-lab/` | The `/theme-lab` view |

### How a theme is selected

`<html data-theme="default | juyo-concept" data-mode="light | dark | system" class="light | dark">`. Theme and mode are two choices (§14.10). The inline script in `index.html` reads both (`localStorage["compass.theme"]`, `localStorage["compass.mode"]`) before the first paint and sets the class to the mode in effect, which is what Spartan's `dark:` variant and every theme's CSS read. `data-theme` with the class also works on any element, which is how the theme lab shows the four combinations side by side; for the default theme a subtree's attribute is the mode's name (`data-theme="light"` or `"dark"`).

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

In a DTCG resolver file, theme (default, juyo-concept) and mode (light, dark) would be two modifiers, with density as a third, independent one. The mode modifier swaps the values of the primitive colour scales and the few roles of §14.5.

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
| `apps/web/src/app/app.ts` | The two-way toggle becomes a three-way switch and a link to the lab; the `theme-lab` view. (Since §14 the switch is `app-theme-switcher`, with theme and mode as two choices.) |
| `apps/web/src/app/store.ts`, `live.ts` | The `theme-lab` view and its address, `/theme-lab`. |
| `apps/web/src/app/echart.ts` | The concept ECharts theme, `chartStyle()`, a scope for `palette()`. |
| `apps/web/src/app/icons.ts` | One icon. |

Nothing under `charts/`, `kassandra/`, `evidence/`, `scope/` or `orb/` is touched, and no component template other than the shell's.

## 13. Follow-ups

1. Replace the literals in components with the tokens, one component at a time, and delete the matching lines from the bridge. The bridge lists them.
2. Move the chart option builders to `chartStyle()` and the theme's font, then drop the CSS override for chart text.
3. Give the default themes the tokens they lack (radius, elevation, focus, motion, type). Then both themes, in both modes, are mappings of one contract and the bridge is not needed at all.
4. Fix in the default themes what the lab's audit found: the dark field border (1.54:1), the dark focus ring beside a primary button (1.63:1), white on the dark destructive red (3.16:1), and `text-muted-foreground/80` in light (3.73:1).
5. Emit the tokens as a DTCG file from the CSS, so a design tool can read the same source.
6. Done: the dark mode, §14. Its follow-ups: the confirm dialog's delete button and the chart builders' `inkOn()` still write a white literal, which the theme cannot reach; `<meta name="theme-color">` is fixed at the default dark canvas; and the default theme could take `data-theme="default"` with the class on a subtree too, so the lab and the catalogue would not need the mode's name as the attribute.
7. The light ochre-6 `#8e670b` is 4.48:1 on a muted fill (ink-3), a hair under the 4.5:1 its step promises on surfaces 0 to 3. Ochre is a chart category and is never set as text, so nothing on screen fails; the step should still be darkened by a point of lightness. `apps/worker/test/web-theme-tokens.test.ts` holds every other step of both columns to its promise and names this exception.

## 14. Dark mode: "Ink ledger"

The concept has two modes. Light is the ledger on paper described above. Dark is the same ledger in ink: the same type, shapes, motion and density, the same three jobs for colour, and a second column of every colour scale. Theme and mode are two separate choices (§14.10), so there are four combinations: Default or Concept, each light or dark. Screenshots of every view in the dark mode are in [screenshots/concept-dark](screenshots/concept-dark/).

### 14.1 The direction

1. **Graphite for work, ink for the frame.** The rail is the same `#101418` in both modes, so the frame does not change when the mode does. The workspace sits one tonal step above it, in a graphite with almost no chroma, and each layer is lighter than the one under it: rail, canvas, card, what floats, fills. Nothing is black and nothing is white.
2. **A second column, not an inversion.** Each scale gets dark values built for the same jobs. Step 5 is still a chart mark at 3:1 or more and step 6 is still text at 4.5:1 or more, so the semantic tier above barely changes: 11 of its 80 colour roles are mapped again, and the other 69 follow their step.
3. **The same three jobs, re-tuned.** Blue is this period’s data, violet is Kassandra, orange is a decision. On graphite each is lighter and, where it covers an area, far less saturated: a tint carries about a quarter of the chroma of the mark of the same hue.
4. **Hairlines carry the layers.** A shadow reads weakly on a dark surface. What floats is one tone lighter than the card under it and takes a stronger hairline; the shadow only seats it.
5. **Type, shape, density and motion are untouched.** Archivo at three widths, Chivo Mono for code, four radii, 110 ms. A mode is a colour decision and nothing else.

### 14.2 What was weighed

- **Reversing the light scales.** The fastest dark mode, and wrong in three places. The light mode’s dark steps are saturated (blue-8 is chroma 0.12): as surfaces they glow. Its lightest neutral (white) would become the text, and pure white on a near-black surface measures 16.4:1, APCA Lc 106, which is the halation range. And the order of surfaces would flip: cards darker than the canvas, popovers darkest of all, which is the opposite of how depth reads in the dark (Material, Carbon: lighter is closer).
- **Pure black.** Rejected: OLED smear on scroll, no room below the canvas for the rail, and nothing left for a shadow to darken.
- **Juyo’s product surfaces for the whole workspace** (the night scale, `#161b22` / `#1f2630` / `#2b343e`, chroma 0.016 to 0.022). They stay where they are, in the rail. As the ground under charts they are visibly blue, and a blue ground makes the blue series, which is the data, the least distinct colour on the page. The workspace neutral is hue 250 at chroma 0.008 to 0.011 for its surfaces: it still leans to Juyo’s ink, and it reads as grey.
- **One tone for the rail and the canvas.** Simpler, and it loses the frame. The rail stays the deepest tone; a 1.05:1 step and one rule separate it from the canvas.
- **Juyo’s blue `#477EE3` unchanged as the series.** It passes on a card (4.17:1) and Juyo’s own dark product draws with it. APCA reads it at Lc 33, half of what the same blue reads on white (Lc 66). The dark step 5 is the same hue one step lighter, `#5d92ef`: 5.31:1 and Lc 42.
- **A paler or a greyer primary button.** The primary action stays ink-12, which is now the light end of the scale: a light button with a graphite label, which is how Juyo’s dark product draws its primary actions. It is the brightest thing on a screen, and a screen has few of them.

### 14.3 Surfaces

Five tones, hand-set in OKLCH at hue 250. The step between neighbours is 1.05 to 1.11 in luminance: small enough to stay calm, and a little wider than the light mode’s steps between white, `#f9fafb` and `#f4f6f8` (1.03 to 1.05), because a small step is harder to see in the dark.

| Layer | Token | Value | OKLCH L / C | Against the layer below |
|---|---|---|---|---|
| Rail (the frame) | `--rail`, `--surface-inverse` | night-1 `#101418` | 0.189 / 0.010 | |
| Canvas | `--background` | ink-2 `#16191c` | 0.212 / 0.008 | 1.05 |
| Card, field | `--card`, `--field` | ink-0 `#1d2024` | 0.243 / 0.009 | 1.08 |
| What floats; a table’s header band | `--popover`, `--table-header-surface` | ink-1 `#22262b` | 0.268 / 0.010 | 1.07 |
| Fill: chips, tracks, code | `--muted`, `--secondary`, `--accent`, `--surface-sunken` | ink-3 `#292e33` | 0.298 / 0.011 | 1.11 (1.19 on a card) |

The step numbers are jobs, as in the light mode, so they are not in order of lightness here: 0 is the raised surface and 2 is the canvas in both modes, and in the dark the raised surface is the lighter of the two. `--surface-sunken` keeps its name and is a lifted fill in the dark; what it promises is “a fill that shows on a card and on the canvas”.

### 14.4 The dark column of each scale

Same method as §4: one hue per scale, lightness and chroma set by hand per step in OKLCH, converted to sRGB. The jobs do not change:

| Step | Job | Contrast on the dark card `#1d2024` |
|---|---|---|
| 1–2 | Tinted surfaces | 1.05–1.24 |
| 3 | Their border | 1.7–1.8 |
| 4 | Soft fills; the fill of a destructive button | 2.7–3.2 |
| 5 | Graphics: lines, bars, icons | 3:1 or more (5.0–5.8) |
| 6 | Text | 4.5:1 or more (7.3–8.1), on the card, the canvas, a fill and the scale’s own tint |
| 7 | Strong text; the light member of a categorical pair | 7:1 or more (11.0–11.7) |
| 8 | The far end | 13.4 or more |

Two decisions shape the column:

- **Steps 6, 7 and 8 are steps 4, 3 and 2 of the light column, value for value.** Light blue-4 `#87b1fa` was already “blue on ink”: the rail’s focus ring. It is now also blue text on graphite. The two modes therefore share half of every hue scale, and a colour seen on the rail is the same colour in the dark workspace.
- **Steps 1 to 5 are new, and their chroma falls with their area.** A mark (step 5) has chroma 0.10 to 0.165 (slate, the drained hue, 0.058). A tint (step 1) has 0.016 to 0.038 at lightness 0.262, two hundredths above the card: enough to say “orange” or “violet” next to a neutral card, not enough to glow. The light mode’s dark steps were not reused: blue-8 `#0f3375` has chroma 0.12.

**ink** (hue 250): 0 raised surface · 1 what floats · 2 canvas · 3 fill · 4 rule, gridline · 5 hairline · 6 card outline · 7 strong divider · 8 control border · 9 quiet icons, the grey series · 10 secondary text · 11 strong secondary, reference lines · 12 text.

| Step | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Hex | `#1d2024` | `#22262b` | `#16191c` | `#292e33` | `#2d3237` | `#33383e` | `#3b4046` | `#4b5057` | `#737a81` | `#8f969d` | `#afb5bc` | `#c9ced3` | `#e5e8ec` |
| L / C | 0.243 / 0.009 | 0.268 / 0.01 | 0.212 / 0.008 | 0.298 / 0.011 | 0.314 / 0.011 | 0.338 / 0.012 | 0.37 / 0.012 | 0.43 / 0.013 | 0.575 / 0.014 | 0.67 / 0.013 | 0.77 / 0.012 | 0.85 / 0.009 | 0.93 / 0.006 |
| On the card | 1.00 | 1.07 | 1.08 | 1.19 | 1.26 | 1.38 | 1.56 | 2.01 | 3.76 | 5.46 | 7.91 | 10.32 | 13.30 |
| On the canvas | 1.08 | 1.16 | 1.00 | 1.29 | 1.36 | 1.49 | 1.69 | 2.17 | 4.06 | 5.90 | 8.54 | 11.14 | 14.36 |

**blue** (hue 261)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Hex | `#1a2537` | `#1e2f4c` | `#29467a` | `#3766b8` | `#5d92ef` | `#87b1fa` | `#c1d9ff` | `#dfecff` |
| L / C | 0.262 / 0.038 | 0.305 / 0.058 | 0.4 / 0.095 | 0.52 / 0.14 | 0.665 / 0.15 | 0.76 / 0.115 | 0.88 / 0.062 | 0.94 / 0.032 |
| On the card | 1.06 | 1.22 | 1.75 | 2.92 | 5.31 | 7.55 | 11.40 | 13.69 |

**violet** (hue 290)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Hex | `#242135` | `#2f2a48` | `#483e74` | `#6959ae` | `#9384e0` | `#b0a6ef` | `#d6d2fc` | `#eae8ff` |
| L / C | 0.262 / 0.036 | 0.305 / 0.054 | 0.4 / 0.09 | 0.52 / 0.13 | 0.665 / 0.135 | 0.76 / 0.105 | 0.88 / 0.058 | 0.94 / 0.03 |
| On the card | 1.05 | 1.20 | 1.73 | 2.83 | 5.15 | 7.43 | 11.28 | 13.61 |

**orange** (hue 45)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Hex | `#312018` | `#42271b` | `#6a3922` | `#a6552d` | `#eb7b44` | `#ff9c6b` | `#ffc8ac` | `#ffe4d6` |
| L / C | 0.262 / 0.03 | 0.305 / 0.046 | 0.4 / 0.078 | 0.54 / 0.12 | 0.7 / 0.155 | 0.79 / 0.14 | 0.88 / 0.08 | 0.94 / 0.04 |
| On the card | 1.05 | 1.20 | 1.73 | 3.08 | 5.80 | 7.96 | 10.99 | 13.49 |

**teal** (hue 196)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Hex | `#162828` | `#173535` | `#185152` | `#197778` | `#33a7a8` | `#64c3c4` | `#b0e3e3` | `#d7f1f1` |
| L / C | 0.262 / 0.024 | 0.305 / 0.036 | 0.4 / 0.058 | 0.52 / 0.082 | 0.665 / 0.1 | 0.76 / 0.09 | 0.88 / 0.052 | 0.94 / 0.028 |
| On the card | 1.07 | 1.24 | 1.82 | 3.08 | 5.63 | 7.90 | 11.63 | 13.81 |

**green** (hue 160)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Hex | `#192820` | `#1c3528` | `#24523c` | `#2d7956` | `#45a678` | `#71c69a` | `#b5e5ca` | `#d9f3e3` |
| L / C | 0.262 / 0.026 | 0.305 / 0.04 | 0.4 / 0.064 | 0.52 / 0.095 | 0.655 / 0.115 | 0.76 / 0.105 | 0.88 / 0.062 | 0.94 / 0.034 |
| On the card | 1.06 | 1.24 | 1.83 | 3.10 | 5.43 | 7.98 | 11.70 | 13.92 |

**red** (hue 25)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Hex | `#331e1c` | `#462422` | `#70312e` | `#ac3c39` | `#e7645e` | `#f4928a` | `#fdc9c4` | `#ffe4e1` |
| L / C | 0.262 / 0.034 | 0.305 / 0.052 | 0.4 / 0.09 | 0.515 / 0.148 | 0.665 / 0.165 | 0.76 / 0.12 | 0.88 / 0.06 | 0.94 / 0.03 |
| On the card | 1.05 | 1.20 | 1.69 | 2.69 | 4.97 | 7.26 | 11.16 | 13.58 |

**ochre** (hue 82)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Hex | `#2b2316` | `#392d16` | `#58441d` | `#89692a` | `#b88e37` | `#dcb05b` | `#f0d39f` | `#f9e9ce` |
| L / C | 0.262 / 0.026 | 0.305 / 0.04 | 0.4 / 0.062 | 0.54 / 0.09 | 0.67 / 0.115 | 0.78 / 0.115 | 0.88 / 0.075 | 0.94 / 0.04 |
| On the card | 1.05 | 1.22 | 1.76 | 3.21 | 5.42 | 8.10 | 11.31 | 13.68 |

**slate** (hue 264)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Hex | `#21252c` | `#292f3b` | `#3e485c` | `#5a6986` | `#8294b8` | `#a4b1cb` | `#d0d8e7` | `#e7ebf3` |
| L / C | 0.262 / 0.016 | 0.305 / 0.024 | 0.4 / 0.036 | 0.52 / 0.05 | 0.665 / 0.058 | 0.76 / 0.04 | 0.88 / 0.022 | 0.94 / 0.012 |
| On the card | 1.06 | 1.22 | 1.78 | 2.96 | 5.35 | 7.58 | 11.41 | 13.68 |

**plum** (hue 345)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Hex | `#2f1f28` | `#402534` | `#663551` | `#9a4879` | `#cf6da7` | `#e196c0` | `#f3cae0` | `#fae4ef` |
| L / C | 0.262 / 0.03 | 0.305 / 0.046 | 0.4 / 0.08 | 0.52 / 0.125 | 0.665 / 0.14 | 0.76 / 0.105 | 0.88 / 0.055 | 0.94 / 0.028 |
| On the card | 1.05 | 1.19 | 1.71 | 2.79 | 4.98 | 7.26 | 11.16 | 13.55 |

Night (`#101418` … `#fafafa`) and the signal orange `#fe7637` are the same in both modes.

### 14.5 Semantic mapping

Every role in §4 keeps its step: `--foreground` is ink-12, `--border` is ink-5, `--series` is blue-5, `--decision` is orange-6, `--kassandra-tint` is violet-1. The values change because the scales have a dark column. Seventeen tokens are mapped again (11 colour roles, the three shadows and the scrim, two component tokens), because in the dark their job needs a different step or a different recipe:

| Role | Light | Dark | Why |
|---|---|---|---|
| `--popover` | ink-0 (the card’s white; the shadow lifts it) | ink-1 `#22262b` | A shadow cannot lift a layer on graphite, so the tone does |
| `--primary-foreground` | ink-0 `#ffffff` | ink-2 `#16191c` | The primary fill is ink-12, now the light end |
| `--destructive-fill` | red-6 `#c02b2f` | red-4 `#ac3c39` | Red text is the light step 6 in the dark, which no label can sit on |
| `--destructive-foreground` | ink-0 `#ffffff` | ink-12 `#e5e8ec` | 4.94:1 on red-4; not pure white |
| `--overlay-hover` / `--overlay-pressed` | ink at 5% / 10% | `#e5e8ec` at 6% / 11% | A hover lightens in the dark |
| `--series-soft` | blue-5 at 60% | the dark blue-5 at 60% | An alpha of the series |
| `--series-muted` | ink-8 `#82888f` (3.58:1, Lc 63) | ink-9 `#8f969d` (5.46:1, Lc 43) | Ink-8 is the control border; as a mark on graphite it would read at Lc 29 |
| `--selection` | blue-5 at 24% | the dark blue-5 at 36% | The text selection |
| `--on-inverse-ring`, `--on-inverse-decision` | blue-4, orange-4 | blue-6, orange-6 | The same two values (`#87b1fa`, `#ff9c6b`): the rail does not change, the step numbers do |
| `--elevation-raised` / `-overlay` / `-modal`, `--scrim` | ink at 4–24% | `rgb(6 8 10)` at 28–70% | §14.9 |
| `--segment-selected-surface` | the card | ink-6 `#3b4046` | A selected segment is lifted out of its track, not sunk into it |
| `--rail-border` | none | ink-4 `#2d3237` | Ink beside graphite is a 1.05:1 step; paper beside ink needed no rule |

`--destructive-fill`, `--destructive-foreground`, `--selection`, `--on-signal`, `--on-inverse-*`, `--segment-selected-surface` and `--rail-border` are new roles in both modes. Each replaces a primitive or a literal that the bridge used to read directly, which only worked while there was one mode.

### 14.6 The three jobs in the dark

| Job | Mark (step 5) | Text (step 6) | Surface and border (steps 1, 3) |
|---|---|---|---|
| This period’s data: blue | `#5d92ef` 5.31:1 | `#87b1fa` 7.55:1 (links, the focus ring) | `#1a2537` / `#29467a` (a selected row) |
| Kassandra: violet | `#9384e0` 5.15:1 | `#b0a6ef` 7.43:1 | `#242135` / `#483e74` (the AI tag) |
| A decision: orange | `#eb7b44` 5.80:1 | `#ff9c6b` 7.96:1 | `#312018` / `#6a3922` (a decision card) |

The one orange action keeps Juyo’s signal `#fe7637` with ink `#101418` on it (6.92:1) in both modes: the fill does not change, so its label does not either. Numbers are still never violet. Ahead is green-6 `#71c69a` and behind is red-6 `#f4928a`, always with a sign and an arrow.

### 14.7 Contrast

Computed as in §4 (WCAG 2, unrounded; APCA 0.0.98G-4g). The theme lab recomputes the pairs in the browser, in the dark pane, from the rendered tokens.

**Text (WCAG 1.4.3, 4.5:1)**

| Pair | Foreground | Surface | WCAG | APCA Lc | Needs | Result |
|---|---|---|---|---|---|---|
| Text on the canvas | `#e5e8ec` ink-12 | `#16191c` ink-2 | 14.36:1 | 92 | 4.5 | pass |
| Text on a card | `#e5e8ec` ink-12 | `#1d2024` ink-0 | 13.30:1 | 91 | 4.5 | pass |
| Text on a popover or a table header | `#e5e8ec` ink-12 | `#22262b` ink-1 | 12.38:1 | 90 | 4.5 | pass |
| Text on a muted fill | `#e5e8ec` ink-12 | `#292e33` ink-3 | 11.15:1 | 88 | 4.5 | pass |
| Secondary text on the canvas | `#afb5bc` ink-10 | `#16191c` ink-2 | 8.54:1 | 61 | 4.5 | pass |
| Secondary text on a card | `#afb5bc` ink-10 | `#1d2024` ink-0 | 7.91:1 | 60 | 4.5 | pass |
| Secondary text on a popover or a table header | `#afb5bc` ink-10 | `#22262b` ink-1 | 7.36:1 | 59 | 4.5 | pass |
| Secondary text on a muted fill | `#afb5bc` ink-10 | `#292e33` ink-3 | 6.63:1 | 57 | 4.5 | pass |
| Primary button label | `#16191c` ink-2 | `#e5e8ec` ink-12 | 14.36:1 | 91 | 4.5 | pass |
| Destructive button label | `#e5e8ec` ink-12 | `#ac3c39` red-4 | 4.94:1 | 69 | 4.5 | pass |
| Destructive text on a card | `#f4928a` red-6 | `#1d2024` ink-0 | 7.26:1 | 56 | 4.5 | pass |
| Link on a card | `#87b1fa` blue-6 | `#1d2024` ink-0 | 7.55:1 | 58 | 4.5 | pass |
| Link on the canvas | `#87b1fa` blue-6 | `#16191c` ink-2 | 8.15:1 | 59 | 4.5 | pass |
| Decision text on its tint | `#ff9c6b` orange-6 | `#312018` orange-1 | 7.57:1 | 60 | 4.5 | pass |
| Decision text on a card | `#ff9c6b` orange-6 | `#1d2024` ink-0 | 7.96:1 | 60 | 4.5 | pass |
| Text on the decision tint | `#e5e8ec` ink-12 | `#312018` orange-1 | 12.65:1 | 90 | 4.5 | pass |
| Secondary text on the decision tint | `#afb5bc` ink-10 | `#312018` orange-1 | 7.52:1 | 59 | 4.5 | pass |
| Decision button: ink on signal orange | `#101418` night-1 | `#fe7637` orange-signal | 6.92:1 | 52 | 4.5 | pass |
| Ahead (positive) on a card | `#71c69a` green-6 | `#1d2024` ink-0 | 7.98:1 | 60 | 4.5 | pass |
| Ahead on the canvas | `#71c69a` green-6 | `#16191c` ink-2 | 8.61:1 | 61 | 4.5 | pass |
| Behind (negative) on a card | `#f4928a` red-6 | `#1d2024` ink-0 | 7.26:1 | 56 | 4.5 | pass |
| Behind on the canvas | `#f4928a` red-6 | `#16191c` ink-2 | 7.84:1 | 57 | 4.5 | pass |
| Failed chip: red on its tint | `#f4928a` red-6 | `#331e1c` red-1 | 6.94:1 | 55 | 4.5 | pass |
| Kassandra tag on its tint | `#b0a6ef` violet-6 | `#242135` violet-1 | 7.10:1 | 56 | 4.5 | pass |
| Kassandra text on a card | `#b0a6ef` violet-6 | `#1d2024` ink-0 | 7.43:1 | 57 | 4.5 | pass |
| Selected row: text on the blue tint | `#e5e8ec` ink-12 | `#1a2537` blue-1 | 12.53:1 | 90 | 4.5 | pass |
| Selected row: secondary text | `#afb5bc` ink-10 | `#1a2537` blue-1 | 7.45:1 | 59 | 4.5 | pass |
| Rail: current item | `#fafafa` night-9 | `#101418` night-1 | 17.72:1 | 104 | 4.5 | pass |
| Rail: other items | `#999fa7` night-7 | `#101418` night-1 | 6.93:1 | 49 | 4.5 | pass |
| Rail: decision count | `#ff9c6b` orange-6 | `#101418` night-1 | 9.00:1 | 62 | 4.5 | pass |
| Rail: selected segment | `#fafafa` night-9 | `#2b343e` night-4 | 12.09:1 | 99 | 4.5 | pass |
| Rail: unselected segment | `#999fa7` night-7 | `#161b22` night-2 | 6.48:1 | 49 | 4.5 | pass |

**Graphics, borders and focus (WCAG 1.4.11, 3:1)**

| Pair | Mark | Surface | WCAG | APCA Lc | Needs | Result |
|---|---|---|---|---|---|---|
| Field border on a card | `#737a81` ink-8 | `#1d2024` ink-0 | 3.76:1 | 29 | 3 | pass |
| Field border on the canvas | `#737a81` ink-8 | `#16191c` ink-2 | 4.06:1 | 30 | 3 | pass |
| Field border on a popover | `#737a81` ink-8 | `#22262b` ink-1 | 3.50:1 | 29 | 3 | pass |
| Field border on a muted fill | `#737a81` ink-8 | `#292e33` ink-3 | 3.15:1 | 27 | 3 | pass |
| Switch, off, on a card | `#737a81` ink-8 | `#1d2024` ink-0 | 3.76:1 | 29 | 3 | pass |
| Focus ring on the canvas | `#87b1fa` blue-6 | `#16191c` ink-2 | 8.15:1 | 59 | 3 | pass |
| Focus ring on a card | `#87b1fa` blue-6 | `#1d2024` ink-0 | 7.55:1 | 58 | 3 | pass |
| Focus ring on a popover | `#87b1fa` blue-6 | `#22262b` ink-1 | 7.03:1 | 57 | 3 | pass |
| Focus ring on a muted fill | `#87b1fa` blue-6 | `#292e33` ink-3 | 6.33:1 | 55 | 3 | pass |
| Focus ring in the rail | `#87b1fa` blue-6 | `#101418` night-1 | 8.54:1 | 59 | 3 | pass |
| Focus ring against a primary button’s fill | `#87b1fa` blue-6 | `#e5e8ec` ink-12 | 1.76:1 | 29 | 3 | gap, see below |
| Series: this period, on a card | `#5d92ef` blue-5 | `#1d2024` ink-0 | 5.31:1 | 42 | 3 | pass |
| Series: this period, on the canvas | `#5d92ef` blue-5 | `#16191c` ink-2 | 5.73:1 | 43 | 3 | pass |
| Series: comparison period | `#8294b8` slate-5 | `#1d2024` ink-0 | 5.35:1 | 42 | 3 | pass |
| Series: reference (budget) | `#c9ced3` ink-11 | `#1d2024` ink-0 | 10.32:1 | 74 | 3 | pass |
| Series: muted | `#8f969d` ink-9 | `#1d2024` ink-0 | 5.46:1 | 43 | 3 | pass |
| Series: third | `#33a7a8` teal-5 | `#1d2024` ink-0 | 5.63:1 | 45 | 3 | pass |
| Decision mark | `#eb7b44` orange-5 | `#1d2024` ink-0 | 5.80:1 | 46 | 3 | pass |
| Negative mark | `#f4928a` red-6 | `#1d2024` ink-0 | 7.26:1 | 56 | 3 | pass |
| Category 1, blue | `#5d92ef` blue-5 | `#1d2024` ink-0 | 5.31:1 | 42 | 3 | pass |
| Category 2, teal | `#b0e3e3` teal-7 | `#1d2024` ink-0 | 11.63:1 | 82 | 3 | pass |
| Category 3, ochre | `#b88e37` ochre-5 | `#1d2024` ink-0 | 5.42:1 | 43 | 3 | pass |
| Category 4, plum | `#f3cae0` plum-7 | `#1d2024` ink-0 | 11.16:1 | 79 | 3 | pass |
| Category 5, green | `#45a678` green-5 | `#1d2024` ink-0 | 5.43:1 | 43 | 3 | pass |
| Category 6, slate | `#d0d8e7` slate-7 | `#1d2024` ink-0 | 11.41:1 | 81 | 3 | pass |
| Sequential step 5 | `#5d92ef` blue-5 | `#1d2024` ink-0 | 5.31:1 | 42 | 3 | pass |
| Sequential step 6 | `#87b1fa` blue-6 | `#1d2024` ink-0 | 7.55:1 | 58 | 3 | pass |
| Sequential step 7 | `#dfecff` blue-8 | `#1d2024` ink-0 | 13.69:1 | 93 | 3 | pass |
| Diverging: far below | `#ff9c6b` orange-6 | `#1d2024` ink-0 | 7.96:1 | 60 | 3 | pass |
| Diverging: far above | `#87b1fa` blue-6 | `#1d2024` ink-0 | 7.55:1 | 58 | 3 | pass |

61 of the 62 pairs pass WCAG 2.2 AA outright, and the last is not a pair that touches. The readings worth knowing:

- **The focus ring against a primary button’s fill is 1.76:1.** The two never touch: the ring is drawn 2px away (`--focus-offset`), so on both of its sides it is read against the surface, where it is 7.55:1 on a card and 8.15:1 on the canvas. A ring that reached 3:1 against both the graphite and the light button would have to sit between them, at about 4:1 on a card, as Juyo’s `#477ee3` does (4.17:1), and would be the weaker ring everywhere else. The lab reports this pair as “gap”, not as a pass, and only for a theme that sets the gap as a token.
- **Body text is Lc 88 to 92, on purpose not more.** APCA advises against going far past Lc 90 for light text on dark. Ink-12 is `#e5e8ec`, lightness 0.93 with a trace of the ink’s hue; white would be Lc 106.
- **Secondary text is Lc 57 to 61, against 73 to 82 in the light mode.** WCAG gives the same pairs 6.6 to 8.5:1, which is the dark-surface overstatement of §4. Ink-10 was set by the APCA reading, not the WCAG one: it is the lightest grey that still leaves a clear step to the text (Lc 60 against 91), and it is a step lighter than the rail’s secondary text (Lc 49), because the workspace carries captions and the rail carries labels.
- **Coloured text is Lc 55 to 61 in the workspace** (6.9 to 8.6:1). It is used for links, deltas with a sign, a tag and a count, never for a paragraph.
- **Chart marks are Lc 42 to 46, against 60 to 71 in the light mode.** This is why the dark blue-5 is lighter than Juyo’s `#477ee3` (Lc 33), and why the grey series moves from ink-8 to ink-9. Going further would bring the series up to the lightness of text.
- **A field border is Lc 27 to 30** (3.15 to 4.06:1), where the light mode has Lc 58 to 63. It passes 1.4.11 on every surface a field sits on. A lighter border would reach the lightness of secondary text and stop reading as a line, so a field also keeps its label above it, as it does today.

### 14.8 Charts

| | Light | Dark |
|---|---|---|
| This period | blue-5 `#477ee3`, 2px | blue-5 `#5d92ef`, 2px |
| Comparison period | slate-5 `#65779d`, dashed 4 3 | slate-5 `#8294b8`, dashed 4 3 |
| Reference (budget) | ink-11 `#394149` | ink-11 `#c9ced3` |
| Gridlines | ink-4 `#e5e8eb` | ink-4 `#2d3237`: 1.26:1 on a card, a rule and not a mark |
| Axis line, labels | ink-7, ink-10 | ink-7 `#4b5057`, ink-10 `#afb5bc` |
| Label printed in a fill | white or ink, whichever reads | the same rule (`inkOn`), so ink on the pale steps |
| Sequential | pale to dark blue: dark is more | graphite-blue to pale blue: light is more |
| Diverging | orange, grey, blue | the same, with the midpoint at the fill tone ink-3 |

Categories keep their order and their alternation of a mid step and a far step, so neighbours still differ by 2:1 or more in luminance:

| | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Colour | blue-5 `#5d92ef` | teal-7 `#b0e3e3` | ochre-5 `#b88e37` | plum-7 `#f3cae0` | green-5 `#45a678` | slate-7 `#d0d8e7` |
| On a card | 5.31 | 11.63 | 5.42 | 11.16 | 5.43 | 11.41 |
| APCA Lc | 42 | 82 | 43 | 79 | 43 | 81 |
| Against the next | 2.19 | 2.15 | 2.06 | 2.05 | 2.10 | |

The far steps are pale in the dark where they were deep in the light. By APCA they are quieter than their light counterparts, not louder (Lc 79 to 82 against 88 to 91), and at chroma 0.05 to 0.06 they are tints, not colours at full strength. A sequential ramp still cannot hold 3:1 at every step: steps 1 to 4 are below 3:1 on a card in both modes, and a heat map prints its value in each cell.

In `echart.ts` the concept theme registers one ECharts theme per mode (`compass-juyo-concept` and `compass-juyo-concept-dark`), each built from the tokens the first time its mode is used. `palette()`, `chartStyle()` and the widget charts’ `readTokens()` read the tokens in effect, so a chart redraws in the new colours when the mode changes and no chart code names a mode.

### 14.9 Elevation, borders, focus

| | Light | Dark |
|---|---|---|
| Card at rest | white on `#f4f6f8`, outline ink-6 | `#1d2024` on `#16191c`, outline ink-6 `#3b4046` (1.69:1 on the canvas) |
| Raised | `0 1px 2px` ink at 7%, `0 1px 1px` ink at 4% | `0 1px 2px rgb(6 8 10 / 0.4), 0 1px 1px rgb(6 8 10 / 0.28)` |
| Overlay | ink at 14% and 8% | `0 8px 20px -4px rgb(6 8 10 / 0.55), 0 2px 6px -2px rgb(6 8 10 / 0.4)`, on a surface one tone lighter, with a strong hairline (ink-7) |
| Modal | ink at 24% and 12% | `0 24px 56px -12px rgb(6 8 10 / 0.7), 0 8px 16px -8px rgb(6 8 10 / 0.5)` |
| Scrim | ink at 45% | `rgb(6 8 10 / 0.62)` |

Shadows are still two-part and tinted with ink. They are stronger because a dark surface hides them, and they are no longer what tells a popover from a card: the tone and the hairline do. The three borders keep their jobs: hairline ink-5 (1.38:1 on a card), strong ink-7 (2.01:1), control ink-8 (3.76:1).

The focus ring is the same recipe, `2px solid var(--ring)` with a 2px gap, in blue-6 `#87b1fa`: the colour the rail’s ring has always had, so there is one ring on every dark surface of the product.

### 14.10 Theme and mode

Two independent choices, each remembered:

| Choice | Values | Stored in | On `<html>` |
|---|---|---|---|
| Theme | `default`, `juyo-concept` | `localStorage["compass.theme"]` | `data-theme` |
| Mode | `light`, `dark`, `system` | `localStorage["compass.mode"]` | `data-mode` (the choice), and the class `.light` or `.dark` (the mode in effect) |

- **The class is what CSS reads.** It is the class Spartan and Tailwind’s `dark:` variant already read, and the default themes already switch on it (`:root.light`). The concept’s dark mode is therefore one more selector, `[data-theme='juyo-concept'].dark`, and a themed subtree works the same way as the page: the theme lab’s dark pane is `<div class="dark" data-theme="juyo-concept">`.
- **System follows `prefers-color-scheme` and keeps following it.** What is stored is “system”, never the mode it resolved to. A first visit is the default theme in system mode, which is what the app did before; with no answer from the device it is dark.
- **Before the first paint**, the inline script in `index.html` reads the two values and sets the attribute, the choice and the class, so no combination flashes another. `theme.ts` applies the same rules afterwards and listens to the device.
- **Old values still work.** `compass.theme` used to hold one of `light`, `dark`, `juyo-concept`. They read as default light, default dark and concept light (the concept was a light theme), and the service rewrites them once as two values. `choiceFrom()` in `theme.ts` and the inline script hold the same rules; `theme.spec.ts` tests the first and `apps/worker/test/web-theme-script.test.ts` runs the second.
- A dark block may only set tokens that the light block declares. A light pane nested in a dark page then gets every value back, which is how the lab and the chart catalogue show the four combinations at once.

### 14.11 The switcher

`src/app/theme/theme-switcher.ts`, selector `app-theme-switcher`. It injects `Theme`, brings its own icons and takes its colours from where it sits, so it needs nothing from the shell.

| Input | Values | |
|---|---|---|
| `variant` | `rows` (default), `menu` | `rows`: two labelled segmented controls, Theme (Default, Concept) and Mode (Light, Dark, System as icons with tooltips), 60px tall together, for the expanded sidebar’s footer. `menu`: one icon button that opens the same two choices as a menu, for a collapsed rail or a phone’s header |
| `side`, `align` | the menu’s side and alignment | Where the menu opens: `side="right"` for a collapsed rail |

Each group in `rows` is a `radiogroup` with one tab stop and arrow keys; the menu is a CDK menu of `menuitemradio`. The button’s name says the state: “Theme: Concept, system (dark). Change theme or mode”.

`Theme` (`src/app/theme.ts`): `id()` the theme, `mode()` the choice, `scheme()` the mode in effect, `dark()`, `set(theme)`, `setMode(mode)`.

### 14.12 What changed in the code

| File | Change |
|---|---|
| `themes/juyo-concept/tokens.css` | The dark block: the dark column of 10 scales and the 17 tokens of §14.5. Eight new roles in the light block |
| `themes/juyo-concept/bridge.css` | Six rules read a role where they read a primitive or a literal (selection, the decision button’s label, the selected segment, the rail’s border, the destructive button, the switch’s thumb) |
| `app/theme.ts`, `app/theme.spec.ts` | Theme and mode as two signals, the system mode, the migration |
| `app/theme/theme-switcher.ts` | The switcher, in the rail’s footer and the phone header |
| `index.html`, `public/_headers` | The pre-paint script for two choices, and its new hash in the Content-Security-Policy |
| `app/echart.ts` | One ECharts theme per mode of the concept |
| `app/theme-lab/` | Four panes, a switch for which of them show, “gap” in the contrast audit, five more pairs |
| `app/charts/catalog.ts` | “Concept dark” as a preview; side by side shows all four |
| `apps/worker/test/web-theme-script.test.ts` | Runs the inline script against the same cases as `theme.spec.ts` |
| `apps/worker/test/web-theme-tokens.test.ts` | Reads `tokens.css`: the dark block sets only tokens the light block declares, both columns are complete, and the pairs of §14.7 hold their ratios |

No component under `charts/`, `kassandra/`, `evidence/`, `scope/`, `studio/`, `builder/` or `orb/` changed for the dark mode: they read roles, and the roles have a dark value.
