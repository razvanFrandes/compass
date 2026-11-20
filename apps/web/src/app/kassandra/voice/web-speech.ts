import { InjectionToken } from '@angular/core';

/*
  The browser's own speech recognition (Web Speech API): the fallback when Soniox cannot be reached. It takes one
  language and is missing in Firefox. Browsers end a recognition by themselves after a pause (and Chrome after
  about a minute even in continuous mode); a pause is not the end of a question, so it is started again, with the
  words so far kept, until the person stops it.
*/

export interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start(): void;
  abort(): void;
}

export type RecognitionConstructor = new () => RecognitionLike;

export interface WebSpeechHandlers {
  /** Everything heard since the start, across the browser's own restarts. */
  onTranscript: (final: string, partial: string) => void;
  /** Recognition cannot go on: no permission, no network, or it will not start again. */
  onError: () => void;
}

export interface WebSpeechSession {
  stop(): void;
}

/** Starts a recognition, or returns null when the browser has none. */
export type WebSpeechStarter = (handlers: WebSpeechHandlers) => WebSpeechSession | null;

/** Errors after which starting again cannot help. "no-speech" and "aborted" are not among them: they are pauses. */
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'language-not-supported']);
/** A recognition that ends this soon after it started, this many times in a row, is not going to work. */
const INSTANT_MS = 1000;
const MAX_INSTANT_ENDS = 3;

/** Romanian for a Romanian browser, English otherwise: this API cannot listen for both at once. */
export function speechLanguage(preferred: readonly string[] = globalThis.navigator?.languages ?? []): string {
  return preferred.some((language) => /^ro\b/i.test(language)) && !/^en\b/i.test(preferred[0] ?? '') ? 'ro-RO' : 'en-US';
}

function browserRecognition(): RecognitionConstructor | undefined {
  const scope = globalThis as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}

/** Two stretches of speech as one text, with one space between them. */
const join = (before: string, after: string): string => (before && after.trim() ? `${before.trimEnd()} ${after.trimStart()}` : before || after.trimStart());

export function startWebSpeech(handlers: WebSpeechHandlers, Recognition: RecognitionConstructor | undefined = browserRecognition()): WebSpeechSession | null {
  if (!Recognition) return null;
  let recognition: RecognitionLike;
  /** What earlier recognitions heard, before the browser ended them. */
  let kept = '';
  let final = '';
  let partial = '';
  let stopped = false;
  let fatal = false;
  let startedAt = 0;
  let instantEnds = 0;

  const begin = () => {
    startedAt = performance.now();
    recognition.start();
  };
  const fail = () => {
    stopped = true;
    recognition.onresult = recognition.onend = recognition.onerror = null;
    handlers.onError();
  };

  try {
    recognition = new Recognition();
    recognition.lang = speechLanguage();
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      final = '';
      partial = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]!;
        if (result.isFinal) final += result[0]!.transcript;
        else partial += result[0]!.transcript;
      }
      instantEnds = 0;
      const said = join(kept, final);
      handlers.onTranscript(said, said ? (partial.trim() && !/^\s/.test(partial) ? ` ${partial}` : partial) : partial.trimStart());
    };
    recognition.onerror = (event) => {
      // An end always follows, and that is where the failure is reported.
      if (FATAL.has(event.error ?? '')) fatal = true;
    };
    recognition.onend = () => {
      if (stopped) return;
      // The browser ended it, not the person: keep the words and listen on.
      kept = join(kept, `${final}${partial}`);
      final = partial = '';
      instantEnds = performance.now() - startedAt < INSTANT_MS ? instantEnds + 1 : 0;
      if (fatal || instantEnds >= MAX_INSTANT_ENDS) return fail();
      try {
        begin();
      } catch {
        fail();
      }
    };
    begin();
  } catch {
    return null;
  }
  return {
    stop() {
      stopped = true;
      recognition.onresult = recognition.onend = recognition.onerror = null;
      try {
        recognition.abort();
      } catch {
        // Already stopped.
      }
    },
  };
}

export const WEB_SPEECH = new InjectionToken<WebSpeechStarter>('WEB_SPEECH', { providedIn: 'root', factory: () => startWebSpeech });
