import { err, ok, type Result } from '../../domain/result.ts';

export const MAX_JSON_BYTES = 16 * 1024; // the largest body we take, a WorkflowSpec, is under 4 KB
export const MAX_MCP_BYTES = 64 * 1024;

export interface BodyError {
  status: 400 | 413;
  error: string;
}

const tooLarge = (max: number): BodyError => ({ status: 413, error: `The request body is larger than ${Math.round(max / 1024)} KB.` });

/** Reads the body, refusing it as soon as it passes `max` bytes (by header, then while streaming). */
async function readCapped(request: Request, max: number): Promise<Result<Uint8Array, BodyError>> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > max) return err(tooLarge(max));
  if (!request.body) return ok(new Uint8Array());
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return err(tooLarge(max));
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) (bytes.set(chunk, offset), (offset += chunk.byteLength));
  return ok(bytes);
}

/** A JSON body of at most `max` bytes. An empty body is `{}`. */
export async function readJson(request: Request, max = MAX_JSON_BYTES): Promise<Result<unknown, BodyError>> {
  const bytes = await readCapped(request, max);
  if (!bytes.ok) return bytes;
  const text = new TextDecoder().decode(bytes.value).trim();
  if (!text) return ok({});
  try {
    return ok(JSON.parse(text));
  } catch {
    return err({ status: 400, error: 'The request body is not valid JSON.' });
  }
}

/** The same request with its body buffered, or a refusal when the body passes `max` bytes. */
export async function withBodyLimit(request: Request, max: number): Promise<Result<Request, BodyError>> {
  if (!request.body) return ok(request);
  const bytes = await readCapped(request, max);
  if (!bytes.ok) return bytes;
  return ok(new Request(request, { body: bytes.value }));
}
