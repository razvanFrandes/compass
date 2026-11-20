# AI UX in analytics / BI products (state as of Nov 2026)

Purpose: reuse proven AI-UX patterns for Compass (hotel analytics; Juyo take-home) instead of inventing new ones.
Compass principles this is checked against: (P1) model never computes numbers, SQL does; (P2) evidence one click away; (P3) AI output uses the same declarative chart spec as manual building; (P4) briefing brings the answer to the user; (P5) agents earn trust gradually (suggest → approve → act).

Method and caveats
- Researched 2026-11-20 via web search + fetch of official docs, launch blogs, press, and review sites. Every claim has a URL next to it.
- Page text came through a summarizing fetch tool. **Exact UI labels in quotes should be re-checked on the source before being copied into Compass copy.**
- `[UNVERIFIED]` = not confirmed in a primary source. `(3rd-party)` = blog, review site, or press, not vendor docs.
- Little community feedback exists for the newest agent features. Review sentiment is thin and labelled as such.

## 0. Things that changed recently (read first)

| Change | Source |
|---|---|
| **Snowflake Intelligence → "Snowflake CoWork"** (Cortex Code → "CoCo"), Summit, June 2–3 2026. Existing users migrated automatically. | https://itbrief.com.au/story/snowflake-renames-ai-tools-amid-broader-platform-push , https://atlan.com/know/snowflake/snowflake-cowork/ |
| **Power BI standalone Copilot** (Home, mobile, Teams, app-scoped) being removed early/mid Jan 2027. "Microsoft 365 Copilot in Power BI and Fabric (preview)" is on by default from Dec 8 2026. | https://mc.merill.net/message/MC1546429 , https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-chat-with-data-standalone |
| **Power BI Q&A** removed Feb 2027 (verified answers replace it) | https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-prepare-data-ai-verified-answers |
| Tableau "Enhanced Q&A / Discover" renamed **"Tableau Agent in Pulse"** | https://docs.salesforce.com/tableau/current/en-us/online/pulse_intro.md |
| ThoughtSpot "reference questions" are now **legacy memory sources** (26.8) | https://docs.thoughtspot.com/cloud/26.8.0.cl/spotter-reference-questions |
| **Mixpanel Spark → "Mixpanel Agent"** (June 2026). "Mixpanel AI" with KPI-monitoring / RCA / experiment agents went GA in May 2026. | https://mixpanel.com/blog/spark-bringing-generative-ai-to-mixpanel/ , https://mrem.bernama.com/viewsm.php?idm=54274 |
| Amplitude "Ask Amplitude" folded into the **Global Agent** (Mar 2026) | https://www.amplitude.com/blog/amplitude-ai-agents-launch |
| Sigma "Ask Sigma" → **Sigma Assistant** (beta); Omni "Blobby" → **Omni Agent**; Databricks "Genie spaces" → **Genie Agents**, plus **Genie One** | see product sections |
| **Duetto acquired FLYR Hospitality** (Oct 8 2026) | https://www.hospitalitynet.org/news/4134812/duetto-acquires-flyr-hospitality-to-expand-its-platform-and-accelerate-innovation-for-hoteliers |
| **Lighthouse launched "Ernest"**, an AI teammate (beta June 2026, now GA) | https://skift.com/2026/06/09/lighthouse-ernest-ai-hotel-commercial-tech/ , https://www.hospitalitynet.org/news/4134784/ernest-lighthouses-ai-teammate-for-hotel-commercial-teams-is-now-generally-available |
| Julius **Notebooks** (June 2025) reportedly sunset; Julius refocused on chat `[UNVERIFIED from Julius itself]` | https://julius.ai/articles/introducing-notebooks , https://latent.space/wiki/julius-ai-5188e45c/ |

---

## 1. Product-by-product

### 1.1 Juyo (juyo.ai) — the target company
Overall structure: **Ask (Chat) → Analyze (Canvas) → Act (Agents)**. https://juyo.ai
- **Kassandra answer depths** (verbatim from the page, fetched 2026-11-20). https://juyo.ai/kassandra-ai
  - **Quick:** "Sub-second answer from a trusted source. The same number every time."
  - **Thinker:** "reasons across 2 or 3 sources, surfaces what you didn't think to check".
  - **Strategic:** "A council of agents argues every angle: pricing optimism, demand realism, risk caution."
  - For complex decisions it reportedly "hands you a form" to collect inputs (per research agent; re-check).
- **Evidence:** "Ask in plain language, get the answer and the reasoning." How the reasoning is displayed is not documented. https://juyo.ai/kassandra-ai
- **Why:** "Driver decomposition that auto-answers the next question behind every number." HotelGPT returns "the chart, the cause, and the recommended next move". https://juyo.ai/kassandra-ai , https://www.hospitalitynet.org/ai/snapshot/juyo-pro
- **Canvas:** "Kassandra AI builds your dashboards and recommends the ones you're missing." Supports zoom, cross-filter and drill-down. https://juyo.ai/kassandra-ai , https://juyo.ai
- **Proactive:** "Proactive alerts tied to your goals, so you hear about the drift before it costs you." Pro includes "smart alerts". https://juyo.ai/kassandra-ai , https://www.hospitalitynet.org/ai/snapshot/juyo-pro
- **Agents:** "Deploy autonomous agents that monitor, recommend and act, inside the bounds you set." https://juyo.ai/kassandra-ai
- **Name check:** "Agent Studio" does **not** appear on juyo.ai `[UNVERIFIED name]`. Search only finds Canary Technologies' unrelated "Hospitality AI Agent Studio". Use Juyo's own wording ("agents… inside the bounds you set") unless the brief names it.
- **Pricing:** HotelGPT tier billed per question. https://juyo.ai
- **Trust:** A Juyo executive's opinion piece argues for scoring past recommendations against outcomes. No product feature is documented `[UNVERIFIED]`.
- **Mobile:** not mentioned.
- **Takeaway for Compass:** Juyo's own language already matches P1–P5. "Same number every time" is P1; "inside the bounds you set" is P5; "chart + cause + next move" is P4 plus driver decomposition. Compass should show these working concretely, because Juyo's public pages describe them only in marketing terms.

