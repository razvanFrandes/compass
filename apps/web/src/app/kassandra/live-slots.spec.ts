import type { ChatLive } from '@compass/contracts';
import { SKELETON_MIN_MS, SkeletonHold, evidenceSlots, isDataTool, shownPhase, specFromArgs, stepCount, stepsWithLive, widgetSlots } from './live-slots';
import { evidence, step, turn, widget } from './testing';

type Tools = ChatLive['tools'];
const ARGS = { kind: 'line', title: 'Lisbon is 15.9% behind last year for December', subtitle: 'Arbor Lisbon Chiado · December 2026', sourceCallId: 'c1', x: 'stay_date', y: ['rooms', 'rooms_stly'] };
const call = (callId: string, name: string, status = 'running'): Tools[number] => ({ callId, name, status });
const phases = (slots: { callId: string; phase: string }[]) => slots.map((slot) => `${slot.callId}:${slot.phase}`);

describe('widgetSlots: live state → what the widget shows', () => {
  it('phase 1, chosen: a show_widget call that only live.tools knows about is a skeleton of the whole card', () => {
    const [slot] = widgetSlots(turn({ running: true }), [call('w1', 'show_widget', 'pending')]);
    expect(slot).toMatchObject({ callId: 'w1', phase: 'chosen', title: null, subtitle: null, widget: null });
    expect(slot!.spec.kind).toBe('bar'); // a neutral shape until the kind is known
    expect(phases(widgetSlots(turn({ running: true }), [call('w1', 'mcp__compass__show_widget', 'running')]))).toEqual(['w1:chosen']);
  });

  it('phase 1 also covers a committed call whose arguments do not say what to draw yet', () => {
    const steps = [step({ callId: 'w1', name: 'show_widget', status: 'pending', args: {} }), step({ callId: 'w2', name: 'show_widget', status: 'running', args: { kind: 'line' } })];
    expect(phases(widgetSlots(turn({ running: true, steps })))).toEqual(['w1:chosen', 'w2:chosen']);
  });

  it('phase 2, described: with the arguments known the title and subtitle are real and the spec sizes the skeleton', () => {
    const [slot] = widgetSlots(turn({ running: true, steps: [step({ callId: 'w1', name: 'show_widget', status: 'running', args: ARGS })] }), [call('w1', 'show_widget')]);
    expect(slot).toMatchObject({ phase: 'described', title: ARGS.title, subtitle: ARGS.subtitle, widget: null });
    expect(slot!.spec).toEqual({ kind: 'line', title: ARGS.title, subtitle: ARGS.subtitle, sourceCallId: 'c1', x: 'stay_date', y: ['rooms', 'rooms_stly'] });
  });

  it('phase 3, ready: the tool result with the widget swaps the chart in, keeping the same slot', () => {
    const w = widget({ kind: 'line', title: ARGS.title });
    const [slot] = widgetSlots(turn({ running: true, steps: [step({ callId: 'w1', name: 'show_widget', args: ARGS, widget: w })] }), [call('w1', 'show_widget', 'done')]);
    expect(slot).toMatchObject({ callId: 'w1', phase: 'ready', title: ARGS.title, widget: w });
    expect(slot!.spec).not.toHaveProperty('rows');
    expect(slot!.spec.kind).toBe('line');
  });

  it('walks one call through the three phases under the same id, so the card is never replaced', () => {
    const live = [call('w1', 'show_widget')];
    const first = widgetSlots(turn({ running: true }), live);
    const second = widgetSlots(turn({ running: true, steps: [step({ callId: 'w1', name: 'show_widget', status: 'running', args: ARGS })] }), live);
    const third = widgetSlots(turn({ running: true, steps: [step({ callId: 'w1', name: 'show_widget', args: ARGS, widget: widget() })] }), live);
    expect([first, second, third].map((slots) => phases(slots))).toEqual([['w1:chosen'], ['w1:described'], ['w1:ready']]);
  });

  it('keeps the order Kassandra asked in, committed calls before the ones only live.tools has', () => {
    const steps = [step({ callId: 'c1', rows: [{}], evidence: evidence() }), step({ callId: 'w1', name: 'show_widget', args: ARGS, widget: widget() }), step({ callId: 'w2', name: 'show_widget', status: 'running', args: ARGS })];
    expect(phases(widgetSlots(turn({ running: true, steps }), [call('w2', 'show_widget'), call('w3', 'show_widget', 'pending'), call('c9', 'get_pace')]))).toEqual(['w1:ready', 'w2:described', 'w3:chosen']);
  });

  it('leaves no skeleton behind: a failed or refused call, a stopped run and a finished live call show nothing', () => {
    const failed = step({ callId: 'w1', name: 'show_widget', status: 'error', args: ARGS, error: 'Unknown column.' });
    expect(widgetSlots(turn({ running: true, steps: [failed] }))).toEqual([]);
    expect(widgetSlots(turn({ running: true, steps: [step({ callId: 'w1', name: 'show_widget', status: 'done', args: ARGS })] }))).toEqual([]);
    expect(widgetSlots(turn({ running: false, steps: [step({ callId: 'w1', name: 'show_widget', status: 'pending', args: ARGS })] }), [call('w2', 'show_widget')])).toEqual([]);
    expect(widgetSlots(turn({ running: true }), [call('w1', 'show_widget', 'done')])).toEqual([]);
  });

  it('shows a finished widget of an old turn as it is, with no skeleton at any point', () => {
    expect(phases(widgetSlots(turn({ answer: 'See the chart.', steps: [step({ callId: 'w1', name: 'show_widget', widget: widget() })] })))).toEqual(['w1:ready']);
  });
});

