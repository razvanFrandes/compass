# Workflow builder: talk, and the workflow draws itself

Status: draft for approval, 2026-11-20.

## Intent

Juyo's Agent Studio ("hoteliers set up agents and workflows that watch the numbers") is still **Coming Soon** on their pricing page. Compass shows what it could be: a hotelier describes what they want in plain language, and a workflow appears node by node on a canvas in front of them. It works for real. For now there is one action, an **email**. The demo moment is Silviu typing his own address, pressing **Send test now**, watching the nodes light up, and getting the mail ten seconds later.

It must visibly run on **Pi and Pi Durable**. Reviewers should see the agent's steps in the chat and know the conversation and runs are durable.

## Goals

- A separate builder chat on the workflows page. Its agent edits the workflow through tools, and each edit appears on the canvas as it happens.
- The person can also edit nodes by hand. Agent and person edit the same draft, and the agent sees manual edits.
- A saved draft is an ordinary `Workflow` that the existing runner (`WorkflowAgents`, Pi) executes on its trigger.
- An email action: a real email from `Compass <alerts@compass.razvanfrandes.com>` with the finding, the numbers, the metric definition and an "Explore in Kassandra" link.
- **Send test now**: runs the draft once on today's data and streams which node is active.

## Non-goals (for now)

- Branches or arbitrary graphs. The graph is a linear chain.
- Actions other than email in the builder (the existing proposal actions stay as they are).
- "Would have fired N times in the last 30 days" backtest.
- The Angular canvas itself. It is built later, by the design-system session, on the contract defined here.

## Anti-goals

- An open email relay. The public demo must not let anyone mail arbitrary people arbitrary content.
- The model computing numbers. Checks are MCP tools over SQL; the model only explains.
- A generic node editor (Zapier, n8n). Nodes speak the hotel's language: findings, metrics, hotels.

## Constraints

- Backend: `apps/worker` in `compass-mvp-backend` (branch `backend`). Other agents' work (finance, RAG, security) is being merged into `backend` by another session. **Start from `backend` after that merge.**
- Pi Durable via `PiHarness`, the same way as `Kassandra` and `WorkflowAgents`.
- Contracts in `packages/contracts` (zod). The Angular app imports them.
- DDD layout and TDD (failing test first). No throwing in domain/application; use the Result pattern already in use.
- Read-only database (`compass_ro`). Nothing is written to hotel data.
- Email Sending is enabled on `compass.razvanfrandes.com` (SPF, DKIM, DMARC, bounce MX in place). Sending to arbitrary recipients needs the Workers Paid plan; check it with the first real send.

## Approaches considered

1. **Spec-editing tools; the graph is derived from the spec (chosen).** The agent's tools change fields of a `WorkflowSpec` draft (trigger, hotels, checks, goal, action). A pure function `specToGraph(draft)` turns the draft into nodes and edges. The agent can never produce an invalid graph, every graph is runnable by the existing runner, and the canvas stays a view.
2. **Generic graph tools** (`add_node`, `connect`, `remove_node`). Looks more like React Flow, but the agent can build graphs the runner cannot execute, and a graph → spec compiler with error handling is needed.
3. **Reuse Kassandra's `draft_workflow`.** Already exists, but it returns the whole spec in one call, so nothing appears node by node, and the builder would share Kassandra's chat instead of having its own.

## Design

### The graph (derived, in contracts)

`specToGraph(draft: Partial<WorkflowSpecInput>): WorkflowGraph`, a pure function in `packages/contracts`, used by the worker and the Angular app.

```
trigger ─▶ scope ─▶ check(s) ─▶ analyze ─▶ [approval] ─▶ action
```

| Node | From the spec | Example label |
|---|---|---|
| `trigger` | `trigger` | "Every morning, after the brief" / "When the brief finds pace behind" |
| `scope` | `hotels` | "Lisbon" / "All 20 hotels" |
| `check:<tool>` (one per check) | `checks[]` | "Pace vs STLY" (`get_pace`) |
| `analyze` | `goal` | "Kassandra explains why" |
| `approval` | `autonomy`, `approver` | only when the action needs approval; email does not |
| `action` | `action`, `delivery` | "Email silviu@…" |

Each node has `{ id, kind, label, detail, state }`, where `state` is `empty | draft | complete`. A node whose field is missing renders as a placeholder (`empty`), so the chain is visible from the first message and fills in. Edges are the chain order. Layout (positions) is the canvas's job.

### Contract changes

- `ActionType` gets `'email'`.
- `WorkflowSpec` gets an optional `delivery: { channel: 'email'; to: string (email, max 1 address) }`, required when `action.type === 'email'`.
- New `WorkflowGraph`, `WorkflowNode`, `specToGraph`.
- New builder socket messages (below).

### Builder agent: `WorkflowBuilder` Durable Object (Pi Durable)

