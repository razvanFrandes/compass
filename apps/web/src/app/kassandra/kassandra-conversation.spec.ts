import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { ChatLive } from '@compass/contracts';
import type { ChatTurn } from '../api';
import { KassandraConversation, type EvidenceSelection } from './kassandra-conversation';
import { evidence, step, turn, widget } from './testing';

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
    expect(items[0]).toContain('Pace vs last year · LIS · 2 rows');
    expect(items[1]).toContain('Pickup in the last days · LIS · failed');
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
    expect(text(el(fixture).querySelector('[role=alert]'))).toBe('No answer this time: it took too many steps (12 turns)');
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
    expect(figure.querySelector('juyo-widget-chart')).not.toBeNull();
    expect(text(figure)).toContain('980');
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
      expect(text(card(fixture))).toContain('980');
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

  it('reports which tool result a widget’s "How this was computed" is about', () => {
    const fixture = render([withWidget()]);
    const picked: EvidenceSelection[] = [];
    fixture.componentInstance.evidenceSelected.subscribe((selection) => picked.push(selection));
    (el(fixture).querySelector('kassandra-widget figure button') as HTMLButtonElement).click();
    expect(picked).toEqual([{ turnKey: 't1', callId: 'c1' }]);
  });

  it('saves a widget on the chosen board with the rows it was drawn from', async () => {
    const fixture = render([withWidget()]);
    const http = TestBed.inject(HttpTestingController);
    const picker = fixture.debugElement.query((node) => node.name === 'kassandra-board-picker').componentInstance as { add(id: string, name: string): Promise<void> };
    const adding = picker.add('b1', 'Lisbon');
    const request = http.expectOne('/api/boards/b1/widgets');
    expect(request.request.method).toBe('POST');
    const body = request.request.body as Record<string, unknown>;
    expect(body['spec']).toEqual({ kind: 'bar', title: 'Lisbon is 15.9% behind last year for December', subtitle: 'Arbor Lisbon Chiado · December 2026', sourceCallId: 'c1', x: 'segment', y: ['rooms'] });
    expect(body['rows']).toEqual(widget().rows);
    expect(body['question']).toBe('Why is Lisbon behind?');
    request.flush({ id: 'w9', spec: body['spec'], rows: [], columns: [], evidence: evidence(), addedAt: '2026-11-20T22:00:00Z' });
    await adding;
    fixture.detectChanges();
    expect(text(button(fixture, 'On Lisbon'))).toBe('On Lisbon · View');
    http.verify();
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

  it('reports a step’s "How this was computed" with its turn', () => {
    const fixture = render([turn({ key: 't7', answer: 'x', steps: [step({ callId: 'c5', evidence: evidence() })] })]);
    const picked: EvidenceSelection[] = [];
    fixture.componentInstance.evidenceSelected.subscribe((selection) => picked.push(selection));
    button(fixture, 'Worked for')!.click();
    fixture.detectChanges();
    button(fixture, 'How this was computed')!.click();
    expect(picked).toEqual([{ turnKey: 't7', callId: 'c5' }]);
  });
});
