# Compass

A hotel analytics app built as a design-lead assignment for Juyo. It opens on a morning brief, answers questions about the hotels with its sources, and lets you set up a watching agent by talking to it.

- **Live app:** https://juyo.razvanfrandes.com
- **MCP server:** https://juyo.razvanfrandes.com/mcp (read-only; add it as a custom connector in Claude)
- **Data generator:** https://github.com/razvanFrandes/compass-datagen

All hotel data is fictional: 20 hotels of an invented group, about 5.8M rows in Postgres.

## What is in it

- **Morning brief.** What needs the hotelier today, ranked and scoped to the hotels they pick. Numbers come from SQL; only the sentence on each finding is written by AI.
- **Kassandra.** Ask about any hotel, night or number, by text or voice. Answers show the charts, tables and the evidence behind every number (the SQL, the sources). Quick and Thinker modes.
- **Agent Studio.** Describe a workflow ("email me every morning if Lisbon's pace falls more than 10% behind last year") and it draws itself node by node. It runs for real and can send a real email.
- **Boards.** Save any chart from an answer to a board.
- **Decisions.** Compass never changes rates. It proposes, and a person sends the decision to the revenue manager.

## Stack

| Part | Tech |
|---|---|
| Web | Angular 22 (zoneless, signals), Spartan UI, Tailwind 4, ECharts 6, Phosphor icons |
| Server | Cloudflare Worker, Durable Objects, Pi Durable agents (Kassandra, the workflow builder, workflow runs) |
| Data | Postgres 17 over Hyperdrive and a Cloudflare Tunnel, read-only role |
| Models | Claude Haiku 5.5 (Quick) and Sonnet 5.5 (Thinker) via AI Gateway |
| Voice | Soniox real-time transcription with short-lived keys |
| Email | Cloudflare Email Service, with per-address, per-client and daily limits |

## Repository

```
apps/web         Angular app
apps/worker      Cloudflare Worker (API, MCP server, Durable Objects)
packages/contracts  shared zod schemas
docs/            write-up, architecture, API, security, decisions, research
```

Start with [docs/writeup.md](docs/writeup.md). Then see [docs/architecture.html](docs/architecture.html), [docs/api.md](docs/api.md), [docs/security.md](docs/security.md) and [docs/decisions.md](docs/decisions.md). The app also has its own docs at `/docs`: the process, accessibility and the data.

## Run it

```bash
pnpm install
pnpm test
pnpm --filter @compass/web start      # web app
pnpm --filter @compass/worker dev     # worker (needs a Postgres from compass-datagen and local secrets in apps/worker/.dev.vars)
pnpm run deploy                       # build the web app and deploy the worker
```
