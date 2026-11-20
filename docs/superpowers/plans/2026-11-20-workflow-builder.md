# Workflow Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A builder chat on Pi Durable that draws a workflow node by node as the user talks, saves it as an ordinary `Workflow`, and runs it with a real email action and a "Send test now" that streams node progress.

**Architecture:** The builder agent's tools edit a `WorkflowDraft` (a partial `WorkflowSpec`). A pure `specToGraph` in contracts turns any draft into a linear node chain, so the canvas is only a view and every saved graph is runnable by the existing `WorkflowAgents` runner. Email workflows end with a `send_email` tool (exactly once per run, fixed template, quotas in Durable Object storage) instead of `propose_action`.

**Tech Stack:** Cloudflare Workers + Durable Objects, `agents` 0.34 `PiHarness`, `@earendil-works/pi-durable` 1.6, zod 4, Vitest 5, Cloudflare Email Service (`send_email` binding).

**Spec:** `docs/superpowers/specs/2026-11-20-workflow-builder-design.md` (read it first).

## Global Constraints

- Start from branch `backend` **after** another session has merged `agent/finance`, `agent/rag` and `agent/security` into it. Do not merge them yourself. Check with `git log backend --oneline | head` that the merge commits are there before Task 1.
- Fit the security branch's rules once merged: `Budget` kinds, origin checks on sockets, `MAX_WORKFLOWS`, `PublicError` shapes. Read `docs/` from that branch (threat model, limits) before Task 3.
- TDD: failing test first. Domain/application code returns unions (`T | { error: string }`, as `WorkflowError` does); throwing stays in presentation and inside Pi tool `execute` (the existing pattern).
- Read-only hotel data. Nothing is written to Postgres.
- Sender: `Compass <alerts@compass.razvanfrandes.com>`. Email Sending is enabled on `compass.razvanfrandes.com`.
- Limits: one recipient per workflow; 3 emails/hour per recipient; 10 emails/hour per client IP; 50 emails/day in total. Scheduled email workflows disable themselves after 7 days or 5 non-test emails.
- Footer copy, exactly: `Compass demo · fictional data · you got this because someone entered your address in a Compass workflow.`
- Explore link: `https://juyo.razvanfrandes.com/ask?q=<question, URL-encoded>` (`APP_URL` var + `/ask?q=`).
- Builder model: Sonnet 5.5 (`THINKER_MODEL`). The Angular canvas is out of scope.
- Do not deploy. Deploying is the user's call.

## Review Focus

1. `/api/workflows/builder/ws` must not be swallowed by the generic `/api/workflows*` handler in `index.ts` → Task 5 has a routing test.
2. Model- or user-supplied text (workflow name, summary, facts) containing `<`, `>`, `&`, quotes must be escaped in the HTML email → Task 2 test.
3. A replayed or retried `send_email` call (Pi `maxRetries: 2`, `replay: 'safe'`) must not send a second mail → Task 3 test.
4. A manual `edit` with an invalid patch (empty hotels, bad address, unknown check tool) must leave the draft unchanged and return an error message → Task 4 test.
5. "Send test now" while a run is already in progress (runner returns 409) must produce an `error` message on the socket, not a dead socket → Task 5 test.

---

### Task 0: Security seams left by the finance/RAG/security merge

Found by the post-merge review (2026-11-20). Fix before the builder work. Read `docs/security.md` and `apps/worker/src/presentation/tools/catalog.ts` first.

**Files:**
- Modify: `apps/worker/src/presentation/tools/catalog.ts`, `apps/worker/src/application/review-search.ts`, `apps/worker/src/application/finance-data.ts`, `apps/worker/src/application/hotel-data.ts`, `apps/worker/src/domain/budget.ts`, `apps/worker/src/index.ts`, `apps/worker/wrangler.jsonc` (`DAILY_LIMITS`), `docs/security.md`, `docs/api.md`
- Test: `apps/worker/test/tool-errors.test.ts`, `apps/worker/test/catalog-untrusted.test.ts` (extend), `apps/worker/test/budget.test.ts` (or the existing budget test file)

