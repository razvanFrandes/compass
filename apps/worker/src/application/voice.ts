import type { VoiceToken } from '@compass/contracts';
import { err, ok, type Result } from '../domain/result.ts';

/**
 * Voice input: the browser streams the microphone straight to the speech-to-text provider, with a temporary key the
 * server mints for one dictation. The permanent key never leaves the server.
 */

export const VOICE_UNAVAILABLE = 'Voice input is not available right now. Type your question instead.';

export type VoiceError =
  /** The Worker has no provider key (the SONIOX_API_KEY secret is not set). */
  | { kind: 'not_configured' }
  /** The provider refused or could not be reached. `status` is its HTTP status; `cause` names the error class. Neither holds a key. */
  | { kind: 'provider'; status: number | null; cause?: string };

/** A temporary key as the provider issued it. */
export interface TemporaryKey {
  apiKey: string;
  expiresAt: string;
}

/** Where to connect with a temporary key, and how to mint one from the permanent key. */
export interface VoiceKeyMinter {
  readonly model: string;
  readonly wsUrl: string;
  mint(permanentKey: string): Promise<Result<TemporaryKey, Extract<VoiceError, { kind: 'provider' }>>>;
}

export async function issueVoiceToken(deps: { apiKey: string | undefined; mint: VoiceKeyMinter }): Promise<Result<VoiceToken, VoiceError>> {
  const permanent = deps.apiKey?.trim();
  if (!permanent) return err({ kind: 'not_configured' });
  const minted = await deps.mint.mint(permanent);
  if (!minted.ok) return minted;
  return ok({ apiKey: minted.value.apiKey, expiresAt: minted.value.expiresAt, model: deps.mint.model, wsUrl: deps.mint.wsUrl });
}
