import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ScopeService } from '../scope/scope.service';
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
  stop() {
    this.stops++;
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
    expect(text(el(fixture).querySelector(`#${group.getAttribute('aria-describedby')}`))).toBe('Reasons across every source; slower');
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

describe('KassandraComposer: scope chips', () => {
  const chips = (fixture: ComponentFixture<unknown>) => [...el(fixture).querySelectorAll('.scope-chip')].map(text);

  it('shows the global hotel scope and follows it', () => {
    const { fixture } = render();
    expect(chips(fixture)).toEqual(['All 20 hotels']);
    TestBed.inject(ScopeService).set(['LIS']);
    fixture.detectChanges();
    expect(chips(fixture)).toEqual(['Arbor Lisbon Chiado']);
    TestBed.inject(ScopeService).set(['LIS', 'AMS', 'NYC']);
    fixture.detectChanges();
    expect(chips(fixture)).toEqual(['Arbor Lisbon Chiado', '+2 more']);
  });

  it('shows the host’s own subject instead, or nothing', () => {
    expect(chips(render({ scope: ['Lisbon pace', 'LIS'] }).fixture)).toEqual(['Lisbon pace', 'LIS']);
    expect(chips(render({ showScope: false }).fixture)).toEqual([]);
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
  const status = (fixture: ComponentFixture<unknown>) => text(el(fixture).querySelector('[role=status]'));

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
    voice.events!.onListening(null);
    voice.events!.onTranscript('Why is', ' Lisabona în urmă');
    fixture.detectChanges();
    const spans = [...el(fixture).querySelectorAll('form p:not([role]) span')];
    expect(spans.map((s) => s.textContent)).toEqual(['Why is', ' Lisabona în urmă']);
    expect(spans[1]!.className).toContain('text-muted-foreground');
  });

  it('sends the question when the person stops speaking, and closes the microphone', () => {
    const { fixture, sent } = listen();
    voice.events!.onListening(null);
    voice.events!.onTranscript('Why is Lisbon behind?', '');
    voice.events!.onEndpoint();
    fixture.detectChanges();
    expect(status(fixture)).toBe('Sending…');
    expect(voice.stops).toBeGreaterThan(0);
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(300);
    fixture.detectChanges();
    expect(sent).toEqual(['Why is Lisbon behind?']);
    expect(field(fixture)).not.toBeNull();
  });

  it('drops the question on Esc', () => {
    const { fixture, sent } = listen();
    voice.events!.onListening(null);
    voice.events!.onTranscript('Why is', '');
    key(document, 'Escape');
    vi.advanceTimersByTime(400);
    fixture.detectChanges();
    expect(sent).toEqual([]);
    expect(voice.stops).toBeGreaterThan(0);
    expect(byLabel(fixture, 'Ask with your voice')).not.toBeNull();
  });

  it('drops the question on the cancel button, and sends it on Done', () => {
    const cancelled = listen();
    voice.events!.onListening(null);
    voice.events!.onTranscript('Why', '');
    cancelled.fixture.detectChanges();
    byLabel(cancelled.fixture, 'Cancel voice input')!.click();
    vi.advanceTimersByTime(400);
    expect(cancelled.sent).toEqual([]);

    const done = listen();
    voice.events!.onListening(null);
    voice.events!.onTranscript('Show pace for Dubai', '');
    done.fixture.detectChanges();
    byLabel(done.fixture, 'Send what I said')!.click();
    vi.advanceTimersByTime(400);
    expect(done.sent).toEqual(['Show pace for Dubai']);
  });

  it('leaves the words in the field where the host wants them completed first', () => {
    const { fixture, sent } = listen({ voiceSends: false });
    voice.events!.onListening(null);
    voice.events!.onTranscript('Email me when Lisbon falls behind', '');
    voice.events!.onEndpoint();
    vi.advanceTimersByTime(400);
    fixture.detectChanges();
    expect(sent).toEqual([]);
    expect(field(fixture).value).toBe('Email me when Lisbon falls behind');
  });

  it('labels the demo transcript, which plays only without a microphone', () => {
    const { fixture } = listen();
    voice.events!.onListening('demo');
    fixture.detectChanges();
    expect(status(fixture)).toBe('No microphone here · demo transcript');
  });

  it('says why voice is not available and goes back to typing', () => {
    const { fixture } = listen();
    voice.events!.onUnavailable('The microphone is blocked for this page.');
    fixture.detectChanges();
    expect(status(fixture)).toBe('The microphone is blocked for this page.');
    expect(field(fixture).getAttribute('aria-describedby')).toBe(el(fixture).querySelector('[role=status]')!.id);
  });
});
