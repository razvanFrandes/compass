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
{ "type": "ask", "text": "Why is Lisbon pacing behind?", "id": "q-123" }
{ "type": "steer", "text": "Use the last 30 days instead" }
{ "type": "abort" }
```

- **`ask`:** pass an `id` so a resend after a dropped connection is not asked twice. Sent while busy, it is queued as a follow-up.
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

`POST /api/kassandra/ask` with body `{ "conversation"?: string, "question": string }` returns:

```json
{ "conversation": "…", "status": "done" | "unanswered", "text": "…", "reason": null, "durationMs": 7379 }
```

It waits for the whole answer, with no streaming. Use the WebSocket in the UI.

## MCP (public, read-only)

`https://juyo.razvanfrandes.com/mcp` (Streamable HTTP) exposes 18 data tools. Kassandra uses the same tools. Connect Claude Desktop to it under Settings → Connectors → Add custom connector. Rate limit: 60 requests per minute per client.

## Health

`GET /api/health` returns `{ "ok": true, "businessDate": "2026-11-20" }`.
