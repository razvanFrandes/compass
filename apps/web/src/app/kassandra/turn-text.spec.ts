import { step, turn, widget } from './testing';
import { followUps, modeOf, phaseText, stepDetail, stepStatus, stepTitle } from './turn-text';

describe('step text', () => {
  it('names a tool in a hotelier’s words, never by its function name', () => {
    expect(stepTitle(step({ name: 'get_pace' }))).toBe('Pace vs last year');
    expect(stepTitle(step({ name: 'mcp__compass__get_rate_position' }))).toBe('Rate vs the comp set');
    expect(stepTitle(step({ name: 'get_something_new' }))).toBe('Something new');
  });

  it('prefers the title the server sends with the evidence', () => {
    const evidence = { ...widget().evidence, title: 'Pace vs last year, Lisbon' };
    expect(stepTitle(step({ evidence }))).toBe('Pace vs last year, Lisbon');
  });

  it('shows the arguments worth reading, with dates in words and no ids or objects', () => {
    expect(stepDetail(step({ args: { hotels: ['LIS', 'DXB2'], from: '2026-12-01', to: '2026-12-31', sourceCallId: 'call_9', filter: { a: 1 }, empty: '' } }))).toBe('LIS, DXB2 · 1 Dec · 31 Dec');
    expect(stepDetail(step({ name: 'show_widget', args: { kind: 'bar', title: 'x' } }))).toBe('');
  });

  it('says how a step ended', () => {
    expect(stepStatus(step({ rows: [{}, {}] }))).toBe('2 rows');
    expect(stepStatus(step({ rows: [{}] }))).toBe('1 row');
    expect(stepStatus(step({ status: 'error' }))).toBe('failed');
    expect(stepStatus(step({ status: 'running' }))).toBe('working');
    expect(stepStatus(step({ name: 'send_email', sent: false }))).toBe('nothing sent');
    expect(stepStatus(step({ name: 'show_widget', widget: widget() }))).toBe('');
  });

  it('reads the mode from the model that answered', () => {
    expect(modeOf('anthropic/claude-haiku-5-5')).toBe('Quick');
    expect(modeOf('claude-sonnet-5-5')).toBe('Thinker');
  });
});

describe('phaseText', () => {
  const running = turn({ running: true });

  it('says what Kassandra is doing while no answer text has arrived', () => {
    expect(phaseText(running, 'waiting')).toBe('Thinking…');
    expect(phaseText(running, 'thinking')).toBe('Thinking…');
    expect(phaseText(running, 'tools')).toBe('Checking the data…');
    expect(phaseText(running, 'writing')).toBe('Writing…');
  });

  it('falls back to the steps before the server sends a phase', () => {
    expect(phaseText(running, null)).toBe('Thinking…');
    expect(phaseText(turn({ running: true, steps: [step({ status: 'running' })] }), undefined)).toBe('Checking the data…');
  });

  it('says writing while the answer streams, and nothing once the turn is over', () => {
    expect(phaseText(turn({ running: true, streamingText: 'Lisbon is' }), 'thinking')).toBe('Writing…');
    expect(phaseText(turn({ answer: 'Done.' }), 'idle')).toBeNull();
    expect(phaseText(turn(), 'thinking')).toBeNull();
  });
});

describe('followUps', () => {
  const rows = [{ a: 1 }, { a: 2 }];

  it('offers nothing while the answer is not there', () => {
    expect(followUps(turn({ running: true, steps: [step({ rows })] }))).toEqual([]);
    expect(followUps(turn({ pending: true, answer: 'x' }))).toEqual([]);
    expect(followUps(turn({ steps: [step({ rows })] }))).toEqual([]);
  });

  it('offers another cut of the data that was read, a chart, and a workflow that keeps watching', () => {
    expect(followUps(turn({ answer: 'Lisbon is behind.', steps: [step({ rows })] }))).toEqual(['Which segments are behind last year?', 'Show this as a chart', 'Watch this and email me when it changes']);
  });

  it('does not offer a chart when the answer already has one, and never more than three', () => {
    const steps = [step({ rows }), step({ callId: 'c2', name: 'get_pickup', rows }), step({ callId: 'c3', name: 'get_pnl', rows }), step({ callId: 'c4', name: 'show_widget', widget: widget() })];
    const next = followUps(turn({ answer: 'Here it is.', steps }));
    expect(next).toEqual(['Which segments are behind last year?', 'Which nights picked up most in the last 7 days?', 'Watch this and email me when it changes']);
  });

  it('puts what the question was about before the freshness check Kassandra runs first', () => {
    const steps = [step({ name: 'get_data_health', rows }), step({ callId: 'c2', name: 'get_metric', rows: [{ a: 1 }] })];
    expect(followUps(turn({ answer: 'Occupancy is 52.9%.', steps }))[0]).toBe('Which hotels drive that?');
  });

  it('offers nothing after an answer that read no data', () => {
    expect(followUps(turn({ answer: 'Hello.' }))).toEqual([]);
  });
});
