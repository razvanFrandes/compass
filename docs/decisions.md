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
  - **The orb itself was replaced: see "The orb morphs" below.**
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

## The orb morphs: `<juyo-orb>` (2026-11-20)

The feedback on the Round 3 orb: "a dot that inflates and that's it". **This section replaces the orb described in Round 3**; the mic level, the ask bar and the phone sheet stay as they were.

- **What it is.** A 3D sphere whose surface morphs, with plasma flowing inside the glass, a fresnel rim in Kassandra's gradient and trails around it. The trails borrow the idea behind the MilkDrop visualiser: each frame is the previous frame zoomed, turned, wave-warped and faded, plus the new one.
- **One component, four inputs:** `<juyo-orb [state] [level] [bands] [size]>` in `apps/web/src/app/orb/`. The Kassandra composer hosts it with exactly these inputs.
  - `state`: `idle` | `listening` | `thinking` | `speaking`.
  - `level`: loudness, 0..1. `bands`: optional frequency bands, 0..1 each, any length. `size`: pixels.
- **What each state does.**
  - Idle: a slow breathing morph.
  - Listening: the voice drives it. Bass bulges the body, mids ripple the surface, highs light arcs on the rim, and a waveform ring leaves ripples in the halo.
  - Thinking: calmer. The surface twists into a spiral, the orb turns and the trails wind around it.
  - Speaking: rings travel over the surface in the rhythm of speech. It follows `level` if one is given.
  - Changing state cross-fades every parameter in about 0.4 s. Nothing jumps.
- **Colour stays on brand.** Blue upper left to pink lower right, like the mark. The colour cycle sways inside the gradient and never leaves it. Trails cool from pink to blue as they fade.
- **Raw WebGL2, no three.js.** The whole renderer with its shaders is 7 kB gzipped and loads on demand, outside the main bundle. The orb is one mesh and three passes, which did not justify a 3D library.
- **Restraint was the hard part.** Early versions looked like a brain, then like a rock. What fixed it: low noise frequencies (two or three broad lobes, not many small ones), most of the voice's bulge carried by spherical harmonics (smooth by construction), one ripple train instead of two crossing ones, and no particles.
- **Microphone:** `orb/mic-analyser.ts` turns a `MediaStream` into `level` and `bands` signals (RMS → dBFS, 60 ms attack, 300 ms release, eight log-spaced bands from 80 Hz to 8 kHz). Sound is measured in the page and never leaves it.
- **Behaviour at the edges.**
  - Pixel ratio capped at 2 and the canvas at 1024 px. It stops drawing when off-screen or when the tab is hidden, and frees its GL objects when destroyed.
  - A lost WebGL context shows the CSS orb and rebuilds when the context returns.
  - Reduced motion: one still frame per state with a slow opacity pulse (WCAG 2.3.3).
  - No WebGL2: a CSS gradient orb.
  - It is decorative (`aria-hidden`), so the state must also be said in text next to it.
- **`/orb-lab`** is a page to try it: state, level, bands, size, the microphone, and a simulated voice for machines without one. It is not linked from the navigation.
- **Open:** `app/orb.ts` (the Round 3 orb) is no longer used. Delete it, and `.orb-fallback` in `styles.css`, once the Kassandra composer has merged.

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

## Hotel scope, the builder's pickers and Agent Studio (Round 2, 2026-11-20)

Plan items A4, A5 and A6 (`docs/plan-round2.md`), against `docs/round2-contracts.md` §1 and §5.

- **One scope for the whole app** (`apps/web/src/app/scope`).
  - `ScopeService.hotels()` holds hotel codes; an empty list is the whole group. It lives in the address (`?hotels=LIS,PAR`), so a link carries it, and in local storage, so it is there on the next visit. The address wins over what was stored.
  - Back and Forward change the place, not the scope: the scope is written again on the address they land on.
  - The brief, the decisions waiting on a person, the audit log and the list of workflows are filtered on the client by hotel code. A workflow for the whole group is always in scope.
  - A new workflow starts on the scope: the builder sends it as its first edit when the draft arrives untouched.
