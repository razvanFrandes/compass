/**
 * The verdict on one eval answer. Deterministic: each group of `mustMention` needs one of its phrases in the text, and
 * a story with `expectWidget` needs a widget of one of those kinds in the answer (`expectCompare`: with a comparison
 * column, e.g. last year). No LLM judge. Imports nothing, so `node --experimental-strip-types evals/run.ts` runs it.
 */

export interface Story {
  id: string;
  question: string;
  mustMention: string[][];
  /** The answer must show a widget of one of these kinds. */
  expectWidget?: string[];
  /** That widget must compare: a `compare` column, or two or more y columns. */
  expectCompare?: boolean;
  mode?: 'quick' | 'thinker';
  why: string;
}

export interface AnswerWidget {
  kind: string;
  title?: string;
  y?: string[];
  compare?: string;
}

export interface EvalAnswer {
  status: string;
  text: string | null;
  widgets?: AnswerWidget[];
}

export interface Verdict {
  pass: boolean;
  /** The groups of `mustMention` the text has no phrase of. */
  missing: string[][];
  /** The kinds of the widgets shown, in order. */
  kinds: string[];
  /** Why the widgets do not meet `expectWidget`, or null. */
  widgetProblem: string | null;
}

const compares = (widget: AnswerWidget) => Boolean(widget.compare) || (widget.y?.length ?? 0) >= 2;

export function checkAnswer(story: Story, answer: EvalAnswer): Verdict {
  const text = (answer.text ?? '').toLowerCase();
  const missing = story.mustMention.filter((group) => !group.some((phrase) => text.includes(phrase.toLowerCase())));
  const widgets = answer.widgets ?? [];
  const kinds = widgets.map((widget) => widget.kind);

  let widgetProblem: string | null = null;
  if (story.expectWidget?.length) {
    const wanted = story.expectWidget.join(' or ');
    const matching = widgets.filter((widget) => story.expectWidget!.includes(widget.kind));
    if (!matching.length) widgetProblem = `expected ${wanted}, got ${kinds.join(', ') || 'no widget'}`;
    else if (story.expectCompare && !matching.some(compares)) widgetProblem = `expected ${wanted} with a comparison (compare, or two y columns), got it without one`;
  }
  return { pass: answer.status === 'done' && missing.length === 0 && widgetProblem === null, missing, kinds, widgetProblem };
}
