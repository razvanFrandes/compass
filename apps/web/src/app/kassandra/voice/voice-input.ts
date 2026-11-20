import { Injectable, InjectionToken, inject } from '@angular/core';
import { MIC_OPENER, micFailure, type MicCapture } from './mic-capture';
import { smooth } from './pcm';
import { SonioxStream, type VoiceSocketFactory } from './soniox-client';
import { VoiceApi } from './voice-api';
import { WEB_SPEECH, type WebSpeechSession } from './web-speech';

/** What turns the voice into text: Soniox, the browser's own recognition, or a labelled demo when there is no microphone. */
export type VoiceEngine = 'soniox' | 'webspeech' | 'demo';

export interface VoiceEvents {
  /** The microphone is open (or the demo began): show the voice surface. `engine` is null until one is chosen. */
  onListening: (engine: VoiceEngine | null) => void;
  onEngine: (engine: VoiceEngine) => void;
  onTranscript: (final: string, partial: string) => void;
  /** The safety cap: listening went on for `MAX_LISTEN_MS`. Listening has stopped; nothing is sent. */
  onTimeout: () => void;
  /** Voice cannot start, or stopped working. `message` is for the person; words already heard are theirs to keep. */
  onUnavailable: (message: string) => void;
}

export const VOICE_SOCKET_FACTORY = new InjectionToken<VoiceSocketFactory>('VOICE_SOCKET_FACTORY', {
  providedIn: 'root',
  factory: () => (url, protocols) => new WebSocket(url, protocols),
});

export const DEMO_PHRASE = 'Which nights next month are furthest behind last year?';
export const VOICE_BLOCKED = 'The microphone is blocked for this page. Allow it in the browser’s site settings, or type your question.';
export const VOICE_FAILED = 'Voice isn’t available right now. Type your question instead.';

export const VOICE_LOST = 'Voice stopped working. Your words are in the field: finish typing, then send.';

/** A forgotten microphone is closed after this long. It is the only timer: silence, however long, ends nothing. */
export const MAX_LISTEN_MS = 5 * 60_000;
/** After Send, how long to wait for the recogniser's last words. */
const FINALISE_MS = 1500;

/**
 * One voice question at a time, for one composer. It opens the microphone, asks the server for a temporary Soniox
 * key and streams the audio there; when Soniox cannot be reached it falls back to the browser's recognition; with no
 * microphone at all it plays a sample question, labelled as a demo.
 *
 * It never decides that the question is over. Pauses and endpoints are ignored; listening ends when the composer
 * calls `finish()` (Send) or `stop()` (Stop, Esc), or after `MAX_LISTEN_MS`.
 */
@Injectable()
export class VoiceInput {
  private readonly api = inject(VoiceApi);
  private readonly openMic = inject(MIC_OPENER);
  private readonly createSocket = inject(VOICE_SOCKET_FACTORY);
  private readonly webSpeech = inject(WEB_SPEECH);

  /** Counts every start and stop, so a callback from an earlier question can tell it is stale. */
  private generation = 0;
  private active = false;
  private mic: MicCapture | null = null;
  private stream: SonioxStream | null = null;
  private speech: WebSpeechSession | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  /** Set by `finish()`: called when the recogniser has handed over its last words. */
  private finished: (() => void) | null = null;
  private demoLevel = 0;
  private demoSpeaking = false;
  private demoAt = 0;

  /** Loudness 0..1, for the orb. Call once per animation frame while listening. */
  level(): number {
    if (this.mic) return this.mic.level();
    if (!this.active) return 0;
    // The demo has no microphone: a believable level while the sample question is being "said".
    const now = performance.now();
    const t = now / 1000;
    const target = this.demoSpeaking ? Math.max(0, 0.45 + 0.35 * Math.sin(t * 9) * Math.sin(t * 2.3)) : 0;
    this.demoLevel = smooth(this.demoLevel, target, Math.min(0.1, (now - this.demoAt) / 1000));
    this.demoAt = now;
    return this.demoLevel;
  }

  bands(count: number): number[] {
    return this.mic ? this.mic.bands(count) : Array.from({ length: count }, () => 0);
  }