### 1.2 Tableau Pulse + Tableau Agent (+ Tableau Next)
- **Ask**
  - Entry points: "Ask" on a metric page, under a group of followed metrics, on the Following tab, and a question embedded in the email digest. https://docs.salesforce.com/tableau/current/en-us/online/pulse_ask_discover_qa.md
  - Suggested initial and follow-up questions, plus a free-text box at the bottom.
  - Scope is deliberately narrow, to Pulse **metrics** only (no arbitrary columns). Supported question types: period-over-period, top/bottom contributors, drivers, outliers, goals, "Compare APAC vs EMEA".
- **Evidence**
  - The answer is an "insight brief": text plus charts. Each insight ends with a **citation link** to its source metric and chart, followed by a **"Metric Sources"** list. Same source as above.
  - Architecture: deterministic statistics first produce "facts" treated as ground truth, then the LLM writes the summary grounded in those facts. This is exactly P1. https://docs.salesforce.com/tableau/current/en-us/online/pulse_insights_platform_insight_types.md
  - No SQL view is shown.
- **Insight-type catalogue** (directly reusable as a taxonomy). Same source as above.
  - Period over Period Change, Current Trend, Trend Change Alert.
  - Unexpected Values (blue shaded expected range).
  - Forecast, with a confidence range shown "only when Pulse is confident".
  - Goal/Threshold, Pace to Goal.
  - Top Drivers / Top Detractors, Top/Bottom Contributors.
  - Concentrated Contribution ("Risky Monopoly", ≥50%).
  - Correlated Metrics, Record-level Outliers.
- **Proactive**
  - You *follow* metrics and get a digest by Slack, email or Teams. The digest leads with the home-page summary; email uses a compact layout plus a starter question; Slack links unfurl; off-cycle alerts arrive as separate messages. https://docs.salesforce.com/tableau/current/en-us/online/pulse_intro.md
  - Alerts are checked every 24 h. https://help.tableau.com/current/online/en-us/pulse_alerts.htm
- **Why:** Top Drivers/Detractors and a **"Breakdown" tab** of contributors.
- **Trust:** "Certified" toggle on metric definitions. Docs say plainly "Hallucinations are possible". Tableau Semantics holds "verified Q&A". https://www.tableau.com/blog/top-10-announcements-keynote-tc25
- **Pinning:** The "Pulse object" places a metric on a dashboard and responds to dashboard filters. Pulse charts themselves are fixed, not editable `[UNVERIFIED that they cannot be edited]`.
- **Authoring agent:** opened from the Agent icon "next to Show Me" or from the Calculation editor. Offers "Jumpstart your analysis" questions, builds views and explains calculations. https://help.tableau.com/current/pro/desktop/en-us/desktop_einstein.htm
- **Tableau Next**
  - **Concierge:** a right-hand chat pane. Answers include "how the AI reasoned" and the source data. https://trailhead.salesforce.com/content/learn/modules/agentforce-for-analytics-in-tableau-next-quick-look/learn-about-agentforce-for-analytics-in-tableau-next
  - **Inspector** (beta, Oct 2025): daily monitors on threshold, % change or expected range, delivered to desktop, mobile or Slack, with "AI-driven insights into what drove the change". https://www.tableau.com/2025-2-october-features
- **Mobile:** push notification on unfavorable change, and a **home-screen widget** of favorite metrics. https://docs.salesforce.com/tableau/current/en-us/online/pulse_intro.md
- **Criticism (3rd-party)**
  - "just a toy with lots of marketing", though it "looks quite pretty on a mobile" (r/tableau mirror). https://lr.in.psf.lt/r/tableau/comments/1e6y3k1/pulse_is_just_marketing
  - Cannot replace long-range dashboards. https://interworks.com/blog/2024/04/15/exploring-tableau-pulse-to-replace-traditional-dashboards/
  - A supplement, not a replacement. https://thedataschool.co.uk/stephanie-pichardo/tableau-pulse-explained-what-it-is-who-its-for-and-where-it-falls-short/

### 1.3 Power BI Copilot
- **Ask**
  - A Copilot pane on reports, for viewers and authors, with session follow-ups. https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-ask-data-question
  - Explicitly **not supported:** "why" questions, forecasting, anomaly detection, key influencers. Report slicers are not applied to answers.
- **Evidence**
  - An expandable **"How Copilot arrived at this"**: fields, measures and filters used, "Data used" links, and the ad hoc **DAX** with a link into DAX query view.
  - With Fabric IQ: step-by-step reasoning plus a **Visual / Table / DAX query** picker. Same source as above.
- **Narrative visual:** footnotes point to specific visuals, and hovering a footnote highlights that visual on the canvas. The text body is not editable by hand, only by prompt. https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-create-narrative
- **Charts and pin:** "Add to page" (authors only) drops a normal report visual onto the page. This is P3 in practice.
- **Trust**
  - **Verified answers** are author-approved visuals with 5–7 trigger phrases and up to 3 user-adjustable filters. https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-prepare-data-ai-verified-answers
    - On screen the user sees a **Verified checkmark**, the **matched trigger phrase**, an AI summary, and "How Copilot arrived at this".
  - **AI data schema** limits what the AI sees; **AI instructions** add business rules. https://learn.microsoft.com/power-bi/create-reports/copilot-prepare-data-ai
  - A model not "Approved for Copilot" triggers a **"low quality" warning** and a click-through **View answer** button. https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-chat-with-data-standalone
- **Proactive:** not Copilot itself. "Set alert" on a visual creates a Fabric Activator rule (F64/Premium). https://learn.microsoft.com/en-us/power-bi/explore-reports/business-user-set-alerts
- **Why:** only the non-AI "Explain the increase/decrease". https://learn.microsoft.com/power-bi/consumer/end-user-analyze-visuals
- **Mobile** (retiring with standalone Copilot). https://learn.microsoft.com/en-us/power-bi/consumer/mobile/mobile-standalone-copilot
  - Copilot sits in the bottom nav; voice input on iOS.
  - Answer anatomy: text plus a **static visual screenshot; tap opens a live interactive drawer**; a References drawer; DAX; copy; thumbs up/down.
