---
name: pi-durable
description: Build Compass's durable agents with @earendil-works/pi-durable hosted in Cloudflare Durable Objects via PiHarness (agents SDK). Use when writing or reviewing Kassandra (chat agent), workflow/watcher agents, Pi tools, the MCP→Pi tool bridge, model setup through AI Gateway (Claude), streaming a Pi conversation to the Angular client, or approvals/sleeps in Pi tasks. Triggers on pi-durable, PiHarness, Harness.open, defineTool, ToolRegistration, createRegistry, agents/harness/pi, agents/models/pi-ai, session.watch, ConversationView.
---

# Pi Durable on Cloudflare (Compass)

Written 2026-11-20 from the official sources in `references/`:
- `pi-durable-README-1.5.2.md`: the package README at tag v1.5.2;
- `cloudflare-pi-harness.md`: `agents@0.33.0/docs/harnesses/pi.md`;
- `cloudflare-models-pi-ai.md`: `agents@0.33.0/docs/models-pi-ai.md`.

**When this file and the references disagree, the references win.** When the references and the installed `.d.ts` types disagree, the types win. Grep the references before guessing an API.

## Versions (hard pin)

| Package | Version | Why |
|---|---|---|
| `agents` | `0.33.0` | the first release with `PiHarness` on Pi 1.5 |
| `@earendil-works/pi-durable`, `pi-ai`, `pi-schema`, `chord` | **`1.5.2` exact** | `agents` peer range is `~1.5.0` |

- **Do not install Pi 1.6.** It came out on 2026-11-20 and `agents` does not support it yet. 1.6 adds `defineSignal`, tools that park, and approval gates. **These APIs do not exist in 1.5**, so do not copy them from the `main` README or the CHANGELOG.
- **Never roll back across a Pi minor.** Conversations stored by a newer minor cannot be read by an older one. Fix a bad deploy by rolling forward.
- Use exact versions in `package.json` (no `^` or `~`).

## Mental model

