# Pi Durable, MCP and RAG for Compass MVP (research, 2026-11-20)

The question was how to use **Pi Durable** (a durable agent harness) in Compass MVP, together with MCP and maybe RAG. This note sets that against the decisions already made in `docs/decisions.md` (Angular 22, Hashbrown generative UI, a strict component catalog, the model never computes a number) and against the 24 h deadline.

Anything marked **unverified** came from secondary text, or was inferred from it. Check it against the installed package types before writing code.

## TL;DR: recommendation

| Layer | Use | Why |
|---|---|---|
| Data access | **One MCP server over the hotel data** (`createMcpHandler` in a Worker) | It earns the bonus point. It is the one source of truth for the in-app chat, the agents and Claude Desktop. |
| Ask + Analyze (Kassandra chat, Canvas) | **Hashbrown**, with its tools mapped from the MCP server | Already decided. It is Angular-native and streams catalog components. The chat is short, interactive and needs no durability. |
| Act (Agent Studio: watchers, propose → approve) | **Pi Durable in a Durable Object (Cloudflare `PiHarness`)**, using the same MCP tools | This is where durability pays off: agents that sleep, wake on a schedule, wait for human approval and survive deploys. |
| RAG | **Not in the 24 h scope.** Use Pi skills or AI Search later, for documents | Our data is structured, and SQL through MCP is more accurate than vector search. RAG only helps once there are unstructured documents. |

Do not put Pi Durable behind the chat. Hashbrown and Pi both want to own the agent loop. Running both in one conversation means two loops, two transcript formats and losing Hashbrown's streaming UI. Pi belongs to Agent Studio, which is scope item 5, the lowest priority. Building it costs about half a day and carries experimental-API risk, so treat it as a stretch goal.

## 1. What Pi / Pi Durable is

Pi (`github.com/earendil-works/pi`, MIT, Node ≥ 22.19) is a TypeScript agent harness built from replaceable layers:

| Package | Role |
|---|---|
| `@earendil-works/pi-ai` | multi-provider LLM layer (Anthropic, OpenAI, Google…) |
| `@earendil-works/pi-agent-core` | agent loop and tool calling, in memory |
| `@earendil-works/pi-coding-agent` | the `pi` CLI and the `createAgentSession()` SDK, plus MCP, codemode and tool_search extensions |
| `@earendil-works/pi-durable` | **durable** runtime: `Harness`, conversations of immutable entries, durable tasks, `sleepUntil`, signals. Status: "Experimental. API changes without notice" |
| `@earendil-works/pi-schema` | tool parameter schemas (`obj`, `str`, `num`); plain JSON Schema also works, with `unknown` args |
| `@earendil-works/chord` | the document/delta runtime; clients apply ops with `applyImmutable` from `@earendil-works/chord/delta` |

How Pi Durable keeps state:
- Every model turn, tool call and piece of state is committed before it is shown.
- A tool call's intent is written before `execute()`. After a crash, only `replay: "safe"` tools run again. The others return `interrupted` to the model.
- A model stream that was cut off counts as one failed attempt under `settings.retry`. `restartLimit` (5 by default) stops crash loops.
- `requestId` / `operationId` make submits idempotent.
- `runtime.sleepUntil(...)` and `harness.signal(taskId, …)` give durable timers and external signals. These are exactly what a watcher agent and an approval step need.

There are three hosts: **Cloudflare `PiHarness`** (Agents SDK ≥ 0.33, Pi `~1.5.0`, beta), Vercel `durable-harness/pi-durable`, and Temporal `pi-temporal`. We deploy on Cloudflare, so we use `PiHarness`.

## 2. MCP server (do first: it is the bonus point and the shared layer)

