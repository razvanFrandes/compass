# Juyo concept theme: research

Collected 20–21 Nov 2026 for the third Compass theme, `juyo-concept`. The direction and the values that follow from this research are in [juyo-concept-spec.md](juyo-concept-spec.md).

## How to read this

- Every claim comes from a page that was fetched and read, unless it is tagged.
- **[book]** means the source is a printed book with no full text online. The point is taken from the publisher's page, the author's own article, or a third-party summary, and that page is linked.
- **[unverified]** means the page could not be fetched and the point is from memory. Nothing in the spec depends on an unverified point.
- **[measured]** means I measured it myself: font files inspected with fontTools, or colours computed with the WCAG 2 and APCA formulas.
- `m3.material.io` only returns a page title to a fetch (it is a JavaScript app), so the Material 3 facts come from Google's own repositories and developer docs. `polaris-react.shopify.com` now redirects, so Polaris was read from the `Shopify/polaris` repository.

## Summary

1. **Tokens come in three tiers and a theme is a remap of the middle one.** Material 3, Primer, Carbon and Atlassian all separate raw values from roles, and all change themes by giving the same role names new values. No system edits components to make a theme.
2. **A colour scale is only useful if every step has a job.** Radix, Primer and Material's tonal palettes all fix what a step is for, which lets them promise contrast from the step number alone.
3. **Analytics products are dense on purpose.** Carbon's productive type set has a 14px base, Polaris calls its admin "high density by default", and Atlassian reserves its 0–8px spacing range for "compact UI" such as table cells.
4. **Numbers need tabular lining figures, not a monospaced face.** Butterick and Matthew Ström both say so; `font-variant-numeric` does it in a proportional face.
5. **Chart colour is for meaning.** Few, Tufte, Datawrapper and Carbon agree: grey for context, one colour for what matters, a second channel (dash, label, shape) beside colour, direct labels over legends.
6. **WCAG 2.2 AA is the gate; APCA is a useful second reading.** WCAG 3 is still a draft and no longer names APCA, so conformance is still measured with the WCAG 2 ratio.
7. **Productive motion is short.** Carbon and Material both put state changes at about 70–200 ms and tie duration to the distance travelled.
8. **Small dark text on a light surface is read more accurately than the reverse,** and the gap widens as type gets smaller. That argues for a light working surface in a product full of 12–13px figures.

## 1. Design systems: how tokens and themes are structured

### Google Material 3

- Three tiers. "Reference tokens hold concrete values, such as a hex color, pixel size, or font family name." "System tokens define decisions and roles that give the design system its character." "Each component token maps to a system token, which has a concrete reference value." In CSS they are `--md-ref-*`, `--md-sys-color-primary` and `--md-filled-button-container-shape`.
- Every colour role has a partner for content on it: "All tokens have a corresponding `--md-sys-color-on-<token>` for content color with accessible contrast."
- Tonal palettes: five key colours, and "the tonal palette contains 13 tones from black, tone 0, to white, tone 100". Roles pick tones, and the picks differ by theme: primary is tone 40 in light and 80 in dark; surface is neutral 98 in light and neutral 6 in dark.
- Contrast is built into the scale: "A difference of 40 in tone guarantees a WCAG contrast ratio ≥ 3.0" and "a difference of 50 in tone guarantees a contrast ratio ≥ 4.5".
- Type scale: 15 roles, from Display 57/64 down to Label 11/16, with Google's own note that "your product will likely not need all 15 default styles".
- Motion: durations in steps of 50 ms (short 50–200, medium 250–400, long 450–600). The standard curve is `cubic-bezier(0.2, 0, 0, 1)`, for "utility-focused" motion, and "duration should increase as the area/traversal of an animation increases".
- Density: a scale that starts at 0 and steps down by 4px per level. Angular Material notes that "setting the density below 0 can reduce accessibility".
- Elevation: "Material 3 represents elevation mainly using tonal color overlays", not shadow.

