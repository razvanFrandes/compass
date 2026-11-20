# Decisions

These are the decisions made so far, in the discussion phase (2026-11-20). No code has been written yet. Each entry gives the choice and the reason.

## Decided

| Area | Choice | Why |
|---|---|---|
| Repo | New repo `compass-mvp`, separate from the POC | Clean history. The POC stays as a reference at `/Users/razvan/Web/compass`. |
| Public access | **No login.** Same-origin check on mutating calls, per-client rate limits and a **daily budget** for all visitors (Budget Durable Object). Price and channel actions are always high risk. Details: `docs/security.md`. | Reviewers must try the demo without signing up, and the owner's model spend must stay bounded. A visitor can still change demo state; nothing outside Compass changes. |
| Framework | Angular 22 (standalone, signals, zoneless) + Tailwind CSS v4 | Same as the POC. Juyo's own product is built in Angular. |
| Component kit | **Spartan UI** (spartan.ng: brain + helm), not Zard | Preferred by the user. More mature: about 3k stars, in the Thoughtworks Radar "Assess" ring. It already ships AI-oriented helm components: `message`, `message-scroller`, `bubble`, `attachment`, `code-block`, `trace`, `questionnaire`, `skeleton`, `sonner`, `command`. |
| Icons | **Not Lucide.** The lead candidate is **Phosphor** (`@ng-icons/phosphor-icons`, MIT); the alternative is Hugeicons Pro | Lucide is on every shadcn-style app. Phosphor's 6 weights work as a system: Light for navigation, Regular for actions, Fill or Duotone for the active state. Spartan already renders icons through `ng-icons`, so swapping sets is cheap. |
| Generative UI runtime | **Hashbrown** (`@hashbrownai/angular`, with its Anthropic adapter) | Angular-native: signals, `exposeComponent()`, `uiChatResource`, and streaming JSON. It renders our own components. |
| Generative UI model | A strict **component catalog** (KPI strip, metric chart, table, comparison, occupancy calendar, insight, action proposal, form, empty state). Add a sandboxed iframe escape hatch only if it is ever needed. | Consistent, premium and accessible. Matches JUYO_CONTEXT §8.3: one spec shared by people and the AI. |
| Data in generated UI | The model emits **queries/metric references, never numbers**. Components fetch their own data. | No hallucinated numbers, and widgets stay live. |
| Skeletons | Every catalog component has a **skeleton with identical dimensions**. There are 3 phases: component chosen → skeleton; props streaming → fill in progressively; data loading → skeleton only on the data area. Show it for at least ~300 ms, use a subtle shimmer, and respect `prefers-reduced-motion`. | Perceived speed and no layout shift. |
| Semantic search (RAG) | **Reviews only**, as `find_reviews`: Workers AI `@cf/baai/bge-m3` (1024 dims) over review sentences in pgvector, next to the data | Numbers stay in SQL: a metric must be computed exactly from sums, and a nearest-neighbour lookup can only approximate it. RAG is for unstructured text, where the question is "what do guests say about X?" and the wording varies. The vectors sit in the same Postgres as the reviews, so one query filters by hotel and period, then ranks by meaning and counts mentions. |
| Charts | Our own chart **spec** sits between the model and the library. The leading renderer is **ECharts 6**. Spartan's chart, which is built on TanStack Charts 0.16, gets a visual bake-off. | The library can be swapped without touching prompts. TanStack Charts is still young. |

## Open (to discuss next)

1. What to carry over from the POC: the domain only, or also the backend (Hono, PGlite, Claude pipeline, Cloudflare deploy)?
2. The MCP server over the data, which is a Juyo bonus point. Where does it sit relative to Hashbrown's tool calling?
3. The Claude models to use, and where the Hashbrown backend runs (Worker or Container).
4. Visual direction: dark-first or light-first, the font (Geist or Inter 4, with tabular numbers), the accent color, and which Spartan style to start from.
5. Final icon pick: Phosphor (free) or Hugeicons Pro ($49).
6. Scope against the deadline. See `JUYO_CONTEXT.md` §1 and §10.

## Known friction to check during setup

- Spartan helm's peer range is `@ng-icons/*` 32–33 (the latest is 36), and its repo still develops on Angular 21.2. Expect small version fixes.
- Spartan's CLI depends on Nx. Check that it works in a plain Angular CLI workspace.
- Hashbrown is still 0.x (v0.5, July 2026), so keep it behind a thin layer of our own.

## Interaction model (2026-11-20)

