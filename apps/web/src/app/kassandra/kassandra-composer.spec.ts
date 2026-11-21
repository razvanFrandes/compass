import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { KassandraComposer } from './kassandra-composer';
import { VoiceInput, type VoiceEvents } from './voice/voice-input';

class FakeVoice {
  events: VoiceEvents | null = null;
  starts = 0;
  stops = 0;
  async start(events: VoiceEvents) {
    this.starts++;
    this.events = events;
  }
  finishing: (() => void) | null = null;
  /** Like Soniox: the last words arrive a moment after Send. */
  finish(done: () => void) {
    this.finishing = done;
  }
  stop() {
    this.stops++;
    this.finishing = null;
  }
  level() {
    return 0.5;
  }
  bands(count: number) {
    return Array.from({ length: count }, () => 0.25);
  }
}

let voice: FakeVoice;

function render(inputs: Record<string, unknown> = {}) {
  voice = new FakeVoice();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  TestBed.overrideComponent(KassandraComposer, { remove: { providers: [VoiceInput] }, add: { providers: [{ provide: VoiceInput, useValue: voice }] } });
  const fixture = TestBed.createComponent(KassandraComposer);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  const sent: string[] = [];
  fixture.componentInstance.submitted.subscribe((text) => sent.push(text));
  return { fixture, sent };
}

const el = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;
const text = (node: Element | null | undefined) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
const byLabel = (fixture: ComponentFixture<unknown>, label: string) => el(fixture).querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
const field = (fixture: ComponentFixture<unknown>) => el(fixture).querySelector('textarea')!;

function type(fixture: ComponentFixture<unknown>, value: string) {
  field(fixture).value = value;
  field(fixture).dispatchEvent(new Event('input'));
  fixture.detectChanges();
}
const key = (target: EventTarget, name: string, init: KeyboardEventInit = {}) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }));

describe('KassandraComposer: text', () => {
  it('labels its field and shows Send only when there is text', () => {
    const { fixture } = render({ label: 'Ask Kassandra', inputId: 'ask-1' });
    expect(text(el(fixture).querySelector('label[for=ask-1]'))).toBe('Ask Kassandra');
    expect(byLabel(fixture, 'Send')).toBeNull();
    expect(byLabel(fixture, 'Ask with your voice')).not.toBeNull();
    type(fixture, 'Why is Lisbon behind?');
    expect(byLabel(fixture, 'Send')).not.toBeNull();
  });

  it('sends on Enter, trimmed, and empties the field; Shift+Enter is a new line', () => {
    const { fixture, sent } = render();
    type(fixture, '  Why is Lisbon behind?  ');
    key(field(fixture), 'Enter', { shiftKey: true });
    expect(sent).toEqual([]);
    key(field(fixture), 'Enter');
    fixture.detectChanges();
    expect(sent).toEqual(['Why is Lisbon behind?']);
    expect(field(fixture).value).toBe('');
  });

  it('offers Stop while Kassandra answers, and Send again once there is text to add', () => {
    const { fixture, sent } = render({ busy: true, steerable: true });
    let stopped = 0;
    fixture.componentInstance.stopped.subscribe(() => stopped++);
    byLabel(fixture, 'Stop Kassandra')!.click();
    expect(stopped).toBe(1);
    type(fixture, 'Use last year instead');
    expect(byLabel(fixture, 'Stop Kassandra')).toBeNull();
    byLabel(fixture, 'Send')!.click();
    expect(sent).toEqual(['Use last year instead']);
  });

  it('places a pre-filled question without sending it', () => {
    const { fixture, sent } = render({ prefill: { text: 'Which nights are behind?', n: 1 } });
    fixture.detectChanges();
    expect(field(fixture).value).toBe('Which nights are behind?');
    expect(sent).toEqual([]);
  });

  it('keeps the text while offline', () => {
    const { fixture, sent } = render({ online: false });
    type(fixture, 'Hello');
    expect(byLabel(fixture, 'Send')!.getAttribute('aria-disabled')).toBe('true');
    key(field(fixture), 'Enter');
    expect(sent).toEqual([]);
    expect(field(fixture).value).toBe('Hello');
  });
});

