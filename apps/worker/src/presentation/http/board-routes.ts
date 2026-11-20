import { BoardCreate, BoardPatch, BoardWidgetCreate, type Board, type BoardSummary, type BoardWidget } from '@compass/contracts';
import type { z } from 'zod';
import type { BoardError } from '../../application/boards/boards.ts';
import type { Result } from '../../domain/result.ts';
import { MAX_JSON_BYTES, readJson } from './body.ts';

/**
 * The boards API (docs/round2-contracts.md §4, docs/api.md "Boards"). The caller has already refused cross-site
 * writes. A write then meets, in this order: the per-client rate limit, the body limit and the shape of the body, the
 * daily budget, and only then the Boards object. So a body that would be refused anyway never spends the budget.
 */

/** A widget carries up to 200 rows, so its body may be larger than the 16 KB of the other writes. */
export const MAX_WIDGET_BYTES = 256 * 1024;

/** What the routes need of the Boards object; the application service has the same shape, so tests use it directly. */
export interface BoardsApi {
  list(): Promise<BoardSummary[]>;
  get(id: string): Promise<Result<Board, BoardError>>;
  create(input: unknown): Promise<Result<Board, BoardError>>;
  update(id: string, input: unknown): Promise<Result<Board, BoardError>>;
  remove(id: string): Promise<Result<null, BoardError>>;
  addWidget(id: string, input: unknown): Promise<Result<BoardWidget, BoardError>>;
  removeWidget(id: string, widgetId: string): Promise<Result<null, BoardError>>;
}

export interface BoardRouteDeps {
  boards: BoardsApi;
  /** The per-client rate limit: null when the request may go on, else the 429 to send. */
  rateLimited(): Promise<Response | null>;
  /** The daily budget of board changes: null when the request may go on, else the 429 to send. */
  overBudget(): Promise<Response | null>;
}

export const isBoardsPath = (pathname: string): boolean => pathname === '/api/boards' || pathname.startsWith('/api/boards/');

const STATUS: Record<BoardError['kind'], number> = { not_found: 404, invalid: 400, limit: 409 };
const error = (status: number, message: string) => Response.json({ error: message }, { status });
const notFound = () => error(404, 'Not found');
const isId = (id: string | undefined): id is string => id !== undefined && /^[\w-]{1,64}$/.test(id);

function answer<T>(result: Result<T, BoardError>, status = 200): Response {
  if (!result.ok) return error(STATUS[result.error.kind], result.error.message);
  return result.value === null ? new Response(null, { status: 204 }) : Response.json(result.value, { status });
}

export async function boardRoutes(request: Request, url: URL, deps: BoardRouteDeps): Promise<Response> {
  const { boards } = deps;
  const [, , id, sub, widgetId, ...rest] = url.pathname.split('/').filter(Boolean); // ['api', 'boards', id?, 'widgets'?, widgetId?]
  const method = request.method;
  if (rest.length || (id !== undefined && !isId(id)) || (widgetId !== undefined && !isId(widgetId))) return notFound();

  /** A write with a body: rate limit, body limit, shape, budget, then the change. */
  const write = async (schema: z.ZodType, maxBytes: number, change: (input: unknown) => Promise<Response>): Promise<Response> => {
    const limited = await deps.rateLimited();
    if (limited) return limited;
    const body = await readJson(request, maxBytes);
    if (!body.ok) return error(body.error.status, body.error.error);
    const shaped = schema.safeParse(body.value);
    if (!shaped.success) {
      const issues = shaped.error.issues.slice(0, 3).map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`);
      return error(400, issues.join('; ').slice(0, 300));
    }
    // The object validates the body again (and fits the widget to its rows): it trusts no caller.
    return (await deps.overBudget()) ?? change(body.value);
  };
  /** A write without a body. */
  const remove = async (change: () => Promise<Response>): Promise<Response> => (await deps.rateLimited()) ?? (await deps.overBudget()) ?? change();

  if (id === undefined) {
    if (method === 'GET') return Response.json(await boards.list());
    if (method === 'POST') return write(BoardCreate, MAX_JSON_BYTES, async (input) => answer(await boards.create(input), 201));
    return notFound();
  }
  if (sub === undefined) {
    if (method === 'GET') return answer(await boards.get(id));
    if (method === 'PATCH') return write(BoardPatch, MAX_JSON_BYTES, async (input) => answer(await boards.update(id, input)));
    if (method === 'DELETE') return remove(async () => answer(await boards.remove(id)));
    return notFound();
  }
  if (sub !== 'widgets') return notFound();
  if (widgetId === undefined) {
    if (method === 'POST') return write(BoardWidgetCreate, MAX_WIDGET_BYTES, async (input) => answer(await boards.addWidget(id, input), 201));
    return notFound();
  }
  if (method === 'DELETE') return remove(async () => answer(await boards.removeWidget(id, widgetId)));
  return notFound();
}