- Use `createMcpHandler` from `agents/mcp`. It is Cloudflare's **recommended** path for new servers: stateless Streamable HTTP in a plain Worker, served at `/mcp`. `McpAgent` is the older path, so do not start new work on it.
- Watch the MCP SDK version: the docs flag a breaking change in 1.26.0, and the handler sits on the SDK v2 server factory.
- Tools (from JUYO_CONTEXT §10): `list_hotels`, `get_schema`, `get_kpis(hotel, metric, period)` and `run_readonly_query(sql)`. Every tool returns rows plus provenance (source, period, metric definition, query), so "evidence is one click away" comes for free.
- Test it with the MCP Inspector and `wrangler dev`. Demo it with Claude Desktop pointed at the same URL.

**Hashbrown consumes it.** Hashbrown has an official "Remote MCP" recipe (`hashbrown.dev/docs/angular/recipes/remote-mcp`):
1. Create an MCP client with `@modelcontextprotocol/sdk` over Streamable HTTP.
2. List the server's tools.
3. Map each one with `createTool()`, with a handler that calls `client.callTool(...)`.

The recipe's example uses the OpenAI adapter. For the Anthropic adapter (`@hashbrownai/anthropic` + `@anthropic-ai/sdk` + the AG-UI SSE encoder), the tools still run client-side, so the mapping should be the same. **Unverified.**

That settles open question 2 in `decisions.md`. The MCP server *is* the data layer, and Hashbrown's tool calling is a client of it. The model chooses tools and catalog components. The components get their numbers through MCP tools, never from the model.

## 3. Pi Durable for Agent Studio (stretch)

The use case is a watcher agent, e.g. "14-day occupancy below STLY", that follows the suggest → act with approval → act alone ladder.

```
Cron / alarm ──▶ Watcher DO (PiHarness)
                  ├─ detects anomaly deterministically (SQL via MCP tool, replay: "safe")
                  ├─ model explains it + drafts a proposal (e.g. a BAR change), with impact preview
                  ├─ waits for approval (durable signal; survives deploys/evictions)
                  ├─ on approve: applies a mocked action → audit log entry (undo)
                  └─ session.watch() ops ──WebSocket──▶ Angular "Agent Studio" inbox
```

DO shape (from Cloudflare docs; **check against installed `agents` types**):

```ts
import { DurableObject } from 'cloudflare:workers';
import { Lifecycle } from 'agents/lifecycle';
import { PiHarness } from 'agents/harness/pi';
import { MCPClientManager } from 'agents/mcp/client';
import { createAI } from 'agents/models/pi-ai';
import { createModels } from '@earendil-works/pi-ai/models';
import { createRegistry, Harness } from '@earendil-works/pi-durable';

export class Watcher extends DurableObject<Env> {
  ai = createAI({ binding: this.env.AI });
  registry = createRegistry();
  mcp = new MCPClientManager('compass-watcher', '1.0.0');
  harness = new PiHarness({
    harness: ({ storage, context, onWake }) => {
      const models = createModels();
      models.setProvider(this.ai.provider);
      return Harness.open(storage, { models, registry: this.registry, onWake }, context);
    },
    defaults: { model: this.ai('anthropic/claude-sonnet-5.5'), maxTurns: 6 }, // catalog id unverified
  });
  lifecycle = Lifecycle.install(this).use(this.harness).use(this.mcp);
}
```

- **MCP → Pi bridge.** Cloudflare documents none, so we write about 40 lines. For each `mcp.listTools()` result, call `registry.install({ name: 'compass-mcp', tools: [...] })`. Each tool's `execute` calls `mcp.callTool({ serverId, name, arguments })`. Read tools get `replay: 'safe'`.
- **Approvals.** PiHarness has **no built-in tool-approval step** yet. We model it ourselves:
  - a `propose_action` tool writes a proposal and returns;
  - the UI's Approve button submits an `app.approval` entry (`entry: { kind: 'app.…', data }`);
  - the model then calls `apply_action`, which refuses unless a matching approval exists.