- **Criticism (3rd-party)**
  - Plausible-looking wrong answers. https://pub.towardsai.net/i-tested-power-bi-copilot-for-30-days-on-real-client-projects-4fd68f713c94
  - Works only on best-practice models. https://community.fabric.microsoft.com/t5/Service/Copilot-theory-versus-practice/m-p/5283765
  - Capacity cost; "a solution looking for a problem" (SQLBI). https://www.sqlbi.com/nl/t/2391/0/MTc0MjI=

### 1.4 ThoughtSpot Spotter (+ SpotIQ, Monitor, AI Highlights)
- **Ask**
  - Home question box, the Spotter page, or a Spotter button when hovering a Liveboard viz. https://docs.thoughtspot.com/cloud/latest/spotter-getting-started
  - Follow-ups **highlight which search tokens changed**; **Reset** starts fresh.
  - **Search mode (speed)** vs **Deep analysis mode (depth)**. Deep analysis drafts an **editable plan with hypotheses**, then writes a report. https://docs.thoughtspot.com/cloud/latest/spotter-research-mode
  - Cross-model: when several models fit, it lists candidate models with **% confidence and a reason** for each. https://docs.thoughtspot.com/cloud/latest/spotter-capabilities
- **Evidence:** search tokens are shown with each answer; hovering a formula shows its calculation. No SQL view is documented `[UNVERIFIED]`.
- **Edit:** the result is a regular Answer.
  - **Edit** opens Edit Answer to add/remove tokens.
  - Quick edits change aggregation, date bucket, or rolling vs fixed date.
  - Table/chart toggle; **Done editing / Discard changes**.
- **Pin**
  - Save to Answers, or Pin to Liveboard. https://docs.thoughtspot.com/cloud/26.7.0.cl/spotter-viz
  - SpotterViz builds and publishes whole Liveboards from a prompt. https://www.thoughtspot.com/press-releases/thoughtspot-launches-four-bi-agents-that-work-as-a-team-to-deliver-modern-analytics
- **Proactive**
  - **Monitor** alerts on KPI charts: Anomaly, Threshold or Scheduled. Email includes expected upper/lower bounds and a Liveboard link; Slack is in EA. https://docs.thoughtspot.com/cloud/latest/monitor
  - **AI Highlights** is a per-tab "TLDR". KPIs are split into **expected vs unexpected** using an anomaly band, each with one change-analysis insight. It self-cautions that it "may not highlight the top change contributor". https://docs.thoughtspot.com/cloud/latest/liveboard-ai-highlights
- **Why**
  - Spotter routes "why" questions to the change-analysis engine. https://docs.thoughtspot.com/cloud/latest/spotter-capabilities
  - SpotIQ change analysis: click the KPI's **% change label**, or pick two points on the sparkline. Uses the top 5 attributes; admins can pin attributes. https://docs.thoughtspot.com/cloud/latest/spotiq-change
- **Trust:** a **"Double check response"** action; approve/reject (✓/✗) of interpreted business terms; **+ Add to Coaching / + Add to memory**; feedback goes to an admin Liveboard. https://docs.thoughtspot.com/cloud/latest/spotter-getting-started
- **Mobile:** KPI **watchlist**; change analysis via a caret next to the % change label. https://docs.thoughtspot.com/cloud/latest/mobile-kpi-change-analysis
- **Reviews (G2):** Spotter is called "the best feature"; cons are the learning curve and price. https://www.g2.com/products/thoughtspot/reviews

### 1.5 Hex (Threads, Notebook Agent, Modeling Agent, Context Studio)
- **Ask**
  - Homepage prompt bar starts a **Thread**. Also available from Slack, MCP and CLI. https://learn.hex.tech/docs/explore-data/threads
  - The "+" menu picks the data connection. You can @-mention sources or projects, toggle **Governed mode**, and choose **Model & Effort** (default "Auto").
  - You can leave and come back while the answer runs. https://hex.tech/blog/fall-2025-launch/
- **Evidence**
  - Thinking, tool calls and results stream live, then **auto-collapse** and can be re-expanded.
  - Answers **cite cells**; clicking one opens it in the Notebook.
  - An **Agent / Notebook / App** toggle shows the underlying logic side by side with the chat.
- **Charts:** the agent uses the **same Explore cells as humans** (P3). Users edit chart type and color directly.
- **Save:** every Thread is backed by an unlisted project, with "Save as project" and "convert to notebook" for data-team audit.
- **Agent edits:** Notebook Agent changes show as a **diff (keep/undo)**; deleting cells needs **Accept/Deny** plus "Don't ask again in this thread". https://learn.hex.tech/docs/explore-data/notebook-view/notebook-agent
  - Modeling Agent proposes semantic-model changes as a per-change accept/reject diff.
- **Trust**
  - Endorsed statuses (default "Certified") look visually distinct and are applied by admins only. https://learn.hex.tech/docs/organize-content/statuses-categories
  - Governed mode restricts the agent to "endorsed data only" or "semantic models only".
- **Admin-side monitoring:** **Context Studio**. https://hex.tech/product/context-studio/
  - Conversation review, topic trends and reasoning traces.
  - The agent raises a warning when unsure or when the user seems doubtful; a Review Agent turns repeated warnings into suggestions; evals run before context changes ship.
- **Proactive / why:** not documented. **Mobile:** Threads is "first experience optimized for mobile". https://hex.tech/blog/fall-2025-launch/
- **Reviews:** G2 4.5/5 (379 reviews); one reviewer wants fast vs thinking modes. https://g2.com/products/hex-tech-hex/reviews

