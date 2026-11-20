# Automatic chart choice and catalogue-constrained chart generation (Compass / Kassandra)

Legend for source tags: (docs) official product documentation; (vendor blog) first-party engineering/marketing post; (paper) peer-reviewed paper or arXiv preprint; (spec) protocol/library specification or README; (search snippet) content seen only through a search-engine summary because the page was not fetched or returned 403, so treat it as lower confidence; (observed) UI seen in a Mobbin screenshot, which shows that a pattern exists but not how it is documented; (community) forum post. Our own synthesis is marked **[our call]**. Research done 2026-11-20.

## Q1. How do BI and analytics products pick the default chart from the shape of the data, and which ones publish their rules?

### Takeaway
Every major product picks a default chart from field roles: dimension vs measure, date vs category vs geography, and how many measures there are. All of them let the user override it. No commercial vendor publishes a full decision table. Their documentation gives a few examples instead (date + measure → line, a single measure → KPI, geography → map, at least 1 attribute + 1 measure before any chart is drawn), plus promises about behaviour (the chart type stays the same across follow-up questions, admins can limit which chart types are allowed). The full logic exists only in research papers (Show Me, CompassQL, Draco) and in open-source code (Metabase `defaultDisplay`, AntV AVA). The product pattern closest to Compass is Tableau Pulse. Deterministic statistical models compute the facts and choose from a fixed list of insight types, and the LLM only writes the narrative.