describe('specFromArgs', () => {
  it('needs a known kind and a title, and keeps only what a spec holds', () => {
    expect(specFromArgs(undefined)).toBeNull();
    expect(specFromArgs({ kind: 'line' })).toBeNull();
    expect(specFromArgs({ kind: 'hologram', title: 'A title' })).toBeNull();
    expect(specFromArgs({ kind: 'kpi', title: '  Occupancy is 52.9%  ', y: ['occupancy', 7, ''], format: 'percent', rows: [{ occupancy: 99 }], compare: '' })).toEqual({ kind: 'kpi', title: 'Occupancy is 52.9%', sourceCallId: '', y: ['occupancy'], format: 'percent' });
    expect(specFromArgs({ kind: 'bar', title: 'By segment', format: 'emoji' })).toEqual({ kind: 'bar', title: 'By segment', sourceCallId: '' });
  });
});

describe('evidenceSlots: data tool calls → the evidence cards they are becoming', () => {
  it('goes from a bare call, to a titled row, to ready', () => {
    const running = turn({ running: true });
    expect(evidenceSlots(running, [call('c1', 'get_pace', 'pending')])).toEqual([{ callId: 'c1', phase: 'chosen', title: null, detail: '' }]);
    const described = turn({ running: true, steps: [step({ callId: 'c1', status: 'running', args: { hotels: ['LIS'], from: '2026-12-01', to: '2026-12-31' } })] });
    expect(evidenceSlots(described, [call('c1', 'get_pace')])).toEqual([{ callId: 'c1', phase: 'described', title: 'Pace vs last year', detail: 'LIS · 1 Dec · 31 Dec' }]);
    const ready = turn({ running: true, steps: [step({ callId: 'c1', rows: [{}], evidence: evidence() })] });
    expect(phases(evidenceSlots(ready, [call('c1', 'get_pace', 'done')]))).toEqual(['c1:ready']);
  });

  it('counts data tools only: charts, drafts and emails have no evidence card', () => {
    const steps = [step({ callId: 'w1', name: 'show_widget', status: 'running', args: ARGS }), step({ callId: 'd1', name: 'draft_workflow', status: 'running' })];
    expect(phases(evidenceSlots(turn({ running: true, steps }), [call('e1', 'send_email'), call('c2', 'mcp__compass__find_reviews'), call('c3', 'run_readonly_query')]))).toEqual(['c2:chosen', 'c3:chosen']);
    expect(['get_pace', 'list_hotels', 'find_reviews', 'search_reviews', 'run_readonly_query'].every(isDataTool)).toBe(true);
    expect(['show_widget', 'draft_workflow', 'send_email', 'set_trigger'].some(isDataTool)).toBe(false);
  });

  it('leaves failed calls and stopped runs to the steps list', () => {
    expect(evidenceSlots(turn({ running: true, steps: [step({ status: 'error', error: 'The data source failed to answer.' })] }))).toEqual([]);
    expect(evidenceSlots(turn({ running: false, steps: [step({ status: 'pending' })] }), [call('c2', 'get_pickup')])).toEqual([]);
  });

  it('counts a call from the moment it starts, so the steps line is there before its entry is committed', () => {
    expect(stepCount(turn({ running: true }), [call('c1', 'get_pace'), call('w1', 'show_widget', 'pending')])).toBe(2);
    expect(stepCount(turn({ running: true, steps: [step({ callId: 'c1', status: 'running' })] }), [call('c1', 'get_pace'), call('w1', 'show_widget')])).toBe(2);
    expect(stepCount(turn({ steps: [step()] }), [call('c9', 'get_pace')])).toBe(1);
  });

  it('hands the panel the live-only calls as steps, so its own waiting cards can start at once', () => {
    const base = turn({ running: true, steps: [step({ callId: 'c1', rows: [{}], evidence: evidence() })] });
    expect(stepsWithLive(base, [call('c1', 'get_pace', 'done')])).toBe(base.steps);
    expect(stepsWithLive(base, [call('c2', 'get_pickup', 'pending'), call('w1', 'show_widget')]).map((s) => [s.callId, s.name, s.status])).toEqual([
      ['c1', 'get_pace', 'done'],
      ['c2', 'get_pickup', 'pending'],
    ]);
  });
});

describe('the minimum time a skeleton stays', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps a skeleton that has appeared for 300 ms, then lets go on its own', () => {
    const hold = new SkeletonHold();
    expect(SKELETON_MIN_MS).toBe(300);
    hold.show(['w1']);
    expect([...hold.held()]).toEqual(['w1']);
    vi.advanceTimersByTime(299);
    expect(shownPhase('ready', hold.held().has('w1'))).toBe('described'); // the chart is there, the skeleton still shows
    vi.advanceTimersByTime(1);
    expect(shownPhase('ready', hold.held().has('w1'))).toBe('ready');
  });

  it('does not start the clock again for a skeleton it has already seen', () => {
    const hold = new SkeletonHold();
    hold.show(['w1']);
    vi.advanceTimersByTime(200);
    hold.show(['w1', 'w2']);
    vi.advanceTimersByTime(100);
    expect([...hold.held()]).toEqual(['w2']);
    vi.advanceTimersByTime(200);
    expect(hold.held().size).toBe(0);
  });

  it('never holds what was not shown as a skeleton, and only delays the last phase', () => {
    expect(new SkeletonHold().held().size).toBe(0);
    expect(shownPhase('ready', false)).toBe('ready');
    expect(shownPhase('chosen', true)).toBe('chosen');
    expect(shownPhase('described', true)).toBe('described');
  });
});
