# Juyo: brand, product UI, and AI write-access research

Collected 2026-11-20. Sources: raw HTML/CSS/JS from juyo.ai and accessjuyo-v3.com, fetched with curl. Nothing was executed; files were only read as text. Raw files are in the session scratchpad (`juyo-raw/`). That folder is temporary.
Labels: **[fact]** = read directly from source, **[inferred]** = my reading, **[uncertain]** = not verified.

---

## TL;DR

- **Two separate design systems.** The marketing site (juyo.ai, Next.js + Tailwind) and the product (accessjuyo-v3.com, Angular + Bootstrap 5.3 + a custom token layer) do not share tokens. They do share these:
  - Near-black `#101418`
  - Off-white `#FAFAFA`
  - Purple (`#9685E4` in the product, `#9D8DF1` on marketing)
  - Blue (`#477EE3` / `#4FA3F8`)
  - Orange `#FE7637`
  - Teal (`#32BEBF` / `#32BDBF`)
  - The Aeonik typeface
- **The product is dark-first.** In the app CSS, `:root` *is* the dark theme. A light theme exists as `[data-theme=light]`. Every product screenshot they publish is dark: near-black `#101418` / `#111518` / `#161B22`, plus a blue-vs-purple chart pair.
- **The marketing site is mostly light** (`#FAFAFA` body), with full-bleed dark sections for the hero, the "Ask. Analyze. Act." band and the CTA. Primary buttons are pill-shaped and near-black (they invert to white on dark sections). Brand purple is an accent, not the button color.
- **AI write access.** Today Kassandra reads and recommends. The analytics database is isolated from production. Connections are described as ingest. The v3 client has no rate-push or PMS-write endpoints. "Agents … act" is roadmap: Agents / "Unlimited Workflow Automations" are **"Coming Soon"** on pricing, and the marketing says actions run with "guardrails you control" and "an autonomy control you set property by property". Nothing public says Juyo pushes rates into an RMS or PMS.

---

## 1. Marketing site (juyo.ai)

Stack **[fact]**: Next.js (Turbopack chunks), Tailwind v3-style utilities, Lenis smooth scroll, Lucide icons in the UI, and Google Material Symbols (Outlined, FILL0) PNG/SVG icons for feature illustrations. Images are on DigitalOcean Spaces (`juyo-production.ams3.cdn.digitaloceanspaces.com`). Main CSS file: `https://juyo.ai/_next/static/chunks/0rf70koj.elmv.css` (≈100 KB).

### 1.1 Color tokens (exact, from `:root` / `.light` / `.dark` in that CSS)

Brand (`:root`):

| Token | Value | Notes |
|---|---|---|
| `--brand-purple` | `157 141 241` = **#9D8DF1** | Most-referenced token in the CSS (14×). Used for text accents, the "AI" pill, glow gradients, and `bg-brand-purple` (7× in HTML) |
| `--brand-purple-hover` | **#865CC8** | |
| `--brand-blue` | **#4FA3F8** | Used once in HTML (`text-brand-blue`) |
| `--brand-orange` | **#FE7637** | Used once in HTML. Material icons are tinted `FE7637` |
| `--brand-aquatic` | **#32BDBF** | Teal |
| `--brand-slate` | **#4F5E7D** | Used in hero radial glows |
| `--bg-body` | **#FAFAFA** | |

Semantic, light (`:root,.light`) vs dark (`.dark`):

| Token | Light | Dark |
|---|---|---|
| `--bg-primary` | `#FAFAFA` | `#101418` |
| `--bg-highlight-primary` (primary button fill) | `#101418` | `#FFFFFF` |
| `--surface-primary` | `#FFFFFF` | `#181F25` |
| `--surface-secondary` | `#EEEEEC` | `#202931` |
| `--text-headline` | `#101418` | `#FFFFFF` |
| `--text-body` | `#101418B3` (70%) | `#FFFFFFB3` |
| `--text-body-secondary` | `#10141880` (50%) | `#FFFFFFB3` |
| `--text-muted` | `#737373` | `#E5E5E5` |
| `--text-danger / success / info / warning` | `#DC2626 / #6CB64E / #3F70CC / #CC5F2C` | same |
| `--icon-secondary` | `#A3A3A3` | `#404040` |

