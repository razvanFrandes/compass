/**
 * Dev-only: walks the workflow builder end to end over its WebSocket, against `wrangler dev`.
 *
 *   TEST_EMAIL=you@example.com node --experimental-strip-types scripts/builder-demo.ts
 *
 * It asks the builder for an email workflow, edits the draft by hand, saves it, and sends test runs:
 * one followed on the graph, a second while the first still runs (refused), then more until the hourly limit of the
 * address is reached (the last run ends without a mail). Every question and run spends model tokens.
 *
 * Env: TEST_EMAIL (required; printed masked), BASE (default http://localhost:8787), DRAFT (default: a new id),
 * TESTS (default 4: test runs in all).
 */
export {};

const email = process.env['TEST_EMAIL'];
if (!email) throw new Error('Set TEST_EMAIL to the address the test mails go to.');
const base = process.env['BASE'] ?? 'http://localhost:8787';
const draftId = process.env['DRAFT'] ?? `demo-${crypto.randomUUID().slice(0, 8)}`;
const tests = Number(process.env['TESTS'] ?? 4);

type Message = { type: string; [key: string]: unknown };

const masked = `${email.slice(0, 2)}****${email.slice(email.lastIndexOf('@'))}`;
const show = (value: unknown) => JSON.stringify(value).replaceAll(email, masked);
const log = (line: string) => console.log(`${new Date().toISOString().slice(11, 19)} ${line.replaceAll(email, masked)}`);

const socket = new WebSocket(`${base.replace(/^http/, 'ws')}/api/workflows/builder/ws?draft=${draftId}`);
const inbox: Message[] = [];
let wake: (() => void) | undefined;
let lastDraft: Message | undefined;

socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data)) as Message;
  if (message.type === 'draft') lastDraft = message;
  describe(message);
  inbox.push(message);
  wake?.();
});
socket.addEventListener('close', (event) => log(`socket closed (${event.code})`));

function describe(message: Message): void {
  if (message.type === 'snapshot') log(`← snapshot: ${(message['entries'] as unknown[]).length} entries`);
  else if (message.type === 'draft') {
    const graph = message['graph'] as { nodes: { id: string; label: string; state: string }[] };
    log(`← draft changed=${show(message['changed'])} workflowId=${String(message['workflowId'])} issues=${show(message['issues'])}`);
    log(`    ${graph.nodes.map((node) => `${node.id}[${node.state}] ${node.label}`).join(' → ')}`);
  } else if (message.type === 'run') {
    log(`← run ${String(message['runId'])} ${String(message['status'])} active=${String(message['activeNode'])} done=${show(message['done'])} failed=${String(message['failed'])}`);
  } else if (message.type === 'error') log(`← error: ${String(message['message'])}`);
  else if (message.type === 'entries') {
    for (const entry of message['entries'] as { kind: string; text?: string; name?: string; type?: string; isError?: boolean; toolCalls?: { name: string; args: unknown }[] }[]) {
      if (entry.kind === 'assistant') {
        for (const call of entry.toolCalls ?? []) log(`← tool call ${call.name} ${show(call.args)}`);
        if (entry.text) log(`← assistant: ${entry.text}`);
      } else if (entry.kind === 'tool_result') log(`← tool result ${entry.name}${entry.isError ? ' (error)' : ''}`);
      else if (entry.kind === 'event') log(`← event ${entry.type} ${show((entry as { data?: unknown }).data)}`);
      else if (entry.kind === 'user') log(`← user: ${entry.text}`);
    }
  }
  // `live` messages (streamed text, tool status) are not printed.
}

/** Waits for the first message from now on that matches, and returns it. */
async function waitFor(what: string, match: (message: Message) => boolean, timeoutMs = 240_000): Promise<Message> {
  const deadline = Date.now() + timeoutMs;
  let seen = inbox.length;
  for (;;) {
    for (; seen < inbox.length; seen++) if (match(inbox[seen]!)) return inbox[seen]!;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
    await new Promise<void>((resolve) => {
      wake = resolve;
      setTimeout(resolve, 1000);
    });
  }
}

const send = (message: object) => {
  log(`→ ${show(message)}`);
  socket.send(JSON.stringify(message));
};
const isIdle = (message: Message) => message.type === 'live' && (message['live'] as { running: boolean }).running === false;
const runEnded = (message: Message) => message.type === 'run' && (message['status'] === 'done' || message['status'] === 'failed');

async function summary(runId: string): Promise<string> {
  const response = await fetch(`${base}/api/runs/${runId}`);
  const body = (await response.json()) as { run?: { status: string; summary: string | null } };
  return `${body.run?.status}: ${body.run?.summary ?? '(no summary)'}`;
}

await new Promise<void>((resolve, reject) => {
  socket.addEventListener('open', () => resolve());
  socket.addEventListener('error', () => reject(new Error(`Could not connect to ${base}. Is wrangler dev running?`)));
});
log(`connected, draft ${draftId}`);
await waitFor('the draft on connect', (message) => message.type === 'draft');

// 1. The conversation: the agent builds the chain, one node per tool call.
const running = waitFor('the agent to start', (message) => message.type === 'live' && (message['live'] as { running: boolean }).running);
send({ type: 'ask', id: `${draftId}-q1`, text: `Email me every morning if Lisbon's pace falls more than 10% behind last year. My address is ${email}` });
await running;
await waitFor('the agent to finish', isIdle);
if ((lastDraft?.['issues'] as string[] | undefined)?.length !== 0) throw new Error(`The draft is not complete: ${show(lastDraft?.['issues'])}`);

// 2. Edits by hand: one that is refused, one that changes a node and back.
send({ type: 'edit', patch: { hotels: [] } });
await waitFor('the refused edit', (message) => message.type === 'error');
const trigger = (lastDraft?.['draft'] as { trigger: unknown }).trigger;
send({ type: 'edit', patch: { trigger: { kind: 'schedule', every: 'week' } } });
await waitFor('the edited draft', (message) => message.type === 'draft');
send({ type: 'edit', patch: { trigger } });
await waitFor('the draft edited back', (message) => message.type === 'draft');

// 3. Save.
send({ type: 'save' });
await waitFor('the saved draft', (message) => message.type === 'draft' && typeof message['workflowId'] === 'string');

// 4. Test runs. During the first one a second test is refused and the socket stays open.
for (let n = 1; n <= tests; n++) {
  log(`--- test run ${n} of ${tests}`);
  const started = waitFor('the run to start', (message) => message.type === 'run' || message.type === 'error');
  send({ type: 'test' });
  const first = await started;
  if (first.type === 'error') {
    log('the run did not start; waiting a minute for the rate limit');
    await new Promise((resolve) => setTimeout(resolve, 61_000));
    n--;
    continue;
  }
  if (n === 1) {
    const refused = waitFor('the second test to be refused', (message) => message.type === 'error');
    send({ type: 'test' });
    await refused;
    log(`socket still open: ${socket.readyState === WebSocket.OPEN}`);
  }
  const end = runEnded(first) ? first : await waitFor('the run to end', runEnded);
  log(`run ${String(end['runId'])} → ${await summary(String(end['runId']))}`);
}

socket.close();
