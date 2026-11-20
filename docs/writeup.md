# Compass: a hotel analytics app that tells you first

Write-up for the Juyo design lead assignment. Razvan Frandes, 21 Nov 2026.

## 1. What it is

Compass is a hotel analytics app for a fictional group, Halcyon Hospitality Group (20 hotels). You open it and it tells you what changed overnight, ranked by money. You can ask Kassandra why, and every answer shows where its numbers came from. You can then describe a workflow in one sentence.

- Live app: https://juyo.razvanfrandes.com [TODO: confirm the app loads at the root before sending]
- MCP server (public, read-only): https://juyo.razvanfrandes.com/mcp
- Repo: [TODO: repo URL]
- An interactive architecture map: [TODO: link once shared]
- [TODO: one screenshot or a 30-second recording of the brief and the workflow builder]

## 2. The idea: from asking, to being told, to acting

Your introduction describes three shifts. I used them as the product spec.

| Juyo's shift | Juyo's product | In Compass |
|---|---|---|
| From clicking through screens to a conversation | Ask: Kassandra | Kassandra chat, Quick and Thinker modes |
| From exploring dashboards to the answer coming to you | Analyze: Canvas | A morning brief as the home screen, and boards |
| From a tool you operate to a partner that works alongside you | Act: Agent Studio | Workflows with approvals, built by talking |

Most analytics products add a chat panel beside a dashboard. I built that version first, in the earlier prototype. So the home screen of Compass is a brief, and you reach a dashboard from an answer.

I spent the most time on Act. Your pricing page lists agents and workflow automations as "Coming Soon", so that is where a take-home can show an opinion of its own.

## 3. What a hotelier sees

The interaction model is Inbox → Thread → Board. The backend for all of it is live. In the Angular app, the workflow builder is built on the live API. The brief, thread, boards and watcher screens are built and are being connected to the live API. Until then they read a snapshot extracted from the same database.

### Morning brief (the Inbox)

A short list of what needs attention today. A broken data feed comes first, because every number below depends on it. Then items are ordered by euro impact. Each item has its facts, its sources, one chart and a question that opens Kassandra. Ranking by money follows your "money, not percentages" position.

Eight fixed SQL detectors find the items, such as pace behind last year, a lost corporate account or a GOP miss against budget. A cron runs them at 05:00 UTC. Claude Haiku writes one summary sentence per item from its facts.

### Kassandra (the Thread)

You ask in plain language. Kassandra calls data tools, shows its steps collapsed, and answers. Each tool result carries its evidence: sources, metric definitions, period, the SQL and its parameters.

Two modes copy your tiers. Quick is Claude Haiku with the governed-metric tools, at most four turns and three sentences. Thinker is Claude Sonnet with all 24 tools, for questions that cross sources. Both stream over WebSocket, and you can steer or stop a run.

`find_reviews` answers "what do guests say about breakfast in Bali?" when guests used other words. Review sentences are embedded with Workers AI into pgvector, next to the reviews. I used RAG for text only. A metric has to be computed exactly from sums.

### Workflows (Act)

A workflow watches a condition, runs checks through the same data tools, explains what it found and proposes an action. A person approves or denies. Approved actions can be undone, and everything goes to an audit log.

Each workflow has an autonomy level: suggest only, wait for approval, or act alone on low-risk actions. Price and channel actions are always high risk in code, whatever the model says.

### Workflow builder: talk, and the workflow draws itself

The screen has a chat on the left and a live node canvas on the right. You type "Email me every morning if Lisbon's pace falls more than 10% behind last year". The agent fills a chain, one node per tool call: trigger → hotels → checks → analysis → action. You can edit any node by hand. "Send test now" runs it once on today's data, lights up each node as it runs, and sends a real email that says whether the workflow would have fired today.

The agent edits a workflow spec, and a pure function derives the graph from the spec. The agent cannot draw a graph the runner cannot execute. I chose a linear chain because a free node canvas asks the hotelier to think like an integrator.

### Boards (Canvas)

A Portfolio board covers all 20 hotels with one filter bar and a small chart catalogue. This is the least built part: boards are UI only, and the backend has no board storage.

## 4. Principles behind the decisions

1. **The model never computes a number.** SQL views hold the metric definitions. The model plans, picks tools and explains.
2. **Evidence is one click away.** "How this was computed" is a panel, and it shows the real query.
3. **One spec for people and AI.** Kassandra drafts the same workflow spec a person edits by hand. The same rule is planned for charts.
4. **Detect with rules, explain with a model.** Anomalies come from fixed SQL, so the brief is the same every time you load it.
5. **Show uncertainty.** The forecast tool returns a P10 to P90 range against on-the-books and budget.
6. **Planted stories as evals.** The dataset contains seven planted problems (S1 to S7). Seven fixed questions check that Kassandra finds each one. The run against production on 20 Nov 2026 found 7 of 7, with answers in 5.6 to 16.2 seconds (`evals/results/2026-11-20T19-30-03-730Z.json`).