Gray ramp (light; dark mode reverses it): `#111418 #191E24 #212931 #3B3E41 #4D4F52 #6A6C70 #C8C9CB #E7E8EA #F1F2F4 #F9FAFB #FFFFFF` (gray-1 to gray-11).
Leftover shadcn tokens (`--ui-primary: 47.9 95.8% 53.1%`, a yellow) are stock defaults and **not used** on the page **[inferred]**.

Frequency of utility classes in the homepage HTML **[fact]**: `text-text-headline` 58, `rounded-full` 37, `border-surface-secondary` 22, `bg-background-highlight` 20, `bg-surface-primary` 19, `rounded-2xl` 18, `text-brand-purple` 7, `bg-brand-purple` 7, `text-brand-orange` 1, `text-brand-blue` 1. Takeaway: the site is **monochrome near-black/off-white, with purple as the only frequent accent**. Orange, blue and teal barely appear on marketing.

### 1.2 Where colors are used

- **Page background:** `#FAFAFA`. Cards and surfaces are `#FFFFFF` with `#EEEEEC` borders.
- **Dark bands** (hero, "Meet Kassandra AI" / Ask-Analyze-Act, the final CTA): `bg-background dark text-white`, i.e. `#101418`. On large screens the hero bands are inset with `lg:rounded-2xl lg:w-[90%]`.
- **Glows:** radial gradients of `rgb(157 141 241 / .5→0)` (purple) and `rgb(79 94 125 / .3→0)` (slate) behind the hero and the Kassandra visuals. There is no hard gradient fill anywhere.
- **Primary button ("Book a demo")**, exact classes: `bg-background-highlight text-surface-primary border-2 rounded-full h-12 px-6 min-w-24 font-medium hover:bg-gray-4`. In light context that is a near-black `#101418` pill with white text and hover `#3B3E41`. In dark sections it inverts to a white pill with dark text. **Primary buttons are not purple.**
- **Nav dropdown items:** `rounded-lg`, hover `bg-surface-secondary/40`, with a `text-xs text-text-body` subtitle under each label (examples: "Margin served hot", "Space that earns its keep").
- **Tabs/segmented control:** a `rounded-full border border-surface-secondary p-2` pill container.
- **Logo grid:** cells use `border-gray-9`, with only the outer corners rounded (`rounded-tl-3xl` …).

### 1.3 Typography

- **Aeonik** (CoType Foundry), self-hosted `Aeonik_Regular` (400) + `Aeonik_Medium` (500), fallback Arial with metric overrides. It is the only family on the marketing site (`font-family: var(--font-aeonik), sans-serif`). Note: the product CSS spells it "Aeonic", but the files are `aeonik-*.woff2`.
- Weights used in the HTML: `font-normal` (58) and `font-medium` (25). **Headlines are 400 weight, set large**, not bold. Bold is only emphasis.
- Sizes: display text runs 3–6rem (48–96px, with one 12rem), plus `text-[2.5rem]`, `text-3xl`. Body is `text-base` / `text-sm`, `leading-8` / `leading-snug`, `tracking-normal`, and `text-pretty` on headings.
- `text-rendering: geometricPrecision` on `<html>`.

### 1.4 Radius, shape, spacing

- Radius set: `9999px` (pills: buttons, tabs), `1rem` / `rounded-2xl` (cards, dark bands), `.75rem` / `rounded-xl` (inputs `h-14 rounded-xl`), `rounded-md` (images in prose).
- Nav height `4rem` / `5rem` / `7rem` responsive (`--main-nav-height`).
- Shadows are almost absent (`shadow-none`). Depth comes from borders and surface tone.

### 1.5 Logo and brand mark

