# Compass MVP: work plan (draft, 2026-11-20)

We work one step at a time. Each task is small, ends in something we can check, and gets a commit. We confirm before moving to the next phase.

## Target architecture

```
Angular (Spartan UI v2) ──WebSocket──▶ Worker ──▶ Kassandra DO (Pi Durable via PiHarness)
        │                                │            ├─ model: Claude via AI Gateway (BYOK)
        │                                │            └─ tools = MCP client ─┐
        │                                ├─ /mcp  MCP server (createMcpHandler) ◀┘ ◀── Claude Desktop
        │                                │            └─ Hyperdrive ──▶ Postgres (Neon) + pgvector
        │                                ├─ Watcher DOs (Pi Durable, scheduled; propose → approve)
        └── HTTP (brief, dashboards) ────┴─ Cron: fixed SQL detectors → brief
```

- **Data:** the `compass-datagen` Postgres (Halcyon Hospitality Group: 20 hotels, 1.2M reservations, planted stories S1–S7). It replaces D1/PGlite, because the metric definitions already live in SQL: `v_hotel_day`, `pace_vs_stly()`, `otb_as_of()`, `v_comp_set_index`, `v_channel_month`, `v_rate_position`.
- **MCP:** the only door to the data. The in-app agent, the watchers and Claude Desktop all use the same tools.
- **Pi Durable:** runs the agent loop for Kassandra and the watchers. Conversations survive deploys, watchers sleep and wake on a schedule, and approvals are durable.
- **Generative UI:** a Pi tool `show_widget` whose arguments are our `WidgetSpec`. Angular renders it from our catalog. **Open decision D1: does Hashbrown stay?**
- **RAG:** pgvector is already in the schema (`review_embeddings`, `documents`, `document_chunks`). Embeddings get added, then exposed as an MCP tool `search_reviews`.

## Juyo services → where they are in the plan

The data covers every module (PMS, RMS, comp set, POS/F&B, M&E, labour, web, reviews, P&L), so they can all be built.

| Juyo service | At Compass (Halcyon, 20 hotels) | Phase | Depth |
|---|---|---|---|
| **Kassandra Quick** | Haiku + metric-catalog tools only, a fast answer with its definition | 3 | full |
| **Kassandra Thinker** | Sonnet + all MCP tools, links 2–3 sources (e.g. labour + F&B + reviews for Bali) | 3 | full |
| **Kassandra Strategic** | "Council": 3 personas (Revenue, Finance, Operations) answer in parallel with the same tools, then a synthesis that names the disagreements | 3 | light |
| **HotelGPT** | Single-hotel mode: the hotel selector limits every tool to one property; meter per question (tokens, €, ms) | 3 | full (no real PMS) |
| **Commercial** | occupancy, ADR, RevPAR, pace/STLY, pickup, channel mix net of commission, rate vs comp set, MPI/ARI/RGI | 2–4 | full |
| **Finance** | USALI P&L actual / budget / forecast, GOP, flowthrough | 2 | light |
| **F&B** | covers, revenue per outlet, per occupied room, labour hours | 2 | light |
| **M&E** | events, meeting space, revenue per sqm | 2 | light |
| **Pulse / Exploration / Deep Dive** | KPI strip, click → drivers, drill down to segment/channel | 4, 7 | light |
| **Canvas** | pinned widgets + "build a board from a description" | 7 | light |
| **Forecast Builder** | forecast P10/P50/P90 from the data + simple what-if | 7 | optional |
| **Briefings** | morning brief ranked by money + PDF export | 4 | full |
| **Agents / Workflow Automations (Act)** | **Workflows**: created from chat or built by hand, run durably on Pi | 5 | full |
| **Data health** | `data_sources`: stale feeds (S7 Berlin POS) shown in the UI and in answers | 4 | light |
| Connections / Data Drop / Embed / SSO | write-up only | – | no |

## Open decisions (before Phase 2)

