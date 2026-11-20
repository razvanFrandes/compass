# Filters and data-slicing controls for Compass (hotel-group analytics + AI assistant)

Researched 2026-11-20. This note covers the filter layer only; charts are covered in a separate note. Conventions: a "Mobbin screen" finding is my reading of the screenshot at that URL. "(via search summary)" means the claim came from a search engine's summary of that URL rather than a direct page read, so treat it as lower confidence. **[our call]** marks my own synthesis or recommendation, not a sourced fact.

---

## 1. Global filter bar vs per-chart filters vs filter panels: when does each win, and how do leading products do it?

### Takeaway
Every mature BI tool I checked uses the same three layers:
1. A dashboard-wide (global) filter bar sets the default context.
2. Per-widget overrides take precedence over the global value, and the better products make the override visible.
3. An overflow or side panel holds the long tail of rarely used filters.

Hotel BI uses exactly this layering: Mews Business Intelligence has a top filter bar that applies to the whole dashboard, plus per-visualization filters that can override it. For Compass, the global bar should hold the hotels, stay dates and comparison. Per-widget overrides should be the exception, mainly for widgets that need a different date lens (for example the pickup or booking window), and should always be badged on the widget.

### Cited Findings

#### Looker (Google Cloud)
- The filter bar can sit "at the top or the right of the dashboard", with top as the default. "Default filters view" is "Expanded" or "Collapsed", with "Expanded" as the default. — [Looker docs: dashboard filters](https://docs.cloud.google.com/looker/docs/filters-user-defined-dashboards)
- Each filter has a "Display" setting: **Inline** (shown in the bar), **Popover** (a summary value that opens the full control) or **More** (overflow). Looker's guidance: "Generally, we recommend that important or frequently used filters be displayed as inline or popover, and less frequently used filters be displayed as overflow." — [Looker docs](https://docs.cloud.google.com/looker/docs/filters-user-defined-dashboards)
- Control types and limits:
  - Multi-select: "Button Group" (up to 30 options), "Checkboxes" (up to 50), "Tag List", "Range Slider".
  - Single-select: "Button Toggles" (up to 30), "Radio Buttons" (up to 50), "Drop-down Menu", "Slider".
  - Dates: "Single Day", "Date Range", and "Timeframes" (which has a "Custom" tab).
  - Other: "Advanced".
  - [Looker docs](https://docs.cloud.google.com/looker/docs/filters-user-defined-dashboards)
- Scope is set per filter under "Tiles To Update". By default a filter applies to tiles from the same Explore. You can pick All or None, or choose a "Field to Filter" per tile. — [Looker docs](https://docs.cloud.google.com/looker/docs/filters-user-defined-dashboards)
- Linked filters ("Select filters to update when this filter changes") narrow a child filter's options from the parent's value. Linking is one-directional. — [Looker docs](https://docs.cloud.google.com/looker/docs/filters-user-defined-dashboards)
- Cross-filters (created by clicking data points) have the highest precedence. They override visualization-level, dashboard-level and query-level filters on the same field. — [Looker docs](https://docs.cloud.google.com/looker/docs/filters-user-defined-dashboards)
- With "Require a filter value", "the dashboard won't run until you select a filter value." Viewers can "temporarily update dashboard filter values" without affecting other users. — [Looker docs](https://docs.cloud.google.com/looker/docs/filters-user-defined-dashboards)

#### Power BI
- The Filters pane has visual-level, page-level and report-level sections. Adding a visual adds a visual-level filter for each of its fields. Doc updated 2026-11-17. — [MS Learn: Format filters in Power BI reports](https://learn.microsoft.com/en-us/power-bi/create-reports/power-bi-report-filter)
- "Report readers can hover over a visual and select the filter icon to see a read-only list of filters and slicers affecting it." — [MS Learn](https://learn.microsoft.com/en-us/power-bi/create-reports/power-bi-report-filter)
- Authors can **Lock** a filter (visible but not editable) or **Hide** it, for example "data cleanup filters that exclude nulls". — [MS Learn](https://learn.microsoft.com/en-us/power-bi/create-reports/power-bi-report-filter)
- "By default, readers' filter selections persist between visits." Search in the Filters pane is on by default. — [MS Learn](https://learn.microsoft.com/en-us/power-bi/create-reports/power-bi-report-filter)
- An optional single **Apply** button is off by default. It is enabled under Query reduction with "Add a single Apply button to the filter pane to apply changes at once". — [MS Learn](https://learn.microsoft.com/en-us/power-bi/create-reports/power-bi-report-filter)
- "Publish to web doesn't display the Filters pane. Add slicers if readers need to filter a report published this way." Slicers are on-canvas controls; the pane is a side panel. — [MS Learn](https://learn.microsoft.com/en-us/power-bi/create-reports/power-bi-report-filter)

#### Tableau
- Scope is set with "Apply to Worksheets": "All Using Related Data Sources", "All Using This Data Source", "Selected Worksheets" or "Only This Worksheet". "Only This Worksheet" is the default for new filters.
- On dashboards, Selected worksheets → "All on dashboard" filters every sheet that shares the data source.
- Filter cards show their scope with icons: a data-source icon or a worksheet icon. Local filters have no icon. "All Using" filters are "global across the workbook".
- Source: [Tableau Help: Apply filters to multiple sheets](https://help.tableau.com/current/pro/desktop/en-us/filtering_global.htm)

#### Metabase
- Filter widgets can sit in three places:
  - **Dashboard-level**, in the header, connected to cards across tabs.
  - **Header-level**, on a heading card, scoped to the cards in that section.
  - **Card-level**, on a single question card.
  - The docs advise preferring dashboard-level widgets unless the dashboard is too large to split up. — [Metabase docs: dashboard filters](https://www.metabase.com/docs/latest/dashboards/filters)
- Changing a filter refreshes the dashboard by default. Authors can turn off **Auto-apply filters** (under … → Edit settings), after which viewers click **Apply**. — [Metabase docs](https://www.metabase.com/docs/latest/dashboards/filters)
- **Always require a value** forces a default. Metabase suggests it for limiting costly queries or scoping a dashboard to one customer. — [Metabase docs](https://www.metabase.com/docs/latest/dashboards/filters)
- The "Time grouping" parameter changes granularity (day, week, month, …) without filtering data. — [Metabase docs](https://www.metabase.com/docs/latest/dashboards/filters)

#### PostHog
- New dashboards default to "No date range override", so each insight keeps its own range. Setting a dashboard date range makes every insight use it, unless a tile overrides or ignores dashboard filters. — [PostHog docs: Dashboards](https://posthog.com/docs/product-analytics/dashboards)
- Tile-level filters win over the dashboard. Property filters from both levels are combined with AND; if they conflict on the same key, the tile wins. — [PostHog docs](https://posthog.com/docs/product-analytics/dashboards)
- Per-tile controls are "Override tile filters" (Date range, Interval with "inherit", Properties, Breakdown) and "Ignore dashboard filters". — [PostHog docs](https://posthog.com/docs/product-analytics/dashboards)
- To compare segments, PostHog suggests duplicating a dashboard and applying different filters to each copy. — [PostHog docs](https://posthog.com/docs/product-analytics/dashboards)

#### Databricks AI/BI dashboards (current 2025–2026 behaviour)
- 2025 changes — [AI/BI release notes 2025](https://docs.databricks.com/aws/en/ai-bi/release-notes/2025):
  - May 22, 2025: a "global filters panel, which applies across all dashboard pages".
  - Sep 4, 2025: "A new filter bar shows all active filters on a dashboard", including cross-filters.
  - Sep 25, 2025: "The global filters panel now opens by default when users first visit a dashboard."
  - Nov 6, 2025: per-widget filters support date ranges, relative date ranges and number filters.
  - Nov 20, 2025: "Dashboards now support applying multiple filters at the same time alongside the default instant application."
- 2026 changes — [AI/BI release notes 2026](https://docs.databricks.com/aws/en/ai-bi/release-notes/2026):
  - Sep 10, 2026: "each widget now responds only to filters whose dataset is related to it".
  - Sep 24, 2026: authors can "configure a dashboard widget to ignore selected dashboard filters".
  - Nov 12, 2026: "Authors can now turn off associative filtering between dashboard filters."

#### Mews Business Intelligence (hotel PMS analytics)
- Dashboard filters sit in the top filter bar and apply to the whole dashboard by default. Examples: "Accounting category," "Date," "Property". On the Pickup dashboard, the time filter is labelled "Date of stay". — [Mews Help: Using filters in Mews BI](https://help.mews.com/s/article/Using-filters-in-Mews-Business-Intelligence)
- Visualization filters are set inside one chart via "Explore from here" → Filters. They apply only to that chart, don't appear in the filter bar, and can override the dashboard-level setting. Under **Configuration**, a chart can switch off dashboard filters entirely. — [Mews Help](https://help.mews.com/s/article/Using-filters-in-Mews-Business-Intelligence)
- Users pick values and click **Apply**. **"Reset all filters"** reloads the dashboard's default configuration. — [Mews Help](https://help.mews.com/s/article/Using-filters-in-Mews-Business-Intelligence)
- Mews warns that including "Cancelled" or "No show" reservations can inflate occupancy, so default filter values carry meaning. Data refreshes every two hours. — [Mews Help](https://help.mews.com/s/article/Using-filters-in-Mews-Business-Intelligence)

#### Product UIs (Mobbin screens)
- **Semrush:** a single global row of dropdowns, each showing its current value: "Worldwide ▾ | Apr 2026 ▾ | Monthly ▾ | All devices ▾", above all report cards. — [Mobbin screen: Semrush](https://mobbin.com/screens/f8548434-b4ef-4e67-a360-72feb07a9003?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Wix Analytics:** a labelled control strip: "Select a time period" (Last 30 Days), "Compare to" (None | Previous period | Last year), "Group by" (Day | Week | Month), "Select a measure". — [Mobbin screen: Wix](https://mobbin.com/screens/5d4a9582-7abb-47d8-b555-021df563a0ec?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Stripe Payments analytics:** a date preset ("Last 12 months"), a granularity select ("Monthly"), and dashed add-filter pills "⊕ Card type", "⊕ Card country", "⊕ Card brand", "⊕ Interaction type". Inactive dimensions are offered as pills rather than hidden in a menu. — [Mobbin screen: Stripe](https://mobbin.com/screens/8bba78c1-0d19-450b-a0f3-361e3fb8375f?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Calendly Analytics:** the date control ("Last 30 days") is a separate button from a generic "Filters" button. — [Mobbin screen: Calendly](https://mobbin.com/screens/1d417c2e-234a-4bf0-a87e-dc65703c2b64?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)

#### Design systems
- **Shopify Polaris IndexFilters:** promote the most-used filter categories, with "no more than 2 or 3 promoted filters"; the rest are added on demand. — [Polaris IndexFilters source (GitHub)](https://raw.githubusercontent.com/Shopify/polaris/main/polaris.shopify.com/content/components/selection-and-input/index-filters.mdx)
- **PatternFly** — [PatternFly: Filters design guidelines](https://www.patternfly.org/patterns/filters/design-guidelines):
  - Filters go in a left-aligned toolbar.
  - Filters across categories combine with AND; values within a category combine with OR.
  - Use a filter group "only when space allows".
  - Use a toggle group for a few options that should stay visible, "such as chart data points".
- **Cloudscape:** filters must operate on "the full collection of resources, and not just the visible resources". — [Cloudscape: Filter patterns](https://cloudscape.design/patterns/general/filter-patterns/)

### Inferences
- **[our call]** When each layer wins:
  - **The global bar wins** when every widget answers the same "who / when / compared to what" question. On a hotel dashboard that is the hotels, the stay dates and the comparison.
  - **Per-widget filters win** when one chart needs a different lens. For example, a pickup chart needs a booking window ("Pickup period", as in Mews), and a 12-month trend should ignore a 30-night range.
  - **A side panel or overflow wins** for the long tail: room type, rate plan, length of stay, nationality, booking source, reservation status.

  Looker, Mews, PostHog and Databricks all implement this with "widget overrides global" precedence.
- **[our call]** Proposed Compass desktop bar (sticky under the page title):
  ```
  [All hotels (20) ▾] [Stay dates: Next 30 nights ▾] [vs Same time last year ▾] [Segment ▾] [Channel ▾] [+ Filter]  …  [View: Group overview ▾] [Reset]
  ```
  - Segment and Channel are the 2–3 promoted filters (Polaris cap). Everything else goes behind "+ Filter".
  - A second row of removable tokens appears only when optional filters are active.
- **[our call]** Any widget that overrides or ignores a global filter gets a visible badge in its header, such as "Own dates" or "All hotels". Hover or click shows the read-only list of filters affecting it (the Power BI pattern) plus a "Use dashboard filters" reset. Silent overrides are the main source of "why don't these numbers match?" confusion. The sources show the override mechanism; this risk is my inference.
- **[our call]** Default reservation-status filtering (exclude cancelled and no-show from occupancy) should be a locked or hidden default rather than a user-facing chip. This follows Power BI's "Hide filter" for cleanup filters and Mews's inflation warning.

### Gaps
- Mixpanel's and Amplitude's dashboard-level filter precedence was not researched.
- Hex dashboards and apps: only search-summary evidence (see Q5).
- Stripe Dashboard's own filter documentation was not retrieved; I only have the Mobbin screen.
- The IBM Carbon filtering pattern page could not be fetched (domain blocked for the fetch tool).
- The Cloudscape *component* usage tabs (property filter, date range picker) are client-rendered and could not be read; only the Cloudscape *pattern* pages were readable.

---

## 2. Date range pickers for analytics: presets, stay date vs booking date, and "compare to"

### Takeaway
The best analytics products treat "date range" and "compare to" as two adjacent, separately labelled controls. Each trigger shows its resolved value: Shopify shows "Today" next to "Yesterday"; Plausible shows "Wed, 30 Sep vs Thu, 01 Oct"; Wix shows "Aug 7 - Today • Compared to Jul 8 - Aug 6, 2024". They offer named presets with the resolved dates next to each one, and draw the comparison as a dashed or faded series plus delta badges.

Hotel tools add three things that generic tools lack:
1. Forward-looking presets, such as Cloudbeds' "Next 7 Days" and "Next 30 Days".
2. An explicit choice of *which* date the filter means. Mews offers "Reservation created time", "Reservation stay date" and "Consumption time"; Cloudbeds lets you filter on Check-In, Booking or Check-Out Date. Mews also offers "Date of stay" and "Pickup period" as two separate filters.
3. Hospitality baselines: same time last year (STLY, measured at the same lead time), same *day* vs same *date* last year, budget, and forecast.

### Cited Findings

#### Presets in shipped products
- **Shopify Analytics** — [Shopify Help: Setting and comparing time ranges](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/using-reports/time-ranges); [Mobbin screen: Shopify Analytics](https://mobbin.com/screens/ed30db83-eeb4-4676-8bef-19e64c8ab414?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp):
  - The preset sidebar has "Today", "Yesterday", "Last …" (rolling: a unit plus a "Last #" value), "Period to date", "Black Friday Cyber Monday", "Quarters" and "Custom range".
  - "Include current period" is on by default for rolling ranges.
  - In the UI, the range and comparison are two pills ("Today", "Yesterday") followed by a currency pill.
  - The popover has the preset list on the left, start → end inputs, a two-month calendar, and Cancel / Apply. Apply stays disabled until something changes.
  - The page header shows "Last refreshed: 8:55 PM".
- **Intercom (Fin performance)** — [Mobbin screen: Intercom](https://mobbin.com/screens/6d0b7fa9-347f-453b-9ed0-f5e4c74140c0?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp):
  - Presets: "Today, Yesterday, Past week, Month to date, Past 4 weeks, Past 12 weeks, Year to date, Past 6 months, Past 12 months, Custom".
  - From/To fields, a two-month calendar, Cancel / Apply, and "+ Add filter" next to the date.
  - A time-zone label, "Los Angeles time (GMT-7)", sits at the right of the bar.
- **Cloudbeds Insights (hotel PMS)** — [Cloudbeds: Glossary of Filter Terms and Date Presets](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/32514428045083-Glossary-of-Filter-Terms-and-Date-Presets). Presets are grouped by period, and each is marked fixed or rolling. Forward-looking presets are first-class.

  | Period | Presets |
  |---|---|
  | Day | "Today", "Yesterday", "Tomorrow" |
  | Week | "Current Week", "Last Week", "Next Week", "Last 7 Days", "Next 7 Days" |
  | Month | "Current Month", "Current Month MTD", "Last Month", "Next Month", "Last 30 Days", "Next 30 Days" |
  | Quarter | "Current Quarter", "Current Quarter QTD", "Last Quarter", "Next Quarter" |
  | Year | "Current Year", "Current Year YTD", "Last Year", "Next Year" |
  | Other | "All", "Custom Date", "Custom Date Range" (including "Custom relative dates") |

  A fixed preset resolves to the same range whenever the report runs; a rolling preset "recalculates daily, relative to today".
- **Databricks (Dec 18, 2025):** relative date filters "now include yesterday, last week, last month, and last year". — [AI/BI release notes 2025](https://docs.databricks.com/aws/en/ai-bi/release-notes/2025)
- **Metabase** date filter types: "Month and Year", "Quarter and Year", "Single Date", "Date Range", "Relative Date", "All Options". — [Metabase docs](https://www.metabase.com/docs/latest/dashboards/filters)
- **Mobile preset lists show resolved dates next to each preset:**
  - Linktree: a bottom sheet "Date range" with Cancel / Apply, radio rows "Last 7 days · Apr 01 - Apr 07", "Last 28 days", "Last 90 days", "Last 365 days", and "Custom range ›". — [Mobbin screen: Linktree](https://mobbin.com/screens/48143b7a-36bd-40ba-8c62-3afe24064e32?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
  - Starling: presets grouped by Week / Month / Year with resolved ranges ("This week · Sun 28 June to Wed 1 July"), plus settings links "My week starts: Sunday", "My month starts: 1st", "My year starts: 1st January". — [Mobbin screen: Starling](https://mobbin.com/screens/9ea374e1-6270-494e-8d5f-c0232eca40de?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
  - Squarespace: a segmented control "Day | Week | Month | Year | Custom"; under Month, rows "Month to Date — January", "Last 30 Days — 16 Dec 2024 – 14 Jan 2025" (checked), "Last 60 Days …". — [Mobbin screen: Squarespace](https://mobbin.com/screens/a8bafbb6-872c-4bac-822e-a930b558f104?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
  - Withings marks a default as "Last Month (recommended)". — [Mobbin screen: Withings](https://mobbin.com/screens/38a9a138-3c94-4d8f-b04f-3a23c3e40c02?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)

#### Stay date vs booking date (hospitality)
- **Mews BI** offers three time contexts: "Reservation created time," "Reservation stay date," and "Consumption time". Changing the context updates every date-dependent metric. — [Mews Help: Using filters in Mews BI](https://help.mews.com/s/article/Using-filters-in-Mews-Business-Intelligence)
- **The Mews BI Booking curve dashboard** has *both* "Date of stay" and "Pickup period" as separate filters. Its other filters are "Property group", "Properties", "Services", "Space type", "Space categories", "Rates", "Segments", "Nationality", "Booking source" and "Reservation status". It lets users "Identify which months are ahead of or behind the same period last year". A "Booking windows" view switches between "By top segments" and "By top rates". — [Mews Help: Booking curve and trends dashboard](https://help.mews.com/s/article/The-Booking-curve-and-trends-dashboard-in-Mews-Business-Intelligence)
- **Mews Analytics (the older product):** the Marketing and Bookings tabs' date range is the reservation *creation* date. Stay-period filtering is done through StartDate/EndDate in the Filters panel. — [Mews Help: Manager analytics](https://help.mews.com/s/article/manager-analytics) (via search summary)
- **Cloudbeds Insights:** a date filter applies to a specific field ("Check-In Date", "Booking Date", "Check-Out Date"), and the choice changes the results. — [Cloudbeds: Filters overview](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/6624657379483-Filters-Overview) (via search summary)
- **Lighthouse (formerly OTA Insight)** — [Lighthouse: Booking pickup and pace](https://mylighthouse.com/resources/blog/booking-pickup-and-pace-revenue-management):
  - "Booking pickup measures the net change in reservations for a specific future stay date over a defined period of time."
  - Pace compares how fast bookings build with a benchmark, "most often the same point in time last year".
  - Lighthouse advises reviewing pickup and pace "by date of arrival".
  - Pickup look-back windows: "yesterday, over the past seven days, or over the past 30 days".
  - Users filter by stay date, segment, channel, room type or length of stay.

#### "Compare to": products that do it well, and how they show it
- **Shopify** — [Shopify Help](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/using-reports/time-ranges); [ShopifyQL: COMPARE TO](https://shopify.dev/docs/api/shopifyql/latest/syntax/compare-to):
  - Open the "Compare to" or "No comparison" indicator and pick "Comparison to past": "Previous period", "Previous year", a custom range, or predefined ones (quarters, BFCM).
  - The comparison period is drawn as dotted or faded lines; current data is solid. Comparisons appear in both charts and tables.
  - "Total sales over time" defaults to the past 30 days compared with the previous 30-day period. Other reports have no comparison by default.
  - In ShopifyQL, `COMPARE TO previous_period | previous_year` produces columns suffixed like `comparison_net_sales__previous_year`.
- **Plausible** — [Mobbin screen: Plausible](https://mobbin.com/screens/b6603e7d-2fdd-4e47-9c68-5288dd94c056?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp):
  - The header reads "Wed, 30 Sep ‹ › vs Thu, 01 Oct". The menu offers "Disable comparison / Previous period / Year over year / Custom period".
  - Each KPI tile shows the current value with a %-change arrow (e.g. "4 ↗300%") and its date, then the comparison value with its date beneath ("1 · Thu, 01 Oct").
  - The chart draws the comparison as a lighter series.
- **Wix Analytics:** a segmented "Compare to: None | Previous period | Last year", with the page subtitle "Aug 7 - Today • Compared to Jul 8 - Aug 6, 2024". — [Mobbin screen: Wix](https://mobbin.com/screens/5d4a9582-7abb-47d8-b555-021df563a0ec?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Klaviyo** — [Mobbin screen: Klaviyo](https://mobbin.com/screens/4ca7b81a-9cb8-497c-a728-e66ae0487f5e?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp):
  - Next to the "Time period" button, plain text reads "Jun 22, 2026 - Jul 22, 2026 compared to previous period".
  - The popover stacks a "Time period" select, date inputs, a "Comparison" select and Apply.
  - KPI deltas read "0% vs. previous period".
- **Etsy Stats** — [Mobbin screen: Etsy](https://mobbin.com/screens/78b43364-a721-4dfe-a980-c96fa8a93c7a?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp):
  - A "Compare to previous year" toggle sits under the chart; the "Previous year" series is dashed and "Custom" is solid.
  - A sentence summary reads "Visits decreased 93% compared to the same period last year."
- **Square:** a pill pair "Today | vs Yesterday", a legend that uses a solid swatch for the current period and a dashed swatch for the comparison, and a "▲0%" delta chip. — [Mobbin screen: Square](https://mobbin.com/screens/6e267440-5f3e-470f-b69a-465ba480df46?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Sweatpals:** a separate "⊕ Compare" button beside "All time", with presets "Previous year / Previous month / Previous week / Previous day", Start/End fields, a two-month calendar, and Clear / Apply. — [Mobbin screen: Sweatpals](https://mobbin.com/screens/f412d8a6-ce6f-41c1-bdbe-8d155ecaffbe?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Calendly:** a KPI delta phrased "+1 (new) vs prior 30 days". — [Mobbin screen: Calendly](https://mobbin.com/screens/1d417c2e-234a-4bf0-a87e-dc65703c2b64?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Amplitude:**
  - Click "Compare" above the chart → "Previous time periods" → a preset (e.g. Previous week, Previous year) or a custom period. A second comparison can be added, and custom comparisons have a "Rolling" toggle. — [Amplitude docs: Metric Explorer advanced analysis](https://amplitude.com/docs/analytics/charts/metric-explorer/metric-explorer-advanced-analysis); [Amplitude docs: Event Segmentation part 2](https://amplitude.com/docs/analytics/charts/event-segmentation/event-segmentation-interpret-2) (via search summary)
  - A community user notes that "compare to past" aligns calendar dates, so weekdays shift year over year. No built-in weekday-aligned option was confirmed. — [Amplitude Community](https://community.amplitude.com/building-and-sharing-your-analysis-58/can-i-offset-compare-to-past-261)
- **Stripe Dashboard home charts:** the date range is chosen in the first dropdown and the comparison range in the third. Longer periods switch to weekly or monthly increments. Stripe labels these charts as estimates. — [Stripe Support](https://support.stripe.com/questions/dashboard-home-page-charts-for-business-insights) (via search summary)
- **Tableau Pulse:** the metric card shows the % change "from the prior period being compared". The breakdown compares against the prior period by default, and goal or threshold data can appear. — [Tableau Pulse: Explore metrics](https://docs.salesforce.com/tableau/current/en-us/online/pulse_explore_metrics.md)
- **Mews** (hospitality-specific comparisons) — [Mews Help: Comparing Mews BI and Mews Analytics](https://help.mews.com/s/article/Comparing-Mews-Business-Intelligence-and-Mews-Analytics):
  - Has a "Same Time Last Year Comparison, or STLY" section.
  - "Same Day Last Year comparison" is available in BI curated dashboards and Pro, but not in Mews Analytics.
  - "Same Date Last Year Comparison" is available in all tiers.
- **Lighthouse:** teams compare "current performance to last year or budget". Pace shows "whether performance is tracking ahead of, in line with or behind forecast", and pickup can be benchmarked against the competitive set. — [Lighthouse blog](https://mylighthouse.com/resources/blog/booking-pickup-and-pace-revenue-management)
- **Duetto:**
  - Cross-property reporting "rolls up data, budgets and forecasts for an entire portfolio". — [Duetto: Multi-property](https://www.duettocloud.com/en-us/multi-property) (via search summary)
  - Forecasts and budgets can be viewed in "Summary or Segment level views". — [Duetto: Reporting and insights](https://www.duettocloud.com/solutions/insight-reporting) (via search summary)
- **STR / CoStar benchmarking:**
  - Standard periods include "Running 28 days" and "Year to date".
  - Indexes are MPI (occupancy), ARI (ADR) and RGI (RevPAR), each calculated as the hotel's metric ÷ the comp-set average × 100.
  - [STR: How to read a STAR report (2019 PDF)](https://str.com/sites/default/files/2019-07/how-to-read-star-report.pdf) (via search summary; old source)

### Inferences
- **[our call]** Use two adjacent pills, each with its resolved value, plus a one-line resolved summary under the bar (combining the Wix, Klaviyo and Shopify patterns):
  ```
  [Stay dates: Next 30 nights ▾] [vs Same time last year ▾]
  21 Nov – 20 Dec 2026 · vs 21 Nov – 20 Dec 2025, on the books as of 20 Nov 2025 · Data as of 14:05
  ```
- **[our call]** Date semantics:
  - The primary range is **stay dates**. Use "nights" wording ("Next 30 nights"), because a hotel night is the unit RMs and GMs think in.
  - The booking window is a **separate, optional "Booked" filter** ("Booked: last 7 days" = pickup window), following Mews's "Date of stay" + "Pickup period" pair.
  - Widgets that cannot use one of the two dates (e.g. a pace curve plotted by lead time) declare it in their header badge.
  - If a single control is preferred, use a "Date basis: Stay date | Booking date" segmented toggle inside the date popover (Mews time-context model). This is weaker for pickup analysis, which needs both dates at once.
- **[our call]** Presets for the stay-date popover, forward-looking first:

  | Group | Presets |
  |---|---|
  | Upcoming | Next 7 nights, Next 30 nights, Next 90 nights, Rest of this month, Next month |
  | Past | Yesterday, Last 7 nights, Last 30 nights, Month to date, Year to date, Last month |
  | Custom | Custom range… |

  Each row shows its resolved dates (the Linktree, Starling and Squarespace pattern). Store presets as *relative* tokens so saved views stay rolling (the Cloudbeds fixed vs rolling distinction).
- **[our call]** Compare-to options:
  - Same time last year (STLY, on-the-books at the same lead time). This is the default for future stay ranges.
  - Last year, same weekday (364 days back). This is the default for past ranges, because day-of-week drives hotel demand. Mews's same-day vs same-date distinction and the Amplitude weekday complaint point the same way.
  - Last year, same date.
  - Previous period.
  - Budget.
  - Forecast.
  - No comparison.
- **[our call]** How to display the comparison:
  - Comparison series dashed or lighter (Shopify, Etsy, Square).
  - KPI tiles show the value, a signed delta (absolute and %) and the comparison value with its label (Plausible).
  - Tooltips show both values.
  - Budget and forecast render as a reference line or target, not a second "period".
- **[our call]** Show each hotel's local "today" (or the time zone, Intercom-style) whenever relative presets resolve across hotels in different time zones.

### Gaps
- No public help-center documentation of the date pickers in Duetto, IDeaS, Lighthouse or Juyo was accessible (their help centres are gated). Their hospitality comparison semantics come from vendor blogs and marketing.
- Current CoStar/STR Benchmark UI period labels were not verified; the source is a 2019 PDF via search summary.
- I found no published usability research comparing ways of displaying a comparison (dashed line vs ghost bars vs delta-only).
- A Shopify "match day of week" comparison option could not be confirmed.
- Mixpanel's compare UI was not researched.

---

## 3. Multi-entity selection: portfolio vs single property, regions and brands; multi-select at 20–200 items; "All hotels" defaults; property switching in hospitality tools

### Takeaway
Hospitality platforms make the portfolio the default lens for group users and let them drill into a property or a *cluster*: Duetto ScoreBoard and CommandCenter, IDeaS Portfolio Navigator, and Mews "Property group" + "Properties" filters. PMS-native BI (Cloudbeds) uses a single property selector inside the Filters panel. At 20–200 items, the converging UI primitive is a searchable multi-select with:
- a select-all row with a selected count,
- grouping into parent nodes (region or brand) with counts and tri-state checkboxes,
- a trigger that summarises the selection rather than listing it.

### Cited Findings

#### Hospitality tools
- **Duetto ScoreBoard** offers "one live dashboard with real-time forecasting across every property". Cross-property reporting rolls up data, budgets and forecasts. — [Duetto: Revenue management for hotel groups](https://www.duettocloud.com/en-us/multi-property) (via search summary)
- **Duetto CommandCenter** (2023) shows progress "for one property or one thousand" and lets users "zero in on specific properties or clusters that are over or under-performing". — [Hospitality Net: Introducing CommandCenter](https://www.hospitalitynet.org/news/4116048.html) (via search summary)
- **IDeaS G3 RMS Portfolio Navigator** (released March 2024) gives a centralized view of all properties' performance for corporate or cluster users. — [Lodging Magazine](https://lodgingmagazine.com/ideas-releases-g3-rms-portfolio-navigator/); [Hotel Management](https://www.hotelmanagement.net/tech/ideas-unveils-solution-multi-property-revenue-management) (via search summary)
- **IDeaS Optix** "rolls up revenue performance for multiple properties and entire estates" while drilling down. — [Hospitality Net product page](https://hospitalitynet.org/product/5000324.html) (via search summary)
- **Mews BI** — [Mews Help: Booking curve](https://help.mews.com/s/article/The-Booking-curve-and-trends-dashboard-in-Mews-Business-Intelligence); [Mews Help: Comparing BI and Analytics](https://help.mews.com/s/article/Comparing-Mews-Business-Intelligence-and-Mews-Analytics):
  - Has *separate* "Property group" and "Properties" filters.
  - Lists "Property group filtering" as a multi-property capability.
  - "Multi Property dashboard included in MMP add-on"; custom multi-property visualizations are Pro only.
- **Cloudbeds Insights:** "If your account has multiple properties, choose the one you want to analyze" in the Filters panel. Sharing reports across properties needs a multi-property Organization. — [Cloudbeds: Filters overview](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/6624657379483-Filters-Overview) (via search summary)
- **Juyo Analytics** offers "pre-configured and fully customizable dashboards" consolidating PMS, rate-shopper and market data, and lists Pick-up Analytics and Pace Analytics features. No public documentation of its property-switching UI was found. — [HotelTechReport: Juyo Analytics](https://hoteltechreport.com/revenue-management/business-intelligence/juyo-analytics); [apaleo Store: JUYO Analytics](https://store.apaleo.com/apps/juyo-analytics) (via search summary)

#### Generic multi-select patterns (Mobbin screens)
- **Square, "Select locations to publish…":**
  - A search field, then a "Deselect all" row with the selected count ("1 ☑").
  - Each row shows the location name, the address and a checkbox.
  - [Mobbin screen: Square](https://mobbin.com/screens/42a7c562-83b2-4266-9737-082e7d7a43e0?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Turo, "Select vehicles" modal:**
  - Search with the placeholder "Make, model, plate #".
  - A status chip ("Listed") and an "All vehicles" select-all checkbox.
  - Footer: "Reset" / "Update".
  - [Mobbin screen: Turo](https://mobbin.com/screens/f5dbf5df-77d2-495f-a26d-4329dc42005a?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Snowflake region picker:** the closest analogue to region → hotel.
  - A hierarchical checkbox tree with counts: "Asia (10)", "Europe (14)", "North America (12)".
  - Sub-group headers inside an expanded region (AWS / Azure / GCP).
  - Search, and a footer with Cancel / Done (Done is disabled until something changes).
  - [Mobbin screen: Snowflake](https://mobbin.com/screens/e963d98c-79dd-474d-bb23-3b07c462af98?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Airtasker category popover:**
  - Search, a two-column checkbox grid and "Clear all".
  - Footer: Cancel / Apply. The trigger elsewhere reads "Other filters (1)".
  - [Mobbin screen: Airtasker](https://mobbin.com/screens/371d2452-093d-426a-a579-884d18ef35b1?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Reddit:** a summary line "1 visible, 1 hidden" next to "Select All". — [Mobbin screen: Reddit](https://mobbin.com/screens/e4f2eaf1-88f4-411b-baa5-7c71ee060e8c?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Walmart store selector:** "My preferred store" plus a "Set as my preferred store" toggle, so a remembered default entity exists alongside the full list. — [Mobbin screen: Walmart](https://mobbin.com/screens/85f40473-89ee-44b0-b901-b16619180a9b?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Semrush:** the analysed entity appears as a removable chip ("content-mobbin.com ×") with a "+" to add more entities for side-by-side comparison. — [Mobbin screen: Semrush](https://mobbin.com/screens/f8548434-b4ef-4e67-a360-72feb07a9003?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)

#### Guidance and limits from design systems and BI tools
- **PatternFly:** use typeahead for lists over 10 items. Use a checkbox select for multiple values from a predefined list (values combine with OR). A single select alone in a toolbar "should include a default 'All options' item". — [PatternFly](https://www.patternfly.org/patterns/filters/design-guidelines)
- **Looker** caps visible-option controls: Button Group at 30 options, Checkboxes at 50. Tag List and Advanced are popover or overflow controls. — [Looker docs](https://docs.cloud.google.com/looker/docs/filters-user-defined-dashboards)
- **Metabase** text and ID filters can render as a dropdown list, a search box or an input box, with single or multiple selection. The default depends on the column's number of distinct values: the fetched summary gave about 100 as the switch-over. That threshold is unverified, so check it before relying on it. — [Metabase docs](https://www.metabase.com/docs/latest/dashboards/filters)
- **Databricks** multi-select improvements:
  - Viewers can "include or exclude the values they select" (May 2025) and paste a column of values into a multi-select filter (Dec 2025). — [AI/BI release notes 2025](https://docs.databricks.com/aws/en/ai-bi/release-notes/2025)
  - "Multi-select filter drop-downs now stay open between selections", and users can select all matching results (Jul 23, 2026). — [AI/BI release notes 2026](https://docs.databricks.com/aws/en/ai-bi/release-notes/2026)
- **MOJ (GOV.UK-based) Filter component:** for long option lists, use an accessible autocomplete that shows only options matching the typed text or already selected. Make matching case-insensitive, strip punctuation and duplicate whitespace, and treat "&" and "and" as the same. — [MOJ Design System: Filter](https://design-patterns.service.justice.gov.uk/components/filter/)
- **Polaris:** when all tag pills are selected, truncate in the middle ("Paid, par… unpaid"). Group tags from the same category together. — [Polaris IndexFilters source](https://raw.githubusercontent.com/Shopify/polaris/main/polaris.shopify.com/content/components/selection-and-input/index-filters.mdx)
- **Cloudscape:** the collection select filter "doesn't support selecting multiple values for a single property"; use the property filter for multi-value. — [Cloudscape: Filter patterns](https://cloudscape.design/patterns/general/filter-patterns/)
- **WAI-ARIA APG:** the combobox pattern is single-select ("a combobox is a single-select widget where selection follows focus in the popup"). Multi-select needs listbox semantics (`aria-multiselectable`, `aria-selected`) from the listbox pattern. — [APG: Combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
- **Spartan UI (Angular)** lists "Combobox", "Command", "Popover", "Checkbox", "Badge" and "Select". — [Spartan components](https://www.spartan.ng/components)

### Inferences
- **[our call]** The trigger summarises the selection, never lists it:
  - "All hotels (20)"
  - "Halcyon Lisbon" (exactly one hotel)
  - "Southern Europe (6)" (exactly one whole group)
  - "Lisbon + 2" or "3 hotels" (anything else)

  A tooltip shows the full list.
- **[our call]** Popover anatomy, using Spartan Popover + Command + Checkbox:
  - Search ("Search hotels, cities, brands").
  - An "All hotels (20)" tri-state row.
  - A grouping switch (By region / By brand) with tri-state group rows and counts (the Snowflake pattern).
  - Hotel rows showing name, city and a hover action "Only" (select just this hotel).
  - A footer "6 of 20 selected · Clear".
  - At 20 hotels the flat list plus search is enough, and grouping is a bonus. Design the component for 200 (virtualised list, group-level select, paste a list) so it scales with the group.
- **[our call]** Defaults by role:
  - Group or regional RMs land on "All hotels" (portfolio first, as Duetto and IDeaS position it).
  - A GM lands on their own hotel, as a "preferred property" default in the Walmart style.
  - Remember the last selection, following Mews's "Auto-save last filter configuration state".
- **[our call]** Portfolio vs property should change what the charts break down by: by hotel when several are selected, by segment or channel when one is. The filter value therefore drives the default chart dimension, and the AI should mention it.

### Gaps
- I could not see the actual property-switcher UI of Duetto, IDeaS, Lighthouse, Juyo or STR. Their help centres or apps are gated, so the evidence is press and marketing descriptions only.
- I found no research that sets a numeric threshold for when to switch from checkboxes to a searchable combobox for 20–200 items. The PatternFly (>10 → typeahead) and Looker (≤30 / ≤50) limits are the only concrete numbers.

---

## 4. Filter chips, tokens and query builders vs dropdowns: when are tokens better?

### Takeaway
Tokens win when users combine many optional properties with operators (is / is not / any of, AND/OR), when the set of possible filters is open-ended, or when the filter state must be readable as one line and round-trip through a URL or an AI. In every token system surveyed, each part of a token (property, operator, value) is separately editable. Value-showing dropdown pills win for the small fixed set of always-present dimensions (hotel, dates, comparison), where removing the filter makes no sense.

### Cited Findings
- **Cloudscape** chooses the filter type by resource complexity:
  - **Text filter:** for users who know the exact term.
  - **Collection select filter:** for one or two common properties; single value per property, "And" only.
  - **Property filter:** for complex products with large property sets; multiple values per property and the operators "And," "Or," "Not," "And not," "Or not".
  - "Display operators when at least two filters are defined." For complex queries, "combine these operators using a token group".
  - [Cloudscape: Filter patterns](https://cloudscape.design/patterns/general/filter-patterns/)
- **Linear** — [Linear docs: Filters](https://linear.app/docs/filters):
  - Filters are added from the filter menu or with the `F` shortcut, and typing a value name (e.g. a team or label) jumps straight to it.
  - In a chip, the property name is fixed. Clicking the operator switches it, and clicking the value changes the selection.
  - Operators: "is" / "is not", which become "is either of" with multiple values. Labels use "includes any," "all," "neither," "either," "none". Dates use "before" / "after".
  - "Advanced filter" opens a builder with AND/OR groups and nested groups.
- **GitHub issues** — [GitHub Docs: Filtering and searching issues and PRs](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/filtering-and-searching-issues-and-pull-requests):
  - Qualifiers use `name:value` (e.g. `state:open is:issue assignee:octocat`). A space acts as AND, and `AND`/`OR` with parentheses can be nested "up to five levels deep". `-` negates.
  - Typing gets help: "As you type your filter, GitHub will show available qualifiers, suggest values, and warn when there is a problem with your filter."
- **ThoughtSpot Spotter:** answers show "the answer title and the search tokens" used to build them. Clicking a token opens a window to clarify the interpretation:
  - change a measure's aggregation,
  - change an attribute's column,
  - switch a date filter between rolling and fixed, or change the date bucket.
  - [ThoughtSpot docs: Getting started with Spotter](https://docs.thoughtspot.com/cloud/latest/spotter-getting-started)
- **PatternFly** — [PatternFly](https://www.patternfly.org/patterns/filters/design-guidelines):
  - Use labels (chips) when the control doesn't show the applied value, when a facet has more than one value, or when boolean rules apply.
  - Don't use labels when the control's current settings already convey the filter.
  - Text filter placeholders read "Filter by [attribute name]".
- **Polaris content rules:** use the filter name alone when clear ("Fulfilled"), but add a word when it is ambiguous ("High risk", not "High"). The text field label should say "Filter orders", not "Enter text here". — [Polaris IndexFilters source](https://raw.githubusercontent.com/Shopify/polaris/main/polaris.shopify.com/content/components/selection-and-input/index-filters.mdx)
- **Chip examples in analytics UIs (Mobbin screens):**
  - Plausible shows chips inline in the header ("Page is /auth/sign-up ×", "Entry page is / ×", "Exit page is /auth/login ×"). An overflow "…" menu has "Save as segment" and "Clear all filters". — [Mobbin screen: Plausible filters](https://mobbin.com/screens/efd91c15-b39f-4c6b-96cd-4176075f286b?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
  - Visitors shows compact chips ("[icon] is Slack ×", "[flag] is 🇺🇸 ×") under the date select. — [Mobbin screen: Visitors](https://mobbin.com/screens/decbd241-09d5-42e6-be62-b9ef54306e0d?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
  - Google Ads shows chips "Campaign status: Enabled, Paused" and "Ad group status: Enabled, Paused", then "Add filter". — [Mobbin screen: Google Ads](https://mobbin.com/screens/d7ab17ee-75ea-47bd-8587-9429545b87dc?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
  - Airtable's chip "Project Status is [Planning] or [In Progress]" opens a checkbox list with "Find an option" search and "Clear". A "Reset" link sits in the filter row. — [Mobbin screen: Airtable](https://mobbin.com/screens/b3b21595-5794-4b20-bb85-ba48a59f12a1?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
  - Preply shows dropdowns that display their value ("Country of birth: Singapore ⊗") with a count badge on a multi-value trigger ("Specialties 1"). Applied filters are also listed below as removable chips grouped by category ("Availability:", "Price per 50-min lesson:", "Tutor's country of birth:"). — [Mobbin screen: Preply](https://mobbin.com/screens/a830f90b-5e12-4415-af31-1afb3cf9c338?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)

### Inferences
- **[our call]** Use a hybrid model:
  - **Core pills.** Hotels, Stay dates and Compare are always present and show their value. They are not removable; Reset returns them to the default.
  - **Removable tokens.** Optional dimensions (Segment, Channel, Room type, Rate plan, Booked window, Length of stay, Market/source) are added via "+ Filter". That opens a Command-style list of dimensions, then a value list (Linear's flow).
  - **Token text.** "Segment: Corporate, Group" or "Channel is not OTA". Show the operator only when it isn't plain "is".
  - **Logic.** AND across dimensions and OR within a dimension (PatternFly).
- **[our call]** No free-text query language for RMs and GMs in the MVP. The AI chat covers natural-language querying, and the tokens give the AI a vocabulary it can write to and the user can read back: the same token text appears in the bar and in the chat's "filters applied" receipt (see Q5).

### Gaps
- I found no quantitative usability study comparing tokens vs dropdowns for analytics dashboards. The guidance above comes from design-system rules and shipped products.

---

## 5. How AI analytics products expose and sync filters with chat

### Takeaway
Two patterns coexist:
1. **The AI as filter operator.** Natural language is translated into the *same visible filter state* that the UI controls. Examples: Linear's AI filters, Seline (filters applied to the dashboard with a "Notes" receipt), Databricks Genie's editable filters, and Pipedrive's AI report showing "1 filter applied" as an editable condition row.
2. **The AI answers in its own scope and shows a receipt of its interpretation.** Examples: ThoughtSpot Spotter's editable tokens, Power BI's "How Copilot arrived at this" and Fabric IQ reasoning steps, and Genie's "Show code".

The documented failure mode is that Power BI Copilot *data questions* ignore the filters currently applied on the report. Compass must avoid exactly that: the assistant should read the current filters by default and say which scope it used.

### Cited Findings

#### Power BI Copilot
- Data questions: "Copilot data questions don't apply filters or slicers currently affecting visuals on the report page to the answers generated in the Copilot pane." Page updated 2026-09-29. — [MS Learn: Ask data questions with Copilot and Fabric IQ](https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-ask-data-question)
- On the same page:
  - Users expand **How Copilot arrived at this** to "verify the fields, measures, and filters it selected". **Data used** links show details.
  - With Fabric IQ, Copilot can "Show reasoning steps … You can verify the calculations and filters used". A display picker switches between visual, table and DAX query.
  - [MS Learn](https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-ask-data-question)
- Report summaries — [MS Learn: Summarize a report with Copilot](https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-pane-summarize-content) (updated 2026-10-06):
  - The visual-header "Copilot summary" "reflects the visual's current state, including any applied filters, slicers, or row-level security (RLS)".
  - Custom prompts: "As long as the filter or slicer exists in the report, Copilot can filter the response for you". Citations reference "the correct, filtered visual".
  - In the standalone experience, users can "hover over the filter icon and see that the Maui filter was applied to all the visuals". **View in report** opens the referenced visual "with the appropriate filters applied".
  - Limitations: relative date/time filters and visual-level filters aren't supported. The same page's best practices also say "summaries don't currently apply filters to answer the specific prompt", which contradicts the custom-prompt claim on that page.

#### ThoughtSpot Spotter
- Follow-ups: "Spotter highlights the changes it made in search tokens".
- "Edit Answer" mode lets users "add or remove query tokens, change measures and attributes", then "Done editing" or "Discard changes".
- Quick edits from a token: after Apply, "The answer updates to show the changes you made".
- Source: [ThoughtSpot docs: Getting started with Spotter](https://docs.thoughtspot.com/cloud/latest/spotter-getting-started)

#### Databricks Genie
- Jun 19, 2025: "Users can now edit filter values to refine responses."
- Jul 10, 2025: "Editable filters now display multiple values."
- Source: [AI/BI release notes 2025](https://docs.databricks.com/aws/en/ai-bi/release-notes/2025)
- Genie on dashboards — [AI/BI release notes 2026](https://docs.databricks.com/aws/en/ai-bi/release-notes/2026):
  - Jul 9, 2026: "The Ask Genie button on published dashboards is now generally available".
  - Sep 10, 2026: "the Ask Genie input bar now shows the chart you selected as context", and starter questions are "scoped to the dashboard page and widget you're viewing".
  - Nov 12, 2026: "Ask Genie now appears only on widgets that Genie can use as context".
- In a Genie chat, "Show code" displays the generated query, and the results appear in a table beside it. — [Databricks docs: Talk to Genie](https://docs.databricks.com/aws/en/genie/talk-to-genie) (via search summary)
- A release-note snippet said "Creating a new Genie Agent from a dashboard now applies the dashboard's filter context in the linked space". It was surfaced by search but not found in the parts of the release notes I read, so it is **unverified**. — [AI/BI release notes 2025](https://docs.databricks.com/aws/en/ai-bi/release-notes/2025) (via search summary)

#### Tableau Pulse
- "Filter settings and the data available for the metric determine which insights Pulse can detect."
- Following a metric keeps "your time period and filter selections" on the home page and in digests.
- A metric shared to Slack reflects the sharer's filters.
- Sources: [Tableau Pulse: Explore metrics](https://docs.salesforce.com/tableau/current/en-us/online/pulse_explore_metrics.md)
- Each new combination of filters or time options creates a related metric under the same definition. — [Tableau Pulse: Create metrics](https://help.tableau.com/current/online/en-us/pulse_create_metrics.htm) (via search summary)

#### Linear AI filters
- You "can type natural-language requests, such as asking for issues assigned to you or due next week, and the view is filtered automatically". The output is ordinary filter chips. — [Linear docs: Filters](https://linear.app/docs/filters)

#### Hex Threads
- Workspace rules tell the agent "which filters to apply by default".
- Users can @-mention a semantic model or table to pin the data source.
- Charts built on a semantic model show the model's name in their footer.
- Sources: [Hex docs: Threads](https://learn.hex.tech/docs/explore-data/threads); [Hex changelog 2025-10-15](https://learn.hex.tech/changelog/2025-10-15) (via search summary)

#### Real screens (Mobbin)
- **Seline** — [Mobbin screen: Seline](https://mobbin.com/screens/57775a57-e65f-4efe-a573-94fe41577f65?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp):
  - User: "Help me filter the dashboard. I want to see: [all my blog posts] [traffic from GPT] [visitors from Singapore]".
  - The assistant replies "Now applying the filters to the dashboard... Done!" and shows the URL parameters.
  - It then gives a **"Notes:" receipt** with one line per interpreted filter:
    - "Date range: last 30 days (America/New_York)"
    - "Blog posts: page contains /blog/"
    - "Traffic from GPT: referrer contains gpt (covers things like chat.openai.com or similar)"
    - "Visitors from Singapore: country is SG"
  - It ends with a repair prompt: "Want a different date range? Tell me the period (e.g., 'this week' or custom dates) and I'll update it."
  - The dashboard's filter bar shows the resulting chips ("Aug 02 - 31 ×", "contains /blog/ ×", "is 🇸🇬 Singapore ×", "contains gpt ×").
- **Pipedrive "Insights AI Report"** — [Mobbin screen: Pipedrive](https://mobbin.com/screens/d77bd5e0-94fc-4078-9c3f-178f987b33d1?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp):
  - The chat sits on the left ("How many deals have been created this year?").
  - The generated report on the right shows "1 filter applied" as an *editable* condition row: "Deals | Deal created on | is | Custom period | 01/01/2025 – 12/31/2025", with "+ Add condition" and Cancel / Save.
  - The chat footer reads "Powered by AI. Results may be inaccurate."
- **Fireflies "AskFred":** scope chips sit *above the chat input* ("Last 30 days", "All Meetings", "Host", "Participant"), so the question's filter scope is visible and editable before asking. — [Mobbin screen: Fireflies](https://mobbin.com/screens/76b1db9b-b3b3-4cf8-904f-52b069bc6eec?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Wix:** the AI chat panel sits next to a filter side panel whose footer states "No filters applied" with a disabled "Clear all". — [Mobbin screen: Wix AI + filters](https://mobbin.com/screens/299093ad-3013-4b44-a09c-87d30f205e2a?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)

### Inferences
- **[our call]** Use one source of truth: a typed `FilterState` with these fields, serialised to the URL:
  - `hotels`
  - `stayRange` (relative preset or absolute dates)
  - `bookedRange`
  - `compare`
  - `segment[]`, `channel[]` and other dimension tokens

  UI controls and AI tool calls (e.g. `get_filters`, `set_filters(patch)`) go through the same reducer. The AI never computes on a hidden scope.
- **[our call]** Every AI change to filters produces three things:
  1. A **"Filters applied" receipt card** in the chat, listing each change as before → after in the same token wording as the bar. For example: "Hotels: All (20) → Lisbon, Porto"; "Stay dates: Next 30 nights → 1–31 Dec 2026 (you said 'next month')"; "Compare: none → Same time last year". The card has **Undo** and **Edit filters** actions.
  2. A brief highlight on the changed pills in the filter bar.
  3. A polite `role="status"` announcement (see Q6).

  Filters are non-destructive and reversible, so apply immediately with Undo rather than asking for confirmation. Confirm only when overwriting a *saved view* (Cloudscape confirms updates and deletes).
- **[our call]** Separate "change the dashboard" from "answer in a different scope". If the user asks "how did Porto do last December?" while the dashboard shows all hotels for next 30 nights, the answer carries its own scope chips (Fireflies / Spotter style) and an **"Apply to dashboard"** action, like Power BI's "View in report" with filters applied. The dashboard only changes when the user asks for that.
- **[our call]** The assistant's default context is the current `FilterState`, and every quantitative answer states its scope in one line ("All 20 hotels · stays 21 Nov–20 Dec 2026 · vs STLY"). This directly avoids the documented Power BI limitation.
- **[our call]** Resolve relative language in the receipt. State the concrete dates, the date basis ("stay dates" vs "booked") and the time zone, as Seline does with "(America/New_York)". "Next month" in November means 1–31 Dec 2026 stay dates, and the receipt should say so. The ambiguity risk is my inference; the Seline screen shows the pattern.
- **[our call]** Hashbrown's generative UI can render the receipt card as a real component, so the receipt and the filter bar share code. This is about the Compass stack only; no external source.

### Gaps
- I could not verify the Genie "dashboard filter context" claim. Chris Webb's December 2025 testing of Power BI Copilot with filters and slicers was found but not read: [Crossjoin blog](https://blog.crossjoin.co.uk/2025/12/14/power-bi-copilot-and-report-filters-and-slicers/).
- Not researched: filter handling in Looker Conversational Analytics, Mixpanel's AI, and Amplitude's AI agents. Amplitude's prompt library has a "Filter chart with period comparison" entry that I did not read: [Amplitude prompt library](https://amplitude.com/en-us/prompt-library/filter-chart-by-segment-with-period-over-period-comparison.md).
- I found no published research on whether filter "receipts" improve trust or accuracy. The patterns above come from shipped products.

---

## 6. Mobile filter patterns and accessibility

### Takeaway
On phones the common pattern is:
- A horizontally scrolling chip row (one chip per key filter) or a "Filters (n)" button.
- Each opens a bottom sheet or full-height sheet with **batch apply**, via a sticky primary button that often carries a count ("Show 356 results", "View 64") and a secondary "Clear all".
- Date presets appear as list rows with their resolved dates.

For accessibility, the relevant specs are the APG combobox pattern (single-select; use listbox semantics for multi-select), the APG date picker dialog (grid keyboard model), and WCAG 2.2 SC 4.1.3 Status Messages (AA) for announcing updates and "no results" without moving focus.

### Cited Findings

#### Apply vs live
- **NN/g** — [NN/g: "User Intent Affects Filter Design" (Katie Sherwin, 2016)](https://www.nngroup.com/articles/applying-filters/):
  - Interactive (live) filtering works when results appear in "less than one second".
  - Batch filtering is recommended on mobile because "page loads are often slow on the go". When unsure, err toward batch with an Apply button.
  - Avoid flicker ("continuous updates can be visually distracting, even if they are fast and don't scroll the page"). Instead, dim the results and show a progress indicator.
  - Don't jump to the top while the user is still working in the filter area.
- **Baymard:**
  - Mobile filters should get their own layer (a full-screen overlay or bottom sheet), with a prominent "Show X Results" button and a deliberate apply action. — [Baymard: Ecommerce filter UI](https://baymard.com/learn/ecommerce-filter-ui) (via search summary)
  - The detailed guidelines are paywalled: [#1125 Apply buttons in mobile filtering](https://baymard.com/guidelines/1125-apply-buttons-in-mobile-filtering-interfaces) and [#467 number of matches](https://baymard.com/guidelines/467-indicating-the-number-of-matches-for-filtering-options).
- **eBay Playbook** names the two models "Immediate apply" and explicit apply, and its primary button can show the count ("See 120 results"). — [eBay Playbook: Filtering patterns](https://playbook.ebay.com/design-system/patterns/filtering-patterns) (via search summary)
- **Power BI's** Apply button (query reduction), **Metabase's** "Auto-apply filters" toggle, and **Databricks'** "applying multiple filters at the same time alongside the default instant application" all show desktop BI defaulting to instant apply with batch as an option. — [Power BI](https://learn.microsoft.com/en-us/power-bi/create-reports/power-bi-report-filter); [Metabase](https://www.metabase.com/docs/latest/dashboards/filters); [Databricks 2025](https://docs.databricks.com/aws/en/ai-bi/release-notes/2025)

#### Mobile screens (Mobbin, iOS)
- **Zocdoc:** a full-height "Filters" sheet with a segmented control ("I'm flexible | ASAP") and per-option counts ("Early morning · before 10 AM (374)"). The sticky footer has "Clear all" and "Show 356 results". — [Mobbin screen: Zocdoc](https://mobbin.com/screens/ab80dc53-69e8-4eaf-b4c8-127a03cb8575?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Viator:** a horizontal chip row under search ("Dates ▾", "Duration ▴", "Languages ▾", "Sort"). Each chip opens a *single-facet* bottom sheet (e.g. "Duration" checkboxes) with "Clear all" and "Show 200 results". — [Mobbin screen: Viator](https://mobbin.com/screens/bc0a1249-6df8-410a-86ed-14f1a6b25b84?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Insight Timer:** chip-group facets ("All", "1-5 mins", …) with "Clear all" and "Show 169 results". — [Mobbin screen: Insight Timer](https://mobbin.com/screens/f532c0e9-58ed-44c0-9d6e-572b20aeba58?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **IKEA:** a "Filter and sort" sheet with counts per option, and "Clear all" next to "View 64". — [Mobbin screen: IKEA](https://mobbin.com/screens/dd756cf9-8d13-47d4-a3cc-ee9d1063428d?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Mindvalley:** a sheet with a grab handle and counts, "Apply" and "Clear filters", and a filter icon in the header with a badge showing "2". — [Mobbin screen: Mindvalley](https://mobbin.com/screens/d0553111-4112-462b-bdde-f97c6e5879be?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Tripadvisor:** chip facets with "Clear filters" and "Show 187 results". — [Mobbin screen: Tripadvisor](https://mobbin.com/screens/0dcf458b-0e9b-4840-b731-fc1ce6479dd2?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **CVS:** rows show their current value ("Ratings · All ratings") with drill-in chevrons, and a toggle row with a count ("With Photos 413"). The footer has "Clear All" and "View 2674 results". — [Mobbin screen: CVS](https://mobbin.com/screens/d52ad7f8-f145-4da4-a920-6768d2f6a20b?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Toggl Track Reports:** a filter chip row (funnel icon, "This Week", "Team ⊗", "Billable", "Project…"). The date chip opens a calendar card with preset chips ("Today", "Yesterday", "This Week", …), the range highlighted, and Cancel / Done. — [Mobbin screen: Toggl Track](https://mobbin.com/screens/996c9791-682e-4a1b-ad5c-9b9ee2a117f3?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Monzo:** a "Date range" screen with From/To rows ("Not selected"), preset chips ("All time", "Last 7 days", "Last 30 days", …), "Clear" and "Done". — [Mobbin screen: Monzo](https://mobbin.com/screens/17676b62-d546-474e-9bd8-0b52e6a83d9c?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- Linktree, Starling and Squarespace date sheets are described in Q2.

#### Responsive collapse (design systems)
- **PatternFly:** "In responsive views, filters can be hidden within the filter icon". On click the toolbar expands, and multiple filters collapse into a single faceted filter. — [PatternFly](https://www.patternfly.org/patterns/filters/design-guidelines)
- **Polaris:** "consider small screen sizes when designing filters and deciding how many to include". Make every control's label understandable, announce state changes, and keep all actions keyboard-accessible. — [Polaris IndexFilters source](https://raw.githubusercontent.com/Shopify/polaris/main/polaris.shopify.com/content/components/selection-and-input/index-filters.mdx)
- **MOJ Filter component** — [MOJ Design System: Filter](https://design-patterns.service.justice.gov.uk/components/filter/):
  - A "Selected filters" area at the top with removable tags (each with visually hidden "Remove this filter" text), a "Clear filters" link, and an "Apply filters" button.
  - Known accessibility issue: users must go back to the top of the component to apply after selecting, which is hard for keyboard users. MOJ says this is not a WCAG failure.
  - Research finding: "Users don't always see they can filter".

#### Accessibility specs
- **WAI-ARIA APG combobox** — [APG: Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/):
  - Roles: `role="combobox"` on the input and a popup with `role="listbox"` (or grid, tree, dialog).
  - `aria-expanded` true/false; `aria-controls` points to the popup.
  - DOM focus stays on the combobox, and `aria-activedescendant` points to the focused option. A dialog popup is the exception: focus moves into it.
  - `aria-autocomplete` is `none`, `list` or `both`.
  - Keys:
    - Down Arrow opens the popup or moves into it.
    - Alt+Down opens without moving focus.
    - Enter accepts.
    - Escape closes, and optionally clears.
    - Home/End move to the first or last option.
- **APG date picker dialog** — [APG: Date Picker Dialog example](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/):
  - The dialog has `role="dialog"` and `aria-modal="true"`. The calendar is `role="grid"` with a roving `tabindex`, and the selected day has `aria-selected="true"`.
  - The month/year heading uses `aria-live="polite"`.
  - Keys:
    - Arrows move by day or week.
    - Home/End go to the start or end of the week.
    - Page Up/Down change the month; Shift+Page Up/Down change the year.
    - Enter or Space selects and closes.
    - Escape closes and returns focus to the button.
  - The text input is linked to a format hint via `aria-describedby`.
  - The trigger's accessible name changes from "Choose Date" to "Change Date, DATE_STRING".
- **WCAG 2.2 SC 4.1.3 Status Messages (AA)** — [W3C Understanding 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html):
  - Status messages must be "programmatically determined through role or properties" and presented "without receiving focus".
  - Brief messages such as "18 results returned" or "No results returned" count as status messages.
  - Technique ARIA22 uses `role=status`. Avoid `role="alert"` or `aria-live="assertive"` for content that is not important and time-sensitive.
- **Power BI Filters pane keyboard:** Tab moves through the pane, and the context-menu key or Shift+F10 opens a menu. — [MS Learn](https://learn.microsoft.com/en-us/power-bi/create-reports/power-bi-report-filter)
- **Linear** focuses the filter menu with the `F` key. — [Linear docs](https://linear.app/docs/filters)

#### Angular primitives available (Spartan UI)
- Spartan lists "Combobox", "Command", "Popover", "Date Picker", "Calendar", "Select", "Toggle Group", "Sheet", "Drawer", "Badge", "Button Group", "Dropdown Menu", "Checkbox", "Tooltip" and "Sonner (Toast)". The components index does not mention a dedicated date *range* picker. — [Spartan components](https://www.spartan.ng/components)

### Inferences
- **[our call]** Compass on phones:
  - A sticky chip row under the header: [All hotels] [Next 30 nights] [vs STLY] [Filters · 2]. It scrolls horizontally, and active chips use a filled style.
  - Each core chip opens a single-facet **Drawer** (bottom sheet), following Viator. "Filters" opens a full-height sheet with every optional dimension.
  - Batch apply with a sticky footer "Clear all" + "Apply".
  - Dashboards have no result count, so the button can name the effect instead ("Show 3 hotels" or "Update dashboard").
  - The date drawer has a "Stay dates | Booked" segmented control, preset rows with resolved dates, and "Custom range ›" opening the Calendar.
- **[our call]** Desktop apply model:
  - Single-select controls (date preset, compare) apply instantly, because NN/g's under-one-second rule is achievable for aggregates.
  - Multi-select popovers (hotels, segments) batch inside the popover and apply on close or on "Apply". This follows Databricks' "stay open between selections".
  - While updating, dim the affected widgets and show a progress indicator (NN/g).
- **[our call]** Announce every dashboard update in one polite `role="status"` region: "Dashboard updated: 3 hotels, stays 21 Nov – 20 Dec 2026, compared with same time last year." When nothing matches: "No bookings match these filters."
- **[our call]** Keyboard:
  - `F` focuses the filter bar (Linear).
  - Esc closes a popover and returns focus to its trigger (APG).
  - The hotel combobox uses listbox multi-select semantics (`aria-multiselectable="true"`, Space toggles an option).
  - The calendar follows the APG grid keys.
  - Chips have a real "Remove filter: Segment Corporate" accessible name, following MOJ's hidden text.
- **[our call]** Spartan mapping:

  | Compass control | Spartan component |
  |---|---|
  | Hotel picker | Popover + Command + Checkbox |
  | Phone sheets | Drawer |
  | Desktop "+ Filter" panel | Sheet |
  | Compare and date-basis segmented controls | Toggle Group |
  | Counts | Badge |
  | Undo after AI or bulk changes | Sonner |
  | Range selection | Calendar (range mode to be verified) |

### Gaps
- Baymard's guideline texts are paywalled.
- The NN/g apply-filters article dates from 2016. Its one-second threshold is still the most-cited guidance, but I found no newer NN/g revision.
- The Material 3 date picker guidance page could not be read (client-rendered), and Carbon was blocked.
- I did not verify from Spartan's docs that the Calendar supports range mode or that the Combobox supports multiple selection. Check the individual component pages before relying on either.

---

## 7. Saved views, URL state, reset, and empty / "no results" states

### Takeaway
URL-serialised filter state is the norm: Looker, Linear, GitHub and Databricks all reflect filters in the URL, and Databricks now preserves even cross-filter selections in share links. Saved views appear as named presets: Polaris view tabs, Cloudscape saved filter sets, Databricks private bookmarks, Mews "views", Plausible segments and Google Ads views. The better implementations share three traits:
- an explicit "unsaved" state,
- a user-settable default,
- confirmation before overwriting or deleting a saved view.

"Reset" returns to the configured default, not to empty (Mews "Reset all filters"). Good empty states name the likely cause and offer the fix in place.

### Cited Findings

#### URL state
- **Looker:** filter values appear in the URL (e.g. `?User+State=New+Jersey&Date=`). The `hide_filter` parameter "is not a security feature", because hidden filters still apply. — [Looker docs](https://docs.cloud.google.com/looker/docs/filters-user-defined-dashboards)
- **Linear:** main filters are in the URL, so copying the address shares the view. View options, quick filters and Insights filters are not. — [Linear docs](https://linear.app/docs/filters)
- **GitHub:** filter and sort changes update the URL automatically, e.g. `/issues?q=state:open+is:issue+assignee:hubot+sort:created-asc`. — [GitHub Docs](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/filtering-and-searching-issues-and-pull-requests)
- **Databricks:**
  - Mar 27, 2025: a fix so filter values "saved in existing URLs" keep working. — [AI/BI release notes 2025](https://docs.databricks.com/aws/en/ai-bi/release-notes/2025)
  - Jul 2, 2026: cross-filter selections appear "in the active filter bar and [are] preserved in dashboard URLs and share links". — [AI/BI release notes 2026](https://docs.databricks.com/aws/en/ai-bi/release-notes/2026)
  - Sep 3, 2026: embedded dashboards can set and read filter values through APIs. — [AI/BI release notes 2026](https://docs.databricks.com/aws/en/ai-bi/release-notes/2026)
- **Cloudscape:** the default filter set applies on landing "unless specific filter parameters are present in the URL". — [Cloudscape: Saved filter sets](https://cloudscape.design/patterns/general/filter-patterns/saved-filter-sets/)

#### Saved views
- **Polaris IndexFilters:**
  - Tabs are saved views ("a saved subset of the list that has been sorted, filtered, or queried, with a unique name"). Merchants can create, rename, duplicate or delete them.
  - The primary action is "Save" or "Save as", depending on whether the view is mutable; the secondary action is "Cancel".
  - The search/filter button toggles between "View" mode and "Filter" mode.
  - [Polaris IndexFilters source](https://raw.githubusercontent.com/Shopify/polaris/main/polaris.shopify.com/content/components/selection-and-input/index-filters.mdx)
- **Cloudscape saved filter sets** — [Cloudscape: Saved filter sets](https://cloudscape.design/patterns/general/filter-patterns/saved-filter-sets/):
  - The selector sits inside the property filter, with an actions dropdown: "Save as new filter set", "Update current filter set", "Delete current filter set" and "Set as default". "Set as default" is disabled when nothing is selected or there are unsaved changes.
  - The unsaved state is shown as "[the filter set name] [unsaved]".
  - The "Save filter set" modal asks for a name (required), a description (optional) and "set as default".
  - Updating a set shows a confirmation that compares the old and new tokens; deleting needs a simple confirmation. Both end with a flashbar.
  - Group user-created sets separately from service-provided sets.
- **Databricks (Oct 22, 2026):** "Dashboard viewers can now save filter combinations as private bookmarks to return to later." — [AI/BI release notes 2026](https://docs.databricks.com/aws/en/ai-bi/release-notes/2026)
- **Mews BI** offers "Auto-save last filter configuration state" and "Save pre-set filter configurations as views" in curated dashboards and Pro, but not in Mews Analytics. — [Mews Help: Comparing BI and Analytics](https://help.mews.com/s/article/Comparing-Mews-Business-Intelligence-and-Mews-Analytics)
- **Power BI:** reader filter selections persist between visits by default. Authors can turn this off. — [MS Learn](https://learn.microsoft.com/en-us/power-bi/create-reports/power-bi-report-filter)
- **Tableau Pulse:** following a metric keeps the user's time period and filter selections. — [Tableau Pulse: Explore metrics](https://docs.salesforce.com/tableau/current/en-us/online/pulse_explore_metrics.md)
- **GitHub** issue and PR lists come with default filters: open items, created by you, assigned to you, mentioning you. — [GitHub Docs](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/filtering-and-searching-issues-and-pull-requests)
- **Product screens (Mobbin):**
  - Plausible: the overflow menu has "Save as segment" and "Clear all filters". — [Mobbin screen: Plausible](https://mobbin.com/screens/efd91c15-b39f-4c6b-96cd-4176075f286b?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
  - Google Ads: a view selector "View (2 filters) · All campaigns" with a Save action beside the chip row. — [Mobbin screen: Google Ads](https://mobbin.com/screens/d7ab17ee-75ea-47bd-8587-9429545b87dc?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
  - Juicebox: a modal filter editor with a live "1.7k matches" count and "Save Changes", plus "Clear all", "Save Preset" and "Select Preset". A category rail marks active categories with dots, and there is a "Hide inactive filters" toggle. — [Mobbin screen: Juicebox](https://mobbin.com/screens/0d56b729-92c9-4dd6-8acc-914c35609eaa?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)

#### Reset and clear
- **Mews:** "Reset all filters" reloads the dashboard's *default* configuration. — [Mews Help](https://help.mews.com/s/article/Using-filters-in-Mews-Business-Intelligence)
- **PatternFly:** a "Clear filters" link follows the last chip. It removes all applied filters and collapses the toolbar back to one row. — [PatternFly](https://www.patternfly.org/patterns/filters/design-guidelines)
- **MOJ:** a "Clear filters" link inside "Selected filters". — [MOJ Filter](https://design-patterns.service.justice.gov.uk/components/filter/)
- **GitHub:** "Clear current search query, filters, and sorts". — [GitHub Docs](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/filtering-and-searching-issues-and-pull-requests)
- **Databricks:**
  - Dec 18, 2025: a fix removed a stray "Reset to default" button from the active filter bar, which shows the product has such a reset action. — [AI/BI release notes 2025](https://docs.databricks.com/aws/en/ai-bi/release-notes/2025)
  - Oct 29, 2026: changing a filter's field clears its default, which falls back to All or None. — [AI/BI release notes 2026](https://docs.databricks.com/aws/en/ai-bi/release-notes/2026)

#### Empty and "no results" states
- **Stripe Payments analytics:** an in-card empty state reads "No data available. Try clearing the filters or selecting another date range, or check if you have any payment activity." — [Mobbin screen: Stripe](https://mobbin.com/screens/8bba78c1-0d19-450b-a0f3-361e3fb8375f?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Shopify Analytics:** cards show "No data for this date range". — [Mobbin screen: Shopify](https://mobbin.com/screens/ed30db83-eeb4-4676-8bef-19e64c8ab414?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Preply:** "Try removing some filters to see your top tutors", followed by the applied filters as removable chips grouped by category. The fix is offered in place. — [Mobbin screen: Preply](https://mobbin.com/screens/a830f90b-5e12-4415-af31-1afb3cf9c338?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Wix:** the filter panel footer states "No filters applied". — [Mobbin screen: Wix](https://mobbin.com/screens/299093ad-3013-4b44-a09c-87d30f205e2a?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **NN/g:** batch filtering risks zero-result combinations, and showing counts per option helps users avoid them. — [NN/g](https://www.nngroup.com/articles/applying-filters/)
- **WCAG 4.1.3:** "No results returned" is a status message that must be announced without moving focus. — [W3C Understanding 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

### Inferences
- **[our call]** URL encoding uses short, stable query params, e.g. `?h=lis,opo&stay=next30n&cmp=stly&seg=corp,grp&ch=!ota&booked=last7d`. Relative presets are stored as relative tokens so a shared link still means "next 30 nights" tomorrow, and absolute ranges as ISO dates. The AI's `set_filters` writes the same params, which makes every AI-made view shareable.
- **[our call]** A "View" menu on the right of the filter bar:
  - Built-in views per role, for example:
    - "Group pace · Next 90 nights vs STLY"
    - "Month to date vs budget"
    - "My hotel · Today" (for GMs)
  - Then "My views", with the actions "Save as new view", "Update view", "Set as default" and "Delete".
  - "· unsaved" appears after the view name when the filters differ from the saved ones (Cloudscape).
  - Overwriting or deleting a view needs confirmation.
- **[our call]** Two separate commands:
  - **Reset** returns to the active view's defaults (Mews semantics).
  - **Clear filters** removes only the optional tokens, keeping Hotels, Dates and Compare.

  Never offer a "clear" that leaves a dashboard with no date range.
- **[our call]** Empty states have three cases, each handled in the widget:
  - **Filtered to nothing.** "No stays match Segment: Group + Channel: Direct." The two most restrictive chips are shown with × to remove, plus "Reset filters" (the Stripe/Preply pattern).
  - **No data yet.** E.g. a newly onboarded hotel, or a future range with no comparison data: "No same-time-last-year data before 12 Mar 2025."
  - **Data stale or loading.** Shopify-style "Last refreshed" stamp plus a skeleton.

  Each case is also announced via the `role="status"` region.
- **[our call]** Show a freshness stamp ("Data as of 14:05") at the end of the filter summary line. Mews refreshes BI every two hours and Shopify shows "Last refreshed: 8:55 PM", so users expect to see data age next to the filters.

### Gaps
- I found no documentation of saved views or URL behaviour for Lighthouse, Duetto, IDeaS or Juyo.
- The Polaris IndexFilters source does not specify how unsaved changes are shown.
- Metabase's handling of filter values in URLs was not confirmed. The fetched summary said active filter changes affect only your own view, which may conflict with URL sharing. Check the docs.
- I found no research on whether users expect bookmarked relative presets to stay rolling or to freeze.
