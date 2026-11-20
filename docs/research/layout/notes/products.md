# Layout patterns of leading analytics and ops products (data-dense but spacious)

Research date: 2026-11-21. Verification levels used below:
- **[fetched]** = I read the primary page itself.
- **[snippet]** = taken from a search-result summary only; the page was not opened. Treat as lower confidence and re-check before quoting.

No screenshots were measured in this pass (no pixel measurements from live UIs). All numbers below come from vendor docs. Where a number is missing, it is listed under Gaps rather than estimated.

---

## 1. Google Analytics 4 (Home, Reports snapshot, Explorations) and Looker Studio: what makes them feel airy?

### Takeaway
GA4's airiness comes from structure rather than from measurements Google publishes: Home is a short vertical stack of a few named sections (one tabbed overview card, one realtime card, recents, suggested cards, insights), each card answers one question, has its own date range, and discloses depth via a link ("View all insights", Expand) instead of showing it inline. Looker Studio's responsive mode formalises this as a 12-column grid with no overlapping components, and its scorecard puts value, comparison, and sparkline in a fixed reading order.

### Cited Findings

**GA4 Home [fetched]**
- Home is personalised: it surfaces information "based on your behavior in Analytics". Section order documented: overview card, realtime card, Recently accessed, Suggested for you, Insights & recommendations — [GA4 About the Home page](https://support.google.com/analytics/answer/11197963?hl=en)
- Overview card: "The overview card shows metrics that are relevant to you with a trendline for each metric." Metrics are shown as tabs inside one card (Analytics adds a tab per metric you regularly view), so several KPIs share one chart area instead of each getting a chart — [GA4 About the Home page](https://support.google.com/analytics/answer/11197963?hl=en)
- Trendline encoding: solid line = last 7 days, dashed line = previous 7 days, one point per day. Comparison is built into the mark instead of into extra labels — [GA4 About the Home page](https://support.google.com/analytics/answer/11197963?hl=en)
- Realtime card: active users in the last 30 minutes, per minute, with up to 5 originating countries (a hard cap on list length inside a card) — [GA4 About the Home page](https://support.google.com/analytics/answer/11197963?hl=en)
- Each card has an independent date range: changing the date range on one card does not affect other cards; choices persist across sessions; personalisation of the overview card is per-user — [GA4 About the Home page](https://support.google.com/analytics/answer/11197963?hl=en)
- Insights & recommendations: insights flag unusual changes and emerging trends; a "View all insights" link opens the full list and an Expand button opens a single insight. Thumbs-down removes a Suggested or Insights card for 30 days — [GA4 About the Home page](https://support.google.com/analytics/answer/11197963?hl=en)

**GA4 Reports snapshot / overview reports [fetched + snippet]**
- "An overview report is a type of Google Analytics report that summarizes the detail reports in a topic." "It consists of a series of summary cards, each card encapsulating a snapshot of data from a detail report." "A topic can have only one overview report." Editors/admins can add and remove summary cards — [GA4 Overview report](https://support.google.com/analytics/answer/10659551?hl=en) [fetched]
- Reports snapshot is the first report in the Reports left nav; any overview report can be set as the Reports snapshot; templates can be customised by adding, removing, rearranging cards [snippet] — [GA4 Reports snapshot](https://support.google.com/analytics/answer/10668965?hl=en)

**Looker Studio [snippet only]**
- Responsive reports: the grid is automatically a 12-column layout that responds to the viewer's device width; components cannot overlap; switching from freeform to responsive is only possible when a page has one or fewer components — [Create a responsive report](https://cloud.google.com/looker/docs/studio/create-a-responsive-report?hl=ko)
- Scorecard anatomy: a sparkline can be added when a metric is the primary field; it appears after the primary metric value and the comparison metric percentage; not available when "Show as progress" is on — [Scorecard reference](https://docs.cloud.google.com/looker/docs/studio/scorecard-reference?authuser=2)
- "Compact Numbers" rounds and shows the unit, e.g. 553,939 becomes 553.9K — [Scorecard reference](https://docs.cloud.google.com/looker/docs/studio/scorecard-reference?authuser=2)

### Inferences
- GA4's Home shows roughly 5 section types and relies on tabs inside the overview card to carry several KPIs. Transferable: a hotel "morning brief" can show one hero card with 3-4 KPI tabs sharing one trend chart (Occupancy / ADR / RevPAR / Revenue), rather than four equal chart cards.
- The solid-vs-dashed previous-period convention removes the need for a legend and a delta table; useful for "vs same day last week / last year" in hotel pacing.
- "One summary card = one detail report" is a clean disclosure contract: every card on a board should have exactly one drill target.
- Capped lists inside cards (top 5) plus a "View all" link is the mechanism that keeps card heights uniform.

### Gaps
- No published pixel values for GA4 card widths, gutters, column count on Home/Reports snapshot, or how many cards fit above the fold. Google's help pages do not state them; would require measuring the live UI or screenshots.
- A commonly repeated "up to 16 summary cards per overview report" limit could not be confirmed in the fetched Google page; it is not stated there. Unverified.
- Explorations (free-form canvas with Variables / Tab settings panels) was not covered by any fetched source in this pass.
- Looker Studio facts are snippet-level; the support page I tried (support.google.com/looker-studio/answer/7355656) returned 404. Default canvas size and grid settings for freeform reports are unconfirmed here.
- No public design rationale from Google for the GA4 Home redesign was found.

---

## 2. Stripe Dashboard, Linear, Vercel: typography scale, density, borders vs whitespace, KPI presentation, sparklines, tables

### Takeaway
Stripe is the only one of the three that publishes concrete layout numbers (via its Stripe Apps patterns, which explicitly mirror native Dashboard pages): charts at 180px in overview modules and 320px when featured, max three charts per row, ~200px minimum chart width, a primary + secondary column page, and headline value above the chart. Linear and Vercel publish principles rather than pixels: reduce chrome contrast so content stands out, align everything, keep a 12-column grid, and use spacing tiers (within group / between groups / section turn) instead of borders.

### Cited Findings

**Stripe [fetched]** — source is the Stripe Apps design-pattern docs, which state they follow native Dashboard patterns
- Recommended chart heights: `180` for a chart inside a `PageModule` on an `OverviewPage` ("Matches the chart area in standard Dashboard metric cards. Compact enough to show multiple charts without scrolling."); `320` for a featured chart on a details page or full-width layout ("Matches the detail view pattern used in Dashboard analytics pages.") — [Stripe chart layout](https://docs.stripe.com/stripe-apps/patterns/chart-layout.md)
- Charts per row: 2 at `1/2` ("Two related metrics of equal importance"), 3 at `1/3` ("A Dashboard overview with multiple metrics at a glance"), or `2/3` + `1/3` ("A primary chart paired with a secondary breakdown or meter") — [Stripe chart layout](https://docs.stripe.com/stripe-apps/patterns/chart-layout.md)
- Hard limit: "Don't place more than three charts in a single row. Charts become difficult to read when compressed below roughly 200px wide." — [Stripe chart layout](https://docs.stripe.com/stripe-apps/patterns/chart-layout.md)
- "Keep related charts at the same height: When charts appear in the same row or section, use the same height value so they align visually." — [Stripe chart layout](https://docs.stripe.com/stripe-apps/patterns/chart-layout.md)
- KPI anatomy: "Pair charts with headline metrics: Show the current value above the chart so users get the answer before checking the trend." The code sample is caption-styled secondary-colour label, then bold subtitle-size value, then chart. "This follows the pattern used on the Stripe Dashboard home page. A header with the current value sits above a chart showing the trend." — [Stripe chart layout](https://docs.stripe.com/stripe-apps/patterns/chart-layout.md)
- Sparkline tile: label (caption, secondary colour), value (subtitle, bold), then a sparkline in a box of height 24 and width 80; items laid out in a row with `gap: 'large'` and `distribute: 'space-between'`. "Sparklines show shape, not numbers" — do not use when users need precise values — [Stripe chart layout](https://docs.stripe.com/stripe-apps/patterns/chart-layout.md)
- Chart choice is by question, not data format: line = "Is this going up or down?", bar = "How much is each category?", meter = "What's the breakdown of this total?", sparkline = "What's the quick trend?" — [Stripe chart layout](https://docs.stripe.com/stripe-apps/patterns/chart-layout.md)
- Layout-shift rule: "Use the same height value for loading, error, empty, and populated states." — [Stripe chart layout](https://docs.stripe.com/stripe-apps/patterns/chart-layout.md)
- Emphasis via background rather than border: "To draw focus to specific charts, add a background" using a `container` background with a `surface` inner box — [Stripe chart layout](https://docs.stripe.com/stripe-apps/patterns/chart-layout.md)
- Page structure: tabs for distinct areas; overview tab uses `OverviewPage` with a `primaryColumn` and `secondaryColumn` (two-column layout "with summary metrics, charts, and sidebar modules"); list tab uses `DataTable` with clickable rows (example `pageSize: 10`); detail is its own route with breadcrumbs and again primary + secondary column; create/edit happens in a `FocusView` drawer that "overlays the current view without interrupting the user's place in the app" — [Stripe full-page apps](https://docs.stripe.com/stripe-apps/patterns/full-page-apps.md)
- Principle: "Progressive: Lead with a high-level overview and let users discover details at their own pace. Don't overwhelm users with all information at once." — [Stripe full-page apps](https://docs.stripe.com/stripe-apps/patterns/full-page-apps.md)
- Home page is user-configurable: under "Your overview", Add/Edit lets users add, remove, reorder widgets; controls are a date range, a time unit (hourly/daily for short ranges, weekly/monthly for long), and a comparison range [fetched for controls; "Your overview" label is snippet] — [Stripe support: Home page charts](https://support.stripe.com/questions/dashboard-home-page-charts-for-business-insights), [Stripe Web Dashboard docs](https://docs.stripe.com/dashboard/basics)
- Conflict: a third-party teardown claims Stripe's home is deliberately fixed to five numbers with sparklines and no "add metric" button [snippet] — [925 Studios breakdown](https://www.925studios.co/blog/stripe-dashboard-design-breakdown); contradicted by Stripe's own docs describing Add/Edit widgets — [Stripe Web Dashboard docs](https://docs.stripe.com/dashboard/basics). Prefer the Stripe docs.

**Linear [fetched]**
- Stated aim of the 2024 redesign: "reduce visual noise, maintain visual alignment, and increase the hierarchy and density of navigation elements." (Karri Saarinen et al., March 28, 2024) — [How we redesigned the Linear UI (part II)](https://linear.app/now/how-we-redesigned-the-linear-ui)
- Structure: an "inverted L-shape" global chrome (sidebar + top) that controls the content of the main view; views are composed of headers for filters/display options, side panels for meta properties, and multiple display modes (list, board, timeline, split, fullscreen) — [How we redesigned the Linear UI (part II)](https://linear.app/now/how-we-redesigned-the-linear-ui)
- Alignment: labels, icons, buttons aligned vertically and horizontally in sidebar and tabs — something users "feel after a few minutes of using the app" rather than notice — [How we redesigned the Linear UI (part II)](https://linear.app/now/how-we-redesigned-the-linear-ui)
- Colour: themes generated in LCH from three inputs (base colour, accent colour, contrast) instead of 98 variables; blue tint in chrome reduced for "a more neutral and timeless appearance"; text and neutral icons made darker in light mode and lighter in dark mode; elevation hierarchy worked out with black/white opacities — [How we redesigned the Linear UI (part II)](https://linear.app/now/how-we-redesigned-the-linear-ui)
- Typography: Inter Display for headings to "add more expression to our headings while maintaining their readability"; regular Inter for everything else — [How we redesigned the Linear UI (part II)](https://linear.app/now/how-we-redesigned-the-linear-ui)
- March 12, 2026 refresh: "Navigation sidebars are slightly dimmer, allowing the main content area to stand out." "Icons across the app have been redrawn and resized." "Headers, navigation, and view controls are now consistent across projects, issues, reviews, and documents." Goal: "make it easier to scan information" — [Linear changelog 2026-03-12](https://linear.app/changelog/2026-03-12-ui-refresh)
- 2024 changelog framing: improve "hierarchy, balance, and density" of all interface elements [snippet] — [Linear changelog 2024-03-20](https://linear.app/changelog/2024-03-20-new-linear-ui)

**Vercel [fetched for design.md; snippet for changelog]**
- Note on source: `vercel.com/design.md` is Vercel's published brand/document guidance (token names prefixed `--vbg-`), not a spec of the dashboard app. Use as principle, not as dashboard measurement — [vercel.com/design.md](https://vercel.com/design.md)
- Grid: 12 columns desktop, 6 tablet, 4 mobile. Prose spans 6-7 columns; tables, charts, diagrams and major comparisons may use up to 12 — [vercel.com/design.md](https://vercel.com/design.md)
- Spacing tiers by relationship (token steps, pixel values not given): within a group = space-2 to space-4; between groups = space-6 to space-8; major section turns = space-8 to space-12; space-16 reserved for a chapter break — [vercel.com/design.md](https://vercel.com/design.md)
- Three border strengths only (subtle / default / strong); gradients, glows, glass, textures and ornamental shadows prohibited; restrained radii; sentence-case headings, no all-caps eyebrows; Geist + Geist Mono loaded at weights 400-600 only; prose measure about 60-68 characters — [vercel.com/design.md](https://vercel.com/design.md)
- Tables: "normal density for ordinary tables; compact only for dense lookup"; full 12-column width by default; baseline alignment in body cells — [vercel.com/design.md](https://vercel.com/design.md)
- Geist Mono "prioritizes readability in code and tabular content" [snippet] — [Geist font](https://vercel.com/font)
- Observability: an overview page where each metric is a starting point with one-click access to its dedicated dashboard; Functions dashboard gained "quick-view tiles with key metrics" [snippet] — [Overview page in Observability](https://vercel.com/changelog/overview-page-in-observability), [Functions at-a-glance insights](https://vercel.com/changelog/vercel-observability-for-functions-now-offers-at-a-glance-key-insights)

### Inferences
- Stripe's numbers give a usable baseline for a hotel app: 180px chart in overview cards, 320px for the single featured chart, never more than 3 charts across, and a 2/3 + 1/3 split when one chart is primary. On a ~1200px content column, a 1/3 card is roughly 380px, well above the 200px floor.
- The Stripe KPI tile is three lines (label / value / 24x80 sparkline). A "KPI rail" for a hotel should stay at that anatomy plus at most one delta; anything more belongs on the detail view.
- All three products get separation from tiered spacing and tonal surfaces (dim sidebar, container vs surface backgrounds) and reserve borders for a small, fixed set of strengths. Linear's 2026 move (dimmer navigation) is a cheap way to make content feel more spacious without adding pixels.
- Vercel's "2-4 / 6-8 / 8-12" spacing tiers imply roughly a 2x jump between intra-card and inter-card spacing, and another step for section breaks. That ratio matters more than the absolute values.
- Tabular numbers in a mono or tabular-figure face is a shared convention for tables.

### Gaps
- Stripe does not publish pixel values for its spacing tokens (`xxsmall` … `xxlarge`), font tokens (`caption`, `subtitle`), page max-width, or primary/secondary column ratio in the pages fetched. No Stripe design-team post on a Dashboard home redesign rationale was found.
- Stripe Payments list and Billing overview specifics (row height, columns, filter chips) were not verified in this pass; the `filter-controls` and `lists` pattern pages exist but were not fetched.
- Linear publishes no font-size scale, row heights, or spacing values. The 2026 changelog does not describe border, spacing or typography changes.
- Vercel's exact Geist dashboard type scale and spacing pixel values were not obtained. Community "Vercel-inspired DESIGN.md" files list values (e.g. 14px body / 20px line height) but are third-party and unverified, so they are excluded.
- No Vercel Web Analytics panel-layout description was found.

---

## 3. Amplitude, Mixpanel, Datadog, Tableau Pulse, Power BI: overview vs detail, and how AI insights sit next to charts

### Takeaway
The builder-style tools converge on a 12-unit row grid with a hard cap on items per row (Mixpanel and Amplitude: 4; Mixpanel minimum card width 3/12) and a small set of fixed row heights. The newer "metric-first" products (Tableau Pulse, Amplitude's Dashboard Agent) put a text summary at the top, then metric cards showing value + change, then a detail page with a single chart, a breakdown tab, and question-driven insights that carry source references.

### Cited Findings

**Mixpanel Boards [snippet — official docs, not opened]**
- Content is arranged in rows; up to four cards (reports or text) per row; content expands to fill the row's width — [Mixpanel Boards docs](https://docs.mixpanel.com/docs/boards)
- Cards snap to positions 1/12th of the row width; minimum card width is 3/12 — [Mixpanel Boards docs](https://docs.mixpanel.com/docs/boards)
- Row height is initially set by the tallest card in the row; text cards grow with content; text cards support title / subtitle / text sizes and lists — [Mixpanel Boards docs](https://docs.mixpanel.com/docs/boards)

**Amplitude [snippet — mixed quality]**
- Dashboard rows use fixed heights of 375, 500, 625 or 750px; charts span 3-12 columns; rich text blocks serve as section headers/context. Source is a third-party registry copy of Amplitude's builder skill, not Amplitude docs — [tessl registry: amplitude create-dashboard](https://tessl.io/registry/skills/github/amplitude/builder-skills/create-dashboard)
- Max 4 items per row; a lone chart in a row cannot be narrowed because that would leave blank space; blank-space spacers are not supported (community thread, may be dated) — [Amplitude Community](https://community.amplitude.com/discussion/6524/decease-chart-width-button-where-did-it-go)
- AI: Chart Chat is an assistant inside charts for summaries and follow-up questions — [Amplitude Chart Chat release](https://amplitude.com/releases/chart-chat)
- AI: Dashboard Agent produces (1) a summary with top overall insights and (2) a section on week-over-week differences; post-processing adds citations and links so users can verify results; summaries can be pushed to email or Slack. Vendor marketing, not independently verified — [Dashboard agent enhancements](https://www.amplitude.com/releases/dashboard-agent-enhancements), [Amplitude AI Builders](https://www.amplitude.com/blog/ai-builders-janaki-vivrekar)

**Datadog [fetched blog, 2021 — older but still the documented model; grid width is snippet]**
- Dashboards are "built on top of a fully responsive grid that will scale to fit any screen size"; widgets snap to the grid; a slightly oversized widget "squeezes" to fit; a "Row" action auto-aligns and resizes selected widgets to full grid width (May 20, 2021) — [Datadog: new dashboards experience](https://www.datadoghq.com/blog/datadog-dashboards/)
- Groups: widgets are grouped under a header; clicking the header collapses/expands; all groups can be collapsed at once; "partial width groups" let groups of different sizes sit side by side — [Datadog: new dashboards experience](https://www.datadoghq.com/blog/datadog-dashboards/)
- High density mode: on wide screens it positions the top and bottom halves of the dashboard side by side; on by default on large monitors, with a toggle — [Datadog: new dashboards experience](https://www.datadoghq.com/blog/datadog-dashboards/)
- Each widget can carry its own timeframe — [Datadog: new dashboards experience](https://www.datadoghq.com/blog/datadog-dashboards/)
- Dashboards have a maximum width of 12 grid squares [snippet] — [Datadog dashboards docs](https://docs.datadoghq.com/dashboards/?lang_pref=en)

**Tableau Pulse [fetched docs; card contents partly snippet]**
- Insight summary: "appears at the top of your home page and in your digests"; "generates when you follow two or more metrics"; individual metrics can be muted from the summary without unfollowing — [Tableau Pulse: explore metrics](https://docs.salesforce.com/tableau/current/en-us/online/pulse_explore_metrics.md)
- Home organisation: sort and filter, group by metric definition or data source, filter to favourites — [Tableau Pulse: explore metrics](https://docs.salesforce.com/tableau/current/en-us/online/pulse_explore_metrics.md)
- Metric cards show the current value and percentage change from the prior comparison period; cards on the Following tab also show goal and threshold information [snippet] — [About Tableau Pulse](https://help.tableau.com/current/online/en-gb/pulse_intro.htm)
- Detail page header shows: current value, percentage change from prior period, applied filters, and insights about the metric. Two tabs: Overview ("shows a line chart of your metric's performance") and Breakdown ("shows you how different values in your metric are contributing to the total value") — [Tableau Pulse: explore metrics](https://docs.salesforce.com/tableau/current/en-us/online/pulse_explore_metrics.md)
- Guided Q&A: Pulse surfaces a question for each insight it detects; an Ask button accepts free questions and ranks semantic matches; the answer page shows "key insights, relevant visualizations, source references, and suggested follow-up questions" — [Tableau Pulse: explore metrics](https://docs.salesforce.com/tableau/current/en-us/online/pulse_explore_metrics.md)
- Digest: daily / weekly / monthly (default weekly) via email, Slack, Teams; a digest gives summary visualisations and text for top insights with links to details; newer email layout is described as compact so more metrics fit on screen [frequency fetched; layout note snippet] — [Tableau Pulse: explore metrics](https://docs.salesforce.com/tableau/current/en-us/online/pulse_explore_metrics.md), [About Tableau Pulse](https://help.tableau.com/current/online/en-gb/pulse_intro.htm)
- Shared-metric unfurl in Slack shows "a snapshot of the metric, the metric value and comparison, the top insights, and any alerts" — [Tableau Pulse: explore metrics](https://docs.salesforce.com/tableau/current/en-us/online/pulse_explore_metrics.md)

**Power BI [fetched]**
- New card visual (GA November 2025, replaces legacy single card and multi-row card): each card has three sections — callout (the value), image, reference labels (context such as variance or target, each with an optional detail value) — in configurable order and arrangement — [Power BI card visual](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-new-card)
- Defaults at GA: card padding raised to 12px ("more padding and padding options were added… The new default is 12px"); reference labels get their own area and "take up 50% of the card by default"; callout size adjustable (walkthrough uses 40% with a trend image beside it) — [Power BI card visual](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-new-card)
- Multi-card layout: "Fit to space" grows/shrinks cards to fill the container (max 4 rows while on); "Fixed size" gives exact pixel dimensions and adds scrollbars when the container is too small — [Power BI card visual](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-new-card)
- Number formatting: callout uses Auto display units by default (11,732 shown as 12K) — [Power BI card visual](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-new-card)
- In-card trend: the documented pattern renders a 6-point trend as an image beside the callout, with a richer hover state (shaded rise/fall segments, value labels) — detail is disclosed on hover, not at rest — [Power BI card visual](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-new-card)
- Conditional formatting is used to draw attention to specific cards (e.g. highlight revenue below target) — [Power BI card visual](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-new-card)

### Inferences
- "Max 4 per row, min 3/12 wide" is the de facto cap across two major product-analytics tools; Stripe is stricter at 3 for charts. For a hotel board builder: 12-column rows, min tile 3/12, max 4 KPI tiles or 3 charts per row.
- Fixed row-height presets (Amplitude's 375/500/625/750, a 125px step) keep boards aligned without users dragging heights; Stripe's 180/320 chart heights play the same role for curated pages.
- Tableau Pulse is the closest analogue to a hotel "morning brief": text summary on top (only when there are at least 2 metrics), then cards with value + change (+ goal), then one chart per metric on a detail page with Overview/Breakdown tabs. Evidence for AI answers is structured as insights → visualisation → source references → follow-up questions; this maps directly onto an "AI chat with evidence" panel.
- Both Tableau and Amplitude place AI text above or beside the chart and link back to the underlying chart/metric; neither is documented as replacing the chart with prose.
- Power BI's move to 12px default padding and a dedicated reference-label area suggests even the densest BI tool decided its KPI cards were too tight; the value/context split (callout vs reference labels) is a reusable KPI-tile anatomy: big value, then one or two small labelled reference numbers (vs budget, vs last year).
- Datadog's collapsible groups and per-widget timeframes are the ops-console answer to density: sections are visible as headers and expand on demand, which fits an operations view (housekeeping, arrivals, maintenance) better than a flat grid.

### Gaps
- Mixpanel and Amplitude layout numbers are from search snippets; the Amplitude row heights come from a third-party registry copy and the 4-per-row cap from an undated community thread. Re-verify against current docs before treating as fact.
- No results at all for Mixpanel's AI (Spark) or Datadog Bits AI presentation patterns.
- Tableau publishes no card dimensions, cards-per-row, or number of insights per metric. I found no dedicated Tableau Pulse design blog post; only help docs.
- Power BI's dedicated KPI visual (indicator / trend axis / target goal) was not fetched; Power BI Copilot narrative/summary placement was not researched.
- Datadog's best-practices guide URL I tried returned 404; no Datadog widget size recommendations (e.g. typical 4x2, 6x3) were confirmed. The 2021 blog is old; the group/high-density model appears unchanged but this was not re-verified against 2026 docs.

---

## 4. Common anti-patterns that make dashboards feel cramped

### Takeaway
The vendor guidance that exists is consistent: same-size everything, too many items per row, chart variety for its own sake, mismatched heights and time frames, unnecessary data labels, and long unrounded numbers are what create the cramped feeling — more than raw item count. Sourcing for this section is thinner than the others (mostly Microsoft and Stripe plus secondary articles).

### Cited Findings
- Equal weight: "If the text and visualizations on your report page are all the same size, your readers might have a hard time focusing on what's most important." — [Power BI tips for creating reports](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-tips-and-tricks-for-creating-reports) [fetched]
- One screen: "Each report page should tell a story at a glance. Can you avoid scroll bars on your pages? Is the report too cluttered or too busy? Remove all but essential information" — [Power BI tips for creating reports](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-tips-and-tricks-for-creating-reports)
- Placement: "put the highest level of detail at the top. Show more detail as you move in the direction the audience uses for reading" — [Power BI tips for creating reports](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-tips-and-tricks-for-creating-reports)
- Chart variety: "Avoid using a variety of visualizations just for the sake of variety." Circular charts (pie, donut, gauge) are harder to read; pie charts best under eight categories — [Power BI tips for creating reports](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-tips-and-tricks-for-creating-reports)
- Number length: "Don't exceed three or four numerals when displaying numbers… use 3.4 million instead of 3,400,000." — [Power BI tips for creating reports](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-tips-and-tricks-for-creating-reports)
- Mixed time frames: "Don't have one chart that has last month next to filtered charts from a specific month of the year." Also be consistent with axis scales, dimension ordering, and colours across charts — [Power BI tips for creating reports](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-tips-and-tricks-for-creating-reports)
- Label clutter: "Avoid cluttering your charts with data labels that aren't needed." — [Power BI tips for creating reports](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-tips-and-tricks-for-creating-reports)
- Too many per row: no more than three charts in a row; unreadable below roughly 200px — [Stripe chart layout](https://docs.stripe.com/stripe-apps/patterns/chart-layout.md) [fetched]
- Mismatched heights: charts in the same row/section should share one height; loading/empty/error states must keep the same height to avoid jumps — [Stripe chart layout](https://docs.stripe.com/stripe-apps/patterns/chart-layout.md)
- Everything at once: "Don't overwhelm users with all information at once." — [Stripe full-page apps](https://docs.stripe.com/stripe-apps/patterns/full-page-apps.md) [fetched]
- Decoration: gradients, glows, glass, textures and ornamental shadows are prohibited in Vercel's guidance; compact table density only for dense lookup — [vercel.com/design.md](https://vercel.com/design.md) [fetched]
- Secondary sources [snippet]: too many KPIs leads to "dashboard fatigue"; one article suggests roughly five to nine visualisations per dashboard and splitting beyond that — [TechTarget: 10 dashboard design principles](https://www.techtarget.com/data-technologies/tip/10-dashboard-design-principles-and-best-practices); absence of white space hinders interpretation — [Packt: common mistakes in dashboard design](https://www.packtpub.com/en-us/product/creating-actionable-insights-using-crm-analytics-14-9781801074391/chapter/chapter-11-best-practices-in-dashboard-design-using-crma/common-mistakes-in-dashboard-design); avoid using colours or background fills to partition a dashboard (citing Stephen Few's "simplify") — [Dummies: keep it simple](https://www.dummies.com/article/technology/software/microsoft-products/excel/excel-dashboard-design-principle-keep-it-simple-138440)
- Counterpoint [snippet]: a dashboard consultant argues that limiting dashboards to only the "most important" metrics is not always reasonable; the real problem is showing many metrics without visual overload — [Goodreads author blog](https://www.goodreads.com/author_blog_posts/25158937-dashboards-should-only-show-the-most-important-metrics-right?tab=book)

### Inferences
- "Too many borders" as an anti-pattern is supported indirectly rather than by a direct quote: Vercel limits borders to three strengths, Stripe recommends a background (not a border) for emphasis, Linear dims chrome instead of outlining content, and Few-derived advice warns against fills used purely for partitioning. No fetched source states "avoid borders" outright.
- A practical checklist for a hotel dashboard: (1) one hero element per screen, sized visibly larger; (2) max 4 KPI tiles or 3 charts per row; (3) one height per row; (4) one shared time frame per section, stated once in the section header rather than per card; (5) abbreviate numbers to 3-4 digits (e.g. "€48.2K", "82.4%"); (6) cap in-card lists at 5 with "View all"; (7) spacing tiers instead of card outlines; (8) one chart type per row where possible.
- The "five to nine visualisations" figure and the counterpoint together suggest the real constraint is hierarchy, not count: GA4 and Pulse show many metrics but only one or two at full visual weight.

### Gaps
- Stephen Few's list of thirteen dashboard mistakes and any Nielsen Norman Group dashboard guidance were not retrieved; the search returned no NN/g material.
- No quantitative evidence (studies, usability data) was found linking specific spacing or border choices to perceived spaciousness.
- "Mixed chart types per row" as an anti-pattern is only supported by the general Power BI "variety for its own sake" guidance, not by a rule specific to rows.

---

## 5. Public design notes from these companies (redesign rationale, design blogs)

### Takeaway
Linear is the only company in the set with detailed, first-party redesign rationale (2024 posts plus a 2026 refresh changelog). Stripe's most concrete public material is its Apps design patterns, which codify Dashboard conventions. For GA4, Tableau Pulse, Datadog, Amplitude and Mixpanel, I found product docs and release notes but no design-rationale posts.

### Cited Findings
- Linear, "How we redesigned the Linear UI (part II)", March 28, 2024, by Karri Saarinen with Yann-Edern Gillet, Andreas Eldh, Romain Cascino: project took "about six weeks", shipped behind feature flags, rolled out to "a percentage of workspaces each day"; goal was an evolution, not a teardown; navigation restructuring was deliberately deferred to limit scope — [Linear](https://linear.app/now/how-we-redesigned-the-linear-ui) [fetched]
- Linear UI refresh, March 12, 2026: dimmer sidebars, redrawn/resized icons, consistent headers and view controls across object types — [Linear changelog](https://linear.app/changelog/2026-03-12-ui-refresh) [fetched]
- Other Linear posts exist but were not opened: [A design reset](https://linear.app/now/a-design-reset), [Behind the latest design refresh](https://linear.app/now/behind-the-latest-design-refresh) [snippet — titles only]
- Stripe: Apps patterns state the aim to "Follow the layout and navigation patterns used by native Stripe Dashboard pages" and give chart heights said to match Dashboard metric cards and analytics detail views — [Stripe full-page apps](https://docs.stripe.com/stripe-apps/patterns/full-page-apps.md), [Stripe chart layout](https://docs.stripe.com/stripe-apps/patterns/chart-layout.md) [fetched]
- Stripe has a "Dashboard update: May 2024" support note [snippet — not opened] — [Stripe support](https://support.stripe.com/questions/dashboard-update-may-2024)
- Vercel: Geist is documented as covering colours, typography, materials, layout (grid listed as a core part of the aesthetic) and components [snippet] — [Geist Design System](https://vercel.com/geist); markdown design guidance at [vercel.com/design.md](https://vercel.com/design.md) [fetched]
- Datadog: 2021 engineering/product post introducing the unified grid dashboard (merging Timeboards and Screenboards), groups, and high density mode — [Datadog blog](https://www.datadoghq.com/blog/datadog-dashboards/) [fetched]
- Power BI: the card visual doc includes a "Default behavior changes from preview" section explaining why defaults changed at GA (more padding, separate reference-label area, Fit to space) — effectively a public rationale for the KPI card redesign — [Power BI card visual](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-new-card) [fetched]
- Microsoft points readers to Miguel Myers' "How to design visually stunning reports" as its recommended design reference [not opened] — [Power BI blog](https://powerbi.microsoft.com/blog/how-to-design-visually-stunning-reports/)
- Amplitude: engineering-side notes on its automated-insights agent (citations added in post-processing) — [Amplitude AI Builders](https://www.amplitude.com/blog/ai-builders-janaki-vivrekar), [Introducing automated insights](https://www.amplitude.com/blog/introducing-automated-insights) [snippet]

### Inferences
- Linear's process notes are transferable beyond visuals: scope the redesign to chrome + hierarchy first, defer navigation restructuring, ship behind a flag with an old/new toggle. Relevant if the hotel app's layout is being reworked incrementally.
- The most actionable "design notes" for layout numbers are documentation, not blog posts (Stripe Apps patterns; Power BI card defaults; Mixpanel/Amplitude board rules).

### Gaps
- No GA4 redesign rationale, no Tableau Pulse design blog, no Stripe Dashboard design-team write-up, and no Mixpanel Boards design post were found in this pass. Their existence is not ruled out; only one search per vendor was run.
- Conference talks were not searched.
- Mobbin-style screenshot teardowns were not consulted, so there are no measured values (card widths, gutters, items above the fold) for any product. This is the main limitation of these notes: measurements are limited to what vendors document (Stripe 180/320/24x80/200px floor; Power BI 12px padding and 50% label area; Mixpanel 3/12 minimum and 4 per row; Amplitude 375-750px rows; 12-column grids at Looker Studio, Datadog, Vercel).
