import { TestBed } from '@angular/core/testing';
import type { ApiResult, VoiceToken } from '../../api';
import { MIC_OPENER, type MicCapture } from './mic-capture';
import type { VoiceSocketLike } from './soniox-client';
import { VoiceApi } from './voice-api';
import { DEMO_PHRASE, MAX_LISTEN_MS, VOICE_BLOCKED, VOICE_FAILED, VOICE_LOST, VOICE_SOCKET_FACTORY, VoiceInput, type VoiceEvents } from './voice-input';
import { WEB_SPEECH, type WebSpeechHandlers } from './web-speech';

class FakeMic implements MicCapture {
  sampleRate = 16_000;
  onPcm: ((chunk: ArrayBuffer) => void) | null = null;
  stopped = false;
  loud = 0.5;
  level() {
    return this.loud;
  }
  bands(count: number) {
    return Array.from({ length: count }, () => 0.2);
  }
  stop() {
    this.stopped = true;
  }
  say(samples = 160) {
    this.onPcm?.(new Int16Array(samples).buffer);
  }
}

class FakeSocket implements VoiceSocketLike {
  readyState = 0;
  binaryType?: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  sent: (string | ArrayBuffer)[] = [];
  closed = false;
  constructor(
    readonly url: string,
    readonly protocols: string[],
  ) {}
  send(data: string | ArrayBuffer) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.({} as Event);
  }
  serve(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent);
  }
  drop() {
    this.readyState = 3;
    this.onclose?.({} as CloseEvent);
  }
}

const TOKEN: VoiceToken = { apiKey: 'snx_temp_1', expiresAt: '2026-11-20T23:00:00Z', model: 'stt-rt-v6', wsUrl: 'wss://stt-rt.soniox.com/transcribe-websocket' };

interface World {
  mic: FakeMic | Error;
  token: ApiResult<VoiceToken> | Promise<ApiResult<VoiceToken>>;
  webSpeech: boolean;
}

function setup(world: Partial<World> = {}) {
  const mic = world.mic ?? new FakeMic();
  const sockets: FakeSocket[] = [];
  const speech = { handlers: null as WebSpeechHandlers | null, stopped: false };
  const log: string[] = [];
  const events: VoiceEvents = {
    onListening: (engine) => log.push(`listening:${engine}`),
    onEngine: (engine) => log.push(`engine:${engine}`),
    onTranscript: (final, partial) => log.push(`heard:${final}|${partial}`),
    onTimeout: () => log.push('timeout'),
    onUnavailable: (message) => log.push(`unavailable:${message}`),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      VoiceInput,
      { provide: MIC_OPENER, useValue: async () => (mic instanceof Error ? Promise.reject(mic) : mic) },
      { provide: VoiceApi, useValue: { token: async () => world.token ?? { ok: true, value: TOKEN } } },
      {
        provide: VOICE_SOCKET_FACTORY,
        useValue: (url: string, protocols: string[]) => {
          const socket = new FakeSocket(url, protocols);
          sockets.push(socket);
          return socket;
        },
      },
      {
        provide: WEB_SPEECH,
        useValue: (handlers: WebSpeechHandlers) => {
          if (world.webSpeech === false) return null;
          speech.handlers = handlers;
          return { stop: () => (speech.stopped = true) };
        },
      },
    ],
  });
  return { voice: TestBed.inject(VoiceInput), mic, sockets, speech, log, events };
}

const named = (name: string) => Object.assign(new Error(name), { name });
const failed: ApiResult<VoiceToken> = { ok: false, error: { status: 503, message: 'Voice is not configured.' } };