- One DO per draft, `PiHarness`, Claude Sonnet 5.5. Socket at `/api/workflows/builder/ws?draft=<id>`, same message shapes as Kassandra (`snapshot`, `entries`, `live`, `error`; client `ask`, `steer`, `abort`), so the chat UI is reused.
- The DO stores the current draft. Extra server message: `{ type: 'draft', draft, graph, changed: nodeId[] }`, sent after every change.
- Tools, each changing one part of the draft and returning the new graph:
  `set_trigger`, `set_hotels`, `add_check`, `remove_check`, `set_goal`, `set_action`, `set_email`.
  Plus the read-only MCP data tools, so it can look at the numbers while building ("Lisbon is already −20% vs STLY, so a −10% threshold would fire tomorrow").
- The system prompt makes it build in chain order, one tool call per node, so nodes appear one by one.
- Manual edits: client sends `{ type: 'edit', patch }`. The DO validates, applies, broadcasts `draft`, and records an `event` entry (`app.edit`) so the agent sees it on its next turn.
- **Save** (my call: the builder object owns the save, so a test always runs on a saved workflow and there is one runner): the client sends `{ type: 'save' }`. Once `WorkflowSpec.safeParse` passes, the builder calls `WorkflowAgents.create` and keeps the returned `workflowId`. Later edits in the same builder go to `WorkflowAgents.update`. The UI's Save button is disabled until the draft is valid.

### Email action

- **When it sends** (my call): the run agent gets a `send_email` tool in place of `propose_action` when `action.type === 'email'`. It calls it only if its checks show the goal's condition is met. A scheduled run that finds nothing sends nothing and ends with "nothing to report".
- **A test run always sends**, marked "Test" in the subject. The mail says plainly whether the workflow would have fired today ("Would fire: Lisbon pace −20% vs STLY" or "Would not fire today: pace −4%, threshold −10%"), so the demo works on any day.
- **Exactly once:** the send tool keys on the run id; a replayed or retried call returns the earlier result and does not mail again. Email is low risk, so no approval.
- Binding restricted to `allowed_sender_addresses: ["alerts@compass.razvanfrandes.com"]`.
- Content is a **fixed template** filled from the run: title, the agent's summary, the key numbers from tool evidence, the metric definition, period, "Explore in Kassandra" link, and the footer "Compass demo · fictional data · you got this because someone entered your address". Plain text and HTML. The model writes only the summary paragraph; the person cannot inject free text into the mail.
- The run writes an audit entry (`outcome: 'emailed'`, recipient masked).

### Send test now

- The client sends `{ type: 'test' }` on the builder socket. It saves first if needed, then the builder calls `WorkflowAgents.run(workflowId, 'manual')` with a test flag and follows that run. (Amended after the final review: `POST /api/workflows/:id/test` was not built. The builder socket's `test` message is the only way to start a test run.)
- The run log maps to nodes: trigger → scope → each `check:<tool>` when that tool is called → `analyze` while the model writes → `action` when the mail is sent. The client gets `{ type: 'run', runId, activeNode, done: nodeId[], failed? }` on the builder socket.

### Abuse limits (public demo)

- One recipient per workflow. At most 3 emails per hour per recipient, 10 per hour per client IP, 50 per day globally (Workers rate limit bindings plus a counter in the DO).
- Recipients pass a basic email validation; no lists, no cc/bcc.
- Fixed template only (above).
- The API has no login, so (my calls):
  - reads (`GET /api/workflows`, `/api/workflows/:id`, audit) show the recipient masked (`si****@gmail.com`);
  - `delivery` cannot be changed by `PATCH` after save. A different address means a new workflow;
  - a scheduled email workflow disables itself after 7 days or 5 sent emails, whichever comes first, and the last mail says so.
- **Explore in Kassandra** links to `https://juyo.razvanfrandes.com/ask?q=<the workflow's question, URL-encoded>`. This is a contract for the Angular app (route `/ask`, param `q` pre-fills the question; the person presses send — amended after the final review, it does not send on its own) and goes into `docs/api.md`.

### Plan and prerequisites

- The account is almost certainly on Workers Paid (the POC deployed Containers, which require it), so arbitrary recipients should work. The first task sends one real email to a non-verified test address before anything else is built; if it fails, the fallback is a fixed allow-list of pre-verified demo addresses.
- Build on `backend` **after** the finance, RAG and security branches are merged. Fit the security branch's rules: `Budget` kinds for builder questions and test runs, origin checks on the builder socket, `MAX_WORKFLOWS`, `PublicError` shapes.

## Left to the builder

- Exact tool argument shapes and node labels.
- How run progress is derived from the run's Pi session (watch ops vs polling the log).
- Where the per-recipient counter lives.
- Test structure, following the existing `apps/worker/test` patterns.

## Done when

- A conversation like "Email me every morning if Lisbon's pace falls more than 10% behind last year" produces the full chain through tool calls, one node per call, visible as `draft` messages.
- A manual `edit` changes the draft and the agent acknowledges it next turn.
- Saving creates a `Workflow`; **Send test now** delivers a real email to a test address and streams node progress.
- Rate limits refuse the 4th email to the same address within an hour (and, since the final review, the 7th within a UTC day).
- `docs/api.md` documents the builder socket, `draft`/`run` messages, the `test` message and the email limits for the Angular session. (Amended after the final review: the HTTP endpoint `POST /api/workflows/:id/test` was not built; the builder socket's `test` message covers it.)
