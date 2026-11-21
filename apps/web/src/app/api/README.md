# API layer

Typed clients for the live backend (`docs/api.md`). Types come from `@compass/contracts`; import them, never redefine them.

```ts
import { KassandraChat, BriefApi, WorkflowsApi, groupTurns } from './api';
```

- **URLs.** Everything goes to the relative `/api` (`API_BASE`). In production that is the same origin. `ng serve` proxies `/api`, sockets included, to `https://juyo.razvanfrandes.com` (`proxy.conf.json`). To use a local worker: `{ provide: API_BASE, useValue: 'http://localhost:8787/api' }`.
- **Errors are values.** HTTP calls return `ApiResult<T>` = `{ ok: true, value } | { ok: false, error: { status, message, resetsAt? } }` and never throw. `error.message` is the server's text: show it as is (409 limits, 429 budget).
- **Contracts at runtime.** `@compass/contracts` exports TypeScript source with `.ts` import paths; `rewriteRelativeImportExtensions` in `tsconfig.json` lets the app compile it. Values work too (`specToGraph`, the zod schemas), not only types.

## Kassandra chat — `KassandraChat`

A root singleton, all signals. It connects on `connect()` or on the first `ask()`, reconnects by itself, and keeps the conversation id in local storage.

```ts
export class Thread {
  protected readonly chat = inject(KassandraChat);
  protected readonly mode = signal<AnswerMode>('thinker');

  constructor() {
    this.chat.connect(); // loads the stored conversation's transcript
  }

  protected send(text: string) {
    if (this.chat.running()) this.chat.steer(text); // or ask(): it is queued as a follow-up
    else this.chat.ask(text, this.mode());
  }
}
```

```html
@for (turn of chat.turns(); track turn.key) {
  @if (turn.question) { <user-bubble [text]="turn.question" [dimmed]="turn.pending" /> }
  @if (turn.steps.length) {
    <!-- "Worked for 4s · 3 steps", collapsed -->
    <steps [steps]="turn.steps" [workedMs]="turn.workedMs" [running]="turn.running" />
  }
  @if (turn.answer ?? turn.streamingText; as text) { <markdown [text]="text" /> }
  @if (turn.failure; as failure) { <failure [reason]="failure.reason" [detail]="failure.detail" /> }
}
@if (chat.error(); as error) { <p role="alert">{{ error }}</p> }
@if (chat.running()) { <button (click)="chat.abort()">Stop</button> }
<cost-meter [usage]="chat.usage()" />
```

| Signal | What |
|---|---|
| `turns` | The transcript grouped for rendering (below). |
| `entries`, `live` | The raw `ChatEntry[]` (merged by id, ascending) and `ChatLive \| null`. |
| `connected`, `status` | `status` is `idle \| connecting \| open \| reconnecting`. Show "Reconnecting…" on the last one. |
| `running` | Show Stop. |
| `error` | The last message the server rejected (rate limit, budget). Cleared by the next `ask`/`steer` or `clearError()`. |
| `usage` | `{ tokens, costUsd }` of the whole conversation. |
| `pending` | Questions sent that the server has not committed yet. They are already in `turns` with `pending: true`. |
| `conversation` | The id. `open(id)` switches to one from the URL, `newConversation()` starts an empty one. |

A `ChatTurn` is `{ key, question, pending, steps, answer, streamingText, running, failure, workedMs, model, usage, events }`.

- `steps`: one per tool call, `{ callId, name, args, status, narration, error?, rows?, evidence?, draft?, sent? }`. `status` is `done` or `error` once the result is in; before that it is the live status (`pending`, `running`, …). `rows` and `evidence` feed the widgets and "Behind the numbers". `narration` is what the agent said before that round of calls: show it as a step, never as the answer.
- `answer` is the final Markdown, or null. While `running`, render `streamingText` in its place.
- `draft` on a `draft_workflow` step is a `WorkflowSpec`: show the editable card, and **Save** calls `WorkflowsApi.create(draft)`.
- A turn with `question: null` (key `head`) holds entries from before the first question in view; the server sends the newest 50 entries only.
- `ask()` returns the ask id, or null for empty text. A rejected question leaves `turns` and its reason is in `error`; keep the text in the composer until the turn is no longer pending if you want to let the person retry.
- **`/ask?q=…`** (links in the alert emails) must pre-fill the composer with `q` and must not call `ask()`.
- **Scope.** `ask(text, mode, { hotels })` restricts the answer to those hotels (round2-contracts §1). An empty list is left out of the message: the whole group. `Live` passes `ScopeService.hotels()` with every question.
- **Calls being written.** `live.drafting` (optional) lists tool calls the model is still writing, with partial arguments. `<kassandra-conversation [drafting]>` merges them with `live.tools` (`liveCalls`), so skeletons and a chart's title start early.
- **Widgets.** A `show_widget` step carries `widget`: the spec plus the `rows`, `columns` and `evidence` of the tool result it names (round2-contracts §3). `<kassandra-conversation>` draws it; do not render it yourself.
- **Round 2 types** (`AskScope`, `WidgetSpec`, `ChatWidget`, `EvidenceColumn`, `Board`, `BoardWidget`, `VoiceToken`) are defined in `@compass/contracts`; `round2-contracts.ts` re-exports them under these names.

