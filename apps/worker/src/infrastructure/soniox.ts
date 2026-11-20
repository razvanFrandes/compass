import type { TemporaryKey, VoiceKeyMinter } from '../application/voice.ts';
import { err, ok } from '../domain/result.ts';

/**
 * Soniox real-time speech-to-text (docs.soniox.com, read on 2026-11-20).
 *
 * Temporary keys: POST /v1/auth/temporary-api-key with the project key as a Bearer token answers 201 with
 * `{ api_key, expires_at }`. The browser opens the WebSocket with the temporary key in the subprotocol list
 * (`new WebSocket(SONIOX_WS_URL, ['soniox-api-key', apiKey])`), sends one JSON text message that names the model,
 * then the audio as binary frames, and an empty text frame to end.
 */
export const SONIOX_TEMPORARY_KEY_URL = 'https://api.soniox.com/v1/auth/temporary-api-key';
export const SONIOX_WS_URL = 'wss://stt-rt.soniox.com/transcribe-websocket';
/** The current real-time model. It transcribes English and Romanian among its languages; `stt-rt-v5` is removed on 15 Dec 2026. */
export const SONIOX_MODEL = 'stt-rt-v6';

/** How long a key may wait before it opens its connection: enough for the microphone prompt. */
const EXPIRES_IN_SECONDS = 120;
/** The longest dictation one key allows. A question is a few sentences. */
const MAX_SESSION_SECONDS = 180;
const TIMEOUT_MS = 8_000;

/**
 * The permanent key goes into the Authorization header and nowhere else. A refusal reports the HTTP status and never
 * the response body, and a network error reports only its class: neither can then carry the key into a log.
 */
export function sonioxMinter(fetcher: typeof fetch = (input, init) => fetch(input, init)): VoiceKeyMinter {
  return {
    model: SONIOX_MODEL,
    wsUrl: SONIOX_WS_URL,
    async mint(permanentKey) {
      let response: Response;
      try {
        response = await fetcher(SONIOX_TEMPORARY_KEY_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${permanentKey}`, 'Content-Type': 'application/json' },
          // One connection per key, so a key that leaks from a page cannot be used again.
          body: JSON.stringify({
            usage_type: 'transcribe_websocket',
            expires_in_seconds: EXPIRES_IN_SECONDS,
            single_use: true,
            max_session_duration_seconds: MAX_SESSION_SECONDS,
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        return err({ kind: 'provider', status: null, cause: error instanceof Error ? error.name : 'unknown' });
      }
      if (!response.ok) return err({ kind: 'provider', status: response.status });
      const key = temporaryKey(await response.json().catch(() => null));
      if (!key || key.apiKey === permanentKey) return err({ kind: 'provider', status: response.status });
      return ok(key);
    },
  };
}

function temporaryKey(body: unknown): TemporaryKey | null {
  if (!body || typeof body !== 'object') return null;
  const { api_key: apiKey, expires_at: expiresAt } = body as { api_key?: unknown; expires_at?: unknown };
  if (typeof apiKey !== 'string' || !apiKey || typeof expiresAt !== 'string' || Number.isNaN(Date.parse(expiresAt))) return null;
  return { apiKey, expiresAt };
}
