/**
 * Story evals: asks Kassandra the seven planted-story questions and checks each answer for the facts that prove the
 * story was found. Deterministic checks (each group: at least one of the phrases must appear), no LLM judge.
 *
 *   node --experimental-strip-types evals/run.ts [baseUrl]      default https://juyo.razvanfrandes.com
 *   EVAL_ONLY=S2,S4 …                                           run a subset
 *
 * Questions run one after another, to stay under the ask rate limit (6 per minute per client).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

interface Story { id: string; question: string; mustMention: string[][]; why: string }
interface Answer { status: string; text: string | null; reason: string | null; durationMs: number }

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
      body: JSON.stringify({ conversation: `eval-${run}-${story.id}`, question: story.question }),
    });
    answer = (await response.json()) as Answer;
  } catch (error) {
    answer = { status: 'error', text: null, reason: String(error), durationMs: Date.now() - started };
  }
  const text = (answer.text ?? '').toLowerCase();
  const missing = story.mustMention.filter((group) => !group.some((phrase) => text.includes(phrase.toLowerCase())));
  const pass = answer.status === 'done' && missing.length === 0;
  results.push({ ...story, pass, missing, status: answer.status, reason: answer.reason, durationMs: answer.durationMs, answer: answer.text });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${story.id}  ${(answer.durationMs / 1000).toFixed(1)}s  ${pass ? '' : `missing ${JSON.stringify(missing)} ${answer.reason ?? ''}`}`);
}

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} stories found`);
mkdirSync(new URL('./results/', import.meta.url).pathname, { recursive: true });
writeFileSync(new URL(`./results/${run}.json`, import.meta.url).pathname, JSON.stringify({ base, run, passed, total: results.length, results }, null, 2));
process.exit(passed === results.length ? 0 : 1);
