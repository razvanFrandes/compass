import { maskEmail, specToGraph, WorkflowSpecShape, type WorkflowDraft } from '@compass/contracts';
import type { z } from 'zod';
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
 * The transcript entry for the manual edits made since the agent was last told: one entry however many edits, written
 * just before the person's next question. The chat shows it as an `app.edit` event and the agent reads its message;
 * no run starts for it. The message holds the chain's labels, so the address stays masked.
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

/**
 * A patch from a client that edits a workflow opened from the list. The client only ever saw that workflow's address
 * masked, so a patch that sends the masked address back means "the same address": it becomes the saved one again.
 * Any other address is the person's new one.
 */
export function unmaskPatch(patch: WorkflowDraft, loadedRecipient: string | null): WorkflowDraft {
  const to = patch.delivery?.to;
  if (!to || !loadedRecipient || to.trim().toLowerCase() !== maskEmail(loadedRecipient).toLowerCase()) return patch;
  return { ...patch, delivery: { ...patch.delivery!, to: loadedRecipient } };
}

/**
 * The transcript entry for a saved workflow opened in the builder, so the agent knows what is on the canvas before
 * the person's first message. It holds the chain's labels, so the address stays masked. No run starts for it.
 */
export function loadedEntry(draft: WorkflowDraft, at: number): EntryDraft {
  const reads = chain(specToGraph(draft));
  return {
    kind: 'app.loaded',
    data: { name: draft.name ?? '', chain: reads },
    model: [{ role: 'user', content: `(I opened the saved workflow "${draft.name ?? ''}" to edit it. Chain now: ${reads})`, timestamp: at }],
  };
}

/** The nodes changed by the edits made since the agent was last told, each once, in the order they first changed. */
export function mergeChanged(earlier: readonly string[] | undefined, changed: readonly string[]): string[] {
  return [...new Set([...(earlier ?? []), ...changed])];
}

export const EDITS_PER_MINUTE = 30;
const MINUTE_MS = 60_000;

/**
 * At most 30 edits per client in a rolling minute, counted in memory in the builder's object. Edits spend no model
 * tokens, but each one writes the draft, and nobody on the socket has logged in.
 */
export class EditLimiter {
  readonly #times = new Map<string, number[]>();

  /** Whether `client` may edit at `now`; an allowed edit is counted, a refused one is not. */
  allow(client: string, now: number): boolean {
    for (const [key, times] of this.#times) {
      const recent = times.filter((at) => at > now - MINUTE_MS);
      if (recent.length) this.#times.set(key, recent);
      else this.#times.delete(key);
    }
    const recent = this.#times.get(client) ?? [];
    if (recent.length >= EDITS_PER_MINUTE) return false;
    this.#times.set(client, [...recent, now]);
    return true;
  }

  /** Clients with an edit in the last minute, as of the last call. */
  get clients(): number {
    return this.#times.size;
  }
}

export type SavePlan =
  /** Nothing saved yet. */
  | { kind: 'create' }
  /** The draft is as saved. */
  | { kind: 'none' }
  /**
   * Same recipient: change the saved workflow. The patch carries no `delivery`. A field that was saved and is no
   * longer in the draft is in the patch with its default, so the stored workflow loses it too.
   */
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
  return { kind: 'update', patch: { ...patch, ...removedFields(draft, saved) } };
}

const fields: Record<string, z.ZodType> = WorkflowSpecShape.shape;

/**
 * The fields `saved` had and `draft` no longer has, each with the value the spec gives a missing field ('' for the
 * description, no checks, …). An update merges the patch over the stored workflow, so a field left out of the patch
 * would keep its old value there, and the workflow would differ from the draft it was saved from.
 */
function removedFields(draft: WorkflowDraft, saved: WorkflowDraft): WorkflowDraft {
  const present = (source: WorkflowDraft, key: string) => (source as Record<string, unknown>)[key] !== undefined;
  const reset: Record<string, unknown> = {};
  for (const key of Object.keys(saved)) {
    if (key === 'delivery' || !present(saved, key) || present(draft, key)) continue;
    const parsed = fields[key]?.safeParse(undefined);
    // A required field has no default: it cannot be missing from a draft that is being saved.
    if (parsed?.success) reset[key] = parsed.data;
  }
  return reset as WorkflowDraft;
}