### 1.6 Julius AI (3rd-party sources mostly)
- **Ask:** upload a file (paperclip), see a data preview, get **dataset-specific suggested questions**; "Custom rules" set the style. https://www.datacamp.com/tutorial/julius-ai-guide (3rd-party)
- **Evidence:** generated **Python is visible** with "Edit code"; multi-step runs show visible steps and auto-fixed errors. https://effortlessacademic.com/julius-ai-in-depth-review/ (3rd-party)
- **Charts:** interactive plus static versions. There is **no point-and-click editor**: you change a chart by re-prompting or editing code. This is the anti-pattern to P3.
- **Proactive:** Slack scheduled reports post top insights, then a thread with detail. `[UNVERIFIED; page 403]` https://hbs.julius.ai/docs/slack-agent/slack-reports
- **Criticism (3rd-party):**
  - Inconsistent or hallucinated statistics on sparse data, and weak reproducibility. https://nubiapage.com/julius-ai-review-2026-pricing-login-founder-user-experience-and-faqs/
  - Users on Julius's own forum ask how to validate results against Stata or R. https://community.julius.ai/t/accuracy-checking-and-hallucinations/165
  - **Lesson:** LLM-written code over raw data, with no semantic layer, is where users report numbers they can't trust. This supports P1.

### 1.7 Amplitude (Global Agent, specialized agents, Root Cause Analysis)
- **Ask** https://amplitude.com/docs/amplitude-ai/global-agent-overview
  - Floating button on every page, "Chat" in the nav, or ⌘⇧K.
  - **Page-aware**: "this chart" refers to what is on screen.
  - **Answer shape: 2–5 sentences → supporting data and links → follow-up suggestions.** Complex answers take 30–60 s.
- **Evidence:** every claim links to supporting data; chart links show sources and calculations.
  - Diagnostic design principles: live reasoning (tools called), inline citations, **multiple competing hypotheses, confidence levels**. https://www.amplitude.com/blog/diagnostic-analytics-trustworthy
- **Charts:** an interactive preview that opens the **full native chart**; edits by asking. New charts save to a personal space by default; AI-generated content stays **hidden from search unless published**. Search prefers "Official" content.
- **Proactive / agents**
  - Dashboard, Session Replay, Feedback and Website Conversion agents on schedules, delivering to Slack or email. https://amplitude.com/docs/amplitude-ai/agents-overview
  - Dashboard Agent shows a **"what changed since last run"** week-over-week section. https://www.amplitude.com/releases/dashboard-agent-enhancements
  - Agents "only carry out actions you approve".
- **Why:** Root Cause Analysis. https://amplitude.com/docs/analytics/root-cause-analysis
  - Flow: Anomaly + Forecast confirms the anomaly (expected value plus "normal" band) → click the point → Microscope → **Run Root Cause Analysis**.
  - Shows per-property time series ranked by relevance, 30 at a time with "Continue Scanning", each with Open Chart and 👍/👎.
- **Monitors:** Prophet, flagging values outside a **99% CI**, evaluated on a schedule rather than continuously. https://www.amplitude.com/docs/analytics/insights
- **Reviews (AWS Marketplace):** mixed; one headline reads "Unreliable AI Undercuts Dashboard Building and Accurate Answers" (May 2026). https://aws.amazon.com/marketplace/reviews/reviews-list/prodview-2hgtgskas7v5y?page=282

### 1.8 Mixpanel (Spark → Mixpanel Agent; Mixpanel AI)
- **Spark's original pattern (2023):** the AI produced a **normal report in the normal builder**, so "show its work" meant opening the query builder (P3 + P2). https://mixpanel.com/blog/spark-bringing-generative-ai-to-mixpanel/
- **Agent:** full page, or "Open in side view" that persists while you navigate. Picks up the open report or Board as context. History, rename, new chat. https://docs.mixpanel.com/docs/mixpanel-agent
  - An **"Artifacts"** list of everything the agent generated. Making report titles clickable raised clickthrough by 10%. Runs continue in the background. https://mixpanel.com/blog/mixpanel-agent-product-updates/
  - Inside a Board, the agent **inherits the Board's date range**.
