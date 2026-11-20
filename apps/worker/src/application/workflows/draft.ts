import { changedNodes, specToGraph, WorkflowSpec, WorkflowSpecShape, type WorkflowDraft } from '@compass/contracts';
import type { z } from 'zod';

/**
 * Edits to a workflow being built. A patch replaces whole fields; every field in it is checked against the spec
 * before anything changes, so a draft only ever holds values that could be saved, and is only missing parts.
 */

const fields: Record<string, z.ZodType> = WorkflowSpecShape.shape;

const issuesOf = (error: z.ZodError, prefix: string[] = []) =>
  error.issues.map((issue) => `${[...prefix, ...issue.path].join('.') || 'workflow'}: ${issue.message}`);

/**
 * Applies `patch` to `draft` and names the graph nodes that now read differently. A field set to `undefined` is
 * removed (or takes its default). On an error nothing is applied and `draft` is untouched.
 */
export function applyDraftPatch(
  draft: WorkflowDraft,
  patch: WorkflowDraft,
  allowedChecks: readonly string[],
): { draft: WorkflowDraft; changed: string[] } | { error: string } {
  const next: Record<string, unknown> = { ...draft };
  const errors: string[] = [];
  for (const [key, value] of Object.entries(patch)) {
    const field = Object.hasOwn(fields, key) ? fields[key] : undefined;
    if (!field) {
      errors.push(`${key}: a workflow has no such field.`);
      continue;
    }
    const parsed = field.safeParse(value);
    if (!parsed.success) {
      errors.push(...issuesOf(parsed.error, [key]));
      continue;
    }
    if (parsed.data === undefined) delete next[key];
    else next[key] = parsed.data;
  }

  if (Array.isArray(patch.checks)) {
    const unknown = patch.checks.filter((tool) => !allowedChecks.includes(tool));
    if (unknown.length) errors.push(`checks: ${unknown.map((tool) => `"${tool}"`).join(', ')} cannot be a check. Use one of: ${allowedChecks.join(', ')}.`);
    else if (!errors.length) next.checks = [...new Set(next.checks as string[])];
  }
  if (errors.length) return { error: errors.join(' ') };

  const after = next as WorkflowDraft;
  return { draft: after, changed: changedNodes(specToGraph(draft), specToGraph(after)) };
}

/** Why the draft cannot be saved yet, as `path: message`. Empty when it can. */
export function draftIssues(draft: WorkflowDraft): string[] {
  const parsed = WorkflowSpec.safeParse(draft);
  return parsed.success ? [] : issuesOf(parsed.error);
}