The model is **Inbox → Thread → Board**, which maps Juyo's Ask → Analyze → Act. v2 of the preview is built this way; v1 is kept for comparison.

- **Inbox** is the home screen: answers ranked by money, with agents' approval requests in the same list and live KPIs (Pulse) beside it. Sources: Tableau Pulse digest; GitLab and Cloudscape notification and approval rules.
- **Thread** has the conversation on the left and the artifact it produced on the right, with "How this was computed" and the chart spec. Sources: Claude Artifacts, ChatGPT Canvas, Mistral canvas; Power BI, Looker and Genie for "show your work".
- **Board (Canvas)**: "Add to board ▾" lets the user choose the board, then a toast offers View and Undo. Boards can also be built by describing a view. Sources: ThoughtSpot "Pin to Liveboard", Power BI, Databricks Genie.
- **Phone**: inbox, bottom tabs and a full-screen thread.
- v1 (a dashboard with an assistant docked on the right) is the "SaaS with AI added" pattern that Juyo says it is moving away from.

## Visual direction and data access (2026-11-20, after the UI research)

- **Colors: Juyo's palette.** Colors are sampled from the screenshots of the Juyo mobile app on Google Play and from their app CSS (`docs/research/ui-refinement/juyo_brand.md`).
  - Dark-first: ink `#0D1117`, surfaces `#161C22` / `#1E2429` / `#2A2E33`.
  - Purple: Juyo's `#996AD5`. Buttons use `#8556C9` so white text passes AA (5.0:1).
  - Chart current period: blue `#477EE3` (lightened to `#5B8DEB` for contrast).
  - Chart comparison period: purple `#9685E4`.
  - Teal `#32BEBF`.
  - "Needs your decision": orange `#FE7637`.
  - Every text token passes WCAG AA (4.5:1) and every chart token passes 3:1. Changes always carry ▲/▼ as well as color.
- **Font: Inter**, chosen for legibility in dense numeric UI, with tabular figures. Juyo's Aeonik is commercial; Raleway's digits don't line up in columns.
- **Read-only.** Juyo states Kassandra "runs on an isolated analytics database — never your live production systems", and agents that act are "Coming Soon". In Compass, approving a recommendation logs the decision and sends it to the revenue manager as an RMS task. No data is ever written.
- **Tooltips**: 600 ms show delay, 100 ms hide, and a skip-delay group. They appear only on icon-only buttons and never on touch (NN/g, Radix, Base UI, Primer). Spartan's default is 0 ms.
- **Boards**: a list of rows (name, purpose, one live KPI with sparkline, freshness), not thumbnails. All analytics tools researched do this. There is no "pin" concept: Juyo doesn't have one, and neither do we.
- **Mobile**: touch targets of at least 44 px on coarse pointers, inputs at 16 px, a frozen first column in tables, and no horizontal overflow.

## Buttons, boards and the ask bar (2026-11-20)

- **Buttons follow Meta's Astryx** (github.com/facebook/astryx: `Button.tsx`, `tokens.stylex.ts`):
  - heights 28/32/36/40 px and an 8 px radius, not pills;
  - medium-weight labels;
  - hover and press drawn as a 6% / 11% overlay;
  - press scales to 0.98 only with a mouse (never on touch or with reduced motion);
  - 175 ms transitions.
- **Boards are cards by default** (Astryx `ClickableCard`: 12 px radius, 1px border, the whole card is the click target, overlay on hover and press). A grid/list toggle keeps the list. NN/g: cards suit a small set of different items with a visual preview; lists are better for scanning by name. Hex and Zoho offer the same toggle.
- **Ask bar**:
  - the edge uses Juyo's Kassandra gradient (#6FA0FB → #A78CFB → #EB75BE);
  - a microphone button starts voice input;
  - while listening, the bar becomes a voice surface: a waveform and glow that follow the voice (Web Audio), a live transcript (Web Speech API), and the question is sent when you stop, like Google voice search;
  - this follows Google's direction from dots towards arcs, waveforms and glowing gradients (9to5Google, Android Authority, 2025–2026);
  - Esc cancels;
  - with no microphone it plays a demo labelled "demo transcript".

## Round 3: calm ask bar, voice orb, rate calendar, watcher cards, brief (2026-11-20)

The feedback on round 2: the gradient ask bar was too loud, the decision table looked generic, and Watchers and Inbox were "lists again". Each change below comes from the notes in `docs/research/ui-round3/`. **This section replaces the ask bar described in the previous section.**