### Cited Findings
**Tableau (Show Me, Pulse)**
- Show Me "automatically evaluates the selected fields and gives you the option of several types of views that would be appropriate for those fields". The suggested view gets an orange outline. With a date dimension and a measure selected it suggests a line, because "A line is often the optimal way to look at how measure values change over time." (docs) — [Tableau Help: Use Show Me](https://help.tableau.com/current/pro/desktop/en-us/buildauto_showme.htm)
- The per-chart rules appear inside the product and are not published as a table. Hovering over a viz type shows "a description showing the minimum requirements for each viz type". Since 25.2 there is also a "Choose for me" option that builds a view from the data source's fields. (docs) — [Tableau Help: Use Show Me](https://help.tableau.com/current/pro/desktop/en-us/buildauto_showme.htm)
- The method behind it is published research. Show Me (Mackinlay, Hanrahan, Stolte, InfoVis 2007) adds automatic mark-type selection, a command that adds one field to a view, and commands that build views from several fields, including small multiples generated through VizQL. Interface logs showed commercial users relied on it even though it is optional. (paper; the PDF returned 403, so this comes from a search snippet) — [Tableau: Show Me whitepaper](https://www.tableau.com/whitepapers/show-me-automatic-presentation-visual-analysis)
- Specific per-chart minimums and the "24 chart types" figure appear only on exam-prep sites, not in Tableau documentation. Treat them as unverified. — [open-exam-prep](https://open-exam-prep.com/study-guides/tableau-desktop/exploring-analyzing-data/visualizations-show-me)
- Tableau Pulse works from a fixed catalogue of insight types: Period over Period Change, Correlated Metrics, Record-level Outliers, Forecast, Current Trend, Trend Change Alert, Unexpected Values, Goal and Threshold Breakdown, Pace to Goal, Top Drivers, Top Detractors, Concentrated Contribution Alert, Top Contributors, Bottom Contributors. (docs) — [Tableau Pulse insight types](https://docs.salesforce.com/tableau/current/en-us/online/pulse_insights_platform_insight_types.md), which is where help.tableau.com/…/pulse_insights_platform_insight_types.htm redirects
- In Pulse, "standardized, deterministic statistical models … detect facts about metrics", and "These facts act as the ground truth when generating insights". "Insight summaries use a large language model to provide a personalized overview in plain language", with the facts "used as ground truths to contextualize language generation". How each insight is drawn is fixed per type: the expected range is a "blue shaded band in chart", and forecasts "appear on the overview chart for a metric". (docs) — [Tableau Pulse insight types](https://docs.salesforce.com/tableau/current/en-us/online/pulse_insights_platform_insight_types.md)

**ThoughtSpot**
- "Your search needs at least one attribute and one measure to be presented as a chart." For a new query ThoughtSpot "analyzes the data and automatically selects the most appropriate chart". A single-measure search gives a KPI chart, and adding a time keyword adds a sparkline. (docs) — [ThoughtSpot: Understanding charts](https://docs.thoughtspot.com/cloud/latest/charts)
- The chart type is kept stable. On follow-up queries ThoughtSpot "should retain the existing chart type *unless* constraints force it to change". On drill-downs it aims at "maintaining the current chart type wherever possible". Colors are tied to values for the whole session, so each state keeps its color even when the search or the chart type changes. (docs) — [ThoughtSpot: Understanding charts](https://docs.thoughtspot.com/cloud/latest/charts)
- Chart types whose required columns are missing (for example, a geo chart without a geographic column) are greyed out, and hovering shows which columns are needed. (docs) — [ThoughtSpot: Understanding charts](https://docs.thoughtspot.com/cloud/latest/charts)
- Admins can control the catalogue (Beta). They can set the default display mode (table or chart), choose which chart types are available, and set the cluster's default chart (the docs' examples are making bar the default and removing pie). (docs) — [ThoughtSpot: Understanding charts](https://docs.thoughtspot.com/cloud/latest/charts)
- The default varies by version. Older ThoughtSpot Software docs disagree on the most common one: line "more often than not" in one version, column "often the chosen default" in another. (search snippet) — [ThoughtSpot Software docs](https://docs.thoughtspot.com/software/7.2/charts)
- ThoughtSpot's content marketing frames the choice by question: ranking → bar, change from January to December → line. (vendor blog, marketing) — [ThoughtSpot: best chart types](https://www.thoughtspot.com/data-trends/data-visualization/best-chart-types)

**Metabase**
- In the query builder, "Metabase will select a chart type most appropriate for your data, but you can change the visualization type." Native SQL results get no automatic chart: they come back as a table and the user picks a visualization. Charts that don't fit the result are listed under "More charts". For maps, "Metabase will automatically try and pick the best kind of map". A bar chart with a numeric x-axis becomes a binned histogram. The page's per-chart guidance: line for trends over time, bar for a number grouped by category, pie for a small number of breakouts. (docs) — [Metabase: Visualization overview](https://www.metabase.com/docs/latest/questions/visualizations/visualizing-results)
- The docs' example: counting orders grouped by time gives a line chart. The chart guide also notes that some visualizations, such as a progress bar, need extra input, so Metabase cannot choose them automatically. (search snippet) — [Metabase: Which chart should you use?](https://www.metabase.com/learn/metabase-basics/querying-and-dashboards/visualization/chart-guide)
- The rules live in code. One commit to `defaultDisplay` returns `{display: "map", settings: {"map.type": "grid"}}` when two coordinate breakouts are both binned, and a pin map when they are not. This was seen on a university mirror of the repo, so check it against upstream. (code) — [Metabase mirror commit](https://code.umd.edu/eds/metabase/-/commit/f84e0d2321e439daddc50c143fc953062c146b70)
- A forum moderator said the x-axis choice for a bar chart with two breakouts is an internal heuristic ("not a function, just internal reference for the magic"). (community) — [Metabase Discourse](https://discourse.metabase.com/t/selecting-x-axis-attribute-for-bar-graph/14731)

**Amazon Quick Sight (formerly QuickSight)**
- "AutoGraph isn't a visual type itself"; AWS Quick "uses the most appropriate visual type for the number and data types of the fields you select." The page has no table mapping field combinations to visuals. (docs) — [AWS Quick: Using AutoGraph](https://docs.aws.amazon.com/quick/latest/userguide/autograph.html)
- Fields are classified as measure or dimension by data type, and numeric fields such as ZIP codes and most IDs can act as dimensions, which changes the chosen visual. (search snippet) — [AWS Quick: working with visual types](https://docs.aws.amazon.com/quick/latest/userguide/working-with-visual-types.md)

**Power BI Q&A and Copilot (Microsoft Fabric)**
- In Q&A, "Power BI determines the appropriate visual type based on the selected suggestion or entered text". In the docs' example, "top geo states by sum of revenue" produces a map. Users can name a type in the question ("as a column chart"), and the docs warn that "not all visual types are useful for presenting all types of data". A Convert icon turns the Q&A result into a standard visual, which can then be pinned. (docs, updated 2026-09-29) — [MS Learn: Q&A visual](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-q-and-a)
- Q&A is being retired, and the sources disagree on the date. The Q&A page says "Q&A experiences are going away in February 2027" and recommends Copilot; a Learn training module says December 2026. (docs) — [MS Learn: Q&A visual](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-q-and-a); [MS Learn training module](https://learn.microsoft.com/en-ca/training/modules/create-dashboards-power-bi/3-explore-data) (search snippet)
- When a visual generated by Q&A is pinned to a dashboard, it reverts to its default type unless it was first converted or saved as a standard visual. (community; a moderator's test confirmed the visual kind does not sync) — [Fabric Community thread](https://community.fabric.microsoft.com/t5/Service/Dashboard-Visual-keeps-changing/m-p/4403129)
- Copilot answers data questions "in the form of a visual", with a text summary that describes the visual and lists the fields used to build or filter it. Copilot chooses the visual itself (bar for sales per menu category in Microsoft's example), and the user can ask for a type such as funnel. Explore lets users change the fields, the chart type, and the filters. (search snippet) — [MS Learn: Copilot data questions](https://learn.microsoft.com/power-bi/create-reports/copilot-ask-data-question); [Power BI blog](https://powerbi.microsoft.com/blog/the-next-era-of-copilot-in-power-bi-chat-with-your-data)

**Google Looker Conversational Analytics and the Conversational Analytics API**
- "Conversational Analytics leverages Vega-lite for conversation chart generation". The doc versions list line (one or more series), area, and bar (horizontal, vertical, stacked) as fully supported, and newer versions add scatter and pie. Maps, heatmaps and charts with tooltips "may render unexpectedly", and any chart not listed is unsupported. Looker data is capped at 5,000 rows per query. (search snippet) — [Looker: Conversational Analytics](https://docs.cloud.google.com/looker/docs/studio/conversational-analytics?hl=en)
- The API returns charts "as either Vega-Lite JSON configurations or SVG images". "This subagent executes Python code to generate a Vega-Lite JSON configuration for the chart." Supported types are Area, Bar, Geoshape, Heatmap, Line (Time series), Pie and Scatter. If an image is requested with `ChartOptions`, "the API provides both the image and the Vega-Lite JSON output". (docs) — [CA API: Render a visualization](https://docs.cloud.google.com/gemini/data-agents/conversational-analytics-api/render-visualization)

**Databricks Genie (AI/BI)**
- "For many questions, Genie automatically generates a visualization and a result table". "When applicable, Genie generates a visualization of the result set". Users can ask for a specific visualization. (docs) — [Databricks: Talk to Genie](https://docs.databricks.com/aws/en/genie/talk-to-genie)
- Release notes say visualizations now "use query result metadata for higher-quality auto-generated charts" (November 2025) and that generated visualizations are editable. (search snippet) — [AI/BI release notes 2025](https://docs.databricks.com/gcp/ai-bi/release-notes/2025); [AI/BI release notes 2024](https://docs.databricks.com/aws/en/ai-bi/release-notes/2024)

**Hex**
- AI charts take a natural-language question, run SQL, prepare the data with Python if needed, and "build a visualization using a native chart cell". (search snippet of vendor blog) — [Hex: Making AI charts go brrrr](https://hex.tech/blog/making-ai-charts-go-brrrr/)
- The main agent passes the visualization subagent `dataSources`, `analyticalGoal` and `userPreferences`: the "what" and "why", not the "how". The subagent first settles "what data, what axes, what chart type" and only then styles. Hex publishes no explicit rules: "Frontier models already know a lot about visualization best practices … we didn't need to harangue the subagent about the dangers of pie charts or rainbow color scales." (vendor blog) — [Hex: cloned visualization team](https://hex.tech/blog/cloned-visualization-team/)

**PostHog AI**
- It creates "every insight type in Product Analytics" (Trends, Funnels, Retention, Paths, Lifecycle, Stickiness) and "identifies the right insight type". Phrases such as "as a funnel" or "broken down by browser" tell it "which insight type and breakdown to use". Follow-up requests update the insight "in place". (docs) — [PostHog: Analyze data with PostHog AI](https://posthog.com/docs/product-analytics/analyze-data-ai.md)
- PostHog's MCP server exposes one tool per insight type (for example `query-trends`, `query-funnel`) and `insight-create` to save the result. (search snippet) — [PostHog MCP docs](https://posthog.com/docs/product-analytics/surfaces/mcp.md)

**Open-source rule engines**
- AntV AVA ChartAdvisor describes itself as "empiric-driven chart recommendation based on visualization rules and chart linter". The Advisor returns a ranked list of chart configurations ("The chart configuration with the highest recommendation is at the top of the list"), and the Linter reports problems in a spec, for example "Difference should be big enough for pie sectors". (spec/README) — [npm @antv/chart-advisor](https://www.npmjs.com/package/@antv/chart-advisor); [README 2.0.4](https://cdn.jsdelivr.net/npm/@antv/chart-advisor@2.0.4/README.md)

### Inferences
- **Who publishes rules.** Only research and open source publish the full logic: the Show Me paper, CompassQL and Draco (Q3), AVA, and Metabase's code. ThoughtSpot and Tableau document behaviour: minimum requirements, stickiness, admin allowlists, and a few examples. AWS, Copilot, Genie and Hex publish essentially nothing beyond "most appropriate for the fields". **[our call]**
- **Consensus default rules**, assembled from the documented examples above. Thresholds marked "heuristic" are our own and not sourced. **[our call]**

  | Result shape (known from SQL tool metadata) | Default | Sensible alternatives | Basis |
  |---|---|---|---|
  | 1 row × 1 measure | KPI number (+ delta vs comparison) | table | ThoughtSpot KPI |
  | 1 measure over time | KPI + sparkline (card) or line | bar if few periods; table | ThoughtSpot sparkline; Tableau/Metabase line |
  | measure × time grain | line | column (heuristic: ≤ ~12 periods); table | Tableau, Metabase |
  | measure × category | bar sorted desc (ranking) | table; pie only for part-to-whole with few parts (heuristic ≤ 5) | Metabase guide; ThoughtSpot article |
  | measure × high-cardinality category | top-N bar + "Other" (heuristic N≈10) | table | inferred from the series/complexity findings in Q3 |
  | measure × time × few series | multi-line (heuristic ≤ 5 series) | small multiples; table | ThoughtSpot follow-up stickiness; VisEval 3-channel difficulty (Q3) |
  | geographic dimension | map (not needed for Compass MVP) | table | Power BI example; Metabase |
  | many dims / raw rows / SQL with no clear shape | table | — | Metabase native-query default |

- Products fall into two patterns. In (a) the LLM chooses the chart freely (ChatGPT, Gemini, Claude inline visuals; Q2). In (b) the shape → chart mapping is deterministic and AI narrates or fills slots (Tableau Pulse, ThoughtSpot defaults, Metabase, AutoGraph). Compass's constraint that SQL tools compute every number fits (b). Kassandra would choose an *analytic intent* (trend, compare, rank, breakdown, KPI), and a deterministic resolver would turn intent plus result shape into a chart kind. **[our call]**
- Three ThoughtSpot behaviours carry over directly to multi-turn Kassandra conversations: keep the chart type unless the new result is incompatible, keep each entity's color stable across widgets, and let admins or the catalogue owner restrict the allowed kinds. **[our call]**

### Gaps
- AWS, Tableau, ThoughtSpot, Microsoft, Google and Databricks publish no decision tables. The full upstream Metabase `defaultDisplay` was not retrieved; only a mirror commit for the map rules was.
- Not covered by the sources reached: Julius AI, Microsoft Fabric data agent, Amazon Q in QuickSight answers, and Looker Studio's own Gemini chart behaviour. The "Agentic charts" page in ThoughtSpot Spotter, referenced from its charts page, was not found in the `llms.txt` index.
- The names and thresholds of AVA's rules were not verified. Searching for specific rule IDs returned nothing.

## Q2. How do Claude, ChatGPT, Gemini, Perplexity and generative-UI frameworks such as Vercel's AI SDK render charts from model output, and how do users switch type, see the data, or edit the spec?

### Takeaway
There are three rendering families:
1. **Code-execution charts.** ChatGPT data analysis renders static images, with interactive rendering for bar, line, pie and scatter.
2. **Free-form generated UI code.** Claude's inline visuals (beta since March 2026) and Gemini's dynamic view and Canvas. These are flexible but give no guarantees; Google warns of "occasional inaccuracies" and Claude's visuals are ephemeral.
3. **Declarative specs against a catalogue.** Google's CA API returns Vega-Lite; A2UI, Vercel json-render and AI SDK tool→component work this way; so do AntV's one-tool-per-chart MCP server and BI assistants that output a standard report object (Pipedrive, PostHog, Genie).

Chat products mostly expect users to change a chart by asking again. BI-grade assistants add direct editing. The catalogue frameworks all work the same way: an allowlist of components with typed props and descriptions, a prompt generated from that allowlist, flat ID-referenced JSON, schema validation with errors fed back to the model, and a renderer that owns all styling.

### Cited Findings
**ChatGPT (data analysis)**
- Interactive charts are supported for bar, line, pie and scatter. Other types may come back as static images. The controls are labelled "Switch to interactive chart" and "Switch to static chart". The help center warns that ChatGPT "may choose an analysis method or chart type that does not match your intent on the first try. Ask it to use a specific method, chart type, grouping, or column". Types you can request include line, bar, pie, histogram, scatter, box plot, heat map, area, radar, treemap, bubble and waterfall. (docs; direct fetch returned 403, so via search snippet) — [OpenAI Help: Data analysis with ChatGPT](https://help.openai.com/en/articles/8437071-data-analysis-with-chatgpt)
- The May 2024 launch let users customize bar, line, pie and scatter charts in the conversation: hover over elements, ask follow-ups, pick colors. Unsupported chart types get a static version. (vendor blog, search snippet) — [OpenAI: Improvements to data analysis](https://openai.com/index/improvements-to-data-analysis-in-chatgpt)

**Claude**
- Since March 12, 2026, Claude "can create custom charts, diagrams and other visualizations in-line in its responses—and then tweak and modify its creations as the conversation develops". The feature is on by default. Claude decides when a visual helps, and users can also ask for one ("draw this as a diagram"). Visuals are temporary: they "change or disappear as the conversation evolves". Artifacts, by contrast, are "permanent tools and documents created by Claude, designed to be shared or downloaded". The feature is on all plans, and in Cowork on paid plans since April 22, 2026. The page does not say how visuals are rendered. (vendor blog) — [Claude: builds visuals](https://claude.com/blog/claude-builds-visuals)
- Press coverage places the launch shortly after a ChatGPT visualization feature for math and science, and notes that Gemini already offered interactive educational images. (press, search snippet) — [The Register](https://www.theregister.com/2026/03/13/claude_charts_a_new_course/)

**Gemini**
- On Nov 18, 2025 Google announced the generative-UI experiments "dynamic view" and "visual layout" in the Gemini app: "Gemini designs and codes a fully customized interactive response for each prompt, using Gemini's agentic coding capabilities" (Gemini 3 Pro plus tools, system instructions and post-processing). Generation "can sometimes take a minute or more", and there are "occasional inaccuracies in the outputs". (research blog, search snippet) — [Google Research: Generative UI](https://research.google/blog/generative-ui-a-rich-custom-visual-interactive-user-experience-for-any-prompt/)
- In Canvas, Gemini generates a single-page app that uses Chart.js and Plotly, with a Code/Preview toggle. (observed) — [Mobbin: Gemini Canvas](https://mobbin.com/screens/befbee9e-df36-4848-8245-3f27a076c4d1)
- Gemini Enterprise renders agent UIs through A2UI using its own catalogue: it "sends along GE's own A2UI catalog, the list of UI components GE knows how to render". Google's A2UI 1.0 announcement says Gemini renders A2UI responses with components from its own component gallery and supports A2UI 0.9.1. (search snippets) — [Google Cloud blog](https://cloud.google.com/blog/topics/developers-practitioners/guide-to-gemini-enterprise-and-a2ui-integration); [Google Developers blog: A2UI 1.0](https://developers.googleblog.com/a2ui-10-build-delightful-fast-reliable-agentic-experiences/)

**Perplexity**
- Perplexity Computer renders interactive finance charts (candlesticks, volume, moving averages, zoom and pan) inline in the thread. Press reports say they are built on TradingView Lightweight Charts. The finance product (May 5, 2026) lists an interactive chart that annotates catalysts, and users can ask for a line chart or a bar comparison. Most detail comes from secondary sources. (search snippets) — [AlphaSignal](https://alphasignal.ai/news/perplexity-computer-now-renders-live-financial-charts-inside-your-research); [Perplexity: Computer for professional finance](https://perplexity.ai/hub/blog/computer-for-professional-finance); [Perplexity use case](https://www.perplexity.ai/en-GB/hub/use-cases/personal-finance-dashboard)

**Vercel AI SDK**
- "Generative UI is the process of connecting the results of a tool call to a React component." Tools declare a Zod `inputSchema`. The client renders message `parts` typed `tool-${toolName}` according to their state: `input-available` shows loading, `output-available` renders `<Weather {...part.output} />`, `output-error` shows `errorText`. (docs) — [AI SDK: Generative UI](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces)
- There is a separate server-side approach that streams React components with `createStreamableUI` (`@ai-sdk/rsc`). (search snippet) — [AI SDK: Rendering UI with LLMs](https://ai-sdk.dev/docs/advanced/rendering-ui-with-language-models)

**Vercel Labs json-render (2026)**
- A catalogue is declared with `defineCatalog`: components with Zod `props` and a `description`, plus `actions`. "You set the guardrails, AI generates within them"; "AI can only use components in your catalog". The vendor also claims "JSON output matches your schema, every time". `catalog.prompt()` generates the system prompt and "Includes component descriptions, props schemas, available actions". Specs use a flat format: a root key plus a map of elements, each with `type`, `props` and `children` IDs. Specs stream progressively through `createSpecStreamCompiler`, and props can bind to state with expressions such as `$state`, `$cond` and `$computed`. The README examples include no chart component. (spec/README) — [GitHub vercel-labs/json-render](https://github.com/vercel-labs/json-render) ([README](https://cdn.jsdelivr.net/gh/vercel-labs/json-render@main/README.md)); coverage: [InfoQ](https://www.infoq.com/news/2026/03/vercel-json-render)

**Google A2UI (v0.9.1; v1.0 is now current)**
- "The set of available UI components and functions is defined in a Catalog." "The server must generate messages that conform to the catalog understood by the client." A custom catalogue lets you "restrict the agent to using exactly the components and visual language that exist in your application". The client announces `supportedCatalogIds` and can send `inlineCatalogs`. (spec) — [A2UI spec v0.9.1](https://a2ui.org/specification/v0.9.1-a2ui/)
- The protocol has four messages: `createSurface`, `updateComponents`, `updateDataModel` and `deleteSurface`. Components are "a flat list" linked by ID references, with exactly one component whose ID is `root`. Data bindings use JSON Pointers. On errors, the client renders "skipping invalid references", and the spec recommends validating generated output against the schema and sending the error back to the LLM with code `"VALIDATION_FAILED"`. Third-party summaries say unknown component types are rejected, but the fetched spec text does not say so explicitly. (spec) — [A2UI spec v0.9.1](https://a2ui.org/specification/v0.9.1-a2ui/)
- The A2UI Basic Catalog has **no chart component**. It contains Text, Image, Icon, Video, AudioPlayer, Row, Column, List, Card, Tabs, Divider, Modal, Button, CheckBox, TextField, DateTimeInput, ChoicePicker and Slider. (spec) — [A2UI spec v0.9.1](https://a2ui.org/specification/v0.9.1-a2ui/)
- The Python `a2ui-agent-sdk` loads catalogues and generates system prompts that teach the LLM to produce valid A2UI JSON. (search snippet) — [GitHub google/A2UI](https://github.com/google/A2UI)

**OpenAI ChatKit widgets**
- "Widget layouts use a strict, simplified JSX dialect that only allows specific components and props". The root types are `Card`, `ListView` and `Basic`. Whether a Chart widget exists, and what props it takes, was not verified. (docs; search snippet and fetched API page) — [ChatKit Python: widgets concept](https://openai.github.io/chatkit-python/concepts/widgets); [ChatKit widgets API](https://openai.github.io/chatkit-python/api/chatkit/widgets)

**AntV MCP Server Chart / GPT-Vis**
- The server exposes one MCP tool per chart type (for example `generate_area_chart`, `generate_bar_chart`, and `generate_spreadsheet` for tables and pivots). Each returns an image URL rendered by the GPT-Vis service, which can be self-hosted as GPT-Vis-SSR. A `DISABLED_TOOLS` environment variable removes tools from the catalogue. READMEs disagree on the count (15+ vs 25+ charts). (search snippet) — [MCP registry entry](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.antvis%2Fmcp-server-chart/versions/0.9.6); [mcpservers.org](https://mcpservers.org/servers/antvis/mcp-server-chart)

**Observed AI chart UIs (Mobbin)**
- **Square AI thread:** an inline chart card ("Daily Sales Trend", two series), followed by narrative bullets quoting numbers, with the footer "AI can make mistakes. Please check responses." (observed) — [Mobbin](https://mobbin.com/screens/65884407-23a3-43b4-8992-13cad699bca8)
- **Searchable agent:** an inline chart card with title, subtitle and overflow menu, plus a "Used tools (2 tools)" disclosure before the narrative. (observed) — [Mobbin](https://mobbin.com/screens/31bf6d79-192c-446a-948d-ab7fd3e1c9cc)
- **Pipedrive "Insights AI Report":** the chat question on the left and a standard, editable report object on the right, with filters, a chart-type icon bar, "Segment by", "View by … Monthly", Save/Cancel, and Helpful/Not helpful feedback. Caption: "Powered by AI. Results may be inaccurate." (observed) — [Mobbin](https://mobbin.com/screens/d77bd5e0-94fc-4078-9c3f-178f987b33d1)
- **Langdock:** charts come back as static images (a radar chart) in an image carousel. (observed) — [Mobbin](https://mobbin.com/screens/8e084e8b-3d61-41f9-8230-104462b21dc2)
- **Rox:** the account report is generated as a "Static Website" artifact with KPI cards and a bar chart, plus a Publish button. (observed) — [Mobbin](https://mobbin.com/screens/b352f022-e416-4a9d-af25-09ada9e5a884)
- **Databricks Genie:** a result table (row count, download, "Show code", "Add as instruction") and a bar chart, followed by "Is this correct? Yes / Fix it / Request review". The feedback chips are "Values look off", "Missing expected columns", "Genie made up a definition" and "Wrong visualization". (observed) — [Mobbin](https://mobbin.com/screens/d69dc3ab-9b7a-4bc2-9aba-1f4d60f206f3)

### Inferences
- Code-generated or free-form visuals (ChatGPT, Claude inline, Gemini) can draw anything, but every number and every style comes from the model, and vendors hedge (Google's "occasional inaccuracies", Claude's ephemeral visuals). An analytics product needs auditable numbers, so the relevant precedent is the catalogue pattern: Pipedrive's report object, Genie, PostHog insight types, and the Vega-Lite output of Google's CA API. **[our call]**
- Background knowledge, not re-verified in this pass: ChatGPT data analysis draws charts by running Python. That fits the "static image unless interactive-supported" behaviour documented above.
- In pure chat products the documented way to change a chart is to ask again: the ChatGPT help center says so explicitly, Claude "tweaks" on follow-up, Looker CA uses follow-ups, and PostHog updates the insight "in place". BI-grade assistants add direct editing: Genie's edit pane, Pipedrive's chart icon bar. Compass should support both. The switcher would change the widget spec locally, with no LLM round-trip, and the changed spec would go back into Kassandra's context so the next turn respects the override. **[our call]**
- None of the generic catalogues ships a chart component (the A2UI Basic Catalog and the json-render core examples have none). Chart components are domain entries the application defines, which is the role of Compass's catalogue. **[our call]**

### Gaps
- The charting stack of Claude Artifacts (React and the libraries available to it) was not verified in this pass, and the rendering technology behind Claude's inline visuals is undocumented.
- The Gemini app's ordinary in-chat charts (outside Canvas and dynamic view) are not documented in the sources reached.
- Perplexity has no primary documentation of its chart pipeline.
- The props of the ChatKit Chart component are unverified; widgets.chatkit.studio was not fetched.
- Julius AI was not researched.

## Q3. What does research on automated visualization recommendation show? Which rules or constraints work best, and where do LLMs fail?

### Takeaway
The field moved from rules (APT and Show Me, then CompassQL's enumerate-and-rank) to constraints (Draco: hard and soft constraints whose weights are learned from perception experiments), then ML (VizML, Data2Vis, DeepEye), then LLM pipelines (LIDA, ChartGPT, NL4DV-style JSON specs). The best-supported approach puts empirically grounded design knowledge in deterministic constraints and uses the model to interpret intent. LLMs' own design preferences "substantially diverge" from guidelines based on human experiments (DracoGPT). On benchmarks LLMs fail roughly 25–50% of the time: GPT-4 passes 75% on VisEval, and frontier models score under 50% on DV-World. The main failure classes are invalid code, wrong data transformations (aggregation), wrong chart type or encoding, missing or wrong sorting, and readability. Charts with three visual channels, irrelevant tables in the context, and ambiguous queries all make results worse.

### Cited Findings
- **CompassQL / Voyager 2.** A query is a Vega-Lite-like `spec` containing "enumeration specifiers (or wildcards)", plus grouping, ranking and config. The engine "contains a collection of constraints for enumerating a set of candidate visualizations". `"chooseBy": "effectiveness"` picks the top encodings, and `groupBy`/`nest` group the results. CompassQL "powers chart specifications and recommendations in Voyager 2". (spec) — [GitHub vega/compassql](https://github.com/vega/compassql)
- **Draco** (Moritz et al., InfoVis 2018 Best Paper, TVCG 2019):
  - It represents a visualization as a set of logical facts and design guidelines as hard constraints (which must hold) and soft constraints (preferences whose weights trade off importance).
  - It is implemented in Answer Set Programming and solved with Clingo; the optimal answer set is translated into Vega-Lite.
  - The weights can be learned directly from the results of graphical-perception experiments, which improved suggestions compared with a hand-tuned model.
  
  (paper pages, search snippets) — [UW IDL: Draco](https://idl.uw.edu/papers/draco); [CMU DIG: Draco](https://dig.cmu.edu/publications/2018-draco.html); [UW News](https://news.cs.washington.edu/2018/11/05/draco-a-constraint-based-model-for-formalizing-principles-of-good-visualization-design-earns-best-paper-at-infovis-2018/)
- **Draco 2** (Yang, Gyarmati, Zeng, Moritz, 2023) adds "a more flexible visualization specification format", a test suite and documentation, and APIs for integrating it into visualization systems. (paper) — [arXiv 2308.14247](https://arxiv.org/abs/2308.14247)
- **DracoGPT** (Wang, Gordon, Battle, Heer; IEEE TVCG / VIS 2024) uses two pipelines, Rank and Recommend, to model LLM preferences in Draco. Findings: "DracoGPT can accurately model the preferences expressed by LLMs"; the two pipelines "moderately agree with each other"; "both substantially diverge from guidelines drawn from human subjects experiments". (paper) — [arXiv 2408.06845](https://arxiv.org/abs/2408.06845)
- **VizML** (Hu, Bakker, Li, Kraska, Hidalgo; arXiv 2018) trains on "one million dataset-visualization pairs" and predicts five design choices, including visualization type and x/y axis. Its performance is "comparable to human performance when predicting consensus visualization type" and exceeds other ML-based systems. (paper) — [arXiv 1808.04819](https://arxiv.org/abs/1808.04819)
- **Data2Vis** (Dibia & Demiralp, IEEE VDS'18) frames chart generation as "a sequence to sequence translation problem" from dataset to Vega-Lite (an LSTM with attention). It learns valid vocabulary and syntax and transformations such as count, bin and mean. The evaluation is qualitative only. (paper) — [arXiv 1804.03126](https://arxiv.org/abs/1804.03126)
- **DeepEye** (Luo, Qin, Tang, Li; ICDE 2018: 101–112) generates and ranks candidate visualizations. The SIGMOD 2018 demo pitches it as a way to create good visualizations "simply like a Google search". The details of its ranking method were not verified. (bibliography, search snippet) — [DBLP](https://dblp.dagstuhl.de/rec/conf/icde/LuoQ0018.html)
- **LIDA** (Dibia, ACL 2023 demo) has four modules:
  - Summarizer, which "converts data into a rich but compact natural language summary";
  - Goal Explorer;
  - VisGenerator, which "generates, refines, executes and filters visualization code";
  - Infographer.

  It generates code that is not tied to a particular charting grammar. (paper) — [arXiv 2303.02927](https://arxiv.org/abs/2303.02927)
- **NL4DV** (Narechania, Srinivasan, Stasko; IEEE VIS 2020) returns "an analytic specification modeled as a JSON object containing data attributes, analytic tasks" plus Vega-Lite specs relevant to the query. (paper) — [arXiv 2008.10723](https://arxiv.org/abs/2008.10723)
- **ChartGPT** (Tian et al.; TVCG 2024 DOI) splits generation into "a step-by-step reasoning pipeline", one sub-task per run. It is fine-tuned on "a dataset consisting of abstract utterances and charts", and its interface lets users check and change the intermediate output of each step. (paper) — [arXiv 2311.01920](https://arxiv.org/abs/2311.01920)
- **nvBench 2.0** (NeurIPS 2025, Datasets & Benchmarks track) contains 7,878 queries, 24,076 visualizations, 780 tables and 153 domains. Ambiguity is injected so that each query has several valid interpretations, each linked to step-wise reasoning paths. The original nvBench mapped each query to a single visualization, and one version of the paper says it ignores more than 60% of real-world ambiguous cases. Their Step-nl2vis model is state of the art on the ambiguous task. (paper, search snippets) — [arXiv 2503.12880](https://arxiv.org/abs/2503.12880); [NeurIPS poster](https://neurips.cc/virtual/2025/poster/121665)
- **VisEval** (Chen, Zhang, Xu, Ren, Yang; arXiv 2024): 2,524 queries over 146 databases, checked for validity, legality and readability. (paper) — [arXiv 2407.00981 (HTML)](https://arxiv.org/html/2407.00981)
  - **Error categories:**
    - invalid code, including "hallucinated data columns";
    - illegal data transformation, i.e. wrong aggregation (for example, not removing duplicates before counting);
    - illegal visualization transformation: wrong chart type, overlapping bars, improper mapping, missing or incorrect legend;
    - illegal order: sorting missing or by the wrong criterion;
    - low readability: floating-point year ticks, inverted y-axis, overflowing axis titles, typos.
  - **Results (Matplotlib):**

    | Model | Pass | Invalid | Illegal |
    |---|---|---|---|
    | GPT-4 | 75.27% | 3.29% | 21.44% |
    | GPT-3.5 | 61.79% | — | — |
    | Gemini-Pro | 51.59% | — | — |
    | CodeLlama-7B | 28.17% | — | — |

  - With Seaborn, GPT-4's invalid rate rises to 25.41% and its pass rate falls to 58.70%; the authors attribute this to less pre-training data.
  - Charts with three channels (stacked bars, grouped lines, grouped scatter) score lower.
  - Adding two irrelevant tables cut GPT-4's pass rate by 9.41 points, so the authors suggest selecting the needed tables before generating.
- **DV-World** (Meng et al., April 2026) has 260 real-world tasks across spreadsheets, evolving artifacts and interactive intent alignment, scored by table-value alignment plus an MLLM judge. State-of-the-art models reach "less than 50% overall performance". (paper) — [arXiv 2604.25914](https://arxiv.org/abs/2604.25914)
  - Snippet only, unverified: the paper names "Wrong Chart Type" as an error category. Layout & Readability accounts for 42.43% of errors on average, and Data Consistency for 31.98%. (search snippet) — [arXiv PDF](https://arxiv.org/pdf/2604.25914)
- **PlotCraft (2025):** its judge flags charts that don't follow the requested type, for example bubble charts whose bubbles are all the same size and so don't encode the amount. (search snippet) — [arXiv 2511.00010](https://arxiv.org/pdf/2511.00010)
- **GPT-3.5 evaluation** (Li et al., 2024): failures from misunderstanding data attributes and from grammar errors. (search snippet) — [arXiv 2401.11255](https://www.arxiv.org/pdf/2401.11255)
- **Industry corroboration (Hex):**
  - When the agent saw only an image of the chart, it "confidently hallucinated the date of the highest peak". Hex's fix is the "agent accessibility principle": give the agent several views (overall look, specific data points, underlying structure).
  - Hex adapted VisEval's three-stage gates for its own evals, with one prompt per expected chart type, phrased as what/why rather than how.
  
  (vendor blog) — [Hex: cloned visualization team](https://hex.tech/blog/cloned-visualization-team/)

### Inferences
- **What works best for Compass is a hybrid.** The LLM classifies the analytic task, as in NL4DV's "analytic tasks" and ChartGPT's step decomposition. A deterministic resolver holds the design knowledge as hard and soft constraints in the style of Draco (plain TypeScript rules are enough at Compass's scale) and picks the chart kind. Empirical rules should outrank the model's taste, per DracoGPT. **[our call]**
- **Compass's architecture removes VisEval's two biggest structural failure classes by design.**
  - Invalid code disappears because there is no code generation.
  - Illegal data transformation disappears because SQL tools compute the aggregates. This holds only if the widget spec refers to tool results by ID and never contains literal numbers.
  
  The risks that remain are the wrong intent or chart kind, the wrong metric or dimension binding, sort order, too many series, and ambiguous periods (nvBench 2.0). They can be handled with enums, defaults, a lint pass, and a clarifying question or alternative suggestions when a query is ambiguous. **[our call]**
- **"Too many series".** VisEval shows quality falls on charts with three channels. A hard cap (top-N plus "Other", or small multiples) is an engineering rule, not a research result. **[our call]**
- **Ambiguity.** nvBench 2.0 suggests offering valid alternative interpretations, for example through the chart switcher or suggestion chips, rather than silently forcing one. **[our call]**
- **What Kassandra sees.** LIDA's compact data summary and Hex's accessibility principle argue that Kassandra should see a compact summary of each tool result: columns, cardinalities, row count, min/max per measure. It should not see a rendered image, and it should not need raw rows in order to choose a chart or write its narrative. **[our call]**

### Gaps
- No quantitative study was found specifically on LLMs plotting too many series, or on invented numbers in catalogue-constrained chart specs. The closest evidence is VisEval's "hallucinated data columns" and Hex's anecdote.
- Not fetched: the Voyager (2016) paper. Verified only from abstracts or snippets: Draco's weight-learning procedure, DeepEye's ranking method, and LIDA's error rates. VisEval's arXiv page lists it as a preprint; publication at a venue was not confirmed.

## Q4. Spec formats: Vega-Lite vs a raw ECharts option vs a small typed catalogue. How do teams validate specs and keep charts visually consistent?

### Takeaway
Vega-Lite is the shared chart language of research and of Google's AI products. It is a concise grammar with a JSON schema and themes through `config`, but production teams find it too verbose for LLM latency. A raw ECharts option is powerful, but its style keys are spread across the whole option, and the LLM would have to emit the data arrays. Hex, the team with the most public production evidence, moved to a small app-specific "chart stub" with enumerated options that compiles to Vega-Lite. Average latency fell from 10.3 s to 1.3 s, and a cheaper model kept roughly 80–90% accuracy. Validation happens in layers: the schema at generation time (Claude strict tool use or structured outputs; json-render and A2UI validation), then semantic linting (AVA's linter, Draco's hard constraints), then renderer-owned theming (Vega-Lite `config`, ECharts `registerTheme` and palettes, Power BI themes).

### Cited Findings
- **Vega-Lite** is "a high-level grammar of interactive graphics" with "a concise, declarative JSON syntax". It compiles to Vega and "determines default properties of these components based on a set of carefully designed rules". It has a versioned JSON schema (v6). (docs) — [Vega-Lite](https://vega.github.io/vega-lite/)
- **Vega-Lite theming.** "Vega-Lite's `config` object lists configuration properties of a visualization for creating a consistent theme" (mark, axis and range schemes). (docs) — [Vega-Lite config](https://vega.github.io/vega-lite/docs/config.html)
- **Vega-Lite as the target of AI chart systems:**
  - Google's CA API, and Looker CA (Q1);
  - NL4DV outputs Vega-Lite; Data2Vis generates it; Draco translates its answer sets into it; CompassQL specs follow its structure (Q3).
- **Hex's production experience** (vendor blog) — [Hex: Making AI charts go brrrr](https://hex.tech/blog/making-ai-charts-go-brrrr/):
  - With GPT-4, Vega-Lite or native-spec output "could take *minutes* to stream back", and "GPT-4 could not reliably generate our native chart spec".
  - Hex built "a simpler abstraction on top of it that was more ergonomic and flexible, but still compiles down to Vega-Lite", about 5x fewer lines and tokens.
  - The "chart stub" started at 35 keys covering about 90% of the features people use, and was later cut to 10 features.
  - Enumerated options (e.g. `kind`: `bar` | `grouped_bar` | `stacked_bar`) turn generation into "a multiple choice question".
  - Results:
    - GPT-4 Turbo with the 35-key stub was about 90% correct in under 5 s.
    - GPT-3.5 on the full stub was "barely better than a coin flip".
    - GPT-3.5 on the 10-feature stub was about 80% correct at about 1 s.
    - Average latency went from 10.3 s to 1.3 s.
  - Removing titles brought streaming down to 0.7 s but accuracy down to 72%. Hex calls early titles "chain of thought lite".
  - Generating each key in parallel "doesn't always perform well".
  - Hex measures quality with 100 hand-written evals that use relaxed assertions.
- **ECharts theming.** The handbook shows the built-in dark theme (`echarts.init(dom, 'dark')`). Other themes are loaded and registered with `echarts.registerTheme(...)` for JSON themes, while JS themes register themselves; the Theme Builder makes new ones. Palettes can be global or per series. Styles are spread across `itemStyle`, `lineStyle`, `areaStyle`, `label` and `emphasis`. (docs) — [ECharts handbook: style](https://echarts.apache.org/handbook/en/concepts/style/)
- **The model's familiarity with the target format matters.** In VisEval, GPT-4's invalid-code rate went from 3.29% with Matplotlib to 25.41% with Seaborn, attributed to less pre-training data. (paper) — [VisEval](https://arxiv.org/html/2407.00981)
- **Typed catalogue frameworks:**
  - json-render: Zod props per component, a generated prompt, a flat spec.
  - A2UI: catalogue IDs, schema validation, `VALIDATION_FAILED` errors fed back to the model.
  - AI SDK: a tool's `inputSchema` maps to a component.
  - AntV MCP: one typed tool per chart type.
  
  (spec/docs) — [json-render](https://github.com/vercel-labs/json-render); [A2UI spec](https://a2ui.org/specification/v0.9.1-a2ui/); [AI SDK](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces); [AntV MCP](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.antvis%2Fmcp-server-chart/versions/0.9.6)
- **Claude API structured outputs** (docs) — [Claude: Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs):
  - Two modes: JSON outputs (`output_config.format`) and strict tool use (`strict: true`), which "Guarantee[s] schema validation on tool names and inputs" through "grammar-constrained sampling".
  - Supported: `enum`/`const`, `anyOf`/`allOf`, `$ref`/`$defs`, `required`, `additionalProperties: false`, and string formats such as `date`, `date-time` and `duration`.
  - Not supported, rejected with a 400: recursive schemas, `oneOf` (use `anyOf`), `not`, numeric constraints (`minimum`/`maximum`), string-length constraints, and array constraints beyond `minItems` 0 or 1.
  - SDK helpers move unsupported constraints into field descriptions and validate the response against the original schema.
  - The first use of a schema adds grammar-compile latency. Compiled grammars are cached for 24 h. Changing the schema structure or the set of tools invalidates that cache, and changing `output_config.format` invalidates the prompt cache.
- **Current Claude models.** On Opus 5.5, Sonnet 5.5 and Fable 5.1/5.2, forced `tool_choice` (`any`/`tool`) returns a 400. The recommended pattern is `auto` + `strict: true` + an instruction naming the tool, or structured outputs. With `eager_input_streaming` enabled, the API no longer validates tool input, so the client must validate it against the schema. (Anthropic's bundled claude-api reference, cached 2026-11-03; not re-checked on the live page) — [Claude tool use overview](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
- **Semantic linting beyond the schema.** AVA's Linter (e.g. "Difference should be big enough for pie sectors") and Draco's hard constraints check whether a schema-valid spec is a sensible chart. (spec/paper) — [AVA chart-advisor](https://www.npmjs.com/package/@antv/chart-advisor); [Draco](https://dig.cmu.edu/publications/2018-draco.html)
- **Consistency in products:**
  - Power BI Q&A visuals "support themes", for example a report-wide "Colorblind safe" theme (docs) — [MS Learn: Q&A visual](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-q-and-a)
  - ThoughtSpot keeps each value's color across searches and chart types within a session, and admins can restrict the available chart types (docs) — [ThoughtSpot charts](https://docs.thoughtspot.com/cloud/latest/charts)

### Inferences
- **Comparing the three formats for Compass.** **[our call]**

  | | Vega-Lite generated by the model | Raw ECharts option generated by the model | Small typed catalogue (recommended) |
  |---|---|---|---|
  | LLM familiarity | High; the lingua franca of research and of Google CA | High, but the option surface is huge | Taught through the schema and descriptions; Hex shows small enumerated specs beat larger ones |
  | Tokens and latency | Verbose (Hex: minutes with GPT-4) | Verbose; must carry the data arrays | Minimal (Hex: about 1 s) |
  | "Model never computes numbers" | Breaks it: Vega-Lite `transform`/`aggregate`/`bin` let the model compute | Breaks it: data arrays and number formatting come from the model | Holds: the spec points to `resultId` from the SQL tool and contains no numbers |
  | Strict-schema compatibility | Poor: the schema is large and recursive (layer/concat), and Claude strict mode rejects recursion | Poor: enormous, loosely typed surface | Good: flat, `anyOf` discriminated on a `kind` const, enums |
  | Style consistency | Inline styling unless stripped; the `config` theme helps | Style keys everywhere, so drift is likely | Renderer owns every token; the model never emits colors |
  | Expressiveness | High | Very high | Limited by design; a table component is the escape hatch |
  | Testing and evals | Hard to diff | Hard | Easy: snapshot specs, eval set of one prompt per kind (Hex) |

- **A sketch of the Compass spec.** **[our call]**

  ```ts
  // anyOf union discriminated by `kind`; all ids are enums generated from the metric registry (SQL views)
  type Widget =
    | { kind: 'kpi';   title: string; metric: MetricId; range: RangeRef; compare?: CompareRef; resultId: string }
    | { kind: 'line';  title: string; metric: MetricId; grain: 'day'|'week'|'month'; range: RangeRef;
        compare?: CompareRef; breakdown?: DimensionId; topN?: 3|5|10; resultId: string }
    | { kind: 'bar';   title: string; metric: MetricId; dimension: DimensionId; sort: 'desc'|'asc'|'natural';
        topN?: 5|10|20; resultId: string }
    | { kind: 'table'; title: string; columns: ColumnRef[]; resultId: string };
  ```

  - Put `title` first, following Hex's "chain of thought lite" finding.
  - Write numeric bounds as enums (`topN: 3|5|10`), not `minimum`/`maximum`, because strict mode rejects numeric constraints.
  - Avoid recursion and `oneOf`.
  - The Angular renderer compiles a widget to ECharts (or Vega-Lite) options and applies the theme tokens.
- **Validation pipeline.** **[our call]**
  1. Strict tool schema on the Claude call.
  2. Re-validate on the client with Zod. This is required when `eager_input_streaming` is on.
  3. Semantic lint:
     - the metric exists and is compatible with the kind;
     - a time kind has a grain;
     - series ≤ N;
     - part-to-whole only for additive metrics with ≤ ~5 parts.
  4. Data-aware resolution after the SQL result is in:
     - 1 row → KPI;
     - more than N categories → top-N bar or table;
     - 0 rows → empty state.
  5. If rendering fails, fall back to the table.

  Lint failures go back to Kassandra as tool errors, in the A2UI `VALIDATION_FAILED` style.
- **Theming.** The model never emits colors or styles. The renderer maps semantic roles (current vs comparison period, hotel vs comp set, positive vs negative delta, forecast band) to design tokens, and keeps each entity's color the same across widgets, as ThoughtSpot does. **[our call]**

### Gaps
- No public head-to-head benchmark of LLM accuracy on Vega-Lite vs ECharts vs a custom DSL was found. The closest evidence is Hex's internal numbers and VisEval's Matplotlib-vs-Seaborn gap.
- Whether ECharts publishes an official JSON schema for its options was not verified.
- Google does not document how it validates the CA API's Vega-Lite output ("no explicit statements about validating chart output").
- The live Anthropic page on forced `tool_choice` behaviour was not re-checked; that claim comes from the bundled reference.

## Q5. Interaction patterns: chart-type switcher, "show as table", drill-down, pin to dashboard, "how this was computed"

### Takeaway
Mature analytics products converge on five pieces of chrome around a chart:
1. A chart/table toggle that is always available.
2. A chart-type switcher limited to compatible types, where unavailable types are disabled and explain what they need.
3. Disclosure of how the answer was produced: "How was this calculated?", "Show code", analysis steps, fields used.
4. Save or pin to a dashboard. This often first requires turning the AI result into a standard object, and Power BI shows the pitfall of chart types reverting when pinned.
5. Structured feedback that includes "wrong visualization".

AI chat products mostly rely on asking again instead.

### Cited Findings
**Chart-type switcher**
- Metabase opens a visualization sidebar, with charts that don't fit listed under "More charts". (docs) — [Metabase](https://www.metabase.com/docs/latest/questions/visualizations/visualizing-results)
- ThoughtSpot's "Change visualization" palette greys out unavailable types, and hovering shows the columns they need. (docs) — [ThoughtSpot](https://docs.thoughtspot.com/cloud/latest/charts)
- Tableau marks the recommended type with an orange outline, and hovering a type shows its minimum requirements. (docs) — [Tableau](https://help.tableau.com/current/pro/desktop/en-us/buildauto_showme.htm)
- Genie: the edit button opens an editing pane with a "Visualization" drop-down. (docs) — [Databricks](https://docs.databricks.com/aws/en/genie/talk-to-genie)
- Power BI Q&A: the type is named in the question, or the result is converted to a standard visual. (docs) — [MS Learn](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-q-and-a)
- ChatGPT: users ask for a type in the prompt and toggle between interactive and static. (search snippet) — [OpenAI Help](https://help.openai.com/en/articles/8437071-data-analysis-with-chatgpt)
- Switchers seen in other products:
  - Better Stack: a "Visualize as" grid (Line, Bar, Pie, Scatter, Gauge, Number, Table, Heatmap, Text, plus a disabled "Live tail"). (observed) — [Mobbin](https://mobbin.com/screens/5263d82e-3550-4cbb-8280-e3fafc9ddeae)
  - Zendesk Explore: a palette of 23 types that includes an explicit "Auto" option. (observed) — [Mobbin](https://mobbin.com/screens/8f15ac15-37aa-4376-b9c1-d7dafee29930)
  - Hotjar Trends: a "Line ▾" dropdown on the chart card. (observed) — [Mobbin](https://mobbin.com/screens/065aa61a-616d-402e-93d0-db33c6d3abb3)
  - HubSpot: a grid of chart-type icons in a settings panel. (observed) — [Mobbin](https://mobbin.com/screens/577f59b8-99cc-4e12-a306-1c6de47909b6)
  - Wix: tabs "Line Chart | Bar Chart Split | Table". (observed) — [Mobbin](https://mobbin.com/screens/ba2f76db-6d83-4698-8a50-1091bd34fbd1)
  - Databricks dashboards: a "Visualization" dropdown on each widget. (observed) — [Mobbin](https://mobbin.com/screens/1c655a48-3bdf-4f8b-a07a-4726553316f1)
  - Hex: a "Type: Grouped column" selector with Data and Style tabs. (observed) — [Mobbin](https://mobbin.com/screens/0fad8049-83ed-4b19-a2b5-0310e0d43e80)
  - Pipedrive's AI report: a chart-type icon bar. (observed) — [Mobbin](https://mobbin.com/screens/d77bd5e0-94fc-4078-9c3f-178f987b33d1)

**Show as table**
- Metabase toggles between the visualization and the table of results. (docs) — [Metabase](https://www.metabase.com/docs/latest/questions/visualizations/visualizing-results)
- Genie returns a visualization plus a result table, and the visualization can be collapsed ("Show visualization" brings it back). (docs) — [Databricks](https://docs.databricks.com/aws/en/genie/talk-to-genie)
- Looker CA responses "might include a visualization, a data table, or other details". (docs) — [Looker CA](https://docs.cloud.google.com/looker/docs/studio/conversational-analytics-looker)
- ThoughtSpot admins set whether answers open as a table or a chart. (docs) — [ThoughtSpot](https://docs.thoughtspot.com/cloud/latest/charts)
- Wix has a "Table" tab next to the chart tabs; HubSpot shows "Summarized Data / Unsummarized Dataset" tabs under the chart. (observed) — Mobbin screens above

**Comparison and time controls** (observed)
- Hotjar: range presets (24h, 7d, 15d, 30d, 3m, 6m, 12m) and "Compare with…".
- Wix: a previous-period overlay ("Compared to Jul 8 – Aug 6, 2024").
- HubSpot: "Comparison" and "Reference line: Goal".

Mobbin links are in the switcher list above.

**Drill-down and refinement**
- ThoughtSpot drill-downs keep the chart type. (docs) — [ThoughtSpot](https://docs.thoughtspot.com/cloud/latest/charts)
- The Power BI Q&A visual cross-filters and cross-highlights other visuals on the page. (docs) — [MS Learn](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-q-and-a)
- Genie shows the applied filters and lets users edit them. (docs) — [Databricks](https://docs.databricks.com/aws/en/genie/talk-to-genie)
- Looker CA has "Open in Explore". (docs) — [Looker CA](https://docs.cloud.google.com/looker/docs/studio/conversational-analytics-looker)
- PostHog follow-ups update the insight in place. (docs) — [PostHog](https://posthog.com/docs/product-analytics/analyze-data-ai.md)
- Pipedrive has "Segment by" and "View by" controls. (observed)

**Pin or add to dashboard**
- Genie: a dashboard button offers "Create new dashboard" or "Add to existing dashboard". (docs) — [Databricks](https://docs.databricks.com/aws/en/genie/talk-to-genie)
- Power BI: convert the Q&A result to a standard visual, then pin it. (docs) — [MS Learn](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-q-and-a)
  - Q&A visuals pinned without converting revert to their default type. (community) — [Fabric Community](https://community.fabric.microsoft.com/t5/Service/Dashboard-Visual-keeps-changing/m-p/4403129)
- ThoughtSpot defines an Answer as "a saved search that can be used in a Liveboard". (docs index) — [ThoughtSpot llms.txt](https://docs.thoughtspot.com/llms.txt)
- PostHog AI can "build full dashboards" and "create alerts on trend metrics". (docs) — [PostHog](https://posthog.com/docs/product-analytics/analyze-data-ai.md)
- Hotjar has an "Add to dashboard" menu (Pinned / Dashboards / New dashboard); Pipedrive has "Save". (observed)

**How this was computed (provenance)**
- Looker CA:
  - "How was this calculated?" gives a plain-text explanation of the raw field names, calculations, filters and sort order.
  - A **Code** tab shows generated Python for advanced queries.
  - "Show reasoning" is available in Thinking mode.
  - "Analytical details" show the generated Looker queries and the underlying data tables.
  
  (docs) — [Looker CA](https://docs.cloud.google.com/looker/docs/studio/conversational-analytics-looker)
- Genie: "Show code" shows the generated SQL. "Analysis" expands into "Understanding the question", "Found relevant data", "Referenced SQL example" and "Thinking steps". (docs) — [Databricks](https://docs.databricks.com/aws/en/genie/talk-to-genie)
- Power BI Copilot: a text summary lists the fields used to build or filter the visual. (search snippet) — [MS Learn](https://learn.microsoft.com/power-bi/create-reports/copilot-ask-data-question)
- ThoughtSpot says search tokens, generated SQL, API payloads and analytical logic are exposed at every step. (vendor page, search snippet) — [ThoughtSpot trust](https://www.thoughtspot.com/trust/agentic-analytics)
- Tableau Pulse: deterministic facts are the "ground truth" for the LLM summaries. (docs) — [Tableau Pulse](https://docs.salesforce.com/tableau/current/en-us/online/pulse_insights_platform_insight_types.md)
- Searchable shows a "Used tools" disclosure. (observed) — [Mobbin](https://mobbin.com/screens/31bf6d79-192c-446a-948d-ab7fd3e1c9cc)

**Feedback and export**
- Genie: feedback options "Yes", "Fix it", "Request review". Users can download PNG or CSV (about 1 GB limit) and copy to the clipboard. (docs) — [Databricks](https://docs.databricks.com/aws/en/genie/talk-to-genie)
  - The feedback chips seen include "Wrong visualization", "Values look off" and "Genie made up a definition". (observed) — [Mobbin](https://mobbin.com/screens/d69dc3ab-9b7a-4bc2-9aba-1f4d60f206f3)
- Pipedrive: Helpful/Not helpful, and "Powered by AI. Results may be inaccurate." (observed) — [Mobbin](https://mobbin.com/screens/d77bd5e0-94fc-4078-9c3f-178f987b33d1)

### Inferences
- **Minimum widget chrome for Compass.** **[our call]**
  - A title, with the period and comparison as a subtitle.
  - A chart/table toggle.
  - A switcher limited to the kinds compatible with the result shape. Disabled kinds explain why, as in ThoughtSpot and Tableau, and an "Auto" option returns to the default, as in Zendesk.
  - A "How this was computed" panel that lists:
    - the metric definition, from the metric registry;
    - the SQL tool and its parameters;
    - filters;
    - period and comparison;
    - row count and data freshness.
    
    It should show these facts, not Kassandra's raw reasoning, in the style of Looker and Genie.
  - Pin or add to dashboard, persisting the *spec* (not an image) and re-running the tool when the dashboard loads. This avoids Power BI's revert-on-pin problem.
  - Feedback with a "wrong chart" chip that feeds the eval set, as Genie does.
- **Stickiness.** Keep the chart kind across follow-ups unless the new result is incompatible, and keep each entity's color stable across widgets (ThoughtSpot). Any manual switch should be a local change to the spec that is recorded in the conversation, so Kassandra doesn't revert it on the next turn. **[our call]**
- **Drill-down in Compass** can reuse the same catalogue. Clicking a bar or point emits a structured follow-up such as `{drill: {dimension, value}}`, which goes to Kassandra or straight to the SQL tool, rather than free text. **[our call]**

### Gaps
- Few AI chat products document drill-down. ThoughtSpot Spotter's chart-specific UI (switching, pinning, provenance) is not described on the fetched Spotter page.
- ChatGPT's table interactions (expand, sort) were not verified.
- The interaction patterns of the Microsoft Fabric data agent and Julius AI were not covered.
- The Mobbin observations show that a UI exists, not how it behaves or what it is called internally.