**Requirements:**
1. **No internals in tool errors.** Only `run_readonly_query` may return database error text (and only it gets the "Fix the query… call get_schema" hint). Every other tool, on a database or embedder failure, returns the existing generic `TOOL_FAILURE` text and logs the real error. Applies to `get_pnl`, `get_forecast`, `find_reviews`, `get_metric` (`HotelData.#tryRun`) and any other tool that catches its own errors. `find_reviews` with a failing embedder returns exactly: `Semantic search is unavailable right now. Use search_reviews with a phrase.`
2. **Embedding budget on public MCP.** New budget kind `embedding`, daily limit 2000 in `DAILY_LIMITS`. Each `find_reviews` call made through `/mcp` takes one unit before embedding; when spent it returns the same "Semantic search is unavailable" message. Implement as a budget-checking `Embedder` wrapper passed to `new HotelData(...)` in the `/mcp` route only (Kassandra and workflows are already bounded by `question` / `workflow_run`).
3. **Cap tool text.** `success()` stops adding rows to the model text once it reaches 50,000 characters and appends `… N more rows not shown.` (`structuredContent` keeps all rows). `get_schema` marks vector columns with `(vector; never select it)`.
4. **`get_brief` wraps account names**: `success(…, 'account names')`.
5. **`/mcp` sends no CORS headers** (Claude Desktop and other MCP clients are not browsers): strip `Access-Control-*` headers from `/mcp` responses.
6. Update `docs/security.md` (wrapped tools incl. `find_reviews` and `get_brief`; descriptive errors only for `run_readonly_query`; Workers AI spend and the `embedding` budget in the threat model and limits table; no CORS on `/mcp`) and `docs/api.md` where it states these.

