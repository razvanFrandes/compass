import { specToGraph, type WorkflowDraft } from '@compass/contracts';
import type { EntryDraft } from '@earendil-works/pi-durable';
import { chain } from './builder-tools.ts';

/**
 * What the builder does with a person's own actions on the canvas: an edit that arrives over the socket, the note
 * that tells the agent about it, and how a changed draft is saved. Pure.
 */

/**
 * A patch as the client sent it. JSON has no `undefined`, so `null` is how a client removes a field
 * (`"delivery": null`); `applyDraftPatch` takes `undefined` for that. Null when it is not an object.
 */
export function clientPatch(raw: unknown): WorkflowDraft | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, value ?? undefined])) as WorkflowDraft;
}

/**
 * The transcript entry for a manual edit. The chat shows it as an `app.edit` event; the agent reads its message on
 * its next turn, and no run starts for it. The message holds the chain's labels, so the address stays masked.
 */
export function editEntry(draft: WorkflowDraft, changed: readonly string[], at: number): EntryDraft {
  const reads = chain(specToGraph(draft));
  return {
    kind: 'app.edit',
    data: { changed: [...changed], chain: reads },
    model: [
      {
        role: 'user',
        content: `(I edited the workflow on the canvas${changed.length ? `: ${changed.join(', ')}` : ''}. Chain now: ${reads})`,
        timestamp: at,
      },
    ],
  };
}

export type SavePlan =
  /** Nothing saved yet. */
  | { kind: 'create' }
  /** The draft is as saved. */
  | { kind: 'none' }
  /** Same recipient: change the saved workflow. The patch carries no `delivery`. */
  | { kind: 'update'; patch: WorkflowDraft }
  /** Another recipient (or one added or removed): a saved workflow keeps its recipient, so this is a new workflow. */
  | { kind: 'replace' };

const recipient = (draft: WorkflowDraft) => draft.delivery?.to.trim().toLowerCase() ?? null;

/** How to save `draft`, given the draft as it was last saved and the workflow it was saved as. */
export function savePlan(draft: WorkflowDraft, saved: WorkflowDraft | null, workflowId: string | null): SavePlan {
  if (!saved || !workflowId) return { kind: 'create' };
  if (recipient(draft) !== recipient(saved)) return { kind: 'replace' };
  if (JSON.stringify(draft) === JSON.stringify(saved)) return { kind: 'none' };
  const { delivery: _fixed, ...patch } = draft;
  return { kind: 'update', patch };
}
