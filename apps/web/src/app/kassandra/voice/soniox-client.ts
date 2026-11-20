/*
  Soniox real-time transcription over one WebSocket, as documented at docs.soniox.com (read 2026-11-20):
  - the browser authenticates with the WebSocket protocols list, ['soniox-api-key', <temporary key>];
  - the first message is the configuration, as JSON text;
  - audio follows as binary frames; an empty text frame ends the stream, and the server answers with
    `finished: true` before it closes;
  - each response carries tokens: final ones are sent once and kept, non-final ones replace the previous
    non-final ones.
  Endpoint detection stays off: a pause is not the end of a question. The person ends it, with Send or Stop.
*/

/** The part of a `WebSocket` the client uses, so tests can pass a fake. */
export interface VoiceSocketLike {
  readonly readyState: number;
  binaryType?: string;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  send(data: string | ArrayBuffer): void;
  close(code?: number, reason?: string): void;
}

export type VoiceSocketFactory = (url: string, protocols: string[]) => VoiceSocketLike;

export interface SonioxConfig {
  wsUrl: string;
  /** The temporary key from `POST /api/voice/token`. */
  apiKey: string;
  model: string;
  /** The rate of the 16-bit mono PCM that `sendAudio` receives. */
  sampleRate: number;
  /** Languages to expect; recognition is biased to them, not restricted. */
  languageHints?: string[];
}

export interface SonioxHandlers {
  /** `final` never changes again; `partial` is the provisional tail and is replaced on every call. */
  onTranscript: (final: string, partial: string) => void;
  /** The stream ended cleanly after `finish()`. */
  onFinished: () => void;
  /** The service refused or dropped the stream. `status` is Soniox's HTTP-like code when it sent one. */
  onError: (message: string, status?: number) => void;
}

interface SonioxToken {
  text: string;
  is_final?: boolean;
}

interface SonioxResponse {
  tokens?: SonioxToken[];
  finished?: boolean;
  error_code?: number;
  error_type?: string;
  error_message?: string;
}

const OPEN = 1;
/** "<end>" and "<fin>" are markers, never words, and never a reason to stop. */
const MARKER = /^<[a-z_]+>$/;
/** About 20 s of 16 kHz audio: what may wait while the socket opens. */
const MAX_QUEUED_BYTES = 640_000;

export const SONIOX_LANGUAGES = ['en', 'ro'];

/** One transcription stream. Make a new one for every question. */
export class SonioxStream {
  private readonly socket: VoiceSocketLike;
  private queue: ArrayBuffer[] = [];
  private queuedBytes = 0;
  private finalText = '';
  private finishing = false;
  private settled = false;

  constructor(
    private readonly config: SonioxConfig,
    private readonly handlers: SonioxHandlers,
    createSocket: VoiceSocketFactory = (url, protocols) => new WebSocket(url, protocols),
  ) {
    this.socket = createSocket(config.wsUrl, ['soniox-api-key', config.apiKey]);
    this.socket.binaryType = 'arraybuffer';
    this.socket.onopen = () => this.start();
    this.socket.onmessage = (event) => this.receive(event.data);
    this.socket.onerror = () => undefined; // a close always follows, and that is where the failure is reported
    this.socket.onclose = () => this.fail('The voice service closed the connection.');
  }

  /** 16-bit little-endian mono PCM at `config.sampleRate`. Audio sent before the socket opens is kept, then sent. */
  sendAudio(chunk: ArrayBuffer): void {
    if (this.settled || this.finishing || !chunk.byteLength) return;
    if (this.socket.readyState === OPEN) {
      this.socket.send(chunk);
      return;
    }
    if (this.queuedBytes + chunk.byteLength > MAX_QUEUED_BYTES) return;
    this.queue.push(chunk);
    this.queuedBytes += chunk.byteLength;
  }

  /** No more audio: the service finalises what it heard and answers `finished`. */
  finish(): void {
    if (this.settled || this.finishing) return;
    this.finishing = true;
    if (this.socket.readyState === OPEN) this.socket.send('');
  }

  /** Stops at once and reports nothing more. */
  close(): void {
    if (this.settled) return;
    this.settled = true;
    this.queue = [];
    this.socket.onopen = this.socket.onmessage = this.socket.onclose = this.socket.onerror = null;
    try {
      this.socket.close(1000);
    } catch {
      // Already closed.
    }
  }

  private start(): void {
    this.socket.send(
      JSON.stringify({
        model: this.config.model,
        audio_format: 'pcm_s16le',
        sample_rate: this.config.sampleRate,
        num_channels: 1,
        language_hints: this.config.languageHints ?? SONIOX_LANGUAGES,
        enable_language_identification: true,
        enable_endpoint_detection: false,
      }),
    );
    for (const chunk of this.queue) this.socket.send(chunk);
    this.queue = [];
    this.queuedBytes = 0;
    if (this.finishing) this.socket.send('');
  }

  private receive(data: unknown): void {
    if (this.settled || typeof data !== 'string') return;
    let response: SonioxResponse;
    try {
      response = JSON.parse(data) as SonioxResponse;
    } catch {
      return;
    }
    if (response.error_code !== undefined || response.error_type !== undefined) {
      this.fail(response.error_message || 'The voice service returned an error.', response.error_code);
      return;
    }
    let partial = '';
    for (const token of response.tokens ?? []) {
      if (typeof token?.text !== 'string') continue;
      if (MARKER.test(token.text)) continue;
      if (token.is_final) this.finalText += token.text;
      else partial += token.text;
    }
    if (response.tokens?.length) this.handlers.onTranscript(this.finalText.trimStart(), this.finalText ? partial : partial.trimStart());
    if (response.finished) {
      this.close();
      this.handlers.onFinished();
    }
  }

  private fail(message: string, status?: number): void {
    if (this.settled) return;
    this.close();
    this.handlers.onError(message, status);
  }
}
