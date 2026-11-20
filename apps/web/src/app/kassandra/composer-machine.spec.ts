import { NOTHING_HEARD, initialComposer, step, transcript, type ComposerContext, type ComposerEvent, type ComposerState } from './composer-machine';

const idle: ComposerContext = { busy: false, steerable: false, online: true, voiceSends: true };

/** Runs events in order and returns the last state with every effect, in order. */
function run(events: ComposerEvent[], context: ComposerContext = idle, from: ComposerState = initialComposer()) {
  let state = from;
  const effects: string[] = [];
  for (const event of events) {
    const next = step(state, event, context);
    state = next.state;
    effects.push(...next.effects.map((effect) => (effect.type === 'emit' ? `emit:${effect.text}` : effect.type)));
  }
  return { state, effects };
}

const speak = (final: string, partial = ''): ComposerEvent => ({ type: 'voice.transcript', final, partial });
const listening: ComposerEvent[] = [{ type: 'voice.start' }, { type: 'voice.listening', engine: null }, { type: 'voice.engine', engine: 'soniox' }];

describe('composer: typed text', () => {
  it('sends the trimmed text and empties the field', () => {
    const { state, effects } = run([{ type: 'input', text: '  Why is Lisbon behind?  ' }, { type: 'submit' }]);
    expect(effects).toEqual(['emit:Why is Lisbon behind?']);
    expect(state.draft).toBe('');
  });

  it('sends nothing when the field is empty', () => {
    expect(run([{ type: 'input', text: '   ' }, { type: 'submit' }]).effects).toEqual([]);
  });

  it('keeps the text while Kassandra is answering, unless the answer can be steered', () => {
    const typed: ComposerEvent[] = [{ type: 'input', text: 'Use last year instead' }, { type: 'submit' }];
    const busy = run(typed, { ...idle, busy: true });
    expect(busy.effects).toEqual([]);
    expect(busy.state.draft).toBe('Use last year instead');
    expect(run(typed, { ...idle, busy: true, steerable: true }).effects).toEqual(['emit:Use last year instead']);
  });

  it('keeps the text while offline', () => {
    const { state, effects } = run([{ type: 'input', text: 'Hello' }, { type: 'submit' }], { ...idle, online: false });
    expect(effects).toEqual([]);
    expect(state.draft).toBe('Hello');
  });

  it('places a pre-filled question and focuses the field, without sending', () => {
    const { state, effects } = run([{ type: 'prefill', text: 'Which nights are behind?' }]);
    expect(state.draft).toBe('Which nights are behind?');
    expect(effects).toEqual(['focus']);
  });
});