- **Ask bar: calm at rest** (`voice_and_composer.md` Part A).
  - None of the 23 composers examined on Mobbin has a gradient or animated border, at rest or on focus.
  - Compass: 56 px tall, 12 px radius, `#1E2429` fill, hairline border, a 1 px purple focus border with a soft ring.
  - Inside the bar: a small Kassandra orb mark, ⌘K, and a mic. Send appears only when there is text.
- **Voice: a 3D orb that reacts to the voice** (`voice_and_composer.md` Part B).
  - Products are moving voice inwards and making it smaller: ChatGPT shows voice inside the thread, Gemini Live uses a pill, and Siri on iOS 27 uses a small orb.
  - What reacts is mostly scale and internal motion speed. The ElevenLabs open-source Orb maps mic volume to radius and opacity.
  - Compass shows a WebGL "Kassandra orb": a fragment-shader sphere with simplex-noise flow and a fresnel rim in Kassandra's gradient.
  - Mic level is computed with Web Audio as RMS → dBFS, smoothed with a 60 ms attack and 300 ms release. It drives size (+11%), surface flow speed and rim brightness. Hue stays fixed.
  - Desktop: the bar expands in place. Phones: a full-screen sheet built as a native modal `<dialog>`, so it sits above the tab bar, and Esc or the Android back gesture cancel.
  - The live transcript comes from the Web Speech API. Reduced motion freezes the orb, browsers without WebGL get a CSS orb, and without a mic a "demo transcript" plays.
- **Nights that need a decision: one dataset, two views, one panel** (`tables_and_rate_calendar.md` Parts A–C).
  - **Decision list:** 56 px two-line rows and one primary value per row. The orange "needs a decision" dot is the only accent. On the books vs LY is a bullet bar (Few); the last column is the amount at stake.
  - **Rate calendar.** This is how hotel RMS tools show the future (RoomPriceGenie, Mews/Atomize, PriceLabs, IDeaS; heat calendars in Duetto, FLYR and Lighthouse).
    - Occupancy is a 5-step single-hue blue fill. Each cell shows BAR and the recommended price with an arrow; ✦ marks an event and an orange dot marks a pending decision.
    - On phones it keeps 7 columns with one value per cell, as Turo, Skyscanner, IHG and IDeaS do.
  - **Night panel** (420 px sheet; a full page on phones) shows:
    - the recommendation and its range;
    - the reasons, the pace curve against last year and the market strip;
    - a sticky Accept / Adjust / Keep, with "Keep" asking for a reason;
    - where the numbers came from.
- **Watchers are cards with a run strip** (`agents_pattern.md`).
  - Cards, because the watchers differ in cadence, output and state, and rows flatten that (Cloudscape, Gemini Enterprise, Zapier, n8n, Manus, Gumloop; NN/g).
  - Each card shows the latest finding, a strip of the last 14 runs, the next run and the autonomy level. The run strip follows Sentry Crons; tall ticks mean a finding, so the strip reads without color.
  - "On/Paused" (the switch) is kept apart from how the last run went (the chip and the strip).
  - Raising autonomy asks for confirmation first. Lowering it is immediate and offers Undo.
  - **Open decision A:** the third level, "Acts within limits", is shown locked because Compass never writes rates. The alternative is to hide it.
  - **Open decision B:** watchers do not auto-pause after repeated failures. They show "Couldn't run" and keep their schedule.
- **Inbox becomes a morning brief** (`insight_feed.md` §5).
  - The hero has a date and "generated" stamp, a one-sentence AI headline, stake chips (at risk / upside / needs your decision) and the ask bar.
  - Three insight cards follow, each with one direct-labelled chart: pace vs LY (dashed LY line), pickup bars with the event shaded, and a 100% channel bar with an LY tick. The decision card is the only orange object on the page.
  - Pulse is a sticky 2×2 rail on desktop and compact 2×2 tiles above the cards on phones.
  - Sources: Tableau Pulse, Robinhood Digests, Perplexity Finance, Copilot Money, Monarch, Ramp.

## Watcher page and create flow (2026-11-20)

This completes the Watchers spec in `docs/research/ui-round3/agents_pattern.md` (§5.2–5.8).