- File: `https://juyo-production.ams3.cdn.digitaloceanspaces.com/logo%20dark.svg` (102×32), single fill `#101418`. On dark it is flipped with CSS `dark:invert`.
- **Mark:** a roughly circular cluster of about 20 dots of different sizes. Some pairs are joined by short organic, metaball-like bridges, so it reads as "connecting the dots" and as a neural or molecular network. The app icon (`icon-192-light.png`) is the mark alone, black on white.
- **Wordmark:** "Juyo" in title case. It is a clean geometric grotesk close to Aeonik Regular **[inferred]**, set tight, with the mark sitting left at cap height.
- **Previous identity** (still on the Apaleo store banner, `images.ctfassets.net/.../Juyo1.jpg`): all-caps, thin-line "JUYO / HOTEL ANALYTICS", starfield photo background, tagline "WE CONNECT THE DOTS." in condensed caps. The current mark updates that same idea.
- **Kassandra visuals:** in the app, the orb is `assets/gifs/kassandra-ai.gif` (`juyo-kassandra-orb`). Fallback avatar: a circle with "K" on `linear-gradient(180deg,#5b7fff,#8b5cf6)`. The "Kassandra AI" page title uses gradient text `linear-gradient(90deg,#6fa0fb,#a78cfb,#eb75be)` (blue → violet → pink). In the screenshots the chat avatar is an iridescent purple/pink sphere.
- HotelGPT icon (`GPT.svg`): a dot-matrix square in `#4E8CFE` blue.

### 1.6 Imagery style

- Product screenshots are the main imagery, shown dark on light pages. They are often cropped or bleed off the edge inside a dark rounded frame (`Home page commercial 1.webp` and similar).
- Customer logos are mostly white-on-dark (`*-white.webp`).
- Hotel photography appears only in case studies (Aethos Ericeira, Red Carnation Ashford Castle, Hotel Oku).
- Feature icons are Google Material Symbols Outlined, wght 300/400, tinted `#9685E4` (purple) or `#FE7637` (orange). Filenames such as `neurology_40dp_9685E4_FILL0_wght400…` and `robot_2_65dp_9685E4…` make this explicit.

---

## 2. Product app (accessjuyo-v3.com, "v3")

Reachable. `index.html` is an Angular shell (`<juyo-analytics>`, `title: Juyo`). It loads `styles-I6PYGKL6.css` (414 KB) and amCharts 3.20.17 (`amcharts, xy, pie, gauge, serial, funnel, ammap worldLow, themes/dark.js, amstock, export`) from `lib.accessjuyo.com`. Favicons switch with `prefers-color-scheme`.

### 2.1 Design tokens (exact)

`:root,[data-theme=dark]`, the **default theme**:

| Token | Dark (default) | Light (`[data-theme=light]`) |
|---|---|---|
| `--color-bg-base` | **#101418** | #FAFAFA |
| `--color-bg-sunken` | #0D1117 | #F3F4F6 |
| `--color-bg-surface` | **#161B22** | #FFFFFF |
| `--color-bg-raised` | #1F2630 | #FFFFFF |
| `--color-bg-hover` | #262E3A | #EEF0F3 |
| `--color-bg-selected` | rgba(150,133,228,.16) | rgba(150,133,228,.14) |
| `--color-fg-primary` | #FAFAFA | #101418 |
| `--color-fg-secondary` | #8A9199 | #51555A |
| `--color-fg-muted` | #5C636B | #8A9199 |
| `--color-border` | #363C46 | #DDDCDC |
| `--color-border-strong` | #3A3F47 | #CFD3D9 |
| `--color-table-cell-grid` | #3A4350 | = surface |
| `--color-table-block-alt` / `-minor` | #313A47 / #29313D | #E2E5E9 / #F5F6F8 |
| `--color-table-row` | #1A2029 | = raised |
| `--box-shadow` | `0 5px 10px rgba(0,0,0,.19), 0 3px 3px rgba(0,0,0,.23)` | `0 2px 6px rgb(0 0 0/4%), 0 2px 6px rgb(0 0 0/10%)` |

