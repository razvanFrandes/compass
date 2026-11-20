import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { ChatLive } from '@compass/contracts';
import type { ChatTurn } from './api';
import { ChatTurnView } from './chat-turn';

function turn(over: Partial<ChatTurn> = {}): ChatTurn {
  return {
    key: 't1',
    question: 'Why is Lisbon behind?',
    pending: false,
    steps: [],
    answer: null,
    streamingText: '',
    running: true,
    failure: null,
    workedMs: null,
    model: null,
    usage: { tokens: 0, costUsd: 0 },
    events: [],
    ...over,
  };
}

function render(t: ChatTurn, phase: ChatLive['phase'] | null) {
  TestBed.configureTestingModule({ providers: [provideHttpClient()] });
  const fixture = TestBed.createComponent(ChatTurnView);
  fixture.componentRef.setInput('turn', t);
  fixture.componentRef.setInput('phase', phase);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector('[role=status]')?.textContent?.trim() ?? null;
}

describe('ChatTurnView phase', () => {
  it('says what Kassandra is doing while no answer text has arrived', () => {
    expect(render(turn(), 'thinking')).toBe('Thinking…');
  });

  it('names tool calls as checking the data', () => {
    expect(render(turn(), 'tools')).toBe('Checking the data…');
  });

  it('says writing when the phase is writing but no text has landed yet', () => {
    expect(render(turn(), 'writing')).toBe('Writing…');
  });

  it('falls back to thinking before the server sends a phase', () => {
    expect(render(turn(), null)).toBe('Thinking…');
  });

  it('gives way to the streaming text', () => {
    expect(render(turn({ streamingText: 'Lisbon is 17% behind' }), 'writing')).toBeNull();
  });

  it('shows nothing once the turn is finished', () => {
    expect(render(turn({ running: false, answer: 'Done.' }), 'idle')).toBeNull();
  });
});
