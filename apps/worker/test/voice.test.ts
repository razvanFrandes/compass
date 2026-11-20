import { afterEach, describe, expect, it, vi } from 'vitest';
import { issueVoiceToken, VOICE_UNAVAILABLE } from '../src/application/voice.ts';
import { SONIOX_MODEL, SONIOX_TEMPORARY_KEY_URL, SONIOX_WS_URL, sonioxMinter } from '../src/infrastructure/soniox.ts';
import { voiceTokenResponse } from '../src/presentation/http/voice.ts';

// POST /api/voice/token hands the browser a temporary Soniox key for one dictation. The permanent key stays in the
// Worker: it is sent to Soniox only, and is never returned or logged.

const PERMANENT = 'permanent-key-0123456789';
const created = (body: unknown, status = 201) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
type Fetch = typeof fetch;

afterEach(() => vi.restoreAllMocks());

describe('issueVoiceToken with the Soniox minter', () => {
  it('asks Soniox for a single-use key that expires soon, and returns it with the model and the socket URL', async () => {
    const fetchMock = vi.fn<Fetch>(async () => created({ api_key: 'snx_temp_abc', expires_at: '2026-11-21T10:02:00.000Z' }));
    const result = await issueVoiceToken({ apiKey: PERMANENT, mint: sonioxMinter(fetchMock) });

    expect(result).toEqual({
      ok: true,
      value: { apiKey: 'snx_temp_abc', expiresAt: '2026-11-21T10:02:00.000Z', model: 'stt-rt-v6', wsUrl: 'wss://stt-rt.soniox.com/transcribe-websocket' },
    });
    expect(SONIOX_MODEL).toBe('stt-rt-v6');
    expect(SONIOX_WS_URL).toBe('wss://stt-rt.soniox.com/transcribe-websocket');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.soniox.com/v1/auth/temporary-api-key');
    expect(url).toBe(SONIOX_TEMPORARY_KEY_URL);
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe(`Bearer ${PERMANENT}`);
    expect(headers.get('content-type')).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual({
      usage_type: 'transcribe_websocket',
      expires_in_seconds: 120,
      single_use: true,
      max_session_duration_seconds: 180,
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('says voice is not set up when the Worker has no key, without calling Soniox', async () => {
    const fetchMock = vi.fn<Fetch>();
    for (const apiKey of [undefined, '', '   ']) {
      expect(await issueVoiceToken({ apiKey, mint: sonioxMinter(fetchMock) })).toEqual({ ok: false, error: { kind: 'not_configured' } });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([400, 401, 429, 500])('reports a refusal from Soniox (%i) as a value, with the status only', async (status) => {
    const body = { error_message: `key ${PERMANENT} is not valid`, request_id: 'r-1' };
    const result = await issueVoiceToken({ apiKey: PERMANENT, mint: sonioxMinter(async () => created(body, status)) });
    expect(result).toEqual({ ok: false, error: { kind: 'provider', status } });
    expect(JSON.stringify(result)).not.toContain(PERMANENT);
  });

  it('reports a network failure as a value: the cause is for the logs and carries no key', async () => {
    const result = await issueVoiceToken({
      apiKey: PERMANENT,
      mint: sonioxMinter(async () => {
        throw new TypeError(`fetch failed for Bearer ${PERMANENT}`);
      }),
    });
    expect(result).toEqual({ ok: false, error: { kind: 'provider', status: null, cause: 'TypeError' } });
  });

  it.each([
    ['no key', { expires_at: '2026-11-21T10:02:00.000Z' }],
    ['no expiry', { api_key: 'snx_temp_abc' }],
    ['an expiry that is not a date', { api_key: 'snx_temp_abc', expires_at: 'soon' }],
    ['not an object', 'ok'],
  ])('refuses an answer with %s', async (_name, body) => {
    const result = await issueVoiceToken({ apiKey: PERMANENT, mint: sonioxMinter(async () => created(body)) });
    expect(result).toEqual({ ok: false, error: { kind: 'provider', status: 201 } });
  });

  it('refuses an answer that is not JSON', async () => {
    const result = await issueVoiceToken({ apiKey: PERMANENT, mint: sonioxMinter(async () => new Response('<html>', { status: 201 })) });
    expect(result).toEqual({ ok: false, error: { kind: 'provider', status: 201 } });
  });

  it('never hands out the permanent key, even if Soniox were to echo it', async () => {
    const result = await issueVoiceToken({
      apiKey: PERMANENT,
      mint: sonioxMinter(async () => created({ api_key: PERMANENT, expires_at: '2026-11-21T10:02:00.000Z' })),
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(PERMANENT);
  });
});

describe('voiceTokenResponse', () => {
  it('answers 200 with the token, never cached', async () => {
    const token = { apiKey: 'snx_temp_abc', expiresAt: '2026-11-21T10:02:00.000Z', model: SONIOX_MODEL, wsUrl: SONIOX_WS_URL };
    const response = voiceTokenResponse({ ok: true, value: token });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(token);
  });

  it('answers 503 with one message for every failure, and logs the status without any key', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const error of [{ kind: 'not_configured' as const }, { kind: 'provider' as const, status: 401 }, { kind: 'provider' as const, status: null, cause: 'TypeError' }]) {
      const response = voiceTokenResponse({ ok: false, error });
      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual({ error: VOICE_UNAVAILABLE });
    }
    expect(VOICE_UNAVAILABLE).toBe('Voice input is not available right now. Type your question instead.');
    expect(logged).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(logged.mock.calls)).not.toContain(PERMANENT);
  });
});