- [ ] **Step 1: Write failing tests:** per tool with a rejecting `Db` (error message containing `CONNECTION_CLOSED db.internal:5432`) the outcome text equals `TOOL_FAILURE` and does not contain `db.internal`; `run_readonly_query` still shows its DB error; `find_reviews` with a rejecting embedder (message containing `https://api.cloudflare.com/accounts/abc123`) returns the semantic-unavailable text; the budget wrapper refuses the 2001st embedding of the day; `success()` with 200 rows of 1 KB text stops under 51,000 characters and says how many rows were not shown; `get_brief` text contains `<untrusted_data source="account names">`; `/mcp` response headers contain no `access-control-allow-origin` (test the header-stripping function as a pure function).
- [ ] **Step 2: Run** `cd apps/worker && pnpm test` — Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm -r typecheck` and `cd apps/worker && pnpm test` — Expected: all PASS.
- [ ] **Step 5: Commit** `fix(worker): no internals in tool errors, embedding budget, capped tool text, no CORS on /mcp`.

### Task 1: Contracts — email action, draft, graph

**Files:**
- Modify: `packages/contracts/src/workflows.ts`
- Create: `packages/contracts/src/workflow-graph.ts`
- Create: `packages/contracts/src/builder.ts`
- Modify: `packages/contracts/src/index.ts` (exports)
- Test: `apps/worker/test/workflow-graph.test.ts`

**Interfaces:**
- Produces:
  - `ActionType` gains `'email'`.
  - `EmailDelivery = z.object({ channel: z.literal('email'), to: z.email() })`.
  - `WorkflowSpecShape` (the plain `z.object`, with new optional `delivery: EmailDelivery`), `WorkflowSpec = WorkflowSpecShape.superRefine(...)`: `action.type === 'email'` ⇔ `delivery` present. (zod 4 refuses `.partial()` on refined objects, hence the split.)
  - `WorkflowDraft = WorkflowSpecShape.partial()`; `type WorkflowDraft = z.input<typeof WorkflowDraft>`.
  - `Workflow` gains `emailsSent?: number`. `WorkflowRun` gains `test?: boolean; client?: string`. `AuditEntry['outcome']` gains `'emailed'`.
  - `maskEmail(address: string): string`.
  - `workflow-graph.ts`: `WorkflowNodeKind = 'trigger' | 'scope' | 'check' | 'analyze' | 'approval' | 'action'`; `interface WorkflowNode { id: string; kind: WorkflowNodeKind; label: string; detail: string; state: 'empty' | 'draft' | 'complete' }`; `interface WorkflowGraph { nodes: WorkflowNode[]; edges: { from: string; to: string }[] }`; `specToGraph(draft: WorkflowDraft): WorkflowGraph`; `changedNodes(before: WorkflowGraph, after: WorkflowGraph): string[]`.
  - `builder.ts`: `BuilderServerMessage = ChatServerMessage | { type: 'draft'; draft: WorkflowDraft; graph: WorkflowGraph; changed: string[]; workflowId: string | null; issues: string[] } | { type: 'run'; runId: string; status: WorkflowRun['status']; activeNode: string | null; done: string[]; failed: string | null }`; `BuilderClientMessage = ChatClientMessage | { type: 'edit'; patch: WorkflowDraft } | { type: 'save' } | { type: 'test' }`.

- [ ] **Step 1: Write the failing tests** in `apps/worker/test/workflow-graph.test.ts`:

```ts
it('draws the empty chain from an empty draft', () => {
  const g = specToGraph({});
  expect(g.nodes.map((n) => n.id)).toEqual(['trigger', 'scope', 'check', 'analyze', 'action']);
  expect(g.nodes.every((n) => n.state === 'empty')).toBe(true);
  expect(g.edges).toEqual([{ from: 'trigger', to: 'scope' }, { from: 'scope', to: 'check' }, { from: 'check', to: 'analyze' }, { from: 'analyze', to: 'action' }]);
});
it('one node per check, in order', () => {
  const g = specToGraph({ checks: ['get_pace', 'get_rate_position'] });
  expect(g.nodes.map((n) => n.id)).toEqual(['trigger', 'scope', 'check:get_pace', 'check:get_rate_position', 'analyze', 'action']);
});
it('no approval node for email, an approval node for price actions', () => {
  expect(specToGraph({ action: { type: 'email' } }).nodes.some((n) => n.kind === 'approval')).toBe(false);
  expect(specToGraph({ action: { type: 'adjust_bar' }, autonomy: 'approve' }).nodes.map((n) => n.id)).toContain('approval');
});
it('an email action without an address is a draft node', () => {
  expect(specToGraph({ action: { type: 'email' } }).nodes.find((n) => n.id === 'action')?.state).toBe('draft');
  expect(specToGraph({ action: { type: 'email' }, delivery: { channel: 'email', to: 'a@b.co' } }).nodes.find((n) => n.id === 'action')?.state).toBe('complete');
});
it('changedNodes lists added and relabelled nodes', () => {
  expect(changedNodes(specToGraph({}), specToGraph({ hotels: ['LIS1'] }))).toEqual(['scope']);
});
it('WorkflowSpec requires delivery exactly when the action is email', () => {
  const base = { name: 'Lisbon pace', hotels: ['LIS1'], trigger: { kind: 'schedule', every: 'day' }, goal: 'Email me if pace falls 10% behind STLY.' };
  expect(WorkflowSpec.safeParse({ ...base, action: { type: 'email' } }).success).toBe(false);
  expect(WorkflowSpec.safeParse({ ...base, action: { type: 'email' }, delivery: { channel: 'email', to: 'a@b.co' } }).success).toBe(true);
  expect(WorkflowSpec.safeParse({ ...base, action: { type: 'notify' }, delivery: { channel: 'email', to: 'a@b.co' } }).success).toBe(false);
});
it('masks addresses', () => {
  expect(maskEmail('silviu@gmail.com')).toBe('si****@gmail.com');
  expect(maskEmail('a@b.co')).toBe('a****@b.co');
});
```

- [ ] **Step 2: Run** `pnpm --filter @compass/worker test workflow-graph` — Expected: FAIL (imports missing).
- [ ] **Step 3: Implement** the contracts above. Node labels: trigger from `trigger.kind` (e.g. "Every morning, after the brief", "When the brief finds pace behind", "Run by hand"); scope "All 20 hotels" for `['ALL']` else the codes joined; check label from a `CHECK_LABELS: Record<string, string>` map in the same file with fallback to the tool name; analyze "Kassandra explains why"; action "Email <masked address>" or the action type. Exact wording is yours.
- [ ] **Step 4: Run** the tests, then `pnpm -r typecheck`. Expected: PASS, and existing code still typechecks (fix `WorkflowSpec` consumers that relied on `.shape` to use `WorkflowSpecShape`, e.g. `draft-tool.ts`).
- [ ] **Step 5: Commit** `feat(contracts): email action, workflow draft and graph`.

### Task 2: Email composition and sender port

**Files:**
- Create: `apps/worker/src/application/workflows/email.ts`
- Create: `apps/worker/src/infrastructure/cloudflare-email-sender.ts`
- Create: `apps/worker/src/infrastructure/do-email-quota.ts`
- Modify: `apps/worker/src/env.ts`, `apps/worker/wrangler.jsonc`
- Test: `apps/worker/test/workflow-email.test.ts`

**Interfaces:**
- Consumes: `Workflow`, `WorkflowRun`, `maskEmail` (Task 1).
- Produces (all in `application/workflows/email.ts`):
  - `interface OutgoingEmail { to: string; subject: string; text: string; html: string }`
  - `interface EmailSender { send(email: OutgoingEmail): Promise<{ messageId: string } | { error: string }> }`
  - `interface EmailQuota { take(recipient: string, client: string): Promise<{ ok: true } | { ok: false; reason: string }> }` — takes one unit from all three windows or none.
  - `interface WorkflowEmailInput { workflow: Workflow; test: boolean; wouldFire: boolean; summary: string; facts: string[]; definition: string; period: string; question: string; appUrl: string }`
  - `composeWorkflowEmail(input: WorkflowEmailInput): Omit<OutgoingEmail, 'to'>`
  - `CloudflareEmailSender(binding: SendEmail)` and `DurableEmailQuota(storage: DurableObjectStorage, now: () => Date)` implement the ports. Quota windows: per recipient 3 per rolling hour, per client 10 per rolling hour, global 50 per UTC day; keys normalised to lower case.
- Config: `send_email: [{ name: 'EMAIL', allowed_sender_addresses: ['alerts@compass.razvanfrandes.com'] }]`; `vars: { APP_URL: 'https://juyo.razvanfrandes.com' }`.

- [ ] **Step 0 (prerequisite, before any code): prove arbitrary recipients work.** Ask the user for a test address they control that is **not** a verified destination in the Cloudflare account. Send one mail with `npx wrangler email sending send` from `alerts@compass.razvanfrandes.com`. Expected: delivered. If it fails with a destination/plan error, stop and report: the fallback (verified allow-list) changes Task 3.
- [ ] **Step 1: Write the failing tests:**

```ts
it('subject says Test on a test run', () => {
  expect(composeWorkflowEmail({ ...input, test: true }).subject).toBe('Test · Lisbon pace watch');
  expect(composeWorkflowEmail({ ...input, test: false }).subject).toBe('Lisbon pace watch');
});
it('a test that would not fire says so', () => {
  expect(composeWorkflowEmail({ ...input, test: true, wouldFire: false }).text).toContain('Would not fire today');
});
it('escapes HTML from the model and the user', () => {
  const html = composeWorkflowEmail({ ...input, summary: '<script>x</script> & "q"', workflow: { ...input.workflow, name: '<b>n</b>' } }).html;
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;');
  expect(html).toContain('&lt;b&gt;n&lt;/b&gt;');
});
it('links to Kassandra with the question encoded', () => {
  expect(composeWorkflowEmail(input).text).toContain('https://juyo.razvanfrandes.com/ask?q=Why%20is%20Lisbon%20pace%20behind%3F');
});
it('carries the footer, in text and html', () => {
  const e = composeWorkflowEmail(input);
  expect(e.text).toContain(FOOTER); expect(e.html).toContain(FOOTER);
});
it('quota refuses the 4th mail to one address within an hour, and allows it an hour later', async () => { /* DurableEmailQuota over an in-memory storage fake with an injected clock */ });
it('quota refuses the 51st mail of the day across recipients', async () => { /* … */ });
```

- [ ] **Step 2: Run** `pnpm --filter @compass/worker test workflow-email` — Expected: FAIL.
- [ ] **Step 3: Implement** the module, the two adapters, the binding, `APP_URL` and their `Env` types. The HTML is a small inline-styled template (no external assets): title, summary, the facts as a list, definition and period in muted text, the Explore button, the footer.
- [ ] **Step 4: Run** the tests and `pnpm -r typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(worker): workflow email template, sender and quotas`.

### Task 3: `send_email` in workflow runs

**Files:**
- Create: `apps/worker/src/application/workflows/email-tool.ts`
- Modify: `apps/worker/src/application/workflows/store.ts`, `memory-store.ts`, `apps/worker/src/infrastructure/do-workflow-store.ts`
- Modify: `apps/worker/src/application/workflows/templates.ts` (`workflowInstructions`)
- Modify: `apps/worker/src/application/workflows/workflow-tools.ts` (`propose_action` refuses on email workflows)
- Modify: `apps/worker/src/presentation/agents/workflow-agents.ts`
- Test: `apps/worker/test/workflow-email-tool.test.ts`, extend `apps/worker/test/workflow-tools.test.ts`

**Interfaces:**
- Consumes: Task 2 ports, `composeWorkflowEmail`; Task 1 `maskEmail`.
- Produces:
  - `WorkflowStore` gains `emailForRun(runId: string): Promise<string | null>` (the receipt) and `recordEmail(runId: string, workflowId: string, receipt: string, test: boolean): Promise<void>` (also increments `emailsSent` for non-test sends).
  - `createEmailExtension(deps: { store: WorkflowStore; sender: EmailSender; quota: EmailQuota; appUrl: string; now?: () => Date }): Extension` with one tool `send_email`, `replay: 'safe'`, args `{ would_fire: boolean; summary: string (20–800); facts: string[] (1–6, ≤160 each); definition: string (≤300); period: string (≤80); question: string (≤200) }`.
  - `WorkflowAgents.run(id, trigger = 'manual', reason = '', opts: { test?: boolean; client?: string } = {})`.
- Behaviour of `send_email`, in order: no run scope → throw; `emailForRun` hit → return that receipt, no send; not a test and `would_fire` false → "Nothing to report; no email sent."; quota refused → return the reason as text, no send; else compose, send, `recordEmail`, `appendAudit({ outcome: 'emailed', receipt: 'Email <id> to <masked>' })`.
- Runner rules: `run()` refuses (400) a non-test run of an email workflow that is past `createdAt + 7 days` or has `emailsSent >= 5`, and sets `enabled: false`. `list()`/`get()` return `delivery.to` masked. `update()` returns 400 `The recipient can't be changed. Create a new workflow.` when the patch's `delivery.to` differs.
- `workflowInstructions` for email workflows: replace the propose/apply steps with "check the data; on a test run always call send_email once, with would_fire saying whether the condition holds today; otherwise call send_email only when it holds; quote numbers from tool results; never compute numbers yourself".

