import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SplitPane } from './split-pane';

const KEY = 'test.split';

@Component({
  imports: [SplitPane],
  template: `
    <juyo-split-pane [storageKey]="key" [(collapsed)]="collapsed" [single]="single()" endLabel="evidence" startLabel="conversation">
      <div paneStart>Conversation</div>
      <aside paneEnd>Evidence</aside>
    </juyo-split-pane>
  `,
})
class Host {
  readonly key = KEY;
  readonly collapsed = signal(false);
  readonly single = signal(false);
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const separator = () => el.querySelector<HTMLElement>('[role=separator]');
  const press = (key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    separator()!.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  };
  const stored = () => JSON.parse(localStorage.getItem(KEY) ?? 'null') as { position: number | null; collapsed: boolean } | null;
  return { fixture, el, separator, press, stored };
}

describe('SplitPane', () => {
  beforeEach(() => localStorage.clear());

  it('is a focusable vertical separator that reports its position', () => {
    const { separator, el } = render();
    const sep = separator()!;
    expect(sep.getAttribute('tabindex')).toBe('0');
    expect(sep.getAttribute('aria-orientation')).toBe('vertical');
    expect(sep.getAttribute('aria-valuenow')).toBe('56');
    expect(sep.getAttribute('aria-valuemin')).toBe('10');
    expect(sep.getAttribute('aria-valuemax')).toBe('90');
    expect(sep.getAttribute('aria-valuetext')).toBe('56% conversation, 44% evidence');
    expect(el.textContent).toContain('Conversation');
    expect(el.textContent).toContain('Evidence');
  });

  it('moves with the arrow keys, Shift for bigger steps, Home and End for the limits', () => {
    const { separator, press } = render();
    const now = () => separator()!.getAttribute('aria-valuenow');
    expect(press('ArrowLeft').defaultPrevented).toBe(true);
    expect(now()).toBe('54');
    press('ArrowRight');
    press('ArrowRight');
    expect(now()).toBe('58');
    press('ArrowLeft', { shiftKey: true });
    expect(now()).toBe('48');
    press('Home');
    expect(now()).toBe('10');
    press('End');
    expect(now()).toBe('90');
  });

  it('leaves other keys alone', () => {
    const { separator, press } = render();
    expect(press('a').defaultPrevented).toBe(false);
    expect(press('ArrowLeft', { metaKey: true }).defaultPrevented).toBe(false);
    expect(separator()!.getAttribute('aria-valuenow')).toBe('56');
  });

  it('sizes the second pane from the position', () => {
    const { el, press } = render();
    press('ArrowLeft');
    expect(el.querySelector<HTMLElement>('.sp-end')!.style.width).toBe('46%');
  });

  it('remembers the position, and a double-click goes back to the default', () => {
    const { separator, press, stored, fixture } = render();
    press('ArrowLeft');
    expect(stored()).toEqual({ position: 54, collapsed: false });
    separator()!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();
    expect(separator()!.getAttribute('aria-valuenow')).toBe('56');
    expect(stored()).toEqual({ position: null, collapsed: false });
  });

  it('restores what was remembered', () => {
    localStorage.setItem(KEY, JSON.stringify({ position: 40, collapsed: false }));
    expect(render().separator()!.getAttribute('aria-valuenow')).toBe('40');
  });

  it('collapses with Enter to a rail whose button brings the pane back', () => {
    const { fixture, el, separator, press, stored } = render();
    press('Enter');
    expect(separator()).toBeNull();
    expect(fixture.componentInstance.collapsed()).toBe(true);
    expect(el.textContent).not.toContain('Evidence');
    expect(stored()).toMatchObject({ collapsed: true });

    const expand = el.querySelector<HTMLButtonElement>('.sp-rail button')!;
    expect(expand.getAttribute('aria-label')).toBe('Show evidence');
    // The folded pane keeps its name on the rail, so it is clear what the button brings back.
    expect(expand.querySelector('.sp-rail-label')!.textContent).toBe('evidence');
    expect(expand.getAttribute('aria-expanded')).toBe('false');
    expand.click();
    fixture.detectChanges();
    expect(separator()).not.toBeNull();
    expect(el.textContent).toContain('Evidence');
    expect(stored()).toMatchObject({ collapsed: false });
  });

  it('starts collapsed when that was remembered', () => {
    localStorage.setItem(KEY, JSON.stringify({ position: null, collapsed: true }));
    const { fixture, separator } = render();
    expect(separator()).toBeNull();
    expect(fixture.componentInstance.collapsed()).toBe(true);
  });

  it('lays out the first pane only when single', () => {
    const { fixture, el, separator } = render();
    fixture.componentInstance.single.set(true);
    fixture.detectChanges();
    expect(separator()).toBeNull();
    expect(el.querySelector('.sp-rail')).toBeNull();
    expect(el.textContent).toContain('Conversation');
  });

  it('follows the pointer while dragging and remembers where it was let go', () => {
    const { fixture, el, separator, stored } = render();
    const host = el.querySelector<HTMLElement>('juyo-split-pane')!;
    host.getBoundingClientRect = () => ({ left: 0, width: 1000, top: 0, height: 800, right: 1000, bottom: 800, x: 0, y: 0, toJSON: () => ({}) });
    const fire = (type: string, clientX: number) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, button: 0 });
      separator()!.dispatchEvent(event);
      fixture.detectChanges();
    };
    fire('pointerdown', 560);
    fire('pointermove', 420);
    expect(separator()!.getAttribute('aria-valuenow')).toBe('42');
    expect(stored()?.position ?? null).not.toBe(42);
    fire('pointerup', 420);
    expect(stored()).toEqual({ position: 42, collapsed: false });
  });
});
