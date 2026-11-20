# Hotel charts for Compass: what revenue, commercial and finance teams use, and how to build each view in Apache ECharts 6

Research date 2026-11-20. This builds on two earlier notes and does not repeat them:
- `/Users/razvan/Web/compass-mvp/docs/research/ui-round3/tables_and_rate_calendar.md` covers rate calendars, decision lists and calendar cell anatomy per vendor.
- `/Users/razvan/Web/compass-mvp/docs/research/ui-round3/insight_feed.md` covers the home feed's three mini charts: `paceLine`, `eventBars` and `shareBar`.

Labels used below:

| Label | Meaning |
|---|---|
| [seen] | The screenshot was opened and read in this round, by me or by one of three parallel research passes. |
| [seen, re-checked] | I opened the image myself. |
| [text] | Vendor wording. |
| [snippet] | Search-result wording; the page was not opened. |
| [third-party] | Review or reseller site. |
| [prior notes] | Taken from the ui-round3 notes. |
| [measured] | Measured locally on the installed packages. |
| [our call] | My synthesis. |

---

## 1. Which views are standard in hotel revenue management, commercial and finance work?

### Takeaway
The same six families of views recur across RMS, BI and benchmarking products:
1. Position against references: on the books (OTB) vs same time last year (STLY), last year (LY), budget and forecast.
2. Booking dynamics: pace by days before arrival, pickup windows, booking window, length of stay.
3. Stay-date calendars and heatmaps.
4. Market position: rate shopping, and MPI, ARI and RGI.
5. Mix and value: segments, channels net of acquisition cost, groups and displacement.
6. Profit and operations: P&L vs budget, LY and comp set; F&B per occupied room; labour vs standards.

Several views are standard in RM practice but rarely drawn as charts in the products I could inspect: forecast ranges (P10–P90), group pace, P&L waterfalls, ARI × MPI quadrants and web booking funnels.

### Cited Findings