- [ ] **Step 1: Write the failing tests** on a real pi-durable `Harness` with the faux provider (same setup as `workflow-tools.test.ts`) and a fake `EmailSender` that records calls:
  - `sends once when the condition holds` — scripted `send_email` call → 1 sent mail, audit outcome `emailed`, recipient masked in the receipt.
  - `does not send twice when the call is replayed` — execute the same tool call twice for one run → 1 sent mail, same receipt returned.
  - `a scheduled run that finds nothing sends nothing` — `would_fire: false`, `test` unset → 0 mails.
  - `a test run sends even when it would not fire` — `would_fire: false`, `test: true` → 1 mail whose text contains `Would not fire today`.
  - `quota refusal sends nothing and says why`.
  - `propose_action refuses inside an email workflow`.
  - For the runner (unit-test the pure rule as `emailWorkflowBlocked(workflow: Workflow, now: Date): string | null` in `email.ts`): blocked after 7 days, blocked at 5 sends, not blocked otherwise.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** the tool, store methods (memory and DO), instructions, the runner options and rules, masking and the PATCH lock. Install the extension in `WorkflowAgents.#createRegistry` with `CloudflareEmailSender(this.env.EMAIL)`, `DurableEmailQuota(this.ctx.storage, …)`, `this.env.APP_URL`.
