import type { Workflow } from '@compass/contracts';

/**
 * How many workflows the public demo holds. Pure.
 *
 * Enabled workflows run every morning from the cron, so their number bounds the daily spend: at most 30 are on at a
 * time. A workflow that is off costs nothing, so it does not count: the builder saves a new workflow whenever the
 * recipient changes and turns the old one off, and those must never stop the next save. Storage is bounded apart
 * from that: at 100 stored workflows, a new one takes the place of the oldest that is off.
 */
export const MAX_WORKFLOWS = 30;
export const MAX_STORED_WORKFLOWS = 100;

const FULL = `The demo runs at most ${MAX_WORKFLOWS} active workflows. Turn one off and try again.`;

const active = (stored: readonly Workflow[]) => stored.filter((workflow) => workflow.enabled).length;

/** A workflow that may be dropped to make room: off, made by a person or by Kassandra (never a template), with no run in progress. */
const droppable = (workflow: Workflow) =>
  !workflow.enabled &&
  workflow.createdBy !== 'template' &&
  workflow.lastRun?.status !== 'running' &&
  workflow.lastRun?.status !== 'waiting_approval';

/**
 * Whether one more workflow may be created next to `stored`, and which stored ones to delete first (`evict`, oldest
 * first; empty below 100).
 */
export function admitWorkflow(stored: readonly Workflow[], enabled: boolean): { ok: true; evict: string[] } | { ok: false; error: string } {
  if (enabled && active(stored) >= MAX_WORKFLOWS) return { ok: false, error: FULL };
  const excess = stored.length + 1 - MAX_STORED_WORKFLOWS;
  if (excess <= 0) return { ok: true, evict: [] };
  const oldest = stored.filter(droppable).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return { ok: true, evict: oldest.slice(0, excess).map((workflow) => workflow.id) };
}

/** Whether the stored workflow `id` may be turned on. One that is already on may stay on. */
export function mayEnable(stored: readonly Workflow[], id: string): { ok: true } | { ok: false; error: string } {
  const others = stored.filter((workflow) => workflow.id !== id);
  if (stored.some((workflow) => workflow.id === id && workflow.enabled) || active(others) < MAX_WORKFLOWS) return { ok: true };
  return { ok: false, error: FULL };
}