- **Why:** RCA generates a Board. https://docs.mixpanel.com/docs/root-cause-analysis
  - Contents: **contribution analysis** (each segment's share of the change), ranked dimensions, **AI-written likely cause, confidence level, next steps**.
  - Starts from a chart, from a fired alert, or by asking. Admins prioritize dimensions in AI Settings.
- **Monitors:** KPI Monitoring Agent alerts to app, Slack or email; automations can be paused and have run history. https://mrem.bernama.com/viewsm.php?idm=54274
- **Trust:** **Verified Mode** prefers verified events/metrics and **flags results that use unverified data**.

### 1.9 Looker + Gemini (Conversational Analytics, data agents)
- **Ask:** pick an Explore, or a data agent covering up to 5 Explores. https://docs.cloud.google.com/looker/docs/conversational-analytics-looker-data
  - Starter questions; **clarifying questions** when fields are ambiguous; a **rephrased question** may appear under yours.
  - **Fast vs Thinking** modes. Docs are candid that Thinking is *not* more accurate; it only adds "Show reasoning". There is also a Stop response button.
- **Evidence:** **"How was this calculated?"** panel.
  - Text tab: field names, calculations, filters, sort.
  - Code tab: Python, only when advanced analytics is on.
  - Optional "Show analytical details" (Looker queries and data tables) and "Show debug info", enabled by the agent creator.
- **Grounding:** queries follow LookML joins and permissions. Google's own tests claim up to two-thirds fewer errors (vendor claim). https://cloud.google.com/blog/products/business-intelligence/how-lookers-semantic-layer-enhances-gen-ai-trustworthiness
  - Caveat: business logic stored in dashboard custom fields is invisible to the agent. https://docs.cloud.google.com/looker/docs/conversational-analytics-looker-best-practices
- **Charts:** refine by follow-up, or **"Open in Explore"**, which turns the result into a normal Explore.
- **Dashboards:** a spark icon, **"Chat with this dashboard"**, opens a side pane. https://docs.cloud.google.com/looker/docs/conversational-analytics-looker-data-agents-dashboards
  - Pinning an answer to a dashboard is `[UNVERIFIED]`.
- **Proactive / why / mobile:** not documented for Conversational Analytics.

### 1.10 Databricks AI/BI Genie (Genie Agents, Genie One)
- **Ask:** New chat; a Context panel with About, Data and Instructions tabs; example questions; follow-up suggestions. https://docs.databricks.com/aws/en/genie-agents/talk-to-genie
  - **Pencil to edit the question and rerun**; Regenerate.
  - Genie One is cross-workspace and routes questions to the right agent, with a conversation outline. https://docs.databricks.com/aws/en/genie-one/chat
- **Evidence:** an expandable **"Analysis"** section, then a Summary, then the table.
  - Steps shown: "Understanding the question" → "Found relevant data" → "Referenced SQL example" → "Thinking steps" (plain-language SQL logic).
  - **"Show code"** reveals the SQL; **applied filters show as editable chips**.
  - **Inspect** has the model re-review its own SQL. https://docs.databricks.com/aws/en/genie-agents/concepts
- **Charts / pin:** auto-chart; an edit pane on the right with a Visualization dropdown. **"Create new dashboard" / "Add to existing dashboard"**. Results kept 30 days.
  - Published dashboards get an auto-generated "Ask Genie" companion that inherits dashboard permissions. https://docs.databricks.com/aws/en/dashboards/genie-spaces
- **Why:** **Agent mode** (formerly Research Agent; ⚡ Flash vs deep). https://docs.databricks.com/aws/en/genie-agents/agent-mode
  - It forms hypotheses and runs many SQL queries, offering **"Answer now"** to cut it short.
  - Output is a report with charts and **citations to research steps**, downloadable as PDF.
  - Docs say "why did the metric change" needs this mode, not Flash.
- **Trust**
  - **Trusted assets** are pre-approved parameterized queries and functions; answers that used one show the creator's comments and editable parameters. Older docs show a "Trusted" label. https://docs.databricks.com/aws/en/genie/trusted-assets
  - Feedback: **Yes / Fix it** (with reasons) **/ Request review**, which goes to the agent's curators. Feedback does not retrain the model.
- **Curator monitoring:** **Benchmarks** of up to 500 questions with ground-truth SQL, scored per run as accuracy % with side-by-side comparison. https://docs.databricks.com/aws/en/genie/benchmarks
- **Mobile:** Genie One iOS/Android apps (no file upload on mobile). https://docs.databricks.com/aws/en/genie/
- **Criticism (3rd-party):** showing SQL builds trust, but "the slightest error will undermine confidence". https://sunnydata.squarespace.com/blog/databricks-genie-our-experience-lessons-learned

### 1.11 Snowflake CoWork (formerly Snowflake Intelligence) + Cortex Analyst
- **Ask:** chat with an Extended-thinking toggle; **Deep Research** (up to 10 min); **Skills** (saved workflows invoked with "/"). https://docs.snowflake.com/en/user-guide/snowflake-cortex/snowflake-intelligence
  - Admin-set example questions. Verified queries can be flagged **"Use as onboarding question"**, so starter prompts are guaranteed-correct. https://docs.snowflake.com/user-guide/views-semantic/editor
- **Evidence:** "responses trace back to the source data and queries", and each chart carries an explanation. The exact Show-SQL UI is `[UNVERIFIED]`.
- **Charts:** **Vega-Lite**, a declarative spec. This is directly analogous to P3. Chart for trends, table for lookups. Manual chart editing is not documented.
- **Save:** "Artifacts" (charts, tables, maps), conversation snapshots, export to PDF/Word/PPT/HTML.
- **Proactive:** an **Automations** tab turns a question into a recurring emailed report.
- **Trust:** verified query repository. https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst/verified-query-repository
  - An exact match **runs the stored SQL without generating new SQL**; similar questions use it as a reference. https://docs.snowflake.com/En/user-guide/snowflake-cortex/snowflake-intelligence/reference
  - Each verified query records `verified_by` and `verified_at`. The API returns a `confidence` signal that says whether a verified query was used.
  - Unmatched questions are clustered into **suggested verified queries** for admins. https://docs.snowflake.com/user-guide/snowflake-cortex/cortex-analyst/verified-query-suggestions
- **Mobile:** iOS app with chat, voice and citations; a Slackbot and an Excel extension at launch. https://www.snowflake.com/en/news/press-releases/snowflake-cowork-powers-the-agentic-enterprise-as-the-personal-agent-for-knowledge-workers-to-work-smarter/

### 1.12 Sigma (Sigma Assistant, ex-Ask Sigma)
- **Ask:** Home → Chat ("Ask me anything about your data"); "+" pins a table or model. https://help.sigmacomputing.com/docs/ask-natural-language-queries-with-assistant.md
  - **Clarifying prompt with labelled options and a "(recommended)" default**, plus Skip and Continue.
  - Follow-ups typed during generation are queued.
  - **Searches existing workbooks before building new analysis.**
- **Evidence** (the richest per-number provenance found)
  - A **"Worked for…"** expander lists the steps, grouped as "Gathered data from…".
  - Query details show sources, filters and joins; clicking a column header shows its calculation; **View SQL**; **Show lineage**.
  - **Numbers in the answer text have dashed underlines; hover shows a citation preview** (source, filters, calculation); **"Ask in chat"** sends that number back as context.
  - A **"Data retrieved at"** timestamp on each result.
- **Charts:** outputs are "standard, editable Sigma elements": **Open in workbook / Copy as workbook element**. Users can switch freely between chat and drag-and-drop. https://www.sigmacomputing.com/blog/introducing-sigma-assistant
- **Why:** in-workbook "explain changes" / "investigate why a metric dipped" (blog-level detail only).
- **Trust:** admin-approved sources carry an indicator; RLS/CLS apply.
- **Reviews (G2):** slowness is the top complaint. https://www.g2.com/compare/omni-analytics-inc-omni-analytics-vs-sigma-computing-sigma

### 1.13 Lightdash AI agents
- **Ask:** "Ask AI" with Auto routing to the right agent. https://docs.lightdash.com/agents/use-ai-agents
  - A chart or dashboard "⋯ → **Ask AI Agent**" pins it as a **context card** above the input; "@" inserts saved content as chips.
  - **Suggested questions appear only once there are more than 6 verified answers**, so starters are always ones that have been verified. https://docs.lightdash.com/guides/ai-agents/verified-answers
- **Evidence:** a **Chart / Lineage toggle** on each result card. The Queries bar shows "Sources / Transformations / Result", with a graph view, View query (SQL) and View code. The agent emits **semantic-layer queries, not raw SQL**.
- **Charts:** a single-step result "is a regular chart and can be saved"; the agent hands off to the standard Explore view.
- **Proactive:** "⋯ → **Schedule delivery**" re-runs the agent and sends the chart plus an AI summary to Slack, email or Teams.
- **Trust:** admins **✓ verify** a chart in the conversation, and a Verified answers tab shows **who, when and how often reused**. Admins can read every thread and turn questions into evals. https://docs.lightdash.com/guides/ai-agents/visibility
- **Autonomy ladder** (clearest one found in BI): https://docs.lightdash.com/guides/ai-agents
  - SQL mode shows proposed SQL with **Approve / Reject** before running.
  - Content tools are off by default: dashboard previews live only in the thread until **"Save dashboard"**. https://docs.lightdash.com/agents/enable-content-tools
  - **Autopilot** maintains content on a schedule.
  - Write-back opens **pull requests** for a human to merge.

### 1.14 Omni (Omni Agent, ex-Blobby)
- **Ask:** pickers for connection, model and topic ("Auto-select a topic"; admins can lock one); LLM and effort choice; queued prompts, and ⌘↵ to interrupt. https://docs.omni.co/ai/chat
- **Existing answers first:** before writing a new query, the agent shows **existing dashboard tiles as live previews** and highlights one that answers directly.
- **Evidence:** **Query details** show each field's name, definition and description; multi-step work shows a ticked task list. https://omni.co/blog/moving-beyond-simple-questions-with-agentic-ai
- **Charts:** each answer is a live query that can be re-run; in a workbook the agent writes the query into the normal editor. https://docs.omni.co/ai/queries
- **Pin:** "add to a dashboard"; an **AI summary visualization** tile type.
- **Trust:** **Verified / Not verified chip on every query**; hover gives the reason ("Off topic", "Not modeled", "New fields", "Review suggested"). https://docs.omni.co/ai/chat
- **Autonomy:** actions show **Allow / Deny** with "Don't ask again". Slack, scheduled routines, API and MCP skip confirmations.
- **Why:** tile "⋯ → Ask a follow up question" pins the chart as a chip. https://docs.omni.co/ai/dashboard-assistant

### 1.15 Hospitality revenue tools
- **Lighthouse**
  - **Ernest:** an "AI teammate" for revenue, marketing, sales and distribution. A single chat in an "AI Workspace", classed "Supervised-Autonomous". https://www.hospitalitynet.org/ai/snapshot/ernest
    - Prepares competitive analysis, forecasts and reports **"overnight, on the schedule they set"**. https://www.hospitalitynet.org/news/4134784/ernest-lighthouses-ai-teammate-for-hotel-commercial-teams-is-now-generally-available
    - Pitched with "why my weekend pickup dropped" (sponsored banner, not docs).
    - "Ernest Crews": humans embed for 30–60 days to set it up. https://www.hospitalitynet.org/news/4134175/lighthouse-launches-ernest-crews-to-get-hotel-commercial-teams-running-on-ai-in-as-little-as-30-days
  - **Pricing Manager:** price suggestions up to 365 days out "along with a clear explanation of the underlying reasoning". Visible factors include competitors selling out, events and pace. https://www.mylighthouse.com/resources/blog/how-to-get-most-out-of-lighthouse-pricing-manager
  - **Autopilot** has scoped rules: all or some rate changes, minimum price difference, occupancy range, which days, push frequency, and override at any time. Same source as above.
  - Reviews: Hotel Tech Report 4.7 on 1,380 reviews (rate-shopping product). https://hoteltechreport.com/revenue-management/market-intelligence-tools/ota-insight-rate-insight
- **Duetto (+ FLYR)**
  - Revenue & Profit OS. https://www.hospitalitynet.org/news/4127745/the-future-of-rms-starts-now-duetto-introduces-the-revenue-profit-operating-system
  - FLYR adds "ask questions… in plain language". After the merger, customers choose "between hands-on control and full automation". https://www.hospitalitynet.org/news/4134812/duetto-acquires-flyr-hospitality-to-expand-its-platform-and-accelerate-innovation-for-hoteliers
  - **AutoPilot** optimizes within the hotel's pricing guidelines and min/max bounds. https://www.hospitalitynet.org/news/4098641.html
  - Scoreboard's **"Rate Explainer"** (per a reviewer). https://hoteltechreport.com/revenue-management/business-intelligence/scoreboard-by-duetto
  - "Duetto Copilot": **not found**.
- **IDeaS G3**
  - **Investigator** explains "the how and why behind automated pricing decisions" in simplified text and visuals. https://ideas.com/problem-solving-revenue-investigator/
    - Forecast Investigator compares actual vs expected bookings on the books (needs 180 days of history). https://ideas.com/improvements-innovations-whats-new-in-g3-rms-august-2025/
  - Critical alerts show automatically after sign-in. https://ideas.com/whats-new-in-g3-rms-nov-2025/
  - Portfolio Navigator prioritizes decisions across properties. https://lodgingmagazine.com/ideas-releases-g3-rms-portfolio-navigator/
  - No NL assistant found `[UNVERIFIED]`.
- **Atomize (Mews RMS)**
  - "Generative AI explains every price recommendation"; a price-insights view with a price-sensitivity chart. https://help.mews.com/s/article/Studying-price-recommendations
  - **Autopilot** up to 730 days ahead; exclude periods or set an end date (after which approval is needed again); always within user bounds. https://help.mews.com/s/article/Autopilot1

---

## 2. Patterns that recur across 3+ products

Each row lists only products where the pattern is documented above.

| # | Pattern | What it looks like | Products (≥3) |
|---|---|---|---|
| A | **Show-your-work expander under every answer** | Collapsed by default. Expands to steps → fields/filters/definitions → query (SQL/DAX/semantic query). | Power BI "How Copilot arrived at this"; Looker "How was this calculated?"; Genie "Analysis" + "Show code"; Sigma "Worked for…" + View SQL; Lightdash Queries bar; Hex collapsing trace; Omni Query details |
| B | **AI output = the native, editable object** | Generated chart opens in or drops into the normal builder; no separate "AI chart" type. | Power BI "Add to page"; ThoughtSpot Edit Answer; Hex Explore cells; Mixpanel reports; Amplitude native chart; Looker "Open in Explore"; Sigma "Open in workbook"; Lightdash "regular chart"; Omni live query; Snowflake Vega-Lite. Counter-example: Julius (re-prompt or edit code only) |
| C | **Human-verified answers with a visible badge, reused by the AI** | Curator approves a query or answer; matching questions reuse it, marked ✓, with who/when. | Power BI verified answers (✓ + matched phrase); Snowflake verified queries (`verified_by/at`, exact match runs stored SQL); Lightdash verified answers (who/when/reuse count); Genie trusted assets; Omni Verified/Not-verified chip with reason; Tableau certified metrics / verified Q&A; Hex endorsed |
| D | **Unverified / low-confidence answers flagged, not hidden** | Warning chip or click-through. | Omni "Not verified" + reason; Power BI "low quality" + View answer; Mixpanel Verified Mode flags unverified data; Amplitude confidence levels; Mixpanel RCA confidence |
| E | **Starter + follow-up question chips** | Starters on empty state; 2–4 follow-ups after each answer. | Tableau Pulse, Looker, Genie, Amplitude, Sigma, Julius, Snowflake |
| F | **Starters drawn from verified answers** | Suggested questions are ones known to be correct. | Snowflake "Use as onboarding question"; Lightdash (only after >6 verified); Power BI verified-answer trigger phrases |
| G | **Context-scoped chat from an object** | Ask from a chart or dashboard; that object becomes a context chip; "this chart" resolves. | Amplitude (page-aware); Mixpanel side view; Lightdash "Ask AI Agent" card; Omni "Ask a follow up question"; Looker "Chat with this dashboard"; Genie on dashboards; ThoughtSpot Spotter-on-viz; Tableau "Ask" on metric |
| H | **Deterministic stats first, LLM narrates** | Facts computed by code, then summarized. Insight-type catalogue. | Tableau Pulse (explicit "facts"); ThoughtSpot change analysis / SpotIQ; Amplitude RCA (Prophet); Mixpanel contribution analysis |
| I | **Expected-range band defines "anomalous"** | Shaded band; alert when outside; "expected vs unexpected". | Tableau Unexpected Values; ThoughtSpot Monitor bounds + AI Highlights; Amplitude Anomaly + Forecast (99% CI); Tableau Next Inspector |
| J | **Driver / contribution decomposition for "why"** | Ranked dimensions, each segment's share of the change, top drivers/detractors. | Tableau Top Drivers/Breakdown; ThoughtSpot SpotIQ (click % change label); Amplitude RCA; Mixpanel RCA board; Juyo "driver decomposition"; IDeaS Investigator |
| K | **Click the delta to explain it** | The change number itself is the entry point. | ThoughtSpot (% change label, web + mobile caret); Amplitude (click anomalous point → RCA); Mixpanel (RCA from chart or alert); Sigma (dashed-underline number → "Ask in chat") |
| L | **Two speeds: quick answer vs deep research** | Mode toggle; deep mode plans hypotheses, runs many queries, writes a cited report; "Answer now" / stop. | ThoughtSpot Search vs Deep analysis; Genie Flash vs Agent mode; Looker Fast vs Thinking; Snowflake Deep Research; Hex effort picker; Juyo Quick/Thinker/Strategic |
| M | **Follow a metric → digest pushed to email/Slack/Teams** | Digest leads with a summary, links back to ask more. | Tableau Pulse; Amplitude scheduled agents (incl. "since last run"); Lightdash Schedule delivery; Snowflake Automations; Julius Slack reports; Lighthouse Ernest overnight prep |
| N | **Threshold / anomaly monitors with alert delivery** | Rule or anomaly monitor; email/Slack/push. | ThoughtSpot Monitor; Tableau Pulse alerts / Inspector; Mixpanel KPI Monitoring Agent; Amplitude anomaly alerts; Power BI Activator; IDeaS critical alerts; Juyo "proactive alerts tied to your goals" |
| O | **Graded autonomy: approve before act** | Allow/Deny or Approve/Reject cards; "don't ask again"; diffs; PRs. | Omni Allow/Deny; Lightdash Approve/Reject SQL + PR write-back; Hex diff keep/undo + Accept/Deny; Amplitude "only actions you approve" |
| P | **Bounded autopilot in RMS** | Min/max bounds, conditions, date exclusions, end date, push schedule, override always available. | Lighthouse Autopilot; Duetto AutoPilot; Atomize Autopilot; Juyo "inside the bounds you set"; Duetto/FLYR "hands-on to full automation" |
| Q | **Feedback routed to a curator, plus evals** | 👍/👎, "Fix it", "Request review"; admins review threads; benchmark sets. | Genie (Fix it / Request review / benchmarks); ThoughtSpot (coaching, admin Liveboard); Lightdash (thread review → evals); Hex Context Studio; Snowflake (suggested verified queries, evals) |
| R | **Clarify instead of guess** | Clarifying question with options; rephrased question shown. | Looker; Sigma (options with "(recommended)"); Power BI standalone; Genie Agent mode |
| S | **Pin / add to dashboard from the answer** | Button on the answer card. | Power BI "Add to page"; ThoughtSpot Pin to Liveboard; Genie "Add to existing dashboard"; Omni "add to a dashboard"; Lightdash "Save dashboard" |
| T | **Explained price recommendations (hospitality)** | Factors behind each rate: comp set, events, pace, forecast vs actual. | Lighthouse Pricing Manager; IDeaS Investigator; Atomize GenAI explanations; Duetto Rate Explainer |

Patterns seen in only 1–2 products (worth knowing, not established):
- Dashed-underline per-number citations (Sigma).
- "Data retrieved at" timestamp (Sigma).
- Existing-tile-first previews (Omni, Sigma's workbook search).
- AI content hidden from search until published (Amplitude).
- Tap-static-screenshot-to-open-live-chart on mobile (Power BI).
- Home-screen metric widget (Tableau).
- Hover a narrative footnote to highlight the chart (Power BI).
- "Double check response" (ThoughtSpot).
- "Council of agents" (Juyo).

---

## 3. Best fit for a hotel revenue dashboard (desktop + phone)

Mapped to the Compass principles. Only established patterns from §2 are used; the anchor products are named.

**P1: model never computes numbers**
- **H (stats first, LLM narrates)** is the core architecture. Use Tableau Pulse's documented split: SQL produces typed "facts", and the LLM only writes prose that references them.
- **C (verified answers)** for hotel staples: Occupancy, ADR, RevPAR, pickup, pace vs STLY, and forecast vs budget.
  - Follow Snowflake's rule: an exact match runs the stored SQL with no generation.
  - Follow Lightdash's display: a ✓ with who and when.
- **D (flag unverified):** use an Omni-style chip with a reason ("New metric", "Not modeled") on answers that didn't come from a verified query.

**P2: evidence one click away**
- **A (show-your-work expander)** under every answer, collapsed. Contents, in order: plain-language steps → metric definitions used (e.g. "RevPAR = room revenue ÷ available room-nights") → filters (dates, segment, property) → SQL.
- **R (clarify):** hotel terms are ambiguous (ADR with or without packages? stay date vs booking date?). Ask, with a recommended option, as Sigma does.

**P3: same declarative chart spec**
- **B (native object):** the AI emits the same chart spec the manual builder uses, as Snowflake does with Vega-Lite and Hex/Lightdash with native cells/charts.
- **S (pin):** "Add to dashboard" on the answer card.
- **G (context-scoped):** ask from a tile, and the tile becomes a context chip.

**P4: briefing brings the answer**
- **M (digest):** a morning briefing for revenue managers, e.g. "since yesterday: pickup for next 30 days, pace vs STLY, comp-set moves".
  - Leads with a summary, then cited insight cards, then a follow-up question (Tableau Pulse digest anatomy).
  - Add a "since last run" section (Amplitude Dashboard Agent).
- **I + N (expected band and monitors):** show a shaded expected range on pickup/pace charts and alert only when a value leaves it. This cuts noise compared with fixed thresholds.
- **J + K (driver decomposition, click the delta):** tapping "RevPAR −8% vs STLY" opens a contribution breakdown by segment, channel, room type and day-of-week (ThoughtSpot, Mixpanel). This also matches Juyo's own "driver decomposition" promise.
- **Insight taxonomy:** reuse Tableau Pulse's insight types rather than inventing them. Period change, Unexpected value, Pace to goal (→ budget), Top drivers/detractors, Concentrated contribution (e.g. one OTA ≥50% of pickup).

**P5: agents earn trust gradually**
- **O (approve before act) → P (bounded autopilot):** this is the industry ladder in both BI and RMS.
  - Suggest: a recommendation card with factors (pattern T).
  - Approve: Allow/Deny with "don't ask again for this rule" (Omni, Hex).
  - Act: autopilot inside explicit bounds — min/max rate, date ranges, occupancy conditions, end date, override always visible (Lighthouse, Atomize, Duetto).
- **T (explained recommendations)** is table stakes in hotel RMS (IDeaS Investigator, Lighthouse, Atomize). Every suggestion needs its "why" factors.
- **Q (feedback to curator):** 👍/👎 plus "Request review" that reaches whoever owns metric definitions.

**Desktop vs phone**
- **Desktop:** chat as a side panel over the dashboard (G); full expanders (A); deep mode (L) for "why did weekend pickup drop" questions; editable chart with pin (B, S).
- **Phone:** the product surface on phone is mostly *push and glance*, not authoring.
  - Patterns documented on mobile:
    - Digest or alert push (Tableau, ThoughtSpot).
    - KPI watchlist with tap-to-change-analysis (ThoughtSpot mobile caret).
    - Short answer first (Amplitude's 2–5 sentences).
    - Static chart that opens a live chart on tap (Power BI mobile; one product only).
    - Voice input (Power BI iOS, Snowflake iOS).
    - Home-screen widget (Tableau; one product only).
  - Approve/deny of agent suggestions on phone is a logical fit, but **no product above documents a mobile approval flow** `[UNVERIFIED as a pattern]`. Treat it as a Compass extrapolation if used.
- **Reviewer warnings to design against**
  - Plausible wrong answers (Power BI 3rd-party); show provenance and verified state (A, C, D).
  - "One error undermines confidence" (Genie 3rd-party); prefer verified queries for core KPIs.
  - "Pulse is a toy / can't replace dashboards" (Tableau 3rd-party); the briefing should complement the dashboard and link into it, not replace it.
  - Julius-style re-prompt-only editing (anti-B).

## 4. Open items / not verified
- Juyo "Agent Studio" name; how Kassandra displays reasoning or sources; Juyo mobile.
- Snowflake CoWork's exact Show-SQL / trace UI and any visible verified badge.
- Tableau Pulse chart editability; Tableau authoring-agent output vs manual worksheet.
- Spotter in the ThoughtSpot mobile app; Amplitude / Sigma / Omni / Lightdash / Lighthouse mobile AI.
- Lighthouse Ernest: whether it can change prices; how it shows sources.
- IDeaS NL assistant (none found); Duetto "Copilot" (none found).
- Julius Notebooks sunset date (third-party only).