#### 1.1 Position against references (OTB vs STLY vs budget vs forecast)
- **Mews RMS overview** [text]: "The dashboard presents the following KPIs per month": RevPAR, occupancy, room nights, revenue and ADR.
  - Month-to-date is compared with STLY, and the forecast with last year's month-end, over "12 months rolling".
  - Source: [Mews help, Overview dashboard in Atomize](https://help.mews.com/s/article/Overview-dashboard-in-Atomize).
- **Duetto ScoreBoard** [text]: "Forecast in a flash. Get day-by-day forecasts across months and segments."; "Enter your monthly goal and let ScoreBoard break down your forecasts into daily rates."
  - The "New Forecast" form pre-fills from "My Forecast / Duetto Forecast / Final Last Year / Saved Forecast or Budget" [seen; marketing mock-up of a form, no chart].
  - Source: [Duetto ScoreBoard](https://www.duettocloud.com/en-us/platform/scoreboard).
- **Duetto Advance pinned date** [prior notes]: a table with columns Commit / STLY / Duetto Forecast / My Forecast / Budget. [Image](https://www.duettocloud.com/hs-fs/hubfs/Advance%20UI%20-%20Pin%20date.png?width=1920&height=700&name=Advance%20UI%20-%20Pin%20date.png).
- **Lighthouse** [text]: "Budget goals, forecasts, pickup and pace in one dashboard."; "Dates with abnormal pickup, sub-optimal pricing or significant market segment trends are flagged and surfaced for your team to action."
  - Source: [Lighthouse Performance, served at the Benchmark Insight URL](https://www.mylighthouse.com/platform/benchmark-insight).
- **CoStar/STR** [text]: OTB is "Sometimes called occupancy on the books, business on the books, or simply 'on the books'". [CoStar data-insights blog](https://www.costar.com/products/str-benchmark/resources/data-insights-blog/using-business-books-complete-benchmarking).
- **Demand Calendar, Juyo and RevView** show this view with explicit LY, OTB-LY and budget references (details in Q2) [seen; prior notes].
  - RevView's month table has the columns On the books, Forecast, Likely range, Occupancy ("83% LY 81%"), Net revenue, vs last year, and vs budget ("90% of budget").
  - Source: [RevView forecast screenshot](https://www.mews.com/api/media/file/bee7f546584b20ca1c4bdf533e1b12a9.jpg) [prior notes].

#### 1.2 Booking dynamics (pace curve, pickup, booking window, length of stay)
- **Pace, IDeaS G3** [text]: "a projection of when future bookings are likely to come in, based on current trends and what's already on the books. This visual helps clarify the forecast, particularly if recent trends differ from last year."
  - It can be compared "with a Previous Expected Booking Pace (from a selected number of days ago)".
  - Source: [IDeaS what's new, Aug 2025](https://ideas.com/improvements-innovations-whats-new-in-g3-rms-august-2025/).
- **Pace, FLYR** [text]: a booking curve "tracks the accumulation of bookings (and their associated revenue)… Pacing: How quickly bookings (and revenue) are building up. Historical Comparisons: Whether your current performance is ahead or behind the same period last period (STLP)."
  - Source: [FLYR help, Understanding booking curves, 27 Mar 2025](https://help.pacerevenue.com/en/articles/10962657-understanding-booking-curves).
- **Pickup, RoomPriceGenie** [text]: the dashboard "shows how many nights were booked within a chosen booking window, how many were cancelled, and how this compares to Last Year (LY)."
  - Its own warning: "Net pickup alone can hide important signals if cancellations offset new bookings."
  - Source: [RoomPriceGenie Pickup Dashboard](https://help.roompricegenie.com/en/knowledge/pickup-dashboard).
- **Pickup, Mews RMS** [text]: a report on "booking activity, room nights, and the amount of revenue generated" for yesterday and the last 3, 7 and 30 days. The pickup graph shows "the new reservations made for future stay dates".
  - Sources: [Overview dashboard](https://help.mews.com/s/article/Overview-dashboard-in-Atomize), [pickup graph](https://help.mews.com/s/article/How-is-the-pickup-graph-calculated).
- **Booking curve, booking window, Mews BI** [text]:
  - "Line chart showing occupancy growth by booking month" (also cumulative ADR, and reservations "including canceled").
  - "Column chart showing booking lead time by segment".
  - "Combo chart showing reservation counts by rate plan".
  - The aim: "Identify which months are ahead of or behind the same period last year."
  - Source: [Mews BI booking curve and trends dashboard](https://help.mews.com/s/article/The-Booking-curve-and-trends-dashboard-in-Mews-Business-Intelligence).
- **Booking window, Cloudbeds Insights** [text]: "Review occupancy, ADR, RevPAR, booking activity, booking window, channel contribution, room revenue…". [Cloudbeds BI](https://www.cloudbeds.com/business-intelligence-software/).
- **Lead time, FLYR** [text]: FLYR ships a "Detailed Lead Time Dashboard" (same booking-curves article).
- **Forward market pace, CoStar** [snippet]: Forward STAR reports "Occupancy on the Books and Pickup for the hotel as well as its (sub)market and competitive set", from "daily Adjusted Rooms Available and Rooms Booked for the next 90 days (for weekly reports) and 365 days (for monthly reports)".
  - Source: [Forward STAR guidelines](https://www.costar.com/products/str-benchmark/resources/guidelines/forward-star-data-reporting-guidelines).
- **Comparison alignment is a user choice in shipped tools.**
  - RoomPriceGenie's pickup chart has "Compare by: Date to Date" [seen, re-checked].
  - FLYR's query builder offers "Comparison Period = Last Year (DoW)", i.e. day-of-week aligned [seen].

#### 1.3 Stay-date calendars and heatmaps
- Month calendars and multi-month heat calendars are the industry's main view of future nights: Duetto Advance, FLYR Signals, Lighthouse Market Insight, RoomPriceGenie, Mews RMS and IDeaS mobile [prior notes, B1–B2].
- Demand Calendar adds a weekday × week "BOOKING PATTERN" heatmap of OTB for the next 12 months, captioned "DARKER MEANS HIGHER VOLUME" [seen]. [Image](https://www.demandcalendar.com/hubfs/Hotel%20Group%20Total%20Revenue%20on%20the%20books.webp).

#### 1.4 Market position (rate shopping and comp-set indices)
- **Rate shopping, Lighthouse** [text]: "Rates for hotels and short-term rentals, shopped live from all key channels in a single, accurate view."; "Forecast market shifts 365 days ahead using millions of real-time flight and hotel search signals."
  - Source: [Lighthouse Rate Insight / Pricing](https://www.mylighthouse.com/platform/rate-insight).
- **Comp median as the reference** [prior notes]:
  - FLYR's Quick View sentence: "Your shopped rate of €215 is 27% above the comp set median of €169."
  - Cloudbeds Revenue Intelligence prints "Market Median Rate £146".
- **Competitor prices in Mews RMS** [text]: it gives "insights into competitor prices in the near time (today and tomorrow)" ([Mews](https://help.mews.com/s/article/Overview-dashboard-in-Atomize)).
- **MPI definition** [text]: "compares your property's occupancy rate to the average occupancy rate of your competitive set". MPI = (hotel occupancy % ÷ comp-set occupancy %) × 100, and 100 means "capturing exactly its fair share of occupancy relative to the comp set".
  - Worked example: 82% vs 80% → MPI 102.5.
  - Source: [Lighthouse blog, D. Foreman, 13 Apr 2026](https://www.mylighthouse.com/resources/blog/market-penetration-index).
  - The same article only names ARI and RGI in its FAQ ("ARI compares your average daily rate"; "RGI compares your RevPAR"). An older snippet of a Lighthouse product page expands ARI as "Average Room Index" [snippet], which conflicts with "average rate index" in the blog.
- **STAR report structure** [third-party]: day-of-week and segmentation tabs; the comp set excludes the subject hotel; 100 = fair share. Sources: [SiteMinder](https://www.siteminder.com/r/hotel-star-reports/), [Hospitality Net](https://www.hospitalitynet.org/news/4127272/whats-a-hotel-star-report-answers-to-common-questions-about-str). STR's own pages returned 403.
- **Quadrant views**:
  - HotStats ProfitFinder: "Visualize your position with the Competitive Profitability Quadrant (CPQ)" [text, product sheet p.4, [PDF](https://www.duettocloud.com/hubfs/HotStats%20-%20Product%20Sheet.pdf)].
  - An ARI × MPI quadrant was not found in any vendor.

#### 1.5 Mix and value (segments, channels net of acquisition cost, groups and displacement)
- **Kalibri Labs, HSMAI Foundation, 2018** [text]:
  - "Hotels in the U.S. are spending 15-25% of Guest-Paid Revenue to acquire their customers."
  - "Revenue Capture, or percentage of revenue they keep after paying all costs of acquisition, is 75-85%."
  - "Net Revenue is revenue net of commissions, channel/transaction fees and loyalty costs."
  - "COPE = Contribution to Operating Profit and Expense."
  - Source: [Demystifying the Digital Marketplace, Estis Green & Lomanno](https://www.ahla.com/sites/default/files/ddm_3rd_tranche_final_6-1-18.pdf).
- **FLYR channel cost, 3 Aug 2026** [text]: "Comparing channels on revenue alone hides all of this — a channel that produces impressive top-line revenue can be far less profitable than a quieter one."
  - The Channel Profitability Report answers "which channels are actually the most valuable to your business, once you account for what it costs to sell through them?"
  - Source: [FLYR help](https://help.pacerevenue.com/en/articles/16186405-understanding-channel-cost-in-insights).
- **IDeaS channel forecasting** [text, title only]: "IDeaS Introduces Channel Forecasting for G3 RMS, Delivering Pivotal Insights into Channel Demand and Costs" ([Hospitality Net](https://hospitalitynet.org/news/4111186.html)).
- **Displacement, FLYR Groups Quotation** [text]:
  - "Displacement is the potential revenue you might miss out on from other guests". The method "Finds the Compression" and separates "primary" from "secondary displacement" on shoulder nights.
  - The KPI header includes "Breakeven – Revenue Based – the room rate above which this group will be net positive for revenue after factoring in displaced accommodation revenue", plus a profit-based breakeven and Group Budget.
  - Sources: [KPI overview, 6 Jul 2026](https://help.pacerevenue.com/en/articles/9807130-groups-quotation-kpi-overview), [price recommendation](https://help.pacerevenue.com/en/articles/13414638-understanding-your-group-price-recommendation).
- **Group tools at IDeaS and Duetto**:
  - IDeaS redesigned its Group Pricing Evaluator in Feb 2026 [text, [IDeaS](https://ideas.com/improvements-innovations-whats-new-in-g3-rms-february-2026/)].
  - Duetto's navigation lists "BlockBuster" ("Group business, streamlined") [text, [Duetto ScoreBoard page nav](https://www.duettocloud.com/en-us/platform/scoreboard)].
  - No displacement chart was found for any vendor.

#### 1.6 Uncertainty (forecast ranges)
- **IDeaS Forecast Investigator** [seen, re-checked; legend and axes only, the plot area showed "Data is not available. Requires at least 180 days of un-ignored data in the past 365 days to use."].
  - The "Actual versus Expected On Books (Transient Only)" chart has series **Actual On Books, Expected On Books, Lowest Expected, Highest Expected**, with x = Date and y = Rooms. So IDeaS shows an expected range per date.
  - Source: [IDeaS Aug 2025](https://ideas.com/improvements-innovations-whats-new-in-g3-rms-august-2025/).
- **RevView** (Mews Marketplace) draws "a dashed forecast line with a shaded 'likely range'" and reports "Accuracy ±5%" [prior notes; [image](https://www.mews.com/api/media/file/bee7f546584b20ca1c4bdf533e1b12a9.jpg)].
- **RoomPriceGenie revenue forecasting** [text]: "No budget needed… learns directly from your booking patterns, your on-the-books reservations, and your current and upcoming prices". Its chart encoding was not found. [RPG](https://help.roompricegenie.com/en/knowledge/revenue-forecasting).
- **No named vendor showed a P10/P50/P90 fan chart.**

#### 1.7 Profit and operations (P&L variance, F&B, labour)
- **HotStats** [text]:
  - "more than 500 key performance indicators of revenue and expense across the operated and undistributed departments down to GOP".
  - "Normalize the numbers by remapping all trial balance data to the latest edition of the USALI".
  - "compare your hotel's entire P&L with over 10,000 hotels worldwide"; "monthly updates rather than annual snapshots".
  - Sources: [product sheet](https://www.duettocloud.com/hubfs/HotStats%20-%20Product%20Sheet.pdf), [product page](https://www.duettocloud.com/en-us/platform/hotstats).
- **Flow-through** [third-party]: HotStats data cited by Hospitality Net says non-union hotels "convert 25%" of incremental revenue to profit, and union hotels "-1%" ([Hospitality Net, 2026](https://www.hospitalitynet.org/news/4130146/us-hotels-face-profit-pressure-as-labor-costs-outpace-recovery)).
- **M3** [snippet]:
  - "Whether it's occupancy, NOI, labor costs, or budget variance, create dashboards that reflect how you run your business" ([M3 Insight](https://www.m3as.com/insight/)).
  - Labour management: "demand-based scheduling with visual identification compared to budget and forecast metrics" ([M3 Labor](https://www.m3as.com/labor-management/)).
- **UniFocus labour standards** [snippet]: standards are expressed as "hours per occupied room (HPOR), covers per server, or check-ins per front desk agent". The worked example: 200 expected occupied rooms × 0.5 h = 100 housekeeping hours ([UniFocus blog](https://www.unifocus.com/blog/what-is-labor-standards-based-scheduling-a-guide-for-hotel-operators)).
- **Actabl PerfectLabor** [text]:
  - "real-time insight into labor spend versus forecast"; "Schedules dynamically adjust to occupancy, events, and seasonal demand" ([Hotel Tech Report listing](https://hoteltechreport.com/operations/scheduling-labor-management/hotel-effectiveness)).
  - "Create benchmark-driven productivity standards and compare property performance" ([Actabl](https://actabl.com/?p=20)).
- **No waterfall or bridge chart was found in any vendor** (HotStats, M3, Demand Calendar, Juyo, Duetto).

#### 1.8 Web funnel and reviews
- A web booking funnel (sessions → booking engine → bookings, by device) was **not found** in any named vendor, including Demand Calendar, which presents itself as hotel BI ("Static PDF reports are dead", [Demand Calendar](https://www.demandcalendar.com/en)).
- Review and reputation charts were not researched in this round.

### Inferences
- [our call] **Table stakes for a group analytics app.** These are the views every reference product has some form of:
  - monthly position vs STLY, LY and budget;
  - a pace curve;
  - pickup windows (1/7/28 days) with cancellations;
  - a stay-date calendar;
  - comp median vs own rate;
  - segment and channel mix.
- [our call] **Where Compass can be ahead.** These are rare in shipped products, and Compass already has the data for each:
  - honest forecast ranges, from the RMS P10/P50/P90;
  - channel mix net of commission (FLYR shipped its report only in Aug 2026);
  - a 20-hotel ARI × MPI quadrant;
  - a GOP bridge vs budget;
  - labour against a standard line.
- [our call] Expose both comparison alignments, date-to-date and 364-day day-of-week, and say which one a chart uses. Vendors offer both (RoomPriceGenie "Date to Date", FLYR "Last Year (DoW)").

### Gaps
- STR/CoStar's own definitions of MPI, ARI and RGI, and the STAR and Forward STAR chart layouts, could not be read (str.com and the costar.com glossary returned 403).
- No HSMAI or USALI primary text was opened in this round. USALI usage is evidenced only through HotStats' wording.
- Group pace as a chart: not found anywhere.
- Review and reputation views: not researched.

---

## 2. How do the named vendors present these views, and which use pie or donut charts?

### Takeaway
The vendors draw almost everything with columns, lines, reference ticks and dashed comparison lines, plus heat calendars and tables with in-cell bars. Uncertainty is nearly absent: only IDeaS (lowest and highest expected) and RevView (a likely-range band) show any.

No named RMS or BI vendor uses a pie or donut for channel or segment mix. The donuts found are single-KPI rings and gauges in labour and profit tools: Actabl, UniFocus and HotStats ProfitFinder.

### Cited Findings

#### Juyo (juyo.ai)
- **Canvas › Data Exploration** [seen, re-checked; dark theme; [image](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Home%20page%20commercial%201%20(1)-2100x2700.webp)].
  - Header: "CY 01 Nov 2026 ▸ 30 Nov 2026 | LY 01 Nov 2025 ▸ 30 Nov 2025".
  - KPI cards side by side: "OTB 52.9% / RN 7,313 / ADR €208.8 / Rev €1.527 M" and "OTB STLY 49.7% / RN 6,873 / ADR €210.3 / Rev €1.445 M".
  - "LENGTH OF STAY": grouped columns over LOS 1, 2, 3, 4…, y = "RNs", blue vs lavender. The legend isn't visible, but the pairing matches OTB vs STLY.
  - "SEGMENTS – MARKET GROUP": a table (Name, OTB, Diff) with a blue in-cell OTB bar carrying a thin lighter marker, and a diverging Diff bar, red for negative (Transient −74) and green for positive (Business Group +392). The Diff values sum to +440 = 7,313 − 6,873.
- **Text** [text]: "Build the views your team needs: zoom in, zoom out, cross-filter and drill deep."; "Portfolio view across properties" ([juyo.ai](https://juyo.ai/)).
- **Older Launchpad** [prior notes]: an OTB vs forecast area chart over "vertical date-lanes" ([image](https://images.ctfassets.net/nrwejlyqd8jv/45PQKFVwNSbpo7EJ8BDH7i/123a92010316645faa9f061c1c8e2dfa/Juyo6.jpg)).

#### Duetto (GameChanger, ScoreBoard, BlockBuster, Advance; HotStats is now "a Duetto company")
- **Public imagery is mostly form or table mock-ups:**
  - the ScoreBoard "New Forecast" form [seen];
  - the Advance Demand Calendar heatmap with a 5-step "Mild Anomaly → Strong Anomaly" ramp [prior notes, [image](https://www.duettocloud.com/hs-fs/hubfs/Advance%20Heatmap.png?width=2764&height=728&name=Advance%20Heatmap.png)];
  - the Daily Summary [prior notes].
- **ScoreBoard promise** [text]: "Put your hotel's data into charts and graphs to help spot patterns and trends." ([ScoreBoard](https://www.duettocloud.com/en-us/platform/scoreboard)).
- **Not found:** pace, pickup, rate-shop and displacement chart encodings. The help centre is not public.

#### IDeaS G3 RMS
- **Business Analysis › Pace Data, "Projected Booking Pace"** [seen, re-checked; [image](https://ideas.com/wp-content/uploads/2025/08/Whats-New-Q2-2025-Business-Analysis-Expected-Booking-Pace-1024x463.jpg)].
  - x = "Days to Arrival", running from 60 on the left through 0 to −30. y = "Occupancy", 0–3,000 room nights for the month.
  - Blue filled area: "Occupancy On Books (STLY)" across the whole axis.
  - Red filled area: "Occupancy On Books", from day 60 to the system date (about day 26). It overlaps the blue, and the overlap reads crimson.
  - Green line: "Occupancy Forecast", over the elapsed part.
  - Red dashed line: "Expected Booking Pace", from the system date onward.
  - Legend also lists "System Date".
  - Controls: "Days to Arrival: 60"; "Show Expected Booking Pace as of: [ ] days ago"; Show ADR / Revenue / None.
  - Navigation: a month picker with a day slider (1–31).
- **Forecast Investigator**: lowest and highest expected markers per date (see 1.6) [seen, re-checked].
- **Not found:** the displacement chart in the redesigned Group Pricing Evaluator; lead-time and LOS charts; pie or donut.

#### Lighthouse (formerly OTA Insight)
- **Benchmark illustration** [seen; stylised marketing graphic, not a product screenshot; [SVG](https://a.storyblok.com/f/288416513769651/411x350/dff1e7d033/benchmark-insight_duplo.svg)].
  - Metric tabs "Occupancy | ADR | …".
  - Grouped columns per period: My hotel (dark slate), Compset (orange) and a third blue series, probably Market.
  - Two lines with the area between them filled green where the hotel is above and red where it is below.
  - Overlay card: "1/10 Ranking", "+ $18 ↑ ADR", "164 MPI".
- **Hero illustration** [seen; stylised; [image](https://a.storyblok.com/f/288416513769651/2412x1645/e4fdf4eb43/hero-image-performance.webp)].
  - An "Own rates vs. compset" line chart: four coloured lines with point markers over about 16 dates, no axis labels.
  - An "ADR $94" card.
- **Market Insight** [prior notes]: mini month calendars on a 6-step blue↔red demand scale, and a demand-forecast chart with a "My price level" line and shaded weekends ([image](https://a.storyblok.com/f/288416513769651/1907x767/8826680520/market-outlook-static.png)).
- **Not found:** a comp min/max band, a median line, a parity chart, or BI pace-curve encodings. No real product screenshots of Rate Insight were reachable.

#### Mews RMS (powered by Atomize) and Mews BI
- **RMS overview** [text]:
  - Monthly KPI comparisons (MTD vs STLY, forecast vs LY month-end).
  - "the bottom graph" drills from a month into the distribution of bookings across stay dates.
  - A pickup report for yesterday and 3, 7 and 30 days.
  - Chart types and colours are not stated, and no screenshot was viewed.
  - Source: [Mews](https://help.mews.com/s/article/Overview-dashboard-in-Atomize).
- **BI booking curve** [text]:
  - Switchable cumulative lines (occupancy, ADR, reservations) by booking month.
  - Lead-time columns by segment, and a combo chart by rate plan.
  - "The data on the Booking curve and trends dashboard updates every two hours."
  - Source: [Mews BI](https://help.mews.com/s/article/The-Booking-curve-and-trends-dashboard-in-Mews-Business-Intelligence).

#### FLYR for Hospitality (formerly Pace; Duetto has announced acquiring it, per prior notes)
- **Quick View, "Price Evolution"** [seen; [article, 28 Jan 2025](https://help.pacerevenue.com/en/articles/10474776-understanding-the-ai-price-history-curve)].
  - Axes: x = update date over the 90 days before the stay night, with a range-brush mini chart underneath. Left y = "Price"; right y = "Occupancy" (0–100%).
  - Price lines: Base Rate as a dark grey step line; AI Price as a violet line; Price Freeze in blue; Manual Change as orange diamonds; Max/Min Rate Price as green and red dashed steps.
  - A "Booking Curve" as stacked pastel areas on the right axis.
  - The tooltip lists a segment-class mix as coloured dots (e.g., "Public Dynamic 50%… Group 6%").
  - Vendor purpose: "shows how FLYR would have priced a specific stay night without user influence during the 90 days leading up to that night."
- **Insights** [seen as a query table; [article](https://help.pacerevenue.com/en/articles/10962657-understanding-booking-curves)]: a pick-up query with "Comparison Period = Last Year (DoW)" and columns "Accommodation Revenue OTB / STLP". Insights supports bar, column, line, area, scatter, bubble and layered charts (collection titles).
- **Groups:** breakeven KPIs [text] (see 1.5). Chart not viewed.

#### RoomPriceGenie
- **Pickup "Nights sold" chart** [seen, re-checked; [article, images dated Mar 2026](https://help.roompricegenie.com/en/knowledge/pickup-dashboard)].
  - x = each stay date of the month. Weekend dates are underlined; Mar 02 is bold, its meaning not stated.
  - y = nights, from −20 to 60.
  - Stacked columns: dark indigo "In the last 90 days" at the bottom, lavender "Outside the last 90 days" on top.
  - Coral "Cancellations" bars below zero.
  - An amber "Last Year" line with dots.
  - Legend pills with eye toggles, and "Compare by: Date to Date".
  - Booking-window presets: Yesterday, Last 3/7/14/30/90 Days, Custom.
- **Filters** [text]: Room Type only so far ("more on the way") ([breakdown & filters](https://help.roompricegenie.com/en/knowledge/pickup-breakdown-filters)).

#### STR / CoStar
- **Forward STAR** [snippet]: hotel vs comp set vs submarket OTB and pickup in horizons "Next Weekend, Next 7 Days, Next 14 Days, Next 28 Days, and Next 90 Days" ([2019 sample PDF](https://str.com/sites/default/files/2019-07/forward-star-sample-report.pdf); returned 403).
- **STAR chart encodings:** not verified.

#### HotStats (Duetto)
- **Report navigation** [seen; [image](https://www.duettocloud.com/hs-fs/hubfs/HotStats-UI-16x9_Be-world-beating.png)]: Dashboard, KPI Report, Competitive Report, Growth Report, Summary P&L, Expanded P&L, Rooms, Room Stats, Food & Beverage, Other Operated, Admin & General, I.T., Sales & Marketing, Property & Maintenance, Utilities, Glossary. These are USALI departments, one report each.
- **Tables** [seen, low-res]: KPI and Summary P&L tables with "This Year / Last Year / Variance" column groups. No budget column was found.
- **F&B trend** [seen, re-checked, low-res; product sheet p.3]: a line chart "Food & Beverage Revenues Total POR" with **You (orange) vs Comp (grey)**.
- **ProfitFinder** [seen, re-checked, low-res; product sheet p.4]: 5 KPI cards headed "[value] vs [value]".
  - 3 cards show paired vertical bars, You (orange) vs Comp (blue-grey).
  - 2 cards show concentric **ring gauges** for percentage KPIs.
  - A table sits below the cards.
  - The CPQ quadrant itself is not shown.

#### M3
- No chart was viewed. Hotel Tech Report images were bot-blocked and m3as.com is script-gated.
- **Text** [text]:
  - "Use comparison columns to make faster decisions"; "Create unlimited and overlapping subgroups within a hotel portfolio" ([Hotel Tech Report listing](https://hoteltechreport.com/revenue-management/business-intelligence/m3-insight)).
  - The 2019 launch promised "interactive graphs, burst charts and animated diagrams" and a "pulse alert feature" ([PR Newswire, 15 Apr 2019](https://prnewswire.com/news-releases/m3-launches-new-business-intelligence-platform-300831345.html)).

#### Cloudbeds
- **Insights** [text]: "occupancy, ADR, RevPAR, booking pace, and channel performance, all current"; a Custom Builder that can "combine tables and visualizations into a single dashboard-style report" ([Cloudbeds](https://www.cloudbeds.com/business-intelligence-software/)).
- **Revenue Intelligence day detail** [prior notes]: forecast occupancy and revenue by days before arrival, with lines Current, Forecast with change, Forecast without change and Last year ([image](https://myfrontdesk.cloudbeds.com/hc/article_attachments/47606451992859)).
- **Not found:** chart encodings in Insights itself.

#### Demand Calendar (the richest public screenshots)
- **Top Management & Owners dashboard** [seen, re-checked; [image](https://www.demandcalendar.com/hubfs/Hotel%20Executive%20Overview.webp)]. One row per hotel plus "Chain Total", each with a value and a delta vs LY.
  - **Total and room revenue rows**: horizontal bars split into **Actual (blue) → On the books (light blue) → Forecast (hatched)**. Vertical ticks mark **Total Last Year (orange solid), OTB Last Year (orange dotted) and Budget (grey)**.
  - **Side panels**: "Total revenue analysis" (Room vs Other revenue stacked) and "Volume/Rate analysis".
  - **RevPAR row**: a narrow bar for the hotel sits inside a wider light "Compset Month to date" bar, with ticks for Last year, Compset Last year and Budget.
  - **"RGI Analysis"**: a dot with a whisker on a **ratio axis (1, 1.25, 1.5, 1.75) with a reference line at 1**, coloured "Positive" green or "Negative" red.
  - **"PRODUCTIVITY"**: RPH and Hours bars with a Last-year tick, and a "Cleaning time per occupied room (minutes)" dot-and-whisker.
- **Revenue Managers dashboard** [seen; [image](https://www.demandcalendar.com/hubfs/Hotel%20Group%20Total%20Revenue%20on%20the%20books.webp)].
  - Pickup "Last 28 days" table by stay month, with red and green cells.
  - "On The Books + Forecast" bars per month, with a legend of OTB, Forecast, Actual ly, OTB ly and Budget.
  - A weekday × week heatmap.
  - **"DAY BY DAY PICK-UP"**: blue pickup columns, pink negative pickup below zero, a dotted OTB line, short orange dashes on each date (unlabelled) and full-height Sunday bands. Toggles: Forecast / Actual ly / OTB / OTB ly. A "Show spreadsheet" link sits under the chart.
- **Marketing dashboard** [seen; [image](https://www.demandcalendar.com/hubfs/Micro-Segment%20Market%20Analysis%20(1).webp)].
  - "LONG-TAIL ANALYSIS": a Pareto-ranked dot line of segment × channel pairs, with "Top 80% of revenue" vs "Bottom 20% of revenue".
  - "TOP 5": bars with an orange Last Year tick.
- **Not found:** web analytics or funnel. A "CFO & Accounting" dashboard on net revenue after acquisition costs is mentioned only in a caption (not viewed).

#### Outside the list, used as evidence for labour views
- **UniFocus "Best Available Data"** [seen; [image](https://help.unifocus.com/help/Content/Resources/Images/bestdata.png)].
  - What it shows: "displays the Actual and Scheduled to Standard and Projected variance".
  - Chart: a horizontal bar chart. Legend: Actual Hours, Scheduled Hours, Standard Hours, Projected Hours.
  - A Chart | Grid toggle.
  - A "Variance Impact" **ring gauge** with red/yellow/green bands at ±20%.
  - Source: [UniFocus help](https://help.unifocus.com/help/Content/Best-Available-Data-screen-Labor-Dashboard.htm).
- **Actabl PerfectLabor** [seen; sample data from Mar 2023].
  - "High Overtime Risk" and "High MPR" as two-colour **donut rings** with hotel counts in the centre ("4 Hotels").
  - "Labor Cost %" and "Occupancy %" as semicircular **dials** ([image](https://actabl.com/wp-content/uploads/hotel-effectiveness-perfectlabor-labor-snapshot-report-below-hero.png)).
  - A portfolio "Labor Win Loss" grid of Win/Loss/Close Loss/Missing pills ([image](https://actabl.com/wp-content/uploads/hotel-effectiveness-perfectlabor-software-hero.png)).
  - Actual vs Variance cards with an Hours | Wages toggle ([image](https://actabl.com/wp-content/uploads/perfectlabor-labor-costs-group-summary-feature-1-737x512.png)).
  - A standards table with Fixed and Variable types ([image](https://actabl.com/wp-content/uploads/hotel-effectiveness-perfectlabor-labor-standards-report-feature-3-737x512.png)).

#### Pie and donut use
| Vendor | Pie/donut? | What for |
|---|---|---|
| Actabl | Yes [seen] | Two-colour donut rings counting hotels flagged (overtime risk, MPR); dial gauges for labour cost % and occupancy % |
| UniFocus | Yes [seen] | Ring gauge for "Variance Impact" with ±20% bands |
| HotStats ProfitFinder | Yes [seen, low-res] | Concentric ring gauges comparing a % KPI, You vs Comp |
| M3 | Mentioned [text] | "burst charts" (2019 launch release); not seen |
| Juyo, Duetto, IDeaS, Lighthouse, Mews RMS/BI, FLYR, RoomPriceGenie, STR/CoStar, Cloudbeds, Demand Calendar | Not found | FLYR shows segment-class mix as a list of coloured dots in a tooltip, not a pie [seen] |

#### Cross-vendor table (view → who ships it, in what form)
| View | Shipped by (form) | Not found |
|---|---|---|
| OTB vs STLY/LY/budget/forecast | Demand Calendar: bullet-style bars, hatched forecast, LY / OTB-LY / budget ticks [seen]. Juyo: OTB vs OTB STLY cards [seen]. Mews RMS: monthly KPIs [text]. Duetto: forecast/budget/LY objects, pinned-date table [seen form / prior]. RevView: table with likely range and % of budget [prior] | A budget line on any RMS chart |
| Pace by days before arrival | IDeaS: overlapping filled areas + forecast line + dashed expected pace [seen]. Cloudbeds RI: lines [prior]. FLYR: booking curves, OTB vs STLP DoW [seen table]. Mews BI: cumulative lines by booking month [text] | Duetto, RoomPriceGenie, Juyo charts |
| Pickup | RoomPriceGenie: stacked columns by booking recency, cancellations below 0, LY line [seen]. Demand Calendar: pickup table + daily columns + OTB line [seen]. Mews RMS: 1/3/7/30 days [text] | — |
| Booking window / LOS | Mews BI: lead-time columns by segment [text]. Juyo: LOS grouped columns [seen]. FLYR lead-time dashboard, Cloudbeds booking window [text] | LOS outside Juyo |
| Calendars / heat | See prior notes. Demand Calendar: weekday × week heatmap [seen] | — |
| Rate shopping | Lighthouse: own-vs-compset lines [seen illustration]. Cloudbeds RI: market median [prior]. FLYR: Market Rates tab [label]. Mews RMS: today/tomorrow [text] | Min–max band, parity chart |
| Rate evolution | FLYR: multi-line price history with min/max bounds + booking-curve areas [seen] | — |
| MPI / ARI / RGI | Lighthouse: columns + lines with green/red fill, ranking tile [seen illustration]. Demand Calendar: RGI dot-whisker on a ratio axis [seen] | ARI × MPI quadrant |
| Mix (net) | Juyo: in-cell bars + diverging diff [seen]. Demand Calendar: Pareto + top-5 bars with LY tick [seen]. FLYR: Channel Profitability Report [text] | Pie or donut for mix |
| Forecast range | IDeaS: lowest/highest expected markers [seen legend]. RevView: likely-range band [prior] | P10/P50/P90 fan |
| Displacement / group pace | FLYR breakeven KPIs, IDeaS GPE, Duetto BlockBuster [text] | Any chart |
| P&L variance | HotStats: TY / LY / variance tables [seen low-res]. M3: "budget variance" [snippet]. Demand Calendar: room/other and volume/rate split [seen] | Waterfall or bridge |
| F&B per occupied room | HotStats: line, You vs Comp [seen low-res] | Covers, average check |
| Labour | UniFocus [seen], Actabl [seen], Demand Calendar productivity [seen], M3 [snippet] | Hours vs occupancy over time |
| Web funnel | — | All named vendors |
| Portfolio | Demand Calendar: rows per hotel + Chain Total [seen]. Actabl: win/loss grid [seen]. UniFocus Property Ranking, HotStats ranking, Juyo Pro portfolio view [text] | Maps, small multiples |

### Inferences
- [our call] **Demand Calendar's executive rows are the clearest public precedent for Compass's position view.** In Stephen Few's terms they are bullet graphs, and in IBCS terms they use hatched forecasts (see Q3). Their one weakness is the orange LY and grey budget ticks, which are hard to tell apart at small sizes.
- [our call] **IDeaS draws OTB and STLY as overlapping opaque areas.** Where they overlap, the STLY shape is hidden, and the blended colour carries no meaning. Lines read better.
- [our call] **Pies are effectively absent from hotel RM tools.** When donuts appear, they encode a single proportion or a count (a KPI ring). Compass should follow that: use a ring only as a "% of target" or "share" glyph, never for a multi-part mix.
- [our call] **Comparison references are always drawn as ticks or dashed lines, never as a second bar of equal weight.** This matches Few's comparative measure and IBCS's lighter PY fill.

### Gaps
- **Duetto:** pace and rate charts not found (no public help centre).
- **Mews RMS:** chart encodings not published.
- **Lighthouse:** only marketing illustrations were reachable.
- **STR/CoStar:** STAR layouts blocked (403).
- **M3:** no visuals reachable.
- **Cloudbeds Insights:** no chart screenshots.
- **Demand Calendar:** the CFO dashboard was not viewed.
- **Hotel Tech Report:** screenshots for all vendors were bot-blocked.
- **No vendor** showed group pace, a displacement chart or a waterfall.

---

## 3. For each view, what is the clearest chart type, and what are the common mistakes?

### Takeaway
Most hotel views reduce to six chart patterns, built on the published rules below:
- **Bullet rows** for position against references.
- **Lines with a dashed comparison** for pace.
- **Diverging columns** for pickup and cancellations.
- **Bands** for forecast ranges.
- **Floating-bar bridges coloured by effect** for P&L variance.
- **Sorted bars split into net and cost** for mix.

The repeated mistakes:
- comparing OTB with a final LY;
- single-line forecasts;
- dual axes;
- overlapping opaque areas;
- pies with many slices;
- rainbow or diverging scales on unsigned data;
- colouring variances by sign instead of by effect.

### Cited Findings
- **Bullet graph (Stephen Few, spec last revised 10 Oct 2013)**:
  - It "was developed to replace the meters and gauges that are often used on dashboards".
  - Parts: a text label, a quantitative scale, a featured measure, "One or two comparative measures (optional)", and "From two to five ranges".
  - Ranges "should be limited to a maximum of five and ideally to three", drawn as intensities of a single hue: two ranges 35% and 10% black; three ranges 40%, 25% and 10%.
  - The featured bar is about ⅓ of the container's thickness. The comparative measure is "a short line that runs perpendicular to the orientation of the graph".
  - For future targets, add "a projection of where you'll be at the end of the period".
  - For expenses, reverse the range order.
  - Source: [Bullet Graph Design Specification](https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf).
- **Pies (Stephen Few, Aug 2007)**:
  - Pies "only make it easy to judge the magnitude of a slice when it is close to 0%, 25%, 50%, 75%, or 100%".
  - "bar graphs provide a much better means to compare the magnitudes of each part".
  - Their strength is that "the message 'part-to-whole relationship' is built right into it".
  - Source: [Save the Pies for Dessert](https://www.perceptualedge.com/articles/visual_business_intelligence/save_the_pies_for_dessert.pdf).
- **FT Visual Vocabulary** ([README](https://github.com/Financial-Times/chart-doctor/blob/main/visual-vocabulary/README.md)):
  - "Change over time" includes "fan chart (projection)" and "calendar heatmap". The fan chart is to "show the uncertainty in future projections - usually this grows the further forward to projection".
  - Part-to-whole includes waterfall. For pies, "be aware that it's difficult to accurately compare the size of the segments".
  - Deviation includes diverging bars.
- **Fan charts (Bank of England Quarterly Bulletin, Feb 1998; Britton, Fisher & Whitley)**:
  - The earlier single projection with a symmetric band "encouraged the reader to concentrate on an apparently precise central projection".
  - "the shaded area itself was often misread as indicating upper and lower bounds for the forecast, rather than the representation of probabilities".
  - The fan chart conveys the assessment "without suggesting a degree of precision that would be spurious".
  - The central projection is the mode, and mode, median and mean differ when risks are skewed.
  - Source: [Understanding the fan chart](https://www.bankofengland.co.uk/-/media/boe/files/quarterly-bulletin/1998/the-inflation-report-projections-understanding-the-fan-chart.pdf).
- **IBCS scenario notation (v1.1, UN 3.2)**:
  - Actual: "solid dark (e.g. black or dark gray) fill".
  - Earlier periods (Previous year): "a lighter solid fill (e.g. light gray)".
  - Plan and Budget: "bordered (outlined, framed) areas".
  - Forecast: bordered and "hatched".
  - Codes: AC, PY, PL, BU, FC.
  - "Readers of IBCS compliant reports can visually recognize these scenario types by looking at the area fill".
  - Source: [IBCS v1.1 pp.125–131](https://www.ibcs.com/wp-content/uploads/2021/02/IBCSv1-1_p125-131.pdf).
  - IBCS v2 (2 Jul 2026) aligns its notation with ISO 24896 [snippet, [PDF](https://www.ibcs.com/wp-content/uploads/2026/07/IBCS_v2_final_2026-07-02_jf-with-ad.pdf)].
- **Dual axes (Lisa Charlotte Muth, Datawrapper, 8 May 2018; edited Jul 2026)**:
  - "The scales of dual axis charts are arbitrary and can therefore (deliberately) mislead readers."
  - Preferred alternatives: side-by-side charts and indexed charts.
  - The 2026 edit softens the stance for expert audiences such as financial services.
  - Source: [Datawrapper](https://www.datawrapper.de/blog/dualaxis/).
- **WCAG 2.2, SC 1.4.11 (non-text contrast, AA)** ([Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)):
  - Graphical objects need "a contrast ratio of at least 3:1 against adjacent color(s)".
  - For pie charts, "you have to discern each slice of the pie chart from the others". The passing example adds "A darker border".
  - A graphic with "labels and values" conveys the same information as text, so it is exempt (the text must meet 1.4.3).
- **Acquisition cost**: 15–25% of guest-paid revenue goes on acquiring customers (Kalibri/HSMAI, see 1.5). So gross-only channel views overstate the value of high-commission channels.

### Inferences
The catalogue below is [our call] unless a source is named. Each entry lists: the question it answers · the clearest form · the encoding · common mistakes · where it is seen · the build recipe (R-numbers refer to Q4).

**V1. Position: OTB vs STLY vs budget vs forecast (monthly, or per hotel)**
- **Question:** will we make the month, and are we ahead of last year at the same lead time?
- **Form:** horizontal bullet rows, one per month (next 12) or per hotel.
- **Encoding:**
  - x = revenue or room nights, starting at 0;
  - a solid bar = actual + OTB (IBCS AC);
  - a hatched, outlined extension = forecast P50 still to come (IBCS FC; Few's "projection");
  - a dark tick = budget;
  - a grey tick = STLY OTB;
  - an optional faint tick = LY final;
  - optionally, a P10–P90 whisker at the end of the bar;
  - text at the right end: "€1.53M · +€82k vs STLY · 96% of budget".
  - Sort portfolio rows by gap to budget, not alphabetically.
- **Mistakes:**
  - comparing OTB with LY final;
  - an ambiguous "LY" label;
  - occupancy % across hotels with no room count;
  - gauges or donuts for "% of budget" (Few);
  - delta pills in every cell (prior notes);
  - a daily budget line drawn from an unphased monthly budget.
- **Seen in:** Demand Calendar [seen], Duetto pinned date [prior notes], Juyo [seen], Mews RMS [text], RevView [prior notes].
- **Build:** R1.

**V2. Pace (booking curve) by days before arrival**
- **Question:** is this night or month filling faster or slower than last year at the same lead time, and where is it heading?
- **Form:** a line chart.
- **Encoding:**
  - x = days before arrival, reversed so arrival is on the right (120 → 0);
  - y = cumulative rooms or revenue OTB, starting at 0;
  - this year as a solid accent line; STLY as a dashed neutral line, labelled with its alignment (date-to-date or 364-day DoW);
  - an optional 3-year median as a dotted line;
  - a "today" rule, and a gap label at today ("−17 rooms vs STLY");
  - from today to day 0, a P50 dotted line with a P10–P90 band;
  - a capacity line.
- **Mistakes:**
  - overlapping opaque areas (IDeaS);
  - not saying whether cancellations are netted;
  - 365-day alignment when weekday matters;
  - one curve for a whole month, which hides weekday mix;
  - a non-zero baseline on cumulative counts.
- **Seen in:** IDeaS [seen], Cloudbeds RI [prior notes], FLYR [seen table], Mews BI [text]; the insight feed's `paceLine` [prior notes].
- **Build:** R2.

**V3. Pickup (last 1/7/28 days) by stay date**
- **Question:** what did we sell and lose in the window, for which nights, against the same window last year?
- **Form:** diverging columns.
- **Encoding:**
  - x = stay date, with weekends shaded and events as labelled bands;
  - y = room nights;
  - above zero, new bookings (optionally split by booking recency, as RoomPriceGenie does); below zero, cancellations;
  - a marker for net pickup;
  - the same window last year as a dashed step line or ticks;
  - window presets of 1/3/7/14/28/90 days;
  - a monthly table of pickup by stay month with deltas vs LY (Demand Calendar).
- **Mistakes:**
  - net-only views (RoomPriceGenie's own warning);
  - confusing the booking-date and stay-date axes;
  - smooth lines through categorical days;
  - comparing hotels without normalising by rooms.
- **Seen in:** RoomPriceGenie [seen], Demand Calendar [seen], Mews RMS [text]; the insight feed's `eventBars` [prior notes].
- **Build:** R3.

**V4. Booking window and length of stay**
- **Question:** how far ahead, and for how long, do guests book (by segment or channel), and is that shifting?
- **Form:** columns by lead-time bucket with STLY behind (IBCS PY lighter, wider bar), or a cumulative share curve. For LOS, grouped columns.
- **Encoding:**
  - buckets 0, 1, 2–3, 4–7, 8–14, 15–30, 31–60, 61–90, 91–180, 181+;
  - y = share of room nights, labelled as such;
  - small multiples by segment with a shared y.
- **Mistakes:**
  - unequal bucket widths drawn like a histogram;
  - mixing bookings and room nights;
  - counting cancelled bookings;
  - share-only views that hide volume.
- **Seen in:** Mews BI [text], Juyo [seen], FLYR and Cloudbeds [text].
- **Build:** R4.

**V5. Calendars and heat tables**
- **Question:** which nights, or which hotel-nights, need attention?
- **Form:** a month heat calendar (prior notes), a weekday × week heatmap, and a hotel × date heat table for the portfolio.
- **Encoding:**
  - a single-hue sequential scale for unsigned metrics;
  - a diverging scale, centred at 0, only for signed metrics such as pace vs STLY in points;
  - 3–6 steps with words in the legend;
  - exceptions-only colouring for triage (Duetto).
- **Mistakes:**
  - rainbow scales;
  - a diverging scale on unsigned data;
  - colour as the only carrier;
  - Sunday-first weeks for European users.
- **Build:** R5.

**V6. Rate shopping across stay dates**
- **Question:** where is our price against the comp set for each upcoming night, and who moved?
- **Form:** lines with a comp range.
- **Encoding:**
  - x = stay date (90–365 days, with dataZoom);
  - own BAR as a bold step line;
  - comp median dashed;
  - comp min–max as light floating bars or a band;
  - individual competitors off by default, and listed in the tooltip sorted by price;
  - sold-out or closed competitors as a marker row, not as 0;
  - event bands;
  - optional second panel: own ÷ median × 100.
- **Mistakes:**
  - spaghetti of 8–10 lines;
  - using the mean instead of the median;
  - including our own hotel in the comp statistics;
  - non-like-for-like rates (room type, LOS, occupancy, meal plan, cancellation policy, taxes);
  - sold-out shown as 0;
  - independent scales across multiples.
- **Seen in:** Lighthouse [seen illustration], Cloudbeds RI [prior notes], FLYR [label], Mews RMS [text].
- **Build:** R6.

**V7. MPI, ARI and RGI**
- **Question:** are we getting our fair share, and is the gap rate-led or volume-led?
- **Forms:**
  - (a) index trend lines with a labelled line at 100, y centred on 100;
  - (b) a portfolio quadrant: x = ARI, y = MPI, a crosshair at 100/100, the dotted RGI = 100 iso-curve, one dot per hotel;
  - (c) dot + whisker for change vs LY (Demand Calendar).
- **The arithmetic:** RGI = MPI × ARI ÷ 100, because RevPAR = occupancy × ADR. So the iso-curve is MPI = 10,000 ÷ ARI.
- **Mistakes:**
  - reading "+5 points" as "+5%";
  - comparing levels across hotels whose comp sets differ;
  - an axis not centred on 100;
  - mixing the ratio (1.0, Demand Calendar) and index (100, Lighthouse) conventions.
- **Build:** R7.

**V8. Segment and channel mix, net of acquisition cost**
- **Question:** where does revenue come from, and what do we keep?
- **Form:** sorted horizontal bars split into net (solid) and commission/fees (hatched).
- **Encoding:**
  - label each bar with its cost share ("18% cost");
  - a STLY tick;
  - a diverging Diff column (Juyo);
  - a Pareto dot line for the long tail (Demand Calendar);
  - over time, 100% stacked columns only for ≤5 groups, otherwise small multiples.
- **Mistakes:**
  - pies or donuts with many slices (Few, FT);
  - gross-only ranking (Kalibri);
  - share-only views that hide growth;
  - a channel's colour changing between charts;
  - mixing segment (why the guest travels) with channel (where they booked).
- **Seen in:** Juyo [seen], Demand Calendar [seen], FLYR [text], RevView [prior notes]; the insight feed's `shareBar` [prior notes].
- **Build:** R8.

**V9. Forecast fan (P10/P50/P90)**
- **Question:** where will each night or month land, and how sure are we?
- **Form:** a fan chart.
- **Encoding:**
  - OTB bars as the floor;
  - P50 dashed;
  - a light P10–P90 band and a darker P25–P75 band (BoE: darker towards the centre);
  - capacity line, monthly budget ticks and a "today" rule;
  - a caption such as "8 in 10 nights should land in the band", but only if backtests support it.
- **Mistakes:**
  - a single line;
  - the band read as hard bounds;
  - P50 called "most likely" (it is the median, not the mode);
  - a band dipping below OTB;
  - band styling that matches actuals;
  - stack-trick tooltips that show band widths.
- **Seen in:** IDeaS [seen legend], RevView [prior notes]. A fan chart was not found in any named vendor.
- **Build:** R9.

**V10. Displacement (group evaluation)**
- **Question:** does this group earn more than the transient business it displaces, including shoulder nights?
- **Form:**
  - (a) per-night stacked columns: OTB, transient forecast still to come, and the group block, against a capacity line, with displaced transient hatched above capacity;
  - (b) a bridge: transient-only → + group rooms → − primary displacement → − secondary displacement → + ancillary profit → − commission → net;
  - (c) the quoted rate against revenue-based and profit-based breakeven lines (FLYR's KPIs).
- **Mistakes:** ignoring secondary displacement, wash or attrition, or profit; showing P50 only.
- **Build:** R11 + R10.

**V11. Group pace**
- **Question:** are definite and tentative group room nights for future months ahead of STLY and budget?
- **Form:** monthly bullet columns: definite solid, tentative outlined or hatched, with STLY and budget ticks.
- **Mistakes:** merging tentative into definite; confusing blocked rooms with picked-up rooms; ignoring wash.
- **Seen in:** not found as a chart in any vendor.
- **Build:** R1 (vertical) or R2.

**V12. P&L variance (GOP bridge)**
- **Question:** why is GOP different from budget or LY?
- **Form:** a waterfall from Budget GOP (outlined, IBCS plan) to Actual GOP (solid).
- **Encoding:**
  - steps are departmental revenue variances, then departmental and undistributed expense variances;
  - colour by effect on GOP (favourable / unfavourable), never by bar direction;
  - signed labels;
  - at most 10–12 steps, with an "Other" step;
  - horizontal when USALI labels are long;
  - annotate flow-through;
  - a Volume/Rate split for rooms (Demand Calendar).
- **Mistakes:**
  - cost overruns drawn green because the bar rises;
  - totals that look like steps;
  - too many steps;
  - variance % without its base.
- **Seen in:** HotStats tables [seen], Demand Calendar splits [seen]. A waterfall was not found in any vendor.
- **Build:** R10.

**V13. F&B per occupied room**
- **Question:** are in-house guests spending in our outlets, against LY, budget and the comp set?
- **Form:** a monthly line, You vs Comp (HotStats), with LY dashed. For the portfolio, a scatter of F&B POR against occupancy.
- **Mistakes:** dividing banquet or external revenue by occupied rooms without splitting it out; inconsistent treatment of service charge.
- **Build:** R2 / R7 patterns.

**V14. Labour vs demand**
- **Question:** did we staff to demand?
- **Form:** a scatter of daily hours against occupied rooms (or covers), with a dashed standard line (e.g., 0.5 h per occupied room, UniFocus's example) and a ±5–10% tolerance band. Also bullet rows per department: actual hours against a standard tick.
- **Mistakes:**
  - a dual axis of hours vs occupancy (Datawrapper);
  - labour cost % alone, which mixes wage rate and volume;
  - treating fixed positions as variable (Actabl separates Fixed and Variable);
  - dials and gauges (Few).
- **Seen in:** UniFocus [seen], Actabl [seen], Demand Calendar [seen].
- **Build:** R14.

**V15. Web funnel by device**
- **Question:** where do visitors drop out before booking?
- **Form:** horizontal step bars (sessions → searches → room/rate views → checkout → bookings) with step-conversion labels, as small multiples by device; plus conversion-rate lines over time.
- **Mistakes:** trapezoid funnels, whose areas distort; mixing users and sessions; quoting conversion without volume.
- **Seen in:** not found in any named vendor.
- **Build:** R15.

**V16. Portfolio overview (20 hotels)**
- **Question:** which hotels need attention?
- **Form:** ranked bullet rows with a "Chain Total" row (Demand Calendar), a hotel × KPI heat table, hotel × KPI small multiples, and the V7 quadrant.
- **Mistakes:** alphabetical order; independent scales across multiples; maps when there is no spatial question.
- **Build:** R1, R5, R12.

### Gaps
- No published hotel-specific usability study comparing these chart types was found. The recommendations rest on general dataviz research and on vendor practice.
- No public evidence was found on how well hotel users read forecast bands; the BoE paper is from macroeconomics.

---

## 4. ECharts 6 in Compass: what changed in v6, and how to build each view

### Takeaway
ECharts 6.1.0 (published 19 May 2026, still the latest on 20 Nov 2026) covers every view above with built-in series, plus two official custom series:
- `lineRange` for forecast bands;
- `barRange` for floating comp ranges and waterfalls.

What v6 adds:
- design-token themes with runtime `setTheme` (dark mode without re-initialising);
- matrix and calendar layouts that can host whole grids (small multiples);
- axis breaks, scatter jitter and beeswarm;
- automatic axis-label overflow protection.

In Angular 22, ngx-echarts 22 has signal inputs. Two of its behaviours shape the integration: it re-creates the chart when `[theme]` changes, and it replaces the whole option (`notMerge`) when `[options]` changes. Its modular build fits Compass's set in 246 KB gzip, against 375 KB for the full bundle.

Two settings are needed:
- Hatching for forecast and plan needs `aria.enabled` and `aria.decal.show`.
- The default v6 palette fails 3:1 contrast on white for 6 of its 9 colours, so Compass needs its own registered themes.

### Cited Findings

#### Versions in use
- **npm registry dates**:
  - `echarts` 6.0.0 on 2025-07-30 and 6.1.0 on 2026-05-19; latest = 6.1.0.
  - `ngx-echarts` 22.0.0 on 2026-06-11, with peer deps `@angular/core >=22.0.0` and `echarts >=5.0.0`. Its README changelog says "2026.06.09: v22 — Upgrade to angular 22".
  - Sources: [registry: echarts](https://registry.npmjs.org/echarts), [registry: ngx-echarts](https://registry.npmjs.org/ngx-echarts).
- **The compass repo** [measured]: `package.json` pins `echarts ^6.1.0` and `ngx-echarts ^22.0.0`. Installed: echarts 6.1.0, ngx-echarts 22.0.0, @angular/core 22.2.4 (`/Users/razvan/Web/compass/node_modules`).

#### What changed in 6.0 and 6.1 (official)
- **v6 feature page** ([handbook](https://echarts.apache.org/handbook/en/basics/release-note/v6-feature/)):
  - "The new theme system uses design tokens to reconstruct colors, spacing, and other design elements". A `v5.js` theme keeps the old look.
  - Themes switch at runtime without disposing the chart.
  - Dark mode is shown with `chart.setTheme('dark' | 'default')` driven by `prefers-color-scheme`.
  - New chord chart; beeswarm (`jitter` non-zero with `jitterOverlap: false`); scatter jitter.
  - Broken axis with a "torn-paper effect" and click-to-expand.
  - Matrix coordinate system.
  - Custom series "registered dynamically" and "used as easily as built-in series".
  - Six new custom charts: violin, contour, sleep stage, segmented doughnut, bar range, line range.
  - Default axis-label overflow and overlap prevention.
- **Upgrade guide** ([handbook](https://echarts.apache.org/handbook/en/basics/release-note/v6-upgrade-guide/)):
  - "the default position of the legend is now at the bottom of the canvas".
  - Restore v5 with `import 'echarts/theme/v5'` and `echarts.init(el, 'v5')`.
  - Disable overflow prevention with `grid.outerBoundsMode: 'none'`, and overlap prevention with `nameMoveOverlap: false`.
  - Rich-text labels now inherit plain-label font styles; `richInheritPlainLabel: false` restores the old behaviour.
- **Release notes** ([GitHub releases](https://github.com/apache/echarts/releases)):
  - 6.0.0: matrix coordinate system; "all series and components… are supported to be declaratively laid out" in matrix and calendar cells; reusable custom series, `compoundPath`, `tooltipDisabled`; axis break; scatter jitter; graph thumbnails; marker `z`/`z2`/`relativeTo`; reversible stack order; legend `triggerEvent`; tooltip `displayTransition`.
  - 6.1.0: axis `dataMin`/`dataMax`; `matrix.x/y.length` for headless matrices; matrix `triggerEvent`; visualMap `seriesTargets`; pie `tangential-noflip` labels; radar `clockwise`; a tooltip XSS fix in lines series; dataZoom fixes.

#### APIs confirmed in the installed 6.1.0 typings
Source for all items: `node_modules/echarts/types/dist/shared.d.ts`.
- **Exports**:
  - `echarts/charts`: Bar, Boxplot, Candlestick, **Chord**, Custom, EffectScatter, Funnel, Gauge, Graph, Heatmap, Line, Lines, Map, Parallel, PictorialBar, Pie, Radar, Sankey, Scatter, Sunburst, ThemeRiver, Tree, Treemap.
  - `echarts/components`: includes **MatrixComponent**, **ThumbnailComponent**, CalendarComponent, AriaComponent, MarkArea/MarkLine/MarkPoint, DataZoom (inside/slider), VisualMap (continuous/piecewise), Dataset, Transform.
  - `echarts/features`: LabelLayout, UniversalTransition.
- **Theme and series registration**: `setTheme(theme, { silent })`, `registerTheme(name, theme)`, `registerCustomSeries(seriesType, renderItem)`.
- **Layout in matrix and calendar cells**: components and series take `coordinateSystemUsage?: 'data' | 'box'` and `coord`. Per the typings comment, "grid rect (cartesian rect) is calculate based on matrix/calendar coord sys; pie center is calculated based on calendar/cartesian".
- **Grid bounds**: `grid.outerBoundsMode: 'auto' | 'same' | 'none'`, `outerBounds`, `outerBoundsContain`. `containLabel` is marked `@deprecated Use grid.outerBounds instead`.
- **Stacking**: `stackStrategy?: 'samesign' | 'all' | 'positive' | 'negative'`, `stackOrder?: 'seriesAsc' | 'seriesDesc'`.
- **Markers**: statistics `'average' | 'min' | 'max' | 'median'`; marker position `relativeTo?: 'container' | 'coordinate'` with `coord`, `xAxis`, `yAxis`.
- **Lines and bars**: line `endLabel`, `step: false | 'start' | 'end' | 'middle'`; `barGap`, `barCategoryGap`.
- **Tooltip and dataZoom**: tooltip order modes `'valueAsc' | 'valueDesc' | 'seriesAsc' | 'seriesDesc'`; dataZoom `filterMode: 'filter' | 'weakFilter' | 'empty' | 'none'`.
- **Responsive**: `media` units with `query: { minWidth, maxWidth, minHeight, maxHeight, minAspectRatio, maxAspectRatio }`.
- **Calendar**: `cellSize` (number, `'auto'` or a pair), `range`, `orient`, `dayLabel.firstDay`, `monthLabel`, `splitLine`.
- **Decal**: `DecalObject` has `symbol`, `symbolSize`, `symbolKeepAspect`, `color`, `backgroundColor`, `dashArrayX`, `dashArrayY`, `rotation`, `maxTileWidth`, `maxTileHeight`.
- **Aria**: `aria.enabled`, `aria.label.description`, `aria.decal.show`, `aria.decal.decals`.
- **Built-in themes**: 'default' and 'dark' are registered in core. The source comment: "Default theme, so that we can use `chart.setTheme('default')` to revert" (`node_modules/echarts/lib/core/echarts.js` lines 2484–2487).
- **v6 default palette** [measured, from `lib/visual/tokens.js`]: `#5070dd #b6d634 #505372 #ff994d #0ca8df #ffd10a #fb628b #785db0 #3fbe95`. Dark mode keeps the same theme colours ("Don't modify theme colors").

#### Official examples and custom series used in the recipes
- **Confidence band** ([source](https://github.com/apache/echarts-examples/blob/gh-pages/public/examples/ts/confidence-band.ts)):
  - a lower-bound line with `lineStyle.opacity: 0`, plus an "upper − lower" line with `areaStyle`, both on `stack: 'confidence-band'`;
  - the central line drawn separately;
  - a `base` offset added so negative values stack.
- **Waterfall** ([source](https://github.com/apache/echarts-examples/blob/gh-pages/public/examples/ts/bar-waterfall2.ts)): a transparent "Placeholder" bar (`color` and `borderColor` set to `'transparent'`) stacked under "Income" and "Expenses" bars on `stack: 'Total'`.
- **Calendar**:
  - [calendar-heatmap](https://github.com/apache/echarts-examples/blob/gh-pages/public/examples/ts/calendar-heatmap.ts) and [calendar-charts](https://github.com/apache/echarts-examples/blob/gh-pages/public/examples/ts/calendar-charts.ts): heatmap and scatter with `coordinateSystem: 'calendar'`.
  - [calendar-pie](https://github.com/apache/echarts-examples/blob/gh-pages/public/examples/ts/calendar-pie.ts): pies with `coordinateSystem: 'calendar'` and a date `center`, plus a size-0 scatter series used only for day labels.
- **Matrix (since 6.0.0)**:
  - [matrix-stock](https://github.com/apache/echarts-examples/blob/gh-pages/public/examples/ts/matrix-stock.ts) places cartesian grids in cells: `grid: [{ coordinateSystem: 'matrix', coord: [0, 0], top: 0, … }, …]`.
  - [matrix-pie](https://github.com/apache/echarts-examples/blob/gh-pages/public/examples/ts/matrix-pie.ts) puts pies at `center: ['Grade 1', 'Class 1']`.
  - [matrix-mini-bar-data-collection](https://github.com/apache/echarts-examples/blob/gh-pages/public/examples/ts/matrix-mini-bar-data-collection.ts) collects headers from `dataset`.
  - Axis breaks: [bar-breaks-simple](https://github.com/apache/echarts-examples/blob/gh-pages/public/examples/ts/bar-breaks-simple.ts) uses `breaks: [{ start, end, gap: '1.5%' }]` with `breakArea`.
- **Custom series packages** ([repo](https://github.com/apache/echarts-custom-series); npm `@echarts-x/*`, peer `echarts ^6.0.0`):
  - Versions: `custom-line-range` 1.1.1 (2026-01-12), `custom-bar-range` 1.2.1 (2026-01-12), `custom-segmented-doughnut` 1.1.1 and `custom-violin` 1.1.1 ([registry](https://registry.npmjs.org/@echarts-x%2Fcustom-line-range)). The repo also lists liquidFill, wordCloud, contour and stage.
  - Usage: `echarts.use(installer)`, then `{ type: 'custom', renderItem: 'lineRange' }`.
  - lineRange: data `[x, yStart, yEnd]`; `itemPayload.areaStyle.opacity` defaults to 0.2. The official example pairs it with a line series of the same `name` so they share a colour.
  - barRange: data `[x, low, high]`; `itemPayload` has `barWidth` (default `70%`), `borderRadius` and `margin`.
  - Both official examples use `encode: { x: 0, y: [1, 2], tooltip: [1, 2] }` on a category x-axis ([lineRange example](https://github.com/apache/echarts-custom-series/blob/main/custom-series/lineRange/examples/index.html), [barRange example](https://github.com/apache/echarts-custom-series/blob/main/custom-series/barRange/examples/index.html)). The lineRange README's first snippet shows `x: [1, 2], y: 0` instead, which contradicts its own example.

#### ngx-echarts 22 behaviour (read from its shipped source, `fesm2022/ngx-echarts.mjs`; [repo](https://github.com/xieziyu/ngx-echarts))
- **Inputs and outputs**: all inputs are signal `input()`s (`options`, `theme`, `initOpts`, `merge`, `autoResize`, `loading`, `loadingType`, `loadingOpts`). Outputs use `output()`, and event outputs are bound lazily (`chartClick`, `chartDataZoom`, `chartLegendSelectChanged`, `chartFinished`, …).
- **How options are applied**:
  - On first init, and on every `[options]` change: `setOption(options, true)` (`notMerge`).
  - On `[merge]` change: `setOption(merge)` (merge mode).
- **Theme**: a `[theme]` change calls `refreshChart()`, which **disposes and re-creates** the chart.
- **Resizing**:
  - A `ResizeObserver` created outside the NgZone, firing through `requestAnimationFrame` and a 100 ms trailing `throttleTime`.
  - The first observer fire is ignored.
  - It throws "please install a polyfill for ResizeObserver" if the API is missing.
- **Height**: if the host has no height, it sets `height: 400px`.
- **Lazy loading**: the `echarts` provider may be a function returning a promise. The source: "check if the echarts module is provided as function returning native import('...') then use the promise".
- **Setup**: the README shows standalone use with `NgxEchartsDirective`, and `provideEchartsCore({ echarts })` for tree-shaken builds.

#### Accessibility (official)
- **Descriptions**: with `aria.enabled`, ECharts writes a generated `aria-label` from the title, series and data. `aria.label.description` replaces it; the docs recommend this for dense charts ([option doc source](https://github.com/apache/echarts-doc/blob/master/en/option/component/aria.md)).
- **Decals**:
  - "It works only if aria.enabled and aria.decal.show are both set to be true."
  - "If it is set to be 'none', no decal will be used."
  - For lines, it "works only if areaStyle is set".
  - The default decal colour is `rgba(0, 0, 0, 0.2)`.
  - Source: [decal doc source](https://github.com/apache/echarts-doc/blob/master/en/option/partial/decal.md).
- **Naming conflict**: the handbook page mixes `aria.show` and `aria.enabled`. The option source and the typings use `aria.enabled` ([handbook](https://echarts.apache.org/handbook/en/best-practices/aria/)).

#### Renderer, bundle size, contrast
- **Canvas vs SVG** ([handbook](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/)):
  - "Canvas is more suitable for charts with a large number of elements".
  - "SVG has an important advantage: It has less memory usage (which is important for mobile devices)", which suits pages with many chart instances.
  - The SVG renderer uses a virtual DOM since 5.3.0, "2-10 times" faster.
  - Switch with `init(dom, null, { renderer: 'svg' })`.
- **Bundle size** [measured; esbuild 0.28.2, minified ESM, ECharts 6.1.0; gzip level 9, brotli default]:

| Import | Minified | gzip | brotli |
|---|---|---|---|
| `import * as echarts from 'echarts'` (full) | 1,115 KB | 375 KB | 305 KB |
| core + Line + Bar + Grid + Tooltip + Canvas | 526 KB | 180 KB | 153 KB |
| Compass set: Line, Bar, Scatter, Heatmap, Custom; Grid, Tooltip, Legend, Dataset, Transform, MarkLine/Area/Point, DataZoom, VisualMap, Calendar, Aria, Title; LabelLayout, UniversalTransition; Canvas | 728 KB | 246 KB | 205 KB |
| … + Pie + Matrix + SVG renderer | 781 KB | 266 KB | 222 KB |

- **Palette contrast** [measured, WCAG relative-luminance formula], for the v6 default palette:
  - **On white**: `#5070dd` 4.47, `#b6d634` 1.66, `#505372` 7.44, `#ff994d` 2.12, `#0ca8df` 2.73, `#ffd10a` 1.46, `#fb628b` 2.91, `#785db0` 5.26, `#3fbe95` 2.33. Six of nine are below the 3:1 of SC 1.4.11.
  - **On the v6 dark background** `rgba(4,8,16,1)`: only `#505372` (2.69) is below 3:1.

### Inferences
Build recipes; the designs are [our call], and every API used is cited above.


**R0. One setup module, lazily loaded**
```ts
// charts/echarts-setup.ts — the only file importing from 'echarts/*'
import * as echarts from 'echarts/core';
import { BarChart, LineChart, ScatterChart, HeatmapChart, CustomChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, DatasetComponent, TransformComponent,
  MarkLineComponent, MarkAreaComponent, DataZoomComponent, VisualMapComponent,
  CalendarComponent, MatrixComponent, AriaComponent } from 'echarts/components';
import { LabelLayout, UniversalTransition } from 'echarts/features';
import { CanvasRenderer, SVGRenderer } from 'echarts/renderers';
import lineRange from '@echarts-x/custom-line-range';
import barRange from '@echarts-x/custom-bar-range';
import { compassLight, compassDark } from './themes';

echarts.use([BarChart, LineChart, ScatterChart, HeatmapChart, CustomChart, PieChart,
  GridComponent, TooltipComponent, LegendComponent, DatasetComponent, TransformComponent,
  MarkLineComponent, MarkAreaComponent, DataZoomComponent, VisualMapComponent,
  CalendarComponent, MatrixComponent, AriaComponent, LabelLayout, UniversalTransition,
  CanvasRenderer, SVGRenderer, lineRange, barRange]);
echarts.registerTheme('compass-light', compassLight);
echarts.registerTheme('compass-dark', compassDark);
export { echarts };

// app.config.ts
providers: [provideEchartsCore({ echarts: () => import('./charts/echarts-setup').then(m => m.echarts) })]
```
- Lazy loading keeps the roughly 246–266 KB gzip out of the first paint.
- `CustomChart` must be registered for `type: 'custom'`. That the `@echarts-x` installers need it is my assumption; verify at build time.

**R1. Bullet rows (V1, V11, V16)**
```ts
{
  aria: { enabled: true, label: { description: summary }, decal: { show: true } }, // needed for any hatch
  grid: { left: 72, right: 160, top: 8, bottom: 24 },
  yAxis: { type: 'category', data: rows, inverse: true, axisTick: { show: false } },
  xAxis: { type: 'value', min: 0 },
  series: [
    { name: 'On the books', type: 'bar', stack: 'pos', barWidth: '45%', data: otb,
      itemStyle: { color: tokens.ink, decal: 'none' } },
    { name: 'Forecast to come (P50)', type: 'bar', stack: 'pos', data: p50.map((v, i) => v - otb[i]),
      itemStyle: { color: 'transparent', borderColor: tokens.ink, borderWidth: 1,
        decal: { symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [2, 4], rotation: -Math.PI / 4, color: tokens.inkMuted } },
      label: { show: true, position: 'right', formatter: (p) => rowText[p.dataIndex] } },
    { name: 'STLY', type: 'scatter', symbol: 'rect', symbolSize: [2, 22], z: 3,
      data: stly.map((v, i) => [v, i]), itemStyle: { color: tokens.muted, decal: 'none' } },
    { name: 'Budget', type: 'scatter', symbol: 'rect', symbolSize: [3, 26], z: 4,
      data: budget.map((v, i) => [v, i]), itemStyle: { color: tokens.ink, decal: 'none' } },
  ],
}
```
- Hatching follows IBCS FC (outlined and hatched). It requires `aria.decal.show`, so every other series sets `decal: 'none'`.
- Few's qualitative ranges become three bars at 40/25/10% intensity, drawn behind the others with `barGap: '-100%'`.

**R2. Pace curve by days before arrival (V2)**
```ts
{
  xAxis: { type: 'value', inverse: true, min: 0, max: 120, name: 'Days before arrival' }, // arrival at right
  yAxis: { type: 'value', min: 0, max: capacity },
  series: [
    { name: 'P10–P90', type: 'custom', renderItem: 'lineRange', data: band /* [dba, p10, p90] */,
      encode: { x: 0, y: [1, 2], tooltip: [1, 2] }, itemPayload: { areaStyle: { opacity: 0.15 } } },
    { name: 'STLY', type: 'line', data: stly /* [dba, rooms] */, showSymbol: false,
      lineStyle: { type: 'dashed', width: 1.5 } },
    { name: 'This year', type: 'line', data: ty, showSymbol: false, lineStyle: { width: 2.5 },
      endLabel: { show: true, formatter: (p) => `${p.value[1]} rooms` },
      markLine: { symbol: 'none', silent: true, data: [
        { xAxis: dbaToday, label: { formatter: 'Today' } },
        { yAxis: capacity, label: { formatter: 'Capacity' } } ] } },
    { name: 'Projection (P50)', type: 'line', data: proj, showSymbol: false, lineStyle: { type: 'dotted' } },
  ],
  tooltip: { trigger: 'axis' },
}
```
- Put the gap label ("−17 vs STLY") in the card header or as a `markPoint` at today.
- The prior notes use a 140 px card for this chart.

**R3. Pickup with cancellations below zero (V3)**
```ts
{
  xAxis: { type: 'category', data: stayDates },
  yAxis: { type: 'value' },
  series: [
    { name: 'Booked', type: 'bar', stack: 'pickup', data: gross },
    { name: 'Cancelled', type: 'bar', stack: 'pickup', data: cancelled.map(v => -v) },  // 'samesign' default stacks negatives apart
    { name: 'Same window LY', type: 'line', step: 'middle', showSymbol: false, data: lyPickup,
      lineStyle: { type: 'dashed' },
      markArea: { silent: true, data: weekendRanges.map(([a, b]) => [{ xAxis: a }, { xAxis: b }]) },
      markLine: { symbol: 'none', data: [{ xAxis: todayLabel, label: { formatter: 'Today' } }] } },
  ],
  dataZoom: [{ type: 'inside' }, { type: 'slider', height: 16 }],
}
```
- Events become extra `markArea` items with `name` labels.
- Booking recency (like RoomPriceGenie's "In the last 90 days") is a third stacked series.

**R4. Booking window with STLY behind (V4)**
- Use a category axis of buckets.
- The STLY series is a wide, light bar (`barWidth: '60%'`).
- The this-year series is a narrow dark bar (`barWidth: '30%'`, `barGap: '-100%'`) drawn over it, which is IBCS's PY lighter fill.
- For shape, use a `line` with `step: 'end'` over the cumulative share.
- LOS uses the same pattern.

**R5. Calendar heatmap and heat tables (V5, V16)**
```ts
{
  calendar: { range: ['2026-12-01', '2027-02-28'], cellSize: ['auto', 30], orient: 'horizontal',
    dayLabel: { firstDay: 1 }, splitLine: { show: false } },
  visualMap: { type: 'piecewise', seriesIndex: 0, orient: 'horizontal', left: 'center', bottom: 0,
    pieces: [ { lt: 50, label: 'Below 50%', color: seq[0] }, { gte: 50, lt: 80, label: '50–79%', color: seq[1] },
              { gte: 80, label: '80% and above', color: seq[2] } ] },
  series: [
    { type: 'heatmap', coordinateSystem: 'calendar', data: nights.map(n => [n.date, n.occ]) },
    { type: 'scatter', coordinateSystem: 'calendar', symbolSize: 0, silent: true,
      data: nights.map(n => [n.date, n.bar]), label: { show: true, formatter: (p) => `€${p.value[1]}` } },
  ],
}
```
- The size-0 scatter for labels is the technique from the calendar-pie example.
- Portfolio heat table: a cartesian `heatmap` with category x (dates) and category y (hotels). Use a diverging `visualMap` centred on 0 only for signed pace points.
- The richer decision cells described in the prior notes need a `custom` series `renderItem`, or HTML.

**R6. Rate shop (V6)**
```ts
{
  xAxis: { type: 'category', data: stayDates },
  yAxis: { type: 'value', scale: true },
  legend: { selected: Object.fromEntries(comps.map(c => [c.name, false])) },   // competitors off by default
  tooltip: { trigger: 'axis', order: 'valueDesc' },
  series: [
    { name: 'Comp set min–max', type: 'custom', renderItem: 'barRange', data: days.map((d, i) => [i, d.min, d.max]),
      encode: { x: 0, y: [1, 2], tooltip: [1, 2] }, itemPayload: { barWidth: 6, borderRadius: 3 } },
    { name: 'Comp set median', type: 'line', data: median, showSymbol: false, lineStyle: { type: 'dashed' } },
    { name: 'Our BAR', type: 'line', step: 'middle', data: own, showSymbol: false, lineStyle: { width: 2.5 } },
    ...comps.map(c => ({ name: c.name, type: 'line', data: c.rates, showSymbol: false, lineStyle: { width: 1 } })),
  ],
  dataZoom: [{ type: 'inside' }, { type: 'slider' }],
}
```
- Sold-out competitors: a scatter row pinned to the top of the grid, using a `path://` cross symbol.

**R7. Index trend and ARI × MPI quadrant (V7)**
```ts
// Trend: y centred on 100
yAxis: { type: 'value', min: 70, max: 130 },
markLine: { symbol: 'none', silent: true, data: [{ yAxis: 100, label: { formatter: 'Fair share' } }] },

// Quadrant: one dot per hotel, RGI = 100 iso-curve
{
  xAxis: { type: 'value', name: 'ARI', min: 60, max: 140 },
  yAxis: { type: 'value', name: 'MPI', min: 60, max: 140 },
  series: [
    { type: 'scatter', symbolSize: 10, data: hotels.map(h => ({ name: h.name, value: [h.ari, h.mpi] })),
      label: { show: true, position: 'right', formatter: '{b}' }, labelLayout: { hideOverlap: true },
      markLine: { symbol: 'none', silent: true, data: [{ xAxis: 100 }, { yAxis: 100 }] },
      markArea: { silent: true, data: [
        [{ name: 'Rate-led', coord: [100, 60] }, { coord: [140, 100] }],
        [{ name: 'Winning share', coord: [100, 100] }, { coord: [140, 140] }],
        [{ name: 'Volume-led', coord: [60, 100] }, { coord: [100, 140] }],
        [{ name: 'Losing share', coord: [60, 60] }, { coord: [100, 100] }] ] } },
    { name: 'RGI = 100', type: 'line', showSymbol: false, silent: true, lineStyle: { type: 'dotted' },
      data: range(72, 139).map(ari => [ari, 10000 / ari]) },
  ],
}
```
- Trails to last month: one faint `line` per hotel (a connected scatter).

**R8. Mix net of commission (V8)**
- Use `dataset` with a `transform: { type: 'sort', config: { dimension: 'gross', order: 'asc' } }`.
- Two `bar`s on one `stack`: net (solid) and commission & fees (hatched decal). Add a `scatter` tick for gross STLY. `yAxis` is the category axis.
- `universalTransition` can morph the bars to a 100% view when toggled.
- If a ring is truly needed for a single share (e.g., "OTA share 41%"):
  - use `pie` with `radius: ['60%', '78%']` and 2 slices;
  - add direct labels;
  - set `itemStyle.borderColor` to the surface colour with `borderWidth: 2`, the slice-separation fix from the WCAG 1.4.11 example;
  - `@echarts-x/custom-segmented-doughnut` suits progress rings.

**R9. Forecast fan (V9)**
- Use `bar` for OTB, then two `lineRange` series: P10–P90 at opacity 0.15 and P25–P75 at 0.3. Add a dashed `line` for P50, and `markLine` for capacity and today.
- Fallback without the plugin: the stack trick from the confidence-band example (an invisible lower line plus an `areaStyle` difference series). Its tooltips show the band width, so supply a `tooltip.formatter` that prints P10 and P90.

**R10. GOP bridge (V12; also V10)**
- **Horizontal (long USALI labels):** the official placeholder pattern. `yAxis` is the category axis; a transparent "base" bar plus "favourable" and "unfavourable" bars share one `stack`.
- **Limitation:** the placeholder method breaks when the running total crosses zero.
- **Vertical:** `barRange` gives `[i, low, high]` per step and handles crossing zero.
  - Use three series (totals, favourable, unfavourable), so colour follows effect on GOP rather than direction.
  - The Budget total is outlined (IBCS plan), and the Actual total is solid.
- **Labels:** `label.formatter` prints signed € values.

**R11. Displacement nights (V10)**
- Stacked columns: OTB, transient to come and the group block.
- A `markLine` for capacity.
- An "over capacity → displaced" series with a hatch decal.
- Pair it with R10 for the money bridge, and a `markLine` at the breakeven rate on a rate chart.

**R12. Small multiples for 20 hotels (V16)**
- **v6 matrix layout:**
```ts
{
  matrix: { x: { data: kpis }, y: { data: hotels }, left: 140, right: 8, top: 24, bottom: 8 },
  grid: hotels.flatMap((_, r) => kpis.map((_, c) => ({ coordinateSystem: 'matrix', coord: [c, r], top: 4, bottom: 4, left: 4, right: 4 }))),
  // one xAxis/yAxis/series per grid via gridIndex / xAxisIndex / yAxisIndex; give each KPI column a shared min/max
}
```
- **Alternatives:** classic multi-`grid` with `axisPointer: { link: [{ xAxisIndex: 'all' }] }`, or an Angular `@for` of small chart components. For many instances, use the SVG renderer (per the handbook's memory note).

**R13. Sparklines (KPI tiles, table cells)**
- `grid: { left: 0, right: 0, top: 2, bottom: 2 }`.
- Hidden axes, with `yAxis.scale: true`.
- `animation: false`, `silent: true`, `tooltip: { show: false }`.
- A dashed STLY `line`, as in the insight feed's Pulse tiles.
- In table rows with dozens of cells, plain inline SVG polylines in Angular are cheaper than one ECharts instance per cell.

**R14. Labour vs standard (V14)**
- A `scatter` of `[occupiedRooms, hours, date]`.
- A dashed `line` for the standard, `[[0, 0], [maxRooms, hpor * maxRooms]]`, plus a `lineRange` tolerance band.
- For time series, use two grids with a shared category x and `axisPointer.link`, rather than a dual axis.

**R15. Web funnel (V15)**
- Horizontal `bar`s per step, with step-conversion labels via `label.formatter`, as small multiples by device (R12).
- `FunnelChart` exists in the bundle, but bars are more precise; this is a choice from Few's position-vs-area argument.

**R16. Theme, dark mode, accessibility, responsiveness and Angular signals**
- **Themes**:
  - Register `compass-light` and `compass-dark` from the app's design tokens, with `backgroundColor: 'transparent'` so charts sit on the app's surfaces. The v6 dark token background is `rgba(4,8,16,1)`.
  - Choose a categorical palette with ≥3:1 contrast against both surfaces.
  - Switch with `chart.setTheme(...)` on the instance from `(chartInit)`. Binding `[theme]` would make ngx-echarts dispose and re-create every chart.
```ts
@Service()
export class ChartTheme {
  private readonly dark = signal(matchMedia('(prefers-color-scheme: dark)').matches);
  readonly name = computed(() => (this.dark() ? 'compass-dark' : 'compass-light'));
  constructor() { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => this.dark.set(e.matches)); }
}

@Component({
  selector: 'cx-pace-chart',
  imports: [NgxEchartsDirective],
  template: `<div echarts class="h-36" [options]="options()" (chartInit)="chart.set($event)"></div>`,
})
export class PaceChart {
  readonly data = input.required<PaceSeries>();
  protected readonly chart = signal<EChartsType | null>(null);
  private readonly theme = inject(ChartTheme);
  protected readonly options = computed(() => buildPaceOption(this.data()));
  constructor() { effect(() => this.chart()?.setTheme(this.theme.name())); }
}
```
- **Updating data**: `[options]` replaces the whole option (`notMerge`). For data-only refreshes, bind a `computed` patch to `[merge]`, which merges.
- **Accessibility**:
  - Turn on `aria.enabled`. Set `aria.label.description` to the same one-sentence finding the insight card shows (generated descriptions get long).
  - Turn on `aria.decal.show` where hatching carries meaning (forecast, plan, commission), and set `decal: 'none'` elsewhere.
  - Prefer direct `endLabel` and `label`s to legends: text labels satisfy SC 1.4.11's alternative, and v6 moved the default legend to the bottom anyway.
  - Offer a Chart / Table toggle, because canvas charts are not keyboard-navigable.
  - Set `animation: false` under `prefers-reduced-motion`.
- **Responsiveness**:
  - ngx-echarts already resizes through `ResizeObserver` (100 ms throttle).
  - Use `media` queries (e.g., `maxWidth: 480`) to drop the legend, shorten axis labels or turn columns horizontal.
  - v6 `outerBounds` keeps labels inside the container by default.
- **Mapping to the existing home cards**: `paceLine` → R2; `eventBars` → R3; `shareBar` → R8 (one 100% stacked bar).

### Gaps
- **Unverified custom-series cases**: `barRange` and `lineRange` on a `time` axis, and `barRange` horizontally. The official examples only use a category x-axis.
- **Theme switching**: whether `setTheme` keeps per-series colours that were set explicitly in the option was not tested.
- **Performance**: not measured for 20 × N small multiples, or for one chart per table row (canvas vs SVG).
- **Keyboard access**: no official ECharts guidance on keyboard navigation of chart elements was found.
- **SSR**: ECharts server-side rendering was not researched.
- **Bundle figures**: these exclude the `@echarts-x` custom-series packages and ngx-echarts itself.
