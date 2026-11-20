import type { AuditEntry, Proposal, Workflow, WorkflowRun } from '@compass/contracts';
import { firstSentences, formatWhen, isRaise, latestFinding, nextCron, nextRunAt, nextRunText, runOutcome, runStrip, stripSummary, studioStatus } from './studio';

const run = (over: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id: 'run-1',
  workflowId: 'wf-1',
  sessionId: '1',
  trigger: 'schedule',
  status: 'done',
  startedAt: '2026-11-20T05:00:10.000Z',
  endedAt: '2026-11-20T05:00:30.000Z',
  summary: 'Nothing to flag today.',
  ...over,
});
const proposal = (over: Partial<Proposal> = {}): Proposal => ({
  id: 'prop-1',
  workflowId: 'wf-1',
  runId: 'run-1',
  hotel_code: 'AMS',
  action: 'create_task',
  title: 'Fix mobile checkout on Amsterdam website',
  rationale: '',
  change: { before: '', after: '', scope: '' },
  impact_eur: -82004,
  risk: 'low',
  status: 'applied',
  createdAt: '2026-11-20T05:00:20.000Z',
  decidedBy: null,
  decidedAt: null,
  note: null,
  ...over,
});
const mail = (at: string, workflowId = 'wf-1'): AuditEntry => ({ id: `a-${at}`, at, workflowId, proposalId: '', hotel_code: 'LIS', action: 'email', by: 'workflow', outcome: 'emailed', receipt: '' });

describe('how a run ended', () => {
  it('is a finding when it proposed something or sent its mail', () => {
    expect(runOutcome(run(), [], [])).toBe('none');
    expect(runOutcome(run(), [proposal()], [])).toBe('finding');
    expect(runOutcome(run(), [proposal({ runId: 'run-other' })], [])).toBe('none');
    expect(runOutcome(run(), [proposal({ status: 'superseded' })], [])).toBe('none');
    expect(runOutcome(run(), [], [mail('2026-11-20T05:00:25.000Z')])).toBe('finding');
    // A mail from another run, or from another workflow, is not this run's finding.
    expect(runOutcome(run(), [], [mail('2026-11-19T05:00:25.000Z')])).toBe('none');
    expect(runOutcome(run(), [], [mail('2026-11-20T05:00:25.000Z', 'wf-2')])).toBe('none');
    // "Send test now" always sends, whatever it found: that mail is not a finding.
    expect(runOutcome(run({ test: true }), [], [mail('2026-11-20T05:00:25.000Z')])).toBe('none');
  });

  it('waits for a person, runs, or could not run', () => {
    expect(runOutcome(run({ status: 'waiting_approval', endedAt: null }), [], [])).toBe('pending');
    expect(runOutcome(run(), [proposal({ status: 'pending' })], [])).toBe('pending');
    expect(runOutcome(run({ status: 'running', endedAt: null }), [], [])).toBe('running');
    expect(runOutcome(run({ status: 'failed' }), [proposal()], [])).toBe('failed');
  });
});

describe('the run strip', () => {
  const runs = [
    run({ id: 'r3', startedAt: '2026-11-20T05:00:00Z', status: 'failed' }),
    run({ id: 'r1', startedAt: '2026-11-18T05:00:00Z' }),
    run({ id: 'r2', startedAt: '2026-11-19T05:00:00Z' }),
  ];

  it('is the last 14 runs, oldest first, padded so it keeps its width', () => {
    const strip = runStrip(runs, [proposal({ runId: 'r2' })], []);
    expect(strip).toHaveLength(14);
    expect(strip.slice(0, 11).every((tick) => tick.outcome === 'empty' && tick.id === '')).toBe(true);
    expect(strip.slice(11).map((tick) => [tick.id, tick.outcome])).toEqual([['r1', 'none'], ['r2', 'finding'], ['r3', 'failed']]);
    const many = Array.from({ length: 20 }, (_, i) => run({ id: `m${i}`, startedAt: `2026-11-${String(i + 1).padStart(2, '0')}T05:00:00Z` }));
    expect(runStrip(many, [], []).map((tick) => tick.id)).toEqual(many.slice(6).map((r) => r.id));
  });

  it('reads in words', () => {
    expect(stripSummary(runStrip([], [], []))).toBe('No runs yet.');
    expect(stripSummary(runStrip(runs, [proposal({ runId: 'r2' })], []))).toBe('Last 3 runs: 1 found something, 1 found nothing, 1 couldn’t run.');
    expect(stripSummary(runStrip([runs[1]!], [], []))).toBe('Last run: 1 found nothing.');
  });
});