  /** Starts listening. Call it from the click on the microphone, so the browser may ask for permission. */
  async start(events: VoiceEvents): Promise<void> {
    this.stop();
    const run = ++this.generation;
    this.active = true;
    const live = () => this.active && run === this.generation;
    this.timers.push(
      setTimeout(() => {
        if (!live()) return;
        this.stop();
        events.onTimeout();
      }, MAX_LISTEN_MS),
    );

    let mic: MicCapture;
    try {
      mic = await this.openMic();
    } catch (error) {
      if (!live()) return;
      if (micFailure(error) === 'blocked') {
        this.stop();
        events.onUnavailable(VOICE_BLOCKED);
      } else {
        this.demo(events, live);
      }
      return;
    }
    if (!live()) return mic.stop();
    this.mic = mic;
    events.onListening(null);

    // Words said while the key is on its way are kept and sent first.
    const early: ArrayBuffer[] = [];
    mic.onPcm = (chunk) => early.push(chunk);
    let heard = '';

    const fallBack = () => {
      if (!live()) return;
      this.stream?.close();
      this.stream = null;
      mic.onPcm = null;
      this.speech = this.webSpeech({
        onTranscript: (final, partial) => {
          if (!live()) return;
          heard = `${final}${partial}`;
          events.onTranscript(final, partial);
        },
        onError: () => live() && this.unavailable(events, heard.trim() ? VOICE_LOST : VOICE_FAILED),
      });
      if (this.speech) events.onEngine('webspeech');
      else this.unavailable(events);
    };

    const token = await this.api.token();
    if (!live()) return;
    if (!token.ok) return fallBack();
    try {
      this.stream = new SonioxStream(
        { wsUrl: token.value.wsUrl, apiKey: token.value.apiKey, model: token.value.model, sampleRate: mic.sampleRate },
        {
          onTranscript: (final, partial) => {
            if (!live()) return;
            heard = `${final}${partial}`;
            events.onTranscript(final, partial);
          },
          onFinished: () => live() && this.finished?.(),
          onError: () => {
            if (!live()) return;
            // After Send, what was heard so far is the question.
            if (this.finished) this.finished();
            // With words already heard, the person keeps them; with none, try the browser's recognition.
            else if (heard.trim()) this.unavailable(events, VOICE_LOST);
            else fallBack();
          },
        },
        this.createSocket,
      );
    } catch {
      return fallBack();
    }
    const stream = this.stream;
    for (const chunk of early) stream.sendAudio(chunk);
    mic.onPcm = (chunk) => stream.sendAudio(chunk);
    events.onEngine('soniox');
  }

  /**
   * Send was tapped: no more audio is taken, and `done` is called once the recogniser has finalised its last words
   * (they still arrive through `onTranscript`), or at once when there is nothing to wait for. `stop()` cancels it.
   */
  finish(done: () => void): void {
    const run = this.generation;
    const stream = this.stream;
    if (!this.active || !stream) return done();
    if (this.mic) this.mic.onPcm = null;
    let called = false;
    this.finished = () => {
      if (called || run !== this.generation) return;
      called = true;
      done();
    };
    this.timers.push(setTimeout(this.finished, FINALISE_MS));
    stream.finish();
  }

  /** Stops everything: the microphone, the stream and every timer. Safe to call again. */
  stop(): void {
    this.generation++;
    this.active = false;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.finished = null;
    this.stream?.close();
    this.stream = null;
    this.speech?.stop();
    this.speech = null;
    this.mic?.stop();
    this.mic = null;
    this.demoSpeaking = false;
    this.demoLevel = 0;
  }

  private unavailable(events: VoiceEvents, message = VOICE_FAILED): void {
    this.stop();
    events.onUnavailable(message);
  }

  /** No microphone here (a sandboxed preview, a desktop without one): a sample question, typed out and labelled. */
  private demo(events: VoiceEvents, live: () => boolean): void {
    events.onListening('demo');
    this.demoAt = performance.now();
    let shown = 0;
    const type = () => {
      if (!live()) return;
      this.demoSpeaking = true;
      shown += 2;
      events.onTranscript('', DEMO_PHRASE.slice(0, shown));
      if (shown < DEMO_PHRASE.length) return void this.timers.push(setTimeout(type, 65));
      this.demoSpeaking = false;
      // It stays on screen until the person taps Send or Stop.
      events.onTranscript(DEMO_PHRASE, '');
    };
    this.timers.push(setTimeout(type, 900));
  }
}
