import { startWebSpeech, type RecognitionLike } from './web-speech';

class FakeRecognition implements RecognitionLike {
  static made: FakeRecognition[] = [];
  static failStart = false;
  lang = '';
  interimResults = false;
  continuous = false;
  onresult: RecognitionLike['onresult'] = null;
  onend: RecognitionLike['onend'] = null;
  onerror: RecognitionLike['onerror'] = null;
  starts = 0;
  aborted = false;
  constructor() {
    FakeRecognition.made.push(this);
  }
  start() {
    if (FakeRecognition.failStart) throw new Error('InvalidStateError');
    this.starts++;
  }
  abort() {
    this.aborted = true;
  }
  /** One recognition's results so far: [text, isFinal]. */
  hear(...results: [string, boolean][]) {
    this.onresult?.({ results: results.map(([transcript, isFinal]) => Object.assign([{ transcript }], { isFinal })) });
  }
}

function listen() {
  FakeRecognition.made = [];
  FakeRecognition.failStart = false;
  const heard: [string, string][] = [];
  let errors = 0;
  const session = startWebSpeech({ onTranscript: (final, partial) => heard.push([final, partial]), onError: () => errors++ }, FakeRecognition)!;
  return { session, recognition: FakeRecognition.made[0]!, heard, errors: () => errors };
}

describe('Web Speech fallback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('listens continuously, with interim results', () => {
    const { recognition, heard } = listen();
    expect(recognition.continuous).toBe(true);
    expect(recognition.interimResults).toBe(true);
    expect(recognition.starts).toBe(1);
    recognition.hear(['Why is', true], [' Lisbon', false]);
    expect(heard).toEqual([['Why is', ' Lisbon']]);
  });

  it('starts again when the browser ends recognition by itself, and keeps the words across the restart', () => {
    const { recognition, heard, errors } = listen();
    recognition.hear(['Why is Lisbon', true]);
    vi.advanceTimersByTime(8000); // the person pauses to think; the browser gives up
    recognition.onerror!({ error: 'no-speech' });
    recognition.onend!();
    expect(recognition.starts).toBe(2);
    expect(errors()).toBe(0);
    recognition.hear(['behind', false]);
    recognition.hear(['behind last year?', true]);
    expect(heard).toEqual([
      ['Why is Lisbon', ''],
      ['Why is Lisbon', ' behind'],
      ['Why is Lisbon behind last year?', ''],
    ]);
  });

  it('keeps words that were still provisional when the browser ended recognition', () => {
    const { recognition, heard } = listen();
    recognition.hear(['Show pace', false]);
    vi.advanceTimersByTime(5000);
    recognition.onend!();
    recognition.hear(['for Dubai', true]);
    expect(heard.at(-1)).toEqual(['Show pace for Dubai', '']);
  });

  it('keeps restarting through a long silence, for as long as the person has not stopped it', () => {
    const { recognition, errors } = listen();
    for (let i = 0; i < 30; i++) {
      vi.advanceTimersByTime(8000);
      recognition.onend!();
    }
    expect(recognition.starts).toBe(31);
    expect(errors()).toBe(0);
  });

  it('does not start again once the person stopped it', () => {
    const { session, recognition } = listen();
    const onend = recognition.onend!;
    session.stop();
    onend();
    expect(recognition.aborted).toBe(true);
    expect(recognition.starts).toBe(1);
    expect(recognition.onend).toBeNull();
  });

  it('reports an error, without restarting, when the browser refuses to listen', () => {
    const { recognition, errors } = listen();
    recognition.onerror!({ error: 'not-allowed' });
    recognition.onend!();
    expect(recognition.starts).toBe(1);
    expect(errors()).toBe(1);
  });

  it('gives up when recognition keeps ending at once, or will not start again', () => {
    const instant = listen();
    instant.recognition.onend!();
    instant.recognition.onend!();
    expect(instant.errors()).toBe(0);
    instant.recognition.onend?.();
    expect(instant.errors()).toBe(1);
    expect(instant.recognition.starts).toBe(3);

    const broken = listen();
    vi.advanceTimersByTime(5000);
    FakeRecognition.failStart = true;
    broken.recognition.onend!();
    expect(broken.errors()).toBe(1);
  });

  it('is absent where the browser has no recognition', () => {
    expect(startWebSpeech({ onTranscript: () => undefined, onError: () => undefined }, undefined)).toBeNull();
  });
});
