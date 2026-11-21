import { describe, expect, it } from 'vitest';
import { KASSANDRA_SECTIONS } from '../src/presentation/agents/kassandra-prompt.ts';
import { agentChangeFor, QUICK_TOOLS } from '../src/presentation/agents/modes.ts';
import { createDataExtension } from '../src/presentation/agents/pi-data-extension.ts';
import { WIDGET_SECTIONS, withWidgets } from '../src/presentation/agents/widgets.ts';

// Kassandra answers visually by default: the rules that say when a widget is owed and which kind fits which data.
// These read the prompt as the model does. Whether a model follows them is what evals/stories.json checks.

const rules = (WIDGET_SECTIONS.find((section) => section.key === 'widgets')!.render as () => string)();
const data = withWidgets(
  createDataExtension(() => {
    throw new Error('no database in this test');
  }),
);

describe('the widget rules of the prompt', () => {
  it('ask for at least one widget whenever the answer compares, trends, splits, ranks or has a few headline figures', () => {
    expect(rules).toMatch(/ALWAYS call show_widget at least once/);
    for (const shape of ['comparison', 'trend', 'split', 'ranking', 'headline figures']) expect(rules, shape).toContain(shape);
  });

  it('say which kind fits which data, for every kind the owner asked to see', () => {
    const recipes: [kind: string, cue: RegExp][] = [
      ['kpi_row', /2–4 headline numbers/],
      ['line', /trend/],
      ['area', /trend/],
      ['bar', /ranking/],
      ['grouped_bar', /side by side/],
      ['donut', /2–7 parts of one whole/],
      ['pie', /2–7 parts of one whole/],
      ['stacked_bar', /mix over time/],
      ['waterfall', /bridge/],
      ['funnel', /booking funnel/],
      ['bullet', /budget or target/],
      ['heatmap', /hotels × nights/],
      ['calendar_heatmap', /one hotel/i],
      ['scatter', /ARI × MPI/],
      ['treemap', /by hotel/],
      ['sankey', /commission/],
      ['table', /look up/],
    ];
    const lines = rules.split('\n');
    for (const [kind, cue] of recipes) {
      expect(lines.some((candidate) => candidate.includes(kind) && cue.test(candidate)), `${kind} is tied to ${cue}`).toBe(true);
    }
  });

  it('name the tool shape that feeds the kinds whose rows no plain result has', () => {
    expect(rules).toMatch(/get_pnl[^\n]*view "bridge"/);
    expect(rules).toMatch(/get_channel_mix[^\n]*shape "flows"/);
    expect(rules).toMatch(/get_kpis/);
    expect(rules).toMatch(/get_pace[^\n]*grain "day"/);
  });

  it('cap an answer at 3 widgets, most important first, and keep the text short and pointing at them', () => {
    expect(rules).toMatch(/Up to 3 widgets/);
    expect(rules).toMatch(/most important first/);
    expect(rules).toMatch(/Keep the text short/);
    expect(rules).toMatch(/Never repeat the rows of a widget/);
  });

  it('keep the nights of a "by hotel, by night" question instead of summing them into bars', () => {
    const heatmap = rules.split('\n').find((line) => line.includes('→ heatmap'))!;
    expect(heatmap).toMatch(/for each hotel and each night/);
    expect(heatmap).toMatch(/do not sum the nights/i);
  });

  it('answer a question about the booking funnel with a funnel before any trend', () => {
    const funnel = rules.split('\n').find((line) => line.includes('→ funnel'))!;
    expect(funnel).toMatch(/whenever the question is about the funnel/i);
    expect(funnel).toMatch(/first/);
  });

  it('draw a calendar, not a line, for which nights of one hotel are filling', () => {
    const heatmap = rules.split('\n').find((line) => line.includes('→ calendar_heatmap'))!;
    expect(heatmap).toMatch(/which nights/i);
    expect(heatmap).toMatch(/not a line/);
  });

  it('draw the flow whenever the question is what is left after commission', () => {
    const sankey = rules.split('\n').find((line) => line.includes('→ sankey'))!;
    expect(sankey).toMatch(/left after commission/);
    expect(sankey).toMatch(/not bars/);
  });

  it('have the result checked before it is charted, since a widget cannot be taken back', () => {
    expect(rules).toMatch(/cannot be taken back/);
  });

  it('still never let the model type a number into a widget', () => {
    expect(rules).toMatch(/you never type a number/);
  });
});

describe('the answer style', () => {
  it('tells Kassandra to show first and keep the text to the conclusion', () => {
    const style = KASSANDRA_SECTIONS.find((section) => section.key === 'answer_style')!.render() as string;
    expect(style).toMatch(/widget/);
  });

  it('never prints a code for a hotel, segment, channel or rate plan, not even in brackets', () => {
    const voice = KASSANDRA_SECTIONS.find((section) => section.key === 'voice')!.render() as string;
    expect(voice).toMatch(/never by its code/i);
    expect(voice).toMatch(/not even in brackets/i);
    for (const example of ['London (LON2)', 'RET', 'BDC']) expect(voice).toContain(example);
    expect(voice).toMatch(/segment.*channel.*rate plan/i);
  });

  it('keeps tool and column names out of what the reader sees', () => {
    const style = KASSANDRA_SECTIONS.find((section) => section.key === 'answer_style')!.render() as string;
    expect(style).toMatch(/never name a tool/i);
  });
});

describe('visual answers in both modes', () => {
  it('Quick still owes a widget, from the result it already has', () => {
    const quick = agentChangeFor('quick', data).instructions!;
    expect(quick).toMatch(/show_widget/);
    expect(quick).toMatch(/three sentences/);
  });

  it('Quick can read the headline KPIs in one call', () => {
    expect(QUICK_TOOLS).toContain('get_kpis');
  });

  it('Thinker may call a data tool only to feed a widget, and has the turns for it', () => {
    const thinker = agentChangeFor('thinker', data);
    expect(thinker.instructions).toMatch(/call a data tool .*to feed a widget/);
    expect(thinker.maxTurns).toBe(12);
  });

  it('keeps the hotel scope after the mode instructions', () => {
    const scope = 'You are answering for: Arbor Lisbon Chiado (LIS).';
    expect(agentChangeFor('thinker', data, scope).instructions!.endsWith(scope)).toBe(true);
    expect(agentChangeFor('quick', data, scope).instructions!.endsWith(scope)).toBe(true);
  });
});