describe('VoiceInput', () => {
  afterEach(() => vi.useRealTimers());

  it('streams the microphone to Soniox with the temporary key, words said early included', async () => {
    let release!: (result: ApiResult<VoiceToken>) => void;
    const { voice, mic, sockets, log, events } = setup({ token: new Promise((resolve) => (release = resolve)) });
    const started = voice.start(events);
    await Promise.resolve();
    await Promise.resolve();
    expect(log).toEqual(['listening:null']);
    (mic as FakeMic).say(160); // said while the key is on its way
    release({ ok: true, value: TOKEN });
    await started;

    expect(log).toEqual(['listening:null', 'engine:soniox']);
    const socket = sockets[0]!;
    expect(socket.url).toBe(TOKEN.wsUrl);
    expect(socket.protocols).toEqual(['soniox-api-key', 'snx_temp_1']);
    socket.open();
    expect(JSON.parse(socket.sent[0] as string)).toMatchObject({ model: 'stt-rt-v6', sample_rate: 16_000, language_hints: ['en', 'ro'], enable_endpoint_detection: false });
    expect((socket.sent[1] as ArrayBuffer).byteLength).toBe(320);
    (mic as FakeMic).say(80);
    expect((socket.sent[2] as ArrayBuffer).byteLength).toBe(160);

    socket.serve({ tokens: [{ text: 'Why is', is_final: true }, { text: ' Lisbon', is_final: false }] });
    socket.serve({ tokens: [{ text: ' Lisbon behind?', is_final: true }, { text: '<end>', is_final: true }] });
    expect(log.slice(2)).toEqual(['heard:Why is| Lisbon', 'heard:Why is Lisbon behind?|']);
  });

  it('never ends the question by itself: not on an endpoint, not on a long silence', async () => {
    vi.useFakeTimers();
    const { voice, mic, sockets, log, events } = setup();
    await voice.start(events);
    const socket = sockets[0]!;
    socket.open();
    socket.serve({ tokens: [{ text: 'Why is Lisbon', is_final: true }, { text: '<end>', is_final: true }] });
    (mic as FakeMic).loud = 0; // the person pauses to think
    vi.advanceTimersByTime(4 * 60_000);
    expect(log).toEqual(['listening:null', 'engine:soniox', 'heard:Why is Lisbon|']);
    expect(socket.closed).toBe(false);
    expect((mic as FakeMic).stopped).toBe(false);
    // Still listening: what is said after the pause is added.
    const frames = socket.sent.length;
    (mic as FakeMic).say(80);
    expect(socket.sent.length).toBe(frames + 1);
    socket.serve({ tokens: [{ text: ' behind?', is_final: true }] });
    expect(log.at(-1)).toBe('heard:Why is Lisbon behind?|');
  });

  it('keeps waiting when nothing has been said yet', async () => {
    vi.useFakeTimers();
    const { voice, mic, log, events } = setup();
    await voice.start(events);
    (mic as FakeMic).loud = 0;
    vi.advanceTimersByTime(60_000);
    expect(log).toEqual(['listening:null', 'engine:soniox']);
    expect((mic as FakeMic).stopped).toBe(false);
  });

  it('stops listening after five minutes, and says so instead of sending', async () => {
    vi.useFakeTimers();
    const { voice, mic, sockets, log, events } = setup();
    await voice.start(events);
    sockets[0]!.open();
    sockets[0]!.serve({ tokens: [{ text: 'A long question', is_final: true }] });
    vi.advanceTimersByTime(MAX_LISTEN_MS - 1);
    expect(log).not.toContain('timeout');
    vi.advanceTimersByTime(1);
    expect(log.at(-1)).toBe('timeout');
    expect((mic as FakeMic).stopped).toBe(true);
    expect(sockets[0]!.closed).toBe(true);
  });

  it('on Send, takes no more audio and waits for the last words before it is done', async () => {
    vi.useFakeTimers();
    const { voice, mic, sockets, log, events } = setup();
    await voice.start(events);
    const socket = sockets[0]!;
    socket.open();
    socket.serve({ tokens: [{ text: 'Why is', is_final: true }, { text: ' Lisbon', is_final: false }] });
    let done = 0;
    voice.finish(() => done++);
    expect(socket.sent.at(-1)).toBe(''); // the empty frame asks Soniox to finalise
    const frames = socket.sent.length;
    (mic as FakeMic).say(80);
    expect(socket.sent.length).toBe(frames);
    expect(done).toBe(0);
    socket.serve({ tokens: [{ text: ' Lisbon behind?', is_final: true }], finished: true });
    expect(log.at(-1)).toBe('heard:Why is Lisbon behind?|');
    expect(done).toBe(1);
    vi.advanceTimersByTime(5000);
    expect(done).toBe(1);
  });

  it('on Send, does not wait for ever, and waits for nothing without a stream', async () => {
    vi.useFakeTimers();
    const slow = setup();
    await slow.voice.start(slow.events);
    slow.sockets[0]!.open();
    let done = 0;
    slow.voice.finish(() => done++);
    vi.advanceTimersByTime(1400);
    expect(done).toBe(0);
    vi.advanceTimersByTime(200);
    expect(done).toBe(1);

    const browser = setup({ token: failed });
    await browser.voice.start(browser.events);
    browser.voice.finish(() => done++);
    expect(done).toBe(2);
  });

  it('forgets a pending Send when stopped', async () => {
    vi.useFakeTimers();
    const { voice, sockets, events } = setup();
    await voice.start(events);
    sockets[0]!.open();
    let done = 0;
    voice.finish(() => done++);
    voice.stop();
    vi.advanceTimersByTime(5000);
    expect(done).toBe(0);
  });

  it('falls back to the browser’s recognition when the token call fails', async () => {
    const { voice, sockets, speech, log, events } = setup({ token: failed });
    await voice.start(events);
    expect(sockets).toHaveLength(0);
    expect(log).toEqual(['listening:null', 'engine:webspeech']);
    speech.handlers!.onTranscript('Show pace', '');
    expect(log.slice(2)).toEqual(['heard:Show pace|']);
    // The browser's recognition gave up for good: the words are kept, nothing is sent.
    speech.handlers!.onError();
    expect(log.slice(3)).toEqual([`unavailable:${VOICE_LOST}`]);
  });

  it('falls back when Soniox refuses the stream before a word was heard, and keeps the words otherwise', async () => {
    const refused = setup();
    await refused.voice.start(refused.events);
    refused.sockets[0]!.open();
    refused.sockets[0]!.serve({ tokens: [], error_code: 401, error_message: 'Invalid API key.' });
    expect(refused.log).toEqual(['listening:null', 'engine:soniox', 'engine:webspeech']);

    const dropped = setup();
    await dropped.voice.start(dropped.events);
    dropped.sockets[0]!.open();
    dropped.sockets[0]!.serve({ tokens: [{ text: 'Why is Lisbon', is_final: false }] });
    dropped.sockets[0]!.drop();
    expect(dropped.log.slice(2)).toEqual(['heard:|Why is Lisbon', `unavailable:${VOICE_LOST}`]);
    expect(dropped.speech.handlers).toBeNull();
  });

  it('says voice is unavailable when neither engine can listen, and lets the microphone go', async () => {
    const { voice, mic, log, events } = setup({ token: failed, webSpeech: false });
    await voice.start(events);
    expect(log).toEqual(['listening:null', `unavailable:${VOICE_FAILED}`]);
    expect((mic as FakeMic).stopped).toBe(true);
  });

  it('plays the labelled demo only when there is no microphone', async () => {
    vi.useFakeTimers();
    const { voice, sockets, speech, log, events } = setup({ mic: named('NotFoundError') });
    await voice.start(events);
    expect(log).toEqual(['listening:demo']);
    vi.advanceTimersByTime(900 + 65 * 40 + 60_000);
    // The sample stays until the person taps Send or Stop.
    expect(log.at(-1)).toBe(`heard:${DEMO_PHRASE}|`);
    expect(sockets).toHaveLength(0);
    expect(speech.handlers).toBeNull();
  });

  it('says the microphone is blocked instead of playing a demo', async () => {
    const { voice, log, events } = setup({ mic: named('NotAllowedError') });
    await voice.start(events);
    expect(log).toEqual([`unavailable:${VOICE_BLOCKED}`]);
  });

  it('reports nothing after stop(), even when the key arrives late', async () => {
    let release!: (result: ApiResult<VoiceToken>) => void;
    const { voice, mic, sockets, log, events } = setup({ token: new Promise((resolve) => (release = resolve)) });
    const started = voice.start(events);
    await Promise.resolve();
    await Promise.resolve();
    voice.stop();
    release({ ok: true, value: TOKEN });
    await started;
    expect(sockets).toHaveLength(0);
    expect(log).toEqual(['listening:null']);
    expect((mic as FakeMic).stopped).toBe(true);
    expect(voice.level()).toBe(0);
  });
});
