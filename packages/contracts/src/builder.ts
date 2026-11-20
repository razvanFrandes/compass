import type { ChatClientMessage, ChatServerMessage } from './chat.ts';
import type { WorkflowGraph } from './workflow-graph.ts';
import type { WorkflowDraft, WorkflowRun } from './workflows.ts';

/**
 * The workflow builder's socket: the chat messages Kassandra uses (so the chat UI is reused), plus the draft
 * being built and the progress of a test run, both in terms of graph node ids.
 */

export type BuilderServerMessage =
  | ChatServerMessage
  /** Sent after every change. `changed` are the node ids to highlight; `issues` say why it cannot be saved yet. */
  | { type: 'draft'; draft: WorkflowDraft; graph: WorkflowGraph; changed: string[]; workflowId: string | null; issues: string[] }
  /** A test run, mapped to the graph: the node it is on, the nodes it finished, and the one that failed. */
  | { type: 'run'; runId: string; status: WorkflowRun['status']; activeNode: string | null; done: string[]; failed: string | null };

export type BuilderClientMessage =
  | ChatClientMessage
  /** A manual edit on the canvas. */
  | { type: 'edit'; patch: WorkflowDraft }
  /** Save the draft as a workflow, once it is valid. */
  | { type: 'save' }
  /** Save if needed, then run it once as a test. */
  | { type: 'test' };
