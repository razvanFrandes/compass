# Compass API (for the Angular app)

Base URL: `https://juyo.razvanfrandes.com`. Locally, `wrangler dev` in `apps/worker` serves `http://localhost:8787`.

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
| `error` | a rejected message (rate limit, empty question) | `message: string` |

`ChatEntry` (discriminated by `kind`):
- `user` — `{ text }`
- `assistant` — `{ text, toolCalls: [{ callId, name, args }], model, usage: { tokens, costUsd }, stopReason }`
  - `stopReason: 'toolUse'` means tool calls follow. The interim `text` of such a turn is the agent narrating its steps: show it as a step, not as the answer.
  - `stopReason: 'stop'` is the final answer, in Markdown.
- `tool_result` — `{ callId, name, isError, error?, rows?, evidence? }`
  - `rows` and `evidence` feed widgets and the "How this was computed" panel.
  - `evidence` holds: `sources`, `definitions`, `period`, `sql`, `params`, `businessDate`, `notes`.
- `event` — our own labelled inputs (e.g. `app.approval`), `{ type, data }`.

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
  - **`quick`:** Claude Haiku 5.5, only the governed-metric tools, at most 4 turns, three sentences. About 5–9 s and a few cents.
  - **`thinker`** (default): Claude Sonnet 5.5, all 18 tools, cross-source diagnosis. About 8–20 s.
  - The mode applies from the next question. A question sent while an answer is running keeps the current mode.
- **Rate limit:** 6 questions per minute per client. Over the limit, the server sends an `error` message.

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
| POST | `/api/workflows` | Create from a `WorkflowSpec` (e.g. a Kassandra draft). Returns `Workflow`. |
| GET | `/api/workflows/:id` | `{ workflow, runs, proposals }` |
| PATCH | `/api/workflows/:id` | Change fields, e.g. `{ "enabled": false }` or `{ "autonomy": "suggest" }`. |
| POST | `/api/workflows/:id/run` | Run now ("Run now" button). Returns `WorkflowRun`. Rate-limited. |
| GET | `/api/runs/:runId` | `{ run, entries: ChatEntry[] }`: the run's log, projected like the chat. |
| GET | `/api/proposals?status=pending` | The approval inbox: `Proposal[]` with `change: { before, after, scope }`, `rationale`, `impact_eur`, `risk`. |
| POST | `/api/proposals/:id/decision` | `{ "approved": true, "by": "Ana Pop (RM)", "note": "" }`. Wakes the parked run. |
| POST | `/api/proposals/:id/undo` | `{ "by": "…" }` on an applied proposal: a compensating RMS task, audited. |
| GET | `/api/audit` | `AuditEntry[]`, newest first. |

**Autonomy** (per workflow) is how trust is earned gradually:
- `suggest` only records proposals;
- `approve` waits for a person;
- `auto_low_risk` applies low-risk actions (tasks, notifications) alone and asks for prices or channels.

**Proposal status:** `pending → approved → applied`, or `denied`, `auto_approved`, `suggested`, `undone`. `superseded` means the agent replaced the proposal with an amended one, for example to meet a condition in the approver's note.

**Run status:** `running → waiting_approval → running → done | failed`. Poll `/api/runs/:id` or `/api/proposals?status=pending` every few seconds.

**From chat:** Kassandra's `draft_workflow` tool returns a `tool_result` entry with `draft: WorkflowSpec`. Show it as an editable card; **Save** sends it to `POST /api/workflows`.

**Schedule:** every morning at 05:00 UTC the cron regenerates the brief, then runs the enabled workflows whose trigger matches a brief finding for their hotels, plus the daily ones.

## MCP (public, read-only)

`https://juyo.razvanfrandes.com/mcp` (Streamable HTTP) exposes 19 data tools (including `get_brief`). Kassandra uses the same tools. Connect Claude Desktop to it under Settings → Connectors → Add custom connector. Rate limit: 60 requests per minute per client.

## Health

`GET /api/health` returns `{ "ok": true, "businessDate": "2026-11-20" }`.