describe('the status of a workflow', () => {
  const wf = (lastRun: Workflow['lastRun']) => ({ lastRun });
  it('says how the last run went, apart from on or paused', () => {
    expect(studioStatus(wf(null), [], [], [])).toEqual({ tone: 'quiet', text: 'Hasn’t run yet' });
    expect(studioStatus(wf({ runId: 'run-1', at: '', status: 'running' }), [], [], [])).toEqual({ tone: 'running', text: 'Running…' });
    expect(studioStatus(wf({ runId: 'run-1', at: '', status: 'failed' }), [], [], [])).toMatchObject({ tone: 'failed' });
    expect(studioStatus(wf({ runId: 'run-1', at: '', status: 'done' }), [run()], [], [])).toEqual({ tone: 'quiet', text: 'Nothing to flag' });
    expect(studioStatus(wf({ runId: 'run-1', at: '', status: 'done' }), [run()], [proposal()], [])).toEqual({ tone: 'finding', text: 'Found something' });
    expect(studioStatus(wf({ runId: 'run-1', at: '', status: 'done' }), [run({ test: true })], [], [mail('2026-11-20T05:00:25.000Z')])).toEqual({ tone: 'quiet', text: 'Test ran' });
    // A decision that waits wins over a newer quiet run.
    expect(studioStatus(wf({ runId: 'run-2', at: '', status: 'done' }), [run({ id: 'run-2' })], [proposal({ status: 'pending' })], [])).toEqual({ tone: 'needs', text: 'Needs your decision' });
  });
});

describe('the latest finding', () => {
  it('is the newest proposal, else what the last run concluded', () => {
    expect(latestFinding([], [])).toBeNull();
    expect(latestFinding([run()], [proposal(), proposal({ id: 'p0', title: 'Older', createdAt: '2026-11-19T05:00:00Z' })])).toMatchObject({
      kind: 'proposal',
      text: 'Fix mobile checkout on Amsterdam website',
      hotel: 'AMS',
      pending: false,
    });
    expect(latestFinding([run()], [proposal({ status: 'pending' })])?.pending).toBe(true);
    expect(latestFinding([run({ summary: 'The condition holds today, so I sent the email. LIS pace is -12.3%.\n\n- **Rooms:** 2,928' })], [])).toMatchObject({
      kind: 'run',
      text: 'The condition holds today, so I sent the email. LIS pace is -12.3%.',
      hotel: '',
      test: false,
    });
    expect(latestFinding([run({ test: true })], [])?.test).toBe(true);
  });

  it('gives way to a newer real run that found nothing, but not to a test', () => {
    const later = run({ id: 'run-2', startedAt: '2026-11-21T05:00:00Z', endedAt: '2026-11-21T05:00:20Z', summary: 'All quiet.' });
    expect(latestFinding([run(), later], [proposal()])).toMatchObject({ kind: 'run', text: 'All quiet.' });
    expect(latestFinding([run(), { ...later, test: true }], [proposal()])).toMatchObject({ kind: 'proposal' });
  });

  it('keeps the first sentences of a long summary', () => {
    const long = `${'Lisbon is behind last year. '.repeat(12)}`.trim();
    const text = firstSentences(long, 100);
    expect(text.length).toBeLessThanOrEqual(100);
    expect(text.endsWith('.')).toBe(true);
    expect(firstSentences('Short.\n\nMore below.')).toBe('Short.');
    // Decimals are not the end of a sentence.
    const scores = `The score is 8.0 against a threshold of 7.57, so the condition does not hold today. ${'More detail follows here. '.repeat(10)}`;
    expect(firstSentences(scores, 120)).toBe('The score is 8.0 against a threshold of 7.57, so the condition does not hold today. More detail follows here.');
    expect(firstSentences('x'.repeat(300), 50)).toHaveLength(51);
  });
});