- **Each watcher has its own page.** The card's title links to it, and the rest of the card is clickable too through a stretched link; the switch, the autonomy control and the buttons remain separate targets.
  - It is a full page, not a drawer, because run history and settings need room.
  - Order on the page:
    - the header (Run now, the on/off switch and ⋯);
    - the pending decision, pinned (Approve and log task / Adjust / Dismiss, then a receipt with Undo);
    - four stat tiles: last run, next run, findings, and "You agreed" (Ramp's agent alignment);
    - run history, with an activity timeline and settings below it.
  - **Run history:**
    - The strip shows 30, 90 or all runs and uses the same encoding as the card.
    - Each bar is a button, but the strip is a single tab stop and the arrow keys move between runs. A tooltip shows the date, the outcome and the duration.
    - Clicking a bar narrows the run log to that run and expands its steps (Checkly, n8n, Browserbase).
  - **Settings** are sections on the same page: schedule (day circles and a time), scope, threshold, autonomy, notifications (default: "Only when it needs you or can't run") and the data it reads (read-only).
- **New watcher has three ways in and one way out** (§5.8):
  - **Describe it to Kassandra.** She asks at most two questions ("1 of 2", recommended option first): which nights, and how far it may go.
  - **Start from a template.**
  - **Set it up manually.**
  - Every path ends on a review card: the watcher in one sentence, the first run in bold, the autonomy level and one authorization line. Nothing is created until "Create watcher".
  - New watchers start at Alerts only or Recommends, never higher (Ramp, Relevance, Linear).
- **Activity** on the Watchers page is a timeline: nodes joined by a rail, and on desktop the days sit side by side (Render event timeline, Cloudscape). "Add a watcher" is a row of template cards with their schedule (Unify, Gemini).
- **The ⋯ menu** holds View run history, Edit settings, Ask about this watcher, Pause until…, Duplicate and Delete. Delete offers Undo instead of a confirmation.
- **Fix: the page no longer scrolls sideways on phones.** The hero glow pushed the layout viewport to 446 px on a 430 px phone. It now stays inside the screen, and `main` clips horizontal overflow as a safety net.
- **Checks:** a headless smoke test (playwright-core with the system Chrome) runs against the dev server and the production build. It covers the watcher page, the strip with keyboard, approve, the create flow, Esc, and phone layouts with an overflow probe on five views. It found no console errors.

## Real data and a quieter UI (2026-11-20)

The feedback: too many colours, too much text, and the data should come from the database.

- **The prototype now runs on `compass_hotels`** (Halcyon Hospitality Group, business date Fri 20 Nov 2026), as decision D5 requires. Fagus is gone from it.
  - The data comes from read-only SQL into one generated module (`halcyon-data.ts`, built by `extract.py`).
  - The morning brief runs **the backend's own detector SQL** from `apps/worker/src/application/brief-detectors.ts` and ranks the results the same way: a broken data feed first, then by money.
  - It currently finds 8 items: Berlin POS stale, New York account loss −€1.34M, Miami GOP −€164k, Barcelona out of order −€115k, Amsterdam mobile conversion −€82k, Bali kitchen −€53k, Dubai Business Bay underpriced +€43k, Lisbon pace −€38k. When the backend adds a detector, the brief picks it up on the next extract, and the UI shows its facts generically until it gets its own card.
  - Night-level views (board, rate calendar, night panel, decision) follow **Tessera Dubai Business Bay**: Gulf Tech Week (15–19 Dec) is missing from its pricing calendar, so story S6 becomes today's decision.
    - The rule is the same as the detector's: under 0.85× the median while busy.
    - The recommendation is each night's comp-set median: 16 Dec €266, 17 Dec €228, 18 Dec €216 (AED shown alongside).
    - The upside is a ceiling: up to +€4.6k on the 84 rooms still unsold.
  - The night panel shows real values for booking curves (`otb_as_of`, this year vs the same weekday last year), pickup over the last 7 days and the competitors' latest shopped rates (3 of 4 are sold out on 16 Dec). Before, these were approximations.
  - Every thread's "How this was computed" shows the detector's real SQL.
- **Colour budget:**
  - Data: one hue, Juyo blue. Last year is a neutral grey dashed line, as in Stripe's previous-period lines.
  - Orange only for "needs your decision". Red only for a broken feed or a failure.
  - Purple only for actions and selection.
  - Money and deltas are neutral, with ▲/▼. Watcher marks (glyphs, run strip, meter, timeline) are neutral. The user's chat bubble is grey.
  - Measured on the first desktop screen (1440 px): Inbox went from 5 hue families to 3, and the board from 5 to 2. Coloured marks on Watchers went from 30 to 12.
- **Less text:**
  - Inbox cards have a title, one fact and a chart. The eyebrows, explanation paragraphs and starter chips are gone.
  - Watcher cards show only the latest finding, the run strip and the schedule; what the watcher checks has moved to its page.
  - The four smaller brief items are compact tiles: a label and a sparkline.
- **Watchers are built on the stories:** Rate vs comp set (S6, needs a decision), Pace vs last year (S1 Lisbon) and Data feeds (S7 Berlin). The templates are Corporate accounts (S2), Web conversion (S4) and Staffing vs workload (S3).

## Filters and the chart catalogue (2026-11-20)

Built from stages 1 and 2 of the report `docs/research/reports/Filtre și grafice pentru Compass.md`. Everything lives on a new **Portfolio** board (all 20 Halcyon hotels). The data comes from read-only SQL in `extract_portfolio.py`, which writes `portfolio-data.ts`.

- **One filter state for the whole app** (`filters.ts`): hotels, stay nights, comparison, segment and channel. The state lives in the URL, so a link reopens the same view.
  - **Three controls are always on the bar** (hotels, stay nights, comparison), two are promoted (segment, channel), and "+ Filter" lists the dimensions planned next.
  - Under the bar, one line spells out the resolved scope: the dates, the comparison dates, and the time the data was as of. Reset appears only when the filters differ from the defaults.
  - **Comparisons depend on the dates:** "same time last year" only for future nights, "last year, same weekday" only for past ones. Options that don't fit are disabled and say why.
  - **Phones** use one bottom sheet per filter, applied in one batch with "Show results". Desktop popovers apply live.
- **Kassandra changes the filters the same way people do.** Asked "Dubai hotels, next 90 nights vs budget", she sets the filters and leaves a receipt ("Kassandra set 3 filters…") with Undo.
  - The prototype parses the request deterministically. In the product, the model calls a `set_filters` tool with the same shape.
- **Budget on future nights is compared with the forecast, not with today's bookings.** The budget is a finished-month number, so on-the-books against budget mostly measures nights that haven't been sold yet (−50 pts that mean nothing). KPI tiles say "Forecast ▲ +5.7 pts vs budget", and chart titles name both numbers.
- **The chart catalogue is a typed `ChartSpec` plus a resolver** (`portfolio.ts`). The resolver turns a spec and the filters into:
  - a statement title;
  - the scope line;
  - the compatible views;
  - the definitions and SQL;
  - the ECharts option.
  
  The chart types are:
  - **Pace:** occupancy by night with the P10–P90 forecast band.
  - **Position:** a bullet row per hotel, with forecast P50 as the track and ticks for STLY and budget. When only one hotel is selected, it collapses to a KPI.
  - **Index:** an ARI × MPI quadrant, labelling the hotels furthest from parity first.
  - **Channel mix:** net of commission.
  - **Segment share:** the donut is allowed only for 2–5 slices with "Other" last; otherwise bars.
  - **October GOP bridge:** budget to actual, with a visible axis break.
  - **Hotel table.**
- **Every chart uses the same card** (`chart-card.ts`):
  - a statement title and a scope line;
  - Chart/Table;
  - "Show as", limited to compatible views. The others are disabled and say why, e.g. "Occupancy isn't parts of one whole".
  - "How this was computed": definitions plus SQL;
  - "Add to board"; "Wrong chart".
- **When a chart can't follow a filter, it says so with a badge:**
  - "All segments" on charts whose data isn't split by segment;
  - "Own dates: last 30 nights" for comp-set indices, which need actuals;
  - "Own dates: October" for the monthly P&L.
  
  Opening the badge lists the filters with the ignored ones struck through.
- **ECharts 6 with its own themes** (`compass-dark` and `compass-light`). Colours come from the design tokens. A theme switch calls `setTheme`, so charts aren't rebuilt. Charts use the SVG renderer and modular imports. The card passes its width to the chart, so phones get truncated names and sparser ticks; the full names stay in the tooltip and table.
- **Limits, honestly:**
  - stay nights are presets only; there is no custom date range yet;
  - segment and channel apply only to the mix and share charts;
  - "+ Filter" dimensions aren't wired;
  - the initial bundle is 1.8 MB (ECharts plus 240 KB of extracted data).
- **Checks:** headless Chrome against the dev server and the production build. It covers the filter popovers, the phone sheet, the receipt and Undo, the card menu, Add to board, the segment badges, past ranges, the light theme, and phone overflow (0 px). It found no console errors.