- [ ] **Step 4: Run** the full suite `pnpm --filter @compass/worker test` and `pnpm -r typecheck`. Expected: all PASS, existing workflow tests unchanged.
- [ ] **Step 5: Commit** `feat(worker): email workflows send once, within quotas`.

### Task 4: Builder tools and draft edits

**Files:**
- Create: `apps/worker/src/application/workflows/draft.ts`
- Create: `apps/worker/src/application/workflows/builder-tools.ts`
- Test: `apps/worker/test/workflow-builder-tools.test.ts`

**Interfaces:**
- Consumes: `WorkflowDraft`, `specToGraph`, `changedNodes` (Task 1).
- Produces:
  - `applyDraftPatch(draft: WorkflowDraft, patch: WorkflowDraft, allowedChecks: readonly string[]): { draft: WorkflowDraft; changed: string[] } | { error: string }` — validates every field present in the patch against `WorkflowSpecShape` field schemas and `allowedChecks`; on error the draft is untouched.
  - `draftIssues(draft: WorkflowDraft): string[]` — `WorkflowSpec.safeParse` issues as `path: message`, empty when saveable.
  - `interface DraftHost { get(): Promise<WorkflowDraft>; apply(patch: WorkflowDraft): Promise<{ changed: string[] } | { error: string }> }`
  - `createBuilderExtension(host: DraftHost, allowedChecks: readonly string[]): Extension` with tools (all `replay: 'safe'`), each applying one patch and returning the new graph as text plus `details: { graph, changed }`:
    - `set_trigger(trigger: WorkflowTrigger)`
    - `set_hotels({ hotels: string[] })`
    - `add_check({ tool })` / `remove_check({ tool })`
    - `set_goal({ name, goal })`
    - `set_action({ type: ActionType, guidance? })`
    - `set_email({ to })` — sets `delivery` and `action: { type: 'email' }`.
  - A tool given an invalid value throws the `error` text (Pi shows it to the model as a failed tool call).