- **The hotel picker is one component** (`HotelPicker`), used by the sidebar switcher, the chip in page headers and the builder's Hotels step.
  - An ARIA combobox that keeps its listbox open: focus stays in the search box and `aria-activedescendant` names the option the arrow keys are on.
  - Quick picks are the whole group, each region and each brand. A region or a brand adds its hotels, or removes them when they are all in. The hotels are listed under their region; the brand is the first word of each name, and typing a brand filters to it.
  - A pick applies at once, so the page behind follows. On a phone the picker is a bottom sheet, and the search box does not take the focus, because the keyboard would cover half the sheet.
- **Hotels come from `GET /api/hotels`.** Until that endpoint is deployed, and whenever it cannot be reached, the app uses a built-in list of the 20 Halcyon hotels behind the same `ScopeService.catalog()`. A test checks that the list agrees with the embedded data.
- **The builder is edited by hand without typing codes.**
  - The Hotels step opens the picker. The node shows names ("Lisbon Chiado + 2 more"), not codes.
  - Any Check step opens the list of labelled checks (`CHECK_LABELS`), each with a line on what it reads. The placeholder opens it too, so a check can be chosen without the chat.
  - **Editing** is `/workflows/<id>/edit`. The builder opens a new draft with `&workflow=<id>` and Save updates that workflow. The address of a saved email workflow arrives masked: an empty field keeps it, and a new address is saved as a new workflow, as before.
- **"Agent Studio" is the one name** for what was Watchers and Workflows, in the navigation, the titles and the buttons. Its address is `/studio`; `/watchers` still opens it.
  - Each workflow is a card: how the last run went, the latest finding, a strip of the last 14 runs, the next run, the switch and the autonomy level.
  - A run is a finding when it proposed something or sent its mail. A test always sends its mail, so a test's mail is not a finding.
  - The next run is computed from the 05:00 UTC schedule in `docs/api.md` and shown in the reader's time zone.
  - The ⋯ menu has Edit, Duplicate, Pause or Resume, and Delete. Delete asks first, with Cancel in focus.
  - **Raising autonomy asks first; lowering it is immediate and offers Undo.** This closes the rule from Round 3 on the live workflows.
  - A paused card recedes with a dashed edge instead of lower opacity, so its text keeps its contrast.
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

Built strictly from stages 1 and 2 of `docs/research/reports/Filtre și grafice pentru Compass.md`, after a first pass that drifted from it: pace drawn as occupancy by night, no pickup, a donut as the default for the mix, and grey comparisons. Everything lives on the **Portfolio** board (all 20 Halcyon hotels). The data comes from read-only SQL in `extract_portfolio.py`, which writes `portfolio-data.ts`.

**Stage 1: one filter state**
- **One `FilterState`** (`filters.ts`) for the bar and for Kassandra. It lives in the URL with short parameters (`?h=lis,opo&stay=next30n&cmp=stly&seg=corp&ch=!ota&booked=7d`).
- **Bar:**
  - Permanent: [Hotels] [Stay dates] [vs …]. Promoted: [Segment] [Channel]. Then [+ Filter] and Reset.
  - Under the bar, one line resolves the dates, the comparison dates and the time the data was as of.
- **Stay dates:**
  - Upcoming and Past groups, each option showing its resolved dates.
  - "Year to date" is disabled with its reason: the extract starts in August.
- **Compare:** STLY, last year same weekday, last year same date, previous period, budget, forecast, none.
  - The default depends on direction: STLY for future nights, last year same weekday for past nights.
  - Options that don't fit are disabled and say why. For example, "previous period" for future nights would compare bookings with finished nights.
- **Hotel selector:**
  - Search by name, city or brand.
  - "All hotels (20)", and groups by Region or Brand with tri-state checkboxes and counts.
  - "Only" on each row, and a "12 of 20 selected · Clear" footer.
  - The trigger reads "Europe (8)" or "Tessera (5)" for a whole group.
