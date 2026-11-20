# Juyo (juyo.ai): product surface, filters and charts, as publicly visible on 20 Nov 2026

Collected 20 Nov 2026 from public pages only: juyo.ai and its sitemap, two public demo pages that juyo.ai embeds in iframes (`website-demo.juyo.ai`, `kassandraai-reasoning.juyo.ai`), screenshots on Juyo's CDN, Google Play, Hotel Tech Report, the Apaleo Store, the Mews Marketplace and Hospitality Net. Pages and images were fetched with curl or WebFetch. Screenshots were looked at directly. Nothing was logged into and no forms were submitted.

Notation: "[inferred]" marks my own reading of an image or label. Unmarked bullets are what the source shows or says. Colour tokens, the Aeonik font and the v3 Angular/amCharts bundle are already covered in `../../ui-refinement/juyo_brand.md` §1–3 and are not repeated here.

Dates: most product pages have a sitemap `lastmod` between June and November 2026 ([sitemap](https://juyo.ai/sitemap.xml)). Screenshots on juyo.ai show demo data dated 2025–2026. Anything from the 2020–2022 "v2" UI is marked **older**.

---

## Q1. What modules and features does Juyo market, and what does each page say it does?

### Takeaway
Juyo sells one platform, framed as **Ask (Chat) → Analyze (Canvas) → Act (Agents)**, in three live tiers: HotelGPT, Pro and Enterprise. Kassandra AI is the reasoning layer across all of it. Under the AI layer there is still a mature "Juyo Engine" of self-serve BI: Creator Mode, Pulse, Exploration, Deep Dive, Table Designer, Iris Chart Designer, Constellations templates and the Launchpad cockpit. Four department suites sit on top: Commercial, Finance, F&B and M&E. Agents and "Unlimited Workflow Automations" are still listed as **"Coming Soon"**. Briefings, alerts, Forecast Builder, Data Drop and Embed are marketed in words only; no public screenshot shows them.

### Cited Findings

#### Platform frame (homepage)
- **Ask. Analyze. Act.:** "Chat, analytics and agents in one product, on one truth, for every department." — [juyo.ai](https://juyo.ai/)
  - **Chat (Ask):** "Talk to your hotel in plain language… gives you the next move in seconds. This is conversational analytics." — [juyo.ai](https://juyo.ai/)
  - **Canvas (Analyze):** "Build the views your team needs: zoom in, zoom out, cross-filter and drill deep." — [juyo.ai](https://juyo.ai/)
  - **Agents (Act):** "Agents monitor goals, surface what changes, recommend the next move, and act when you're ready, with guardrails you control." — [juyo.ai](https://juyo.ai/)
- **"One reasoning agent across all departments":** a tab set (Commercial | Finance | F&B | M&E). Each tab shows 2–3 dark Canvas screenshots, for example [Home page commercial 1](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Home%20page%20commercial%201%20%281%29.png) and [Home page finance 1](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Home%20page%20finance%201.png). Commercial copy: "Real commercial strategy lives in the detail: segments, channels, rate codes, day of week." — [juyo.ai](https://juyo.ai/)
- **Live demo in the hero:** the homepage hero embeds an iframe, [website-demo.juyo.ai](https://website-demo.juyo.ai/) (page title "Juyo AI — Live Demo"). The HotelGPT page embeds the same demo. It is a scripted Kassandra chat; see Q5. — [juyo.ai](https://juyo.ai/), [juyo.ai/hotelgpt](https://juyo.ai/hotelgpt)

#### Tiers
- **HotelGPT:**
  - Tagline "Ask your hotel anything". "Connect one source… Ask about occupancy, ADR, pace, pickup or segment mix and get a straight reply in seconds." — [juyo.ai/hotelgpt](https://juyo.ai/hotelgpt)
  - Topic tabs on the page, each with its own one-line pitch — [juyo.ai/hotelgpt](https://juyo.ai/hotelgpt):
    - **Pricing:** "Defend the next rate move before you make it."
    - **P&L:** "Find the story the P&L is telling… decomposes the variance — ADR, occupancy, flowthrough, cost".
    - **Forecasting:** "Pressure-test the forecast before you commit to it."
    - **Comp Set:** "Read the comp set in motion… whether your ARI stays competitive in the high-demand bands".
  - Usage is billed in tokens and shown in the product: "HotelGPT runs on tokens, our built-in meter shows you exactly where you stand, always." The free month is "1,000 tokens, about 100 smart questions". Direct integrations: "Mews and Opera Cloud". — [juyo.ai/hotelgpt](https://juyo.ai/hotelgpt)
  - A second figure on another page: "A thousand tokens cover about 30 days of regular use." — [juyo.ai/commercial-solutions](https://juyo.ai/commercial-solutions)
  - Price: "€0.05 / Kassandra AI token", "No minimum fee on your first hotel". — [juyo.ai/pricing](https://juyo.ai/pricing)
- **Juyo Pro:**
  - "Connecting the dots across every hotel… unlimited dashboards and a portfolio view that keeps every property on the same numbers." — [juyo.ai/juyo-pro](https://juyo.ai/juyo-pro)
  - Bullets: "Unlimited dashboards and canvas", "Portfolio view across properties", "Dedicated customer success manager", "Cross-source reasoning across your connected data". — [juyo.ai](https://juyo.ai/)
  - Homepage tier copy: "Dashboards with creator mode, Canvas, portfolio view, a shared collaboration workspace, and agents that turn her recommendations into automated work." — [juyo.ai](https://juyo.ai/)
  - Price: "From €200 / hotel per month". — [juyo.ai/pricing](https://juyo.ai/pricing)
- **Juyo Enterprise:**
  - "We make Juyo run the way you do… embed it in the tools your teams already use." — [juyo.ai/juyo-enterprise](https://juyo.ai/juyo-enterprise)
  - Feature cards — [juyo.ai/juyo-enterprise](https://juyo.ai/juyo-enterprise):
    - "Every property, one model" ("Roll the whole group into a single view or drill into one hotel, brand or room type, comparing properties, regions and segments side by side without losing your place").
    - "Agents across the portfolio" ("an autonomy control you set property by property").
    - "Governance built for an enterprise" ("full audit log and decision log").
    - "Mapped to how your group runs" ("Custom dimension mapping and table setups").
    - "Data platform" ("integrate the data delivered by Juyo through an API/Data Feed into their own visualization solution").
    - "Embed" ("Interactive data visualization and advanced analytics directly into any web technology").
- **Juyo Lite (likely legacy):**
  - The `/juyo-lite` page still exists, sitemap `lastmod` 2026-06-04. It is not in the footer's Platform list, which shows HotelGPT, Juyo Pro, Enterprise, Connections and Pricing. — [juyo.ai/juyo-lite](https://juyo.ai/juyo-lite), [sitemap](https://juyo.ai/sitemap.xml)
  - It lists "Performance dashboards" ("Pre-built views… designed to be read at a glance"), "Automated reporting" ("Scheduled reports that go out on time") and "User-level permissions" ("Set access by role, department, or property"). Its tabs are Kassandra AI | Canvas | Forecasting | Sharing. — [juyo.ai/juyo-lite](https://juyo.ai/juyo-lite)

#### Kassandra AI (reasoning layer)
- **Positioning:**
  - "The hospitality intelligence agent at the heart of Juyo… she comes back with the chart, the cause, and the move worth making." — [juyo.ai/kassandra-ai](https://juyo.ai/kassandra-ai)
  - The data-model tab claims "2.1M+ reservation rows. 306 time-travel snapshots. 160 channels. 15 forecast versions. 126 P&L scenarios. Data Drop for instant file ingestion." — [juyo.ai/kassandra-ai](https://juyo.ai/kassandra-ai)
- **Three reasoning depths** — [juyo.ai/kassandra-ai](https://juyo.ai/kassandra-ai):

  | Label | Mode | Page wording |
  |---|---|---|
  | "Get a fact" | **Quick** | "Sub-second answer… The same number every time" |
  | "Get a recommendation" | **Thinker** | "reasons across 2 or 3 sources… a recommendation and the next steps" |
  | "Make the call" | **Strategic** | "A council of agents argues every angle: pricing optimism, demand realism, risk caution" |
- **Nine capability cards** (purple Material icons) — [juyo.ai/kassandra-ai](https://juyo.ai/kassandra-ai):

  | Card | What it says |
  |---|---|
  | Creates dashboards | "Kassandra AI builds your dashboards and recommends the ones you're missing" |
  | Answers questions | "Ask in plain language, get the answer and the reasoning" |
  | Builds and runs agents | "monitor, recommend and act, inside the bounds you set" |
  | Spots what's drifting | "Proactive alerts tied to your goals" |
  | Briefs the team | "Morning briefings, month-end commentary and executive summaries… exportable to PDF, PowerPoint or Word" |
  | Explains why and how | "Driver decomposition that auto-answers the next question behind every number" |
  | Forecasts and plans | "Forecast Builder, scenario and what-if modelling, budget planning" |
  | Debates the bets | "Council mode argues both sides of a hard call" |
  | Displays interactive forms | "Kassandra AI hands you a form, takes what she needs, and reasons in seconds" |
- **Rollout history (Wrapped 2025):** Kassandra first shipped as **Smart Widget Discovery** ("navigate the Gallery using keywords and context"). Next came **Insights** ("reading dashboards, spotting patterns, and explaining… adapted by role, language, and level of detail"). Then **Ask** (conversational analytics). — [juyo.ai/juyo-analytics-wrapped-2025](https://juyo.ai/juyo-analytics-wrapped-2025) (2025 recap; sitemap lastmod 2026-09-21)
- **Third-party description:** "HotelGPT returns the chart, the cause, and the recommended next move." Pro "bundles unlimited dashboards, comp set benchmarking, P&L visibility, pickup and pace, forecast variance, portfolio view, multi-user collaboration, and smart alerts." — [Hospitality Net snapshot](https://www.hospitalitynet.org/ai/snapshot/juyo-pro) (undated)

#### The "Juyo Engine" (self-serve BI), from the Juyo Pro page
- **Creator Mode:** "design as many analytics dashboards as you need." — [juyo.ai/juyo-pro](https://juyo.ai/juyo-pro)
- **Pulse:** "All your vital KPI's in one place. Pulse is your KPIs universe unveiled." — [juyo.ai/juyo-pro](https://juyo.ai/juyo-pro)
- **Exploration:** "Dive deep, discover more, zoom in and out. Granular multisource Analytics Engine". — [juyo.ai/juyo-pro](https://juyo.ai/juyo-pro)
- **Deep Dive:** "Exploration not enough for you? Go deeper than ever in your data to find hidden opportunities." — [juyo.ai/juyo-pro](https://juyo.ai/juyo-pro)
- **Table Designer:** "Create super flexible data tables from scratch exactly how you want them." — [juyo.ai/juyo-pro](https://juyo.ai/juyo-pro)
- **Iris Chart Designer:** "Build stunning, fully customisable charts from the ground up". — [juyo.ai/juyo-pro](https://juyo.ai/juyo-pro)
- **Canvas:** "The heart of Juyo. Create, personalise, curate. Canvas shapes the right data for the right people." — [juyo.ai/juyo-pro](https://juyo.ai/juyo-pro)
- **Constellations:** "Start deciding on day one… Fully customisable analytics templates that get you running in seconds." — [juyo.ai/juyo-pro](https://juyo.ai/juyo-pro)
  - Apaleo names the template families: "Performance, (Total/Net) Revenue Mgmt, Distribution, Sales & Marketing". — [Apaleo Store](https://store.apaleo.com/apps/juyo-analytics)
- **Launchpad:**
  - "Previously a standalone module, Launchpad is now fully integrated into Hotel Canvas… It filters, cross-filters, and exports like any other widget." — [Wrapped 2025](https://juyo.ai/juyo-analytics-wrapped-2025)
  - It shows "Key KPIs, Pickup trends, Forecasts and budgets, Market share, Pricing comparisons, Restrictions, notes, and local events". It comes with "its own dedicated constellation". — [Wrapped 2025](https://juyo.ai/juyo-analytics-wrapped-2025)
  - A customer describes the workflow: "You log in, analyse the data, put your forecast in, lock it, and it's done." — [Dominus case study](https://juyo.ai/how-a-group-unified-multi-brand-data-and-boosted-revenue-eficiency-with-juyo)
  - **Older** descriptions: "Vertical Date-Lanes show you the state of your business" ([Hotel Tech Report](https://hoteltechreport.com/revenue-management/business-intelligence/juyo-analytics)); "Communicate on daily strategies in a dynamic demand calendar" ([Mews Marketplace](https://www.mews.com/en/products/marketplace/juyo-analytics)).
- **Custom breakdowns:** "flip table orientations, switch between table and chart views, apply value-based filters, sort data more intuitively, and use totals-only views". — [Wrapped 2025](https://juyo.ai/juyo-analytics-wrapped-2025)
- **F&B POS module (2025):** "Visual breakdowns and heatmaps make it easy to spot demand patterns across days and times". — [Wrapped 2025](https://juyo.ai/juyo-analytics-wrapped-2025)
- **Net Revenue v2.0 / distribution cost module:**
  - "Multi-dimensional cost allocation" and "Allocation for sales and marketing costs". — [juyo.ai/introducing-net-revenue-v20…](https://juyo.ai/introducing-net-revenue-v20-a-new-era-of-cost-allocation)
  - "Filterable chain-level overview… also filtered and cross-filtered, you can see the net revenue contribution of each dimension". — [same](https://juyo.ai/introducing-net-revenue-v20-a-new-era-of-cost-allocation)
  - Publish date not shown; sitemap lastmod 2026-07-02, which is likely a site-migration date [inferred].
- **Drag-and-drop building:** "drag and drop any metric into the canvas, completely bypassing rigid report templates." — [Dominus case study](https://juyo.ai/how-a-group-unified-multi-brand-data-and-boosted-revenue-eficiency-with-juyo)

#### Department suites (Solutions)
- **Commercial** — [juyo.ai/commercial-solutions](https://juyo.ai/commercial-solutions)
  - Pitch: "Commercial decisions at the speed of the market".
  - Tabs: "Revenue management | Sales, distribution & marketing | Total revenue & guest value | Net revenue & profitability".
  - Screenshot cards: "Improve the mix with data exploration", "Forecast with confidence", "Run in depth account intelligence", "Marketing analytics", "Master total revenue management", "Grow repeat business", "Measure Net RevPAR and cut distribution cost", "Optimise your room type strategy", "Optimize your groups business".
- **Finance** — [juyo.ai/finance-solutions](https://juyo.ai/finance-solutions)
  - Pitch: "Your P&L shouldn't be the first place you find out."
  - Personas: "The CFO gets the consolidated bottom line, the Controller the variance and anomaly view, the FP&A Analyst budget versus actual and the forecast, the asset manager GOP and flow-through by property."
  - AI claim: "Kassandra AI flags the cost anomaly, the budget variance, the drift on CPOR and flowthrough".
- **F&B** — [juyo.ai/fandb-solutions](https://juyo.ai/fandb-solutions)
  - "Juyo pulls covers, spend per cover and cost of sales from your PMS and POS into one live view".
  - "engineer the menu around margin".
- **M&E** — [juyo.ai/meetingandevents-solutions](https://juyo.ai/meetingandevents-solutions)
  - Tabs: "Pipeline & demand | Conversion & decisions".
  - "Kassandra AI scores every enquiry on its likelihood to convert and its value to the hotel, and shows you why deals are won and lost: price, response time, availability, competitor."
  - "won, tentative and lost pipeline all live alongside rooms".
- **Dashboard names in the 2026 screenshots** (breadcrumb "Canvas > …"):
  - Data Exploration, Marketing Analytics, Total Revenue Analytics, Profit Contribution Analytics, Launchpad, Company Analytics, Repeat Guests Analytics, Net Revenue Analytics, Room Type Analytics, Group Analytics — [commercial cards](https://juyo.ai/commercial-solutions), e.g. [Commercial.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Commercial.png), [Forecast with confidence](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Forecast%20with%20confidence.png)
  - Phased P&L Analysis, Overhead Analysis, P&L, and "Portfolio > P & L TEST" — [Finance 4](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Finance%204.png), [Home page finance 1–3](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Home%20page%20finance%202.png)
  - F&B Analysis, Point of Sale Analytics, Menu Engineering — [F&B1](https://juyo-production.ams3.cdn.digitaloceanspaces.com/F%26B1.png), [Canvas.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Canvas.png)
  - Lead Time Analysis, M&E, M&E and Group Blocks Analysis — [M&E1](https://juyo-production.ams3.cdn.digitaloceanspaces.com/M%26E1%20%281%29.png), [M&E3](https://juyo-production.ams3.cdn.digitaloceanspaces.com/M%26E3%20%282%29.png)
  - The saved-dashboards drawer also lists Market Share Analytics, Canvas EOS, P&L Statistics and Payroll Analysis — [kassandra-ai.png on /juyo-lite](https://juyo-production.ams3.cdn.digitaloceanspaces.com/kassandra-ai.png)

#### Collaboration, sharing, export, reporting
- **Comments and email links:** "a Comments functionality that allows you to share further context to dashboards or visualisations… send links to interactive dashboards to others via email, one-off and recurring." — [juyo.ai/commercial-solutions](https://juyo.ai/commercial-solutions) (FAQ)
- **Export:** "Data (XLSX, CSV, JSON), PDF, Image (PNG/JPG)… screenshots of entire dashboards using a browser extension." — [juyo.ai/finance-solutions](https://juyo.ai/finance-solutions) (FAQ)
- **Pricing-table rows under Analyze:** "Dashboards", "Canvas (Control Center)", "Save, Share & Folders", "Portfolio View", "Collaboration Workspace". — [juyo.ai/pricing](https://juyo.ai/pricing)
- **Hotel Tech Report feature list** (older listing) — [HTR](https://hoteltechreport.com/revenue-management/business-intelligence/juyo-analytics):
  - Reporting: "Scheduled Reports", "Alerts Feed", "Collaboration & Commenting".
  - Planning: "Forecast Locking & Workflows", "Version Control", "Shared Demand Calendar".
  - Data: "Flexible Portfolio Grouping", "Customizable Data Hierarchies".

#### Act / Agents
- **Pricing row:** "Act | Agents | Unlimited Workflow Automations" is "Coming Soon" for both Pro and Enterprise. — [juyo.ai/pricing](https://juyo.ai/pricing)
- **Enterprise wording:** "Decide who sees which properties, what each agent is allowed to do, and how every action is logged." — [juyo.ai/juyo-enterprise](https://juyo.ai/juyo-enterprise)
- **Product name:** no page on juyo.ai uses the word "Studio" (my grep of 42 downloaded pages). The three tier icons on the pricing page are `gpt-2.svg`, `star-1.svg` and `superagent.svg`. By their order they are HotelGPT, Pro and Enterprise [inferred]. That matches the "Juyo Star" and "Superagent" tier names in the reasoning page's CSS (see Q3). — [juyo.ai/pricing](https://juyo.ai/pricing)

#### Data foundation, connections, security (the closest thing to "data health")
- **Data foundation:** "SCD Type 2 snapshot architecture. Individual reservation-level granularity. 16+ connected sources. Temporal analysis no competitor can match. Data Drop for instant file ingestion." — [juyo.ai/it-data-and-security](https://juyo.ai/it-data-and-security)
- **Security and certifications:**
  - "PostgreSQL Row-Level Security. Agent permission guardrails. Full audit trails." — [same](https://juyo.ai/it-data-and-security)
  - SOC 2 and ISO 27001 are "Coming Q4 2026". — [same](https://juyo.ai/it-data-and-security)
  - "Permissions… down to the property, department, and data-model level". — [same](https://juyo.ai/it-data-and-security)
- **Onboarding mapping:** after go-live, "map segments, channels and room types (about a 1-hour exercise)". — [juyo.ai/juyo-pro](https://juyo.ai/juyo-pro) (FAQ)
- **Connections page:** filter chips "All | Finance | M&E | Other | PMS | POS | RMS". Example entries: "Lighthouse — Rateshopping, Review & Market Insight Data", "d2o — Productivity Data (Juyo to PMI)", "Revinate — Data Review", "Benchmarking Alliance", RMS (BEONx, IDeaS, Duetto), M&E (Thynk, Opera Sales). — [juyo.ai/connections](https://juyo.ai/connections)

#### Older third-party listings (2020–2024 era)
- **Hotel Tech Report capability titles:** "Room Type Analytics", "Corporate Client and Agency Analytics", "Pick-up Analytics", "Net Revenue Analytics", "Total Revenue Analytics", "Superman Calendar", "Juyo Launchpad". 4.6/5 from 34 reviews; latest review 2024-10-13. — [Hotel Tech Report](https://hoteltechreport.com/revenue-management/business-intelligence/juyo-analytics)
- **Apaleo Canvas analysis areas:** "Segment statistics; channel production; rate code performance; company performance; agency performance; room type statistics; source market production; booking behavior; stay patterns; review scores; competitor/market pricing and demand". Priced at "2.5 €/monthly per room" plus an EUR 850 setup fee. — [Apaleo Store](https://store.apaleo.com/apps/juyo-analytics)

### Inferences
- **Two products under one brand:**
  - The marketing site sells the AI-native story (Kassandra, Canvas, Agents).
  - Every dashboard screenshot is still the mature v3 "Canvas" BI app: dense tables, amCharts, a dashboard drawer.
  - Kassandra answers appear as a separate chat surface with its own chart style (see Q3/Q5).
  - Compass can feel "in Juyo's world" by pairing a calm chat or briefing surface with a dense, filterable canvas, rather than picking one.
- **Juyo's own taxonomy is a usable vocabulary for Compass:**
  - Constellation = template pack.
  - Launchpad = daily cockpit.
  - Pulse = KPI strip.
  - Exploration / Deep Dive = slice and dice.
  - Briefing = generated narrative.
  - To avoid copying, Compass should use its own nouns [suggestion].
- **"Data health" is not a product surface Juyo markets.** Data quality is framed as a service ("Prevention over troubleshooting") and as architecture (SCD2 snapshots). A visible data-freshness or health panel in Compass would be a differentiator [inferred].

### Gaps
- **Kassandra page tabs:** the text of "Hospitality-native intelligence", "Connected reasoning" and "Security & governance" was not in the static HTML. Only the first tab ("most granular data model") was retrievable.
- **Unseen features:** no public screenshot or video of Briefings, Alerts, Agents, Forecast Builder, Data Drop, Embed, the Table Designer or Iris Chart Designer editors, the Widget Gallery, or Pulse as a separately named screen.
- **Ten-minute tour:** [juyo.ai/ten-minute-tour](https://juyo.ai/ten-minute-tour) embeds one MP4 (`19125530-uhd_2560_1440_30fps.mp4`). It was not watched. The filename looks like a stock clip [inferred].
- **Docs:** no public help centre or docs. Pricing lists "Help Center & Docs" as "In app".
- **Dates:** publication dates of blog and product posts are not exposed in the HTML. Sitemap `lastmod` is only a modification date.

---

## Q2. What filter and slicing controls does the UI show, and where do they sit?

### Takeaway
In the Canvas app, filtering is **global-first**, set in two fixed bars above every dashboard:
1. A top bar with breadcrumb, a **chain** dropdown and a **hotel** dropdown.
2. A date bar with two **CY | LY** date-range pairs, one with a bed icon and one with a calendar icon, plus a **currency** dropdown and a gear.

Each widget then has its own small controls in its header: search, a data-version dropdown ("OTB"), settings, expand and help. Inside tables there are metric dropdowns such as "RNs ▾" and "Tax Total ▾". Slicing happens by dimension widgets (segments, channels, rate codes, room types, companies, agencies, countries, LOS, lead time, DOW, occupancy bands, POS outlets) that cross-filter each other. Saved views live in a left drawer of private and public dashboard folders. Chat surfaces (web demo, HotelGPT, mobile) have **no filter chrome**: scope comes from the question, and from an organization switcher on mobile.

### Cited Findings

#### Global bars in the current Canvas app (2026 marketing screenshots)
- **Top bar, left to right** — [Canvas.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Canvas.png) (on [juyo.ai/juyo-pro](https://juyo.ai/juyo-pro)), [F&B (1).png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/F%26B%20%281%29.png):
  1. Juyo dot logo.
  2. Hamburger "≡".
  3. Breadcrumb "Canvas > Menu Engineering".
  4. "DEMO CHAIN ▾" dropdown.
  5. "DEMO HOTEL ▾" dropdown.
  6. Clock icon, rocket icon with a red badge, headset icon.
  7. User name.
- **Date bar (second row), left to right** — [Canvas.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Canvas.png):
  1. A square icon tab with a **bed** glyph, then "CY 01 Jul 2026 ▸ 31 Jul 2026" and "LY 01 Jul 2025 ▸ 31 Jul 2025".
  2. Mid-bar, a second square tab with a **calendar** glyph, then "CY 03 Jul 2026 ▸ 04 Jul 2026" and "LY 03 Jul 2025 ▸ 04 Jul 2025".
  3. At the far right, a **"€ ▾" currency** dropdown and a **gear**.
- **Same layout with purple tabs:** the bars appear in [Juyo Pro.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Juyo%20Pro.png) and [Juyo Enterprise.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Juyo%20Enterprise.png) ("CY 01 Nov 2026 ▸ 30 Nov 2026 | LY 01 Nov 2025 ▸ 30 Nov 2025" and "CY 01 Nov 2026 ▸ 02 Nov 2026 | LY 01 Nov 2025 ▸ 02 Nov 2025"). The two icon tabs are **purple** there and **blue** in Canvas.png, F&B (1) and the solution cards. — [juyo.ai](https://juyo.ai/), [juyo.ai/juyo-pro](https://juyo.ai/juyo-pro)
- **Portfolio pages:** the breadcrumb changes to "Portfolio > P & L TEST". Only the chain dropdown is shown; no hotel dropdown appears in the visible part of the bar. — [Finance 4](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Finance%204.png) (on [juyo.ai/finance-solutions](https://juyo.ai/finance-solutions))
- **Hamburger drawer (saved views):** — [kassandra-ai.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/kassandra-ai.png) (on [juyo.ai/juyo-lite](https://juyo.ai/juyo-lite))
  - "My Dashboards ⓘ" with folders "Temp" and "User".
  - "Public Dashboards ⓘ" with a "Chain ✎" group:
    - Folders "Revenue Managemen…" and "Finance Constellation…". The Finance folder holds P&L, Phased P&L Analysis, P&L Statistics, F&B Analysis, Payroll Analysis and Overhead Analysis.
    - A "POS" folder.
    - Loose dashboards: Data Exploration, Menu Engineering, Point of Sale Analytics, Launchpad, Market Share Analytics, Canvas EOS, Profit Contribution Analytics.
  - A "Hotel" group.
  - Every item has a "•••" menu. The selected item is a highlighted pill.
  - The browser URL bar reads "accessjuyo-v3.com".

#### Property, portfolio and hierarchy selection
- **Subgroups:** "visualise data across your entire portfolio and in an unlimited amount of definable subgroups… Brands, Location-types, Commercial Regions, Cluster Revenue Managers, and more." — [juyo.ai/commercial-solutions](https://juyo.ai/commercial-solutions) (FAQ)
- **Enterprise portfolio mapping:** "Map your portfolio your way, by brand, asset class, management structure and location". "drill into one hotel, brand or room type, comparing properties, regions and segments side by side without losing your place." — [juyo.ai/juyo-enterprise](https://juyo.ai/juyo-enterprise)
- **Two-level segment mapping:**
  - Brand-specific segments are kept, and "Dominus groups both ['BAR' and 'Consortia'] under 'Retail' for portfolio analysis". — [Dominus case study](https://juyo.ai/how-a-group-unified-multi-brand-data-and-boosted-revenue-eficiency-with-juyo)
  - Widget titles name the hierarchy level shown: "SEGMENTS - MARKET GROUP", "CHANNELS - CHANNEL GROUP", "ROOM TYPES - CATEGORY". — [Home page commercial 1](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Home%20page%20commercial%201%20%281%29.png), [Improve the mix…](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Improve%20the%20mix%20with%20data%20exploration-1.png)

#### Date ranges and compare-to
- **Comparison is built into the global bar.** Every range is a CY/LY pair. The LY dates in the screenshots are calendar-aligned (01 Nov 2026 ↔ 01 Nov 2025), not weekday-aligned. — [Juyo Pro.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Juyo%20Pro.png)
- **KPI tiles as compare-to:** each tile is one data version, with RN / ADR / Rev underneath.
  - Tiles seen: "OTB", "OTB STLY", "ACTUALS LY", "LIVE FOR[ECAST]", "BOOKED & STAYED", "PAID UPGRADE", "FREE UPGRADE", "DOWNGRADE" — [Commercial.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Commercial.png), [Juyo Pro.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Juyo%20Pro.png)
  - A delta tile: "OTB % OTB STLY" with OCC −2.7%, ADR −10.8%, Rev −13.2% in red. — [Forecast with confidence](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Forecast%20with%20confidence.png)
- **Finance compare tiles:**
  - "GOP Actual", "vs. LY (Actual − Actual LY)", "vs. BUD (Actual − Budget)" (green positives), "Departmental Profits". — [Finance 4](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Finance%204.png)
  - P&L tables use columns "Actual | Actual LY | Actual − Actual LY | Budget | Forecast", grouped by quarter (Q1 25, Q2 25 …). — [Finance 1](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Finance%201.png), [kassandra-ai.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/kassandra-ai.png)
- **Group Analytics 12-month breakdown** legend: OTB, OTB STLY, Actuals LY, Live Forecast, Forecast, Budget, plus "Pickup" and "Pickup LY". — [Optimize your groups business](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Optimize%20your%20groups%20business.png)
- **Launchpad table column groups:** "OTB | COMPARISON OTB | VARIANCES | PICKUP" (each split into Occupancy / ADR), then rate-shop columns "Own Hotel | Rank | [competitor]". — [Forecast with confidence](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Forecast%20with%20confidence.png)
- **Customer wording:** "Juyo Analytics allows for budget and forecast input and compares our pickup and pace to it", and "comparison of pick-up vs pick-up L.Y." — [Spier case study](https://juyo.ai/a-case-study-spier-hotel-stellenbosch) (older)

#### Per-widget controls (current Canvas)
- **Widget header row:**
  - UPPERCASE title on the left.
  - On the right: 🔍 search, "OTB ▾" dropdown, ⚙ settings, ⤢ expand, ? help.
  - Source: "ROOM TYPE SHIFTS" in [Juyo Pro.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Juyo%20Pro.png). "LENGTH OF STAY", "OCCUPANCY BANDS" and "DAY OF WEEK" each carry "OTB ▾" in [Juyo Enterprise.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Juyo%20Enterprise.png).
- **In-table metric dropdown,** centred above the rows:
  - "RNs ▾" — [Home page commercial 1](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Home%20page%20commercial%201%20%281%29.png)
  - "Tax Total ▾", "Transaction Total ▾", "Number of Covers ▾" in POS widgets — [Canvas.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Canvas.png)
  - "Number of Checks ▾" — [F&B2](https://juyo-production.ams3.cdn.digitaloceanspaces.com/F%26B2%20%281%29.png)
- **Sorting:** the sortable column carries a sort glyph ("OTB ↓≡", "CY ↓≡"). — [Home page commercial 1](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Home%20page%20commercial%201%20%281%29.png)
- **Lead-time widget:** a two-handle **range slider** over the chart (days-out window) and a "•••" menu. — [Juyo Enterprise.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Juyo%20Enterprise.png)
- **Chart widgets:** a round **download** button top-right. — [Juyo Enterprise.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Juyo%20Enterprise.png), [Juyo Pro.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Juyo%20Pro.png)
- **Map widgets:** home, + and − zoom buttons. — [Home page commercial 2](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Home%20page%20commercial%202%20%281%29.png)
- **Finance / F&B widgets:** a 🏷 tag icon, a bar-chart icon, a calendar icon and ⚙ settings in the header. — [F&B (1).png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/F%26B%20%281%29.png), [kassandra-ai.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/kassandra-ai.png)
- **KPI tiles:** a "?" top-right. Finance and F&B tiles also have a small line/sparkline glyph bottom-left. — [Home page finance 1](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Home%20page%20finance%201.png), [Home page f&b 1](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Home%20page%20f%26b%201.png)
- **P&L tables:** hierarchical rows with ▸ / ▾ expanders ("Rooms Department ▾" > Rooms Revenue / Rooms Expenses / Rooms Profit). — [Home page finance 3](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Home%20page%20finance%203.png)

#### Cross-filter, drill-down and value filters
- **Product claims:**
  - "zoom in, zoom out, cross-filter and drill deep". — [juyo.ai](https://juyo.ai/)
  - Launchpad "filters, cross-filters, and exports like any other widget"; custom breakdowns "apply value-based filters… totals-only views". — [Wrapped 2025](https://juyo.ai/juyo-analytics-wrapped-2025)
- **Reviews and expert comments** — [Hotel Tech Report](https://hoteltechreport.com/revenue-management/business-intelligence/juyo-analytics) (older):
  - "You can dive deep into the data with the cross filter function."
  - "multidimensional filters" and "keep the same filter across different views".
- **Blog advice on slicing and format:** "Slice it by channel, segment, source market, room type, or anything that brings the who, where, or how into the picture." "Match the story to the format, line charts for trends, bar charts for comparisons, heatmaps when you want to impress your GM." — [Building the perfect hotel dashboard](https://juyo.ai/building-the-perfect-hotel-dashboard)
- **Marketing pro tip:** "Cross-filter by nationality, source, or segment to evaluate if specific campaigns are moving the needle." — [Customisation in action](https://juyo.ai/customisation-in-action-strategic-metrics-for-hotel-marketing-and-sales-teams)
- **Job ad (expected UI skills):** "interactive dashboards, charts, large data tables, filters, drill-downs and comparisons, keeping views consistent as hoteliers change properties, dates or metrics." — [Senior Design Engineer job](https://juyo.ai/careers/open-position-senior-design-engineer)

#### Dimensions available for slicing (lists from Juyo and its marketplaces)
- **Mews listing:** "Segments, Channels, Rate Codes, Companies, Agencies, Room types, Source Markets; Booking behavior (length of stay, leadtime); Stay Patterns (DOW, occupancy bands)". — [Mews Marketplace](https://www.mews.com/en/products/marketplace/juyo-analytics)
- **Data Exploration screenshot widgets:** "SEGMENTS - MARKET GROUP", "RATE CODES", "AGENCY", "ROOM TYPES - CATEGORY", "COMPANY", "LOYALTY". — [Improve the mix…](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Improve%20the%20mix%20with%20data%20exploration-1.png)
- **F&B and M&E dimensions:**
  - F&B: "POS: REVENUE CENTER" outlets (Terrace, Restaurant, Spa, Bar, Banqueting…), "POS: CATEGORY", "POS HEATMAP" by weekday × hour. — [Home page f&b 2](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Home%20page%20f%26b%202.png)
  - M&E: "M&E STATUS" (Definite, Tentative, Non Converted, Unknown), attendee buckets, revenue buckets, lead time. — [M&E1](https://juyo-production.ams3.cdn.digitaloceanspaces.com/M%26E1%20%281%29.png), [M&E3](https://juyo-production.ams3.cdn.digitaloceanspaces.com/M%26E3%20%282%29.png)
- **Net Revenue v2.0 context:** you can see "under which conditions (channel, lead time, stay period, etc.) that specific country is driving high NetADR bookings." — [Net Revenue v2.0](https://juyo.ai/introducing-net-revenue-v20-a-new-era-of-cost-allocation)

#### Older v2 UI (2020–2022; still shown on Apaleo and Mews listings)
- **Date bar:** "CY 2021-01-01 ▸ 2021-12-31 | LY 2020-01-01 ▸ 2020-12-31" behind a bed tab, and "CY 2021-05-07 ▸ 2021-05-08 | LY 2020-05-07 ▸ 2020-05-08" behind a calendar tab. Then **"OTB ▾"**, **"Previous ⟲"** and **"History 🕓"** buttons. — [Mews image 4](https://www.mews.com/api/media/file/d81af6ce0bb73bd4453363d3cae00d3a.jpg), [Apaleo Juyo2](https://images.ctfassets.net/nrwejlyqd8jv/4HvLkbTBo9b11kiZoKcwv4/89f0b68b954490f65de1261a173391de/Juyo2.jpg)
- **Saved dashboards as a horizontal tab strip:** "Public ▾ | Performance ▾ | Exploration ▾ | Forward Performance ▾ | New ▾ | All exploration ▾ | Country ▾ (active, blue) | New ▾ | ⊕". — [Mews image 3](https://www.mews.com/api/media/file/23df5442f139f7907bc1269072b3fd28.jpg)
  - Another strip: "Dashboard | Rate Codes | Hotel Performance | Net Revenue Analytics | Pricing Analytics | Forward Performance | Exploration | BI/BW | Channel Analysis | Rate Code Analysis". — [Apaleo Juyo3](https://images.ctfassets.net/nrwejlyqd8jv/51RC6fZsSjeIzCQImnAAxl/c139e14279cb736d207fbdeafa3e538a/Juyo3.jpg)
- **KPI tiles:** "OTB | OTB LY | ACTUALS LY | LIVE | FORECAST | BUDGET". — [Mews image 4](https://www.mews.com/api/media/file/d81af6ce0bb73bd4453363d3cae00d3a.jpg)
- **Widget dropdowns:** "Absolute ▾ / Absolute Change ▾", "RNs ▾", "Default ▾", "Minor ▾ / Major ▾", "Total Revenue ▾", and an "Export to XLSX" link. One screenshot shows values in "kr", so multi-currency was already supported. — [Mews image 3](https://www.mews.com/api/media/file/23df5442f139f7907bc1269072b3fd28.jpg), [Mews image 4](https://www.mews.com/api/media/file/d81af6ce0bb73bd4453363d3cae00d3a.jpg)
- **Launchpad (calendar shows March 2022):**
  - A left mini month calendar, plus "Demo Chain" and "Demo Hotel" pickers.
  - "import drafts" and "export otb forecast" buttons.
  - Vertical day lanes ("Thu 17 Mar…") over an area chart, with per-day "OTB | Fcst" columns by segment.
  - "Hotel Occupancy" semicircle gauges, "Group Demand" tiles reading "OPT x / TO SELL", and "Important comments". — [Apaleo Juyo6](https://images.ctfassets.net/nrwejlyqd8jv/45PQKFVwNSbpo7EJ8BDH7i/123a92010316645faa9f061c1c8e2dfa/Juyo6.jpg)

#### Chat and mobile scoping
- **Web demo chat:** no date, property or segment controls. Header "Conversation" / "Juyo AI · live · pulling from your connected sources" and a "＋ New chat" button. Scope is stated in the prompt ("for the month of June", "next 60 days"). — [website-demo.juyo.ai](https://website-demo.juyo.ai/)
- **Mobile app:** the only selector is an "ORGANIZATION" dropdown ("Aberdeen Hotels"; "Demo Chain" on tablet) above a searchable "HISTORY" list. — [Google Play listing](https://play.google.com/store/apps/details?id=com.juyo.mobile&hl=en), screenshots [4](https://play-lh.googleusercontent.com/D8XVAUVhfculkWTdDtpTX7OI5b9FxCtXmSZP7rSHsSHcK1hYqhjRQ9WtYjs4AT2-Ytwp5nGyZ1oolFB_R0RXIA=h1400) and [8](https://play-lh.googleusercontent.com/FOYZQy6V6yTYHi6O7g-c1MYPxEeAeyCoi7hxCIqP2wfK44mzTv1QAClzzo-o_fokdqvG6rdsy_44t0ah_3CBYg=h1400)

### Inferences
- **What the two date pairs mean** [inferred]: the bed-icon pair is the **stay-date period** and the calendar-icon pair is the **booking/pick-up window**, because it is typically a 1–2 day range near "today". Juyo publishes no definition. Mews BI, a different product, uses the same split ("Pickup period" vs "Date of stay"); see [Mews help](https://help.mews.com/s/article/The-Booking-curve-and-trends-dashboard-in-Mews-Business-Intelligence).
- **The widget "OTB ▾" dropdown** probably switches the data version per widget (OTB, Actuals, Forecast, Budget, STLY) [inferred from the v2 tile set and the label].
- **"RNs ▾"** probably switches the measure behind the inline bars (RNs, Revenue, ADR) [inferred].
- **Header icons** [inferred]: the clock is probably **time travel / history**, given "306 time-travel snapshots" ([kassandra-ai](https://juyo.ai/kassandra-ai)) and v2's "History" button. The rocket is probably product updates, the headset support.
- **Dashboards are not filter-light.** Global context is shared, and each widget re-cuts it with its own data-version and measure switches. That gives power, but the same page can quietly mix OTB, Forecast and Actuals.
  - Compass could make the global "compare to" explicit and show any per-card override as a visible chip [suggestion].
- **Filter placement in Juyo's world:**
  - Top breadcrumb + property pickers; second row of date pairs; per-card mini-toolbar; left drawer of saved views.
  - No filter side panel and no chip row in any screenshot.

### Gaps
- No public documentation names or defines the two date pairs, the "OTB ▾" options, the gear menu, the clock or the rocket. Interaction (popover vs calendar picker) cannot be seen in static images.
- No screenshot shows an open dropdown: date picker presets, comparison options (STLY vs LY vs budget), segment multi-select or currency list.
- No screenshot shows a global segment, channel or market filter. Slicing appears to happen only via cross-filtering dimension widgets [inferred].
- **Not found:** cross-filter visual state (how a selected row looks); breadcrumb-based drill paths; saved-view "favourites"; filter chips.

---

## Q3. Which chart and widget types appear, and what colour and labelling conventions are visible?

### Takeaway
Canvas is a **table-and-bar heavy** BI tool:
- KPI tiles.
- Tables with inline magnitude bars and diverging diff bars.
- Grouped CY vs comparison bars.
- Plus maps, area/lead-time curves, Sankey, funnel, waterfall, donuts and pies, gauges and rings, a Pareto chart, and heatmap grids or conditionally coloured tables.

Kassandra answers use a **lighter chart kit**: outlined KPI tiles, grouped and stacked bars, lines with dashed comparison series, reference/threshold lines and event bands, donuts, horizontal bars and simple tables. The current palette is near-black UI with **blue = current/own, purple = comparison**, teal/green good, orange/red bad. The older v2 used bright blue CY vs orange LY.

### Cited Findings

#### Canvas widget catalogue (2026 screenshots on juyo.ai)
- **KPI tiles:**
  - Label ("OTB"), large % (occupancy), then a mini RN / ADR / Rev list, with "?" top-right. — [Juyo Pro.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Juyo%20Pro.png)
  - Finance and F&B tiles: purple glyph left, a "Operating Revenues / Actual" label, big value "€ 87.7 k". — [Home page finance 3](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Home%20page%20finance%203.png)
  - Commercial "OTHER REVENUE € 36.9 k" and "FOOD AND BEVERAGE € 134.3 k" tiles, each with a small coloured delta line underneath (too small to read reliably). — [Commercial.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Commercial.png)
- **Bar-in-table dimension widgets:**
  - Columns: Name | OTB | Diff.
  - A blue horizontal magnitude bar, then a second column of **diverging diff bars**: green positive, red negative.
  - A TOTAL row, and "UNCORRELATED" as a catch-all segment.
  - Source: [Home page commercial 1](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Home%20page%20commercial%201%20%281%29.png), [Improve the mix…](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Improve%20the%20mix%20with%20data%20exploration-1.png)
- **Grouped vertical bars, CY (blue) vs LY/STLY (purple):** length of stay, occupancy bands, day of week, legend "OTB / OTB STLY". — [Juyo Enterprise.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Juyo%20Enterprise.png), [Home page commercial 1](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Home%20page%20commercial%201%20%281%29.png)
- **Lead-time area chart:**
  - Overlapping CY/LY areas, "CY Cumulative" and "LY Cumulative" lines on a secondary % axis.
  - Dashed vertical markers; x-axis "Days Out".
  - Range slider above. — [Juyo Enterprise.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Juyo%20Enterprise.png)
- **Room types:**
  - **Sankey** "ROOM TYPES" for booked → stayed shifts.
  - Combo bars (Booked & Stayed, Free Upgrades, Paid Upgrades, Downgrades) with an Occupancy line.
  - A wide Booked/Stayed/Δ table across Occupancy, RN, ADR and Rev. — [Juyo Pro.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Juyo%20Pro.png)
- **World map** "GUEST GEOGRAPHICAL ORIGIN - COUNTRY": choropleth in greens with grey for no data, credit "JS map by amCharts". — [Home page commercial 2](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Home%20page%20commercial%202%20%281%29.png)
- **Wide revenue tables:** "SEGMENTS" and "CHANNELS" with column groups "Revenue Overview" (RNs, ADR, Revenue, RevPAR, RN Mix, Rev Mix, Occupancy) and "Distribution Costs" (Net ADR, Net Revenue, Net %, Rank, Multiplier, F&B, Other, Total). Conditional **green/orange/red** cells. — [Master total revenue management](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Master%20total%20revenue%20management.png), [Home page commercial 3](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Home%20page%20commercial%203%20%281%29.png)
- **Net revenue:**
  - **Ring gauges** for OCC / ADR / Rev, with rows OTB STLY, Actuals LY, FCST, Budget and green/red % deltas.
  - "CHANNEL YIELD 92.1%" and "NET REVPAR CAPTURE RATE 140.9%" tiles.
  - **"SELL-TO-NET REVENUE" funnel** in blue steps (Guest Paid Rev → Hotel Rev → Channel Yield Rev → Net Rev).
  - "DISTRIBUTION YIELD" grouped bars, blue vs orange. — [Measure Net RevPAR…](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Measure%20Net%20RevPAR%20and%20cut%20distribution%20cost.png)
- **Company analytics:**
  - **Pareto**: descending blue bars with an orange cumulative line.
  - Small radial gauges "Account Distribution 4%" and "Rate Efficiency 100%". — [Run in depth account intelligence](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Run%20in%20depth%20account%20intelligence.png)
- **Launchpad / pace grid:** a day-by-day table with cell shading in blue, orange, green and red (heatmap-style table) across OTB, Comparison OTB, Variances, Pickup and rate-shop columns. — [Forecast with confidence](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Forecast%20with%20confidence.png)
- **Repeat guests:** OCC / ADR / Rev rings plus grouped bars "Repeat guests" (blue vs orange). — [Grow repeat business](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Grow%20repeat%20business.png)
- **Groups:** "12-MONTH BREAKDOWN" grouped bars with a multi-version legend; "GROUP" table with OTB/OTB STLY and diff bars. — [Optimize your groups business](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Optimize%20your%20groups%20business.png)
- **Finance:**
  - "PHASED Profit & Loss" table with inline green/red variance bars. Row bands are coloured by line type: green Operating Revenues, mauve GOP, blue EBITDA.
  - **"Profit Conversion Waterfall"**.
  - **Donut** "Expenses Split" (Sales & Marketing 30.70% / Admin & General 69.30%).
  - "Expenses vs LY" bars.
  - **MPI / ARI ring gauges** (92.80 pts red ring, 106.30 pts green ring).
  - "EBITDA Margin / NOI Margin" lines.
  - Source: [Home page finance 1](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Home%20page%20finance%201.png), [Home page finance 2](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Home%20page%20finance%202.png), [Home page finance 3](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Home%20page%20finance%203.png), [kassandra-ai.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/kassandra-ai.png)
- **F&B:**
  - "Revenue Breakdown" bars (Breakfast, Restaurant, Bar & Minibar, Banquets & Events).
  - "Cost % Evolution" horizontal bars (Food Cost %, Beverage Cost %, Labor Cost %).
  - "Cost Breakdown (ACTUAL)" donut and "Revenue to profit Waterfall". — [F&B (1).png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/F%26B%20%281%29.png)
  - **"POS HEATMAP"**: weekday × hour grid, yellow→orange→red. — [Home page f&b 2](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Home%20page%20f%26b%202.png)
  - **Pie-of-pie** "POS: CATEGORY": a large pie plus an exploded rainbow pie. — [Home page f&b 3](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Home%20page%20f%26b%203.png), [Canvas.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Canvas.png)
- **M&E:**
  - "Attendees and Revenue Bucket Matrix": a blue-shaded grid of lead-time buckets × attendee buckets, with € values per cell.
  - "M&E BREAKDOWN" bars (Occupancy) with a Revenue/m² line.
  - Status tables with green status pills. — [M&E1](https://juyo-production.ams3.cdn.digitaloceanspaces.com/M%26E1%20%281%29.png), [M&E2](https://juyo-production.ams3.cdn.digitaloceanspaces.com/M%26E2%20%281%29.png), [M&E3](https://juyo-production.ams3.cdn.digitaloceanspaces.com/M%26E3%20%282%29.png)

#### Kassandra / HotelGPT chat charts (2026 screenshots)
- **Lines:**
  - "Demo Hotel Rate vs Comp Set Average — July 2026 (with demand event markers)": own rate orange, comp set purple. Shaded vertical **event bands** and a dashed vertical marker line (probably "today" [inferred]). — [Screenshot 2026-07-03](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Screenshot%202026-07-03%20at%2017.58.45.png) (on [juyo.ai/juyo-pro](https://juyo.ai/juyo-pro))
  - "Performance Indices — MPI · ARI · RGI (Jan–Jun 2026)": three lines (RGI teal, ARI purple, MPI orange dashed) and a dashed grey **"Fair Share (1.00)"** reference line. Above it, monthly grouped bars in purple and blue. — [HotelGPT Comp set](https://juyo-production.ams3.cdn.digitaloceanspaces.com/HotelGPT%20Comp%20set.png) (on [juyo.ai/hotelgpt](https://juyo.ai/hotelgpt))
  - Dual-axis "Occupancy % (blue area) vs ADR (€) (orange dotted)" by week. — [Screenshot 2026-07-07](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Screenshot%202026-07-07%20at%2012.27.05.png)
- **Donut and horizontal bars:** "Segment Mix — Forecast RN Share" donut, and "Channel Split — Forecast vs LY" horizontal grouped bars (blue Forecast 2026, teal Last Year). — [Screenshot 2026-07-07](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Screenshot%202026-07-07%20at%2012.27.05.png)
- **Grouped bars:** "Segment Pace — CY OTB vs LY OTB vs LY Final (Room Nights)" in blue, purple and teal. — [Kassandra 3](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Kassandra%203.png)
- **Bars + line with threshold lines:** "Occupancy vs Arrivals — Step-Cost Zone Overlay", with dashed lines labelled "Full Crew Threshold (79%)" (red tag) and "Enhanced Crew (60%)" (orange tag). The first bar is red-tinted. — [Kassandra 4](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Kassandra%204.png)
- **Group displacement:**
  - Grouped bars "Group Net ADR vs Prevailing Transient ADR — by block" (blue vs brown-orange).
  - **Stacked** bars "Contract Revenue vs Estimated Displacement Cost — net contribution by block (€)" (teal "Net vs Transient" + orange "Displacement Cost"). — [Commercial Win the group business…](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Commercial%20Win%20the%20group%20business%20worth%20winning.png)
- **Combo and table:** "Daily Occupancy % and ADR — CY 2026 vs LY 2025 (Apr–May)" combo bars + lines, plus a "Segment Detail — Room Nights, ADR and Revenue vs LY vs Budget" table. — [FInd the rate you left on the table](https://juyo-production.ams3.cdn.digitaloceanspaces.com/FInd%20the%20rate%20you%20left%20on%20the%20table%20%281%29.png)

#### Chart primitives in the public scripted demo (`website-demo.juyo.ai`)
- **Four hand-rolled SVG chart functions** — [website-demo.juyo.ai](https://website-demo.juyo.ai/):
  1. `lineChart`: 600×170, 4 gridlines `#2A2F37`, only first / middle / last x-labels, 2px rounded polylines, comparison series grey `#8A9199` dashed `4 4`, flagged points as orange `#FE7637` dots.
  2. `donut`: 16px stroke, legend on the right.
  3. `hbars`: label left, value text right, one colour per bar.
  4. `miniBarsHTML`: rows of name | 8px track with fill | value.
- **Chart titles in the demo:** "Revenue vs LY by segment", "Channel mix — June OTB", "BAR vs comp set median — by day of week", "June pickup index vs LY (100 = parity)", "Net ADR by channel — June", "Occupancy forecast (%) — next 14 days", "Department staffing flags", "Revenue Δ per date — €15 BAR move". — [website-demo.juyo.ai](https://website-demo.juyo.ai/)
- **Colour as meaning in the demo:** each bar is coloured by verdict, not by series. Teal `#32BEBF` is good, orange `#FE7637` bad, purple `#9685E4` neutral or highlighted, grey `#8A9199` flat, blue `#477EE3` neutral or other. Example: Corporate +9.1% teal, Group −3.8% orange, Wholesale flat grey. — [website-demo.juyo.ai](https://website-demo.juyo.ai/)

#### Colour and labelling conventions
- **Accent tiers on a public Juyo page.** The CSS of [kassandraai-reasoning.juyo.ai](https://kassandraai-reasoning.juyo.ai/) maps each accent to a tier and a meaning:

  | Token | Tier | Meaning |
  |---|---|---|
  | `--color-teal: #32BEBF` | "Tier 1 · JuyoGPT" | "success · positive" |
  | `--color-blue: #477EE3` | "Tier 2 · Juyo Launch" | "info" |
  | `--color-purple: #9685E4` | "Tier 3 · Juyo Star" | "brand primary CTA" |
  | `--color-orange: #FE7637` | "Tier 4 · Superagent" | "alert · negative" |

  - Header comment: "Accents (tiered — never mix more than two per view)".
  - Extra delta colours: `--state-positive: #22C55E` and `--state-negative: #EF4444`.
  - Label style: "11px / 700 / LS 2 / UPPER".
- **The two-accent rule is contradicted by Juyo's own demo.** KPI rows in [website-demo.juyo.ai](https://website-demo.juyo.ai/) mix four accents (teal, blue, purple, orange), as do the published answer screenshots ([Screenshot 2026-07-03](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Screenshot%202026-07-03%20at%2017.58.45.png)).
- **Canvas number formats:**
  - Space between € and value, lowercase k, uppercase M: "€ 1.527 M", "€ 36.9 k", "€ 208.8".
  - Percentages to one decimal ("52.9%").
  - Signed integer diffs coloured green/red ("+392", "−74").
  - "▸" between dates; dates "01 Nov 2026" (v3) vs ISO "2021-01-01" (v2).
  - UPPERCASE widget titles that name dimension and hierarchy level.
  - Source: [Juyo Pro.png](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Juyo%20Pro.png), [Home page commercial 1](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Home%20page%20commercial%201%20%281%29.png)
- **Kassandra number formats:**
  - No space, uppercase K/M: "~€110K", "€3.12M", "+€42.8K", ranges with en dash "+€38–46K".
  - Tabular numerals in KPI values (`font-variant-numeric: tabular-nums`).
  - Source: [website-demo.juyo.ai](https://website-demo.juyo.ai/), [Screenshot 2026-07-03](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Screenshot%202026-07-03%20at%2017.58.45.png)
- **Juyo's own blog conventions:**
  - "a business progression chart comparing current performance (blue lines) against the same time last year (orange lines)". — [From spreadsheets to interactive dashboards](https://juyo.ai/from-spreadsheets-to-interactive-dashboards-how-hotels-elevate-their-strategy-with-data)
  - "clear visual indicators (e.g., green = gaining share, red = losing)". — [Customisation in action](https://juyo.ai/customisation-in-action-strategic-metrics-for-hotel-marketing-and-sales-teams)
- **Older v2 visuals:**
  - Bright blue CY vs orange LY bars; traffic-light tables; a grey world map with orange dots.
  - A donut for channels; a blue "SELL-TO-NET REVENUE" funnel.
  - Launchpad purple/blue area lanes and teal semicircle occupancy gauges.
  - Source: [Apaleo Juyo3](https://images.ctfassets.net/nrwejlyqd8jv/51RC6fZsSjeIzCQImnAAxl/c139e14279cb736d207fbdeafa3e538a/Juyo3.jpg), [Apaleo Juyo5](https://images.ctfassets.net/nrwejlyqd8jv/1Vn8ZczDks0FkdxMgYzTON/0c3c4fa0f771264a4d0e0025a91ef1f2/Juyo5.jpg), [Apaleo Juyo6](https://images.ctfassets.net/nrwejlyqd8jv/45PQKFVwNSbpo7EJ8BDH7i/123a92010316645faa9f061c1c8e2dfa/Juyo6.jpg), [Mews image 2](https://www.mews.com/api/media/file/0d0fba5119e9d9544375238e61156088.jpg)

### Inferences
- **Two visual dialects:**
  - **Canvas** (amCharts 3, dense, many hues, rainbow pies, saturated heatmaps).
  - **Kassandra** (fewer marks, outlined tiles, captioned chart cards, colour carrying verdict).
  - Compass can live in the Kassandra dialect and borrow Canvas's *chart grammar* (bar-in-table with diverging diffs, CY vs comparison grouped bars, the lead-time curve) without its density or its rainbow pies [suggestion].
- **Blue vs purple, or orange?** "Blue = current vs purple = comparison" is the current Canvas convention. The 2026 chat charts are less consistent: the own rate is orange in the 2026-07-03 shot and blue in the AI-2 shot. Compass should fix one mapping and use it everywhere [suggestion].
- **Colour-blind safety:** red/green diff bars are the main signal in Canvas tables. That is a known weakness; signed numbers plus shape or position would be safer [inferred].

### Gaps
- No public view of the Iris Chart Designer or Table Designer chart-type pickers, so the full chart catalogue (scatter, bullet, treemap?) is unknown.
- The chart library in the v5 chat is not confirmed. The demo uses hand-rolled SVG; the published screenshots look like Chart.js [inferred, carried over from juyo_brand.md].
- Calendar / "Superman Calendar" widgets were not seen in current screenshots. The only calendar visual is the **older** Launchpad (2022).

---

## Q4. What does the Juyo mobile app show?

### Takeaway
There is one public Android app, **"Juyo AI"** (`com.juyo.mobile`): 50+ downloads, updated 2 Oct 2026. It is a **chat-only Kassandra client**, not a dashboard app. Its screens are a greeting home with suggestion cards, answer cards (outlined KPI tiles, a grouped bar chart, a detail table with "Expand"), a waiting state, and a drawer with an organization switcher and searchable question history. It has no date, segment or property filters beyond the organization dropdown. No iOS App Store listing was found.

### Cited Findings
- **Listing basics:**
  - Name "Juyo AI", category Business, rated Everyone, "50+ Downloads", "Updated on Oct 2, 2026".
  - Description: "Juyo AI brings your Juyo Analytics conversations to your pocket. Ask questions, explore insights, and stay connected to your organization's data anytime, anywhere." Short description "Business Insights Anywhere".
  - What's new: "Added different AI Models support".
  - Source: [Google Play](https://play.google.com/store/apps/details?id=com.juyo.mobile&hl=en)
- **Data safety:** "No data shared with third parties"; collects "Messages and App activity"; "Data isn't encrypted"; "Data can't be deleted". Developer: Juyo, Brussels. The developer page lists only this app. — [Google Play](https://play.google.com/store/apps/details?id=com.juyo.mobile&hl=en), [Play developer page](https://play.google.com/store/apps/developer?id=Juyo+AI)
- **Screenshot 1 — "AI FOR HOTELIERS / Ask anything about your property / PMS, RMS and P&L — one place to ask, one place to know":**
  - Hamburger, iridescent orb, "Good morning, Juyo".
  - "Ask me anything about your property. I connect your PMS, RMS, P&L and more."
  - Two horizontally scrolling suggestion cards ("How does LOS differ between direct and OTA book…", "How has our OTA commission rate changed over time?").
  - Composer "Ask Kassandra anything…" with a mic and a purple send button.
  - Source: [screenshot 1](https://play-lh.googleusercontent.com/fG3tXGPu2K6ULyP1FtyT2fG3xboa980XfJC7vIgGATqeZ943uxpbTXXMKPqrmDNw_D-RoKE6uxxXyBjL8hsZAEY=h1400)
- **Screenshot 2 — "PERFORMANCE, VISUALIZED / See performance at a glance / Spot rate swings by day, week or month":**
  - Outlined tiles "WEEKEND AVG (FRI–SUN) £68 · £25 below midweek avg" (orange) and "JUNE ADR JUMP +£22 · Mon: £77→£102 · Tue: £87→£111" (blue).
  - Chart card "ADR by Day of Week — Apr, May & Jun 2026", grouped bars in blue, purple and teal.
  - A compose icon top-right.
  - Source: [screenshot 2](https://play-lh.googleusercontent.com/WGVzX5Obdw6rEeWiALMFF5KCe3akc0HAE9S7LCc0cuJ464uVIl_uRl6WZpwm-8rHTWW7zDmC_iUnJs4JsHxk6Q=h1400)
- **Screenshot 3 — "REAL-TIME ANSWERS":**
  - Purple right-aligned user bubble.
  - Status card "One moment… reshuffling the universe." with "2s elapsed".
  - Composer placeholder "Waiting for Kassandra…" with a highlighted pink/purple border.
  - Source: [screenshot 3](https://play-lh.googleusercontent.com/r7lkolXkysvhpxkQ-ODF11MLGe_KUhQhJJA6h3B0YxOu4VhZuq2r2T3nP_tW1ILzOQ8QpghN3jQjJSop5wdJcg=h1400)
- **Screenshot 4 — "MULTI-PROPERTY / One assistant for every organization / Switch organizations and revisit past answers, all organized":**
  - Back arrow, Juyo logo, "FJ" avatar.
  - "ORGANIZATION" dropdown ("Aberdeen Hotels").
  - "HISTORY" search box and a list of past questions, some with a purple dot and one with a spinner.
  - A floating purple compose button.
  - Source: [screenshot 4](https://play-lh.googleusercontent.com/D8XVAUVhfculkWTdDtpTX7OI5b9FxCtXmSZP7rSHsSHcK1hYqhjRQ9WtYjs4AT2-Ytwp5nGyZ1oolFB_R0RXIA=h1400)
- **Screenshots 5–8 (tablet layout, status bar "Wed Jul 1"):**
  - Suggestions: "Where am I losing share to the comp set?", "Where are we most at risk of missing forecast?", "What is our direct booking conversion rate?".
  - "AI-WRITTEN INSIGHTS / Numbers, explained in plain English / Kassandra spots the pattern and tells you exactly why it matters".
  - The answer card:
    - Headline "📊 Classic oil & gas demand — midweek rules, weekends collapse" and meta "Aberdeen Altens · April – June 2026 · ADR by Day of Week".
    - A purple narrative paragraph.
    - Four outlined tiles: "JUNE WED PEAK £118" (purple), "MIDWEEK AVG (TUE–THU) £93" (teal), "WEEKEND AVG (FRI–SUN) £68" (orange), "JUNE ADR JUMP +£22" (blue).
    - A chart card with an "⤢ Expand" button.
    - A "ADR by Day of Week — Detail" table (DAY | APR 2026 | MAY 2026 | JUN 2026 | JUN VS APR, teal + deltas) with its own "⤢ Expand".
  - Source: [screenshot 5](https://play-lh.googleusercontent.com/sK9w-Ub_uFSZf20BbaYjNKZFrPsoNBuIMHc-UZ5jRAAcVykWeq1ow_VEONWUKQa5SjsgemEXYb4ciVQ2GMOFRQ=h1400), [screenshot 6](https://play-lh.googleusercontent.com/urvNyRhk30QiV-GoaZovRtRO8FYyHn8GyUDCxgE_XqXrsUiFixZD6R3Y6kbTc6f8xdAegIVLhd5gXPTfJndmyQ=h1400), [screenshot 8](https://play-lh.googleusercontent.com/FOYZQy6V6yTYHi6O7g-c1MYPxEeAeyCoi7hxCIqP2wfK44mzTv1QAClzzo-o_fokdqvG6rdsy_44t0ah_3CBYg=h1400)
- **History examples** in the drawer — [screenshots 4 and 8](https://play-lh.googleusercontent.com/FOYZQy6V6yTYHi6O7g-c1MYPxEeAeyCoi7hxCIqP2wfK44mzTv1QAClzzo-o_fokdqvG6rdsy_44t0ah_3CBYg=h1400):
  - "How does my ADR compare to budget?", "Show me cancellation rate trends by segment", "Which corporate accounts are declining?"
  - "How is F&B revenue performing vs budget?", "How does YTD performance compare across all properties?", "What drove RevPAR growth last month?"
  - "What should I focus on in my next board report?", "What is my payroll cost ratio trend?"
- **Only one app from this developer:** the Google Play developer page "Juyo AI" lists only `com.juyo.mobile`. A web search for an Apple App Store listing ("Juyo AI" + Kassandra) returned only unrelated apps (Juno, Yuno, Juicy AI…), so no iOS listing was found (negative result, see Gaps). — [Play developer page](https://play.google.com/store/apps/developer?id=Juyo+AI)
- **No mention on Juyo's own sites:** juyo.ai pages do not mention a mobile app, Google Play or the App Store (grep of 42 downloaded pages). Hotel Tech Report "doesn't mention a mobile app". — [juyo.ai](https://juyo.ai/), [Hotel Tech Report](https://hoteltechreport.com/revenue-management/business-intelligence/juyo-analytics)
- **Not on Mobbin:** a Mobbin search for Juyo returned only unrelated apps (DoorDash, OpenTable, Airbnb…). — [Mobbin search result example](https://mobbin.com/screens/4fbbe5c4-e614-4170-a996-1ab1a0d73ed0)

### Inferences
- **Mobile is positioned exactly as "the GM reads, asks and leaves":** no dashboards, no filters. The answer card is the unit, and it is the same anatomy as the web chat.
  - For Compass, a phone view built around the briefing and answer cards matches Juyo's own direction [inferred].
- **Tablet frames look like iPad,** so an iOS build may exist privately or via TestFlight [inferred, unverified].
- **The low install count (50+)** suggests an early or internal rollout as of Oct 2026 [inferred].

### Gaps
- No Apple App Store listing was found (web search only). Whether an iOS build exists is unknown.
- Not seen in public: notifications/alerts on mobile, offline states, sharing or export from mobile, how "different AI Models" are chosen in the UI, and whether Canvas dashboards are reachable on mobile.
- No reviews or ratings are shown on the Play listing (50+ installs).

---

## Q5. How do Kassandra answers render (charts in chat, tables, "bottom line" boxes)?

### Takeaway
Kassandra answers render as **structured report cards inside the chat stream**, built from a fixed block vocabulary:
1. Headline with an emoji icon.
2. Meta line (hotel · period · topic).
3. Lead narrative, with bold figures in purple and good-news figures in teal.
4. A row of 3–5 **outlined KPI tiles**: uppercase label, coloured value, grey sub-caption.
5. UPPERCASE **section titles**.
6. **Chart cards**: bold title, chart, grey caption, with "Expand" on mobile.
7. **Tables**.
8. **Recommended actions**: cards with a coloured left rule, bold headline, rationale and a teal impact line.
9. Collapsible "assumptions and methodology" sections, a **"Bottom line"** box, and **"Suggested follow-ups"** pills.

Answers stream in with a progress line ("I have all the numbers. Rendering the full analysis now.", "One moment… reshuffling the universe."). The scripted homepage demo exposes this as typed block data (`narrative`, `kpi`, `sectionTitle`, `chart`, `recs`, `followups`).

### Cited Findings

#### Public scripted demo (`website-demo.juyo.ai`, embedded on the juyo.ai hero)
- **Empty state:**
  - Orb, "Hello, Juyo".
  - "Ask me anything about your hotel performance. I connect Reservations, P&L, Benchmarking, Rate Shopping, Reviews and more, then I interpret, reason, and tell you what to do next."
  - Input "Ask Kassandra anything about your property…".
  - "TRY ONE OF THESE" suggestion buttons, each with a ✦ spark and a purple **role tag**: "COMMERCIAL", "OPERATIONS", "REVENUE MANAGEMENT".
  - Source: [website-demo.juyo.ai](https://website-demo.juyo.ai/)
- **Chat view:**
  - Header orb, title (e.g. "June commercial assessment"), subtitle "Juyo AI · live · pulling from your connected sources", "＋ New chat".
  - User bubble right-aligned with a 1px border; assistant avatar is the orb GIF.
  - A typing bubble, then the narrative is typed out character by character.
  - Source: [website-demo.juyo.ai](https://website-demo.juyo.ai/)
- **Block types in the script,** rendered in order — [website-demo.juyo.ai](https://website-demo.juyo.ai/):
  - `narrative`: 14.5px. `<strong>` is purple, `<em>` is teal, non-italic, 600 weight.
  - `kpi`: cards with a 1px border at 35% alpha of the accent colour, value coloured by accent, label 11px / 700 / uppercase / letter-spacing 1.5px, sub-caption 12px grey.
  - `sectionTitle`: 11.5px, uppercase, letter-spacing 1.8px, grey. Examples: "Segment performance — June OTB", "Recommended actions".
  - `chart`: card with a 13.5px bold title, the SVG, and a 12.5px grey caption.
  - `recs`: a 3px left border (rec-1 orange, rec-2 purple, rec-3 teal), headline 14.5px bold, sub 13px grey, impact 13px / 600 teal.
  - `followups`: label "SUGGESTED FOLLOW-UPS", pill buttons (radius 999px) with a purple ✦, plus "More follow-ups".
- **Example "recommended action" lines** — [website-demo.juyo.ai](https://website-demo.juyo.ai/):
  - "Lift Thursday BAR €10–15 across June" → "+€11.4K projected lift".
  - "Pause Expedia visibility boost after May 31" → "+€7.4K June".
  - "Move one front desk FTE — May 27 evening → May 16 afternoon" → "€0 cost · risk avoided".
- **Follow-ups open nested answers** with their own KPI, chart and recs blocks. Examples: "Run the customer value chain on my top 5 segments for June…", "What would a €15 BAR move on the top five flagged dates do to forecast revenue if elasticity holds at trailing-90 levels?" — [website-demo.juyo.ai](https://website-demo.juyo.ai/)

#### Published answer screenshots (2026)
- **"~€110K sitting on the table in July — and the comp set already knows about Tomorrowland":**
  - Meta "Demo Hotel · Brussels · July 2026 Competitive Intelligence".
  - Five outlined tiles: "JULY AVG VS BENCH −€3", "ADDRESSABLE UPLIFT ~€110K", "MPI (JAN 2026) 0.92", "ARI TREND 1.03–1.06", "EVENTS IN JULY 5".
  - A rate-vs-comp line chart with event bands.
  - A section "🎪 The Event Calendar is Doing the Work — But Not Everywhere", where money is highlighted inline ("€147 below market").
  - Source: [Screenshot 2026-07-03](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Screenshot%202026-07-03%20at%2017.58.45.png)
- **"All 12 groups clear the displacement bar — but two deserve a harder look before the next renewal":**
  - Preceded by the status line "I have all the numbers. Rendering the full analysis now."
  - Meta "Demo Hotel · Group Portfolio Analysis · July–August 2026 · 481 rooms".
  - Tiles: "TOTAL CONTRACT VALUE €442K", "DISPLACEMENT COST €92K", "NET VS TRANSIENT +€350K", "RATE RISK BLOCKS 3", "OTB OCCUPANCY ~34%".
  - Two chart cards.
  - A section "⚡ The displacement math — assumptions and methodology".
  - Closes with "Two natural next steps: (1)… (2)…".
  - Source: [Commercial Win the group business…](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Commercial%20Win%20the%20group%20business%20worth%20winning.png) (on [juyo.ai/kassandra-ai](https://juyo.ai/kassandra-ai))
- **"−€215K vs last year — but three dates in May explain 77% of it":**
  - Five tiles (€3.12M, €192.61, 57.5%, −1,096 RN, €270K).
  - A combo chart and a segment detail table.
  - Section "🎯 Three Segments Worth a Harder Look".
  - Source: [FInd the rate you left on the table](https://juyo-production.ams3.cdn.digitaloceanspaces.com/FInd%20the%20rate%20you%20left%20on%20the%20table%20%281%29.png)
- **Operational answers:**
  - "30-Day Pace Analysis — May 12 to Jun 11, 2026" with three orange-outlined tiles ("CY OTB VS LY OTB −517 RN", "CY OTB OCCUPANCY 45.3%", "PROJECTED FINAL OCC ~65.9%"). The chat composer reads "Ask anything about your data". — [Kassandra 3](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Kassandra%203.png)
  - "Step-Cost Threshold Analysis — 14 Days" with "CRITICAL DAYS May 18–19" and "STEP-UP DAYS May 20–21" tiles. — [Kassandra 4](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Kassandra%204.png)
- **HotelGPT shell:** header "HotelGPT / Powered by Kassandra AI" with the orb. Answer sections such as "Rate positioning — structurally cheap on the days that matter most" and "📅 Context: What the 78% pace actually means with 27 days left". — [Kassandra AI 2](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Kassandra%20AI%202.png), [HotelGPT Comp set](https://juyo-production.ams3.cdn.digitaloceanspaces.com/HotelGPT%20Comp%20set.png)
- **Already documented earlier:** the "THE READ" label, the boxed **"Bottom line"** and the honesty banner when data tables are not connected are in [insight_feed.md §3.20](../../ui-round3/insight_feed.md) and [juyo_brand.md §3](../../ui-refinement/juyo_brand.md), with source screenshot [Hotelgpt (1)](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Hotelgpt%20%281%29-2100x1400.webp).
- **Mobile:** chart and table cards each carry an "⤢ Expand" button. Tiles are 4-up on tablet and stacked on phone. — [Google Play screenshot 6](https://play-lh.googleusercontent.com/urvNyRhk30QiV-GoaZovRtRO8FYyHn8GyUDCxgE_XqXrsUiFixZD6R3Y6kbTc6f8xdAegIVLhd5gXPTfJndmyQ=h1400), [screenshot 2](https://play-lh.googleusercontent.com/WGVzX5Obdw6rEeWiALMFF5KCe3akc0HAE9S7LCc0cuJ464uVIl_uRl6WZpwm-8rHTWW7zDmC_iUnJs4JsHxk6Q=h1400)

#### "How Kassandra thinks" page (`kassandraai-reasoning.juyo.ai`, embedded on /kassandra-ai)
- **Five layers:** "Layer 1 · Raw — Source Systems (PMS · RMS · POS · S&C · Forecast)", "Layer 2 · Unified — Transactional Data", "Layer 3 · Lenses — Reasoning Frameworks (commercial · financial · M&E)", "Layer 4 · Meaning — Semantic Layer (pace · elasticity · LTV)", "Layer 5 · Voice — Kassandra draws the conclusion". Status chip "Live · 11 sources · 1.4M signals / day". — [kassandraai-reasoning.juyo.ai](https://kassandraai-reasoning.juyo.ai/)
- **Output card in three parts:**
  - "Insight: GOP conversion not optimised on peak demand."
  - "Recommendation: Review acquisition cost and channel mix, as well as staffing in F&B."
  - "Action: Update forecast and staffing schedule."
  - Source: [kassandraai-reasoning.juyo.ai](https://kassandraai-reasoning.juyo.ai/)

#### Claimed interaction patterns (no screenshot)
- Reasoning depth ("Quick / Thinker / Strategic"), "Council mode", "hands you a form" and exports to "PDF, PowerPoint or Word". — [juyo.ai/kassandra-ai](https://juyo.ai/kassandra-ai)
- "Insights… adapted by role, language, and level of detail". — [Wrapped 2025](https://juyo.ai/juyo-analytics-wrapped-2025)
- An essay describes the intended dashboard + AI loop: "It highlights what's unusual, for example: saturday pickup is 15% below its normal pattern. You click the anomaly, and AI explains why, in context". — [Is AI killing dashboards](https://juyo.ai/is-ai-killing-dashboards)
- **Quantitative backing claim:** "Behind every answer is rigorous quantitative work: pace curves, booking window distributions, day-over-day and week-over-week pickup velocity… surfaced as plain language, not formulas." — [Complex questions, instant answers](https://juyo.ai/blog-complex-questions-instant-answers)

### Inferences
- **The block vocabulary is the real design system of Kassandra.** It is narrative → KPI row → section title → chart card (title + caption) → recommended actions with an impact figure → follow-ups.
  - A Compass answer spec of the same shape (typed blocks, not free HTML) would read as native to Juyo while letting Compass add what is missing [inferred].
- **What is missing in Juyo's public answers:**
  - Visible sources or definitions per number.
  - A confidence or range on projections: the demo shows point estimates like "+€42.8K projected (at trailing-90 elasticity)" without a band.
  - Any "approve / apply" control on a recommendation. Recs are read-only text with an impact line [inferred from the demo markup].
- **Editorial tone is part of the render:** emoji headlines, "reshuffling the universe", "rate is the wound". Compass can keep the structure and choose a calmer voice to differentiate [suggestion].

### Gaps
- No public example of an interactive form, a council/strategic multi-agent answer, a briefing or export (PDF/PPT/Word), an alert, or an agent run.
- Not visible: whether chat charts can be pinned or opened in Canvas, and whether Kassandra shows its SQL or sources.
- The "Bottom line" box is known only from earlier-viewed screenshots (see insight_feed.md). The new screenshots reviewed here do not show it again.