Theme-independent (`:root`):

- `--color-accent: #9685E4`, hover `#A594E9`, fg `#FFFFFF`
- `--color-positive: #34916E` (hover `#3EAD83`), `--color-negative: #AB4236` (hover `#C34E40`), `--color-warning: #FE7637`, `--color-info: #477EE3`
- **Chart series:** `--color-chart-current: #477EE3` (blue, current year/OTB), tint `#7BA2EB`, shades `#2060D4 / #1A4DAB / #143D86`; `--color-chart-comparison: #9685E4` (purple, LY/STLY), tint `#B3A7EC`, shades `#6850D8 / #462BC3 / #37229A`
- **Categorical 1–8:** `#477EE3 #9685E4 #32BEBF #FE7637 #F6E552 #77C955 #E84057 #8A9199`
- `--border-radius: 12px`

Frequency in the JS bundles (inline component styles) **[fact]**: `#9685E4` ≈697, `#477EE3` ≈695, `#8A9199` ≈691, `#101418` ≈689, `#FAFAFA` ≈463, `#FE7637` ≈460. **The real palette is near-black + gray + blue/purple, with orange as the third hue.**

Bootstrap residue: stock `.btn-primary` is still `#0D6EFD`, and stock Bootstrap colors dominate the raw hex counts. They are unthemed defaults, not brand **[inferred]**.

### 2.2 Type in the app

- `body { font-family: Aeonic, Raleway, sans-serif; font-size: .9rem; font-weight: 400; color: var(--color-fg-secondary); }`. Default body text is the **gray** `#8A9199`, not white.
- Aeonik regular + medium-italic woff2. Raleway 400/500/600 from Google Fonts (legacy, still declared in about 30 @font-face blocks). **Open Sans** appears only in 2 component styles (14px, nowrap labels, probably chart or picker legends) **[uncertain which component]**.
- Weights in CSS: 400 > 500 = 600 > 300.
- Icons: Font Awesome 5 Pro (light `fal` variant used, e.g. `fa-paper-plane` send button) and FA Duotone.

### 2.3 Kassandra page styling (from component CSS in the JS)

- Page padding 32px. Container radius `var(--border-radius)` (12px), padding 32px, `box-shadow: 0 4px 20px #0000001a`.
- Greeting: "Hi! I am Kassandra, your Hospitality AI Superagent. Ask me anything about your hotel data."
- Input placeholder "Ask Kassandra a question..." (maxlength 1000). In the newer v5 screenshots it is "Ask anything about your data".
- Disclaimer in italic `.8rem` secondary: "Kassandra currently only has access to data from The Hotel Brussels".
- Tables inside answers: `thead` uses the surface color, cells `8px 16px`, rows separated by 1px borders.
- Metric callout: `.metric` with background `bg-base`, a 4px left border in `--color-accent`, value 1rem/700.
- Warning callout: `#ffc1071a` background.
- Feedback endpoint `api/chroma/feedback/{id}` with `{isApproved}` (thumbs up/down).
- Launchpad cards include "HotelGPT – Insights and recommendations powered by Kassandra AI" (`isAiCard`), which links out to `onToV5Platform()`, i.e. the new platform is a separate "v5" app.

---

## 3. Product UI in screenshots

All are dark. URLs are on `juyo-production.ams3.cdn.digitaloceanspaces.com` unless noted. Pixel colors were sampled from the images and are approximate because of compression.

**Canvas / dashboards (v3 Angular app)**: `Canvas-1080x567.webp`, `Juyo%20Pro-1080x720.webp`, `Juyo%20Enterprise-1080x720.webp`, `Home%20page%20commercial%201%20(1)-1080x1389.webp`