The screens do not render turns themselves any more: `src/app/kassandra/` has the one composer (`<kassandra-composer>`) and the one conversation (`<kassandra-conversation [turns] [phase] [error] [usage]>`), used by every surface.

`groupTurns(entries, live?)` is pure. Use it for a workflow run's log too:

```ts
const log = this.workflows.runLogResource(this.runId);
readonly turns = computed(() => groupTurns(log.value()?.entries ?? []));
```

The workflow builder socket speaks the same protocol plus `draft` and `run`. `ChatSocket` (what `KassandraChat` wraps) takes them through `onMessage`:

```ts
const chat = new ChatSocket<Extract<BuilderServerMessage, { type: 'draft' | 'run' }>>({
  url: () => wsUrl(base, 'workflows/builder/ws', { draft: draftId }),
  onMessage: (message) => (message.type === 'draft' ? draft.set(message) : run.set(message)),
});
chat.connect();
chat.send({ type: 'edit', patch: { trigger: { kind: 'schedule', every: 'week' } } });
// Call chat.disconnect() from DestroyRef.onDestroy.
```

## Morning brief — `BriefApi`

```ts
protected readonly api = inject(BriefApi);
// api.brief is an httpResource<Brief>: value(), isLoading(), reload(). api.error() is an ApiError | null.
protected readonly items = computed(() => this.api.brief.value()?.items ?? []);

protected async refresh() {
  const result = await this.api.refresh(); // POST /api/brief/refresh; updates api.brief on success
  if (!result.ok) this.notice.set(result.error.message);
}
```

Show `item.summary ?? item.title`, with the AI label only when `summary` is there. "Explore" is `live.explore(item.question, scope, 'brief:' + item.id)`: it opens the Thread and sends at once, and the same item reopens its thread. `api.budget()` returns today's usage of the daily limits.

## Workflows, inbox, audit — `WorkflowsApi`

Every call returns `Promise<ApiResult<T>>`:

| Call | Endpoint |
|---|---|
| `list()` · `get(id)` | `GET /api/workflows` · `/api/workflows/:id` → `{ workflow, runs, proposals }` |
| `create(spec)` · `patch(id, changes)` | `POST /api/workflows` · `PATCH /api/workflows/:id` |
| `run(id)` | `POST /api/workflows/:id/run` → `WorkflowRun` (409 while one is running) |
| `duplicate(id)` · `remove(id)` | `POST /api/workflows/:id/duplicate` → `Workflow` (off, named "… (copy)") · `DELETE /api/workflows/:id` → 204, `value` is null |
| `runLog(runId)` | `GET /api/runs/:runId` → `{ run, entries }` |
| `proposals(status?)` | `GET /api/proposals?status=…` |
| `decide(id, { approved, by, note? })` · `undo(id, by)` | `POST /api/proposals/:id/decision` · `/undo` |
| `audit()` | `GET /api/audit` |

For a screen, the `*Resource` methods wrap the GETs as `httpResource` (create them in a field initializer):

```ts
export class Inbox {
  private readonly api = inject(WorkflowsApi);
  protected readonly inbox = this.api.proposalsResource(); // pending; value() is [] until loaded
  protected readonly notice = signal<string | null>(null);

  constructor() {
    // The contract is polling: a decision wakes the run, and the proposal moves on a moment later.
    const timer = setInterval(() => this.inbox.reload(), 5000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected async decide(proposal: Proposal, approved: boolean) {
    const result = await this.api.decide(proposal.id, { approved, by: 'Ana Pop (RM)' });
    if (!result.ok) this.notice.set(result.error.message);
    this.inbox.reload();
  }
}
```

Also `listResource()`, `detailResource(() => id())`, `runLogResource(() => runId())` (both idle while the id is undefined) and `auditResource()`. A resource's failure as a value: `toApiError(resource.error())`.

## Hotels — `HotelsApi`

`list()` and `listResource()` wrap `GET /api/hotels` → `HotelRef[]` (`docs/round2-contracts.md` §1). `HotelRef` is declared in `hotels-api.ts` until `@compass/contracts` exports it. Screens do not call this client: they read `ScopeService` (`src/app/scope`), which falls back to a built-in list while the endpoint is missing.

```ts
protected readonly scope = inject(ScopeService);
// scope.hotels()  → string[] of hotel codes, empty for the whole group: send it as `scope.hotels` with an ask
// scope.includes(row.hotel_code), scope.label(), scope.nameOf('LIS'), scope.href('/ask?c=…')
```

## Tests

`npx ng test --watch=false` in `apps/web`. `testing.ts` has the fake socket (`FakeSocket`) and entry builders; provide `SOCKET_FACTORY` to test a screen without a network.