describe('composer: voice', () => {
  it('opens the microphone once, however often the button is pressed', () => {
    const { state, effects } = run([{ type: 'voice.start' }, { type: 'voice.start' }]);
    expect(state.voice).toBe('starting');
    expect(effects).toEqual(['voice.open']);
  });

  it('shows partial words live: final ones stay, the tail is replaced', () => {
    const { state } = run([...listening, speak('', 'Why is'), speak('Why is', ' Lisbon'), speak('Why is', ' Lisabona în urmă')]);
    expect(state.voice).toBe('listening');
    expect(state.engine).toBe('soniox');
    expect(state.heard).toBe('Why is');
    expect(state.partial).toBe(' Lisabona în urmă');
    expect(transcript(state)).toBe('Why is Lisabona în urmă');
  });

  it('sends what was heard when the person stops speaking, after a short "Sending…" beat', () => {
    const stopped = run([...listening, speak('Why is Lisbon', ' behind?'), { type: 'voice.endpoint' }]);
    expect(stopped.state.voice).toBe('sending');
    expect(stopped.effects).toEqual(['voice.open', 'voice.close', 'settle']);
    const sent = run([{ type: 'voice.settled' }], idle, stopped.state);
    expect(sent.effects).toEqual(['emit:Why is Lisbon behind?']);
    expect(sent.state).toEqual(initialComposer());
  });

  it('keeps listening through a pause before the first word', () => {
    const { state, effects } = run([...listening, { type: 'voice.endpoint' }]);
    expect(state.voice).toBe('listening');
    expect(effects).toEqual(['voice.open']);
  });

  it('sends on Done as on silence', () => {
    const { state, effects } = run([...listening, speak('Show pace for Dubai'), { type: 'voice.done' }, { type: 'voice.settled' }]);
    expect(effects.at(-1)).toBe('emit:Show pace for Dubai');
    expect(state.voice).toBe('off');
  });

  it('Done with nothing heard closes voice and sends nothing', () => {
    const { state, effects } = run([...listening, { type: 'voice.done' }]);
    expect(state.voice).toBe('off');
    expect(effects).toEqual(['voice.open', 'voice.close', 'focus']);
  });

  it('Esc drops what was heard, at any moment', () => {
    for (const before of [[{ type: 'voice.start' }] as ComposerEvent[], [...listening, speak('Why is Lisbon')]]) {
      const { state, effects } = run([...before, { type: 'voice.cancel' }]);
      expect(state).toEqual(initialComposer());
      expect(effects.slice(-2)).toEqual(['voice.close', 'focus']);
      expect(effects.some((effect) => effect.startsWith('emit'))).toBe(false);
    }
  });

  it('Esc during "Sending…" still stops the question', () => {
    const { state, effects } = run([...listening, speak('Why'), { type: 'voice.endpoint' }, { type: 'voice.cancel' }, { type: 'voice.settled' }]);
    expect(state.voice).toBe('off');
    expect(effects.some((effect) => effect.startsWith('emit'))).toBe(false);
  });

  it('puts the words in the field instead of sending when the host edits before sending', () => {
    const { state, effects } = run([{ type: 'input', text: 'Email me' }, ...listening, speak('when Lisbon falls behind'), { type: 'voice.endpoint' }], { ...idle, voiceSends: false });
    expect(state.voice).toBe('off');
    expect(state.draft).toBe('Email me when Lisbon falls behind');
    expect(effects).toEqual(['voice.open', 'voice.close', 'focus']);
  });

  it('puts the words in the field when Kassandra is busy and cannot be steered', () => {
    const { state, effects } = run([...listening, speak('And for Dubai?'), { type: 'voice.endpoint' }], { ...idle, busy: true });
    expect(state.draft).toBe('And for Dubai?');
    expect(effects.some((effect) => effect.startsWith('emit'))).toBe(false);
  });

  it('says so when nothing was heard', () => {
    const { state, effects } = run([...listening, { type: 'voice.nothing' }]);
    expect(state.voice).toBe('off');
    expect(state.notice).toBe(NOTHING_HEARD);
    expect(effects.slice(-2)).toEqual(['voice.close', 'focus']);
  });

  it('shows why voice is unavailable and clears it at the next keystroke', () => {
    const blocked = run([{ type: 'voice.start' }, { type: 'voice.unavailable', message: 'The microphone is blocked.' }]);
    expect(blocked.state.voice).toBe('off');
    expect(blocked.state.notice).toBe('The microphone is blocked.');
    expect(run([{ type: 'input', text: 'W' }], idle, blocked.state).state.notice).toBeNull();
  });

  it('never sends the demo transcript: it lands in the field, for the person to send or drop', () => {
    const { state, effects } = run([{ type: 'voice.start' }, { type: 'voice.listening', engine: 'demo' }, speak('Which nights are behind?'), { type: 'voice.endpoint' }]);
    expect(state.voice).toBe('off');
    expect(state.draft).toBe('Which nights are behind?');
    expect(effects.some((effect) => effect.startsWith('emit'))).toBe(false);
  });

  it('labels the demo engine and ignores voice events once voice is off', () => {
    const demo = run([{ type: 'voice.start' }, { type: 'voice.listening', engine: 'demo' }]);
    expect(demo.state.engine).toBe('demo');
    const late = run([speak('late words'), { type: 'voice.endpoint' }, { type: 'voice.settled' }]);
    expect(late.state).toEqual(initialComposer());
    expect(late.effects).toEqual([]);
  });

  it('does not submit typed text while voice is on', () => {
    const { effects } = run([{ type: 'input', text: 'typed' }, ...listening, { type: 'submit' }]);
    expect(effects).toEqual(['voice.open']);
  });
});
