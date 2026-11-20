/**
 * Story evals: asks Kassandra the planted-story questions (S1–S7) and the visual ones (V1–V8) and checks each answer:
 * the facts that prove the story was found, and for a visual story the kind of widget the answer shows
 * (evals/check.ts). Deterministic checks, no LLM judge.
 *
 *   node --experimental-strip-types evals/run.ts [baseUrl]      default https://juyo.razvanfrandes.com
 *   EVAL_ONLY=S2,V4 …                                           run a subset
 *
 * Questions run one after another, to stay under the ask rate limit (6 per minute per client).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { checkAnswer, type AnswerWidget, type Story } from './check.ts';

interface Answer { status: string; text: string | null; reason: string | null; durationMs: number; widgets?: (AnswerWidget & { x?: string; group?: string; rows?: unknown[] })[] }

const base = process.argv[2] ?? 'https://juyo.razvanfrandes.com';
const only = process.env['EVAL_ONLY']?.split(',');
const stories = (JSON.parse(readFileSync(new URL('./stories.json', import.meta.url).pathname, 'utf8')) as Story[]).filter(
  (s) => !only || only.includes(s.id),
);
const run = new Date().toISOString().replace(/[:.]/g, '-');
const results = [];

for (const story of stories) {
  const started = Date.now();
  let answer: Answer;
  try {
    const response = await fetch(`${base}/api/kassandra/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conversation: `eval-${run}-${story.id}`, question: story.question, ...(story.mode ? { mode: story.mode } : {}) }),
    });
    answer = (await response.json()) as Answer;
  } catch (error) {
    answer = { status: 'error', text: null, reason: String(error), durationMs: Date.now() - started };
  }
  const verdict = checkAnswer(story, answer);
  // The widgets as specs with their row count: the rows themselves would bloat the results file.
  const widgets = (answer.widgets ?? []).map(({ rows, ...spec }) => ({ kind: spec.kind, title: spec.title, x: spec.x, y: spec.y, group: spec.group, compare: spec.compare, rows: rows?.length ?? 0 }));
  results.push({ ...story, ...verdict, status: answer.status, reason: answer.reason, durationMs: answer.durationMs, widgets, answer: answer.text });
  const problems = [verdict.missing.length ? `missing ${JSON.stringify(verdict.missing)}` : '', verdict.widgetProblem ?? '', answer.reason ?? ''].filter(Boolean).join('; ');
  console.log(`${verdict.pass ? 'PASS' : 'FAIL'}  ${story.id}  ${((answer.durationMs ?? 0) / 1000).toFixed(1)}s  widgets: ${verdict.kinds.join(', ') || 'none'}  ${verdict.pass ? '' : problems}`);
}

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} stories pass`);
mkdirSync(new URL('./results/', import.meta.url).pathname, { recursive: true });
writeFileSync(new URL(`./results/${run}.json`, import.meta.url).pathname, JSON.stringify({ base, run, passed, total: results.length, results }, null, 2));
process.exit(passed === results.length ? 0 : 1);