describe('KassandraComposer: Quick or Thinker', () => {
  const radios = (fixture: ComponentFixture<unknown>) => [...el(fixture).querySelectorAll<HTMLElement>('[role=radio]')];

  it('is a labelled radio group with one checked radio in the tab order', () => {
    const { fixture } = render();
    const group = el(fixture).querySelector('[role=radiogroup]')!;
    expect(group.getAttribute('aria-label')).toBe('Answer mode');
    // What each mode means is the radio's tooltip (and its description for a screen reader), not a line of text.
    expect(radios(fixture).map((r) => r.getAttribute('title'))).toEqual(['A fast answer from one trusted source', 'Works across several sources; takes longer']);
    expect(el(fixture).textContent).not.toContain('takes longer');
    expect(radios(fixture).map((r) => [text(r), r.getAttribute('aria-checked'), r.getAttribute('tabindex')])).toEqual([
      ['Quick', 'false', '-1'],
      ['Thinker', 'true', '0'],
    ]);
  });

  it('selects on click and with the arrow keys, Home and End, wrapping at the ends', () => {
    const { fixture } = render();
    const mode = () => fixture.componentInstance.mode();
    radios(fixture)[0]!.click();
    expect(mode()).toBe('quick');
    fixture.detectChanges();
    expect(radios(fixture)[0]!.getAttribute('aria-checked')).toBe('true');
    key(radios(fixture)[0]!, 'ArrowRight');
    expect(mode()).toBe('thinker');
    key(radios(fixture)[1]!, 'ArrowDown');
    expect(mode()).toBe('quick');
    key(radios(fixture)[0]!, 'ArrowLeft');
    expect(mode()).toBe('thinker');
    key(radios(fixture)[1]!, 'Home');
    expect(mode()).toBe('quick');
    key(radios(fixture)[0]!, 'End');
    expect(mode()).toBe('thinker');
  });

  it('is left out where the host has one model only', () => {
    expect(el(render({ showMode: false }).fixture).querySelector('[role=radiogroup]')).toBeNull();
  });
});

describe('KassandraComposer: nothing repeated under the field', () => {
  it('shows no scope chip: the hotel scope is in the sidebar and the page header', () => {
    const { fixture } = render();
    expect(el(fixture).querySelector('.scope-chip')).toBeNull();
    expect(el(fixture).textContent).not.toContain('All 20 hotels');
  });
});

describe('KassandraComposer: voice', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function listen(inputs: Record<string, unknown> = {}) {
    const rendered = render(inputs);
    byLabel(rendered.fixture, 'Ask with your voice')!.click();
    rendered.fixture.detectChanges();
    return rendered;
  }
  const status = (fixture: ComponentFixture<unknown>) => text(el(fixture).querySelector('form p'));
  const announced = (fixture: ComponentFixture<unknown>) => text(el(fixture).querySelector('.voice-announcer'));
  const hint = (fixture: ComponentFixture<unknown>) => text(el(fixture).querySelector('.voice-hint'));
  function say(fixture: ComponentFixture<unknown>, final: string, partial = '') {
    voice.events!.onListening(null);
    voice.events!.onTranscript(final, partial);
    fixture.detectChanges();
  }

  it('opens the microphone on the mic button and hosts the orb, fed with the voice', () => {
    const { fixture } = listen();
    expect(voice.starts).toBe(1);
    expect(status(fixture)).toBe('Allow the microphone to talk to Kassandra');
    voice.events!.onListening(null);
    vi.advanceTimersByTime(40);
    fixture.detectChanges();
    expect(status(fixture)).toBe('Listening…');
    expect(el(fixture).querySelector('juyo-orb')).not.toBeNull();
  });

  it('shows the words while they are spoken: final ones plain, the provisional tail muted', () => {
    const { fixture } = listen();
    say(fixture, 'Why is', ' Lisabona în urmă');
    const spans = [...el(fixture).querySelectorAll('.voice-words span')];
    expect(spans.map((s) => s.textContent)).toEqual(['Why is', ' Lisabona în urmă']);
    expect(spans[1]!.className).toContain('text-muted-foreground');
  });

  it('while listening, shows Stop and Send side by side with the hint, and puts the focus on Send', () => {
    const { fixture } = listen();
    document.body.appendChild(el(fixture));
    say(fixture, 'Why is Lisbon behind?');
    expect(text(byLabel(fixture, 'Stop listening'))).toBe('Stop');
    expect(byLabel(fixture, 'Send what I said')!.getAttribute('type')).toBe('submit');
    expect(hint(fixture)).toBe('Send when you’re done');
    vi.advanceTimersByTime(100);
    expect(document.activeElement).toBe(byLabel(fixture, 'Send what I said'));
    el(fixture).remove();
  });

  it('never sends on its own: the person pauses for minutes and the words just stay', () => {
    const { fixture, sent } = listen();
    say(fixture, 'Why is Lisbon');
    vi.advanceTimersByTime(4 * 60_000);
    say(fixture, 'Why is Lisbon', ' behind last year?');
    vi.advanceTimersByTime(30_000);
    fixture.detectChanges();
    expect(sent).toEqual([]);
    expect(voice.stops).toBe(0);
    expect(voice.finishing).toBeNull();
    expect(status(fixture)).toBe('Listening…');
    expect(text(el(fixture).querySelector('.voice-words'))).toBe('Why is Lisbon behind last year?');
  });

  it('sends on Send: listening stops, the last words are waited for, then the whole question goes', () => {
    const { fixture, sent } = listen();
    say(fixture, 'Why is Lisbon', ' behind');
    byLabel(fixture, 'Send what I said')!.click();
    fixture.detectChanges();
    expect(status(fixture)).toBe('Sending…');
    expect(sent).toEqual([]);
    voice.events!.onTranscript('Why is Lisbon behind last year?', '');
    voice.finishing!();
    fixture.detectChanges();
    expect(sent).toEqual(['Why is Lisbon behind last year?']);
    expect(voice.stops).toBeGreaterThan(0);
    expect(field(fixture).value).toBe('');
    expect(announced(fixture)).toBe('Stopped. Sent.');
  });

  it('sends on Enter while listening', () => {
    const { fixture, sent } = listen();
    say(fixture, 'Show pace for Dubai');
    el(fixture).querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    voice.finishing!();
    expect(sent).toEqual(['Show pace for Dubai']);
  });

  it('does nothing on Send before a word was heard', () => {
    const { fixture, sent } = listen();
    voice.events!.onListening(null);
    fixture.detectChanges();
    expect(byLabel(fixture, 'Send what I said')!.getAttribute('aria-disabled')).toBe('true');
    byLabel(fixture, 'Send what I said')!.click();
    fixture.detectChanges();
    expect(sent).toEqual([]);
    expect(voice.finishing).toBeNull();
    expect(status(fixture)).toBe('Listening…');
  });

  it('keeps the words in the field on Stop, to be edited and sent by hand', () => {
    const { fixture, sent } = listen();
    say(fixture, 'Why is Lisbon', ' behind?');
    byLabel(fixture, 'Stop listening')!.click();
    vi.advanceTimersByTime(400);
    fixture.detectChanges();
    expect(sent).toEqual([]);
    expect(voice.stops).toBeGreaterThan(0);
    expect(field(fixture).value).toBe('Why is Lisbon behind?');
    byLabel(fixture, 'Send')!.click();
    expect(sent).toEqual(['Why is Lisbon behind?']);
  });

  it('keeps the words in the field on Esc', () => {
    const { fixture, sent } = listen();
    say(fixture, 'Why is', ' Lisbon');
    key(document, 'Escape');
    vi.advanceTimersByTime(400);
    fixture.detectChanges();
    expect(sent).toEqual([]);
    expect(voice.stops).toBeGreaterThan(0);
    expect(field(fixture).value).toBe('Why is Lisbon');
    expect(byLabel(fixture, 'Ask with your voice')).not.toBeNull();
  });

  it('stops after five minutes without sending, and says where the words are', () => {
    const { fixture, sent } = listen();
    say(fixture, 'A long question');
    voice.events!.onTimeout();
    fixture.detectChanges();
    expect(sent).toEqual([]);
    expect(field(fixture).value).toBe('A long question');
    expect(text(el(fixture).querySelector(`#${field(fixture).getAttribute('aria-describedby')}`))).toContain('five minutes');
  });

  it('tells a screen reader when listening starts and stops', () => {
    const { fixture } = listen();
    const live = el(fixture).querySelector('.voice-announcer')!;
    expect(live.getAttribute('role')).toBe('status');
    expect(announced(fixture)).toBe('');
    say(fixture, 'Why');
    expect(announced(fixture)).toBe('Listening');
    byLabel(fixture, 'Stop listening')!.click();
    fixture.detectChanges();
    expect(announced(fixture)).toBe('Stopped');
    expect(el(fixture).querySelector('.voice-announcer')).toBe(live); // the same node: a live region must stay in the page
  });

  it('labels the demo transcript, which plays only without a microphone', () => {
    const { fixture } = listen();
    voice.events!.onListening('demo');
    fixture.detectChanges();
    expect(status(fixture)).toBe('No microphone found · this is a sample question');
  });

  it('says why voice is not available and goes back to typing', () => {
    const { fixture } = listen();
    voice.events!.onUnavailable('The microphone is blocked for this page.');
    fixture.detectChanges();
    const notice = el(fixture).querySelector(`#${field(fixture).getAttribute('aria-describedby')}`)!;
    expect(text(notice)).toBe('The microphone is blocked for this page.');
    expect(notice.getAttribute('role')).toBe('status');
  });
});

