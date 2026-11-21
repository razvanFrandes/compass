import type { ChatLive } from '@compass/contracts';
import { MAX_CHARTS, SKELETON_MIN_MS, SkeletonHold, evidenceSlots, isDataTool, liveCalls, shownPhase, specFromArgs, stepCount, stepsWithLive, widgetSlots } from './live-slots';
import { evidence, paceEvidence, paceRows, step, turn, widget } from './testing';

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

describe('widgetSlots with previews: a chart from the moment the data is asked for', () => {
  const ON = { previews: true };
  /** A finished get_pace call: one row per hotel. */
  const pace = (callId = 'c1', patch = {}) => step({ callId, name: 'get_pace', args: { hotels: ['LIS', 'AMS', 'PAR'], daysAhead: 30 }, rows: paceRows, evidence: paceEvidence(), ...patch });
  const HER = { kind: 'bar' as const, title: 'Lisbon is 17.4% behind last year; Paris is ahead', subtitle: 'Lisbon, Amsterdam, Paris · next 30 nights', sourceCallId: 'c1', x: 'hotel_code', y: ['pace_pct'] };
  const shown = (slots: ReturnType<typeof widgetSlots>) => slots.map((slot) => `${slot.callId}:${slot.phase}:${slot.preview ? 'preview' : 'final'}:${slot.widget?.kind ?? '-'}`);

  it('(a) a data call that has just started is a neutral skeleton, before its entry or its arguments exist', () => {
    const [slot] = widgetSlots(turn({ running: true }), [call('c1', 'get_pace', 'pending')], ON);
    expect(slot).toMatchObject({ callId: 'c1', phase: 'chosen', preview: true, title: null, subtitle: null, widget: null });
    expect(slot!.spec).toEqual({ kind: 'bar', title: '', sourceCallId: '' });
    expect(shown(widgetSlots(turn({ running: true }), [call('c1', 'mcp__compass__get_metric', 'running')], ON))).toEqual(['c1:chosen:preview:-']);
  });

  it('(a) with its arguments known, the tool’s own title stands over the skeleton', () => {
    const running = step({ callId: 'c1', name: 'get_pace', status: 'running', args: { hotels: ['LIS'], from: '2026-12-01', to: '2026-12-31' } });
    const [slot] = widgetSlots(turn({ running: true, steps: [running] }), [call('c1', 'get_pace')], ON);
    expect(slot).toMatchObject({ callId: 'c1', phase: 'described', preview: true, title: 'Pace vs last year', subtitle: 'Lisbon Chiado · 1 Dec · 31 Dec', widget: null });
  });

  it('(b) the moment the rows are in, the slot is a preview chart: the kind a first look suggests, the tool’s rows untouched', () => {
    const [slot] = widgetSlots(turn({ running: true, steps: [pace()] }), [call('c1', 'get_pace', 'done')], ON);
    expect(slot).toMatchObject({ callId: 'c1', phase: 'ready', preview: true, title: 'Pace vs last year', subtitle: 'Lisbon Chiado, Amsterdam Centraal, Paris Opera · 21 Nov – 20 Dec' });
    expect(slot!.spec).toEqual({ kind: 'bar', title: 'Pace vs last year', subtitle: 'Lisbon Chiado, Amsterdam Centraal, Paris Opera · 21 Nov – 20 Dec', sourceCallId: 'c1', x: 'hotel_code', y: ['rooms_otb'], compare: 'rooms_otb_stly', format: 'count' });
    expect(slot!.widget!.rows).toBe(paceRows); // the same rows, by reference: nothing is computed on the way
    expect(slot!.widget!.evidence.sources).toEqual(['hotel.pace_vs_stly()']);
  });

  it('(c) Kassandra’s widget for that result takes the preview’s slot: her kind and title, the same card', () => {
    const hers = widget({ ...HER, kind: 'bullet', compare: 'rooms_otb_stly', y: ['rooms_otb'], rows: paceRows, columns: paceEvidence().columns! });
    const steps = [pace(), step({ callId: 'w1', name: 'show_widget', args: HER, widget: hers })];
    const [slot, ...rest] = widgetSlots(turn({ running: true, steps }), [call('w1', 'show_widget', 'done')], ON);
    expect(rest).toEqual([]);
    expect(slot).toMatchObject({ callId: 'c1', phase: 'ready', preview: false, title: HER.title, subtitle: HER.subtitle, widget: hers });
    expect(slot!.spec.kind).toBe('bullet');
  });

  it('(c) when she picks the kind the preview already has, only the words change', () => {
    const before = widgetSlots(turn({ running: true, steps: [pace()] }), [], ON)[0]!;
    const hers = widget({ ...HER, y: ['rooms_otb'], compare: 'rooms_otb_stly', format: 'count', rows: paceRows, columns: paceEvidence().columns! });
    const after = widgetSlots(turn({ running: true, steps: [pace(), step({ callId: 'w1', name: 'show_widget', args: HER, widget: hers })] }), [], ON)[0]!;
    const { title: _t1, subtitle: _s1, ...drawnBefore } = before.spec;
    const { title: _t2, subtitle: _s2, ...drawnAfter } = after.spec;
    expect(drawnAfter).toEqual(drawnBefore);
    expect([before.title, after.title]).toEqual(['Pace vs last year', HER.title]);
    expect(after.callId).toBe(before.callId);
  });

  it('walks one result from skeleton to preview to her chart under one id, with no second card on the way', () => {
    const live = [call('c1', 'get_pace')];
    const drafting = { callId: 'w1', name: 'show_widget', status: 'pending', args: { kind: 'bar', title: 'Lisbon is 17.4% beh' } };
    const committed = step({ callId: 'w1', name: 'show_widget', status: 'running', args: HER });
    const hers = widget({ ...HER, format: 'percent', rows: paceRows, columns: paceEvidence().columns! });
    const stages = [
      widgetSlots(turn({ running: true }), live, ON),
      widgetSlots(turn({ running: true, steps: [step({ callId: 'c1', name: 'get_pace', status: 'running', args: { hotels: ['LIS'] } })] }), live, ON),
      widgetSlots(turn({ running: true, steps: [pace()] }), [], ON),
      // She starts show_widget: nothing says which result yet, and the preview is the only candidate.
      widgetSlots(turn({ running: true, steps: [pace()] }), [call('w1', 'show_widget', 'pending')], ON),
      // Her arguments stream: the title shows as it is written, the chart stays the preview's.
      widgetSlots(turn({ running: true, steps: [pace()] }), [drafting], ON),
      // The call is committed: her kind and columns pass the server's check, so they are drawn already.
      widgetSlots(turn({ running: true, steps: [pace(), committed] }), [call('w1', 'show_widget')], ON),
      widgetSlots(turn({ running: true, steps: [pace(), { ...committed, status: 'done', widget: hers }] }), [], ON),
      widgetSlots(turn({ answer: 'Lisbon is behind.', steps: [pace(), { ...committed, status: 'done', widget: hers }] }), null, ON),
    ];
    expect(stages.map(shown)).toEqual([
      ['c1:chosen:preview:-'],
      ['c1:described:preview:-'],
      ['c1:ready:preview:bar'],
      ['c1:ready:preview:bar'],
      ['c1:ready:preview:bar'],
      ['c1:ready:preview:bar'],
      ['c1:ready:final:bar'],
      ['c1:ready:final:bar'],
    ]);
    expect(stages.map(([slot]) => slot!.title)).toEqual([null, 'Pace vs last year', 'Pace vs last year', 'Pace vs last year', 'Lisbon is 17.4% beh', HER.title, HER.title, HER.title]);
    // Before the server confirms, the chart is already hers: pace in percent, not the preview's room nights.
    expect(stages.map(([slot]) => slot!.widget?.y?.[0])).toEqual([undefined, undefined, 'rooms_otb', 'rooms_otb', 'rooms_otb', 'pace_pct', 'pace_pct', 'pace_pct']);
  });

  it('keeps the preview as a normal chart once the answer is final and she drew nothing', () => {
    const done = turn({ answer: 'Lisbon is 17.4% behind.', steps: [pace()] });
    expect(shown(widgetSlots(done, null, ON))).toEqual(['c1:ready:final:bar']);
    expect(shown(widgetSlots(turn({ running: true, steps: [pace()] }), [], ON))).toEqual(['c1:ready:preview:bar']);
  });

  it('keeps the preview when the server refuses her chart, and when her arguments would not fit', () => {
    const refused = step({ callId: 'w1', name: 'show_widget', status: 'error', args: { ...HER, kind: 'donut' }, error: 'donut is only for 2–7 parts of one whole.' });
    expect(shown(widgetSlots(turn({ running: true, steps: [pace(), refused] }), [], ON))).toEqual(['c1:ready:preview:bar']);
    const unfit = step({ callId: 'w2', name: 'show_widget', status: 'running', args: { ...HER, kind: 'line' } });
    const [slot] = widgetSlots(turn({ running: true, steps: [pace(), unfit] }), [call('w2', 'show_widget')], ON);
    expect(slot).toMatchObject({ callId: 'c1', preview: true, title: HER.title });
    expect(slot!.spec.kind).toBe('bar');
  });

  it('skips reference tools at every stage: the hotel list, definitions, feed status, the brief, guest quotes', () => {
    const lookups = ['list_hotels', 'list_metrics', 'get_schema', 'get_data_health', 'get_brief', 'find_reviews', 'search_reviews'];
    expect(widgetSlots(turn({ running: true }), lookups.map((name, i) => call(`c${i}`, name)), ON)).toEqual([]);
    const hotels = step({ callId: 'c1', name: 'list_hotels', args: {}, rows: [{ hotel_code: 'LIS', name: 'Arbor Lisbon Chiado', rooms: 150 }, { hotel_code: 'AMS', name: 'Arbor Amsterdam Centraal', rooms: 210 }], evidence: evidence({ title: 'Hotels of the group' }) });
    expect(widgetSlots(turn({ running: true, steps: [hotels] }), [], ON)).toEqual([]);
    expect(widgetSlots(turn({ answer: 'There are 20 hotels.', steps: [hotels] }), null, ON)).toEqual([]);
  });

  it('lets go of a skeleton whose rows turn out to be a table, empty, or an error', () => {
    const waiting = widgetSlots(turn({ running: true }), [call('c1', 'run_readonly_query')], ON);
    expect(shown(waiting)).toEqual(['c1:chosen:preview:-']);
    const prose = step({ callId: 'c1', name: 'run_readonly_query', rows: [{ note: 'Rates were loaded late on Tuesday.' }, { note: 'The comp set changed in October.' }], evidence: evidence() });
    expect(widgetSlots(turn({ running: true, steps: [prose] }), [], ON)).toEqual([]);
    expect(widgetSlots(turn({ running: true, steps: [pace('c1', { rows: [] })] }), [], ON)).toEqual([]);
    expect(widgetSlots(turn({ running: true, steps: [step({ callId: 'c1', status: 'error', error: 'The data source failed to answer.' })] }), [], ON)).toEqual([]);
  });

  it(`never shows more than ${MAX_CHARTS} charts in an answer: previews fill what her own charts leave`, () => {
    expect(MAX_CHARTS).toBe(3);
    // Five different readings (five metrics), not one reading five times.
    const five = ['c1', 'c2', 'c3', 'c4', 'c5'].map((id) => pace(id, { name: 'get_metric', args: { metric: `m_${id}` }, rows: [...paceRows] }));
    expect(shown(widgetSlots(turn({ running: true, steps: five }), [], ON))).toEqual(['c1:ready:preview:bar', 'c2:ready:preview:bar', 'c3:ready:preview:bar']);
    expect(shown(widgetSlots(turn({ running: true }), ['get_pace', 'get_metric', 'get_mix', 'get_pnl'].map((name, i) => call(`c${i}`, name)), ON))).toHaveLength(3);
    // Her chart of the fifth result comes in: it shows, and the last preview makes room.
    const hers = widget({ ...HER, sourceCallId: 'c5', rows: paceRows, columns: paceEvidence().columns! });
    const withHers = [...five, step({ callId: 'w1', name: 'show_widget', args: { ...HER, sourceCallId: 'c5' }, widget: hers })];
    expect(shown(widgetSlots(turn({ answer: 'Done.', steps: withHers }), null, ON))).toEqual(['c1:ready:final:bar', 'c2:ready:final:bar', 'c5:ready:final:bar']);
    // What she asked for is never dropped (a board view may show 4).
    const four = ['c1', 'c2', 'c3', 'c4'].flatMap((id, i) => [pace(id, { name: 'get_metric', args: { metric: `m_${id}` }, rows: [...paceRows] }), step({ callId: `w${i}`, name: 'show_widget', widget: widget({ ...HER, sourceCallId: id, rows: paceRows }) })]);
    expect(widgetSlots(turn({ answer: 'Done.', steps: four }), null, ON)).toHaveLength(4);
  });

  it('gives her chart its own card when the result had no preview, and when it is her second chart of one result', () => {
    const hotels = step({ callId: 'c0', name: 'list_hotels', args: {}, rows: [{ hotel_code: 'LIS', rooms: 150 }, { hotel_code: 'AMS', rooms: 210 }], evidence: evidence() });
    const ofLookup = step({ callId: 'w0', name: 'show_widget', widget: widget({ sourceCallId: 'c0' }) });
    expect(shown(widgetSlots(turn({ answer: 'Done.', steps: [hotels, ofLookup] }), null, ON))).toEqual(['w0:ready:final:bar']);
    const first = step({ callId: 'w1', name: 'show_widget', widget: widget({ ...HER, rows: paceRows }) });
    const second = step({ callId: 'w2', name: 'show_widget', widget: widget({ ...HER, kind: 'table', rows: paceRows }) });
    expect(shown(widgetSlots(turn({ answer: 'Done.', steps: [pace(), first, second] }), null, ON))).toEqual(['c1:ready:final:bar', 'w2:ready:final:table']);
  });

  it('redraws a preview in place when she reads the same thing again narrower, and her chart of the new rows takes that card', () => {
    const all = pace('c1', { args: { daysAhead: 30 } });
    const narrow = paceRows.slice(0, 2);
    const again = (patch = {}) => pace('c2', { args: { hotels: ['LIS', 'AMS'], daysAhead: 30 }, rows: narrow, ...patch });
    // The second call is announced, then running: the first chart stays, and no second skeleton opens.
    expect(shown(widgetSlots(turn({ running: true, steps: [all] }), [call('c2', 'get_pace', 'pending')], ON))).toEqual(['c1:ready:preview:bar']);
    const loading = widgetSlots(turn({ running: true, steps: [all, again({ rows: undefined, evidence: undefined, status: 'running' })] }), [call('c2', 'get_pace')], ON);
    expect(shown(loading)).toEqual(['c1:ready:preview:bar']);
    expect(loading[0]!.widget!.rows).toBe(paceRows);
    // Its rows land: the same card, the new rows.
    const redrawn = widgetSlots(turn({ running: true, steps: [all, again()] }), [], ON);
    expect(shown(redrawn)).toEqual(['c1:ready:preview:bar']);
    expect(redrawn[0]!.widget).toMatchObject({ sourceCallId: 'c2', rows: narrow, subtitle: 'Lisbon Chiado, Amsterdam Centraal · 21 Nov – 20 Dec' });
    // Her chart names the second result, and takes the card the first one opened.
    const hers = widget({ ...HER, sourceCallId: 'c2', rows: narrow, columns: paceEvidence().columns! });
    const done = widgetSlots(turn({ answer: 'Lisbon is behind.', steps: [all, again(), step({ callId: 'w1', name: 'show_widget', widget: hers })] }), null, ON);
    expect(shown(done)).toEqual(['c1:ready:final:bar']);
    expect(done[0]!.widget).toBe(hers);
    // A re-read that fails, or has nothing to draw, leaves the first chart alone.
    expect(shown(widgetSlots(turn({ running: true, steps: [all, again({ rows: undefined, evidence: undefined, status: 'error', error: 'The data source failed to answer.' })] }), [], ON))).toEqual(['c1:ready:preview:bar']);
  });

  it('keeps two readings of one tool apart: another metric, another roll-up', () => {
    const occupancy = pace('c1', { name: 'get_metric', args: { metric: 'occupancy', hotels: ['LIS'] } });
    const adr = pace('c2', { name: 'get_metric', args: { metric: 'adr', hotels: ['LIS'] }, rows: [...paceRows] });
    expect(shown(widgetSlots(turn({ running: true, steps: [occupancy, adr] }), [], ON))).toEqual(['c1:ready:preview:bar', 'c2:ready:preview:bar']);
    // While the second call has no arguments yet it could be a re-read, so it opens no skeleton; with them it does.
    expect(shown(widgetSlots(turn({ running: true, steps: [occupancy] }), [call('c2', 'get_metric', 'pending')], ON))).toEqual(['c1:ready:preview:bar']);
    const loading = step({ callId: 'c2', name: 'get_metric', status: 'running', args: { metric: 'adr', hotels: ['LIS'] } });
    expect(shown(widgetSlots(turn({ running: true, steps: [occupancy, loading] }), [call('c2', 'get_metric')], ON))).toEqual(['c1:ready:preview:bar', 'c2:described:preview:-']);
  });

  it('opens her own skeleton only when no preview is waiting for her', () => {
    expect(shown(widgetSlots(turn({ running: true }), [call('w1', 'show_widget', 'pending')], ON))).toEqual(['w1:chosen:final:-']);
    const two = [pace('c1'), pace('c2', { name: 'get_metric', args: { metric: 'occupancy' }, rows: [...paceRows], evidence: paceEvidence() })];
    expect(shown(widgetSlots(turn({ running: true, steps: two }), [call('w1', 'show_widget', 'pending')], ON))).toEqual(['c1:ready:preview:bar', 'c2:ready:preview:bar']);
    // With two previews, a title that names no result yet is not put on either.
    const drafting = { callId: 'w1', name: 'show_widget', status: 'pending', args: { kind: 'bar', title: 'Paris leads' } };
    expect(widgetSlots(turn({ running: true, steps: two }), [drafting], ON).map((slot) => slot.title)).toEqual(['Pace vs last year', 'Pace vs last year']);
    const named = { ...drafting, args: { ...drafting.args, sourceCallId: 'c2' } };
    expect(widgetSlots(turn({ running: true, steps: two }), [named], ON).map((slot) => slot.title)).toEqual(['Pace vs last year', 'Paris leads']);
  });

  it('drops previews when the run stopped without an answer, and keeps what she showed', () => {
    const hers = step({ callId: 'w1', name: 'show_widget', widget: widget({ ...HER, sourceCallId: 'c2', rows: paceRows }) });
    const stopped = turn({ running: false, failure: { reason: 'aborted' }, steps: [pace('c1'), pace('c2', { name: 'get_metric', args: { metric: 'occupancy' }, rows: [...paceRows] }), hers, step({ callId: 'c3', name: 'get_pickup', status: 'pending' })] });
    expect(shown(widgetSlots(stopped, [call('c3', 'get_pickup')], ON))).toEqual(['w1:ready:final:bar']);
  });

  it('draws nothing from data calls unless previews are asked for: a workflow’s log shows only her charts', () => {
    expect(widgetSlots(turn({ running: true, steps: [pace()] }), [call('c2', 'get_pickup')])).toEqual([]);
    expect(widgetSlots(turn({ answer: 'Done.', steps: [pace()] }))).toEqual([]);
  });

  it('hands the chart the same spec and widget objects for the same transcript, so a live update redraws nothing', () => {
    const steps = [pace(), step({ callId: 'w1', name: 'show_widget', widget: widget({ ...HER, sourceCallId: 'c9' }) })];
    const first = widgetSlots(turn({ running: true, steps }), [], ON);
    const again = widgetSlots(turn({ running: true, steps: steps.map((s) => ({ ...s })), streamingText: 'Lisbon is' }), [], ON);
    expect(again.map((slot) => slot.spec)).toEqual(first.map((slot) => slot.spec));
    again.forEach((slot, i) => {
      expect(slot.spec).toBe(first[i]!.spec);
      expect(slot.widget).toBe(first[i]!.widget);
    });
  });
});

