# Compass API (for the Angular app)

Base URL: `https://juyo.razvanfrandes.com`. Locally, `wrangler dev` in `apps/worker` serves `http://localhost:8787`.

## Rules for every call

- **Same origin.** `POST`, `PATCH`, `PUT` and `DELETE` under `/api/` are refused (403) when `Origin` is another site. CORS is allowed only for the Angular dev server (`http://localhost:4200`), and never on `/mcp`.
- **Body size.** JSON bodies are at most 16 KB (413). Invalid JSON gets 400.
- **Errors** are `{ "error": "…" }`. A 500 never carries internals.
- **Daily budget.** Questions, workflow runs, decisions and brief refreshes are counted per UTC day for all visitors together. Over the limit: 429 with `{ error, resetsAt }` and `Retry-After`. Show `error` as is. See `docs/security.md`.
- **`GET /api/budget`** returns today's usage: `{ question: { used, limit }, workflow_run: …, decision: …, brief_refresh: …, embedding: … }`. `embedding` counts `find_reviews` calls made through `/mcp`.

The types live in `packages/contracts` (`@compass/contracts`). Import them instead of redefining them.

## Kassandra chat: WebSocket

```
wss://juyo.razvanfrandes.com/api/kassandra/ws?conversation=<id>
```

- **Conversation id:** 1–64 letters, digits, `-` or `_`. Pick it on the client (e.g. `crypto.randomUUID()`) and keep it in the URL or in local storage to come back to the conversation.
- **Persistence:** each conversation is one Durable Object. The transcript is durable: it survives reloads, deploys and evictions.
- **Origins:** the socket is accepted from `juyo.razvanfrandes.com` and `localhost`.

### Server → client (`ChatServerMessage`)

| `type` | When | Payload |
|---|---|---|
| `snapshot` | right after connecting | `entries: ChatEntry[]` (newest ≤ 50), `live: ChatLive` |
| `entries` | a new transcript entry was committed | `entries: ChatEntry[]`. Entries never change. Append them by `id`. |
| `live` | the run state changed | `live: ChatLive`. Replace the previous one. |
| `error` | a rejected message (rate limit, daily budget, empty question) | `message: string` |

`ChatEntry` (discriminated by `kind`):
- `user` — `{ text }`
- `assistant` — `{ text, toolCalls: [{ callId, name, args }], model, usage: { tokens, costUsd }, stopReason }`
  - `stopReason: 'toolUse'` means tool calls follow. The interim `text` of such a turn is the agent narrating its steps: show it as a step, not as the answer.
  - `stopReason: 'stop'` is the final answer, in Markdown.
- `tool_result` — `{ callId, name, isError, error?, rows?, evidence?, sent? }`
  - `rows` and `evidence` feed widgets and the "How this was computed" panel.
  - `evidence` holds: `sources`, `definitions`, `period`, `sql`, `params`, `businessDate`, `notes`.
  - `sent` is on `send_email` results only (workflow run logs): whether a mail went out. It is `false` when a limit refused it or there was nothing to report.
