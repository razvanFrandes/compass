import { evidenceEntries, evidenceTarget, hasEvidence, statedText } from './evidence-target';
import { evidence, step, turn, widget } from './testing';

/*
  The owner's case: "What happened with Vantor Consulting…" reads the account production; the next question,
  "Show this as a chart", only calls show_widget, whose source is that earlier result.
*/
const production = step({ callId: 'prod', name: 'get_account_production', args: { hotels: ['NYC'] }, rows: [{ account: 'Vantor Consulting', revenue_eur: 144102 }], evidence: evidence({ title: 'Account production' }) });
const lookup = step({ callId: 'hotels', name: 'list_hotels', args: {}, rows: [{ hotel_code: 'NYC' }], evidence: evidence({ title: 'Hotels of the group' }) });
const chart = widget({ title: 'Vantor Consulting revenue fell €1.35M', sourceCallId: 'prod', x: 'account', y: ['revenue_eur'], compare: 'previous_revenue_eur', group: undefined });
const asked = turn({ key: 't1', question: 'What happened with Vantor Consulting?', answer: 'Revenue fell from €1,495,492 to €144,102.', steps: [lookup, production] });
const charted = turn({ key: 't2', question: 'Show this as a chart', answer: 'I’ve added the chart above.', steps: [step({ callId: 'w1', name: 'show_widget', args: {}, widget: chart })] });

describe('evidenceEntries', () => {
  it('gives a turn whose chart draws an earlier result that result, before its own steps', () => {
    const entries = evidenceEntries([asked, charted], charted);
    expect(entries.map((entry) => entry.callId)).toEqual(['prod', 'w1']);
    expect(entries[0]).toBe(production);
  });

  it('does not repeat a source the turn read itself', () => {
    const both = turn({ key: 't3', steps: [production, step({ callId: 'w1', name: 'show_widget', widget: chart })] });
    expect(evidenceEntries([asked, both], both).map((entry) => entry.callId)).toEqual(['prod', 'w1']);
  });

  it('borrows one source once, however many charts draw it', () => {
    const two = turn({ key: 't4', steps: [step({ callId: 'w1', name: 'show_widget', widget: chart }), step({ callId: 'w2', name: 'show_widget', widget: chart })] });
    expect(evidenceEntries([asked, two], two).map((entry) => entry.callId)).toEqual(['prod', 'w1', 'w2']);
  });

  it('rebuilds a source that is no longer in the transcript from what the chart carries', () => {
    const [source] = evidenceEntries([charted], charted);
    expect(source).toMatchObject({ callId: 'prod', status: 'done', rows: chart.rows });
    expect(source!.evidence).toMatchObject({ sql: 'select 1', columns: chart.columns });
  });

  it('leaves a turn without charts as it is', () => {
    expect(evidenceEntries([asked, charted], asked)).toBe(asked.steps);
  });
});

describe('evidenceTarget', () => {
  it('follows a chart to the result it draws, and says which chart and which columns', () => {
    const target = evidenceTarget([asked, charted], { turnKey: 't2', callId: 'prod', widgetCallId: 'w1' });
    expect(target.turn).toBe(charted);
    expect(target.callId).toBe('prod');
    expect(target.chart).toEqual({ title: 'Vantor Consulting revenue fell €1.35M', columns: ['account', 'revenue_eur', 'previous_revenue_eur'] });
  });

  it('follows a step to its own card, with no chart', () => {
    expect(evidenceTarget([asked, charted], { turnKey: 't1', callId: 'prod' })).toEqual({ turn: asked, callId: 'prod', chart: null });
  });

  it('lets go when nothing is picked, or the turn is gone', () => {
    expect(evidenceTarget([asked], null)).toEqual({ turn: null, callId: null, chart: null });
    expect(evidenceTarget([asked], { turnKey: 'gone', callId: 'prod' })).toEqual({ turn: null, callId: null, chart: null });
  });
});

describe('hasEvidence and statedText', () => {
  it('counts a turn that only drew a chart as one with something to explain', () => {
    expect(hasEvidence(asked)).toBe(true);
    expect(hasEvidence(charted)).toBe(true);
    expect(hasEvidence(turn({ steps: [step({ name: 'draft_workflow' })] }))).toBe(false);
  });

  it('reads the numbers a turn states from its answer and the titles of its charts', () => {
    expect(statedText(charted)).toBe('I’ve added the chart above.\nVantor Consulting revenue fell €1.35M');
    expect(statedText(asked)).toBe('Revenue fell from €1,495,492 to €144,102.');
    expect(statedText(turn())).toBeNull();
  });
});
