import { readFileSync } from 'node:fs';
import { WIDGET_KINDS } from '@compass/contracts';
import { describe, expect, it } from 'vitest';
import { checkAnswer, type AnswerWidget, type Story } from '../evals/check.ts';

// The eval runner's verdict on one answer (evals/run.ts): the facts the text must mention, and for the "visual"
// stories the kind of widget the answer must show. Deterministic, no LLM judge.

const story = (fields: Partial<Story> = {}): Story => ({ id: 'V1', question: 'How is Lisbon pacing?', mustMention: [['Lisbon']], why: '', ...fields });
const widget = (kind: string, fields: Partial<AnswerWidget> = {}): AnswerWidget => ({ kind, title: 'A title', ...fields });
const done = (text: string, widgets: AnswerWidget[] = []) => ({ status: 'done', text, widgets });

describe('checkAnswer', () => {
  it('passes a done answer that mentions one phrase of every group', () => {
    expect(checkAnswer(story(), done('Arbor LISBON Chiado is behind.'))).toMatchObject({ pass: true, missing: [], kinds: [] });
  });

  it('fails an answer that is not done, or misses a group', () => {
    expect(checkAnswer(story(), { status: 'unanswered', text: 'Lisbon', widgets: [] }).pass).toBe(false);
    expect(checkAnswer(story(), done('Porto is behind.'))).toMatchObject({ pass: false, missing: [['Lisbon']] });
  });

  it('with expectWidget, needs a widget of one of those kinds and reports the kinds shown, in order', () => {
    const visual = story({ expectWidget: ['line', 'area'] });
    expect(checkAnswer(visual, done('Lisbon', [widget('kpi_row'), widget('area')]))).toMatchObject({ pass: true, kinds: ['kpi_row', 'area'], widgetProblem: null });
    const bar = checkAnswer(visual, done('Lisbon', [widget('bar')]));
    expect(bar.pass).toBe(false);
    expect(bar.widgetProblem).toMatch(/expected line or area, got bar/);
    expect(checkAnswer(visual, done('Lisbon')).widgetProblem).toMatch(/got no widget/);
  });

  it('with expectCompare, the matching widget must carry a comparison column', () => {
    const visual = story({ expectWidget: ['line', 'area'], expectCompare: true });
    expect(checkAnswer(visual, done('Lisbon', [widget('line', { compare: 'rooms_otb_stly' })])).pass).toBe(true);
    // Two y columns (this year and last year) compare too.
    expect(checkAnswer(visual, done('Lisbon', [widget('line', { y: ['rooms_otb', 'rooms_otb_stly'] })])).pass).toBe(true);
    const plain = checkAnswer(visual, done('Lisbon', [widget('line', { y: ['rooms_otb'] })]));
    expect(plain.pass).toBe(false);
    expect(plain.widgetProblem).toMatch(/comparison/);
  });

  it('a story without expectWidget does not mind widgets', () => {
    expect(checkAnswer(story(), done('Lisbon', [widget('bar')]))).toMatchObject({ pass: true, kinds: ['bar'] });
  });
});

describe('evals/stories.json', () => {
  const stories = JSON.parse(readFileSync(new URL('../evals/stories.json', import.meta.url).pathname, 'utf8')) as Story[];

  it('keeps the seven planted stories and adds the visual ones', () => {
    const ids = stories.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id.startsWith('S'))).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7']);
    const visual = stories.filter((s) => s.expectWidget);
    expect(visual.length).toBeGreaterThanOrEqual(6);
    expect(visual.length).toBeLessThanOrEqual(8);
  });

  it('expects only widget kinds that exist', () => {
    for (const s of stories) for (const kind of s.expectWidget ?? []) expect(WIDGET_KINDS, `${s.id} ${kind}`).toContain(kind);
  });
});