- **Segment and channel:** support "is / is not". Once set, they read as tokens with their own remove button ("Channel is not Booking.com, Expedia").
- **"+ Filter"** is a command list of dimensions. Booked (the booking window) works and becomes a removable token. Room type, rate plan, length of stay and source market are listed but disabled: they aren't in the extract.
- **Kassandra's receipt:** each change shows before → after in the bar's own words, with the source:
  - "(you said “next 90 nights”)" for a typed request;
  - "(clicked New York Midtown)" for a chart drill.
  
  It has Undo and Edit filters. The changed pills glow once, and a status region announces the update.
- **Answers:** every quantitative answer carries one line of scope chips. "Apply to dashboard" turns that scope into filters, with the same receipt.
- **Phones:** the bar is [Hotels] [Stay] [vs] [Filters · N]. Each opens a bottom sheet with Clear and "Show results", applied as one batch.

**Stage 1: chart contract and colour**
- **Typed `ChartSpec`** (`portfolio.ts`): it names the question (`kind`), never numbers or colours. A deterministic resolver returns:
  - a statement title and a scope line;
  - the compatible views, with the reason for each one that isn't;
  - the table, the badge, the definitions and the SQL.
- **Standard card** (`chart-card.ts`):
  - Chart/Table.
  - "Show as" with **Auto** (and why Auto picked that view) plus the compatible views. A manual choice says "your choice · Back to Auto".
  - How this was computed: definitions, scope, freshness, SQL.
  - Add to board (saves the spec), and Wrong chart.
  - A badge when a filter can't apply. Clicking it gives the read-only list with the ignored filters struck through.
  - Clicking a mark sends a structured drill (`{ dimension, value }`), answered from the same specs.