describe('KassandraComposer: the orb mark', () => {
  const orb = (fixture: ComponentFixture<unknown>) => el(fixture).querySelector<HTMLElement>('juyo-orb');

  it('shows the Lattice orb at rest, 32 px and decorative, instead of the CSS mark', () => {
    const { fixture } = render();
    expect(orb(fixture)).not.toBeNull();
    expect(orb(fixture)!.getAttribute('aria-hidden')).toBe('true');
    expect(orb(fixture)!.style.width).toBe('32px');
    expect(orb(fixture)!.dataset['state']).toBe('idle');
    expect(el(fixture).querySelector('.orb-mark')).toBeNull();
  });

  it('thinks while Kassandra runs and speaks while the answer is written', () => {
    const { fixture } = render({ busy: true, phase: 'thinking' });
    expect(orb(fixture)!.dataset['state']).toBe('thinking');
    fixture.componentRef.setInput('phase', 'tools');
    fixture.detectChanges();
    expect(orb(fixture)!.dataset['state']).toBe('thinking');
    fixture.componentRef.setInput('phase', 'writing');
    fixture.detectChanges();
    expect(orb(fixture)!.dataset['state']).toBe('speaking');
    fixture.componentRef.setInput('busy', false);
    fixture.detectChanges();
    expect(orb(fixture)!.dataset['state']).toBe('idle');
  });

  it('shows no mode description and no scope under the field', () => {
    const { fixture } = render();
    expect(text(el(fixture))).not.toMatch(/takes longer|trusted source|hotels/);
  });
});