| # | Question | Recommendation |
|---|---|---|
| D1 | Hashbrown or Pi for the chat? Both want to own the loop. | **Pi** as the only loop. Hashbrown comes out (one fewer 0.x dependency). The widget appears when `show_widget` is called, with a skeleton until then. |
| D2 | Where does Postgres live in production? | **Neon** (pgvector, branching) + **Hyperdrive**. Load `out/full` (or `out/window` if size or time is an issue). |
| D3 | Does the v2 UI match Juyo's world? | Review in Phase 1, before we build on it. |
| D4 | How do reviewers get into MCP? | Public read-only, rate-limited. |
| D5 | The brand in the app | **Decided:** Halcyon Hospitality Group, 20 hotels, the exact data from `compass-datagen`. Fagus is gone everywhere. |

## Phase 0: Foundations (no features)

- **T0.1** Copy the v2 UI (`spartan-demo`, the latest build) from the temporary scratchpad into `compass-mvp/apps/web`, without `node_modules`/`dist`. ✔ `ng serve` starts, no Lucide icons are used, commit.
- **T0.2** Workspace structure: `apps/web` (Angular), `apps/worker` (Worker + DO + MCP), `packages/contracts` (shared TS types). pnpm workspace. ✔ `pnpm -r build` passes.
- **T0.3** Local data: the existing `compass_hotels` database (already loaded: 20 hotels, 1.2M reservations) + a **read-only role** `compass_ro`, limited to `SELECT` on schema `hotel` with `statement_timeout = 5s`. ✔ an `INSERT` fails with that role.
- **T0.4** Write the decisions D1–D5 into `docs/decisions.md`.

## Phase 1: Contracts and UI review

- **T1.1** `packages/contracts`: `WidgetSpec` (9 catalog types), `MetricRef`, `Evidence` (source, period, definition, sql), `BriefItem`, `WatcherProposal`. ✔ typecheck.
- **T1.2** Review v2 against JUYO_CONTEXT (§5 their look, §8 principles) and `docs/research/ai-ux/pattern_canon.md`. List: keep / change / remove. ✔ a short list we decide on together.
- **T1.3** Split the 629-line `app.ts` into lazy routes: `/brief`, `/ask`, `/canvas`, `/agents`, `/catalog`. The UI keeps running on mocks. ✔ the same UI, now in small components.

## Phase 2: MCP server (the core of the backend)

- **T2.1** A Worker with `createMcpHandler` at `/mcp` + a Postgres connection (local via `wrangler dev`, then Hyperdrive). ✔ MCP Inspector lists the tools.
- **T2.2** Metric-catalog tools: `list_hotels`, `list_metrics` (definitions), `get_metric(metric, hotels, period, compare)` over the SQL views. ✔ the answers match `tests/check.py`.
- **T2.3** `run_readonly_query(sql)`: a guard that allows only one SELECT, uses `compass_ro`, has a timeout and caps rows. Every result returns `Evidence`. ✔ writes and multiple statements are refused.
- **T2.4** Specialised tools: `get_pace(hotel)`, `get_channel_mix`, `get_rate_position`, `get_data_health`. ✔ S1 (Lisbon pace −20%) and S4 (Amsterdam mobile) are visible through tools.
- **T2.5** Claude Desktop connected to the local server. ✔ the question "Why is Lisbon pace down?" works in Claude Desktop.

## Phase 3: Kassandra on Pi Durable

- **T3.1** Spike: `Kassandra` DO with `PiHarness`, the model through AI Gateway, no tools. ✔ a prompt over WebSocket gets an answer, and a redeploy mid-answer does not lose the conversation.
- **T3.2** MCP → Pi bridge: `MCPClientManager` + Pi tools registered from `listTools()` (read tools: `replay: "safe"`). ✔ the agent calls `get_metric` itself.
- **T3.3** `show_widget` tool + system prompt (definitions, "never compute numbers", catalog). ✔ the answer comes back as a `WidgetSpec` with `Evidence`.
- **T3.4** Angular: a service that applies `session.watch()` ops (chord `applyImmutable`) to a signal, streams the text, renders widgets from the catalog, and shows the steps collapsed. ✔ end-to-end in the UI.
- **T3.5** Quick / Thinker: Quick = Haiku + metric tools only, Thinker = Sonnet + all tools. A cost/latency meter on each answer.
- **T3.6** Strategic (council): 3 personas in parallel (Revenue, Finance, Operations) with the same tools + a synthesis with points of agreement and disagreement. ✔ "Should we drop Lisbon's rate?" gives 3 views + a recommendation.
- **T3.7** HotelGPT mode: one selected hotel limits every tool; a token/€ meter per question.
- **Fallback checkpoint:** if T3.1 does not work within ~2 h, Kassandra moves to a simple Worker loop (Anthropic SDK + the same MCP tools), and Pi stays for the watchers only.