describe('liveCalls: the calls in flight, the ones still being written included', () => {
  it('adds each drafted call as pending, with the arguments streamed so far', () => {
    const tools: Tools = [call('c1', 'get_pace', 'done')];
    const drafting = [{ callId: 'w1', name: 'show_widget', args: { kind: 'bar', title: 'Lisbon is' } }];
    expect(liveCalls({ tools, drafting })).toEqual([{ callId: 'c1', name: 'get_pace', status: 'done' }, { callId: 'w1', name: 'show_widget', status: 'pending', args: { kind: 'bar', title: 'Lisbon is' } }]);
  });

  it('keeps the real status of a call that has started, and is empty with no live state', () => {
    const tools: Tools = [call('w1', 'show_widget', 'running')];
    expect(liveCalls({ tools, drafting: [{ callId: 'w1', name: 'show_widget', args: {} }] })).toEqual(tools);
    expect(liveCalls(null)).toEqual([]);
    expect(liveCalls({ tools: [] })).toEqual([]);
  });

  it('starts a data call’s skeleton while the model is still writing the call', () => {
    const drafted = liveCalls({ tools: [], drafting: [{ callId: 'c1', name: 'get_pace', args: {} }] });
    expect(widgetSlots(turn({ running: true }), drafted, { previews: true })).toMatchObject([{ callId: 'c1', phase: 'chosen', preview: true }]);
    expect(stepCount(turn({ running: true }), drafted)).toBe(1);
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
    expect(evidenceSlots(described, [call('c1', 'get_pace')])).toEqual([{ callId: 'c1', phase: 'described', title: 'Pace vs last year', detail: 'Lisbon Chiado · 1 Dec · 31 Dec' }]);
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