- **Colour (report):**
  - The current period is blue and solid.
  - The comparison is purple, dashed or as a tick (`--series-cmp`: #9685e4 on dark, #7a68d8 on light; 5.5:1 and 4.4:1).
  - Budget is a neutral, labelled reference.
  - The forecast is hatched (ECharts decal).
  - Everything else is grey: at most two accents per chart.
  - Rates change in pp, money in %.
- **KPI tiles:** the value, the delta against a named base, the base itself with its dates ("STLY 51.4% · 22 Nov – 21 Dec 2025"), and a sparkline with the comparison dashed.
- **Budget on future nights is read against the forecast,** not against today's bookings. The budget is a finished-month number.

**Stage 2: the catalogue**
- **V1 Position:** bullet rows as % of budget, with the chain total on top. On the books is solid, with a hatched extension to P50. The comparison is a purple tick and budget sits at 100%. The text reads "€1.58M · −€52k vs STLY · 63% of budget". Rows are sorted by where each hotel lands against budget.
- **V2 Pace:** room nights on the books for the window, by booking date, as of each day.
  - This year is solid; same time last year is purple and dashed.
  - "Today", capacity, and a P10–P90 band to the last night. The band follows last year's pickup shape, which "How this was computed" states.
  - The counting rule matches `otb_as_of()`, so it agrees with the KPI tiles.
- **V3 Pickup:** booked above zero, cancelled below, last year's net as a dashed step.
  - Weekends and city events are shaded; Gulf Tech Week shows for Dubai.
  - The booking window is the "Booked" token, 7 days by default.
- **V9 Forecast fan:** on the books as bars, P50 dotted, P10–P90 shaded, and budget as a reference.
  - P25–P75 isn't stored in `forecasts`; "How this was computed" says so.
- **V8 Net mix:** net solid, commission hatched, last year's net as a tick.
- **Segment share:** sorted bars on a % axis by default. A donut is offered only through the gate: 2–5 slices after grouping, "Other" not the largest, the top two at least 5 pp apart. The largest slice starts at 12 o'clock and is the only accent.
- **V7 ARI × MPI quadrant:** centred on 100, with the RGI = 100 isocurve and named quadrants (winning share, volume-led, rate-led, losing share). Labels are kept for the hotels furthest from parity.
- **V12 GOP bridge:** budget is outlined and actual is solid. Steps are coloured by their effect on GOP, and the axis break is drawn on the totals.
- **V16 Hotel table:** chain total first, with an in-cell occupancy bar and a sparkline per hotel.
- **Charts that can't follow a filter say so:**
  - pickup and fan show an empty state with "Show next 30 nights" for past dates;
  - the quadrant shows "Own dates: last 30 nights" for future dates;
  - the P&L shows "Own dates: October".

**Limits**
- The stay dates have presets only; there is no custom date range.
- Optional dimensions beyond Booked aren't extracted.
- Request parsing is deterministic and stands in for a `set_filters(patch)` tool.
- The initial bundle is 2.2 MB, because the extract is embedded. The build budget was raised to 3 MB for the prototype.

**Checks:** headless Chrome against the dev server and the production build. It covers every chart and the filter flows (receipt, Edit, Undo, tri-state groups, tokens, "is not"), the drill and "Apply to dashboard", past ranges, the light theme and the phone sheet. Phone overflow is 0 px, and there are no console errors.

## Round 2 backend: scope, evidence columns, workflow edit, voice (2026-11-21)

- **Hotel scope is a working mode, not a permission.** There is no login, so the scope a question carries is checked (known hotels only, names from the database) and enforced in code on every data tool, but anyone may pick any scope. Under a scope a call for hotels outside it is refused with a message for the model rather than answered with other hotels' rows; a partly-outside call reads the inside hotels and says which were left out. `run_readonly_query` must return `hotel_code` and is filtered on it: best effort, and documented as such.
- **The scope travels with the question** and is applied like the mode: a question sent while an answer runs keeps that answer's scope. Its codes are kept in the conversation object's storage, so a run that resumes after an eviction reads the same hotels.
- **Column metadata lives next to the tool catalog** (`presentation/tools/tool-views.ts`), not in SQL comments or in the UI: one place says a tool's title and what each row property is. A test runs every tool against the database and fails on a property without a column. `percent` always means "already in percent"; `pickup_pct`, a 0–1 share the model reads, stays a `number` with a unit that says so rather than being relabelled.
- **Editing a workflow reuses the builder.** `&workflow=<id>` loads the saved workflow into an empty draft and binds the draft to it; the existing save rules then do the rest (same recipient → update, another → new workflow). The recipient stays masked on the socket until the person types another one, because workflow ids are public and a draft id is not.
- **Delete keeps the record.** A deleted workflow's runs, proposals and audit entries stay, marked `deletedWorkflowName`. Delete is refused while a run is going or a proposal waits: that run still needs its workflow. The templates are created once, so deleting them all leaves an empty list.
- **First runs on first use** instead of a deploy hook: the first read of the workflows or the proposals starts the first run of each brief-triggered workflow that never ran, once, from the `workflow_run` budget, never for an email workflow. It gives the Inbox a real proposal without a second cron or a manual step after a deploy.
- **Voice:** Soniox real-time (`stt-rt-v6`, English and Romanian among its languages) with temporary keys minted by the Worker: single use, 120 s to connect, 180 s of audio, 10 per minute per client and 300 a day. The browser connects straight to Soniox, so audio never passes through the Worker.

## Round 2 backend: widgets in answers and boards on the server (2026-11-20)

**Widgets (`show_widget`)**
- **The model names data, it does not carry it.** The tool's arguments are a kind, a title, the id of an earlier data tool result (`sourceCallId`) and column keys. The server reads that result from the Pi transcript and copies its rows, columns and evidence into the tool result as `widget`. So a widget cannot show a number that no tool returned.
- **The model learns the id from the tool result.** Every data result Kassandra reads ends with `Result id: <callId>`. We do not rely on the provider showing tool call ids to the model.
- **The server checks that the kind fits the rows** (`application/widgets/fit.ts`, one rule per kind): pie and donut only for 2–7 parts of a whole (percentages must add up to 100), line and area only over an ordered x, funnel only over stages that shrink, one row per bar, and so on. A refusal is a sentence that says what to do instead, so the model corrects itself in one turn.
- **No row filter in the tool.** When a result has the wrong shape (a row per hotel where one row is needed), the model calls the data tool again narrower. That keeps the widget's rows identical to a tool result, with its SQL as evidence.
- **The spec is normalised by the server:** only the fields the kind uses, and `format` from the column.
- **Limits:** 200 rows per widget; 4 widgets per answer on the server, 3 in the prompt (a board view may use 4).
- **Quick mode offers `show_widget`** and takes 5 turns instead of 4: showing a widget is a tool round of its own, and it must not cost the answer.
- **Column metadata:** a widget uses the columns its data tool names in the evidence (contracts §2). Until every tool does, `application/widgets/columns.ts` reads kinds and labels from key names and values. Only keys with `eur` are money: rates in local currency stay plain numbers.

**Boards**
- **One `Boards` Durable Object for the group,** like `Briefs` and `WorkflowAgents`. A board's summary and each widget are separate values, so listing boards reads no rows.
- **A board widget is a copy** (spec, rows, columns, evidence, the question), not a live query. It shows what the answer showed, with its evidence. Refreshing a widget against today's data is not built.
- **The same fit rules guard the board:** a widget posted to a board is checked like one from `show_widget`.
- **Sample boards are seeded from the database on first use,** through the catalog tools, with periods relative to the business date: "Portfolio overview", "Dubai Business Bay", "Amsterdam web". A widget whose tool fails is left out; if nothing can be built, seeding is tried again a minute later. A deleted sample board stays deleted.
- **Writes are public and bounded:** same-origin, 60 per minute per client, a daily `board_write` budget, and hard limits (50 boards, 24 widgets, 200 rows, 256 KB per widget).
- **"Describe a view" has no endpoint of its own.** The client asks Kassandra with the prefix "Build a board view:" and posts the widgets of the answer to the board. A prompt section makes that prefix return 2–4 widgets and little prose.

**Open**
- Board widgets trust the client for their rows (contracts §4). A stricter API would take `{ conversation, callId }` and copy the widget on the server.
- `EvidenceColumn` is defined once, in `packages/contracts/src/evidence.ts`; widgets and boards import it from there.


## Evidence panel, tables and the resizable split (Round 2, 2026-11-20)

The owner's review: evidence tables overflowed and showed internal names (`hotel_code`, `data_stale:BER:POS`, `hotel.v_hotel_day`, "Get pace · 45"). The code is in `apps/web/src/app/evidence/`.

- **The panel leads with the numbers the answer quotes.** Each number in the final answer is matched to a cell of a tool result (rounded and scaled figures too: "€1.34M" finds 1,336,633) and shown as a button that opens the row it came from. When nothing matches, the panel shows the first figures of each result under "Key figures". A number the model derived in words is not listed, because no row holds it.
- **One card per tool call, closed by default.** The title is the server's `evidence.title`, else a label map ("Pace vs last year"). The period and the business date are written in words. Sources show by name (`sourceLabels`, else a map). Raw source names, the SQL and its parameters are only inside "Technical details".
- **Tables are for reading.** Headers come from the server's `columns` (contracts §2); without them, labels and kinds are inferred from keys and values. Columns of kind `id` or marked `hidden` are behind "Show N internal columns". Hotel codes show as names (`GET /api/hotels`, else the hotel list the app ships with, else the code). Numbers, percentages, money and dates are formatted with tabular figures; numeric columns are right-aligned. The table scrolls inside its card with the first column frozen and a fade on the edge that has more. It starts with 8 rows; "Show all N rows" opens the rest in a box with its own scroll. Headers sort.
- **The frozen column is the one that tells rows apart.** When the first column holds one value for every row (one hotel, 193 stay dates), the first naming column that varies leads instead.
- **The split is a WAI-ARIA window splitter.** Drag the divider; Left and Right move it 2% (Shift: 10%); Home and End go to the limits; Enter folds the evidence away to a rail; double-click resets. The position and the collapse are kept in `localStorage` (`compass.evidence.split`); blocked storage is ignored.
- **Phones get a bottom sheet.** Under 1024 px the evidence is a native modal `<dialog>`: the browser traps focus, Esc closes it, and focus returns to the button that opened it.
- **Open point for the backend:** a percent column whose values are fractions (today only `pickup_pct`, 0.1098 = 11%) needs `unit: 'ratio'` in its column metadata; the frontend already reads it.

## Widget chart catalogue, Round 2 (2026-11-21)

Built from `docs/round2-contracts.md` §2–§3. It sits next to the Portfolio catalogue above and does not replace it: the Portfolio charts answer fixed questions from the extract; these draw whatever rows a tool returned, from a `WidgetSpec` Kassandra chose.

- **One entry point:** `<juyo-widget-chart [spec] [rows] [columns] [compact]>` in `apps/web/src/app/charts/` draws all 21 `WidgetKind`s. Optional `[header]` (off when the host card shows the title) and `[loading]`.
  - **Loading states for generative UI:** `[loading]` is `'none' | 'skeleton' | 'title'`. Kassandra's branch drives it from the streaming tool call.
    - `skeleton`: the whole widget as a placeholder for the spec's kind. The title and subtitle are the real words, invisible, with a bar on each line, so the header already has its final height; before the title has streamed in, two stub lines stand in.
    - `title`: the real title and subtitle, with the chart area still a placeholder.
    - `none`: the widget. Rows that are null or undefined still show `title`.
    - Each kind has its own skeleton in the layout it will have (`widget-skeleton.ts`): bars that lie down or stand up as the chart will, a ring for a donut, an arc for a gauge, rows and columns for a table, tiles for KPIs, bands for a sankey. A pure plan (`builders/skeleton.ts`) decides from the spec what the rows would decide later: bar direction, a legend row, the number of tiles.
    - The body height depends only on the kind, the density and the width, and "View as table" keeps its place in the header in every state, so the box is identical through skeleton → title → loaded (measured for all 23 gallery widgets at 1440, 820 and 390 px, both densities; layout shift during the replay is 0).
    - A soft band of the surface colour sweeps across the shapes (transform only); under `prefers-reduced-motion` it is off and the skeleton is static.
  - `WidgetSpec` and `EvidenceColumn` are mirrored in `charts/widget-types.ts` until `@compass/contracts` exports them; the shapes are identical.
- **Every kind has a pure builder** (`charts/builders/`): rows + columns + spec → an ECharts option, or a view model for the kinds that are HTML (kpi, kpi_row, sparkline_list, table). Builders never fetch and never invent a number; they format by the column's `kind` and `unit`.
  - Percent columns are read as 0–100, which is what the backend sends (`round(100.0 * …, 1)`). A column with `unit: 'ratio'` is read as a fraction.
  - Money is three significant figures on charts (€1.34M, €18.4M, €164k) and in full in tables and tooltips.
- **How each kind reads its spec:**
  - `x` is the category or date, `y` the value columns, `compare` the comparison column, `group` splits long rows into series or parts.
  - Sankey: `x` is the source, `group` the target. Heatmap: `x` the columns, `group` the rows. Treemap: `x` the leaf, `group` its parent. Scatter: `x` and `y[0]` are the two measures, `group` names the points.
  - KPI tiles find their own comparison (`revpar` → `revpar_ly`, `_budget`, …) when the spec has several `y` columns. A fall reads as good news for costs, commissions and cancellations.
  - Waterfall: a `kind`/`type` column marks totals; without one the first row opens and the last row closes when it equals the opening plus the steps.
- **Colour:** the current period is blue, the comparison purple (dashed line, tick or bar), parts take a fixed order of five hues (blue, teal, purple, amber, pink), the sixth is a tint and the rest grey; "Other" is always grey. Magnitude is one blue ramp. Green and red appear only with ▲/▼.
  - Amber and pink are new and live in `charts/tokens.ts`. The five-hue order was checked with the dataviz validator: adjacent colour-blind ΔE ≥ 8, normal-vision ΔE ≥ 15 and ≥ 3:1 against the card in both themes. Juyo's own teal and purple sit outside the validator's lightness band in dark mode; they are kept because they are the brand's.
  - Colours are read from the tokens in effect on the widget's own element, so a subtree with its own theme is drawn in that theme.
- **Honest fallbacks, always with a note:** a pie or donut outside 2–7 parts (or with a negative part) is drawn as bars; flows that loop are shown as a table; an unknown kind is shown as a table; rows that don't fit are cut with "Showing the first N of M rows". No rows gives a sentence, not an empty axis.
- **One value axis, never two.** A bridge whose steps are small next to its totals gets a broken axis, and says so.
- **Labels before legends:** line ends carry the series names, bars carry their values, slices carry name and share. A legend appears only where a direct label can't (stacks, phone widths).
- **Accessibility:**
  - Each chart is a focusable image with a text alternative built from the data (kind, size, highest and lowest).
  - The arrow keys step through the marks; the tooltip follows and a live region reads the point.
  - "View as table" shows the same rows, formatted and sortable, with a sticky header and first column.
  - `prefers-reduced-motion` turns chart animation off.
- **`/catalog`** shows every kind with sample rows shaped like Halcyon's (the page says they are samples). It previews the app theme, dark, light or both side by side, at both densities, and in each loading state (Skeleton, Title, Loaded); "Replay stream" plays the three in order. The preview themes are read from the stylesheet, so the page keeps no second copy of the palette.
  - It is not in the navigation; the shell's owner decides where the link goes.
- **Checks:** unit tests for formatting, every builder and the component; axe (WCAG 2.2 AA plus best practice) on `/catalog` in nine states with no violations; no horizontal overflow at 390 px; no console errors.
- **Limits:**
  - axe cannot measure text inside the chart SVGs; their inks come from tokens that the unit tests hold to 4.5:1 on the surface and to the better of black or white on a fill.
  - The extra chart types add about 30 kB (gzipped) to the first load.
  - Scatter labels are dropped where they would overlap; the tooltip and the table carry the rest.

## Round 2: one Kassandra component family (2026-11-20, late)

Kassandra is drawn by the same components wherever she appears (`apps/web/src/app/kassandra/`). The old ask bar and the old chat turn are gone.

- **`kassandra-composer`** is the only ask bar: Inbox (desktop and the phone dock), Thread, workflow builder, a workflow's page ("Ask about this"), a board ("Ask or filter" and "Describe a view").
  - It keeps the calm bar of round 3 (56 px, the orb as the only colour, Send only when there is text, ⌘K).
  - Under the bar, one line says what the question is asked for (the global hotel scope as chips, or the host's own subject) and how (Quick or Thinker, a radio group with roving tabindex, arrow keys, Home and End).
  - It hosts the orb as `<juyo-orb [level] [state] [bands]>`: `listening` with the microphone's level and spectrum, `thinking` while Kassandra answers.
  - Its behaviour is a pure state machine (`composer-machine.ts`), tested without a microphone.
- **Voice is Soniox real-time**, read from docs.soniox.com on 20 Nov:
  - `POST /api/voice/token` gives a temporary key; the browser opens Soniox's WebSocket with the protocols list `['soniox-api-key', key]`, so the key is in no URL and no message.
  - Audio is raw 16-bit mono PCM from an AudioWorklet (`public/pcm-capture.worklet.js`), averaged down to 16 kHz when the device rate allows. Raw PCM works in every browser; MediaRecorder's container differs between Chrome and Safari.
  - Language hints are English and Romanian, with language identification and endpoint detection on. The `<end>` token ends the question.
  - Words show while they are spoken: final tokens plain, the provisional tail muted.
  - Voice stops on silence (Soniox's endpoint, or 2.6 s of quiet as a backup), on Done, and on Esc or ✕, which drop the question. Nine seconds with nothing said gives up with a note.
  - A voice question is sent when the person stops. In the workflow builder it lands in the field instead, because a description usually needs an address added.
  - **Fallbacks:** if the token call or the stream fails before a word was heard, the browser's own recognition (Web Speech) takes over. A blocked microphone says so. The "demo transcript" plays only when there is no microphone at all, and its sample question is never sent: it lands in the field.
  - The CSP gains `wss://stt-rt.soniox.com` in `connect-src`.
- **`kassandra-conversation`** draws the turns: the work collapsed to one line with human step titles, the phase ("Thinking…", "Checking the data…", "Writing…") with Stop beside it, the streaming text, the Markdown answer, widgets, a drafted workflow, a failure in plain words.
  - **Widgets** (`show_widget`, contracts §3) are drawn by `<juyo-widget-chart>` from the tool's rows.
  - **Widgets appear in three phases, in one card that never changes size** (the "Skeletons" rule above; the mapping is `kassandra/live-slots.ts`):
    1. *Chosen*: `live.tools` has a `show_widget` call that is pending or running. The card shows skeleton lines for the title and the chart's skeleton. The kind is not known yet (`live.tools` carries no arguments), so the shape is a neutral bar chart.
    2. *Described*: the call's entry is committed with its arguments. The title and subtitle are real, and the chart area is the skeleton of that widget kind (`<juyo-widget-chart [spec] [rows]="null" loading="title">`), already at its final dimensions.
    3. *Ready*: the `tool_result` with `widget` is in. The chart takes the skeleton's place inside the same element, and "How this was computed" and "Add to board" take the place of their skeletons.
  - A skeleton that has appeared stays at least 300 ms (`SkeletonHold`), so a fast result does not flicker in. A transcript loaded from the server shows its charts at once, with no skeleton. A failed call or a stopped run leaves no skeleton.
  - The shimmer is a slow, faint sweep (`.k-skel`); under `prefers-reduced-motion` it is a static block.
  - The "Working · N steps so far" line counts a call from the moment it starts, so nothing below it jumps when the entry is committed.
  - **Data tool calls get the same treatment in "How this was computed"**: a skeleton row when the call starts, its human title and arguments with "Reading the data…" once they are known, then the evidence card. While an answer is being made the panel follows it. `stepsWithLive()` gives the evidence panel the calls only `live.tools` knows, so a panel that draws its own waiting cards starts at once.
  - **Add to board** on every widget: pick a board or "New board" (named after the widget's title). It is saved on the server with its rows; a toast offers View and Undo.
  - **Next questions** under the last answer are fixed wording chosen from the tools the answer used (another cut of the same data, "Show this as a chart", "Watch this and email me when it changes"). No model writes them.
  - **Tokens and cost** are only behind "Details", per answer and for the conversation.
  - The answer is announced to screen readers once, when it is whole, not token by token.
- **Explore answers at once (A2).** Explore, a chart mark, a KPI tile and "Ask why" open the Thread and send the question, because the click is the person's own. Only `/ask?q=` (a link in an email) fills the composer and waits, in a fresh conversation.
  - The same item under the same hotel scope reopens its thread instead of asking again. If that thread turns out empty (the first question was refused), it is asked again.
  - Typed questions always start a new thread.
- **Threads in the sidebar** have distinct titles (the scope in brackets is dropped, a taken title gets a number), a relative time, and ⋯ with Rename (in place) and Delete (with Undo). The list is this browser's; the transcripts stay on the server.
- **The hotel scope goes with every question** (`scope.hotels`, contracts §1), read from `ScopeService`. An empty scope is left out: the whole group.
- **Describe a view** on a board sends "Build a board view: …" on a conversation of its own, shows Kassandra's work under the bar, and saves every widget she answers with on that board, with a receipt and Undo.
- **Integrated (2026-11-21).** The placeholders are gone; the family uses the real components:
  - `<juyo-widget-chart>` from `charts/`: `kassandra-widget` maps its phase to `[loading]` (chosen → `skeleton`, described → `title`, ready → `none`). The card keeps its own title and passes `[header]="false"`.
  - `<juyo-orb>` from `orb/` (WebGL) in voice mode only, fed `level`, `bands` (a `Float32Array`) and `state`. At rest the composer shows the CSS mark, so a page of composers holds no WebGL context.
  - `ScopeService` from `scope/`; the composer's scope chip is `ScopeService.label()`, the same words as the sidebar switcher.
  - The Thread sits in `<juyo-evidence-layout>` (resizable split; bottom sheet on phones). `evidenceSelected` opens the tool call's card. The panel draws its own waiting cards from `stepsWithLive()`, so `kassandra-evidence-pending` was removed.
  - Boards have one client, `BoardsService` (`/api/boards`): "Add to board" and "Describe a view" save through it, so the Boards pages redraw without a reload. Saved widgets are drawn by `<juyo-widget-chart>`.
  - The Round 2 types are defined once, in `@compass/contracts`; `api/round2-contracts.ts` and `boards/types.ts` re-export them.
  - The built-in boards are `built-in-portfolio` and `built-in-dubai`, because the server's sample board "Portfolio overview" has the id `portfolio`.