Sources: [Material Web theming](https://github.com/material-components/material-web/blob/main/docs/theming/README.md), [MDC-Android Color](https://github.com/material-components/material-components-android/blob/master/docs/theming/Color.md), [MDC-Android Motion](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md), [Compose type scale tokens](https://github.com/androidx/androidx/blob/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/TypeScaleTokens.kt), [material-color-utilities: contrast](https://github.com/material-foundation/material-color-utilities/blob/main/concepts/contrast_for_accessibility.md), [Material 3 in Compose](https://developer.android.com/develop/ui/compose/designsystems/material3), [@material/density](https://cdn.jsdelivr.net/npm/@material/density@14.0.0/README.md), [Angular Material theming](https://github.com/angular/components/blob/main/guides/theming.md).

### Apple Human Interface Guidelines

- macOS, the dense platform, runs on a 13pt body with 16pt line height; iOS uses 17/22. Minimum sizes are 10pt and 11pt.
- Tracking changes with size: positive at small sizes (SF Pro at 10pt is +12/1000 em), negative as type grows (17pt is −26).
- "Avoid Ultralight, Thin, and Light font weights, which can be difficult to see, especially when text is small."
- Colours are named by purpose: "Each dynamic color is semantically defined by its purpose, rather than its appearance or color values." "Avoid hard-coding system color values."
- In dark mode, "the base colors are dimmer, making background interfaces appear to recede, and the elevated colors are brighter".
- Contrast: 4.5:1 minimum, and "for custom foreground and background colors, strive for a contrast ratio of 7:1, especially in small text".
- "Offer visual indicators, like distinct shapes or icons, in addition to color."
- Materials: "Thicker materials… provide better contrast for text and other elements with fine features", and translucent material stays out of the content layer.
- The SF fonts are licensed for Apple-platform mock-ups only, so they are not a choice for a web app.

Sources: HIG [typography](https://developer.apple.com/design/human-interface-guidelines/typography), [color](https://developer.apple.com/design/human-interface-guidelines/color), [dark mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode), [materials](https://developer.apple.com/design/human-interface-guidelines/materials), [accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Apple fonts](https://developer.apple.com/fonts/).

### IBM Carbon

- Four themes, each named for its background: White, Gray 10, Gray 90, Gray 100.
- Layering does the work of elevation. "In the light themes, layers alternate between White and Gray 10." "In the dark themes, layers become one step lighter with each added layer."
- Token names read element, then role, then state (`$background-hover`). The role is constant and the value changes: `$text-secondary` is Gray 70 in one theme and Gray 30 in another.
- The 2x grid: "The basic unit of 2x Grid geometry is the 8-pixel square mini unit." The spacing scale is 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 160.
- Two type sets: "The productive type set uses a base type size of 14px, while the expressive type set uses a base type size of 16px." Productive styles include `body-compact-01` at 14/18 and `label-01` at 12/16 with +0.32px tracking.
- Motion: 70, 110, 150, 240, 400 and 700 ms. The productive standard curve is `cubic-bezier(0.2, 0, 0.38, 0.9)`, entrance `(0, 0, 0.38, 0.9)`, exit `(0.2, 0, 1, 0.9)`. "Productive motion creates a sense of efficiency and responsiveness, while remaining subtle and out of the way."

Sources: Carbon [color](https://carbondesignsystem.com/elements/color/overview/), [spacing](https://carbondesignsystem.com/elements/spacing/overview/), [2x grid](https://carbondesignsystem.com/elements/2x-grid/overview/), [type sets](https://carbondesignsystem.com/elements/typography/type-sets/), [motion](https://carbondesignsystem.com/elements/motion/overview/).

### GitHub Primer

- "Base tokens are the lowest level tokens and map directly to a raw value." "Functional tokens represent global UI patterns." "Component/pattern tokens should only be used in component CSS."
- A hard rule: "Base color tokens don't respect color modes and should never be used directly in code or design."
- Themes are overrides on one name. `fgColor.default` points at neutral 13 in light, neutral 12 in dark and neutral 11 in dark dimmed.
- The neutral scale has stated jobs: "The first six steps… are typically used for background colors"; "Step 8 is considered the minimum contrast value for interactive control borders"; "Step 9 is considered the minimum contrast value for text".
- Control heights are 24, 28, 32, 40 and 48px; radius is 3, 6 and 12.

Sources: Primer [token names](https://primer.style/product/primitives/token-names/), [color usage](https://primer.style/product/getting-started/foundations/color-usage/), [colour primitives](https://primer.style/product/primitives/color/), [size](https://primer.style/primitives/size/), [fgColor.json5](https://github.com/primer/primitives/blob/main/src/tokens/functional/color/fgColor.json5).

### Shopify Polaris

- A 4px base: `space-100` is 4px. Semantic aliases sit on top, such as `space-table-cell-padding` at 6px.
- "The admin is high density by default." "Information-rich interfaces, like index pages or data tables, require high-density layouts for efficiency." "Use divider lines and surface colors to create clear delineation between sections in a high density component."
- Depth is tied to meaning: "The depth of an element should always be related to its importance or interactivity." A bevel on a table is listed as a mistake.
- Motion runs 0–500 ms in steps of 50; avoid "overly elaborate or lengthy animations for simple feedback".

Sources: [polaris-tokens](https://github.com/Shopify/polaris/tree/main/polaris-tokens/src), Polaris [density](https://github.com/Shopify/polaris/blob/main/polaris.shopify.com/content/design/layout/density.mdx), [depth](https://github.com/Shopify/polaris/blob/main/polaris.shopify.com/content/design/depth/index.mdx), [motion](https://github.com/Shopify/polaris/blob/main/polaris.shopify.com/content/design/motion/using-motion.mdx).

### Atlassian Design System

- Names follow foundation.property.modifier: `color.text`, `color.background.neutral.subtle.hovered`, `elevation.surface.raised`.
- Four surfaces (sunken, default, raised, overlay) and two shadows (raised, overlay). A surface is always paired with its shadow. In dark mode "the higher the elevation, the lighter the surface looks". Raised and overlay are used sparingly, and a border or whitespace is preferred for grouping.
- A dedicated type set for numbers: `font.metric` at 16/20, 24/28 and 28/32.
- Body text is 14/20.

Sources: Atlassian [design tokens](https://atlassian.design/foundations/tokens/design-tokens), [elevation](https://atlassian.design/foundations/elevation), [spacing](https://atlassian.design/foundations/spacing), [typography](https://atlassian.design/foundations/typography).

### Radix Colors

- Twelve steps, each with a job: 1 app background, 2 subtle background, 3–5 component backgrounds (rest, hover, active), 6 subtle borders, 7 component borders and focus rings, 8 hovered borders, 9 solid backgrounds, 10 hovered solids, 11 low-contrast text, 12 high-contrast text.
- Steps 11 and 12 "are guaranteed to Lc 60 and Lc 90 APCA contrast ratio on top of a step 2 background".
- Choose the grey "saturated with the hue closest to your accent hue".

Sources: Radix [understanding the scale](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale), [composing a palette](https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette).

### W3C Design Tokens Community Group

- The Format Module 2025.10 is a Final Community Group Report dated 28 October 2025. It is "considered stable" and is not a W3C Standard.
- A token is a JSON object with `$value`, plus `$type`, `$description` and `$extensions`. An alias is written `{group.token}`.
- Types: color, dimension, fontFamily, fontWeight, duration, cubicBezier, number, and the composites strokeStyle, border, transition, shadow, gradient and typography.
- Theming is a separate Resolver Module: sets, modifiers with named contexts, and a resolution order in which "the last occurrence of a token produces the final value". The spec warns that contexts "are susceptible to combinatorial explosion", so modifiers should be kept orthogonal.

Sources: [Format Module 2025.10](https://www.designtokens.org/tr/2025.10/format/), [Resolver Module 2025.10](https://www.designtokens.org/tr/2025.10/resolver/).

## 2. Books and writing

### Refactoring UI (Adam Wathan, Steve Schoger)

- Hierarchy comes from colour and weight before size: two or three text colours and two weights. "Stay away from font weights under 400 for UI work."
- Greys start from a very dark grey, not black. Build a ramp by picking the base, then the darkest and lightest, then filling in. "Trust your eyes, not the numbers."
- "Don't use grey text on coloured backgrounds": take a colour of the background's own hue.
- Before adding a border, try a shadow, a different background or more space.
- Labels are a last resort; on a dashboard keep the label but make it smaller and quieter, because "the data itself is what matters".
- **[book]** Spacing and type scales are picked by hand and constrained in advance: 4, 8, 12, 16, 24, 32, 48, 64 for space; a type scale with no two neighbours too close.

Sources: [Building your color palette](https://www.refactoringui.com/previews/building-your-color-palette), [Labels are a last resort](https://www.refactoringui.com/previews/labels-are-a-last-resort), [7 practical tips for cheating at design](https://medium.com/refactoring-ui/7-practical-tips-for-cheating-at-design-40c736799886) (read through a mirror), third-party [book notes](https://rjseymour66.github.io/webdev/refactoring-ui/).

### Alla Kholmatova, Design Systems

- **[book]** A design system is "a set of interconnected patterns and shared practices".
- **[book]** Functional patterns are the modules of an interface. Perceptual patterns are "descriptive styles that express and communicate the personality of the product visually": colour, type, shape, motion. A theme is a change of perceptual patterns over the same functional ones.
- From her article: "we should start with language, not interfaces". Patterns are named for what they do.

Sources: [Smashing: Design Systems](https://www.smashingmagazine.com/design-systems-book/), [The language of modular design](https://alistapart.com/article/language-of-modular-design/).

### Brad Frost, Atomic Design

- Five levels: atoms, molecules, organisms, templates, pages. Pages are "specific instances of templates" with real content, and they test the system.
- From his blog: "design tokens are subatomic particles". A colour token "is not exactly functional on its own" until an atom uses it.

Sources: [Atomic Design, chapter 2](https://atomicdesign.bradfrost.com/chapter-2/), [Extending atomic design](https://bradfrost.com/blog/post/extending-atomic-design/).

### Every Layout (Heydon Pickering, Andy Bell)

- "The measure should never exceed 60ch", set in `ch` so it follows the font.
- "Margin is really a property of the relationship between two proximate elements": space comes from the layout that holds things, not from each component.
- Layouts are composed from primitives that each do one job, and media queries are "manual overrides".

Sources: Every Layout [axioms](https://every-layout.dev/rudiments/axioms/), [modular scale](https://every-layout.dev/rudiments/modular-scale/), [composition](https://every-layout.dev/rudiments/composition/), [the Stack](https://every-layout.dev/layouts/stack/).

### Matthew Butterick, Practical Typography

- Body text first: 15–25px on screen, line spacing 120–145%, 45–90 characters per line.
- Capitals only for less than a line, and always with 5–12% letterspacing.
- Tabular figures are "essential for one purpose: vertically aligned columns". "In body text, proportional figures are preferred." Lining figures "can be used in any situation".
- In grids of numbers "digits with the same meaning must be vertically aligned". Currency is right-aligned.
- An en dash marks a range.

Sources: [Typography in ten minutes](https://practicaltypography.com/typography-in-ten-minutes.html), [Alternate figures](https://practicaltypography.com/alternate-figures.html), [Grids of numbers](https://practicaltypography.com/grids-of-numbers.html), [Letterspacing](https://practicaltypography.com/letterspacing.html), [Hyphens and dashes](https://practicaltypography.com/hyphens-and-dashes.html).

### Edward Tufte

- **[book]** "Above all else show the data." Maximise the share of ink that carries data and erase the rest.
- **[book]** Grids and labels should recede; direct labels beat a separate legend.
- Small multiples answer "Compared to what?" with panels on identical scales.
- Sparklines, from his own site: "a small intense, simple, word-sized graphic with typographic resolution".

Sources: [Sparkline theory and practice](https://www.edwardtufte.com/notebook/sparkline-theory-and-practice-edward-tufte/), [Data-ink ratio](https://infovis-wiki.net/wiki/Data-Ink_Ratio), [Small multiple](https://en.wikipedia.org/wiki/Small_multiple).

### Stephen Few

- A dashboard is "consolidated and arranged on a single screen so the information can be monitored at a glance".
- Excess precision is a pitfall: $3,848,305.93 where $3.8M would do.
- Colour changes only when meaning changes. "Use soft, natural colors to display most information and bright and/or dark colors to highlight."
- Non-data ink is "just visibly enough to perform [its] role": thin grey axes, usually no borders.
- Avoid red with green: about 10% of men cannot tell them apart.
- The bullet graph: a bar for the measure, a short perpendicular line for the comparison, and at most a few grey ranges behind.

Sources: [Common pitfalls in dashboard design](https://www.perceptualedge.com/articles/Whitepapers/Common_Pitfalls.pdf), [Practical rules for using color in charts](https://www.perceptualedge.com/articles/visual_business_intelligence/rules_for_using_color.pdf), [Bullet graph design specification](https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf).

### IBM Carbon data visualization

- The categorical palette "should be applied in sequence strictly", because the order "is carefully curated to maximize contrast between neighboring colors".
- Sequential palettes are one hue. "In light themes, the darkest color denotes the largest values."
- Two diverging palettes; purple–teal is the one for performance data.
- "When possible, avoid using a legend and label data representations directly."
- "Always start numerical axes at zero" for bars; lines may be cropped.
- The 3:1 rule for chart marks is not stated on Carbon's palette pages. It comes from WCAG 1.4.11 (see below).

Sources: Carbon [color palettes](https://carbondesignsystem.com/data-visualization/color-palettes/), [legends](https://carbondesignsystem.com/data-visualization/legends/), [axes and labels](https://carbondesignsystem.com/data-visualization/axes-and-labels/).

### Datawrapper (Lisa Charlotte Muth) and Observable

- "Consider the color grey as the most important color in Data Vis."
- "If you need more than seven colors in a chart, consider using another chart type."
- "Use light colors for low values and dark colors for high values."
- For a diverging scale "the center color should ideally be a light grey, not white".
- For colour-blind readers: "Get it right in black & white." "Blue is the safest hue." "The only bulletproof solution is to encode your data with a second visual variable."
- On contrast in charts: a gradient that holds 3:1 everywhere "covers only about half the lightness range", and "WCAG was not designed for data visualization".
- Observable Plot defaults to a ten-colour categorical scheme and a diverging scheme with a symmetric pivot at zero.

Sources: [What to consider when choosing colors for data visualization](https://www.datawrapper.de/blog/colors/), [Colors for data vis style guides](https://www.datawrapper.de/blog/colors-for-data-vis-style-guides/), [Colorblindness, part 2](https://www.datawrapper.de/blog/colorblindness-part2/), [Contrast checks for data vis](https://www.datawrapper.de/blog/color-contrast-check-data-vis-wcag-apca/), [Observable Plot scales](https://github.com/observablehq/plot/blob/main/docs/features/scales.md).

### Numbers in tables (Matthew Ström)

- Use tabular lining figures; a monospaced face is only the fallback when a font lacks them.
- Right-align numbers, left-align text, align each header with its column.
- Rules are mostly redundant once the data is aligned; if used, they are light and horizontal.

Sources: [Design better data tables](https://mattstromawn.com/writing/tables/), [MDN: font-variant-numeric](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric).

## 3. Contrast: WCAG 2 and APCA

- WCAG 2 ratio: (L1 + 0.05) / (L2 + 0.05) on relative luminance. There is no rounding, so 4.499 fails.
- SC 1.4.3 (AA): 4.5:1 for text, 3:1 for large text (about 24px, or 18.5px bold).
- SC 1.4.11 (AA): 3:1 against adjacent colours for user-interface components and for "parts of graphics required to understand the content". Chart marks need it against their background, not against each other. A graphic is exempt when the same values are given as text.
- WCAG 2.2: Focus Not Obscured (2.4.11) and a 24px target size (2.5.8) are AA. Focus Appearance (2.4.13: a 2px perimeter at 3:1) is AAA.
- APCA reports a lightness contrast, Lc, from 0 to about 106. Its published levels: Lc 90 preferred for body text, Lc 75 the minimum for columns of body text, Lc 60 for other content text, Lc 45 for large headlines, Lc 30 the floor for any text, Lc 15 the point of invisibility for non-text.
- APCA's case against WCAG 2 is that it "overstates contrast for dark colors".
- Status: WCAG 3 is a Working Draft, and "the contrast algorithm used in WCAG 3 is yet to be determined". APCA was removed from the draft in 2023. Adrian Roselli's advice is to keep conforming to WCAG 2 and document any deviation; Eric Eggert's is that "you cannot rely on APCA for compliance".

Sources: W3C [contrast (minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [focus appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html), [WCAG 3 draft](https://www.w3.org/TR/wcag-3.0/), [APCA in a nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell), [Why APCA](https://git.apcacontrast.com/documentation/WhyAPCA), [Roselli on WCAG 3 contrast](https://adrianroselli.com/2026/04/wcag3-contrast-as-of-april-2026.html), [Eggert: WCAG 3 is not ready yet](https://yatil.net/blog/wcag-3-is-not-ready-yet).

## 4. Light or dark for small figures

Three studies by one group (Piepenbrock, Mayr, Mund and Buchner, Heinrich-Heine-Universität Düsseldorf), read as PubMed abstracts:

- "A positive polarity advantage was found for both age groups. The presentation in positive polarity is recommended for all ages." Positive polarity is dark characters on a light background. The tasks were a visual acuity test and proofreading. ([Ergonomics 2013;56(7):1116–24](https://pubmed.ncbi.nlm.nih.gov/23654206/))
- "The positive polarity advantage linearly increased with decreasing character size." Sizes tested were 8 to 14pt. "Especially with small font sizes, negative polarity displays should be avoided." ([Human Factors 2014;56(5):942–51](https://pubmed.ncbi.nlm.nih.gov/25141597/))
- The proposed cause is brightness: "pupil sizes were smaller and proofreading performance was better with positive than with negative polarity displays". ([Ergonomics 2014;57(11):1670–7](https://pubmed.ncbi.nlm.nih.gov/25135324/))

Limits: the studies used black on white and white on black, and proofreading, not tables. They say nothing about preference, glare in a dark room, or a dimmed dark theme. They support a light surface as the default for small, dense figures; they do not make a dark theme wrong, and Compass keeps one.

## 5. Fonts: what Google Fonts actually ships [measured]

I downloaded the Latin variable file of 47 families from the Google Fonts API and read their tables with fontTools: the variation axes, the OpenType features, and whether the default digits share one width. The finalists were then set in a comp of a Compass screen.

| Family | Axes | Tabular figures | Notes |
|---|---|---|---|
| **Archivo** (Omnibus-Type) | weight 100–900, width 62–125 | `tnum` and `pnum` | Tall x-height (0.526 em). Narrow digits (0.573 em). One file of about 87 KB covers every role. Has a real minus and the euro. No slashed zero. |
| Instrument Sans | weight 400–700, width 75–100 | `tnum`, `pnum` | Elegant and close to Aeonik, but wide: digits are 0.666 em, so labels wrapped in the comp. No weight below 400 or above 700. |
| Mona Sans | weight 200–900, width 75–125 | `tnum`, `pnum` | Tabular zero is slashed, which makes money look like code. Strongly tied to GitHub. |
| Schibsted Grotesk, Radio Canada Big | weight | `tnum` | `tnum` also widens the comma and the full stop, so "1,284,560" breaks apart. |
| Host Grotesk, Hanken Grotesk | weight | tabular by default, no `pnum` | Digits in running text cannot be made proportional. |
| Atkinson Hyperlegible Next | weight 200–800 | `tnum`, `pnum` | Very legible; slashed tabular zero; no width axis. |
| Funnel Display / Funnel Sans | weight 300–800 | tabular by default | Good figures, but a second grotesque beside the text face adds little. |
| Inter (the current face) | weight, optical size 14–32 | `tnum`, `pnum` | The Google Fonts build has no `cv05` or `cv08`. The app's `font-feature-settings: 'cv05', 'cv08'` therefore does nothing. |
| **Chivo Mono** (Omnibus-Type) | weight 100–900 | `tnum`, `pnum` | The mono from Archivo's foundry, with the same grotesque skeleton. About 25 KB. |

Method note: the Google Fonts API returns a stripped static file to old user agents, so the features were read from the variable WOFF2 that a current browser gets.

## 6. Juyo's own brand

The earlier study in [`../ui-refinement/juyo_brand.md`](../ui-refinement/juyo_brand.md) read juyo.ai and the product's public CSS. The points this theme builds on:

- Juyo has two systems that share no tokens: a mostly light marketing site and a dark product.
- They share an ink (#101418), an off-white (#FAFAFA), a violet (#9685E4 in the product), a blue (#477EE3), an orange (#FE7637), a teal and a slate (#4F5E7D).
- The typeface is Aeonik, a commercial grotesque, set at regular and medium weight. Headlines are large and not bold.
- Primary buttons on the marketing site are ink, not violet.
- Shadows are almost absent; depth comes from borders and surface tone.
- In charts, blue is the current period and violet is last year.
- Their public writing argues for "money, not percentages".

## 7. What Compass has today [measured]

Read from `apps/web/src` on this branch, before the theme was added.

- **Colour:** 47 colour tokens per theme, each hand-picked. No scale stands behind them.
- **Type:** 21 distinct font sizes: 20 literals in component templates (10, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 17, 18, 20, 22, 24, 26, 30 and 34px) and one more (10.5px) in `styles.css`.
- **Radius:** 11 distinct pixel values from 1px to 16px, plus full pills.
- **Elevation:** four drop-shadow recipes in `styles.css`, written per class, and more inside components.
- **Focus:** five ring recipes: a 3px glow, a 2px ring, an inset ring, a double ring in the ring colour and a double ring in orange.
- **Motion:** twelve durations between 90 ms and 700 ms for transitions and entrances, on three cubic-bezier curves plus `ease`.
- Only colour, the two font families and one base radius are tokens. Everything else is a literal in a component or in `styles.css`.
- Two contrast failures in the default dark theme, found by the theme lab's audit: the field border on a card is 1.54:1 (needs 3:1), and the focus ring beside a primary button is 1.63:1. White on the dark theme's destructive red is 3.16:1 (needs 4.5:1).

## 8. Principles that transfer to a dense, numeric product for revenue managers

1. **Three tiers, one direction of reference.** Raw values, then roles, then component decisions. A component never reads a raw value. (Material 3, Primer, DTCG)
2. **A theme remaps the semantic tier and nothing else.** (Primer, Carbon, Atlassian)
3. **Name tokens by element, role and state, never by hue.** (Carbon, Primer, Atlassian, Apple)
4. **Give every scale step a job, and let the step carry the contrast promise.** (Radix, Primer, Material's tone gaps)
5. **Tint the grey toward the brand's own dark.** (Radix, Refactoring UI)
6. **Separate layers with tone and a hairline; keep shadow for what floats.** (Carbon layering, Atlassian, Polaris, Refactoring UI)
7. **Dense by default, on a 4px unit, with 44px targets kept on touch.** Controls of 24–36px and table padding of 6–8px are normal for this kind of product. (Polaris, Primer, Atlassian, Carbon)
8. **Build the type scale around 14px, by hand, with few steps.** (Carbon productive, Atlassian, Refactoring UI, Material's own note)
9. **Give metrics their own type style.** (Atlassian `font.metric`)
10. **Tabular lining figures in a proportional face; right-align; state the unit once.** (Butterick, Ström)
11. **No weight under 400, and capitals only for acronyms.** (Apple, Refactoring UI, Butterick)
12. **Round to the decision and show the difference directly.** (Few)
13. **Colour changes only when meaning changes; grey is the workhorse.** (Few, Datawrapper)
14. **Every chart mark is 3:1 or more against its surface, and nothing depends on colour alone.** (WCAG 1.4.11, Apple, Carbon, Datawrapper)
15. **Sequential scales are one hue with falling lightness; diverging scales have a grey centre and avoid red with green.** (Carbon, Datawrapper, Few)
16. **Chart chrome recedes: faint horizontal gridlines, no frame, direct labels.** (Tufte, Few, Carbon)
17. **WCAG 2.2 AA is the gate; APCA is read beside it.** (W3C, Roselli, Eggert)
18. **Motion is short and answers an action: about 70–110 ms for state, up to about 300 ms for a panel.** (Carbon, Material 3, Polaris)
19. **Light surface for small figures, with dark kept as a choice.** (Piepenbrock et al.)

## 9. Gaps

- `m3.material.io` could not be read directly. The dotted token spelling (`md.sys.color.primary`) and the full list of 13 tones are **[unverified]**; the CSS spelling and the tone-to-role mapping were read from Google's repositories.
- Kholmatova's and Tufte's books and parts of Refactoring UI were read through publisher pages and summaries, as tagged.
- Carbon's data-visualisation accessibility page returned 404.
- Juyo's new platform (the one after the public product CSS) could not be inspected, so the brand facts are from the marketing site and the older product.
