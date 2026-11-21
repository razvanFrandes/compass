import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { ChatLive } from '@compass/contracts';
import type { ChatTurn } from '../api';
import { KassandraConversation, type EvidenceSelection } from './kassandra-conversation';
import { ViewAsMemory } from '../charts/view-memory';
import { evidence, paceEvidence, paceRows, step, turn, widget } from './testing';

function render(turns: ChatTurn[], inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(KassandraConversation);
  fixture.componentRef.setInput('turns', turns);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  return fixture;
}
const el = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;
const text = (node: Element | null | undefined) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
const button = (fixture: ComponentFixture<unknown>, label: string) => [...el(fixture).querySelectorAll('button')].find((b) => text(b)?.includes(label));
const status = (turns: ChatTurn[], phase: ChatLive['phase'] | null) => text(render(turns, { phase }).nativeElement.querySelector('[role=status]'));

describe('KassandraConversation: a turn', () => {
  it('shows the question, and marks one the server has not confirmed yet', () => {
    const fixture = render([turn({ pending: true })]);
    expect(text(el(fixture).querySelector('kassandra-turn p'))).toBe('You asked: Why is Lisbon behind? Sending…');
  });

  it('says what Kassandra is doing while no answer text has arrived', () => {
    expect(status([turn({ running: true })], 'thinking')).toBe('Thinking…');
    expect(status([turn({ running: true })], 'tools')).toBe('Checking the data…');
    expect(status([turn({ running: true, streamingText: 'Lisbon is 17% behind' })], 'writing')).toBe('Writing…');
  });

  it('shows the phase on the running turn only, and nothing once it is finished', () => {
    expect(status([turn({ answer: 'Done.' })], 'idle')).toBeNull();
    const fixture = render([turn({ answer: 'First.' }), turn({ key: 't2', question: 'And Dubai?', running: true })], { phase: 'thinking' });
    expect(el(fixture).querySelectorAll('[role=status]')).toHaveLength(1);
  });

  it('keeps the steps collapsed to one line and opens them on demand, with human titles', () => {
    const steps = [step({ narration: 'Checking pace first.', rows: [{}, {}], evidence: evidence() }), step({ callId: 'c2', name: 'get_pickup', status: 'error', error: 'The data source failed to answer.' })];
    const fixture = render([turn({ steps, answer: 'Lisbon is behind.', workedMs: 4200, model: 'claude-sonnet-5-5' })]);
    const toggle = button(fixture, 'Worked for')!;
    expect(text(toggle)).toBe('Worked for 4s · 2 steps');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(el(fixture).querySelector('ol')).toBeNull();

    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const list = el(fixture).querySelector('ol')!;
    expect(list.id).toBe(toggle.getAttribute('aria-controls'));
    const items = [...list.querySelectorAll('li')].map(text);
    expect(items[0]).toContain('Checking pace first.');
    expect(items[0]).toContain('Pace vs last year · Lisbon Chiado · 2 rows');
    expect(items[1]).toContain('Recent pickup · Lisbon Chiado · couldn’t finish');
    expect(items[1]).toContain('The data source failed to answer.');
    expect(text(list)).not.toContain('get_pace');
  });

  it('counts the steps so far while the run goes on', () => {
    const fixture = render([turn({ running: true, steps: [step({ status: 'running' })] })], { phase: 'tools' });
    expect(text(button(fixture, 'Working'))).toBe('Working · 1 step so far');
  });

  it('renders the answer as Markdown, escaped, and the streaming text in its place while it is written', () => {
    const done = render([turn({ answer: 'Lisbon is **17% behind** <script>x</script>' })]);
    expect(el(done).querySelector('app-markdown strong')?.textContent).toBe('17% behind');
    expect(el(done).querySelector('script')).toBeNull();
    const writing = render([turn({ running: true, streamingText: 'Lisbon is' })]);
    expect(text(el(writing).querySelector('app-markdown'))).toBe('Lisbon is');
    expect(el(writing).querySelector('[aria-live=polite]')?.getAttribute('aria-busy')).toBe('true');
  });

  it('says why a run ended without an answer', () => {
    const fixture = render([turn({ failure: { reason: 'turn_limit', detail: '12 turns' } })]);
    expect(text(el(fixture).querySelector('[role=alert]'))).toBe('No answer this time. The question took too many steps. Narrow it to one hotel or a shorter period and ask again. (12 turns)');
  });

  it('shows the server’s rejection as it is', () => {
    const fixture = render([], { error: 'You have asked 6 questions this minute. Try again shortly.' });
    expect(text(el(fixture).querySelector('[role=alert]'))).toBe('You have asked 6 questions this minute. Try again shortly.');
  });

  it('keeps tokens and cost behind a Details disclosure', () => {
    const fixture = render([turn({ answer: 'Done.', model: 'claude-haiku-5-5', workedMs: 6000, usage: { tokens: 52_600, costUsd: 0.05 } })], { usage: { tokens: 80_000, costUsd: 0.09 } });
    const details = el(fixture).querySelector('details')!;
    expect(details.open).toBe(false);
    expect(text(details.querySelector('summary'))).toBe('Details');
    expect(text(details)).toContain('Quick (claude-haiku-5-5)');
    expect(text(details)).toContain('52.6k tokens · $0.05');
    expect(text(details)).toMatch(/Conversation so far\s*80\.0k tokens · \$0\.09/);
    // Nothing about tokens or dollars anywhere outside the disclosure.
    const outside = el(fixture).cloneNode(true) as HTMLElement;
    outside.querySelector('details')!.remove();
    expect(text(outside)).not.toMatch(/tokens|\$/);
  });
});