## Phase 4: Morning brief

- **T4.1** Fixed SQL detectors (pace vs STLY, rate vs comp set, channel mix, data health, F&B per occupied room). ✔ they find S1–S7.
- **T4.2** A cron that ranks by money impact; the model writes only the explanation sentence. ✔ `/brief` shows the top 3 with evidence and "explore in Kassandra".

## Phase 5: Workflows (Act) on Pi Durable

A workflow is a **declarative spec** (the same rule as for widgets: one recipe for people and AI). It can be **created in two ways**, and both produce the same `WorkflowSpec`:
1. **From chat:** "Watch Dubai's pace every morning. If the rate is below the comp set median while occupancy is above 80% three weeks out, propose a BAR increase and ask me." Kassandra calls `draft_workflow`, and the UI shows the spec as an editable card, then Save.
2. **By hand:** a builder in `/agents` with a vertical list of steps (no node graph) and a dropdown for each step.

```ts
interface WorkflowSpec {
  name: string;
  hotels: string[];                                   // or 'all'
  trigger: { kind: 'schedule'; cron: string }
         | { kind: 'condition'; metric: MetricRef; op: '<' | '>'; value: number; window: string };
  steps: Array<
    | { kind: 'check'; tool: string; args: object }   // an MCP tool, deterministic
    | { kind: 'analyze'; instruction: string }        // the model explains, never computes
    | { kind: 'propose'; action: 'adjust_bar' | 'close_channel' | 'create_task' | 'notify'; params: object }
    | { kind: 'approve'; who: 'revenue_manager' | 'gm' }
    | { kind: 'act' }                                 // mocked action + audit + undo
    | { kind: 'notify'; channel: 'in_app' | 'email' }>;
  autonomy: 'suggest' | 'approve' | 'auto_low_risk'; // per hotel
}
```

Execution: each workflow is a **Pi Durable** DO.
- The trigger is a durable `sleepUntil` or a cron.
- `check` = an MCP call (`replay: "safe"`).
- `analyze` = a model turn.
- `approve` = the run waits on a **durable signal** and survives deploys; the Approve button sends the signal.
- `act` writes to the audit log and keeps an undo.

- **T5.1** `WorkflowSpec` in contracts + validation. ✔ the 3 example workflows validate.
- **T5.2** Runner: a `Workflow` DO with PiHarness that executes the steps in order. ✔ "S6 Dubai: rate below comp set" runs on demand and produces a proposal.
- **T5.3** Approval + audit + undo, as a durable signal. ✔ approve after a redeploy still works.
- **T5.4** The `/agents` UI: the workflow list (status, last run, autonomy, on/off, Run now), proposal inbox, run history.
- **T5.5** The manual builder (step list).
- **T5.6** Creation from chat: the `draft_workflow` tool + the editable card in Kassandra.
- Ready-made templates: "pace below STLY" (S1 Lisbon), "corporate account lost" (S2 New York), "mobile conversion dropped" (S4 Amsterdam), "stale data feed" (S7 Berlin).

## Phase 6: RAG

- **T6.1** Enable pgvector, generate embeddings for reviews (Workers AI, 1024 dims) into `review_embeddings`. ✔ a similarity search finds the Bali "food" reviews (S3).
- **T6.2** The MCP tool `search_reviews(hotel, query, period)` returns quotes as evidence. ✔ "Why did F&B drop in Bali?" links the hours, the covers and the reviews.

## Phase 7: Canvas, polish, delivery

- **T7.1** Canvas: pinned widgets + "build a board from a description".
- **T7.2** Phone (brief + Ask sheet), AXE, dark mode.
- **T7.3** Deploy (Worker + Neon + Hyperdrive), evals over S1–S7, write-up, email.

## Order and risk

The deadline is about 21 h away. Phases 0–3 + 4 are the minimum demo. Phases 5–6 are where Juyo has nothing shipped yet (Act, RAG on reviews), so they are worth a lot. Phase 7.1 comes only if there is time. Every phase ends in a working, committed state.