## 5. Architecture, and why

```
Browser (Angular)            Claude Desktop, any MCP client
   │ WebSocket + HTTP                  │ Streamable HTTP
   ▼                                   ▼
Cloudflare Worker ──────────────── /mcp  (24 read-only tools)
   ├─ Kassandra            Durable Object, Pi Durable agent ─┐
   ├─ Workflow agents      Durable Object, Pi Durable agent ─┤ same tools
   ├─ Workflow builder     Durable Object, Pi Durable agent ─┘
   ├─ Budget, email quota  Durable Objects
   ├─ Cron 05:00 UTC       detectors → brief → workflows
   ├─ Claude via AI Gateway · Workers AI (bge-m3) · Email Service
   ▼
Hyperdrive → Cloudflare Tunnel → Postgres 17 + pgvector (my own VM, read-only role)
```

- **One Cloudflare Worker.** One deploy holds the app, the API, the agents, the cron, the MCP server and email. Durable Objects fit agents that sleep and wake.
- **Pi Durable agents.** Each conversation, workflow run and builder draft is one Durable Object running an agent loop. An approval is a durable signal, so a workflow can wait days for a person.
- **MCP as the only door to data.** Kassandra, the workflow agents and outside clients use the same 24 tools. In Claude Desktop, add the URL under Settings → Connectors → Add custom connector.
- **Postgres.** The metric definitions already lived in SQL views, so I kept Postgres. I run it on my own VM rather than a managed service. Hyperdrive and a Cloudflare Tunnel make that safe: the VM opens no inbound port.

**Security.** The demo is public with no login, and every model call is on my key.

- The Worker's database role can only `SELECT` on one schema, in read-only transactions, with a 5 second timeout.
- Per-client rate limits, plus a daily budget for all visitors together: 300 questions and 60 workflow runs. When it is spent, the app says so until midnight UTC.
- Outside text, such as guest reviews, reaches the model wrapped as `<untrusted_data>`.
- Email is the riskiest feature, because a visitor types the address. Mail goes from one fixed sender (alerts@compass.razvanfrandes.com) in a fixed template, to one recipient per workflow, at most 6 per day per address and 50 per day overall. The model writes only the summary.
- Accepted risks are in `docs/security.md`. A visitor can change demo state. Nothing outside Compass changes.

## 6. Design system choices

- **Angular 22, Tailwind v4, Spartan UI.** Your product is Angular. Spartan gives unstyled primitives plus a styled layer I own.
- **Tokens first.** A dark-first palette sampled from Juyo's own app. Text tokens target WCAG AA.
- **A colour budget.** One hue for data. Orange only for "needs your decision". Red only for a failure. Purple only for actions and selection. Changes carry ▲/▼ as well as colour.
- **Inter with tabular figures**, because digits must line up in columns.
- **Hotel-native views.** Future nights are a rate calendar, the way RMS tools show them.

## 7. What is real, what is mocked, what I cut

**Real.** The Worker, the 24 MCP tools, both Kassandra modes, the morning brief detectors, semantic review search, workflows with approvals and audit, the workflow builder end to end, and email. Delivery to an outside Gmail address is confirmed.

**Mocked or partial.**
- All data is fictional: the hotels, 1.2 million reservations, accounts, reviews and the seven stories. The business date is fixed at 20 Nov 2026.
- Nothing is written to a hotel system. There is no PMS, RMS or POS integration. An "applied" action is a logged task plus an audit entry.
- There is no login. The approver's name is whatever the visitor types.
- The review corpus is templated. Its 203,791 reviews contain only 51 distinct sentences, so this data does not stress the search.
- The brief, thread, board and watcher screens are being connected to the live API.

**Cut for time.**
- Kassandra's Strategic tier and a single-hotel HotelGPT mode.
- Charts generated inside the chat, board storage, board generation from a description, and PDF export.
- Workflow branches, builder actions other than email, and a "would have fired N times in the last 30 days" backtest.

**Next, in order.**
1. The backtest.
2. Charts in chat from a shared spec, so an answer can be pinned to a board and edited.
3. Snapshots of history, so "what did we believe last Tuesday" has an answer.
4. Login and roles, so an approval becomes a real control.

**Where this started.** I built an earlier Compass before the interview: a dashboard with a docked assistant for a three-hotel group (https://compass.razvanfrandes.com). Compass MVP is a new repo. SQL-computed numbers and read-only model SQL come from the prototype. The brief, the MCP server, the agents, the workflows and the builder are new.

**How I built it.** With AI coding agents, inside written plans, contracts and tests. I answer for the result.

[TODO: a short personal note. What you enjoyed, and what you would do differently with a week.]