describe('the next run', () => {
  const now = Date.parse('2026-11-20T21:30:00Z');
  const daily = { enabled: true, trigger: { kind: 'schedule', every: 'day' }, lastRun: null } as const;

  it('is the next 05:00 UTC cron', () => {
    expect(new Date(nextCron(now)).toISOString()).toBe('2026-11-21T05:00:00.000Z');
    expect(new Date(nextCron(Date.parse('2026-11-20T04:59:00Z'))).toISOString()).toBe('2026-11-20T05:00:00.000Z');
    expect(new Date(nextRunAt(daily, [], now)!).toISOString()).toBe('2026-11-21T05:00:00.000Z');
    expect(nextRunAt({ ...daily, enabled: false }, [], now)).toBeNull();
    expect(nextRunAt({ ...daily, trigger: { kind: 'manual' } }, [], now)).toBeNull();
  });

  it('waits about a week after the last real run of a weekly workflow', () => {
    const weekly = { ...daily, trigger: { kind: 'schedule', every: 'week' } } as const;
    expect(new Date(nextRunAt(weekly, [], now)!).toISOString()).toBe('2026-11-21T05:00:00.000Z');
    const ranThisMorning = [run({ startedAt: '2026-11-20T05:00:05Z' })];
    expect(new Date(nextRunAt(weekly, ranThisMorning, now)!).toISOString()).toBe('2026-11-27T05:00:00.000Z');
    // A run started by hand later in the day pushes it to the first cron 6.5 days later.
    expect(new Date(nextRunAt(weekly, [run({ startedAt: '2026-11-20T20:00:00Z' })], now)!).toISOString()).toBe('2026-11-28T05:00:00.000Z');
    // A test run does not count.
    expect(new Date(nextRunAt(weekly, [run({ startedAt: '2026-11-20T20:00:00Z', test: true })], now)!).toISOString()).toBe('2026-11-21T05:00:00.000Z');
  });

  it('reads as a line on the card, in the reader’s time zone', () => {
    expect(formatWhen(Date.parse('2026-11-21T05:00:00Z'), now, 'Europe/Bucharest')).toBe('tomorrow, 07:00');
    expect(formatWhen(Date.parse('2026-11-20T22:00:00Z'), now, 'UTC')).toBe('today, 22:00');
    expect(formatWhen(Date.parse('2026-11-27T05:00:00Z'), now, 'UTC')).toBe('Fri 27 Nov, 05:00');
    expect(nextRunText(daily, [], now, 'UTC')).toBe('Next run tomorrow, 05:00');
    expect(nextRunText({ ...daily, trigger: { kind: 'brief', finding: 'pace_behind' } }, [], now, 'UTC')).toBe('Reads the next brief tomorrow, 05:00');
    expect(nextRunText({ ...daily, trigger: { kind: 'manual' } }, [], now)).toBe('Runs when you start it');
    expect(nextRunText({ ...daily, enabled: false }, [], now)).toBe('Paused · no run scheduled');
  });
});

describe('autonomy', () => {
  it('knows a raise from a lowering', () => {
    expect(isRaise('suggest', 'approve')).toBe(true);
    expect(isRaise('approve', 'auto_low_risk')).toBe(true);
    expect(isRaise('auto_low_risk', 'approve')).toBe(false);
    expect(isRaise('approve', 'approve')).toBe(false);
  });
});
