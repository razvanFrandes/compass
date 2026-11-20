# Insight feed: a visual morning brief for the Compass home

Researched 2026-11-20 (UI round 3). The question: which premium, visual patterns (not list rows) exist for an AI "morning brief / insights inbox" home, and which single layout should Compass ship.

How to read this:
- **[M]** means I opened the Mobbin screen image and saw it. The link goes to that screen.
- **[S]** means an official source (docs, help center, changelog, company blog or newsroom) says it. The link is beside it.
- **[3P]** means a third-party source. Treat it as unverified.
- **[P]** means it is our proposal or inference. No source states it as a rule.
- Official images marked "viewed" were opened by a research sub-agent, not on Mobbin. Their descriptions are second-hand, but each one links to the image.

Source gaps:
- **Not on Mobbin** (searched by name in both standard and deep mode): Robinhood, Ramp, Webull, Granola, Dia, Tableau Pulse, and Fey on iOS. Their sections rely on official pages only, so they say less about visual detail.
- **Juyo Kassandra** anatomy comes from our earlier read of Juyo's own published screenshots ([../ui-refinement/juyo_brand.md](../ui-refinement/juyo_brand.md) §3) plus the juyo.ai pages.
- Everything the brief needs about chat, approvals and mobile composer behaviour is already in [../ai-ux/pattern_canon.md](../ai-ux/pattern_canon.md) and [../ui-refinement/mobile_and_boards.md](../ui-refinement/mobile_and_boards.md). This file does not repeat it.

---

## TL;DR

1. **Ship one layout: "brief hero + chart cards + Pulse rail" (§5).**
   - **Hero:** date, a "generated at" stamp, the AI headline, three stake chips (`▼ €5.8k at risk`, `▲ €3.1k upside`, `● 1 needs your decision`) and the ask bar.
   - **Three insight cards.** Each has a money chip, a takeaway title, one mini chart with a dashed STLY line, a one-line why, and its own "Ask about this".
     - Card 1 is wide; cards 2 and 3 are half width.
     - The decision card is the only orange object on the page.
   - **Pulse:** 2×2 sparkline tiles in a sticky right rail. On phones they become a 2×2 block above the cards.
   - **Resolved:** collapses into one line.
2. **Lead with the summary.** Tableau Pulse puts its insight summary at the top of the home page, above the metric cards. Robinhood Digests, Public, Dia's Morning Brief and Linear's Daily pulse all lead with one AI sentence and a time stamp.
3. **Put a chart in every insight, and give it a comparison line.**
   - Tableau draws a sparkline with a dashed forecast on every card.
   - Robinhood plots "You" against SPY.
   - Copilot and Monarch draw this period against last period, with an end label.
   - For a hotel, the comparison line is STLY.
4. **Show rank with size.** Apple News, Google Discover, Perplexity Discover and Google Ads all make the first item bigger. Equal grids (Stripe, Mixpanel boards) read as dashboards, not briefs.
5. **A decision is a card with its buttons inside, not a colored row.**
   - Copilot "line[s] up suggestions on your Dashboard for you to approve" (DISMISS / APPROVE).
   - Ramp puts ⊗ / ✓ on each savings card. Monarch's "Savings Found" has one CTA plus ×.
   - Remote, Revolut and Instacart put the approval, with a deadline, inside the card.
   - None of the analytics products we checked (Tableau, Amplitude, Mixpanel, Linear, Juyo) has a decision card in its brief. That is the gap Compass fills.
6. **Put KPIs beside the story, not inside it.** Perplexity's right rail of 2×2 sparkline tiles is the closest match to the Pulse column.
7. **Each card opens its own thread, showing the same chart.** Precedents: Linktree's per-card question chips, Mercury's "click into any of them to ask our chatbot", Mixpanel's "Chat with Mixpanel Agent" and Amplitude's chart inside the chat.
8. **Reuse Juyo's own visual language:** Kassandra's outlined KPI tiles, charts with event bands and a "today" line, and the "Bottom line" box.
9. **Watch out:**
   - White text on orange fails contrast (2.67:1), so use ink text.
   - Purple #996AD5 fails 4.5:1 for small text on both surfaces.
   - Fey shut down in 2025, so its screens are a design reference only.
   - Arc's AI features end on 23 Nov 2026.

---

## 1. The content this home has to carry

| Element | Today's content |
|---|---|
| AI headline | "December weekends are soft. The tech summit at the end of November is not." |
| Ask bar | Free-text question about the hotel |
| 3 ranked items (by money) | **1.** −€4.6k: the weekend of 11–12 Dec is 17 pts behind last year. **2.** +€3.1k: raise BAR for 27–28 Nov, *needs your decision*. **3.** −€1.2k: Booking.com took 41% of pickup. |
| Resolved | 1 item |
| Pulse | Occupancy 44.8%, ADR €142, RevPAR €64, Revenue €406k, each with a sparkline |
| Click on an item | Opens a conversation thread with a chart |

Two derived numbers the layout can use without inventing data: **€5.8k at risk** (4.6 + 1.2) and **€3.1k upside**. The Pulse values agree with each other: 44.8% × €142 = €63.6, which rounds to the €64 RevPAR shown.

---

## 2. What makes a brief visual: patterns seen in two or more products

| # | Pattern | Seen in | How Compass uses it [P] |
|---|---|---|---|
| P1 | **Hero summary with a freshness stamp.** One short sentence or paragraph at display size, dated, with a "generated at" time. | Fey "Daily recap · Summarized at 6:00 AM" [M]; Public "Generated by Agents at 11:22 AM" [M]; Perplexity Finance "Market Summary" plus "Updated 2 minutes ago" on its AI watchlist prose [M]; Fitbit AI card stamped "7:39PM" [M]; Garmin "Active Intelligence" under "Good morning, Sam" [M]; Robinhood Digest "Updated 4 PM" [S]; Tableau "Today's Tableau Pulse" summary block [S]; Linear "Daily pulse" delivered "around 6:00 AM" [S]; Dia "The Tuesday Brief" [S]; Monarch "✦ Weekly Recap" [S] | The headline sentence with the date and "generated 06:00" |
| P2 | **Numbers as chips inside the prose.** | Fey news cards ("Nvidia's −2.60% H20 chip orders", the % in a red pill) [M]; Perplexity Finance watchlist prose ("Tesla ↗4.59%" pill) [M]; Mercury trend text with entity chips that act as filters [M]; Churnkey narrative with bold figures [M]; Kassandra shows money "inline in color" (juyo_brand.md) | Money chips under the headline and in every card title |
| P3 | **One chart per insight, with a reference line.** | Copilot cumulative spend vs last month (dotted) with an end label "$848 over" [M]; Monarch "This month vs. last month" [M]; Perplexity Finance iOS "Standouts" card with a labelled "Prev close" dashed line [M]; Apple Stocks sparklines on a dotted previous-close baseline [M]; Bloomberg "At A Glance" tiles [M]; Stripe and Google Analytics dashed prior period [M]; Tableau Pulse sparkline with a dashed forecast and an expected-range band on every card [S]; Robinhood Digest chart of "You" against SPY [S] | Every card's mini chart draws STLY as the dashed line |
| P4 | **One big item, then smaller ones.** | Apple News Top Stories [M]; Google Discover [M]; Perplexity Discover (wide, then 3-up, then wide) [M]; Google Ads "TOP RECOMMENDATION FOR YOU" as the first card [M]; ClickUp's "AI Project Update" spans a 2×2 cell of its bento [M] | Item #1 is a wide card; #2 and #3 sit side by side |
| P5 | **KPI tiles in a rail or strip beside the feed, not inside it.** | Perplexity Finance right rail plus "Top Assets" row [M]; Perplexity Discover "Market Outlook" 2×2 sparkline tiles [M]; Fey watchlist slide-over [M]; Stripe right rail [M]; Linktree "Lifetime totals" row [M]; Amplitude KPI tiles that switch the chart [M]; Fitbit 2×2 tiles above the AI card [M]; Monarch "Savings Found" rail of totals [S]; Ramp homepage right-hand sidebar [S] | Pulse as a 2×2 tile rail on desktop, a 2×2 block on phones |
| P6 | **The action-needed item is its own object: a label, a deadline, buttons inside the card.** | Copilot "TO REVIEW" card with "MARK AS REVIEWED" [M]; Otter "LIVE" card with a red outline and "Join meeting" [M]; Instacart "You have 6 hr 14 min left to approve this order" [M]; Remote Approve/Decline inside the card [M]; Google Ads impact chip "+2.7%" on each recommendation [M]; Docusign "1 Action Required" tile [M]; Monarch "Open review" [M]; Copilot DISMISS / APPROVE on dashboard suggestions [S]; Ramp ⊗ / ✓ on savings cards [S]; Tableau alerts center plus a 24-hour badge on the card [S]; Linear Inbox "Priority" tab [S] | The decision card is the only orange object, with before → after, "7 days out", Review / Not now |
| P7 | **A per-card way to ask, which opens the AI with that card's context.** | Linktree puts a suggested question chip at the bottom of every insight card [M]; Strava "Athlete Intelligence" card with "Say More" [M]; Lloyds "Ask a question" card under the chart [M]; Amplitude renders the chart inside the chat thread with "Open Chart" [M]; Mercury: "click into any of them to ask our chatbot" [S]; Mixpanel alert card with "Chat with Mixpanel Agent" [S]; Tableau "Ask Tableau Agent in Pulse" with suggested questions [S] | "Ask about this" on each card; the thread opens with the same chart |
| P8 | **Done items collapse.** | Monarch Advice "Show 1 completed" [M]; Linear Inbox "Notification deleted · Undo" [M]; Canny "Idea created · Undo" [M] | One line: "1 resolved since yesterday · Show" |
| P9 | **A trust line on generated content.** | Perplexity "53 sources" [M]; Mercury "Trends are generated and may include inaccuracies." [M]; Arc Search "Read 20 web pages" [M]; Google Discover AI summaries with stacked publisher icons [M]; Fey analysis "Sources: 10-K filing 20K words, Financials 16 quarters, Analyst estimates 32 analysts" [M]; Dia footer "Made for you by Dia using your Gmail, Google Calendar, Slack…" [S]; Tableau citations and "Metric Sources" [S]; Granola "Every fact is cited" [S] | A "Sources" chip in the hero; the caveat in the page footer |

---

## 3. Product anatomy

For each product: what I looked at, then layout, hierarchy, chart, impact, how "needs you" is shown, card actions, density, how KPIs sit beside the insights, and what Compass should take.

### 3.1 Fey (web): daily recap home

