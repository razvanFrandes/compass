/** An error whose message is written for the client. Every other error is logged and answered generically. */
export class PublicError extends Error {
  override name = 'PublicError';
}

export const GENERIC_ERROR = 'Something went wrong on our side. Try again in a moment.';

export function publicMessage(error: unknown): string {
  return error instanceof PublicError ? error.message : GENERIC_ERROR;
}

/** A 500 that tells the client nothing about the internals; the details go to the Worker logs. */
export function internalError(error: unknown): Response {
  console.error('unhandled error', error);
  return Response.json({ error: GENERIC_ERROR }, { status: 500 });
}
