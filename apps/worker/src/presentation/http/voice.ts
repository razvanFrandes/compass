import type { VoiceToken } from '@compass/contracts';
import { VOICE_UNAVAILABLE, type VoiceError } from '../../application/voice.ts';
import type { Result } from '../../domain/result.ts';

/**
 * The answer of POST /api/voice/token. A key is never cached. Every failure reads the same to the client; the
 * log gets the provider's status or the error class, which hold no key.
 */
export function voiceTokenResponse(result: Result<VoiceToken, VoiceError>): Response {
  const headers = { 'Cache-Control': 'no-store' };
  if (result.ok) return Response.json(result.value, { headers });
  const { error } = result;
  console.error('voice token failed', error.kind, error.kind === 'provider' ? (error.status ?? error.cause) : '');
  return Response.json({ error: VOICE_UNAVAILABLE }, { status: 503, headers });
}
