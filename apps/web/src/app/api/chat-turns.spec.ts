import { specToGraph, type Evidence } from '@compass/contracts';
import { groupTurns } from './chat-turns';
import { answer, live, result, steps, user } from './testing';

const evidence: Evidence = {
  sources: ['hotel.v_pace'],
  definitions: { pace: 'On the books vs same time last year' },
  period: { from: '2026-11-20', to: '2027-01-03' },
  sql: 'select 1',
  params: [],
  rowCount: 1,
  businessDate: '2026-11-20',
  notes: [],
};

describe('groupTurns', () => {
  it('groups a question, its steps with matched results, and the answer', () => {
    const turns = groupTurns([
      user(1, 'Why is Lisbon pacing behind?', 1000),
      steps(2, [{ callId: 'a', name: 'get_pace' }, { callId: 'b', name: 'get_pickup' }], 'Checking pace and pickup.', 2000),
      result(3, 'a', { rows: [{ hotel: 'LIS', pace: -12 }], evidence }, 3000),
      result(4, 'b', { name: 'get_pickup', isError: true, error: 'The data source failed to answer.' }, 4000),
      answer(5, '**Lisbon** is 12% behind.', 5000),
    ]);

    expect(turns).toHaveLength(1);
    const [turn] = turns;
    expect(turn).toMatchObject({ key: '1', question: 'Why is Lisbon pacing behind?', answer: '**Lisbon** is 12% behind.', running: false, pending: false });
    expect(turn!.steps).toEqual([
      { callId: 'a', name: 'get_pace', args: { hotels: ['LIS'] }, status: 'done', narration: 'Checking pace and pickup.', rows: [{ hotel: 'LIS', pace: -12 }], evidence },
      { callId: 'b', name: 'get_pickup', args: { hotels: ['LIS'] }, status: 'error', narration: '', error: 'The data source failed to answer.' },
    ]);
    expect(turn!.workedMs).toBe(4000);
    expect(turn!.model).toBe('claude-sonnet');
    expect(turn!.usage.tokens).toBe(150);
    expect(turn!.usage.costUsd).toBeCloseTo(0.03);
  });

  it('does not show the narration of a tool-calling turn as the answer', () => {
    const [turn] = groupTurns([user(1, 'q'), steps(2, [{ callId: 'a', name: 'get_pace' }], 'Let me look.')]);
    expect(turn!.answer).toBeNull();
    expect(turn!.steps[0]!.narration).toBe('Let me look.');
  });

  it('takes what was written beside the chart as the answer when nothing follows it', () => {
    // Asked to answer visually, a model often writes its sentences in the message that calls show_widget, then stops.
    const [turn] = groupTurns([
      user(1, 'How is Lisbon pacing?'),
      steps(2, [{ callId: 'a', name: 'get_pace' }], 'Let me look.'),
      result(3, 'a'),
      steps(4, [{ callId: 'w', name: 'show_widget' }], 'Lisbon is 15.9% behind last year.'),
      result(5, 'w', { name: 'show_widget' }),
      answer(6, ''),
    ]);
    expect(turn!.answer).toBe('Lisbon is 15.9% behind last year.');
    // It is said once: not again as the narration of the chart's step.
    expect(turn!.steps.map((step) => step.narration)).toEqual(['Let me look.', '']);
  });

  it('keeps it as narration when an answer follows, while the run goes on, and beside a data tool', () => {
    const followed = groupTurns([user(1, 'Q'), steps(2, [{ callId: 'w', name: 'show_widget' }], 'Drawing it.'), result(3, 'w', { name: 'show_widget' }), answer(4, 'Lisbon is behind.')]);
    expect(followed[0]!.answer).toBe('Lisbon is behind.');
    expect(followed[0]!.steps[0]!.narration).toBe('Drawing it.');

    const running = groupTurns([user(1, 'Q'), steps(2, [{ callId: 'w', name: 'show_widget' }], 'Lisbon is behind.'), result(3, 'w', { name: 'show_widget' })]);
    expect(running[0]!.answer).toBeNull();

    const data = groupTurns([user(1, 'Q'), steps(2, [{ callId: 'a', name: 'get_pace' }], 'Let me look.'), result(3, 'a'), answer(4, '')]);
    expect(data[0]!.answer).toBeNull();
    expect(data[0]!.steps[0]!.narration).toBe('Let me look.');
  });

  it('starts a new turn at every question', () => {
    const turns = groupTurns([user(1, 'first'), answer(2, 'one'), user(3, 'second'), answer(4, 'two')]);
    expect(turns.map((turn) => [turn.question, turn.answer])).toEqual([['first', 'one'], ['second', 'two']]);
  });

  it('puts the live state on the last turn only', () => {
    const entries = [user(1, 'first'), answer(2, 'one'), user(3, 'second'), steps(4, [{ callId: 'a', name: 'get_pace' }, { callId: 'b', name: 'get_mix' }]), result(5, 'a')];
    const turns = groupTurns(entries, live({ running: true, streamingText: 'Lisbon is', tools: [{ callId: 'a', name: 'get_pace', status: 'done' }, { callId: 'b', name: 'get_mix', status: 'running' }] }));

    expect(turns[0]).toMatchObject({ running: false, streamingText: '' });
    expect(turns[1]).toMatchObject({ running: true, streamingText: 'Lisbon is', answer: null });
    expect(turns[1]!.steps.map((step) => step.status)).toEqual(['done', 'running']);
  });

  it('shows the failure of a run that ended without an answer, and no stale streaming text', () => {
    const [turn] = groupTurns([user(1, 'q')], live({ streamingText: 'left over', failure: { reason: 'aborted' } }));
    expect(turn).toMatchObject({ running: false, streamingText: '', failure: { reason: 'aborted' }, answer: null });
  });

  it('adds questions that are not committed yet as pending turns', () => {
    const turns = groupTurns([user(1, 'first'), answer(2, 'one')], live({ running: true, streamingText: 'Th' }), [{ id: 'q-1', text: 'second' }]);
    expect(turns).toHaveLength(2);
    expect(turns[0]).toMatchObject({ running: false, answer: 'one' });
    // The earlier turn is answered, so the run that started is for the pending question.
    expect(turns[1]).toMatchObject({ key: 'pending:q-1', question: 'second', pending: true, running: true, streamingText: 'Th' });
  });

  it('keeps the live state on the running turn when a follow-up is queued behind it', () => {
    const turns = groupTurns([user(1, 'first')], live({ running: true, streamingText: 'Wor' }), [{ id: 'q-2', text: 'follow-up' }]);
    expect(turns[0]).toMatchObject({ running: true, streamingText: 'Wor' });
    expect(turns[1]).toMatchObject({ pending: true, running: false, streamingText: '' });
  });

  it('keeps entries that come before the first question in view', () => {
    const turns = groupTurns([result(7, 'gone', { rows: [{ n: 1 }] }), answer(8, 'tail of an older turn'), user(9, 'next')]);
    expect(turns[0]).toMatchObject({ key: 'head', question: null, answer: 'tail of an older turn', workedMs: null });
    expect(turns[0]!.steps).toEqual([{ callId: 'gone', name: 'get_pace', args: {}, status: 'done', narration: '', rows: [{ n: 1 }] }]);
    expect(turns[1]!.question).toBe('next');
  });

  it('collects events and drafted workflows', () => {
    const draft = { name: 'Watch Lisbon pace' } as never;
    const [turn] = groupTurns([
      user(1, 'draft it'),
      { id: 2, kind: 'event', type: 'app.approval', data: { approved: true }, at: 2000 },
      steps(3, [{ callId: 'd', name: 'draft_workflow' }]),
      result(4, 'd', { name: 'draft_workflow', draft, sent: false }),
    ]);
    expect(turn!.events.map((event) => event.type)).toEqual(['app.approval']);
    expect(turn!.steps[0]).toMatchObject({ draft, sent: false, status: 'done' });
  });

  it('returns nothing for an empty transcript', () => {
    expect(groupTurns([], live())).toEqual([]);
  });
});

describe('@compass/contracts', () => {
  it('is importable at runtime, not only for types', () => {
    expect(specToGraph({}).nodes.map((node) => node.id)).toEqual(['trigger', 'scope', 'check', 'analyze', 'action']);
  });
});
