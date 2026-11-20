# Nights that need a decision: premium tables and hotel rate calendars

Research date: 2026-11-20. Scope: why the "Nights that need a decision" table reads as generic, how premium products build data tables, how hotel revenue-management (RMS) tools show per-night pricing decisions, and a redesign for Compass (Angular + Tailwind v4, dark-first Juyo palette, Inter).

How to read this:
- **[S]** a published source says it (URL beside it). Short quotes are verbatim.
- **[seen]** I looked at the screenshot (Mobbin link or image URL). Nothing here is described from metadata alone.
- **[M]** measured from Mobbin's high-resolution image (see the note in A1).
- **[S\*]** quoted by a parallel research pass and not re-fetched by me. **[seen by the research pass]** means that pass opened the image and I did not.
- **[3P]** a third party (review site, reseller, blog) says it. Treat as unverified.
- **[P]** my proposal or inference. No source states it as a rule.
- Contrast ratios are computed with the WCAG 2.x relative-luminance formula; alpha tints are blended over surface `#161C22`.

---

## TL;DR

1. **The current table fails on hierarchy, not on styling.**
   - It has five columns of equal weight, and three of them use color (event pill, red delta, orange text).
   - Its bar repeats its own number and leaves out last year.
   - Its action is orange text with no reason and no way to act.
   - Premium tables (Linear, Stripe, Mercury) do the opposite: one primary element per row in ink, everything else muted on a second line, and at most one accent color per row (A1).