Screens [M]: [home](https://mobbin.com/screens/dc5328bd-98d9-46b1-9b18-7ee5805fb878), [watchlist slide-over](https://mobbin.com/screens/8487cb92-3969-4f21-a847-26177466cf9a), [search](https://mobbin.com/screens/05f87eae-99d3-4d7a-a7c4-c443a99afb0b), [AI stock analysis](https://mobbin.com/screens/822b787f-6087-43e9-9d37-69fd43b52d63), [stock page with Key Indicators](https://mobbin.com/screens/8ca11180-05f8-4b65-8ac1-953d19843a24), [portfolio](https://mobbin.com/screens/2075240a-99a1-4224-b0d9-bcee4c29b30f).

**Status [S]:** Fey is no longer a live product.
- Wealthsimple acquired it on 27 Aug 2025 ([newsroom](https://newsroom.wealthsimple.com/wealthsimple-acquires-investment-research-platform-fey)). fey.com now shows "Sign-ups to Fey are closed", and Fey wound down by 30 Sep 2025 ([BetaKit](https://betakit.com/wealthsimple-acquires-fey-to-bolster-its-investment-research-capabilities/), [3P]).
- No official documentation of the Daily Recap survives. The Mobbin screens listed above are the only record of its anatomy, so treat them as a design reference.

- **Layout:** a greeting row ("Hello, Sam" on the left; "The markets are closed" and a theme toggle on the right), then two equal columns. The left column is one tall card: the date, "The markets are **neutral**" with the sentiment word in color, a large S&P 500 line chart with a VIX sub-chart, range chips (1M · 3M · YTD · 1Y · 2Y), and sector rows with inline green/red bars. The right column is a "Daily recap" card followed by stacked news cards. A floating dock at the bottom holds navigation and search.
- **Hierarchy and size:** the recap card is the largest text block. It has a bold summary of four or five lines, "Read more", a soft gradient glow, "Summarized at 6:00 AM" and an expand icon. Each news card below is about half its height.
- **Chart per insight:** no. One big market chart is the visual anchor. Each news card is a single AI sentence.
- **Impact:** a colored %-change pill sits inside the sentence. Sentiment is one colored word in the chart header.
- **Needs you:** none. A market feed has no actions.
- **Card actions:** Read more, expand the recap, the ticker chip opens the stock. The watchlist slides over from the right.
- **Density:** low. Dark, a lot of space, one accent per element.
- **KPIs beside insights:** the Holdings/Watchlist panel is a slide-over, not a fixed column. On the stock page, a "Key Indicators" card lists three findings with check or cross icons and bold numbers ("Underperforming S&P 500 by 20.47% YTD"), stamped "Metrics analyzed at 6:00 AM Feb 25". A KPI strip sits below it.
- **Take for Compass:** the premium feel comes from one large chart and one glowing recap card, not from many widgets. "Key Indicators" is a good model for a short set of checkable findings with a timestamp.

### 3.2 Perplexity Finance (web and iOS)

Screens [M]: [web home](https://mobbin.com/screens/83b1f736-4260-48f3-b6a3-b6da01cfbaf9), [watchlist movers and notable price movement](https://mobbin.com/screens/471f9aa4-b86c-4eb8-bddf-6f7a36639782), [AI watchlist prose](https://mobbin.com/screens/96e44156-62d2-4bc8-b6be-f58f7babe8c9), [earnings](https://mobbin.com/screens/2891d073-cefe-4429-8ab2-5f464e860171), [heatmap](https://mobbin.com/screens/6334e233-7651-4be1-a9e9-eb7b29563b98), [iOS Standouts card](https://mobbin.com/screens/026f3608-8463-4467-956e-a915ad3bdf7f), [iOS notable price movement](https://mobbin.com/screens/1f039b81-0a66-4c56-8f40-f5fbac96ba7a).

**Official [S]:**
- The Finance home holds "A customizable watchlist", "Upcoming earnings", "A summary of recent market developments and latest news" and "Top gainers and losers" ([changelog, May 2025](https://www.perplexity.ai/changelog/what-we-shipped-may-23rd)).
- The Watchlist tab gives an "AI-generated market synthesis across your entire watchlist's recent movement" ([changelog, Dec 2025](https://www.perplexity.ai/changelog/what-we-shipped---december-5th)).
- Hovering a company on the heatmap shows "a live-updating synthesis of why the price is up or down" ([changelog, Feb 2026](https://www.perplexity.ai/changelog/what-we-shipped---february-6th-2026)).
- The [official watchlist image](https://cdn.sanity.io/images/aqo64vfr/production/c4e4d5153a6afd423639519c70c84f982b16d27a-2998x1528.png) (viewed) matches the Mobbin screens.

- **Layout:** a main column (about two thirds) and a right rail (one third). Main: a "Top Assets" row of 4–5 small cards, then "Market Summary", then an "S&P 500 Heatmap" (treemap). Rail: a "Bullish Sentiment" meter top right, then the Watchlist, Prediction Markets cards and Gainers/Losers/Active tabs. The ask bar ("Ask anything about US markets", with Search, Computer, a model picker and voice) is docked at the bottom of the main column.
- **Hierarchy and size:** the Market Summary card opens with its first story expanded as a paragraph. The other stories are collapsed one-line rows, followed by a "53 sources" chip.
- **Chart per insight:** each "Top Assets" card has an area sparkline, green or red. Summary stories have no charts. The iOS "Standouts" card is one insight with a big intraday chart, a red delta pill (↘50.95%) and a dashed line labelled "Prev close: $464.42".
- **Impact:** arrow plus % in tinted pills (green or red). On the AI watchlist page, the prose itself carries bold tickers and inline delta pills ("Tesla ↗4.59%"), with "62 sources" and "Updated 2 minutes ago".
- **Needs you:** none. "Price Alert" is a header action.
- **Card actions:** expand or collapse a story, sources, remove from watchlist (×), Expand on the heatmap.
- **Density:** high but calm: thin borders, small type, a lot of white space between sections.
- **KPIs beside insights:** in the rail, always visible.
- **Take for Compass:** the main-plus-rail split, and the iOS "Standouts" card as the model for one insight carrying one chart with a labelled reference line.

### 3.3 Perplexity Discover (web and iOS)

Screens [M]: [web For You](https://mobbin.com/screens/423c2053-3a7f-4e84-ac8a-0723f1790a45), [web Sports with Market Outlook rail](https://mobbin.com/screens/14c9db17-6526-4c8f-a166-1e24309acafd), [web scrolled](https://mobbin.com/screens/ec59e633-ba10-46a5-9277-363061007f02), [web TSLA "Key Issues" bull/bear cards](https://mobbin.com/screens/fe843441-44a8-40db-aba7-9f94279366e3), [iOS Discover](https://mobbin.com/screens/cbca6cd0-2be2-4b07-b4a0-049a259ea642).

**Official [S]:**
- The web Discover revamp is "your new front page", with a quick view of "the markets and weather" ([changelog, Jul 2025](https://www.perplexity.ai/changelog/what-we-shipped-july-18th)).
- Stories open in "Summary" mode by default, with a "Report" toggle and a "Why it matters" section ([changelog, Jun 2025](https://www.perplexity.ai/changelog/what-we-shipped-june-13th)).

- **Layout:** tabs at the top (For You · Top · Topics). The main column runs in a fixed rhythm: a wide hero story (serif headline of 2–3 lines, "Published 13 hours ago", a two-line dek, a sources chip, image on the right at about 45% width), then three equal image cards, then another wide card with the image on the left. The right rail holds a weather widget, "Market Outlook" as 2×2 tiles, and "Trending Companies".
- **Hierarchy and size:** the hero is about three times the area of a 3-up card.
- **Chart per insight:** no. Stories use photos. The rail tiles (S&P Futures, NASDAQ, Bitcoin, VIX) each have a value, a % change and a sparkline.
- **Impact:** green/red % with arrow on the rail tiles. On the TSLA page, "Key Issues" shows two side-by-side cards tagged "Bullish view ↗" (green) and "Bearish view ↘" (red).
- **Needs you:** none.
- **Card actions:** like (♡), overflow (⋯), sources. On iOS: Listen, share, ⋯.
- **Density:** medium, editorial.
- **KPIs beside insights:** the rail, as 2×2 sparkline tiles.
- **Take for Compass:** the wide-then-small rhythm, and the 2×2 sparkline tiles in the rail, which is exactly the Pulse.

### 3.4 Public (iOS): Markets "Today" with an AI headline

Screens [M]: [Markets › Today](https://mobbin.com/screens/8997baf2-791d-48ad-9567-ceb165150a07), [Latest news](https://mobbin.com/screens/d4ff9a4c-6714-4e65-8de5-2efe0640ca77), [Inbox](https://mobbin.com/screens/a6751b2f-6f73-4d79-90d8-bd6d9ffc30f4), [Inbox price alerts](https://mobbin.com/screens/7366c67e-2cc7-4265-a62b-b7d18de22f6b), [Agents tab](https://mobbin.com/screens/75494b9e-15ae-4420-a7e1-6132eefcb39e), [Ask AI answer](https://mobbin.com/screens/90c5158a-0e7e-48de-962f-4f041871c69c).

**Official [S]:**
- The "Market briefing" promises "a detailed breakdown of what's moving the markets each day" ([features](https://public.com/features)). The [official image](https://public.com/wp-content/uploads/2026/03/feature-01-02.webp) (viewed) shows:
  - one card with a date eyebrow;
  - a large serif headline sentence;
  - the footer "Generated by AI at 1:35 PM ✦";
  - earnings pills around it ("Beat +1.49%" in green, "Miss −0.95%" in red).
- "Key moments" are summaries "embedded directly on the asset's performance chart" ([features](https://public.com/features); [image](https://public.com/wp-content/uploads/2026/03/feature-01-03.webp), viewed). The image shows:
  - dots on the price line;
  - a sideways row of dated cards under the chart, each with a "↗ $71.05 (4.2%)" chip and one sentence on the cause.

- **Layout:** large title "Markets", tabs (Today · Stocks · Crypto · Options · Bonds). Under Today: the date ("Wednesday, July 29"), a three-line AI headline in large bold type ("Markets are lower today as oil surges 6.8% on Middle East escalation ahead of the Fed's rate decision.") with a → button, and "Generated by Agents at 11:22 AM ✦". Then outlined index rows (S&P 500, Nasdaq 100, VIX, Bitcoin, UST 6M) with colored %, then "Sectors" as tinted tiles (green tile with an up-arrow icon for Energy +1.90%, a red one beside it) that scroll sideways.
- **Hierarchy and size:** the headline is the biggest thing on the screen. Everything below is smaller and quieter.
- **Chart per insight:** none in the brief.
- **Impact:** green/red %, and green/red tinted sector tiles with arrow icons.
- **Needs you:** none on Today. The Inbox is a plain list of tagged rows ("Price alert", "Trade").
- **Card actions:** the → on the headline opens the full AI write-up.
- **Density:** low.
- **KPIs beside insights:** directly under the headline, as a compact block.
- **Tab bar:** Portfolio · Markets · Search · Inbox · Agents. The Agents tab is a dark gradient page with glass cards ("Market Monitoring") marked "Coming soon".
- **Take for Compass:** the headline-first hierarchy and the "Generated by … at …" stamp. The Inbox is the list pattern the user rejected.

### 3.5 Robinhood Cortex Digests (official pages only; not on Mobbin)

Sources [S]: [Cortex Digests](https://robinhood.com/us/en/support/articles/cortex-digests), [Digests methodology](https://robinhood.com/us/en/support/articles/cortex-digests-methodology), [YES/NO event, 16 Dec 2025](https://robinhood.com/us/en/newsroom/robinhood-presents-yes-no-event), [Crypto Market Pulse](https://robinhood.com/us/en/support/articles/crypto-market-pulse/), [Cortex](https://robinhood.com/us/en/support/articles/cortex/), [Cortex Digest agreement (PDF)](https://cdn.robinhood.com/assets/robinhood/legal/cortex_digest_agreement.pdf). Official images viewed: [Portfolio Digests](https://images.ctfassets.net/1hpl803w8xsv/7B3zAzlMqCgJat5iVlsJK3/b67281175926debcb8bc5730de2b2401/Portfolio_Digests.png) and [Cortex](https://images.ctfassets.net/1hpl803w8xsv/5blpnMMlzJJoBPSInitC0h/d8b1c17713328f3b1c29a4ee9fc056b4/Robinhood_Cortex.png).

- **Layout:** Portfolio Digests sit on the investing home, so people read them "without needing to leave their investing home screen". Each digest has three sections: "Market backdrop", "Return drivers" and "Top movers".
- **Hierarchy and size:** in the official image, from the top:
  1. "Updated 4 PM".
  2. A large AI headline, the biggest element: "Your portfolio rose by 2.41%, driven by cooling inflation and your Qentrix holding."
  3. A chart.
  4. A driver block.
- **Chart per insight:** yes. "In the Digest charts, 'You' represents your portfolio performance." SPY is always shown, and BTC only if you hold crypto. The image draws "You" as a green filled area, with SPY and BTC as lines.
- **Impact:**
  - A legend row with arrows and % ("▲ 2.41% You ▲ 1.21% SPY ▲ 1.92% BTC").
  - A green label, "Market driver: Cooling inflation", with a rule on its left.
  - Breaking news gets a lightning icon.
- **Needs you:** Cortex can draft an order, but the person has to "Review and submit when ready".
- **Card actions:** Crypto Market Pulse summaries end in "simple next steps": Learn more, Trade, or tap the ticker.
- **Freshness:** digests "refresh multiple times a day, or whenever news breaks", and show "the displayed time and date".
- **Density:** low. One digest fills a phone screen (the research agent's reading of the image).
- **Take for Compass:** this is the closest public precedent for "AI headline + one comparison chart + named driver" on a home screen. The "Market driver:" label is a good model for each card's why line.

### 3.6 Webull Vega (official pages only; not on Mobbin)

Sources: [webull.com/vega](https://www.webull.com/vega) [S], [Vega Analyst reports FAQ](https://www.webull.com/help/faq/11123-Vega-Analyst-Advanced-AI-Reports) [S], [Webull Australia release, Jan 2026](https://www.aap.com.au/aapreleases/cision20260107ae58353) [S], [FX News Group on the Nov 2025 launch](https://fxnewsgroup.com/forex-news/retail-forex/webull-introduces-ai-powered-decision-partner-vega) [3P]. Official [illustration](https://wbstatic.webullfintech.com/v1/webull-us-g/assets/e4b87b8bee80cf5191f7e176d1cfd985.png) viewed.

- Vega Insights "Delivers real-time, personalized analysis and alerts based on each client's watchlists and portfolios" [3P, quoting the release]. Watchlist Analysis: "Spot patterns, catalysts, and sector shifts as they happen" [S].
- In Australia: "Receive comprehensive daily summaries during trading hours and after-market sessions" [S].
- Vega Analyst reports open with "A concise takeaway…" and always include risks and opportunities [S].
- The official illustration is a dark card ("Stock A's AI Earnings Express Q3 2025") with teal verdict chips ("Beat expectations", "Double growth") above a metric table. It has no sparkline.
- **Unverified:** where the summaries sit in the app, card sizes, and any decision UI.
- **Take for Compass:** verdict chips that state the conclusion before the numbers.

### 3.7 Apple Stocks and Apple News (iOS)

Screens [M]: [Stocks](https://mobbin.com/screens/ac82abe9-7fa7-4085-9315-bcccdf872bc7), [News Today](https://mobbin.com/screens/2450aa3b-98e8-45ed-a7bc-afb38e478b73), [Top Stories](https://mobbin.com/screens/40d35b60-d9e9-4e2a-abfd-0b0faef277dd), [Latest Stories](https://mobbin.com/screens/d17401bc-3623-4468-8c98-05ad4659624e), [News widget](https://mobbin.com/screens/8c36d7b2-c9df-4841-a027-96c19c0791e1).

**Official [S]:**
- Stocks watchlist rows use "color-coded spark-lines" ([App Store](https://apps.apple.com/us/app/id1069512882)).
- News sits under the watchlist: "Swipe up on Business News or Top Stories to view stories" ([iPhone guide](https://support.apple.com/guide/iphone/read-business-news-iph013530e8d/ios)).
- The News Today feed "presents top stories selected by Apple News editors", and Top Stories are "the same for everyone" ([iPhone guide](https://support.apple.com/guide/iphone/see-news-stories-chosen-just-for-you-iph5b557ed3d/ios)).
- In iOS 26 the tab bar is "redesigned to float above users' content" ([Apple Newsroom](https://www.apple.com/newsroom/2025/06/apple-elevates-the-iphone-experience-with-ios-26/)).

- **Stocks layout:** dark. Large title with the date under it ("Stocks / April 1"), a "My Symbols" switcher, then rows: symbol and name, a sparkline drawn against a dotted previous-close baseline, the price, and a solid green or red delta pill. "Business News — From Yahoo Finance" is a bottom sheet pulled up over the list.
- **News layout:** large title with the date ("News / April 6"), topic chips, a red "Top Stories" header ("Selected by the Apple News editors."). The first story is a hero card: full-bleed image, publisher logo, a three-line headline, time and authors, ⋯. Later stories are smaller cards with the text on the left and a thumbnail on the right. The widget groups sections with colored labels (Top Stories red, For You green, Today's Podcast purple).
- **Chart per insight:** Stocks, yes (a sparkline on every row). News, photos only.
- **Impact:** solid green/red pills (Stocks). Section color (News).
- **Needs you:** none.
- **Card actions:** ⋯ on each story; the floating tab bar (Today · News+ · Audio · Following, plus Search).
- **Density:** Stocks dense; News airy.
- **KPIs beside insights:** in Stocks the KPIs are the main list and news is a sheet underneath. That is the opposite priority to a brief.
- **Take for Compass:** date in the title, one hero story, sparkline plus dotted baseline plus solid delta pill.

### 3.8 Google Discover (iOS, Google app)

Screens [M]: [feed](https://mobbin.com/screens/b5b06ee7-a74e-4534-8d2d-bfe19c875c04), [AI summary cards](https://mobbin.com/screens/b939a533-8c1f-40cc-ba24-a23e47f795b3), [Google home with glance tiles](https://mobbin.com/screens/7483666e-2df6-446e-af6b-5931bb5f35ec), [Following grid](https://mobbin.com/screens/6b3bf247-30b3-40ae-884f-522d81e9c004).

**Official [S]:**
- AI trending cards are "brief previews that you can expand to see more information, plus links" ([Google blog, Oct 2025](https://blog.google/products-and-platforms/products/search/ai-features-web-content/)).
- Card controls sit at the bottom right: "tap More" for "Not interested in [Topic]" or "Don't show content from [Source]", or "tap Like" ([Google Help](https://support.google.com/websearch/answer/2819496?hl=en&co=GENIE.Platform%3DAndroid)).
- Since Aug 2026, "tap any three-dot menu in your feed" and type what you want more or less of ([Google blog](https://blog.google/products-and-platforms/products/search/personalize-search-discover-news/)).
- A TechCrunch screenshot of the AI card shows "Generated with AI, which can make mistakes" ([TechCrunch](https://techcrunch.com/2025/07/15/google-discover-adds-ai-summaries-threatening-publishers-with-further-traffic-declines), [3P]).

- **Layout:** search bar and an "AI Mode" chip at the top, then small glance tiles (weather with AQI, "Sunset today 5:54 PM"), then a single-column feed.
- **Hierarchy and size:** big cards (full-width image, two- or three-line headline, source and age) alternate with compact cards (headline on the left, thumbnail on the right). Topic groups have a header with a Follow button. "Following" uses one big card over two small ones.
- **Chart per insight:** no.
- **Impact:** none. AI-made cards are marked with a Gemini sparkle and a stack of publisher icons with "+2", plus "See more".
- **Needs you:** none.
- **Card actions:** ♡, share, ⋮ on every card; Follow on topic headers.
- **Density:** low.
- **KPIs beside insights:** the glance tiles at the top are the only "KPIs".
- **Take for Compass:** big/compact alternation, and marking AI-made cards with a sparkle plus their sources.

### 3.9 Mercury Insights (web)

Screens [M]: [Sankey view with AI trends](https://mobbin.com/screens/10e9460a-1e44-4361-afe6-e0e9d857e6d9), [bar view](https://mobbin.com/screens/75f8ba8f-33c1-40ce-92b7-63b4216a7ecf), [Money in / Money out cards](https://mobbin.com/screens/c50126f3-c02b-4c44-a643-a26c0db602aa), [filters and saved view](https://mobbin.com/screens/f0c740ed-d283-4f4e-9208-64c3712975ec).

**Official [S]:**
- Insights launched on 11 Mar 2026 with a snapshot of "burn, runway, and key spend categories" and "AI-powered insights and alerts". Users can "click into any of them to ask our chatbot" ([Mercury blog](https://mercury.com/blog/introducing-insights)).
- "Drill down into any trend or alert to see the transactions behind it" ([mercury.com/insights](https://mercury.com/insights)).
- The [official overview image](https://www.datocms-assets.com/115132/1773077329-2026_blog_insights-overview_16x9.png) (viewed) matches the Mobbin screens: Net Cashflow, three trends with arrows and entity chips, the caveat footer, and the money-in/out chart.

- **Layout:** header ("Insights", bookmark, "Share feedback", Export), a filter row (Saved views, Filters, date range, All Cashflow, Compare to), a timeline brush for the range, then a big-number trio (Net cashflow, Money in, Money out) without card chrome. Below: AI trends on the left third, the chart on the right two thirds. Further down, "Money in" and "Money out" cards with a Source/Category/GL Code switch and inline share bars.
- **Hierarchy and size:** text and chart are side by side at equal height. The chart is the larger area.
- **Chart per insight:** the three trends share one chart (Sankey, or bars with a line). Trends do not carry their own.
- **Impact:** an icon per trend (↗ for "Higher spend to Uphold", ✱ for "More uncategorized payments") and a bold title. The amounts sit in the sentence. Entity names are grey chips that act as links to the filtered view.
- **Needs you:** implicit. "4 uncategorized payments" is a chip that opens those payments.
- **Card actions:** chips are filters; the view can be saved or bookmarked.
- **Density:** medium.
- **KPIs beside insights:** the big-number trio sits above both the trends and the chart.
- **Trust line:** "Trends are generated and may include inaccuracies." under the trends.
- **Take for Compass:** narrative beside its chart, entity chips that jump into the data, and the caveat line.

### 3.10 Ramp (official pages only; not on Mobbin)

Sources [S]: [introduction to the homepage](https://support.ramp.com/introduction-to-homepage), [Savings Insights](https://support.ramp.com/hc/en-us/articles/360042590674-Ramp-Savings-Insights), [Ramp Intelligence](https://ramp.com/intelligence), [Ramp Agents](https://ramp.com/blog/ramp-agents-announcement), [Reporting Agent](https://support.ramp.com/reporting-agent). Official [Savings Insights image](https://assets.ramp.com/help-center/ramp-savings-insights/attachments/4405619551123.png) viewed.

- **Layout:** the homepage has a task feed that "Displays assigned tasks (e.g., approvals, reimbursements, missing items)", and "The Homepage prioritizes key tasks". Other modules:
  - "Spending Insights".
  - FYIs from "Ramp Digest".
  - Banners for "required actions".
  - Sections collapse, and there is a right-hand sidebar.
- **Savings insights:** three equal cards in the official image. Each card has a yellow "New" tag, a one-line reason, a green "Potential Savings" figure ($1,600.00), and red ⊗ / green ✓ buttons. They show a figure, not a chart.
- **Needs you:** tasks come first. Agents "Approves when it's safe. Escalates when it's not." A "blue Ramp Intelligence icon" marks AI content.
- **Rationale:** "Every action comes with a rationale."
- **Charts:** the Reporting Agent builds charts on request with "Save to dashboard", and "Ask Ramp" opens from a chart.
- **Take for Compass:** an action card needs a money figure, a reason and two buttons. Mark AI content consistently, and treat the rationale as a required field.

### 3.11 Monarch (web and iOS): weekly recap

Screens [M]: [web dashboard with Weekly Recap card](https://mobbin.com/screens/779b114b-51f0-4a73-a203-ae1d75b472c1), [web net worth card](https://mobbin.com/screens/92fffbf2-d075-452c-9bbf-c7a51de40966), [web Advice with "Show 1 completed"](https://mobbin.com/screens/db3fb7cb-ef0b-43d2-8ef3-e98b5494a626), [iOS dashboard "June's review"](https://mobbin.com/screens/3738395a-1916-48e7-9d48-426ca0297264), [iOS "5 days ready to review"](https://mobbin.com/screens/78553887-5a7d-43f9-bd8f-b526c27dadf6), [iOS review intro](https://mobbin.com/screens/b10326d5-5eda-4ea8-8015-5c072eaf6add), [iOS review step: plan summary](https://mobbin.com/screens/794a4ea9-9d5c-4475-977c-e5652352af28), [iOS review step: cash flow](https://mobbin.com/screens/93752f2a-7ab5-4e59-a6b3-2bde0f9dd978), [iOS review step: net worth](https://mobbin.com/screens/15c9cd22-329c-493d-937f-e9335fd52b93).

**Official [S]:**
- The Weekly Recap (Dec 2025) covers "what changed, how your spending is trending, and what deserves your attention". It lives "on your dashboard, and we'll send you a weekly email as well" ([winter release](https://www.monarch.com/blog/winter-release)).
- Its [official image](https://cdn.sanity.io/images/mdewiujj/production/aa7f24dbad21057b43a7f8662af2a91e2020cefe-1024x728.png) (viewed) shows:
  - the header "✦ Weekly Recap | December 7–13";
  - an AI sentence with bold figures;
  - a donut chart, "$1,580 Total spend".
- "Savings Found" (beta, Nov 2026): "Each one shows how much you might be able to put back in your pocket" ([October product update](https://monarch.com/blog/october-product-update)). Its [image](https://cdn.sanity.io/images/mdewiujj/production/9ed45d86574dde1517130390e7993193d3d71ed7-3600x2355.png) (viewed) shows:
  - "Good morning, Jon";
  - a large ask box with suggestion chips;
  - stacked cards, each with a green "Earn $750/yr" eyebrow, a title, one call-to-action button, bookmark / ✓ icons and an ×;
  - a right rail with "$185 saved to date" and "$520 found for you".

- **Layout (web):** "Hello, Sam!" and Customize, then a two-column masonry of widget cards. "Your Weekly Recap — August 23rd–29th" is its own card with an orange sparkle title and one line ("See how your net worth and spending changed last week, and see what's coming up this week") plus a chevron.
- **Layout (iOS):** a stack of widget cards: a calendar ("July's progress — 5 days ready to review"), "June's review — View your progress for June!" with an orange **Open review** button, a net-worth chart card with page dots.
- **The recap itself (iOS):** a full-screen stepper with eight steps, Previous/Next and a dot progress bar. One idea per screen: "Plan summary" (progress bars for income and expenses), "July's cash flow" (tinted horizontal bars: income green, expenses red, savings blue), "Top income categories", "How your net worth changed in July".
- **Chart per insight:** yes on the recap steps (one bar set per step). On the web dashboard, "Spending — This month vs. last month" is a cumulative chart: an orange area for this month against a grey line for last month, with an end label.
- **Impact:** delta chips such as "↘ $16.00 (−12.7%)" next to card titles; "On track" badges on goals.
- **Needs you:** "N days ready to review" and the orange Open review button.
- **Card actions:** Open review, Next/Previous, chevrons.
- **Density:** low on iOS, medium on web.
- **KPIs beside insights:** they are the widgets themselves.
- **Take for Compass:** the pace chart (this period vs last, end label), and "Show 1 completed" for resolved items. The stepper is good for a weekly ritual, too slow for a daily brief of three items.

### 3.12 Copilot Money (iOS)

Screens [M]: [dashboard](https://mobbin.com/screens/39e851c1-7c5d-4f1e-bf81-1c3be05e5566), [dashboard, under budget](https://mobbin.com/screens/bcbf0ba4-98c3-4c50-a9c9-ccb81dd25e1d), [monthly spending bars](https://mobbin.com/screens/7bf8ee36-d264-4774-8639-48b4139b2e28), [cash flow](https://mobbin.com/screens/e7591103-070b-45f3-bd00-f73be234e5fc).

**Official [S]:**
- The Dashboard order is: a spending graph ("dotted line" = ideal pace, solid = actual), then To Review, Budgets, Upcoming (horizontal scroll) and Net This Month ([help center](https://help.copilot.money/en/articles/6045480-dashboard-tab-overview)).
- Since Oct 2026 the assistant will "line up suggestions on your Dashboard for you to approve" ([Meet your money assistant](https://www.copilot.money/dispatch/meet-your-money-assistant)). "You can dismiss, approve, or dig into any suggestion further" ([beta updates](https://www.copilot.money/dispatch/beta-updates-improvements)).
- The [official dashboard image](https://www.copilot.money/img/dispatch/screens/phone-dashboard.webp) (viewed) shows a "Transaction fixes" card under TO REVIEW with DISMISS / APPROVE.
- "charts now appear right in conversation" ([beta updates](https://www.copilot.money/dispatch/beta-updates-improvements)).

- **Layout:** blue gradient header with segmented tabs (Dashboard · Cash flow · Accounts …), then a stack of white cards.
- **Hierarchy and size:** the top card is the hero: "$2,367 spent" over "$2,236 spent last month", with a cumulative line for this month and a dotted line for last month. The line ends in a pill label ("$848 over" in magenta; on another screen "$1,034 over" in green).
- **Chart per insight:** yes for the hero. The monthly spending view uses bars against a budget line, with the over-budget month in red and a value callout.
- **Impact:** the end-of-line pill; "NET THIS MONTH $294.14" with a red "↘ 46.59%" pill "vs $550.79".
- **Needs you:** a "TO REVIEW" card right under the hero. It lists yesterday's transactions with category chips and ends in a full-width **MARK AS REVIEWED** button inside the card.
- **Card actions:** Mark as reviewed, View all, Recurrings ›, Cash flow ›.
- **Density:** medium.
- **KPIs beside insights:** "UPCOMING" mini cards ("in 8 days", "in 10 days") and budget rings follow the review card.
- **Take for Compass:** the pace chart with an end label is the exact form for "17 pts behind last year". The review card proves that a to-do can sit inside a visual home without becoming a list page.

### 3.13 Tableau Pulse (official docs only; not on Mobbin)

Sources [S]: [release notes](https://help.tableau.com/current/online/en-us/pulse_intro.htm), [explore metrics](https://help.tableau.com/current/online/en-us/pulse_explore_metrics.htm), [insight types](https://help.tableau.com/current/online/en-us/pulse_insights_platform_insight_types.htm), [ask / discover](https://help.tableau.com/current/online/en-us/pulse_ask_discover_qa.htm), [alerts](https://help.tableau.com/current/online/en-us/pulse_alerts.htm), [create metrics](https://help.tableau.com/current/online/en-us/pulse_create_metrics.htm), [goals and thresholds](https://help.tableau.com/current/online/en-us/pulse_goals.htm), [Pulse on dashboards](https://help.tableau.com/current/online/en-us/pulse_dashboard.htm). These help.tableau.com pages redirect to docs.salesforce.com. Official screenshots viewed: `pulse_dark_mode.png`, `pulse_home_card_goal.png`, `pulse_homepage_alert_center.png`, `pulse_digest_redesign.png` and `pulse_inline_viz.png`, all under `https://help.tableau.com/current/online/en-us/Img/`.

- **Layout:** the top of the home page is a text block, not a card: "Your insight summary appears at the top of your home page and in your digests". It only appears once you follow two or more metrics. In the official screenshot it is titled "Today's Tableau Pulse" and holds a paragraph with a sparkle icon and linked metric names, a tally ("Overall, 16 of 16 metrics changed: 6 favorably, 2 unfavorably, 8 neutral or unspecified"), and "Was this helpful?" with thumbs. Below it come the Following / Browse Metrics tabs, sort and filter, collapsible groups, and a grid of equal "rounded-corner metric cards".
- **Hierarchy and size:** all cards are the same size. There is no hero card; the summary plays that role.
- **Chart per insight:** yes, on every card. A sparkline labels the start value, marks the current point with a dot and its value, draws a dashed forecast to period end, and shades a light expected-range band. Each card also shows its top insight in two lines ("The top insight for each metric is displayed with the metric"). Since 12 Mar 2026, agent answers are "illustrated with an inline visualization".
- **Impact:**
  - The change line ("+65.9% (+$97.09K) vs. prior period") is colored by business meaning, set per metric with "Value going up is": "blue for neutral, green for favorable, and red for unfavorable".
  - A goal line ("67.9% of $1.5B goal met | 8 weeks left"). Since Jan 2026 there is also an on-track / off-track status that turns the forecast line green or red.
  - Unfavorable threshold ranges are shaded red.
  - "Insights are ranked based on impact to the metric."
- **Needs you:** there is no decision card. Alerts sit in a "Tableau Pulse Alerts" center at the top of the home page. "An alert badge also appears for the next 24 hours on the impacted metric card", and digests list alerts first.
- **Card actions:** ⋮ (followers, details, related metrics), follow/unfollow, favorite star, "Mute from Insights Summary", turn off alerts, set goal or threshold, thumbs on insights, and "Ask Tableau Agent in Pulse" with suggested-question chips.
- **Density:** medium-high. Each card holds a context line, the metric name, a big number, the change line, an optional goal line, the chart and a two-line insight.
- **KPIs beside insights:** they are fused. In Pulse the KPI *is* the card, and the insight rides on it.
- **Digests:**
  - The Slack digest shows "a sparkline chart that shows that period's data".
  - The March 2026 email digest is compact rows with the big number only.
  - The Teams digest leads with an AI summary.
- **2026 changes:** dark mode (2 Jul 2026), favorites and pace to goal (8 Jan), compact email digest and inline charts in agent briefs (12 Mar).
- **Take for Compass:**
  - Take the summary-first page, the tally line (it becomes our stake chips), color by business meaning, a dashed comparison inside every sparkline, and ranking by impact.
  - Pulse answers "needs your decision" with nothing more than an alert badge. That is the gap the Compass decision card fills.

### 3.14 Amplitude (web)

Screens [M]: [Home](https://mobbin.com/screens/75953679-6e87-4fe3-90c8-d824cdc80ed9), [Ask Amplitude thread](https://mobbin.com/screens/617e9a31-03e3-48c0-aab4-89ec276ae3e9).

Official [S]: [home page docs](https://amplitude.com/docs/get-started/amplitude-home-page) (updated 2026-10-21), [Specialized Agents](https://amplitude.com/docs/amplitude-ai/specialized-agents-overview), [Dashboard Agent](https://amplitude.com/docs/amplitude-ai/dashboard-agent).
- The documented home has no AI layer. It "shows how many users you have, how many are new, where they are, and what they're doing", along with recents, a create-chart shortcut and templates.
- AI findings go to an **Agent Inbox**: "Review agent threads, scheduled run outputs, alerts, and generated artifacts asynchronously".
- The Dashboard Agent writes "a list of prioritized insights and recommendations, highlighting what changed, why it matters, and the user segments most affected".
- For actions, "a human must approve it before Amplitude executes it". The approval screen is not documented.

- **Layout:** a bento of cards. The main card ("Web Engagement") has four KPI tiles across the top (Visitors 4 ▲300%, Page Views 12 ▲200%, Bounce Rate 40.0%, Page Views Per Session 2.4 ▼40%). The selected tile drives the line chart below. A realtime gauge card sits to the right, a Templates carousel below, then three equal cards.
- **Chart per insight:** each KPI tile switches the one chart. The chart tooltip flags "Dec 16: Anomaly" with "Click for Actions".
- **Impact:** green/red % beside each value.
- **Needs you:** the anomaly marker inside the chart.
- **Card actions:** "Open Analysis →", ⋯.
- **Thread:** "Ask Amplitude" answers with a chart card inside the chat ("Open Chart"), the definition shown as chips under the chart ("Measuring retention of users that perform New User …"), and "Ask follow-up".
- **Take for Compass:** KPI tiles that switch a chart are a good desktop Pulse interaction. The in-thread chart card with definition chips is the target for the card → thread hand-off.

### 3.15 Mixpanel (web)

Screens [M]: [Home](https://mobbin.com/screens/c05854c6-1065-45ed-89da-49e845da80d4), [Board](https://mobbin.com/screens/c97e0238-c27f-430a-aad4-f3b1816ee9fb), [card menu](https://mobbin.com/screens/b2e7f096-7f25-4cdb-a80e-645ed595f5a1).

Official [S]: [home and changelog](https://docs.mixpanel.com/changelogs/2025-07-15-homepage-board), [agentic automations](https://docs.mixpanel.com/docs/agentic-automations), [Mixpanel AI blog (May 2026)](https://mixpanel.com/blog/mixpanel-ai/).
- Since July 2025 an admin can make any Board the homepage, to "Put key KPIs front and center".
- The Mixpanel Agent's KPI digest contains:
  - "A short summary of what the metric did in the last window vs. baseline".
  - Notable shifts "with the agent's reasoning".
  - The "top 5 and bottom 5 performing segments".
  - A way to give feedback.
- The blog shows two images (viewed):
  - An in-app alert card: "Agendas Created trend · 2 mins ago", "Dropped 20% over the past 11 days", flagged as an anomaly, with a "Chat with Mixpanel Agent" button.
  - A Slack monitor with a red "Anomaly detected" pill, "Sign-ups: 4,210 | -12.1%", a line chart and the buttons View in Mixpanel, Root Cause Analysis and Ask Mixpanel Agent. The image is low resolution, so these labels are approximate.
- That Slack card (headline number, chart, then action buttons) is the nearest documented analytics example of an insight card with its own chart and actions.

- **Layout:** "Good Morning" greeting, "Your Recents" as thumbnail cards with chart previews and See All, "Your Product" as three KPI cards, then "Top Boards" (a list) and "Suggested Creators".
- **Board:** a bento with a KPI number card ("3 users", "+25%" chip), a funnel bar chart, a line chart, a rich-text narrative card and a flow chart.
- **Chart per insight:** on boards, yes. Home has thumbnails only.
- **Needs you:** none.
- **Card actions:** ⋯ with Delete, Rename, Duplicate, Chart Type, Copy URL, Move to, Create Linked Copy, Refresh Data.
- **Take for Compass:** a narrative card can sit inside a chart grid. Home itself is a navigation page, not a brief.

### 3.16 Linear Pulse and Inbox (web)

Screens [M]: [Pulse](https://mobbin.com/screens/71a0482d-226d-44bf-aac0-1abc44a7c40b), [project update with progress](https://mobbin.com/screens/e88b6bd7-3d4b-4e1e-8cd7-a9d2a6852795), [initiative with health and progress chart](https://mobbin.com/screens/e073e872-0477-4902-84c6-17e551e76f26), [Inbox](https://mobbin.com/screens/18c6955a-c42f-4cc1-9aa2-0276456720fb), [Inbox with undo toast](https://mobbin.com/screens/14cbb61d-2120-46fa-b29c-b7678e4b85cc).

Official [S]: [Pulse docs](https://linear.app/docs/pulse), [Pulse launch (Apr 2025)](https://linear.app/changelog/2025-04-16-pulse), [one-sentence takeaways (Apr 2026)](https://linear.app/changelog/2026-04-16-linear-for-microsoft-teams), [Inbox docs](https://linear.app/docs/inbox), [Priority inbox (Sep 2026)](https://linear.app/changelog/2026-09-03-priority-inbox), [project updates](https://linear.app/docs/initiative-and-project-updates).
- Pulse is "a personalized, realtime feed of updates and discussions".
- "A personal AI-generated summary of updates will be delivered daily or weekly to your Linear inbox", also as "a short audio digest". It arrives "around 6:00 AM in your local time".
- The official screenshot of "Daily pulse for Apr 16" shows a Listen button with a 1.2× speed control, "Initiatives" and "Projects" sections, and 2–3 bullets per item with health icons. Thumbs up/down sit at the bottom.
- Since April 2026, "Pulse entries now lead with a one-sentence takeaway for faster scanning".
- Since September 2026, Inbox has a Priority tab: "separates what needs your attention from what can wait".
- Project health is "On track, At risk, or Off track".

- **Pulse layout:** tabs (For me · Popular · Recent) and one centered reading column. Each update shows the project name, a health badge ("Project on track" in green), author and time, the body, property changes ("Status Backlog → In Progress"), comment and reaction icons, and a reply field.
- **Inbox layout:** master-detail. A dense list on the left (avatar, title, reason such as "Project update reminder", age, unread dot, red "Overdue"), the item on the right, "Notification deleted · Undo" toast.
- **Chart per insight:** no, in both. Progress charts live on the project page.
- **Impact:** health badge color and text.
- **Needs you:** "Overdue", "Due today" and unread dots.
- **Card actions:** reply, react, subscribe, delete with undo.
- **Density:** high (Inbox), medium (Pulse).
- **Take for Compass:** the health badge (color plus words) and undo after dismissing. The rows themselves are exactly what the user rejected.

### 3.17 Notion AI Meeting Notes and Home (web)

Screens [M]: [meeting with AI summary block](https://mobbin.com/screens/a1cd6f83-aac0-4df6-9297-3cc36fb6de4d), [recording](https://mobbin.com/screens/c34214cd-f0fa-4b2c-ba7b-e3df1acf5c68), [summary instructions](https://mobbin.com/screens/d4fd770a-f919-4d8f-b5b3-7191eaa36c07), [database Dashboard view](https://mobbin.com/screens/41f32a46-0aa4-4205-a6ab-627135308029).

Official [S]: [sidebar](https://www.notion.com/help/sidebar), [Home and My Tasks](https://www.notion.com/help/home-and-my-tasks), [AI Meeting Notes](https://www.notion.com/help/ai-meeting-notes).
- "Home changed from a full-page experience to a part of your sidebar." It is now sections of list rows: Upcoming events, Recents, Favorites, Agents, Teamspaces and others.
- The earlier full-page Home is shown in an [official screenshot dated May 2025](https://images.ctfassets.net/spoqsaf9291f/5NbB7pKoDLfX1McoodloU1/6f575e91c6f22b78d63845b4324ce6b4/Screenshot_2025-05-13_at_5.58.13_PM.png), which was viewed. It had a row of four page cards and an "Upcoming events" panel with a "Join and take notes" button.
- The meeting AI "identifies key points and action items". "Hover over a citation to see the snippet of your transcript."

- **Layout:** a "Meetings" sidebar with "Upcoming events" (relative time such as "In 2 min"), Today and Yesterday. The meeting page holds one AI block with Summary · Notes · Transcript tabs and a "Summarizing" status; a floating recorder pill shows a waveform and Stop.
- **Dashboard view:** a database can render as a bento of chart cards (a donut with "4 Total", a timeline, a line chart, a table), each with filter and sort in its header.
- **Chart per insight:** no for meeting notes; yes for the Dashboard view.
- **Needs you:** none visible.
- **Take for Compass:** the AI block with a status ("Summarizing") and tabs for summary vs source. Little else applies.

### 3.18 Granola (official docs only; not on Mobbin)

Sources [S]: [Granola 101](https://docs.granola.ai/help-center/getting-started/granola-101), [syncing calendars](https://docs.granola.ai/help-center/getting-started/syncing-your-calendars), [chatting with your meetings](https://docs.granola.ai/help-center/getting-more-from-your-notes/chatting-with-your-meetings), [Briefs (May 2026)](https://www.granola.ai/blog/briefs-prepare-you-for-your-next-meeting-as-you-join), [agent brief (Nov 2026)](https://www.granola.ai/blog/introducing-your-agent-brief), and the [official home screenshot](https://mintcdn.com/granola-c3940166/WYUNjk1Za7ZK9EoV/help-center/assets/hca_01JXZESY57CWM1FNEN9HPGKSMH/wFile_01K1ARYX6Q91228R6NFX48NXNG-db782622ef.png), which was viewed.

- **Layout:** the home has four sections: "Coming up", "Your notes", "Spaces and folders" and "Granola Chat".
  - "Coming up" is the dominant card. It has large serif day numbers, event rows with a colored left rule, and the live meeting marked green ("Now · 11:00–12:00") with a black "Start now" pill.
  - Notes sit below it, grouped into Today and Yesterday.
  - A floating "Continue chat" bar sits at the bottom with a "/ List recent todos" chip.
- **Hierarchy:** the time-critical block is the biggest.
- **Chart per insight:** none.
- **Needs you:** the live meeting's "Start now" button.
- **Briefs:**
  - A meeting brief is "a two-to-three bullet pointed list of what matters most".
  - "Every fact is cited."
  - Briefs "hide themselves once you've read it".
  - The agent brief: "Granola rewrites it every night, so it's fresh in the morning."
- **Take for Compass:** give the time-critical item the biggest and most saturated treatment. Keep briefs short and cited, and let read items get out of the way.

### 3.19 Arc Search and Dia

Screens [M]: [Arc Search "Browse for me" page](https://mobbin.com/screens/80c8c003-c2e5-4e20-a084-552d8cee31b0), [its summary section](https://mobbin.com/screens/a434d1d7-4229-41d4-b855-631d4e05fc4d). Dia is not on Mobbin.

- **Arc status [S]:** The Browser Company says "We've decided to sunset Arc on December 22, 2026". It also says Arc Search's "Browse for Me and other AI features turn off" on 23 November 2026 ([arc.net](https://arc.net/)). Treat Arc as a historical reference.
- **Dia Morning Brief [S]:**
  - The brief "lays it all out (calendar, inbox, key links) so you know exactly what you're walking into" ([diabrowser.com](https://www.diabrowser.com/)).
  - The [changelog](https://www.diabrowser.com/changelog) says the brief's footer "shows roughly how many items Dia read and which tools contributed" (19 Nov 2026), and "Start the day knowing which emails need a reply" (10 Sep 2026).
  - Frames from Dia's official video were viewed ([thumbnail](https://image.mux.com/AfVIo00zNCeCXbiFeHQ7RuHZUfzl3agTCOno01XBF01lRs/thumbnail.webp?time=2)). From top to bottom they show:
    - A sidebar tab, "The Tuesday Brief".
    - An editorial hero: a large yellow serif title over a fine-art painting.
    - An italic lede ("Good morning, Nadia. Four days to the brand launch, and the team is on track…").
    - "Top to-dos" with checkboxes and source-app icons.
    - "New updates" numbered 01 and 02. Each has a source tag ("Amplitude") and a one-line metric ("1,240 signups last week, up 11%…").
    - A "Your day" timeline with a "Prep me →" starburst.
    - A footer, "Made for you by Dia using your Gmail, Google Calendar, Slack…", and a Share button.
  - There are no charts.

- **Arc Search layout:** an image mosaic at the top (one large image, two small), a row of source favicons with "Read 20 web pages", a sideways row of source cards, a large blue title, emoji-led bullets, and at the end sections with icons and "Summarized for you by Arc Search".
- **Chart per insight:** no, in both Arc and Dia.
- **Take for Compass:**
  - Arc: a generated page earns trust by showing its sources first. That supports a "Sources" chip in the hero.
  - Dia is the clearest "morning brief" designed as an object: an editorial hero, a lede, numbered updates, to-dos and a footer that says what it was made from. It is text-only, and that is the gap Compass fills with one chart per item.

### 3.20 Juyo Kassandra / HotelGPT

Sources [S]: [juyo.ai/kassandra-ai](https://juyo.ai/kassandra-ai), [juyo.ai/hotelgpt](https://juyo.ai/hotelgpt) and [juyo.ai](https://juyo.ai/). Screenshots from Juyo's CDN were viewed: the [HotelGPT report card](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Hotelgpt%20%281%29-2100x1400.webp) and the [rate-move variant](https://juyo-production.ams3.cdn.digitaloceanspaces.com/Screenshot%202026-07-05%20at%2022.00.01-1920x1018.webp). Earlier notes are in [juyo_brand.md §3](../ui-refinement/juyo_brand.md).

- **Layout:** a long "report card" answer in the chat, on a dark panel (about #1F222A).
- **Hierarchy, top to bottom:**
  1. A headline sentence ("Ranked 7th or worse on 22 of 30 days — rate is the wound").
  2. A meta line ("Demo Hotel · November 2026 · vs comp set of 8 hotels").
  3. The small-caps label "THE READ" over a paragraph with money highlighted inline: red for "€36 below the comp set average every night", green for "~€90K".
  4. A row of five KPI tiles, each with an uppercase label, a big number and a colored caption: OCCUPANCY 57.6%, ADR €209, REVPAR €120, RATE RANK 6.6 avg ("7th or worse"), DAYS UNDERPRICED 26/30.
  5. A chart sub-panel.
  6. Sections with bold run-in leads.
  7. A boxed **"Bottom line"** ("The money is in the rate, not the rooms… Start with 17 November…").
- **Chart:** yes, in its own sub-panel.
  - Bars, for example "Rate gap vs comp set by day of week", with Thu–Sun in red and Mon–Wed in purple.
  - Other screenshots show a dashed comparison series, shaded event bands and a dashed "today" line (juyo_brand.md).
- **Impact:**
  - Money is colored inline.
  - KPI tiles have 1px colored outlines (orange, purple, teal or blue) with matching values.
  - A warning-triangle headline flags risky moves ("That €15 push crosses you from discount to premium — at the worst possible moment").
- **Needs you:** inside the card, as the "Bottom line" and "Two natural next steps: (1)… (2)…".
  - Juyo's site says Kassandra "hands you a form" for hard calls.
  - It also says agents "recommend the next move, and act when you're ready, with guardrails you control".
- **Proactive:** "Proactive alerts tied to your goals, so you hear about the drift before it costs you", and "Morning briefings, month-end commentary and executive summaries … exportable to PDF, PowerPoint or Word" ([kassandra-ai](https://juyo.ai/kassandra-ai)). No screenshot of a brief or alert screen was found.
- **Take for Compass:** reuse three Juyo pieces on the home:
  - Outlined KPI tiles become the Pulse.
  - A chart sub-panel with an event band and a "today" line becomes the decision card's chart.
  - The "Bottom line" box becomes the one-line "why" on each card and the closing box in the thread.

### 3.21 Other Mobbin screens worth taking from

These are not on the brief's list, but each one is the clearest example of a piece of the recommended layout.

| Screen | What it shows | Used for [P] |
|---|---|---|
| [Linktree Insights](https://mobbin.com/screens/e7d73ed0-bdd0-447e-ad29-7cd8b9a4f518) [M] | "Lifetime totals" KPI row, then 2×2 cards each with a chart or a one-sentence summary, and a suggested question chip at the bottom of every card ("How can I get more visitors to my Linktree?") that opens the AI panel | Per-card ask chip |
| [Google Ads Recommendations](https://mobbin.com/screens/d9531eb3-ef5f-403d-af27-b2265e78f457) [M] | Optimization score bar; a 2-column card grid with a View cards / View list switch; first card labelled "TOP RECOMMENDATION FOR YOU"; each card has a "New" badge, an impact chip ("+2.7%"), "Recommended because …" and a preview | Decision card: impact chip, reason line |
| [Otter home](https://mobbin.com/screens/dbcd50d0-4439-4d96-bd81-c8bc719c172b) [M] | Feed of meeting cards; the live one has a red outline, a red "LIVE" label and a "Join meeting" button; a floating "Ask Otter anything …" bar | Action card set apart by outline, label and button |
| [Fireflies home](https://mobbin.com/screens/6d457725-4850-44d2-b100-060adc93fab9) [M] | "Good Morning, Alex" on a sky gradient, three stat chips, "Personal Assistant" cards ("Daily Digest ✓ 2 meetings, 1 day ago"), floating ask bar | Greeting hero with stat chips |
| [Instacart approval](https://mobbin.com/screens/d4e4f075-e8d2-4292-be15-b0bf2031b0db) [M] | "A new order is pending approval", "You have 6 hr 14 min left to approve this order, otherwise it will be cancelled.", Approve / Reject | Deadline line on the decision card |
| [Remote pending request](https://mobbin.com/screens/eaa27ba6-12e7-4749-baf1-e558dcf1dcd7) [M] | "Pending time off · 1" card with Decline and Approve inside the card | Buttons inside the card |
| [Revolut Business approval](https://mobbin.com/screens/9a34e3c2-65fa-49e0-9a6f-5833c749d333) [M] | Dark: Approve (light pill) and Reject (dark pill) at the top; "Pending review" | Dark-mode button pair |
| [Docusign home](https://mobbin.com/screens/1be1d33a-d303-4918-84fd-5bdced4d146a) [M] | Two big count tiles: "1 Action Required", "1 Waiting for Others" | "1 needs your decision" as a stake chip |
| [Bloomberg At A Glance](https://mobbin.com/screens/4e093f04-955e-40c9-9359-d4200bc418a3) [M] | 3×2 tiles: name, value, tinted delta pill with arrow, sparkline with area fill over a dashed previous-close line | Pulse tile |
| [Stripe Today](https://mobbin.com/screens/d97159b3-dc43-46d4-87af-f0c28cbb2396) [M] | "Today" chart against a dashed yesterday line; a right rail with "Recommendations"; then "Your overview" chart cards ("Updated 4 hours ago · More details") | Rail beside the main story |
| [Google Health (Fitbit) Today](https://mobbin.com/screens/791c26f4-03f8-4280-b5bc-824ba6c1532d) [M] | 2×2 tinted KPI tiles (paged), then an AI card stamped "7:39PM" with a big headline ("You've cleared your step goal for the day"), then a floating "Ask Coach" button | Mobile: KPI block above the brief |
| [Garmin Connect home](https://mobbin.com/screens/583e6698-97c2-473a-a330-4aab0dce3a80) [M] | Dark: "Good morning, Sam", "Active Intelligence" paragraph, a linked "Stress — View your 4-week report" card | Dark hero brief |
| [Oura Meals](https://mobbin.com/screens/18337b06-cc84-450c-a387-2ce7f57bac28) [M] | Dark: a green small-caps status ("GOOD · 3 MEALS LOGGED"), a serif headline, a glowing line chart on a labelled scale | Premium dark chart styling |
| [Strava Athlete Intelligence](https://mobbin.com/screens/f6b18597-ed12-4014-98bb-7da449d3ad85) [M] | AI card with one sentence and an orange "Say More" button | Ask-more entry |
| [Crypto.com Insights](https://mobbin.com/screens/9d0f4190-2183-47ad-94b4-10e6644438ee) [M] | An "IN 4 DAYS" event card (1/8); update cards with tags ("Signal", "Price Dip"), a question headline, an explanation, and a footer row with the asset, its price and a "Trade" button | CTA in the card footer; countdown to an event |
| [Churnkey Analytics](https://mobbin.com/screens/5f76714e-953a-4edc-a49c-72bfe343c4d9) [M] | Big-number trio, then a narrative paragraph with bold figures, then the chart | Prose with emphasized numbers |
| [Searchable report](https://mobbin.com/screens/68802fa4-338e-4d58-9c23-cb63e3359b56) [M] | Linked headline sentence, a callout ("Visibility was stable, so the next cycle should focus on …"), then a chart card | "Bottom line" callout |
| [ClickUp dashboard](https://mobbin.com/screens/e37f9235-7899-474c-a6de-02f68f982ecf) [M] | An "AI Project Update" card spanning two columns and two rows beside KPI tiles | Narrative tile in a bento |
| [Arcade Insights](https://mobbin.com/screens/7bc9c360-fe3b-405c-9ee7-bdbfbdd0cbcb) [M] | KPI tiles with delta chips and a tooltip sentence; chart card titled with its takeaway ("90% of viewers played your Arcade, bravo!") | Card title = takeaway |
| [Canny Autopilot](https://mobbin.com/screens/8794989c-4116-4894-9684-2fd8f4761652) [M] | Suggestion card with "Looks good" (primary), Merge, Move, Delete; "Idea created · Undo" toast | Accept with undo |
| [Square "Review promotion"](https://mobbin.com/screens/7da1615c-0436-415b-b992-ff64a472a95f) [M] | "Why this promotion?" reasoning box above the editable details and Launch | Reason line on the decision |
| [Lightyear Lightning Updates](https://mobbin.com/screens/c1a0c5e9-d514-4a26-a778-40579dc3a58b) [M] | One-sentence AI updates on tinted cards: red tint for fallers, green for risers | Tint as sentiment (we use it only for the decision) |

---

## 4. Side by side

| Product | Layout | Chart in each insight? | Impact shown as | "Needs you" shown as | KPIs relative to insights |
|---|---|---|---|---|---|
| Fey | 2 columns: chart card, recap + news stack | No (one hero market chart) | Colored % pill inside the sentence | n/a | Slide-over watchlist |
| Perplexity Finance | Main + right rail | KPI cards yes; stories no; iOS Standouts yes | Tinted % pills, sentiment meter | n/a | Right rail + top row |
| Perplexity Discover | Wide, 3-up, wide + rail | No (photos) | Rail tiles only | n/a | Rail 2×2 sparkline tiles |
| Public | Stacked: headline, indices, sector tiles | No | Colored %, tinted tiles | Separate Inbox (list) | Under the headline |
| Apple Stocks / News | List + news sheet / hero + small cards | Stocks yes (sparkline) | Solid delta pill | n/a | Stocks: KPIs are the page |
| Google Discover | Big / compact alternation | No | n/a | n/a | Glance tiles on top |
| Mercury | Trends left, chart right, numbers on top | One shared chart | Icon + amount in text | Chip to the uncategorized items | Big numbers above |
| Monarch | Widget masonry; stepper recap | Recap steps yes | Delta chips, badges | "N days ready to review", Open review | Widgets are the KPIs |
| Copilot | Hero chart card + stacked cards | Hero yes (pace vs last month) | End-label pill, delta pill | TO REVIEW card + in-card button | Cards below the review |
| Amplitude | Bento | Tiles switch one chart | Green/red % | Anomaly marker in chart | Tiles on top of the chart |
| Mixpanel | Home: navigation; boards: bento | Boards yes | Delta chip | n/a | KPI cards on home |
| Linear | Single column (Pulse), master-detail (Inbox) | No | Health badge | Overdue, unread | n/a |
| Juyo Kassandra | Long report card in chat | Yes, in a sub-panel | Outlined KPI tiles, colored money | n/a in the card | Tile row inside the card |
| Tableau Pulse | Summary block, then an equal grid of metric cards | Yes: sparkline with dashed forecast and range band on every card | Change line colored by "Value going up is" (favorable / unfavorable / neutral) | Alerts center at the top, 24-hour badge on the card | Fused: the KPI is the card |
| Robinhood Digests | One digest on the investing home | Yes: "You" vs SPY / BTC | Arrow + % legend; "Market driver:" label | "Review and submit when ready" (Cortex) | Legend row inside the digest |
| Ramp | Task feed + modules + right sidebar | No (figures) | Green "Potential Savings" figure, "New" tag | Tasks first; ⊗ / ✓ on each savings card | Right-hand sidebar |
| Granola | "Coming up" card + notes by day + chat bar | No | n/a | "Start now" on the live meeting | n/a |
| Dia Morning Brief | Editorial page: hero, lede, to-dos, numbered updates, day timeline | No | One-line metric per update | "Top to-dos" | Inline in updates |
| Webull Vega | Unverified | Unverified (illustration has none) | Verdict chips ("Beat expectations") | Unverified | Unverified |

---

## 5. Recommendation: "brief hero + chart cards + Pulse rail"

**In one line:** a one-screen briefing.
- The hero says what changed and what is at stake.
- Three cards each prove their point with one small chart.
- The one decision is the only orange object on the page.
- The four Pulse KPIs sit beside the story as sparkline tiles.

Nothing on the page is a list row.

### 5.1 Desktop (content width ≥ 1280 px)

```text
+---------------------------------------------------------------+-------------------------------------+
| HERO  (no card chrome: ink + soft purple glow)                | PULSE  (rail, sticky)               |
| FRI 20 NOV · MORNING BRIEF · GENERATED 06:00 · [Sources]      | vs same time last year              |
|                                                               | +---------------+ +---------------+ |
| December weekends are soft.                                   | | Occupancy     | | ADR           | |
| The tech summit at the end of November is not.                | | 44.8%   Δ LY  | | €142    Δ LY  | |
|                                                               | | ~~~~~ - - - - | | ~~~~~ - - - - | |
| [▼ €5.8k at risk] [▲ €3.1k upside] [● 1 needs your decision]  | +---------------+ +---------------+ |
| +-----------------------------------------------------------+ | | RevPAR        | | Revenue       | |
| | Ask about December weekends, the summit, channels…    [→] | | | €64     Δ LY  | | €406k   Δ LY  | |
| +-----------------------------------------------------------+ | | ~~~~~ - - - - | | ~~~~~ - - - - | |
|                                                               | +---------------+ +---------------+ |
+---------------------------------------------------------------+ Updated 06:00 · Open dashboard →    |
| CARD 1  (wide: text left ~55%, chart right ~45%)              |                                     |
| 1 · PACE                                         [▼ −€4.6k]   |                                     |
| The weekend of 11–12 Dec is 17 pts       +----------------+   |                                     |
| behind last year.                        | pace vs STLY   |   |                                     |
| Why: one sentence.                       | line, −17 pts  |   |                                     |
| [Ask about this]      Open thread →      +----------------+   |                                     |
+-------------------------------+-------------------------------+                                     |
| CARD 2 (orange outline)       | CARD 3                        |                                     |
| 2 · NEEDS YOUR DECISION       | 3 · CHANNELS                  |                                     |
|                  [▲ +€3.1k]   |                  [▼ −€1.2k]   |                                     |
| Raise BAR for 27–28 Nov.      | Booking.com took 41% of       |                                     |
| +-------------------------+   | pickup.                       |                                     |
| | pickup bars, event band |   | +-------------------------+   |                                     |
| +-------------------------+   | | 100% channel share bar  |   |                                     |
| BAR €now → €proposed          | +-------------------------+   |                                     |
| 7 days out                    | Why: one sentence.            |                                     |
| [Review change] [Not now]     | Open thread →                 |                                     |
+-------------------------------+-------------------------------+                                     |
| ✓ 1 resolved since yesterday · Show                           |                                     |
+---------------------------------------------------------------+-------------------------------------+
```

| Region | Grid [P] | Size [P] | Pattern source |
|---|---|---|---|
| Main column | 8 of 12 columns | n/a | Perplexity Finance and Discover main + rail [M]; Stripe "Today" + rail [M] |
| Pulse rail | 4 of 12 columns, sticky (`top: 24px`) | 2×2 tiles, each about 170 × 132 px | Perplexity Discover "Market Outlook" 2×2 [M]; Bloomberg "At A Glance" [M]; Monarch "Savings Found" rail of totals [S] |
| Hero | Full main width. No border; sits on ink with a soft purple radial glow | About 260 px tall | Tableau's summary block at the top of the home page [S]; Dia's editorial hero [S]; Fey's glowing recap card [M]; Juyo's purple radial glows ([juyo_brand.md](../ui-refinement/juyo_brand.md) §1) |
| Card 1 | Full main width | About 200 px; text 55%, chart 45% | Perplexity Discover hero story with the image on the right [M]; Robinhood Digest headline + chart [S] |
| Cards 2 and 3 | Half main width each, equal height | About 320 px; chart 112 px | Google Ads 2-column recommendation cards [M]; Linktree 2×2 insight cards [M] |
| Resolved | Full main width | One 44 px line | Monarch "Show 1 completed" [M] |
| Gutters | 24 px desktop, 16 px mobile | n/a | [../ui-refinement/mobile_and_boards.md](../ui-refinement/mobile_and_boards.md) |

### 5.2 Hero brief

Top to bottom:
1. **Eyebrow.** 12 px, uppercase, +0.06em tracking, secondary text: "Fri 20 Nov · Morning brief · Generated 06:00". It ends in a **Sources** chip that lists the data feeds the brief read. Precedents:
   - Robinhood "Updated 4 PM" [S].
   - Public "Generated by AI at 1:35 PM ✦" [S] and "Generated by Agents at 11:22 AM" [M].
   - Dia's footer "Made for you by Dia using …" [S].
   - Perplexity "53 sources" [M].
2. **Headline.** Inter 600, 32/38 on desktop and 24/30 on mobile, −0.01em, white, at most two lines with one clause per line.
   - Keep color out of the headline [P]. The chips below carry the color, so the meaning never depends on hue.
   - Public, Robinhood and Fitbit all make the AI sentence the largest type on the screen [M][S].
3. **Stake chips.** `▼ €5.8k at risk` (red), `▲ €3.1k upside` (green), `● 1 needs your decision` (orange).
   - The orange chip is a link: it scrolls to card 2 and moves keyboard focus there.
   - This is Tableau's tally line ("6 favorably, 2 unfavorably…") [S] turned into money, combined with Docusign's "1 Action Required" tile [M].
4. **Ask bar.** 48 px tall, full hero width. The placeholder names today's topics, and Enter starts a new thread.
   - Up to three suggested questions sit underneath as chips.
   - Precedents: Tableau's suggested-question chips [S], Monarch's ask box with suggestion chips [S], Linktree's per-card questions [M].

### 5.3 The insight card (cards 1 and 3)

Top to bottom:
1. **Header row.** Rank numeral and a small-caps category on the left ("1 · PACE"); the money chip on the right.
   - The chip is signed, has an arrow and uses tabular numerals.
   - It is colored by business meaning, as in Tableau: "green for favorable, and red for unfavorable" [S].
2. **Title = the takeaway sentence.** 17 px / 600, at most two lines: "The weekend of 11–12 Dec is 17 pts behind last year." Precedents:
   - Linear: "Pulse entries now lead with a one-sentence takeaway" [S].
   - Arcade titles its chart with the takeaway [M].
   - Rule 8 in [mobile_and_boards.md](../ui-refinement/mobile_and_boards.md).
3. **Mini chart.** One chart, at most three text labels, no gridlines, today marked, the comparison dashed. See §5.5.
4. **Why line.** One sentence in secondary text. Precedents:
   - Juyo's "Bottom line" box [S].
   - Robinhood's "Market driver:" label [S].
   - Square's "Why this promotion?" [M].
   - Ramp: "Every action comes with a rationale" [S].
5. **Footer.**
   - `Ask about this` opens the thread with this card's context, as in Linktree [M] and Mercury ("click into any of them to ask our chatbot") [S].
   - `Open thread →`: the whole card is the link.
   - ⋯ holds Snooze until tomorrow, Not useful and Copy link, like Tableau's "Mute from Insights Summary" and thumbs [S] and Google Discover's More menu [S].

### 5.4 The decision card (card 2)

It is the same size as card 3, so the money ranking stays honest. It stands out through treatment, not size [P].

- **Treatment:**
  - A 1 px orange border (#FE7637) on a tinted surface: #161C22 plus 8% orange, which is #292324.
  - The label "NEEDS YOUR DECISION" in orange.
  - No other orange on the page except the hero chip that points here.
  - Precedents: Otter's live card (red outline, "LIVE" label, button) [M], Juyo's orange-outlined KPI tiles [S] and Kassandra's warning headline on rate moves [S].
- **Content:**
  - Header: "2 · NEEDS YOUR DECISION" and `▲ +€3.1k` in green.
  - Title: "Raise BAR for 27–28 Nov."
  - The chart (§5.5).
  - A before → after row: "BAR €now → €proposed".
  - A deadline line: "7 days out". Precedents: Instacart's "6 hr 14 min left to approve" [M] and Crypto.com's "IN 4 DAYS" [M].
  - Two buttons inside the card.
- **Buttons:** primary **Review change** (orange fill with ink #0D1117 text) and secondary **Not now** (ghost). In-card approve and dismiss is the norm:
  - Copilot DISMISS / APPROVE [S]
  - Ramp ⊗ / ✓ [S]
  - Remote Decline / Approve [M]
  - Revolut Business Approve / Reject [M]
  - Monarch "Savings Found": one CTA plus × [S]
- **Review change** opens the approval surface already specified in [pattern_canon.md](../ai-ux/pattern_canon.md) and in rule 10 of [mobile_and_boards.md](../ui-refinement/mobile_and_boards.md): before → after, a named action, Edit, Deny, and a receipt with Undo. Robinhood's Cortex also stops at "Review and submit when ready" [S].
- **After approval:** the card folds into the resolved line with a receipt ("Approved 08:14 · Undo") [P]. Precedents: Canny's "Idea created · Undo" [M] and Linear's undo toast [M].
- **Why it keeps a chart:** Ramp, Monarch and Copilot action cards show a money figure and buttons with no chart (§3.10–3.12). We keep a small chart because the evidence is the reason to approve. Juyo's own rate-move answer does the same: a bar chart of "YOU (now)" against "YOU (+€15)" under a warning headline [S].

### 5.5 One chart per card

| Card | Chart | What it shows | Why this form |
|---|---|---|---|
| 1 · Pace, −€4.6k | Line: occupancy on the books for Fri 11 and Sat 12 Dec by days before arrival. This year solid blue (#5B8DEB), same time last year dashed purple (#996AD5). End labels at today, with a bracket "−17 pts". | The gap and how fast it opened | Copilot's pace line with an end label [M][S]; Monarch's "This month vs. last month" [M]; Robinhood's "You" vs SPY [S]; Juyo's blue = current, purple = LY ([juyo_brand.md](../ui-refinement/juyo_brand.md) §3) |
| 2 · Decision, +€3.1k | Bars: daily pickup (or demand, whichever series the recommendation is computed from) for stay dates around the summit. A shaded event band over 27–28 Nov labelled "Tech summit", and a dashed "today" line. The BAR before → after row sits below. | Why now, and why these two nights | Kassandra's event bands and "today" line ([juyo_brand.md](../ui-refinement/juyo_brand.md) §3); Juyo's rate-move chart [S] |
| 3 · Channels, −€1.2k | One 100% stacked bar of pickup by channel. Booking.com is highlighted and labelled "41%"; other channels are muted grey. Optionally, a tick for Booking.com's share at the same time last year. | Concentration in one channel | Tableau's "Concentrated Contribution Alert" ("Risky Monopoly") insight type [S]; Mercury's share bars [M] |
| Resolved | None | n/a | n/a |

Chart rules [P], drawn from the sources above:
- **One chart per card.** No legend: label the lines directly. At most three text labels.
- **Line styles:** the comparison is always dashed; this year is always solid blue.
- **Marks:** mark today, and shade the one region the sentence talks about.
- **Heights:** 140 px in card 1, 112 px in cards 2–3, 96 px on phones. Pulse sparklines are 40 px.
- **Text alternative:** the chart illustrates the title, so the title doubles as the chart's text alternative.

### 5.6 Pulse rail

- **Tiles:** 2×2. Each tile has a label (12 px, secondary), a value (24 px, tabular numerals), a delta vs STLY with sign and arrow, and a 40 px sparkline with a dashed STLY line.
- **Click:** the whole tile is a button that opens the metric's drivers in a thread. Precedents: Tableau's "Top Drivers" and "Top Detractors" insight types [S], and Amplitude's KPI tiles that switch the chart [M].
- **Caption** under the tiles: "Updated 06:00 · Open dashboard →".
- **Sources:**
  - Perplexity Discover "Market Outlook" [M]
  - Bloomberg "At A Glance" [M]
  - Tableau's metric card (big number, change line, sparkline) [S]
  - Juyo's KPI tiles [S]
  - Apple Stocks' "color-coded spark-lines" [S]

### 5.7 Resolved

- **Collapsed:** one line, "✓ 1 resolved since yesterday · Show".
- **Expanded:** a muted card with no chart, saying what was done and when.
- **Precedents:** Monarch's "Show 1 completed" [M]. Granola's briefs "hide themselves once you've read it" [S].

### 5.8 Mobile (< 768 px) and tablet

```text
+------------------------------------------+
| FRI 20 NOV · 06:00 · [Sources]           |
|                                          |
| December weekends are soft. The tech     |
| summit at the end of November is not.    |
|                                          |
| [▼ €5.8k at risk] [▲ €3.1k upside]       |
| [● 1 needs your decision]                |
|                                          |
| +-----------------+ +----------------+   |
| | Occ 44.8%   Δ   | | ADR €142   Δ   |   |
| | ~~~~~ - - - -   | | ~~~~~ - - - -  |   |
| +-----------------+ +----------------+   |
| | RevPAR €64  Δ   | | Rev €406k  Δ   |   |
| | ~~~~~ - - - -   | | ~~~~~ - - - -  |   |
| +-----------------+ +----------------+   |
|                                          |
| +--------------------------------------+ |
| | 1 · PACE                 [▼ −€4.6k]  | |
| | The weekend of 11–12 Dec is          | |
| | 17 pts behind last year.             | |
| | [ pace vs STLY chart, 96 px ]        | |
| | Ask about this     Open thread →     | |
| +--------------------------------------+ |
|                                          |
| +======================================+ |
| ‖ 2 · NEEDS YOUR DECISION  [▲ +€3.1k]  ‖ |
| ‖ Raise BAR for 27–28 Nov.             ‖ |
| ‖ [ pickup + event band, 96 px ]       ‖ |
| ‖ BAR €now → €proposed · 7 days out    ‖ |
| ‖ [ Review change ]   [ Not now ]      ‖ |
| +======================================+ |
|                                          |
| +--------------------------------------+ |
| | 3 · CHANNELS             [▼ −€1.2k]  | |
| | Booking.com took 41% of pickup.      | |
| | [ 100% channel share bar ]           | |
| | Ask about this     Open thread →     | |
| +--------------------------------------+ |
|                                          |
| ✓ 1 resolved since yesterday · Show      |
+------------------------------------------+
| [ Ask about your hotel…          (→) ]   |
| [ tab bar, 3–5 labelled destinations ]   |
+------------------------------------------+
```

- **Order:** eyebrow, headline (24/30), stake chips (wrapping), Pulse as a 2×2 block, card 1, the decision card, card 3, the resolved line. The ask bar is docked above the tab bar.
- **Pulse goes above the cards** on phones, as a compact 2×2 block, because a rail has nothing to sit beside. Precedents:
  - Fitbit puts 2×2 tiles above its AI card [M].
  - Public puts index rows directly under its AI headline [M].
  - Robinhood's Digest lives on the investing home screen [S].
- **Cards:** full width, with the chart under the title at 96 px.
- **Buttons:** at least 44 px tall with 8 px gaps (rule 4 in [mobile_and_boards.md](../ui-refinement/mobile_and_boards.md)). Review change opens a bottom sheet (rule 10).
- **Ask bar:** docked at the bottom (rule 7). Precedents:
  - Perplexity and Public on iOS [M].
  - Granola: "Find Granola Chat at the bottom of your screen" [S].
  - Copilot's "Ask Copilot" bar [S].
- **No carousel:** with three items, a swipe hides two of them [P].
- **Tablet (768–1279 px):**
  - The rail becomes a 4-across strip under the hero, like Perplexity Finance's "Top Assets" row [M] and Linktree's "Lifetime totals" [M].
  - Card 1 is full width; cards 2 and 3 sit side by side.

### 5.9 From card to thread

- **Hit areas:** the card title is the link, and the whole card is its hit area. "Ask about this", "Review change" and ⋯ are separate buttons layered on top [P].
- **The thread opens with the same chart** as its first message, followed by the why, the evidence and follow-up chips. Precedents:
  - Amplitude renders the chart card inside the thread with definition chips [M].
  - Tableau's agent briefs have carried "an inline visualization" since March 2026 [S].
  - Copilot: "charts now appear right in conversation" [S].
  - Square's thread ends in follow-up chips [M].
- **Back** returns to the home and keeps the scroll position.

### 5.10 Accessibility and color checks

Contrast was computed with the WCAG 2.x relative-luminance formula.

| Pair | Ratio | Rule |
|---|---|---|
| Orange #FE7637 on #161C22 / #1E2429 / #0D1117 | 6.43 / 5.87 / 7.08 | OK for small text, borders and chart lines |
| Orange text on the decision tint #292324 | 5.78 | OK for the "NEEDS YOUR DECISION" label |
| Ink #0D1117 on an orange button | 7.08 | Use this for the primary button label |
| White on orange | 2.67 | **Fails.** Never put white text on orange |
| Purple #996AD5 on #161C22 / #1E2429 | 4.40 / 4.01 | **Fails 4.5:1 for small text.** Use purple only for chart lines (≥ 3:1) and large text |
| Blue #5B8DEB on #161C22 / #1E2429 | 5.28 / 4.82 | OK |

- **Decision state:** shown by the border plus a text label, never by color alone ([WCAG 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)).
- **Deltas:** every delta has a sign and an arrow, because red and green are hard to tell apart for color-blind readers ([color_type.md](../ui-refinement/color_type.md) TL;DR point 2).
- **Chart lines:** they need at least 3:1 against the card ([WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)). Blue, purple and orange all pass on #161C22.
- **Structure:** each card is an `<article>` with a heading. Rank and category are text, not only position.
- **Motion:** respect `prefers-reduced-motion` for any chart draw-in.

### 5.11 Why this layout

| Decision | Evidence |
|---|---|
| The summary goes on top, not a hero insight | Tableau puts the insight summary at the top of the home page [S]. Dia, Linear's Daily pulse, Robinhood Digests and Public all lead with an AI sentence [S][M]. |
| Every insight carries one chart with a dashed comparison | Tableau cards (sparkline plus dashed forecast) [S]; Robinhood Digest ("You" vs SPY) [S]; Copilot and Monarch pace charts [M]; Perplexity "Prev close" [M] |
| The first card is bigger than the rest | Apple News, Google Discover, Perplexity Discover, Google Ads "TOP RECOMMENDATION FOR YOU" [M] |
| The decision is a distinct card with buttons and a deadline inside it | Copilot, Ramp and Monarch approve/dismiss cards [S]; Otter's LIVE card, Instacart's deadline, Remote and Revolut approvals [M] |
| KPIs sit in a rail of sparkline tiles | Perplexity Finance and Discover rails [M]; Monarch's Savings rail [S]; Stripe's rail [M] |
| Each card has its own ask | Linktree [M]; Mercury ("click into any of them to ask our chatbot") [S]; Mixpanel's "Chat with Mixpanel Agent" alert card [S] |
| Resolved items collapse | Monarch [M]; Granola [S] |
| The visual language comes from Juyo | Kassandra's outlined KPI tiles, event-band charts and "Bottom line" box [S] |

### 5.12 Alternatives considered and rejected

| Alternative | Seen in | Why not |
|---|---|---|
| Ranked text rows (an inbox) | Linear Inbox [M], Public Inbox [M], Notion's sidebar Home [S] | The user rejected it. Rows hide magnitude and read like notifications. |
| Equal grid of metric cards | Tableau Pulse [S], Stripe overview [M], Mixpanel boards [M] | Good for following many metrics. With three ranked items it hides the ranking, and it duplicates the dashboard Compass already has. |
| Carousel of insight cards | Lightyear [M], Crypto.com [M], Perplexity Finance on iOS [M], Public "Key moments" [S] | It hides two of the three items behind a swipe. |
| Stories or stepper recap | Monarch's review [M], Copilot's slides you can share [S] | Right for a weekly ritual, too slow for a daily scan. Worth keeping in mind for a weekly recap. |
| Accordion summary | Perplexity "Market Summary" [M] | Collapsed rows are a list again. |
| One big chart and a news column | Fey [M] | Works for one market. A hotel brief has three different stories, and each needs its own chart. |

---

## 6. Build notes (Angular + Tailwind)

Follow the project's Angular rules: standalone components, `input()` / `output()`, `computed()`, native control flow, `class` bindings, and no `ngClass`.

| Component | Inputs / outputs | Notes |
|---|---|---|
| `BriefHero` | `brief` (date, generatedAt, headline, stakes, sources) | Contains `AskBar`. The decision stake chip links to the decision card and moves focus to it. |
| `InsightCard` | `insight` (rank, kind, title, why, impact, chart, threadId); `variant: 'wide' \| 'default'`; outputs `ask`, `snooze`, `dismiss` | The chart goes in a projected slot. |
| `DecisionCard` | The `InsightCard` inputs plus `before`, `after`, `daysOut`; outputs `review`, `notNow` | The only place the orange treatment lives. |
| `MiniChart` | The same declarative chart spec the thread uses | Three kinds: `paceLine`, `eventBars`, `shareBar`. |
| `PulseTile` | label, value, delta, series, comparison | A button that opens the metric's drivers. |
| `ResolvedLine` | `items` | Collapsed by default. |

A single grid gives the right order on every breakpoint: hero, then Pulse, then cards on phones; hero and cards on the left with Pulse on the right on desktop.

```html
<div class="mx-auto grid max-w-[1280px] gap-4 px-4 lg:grid-cols-12 lg:gap-6 lg:px-6">
  <app-brief-hero class="lg:col-span-8" />
  <app-pulse-grid class="self-start lg:col-span-4 lg:row-span-2 lg:sticky lg:top-6" />
  <section class="grid gap-4 md:grid-cols-2 lg:col-span-8 lg:gap-6" aria-label="Today's items">
    <app-insight-card class="md:col-span-2" variant="wide" />
    <app-decision-card />  <!-- border border-[#FE7637] bg-[#292324] -->
    <app-insight-card />
    <app-resolved-line class="md:col-span-2" />
  </section>
</div>
```

Tokens to add: `--decision: #FE7637`, `--decision-surface: #292324`, `--on-decision: #0D1117`. Use `tabular-nums` on every number.

---

## 7. Gaps and caveats

- **Not on Mobbin:** Robinhood, Ramp, Webull, Granola, Dia, Tableau Pulse and Fey on iOS. Their anatomy comes from official pages and official images.
- **Fey is no longer a live product.** Wealthsimple acquired it on 27 Aug 2025, and fey.com now says "Sign-ups to Fey are closed" ([Wealthsimple newsroom](https://newsroom.wealthsimple.com/wealthsimple-acquires-investment-research-platform-fey)). Its Mobbin screens are a design reference only.
- **Arc's AI features turn off on 23 Nov 2026** ([arc.net](https://arc.net/)).
- **No analytics product we checked documents a decision card in its brief.** That covers Tableau, Amplitude, Mixpanel, Linear and Juyo. The Compass decision card is assembled from fintech approval and suggestion cards (Copilot, Ramp, Monarch, Instacart, Remote, Revolut) and Google Ads recommendations. Each part has a precedent; the combination is ours.
- **Unverified:**
  - Webull's in-app placement and card sizes.
  - Amplitude's Agent Inbox UI.
  - Saved views on Mercury's Insights page (the help page returned 403).
  - Whether Monarch's recap widget can be hidden.
- **Numbers:** this file uses only the numbers in the brief, two sums (€5.8k and €3.1k) and the RevPAR check. The BAR values, the deadline wording and the chart series are placeholders until the data layer provides them.
