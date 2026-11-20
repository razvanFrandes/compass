import { SonioxStream, type SonioxHandlers, type VoiceSocketLike } from './soniox-client';

class FakeVoiceSocket implements VoiceSocketLike {
  readyState = 0;
  binaryType?: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readonly sent: (string | ArrayBuffer)[] = [];
  closed = false;

  constructor(
    readonly url: string,
    readonly protocols: string[],
  ) {}

  send(data: string | ArrayBuffer): void {
    this.sent.push(data);
  }
  close(): void {
    this.closed = true;
    this.readyState = 3;
  }
  open(): void {
    this.readyState = 1;
    this.onopen?.({} as Event);
  }
  serve(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent);
  }
  drop(): void {
    this.readyState = 3;
    this.onclose?.({ code: 1006 } as CloseEvent);
  }
}

function setup() {
  let socket!: FakeVoiceSocket;
  const seen = { transcripts: [] as [string, string][], finished: 0, errors: [] as [string, number | undefined][] };
  const handlers: SonioxHandlers = {
    onTranscript: (final, partial) => seen.transcripts.push([final, partial]),
    onFinished: () => seen.finished++,
    onError: (message, status) => seen.errors.push([message, status]),
  };
  const stream = new SonioxStream({ wsUrl: 'wss://stt-rt.soniox.com/transcribe-websocket', apiKey: 'snx_temp_abc', model: 'stt-rt-v6', sampleRate: 16000 }, handlers, (url, protocols) => {
    socket = new FakeVoiceSocket(url, protocols);
    return socket;
  });
  return { stream, socket, seen };
}

const pcm = (samples: number) => new Int16Array(samples).buffer;

describe('SonioxStream', () => {
  it('authenticates with the protocols list, so the temporary key is never in the URL or a message', () => {
    const { socket } = setup();
    expect(socket.url).toBe('wss://stt-rt.soniox.com/transcribe-websocket');
    expect(socket.protocols).toEqual(['soniox-api-key', 'snx_temp_abc']);
    socket.open();
    expect(JSON.stringify(socket.sent)).not.toContain('snx_temp_abc');
  });

  it('sends the configuration first: raw PCM, English and Romanian, endpoint detection', () => {
    const { socket } = setup();
    socket.open();
    expect(JSON.parse(socket.sent[0] as string)).toEqual({
      model: 'stt-rt-v6',
      audio_format: 'pcm_s16le',
      sample_rate: 16000,
      num_channels: 1,
      language_hints: ['en', 'ro'],
      enable_language_identification: true,
      enable_endpoint_detection: false,
    });
  });

  it('keeps audio captured while the socket opens and sends it after the configuration, in order', () => {
    const { stream, socket } = setup();
    const first = pcm(160);
    const second = pcm(320);
    stream.sendAudio(first);
    stream.sendAudio(second);
    expect(socket.sent).toHaveLength(0);
    socket.open();
    expect(typeof socket.sent[0]).toBe('string');
    expect(socket.sent.slice(1)).toEqual([first, second]);
    const third = pcm(80);
    stream.sendAudio(third);
    expect(socket.sent.at(-1)).toBe(third);
  });

  it('appends final tokens and replaces the non-final ones on every response', () => {
    const { socket, seen } = setup();
    socket.open();
    socket.serve({ tokens: [{ text: 'Why', is_final: false }, { text: ' is', is_final: false }] });
    socket.serve({ tokens: [{ text: 'Why', is_final: true }, { text: ' is', is_final: true }, { text: ' Lisbon', is_final: false }] });
    socket.serve({ tokens: [{ text: ' Lisabona', is_final: false }, { text: ' în', is_final: false }] });
    socket.serve({ tokens: [{ text: ' Lisabona', is_final: true }, { text: ' în urmă?', is_final: true }] });
    expect(seen.transcripts).toEqual([
      ['', 'Why is'],
      ['Why is', ' Lisbon'],
      ['Why is', ' Lisabona în'],
      ['Why is Lisabona în urmă?', ''],
    ]);
  });

  it('does not ask for endpoint detection, and an <end> token is never shown nor ends anything', () => {
    const { socket, seen } = setup();
    socket.open();
    socket.serve({ tokens: [{ text: 'Show pace', is_final: true }, { text: '<end>', is_final: true }] });
    socket.serve({ tokens: [{ text: ' for Dubai', is_final: true }] });
    expect(seen.transcripts).toEqual([
      ['Show pace', ''],
      ['Show pace for Dubai', ''],
    ]);
    expect(seen.finished).toBe(0);
    expect(socket.closed).toBe(false);
  });

  it('ends the stream with an empty text frame and reports finished once the service confirms', () => {
    const { stream, socket, seen } = setup();
    socket.open();
    stream.finish();
    expect(socket.sent.at(-1)).toBe('');
    stream.sendAudio(pcm(160));
    expect(socket.sent.at(-1)).toBe('');
    socket.serve({ tokens: [{ text: 'Done', is_final: true }], finished: true });
    expect(seen.finished).toBe(1);
    expect(socket.closed).toBe(true);
    socket.drop();
    expect(seen.errors).toEqual([]);
  });

  it('finishes right after the configuration when finish() came before the socket opened', () => {
    const { stream, socket } = setup();
    stream.sendAudio(pcm(160));
    stream.finish();
    socket.open();
    expect(socket.sent).toHaveLength(3);
    expect(socket.sent[2]).toBe('');
  });

  it('reports an error response with its status and closes', () => {
    const { socket, seen } = setup();
    socket.open();
    socket.serve({ tokens: [], error_code: 401, error_type: 'unauthenticated', error_message: 'Invalid API key.' });
    expect(seen.errors).toEqual([['Invalid API key.', 401]]);
    expect(socket.closed).toBe(true);
  });

  it('reports a dropped connection once', () => {
    const { socket, seen } = setup();
    socket.open();
    socket.drop();
    socket.drop();
    expect(seen.errors).toHaveLength(1);
  });

  it('reports nothing after close()', () => {
    const { stream, socket, seen } = setup();
    socket.open();
    stream.close();
    socket.serve({ tokens: [{ text: 'late', is_final: true }] });
    socket.drop();
    expect(seen.transcripts).toEqual([]);
    expect(seen.errors).toEqual([]);
  });
});