2. **Table rules** (A3; drawn from over 60 Mobbin screens, 7 design systems, NN/g, Few, Tufte, Butterick and Datawrapper):
   - rows 40 px (Carbon's default), 44 px with inline row actions, 56 px with two lines;
   - sentence-case 12 px muted headers with no fill;
   - horizontal hairlines and no zebra;
   - right-aligned tabular numbers under right-aligned headers;
   - `—` for missing values;
   - hover always on;
   - no hue for magnitude.
3. **Hotel RMS tools show the future as a calendar** (B1).
   - RoomPriceGenie, Mews RMS (ex-Atomize), PriceLabs and the IDeaS phone app use a month grid with one cell per night: date, occupancy, current price, recommended price with an arrow, and the event.
   - Duetto, FLYR and Lighthouse add a multi-month heat calendar for triage.
   - Duetto's is the quietest: neutral days, colored exceptions. Its own words: "Your 90-day revenue calendar is now a decision queue."
4. **Recommendations travel with money and a reason** (B1).
   - Mews: "158 price recommendations and $13,658.00 in additional revenue awaiting approval".
   - Atomize: "Revenue opportunity +852 EUR" per room type.
   - Cloudbeds: a list of nights with `$196 → $163`, KPIs before → after, a reason paragraph, then Edit / Accept and Accept all.
5. **The redesign (C1–C4)** is one dataset with two views and one panel:
   - a **decision list**: Night · Recommendation (with its reason) · On the books vs LY (bullet bar) · At stake · ✓ / ✕;
   - a **rate calendar**: occupancy as a 5-step single-hue fill, current BAR, `↘ €160`, an orange marker for pending nights, events;
   - a **Night panel**: evidence, pace curve against last year, Accept / Adjust / Keep, and where the numbers came from.
6. **Color (C5):**
   - orange is used only for the "needs a decision" marker;
   - blue = this year and purple = last year, Juyo's own chart convention;
   - no green or red inside this component;
   - white text never sits on orange (2.67:1).
7. **Mobile (C6):**
   - the list becomes three-line rows;
   - the calendar keeps 7 columns with one value per cell, as Turo, Skyscanner, IHG and IDeaS do;
   - a tap opens a full-screen Night page with a sticky Accept.
8. **Gaps:**
   - Ramp, Brex, Plaid and Datadog have no web screens on Mobbin.
   - Lighthouse Pricing Manager shows only marketing illustrations.
   - No RMS except IDeaS shows a phone calendar.
   - No product table uses a bullet bar; that choice rests on Few's specification.

---

## Why the current table reads as generic

The current table has five columns: Night (`Sat 12 Dec` + event pill), On the books (grey bar + `41%`), vs last year (`▼ −17 pt` in red), BAR vs comp (`€184 / €166`) and Suggested (orange dot + orange `Lower BAR to €160`). Each problem below is set against what the products in Part A do.

| Symptom | What premium tables do instead | Evidence |
|---|---|---|
| Five columns of equal weight, so there is no entry point | One primary element per row in ink at medium weight; everything else muted and smaller, often on a second line | Linear, Stripe, Mercury, Deel, Retool (A1a, A1b, A1d) |
| Color in three of five columns (an event pill, a red delta, orange text), plus a grey bar | 0–3 hues per table and at most one accent per row. Mercury colors money in and leaves money out in ink; Linear colors only "On track" | A1a, A1e |
| A thin grey bar that repeats its own label and leaves out last year | Bars carry a comparison or a part-to-whole (Mercury Insights), or there is no bar. Plain fill-on-track bars appear in HubSpot and TheyDo, the generic pattern | A1a, A1c; bullet graph in A2 |
| `€184 / €166`: two numbers in one cell, unlabeled, joined by a slash | One number per line; the second number is a muted, labelled secondary ("market €166") | Stripe amount + muted currency, Mercury account line (A1a) |
| The action is a colored sentence with no reason and no way to act | A rationale line ("Recommended because …"), per-row accept/decline, Todo/History tabs | Google Ads, AirOps, Deel, Peec AI (A1b) |
| Nights shown as a list, without their week | Hotel tools lay nights out on a calendar | Part B |

---

# Part A: Premium table craft

## A1. What premium products do (Mobbin)

**Measurement note [M].** Mobbin's web screenshots download at 1920 px wide. In them, 13–14 px UI text measures about 16–18 px from ascender to descender. That fits a capture viewport about 1512 px wide (scale ≈ 1.27). I measured row pitch with a pixel-profile script and divided by 1.27. Treat every px value in this part as an estimate (±3 px). Where I did not measure, I say "visual estimate".

**Coverage.** Mobbin returned no web screens for **Ramp, Brex or Plaid** (queries: "Ramp", "Ramp expenses transactions table", "Brex expenses table", "Plaid dashboard table"). Their places are taken by the closest decision-queue and finance screens: Deel, AirOps, Peec AI, Google Ads, Remote and Monarch.

### A1a. Fintech and product tools

| Product / screen | Row height [M] | Header | Numbers | Status | Color budget | Viz in cells | Dividers, hover, selection | Primary vs secondary text |
|---|---|---|---|---|---|---|---|---|
| Linear issues list [seen] ([screen](https://mobbin.com/screens/0ac97560-1aef-4907-a356-8c18c749437b)) | ~44 px; group band ~36 px | **No column header.** Rows sit under tinted group bands ("In Progress 5", "Todo 7", "Backlog 4") with a count and a `+` | Dates right-aligned, muted ("Mar 31") | Icon only (status circle, priority bars) | Grey UI. Label dots are the only hue | none | **No row dividers**, whitespace only | Title in ink; ID muted before it; labels as small chips on the right |
| Linear projects [seen] ([screen](https://mobbin.com/screens/3d3a4fae-d824-440a-961b-001c6b715a4a)) | ~48 px | Sentence case ("Target date"), regular weight, muted grey, no background | "72%" with a progress-pie icon | Health = icon + text. **Only "On track · 6d" is colored** (green); "No updates" is grey | At most one semantic color per row | A one-line trend line after the % | No dividers. Hover = rounded light fill, and the row checkbox appears only on hover | Name in ink; milestone and date inline in grey |
| Linear initiatives [seen] ([screen](https://mobbin.com/screens/8edc5297-19ef-4de0-8483-dfafa3733cbf)) | two-line row | same | — | "No updates" = icon + grey text | none | none | hover fill | **Title (medium) with a one-line muted description under it** |
| Stripe transactions [seen] ([screen](https://mobbin.com/screens/f706524f-2964-47a5-ba06-4fdf75779e0f)) | ~44 px | Sentence case, semibold, slate (darker than muted, lighter than ink) | **Amount right-aligned and semibold; currency code muted after it ("$0.75 SGD")**; decimals line up | Small bordered badge: green "Succeeded", neutral "Incomplete" / "Cancelled", red "Failed" | Color appears only inside status badges | none | 1 px horizontal hairlines, no vertical lines; checkbox column | IDs in monospace; **empty = "—"** |
| Stripe, denser layout [seen] ([screen](https://mobbin.com/screens/80054ec0-bb9d-4438-9a66-4f7bcd8f103f)) | ~36 px | same | same | badge with an icon inside (✓, ✕, clock) | same | none | hairlines; many empty cells, all "—" | — |
| Mercury transactions [seen] ([screen](https://mobbin.com/screens/092df116-f17c-4ffe-89b6-4e2026e58168)) | ~50 px | Sentence case, regular, muted; sort arrow on "Date" | Right-aligned; **cents set smaller and raised** ("−$3.24"); true minus sign; **money in = green, money out = ink (not red)**; failed = struck through and grey | "Failed" = small outline pill (red text) beside the name | Green for inflow and red for "Failed", nothing else | none | Hairlines. **Selected row keeps a light fill while a detail panel opens on the right** ([screen](https://mobbin.com/screens/b315af47-c926-4be0-8e5f-182a270d2430)) | Name in ink with a logo avatar; account ("Checking ••7127") muted |
| Mercury Insights [seen] ([screen](https://mobbin.com/screens/c50126f3-c02b-4c44-a643-a26c0db602aa)) | ~37 px | Sentence case, muted ("% of total", "Amount") | "65.7%" left of the bar; tiny values as "<0.1%"; amount right-aligned | — | One accent (indigo) for every bar | **Thin rounded bar on a grey track. Each row's segment starts where the previous row's ended, so the column reads as one part-to-whole strip** | hairlines | — |
| Mercury P&L [seen] ([screen](https://mobbin.com/screens/39aedac6-b7a2-494f-ad2c-b3c6739e80f4)) | ~36 px | Month headers right-aligned over right-aligned numbers | Two decimals; zeros printed as "0.00" | — | none | — | Full grid; group and total rows bold on a grey band; indentation shows hierarchy | — |
| Monarch, dark [seen] ([screen](https://mobbin.com/screens/5ccd25f4-5075-497d-93ad-d742ae49345b)) | ~50 px; date band ~37 px | No column header; date group rows | Amount right-aligned in near-white; **spending is not colored** | — | Emoji category icons only | none | Hairlines on dark. **The date band shows that day's total, right-aligned**. Each row ends in a chevron (opens detail) | Summary panel: muted label left, white value right |

### A1b. Decision queues (the closest analog to "nights that need a decision")

| Screen [seen] | What it does |
|---|---|
| Deel "Action required" ([screen](https://mobbin.com/screens/b6d82ee0-8694-4f55-a1d5-9f0964c8b13c)) | Sidebar count "Action required 72". Status pill "● Pending your approval". **Per-row ✕ and ✓ icon buttons** plus ⋮. Bulk "Approve all your pending (71)" / "Deny all your pending (71)" sit inside an Actions menu, not as loose buttons. Amount right-aligned and bold, with the date as a muted second line. Missing vendor = "-". |
| AirOps "Recommended Prompts" ([screen](https://mobbin.com/screens/ae0f151a-f195-43ba-9f2f-9c3ff74bfa10)) | Each item = title + **one-line rationale (muted)** + metadata chips. Per-row ✕ (neutral) and ✓ (dark, filled). Bulk "Decline all" (neutral) and "Accept all" (filled). |
| Peec AI "Actions › Impact" ([screen](https://mobbin.com/screens/a33f472c-a45f-4a1d-bcab-6aa85d66c70e)) | Tabs **Todo / History**: decided items leave the queue but stay auditable. Columns: Recommended action, Group, Type, Action (✕ ✓). |
| Google Ads Recommendations ([screen](https://mobbin.com/screens/12ca2ceb-e1ff-441e-b939-5e63d9800fdf)) | Every card carries a **"Recommended because …"** line. Category filters show the uplift ("Measurement +95%"). A separate **Auto-apply settings** tab with Manage / History ([screen](https://mobbin.com/screens/5fa97545-3ab9-405c-b762-68adf7cc0e74)): suggest first, automate later. |

### A1c. Price calendars and heatmaps (adjacent products)

Mobbin has no hotel RMS screens. These are the nearest calendars with a price or a value per day.

| Screen [seen] | Cell anatomy | Color | Legend |
|---|---|---|---|
| Airbnb host calendar, web ([screen](https://mobbin.com/screens/af3a39a1-6998-45f6-9c82-fe16a07a43ea)) | Day number top-left (small, semibold), nightly price bottom-left; past days filled grey; **selected day = 2 px black rounded outline**; a few days carry a small dot top-left (its meaning is not shown) | None: a neutral grid | None. A right-hand panel holds settings for the selection (discounts, promotions) |
| Turo host calendar, web ([screen](https://mobbin.com/screens/a4fdf5a0-31d7-460c-98dc-04da656bb6f8)) | Horizontal strip of days: weekday caps + date; **weekend columns shaded**; today = filled black circle; trips drawn as lines with end dots; price under every day; some prices followed by "•" (meaning not shown) | Neutral | None |
| Turo host calendar, iOS ([screen](https://mobbin.com/screens/b4daf611-afdf-4e39-94d3-c8f2ec6a8605)) | **7-column month at phone width, date + one price per cell**; multi-select with check marks; bottom sheet "Prices: Adjust / Set / Dynamic" → "Update 53 dates" | Neutral + purple selection | None |
| KAYAK hotel date picker ([screen](https://mobbin.com/screens/968c1ad2-ddb5-46ec-b3f8-cac800d7bc22)) | Date only; the cell is filled by price class | **3 classes**: green "Cheaper", amber "Average", pink "Higher" | Under the grid: the 3 swatches + "Based on average prices of 3-star hotels." |
| Tripadvisor tours ([screen](https://mobbin.com/screens/07f4a277-4832-425f-8d34-56dd3fd12e32)) | Round cell: date + price ("$49") | Same 3 classes | "Cheaper / Average / Higher" + "Showing prices in USD" |
| Kiwi.com pricing table ([screen](https://mobbin.com/screens/ea4bc778-0ba3-40c1-b552-ae18df885f79)) | Departure × return matrix, a price in every cell | Cheap prices green text, expensive red, the rest neutral; selected cell solid dark blue; its row and column tinted (crosshair) | None |
| Skyscanner, iOS ([screen](https://mobbin.com/screens/2c10a6c0-1e46-42c6-ba49-9ab8ed55de70)) | Date + small price; "Estimated prices ⓘ" | **Only the cheap prices are colored** (teal); the rest grey | Info icon |
| IHG Hotels, iOS ([screen](https://mobbin.com/screens/508a7ba5-14a1-40bc-aeb2-cebadfa029cb)) | Date + nightly price in grey under it | None | — |
| Steep heatmap ([screen](https://mobbin.com/screens/4b8bbec1-fe24-48c7-83f2-cfd5d75cd2d2)) | One row per day | Diverging red–green with **user-set Min / Mid / Max thresholds** | Gradient bar with the three values |
| Gorgias busiest times ([screen](https://mobbin.com/screens/67893754-21c2-4d5e-86af-dd8f5e0ce722)) | Hour × weekday; empty = "-" | Single-hue blue | "Least busy ▢▢▢ Busiest"; **Table / Heatmap toggle** |
| Quo busy times ([screen](https://mobbin.com/screens/c2a9cf1b-9b32-4ac4-89b5-b907c8f26146)) | GitHub-style squares; empty = light grey | Single-hue blue | "Less ▢▢▢▢▢ More" |
| Intercom hourly distribution ([screen](https://mobbin.com/screens/ef07903d-5b56-4db3-bb61-3b76070e2f9b)) | The value is printed in every cell | Single-hue blue | Gradient 0 → 4 |

**Negative finding.** I searched Mobbin for a product table with a target tick inside its bars (a bullet bar) and found none. The tables that came back draw plain fill-on-track progress bars with "of" text: HubSpot goals ([screen](https://mobbin.com/screens/96ea82d0-be10-4785-af0b-e67dbd0439a5): "$0.00 … of $12,000.00") and TheyDo ([screen](https://mobbin.com/screens/63f1bd2f-837d-4f87-8700-556e91fd235a)). That is the same thin-grey-bar pattern the current Compass table uses. The case for a bullet bar rests on Few's specification (A2), not on product precedent.

### A1d. Data and developer tools (Attio, Airtable, Notion, Retool, Hex, Vercel; Sentry for Datadog)

A second pass looked at these screens. It calibrated row heights against Retool's own "Row height: Small (32px)" setting, and its scale came within about 4% of mine. Datadog has no screens on Mobbin (two searches), so Sentry stands in. The only Hex screen is a SQL output. The Notion screens have no numeric columns, so Notion gives no evidence on number formatting.

| Product [seen] | What the screens show |
|---|---|
| Attio ([companies](https://mobbin.com/screens/f85654c3-a89c-444e-bdf4-7ba40c3118f4), [format menu](https://mobbin.com/screens/221f159e-b623-47fd-a186-89173dddc092), [footer avg](https://mobbin.com/screens/a44be622-b84a-4805-ad7a-6f600ece6356), [status](https://mobbin.com/screens/9b7cd195-28c6-472d-a3f3-4c3b93f8362b)) | Full hairline grid; rows ~35 px; headers sentence case, regular, with a type icon, no fill. Sort shows as a toolbar chip ("Sorted by …"), not in the header. Currency right-aligned with a fixed 2 decimals; the column's Formatting menu offers Symbol / Code / Name and 2 / no decimals. Footer aggregates ("13 count", "US$85,325,000.00 avg") put the value first and a muted label after. State = small dot + text ("Very weak" red, "Weak" orange, "No communication" grey). Range categories use tinted pills in 5+ hues, which is a lot of color. |
| Airtable ([row height](https://mobbin.com/screens/3c262023-056c-4329-af3c-3505a85f2d80), [grid](https://mobbin.com/screens/45f1760f-30a6-44bd-9ebd-4c84cbe4e48a), [grouped](https://mobbin.com/screens/06e3f847-9156-42de-b9bd-71378b176f5e)) | Row-height menu: Short / Medium / Tall / Extra Tall (Short ≈ 32 px). Numbers right-aligned, nulls blank, footer "Avg 60". Group rows are a grey band about twice the row height with a chevron, a count, a per-group aggregate, and a "+" row. Status = filled pastel pills, one hue per value. |
| Notion ([table](https://mobbin.com/screens/121f0606-5b04-4871-8d8a-6335e937ed08), [layout](https://mobbin.com/screens/8859ba39-fc79-499d-a756-0085c2bf502f)) | Headers muted grey (lighter than the body), regular, with a property icon. Rows ~34 px with horizontal rules. **Vertical lines are a user toggle** ("Show vertical lines"). Status = pill with a colored dot inside. Empty cells blank. |
| Retool ([settings](https://mobbin.com/screens/77f7c55f-a685-43e6-a7bd-a7f40fb441de), [users](https://mobbin.com/screens/57a7ab48-8978-4a6d-8f38-a656a17816d8), [transactions](https://mobbin.com/screens/277e1b2b-c027-41c6-a100-89fde0185c95)) | Inspector: "Row height: Small (32px)", "Empty state: No rows found". Selected row = light-blue tint + filled checkbox; the footer changes to "1 of 1,297 selected". Two-line cells (name, then a muted email) ≈ 46 px. **Pitfalls visible:** mixed decimals ("1.3" over "2"), left-aligned currency, a year printed as "2,022". |
| Hex ([SQL output](https://mobbin.com/screens/e58e9d97-cfb9-452c-b02e-621fa2beb7ce)) | Densest seen (~27 px): full grid, raw UPPERCASE column names, no color at all. Numbers right-aligned but with mixed decimals. A "Table / Chart" toggle sits on the result. |
| Sentry, for Datadog ([issues](https://mobbin.com/screens/f0af3f2e-a416-4ab8-acdf-37b306c3a086)) | Three-line rows (~70 px). A trend column with a thin grey line per row and a 24h/7d toggle in the header. Color only for severity: a short red/orange bar and red "Unhandled". |
| Vercel ([deployments](https://mobbin.com/screens/ac75e179-8e00-463a-9cba-b20d424db41c), [usage](https://mobbin.com/screens/51ef7780-7659-4dae-a7fe-039d26fb20b7), [totals](https://mobbin.com/screens/e828f30f-3564-432d-8a2f-33b3116dd465), [analytics lists](https://mobbin.com/screens/b39e4b87-cdb8-410a-945f-6a34c807468e)) | **Deployments:** headerless two-line rows (~70 px); status = green dot + "Ready" with a muted duration under it; branch and SHA in monospace; three hues in total. **Usage:** a sparkline about 75 px wide and 1.5 px thick per row, in the series hue; charges right-aligned; a right-aligned subtotal stack ending in a bold "Total". **Analytics lists:** a light-grey bar behind each label, proportional to the value, with the value right-aligned and semibold. |

Other screens from the pattern searches:
- Uniswap ([tokens](https://mobbin.com/screens/e39f0d0f-bed1-49ff-92e0-c53d36d34de6)): no row rules, numeric headers right-aligned, deltas as "▲0.15%" / "▼0.06%" in green/red, and a ~105 px sparkline colored by direction.
- PlanetScale ([queries](https://mobbin.com/screens/ef455d28-04ea-46f4-a289-cb6c283ea929)): the unit goes in the header ("p50 latency (ms)"), "< 1" for values below one, and a single outlier in orange.
- incident.io ([incidents](https://mobbin.com/screens/737fac38-b7a6-4559-84b1-b6d9802faab4)): no rules, ~48 px rows, outlined severity chips with only "Critical" solid red, and "–" for missing.
- Linear ([issues](https://mobbin.com/screens/be6c4ee4-aa93-42b4-89b3-dcfc8386f022)): a floating "6 selected · Actions" bar.

Dark tables (Twenty, Supabase, StackAI, Fey, Tailscale, Vapi, Better Stack, Revolut):
- Headers are muted grey, body text off-white, primary text white and semibold.
- Rules are very faint or absent.
- Accent appears only in small dots, checkboxes and delta text.
- The table often sits on a card slightly lighter than the page.
- Links: [Twenty](https://mobbin.com/screens/36b0d5c8-9550-44ee-b7a0-30f8d10f2eed), [Supabase](https://mobbin.com/screens/a454c054-f6e8-41aa-a86c-41e774222935), [Fey](https://mobbin.com/screens/0caf65f6-dcdc-451d-ae2c-5e8c47e1efff), [Revolut](https://mobbin.com/screens/abb4772e-2342-4e81-bdef-18b406a5e14f), [Better Stack](https://mobbin.com/screens/90fd13b9-7ba3-483e-b4e8-96ffd2461028).
- I measured one myself, the **Fey screener** [seen] [M] ([screen](https://mobbin.com/screens/920817af-adb1-4853-90ec-acd729c9101b)):
  - rows ~43 px;
  - sentence-case muted headers, with a count chip next to "Company";
  - the ticker in bold white and the company name muted on the same line;
  - numbers right-aligned, "N/A" muted;
  - **the hovered or selected row gets a 1 px rounded outline instead of a fill**.
  - It is a trading screen, so it colors every growth figure and daily change, which is more color than Compass wants.

### A1e. Cross-product consensus (both passes)

| Topic | Consensus | Shown by | Exceptions |
|---|---|---|---|
| Row height | Single-line 32–44 px; two-line 46–56 px; three-line ~70 px | Retool 32, Airtable Short ~32, Notion ~34, Attio ~35, Stripe ~36 / ~44, Linear ~44, Mercury ~48–50 | Hex ~27 (raw data). Uniswap and incident.io are roomier (~48–60) |
| Header | Small, sentence case, muted, no fill; weight regular (Linear, Mercury, Notion) or semibold (Stripe) | Linear, Stripe, Mercury, Notion, Vercel usage, incident.io, Twenty | UPPERCASE: Hex, Vanta, Tailscale, [Remote](https://mobbin.com/screens/7159c0c9-f449-427d-af9e-da0762a0a2c1) (which also shows status as a half-filled circle + text with a muted explanation line under it). Bold dark: Retool, Jira. Filled band: Sentry, Uniswap |
| Number alignment | Numbers and their headers right-aligned; fixed decimals per column; compact large values (K / M) | Stripe, Mercury, Attio, Airtable, Uniswap, Vercel charges | Left-aligned numbers: Twenty, StackAI, Supabase, Retool currency |
| Deltas | Sign or direction glyph; colored only where the direction matters, and the "good" color can be the only color (Mercury colors inflow, not outflow) | Mercury, Uniswap, Fey | Vercel paints a "+69%" bounce-rate rise red: bad direction, not sign |
| Status | Dot + text, or a small bordered badge; a solid fill only for the single most urgent value | Linear, Stripe, Attio, Vercel, incident.io | Solid on every row: Zendesk. Multi-hue pills: Airtable, Notion |
| Color budget | Neutral text; hue only in status marks, deltas and charts; 0–3 hues per table | Linear, Stripe, Mercury, Hex (0), Vercel deployments (3) | Attio ranges, Airtable status, Semrush intent bar (5+) |
| Inline viz | Sparkline ~1–1.5 px, no axes, 50–105 px, one hue; or a bar behind or beside the value on a grey track | Linear projects, Vercel, Uniswap, Sentry, Mercury Insights | **No bullet or target-tick cell seen** in any product |
| Dividers | Horizontal hairlines, or none | Stripe, Mercury, Vercel, Sentry; none: Linear, incident.io, Uniswap | Full grid in spreadsheet-like tools: Attio, Airtable, Hex, Mercury P&L |
| Zebra | Not seen in any of the premium screens | — | — |
| Selection and actions | Leftmost checkbox (often only on hover); a count + bulk bar outside the row; row actions at the far right | Linear (hover checkbox, floating bar), Retool, Stripe, Deel | — |
| Primary / secondary | Primary in ink, medium weight; secondary muted and smaller, on a second line or as a muted prefix/suffix | Linear, Stripe, Mercury, Retool, Vercel, Deel | — |
| Grouping and totals | Group band with name, count, chevron and an optional group aggregate; footer value first, muted label after | Linear, Airtable, Monarch (daily total), Attio | — |
| Null and zero | Null = muted "—" (or blank); zero printed explicitly | Stripe "—", incident.io "–", Revolut "–", Cloudflare "No data"; Vercel "$0.00" | Blank nulls: Airtable, Notion |
| Dark mode | Off-white body, muted headers, faint or no rules, accents only in small marks, table on a slightly lighter card | Monarch, Twenty, Supabase, Fey, Vapi | — |

## A2. What design systems and data-viz experts say

A parallel pass read these sources. I re-fetched the Carbon sizes, Primer's empty-cell rule and Geist's em-dash rule myself and they match.

| Source | Rules that matter here (verbatim where quoted) |
|---|---|
| **NN/g, Data tables: four major user tasks** ([link](https://www.nngroup.com/articles/data-tables/)) | The first column should be "a human-readable record identifier". "The default order of the columns should reflect the importance of the data to the user and related columns should be adjacent." Freeze header rows and columns when the table is larger than the screen. Inline row actions "can work if you just have one or two actions." To help people keep their place: "Borders, zebra striping, and hover-triggered highlighting of a record can all help." |
| **NN/g, Visual indicators to differentiate items** (96 users; [link](https://www.nngroup.com/articles/visual-indicators-differentiators/)) | "Text only was 57% slower than the best performing condition", which was color + icon. "Combining a unique icon with a color … proved to perform the best." "Relying on color alone runs the risk of failing color-blind users." |
| **NN/g, Dashboards: preattentive attributes** ([link](https://www.nngroup.com/articles/dashboards-preattentive/)) | "color should not be used to communicate information about quantitative values or magnitude"; color should "reinforce information that is already communicated in a different way." |
| **NN/g, Mobile tables** ([link](https://www.nngroup.com/articles/mobile-tables/)) | "You must first create a usable table for a large screen before translating it to a small one." Sticky headers; lock the leftmost column when scrolling sideways; make overflow apparent. |
| **NN/g, Dark mode vs light mode** ([link](https://www.nngroup.com/articles/dark-mode/)) | With normal vision, "visual performance tends to be better with light mode", and the light-mode advantage grows as font size shrinks. |
| **Material 2, data tables** ([Wayback](https://web.archive.org/web/20200107200212/https://material.io/design/components/data-tables.html); [MDC source](https://github.com/material-components/material-components-web/blob/master/packages/mdc-data-table/_data-table-theme.scss)) | "The baseline row height is 52dp, and the column header row height is 56dp." 16 dp header padding; "Column header text uses a medium weight font." "Align numbers to the right for improved scannability." Hover shows a background color; a selected row needs a fill because the checkbox may sit outside a magnifier's view. MDC: hover = on-surface 4%, selected = primary 4%, dividers = on-surface 12%, minimum row 36 px. Dark example: header text white at 60%, body at 100%, dividers at 12%. Density: each step removes 4 dp, and "Users must opt in to high density component experiences" ([applying density](https://web.archive.org/web/20200107200058/https://material.io/design/layout/applying-density.html)). |
| **IBM Carbon, data table** ([usage](https://carbondesignsystem.com/components/data-table/usage/), [style](https://carbondesignsystem.com/components/data-table/style/)) | Sizes xs 24, sm 32, **md 40 ("Use as the default and most commonly used size")**, lg 48, xl 64 px (xl "only recommended if your data is expected to have 2 lines of content"). The header row matches the row size. "The data table's row hover state should always be enabled." Zebra is an optional modifier. Only the sorted column shows its icon. Skeletons instead of spinners. Header 14 px semibold, cells 14 px regular, 16 px horizontal padding. |
| **IBM Carbon, status indicators** ([link](https://carbondesignsystem.com/patterns/status-indicator-pattern/)) | Status relies on at least two of color, shape and symbol (the page also says three; it contradicts itself). 3:1 contrast. Shapes suit "smaller spaces or when users need to scan large amounts of data" and must be "paired with a status label." "More than five or six indicators can overwhelm users." Deltas need a "“+” or “-” sign, a caret, or an arrow"; color is optional. |
| **Shopify Polaris** ([DataTable](https://github.com/Shopify/polaris/blob/main/polaris.shopify.com/content/components/tables/data-table.mdx), [IndexTable](https://github.com/Shopify/polaris/blob/main/polaris.shopify.com/content/components/tables/index-table.mdx), [`s-table`](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/table)) | "Numerical = Right aligned", "Align headers with their related data", "Don't center align". Units in headers, "Keep decimals consistent." Numeric text uses `tabular-nums lining-nums`. The current web component's `variant="auto"` "displays as a table on wide screens and as a list on narrow screens", with primary and secondary slots. |
| **GitHub Primer** ([guidelines](https://primer.style/product/components/data-table/guidelines/)) | "Right-align numeric values and use the `tabular-num` font variant when possible." "Don't use a single column to show multiple pieces of data" (unclear what sorting uses). "By default, leave empty cells blank … Just don't use a character like “x” or “-”." Wrap before truncating; start sorted; skeleton loading. |
| **AWS Cloudscape** ([table](https://cloudscape.design/components/table/?tabId=usage), [status](https://cloudscape.design/components/status-indicator/?tabId=usage)) | "Right-align quantitative numeric data … show the same number of decimal places"; "Left-align categorical numeric data" (dates, codes, phone numbers); "Use hyphen (-) for any empty values"; comfortable density by default; status = icon + text + color, "Never rely on color alone." |
| **Vercel Geist** ([table](https://vercel.com/geist/table), [badge](https://vercel.com/geist/badge)) | "Render — in cells where a value is unknown or not applicable. Don't substitute N/A, null, or an empty string." "Apply tabular-nums … to numeric columns". Headers in Title Case. "One badge per row"; subtle badge variants on dense surfaces. |
| **Atlassian** ([dynamic table](https://atlassian.design/components/dynamic-table/usage), [lozenge](https://atlassian.design/components/lozenge/usage)) | "Never rely on highlighted rows to convey important meaning, selection, or focus." Lozenges in sentence case, never all caps. |
| **Inter** ([rsms.me/inter](https://rsms.me/inter/)) | `tnum`: "Fixed-width numbers are useful for tabular data." Also `zero` (slashed zero) and `case`. |
| **Butterick, Practical Typography** ([grids of numbers](https://practicaltypography.com/grids-of-numbers.html), [tables](https://practicaltypography.com/tables.html)) | "digits with the same meaning must be vertically aligned", which works only with tabular figures. "Increasing the cell margins is the best way to improve the legibility of a dense table"; turn borders off, then add back only what is needed. |
| **Rutter, A List Apart** ([web typography: tables](https://alistapart.com/article/web-typography-tables/)) | "Avoid zebra striping, tints and fills"; rules in one direction only, lighter; "Right-align numbers"; "match the alignment of headings to the alignment of the data"; `font-variant-numeric: lining-nums tabular-nums`. |
| **Enders, A List Apart (zebra studies)** ([1](https://alistapart.com/article/zebrastripingdoesithelp/), [2](https://alistapart.com/article/zebrastripingmoredataforthecase/)) | 244 users: "no statistically significant difference in accuracy". Follow-up with 2,276 sessions: striping "improved accuracy on three of the eight questions". |
| **Stephen Few** ([bullet graph spec](https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf), [color rules](https://www.perceptualedge.com/articles/visual_business_intelligence/rules_for_using_color.pdf), [rapid monitoring](https://www.perceptualedge.com/articles/visual_business_intelligence/dd_for_rapid_monitoring.pdf)) | Bullet graph: the featured bar is about one-third of the plot height; the comparative measure is a "short line that runs perpendicular"; qualitative ranges "maximum of five and ideally to three", one hue at different intensities. "Use color only when needed"; "avoid … red and green in the same display." In-table bars "visually subdued"; row banding "just visible enough" and only in wide tables. |
| **Tufte, sparklines** ([link](https://www.edwardtufte.com/notebook/sparkline-theory-and-practice-edward-tufte/)) | "small intense, simple, word-sized graphic"; "sparklines improve the attention span of tables"; normal range as a gray band, the latest value in an accent. |
| **Datawrapper, tables** ([guide](https://www.datawrapper.de/blog/guide-what-to-consider-when-creating-tables), [bars in tables](https://www.datawrapper.de/docs/how-to-add-bar-charts-line-charts-to-tables), [heatmaps](https://www.datawrapper.de/blog/heatmaps-for-tables)) | Add bars to "only the most important one(s)" of the columns; bars start at zero; zebra only for long, many-column tables; heatmaps let readers "skim the table for outliers and patterns." |
| **Linear and Mercury** (no table-specific writing) | Linear 2024: text and icons "lighter in dark mode" ([link](https://linear.app/now/how-we-redesigned-the-linear-ui)); Linear 2026: "fewer separators" ([link](https://linear.app/now/behind-the-latest-design-refresh)). Mercury moved "the amount column next to the merchant name" to make activity easier to scan ([link](https://mercury.com/blog/new-transactions)). |

Access gaps: m2/m3.material.io are client-rendered, so Material 2 comes from 2019–2020 Wayback snapshots and the MDC source. A search of the M3 site found no data-table component, but this could not be confirmed directly. Few's *Show Me the Numbers* was not available; his Perceptual Edge PDFs were used instead.

## A3. Table rules for Compass (consolidated)

Where sources disagree, the "Call" column says which side Compass takes and why. These rules cover every Compass table, not only the decision list.

| # | Topic | Rule for Compass | Sources | Call on conflicts |
|---|---|---|---|---|
| 1 | Density | Analysis tables 40 px rows (Carbon's default md); single-line rows with inline actions 44 px; two-line rows 56 px; compact 32 px only as a user opt-in | Carbon sizes; Material density ("Users must opt in"); measured: Stripe ~44, Linear ~44, Retool 32 (A1) | Material's 52 dp is taller than both the premium products and Carbon. Follow Carbon |
| 2 | Padding | 12 px between cells, 16 px at the table's outer edges | Primer (8/12 normal, 16 edges), Carbon and MDC (16), Butterick (cell margins beat borders) | — |
| 3 | Header | 12/16, weight 500, `--text-2`, sentence case, no fill, same height as the rows, sticky once the table is taller than the viewport, aligned like its column, units in the header | NN/g (freeze headers), Carbon (header row matches row size), Polaris and Rutter (align with data), Cloudscape (units and timezone in the header); Linear, Stripe, Mercury (A1) | Case: Geist uses Title Case; Carbon, Polaris, Cloudscape and the premium screens use sentence case. **Sentence case.** Color: Carbon uses primary text, while Primer and Material's dark example (60%) mute it. **Muted**, as Linear and Mercury do |
| 4 | Sorting | Start sorted; only the sorted header shows its arrow | Carbon, Primer | — |
| 5 | Numbers | Right-aligned; `tabular-nums lining-nums`; the same decimals per column; true minus `−`; `€` prefix with no space; dates left-aligned (they are categories, not quantities) | Material, Polaris, Primer, Cloudscape, Geist, Inter `tnum`, Butterick, Rutter | Compact values (`€1.2k`) only in summary cells, never in a column people compare (Datawrapper shortens; Butterick keeps precision) |
| 6 | Status | Dot or shape + text, never color alone; one status per row; 1–2 words; at most 5–6 states | Carbon status pattern, Cloudscape, NN/g (icon + color fastest), Geist ("One badge per row"), Atlassian | — |
| 7 | Color budget | Neutral text by default; at most one accent per row; never hue for magnitude (one-hue intensity is fine for heat); deltas carry a sign or arrow and stay neutral inside tables | NN/g dashboards, Few ("Use color only when needed", avoid red and green together), Carbon (color optional on deltas); Linear, Stripe, Mercury (A1) | Uniswap and Fey color every delta; Mercury colors only inflow. **Neutral in tables, color in KPI tiles** |
| 8 | Inline viz | Only on the one or two key columns; bars start at zero; subdued; one shared scale; a bullet bar when there is a comparison; sparklines word-sized and quieter than the current value | Datawrapper, Few (bullet spec, rapid monitoring), Tufte | — |
| 9 | Rules and stripes | 1 px horizontal hairlines at 6% white; no vertical rules, no outer frame; no zebra by default (allowed as a user setting on wide tables) | Rutter, Butterick, Linear ("fewer separators"); Enders (no harm, small gains); Cloudscape (striping as a preference) | NN/g lists zebra as an aid; Rutter says avoid. None of the premium screens use it. **Off, opt-in** |
| 10 | Hover, selection, focus | Hover always on (`--row-hover`, 4%); selection = fill + a second cue (checkbox or marker), never the fill alone; visible focus ring | Carbon (hover always), MDC (4%), Material and Atlassian (selection not by highlight alone) | — |
| 11 | Primary vs secondary | The first column is a human-readable identifier. Primary 14/20 `--text-1`; secondary 12/16 `--text-2` | NN/g ("human-readable record identifier"); Linear, Stripe, Retool, Vercel, Deel (A1) | Primer: "Don't use a single column to show multiple pieces of data." **Two-line cells only when line 2 is context for line 1, and sorting always uses line 1** |
| 12 | Empty and zero | `—` in `--text-2` for unknown or not applicable, with an accessible name ("no data"); zero printed as `0` / `€0` | Geist (em dash, never N/A), Stripe (A1); Vercel `$0.00` (A1) | Primer leaves cells blank to spare screen readers; Cloudscape uses a hyphen. **Em dash + accessible name** covers both concerns |
| 13 | Truncation | Wrap first; truncate last, with the full text in a tooltip or the detail panel | Polaris, Primer, Carbon | — |
| 14 | Row actions | At most two inline actions; the rest in a ⋯ menu; bulk actions through checkboxes and a bar outside the rows | NN/g ("one or two actions"), Carbon (fewer than 3 inline); Linear, Retool, Deel (A1) | — |
| 15 | Groups and totals | A group band styled like the header, with name, count and group aggregate; a bold total row at the bottom | Polaris (subheader, summary row); Linear, Airtable, Monarch (A1) | — |
| 16 | Loading | Skeleton rows with the final heights | Carbon, Primer, Cloudscape; `docs/decisions.md` | — |
| 17 | Mobile | Design the desktop table first. Four or fewer columns become list rows; a real matrix keeps a frozen first column, a sticky header and visible overflow | NN/g mobile tables, Polaris `variant="auto"`, `mobile_and_boards.md` | — |
| 18 | Dark theme | Three text steps (`--text-1/2/3`, like Material's 87/60/38%); nothing under 12 px; accents used sparingly | Material dark theme; NN/g dark mode (the light-mode advantage grows as text gets smaller) | — |

---

# Part B: How hotel RMS and pricing tools show nights

## B1. Vendor by vendor

Evidence for this part:
- Every screenshot below was opened and read, either by me or by a parallel research pass that downloaded vendor help-centre and marketing images.
- I re-opened the ones Part C relies on myself: the RoomPriceGenie calendar and day panel, the FLYR Signals Calendar, Duetto's Demand Calendar and Daily Summary, Cloudbeds' rate changes and day detail, the Mews RMS calendar, the Atomize recommendation table and the Mews Operations grid, Lighthouse's illustrations and Market outlook, the IDeaS pricing screen, the PriceLabs calendar and the Juyo Launchpad.
- Quote labels: **[S]** = I re-fetched the page and the wording matches. **[S\*]** = quoted by the research pass and not re-fetched.

**Vendor status in Nov 2026:**
- Mews bought Atomize in Nov 2024, and the product is now "Mews RMS, powered by Atomize" ([press](https://www.mews.com/en/press/mews-acquires-atomize), [blog](https://www.mews.com/en/blog/mews-rms-powered-by-atomize-unifies-revenue-management-dynamic-pricing-and-business-intelligence)).
- Pace Revenue became FLYR for Hospitality ([Hospitality Net](https://www.hospitalitynet.org/news/4117490.html)).
- Duetto has since announced it acquired FLYR Hospitality ([Hospitality Net](https://www.hospitalitynet.org/news/4134812/duetto-acquires-flyr-hospitality-to-expand-its-platform-and-accelerate-innovation-for-hoteliers); the page shows "October 8" with no year). FLYR's help centre still publishes under that name in Oct 2026.
- Cloudbeds' PIE now sits next to a newer "Revenue Intelligence" module.
- Juyo is BI, not an RMS.

### RoomPriceGenie (independent hotels)
- **Main view** [seen] ([price calendar](https://help.roompricegenie.com/hs-fs/hubfs/Knowledge%20Base%20Import/image-png-Jan-22-2025-01-29-36-8981-PM-Mar-24-2026-04-43-51-6314-PM.png)). A month grid with week numbers, a Week | Month toggle and tabs Prices · Occupancy · Pickup · Revenue. Chips across the top: "52% Occupancy · 28% Expected Occupancy by Today · 80% Target Occupancy". Selectors: Room Type, "Compare Price to: Price In PMS", Adjustments. Plus "Bulk Edit" and "Last Upload".
- **Cell:**
  - date top-left; holiday name top-right ("Maundy Thursday", "Labour Day");
  - the PMS price, small and grey;
  - occupancy % bottom-left;
  - the recommended price bottom-right: in a pink pill with ↘ when it will fall, a green pill with ↗ when it will rise, plain bold black when unchanged.
- **Color rules** [S] ([calendar color scheme](https://help.roompricegenie.com/en/knowledge/calendar-color-scheme)):
  - "The red color indicates that the price will drop in the next round of updates."
  - "When prices remain the same (or within a margin of +/- 4%), we simply add a slight highlight by making it bold."
  - Black means "No attention is needed".
  - Grey marks past days.
- **Occupancy view** [seen by the research pass] ([image](https://help.roompricegenie.com/hs-fs/hubfs/Knowledge%20Base%20Import/occupancy%20calendar-3.png)). Legend: "Not Enough Bookings" in orange and "Too Many Bookings" in purple, each in two intensities. "Purple shading means you are above the expected target occupancy" [S\*] ([occupancy strategy](https://help.roompricegenie.com/en/knowledge/occupancy-strategy)).
- **Day panel, 2026** [seen] ([image](https://help.roompricegenie.com/hs-fs/hubfs/undefined-Apr-13-2026-08-22-50-5979-PM.png)):
  - `Wed, 04/22/2026` with ‹ › to step between days;
  - tabs Overview / Edit Prices / Edit Min Stay / All Room Types / Price Evolution;
  - an AI card "Your pickup and occupancy are on track", with an explanation and "Is this helpful? 👍 👎";
  - tiles `€259 Recommended Price` (red ↘ icon) and `66% Occupancy`.
- **Acting:**
  - An "Upload Prices" menu: manual, "Auto-Upload Next 1 Month", "Turn off Auto-Upload". The upload modal says "By default only price changes greater than 4% will be uploaded." [seen by the research pass] ([help article](https://help.roompricegenie.com/en/knowledge/calendar-color-scheme)).
  - "Fix Prices" overrides a suggestion; no calendar marker for it was seen ([fix prices](https://help.roompricegenie.com/en/knowledge/fix-prices)).

### Mews RMS (powered by Atomize)
- **Pricing calendar** [seen] ([screenshot](https://help.mews.com/servlet/rtaImage?eid=ka0QC000002GxKz&feoid=00N0900000FEl1v&refid=0EMQC00000Lujpb)).
  - A "Smart tip" banner: "There are 158 price recommendations and $13,658.00 in additional revenue awaiting approval." with a "Review prices" button.
  - Grid / list toggle; rate and room-type selectors.
  - Each cell holds icon chips (a lightbulb for a recommendation), the date, a pickup delta (green ▲7 / red ▼-1), an occupancy ring with %, and **the recommended price in blue above the current price**.
  - A right panel shows Price, `Final price`, available spaces, OTA competitor pricing and price history.
- **Color rule** [S] ([studying price recommendations](https://help.mews.com/s/article/Studying-price-recommendations)): "A price recommendation that is awaiting approval is marked in blue throughout the system." "If you have an override in place, the current price will instead be orange."
- **Atomize recommendation table** [seen] (Mews help screenshot of the legacy UI). Per room type it shows:
  - "Availability change last 24h";
  - **"Revenue opportunity +852 EUR / 24h: +18 EUR"**;
  - "Price recommendation 84 EUR / Current: 120 EUR";
  - a lock icon for overrides, which turns the button into "Remove & accept";
  - green "Accept" and "Accept all", "Total: +987 EUR", "Avg. change: ±35%".
- **Legacy summary** [seen by the research pass]: "There are 491 recommended price changes and 88 491 EUR in additional revenue if you accept all changes."
- **Most urgent** [S] ([article](https://help.mews.com/s/article/Most-urgent-price-recommendations)): "The list can be ranked by the total revenue gain between now and the day of arrival, the revenue gain in the next 24 hours, or by the degree to which the current prices are from being optimal."
- **Autopilot** [seen] (same screenshot as the pricing calendar):
  - "Automatically accept price recommendations for all stay dates."
  - "Disable 90 days prior to arrival", with a note that "Any price recommendations during this window will need to be manually accepted."
  - Date-range exceptions.
- **Operations rate grid** [seen]:
  - Dates as columns, with weekend headers greyed.
  - An Occupancy row filled in purple, darker for higher occupancy, with the value printed.
  - A base price plus category offsets (+20.00%, +€30.00).
  - "a small triangle in the corner of a box indicates that there was a price override" [S\*] ([rate management](https://help.mews.com/s/article/rate-management)).
- **Events:** no event marker seen in any Mews calendar.

### Duetto (GameChanger and Advance)
- **Advance "Demand Calendar"** [seen] ([image](https://www.duettocloud.com/hs-fs/hubfs/Advance%20Heatmap.png?width=2764&height=728&name=Advance%20Heatmap.png)).
  - Four months side by side, under the subtitle "Highlighted dates indicate an exception in your booking activity."
  - **Most days stay neutral grey.** Exceptions take a 5-step red ramp, with the legend "Mild Anomaly → Strong Anomaly".
  - A blue corner triangle = "Dynamic Optimization"; a small dot = "Watched Date"; today is outlined.
- **Vendor text, 30 Jul 2026** [S] ([Advance: what's new](https://www.duettocloud.com/en-us/library/advance-whats-new-and-how-real-teams-are-using-it)):
  - "Your 90-day revenue calendar is now a decision queue."
  - "Darker means more signals, more urgency."
  - "You set the sensitivity."
  - "Now the Demand Calendar heat map and the alerts do that legwork, showing you where to look first."
- **Daily Summary** [seen] ([image](https://www.duettocloud.com/hs-fs/hubfs/Daily%20Summary.png?width=1920&height=1100&name=Daily%20Summary.png)).
  - A banner "Dynamic Optimization has increased BAR from $229 → $270".
  - An "Observation" paragraph with bullets.
  - A "Recommendation" box with buttons "Manage Rates / Set Restrictions / Review all optimizations".
  - "Last updated: Today at 2:30 PM".
- **Pinned date** [seen by the research pass] ([image](https://www.duettocloud.com/hs-fs/hubfs/Advance%20UI%20-%20Pin%20date.png?width=1920&height=700&name=Advance%20UI%20-%20Pin%20date.png)). Hotel stats in columns Commit / STLY / Duetto Forecast / My Forecast / Budget, plus market-demand, rate-shop and events cards.
- **GameChanger "Manage Rates"** [seen by the research pass; a small marketing composite, partly legible] ([image](https://www.duettocloud.com/hubfs/Blog-Cover-NRMX-1.png)). Columns Stay Date | Current | Recommended | Override | Result | Protect; Optimize and Publish buttons; a lock icon on a row.

### FLYR Hospitality (formerly Pace)
- **Optimization page** [seen] ([signals calendar article](https://help.pacerevenue.com/en/articles/17307007-signals-calendar-overview)). Three layers:
  - a **Signals Calendar** of six mini-months;
  - a timeline table: dates as columns, one property row and one row per room type;
  - a market-rates chart.
- **Signals Calendar** [S] (same article):
  - Monitors (Pick-up / Market Position): "Only one can be active at a time, and switching recolours the whole calendar."
  - Act signals show "a coloured dot for each Act signal type".
  - Events are "shown as a border around that day".
- **Table cells** [seen; the legend was read by the research pass in the [reading the optimization table](https://help.pacerevenue.com/en/articles/15585679-reading-the-optimization-table) article]:
  - Layout: AI price top-left, current price large in the centre, occupancy on the books bottom-left, pick-up bottom-right.
  - Occupancy heat: 6 blues.
  - AI price: teal for "Less Aggressive", mauve for "More Aggressive".
  - Pick-up green, cancellations red.
  - "Price Freeze" is an outlined square.
- **Attention** [seen] ([marking act signals](https://help.pacerevenue.com/en/articles/17359587-marking-act-signals-as-read)):
  - The header reads "Act (123)" with a dropdown of counts per signal type.
  - A bottom bar reads "Signals selected: Price Threshold (1), Price Freeze (2), Restriction Recommendation (22)" with **"Mark All as Read"**.
  - Act signals mean "a clear gap exists between the current state and the optimal state" [S\*] ([act signals](https://help.pacerevenue.com/en/articles/17339865-act-signals-and-the-signals-tab-in-quick-view)).
- **Quick View for one date** [seen by the research pass]. Tabs Signals / Booking Curve / Performance / Market Rates, with a sentence such as "Your shopped rate of €215 is 27% above the comp set median of €169."

### Lighthouse (Pricing Manager, Rate Insight, Market Insight)
- **Pricing Manager** has no public product screenshot, only marketing illustrations [seen] ([main screen](https://a.storyblok.com/f/288416513769651/2130x1200/6a21af2a0d/pricing-manager-main-pricing-screen.png), [hero](https://a.storyblok.com/f/288416513769651/2370x1532/8acb52ee6c/pm-hero-thumbnail.png)).
  - A Mon–Sun grid of red, amber and green tinted cells, each with ↑/↓.
  - One cell reads `$105` with `↑ $118 +12%` and a **"Push"** button, and has an orange dot on its corner.
  - A popover reads "Recommended price $125" against "My hotel $105".
- **Pricing Manager, vendor text** [S\*] ([blog](https://mylighthouse.com/resources/blog/how-pricing-manager-saves-time-for-independent-hotels)): the calendar shows "your current prices, recommended rates, and the prices of your competitors"; "The calendar is color-coded for ease of use."; hovering explains "why that pricing recommendation was made".
- **Market Insight "Market outlook vs. 7 days ago"** (real UI) [seen] ([image](https://a.storyblok.com/f/288416513769651/1907x767/8826680520/market-outlook-static.png)):
  - Mini month calendars filled on a 6-step blue (low demand) ↔ red (high demand) scale.
  - Small ↓ arrows for "Demand change vs. 7 days ago" and ○ for "Opportunity".
  - Filters "Any demand change / Any opportunity".
  - A demand-forecast chart with a "My price level" line and shaded weekends.
- **Market Insight day panel** [seen] ([image](https://a.storyblok.com/f/288416513769651/2202x919/56df373f6d/daily-indicators-figma-frame.png)): "Demand forecast Very high · No change vs. 7 days ago · Demand is usually Very low on Tuesdays", and a competitor table "Usual Tue | Current".

### IDeaS G3 RMS
- **Web pricing screen** [seen; 640 px GIF frame] ([image](https://244639001.fs1.hubspotusercontent-na2.net/hub/244639001/hubfs/Videos/Whats%20New%20Videos/Q3%202025/Thumbnails/Whats%20New%20Q3%202025%20Pricing%20Occ.%20OB%20Percentage.gif?length=1920)).
  - Date rows ("Fri 17-Jan-2025 · OF: 72.84% · Competitors"), each with room-class tiles showing "Final Price" and "Last Room Value".
  - Buttons Save / Upload / **Multiday Override** / **What If** / Cancel, and a "Legend" link.
  - Occupancy on the books was added to the pricing calendar in late 2025 [S\*] ([what's new Nov 2025](https://ideas.com/whats-new-in-g3-rms-nov-2025/)).
- **Information Manager** [seen by the research pass] ([image](https://ideas.com/wp-content/uploads/2025/05/Whats-New-Info-Manager-Investigation-State-Q1-2025.jpg)). Tabs "Alerts / Exceptions / Notifications" with counts, color score badges, and states New → Viewed → Investigated.
- **iPhone app "IDeaS Mobile RMS"** [seen by the research pass] ([App Store](https://apps.apple.com/us/app/ideas-mobile-rms/id736684902)).
  - A dark "@ A Glance" month grid. Each cell: date, BAR level, `OF: 96%`, `OTB: 96%`.
  - Legend: Low (49% and below), Medium (50–79%), High (80% and above), plus System Date, Floor / User Override pins and a Special Event star.
  - App description [S]: "Prioritize. Access the @ A Glance calendar to see what needs your attention now."

### Cloudbeds (PIE and Revenue Intelligence)
- **PIE Rate Manager, calendar view** [seen] ([image](https://myfrontdesk.cloudbeds.com/hc/article_attachments/42241231763355)).
  - Dates as columns, occupancy % in each header, weekend columns tinted.
  - An Events row with bars ("Workshop"); room rows with availability and rate.
  - Corner triangles. The legend, read by the research pass, defines "Rule Applied" (teal) and "Min/max limit reached" (red) ([legend](https://myfrontdesk.cloudbeds.com/hc/article_attachments/42241212586651)).
- **Revenue Intelligence "Opportunities"** [seen] ([page](https://myfrontdesk.cloudbeds.com/hc/article_attachments/45153094063387), [card](https://myfrontdesk.cloudbeds.com/hc/article_attachments/45153072560923)). **This is the closest product to "Nights that need a decision".**
  - A **"Rate changes"** list of nights, each with a `$196 → [$163]` chip, and **"Accept all"** at the top.
  - An expanded night shows:
    - per-room-type `£297 → £99`;
    - Revenue / Occupancy / ADR / RevPAR with tinted deltas;
    - a reason paragraph ("…currently being 19 rooms behind pace and 70% behind budget occupancy, coupled with our rate being 317% higher than competitor median rate…");
    - **Edit / Accept**.
- **Revenue Intelligence, vendor text** [S] ([how to use rate change recommendations](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/40710719764763-How-to-use-the-Rate-Change-recommendations)):
  - "The AI explanation is generated per date and reflects market and demand conditions for that day."
  - "Click Edit to review more details or adjust rates before applying."
  - "A locked rate remains unchanged even when using the Accept all button or automated Autopilot updates."
- **Day detail** [seen] ([image](https://myfrontdesk.cloudbeds.com/hc/article_attachments/47606451992859)).
  - ‹ date › navigation; tabs Opportunities / Explainability / Overview / Rate Evolution / Financials.
  - KPIs as before → after (Revenue £1,486 → £1,945, +£460).
  - Forecast occupancy and revenue by days before arrival, with lines **Current, Forecast with change, Forecast without change, Last year**.
  - A room table of `£104 → £162` chips, with **Lock All / Reset all / Accept all**.
  - Competitor rates with "Market Median Rate £146"; an Events list.

### Juyo (BI, for reference)
- **Launchpad** [seen] ([image, older UI with 2022 data](https://images.ctfassets.net/nrwejlyqd8jv/45PQKFVwNSbpo7EJ8BDH7i/123a92010316645faa9f061c1c8e2dfa/Juyo6.jpg)):
  - "vertical date-lanes": dates as columns under an OTB vs forecast area chart;
  - an OTB | Fcst grid per segment and a per-day occupancy wedge;
  - a "Group Demand" row of "TO SELL" counts, some filled red (meaning not stated), and an "Important comments" row;
  - a mini month calendar for navigation.
- No recommendation or accept UI was found.

### Analogs: PriceLabs and BEONx
- **PriceLabs month grid** [seen] ([pricing calendar help](https://help.pricelabs.co/portal/kb/articles/pricing-calendar), [color guide](https://help.pricelabs.co/portal/en/kb/articles/what-do-the-colors-mean-a-guide-to-pricelabs-calendar-color-coding)):
  - an event strip across the top of the cell ("Victory Day"), a min-stay glyph ("3☾") and the price;
  - fills for demand level (Low / Normal / Good / High), or blue/pink for recommended above/below last year's ADR; darker means "A larger gap" [S\*].
- **BEONx forecast** [seen by the research pass] ([image](https://images.ctfassets.net/nrwejlyqd8jv/5yJbwScIPEftKDoSfb4r2G/d3256f76c27d8c9e4e658ec238c5c40f/1.png)): pickup per day for windows −0 to −90 days, with yellow event chips above the day columns.

## B2. Cross-vendor anatomy

| Element | What the tools do | Who |
|---|---|---|
| Surface | Month grid with one cell per night | RoomPriceGenie, Mews RMS, PriceLabs, IDeaS mobile, Lighthouse PM (illustration) |
| | Multi-month heat calendar for triage | Duetto Advance, FLYR Signals, Lighthouse Market Insight |
| | Dates-as-columns grid (rooms × nights) | FLYR, Cloudbeds PIE, Mews Operations, Juyo |
| | A list of nights waiting for a decision | Cloudbeds RI, Mews / Atomize "Most urgent", IDeaS Information Manager |
| Cell contents | Date; occupancy on the books (% or ring); current price; recommended price; pickup; event name or glyph; lock/override icon | RoomPriceGenie, Mews RMS, FLYR, PriceLabs, IDeaS mobile |
| Recommendation vs current | Both shown. Recommended above or beside current (Mews: blue over black; RoomPriceGenie: grey PMS price + colored pill), or as `current → recommended` (Cloudbeds, Duetto) | all |
| Direction | Arrow glyph (↗ ↘ ↑ ↓ ▲ ▼), almost always also colored | RoomPriceGenie, Lighthouse, Mews, FLYR, Cloudbeds |
| What color encodes | Occupancy (Mews Ops, FLYR, IDeaS mobile), price direction (RoomPriceGenie, PriceLabs), demand (Lighthouse MI), anomaly or urgency (Duetto), pending state (Mews: blue) | — |
| Steps | 3 (IDeaS mobile, RoomPriceGenie), 4 (PriceLabs), 5 (Duetto), 6 (FLYR, Lighthouse) | — |
| Legend | Under the calendar or behind a "Legend" link; words, not just numbers ("Mild → Strong Anomaly", "Low / Medium / High") | Duetto, IDeaS, Cloudbeds, FLYR, PriceLabs |
| Exceptions only | Neutral days, colored exceptions | **Duetto Advance** ("Highlighted dates indicate an exception") |
| Money | Revenue awaiting approval, per night and in total | Mews ("$13,658.00 … awaiting approval"), Atomize ("Revenue opportunity +852 EUR"), Cloudbeds (revenue before → after) |
| Why | Plain-language reason per night | Cloudbeds, RoomPriceGenie, Duetto, FLYR, Lighthouse (on hover) |
| Acting | Per-night Accept / Push / Apply; Edit; Accept all; Upload | All. Bulk acceptance always skips locked or overridden nights (Cloudbeds) |
| Trust ladder | Autopilot with date exceptions and a near-arrival shutoff | Mews, Duetto, Lighthouse, RoomPriceGenie (auto-upload) |
| Read state | "Mark All as Read", state New → Viewed → Investigated | FLYR, IDeaS |
| Phone | Only IDeaS shows a phone calendar: a 7-column month with date, BAR level, OF % and OTB %, 3 occupancy bands, override pins and an event star | IDeaS |

What Compass should take from this [P]:
1. **A month calendar with one cell per night is the industry's own picture of the future.** The decision list is how Cloudbeds and Mews ("Most urgent") present the same nights as work to do. Duetto says it outright: "Your 90-day revenue calendar is now a decision queue."
2. **Every tool with a recommendation UI shows the recommended price next to the current one.** Most add a direction arrow and color it by direction. Compass keeps the arrow and drops the red/green, because orange already carries "needs a decision".
3. **The quietest RMS calendar is Duetto's: neutral days, colored exceptions.** Compass's "needs a decision" marker plays that role. The occupancy fill stays light and single-hue so the markers stand out.
4. **Money and a reason travel with every recommendation** (Mews, Atomize, Cloudbeds). Compass can show money, but only computed money; the reason is a deterministic template.
5. **Compass is read-only.** Lock, override and autopilot become "Keep €184", "Sent to RMS" and, later, an Agent Studio rule. These are the same trust steps, applied to a task rather than to a price.

## B3. A hotel analytics app that uses the same phrase: RevView (Mews Marketplace)

RevView's listing describes "the nights that need a decision clearly marked" and names three triggers [S] ([Mews Marketplace, RevView](https://www.mews.com/en/products/marketplace/revview)):
- "A night about to sell out while rooms are still available";
- "A month quietly falling behind last year";
- "A channel where cancellations are starting to increase".

It also says: "Owners tend to look at the money, general managers at the risks, and revenue managers at the pace." and "It is the same screen for everyone." I opened its three gallery screenshots (2529 × 1581 px, served from `mews.com/api/media/file/…`) [seen]:

- **Forecast view** ([image](https://www.mews.com/api/media/file/bee7f546584b20ca1c4bdf533e1b12a9.jpg)).
  - Three KPI tiles, each with a plain-language subline:
    - `Next 30 nights 83%` / "forecast · 67% on the books · €117k net";
    - `Demand index 1,08` / "pickup last 14 days vs the same window last year: 412 vs 380 nights";
    - `Accuracy ±5%` / "a week out, last 12 weeks · ±3% the day before".
  - A daily chart "Occupancy · on the books and forecast" with:
    - bars for nights on the books;
    - a dashed forecast line with a shaded "likely range";
    - a dashed "last year, same weekday" line;
    - shaded weekends.
  - A month table: On the books, **Forecast (bold)**, Likely range, Occupancy (`83% LY 81%`), Net revenue, vs last year (green pill `↑ 2,3%`), vs budget (`90% of budget`, `–` when missing).
  - **The nights needing a decision appear as a sentence, not a table:** "6 nights are forecast above 90% with room still on the books (25 Sep, 26 Sep, 28 Sep, 29 Sep +2): room to raise the rate or set a minimum stay."
  - The header names the model and snapshot: "pace model · from the books on 14 Sep".
- **Overview** ([image](https://www.mews.com/api/media/file/1a0bfcc5862d7ae6df7931b34b50a7d7.jpg)).
  - KPI tiles with tinted delta pills.
  - "On the books · Sep – Nov 2026 €232k ↑ 7,1% vs same day last year", with one bar per month labelled `€107k / 78% occ`.
  - A booking-window table where cancellation shares are printed in red ("red = cancelled share" is explained in a footnote).
- **Channels** ([image](https://www.mews.com/api/media/file/65811a46c1c4340bcf873c2f538e6850.jpg)).
  - Right-aligned numbers, sentence-case muted headers, a bold Total row and `–` for missing values.
  - A money figure muted after a percentage (`18,0% €31k`).
  - A plain-language takeaway under the table ("One percentage point less average commission is worth €3.830 over this period.").
  - Its deltas are tinted pills on every row, the kind of color everywhere that this redesign removes.

What to take from it: the decision is stated with its dates and its action in one sentence, and money and model provenance sit next to the numbers. What to avoid: colored delta pills in every cell.

## B4. Why a calendar: the research behind it

- Van Wijk and Van Selow's calendar view (InfoVis 1999) puts daily values on a calendar so that patterns on several time scales (day, week, season) can be seen at once. Their abstract opens: "A new method is presented to get insight into univariate time series data." [S] ([abstract](https://www.sciweavers.org/node/165520)). Hotel nights are this kind of data: each night has a weekday, a season and sometimes an event.
- The consumer price calendars in A1c (KAYAK, Tripadvisor, Skyscanner, Turo, Airbnb, IHG) all put **one price per day in a month grid**, and the colored ones explain their scale in a legend placed under the grid.

---

# Part C: The redesign

## C1. The concept: one dataset, two views, one panel [P]

Replace the five equal columns with three pieces that share the same nights and the same selection:

1. **Decision list** (the default; on the briefing and the dashboard). One row per night that is waiting for a decision. It answers four questions in reading order: *which night, what to do, why, how much*. The evidence is drawn, not colored.
2. **Rate calendar** (a `List | Calendar` toggle, and the main view in Explore). A month grid. Each cell holds the date, the current BAR and the occupancy on the books as a single-hue fill. A small orange marker shows a night that is waiting for a decision. This is how RMS tools lay out nights (Part B), and calendars reveal the weekday and event patterns that a list hides (Van Wijk & Van Selow, B4).
3. **Night panel** (a right-hand sheet on desktop, a pushed page on phones). It opens from a row or a cell. It holds the recommendation, its evidence, the pace curve against last year, and Accept / Adjust / Keep. Mercury opens a detail panel next to the selected row in the same way (A1a). Gorgias toggles the same data between a table and a heatmap (A1c).

Why not only one of them:
- **A calendar alone** is a place to explore, not a to-do list. The briefing needs the three nights that matter, ranked, in a few lines.
- **A table alone** loses adjacency. A weak Saturday next to a strong Friday, or a whole event weekend, is visible at a glance on a grid and invisible in a list sorted by money.
- **A strip of decision cards** suits a few items that differ from each other. Nights are uniform items that people scan and compare. NN/g: "Card layouts are less scannable than lists", "Cards are also a poor choice when users need to compare between multiple options", and for "very homogenous items" "consider using a standard vertical list of items" [S] ([NN/g, Cards](https://www.nngroup.com/articles/cards-component/)).

## C2. Decision list: exact anatomy (desktop, ≥ 1024 px)

Four data columns plus actions. Every cell has a primary line and a muted secondary line, as Linear initiatives, Deel and AirOps do (A1).

```
Nights that need a decision  ● 3                               [ List | Calendar ]   Sort: At stake ▾
──────────────────────────────────────────────────────────────────────────────────────────────────────
Night                 Recommendation                        On the books vs LY          At stake
Sat 12 Dec            ● Lower BAR to €160                   ████████░░│░░░░░  41%        +€1.2k   ✓  ✕
in 22 days · ✦ Xmas   €18 above market median · 17 pts…     LY 58% · −17 pts       est. revenue
──────────────────────────────────────────────────────────────────────────────────────────────────────
```

| Column (header text) | Width | Line 1 (14/20, primary) | Line 2 (12/16, `--text-2`) | Align |
|---|---|---|---|---|
| **Night** | 168 px | `Sat 12 Dec`, weight 500, `--text-1` | `in 22 days` · event icon (12 px) + `Christmas market` | left |
| **Recommendation** | flex, min 240 px | Orange 6 px dot (only while pending), then `Lower BAR to €160`: verb at weight 400, new price at weight 600 | Reason, one line, truncated: `€18 above market median · 17 pts behind last year` | left |
| **On the books vs LY** | 200 px | Bullet bar 112 × 6 px, then `41%` (tabular) | `LY 58% · −17 pts` | bar left, numbers right |
| **At stake** | 104 px | `+€1.2k` (tabular, weight 500) | `est. room revenue` | right |
| (actions, header visually hidden) | 88 px | Two 32 × 32 ghost icon buttons: ✓ = accept €160, ✕ = keep €184. Visible at rest in `--text-2`, `--text-1` on row hover. Tooltip and `aria-label` say the consequence: "Accept €160 for Sat 12 Dec", "Keep €184 for Sat 12 Dec" | — | right |

Section title: `Nights that need a decision` (15/20, 600), then `● 3 · about €3.1k at stake` (12/16, `--text-2`, orange dot). Mews RMS opens its pricing calendar with the same kind of summary: "There are 158 price recommendations and $13,658.00 in additional revenue awaiting approval", next to a "Review prices" button [seen] ([Mews help screenshot](https://help.mews.com/servlet/rtaImage?eid=ka0QC000002GxKz&feoid=00N0900000FEl1v&refid=0EMQC00000Lujpb); B1).

Notes on the columns:
- **"At stake" ships only if a deterministic rule computes it, and then as an estimate or a range.** The model never computes it. If there is no rule, drop the column and sort by date. RMS tools put money in this position too: Atomize shows a "Revenue opportunity" in EUR next to each price recommendation, and Cloudbeds shows revenue before → after for each night (B1). Juyo's own position is "Percentages are for benchmarking. Money is for deciding." [S] ([juyo.ai, Money not percentages](https://juyo.ai/money-not-percentages)), so money belongs in the decision row and percentages in the evidence.
- **The market rate moves into the recommendation's reason line**, so "€184 / €166" disappears. The row reads like a sentence: *Sat 12 Dec — lower BAR to €160 — €18 above the market, 17 points behind last year — about €1.2k at stake.*
- **Sort:** by "At stake" when it exists, otherwise by date (soonest first). Offer both in a sort menu.

Row and table metrics:
- Row height **56 px** (two lines: 20 + 16 px of text, 10 px padding top and bottom). A compact density is **44 px** with the secondary line hidden; that matches Stripe and Linear rows (A1a).
- Horizontal cell padding **12 px**, and **16 px** on the first and last cells.
- **Dividers:** 1 px `rgba(255,255,255,.06)` (= `#242A2F` on `#161C22`). No vertical rules, no zebra.
- **Header:** sentence case, 12/16, weight 500, `--text-2`, no background. It is sticky and gains a 1 px bottom divider once the body scrolls. Header alignment follows the column (right-aligned over numbers).
- **Hover:** `rgba(255,255,255,.04)` fill (`#1F252B`). **Selected** (panel open for this night): `rgba(153,106,213,.12)` fill (`#262537`). **Focus-visible:** 2 px focus ring, inset.
- Clicking anywhere on the row except the two buttons opens the Night panel.

The bullet bar (after Few's bullet graph, see A2):
- Track: `--surface-3` `#2A2E33`, 6 px tall, 3 px radius, 112 px wide = 0–100% occupancy.
- Fill: blue `#5B8DEB` = on the books now (5.28:1 on `#161C22`, above the 3:1 for graphics).
- Tick: 2 × 14 px, purple `#9685E4` = last year at the same lead time (5.54:1 on the surface, 4.41:1 on the track).
  - **Purple on the blue fill is only 1.05:1** (both colors have nearly the same luminance), so the tick disappears wherever this year is ahead of last year.
  - Fix: the tick extends 4 px above and below the 6 px bar, and it carries a 1 px `--surface-1` keyline on each side, so it reads as a dark-edged notch through the fill.
- Blue for now and purple for last year is Juyo's own chart convention (blue OTB vs purple STLY in their Canvas screenshots, see `docs/research/ui-refinement/juyo_brand.md` §3), so the bar reads the same as their charts.
- Optional qualitative bands behind the bar (Few) are not needed here. Keep the track plain.

States and their vocabulary (all neutral text, no green or red):

| State | List | Calendar cell |
|---|---|---|
| Pending | orange dot + recommendation | orange marker |
| Accepted | moves to the **Decided** tab; text `✓ Sent to RMS · €160 · 10:42` | marker removed; the cell shows the new price once the RMS confirms |
| Adjusted | `✓ Sent to RMS · €165 (adjusted)` | same |
| Kept | `Kept €184 · Group block expected` in `--text-2` | marker removed |
| Resolved elsewhere | `Price changed in the PMS` | marker removed |

- **Tabs: Pending / Decided**, following Peec AI's Todo / History. Decided items stay auditable.
- **Accept shows a toast** "€160 sent to the RMS as a task · Undo".
  - Because it carries an action, it stays until dismissed (Carbon: actionable notifications persist; NN/g: Undo needs good visibility; both cited in `docs/research/ui-refinement/tooltips_microux.md`).
  - The Decided row keeps its own "Undo" until the RMS confirms.
  - Compass does not write prices (`docs/decisions.md`), so the copy says "sent to the RMS", never "price changed".
- **Bulk action:** "Accept all (3)" sits in an overflow menu, as in Deel, and asks for confirmation with a before → after list.
- **Empty state:** "No nights need a decision in the next 60 days. Last checked 06:00." plus a link to the rate calendar.
- **Missing values:** `—` in `--text-2`, as Stripe does. Never `0` for unknown.

## C3. Rate calendar: exact anatomy (desktop)

- **Grid:** 7 columns, **Monday first** (European hotels). Weekday header `Mon … Sun`, 12/16, `--text-2`, sentence case.
- **Cells:** min 112 × 88 px, 8 px radius, 4 px gap, 8 px padding. Rounded cells with gaps read cleaner on dark than full grid lines.

```
┌────────────────────┐   fill = occupancy on the books (5 blue steps)
│ 12              ✦  │   ✦ = event (name in tooltip / aria-label)
│ €184               │   current BAR
│ 41%       ↘ €160 ● │   ● = waiting for a decision (orange, with a surface-colored ring)
└────────────────────┘
```
- **Cell content:**
  - **Top-left:** day number, 12/16, `--text-2`. Today: `--text-1` with a 1 px ring.
  - **Top-right:** event icon, 12 px, `--text-2`. Its name is in the tooltip and `aria-label`.
  - **Middle:** current BAR `€184`, 15/20, weight 500, tabular, `--text-1`.
  - **Bottom-left:** `41%` on the books, 12/16, `--text-2`. The fill encodes the same number, so the text keeps the cell readable without color. W3C's notes on SC 1.4.11 count "color gradients that represent a measurement, such as heat maps" as essential, and exempt graphics whose "labels and values" are given as text [S] ([Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)).
  - **Bottom-right, pending only, when the cell is ≥ 112 px:** `↘ €160` (or `↗ €205` for a raise), 12/16, `--text-1`. The arrow's shape gives the direction. RoomPriceGenie and Lighthouse also use arrows, but they color the price red or green as well (B1); Compass leaves that out, so orange stays the only accent.
- **Fill = occupancy on the books.** 5 bins, one hue: blue `#5B8DEB` at α 0.08 / 0.16 / 0.28 / 0.42 / 0.60 over `#161C22` = `#1C2532 / #212E42 / #293C5A / #334B76 / #3F609B`. Higher occupancy is lighter, which is Carbon's rule for dark themes: "In dark themes, the lightest color denotes the largest values." [S] ([Carbon color palettes](https://carbondesignsystem.com/data-visualization/color-palettes/)). `--text-1` `#E6EDF3` keeps at least 5.29:1 on the strongest bin.
- **Decision marker:** an orange `#FE7637` dot, 8 px, with a 2 px ring in the surface color.
  - Orange has only 2.34:1 against the strongest blue bin.
  - The ring keeps it at 6.43:1 against `#161C22`, above the 3:1 for graphics.
  - Orange and blue are a colorblind-safe pair. Datawrapper: "Blue is the safest hue" and "the safest choice is to mix blue with orange or red" [S] ([Datawrapper, colorblindness part 2](https://www.datawrapper.de/blog/colorblindness-part2)).
- **States:**
  - Past nights: no fill, BAR in `--text-3`, not interactive.
  - Selected: 2 px `--text-1` outline, as Airbnb's host calendar does (A1c).
  - Hover: +4% white overlay.
- **Legend** under the grid, left-aligned, 12/16, `--text-2`:
  - `On the books` followed by the 5 swatches, with `0%` and `100%` at the ends;
  - `● Needs a decision`;
  - `✦ Event`;
  - on the right: `BAR, base room, EUR`. KAYAK and Tripadvisor put a short scope line in the same place (A1c).
- **Toolbar:** month switcher `‹ December 2026 ›`, the `List | Calendar` toggle, and a "Today" button.
- **Not in v1:** a second fill metric (pace vs last year). If it is added later, use a diverging scale with a neutral midpoint. Carbon recommends purple–teal for "performance, sales, and rates of change" [S] (same page). That collides with purple = last year and with the purple button, so test it before shipping.

## C4. Night panel: exact anatomy

- **Desktop:** a 400 px sheet over the right side. The list or calendar stays visible, with the selected row or cell marked (Mercury pattern). Esc closes it and returns focus to the row.
- **Phone:** a **pushed full-screen page** with a back chevron, not a bottom sheet. It holds the same content, with `Accept €160` sticky at the bottom.
  - NN/g says bottom sheets are for short contextual tasks and must not replace a detail page ([NN/g, bottom sheets](https://www.nngroup.com/articles/bottom-sheet/), already applied in `mobile_and_boards.md`).
  - `Adjust price` and `Keep €184` are short tasks, so each opens a bottom sheet from that page. Never stack a second sheet.

Content, top to bottom:
1. **Header.** `Saturday 12 December` (16/24, 600) with ‹ › buttons to step to the previous or next night (RoomPriceGenie and Cloudbeds both put these next to the date, B1); `in 22 days · Christmas market, Fri–Sun` (12/16, `--text-2`); close ✕.
2. **Recommendation.**
   - Label `Recommendation` (12/16, `--text-2`).
   - `Lower BAR from €184 to €160` (20/28, 600). The old price in `--text-2`, the new one in `--text-1`.
   - Under it the estimate as a range: `≈ +€0.9k to +€1.6k room revenue if pickup follows last year`. A range, because forecasts are not single numbers.
3. **Why** (label left in `--text-2`, value right-aligned in `--text-1`, tabular; Monarch's summary panel uses the same layout):
   - `On the books` → `41% (52 of 128) · LY 58%`
   - `Pickup, last 7 days` → `+3 rooms · LY +9`
   - `BAR vs market median` → `€184 vs €166 · 5 of 6 open`
4. **Pace curve.** 140 px tall.
   - x = days before arrival (−90 → 0), y = rooms on the books.
   - This year: solid blue. Last year: dashed purple. A vertical "today" rule. The dash pattern, not the hue, separates the two lines, because blue and purple are nearly the same lightness (1.05:1). Datawrapper's rule is to vary lightness or add a second cue.
   - 3 y-ticks, no fill.
   - Cloudbeds draws the same chart for a night with four lines: Current, Forecast with change, Forecast without change, Last year (B1). Add the two forecast lines only once a deterministic forecast exists; until then, show the booked curve and last year only.
5. **Market strip** [P]. One line: each competitor's rate for that night as a grey dot. A tick marks the median, a `--text-1` dot is our BAR, and an orange ring is the recommended BAR.
6. **Actions** (sticky at the bottom):
   - Primary `Accept €160`: `#8556C9` with white text, 5.03:1.
   - Secondary `Adjust price`: an inline number field with ±€5 steps.
   - Ghost `Keep €184`: declines the change and asks for an optional reason with chips `Group block expected · Event not in data · Other`. The label names the outcome; a bare "Dismiss" hides that keeping the price is itself a pricing decision.
7. **Trust line** (12/16, `--text-2`): `From PMS snapshot 06:00 · comp rates 05:30 · How this is calculated ›`. It opens the definition and the query, so the evidence is one click away.

## C5. Typography and tokens

- **Font:** Inter.
  - Every number uses `font-variant-numeric: tabular-nums` (Tailwind `tabular-nums`), so the digits line up in columns.
  - Weights: 400 for body text, 500 for primary cell values, 600 for titles and the recommended price. No bold elsewhere.
- **Type scale** (size / line height):
  - 12/16: headers, secondary lines, legends;
  - 14/20: primary cell text;
  - 15/20: calendar price;
  - 16/24: panel title;
  - 20/28: recommendation headline.
- **Text tokens** (proposed; contrast measured on `#161C22` / `#1E2429`):
  - `--text-1` `#E6EDF3`: 14.53 / 13.27.
  - `--text-2` `#9BA6B2`: 6.94 / 6.34. Use it for all secondary text.
  - `--text-3` `#7D8590`: 4.60 / 4.20. It fails AA on `#1E2429`, so keep it for disabled and past nights only.
- **Color budget** [P]:

| Color | Allowed uses | Never |
|---|---|---|
| Neutrals (`--text-1/2`) | every number and label | — |
| Orange `#FE7637` | the "needs a decision" dot and marker, and the count dot in the section title | text, fills, buttons, borders. White on orange is 2.67:1 |
| Blue `#5B8DEB` | this year in charts, the bullet fill, the heat scale | text |
| Purple `#9685E4` | last year in charts, the bullet tick | — |
| Purple `#8556C9` | the primary button | data |
| Green `#4CC38A` / red `#F0616D` | KPI deltas elsewhere, always with ▲/▼ | anywhere in this component |

This gives at most **one accent per row**, which is what Linear, Stripe and Mercury do (A1a).

Tokens for this component (CSS custom properties, to be mapped into the Tailwind v4 `@theme`):

```css
:root {
  --surface-1: #161C22; --surface-2: #1E2429; --surface-3: #2A2E33;
  --text-1: #E6EDF3;    --text-2: #9BA6B2;    --text-3: #7D8590;
  --divider: rgb(255 255 255 / 0.06);
  --row-hover: rgb(255 255 255 / 0.04);
  --row-selected: rgb(153 106 213 / 0.12);
  --decision: #FE7637;                        /* marker only */
  --series-now: #5B8DEB; --series-ly: #9685E4;
  --heat-1: #1C2532; --heat-2: #212E42; --heat-3: #293C5A;
  --heat-4: #334B76; --heat-5: #3F609B;       /* 0–20 … 80–100 % on the books */
}
/* decision list row */
.decision-row { display: grid; min-height: 56px;
  grid-template-columns: 168px minmax(240px, 1fr) 200px 104px 88px; }
```

## C6. Mobile (≤ 640 px)

**Decision list: rows instead of a table.** It is 4 columns of mixed data, which is the case for card rows in `mobile_and_boards.md`. Each night is a full-width tap target, min 72 px tall:
- Line 1: `Sat 12 Dec · in 22 days` (14/20, 500), with `+€1.2k` right-aligned.
- Line 2: orange dot + `Lower BAR to €160` (15/20, 600) + `now €184` in `--text-2`.
- Line 3: the bullet bar full-width, 6 px, then `41% · LY 58%` (12/16, `--text-2`).
- The event shows as an icon after the date.
- No inline ✓/✕: tapping opens the Night page, which has one primary action. This avoids accidental accepts.

**Calendar: 7 columns at 375 px.**
- With 16 px gutters and 2 px gaps, a cell is about 47 × 56 px.
- Each cell holds the day number (12 px) and **one value**: the price without the € sign (`184`; the legend says EUR). Turo, Skyscanner, IHG and Tripadvisor all fit one short price per cell at this width (A1c).
- The fill stays. The orange dot (6 px) sits under the price. Events are not shown on the cell; they appear on the Night page.
- Tap opens the Night page. Swipe or ‹ › changes the month.

**Touch targets:** 44 px minimum with 8 px spacing (`mobile_and_boards.md`).

## C7. Accessibility

- **List:** a real `<table>` with a `<caption>` "Nights that need a decision" and `<th scope="col">`. The actions header is visually hidden but present. Numbers are right-aligned under right-aligned headers.
- **Calendar:** follow the WAI-ARIA date-grid pattern [S] ([APG date picker dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/)):
  - `role="grid"` on the table;
  - arrow keys move by day and week, Home/End go to the week's start and end, Page Up/Down change the month;
  - `aria-selected` marks only the selected cell.
- **Each cell's accessible name holds everything the color shows:** "Saturday 12 December, BAR 184 euros, 41 percent on the books, last year 58 percent, needs a decision: lower to 160 euros".
- **No meaning by color alone:**
  - the marker has text in the legend and in the cell's name;
  - deltas use a true minus sign and words ("pts behind");
  - the bullet bar's numbers are printed beside it.
- **Motion:** respect `prefers-reduced-motion` for panel and toast transitions.

## C8. What to remove from the current table

| Now | Change | Why |
|---|---|---|
| Event pill next to the date | Event icon + muted text in the secondary line | Geist allows "One badge per row" (A2). In the Linear and Stripe screens, badges carry status, and metadata stays plain text (A1a). RMS calendars print the event name or a glyph, not a pill (B2) |
| Grey progress bar + `41%` | Bullet bar: blue fill = now, purple tick = last year | The bar repeated the number and left out the comparison that drives the decision (Few, A2) |
| `▼ −17 pt` in red | `LY 58% · −17 pts` in `--text-2` | The tick already shows the gap. Every row in this list is a problem row, so red on every row says nothing |
| `€184 / €166` | `€184` in the recommendation, the market median in its reason line | The slash pair hides which number is ours. The gap is the evidence |
| Orange dot + orange `Lower BAR to €160` | Orange dot + neutral text, with the new price in weight 600 | Orange marks the state, not the words. One accent per row |
| Five equal columns | Night · Recommendation · Evidence · Money · Actions, with two-line cells | Gives the eye a reading order: when → what → why → how much |

---

## Sources

**Mobbin screens.** Linked inline in Part A. Every screen cited was opened as an image. I measured row heights on hi-res images of Linear, Stripe, Mercury, Monarch and Fey, and inspected hi-res crops of Airbnb, Turo and Deel.

**Standards and data-viz references**
- W3C, [Understanding SC 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- W3C WAI-ARIA APG, [Date picker dialog: date grid keyboard support](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/)
- IBM Carbon, [Data visualization color palettes](https://carbondesignsystem.com/data-visualization/color-palettes/)
- Datawrapper, [What to consider when visualizing data for colorblind readers (part 2)](https://www.datawrapper.de/blog/colorblindness-part2)
- Van Wijk & Van Selow, "Cluster and calendar based visualization of time series data", InfoVis 1999 ([abstract](https://www.sciweavers.org/node/165520))
- NN/g, [Bottom sheets](https://www.nngroup.com/articles/bottom-sheet/)

**Hospitality**
- Juyo, [Money not percentages](https://juyo.ai/money-not-percentages) (19 Oct 2026)
- Mews Marketplace, [RevView](https://www.mews.com/en/products/marketplace/revview)

**Earlier Compass research reused here**
- `docs/research/ui-refinement/color_type.md`
- `docs/research/ui-refinement/juyo_brand.md`
- `docs/research/ui-refinement/mobile_and_boards.md`
- `docs/research/ui-refinement/tooltips_microux.md`
- `docs/decisions.md`

**Design systems and table guidance (A2)**
- NN/g:
  - [Data tables: four major user tasks](https://www.nngroup.com/articles/data-tables/)
  - [Mobile tables](https://www.nngroup.com/articles/mobile-tables/)
  - [Visual indicators to differentiate items](https://www.nngroup.com/articles/visual-indicators-differentiators/)
  - [Dashboards: preattentive attributes](https://www.nngroup.com/articles/dashboards-preattentive/)
  - [Dark mode vs light mode](https://www.nngroup.com/articles/dark-mode/)
  - [Cards](https://www.nngroup.com/articles/cards-component/)
  - [Comparison tables](https://www.nngroup.com/articles/comparison-tables/)
- Material 2:
  - [data tables (Wayback 2020)](https://web.archive.org/web/20200107200212/https://material.io/design/components/data-tables.html)
  - [applying density](https://web.archive.org/web/20200107200058/https://material.io/design/layout/applying-density.html)
  - [dark theme](https://web.archive.org/web/20191226073755/https://material.io/design/color/dark-theme.html)
  - [MDC data-table theme source](https://github.com/material-components/material-components-web/blob/master/packages/mdc-data-table/_data-table-theme.scss)
- IBM Carbon:
  - [data table usage](https://carbondesignsystem.com/components/data-table/usage/)
  - [style](https://carbondesignsystem.com/components/data-table/style/)
  - [status indicator pattern](https://carbondesignsystem.com/patterns/status-indicator-pattern/)
- Shopify Polaris:
  - [DataTable](https://github.com/Shopify/polaris/blob/main/polaris.shopify.com/content/components/tables/data-table.mdx)
  - [IndexTable](https://github.com/Shopify/polaris/blob/main/polaris.shopify.com/content/components/tables/index-table.mdx)
  - [`s-table`](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/table)
- GitHub Primer, [DataTable guidelines](https://primer.style/product/components/data-table/guidelines/)
- AWS Cloudscape:
  - [table](https://cloudscape.design/components/table/?tabId=usage)
  - [status indicator](https://cloudscape.design/components/status-indicator/?tabId=usage)
- Vercel Geist:
  - [table](https://vercel.com/geist/table)
  - [badge](https://vercel.com/geist/badge)
- Atlassian:
  - [dynamic table](https://atlassian.design/components/dynamic-table/usage)
  - [lozenge](https://atlassian.design/components/lozenge/usage)
- Inter, [font features](https://rsms.me/inter/)
- Butterick:
  - [Grids of numbers](https://practicaltypography.com/grids-of-numbers.html)
  - [Tables](https://practicaltypography.com/tables.html)
- Rutter, [Web typography: tables](https://alistapart.com/article/web-typography-tables/)
- Enders:
  - [Zebra striping: does it really help?](https://alistapart.com/article/zebrastripingdoesithelp/)
  - [More data for the case](https://alistapart.com/article/zebrastripingmoredataforthecase/)
- Few:
  - [Bullet graph design specification](https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf)
  - [Practical rules for using color in charts](https://www.perceptualedge.com/articles/visual_business_intelligence/rules_for_using_color.pdf)
  - [Dashboard design for rich and rapid monitoring](https://www.perceptualedge.com/articles/visual_business_intelligence/dd_for_rapid_monitoring.pdf)
- Tufte, [Sparkline theory and practice](https://www.edwardtufte.com/notebook/sparkline-theory-and-practice-edward-tufte/)
- Datawrapper:
  - [What to consider when creating tables](https://www.datawrapper.de/blog/guide-what-to-consider-when-creating-tables)
  - [Bar and line charts in tables](https://www.datawrapper.de/docs/how-to-add-bar-charts-line-charts-to-tables)
  - [Heatmaps for tables](https://www.datawrapper.de/blog/heatmaps-for-tables)
- Linear:
  - [How we redesigned the Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui)
  - [Behind the latest design refresh](https://linear.app/now/behind-the-latest-design-refresh)
- Mercury, [New transactions](https://mercury.com/blog/new-transactions)

**Hotel RMS and pricing tools (B1)**
- RoomPriceGenie:
  - [Calendar color scheme](https://help.roompricegenie.com/en/knowledge/calendar-color-scheme)
  - [Occupancy strategy](https://help.roompricegenie.com/en/knowledge/occupancy-strategy)
  - [Fix prices](https://help.roompricegenie.com/en/knowledge/fix-prices)
  - [Price explanations](https://help.roompricegenie.com/en/knowledge/price-explanations)
- Mews:
  - [Mews acquires Atomize](https://www.mews.com/en/press/mews-acquires-atomize)
  - [Mews RMS powered by Atomize](https://www.mews.com/en/blog/mews-rms-powered-by-atomize-unifies-revenue-management-dynamic-pricing-and-business-intelligence)
  - [Studying price recommendations](https://help.mews.com/s/article/Studying-price-recommendations)
  - [Most urgent price recommendations](https://help.mews.com/s/article/Most-urgent-price-recommendations)
  - [Accepting price recommendations](https://help.mews.com/s/article/Accepting-price-recommendations)
  - [Configure Autopilot](https://help.mews.com/s/article/How-to-configure-Autopilot-in-Mews-RMS)
  - [Rate management](https://help.mews.com/s/article/rate-management)
- Duetto:
  - [Advance: what's new](https://www.duettocloud.com/en-us/library/advance-whats-new-and-how-real-teams-are-using-it)
  - [New rate management experience in GameChanger](https://www.duettocloud.com/en-us/library/product-update-new-rate-management-experience-comes-to-gamechanger)
- FLYR / Pace help centre:
  - [Signals calendar overview](https://help.pacerevenue.com/en/articles/17307007-signals-calendar-overview)
  - [Reading the optimization table](https://help.pacerevenue.com/en/articles/15585679-reading-the-optimization-table)
  - [Act signals](https://help.pacerevenue.com/en/articles/17339865-act-signals-and-the-signals-tab-in-quick-view)
  - [Marking act signals as read](https://help.pacerevenue.com/en/articles/17359587-marking-act-signals-as-read)
  - [Accepting price recommendations](https://help.pacerevenue.com/en/articles/3104440-accepting-price-recommendations)
- Duetto acquires FLYR Hospitality ([Hospitality Net](https://www.hospitalitynet.org/news/4134812/duetto-acquires-flyr-hospitality-to-expand-its-platform-and-accelerate-innovation-for-hoteliers)); Pace becomes FLYR for Hospitality ([Hospitality Net](https://www.hospitalitynet.org/news/4117490.html))
- Lighthouse:
  - [How Pricing Manager saves time](https://mylighthouse.com/resources/blog/how-pricing-manager-saves-time-for-independent-hotels)
  - [Getting the most out of Pricing Manager](https://www.mylighthouse.com/resources/blog/how-to-get-most-out-of-lighthouse-pricing-manager)
  - [Getting the most out of Lighthouse Pricing](https://www.mylighthouse.com/resources/blog/how-to-get-most-out-of-lighthouse-pricing)
- IDeaS:
  - [What's new in G3 RMS, Nov 2025](https://ideas.com/whats-new-in-g3-rms-nov-2025/)
  - [Improvements and innovations](https://ideas.com/improvements-innovations-whats-new-in-g3-rms/)
  - [IDeaS Mobile RMS on the App Store](https://apps.apple.com/us/app/ideas-mobile-rms/id736684902)
- Cloudbeds:
  - [How to use the Rate Change recommendations](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/40710719764763-How-to-use-the-Rate-Change-recommendations)
  - [PIE Rate Manager](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/115002673474-PIE-Rate-Manager)
- Juyo:
  - [juyo.ai](https://juyo.ai)
  - [Juyo Analytics on the apaleo store](https://store.apaleo.com/apps/juyo-analytics)
- PriceLabs:
  - [Pricing calendar](https://help.pricelabs.co/portal/kb/articles/pricing-calendar)
  - [Calendar color coding](https://help.pricelabs.co/portal/en/kb/articles/what-do-the-colors-mean-a-guide-to-pricelabs-calendar-color-coding)

Not reached:
- Hotel Tech Report product pages are gated to verified hoteliers.
- G2, Capterra and GetApp media returned 403.
- YouTube was not checked.
- Lighthouse Pricing Manager has no public product screenshot.