- **Shell:** a top bar (~#161A22) holding the dot logo, a hamburger, the breadcrumb "Canvas > Data Exploration", hotel/chain pickers centered ("DEMO CHAIN", "DEMO HOTEL"), and icons plus the user name on the right.
- **Date bar** below (~#1F2631): two pairs, "CY 01 Nov 2026 ▸ 30 Nov 2026 | LY 01 Nov 2025 ▸ 30 Nov 2025". Each pair has a square purple (`~#9381E0`) icon tab on the left, one with a bed icon and one with a calendar icon (stay dates vs booking dates).
- **Page bg** ~#111518. **Widget cards** ~#161C21 / #161C23, small radius (~6–8px), no visible shadow, 1px darker gutters.
- **Card header:** UPPERCASE small label ("LENGTH OF STAY", "SEGMENTS - MARKET GROUP", "ROOM TYPES", "POS: REVENUE CENTER"). Right side: search, a dropdown ("OTB"), gear, expand, and `?` icons in gray.
- **KPI tiles:** a label ("OTB", "OTB STLY", "PAID UPGRADE") over a large value (52.9%), then a mini key-value list (RN / ADR / Rev). A `?` sits top-right. Values are white, labels gray.
- **Density: high.** Tables use ~11–12px text, many columns (CY / LY / Diff, Booked / Stayed / △), and inline diverging bars. Diffs are green `#34916E`-ish when positive and red `#AB4236`-ish when negative, as text and as bars.
- **Charts** (amCharts 3): grouped bars with **blue #477EE3 = current/OTB vs purple #9685E4 = STLY/LY**, legend under the chart, dashed gridlines, rotated axis labels, area charts for lead time, a Sankey for room-type shifts (pink/blue), and pie/donut charts (one F&B pie uses a rainbow palette, which is very busy).
- The F&B "Menu Engineering" canvas uses a slightly bluer slate (#283042 range) than the commercial canvas. This is older styling **[inferred]**.

**Kassandra / HotelGPT chat (v5 "new platform")**: `Hotelgpt%20(1)-1080x720.webp`, `HotelGPT%20Comp%20set-1080x622.webp`, `Screenshot%202026-07-03…`, `…07-05…`, `…07-07…`, `Kassandra%203/4…`

- **Header:** an iridescent orb avatar plus "HotelGPT", with subtitle "Powered by Kassandra AI".
- **Composer:** pinned to the bottom, full width, ~#0C1216, placeholder "Ask anything about your data", square send button in muted purple (~#4C4B6B).
- **User message:** a right-aligned dark pill.
- **Assistant answer:** a long-form "report card" on a ~#1F222A panel, with these parts in order:
  1. An emoji or ⚠️ icon with a bold headline ("Ranked 7th or worse on 22 of 30 days — rate is the wound", "~€110K sitting on the table in July — and the comp set already knows about Tomorrowland").
  2. A meta line ("Demo Hotel · Brussels · July 2026 Competitive Intelligence").
  3. A purple-tinted lead paragraph. Small-caps section labels ("THE READ").
  4. A row of 4–5 **KPI tiles with colored 1px outlines** (orange / purple / teal / blue border plus matching big value, e.g. orange `-€3`, `~€110K`; purple `0.92`; teal `1.03–1.06`; blue `5`), each with a label in small caps and a small gray explanation.
  5. Charts in their own sub-panel. They look like Chart.js **[inferred from legend boxes and point styling]**: smoothed lines with point markers, a dashed series for comparison, shaded event bands, a vertical dashed "today" line, and rounded bar tops.
  6. Body sections with bold run-in leads and a "Bottom line" callout box.
- **Chart colors in chat:** purple `#9685E4`-ish for the comp set and for negative-but-mild bars, orange-red `~#CF533F / #E86D37` for the bad days or "you", teal `#32AFB0` for "YOU (now)", blue `#385999` for competitors.
- Monetary highlights are inline in color: red for losses (`€36 below the comp set average every night`), teal for opportunity (`~€90K`).
- One screenshot shows an honesty banner in italic: "⚠️ Demo Hotel's live data tables aren't connected in this environment — what follows is framework reasoning from the parameters you've stated."

**Older v2 UI** (Apaleo store, `images.ctfassets.net/nrwejlyqd8jv/…/Juyo2.jpg`, `Juyo4.jpg`; Mews marketplace; HotelTechReport gallery):

- Navy-slate dark (#2A3242-ish), saturated bright blue (CY) vs orange (LY) bars, a traffic-light heatmap table (green / orange / red cells), a blue "sell-to-net" funnel, a world map with orange dots, and a horizontal tab strip of saved dashboards.
- HotelTechReport has more captioned screenshots (Room Type, Pick-up, Net Revenue, "Superman Calendar", Launchpad with "Vertical Date-Lanes"). Their asset URLs return HTML to curl, so they were **not viewed**.
- YouTube video `Cd_q3259yXY` is embedded on HTR; the title could not be read.
- No G2 or Capterra listing was found. HotelTechReport: 4.6/5, 34 reviews; review quotes include "Great UI, separate dashboards, and a great display of the data."

**Video:** `https://juyo.ai/ten-minute-tour` embeds `19125530-uhd_2560_1440_30fps.mp4`. The filename pattern looks like a stock clip, not a product walkthrough **[uncertain, not watched]**.

---

## 4. Does the AI write or change data?

### Statements that point to read-only today

- **Isolation (strongest):** "Kassandra AI runs on an isolated analytics database — never your live production systems — so the AI layer can never reach or interfere with the data running your operation." (https://juyo.ai/it-data-and-security)
- "She lives inside Juyo, reads your live data the moment it lands…" (https://juyo.ai/kassandra-ai)
- "Ask her in the language of the business and she comes back with the chart, the cause, and the move worth making." (https://juyo.ai/kassandra-ai)
- **Connections are inbound:** "We ingest, clean, and standardize data from the industry's leading providers…" (https://juyo.ai/connections). The RMS connectors listed are BEONx, IDeaS and Duetto. PMS connectors include Opera, Mews, Apaleo, Guestline, StayNTouch, Infor, hapi, Shiji. The only outbound flow mentioned is "d2o — Productivity Data (Juyo to PMI)".
- **Outbound data is for BI, not operations:** "Allows hotel groups to integrate the data delivered by Juyo through an API/Data Feed into their own visualization solution." (https://juyo.ai/juyo-enterprise)
- FAQ, "How can I get started": "We set up the data-flow from your PMS and other data sources to Juyo…" (https://juyo.ai/faq)
- HotelGPT pricing copy: "Defend the next rate move before you make it… comes back with the move and the reasoning behind it." The human makes the move (https://juyo.ai/hotelgpt).
- **v3 client code [fact]:** none of the 240 API paths in the bundle contains rate push, RMS/PMS write-back or "interface/outbound". Write operations are all internal configuration: segment/rate-code/room-type mapping and `publish` mapping, finance structures `publish`, forecast template upload, Data Drop upload, Kassandra knowledge/FAQ upload. These change how Juyo *models* the data, not the source systems.
- Third parties (Hospitality Net Juyo Pro snapshot, Apaleo, Mews marketplace) say nothing about write access, and a web search found no press release claiming Kassandra sets rates.

### Statements that point to future or partial "act"

- "Deploy autonomous agents that monitor, recommend and act, inside the bounds you set." (https://juyo.ai/kassandra-ai)
- Homepage: "Agents monitor goals, surface what changes, recommend the next move, and act when you're ready, with guardrails you control." (https://juyo.ai/)
- "Put Kassandra AI to work on every hotel at once, running pricing, forecasting and reporting on your behalf, with permission guardrails and an autonomy control you set property by property." (https://juyo.ai/juyo-enterprise)
- "Decide who sees which properties, what each agent is allowed to do, and how every action is logged." (https://juyo.ai/juyo-enterprise)
- "PostgreSQL Row-Level Security. Agent permission guardrails. Full audit trails… The trust to act autonomously." (https://juyo.ai/it-data-and-security)
- Mission statement: "…compounding knowledge into every decision, made by humans or made for them…" (https://juyo.ai/about-us)
- **Pricing table:** row "Act | Agents → Unlimited Workflow Automations" shows **"Coming Soon"** for Pro and Enterprise (https://juyo.ai/pricing).
- Careers: "The layers that come next are still to be designed… Agent-driven workflows, AI-assisted decisions." (https://juyo.ai/careers/open-position-senior-design-engineer)

### What Kassandra produces today (non-destructive)

Dashboards created in Canvas, briefings exported to PDF / PPT / Word, alerts, forecasts and what-if scenarios, and "interactive forms" (https://juyo.ai/kassandra-ai). These write *artifacts inside Juyo*, not source data.

**Conclusion [inferred, high confidence]:** today's product is read-only analytics with recommendations, with the AI sandboxed on an analytics replica. "Act" is the announced next layer, gated behind an autonomy control, permission guardrails and an audit log. It is unclear what "running pricing on your behalf" would write to; no RMS or PMS push integration is documented.

**Implication for Compass:** a "recommend → human approves → logged action" pattern, with explicit autonomy levels and a decision log, sits squarely on Juyo's roadmap and fills a gap they have not designed yet. The safe framing is "proposed change, not applied". That matches their "act when you're ready" wording.

---

## 5. Tone of copy and taglines

- **Hero:** "From Scattered Data / to Confident Decisions", two lines, 400 weight, very large. Sub: "The Hospitality Intelligence Platform that connects the dots. Built by hoteliers, for hoteliers."
- **Recurring motifs:** "connect the dots" (also the logo), "one truth" / "one source of truth", "Ask. Analyze. Act." (each with a product noun underneath: Chat / Canvas / Agents), "the chart, the cause, and the move worth making".
- **Voice:** confident and hotelier-insider. It uses domain jargon without explaining it (RevPAR, pickup, flowthrough, displacement, comp set, CPOR) and says so explicitly: "No explaining what RevPAR, pickup or flowthrough means."
- Short punchy fragments: "Revenue is great. Profit is better." "She has opinions. And the data to back them." "Depth and altitude, in one move."
- Kassandra is personified as "she", a colleague with opinions.
- The in-product AI copy is more dramatic and editorial: "rate is the wound", "a signal that's been blinking red", "~€110K sitting on the table". The answers are written as headline-led briefings, not chat bubbles.
- Nav subtitles are witty: "Margin served hot" (F&B), "Space that earns its keep" (M&E).
- **Social proof everywhere:** "Trusted by 1,700+ hotels", "10hrs /week saved per Revenue Manager", "3min Time to Insight".

---

## 6. Takeaways for Compass (stay close vs diverge)

- **Close match:**
  - Dark `#101418` base, `#161B22` surfaces, `#1F2630` raised, gray text `#8A9199`, 12px radius
  - Blue `#477EE3` for current vs purple `#9685E4` for comparison
  - Orange `#FE7637` for warning or "you"; teal `#32BEBF` as the third series
  - Aeonik (licensed). Inter or Geist are the nearest free stand-ins **[suggestion]**
  - Pill-shaped near-black or white buttons
- **Deliberate divergence options:**
  - Light-first product (their light theme exists but no one shows it)
  - Lower density than the 12px amCharts tables
  - Calmer AI answer cards instead of emoji headlines
  - A single accent instead of four outlined KPI colors
  - Real accessibility contrast: their `--color-fg-muted #5C636B` on `#161B22` is 2.84:1 and fails AA for text (their secondary text `#8A9199` passes at 5.43:1) **[computed]**
- **They are hiring** a Senior Design Engineer to define "conversational analytics, agent-driven workflows, AI-assisted decisions". The stack is **Angular + TypeScript, AWS**, and the role asks for a "frameworks, not screens" approach, "less is more", and AI-assisted building. Compass being Angular is on-brief.

### Open / unverified

- Exact Juyo v5 (new platform) CSS: the v5 app URL was not found. Chat colors are sampled from screenshots only.
- Whether the v5 Agents can already write anything for beta customers.
- HTR screenshots and the YouTube video content were not viewed.
- The Open Sans usage location in the v3 app.
