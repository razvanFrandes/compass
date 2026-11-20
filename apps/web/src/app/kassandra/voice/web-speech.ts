import { InjectionToken } from '@angular/core';

/*
  The browser's own speech recognition (Web Speech API): the fallback when Soniox cannot be reached. It takes one
  language, ends by itself after a pause, and is missing in Firefox.
*/

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start(): void;
  abort(): void;
}

export interface WebSpeechHandlers {
  onTranscript: (final: string, partial: string) => void;
  /** Recognition ended after a pause in speech. */
  onEnd: () => void;
  onError: () => void;
}

export interface WebSpeechSession {
  stop(): void;
}

/** Starts a recognition, or returns null when the browser has none. */
export type WebSpeechStarter = (handlers: WebSpeechHandlers) => WebSpeechSession | null;

/** Romanian for a Romanian browser, English otherwise: this API cannot listen for both at once. */
export function speechLanguage(preferred: readonly string[] = globalThis.navigator?.languages ?? []): string {
  return preferred.some((language) => /^ro\b/i.test(language)) && !/^en\b/i.test(preferred[0] ?? '') ? 'ro-RO' : 'en-US';
}

export function startWebSpeech(handlers: WebSpeechHandlers): WebSpeechSession | null {
  const scope = globalThis as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
  const Recognition = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  if (!Recognition) return null;
  let recognition: RecognitionLike;
  try {
    recognition = new Recognition();
    recognition.lang = speechLanguage();
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let final = '';
      let partial = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]!;
        if (result.isFinal) final += result[0]!.transcript;
        else partial += result[0]!.transcript;
      }
      handlers.onTranscript(final.trimStart(), final ? partial : partial.trimStart());
    };
    recognition.onend = () => handlers.onEnd();
    recognition.onerror = () => handlers.onError();
    recognition.start();
  } catch {
    return null;
  }
  return {
    stop() {
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
