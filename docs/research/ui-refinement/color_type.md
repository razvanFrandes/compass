# Compass: color and typography directions

Research date: 2026-11-20. Scope: color systems, data-viz palettes and type for a premium hospitality analytics demo (Compass, Juyo take-home).

How to read this:
- **[S]** means a published source says it (link beside it).
- **[3P]** means a third-party reconstruction or blog, not the company itself. Treat it as unverified.
- **[P]** means it is my proposal or inference.
- I computed every contrast ratio below myself. The script converts OKLCH to sRGB using Björn Ottosson's OKLab matrices, then applies the WCAG 2.x relative-luminance formula.
- Hex values are the gamut-mapped sRGB equivalents.

---

## 0. TL;DR

1. **The current graphite + brass direction fits where the field is going.** Linear's March 2026 refresh moved from cool blue-grays to "a warmer gray that still feels crisp, but less saturated". It also dimmed chrome and softened borders. [S] [Linear: behind the latest design refresh](https://linear.app/now/behind-the-latest-design-refresh), [Linear changelog 2026-03-12](https://linear.app/changelog/2026-03-12-ui-refresh). Radix pairs its yellow-tinted `sand` gray with amber, yellow, orange and brown, which is the same pairing logic as warm graphite with brass. [S] [Radix: composing a palette](https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette)
2. **Your green/red has a real problem.** The positive and negative tokens sit at the same lightness (L≈0.50–0.53). Red-green colorblind readers see them as "two shades of olive or orange" [S] ([Datawrapper, colorblindness pt 2](https://www.datawrapper.de/blog/colorblindness-part2)). Fix it with:
   - a sign plus an arrow glyph on every delta (this is mandatory);
   - lightness separation in chart fills;
   - optionally, a blue/orange "CVD-safe" semantic pair. Direction C uses that pair by default.
3. **Type: keep Geist for UI with `tabular-nums` on every number. Don't adopt Raleway for UI.** Raleway's default figures are old-style, so numbers in tables and KPIs go ragged unless you turn on `lnum`. [S] [Medium: what's wrong with Raleway](https://medium.com/newsbrewer-app/662e1e7bc7f7), [CTAN Raleway doc](https://ctan.org/tex-archive/fonts/raleway). Juyo's "Aeonic" is almost certainly **Aeonik** by CoType Foundry, a commercial font (see §3.4). Juyo's current marketing site (juyo.ai) loads Aeonik Regular and Medium.
4. **Recommendation [P]:** ship **B (refined graphite + brass)** as the default. Optionally show **A (Juyo-aligned)** as a theme switch to show you can work in their brand. Keep **C** as the fallback if the reviewers find brass too "luxury hotel" for a B2B analytics tool.

---

## 1. How leading data/fintech products handle color

| Product | Neutrals | Accents | Semantic / notes | Source |
|---|---|---|---|---|
| **Linear** | Moved from cool, blue-ish grays to warmer, less saturated grays in 2026, avoiding "muddy". The theme is generated in LCH from three inputs: base, accent, contrast. | One accent, with its bleed into neutrals deliberately limited. | A contrast variable drives high-contrast themes. Fewer borders, softer contrast, dimmer sidebar. | [S] [2024 redesign](https://linear.app/now/how-we-redesigned-the-linear-ui), [2026 refresh](https://linear.app/now/behind-the-latest-design-refresh) |
| **Vercel Geist** | `gray` plus `gray-alpha` scales, 10 steps each (100–1000), and two background tokens. | Scales for blue, red, amber, green, teal, purple and pink. Uses P3 on capable displays. | The step roles are fixed: 100–300 backgrounds, 400–600 borders, 700–800 high-contrast fills, 900 secondary text, 1000 primary text. | [S] [vercel.com/geist/colors](https://vercel.com/geist/colors) |
| **Radix Colors** | Six grays, each tinted toward a hue family: gray, mauve, slate, sage, olive, sand. | The rule is to "choose the gray scale which is saturated with the hue closest to your accent hue". | 12-step scale. Step 11 is guaranteed APCA Lc 60 and step 12 Lc 90 on step 2. Steps 9–10 of amber and yellow are meant to carry dark text. | [S] [Understanding the scale](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale), [Composing](https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette) |
| **Stripe** | n/a | The palette was built in CIELAB so every hue has a similar contrast curve. | Default text colors pass WCAG on white. Any two colors **≥5 levels apart** pass for small text, and ≥4 levels pass for icons and large text. | [S] [Stripe: accessible color systems](https://stripe.com/blog/accessible-color-systems) |
| **Mercury** | Light, restrained. | A single indigo/purple accent, reported as #5266eb. Custom Arcadia / Arcadia Display type. | Unverified. | [3P] [blakecrosley.com](https://blakecrosley.com/guides/design/mercury), [shadcn.io/design/mercury](https://www.shadcn.io/design/mercury/raw) |
| **Ramp** | Warm. | A single "solar yellow" accent (reported #ffe74c). Uses TWK Lausanne. | Third-party sources say ss01 is used for numerals. | [S/3P] [Fonts In Use: Ramp 2023](https://fontsinuse.com/uses/56961/ramp-2023-campaign), [shadcn.io/design/ramp](https://www.shadcn.io/design/ramp/raw) |
| **Mews** (hospitality PMS) | Black and white. | A hot-pink brand accent after the Koto rebrand. Type is Söhne. | Product UI got "more vibrant colors" and improved contrast in 2022. | [S] [Creative Boom on Koto/Mews](https://www.creativeboom.com/news/koto-just-proved-that-design-for-enterprise-platforms-doesnt-have-to-be-beige/), [Mews release notes](https://releases.mews.com/en/seen-our-fresh-new-look-more-vibrant-colors-and-simpler-more-consistent-icons) |

**I did not verify** Attio, Hex, Lighthouse, or Tableau's newest product UI. My searches found no first-party color documentation for them, so I'm making no claims about them.

**Patterns [P], drawn from the table above:**
- **Neutrals.** They are tinted toward the accent hue, never pure gray (Radix rule). The trend is moving warm (Linear 2026).
- **Accents.** Premium products use **one** brand accent: Linear, Mercury, Ramp and Mews all do. Everything else is neutral plus semantic colors.
- **Scales.** They have fixed step roles, so a token's job is predictable (Geist and Radix). Contrast is guaranteed by step distance (Stripe, Radix).
- **Dark mode.** It is generated, not hand-picked. Linear generates it from base, accent and contrast. Geist and Radix ship parallel scales. Hues get lighter and slightly less saturated on dark surfaces.

---

## 2. Data-viz palettes and accessibility rules

### 2.1 Requirements (WCAG 2.2)
- **Chart text** (axis labels, values, legends) is text, so it needs 4.5:1 (or 3:1 if large) under SC 1.4.3. [S] [W3C 1.4.11 Understanding](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- **Graphical parts** needed to understand a chart (lines, bars) need **≥3:1 against adjacent colors**, and this is a hard threshold: 2.999 fails. Lines don't need to contrast with each other if they rarely overlap. Thin lines anti-alias lighter, so exceed the minimum. A graphic is exempt if the same information is given as conforming text (labels or values). [S] same source
- **Input borders** are UI components, so they also need 3:1. Decorative card borders don't. [S] same source

### 2.2 Reference palettes (published values)
- **IBM Carbon categorical, light theme, in this exact order:**
  - #6929c4, #1192e8, #005d5d, #9f1853, #fa4d56, #570408, #198038
  - #002d9c, #ee538b, #b28600, #009d9a, #012749, #8a3800, #a56eff
  - Carbon also ships monochrome groups for small, predictable category counts, and sequential palettes (darkest = largest value in light themes; lightest = largest in dark).
  - Diverging: red–cyan for hot/cold data, purple–teal for **performance or sales**. Diverging palettes don't change between themes.
  - Status colors: red #da1e28, orange #ff832b, yellow #f1c21b, green #198038.
  - [S] [Carbon: color palettes](https://carbondesignsystem.com/data-visualization/color-palettes/)
- **Tableau 10** (as shipped in d3): #4e79a7 #f28e2c #e15759 #76b7b2 #59a14f #edc949 #af7aa1 #ff9da7 #9c755f #bab0ab. [S] [d3-scale-chromatic Tableau10.js](https://github.com/d3/d3-scale-chromatic/blob/main/src/categorical/Tableau10.js), [d3 docs](https://d3js.org/d3-scale-chromatic/categorical)
- **Observable 10:** #4269d0 #efb118 #ff725c #6cc5b0 #3ca951 #ff8ab7 #a463f2 #97bbf5 #9c6b4e #9498a0. [S] [observable10.js](https://github.com/d3/d3-scale-chromatic/blob/main/src/categorical/observable10.js)
- **Okabe–Ito** (CVD-safe; also called the Wong palette): #E69F00 #56B4E9 #009E73 #F0E442 #0072B2 #D55E00 #CC79A7 #000000. [S] [ggokabeito](https://rdrr.io/github/malcolmbarrett/ggokabeito/man/palette_okabe_ito.html), [colorblindr source](https://rdrr.io/github/clauswilke/colorblindr/src/R/palettes.R)
- **Atlassian** applies chart colors through design tokens. It recommends its predefined categorical tokens over custom schemes for accessibility. I didn't retrieve exact values. [S] [Atlassian data-viz color](https://atlassian.design/foundations/color/data-visualization-color)

### 2.3 Datawrapper / Lisa Charlotte Muth guidance (most applicable)
- "Gray is the most important color in data vis." Grey out context and color only the highlight. [S] [Datawrapper: colorguide](https://www.datawrapper.de/blog/colorguide)
- Green can be combined neither with red/orange nor with blue **of the same lightness**. "Blue is the safest hue." Blue pairs safely with orange or red. "You can use any colors you like as long as they vary by lightness." [S] [Colorblindness pt 2](https://www.datawrapper.de/blog/colorblindness-part2)
- For good/bad, **double-encode** with symbols, and make the two colors differ in lightness. "The only bulletproof solution is to encode your data with a second visual variable." Use direct labels instead of legends. [S] same
- For diverging maps, avoid red–green, orange–green, blue–green and yellow–pink. [S] [Datawrapper colorblind check](https://www.datawrapper.de/blog/colorblind-check)

### 2.4 What this means for Compass [P]
- **Default chart treatment:**
  - "This period" in ink/graphite.
  - "Last year / comp set" in muted gray, dashed.
  - The one series the user should act on in the accent.
  - This is Datawrapper's gray-plus-highlight rule, and it suits a revenue dashboard that mostly compares against last year or a budget.
- **Categories** (segments, channels): cap them at 4–5 series. Beyond that, use Carbon or Observable order with direct labels.
- **Pickup/variance heat maps:** use a diverging palette with a neutral midpoint. Carbon's purple–teal performance palette is a sourced option, or use the blue–orange pair from Direction C.
- **Deltas:** "▲ +4.2 pts" / "▼ −1.8 pts" with `tabular-nums`. Color is a third encoding, never the only one.

---

## 3. Typography for dense numeric UI

### 3.1 Candidates
| Face | License | Numeric features | Notes |
|---|---|---|---|
| **Inter 4.x** | SIL OFL 1.1 | `tnum`, `zero`, `ss01` (open digits), `cv01`–`cv04`/`cv09` digit alternates, `case` | It has a text-to-display optical-size range, and Linear uses Inter Display for headings with Inter for everything else. [S] [rsms.me/inter](https://rsms.me/inter/), [Linear](https://linear.app/now/how-we-redesigned-the-linear-ui). |
| **Geist / Geist Mono** | SIL OFL 1.1 | `tnum` (current choice) | The README describes Geist Sans as designed for headlines and large display sizes, and Geist Mono for code, diagrams and terminals. There is now also a **Geist Serif**. [S] [vercel/geist-font](https://github.com/vercel/geist-font). An earlier note in this repo records that it has no slashed zero and is "display-first" (see `docs/research/notes/.../themes_tokens_charts_motion.md`). |
| **Söhne** (Klim) | Commercial | n/a | Used by Mews. [S] [Creative Boom](https://www.creativeboom.com/news/koto-just-proved-that-design-for-enterprise-platforms-doesnt-have-to-be-beige/) |
| **TWK Lausanne** | Commercial | n/a | Used by Ramp. [S] [Fonts In Use](https://fontsinuse.com/uses/56961/ramp-2023-campaign) |
| **IBM Plex Sans / Mono, Untitled Sans, SF Pro** | n/a | n/a | I did not re-verify these in this pass. Plex is OFL and is Carbon's face; I'm stating that from general knowledge, not a fetched source. |

### 3.2 Numeric rules
- Use `font-variant-numeric: tabular-nums lining-nums` (OpenType `tnum`/`lnum`) on every table cell, KPI and axis. Add `slashed-zero` only for IDs and codes. These only work if the font ships the features. [S] [MDN font-variant-numeric](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric)
- Right-align numeric columns and keep units in the header, not in cells [P].

### 3.3 Sizes and mobile
- **Form controls on mobile must render at ≥16px.** Below that, iOS Safari zooms on focus. Don't use `user-scalable=no`, which Safari ignores and which hurts accessibility. A common guard is `input, select, textarea { font-size: max(16px, 1em) }`. [S] [CSS-Tricks](https://css-tricks.com/?p=339455), [Rick Strahl](https://weblog.west-wind.com/posts/2023/Apr/17/Preventing-iOS-Textbox-Auto-Zooming-and-ViewPort-Sizing), [dev.to micro-tip](https://dev.to/danburzo/css-micro-tip-make-mobile-safari-not-have-to-zoom-into-inputs-1fc1)
- **Proposed scale [P]** for a dense dashboard (rem at a 16px root):
  - 12 caption / axis
  - 13 table, desktop
  - 14 body, desktop
  - 16 body, mobile, and all inputs
  - 18 section title
  - 24 page title
  - 32–40 hero KPI figure
- Line-height: 1.4 for body, 1.2 for headings, 1.0–1.1 for KPI numerals. Use negative tracking (about −0.02em) only at 24px and above.

### 3.4 Juyo's fonts
- **"Aeonic" is Aeonik**, a sans by **CoType Foundry** in London, designed by Mark Bloom and Joe Leadbeater. It was first released in 2018 and expanded in 2020, with seven weights plus italics. It blends neo-grotesque and geometric traits. It is **commercial**: buy it from CoType, or get it through Adobe Fonts or Monotype per Typewolf. Similar faces are NB International and Surt, and the closest paid match on Adobe Fonts is Neue Haas Grotesk. Variants include Aeonik Pro, Mono/Fono and Soft. [S] [Typewolf: Aeonik](https://www.typewolf.com/aeonik), [type-01 on Aeonik Mono/Fono](https://type-01.com/the-new-fonts-from-cotype-aeonik-mono-fono/), [The Brand Identity: Aeonik Pro](https://the-brandidentity.com/feed/cotype-foundry-launches-aeonik-pro-alongside-set-museum-inspired-specimen-books/). I didn't read CoType's EULA (cotype.xyz refused the TLS handshake), so **don't self-host Aeonik in the demo without a license.**
- **What juyo.ai serves today:** I inspected the HTML on 2026-11-20. It loads two font files, `Aeonik_Regular` and `Aeonik_Medium`, with a `system-ui` fallback. I found no Inter. The most common literal color was **#9D8DF1** (a lavender, 77 occurrences). That color is **2.79:1 on white, so it fails as a text or button-label color**, and 7.51:1 with black text. Treat this as a hint for the other agent's extraction, not as a confirmed brand spec. Their in-product app (per `JUYO_CONTEXT.md`) uses Bootstrap 5.3 with Raleway, Aeonic and Open Sans.
- **Raleway for UI:** it is elegant at display sizes, but its numerals default to old-style. Some sources disagree on whether its tabular support is clean. That makes it a poor fit for numbers. [S] [Medium](https://medium.com/newsbrewer-app/662e1e7bc7f7), [CTAN](https://ctan.org/tex-archive/fonts/raleway). Open Sans is a serviceable humanist UI face but is dated next to Inter or Geist [P].

---

## 4. Premium hospitality cues

Official brand specs for these properties are mostly behind brand portals, so treat any hex values as unverified.

- **Aman.**
  - The wordmark is custom lettering (plain, widely tracked capitals).
  - The palette is earthy: "sand, soil and clay" (2016 Construct identity).
  - One third-party system extract says "there is no primary brand color".
  - [S/3P] [BP&O: Branding Aman](https://bpando.org/2016/02/16/branding-aman/), [Colville Walker](https://creativepool.com/colville-walker/projects/aman-brand-identity-evolution-for-aman), [shadcn.io/design/aman](https://www.shadcn.io/design/aman/raw)
- **Six Senses.**
  - Uniform rebrand reporting describes an "olive, pebble and pearl white" palette.
  - The logo pairs a brush-mark pyramid with all-caps Canto.
  - Official assets are on a gated brand portal.
  - [S] [Spa Business](https://www.spabusiness.com/wellness-products-and-services/Fashionizer-creates-spa-uniforms-for-Six-Senses/310256), [Fonts In Use](https://www.fontsinuse.com/uses/36800/six-senses), [brand.sixsenses.com](https://brand.sixsenses.com/sixsenses/marketing-assets?locale=nn)
- **Marriott Bonvoy.**
  - The type system is a sans + serif pair: Swiss 721 + Aldine (Mother Design).
  - Instrument built the component system for web and native.
  - A third-party extract reports a near-black #1c1c1c and a coral #ff8d6b.
  - [S/3P] [Mother Design](https://motherdesign.com/work/marriott-bonvoy), [Instrument](https://Instrument.com/work/marriott), [shadcn.io/design/marriott](https://www.shadcn.io/design/marriott)
- **Mews** (operator software, closest to Juyo's world): it rebranded away from "beige enterprise" to black, white and hot pink with Söhne. [S] [Creative Boom](https://www.creativeboom.com/news/koto-just-proved-that-design-for-enterprise-platforms-doesnt-have-to-be-beige/)
- **Cloudbeds:** not researched, no claims.

**Synthesis [P]:**
- Luxury hospitality signals premium through **restraint**: near-neutral, material-derived palettes (stone, sand, olive, ink), a lot of space, few or no saturated colors, and often a quiet serif or widely tracked capitals at display sizes only.
- Operator software (Mews) does the opposite: one loud accent.
- For an analytics tool sold to hotel operators, the credible middle is a material-neutral base with **one** accent that carries meaning. Use a serif at most for the page title or property name, never in data.
- To avoid the "template" look, don't use default shadcn zinc + blue (the current `styles.css` "LIT" theme is exactly that: hue 262 blue on 286 zinc). Don't use gold gradients, and don't use script or Didone faces.

---

## 5. Three directions (light and dark tokens, contrast-checked)

Columns: OKLCH, hex, and contrast against `background` / `surface`. `text`, `muted`, `primary`, `accent-text` and the semantic tokens must reach ≥4.5. `chart-*` and `input-border` must reach ≥3.0. `border` is decorative, so it is exempt. Every value listed passes its target.

### A. "Juyo-aligned": cool ink + lavender
Rationale:
- It follows juyo.ai's observed lavender (#9D8DF1) and its geometric-grotesque type (Aeonik).
- Neutrals are tinted toward the accent hue, following Radix's rule (mauve pairs with violet).
- When the other agent's extraction lands, replace hue 285–290 and keep the L/C structure.

| token | light | hex | vs bg / surface | dark | hex | vs bg / surface |
|---|---|---|---|---|---|---|
| background | oklch(0.985 0.004 285) | #fafafd | n/a | oklch(0.17 0.015 285) | #0f0f16 | n/a |
| surface | oklch(1 0 0) | #ffffff | n/a | oklch(0.21 0.018 285) | #171720 | n/a |
| text | oklch(0.21 0.02 280) | #161721 | 17.0 / 17.8 | oklch(0.95 0.008 285) | #eeeef4 | 16.5 / 15.3 |
| muted-fg | oklch(0.50 0.025 280) | #606272 | 5.8 / 6.0 | oklch(0.72 0.02 285) | #a3a3b1 | 7.7 / 7.1 |
| border | oklch(0.91 0.008 285) | #e0e1e6 | decorative | oklch(0.30 0.02 285) | #2d2d38 | decorative |
| input-border | oklch(0.64 0.015 285) | #8b8b95 | – / 3.4 | oklch(0.52 0.02 285) | #676874 | – / 3.2 |
| primary | oklch(0.50 0.19 285) | #5e48c8 | 6.2 / 6.5 (white on it 6.5) | oklch(0.72 0.13 290) | #a495f0 | 7.4 / 6.9 (use bg-colored text on it, 7.4) |
| accent (fill) | oklch(0.72 0.13 290) | #a495f0 | **dark text only** (6.9; white 2.6 fails) | same | | |
| accent-text | oklch(0.48 0.16 290) | #6047b0 | 6.7 / 7.0 | oklch(0.78 0.11 290) | #b6abf9 | 9.3 / 8.6 |
| positive | oklch(0.50 0.11 160) | #0b764d | 5.4 / 5.7 | oklch(0.75 0.13 160) | #57c791 | 9.1 / 8.4 |
| negative | oklch(0.53 0.19 27) | #c22826 | 5.6 / 5.8 | oklch(0.71 0.16 25) | #f5746d | 6.9 / 6.4 |
| warning | oklch(0.55 0.12 65) | #a0600b | 4.8 / 5.0 | oklch(0.80 0.12 75) | #ebb25f | 10.1 / 9.4 |
| chart-1 (focus) | = primary | #5e48c8 | 6.2 | = dark primary | #a495f0 | 7.4 |
| chart-2 | oklch(0.60 0.10 205) | #0f919c | 3.6 | oklch(0.78 0.10 200) | #5dcbd1 | 9.9 |
| chart-3 | oklch(0.62 0.14 60) | #c26e12 | 3.6 | oklch(0.76 0.13 65) | #e99f50 | 8.7 |
| chart-4 (comparison) | oklch(0.55 0.03 280) | #6e7083 | 4.7 | oklch(0.60 0.02 285) | #7f7f8c | 4.8 |

- **Type:** Inter (text) + Inter Display (≥24px), with `tnum`. Inter is a free stand-in that sits close to Aeonik's neo-grotesque feel; the Inter-Aeonik similarity is my judgement. Use Aeonik for the logo or headings only if licensed.
- **Risk [P]:** lavender reads "SaaS", not "hospitality". It's also close to Mercury's indigo and the generic AI-product violet.

### B. "Graphite & Brass", refined (recommended)
Rationale:
- Warm, low-chroma neutrals (hue 70–85, C≤0.012) match Linear's 2026 direction and Radix `sand` + amber.
- Brass is reserved for "needs a decision", the one accent.
- The primary is ink, not a color, so the accent keeps its meaning.
- It connects to hospitality's material palette (Aman's sand, soil, clay) without imitating it.

| token | light | hex | vs bg / surface | dark | hex | vs bg / surface |
|---|---|---|---|---|---|---|
| background | oklch(0.985 0.003 85) | #fbfaf8 | n/a | oklch(0.17 0.006 70) | #110f0d | n/a |
| surface | oklch(1 0 0) | #ffffff | n/a | oklch(0.205 0.007 70) | #191714 | n/a |
| text | oklch(0.22 0.008 70) | #1d1a17 | 16.6 / 17.3 | oklch(0.95 0.006 85) | #f0eeea | 16.5 / 15.5 |
| muted-fg | oklch(0.50 0.012 70) | #68625c | 5.8 / 6.0 | oklch(0.72 0.012 75) | #a9a49c | 7.7 / 7.2 |
| border | oklch(0.91 0.006 80) | #e3e1dd | decorative | oklch(0.30 0.008 70) | #302d2a | decorative |
| input-border | oklch(0.64 0.008 75) | #8f8b87 | – / 3.4 | oklch(0.52 0.008 75) | #6c6864 | – / 3.3 |
| primary (ink) | oklch(0.27 0.010 70) | #2a2621 | 14.5 / 15.1 (white on it 15.1) | oklch(0.93 0.008 85) | #eae7e2 | 15.6 / 14.6 (bg-colored text on it) |
| accent / brass (fill) | oklch(0.80 0.11 82) | #e1b767 | **dark text only** (9.2; white 1.9 fails) | oklch(0.80 0.11 82) | #e1b767 | 10.2 vs bg; use bg-colored text on it |
| accent-text (brass) | oklch(0.52 0.10 75) | #8a5f18 | 5.4 / 5.6 | oklch(0.82 0.11 82) | #e8bd6d | 10.9 / 10.2 |
| positive | oklch(0.50 0.11 155) | #1e7546 | 5.4 / 5.7 | oklch(0.75 0.13 155) | #62c689 | 9.1 / 8.5 |
| negative | oklch(0.53 0.18 28) | #be3029 | 5.5 / 5.8 | oklch(0.71 0.16 28) | #f57567 | 6.9 / 6.5 |
| warning | oklch(0.55 0.13 55) | #aa5910 | 4.9 / 5.1 | oklch(0.76 0.13 60) | #ed9c55 | 8.6 / 8.1 |
| chart-1 (this period) | = primary | #2a2621 | 14.5 | oklch(0.90 0.008 85) | #e0ded8 | 14.2 |
| chart-2 (decision / forecast) | oklch(0.64 0.12 78) | #b48226 | 3.3 | oklch(0.78 0.12 82) | #deaf56 | 9.5 |
| chart-3 | oklch(0.55 0.09 240) | #3a78a1 | 4.6 | oklch(0.70 0.10 240) | #60a7d6 | 7.3 |
| chart-4 | oklch(0.62 0.07 160) | #609378 | 3.4 | oklch(0.70 0.08 160) | #71ae8d | 7.4 |
| chart-ref (LY, dashed) | = muted-fg | #68625c | 5.8 | = muted-fg | #a9a49c | 7.7 |

Notes:
- **Brass as a fill vs as text.** Light-mode brass fill (#e1b767) is only 1.9:1 against the background. Use it for badges and pills with ink text, and add the darker `accent-text` brass as a 1px border or icon so the shape still passes 3:1. In charts, use `chart-2` (3.3:1), not the fill token.
- **Warning vs brass.** Warning (hue 55, orange) and brass (hue 78–82) are adjacent. Keep warning for system status only (sync errors, stale data) and always pair it with an icon. Otherwise drop warning and let brass carry all "attention" semantics.
- **Positive vs negative.** In both themes they have nearly equal luminance (light: 5.4 vs 5.5), so for deuteranopes they collapse. Arrows and signs are mandatory. Offer a "colorblind-safe deltas" toggle that swaps in C's blue/orange pair.
- **Type:** keep Geist + Geist Mono, but turn `tnum` on globally for numerals. Optionally try Inter for body text if Geist feels too display-like at 13px in tables. Optionally use Geist Serif for the property name or page H1 only, as a quiet hospitality cue, echoing Bonvoy's sans + serif pairing.

### C. "Evergreen ledger": stone + pine, with blue/orange semantics
Rationale:
- The accent is a deep pine. It echoes Six Senses' olive and pebble palette and reads as "hospitality / nature" rather than "finance".
- Taking green out of the semantic role frees **blue = better, orange = worse**. Datawrapper calls that pair the safest for red- and green-blind readers.
- It is the most distinctive of the three and still restrained.

| token | light | hex | vs bg / surface | dark | hex | vs bg / surface |
|---|---|---|---|---|---|---|
| background | oklch(0.975 0.006 95) | #f8f7f2 | n/a | oklch(0.18 0.012 165) | #0d1310 | n/a |
| surface | oklch(0.995 0.003 95) | #fefdfb | n/a | oklch(0.215 0.014 165) | #131c18 | n/a |
| text | oklch(0.22 0.015 165) | #141d19 | 16.0 / 17.0 | oklch(0.95 0.008 100) | #efefe9 | 16.2 / 15.1 |
| muted-fg | oklch(0.49 0.015 150) | #5b635c | 5.8 / 6.1 | oklch(0.73 0.015 140) | #a3aaa1 | 7.9 / 7.3 |
| border | oklch(0.90 0.010 110) | #dedfd7 | decorative | oklch(0.31 0.015 165) | #29332e | decorative |
| input-border | oklch(0.63 0.012 140) | #858b84 | – / 3.4 | oklch(0.53 0.015 160) | #656f69 | – / 3.3 |
| primary / accent (pine) | oklch(0.40 0.07 165) | #1a533e | 8.3 / 8.8 (white on it 8.9) | oklch(0.76 0.09 165) | #77c4a3 | 9.1 / 8.5 (bg-colored text on it) |
| accent-text | oklch(0.42 0.07 165) | #205943 | 7.6 / 8.0 | oklch(0.78 0.09 165) | #7ecaa9 | 9.7 / 9.1 |
| positive (blue) | oklch(0.50 0.13 250) | #1666aa | 5.6 / 5.9 | oklch(0.74 0.12 245) | #65b2f1 | 8.2 / 7.7 |
| negative (orange) | oklch(0.56 0.15 45) | #b95115 | 4.6 / 4.9 | oklch(0.75 0.14 50) | #f49157 | 8.1 / 7.5 |
| warning (ochre) | oklch(0.52 0.10 75) | #8a5f18 | 5.2 / 5.5 | oklch(0.80 0.12 80) | #e6b55d | 9.9 / 9.2 |
| chart-1 | = primary | #1a533e | 8.3 | = dark primary | #77c4a3 | 9.1 |
| chart-2 | oklch(0.55 0.13 250) | #2a75ba | 4.5 | oklch(0.72 0.12 245) | #5eaceb | 7.6 |
| chart-3 | oklch(0.66 0.15 50) | #d97230 | 3.05 (tight; use ≥2px strokes) | oklch(0.76 0.14 50) | #f7945a | 8.4 |
| chart-4 | oklch(0.60 0.10 90) | #977d30 | 3.7 | oklch(0.82 0.10 95) | #d8c477 | 10.8 |

- **Type:** Inter / Inter Display, or keep Geist. Geist Serif or a widely tracked uppercase label style for the property name.
- **Risk [P]:** blue for "good" and orange for "bad" is less familiar to revenue managers than green/red, so the legend and copy have to teach it once. Pine plus green-tinted dark mode can drift toward "eco brand" if chroma creeps up, so keep C≤0.09.

---

## 6. Implementation notes for the current codebase [P]
- `compass/src/styles.css` currently has the tweakcn "LIT" theme: Funnel Sans, a blue primary at hue 262, zinc neutrals at hue 286, and `--radius: 1rem`. That isn't the graphite/brass/Geist described in the brief, so the graphite version must live elsewhere or not be applied yet. Map whichever direction you choose onto the shadcn variable names:
  - `--background`, `--card`, `--foreground`, `--muted-foreground`, `--border`, `--input`, `--primary`, `--accent`, `--destructive`, `--chart-1..5`
  - Add new semantic variables: `--positive`, `--negative`, `--warning`, `--accent-text`, `--input-border`.
- Note that shadcn's `--accent` means a hover surface, not a brand accent. Put brass in a new `--decision` / `--decision-foreground` pair so it can't leak into hover states.
- Add `font-variant-numeric: tabular-nums lining-nums` to a `.num` utility and to `td`, KPI and chart-tick styles.
- Add `input, select, textarea { font-size: max(16px, 1em) }` under the mobile breakpoint.
- **Verify in browser:** run an axe pass on both themes, and run a CVD simulation (Chrome DevTools > Rendering > Emulate vision deficiencies) on the KPI and pickup charts.

## 7. Gaps / not verified
- No first-party color data for Attio, Hex, Lighthouse, Cloudbeds or Tableau's 2025–26 product UI.
- Aeonik EULA terms were not read.
- Mercury, Ramp, Aman, Bonvoy and Six Senses hex values come from third-party extracts.
- Juyo's exact brand colors are pending the other agent. The #9D8DF1 above is a single-page observation.
- All contrast numbers are computed (WCAG 2.x). APCA was not computed.
