import type { ChatEntry, WorkflowGraph, WorkflowRun } from '@compass/contracts';

/**
 * Where a run is on its workflow's graph, read from its log. Pure, so the builder can recompute it on every poll.
 *
 * The trigger and the scope are done once a run exists. A call to a tool that is a check of the workflow is on that
 * check's node until its result comes back. The email tool is the action, done only when a mail went out. Everything
 * else the agent does (other tools, thinking, writing) is `analyze`.
 */
export interface RunProgress {
  activeNode: string | null;
  /** Finished nodes, in chain order. */
  done: string[];
  failed: string | null;
}

const EMAIL_TOOL = 'send_email';

export function runProgress(entries: readonly ChatEntry[], graph: WorkflowGraph, status: WorkflowRun['status']): RunProgress {
  const order = graph.nodes.map((node) => node.id);
  const nodeFor = (tool: string) => (tool === EMAIL_TOOL ? 'action' : order.includes(`check:${tool}`) ? `check:${tool}` : 'analyze');

  const done = new Set(['trigger', 'scope']);
  /** Calls without a result yet, by call id. */
  const pending = new Map<string, string>();

  for (const entry of entries) {
    if (entry.kind === 'assistant') {
      for (const call of entry.toolCalls) pending.set(call.callId, nodeFor(call.name));
    } else if (entry.kind === 'tool_result') {
      const node = pending.get(entry.callId) ?? nodeFor(entry.name);
      pending.delete(entry.callId);
      // A send_email result without an error can still say that no mail went out (a limit, nothing to report).
      if (entry.isError || node === 'analyze' || (node === 'action' && entry.sent === false)) continue;
      done.add(node);
      // The mail is out: the analysis that led to it is finished too.
      if (node === 'action') done.add('analyze');
    }
  }

  // The first node in the chain with a call running; with none, the agent is thinking, until the action is done.
  const waiting = new Set(pending.values());
  const running = order.find((id) => id !== 'analyze' && waiting.has(id)) ?? (done.has('action') ? null : 'analyze');

  const ended = status === 'done' || status === 'failed';
  if (status === 'done') done.add('analyze');
  const activeNode = ended ? null : running;
  return {
    activeNode,
    done: order.filter((id) => done.has(id) && id !== activeNode && !(status === 'failed' && id === running)),
    failed: status === 'failed' ? running : null,
  };
}

/**
 * Whether the builder stops following a run: it ended, or it is parked until a person decides on its proposal. A
 * parked run can wait for days, so it is not followed (and not reported as failed after 3 minutes).
 */
export function followEnds(status: WorkflowRun['status']): boolean {
  return status === 'done' || status === 'failed' || status === 'waiting_approval';
}