- **Client.** PiHarness has no chat protocol or React hooks, which suits Angular. Send `watch.value` once, then stream `call.ops` over a WebSocket. A `@Service()` applies them to a `signal` with `applyImmutable()`.
- **Models.** PiHarness calls models through `agents/models/pi-ai`, which uses Workers AI or **AI Gateway**. For Claude, the key lives on the gateway (BYOK / Unified Billing), not in the Worker. Model ids use the catalog spelling with dots (`anthropic/claude-opus-5.5`) or `getBuiltinModel('anthropic', 'claude-opus-5-5')`. Whether Sonnet 5.5 and Haiku 5.5 are in the catalog is **unverified**.

If time runs short, a fallback that tells the same story: a Cloudflare Cron Trigger plus deterministic SQL, a single Claude call for the explanation, and a D1/KV table for proposals and the audit log. Call it a "light" agent in the write-up, and name Pi Durable as the next step.

## 4. RAG

- Numbers such as occupancy, ADR, RevPAR, pace and channel mix belong to SQL through MCP. Using RAG for them would contradict "the model never computes a number" and "accuracy is the exchange rate of trust".
- RAG starts to pay off once there are documents: SOPs, pricing policies, OTA and corporate contracts, event descriptions, guest reviews, market reports.
- Options, in order:
  1. **Pi skills from R2** (`skills(r2(bucket, { prefix }))` from `agents/harness/pi`): curated playbooks such as "how to read pace" or "UNTOLD weekend pricing" that the agent activates on demand.
  2. **Cloudflare AI Search** (R2 → automatic chunking, embeddings and Vectorize). Bind it with `ai_search_namespaces`, call `env.AI_SEARCH.get('docs').search({ messages })`, and expose it as an MCP tool `search_documents` so that chat, agents and Claude Desktop all get it.
  3. Raw Vectorize, only if we need our own chunking or per-hotel metadata filters.
- For the write-up, a fair line is: "RAG is deliberately absent. Structured questions go to SQL. Documents would enter through AI Search as one more MCP tool."

## 5. Risks

- **Experimental stack.** PiHarness is beta, Pi Durable is experimental, and Hashbrown is 0.x. Each `agents` release supports exactly one Pi minor (0.33 ↔ `~1.5.0`), and **rolling back across a Pi minor makes stored conversations unreadable**. Pin exact versions.
- PiHarness gaps: no tool approvals and no conversation deletion yet. `abort()` waits for idle, so tools must honor `ctx.abortSignal`.
- Without `onWake`, a sleeping task keeps the DO in memory, and billed.
- With a 24 h deadline, every hour spent on Pi is an hour taken from the briefing, Canvas and visual polish, which JUYO_CONTEXT ranks higher.

## Sources

- Cloudflare: [Pi harness](https://developers.cloudflare.com/agents/harnesses/pi/), [changelog 2026-10-02](https://developers.cloudflare.com/changelog/post/2026-10-02-pi-harness/), [long-running agents](https://developers.cloudflare.com/agents/concepts/long-running-agents/), [Pi AI models](https://developers.cloudflare.com/agents/models/pi-ai/), [MCP handler API](https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/), [remote MCP server guide](https://developers.cloudflare.com/agents/model-context-protocol/guides/remote-mcp-server/), [MCP client manager](https://developers.cloudflare.com/agents/runtime/capabilities/mcp-client-manager/), [AI Search as agent tool](https://developers.cloudflare.com/agents/tools/ai-search/), [Vectorize](https://developers.cloudflare.com/vectorize/)
- Pi: [repo](https://github.com/earendil-works/pi), [pi-durable README](https://github.com/earendil-works/pi/blob/main/packages/durable/README.md), [SDK docs](https://pi.dev/docs/latest/sdk), [Vercel Pi](https://vercel.com/docs/agent-harnesses/pi), [Temporal + Pi](https://temporal.io/blog/the-immortal-life-of-pi-running-the-pi-coding-agent-on-temporal)
- Hashbrown: [Remote MCP recipe](https://hashbrown.dev/docs/angular/recipes/remote-mcp), [Anthropic adapter](https://hashbrown.dev/docs/angular/platform/anthropic)