describe('KassandraConversation: widgets', () => {
  const withWidget = () => turn({ answer: 'See the chart.', steps: [step({ rows: [{}, {}], evidence: evidence() }), step({ callId: 'c2', name: 'show_widget', widget: widget() })] });

  it('draws a widget from the tool rows, with its conclusion as the title and Add to board', () => {
    const fixture = render([withWidget()]);
    const figure = el(fixture).querySelector('kassandra-widget figure')!;
    expect(text(figure.querySelector('h3'))).toBe('Lisbon is 15.9% behind last year for December');
    expect(text(figure.querySelector('figcaption p'))).toBe('Arbor Lisbon Chiado · December 2026');
    // The chart itself is <juyo-widget-chart>'s (src/app/charts): drawn, not a skeleton.
    expect(figure.querySelector('juyo-widget-chart')).not.toBeNull();
    expect(figure.querySelector('juyo-widget-chart [aria-busy=true]')).toBeNull();
    expect(button(fixture, 'Add to board')).toBeDefined();
  });

  it('hides Add to board where the host does not keep boards', () => {
    expect(button(render([withWidget()], { addToBoard: false }), 'Add to board')).toBeUndefined();
  });

  describe('in three phases, in the same card', () => {
    const ARGS = { kind: 'bar', title: 'Lisbon is 15.9% behind last year for December', subtitle: 'Arbor Lisbon Chiado · December 2026', sourceCallId: 'c1', x: 'segment', y: ['rooms'] };
    const card = (fixture: ComponentFixture<unknown>) => el(fixture).querySelector('kassandra-widget')!;
    const chartBusy = (fixture: ComponentFixture<unknown>) => card(fixture).querySelector('juyo-widget-chart [aria-busy=true]') !== null;

    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('1. the call has started (live.tools): a skeleton of the card, chart area included', () => {
      const fixture = render([turn({ running: true })], { phase: 'tools', liveTools: [{ callId: 'c2', name: 'show_widget', status: 'pending' }] });
      expect(card(fixture).getAttribute('data-phase')).toBe('chosen');
      expect(card(fixture).querySelector('h3')).toBeNull();
      expect(text(card(fixture).querySelector('figcaption [role=status]'))).toBe('Kassandra is drawing a chart');
      expect(chartBusy(fixture)).toBe(true);
      expect(button(fixture, 'Add to board')).toBeUndefined();
    });

    it('2. the arguments are known: the title and subtitle are filled in, the chart area stays a skeleton', () => {
      const fixture = render([turn({ running: true, steps: [step({ callId: 'c2', name: 'show_widget', status: 'running', args: ARGS })] })], { phase: 'tools' });
      expect(card(fixture).getAttribute('data-phase')).toBe('described');
      expect(text(card(fixture).querySelector('h3'))).toBe(ARGS.title);
      expect(text(card(fixture).querySelector('figcaption p'))).toBe(ARGS.subtitle);
      expect(chartBusy(fixture)).toBe(true);
      expect(card(fixture).querySelector('juyo-widget-chart')!.getAttribute('data-kind')).toBe('bar');
    });

    it('3. the result is in: the chart takes the skeleton’s place in the same element, after the skeleton’s 300 ms', () => {
      const fixture = render([turn({ running: true, steps: [step({ callId: 'c2', name: 'show_widget', status: 'running', args: ARGS })] })], { phase: 'tools' });
      const figure = card(fixture).querySelector('figure');
      const chart = card(fixture).querySelector('juyo-widget-chart');

      // The result arrives 100 ms after the skeleton appeared: the skeleton stays, so it does not flicker.
      vi.advanceTimersByTime(100);
      fixture.componentRef.setInput('turns', [turn({ running: true, steps: [step({ callId: 'c2', name: 'show_widget', args: ARGS, widget: widget() })] })]);
      fixture.detectChanges();
      expect(card(fixture).getAttribute('data-phase')).toBe('described');
      expect(chartBusy(fixture)).toBe(true);

      vi.advanceTimersByTime(200);
      fixture.detectChanges();
      expect(card(fixture).getAttribute('data-phase')).toBe('ready');
      expect(chartBusy(fixture)).toBe(false);
      expect(button(fixture, 'Add to board')).toBeDefined();
      // Same card, same chart element: a swap inside the box, not a new box.
      expect(card(fixture).querySelector('figure')).toBe(figure);
      expect(card(fixture).querySelector('juyo-widget-chart')).toBe(chart);
    });

    it('a transcript loaded from the server shows its charts at once, with no skeleton', () => {
      const fixture = render([withWidget()]);
      expect(card(fixture).getAttribute('data-phase')).toBe('ready');
      expect(chartBusy(fixture)).toBe(false);
    });

    it('a call that failed, or a run that was stopped, leaves no skeleton', () => {
      const failed = render([turn({ running: true, steps: [step({ callId: 'c2', name: 'show_widget', status: 'error', args: ARGS, error: 'Unknown column.' })] })], { phase: 'thinking' });
      expect(el(failed).querySelector('kassandra-widget')).toBeNull();
      const stopped = render([turn({ failure: { reason: 'aborted' }, steps: [step({ callId: 'c2', name: 'show_widget', status: 'pending', args: ARGS })] })]);
      expect(el(stopped).querySelector('kassandra-widget')).toBeNull();
    });
  });

  it('reports which tool result a widget’s "Behind the numbers" is about, and which chart was asked', () => {
    const fixture = render([withWidget()]);
    const picked: EvidenceSelection[] = [];
    fixture.componentInstance.evidenceSelected.subscribe((selection) => picked.push(selection));
    button(fixture, 'Behind the numbers')!.click();
    expect(picked).toEqual([{ turnKey: 't1', callId: 'c1', widgetCallId: 'c2' }]);
  });

  it('reports a chart drawn from an earlier answer with the turn it sits in and the result it draws', () => {
    const asked = turn({ key: 't1', answer: 'Lisbon is behind.', steps: [step({ rows: [{}, {}], evidence: evidence() })] });
    const charted = turn({ key: 't2', question: 'Show this as a chart', answer: 'See the chart.', steps: [step({ callId: 'c9', name: 'show_widget', widget: widget() })] });
    const fixture = render([asked, charted]);
    const picked: EvidenceSelection[] = [];
    fixture.componentInstance.evidenceSelected.subscribe((selection) => picked.push(selection));
    button(fixture, 'Behind the numbers')!.click();
    expect(picked).toEqual([{ turnKey: 't2', callId: 'c1', widgetCallId: 'c9' }]);
  });

  it('saves a widget on the chosen board with the rows it was drawn from', async () => {
    const fixture = render([withWidget()]);
    const sent: { method: string; path: string; body: Record<string, unknown> }[] = [];
    const fetched = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if ((init?.method ?? 'GET') === 'GET') return new Response('[]', { status: 200 });
      const body = JSON.parse(String(init!.body)) as Record<string, unknown>;
      sent.push({ method: init!.method!, path: String(input), body });
      return new Response(JSON.stringify({ id: 'w9', spec: body['spec'], rows: [], columns: [], evidence: evidence(), addedAt: '2026-11-20T22:00:00Z' }), { status: 200 });
    });
    const picker = fixture.debugElement.query((node) => node.name === 'kassandra-board-picker').componentInstance as { add(id: string, name: string): Promise<void> };
    await picker.add('b1', 'Lisbon');
    expect(sent.map(({ method, path }) => ({ method, path }))).toEqual([{ method: 'POST', path: '/api/boards/b1/widgets' }]);
    const body = sent[0]!.body;
    expect(body['spec']).toEqual({ kind: 'bar', title: 'Lisbon is 15.9% behind last year for December', subtitle: 'Arbor Lisbon Chiado · December 2026', sourceCallId: 'c1', x: 'segment', y: ['rooms'] });
    expect(body['rows']).toEqual(widget().rows);
    expect(body['question']).toBe('Why is Lisbon behind?');
    fixture.detectChanges();
    expect(text(button(fixture, 'On Lisbon'))).toBe('On Lisbon · Open');
    fetched.mockRestore();
  });
});

