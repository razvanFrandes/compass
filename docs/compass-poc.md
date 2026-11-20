# Compass POC: what already exists

Compass MVP is a fresh start. The earlier prototype, **Compass POC**, lives at `/Users/razvan/Web/compass` (live: https://compass.razvanfrandes.com). Use it as a reference for ideas and domain logic. Don't copy its UI layer: it was built on Zard UI, and we are dropping Zard.

## What the POC does

It is a dashboard for a fictional hotel group, **Fagus Hotels** (Cluj, București, Brașov), with an AI assistant that answers from the database and builds the right chart for each question.

```
Angular (httpResource)  ──GET /api/dashboard/:hotel──▶  Hono  ──SQL──▶  PGlite
Assistant (signals)     ──POST /api/ask──────────────▶  Hono
                                                         ├─ Claude (Sonnet): question + schema → { sql, widget }
                                                         ├─ worker thread: SQL in a READ ONLY transaction, then ROLLBACK
                                                         └─ Claude (Haiku): rows → answer
```

- The model never computes numbers. The SQL produces them, and the answer is written only from the returned rows.
- Both Claude calls use structured outputs, so the server always gets valid JSON back.
- Model-written SQL runs in a worker thread with a 5 s timeout and `LIMIT 200`. On error, the model gets one repair attempt.
- `toWidget()` validates the widget the model picked and falls back to a table. Widgets can be pinned to the dashboard.
- The last few questions are sent along with each new one, so follow-ups keep their context.
- **Deployment:** a Cloudflare Worker serves the static assets and applies rate limits (5 questions per minute per visitor, 30 per minute in total). The API runs in a Container (Hono + PGlite), and a Durable Object manages that container.

## Data model (PGlite, seeded on start, `BUSINESS_DATE = 2026-11-05`)

| Table | Columns |
|---|---|
| `hotels` | id, name, city, rooms, segment |
| `daily_performance` | hotel_id, stay_date, rooms_available, rooms_sold, room_revenue, rooms_sold_7d_ago |
| `channel_performance` | hotel_id, stay_date, channel, rooms_sold, room_revenue, commission_pct |
| `rates` | hotel_id, stay_date, bar_rate |
| `competitor_rates` | hotel_id, stay_date, competitor, rate |
| `events` | hotel_id, name, start_date, end_date |

The seed lives in `compass/server/seed.ts`.

## Files worth reading in the POC

| File | Why |
|---|---|
| `server/ai.ts` | prompt, structured-output schemas, the plan → SQL → answer pipeline |
| `server/seed.ts` | fictional data generator |
| `server/sql-runner.ts`, `server/sql-worker.ts` | safe read-only SQL execution |
| `server/dashboard.ts` | KPI queries |
| `worker/index.ts`, `wrangler.jsonc`, `Dockerfile` | Cloudflare deployment |
| `src/app/features/assistant/*` | chat panel, AI widget, pinned widgets |

## What the POC is missing

- An MCP server over the data (MCP was used only during development).
- A briefing view ("the answer comes to you").
- Generating several widgets at once (a Canvas).
- Agents.
- Evals.
- **Known bug:** the footer says "Claude Code" when the answer actually came from the Claude API.