- **Harness:** one storage (the DO's SQLite) and the runner. Every change is an atomic commit, and nothing is shown before it is stored.
- **Conversation / session:** a transcript of immutable entries: `pi.user`, `pi.assistant`, `pi.tool-result`, `pi.system`, `pi.reset`, or our own `app.*` kinds.
- **Documents:** typed JSON next to the transcript.
  - Built-in: `pi.agent` (model, tools, instructions), `pi.live` (run, streaming answer, tools, `runFailure`), `pi.inbox`, `pi.usage` (tokens and cost).
  - Ours: `defineDoc`, with a kind prefixed `app.`.
- **Task:** a durable state machine that checkpoints after every phase. Built-in tasks: `pi.generation` (a model turn) and `pi.tool` (one tool call).
- **Extension:** a named bundle of `tools`, `sections` (system prompt), `hooks`, `wraps` and `tasks`, installed in a **registry**. Nothing in the registry is stored; conversations store extension names.

One answered input: `submit → pi.user → pi.generation → pi.assistant(tool calls) → pi.tool × n → pi.tool-result × n → pi.generation → pi.assistant(answer)`.

## Host it in a Durable Object (PiHarness)

```ts
import { DurableObject } from 'cloudflare:workers';
import { createModels } from '@earendil-works/pi-ai/models';
import { createRegistry, Harness } from '@earendil-works/pi-durable';
import { PiHarness } from 'agents/harness/pi';
import { Lifecycle } from 'agents/lifecycle';
import { createAI } from 'agents/models/pi-ai';

export class Kassandra extends DurableObject<Env> {
  ai = createAI({ binding: this.env.AI, byokAlias: 'compass' }); // the Claude key lives on AI Gateway
  registry = createRegistry();                                  // per object, NEVER at module scope

  harness = new PiHarness({
    harness: ({ storage, context, onWake }) => {               // may run more than once: keep it idempotent
      const models = createModels();
      models.setProvider(this.ai.provider);
      return Harness.open(storage, {
        models, registry: this.registry, onWake,              // always pass onWake (it lets the DO hibernate)
        settings: { afterFailedRun: 'withdraw', retry: { maxRetries: 3 } },
        onReport: (r) => console.warn('pi', r.kind, r.error),
      }, context);
    },
    defaults: { model: this.ai('anthropic/claude-sonnet-5.5'), maxTurns: 8 },
  });

  lifecycle = Lifecycle.install(this).use(this.harness);
}
```

wrangler: `"ai": { "binding": "AI" }`, a DO binding, and the migration `new_sqlite_classes: ["Kassandra"]`. Pi's tables are prefixed `pi_` in the DO's SQLite. To share that database with our own tables, see "Storage" in the README (`DurableObjectSqliteDatabase` + `SqliteStorage.open(db, { prefix: 'pi_' })`).

## Models (Claude via AI Gateway)

- **Verified** catalog ids in pi-ai 1.5.2: `anthropic/claude-sonnet-5.5`, `anthropic/claude-haiku-5.5`, `anthropic/claude-opus-5.5` (with dots). Any other string throws a `TypeError`.
- A session stores its model as `{ provider: 'cloudflare', modelId: 'anthropic/claude-sonnet-5.5' }`.
- Options passed to `ai(id, options)` **do not reach the session**. Put gateway options on `createAI(...)`.
- Keys: **none in the Worker.** AI Gateway holds the Anthropic key (BYOK, selected by `byokAlias`) or uses Unified Billing.
- Outside a Worker, e.g. in tests or scripts: `createAI({ accountId, apiToken, gateway })`.
- Compass tier mapping:
  - **Quick** = `anthropic/claude-haiku-5.5` with metric tools only;
  - **Thinker** = `anthropic/claude-sonnet-5.5` with all tools;
  - **Strategic** = Sonnet with 3 persona subagents + a synthesis. Use the subagent pattern; see README "Abort and Subagents".

## Tools

```ts
import { obj, str, num } from '@earendil-works/pi-schema';
import type { ToolRegistration } from '@earendil-works/pi-durable';

const GetMetric = obj({ metric: str(), hotel: str(), from: str(), to: str() });
export const getMetric: ToolRegistration<typeof GetMetric> = {
  name: 'get_metric',
  description: 'Governed hotel metric for a period. Returns rows + evidence (definition, source, sql).',
  parameters: GetMetric,          // pi-schema (JSON Schema). NOT TypeBox/Type.Object (removed in 1.5)
  replay: 'safe',                 // read-only, so safe to rerun after an eviction. Default is 'unsafe'.
  async execute(args, api, context) {
    const result = await callMcp('get_metric', args, context.abortSignal); // ALWAYS pass the abort signal
    await api.details({ evidence: result.evidence }, context);             // for the UI, never seen by the model
    return {
      output: [{ type: 'text', text: JSON.stringify(result.rows) }],       // what the model sees
      structuredOutput: result,                                            // for tool→tool calls (needs structuredOutputSchema)
    };
  },
};
registry.install({ name: 'compass-data', tools: [getMetric], sections: [{ key: 'rules', render: () => RULES }] });
```

- A result has 3 channels: `output` (the model), `structuredOutput` (programs), `details` (the UI). The transcript stores `output` and `details`.
- Throwing from `execute()` gives the model an error result; it does not crash anything.
- `control: { terminate: true }` on every result of a round ends the run with no further model call. Use it for `show_widget` when the widget *is* the answer.
- `deferred: true` + `createToolSearchExtension()` for large tool sets (e.g. a whole MCP server).
- `callers: ['model'] | ['tools']` controls who may call a tool; `configure({ modelTools })` narrows what the model is offered.
- Write tools (e.g. `apply_action`) stay `replay: 'unsafe'` and must be idempotent by key.

## MCP → Pi bridge (we write it ourselves; Cloudflare documents none)

- Connect with `MCPClientManager` from `agents/mcp/client`, added to the Lifecycle: `.use(this.mcp)`.
- In the factory, for each tool from `mcp.listTools()`, register a `ToolRegistration`:
  - `parameters` = the MCP `inputSchema` as-is (plain JSON Schema gives `unknown` args; the Harness still validates);
  - `execute` → `mcp.callTool({ serverId, name, arguments: args })`;
  - `replay: 'safe'` only for read-only tools.
- Install everything as one extension, `compass-mcp`. Re-installing the same name replaces it in place (hot reload).
- Use our own name prefix (e.g. `hotel__`) to avoid collisions.

## Talking to the client (Angular)

Server side:
- `const watch = await session.watch()`;
- send `watch.value` once, then forward each `call.ops` over a WebSocket;
- call `watch.stop()` when the client leaves.

Client side:
- keep a `signal<ConversationView>`;
- apply the ops with `applyImmutable()` from `@earendil-works/chord/delta`.

What to read from the view:
- `view.entries`: a window of the newest 50, growing to 100;
- `view.docs['pi.live'].generation.message`: the streaming answer;
- `live.run === undefined` means idle;
- `live.runFailure`: why a run ended without an answer;
- `view.docs['pi.usage']`: the cost meter.

Reconnect and long transcripts:
- watches live **in memory only**, so after a DO restart open a new one;
- `ConversationTranscript` (exported by pi-durable) merges values, pages older entries and resumes with `transcript.resume`.

The entries are Pi's own format. Map them to our UI models; never render raw.

Server API on PiHarness: `prompt`, `submit(input, { operationId, whenBusy, whenIdle, entry })`, `wait(operationId)`, `steer`, `continue`, `abort`, `pending`, `messages`, `watch`, `entries`, `reset`, `setModel`, `busy`, `harness.sessions.create/get/list/fork`.

## Workflows (Act): durable patterns that exist in 1.5

- **Schedule / wait:** a task defined with `defineTask` whose phase calls `runtime.sleepUntil(at, nextCheckpoint, context)`.
  - There is no sleep in the middle of a phase: work after the wait goes in the next phase, and what it needs goes in the checkpoint.
  - With PiHarness, `onWake` + the Lifecycle alarm wake the DO.
- **Steps:** each step is a phase or a child task.
  - Wait for children with `{ status: 'waiting', on, policy: 'allSettled' | 'failFast' }`.
  - Abort runs bottom-up.
- **Approval (1.5 way):**
  1. `propose_action` writes the proposal into an `app.proposals` doc and returns `control: { terminate: true }`.
  2. Approve or Deny in the UI → `session.submit('Approved: …', { entry: { kind: 'app.approval', data: { proposalId, by } }, operationId: 'approve:'+proposalId })`.
  3. `apply_action` checks the doc for a matching approval and otherwise throws.
  4. A `beforeTool` hook can also `block` `apply_action` without approval.
- **Audit / undo:** our own `app.audit` doc (`history: 'rewindable'` allows `snapshotAsOf`). Undo = a compensating action, also audited.
- **Idempotency:** a stable `operationId` / `requestId` for every submit, so a retry finds the same submission.

## Hard rules

1. Every async Pi call takes a Chord `Context`. Never ignore `context.abortSignal` in a tool: `abort()` and close wait for it.
2. One registry per DO instance. The factory must be safe to run again (after a storage error Pi reopens).
3. A storage error closes the Harness. Do not retry inside it: it reopens itself on the next call.
4. Our kinds and docs are prefixed `app.`; `pi.` is reserved.
5. The model never computes numbers. Numbers come from tools (SQL/MCP), and the prompt sections say so.
6. Read-only tools are `replay: 'safe'`. Tools with side effects are `unsafe` and idempotent by key.
7. Set `maxTurns` (default unlimited) and `settings.restartLimit` (default 5) on purpose.
8. Not available yet in PiHarness: tool approvals built into Pi (1.6) and deleting conversations.

## Testing (TDD)

- The core runs on `MemoryStorage` in Node with the faux provider, no Cloudflare and no API key needed. Unit-test tools, extensions and tasks there with Vitest:

  ```ts
  const harness = await Harness.open(new MemoryStorage(), { models, registry }, BACKGROUND_CONTEXT);
  ```
- Test recovery: open over Node SQLite (`openNodeSqliteStorage`), close mid-run, reopen, call `harness.resume()`, and assert.
- Integration on Workers: `@cloudflare/vitest-pool-workers` with the real DO.
- Official runnable examples (repo `packages/durable/test/examples` at tag `v1.5.2`):
  - 13 chat;
  - 19 inbox;
  - 21/22 subagents;
  - 23 child tasks;
  - 31 transcript;
  - 33 continue;
  - 34 submit-in-commit.
