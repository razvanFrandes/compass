import { TestBed } from '@angular/core/testing';
import { ASK_BY_KIND, ASK_GROUPS, FEATURED_ASKS, KIND_NAMES } from '../charts/ask-examples';
import { KIND_ICONS } from '../charts/kind-icons';
import { WIDGET_KINDS } from '../charts/widget-types';
import { KassandraTryAsking } from './kassandra-try-asking';

function render(compact = false) {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(KassandraTryAsking);
  fixture.componentRef.setInput('compact', compact);
  fixture.detectChanges();
  const picked: string[] = [];
  fixture.componentInstance.picked.subscribe((question) => picked.push(question));
  const el: HTMLElement = fixture.nativeElement;
  const buttons = () => [...el.querySelectorAll<HTMLButtonElement>('button.try-q')];
  return { fixture, el, picked, buttons };
}

const all = ASK_GROUPS.flatMap((group) => group.items);

describe('the example questions', () => {
  it('are 8 to 12, each for its own kind of widget', () => {
    expect(all.length).toBeGreaterThanOrEqual(8);
    expect(all.length).toBeLessThanOrEqual(12);
    expect(new Set(all.map((item) => item.kind)).size).toBe(all.length);
    expect(new Set(all.map((item) => item.question)).size).toBe(all.length);
  });

  it('give every widget kind a question, a name and an icon for the catalogue', () => {
    for (const kind of WIDGET_KINDS) {
      expect(ASK_BY_KIND[kind]?.length, kind).toBeGreaterThan(10);
      expect(KIND_NAMES[kind], kind).toBeTruthy();
      expect(KIND_ICONS[kind], kind).toBeTruthy();
    }
    for (const item of all) expect(ASK_BY_KIND[item.kind]).toBe(item.question);
  });
});

describe('kassandra-try-asking', () => {
  it('shows every question under the name of its group', () => {
    const { el, buttons } = render();
    expect(el.textContent).toContain('Try asking');
    expect(buttons().map((button) => button.querySelector('.try-text')!.textContent!.trim())).toEqual(all.map((item) => item.question));
    const lists = [...el.querySelectorAll('ul')];
    expect(lists.map((list) => list.getAttribute('aria-label'))).toEqual(ASK_GROUPS.map((group) => group.title));
    expect(lists.map((list) => list.querySelectorAll('li').length)).toEqual(ASK_GROUPS.map((group) => group.items.length));
  });

  it('draws the icon of the widget kind on each question, and says the kind to a screen reader', () => {
    const { buttons } = render();
    buttons().forEach((button, i) => {
      const icon = button.querySelector('ng-icon')!;
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      expect(icon.querySelector('svg'), all[i]!.kind).not.toBeNull();
      expect(button.querySelector('.sr-only')!.textContent).toContain(KIND_NAMES[all[i]!.kind]);
    });
  });

  it('sends the question at once when it is clicked', () => {
    const { buttons, picked } = render();
    buttons()[1]!.click();
    expect(picked).toEqual([all[1]!.question]);
  });

  it('does not send while Kassandra is busy', () => {
    const { fixture, buttons, picked } = render();
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(buttons().every((button) => button.disabled)).toBe(true);
    buttons()[0]!.click();
    expect(picked).toEqual([]);
  });

  it('compact: shows three questions and opens the rest on request', () => {
    const { fixture, el, buttons, picked } = render(true);
    expect(buttons().map((button) => button.querySelector('.try-text')!.textContent!.trim())).toEqual(FEATURED_ASKS.map((item) => item.question));
    const more = el.querySelector<HTMLButtonElement>('button.try-more')!;
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(more.textContent).toContain(String(all.length));

    more.click();
    fixture.detectChanges();
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector(`#${more.getAttribute('aria-controls')}`)).not.toBeNull();
    // The featured three stay where they were; the full gallery opens under them.
    expect(buttons()).toHaveLength(FEATURED_ASKS.length + all.length);
    buttons().at(-1)!.click();
    expect(picked).toEqual([all.at(-1)!.question]);
  });
});
