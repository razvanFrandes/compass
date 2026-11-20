import type { VoiceEngine } from './voice/voice-input';

/*
  The composer as a state machine, pure so it can be tested without a microphone: typed text on one side, a voice
  question on the other. The component feeds it events and carries out the effects it returns.

    off ──mic──▶ starting ──microphone open──▶ listening ──silence / Done──▶ sending ──▶ off (question sent)
                     │                              │
                     └────────── Esc / ✕ / nothing heard / unavailable ──────────▶ off (nothing sent)
*/

export type VoicePhase = 'off' | 'starting' | 'listening' | 'sending';

export interface ComposerState {
  /** What is typed in the field. */
  draft: string;
  voice: VoicePhase;
  engine: VoiceEngine | null;
  /** Words the recogniser will not change any more. */
  heard: string;
  /** Its provisional tail, replaced with every update. */
  partial: string;
  /** One line under the field: why voice stopped without a question. */
  notice: string | null;
}

/** What the composer's inputs say at the moment of the event. */
export interface ComposerContext {
  /** Kassandra is answering. */
  busy: boolean;
  /** While busy, text may still be sent (it joins the running answer). */
  steerable: boolean;
  /** False while the connection is down: typing stays possible, sending waits. */
  online: boolean;
  /** A voice question is sent when the person stops speaking; otherwise it lands in the field to be edited. */
  voiceSends: boolean;
}

export type ComposerEvent =
  | { type: 'input'; text: string }
  | { type: 'prefill'; text: string }
  | { type: 'submit' }
  | { type: 'voice.start' }
  | { type: 'voice.listening'; engine: VoiceEngine | null }
  | { type: 'voice.engine'; engine: VoiceEngine }
  | { type: 'voice.transcript'; final: string; partial: string }
  /** The person stopped speaking. */
  | { type: 'voice.endpoint' }
  /** The person pressed Done. */
  | { type: 'voice.done' }
  /** Esc, or the ✕ button. */
  | { type: 'voice.cancel' }
  | { type: 'voice.nothing' }
  | { type: 'voice.unavailable'; message: string }
  /** The short "Sending…" beat is over. */
  | { type: 'voice.settled' };

export type ComposerEffect =
  /** Hand the question to the host. */
  | { type: 'emit'; text: string }
  | { type: 'voice.open' }
  | { type: 'voice.close' }
  /** Come back with `voice.settled` after the "Sending…" beat. */
  | { type: 'settle' }
  | { type: 'focus' };

export interface ComposerStep {
  state: ComposerState;
  effects: ComposerEffect[];
}

export const NOTHING_HEARD = 'I didn’t hear anything. Try again, or type your question.';

export const initialComposer = (): ComposerState => ({ draft: '', voice: 'off', engine: null, heard: '', partial: '', notice: null });

export function canSend(context: ComposerContext): boolean {
  return context.online && (!context.busy || context.steerable);
}

/** Everything heard so far, as one line. */
export function transcript(state: ComposerState): string {
  return `${state.heard}${state.partial}`.replace(/\s+/g, ' ').trim();
}

const off = (state: ComposerState, patch: Partial<ComposerState> = {}): ComposerState => ({ ...state, voice: 'off', engine: null, heard: '', partial: '', ...patch });
const same = (state: ComposerState): ComposerStep => ({ state, effects: [] });

export function step(state: ComposerState, event: ComposerEvent, context: ComposerContext): ComposerStep {
  const listening = state.voice === 'starting' || state.voice === 'listening';

  /** Voice ends with words: send them, or leave them in the field when they cannot or should not be sent. */
  const finish = (): ComposerStep => {
    const text = transcript(state);
    if (!text) return same(state);
    // The demo's sample question is not something the person said: it is never sent for them.
    if (context.voiceSends && state.engine !== 'demo' && canSend(context)) return { state: { ...state, voice: 'sending', heard: text, partial: '' }, effects: [{ type: 'voice.close' }, { type: 'settle' }] };
    const draft = state.draft.trim() ? `${state.draft.trimEnd()} ${text}` : text;
    return { state: off(state, { draft }), effects: [{ type: 'voice.close' }, { type: 'focus' }] };
  };

  switch (event.type) {
    case 'input':
      return same({ ...state, draft: event.text, notice: null });
    case 'prefill':
      return { state: { ...state, draft: event.text, notice: null }, effects: event.text ? [{ type: 'focus' }] : [] };
    case 'submit': {
      const text = state.draft.trim();
      if (!text || state.voice !== 'off' || !canSend(context)) return same(state);
      return { state: { ...state, draft: '', notice: null }, effects: [{ type: 'emit', text }] };
    }
    case 'voice.start':
      if (state.voice !== 'off') return same(state);
      return { state: { ...state, voice: 'starting', engine: null, heard: '', partial: '', notice: null }, effects: [{ type: 'voice.open' }] };
    case 'voice.listening':
      return state.voice === 'starting' ? same({ ...state, voice: 'listening', engine: event.engine }) : same(state);
    case 'voice.engine':
      return listening ? same({ ...state, engine: event.engine }) : same(state);
    case 'voice.transcript':
      return listening ? same({ ...state, heard: event.final, partial: event.partial }) : same(state);
    case 'voice.endpoint':
      // A pause before the first word is not an end: keep listening.
      return state.voice === 'listening' ? finish() : same(state);
    case 'voice.done':
      if (!listening) return same(state);
      return transcript(state) ? finish() : { state: off(state), effects: [{ type: 'voice.close' }, { type: 'focus' }] };
    case 'voice.cancel':
      return state.voice === 'off' ? same(state) : { state: off(state), effects: [{ type: 'voice.close' }, { type: 'focus' }] };
    case 'voice.nothing':
      return listening ? { state: off(state, { notice: NOTHING_HEARD }), effects: [{ type: 'voice.close' }, { type: 'focus' }] } : same(state);
    case 'voice.unavailable':
      return state.voice === 'off' ? same(state) : { state: off(state, { notice: event.message }), effects: [{ type: 'voice.close' }, { type: 'focus' }] };
    case 'voice.settled':
      return state.voice === 'sending' ? { state: off(state), effects: [{ type: 'emit', text: state.heard }] } : same(state);
  }
}