- `event` — our own labelled inputs (e.g. `app.approval`, the builder's `app.edit`), `{ type, data }`.

`ChatLive`:
- `running` — show the Stop button while it is true;
- `streamingText` — the answer being written, before it lands as an `assistant` entry;
- `tools: [{ callId, name, status }]`, where `status` is `pending | running | done | sleeping | waiting`;
- `turns`;
- `failure: { reason, detail? } | null`, e.g. `model_error`, `turn_limit`, `aborted`;
- `usage: { tokens, costUsd }` — the conversation total, for the cost meter.

### Client → server (`ChatClientMessage`)

```json
{ "type": "ask", "text": "Why is Lisbon pacing behind?", "id": "q-123", "mode": "thinker" }
{ "type": "steer", "text": "Use the last 30 days instead" }
{ "type": "abort" }
```

- **`ask`:** pass an `id` so a resend after a dropped connection is not asked twice. Sent while busy, it is queued as a follow-up.
- **`mode`** (the Quick / Thinker selector in the composer):
  - **`quick`:** Claude Haiku 5.5, only the governed-metric tools (plus `get_pnl` and `get_forecast`), at most 4 turns, three sentences. About 5–9 s and a few cents.
  - **`thinker`** (default): Claude Sonnet 5.5, all 24 data tools, cross-source diagnosis. About 8–20 s.
  - The mode applies from the next question. A question sent while an answer is running keeps the current mode.
- **Rate limit:** 6 questions per minute per client, and the daily budget (`steer` counts as a question). Over a limit, the server sends an `error` message.

### Rendering a turn

```
user entry
  └ assistant (stopReason toolUse)       → "Worked for 4s · 3 steps" (collapsed), one step per toolCall
      └ tool_result (matched by callId)  → step done ✓ / error; rows + evidence for widgets
  └ assistant (stopReason stop)          → the answer (Markdown)
live.streamingText                       → the answer while it is being written
```

### Reconnecting

Open a new socket with the same `conversation`. You get a fresh `snapshot`; merge it by entry `id`.

## Kassandra: one-shot HTTP (scripts, evals)

`POST /api/kassandra/ask` with body `{ "conversation"?: string, "question": string, "mode"?: "quick" | "thinker" }` returns:

```json
{ "conversation": "…", "status": "done" | "unanswered", "text": "…", "reason": null, "durationMs": 7379, "mode": "thinker" }
```

It waits for the whole answer, with no streaming. Use the WebSocket in the UI.

## Morning brief

- **`GET /api/brief`** returns the latest `Brief` (`@compass/contracts` brief.ts):
  - `{ businessDate, generatedAt, items, model, usage }`;
  - each item is `{ id, kind, hotel_code, hotel_name, severity, impact_eur, impact_basis, title, facts, question, sources, summary? }`.
- **Order:** `critical` items (a stale data feed) come first, then items by absolute EUR impact.
  - `impact_eur < 0` is revenue lost or at risk;
  - `impact_eur > 0` is revenue left on the table.
- **What the AI does:** fixed SQL detectors find the items. The model (Claude Haiku) only writes `summary` from the item's facts, so show the AI label on `summary`. If the model fails, `summary` is absent: fall back to `title`.
- **"Explore":** open Kassandra with `item.question`.
- **Regeneration:** a cron regenerates the brief every morning at 05:00 UTC. `POST /api/brief/refresh` regenerates it now (rate-limited).

## Workflows (Act)

Agents that watch the numbers, propose an action and act once a person approves. Each run is a durable Pi session. While it waits for approval it holds no compute, and the wait survives deploys. Compass is read-only: an approved action is handed to the revenue manager as an RMS task and written to the audit log.

| Method | Path | What |
|---|---|---|
| GET | `/api/workflows` | `Workflow[]`. Five templates are seeded on first use, one per brief finding. |
| POST | `/api/workflows` | Create from a `WorkflowSpec` (e.g. a Kassandra draft). Returns `Workflow`. At most 30 workflows (409 beyond). |
| GET | `/api/workflows/:id` | `{ workflow, runs, proposals }` |
| PATCH | `/api/workflows/:id` | Change fields, e.g. `{ "enabled": false }` or `{ "autonomy": "suggest" }`. The recipient of an email workflow cannot be changed (400). |
| POST | `/api/workflows/:id/run` | Run now ("Run now" button). Returns `WorkflowRun`. Rate-limited and budgeted. |
| GET | `/api/runs/:runId` | `{ run, entries: ChatEntry[] }`: the run's log, projected like the chat. |
| GET | `/api/proposals?status=pending` | The approval inbox: `Proposal[]` with `change: { before, after, scope }`, `rationale`, `impact_eur`, `risk`. |
| POST | `/api/proposals/:id/decision` | `{ "approved": true, "by": "Ana Pop (RM)", "note": "" }`. Wakes the parked run. Budgeted. |
| POST | `/api/proposals/:id/undo` | `{ "by": "…" }` on an applied proposal: a compensating RMS task, audited. |
| GET | `/api/audit` | `AuditEntry[]`, newest first. |

**Autonomy** (per workflow) is how trust is earned gradually:
- `suggest` only records proposals;
- `approve` waits for a person;
- `auto_low_risk` applies low-risk actions (tasks, notifications) alone and asks for prices or channels. `adjust_bar`, `close_channel` and `open_channel` are always high risk, whatever the agent says.

**Proposal status:** `pending → approved → applied`, or `denied`, `auto_approved`, `suggested`, `undone`. `superseded` means the agent replaced the proposal with an amended one, for example to meet a condition in the approver's note.

**Run status:** `running → waiting_approval → running → done | failed`. Poll `/api/runs/:id` or `/api/proposals?status=pending` every few seconds.

**From chat:** Kassandra's `draft_workflow` tool returns a `tool_result` entry with `draft: WorkflowSpec`. Show it as an editable card; **Save** sends it to `POST /api/workflows`.

**Schedule:** every morning at 05:00 UTC the cron regenerates the brief, then runs the enabled workflows whose trigger matches a brief finding for their hotels, plus the daily ones.

## Workflow builder: WebSocket

```
wss://juyo.razvanfrandes.com/api/workflows/builder/ws?draft=<id>
```

Kassandra builds a workflow with the person. The chat is on one side and the workflow, as a chain of nodes, on the other. The agent fills in one node per tool call; the person can also edit a node by hand.

- **Draft id:** 1–64 letters, digits, `-` or `_`. Pick it on the client with `crypto.randomUUID()` and keep it in the URL to come back to the draft. Each draft is one Durable Object, which keeps the conversation, the draft and the id of the workflow it was saved as.
- **Keep the id private.** Whoever has the draft id sees the conversation and the draft, including the email address in full. Do not list or share draft ids.
- **Origins:** as the Kassandra socket.
- **Chat:** the socket speaks the Kassandra protocol above (`snapshot`, `entries`, `live`, `error`; `ask`, `steer`, `abort`), so the chat UI is reused. `snapshot.conversation` is the draft id. `ask` takes no `mode`: the builder always uses Claude Sonnet 5.5.
- **Types:** `BuilderServerMessage`, `BuilderClientMessage`, `WorkflowDraft`, `WorkflowGraph`, `specToGraph` in `@compass/contracts`.

### Server → client, on top of the chat messages

| `type` | When | Payload |
|---|---|---|
| `draft` | right after the snapshot, and after every change (a tool call, an `edit`, a `save`) | `draft`, `graph`, `changed`, `workflowId`, `issues` |
| `run` | while a test run is going, each time its place on the graph changes | `runId`, `status`, `activeNode`, `done`, `failed` |

`draft`:
- `draft: WorkflowDraft` — a `WorkflowSpec` with any part still missing. Replace the previous one.
- `graph: { nodes, edges }` — the same draft as a chain (`specToGraph(draft)`; you can also compute it on the client). Positions are the canvas's job.
- `changed: string[]` — ids of the nodes that are new or read differently. Highlight or animate them. Empty on connect and after a save.
- `workflowId: string | null` — set once the draft is saved.
- `issues: string[]` — why it cannot be saved yet, as `path: message`. Enable **Save** and **Send test** when it is empty.

Nodes, in chain order:

| `id` | `kind` | From the draft | Example `label` |
|---|---|---|---|
| `trigger` | `trigger` | `trigger` | "Every morning, after the brief" |
| `scope` | `scope` | `hotels` | "LIS" / "All 20 hotels" |
| `check:<tool>`, one per check (`check` while there is none) | `check` | `checks[]` | "Pace vs last year" (`get_pace`) |
| `analyze` | `analyze` | `goal` | "Kassandra explains why" |
| `approval` | `approval` | `autonomy`, `approver` | only when the action needs approval; an email does not |
| `action` | `action` | `action`, `delivery` | "Email si****@gmail.com" |

Each node is `{ id, kind, label, detail, state }`. `state` is `empty` (a placeholder: nothing chosen yet), `draft` (a value that is not complete or valid yet) or `complete`. The whole chain is there from the first message and fills in. Ids are stable across edits. Labels show the address masked.

`run`:
- `status` — the run's status (`running`, `done`, `failed`; `waiting_approval` for a workflow whose action needs approval);
- `activeNode` — the node the run is on, or `null` once it has ended (or the mail is out and the agent is writing its summary);
- `done` — the nodes it finished, in chain order;
- `failed` — the node a failed run stopped on, else `null`.

A run walks the chain: `trigger` and `scope` are done at once; a check is active from its tool call to its result; `analyze` is active while the agent thinks or reads other data; `action` is active while the mail is being sent, and done **only when a mail went out**. A test that reaches the hourly limit ends `done` without `action` in `done`; read why in `GET /api/runs/:runId` (`run.summary`). The server polls the run once a second, so a quick step can be skipped. It follows a run for at most 3 minutes.

### Client → server, on top of the chat messages

```json
{ "type": "edit", "patch": { "trigger": { "kind": "schedule", "every": "week" } } }
{ "type": "edit", "patch": { "action": { "type": "notify" }, "delivery": null } }
{ "type": "save" }
{ "type": "test" }
```

- **`edit`:** a manual change on the canvas.
  - `patch` holds whole fields of the workflow (`trigger`, `hotels`, `checks`, `name`, `goal`, `action`, `delivery`, `approver`, `autonomy`, `enabled`, `description`). A field set to `null` is removed.
  - Every field is validated. If one is invalid, nothing is applied and you get an `error` message with the reason.
  - On success everyone on the draft gets a `draft` message, and the transcript gets an `event` entry `app.edit` with `data: { changed, chain }`. The agent reads it on its next turn, so it builds on the edit.
  - `checks` may only name data tools (the 24 tools of `/mcp`), at most 8.
- **`save`:** saves the draft as a workflow. Refused with an `error` while `issues` is not empty. The first save creates the workflow; you get a `draft` message with its `workflowId`. A later save updates that workflow. If the address changed (or was added or removed), the save creates a **new** workflow, turns the old one off, and `workflowId` changes.
- **`test`** ("Send test now"): saves if needed, then runs the workflow once as a test and sends `run` messages. An email workflow always sends on a test, with the subject `Test · <name>`, and the mail says whether the workflow would have fired today.
  - One test at a time: a `test` sent while a run is going gets an `error` message, and the socket stays open.
- **Limits:** `ask` and `steer` share Kassandra's limit (6 per minute per client) and the daily `question` budget. `test` shares the same per-minute limit and counts against the daily `workflow_run` budget. A message is at most 16 KB. Over a limit, the server sends an `error` message.

### Email workflows

- **One recipient** per workflow, set when it is saved. `PATCH` cannot change it.
- **Masked everywhere outside the builder socket:** `GET /api/workflows`, `/api/workflows/:id`, the answers of `POST` and `PATCH`, the audit log and the graph labels show `si****@gmail.com`.
- **Fixed template:** the model writes the summary and picks the facts; it never chooses the recipient or the layout.
- **Limits:** 3 emails per hour per address, 10 per hour per client, 50 per UTC day for the whole demo. Over a limit, the run ends `done`, sends nothing and says so in its summary.
- **Lifetime:** a scheduled email workflow turns itself off after 7 days or 5 emails, whichever comes first. The last mail says so. Test runs are not counted, only the hourly and daily limits.
- **"Explore in Kassandra"** in the mail links to `https://juyo.razvanfrandes.com/ask?q=<question, URL-encoded>`. This is a contract for the app: the route `/ask` must open Kassandra, pre-fill the question from `q` and send it.

## MCP (public, read-only)

`https://juyo.razvanfrandes.com/mcp` (Streamable HTTP) exposes 24 data tools. Kassandra uses the same tools.

- **Reference:** `list_hotels`, `list_metrics`, `get_schema`, `get_data_health`.
- **Commercial:** `get_metric`, `get_pace`, `get_pickup`, `get_rate_position`, `get_channel_mix`, `get_mix`, `get_account_production`, `get_inventory`, `get_web_funnel`.
- **Finance and forecast:** `get_pnl` (USALI P&L vs budget and last year, GOP margin, flowthrough), `get_forecast` (P10–P90 range vs on the books and budget), `get_lost_business` (price regrets vs denials).
- **F&B, M&E and guests:** `get_fnb`, `get_labor`, `get_meetings_events`, `get_review_scores`, `find_reviews` (by meaning), `search_reviews` (exact phrase).
- **Brief and escape hatch:** `get_brief`, `run_readonly_query`.

Connect Claude Desktop to it under Settings → Connectors → Add custom connector. Rate limit: 60 requests per minute per client. Bodies at most 64 KB. Browser requests from other origins get 403, and responses carry no CORS headers: MCP clients are not browsers.

Tools that return outside free text (`find_reviews`, `search_reviews`, `get_account_production`, `get_brief`, `run_readonly_query`) wrap their rows in `<untrusted_data>` in the text content. `structuredContent` is not wrapped.

- **Text cap.** The text content holds at most 60 rows and at most 50,000 characters of rows, then ends the rows with `… N more rows not shown.` `structuredContent` keeps every row.
- **Errors.** A failed call has `isError: true`. Only `run_readonly_query` returns the database's error text, with a hint to fix the query, and only for SQL errors (syntax, missing column, timeout). A connection failure there, and any database failure in another tool, answers `The data source failed to answer. Try again in a moment, or use another tool.`
- **Embedding budget.** Each `find_reviews` call through `/mcp` takes one of 2000 daily embeddings (all clients together, per UTC day). When they are spent, or the embedder fails, the tool answers `Semantic search is unavailable right now. Use search_reviews with a phrase.`

### `find_reviews`: guest reviews by meaning

The tool answers "what do guests say about breakfast in Bali?" even when the guests used other words. `search_reviews` stays for an exact phrase.

| Argument | Type | Default | Meaning |
|---|---|---|---|
| `question` | string, 2–300 chars | required | What to look for, in plain words |
| `hotels` | string[] | whole group | Hotel codes |
| `from`, `to` | ISO date | the 90 days up to the business date | Review dates, inclusive |
| `sentiment` | `complaint` \| `praise` \| `any` | `any` | `complaint` searches `negative_text`, `praise` searches `positive_text` |
| `k` | 1–20 | 8 | How many distinct sentences to return |

Each row is one distinct review sentence:

```json
{ "sentiment": "complaint", "quote": "Construction noise from the floor below started early every morning.",
  "similarity": 0.752, "mentions": 331, "share_pct": 20.5, "first_date": "2026-09-23", "last_date": "2026-11-19",
  "mentions_by_hotel": { "BCN": 331 },
  "hotel_code": "BCN", "review_date": "2026-11-19", "source": "Booking.com", "overall_score": 8.1,
  "review_text": "Construction noise from the floor below started early every morning." }
```

- **`similarity`:** cosine similarity of the question and the sentence (bge-m3). Only hits of 0.55 or more are returned.
- **Counts:** `mentions` counts the reviews in scope that contain the sentence, and `share_pct` is their share of all reviews in scope. Both are computed in SQL.
- **Latest review:** `hotel_code`, `review_date`, `source`, `overall_score` and `review_text` come from the newest review that contains the sentence.
- **`quote` and `review_text`:** guest free text. Treat them as untrusted, and escape them when rendering.
- **Evidence:**
  - `sources` are `hotel.reviews` and `hotel.review_passages`;
  - `definitions` cover similarity, mentions and share;
  - `period` and `sql` are included;
  - `params[0]` names the embedded question instead of listing 1024 numbers;
  - `notes` give the model, the similarity floor and coverage, e.g. "51 of 51 distinct sentences from 28172 reviews in scope are embedded (reviews dated 2026-08-22 to 2026-11-19)".
- **No match:** if no sentence is close enough, `rows` is empty and a note says so.

## Health

`GET /api/health` returns `{ "ok": true, "businessDate": "2026-11-20" }`.