describe('KassandraConversation: instant previews and "View as"', () => {
  const pace = (patch = {}) => step({ callId: 'c1', name: 'get_pace', args: { hotels: ['LIS', 'AMS', 'PAR'] }, rows: paceRows, evidence: paceEvidence(), ...patch });
  const HER = { kind: 'bar' as const, title: 'Lisbon is 17.4% behind last year; Paris is ahead', subtitle: 'Lisbon, Amsterdam, Paris · next 30 nights', sourceCallId: 'c1', x: 'hotel_code', y: ['pace_pct'] };
  const hers = () => widget({ ...HER, format: 'percent', rows: paceRows, columns: paceEvidence().columns! });
  const card = (fixture: ComponentFixture<unknown>) => el(fixture).querySelector('kassandra-widget')!;
  const chart = (fixture: ComponentFixture<unknown>) => card(fixture).querySelector('juyo-widget-chart')!;
  const radio = (fixture: ComponentFixture<unknown>, label: string) => [...card(fixture).querySelectorAll<HTMLButtonElement>('[role=radio]')].find((b) => text(b)?.startsWith(label))!;

  beforeEach(() => {
    globalThis.localStorage?.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('shows a skeleton as soon as a data call starts, where the host asked for previews', () => {
    const live = [{ callId: 'c1', name: 'get_pace', status: 'pending' }];
    const fixture = render([turn({ running: true })], { phase: 'tools', liveTools: live, previews: true });
    expect(card(fixture).getAttribute('data-phase')).toBe('chosen');
    expect(text(card(fixture).querySelector('figcaption [role=status]'))).toBe('Kassandra is reading the data');
    expect(card(fixture).querySelector('juyo-widget-chart [aria-busy=true]')).not.toBeNull();
    // A workflow's log, or a board's "describe a view", does not ask: nothing is drawn for a data call.
    expect(el(render([turn({ running: true })], { phase: 'tools', liveTools: live })).querySelector('kassandra-widget')).toBeNull();
  });

  it('starts that skeleton from a call the model is still writing (live.drafting)', () => {
    const fixture = render([turn({ running: true })], { phase: 'tools', drafting: [{ callId: 'c1', name: 'get_pace', args: {} }], previews: true });
    expect(card(fixture).getAttribute('data-phase')).toBe('chosen');
    expect(text(button(fixture, 'Working'))).toBe('Working · 1 step so far');
  });

  it('draws the preview when the rows land, says it is one, and offers "View as"', () => {
    const fixture = render([turn({ running: true })], { phase: 'tools', liveTools: [{ callId: 'c1', name: 'get_pace', status: 'running' }], previews: true });
    const figure = card(fixture).querySelector('figure');
    vi.advanceTimersByTime(400);
    fixture.componentRef.setInput('turns', [turn({ running: true, steps: [pace()] })]);
    fixture.componentRef.setInput('liveTools', []);
    fixture.detectChanges();
    expect(card(fixture).getAttribute('data-phase')).toBe('ready');
    expect(card(fixture).hasAttribute('data-preview')).toBe(true);
    expect(text(card(fixture).querySelector('h3'))).toBe('Pace vs last year');
    expect(text(card(fixture).querySelector('figcaption .text-muted-foreground'))).toBe('Lisbon Chiado, Amsterdam Centraal, Paris Opera · 21 Nov – 20 Dec');
    expect(text(card(fixture).querySelector('.k-preview'))).toBe('Preview: drawn from the data as it arrived. Kassandra may still choose another chart.');
    expect(chart(fixture).getAttribute('data-kind')).toBe('bar');
    expect([...card(fixture).querySelectorAll('[role=radio]')].map((b) => b.getAttribute('data-kind'))).toEqual(['kpi_row', 'bullet', 'bar', 'grouped_bar', 'donut', 'pie', 'treemap', 'table']);
    expect(text(radio(fixture, 'Bar'))).toBe('Bar, Recommended');
    expect(card(fixture).querySelector('figure')).toBe(figure); // the skeleton's card, not a new one
  });

  it('turns the preview into Kassandra’s chart in the same card when her widget lands', () => {
    const fixture = render([turn({ running: true, steps: [pace()] })], { phase: 'thinking', previews: true });
    const figure = card(fixture).querySelector('figure');
    const drawn = chart(fixture);
    fixture.componentRef.setInput('turns', [turn({ running: true, steps: [pace(), step({ callId: 'w1', name: 'show_widget', args: HER, widget: hers() })] })]);
    fixture.detectChanges();
    expect(el(fixture).querySelectorAll('kassandra-widget')).toHaveLength(1);
    expect(card(fixture).querySelector('figure')).toBe(figure);
    expect(chart(fixture)).toBe(drawn);
    expect(card(fixture).hasAttribute('data-preview')).toBe(false);
    expect(card(fixture).querySelector('.k-preview')).toBeNull();
    expect(text(card(fixture).querySelector('h3'))).toBe(HER.title);
    expect(card(fixture).querySelector('[role=radiogroup]')?.getAttribute('aria-label')).toBe(`View as: ${HER.title}`);
  });

  it('leaves the preview as a normal chart once the answer is final and she drew none, and stops offering "Show this as a chart"', () => {
    const done = turn({ answer: 'Lisbon is 17.4% behind.', steps: [pace()] });
    const fixture = render([done], { previews: true, suggest: true });
    expect(card(fixture).getAttribute('data-phase')).toBe('ready');
    expect(card(fixture).querySelector('.k-preview')).toBeNull();
    expect(button(fixture, 'Add to board')).toBeDefined();
    expect(button(fixture, 'Show this as a chart')).toBeUndefined();
    expect(button(render([done], { suggest: true }), 'Show this as a chart')).toBeDefined();
  });

  it('remembers "View as" for a chart of an answer, through the preview becoming Kassandra’s chart', () => {
    const fixture = render([turn({ running: true, steps: [pace()] })], { phase: 'thinking', previews: true });
    radio(fixture, 'Table').click();
    fixture.detectChanges();
    expect(chart(fixture).getAttribute('data-kind')).toBe('table');
    expect(TestBed.inject(ViewAsMemory).kind('answer:c1')).toBe('table');

    fixture.componentRef.setInput('turns', [turn({ answer: 'Lisbon is behind.', steps: [pace(), step({ callId: 'w1', name: 'show_widget', args: HER, widget: hers() })] })]);
    fixture.detectChanges();
    expect(chart(fixture).getAttribute('data-kind')).toBe('table');
    expect(radio(fixture, 'Table').getAttribute('aria-checked')).toBe('true');
    expect(text(radio(fixture, 'Bar'))).toBe('Bar, Recommended'); // her kind is the recommendation
  });

  it('saves the kind on screen with "Add to board", in a spec the server accepts', async () => {
    vi.useRealTimers();
    const fixture = render([turn({ answer: 'Lisbon is behind.', steps: [pace(), step({ callId: 'w1', name: 'show_widget', args: HER, widget: hers() })] })], { previews: true });
    radio(fixture, 'Table').click();
    fixture.detectChanges();
    const sent: Record<string, unknown>[] = [];
    const fetched = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      if ((init?.method ?? 'GET') === 'GET') return new Response('[]', { status: 200 });
      const body = JSON.parse(String(init!.body)) as Record<string, unknown>;
      sent.push(body);
      return new Response(JSON.stringify({ id: 'w9', spec: body['spec'], rows: [], columns: [], evidence: evidence(), addedAt: '2026-11-20T22:00:00Z' }), { status: 200 });
    });
    const picker = fixture.debugElement.query((node) => node.name === 'kassandra-board-picker').componentInstance as { add(id: string, name: string): Promise<void> };
    await picker.add('b1', 'Lisbon');
    expect(sent[0]!['spec']).toEqual({ kind: 'table', title: HER.title, subtitle: HER.subtitle, sourceCallId: 'c1' });
    expect(sent[0]!['rows']).toEqual(paceRows);
    expect(sent[0]!['columns']).toEqual(paceEvidence().columns);
    fetched.mockRestore();
  });

  it('never draws more than three charts for an answer', () => {
    const steps = ['c1', 'c2', 'c3', 'c4', 'c5'].map((callId) => pace({ callId, name: 'get_metric', args: { metric: `m_${callId}` }, rows: [...paceRows] }));
    const fixture = render([turn({ answer: 'Done.', steps })], { previews: true });
    expect(el(fixture).querySelectorAll('kassandra-widget')).toHaveLength(3);
  });
});

