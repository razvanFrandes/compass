import type { ThreadMeta, ThreadMetaList } from '@compass/contracts';
import type { Result } from '../../domain/result.ts';
import { readJson } from './body.ts';

/**
 * The conversations API: the sidebar's titles and takeaways, a rename, a delete. The caller has already refused
 * cross-site writes. Each request meets the per-client rate limit first; a write then meets the body limit and the
 * shape of the body before any Kassandra object is touched. Writing a missing title spends a Quick model call, which
 * the object takes from the daily budget (`thread_title`).
 */

/** What the routes need of the Kassandra objects, one per conversation id. */
export interface ConversationsApi {
  /** The conversation's meta, written now if its first answer is in and it has none yet; null when there is none. */
  meta(id: string): Promise<ThreadMeta | null>;
  rename(id: string, title: string): Promise<Result<ThreadMeta, string>>;
  /** Deletes the transcript and the meta. */
  forget(id: string): Promise<void>;
}

export interface ConversationRouteDeps {
  threads: ConversationsApi;
  /** The per-client rate limit: null when the request may go on, else the 429 to send. */
  rateLimited(): Promise<Response | null>;
}

const BASE = '/api/kassandra/conversations';
/** The sidebar keeps 30 conversations at most. */
export const MAX_IDS = 30;

export const isConversationsPath = (pathname: string): boolean => pathname === BASE || pathname.startsWith(`${BASE}/`);

const error = (status: number, message: string) => Response.json({ error: message }, { status });
const notFound = () => error(404, 'Not found');
const isId = (id: string | undefined): id is string => id !== undefined && /^[\w-]{1,64}$/.test(id);

export async function conversationRoutes(request: Request, url: URL, deps: ConversationRouteDeps): Promise<Response> {
  const [, , , id, ...rest] = url.pathname.split('/').filter(Boolean); // ['api', 'kassandra', 'conversations', id?]
  const method = request.method;
  if (rest.length || (id !== undefined && !isId(decodeURIComponent(id)))) return notFound();

  if (id === undefined) {
    if (method !== 'GET') return notFound();
    const limited = await deps.rateLimited();
    if (limited) return limited;
    const ids = [...new Set((url.searchParams.get('ids') ?? '').split(',').filter(Boolean))];
    if (!ids.length || ids.length > MAX_IDS || !ids.every(isId)) return error(400, `Pass ?ids=<id>,<id> (1–${MAX_IDS} ids: letters, digits, - or _).`);
    const metas = await Promise.all(ids.map(async (one) => [one, await deps.threads.meta(one)] as const));
    const list: ThreadMetaList = {};
    for (const [one, meta] of metas) if (meta) list[one] = meta;
    return Response.json(list, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (method === 'PATCH') {
    const limited = await deps.rateLimited();
    if (limited) return limited;
    const body = await readJson(request);
    if (!body.ok) return error(body.error.status, body.error.error);
    const title = (body.value as { title?: unknown } | null)?.title;
    if (typeof title !== 'string') return error(400, 'Send { title }.');
    const renamed = await deps.threads.rename(id, title);
    return renamed.ok ? Response.json(renamed.value) : error(400, renamed.error);
  }

  if (method === 'DELETE') {
    const limited = await deps.rateLimited();
    if (limited) return limited;
    await deps.threads.forget(id);
    return new Response(null, { status: 204 });
  }

  return notFound();
}
