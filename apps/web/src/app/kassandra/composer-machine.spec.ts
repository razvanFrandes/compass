import { LISTENED_LONG, NOTHING_HEARD, initialComposer, step, transcript, type ComposerContext, type ComposerEvent, type ComposerState } from './composer-machine';

const idle: ComposerContext = { busy: false, steerable: false, online: true };

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

  it('never sends on a pause: the words keep adding up through any silence, with nothing emitted', () => {
    // A recogniser reports nothing during a pause, and repeats its text when it finalises: neither ends listening.
    const { state, effects } = run([...listening, speak('', 'Why is'), speak('Why is', ''), speak('Why is', ''), speak('Why is', ' Lisbon'), speak('Why is Lisbon', ''), speak('Why is Lisbon', ' behind?')]);
    expect(state.voice).toBe('listening');
    expect(transcript(state)).toBe('Why is Lisbon behind?');
    expect(effects).toEqual(['voice.open']);
  });

  it('has no event that sends by itself: only Send leads to a question', () => {
    const said: ComposerEvent[] = [...listening, speak('Why is Lisbon behind?')];
    const unattended: ComposerEvent[] = [{ type: 'voice.timeout' }, { type: 'voice.unavailable', message: 'Voice stopped.' }, { type: 'voice.stop' }, { type: 'voice.settled' }, { type: 'voice.engine', engine: 'webspeech' }, speak('Why is Lisbon behind?')];
    for (const event of unattended) {
      const { effects } = run([...said, event, { type: 'voice.settled' }]);
      expect(effects.some((effect) => effect.startsWith('emit') || effect === 'voice.finish')).toBe(false);
    }
  });

  it('Send while listening stops listening, waits for the last words and sends the full transcript', () => {
    const tapped = run([...listening, speak('Why is Lisbon', ' behind'), { type: 'voice.done' }]);
    expect(tapped.state.voice).toBe('sending');
    expect(tapped.effects).toEqual(['voice.open', 'voice.finish']);
    const sent = run([speak('Why is Lisbon behind last year?'), { type: 'voice.settled' }], idle, tapped.state);
    expect(sent.effects).toEqual(['voice.close', 'emit:Why is Lisbon behind last year?']);
    expect(sent.state).toEqual(initialComposer());
  });

  it('Send puts what was typed before what was said, as one question', () => {
    const { state, effects } = run([{ type: 'input', text: 'Email me' }, ...listening, speak('when Lisbon falls behind'), { type: 'voice.done' }, { type: 'voice.settled' }]);
    expect(effects.at(-1)).toBe('emit:Email me when Lisbon falls behind');
    expect(state.draft).toBe('');
  });

  it('Send with nothing heard closes voice and sends nothing', () => {
    const { state, effects } = run([...listening, { type: 'voice.done' }]);
    expect(state.voice).toBe('off');
    expect(effects).toEqual(['voice.open', 'voice.close', 'focus']);
  });

  it('Stop and Esc keep the words in the field and send nothing', () => {
    const { state, effects } = run([...listening, speak('Why is Lisbon', ' behind?'), { type: 'voice.stop' }]);
    expect(state.voice).toBe('off');
    expect(state.draft).toBe('Why is Lisbon behind?');
    expect(effects).toEqual(['voice.open', 'voice.close', 'focus']);
    // Then the person sends by hand.
    expect(run([{ type: 'submit' }], idle, state).effects).toEqual(['emit:Why is Lisbon behind?']);
  });

  it('Stop adds the words after what was already typed, and leaves the field alone when nothing was said', () => {
    const typed: ComposerEvent[] = [{ type: 'input', text: 'Email me ' }, ...listening];
    expect(run([...typed, speak('when Lisbon falls behind'), { type: 'voice.stop' }]).state.draft).toBe('Email me when Lisbon falls behind');
    expect(run([...typed, { type: 'voice.stop' }]).state.draft).toBe('Email me ');
    expect(run([{ type: 'voice.start' }, { type: 'voice.stop' }]).state).toEqual(initialComposer());
  });

  it('Stop while the last words are coming in keeps them and sends nothing', () => {
    const { state, effects } = run([...listening, speak('Why'), { type: 'voice.done' }, { type: 'voice.stop' }, { type: 'voice.settled' }]);
    expect(state.voice).toBe('off');
    expect(state.draft).toBe('Why');
    expect(effects.some((effect) => effect.startsWith('emit'))).toBe(false);
  });

  it('stops after five minutes without sending: the words wait in the field', () => {
    const { state, effects } = run([...listening, speak('A long question'), { type: 'voice.timeout' }]);
    expect(state.voice).toBe('off');
    expect(state.draft).toBe('A long question');
    expect(state.notice).toBe(LISTENED_LONG);
    expect(effects).toEqual(['voice.open', 'voice.close', 'focus']);
    expect(run([...listening, { type: 'voice.timeout' }]).state.notice).toBe(NOTHING_HEARD);
  });

  it('puts the words in the field when Kassandra is busy and cannot be steered, or the connection is down', () => {
    for (const context of [{ ...idle, busy: true }, { ...idle, online: false }]) {
      const { state, effects } = run([...listening, speak('And for Dubai?'), { type: 'voice.done' }], context);
      expect(state.voice).toBe('off');
      expect(state.draft).toBe('And for Dubai?');
      expect(effects.some((effect) => effect.startsWith('emit'))).toBe(false);
    }
  });

  it('shows why voice is unavailable and clears it at the next keystroke', () => {
    const blocked = run([{ type: 'voice.start' }, { type: 'voice.unavailable', message: 'The microphone is blocked.' }]);
    expect(blocked.state.voice).toBe('off');
    expect(blocked.state.notice).toBe('The microphone is blocked.');
    expect(run([{ type: 'input', text: 'W' }], idle, blocked.state).state.notice).toBeNull();
  });

  it('keeps the words when voice stops working mid-question', () => {
    const { state } = run([...listening, speak('Why is Lisbon'), { type: 'voice.unavailable', message: 'Voice stopped.' }]);
    expect(state.draft).toBe('Why is Lisbon');
    expect(state.notice).toBe('Voice stopped.');
  });

  it('never sends the demo transcript: it lands in the field, for the person to send or drop', () => {
    const { state, effects } = run([{ type: 'voice.start' }, { type: 'voice.listening', engine: 'demo' }, speak('Which nights are behind?'), { type: 'voice.done' }]);
    expect(state.voice).toBe('off');
    expect(state.draft).toBe('Which nights are behind?');
    expect(effects.some((effect) => effect.startsWith('emit'))).toBe(false);
  });

  it('labels the demo engine and ignores voice events once voice is off', () => {
    const demo = run([{ type: 'voice.start' }, { type: 'voice.listening', engine: 'demo' }]);
    expect(demo.state.engine).toBe('demo');
    const late = run([speak('late words'), { type: 'voice.done' }, { type: 'voice.stop' }, { type: 'voice.timeout' }, { type: 'voice.settled' }]);
    expect(late.state).toEqual(initialComposer());
    expect(late.effects).toEqual([]);
  });

  it('does not submit typed text while voice is on', () => {
    const { effects } = run([{ type: 'input', text: 'typed' }, ...listening, { type: 'submit' }]);
    expect(effects).toEqual(['voice.open']);
  });
});