describe('KassandraConversation: what the person can do', () => {
  it('offers next questions under the last answer only, and reports the one picked', () => {
    const answered = (key: string) => turn({ key, answer: 'Lisbon is behind.', steps: [step({ rows: [{}, {}] })] });
    const fixture = render([answered('t1'), answered('t2')], { suggest: true });
    const lists = el(fixture).querySelectorAll('ul[aria-label="Ask next"]');
    expect(lists).toHaveLength(1);
    expect(el(fixture).querySelectorAll('kassandra-turn')[1]!.contains(lists[0]!)).toBe(true);
    const picked: string[] = [];
    fixture.componentInstance.suggestionPicked.subscribe((question) => picked.push(question));
    button(fixture, 'Which segments are behind last year?')!.click();
    expect(picked).toEqual(['Which segments are behind last year?']);
  });

  it('offers no next questions unless the host asks for them', () => {
    const fixture = render([turn({ answer: 'Lisbon is behind.', steps: [step({ rows: [{}, {}] })] })]);
    expect(el(fixture).querySelector('ul[aria-label="Ask next"]')).toBeNull();
  });

  it('shows Stop beside what Kassandra is doing when the host can stop her', () => {
    expect(button(render([turn({ running: true })], { phase: 'thinking' }), 'Stop')).toBeUndefined();
    const fixture = render([turn({ running: true })], { phase: 'thinking', stoppable: true });
    let stopped = 0;
    fixture.componentInstance.stopped.subscribe(() => stopped++);
    button(fixture, 'Stop')!.click();
    expect(stopped).toBe(1);
  });

  it('reports a step’s "Behind the numbers" with its turn', () => {
    const fixture = render([turn({ key: 't7', answer: 'x', steps: [step({ callId: 'c5', evidence: evidence() })] })]);
    const picked: EvidenceSelection[] = [];
    fixture.componentInstance.evidenceSelected.subscribe((selection) => picked.push(selection));
    button(fixture, 'Worked for')!.click();
    fixture.detectChanges();
    button(fixture, 'Behind the numbers')!.click();
    expect(picked).toEqual([{ turnKey: 't7', callId: 'c5', widgetCallId: undefined }]);
  });
});