- [ ] **Step 1: Write the failing tests:**
  - `applyDraftPatch` rejects `{ hotels: [] }`, `{ delivery: { channel: 'email', to: 'nope' } }`, `{ checks: ['drop_table'] }` with an error and leaves the draft equal to the input.
  - `applyDraftPatch` on `{ hotels: ['LIS1'] }` returns `changed: ['scope']`.
  - With the faux provider scripting `set_trigger`, `set_hotels`, `add_check`, `set_goal`, `set_email` in that order, the host's draft passes `WorkflowSpec.safeParse` and each call's `details.changed` names exactly one node, in chain order.
  - `add_check` with an unknown tool fails the call and the draft has no new check.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** tests + typecheck. Expected: PASS.
- [ ] **Step 5: Commit** `feat(worker): workflow builder tools over a draft`.

### Task 5: `WorkflowBuilder` Durable Object, socket, test runs

**Files:**
- Create: `apps/worker/src/presentation/agents/chat-socket.ts` (shared socket loop extracted from `kassandra.ts`)
- Modify: `apps/worker/src/presentation/agents/kassandra.ts` (use it; behaviour unchanged)
- Create: `apps/worker/src/presentation/agents/workflow-builder.ts`, `builder-prompt.ts`
- Create: `apps/worker/src/application/workflows/run-progress.ts`
- Modify: `apps/worker/src/index.ts`, `apps/worker/src/env.ts`, `apps/worker/wrangler.jsonc`
- Modify: `docs/api.md`
- Test: `apps/worker/test/run-progress.test.ts`, `apps/worker/test/builder-routing.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4; `WorkflowAgents.create/update/run/runLog` (Task 3 signature for `run`).
- Produces:
  - `serveChatSocket(socket: WebSocket, session: PiSession, opts: { onMessage(raw: unknown): Promise<void>; onOpen?(send: (m: BuilderServerMessage) => void): Promise<void> }): Promise<void>` — the snapshot/entries/live loop now in `Kassandra.#serve`.
  - `runProgress(entries: ChatEntry[], graph: WorkflowGraph, status: WorkflowRun['status']): { activeNode: string | null; done: string[]; failed: string | null }`. Rules: `trigger` and `scope` are done at start; a tool call named `X` with node `check:X` is active until its result, then done; other tool calls and assistant text make `analyze` active; a `send_email` call makes `action` active, its successful result makes it done (and `analyze` done); status `failed` sets `failed` to the active node.
  - `WorkflowBuilder` DO: one per draft (`idFromName(draft)`), `PiHarness` like `Kassandra`, model `THINKER_MODEL`, registry = builder prompt section + `createBuilderExtension` + the read-only data extension. Storage keys: `draft`, `workflowId`.
  - Client messages: `ask`/`steer`/`abort` as Kassandra (same `ASK_RATE_LIMIT` and, after the merge, the security branch's `Budget`); `edit` → `applyDraftPatch`, broadcast `draft`, add an `app.edit` event entry for the agent; `save` → `WorkflowAgents.create` (or `update`; a changed recipient creates a new workflow and switches `workflowId`), broadcast `draft` with `workflowId`; `test` → save if needed, `WorkflowAgents.run(workflowId, 'manual', 'test from builder', { test: true, client })`, then poll `runLog` every 1 s (stop at `done`/`failed` or after 3 min) and send `run` messages computed by `runProgress`. A runner error (e.g. 409) is sent as `{ type: 'error', message }`.
  - Every draft change (tool or edit) sends `{ type: 'draft', draft, graph, changed, workflowId, issues: draftIssues(draft) }`. On connect, after the snapshot, the current `draft` is sent.
  - Route: `GET /api/workflows/builder/ws?draft=<1–64 of [A-Za-z0-9_-]>`, matched **before** the generic `/api/workflows` handler, with the same origin checks as the Kassandra socket.
  - Wrangler: DO binding `WORKFLOW_BUILDER` / class `WorkflowBuilder`, a new `new_sqlite_classes` migration with the next free tag after the merge.
  - Builder prompt (`builder-prompt.ts`): build in chain order, one tool call per node (trigger, hotels, checks, goal, action/email); look at the data with read tools before choosing a threshold and say what it would do today; ask for the address only when the user wants email and has not given one; keep replies to one or two sentences.

- [ ] **Step 1: Write the failing tests:**
  - `run-progress.test.ts`: a run log with `get_pace` call and result, assistant text, `send_email` call and result → `done` = `['trigger', 'scope', 'check:get_pace', 'analyze', 'action']`, `activeNode` null; the same log cut after the `get_pace` call → `activeNode: 'check:get_pace'`; status `failed` mid-check → `failed: 'check:get_pace'`.
  - `builder-routing.test.ts`: the Worker's route matcher sends `/api/workflows/builder/ws` to the builder and `/api/workflows/wf-1` to the workflows handler (extract the matcher as a pure `routeOf(pathname): 'builder' | 'workflows' | …` if it is not already testable).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `run-progress.ts`, the routing change, `chat-socket.ts` (Kassandra switched over), the DO, prompt, bindings, `Env`.
- [ ] **Step 4: Run** the full suite and typecheck. Expected: PASS.
- [ ] **Step 5: Manual end-to-end** with `wrangler dev` (local Postgres per `docs/infrastructure.md`) and a small Node WebSocket script in `apps/worker/scripts/builder-demo.ts`:
  - ask "Email me every morning if Lisbon's pace falls more than 10% behind last year. My address is <user's test address>";
  - Expected: one `draft` message per tool call, the last with `issues: []`;
  - send `save`, then `test`; Expected: `run` messages walking the chain, ending with `action` done, and the mail arrives with subject `Test · …`;
  - send `test` again while the first runs; Expected: an `error` message, socket stays open;
  - send a 4th test within the hour to the same address; Expected: the run ends without a mail and says the limit was reached.
  Ask the user for the test address; do not use any address from memory or git config.
- [ ] **Step 6: Document** in `docs/api.md`: the builder socket, `draft`/`run`/`edit`/`save`/`test` messages, node ids and kinds, the `/ask?q=` contract, the email limits and masking.
- [ ] **Step 7: Commit** `feat(worker): workflow builder on Pi Durable with live graph and test runs`.
