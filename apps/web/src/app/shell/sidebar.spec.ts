import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOCKET_FACTORY } from '../api';
import { FakeSocket } from '../api/testing';
import { CompassStore } from '../store';
import type { NavItem } from './nav';
import { Sidebar } from './sidebar';
import { SIDEBAR_STORAGE_KEY, SidebarState } from './sidebar-state';

@Component({
  imports: [Sidebar],
  template: `<nav appSidebar [items]="items"></nav><input id="ask" />`,
})
class Host {
  readonly items: NavItem[] = [
    { view: 'inbox', label: 'Inbox', icon: 'phosphorTrayLight', iconActive: 'phosphorTrayFill', count: 7 },
    { view: 'boards', label: 'Boards', icon: 'phosphorSquaresFourLight', iconActive: 'phosphorSquaresFourFill', count: 0 },
    { view: 'watchers', label: 'Agent Studio', icon: 'phosphorLightningLight', iconActive: 'phosphorLightningFill', count: 1 },
  ];
}

const THREADS = [
  { id: 'c-1', title: 'Why is Lisbon pacing behind?', at: Date.now() - 5 * 60_000 },
  { id: 'c-2', title: 'ADR by segment, December', at: Date.now() - 3 * 3_600_000 },
];

describe('Sidebar', () => {
  let fixture: ComponentFixture<Host>;
  let root: HTMLElement;
  let nav: HTMLElement;

  /** The API is not there: every request gets a 404, and the app works on what it has built in (the 20 hotels). */
  const answer = () => {
    for (const request of TestBed.inject(HttpTestingController).match(() => true)) if (!request.cancelled) request.flush({ error: 'Not found.' }, { status: 404, statusText: 'Not Found' });
  };
  const settle = async () => {
    fixture.detectChanges();
    answer();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const toggle = () => nav.querySelector<HTMLButtonElement>('.rail-toggle')!;
  const press = (init: KeyboardEventInit, target: EventTarget = document.body) => target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
  /** What a screen reader calls it: the label, or the text inside. */
  const name = (el: Element) => (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();

  async function render({ saved, threads = THREADS }: { saved?: 'collapsed' | 'expanded'; threads?: typeof THREADS } = {}) {
    localStorage.clear();
    if (saved) localStorage.setItem(SIDEBAR_STORAGE_KEY, saved);
    localStorage.setItem('compass.conversations', JSON.stringify(threads));
    history.replaceState(null, '', '/');
    FakeSocket.reset();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: SOCKET_FACTORY, useValue: (url: string) => new FakeSocket(url) }] });
    fixture = TestBed.createComponent(Host);
    root = fixture.nativeElement as HTMLElement;
    document.body.appendChild(root);
    await settle();
    await settle();
    nav = root.querySelector('nav')!;
  }
  afterEach(() => {
    root.remove();
    document.querySelector('.cdk-overlay-container')?.replaceChildren();
  });

  it('is the Main navigation landmark, expanded: the wordmark, labels, the thread list and a two-item foot', async () => {
    await render();
    expect(nav.getAttribute('aria-label')).toBe('Main');
    expect(nav.hasAttribute('data-collapsed')).toBe(false);
    expect(nav.querySelector('.rail-logo app-compass-logo')?.getAttribute('data-variant')).toBe('full');
    expect(nav.querySelector('.rail-logo .word')?.textContent).toBe('Compass');
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(toggle().getAttribute('aria-label')).toBe('Collapse sidebar');
    expect(toggle().getAttribute('aria-controls')).toBe(nav.id);
    expect(nav.querySelector('kassandra-thread-list')?.textContent).toContain('Why is Lisbon pacing behind?');
    expect(nav.querySelector('app-rail-threads')).toBeNull();
    expect(nav.querySelector('.sw-side')?.hasAttribute('data-compact')).toBe(false);
    // Recent, in sentence case, with a way to start a new conversation; grouped by day, no time on the rows.
    const recent = nav.querySelector('kassandra-thread-list')!;
    expect(recent.querySelector('h2')?.textContent?.trim()).toBe('Recent');
    expect(recent.querySelector('.k-recent-new')?.getAttribute('aria-label')).toBe('New conversation');
    expect([...recent.querySelectorAll('h3')].map((h) => h.textContent?.trim()).every((label) => ['Today', 'Yesterday'].includes(label!))).toBe(true);
    expect(recent.querySelector('.k-thread-title')?.textContent).toBe('Why is Lisbon pacing behind?');
    expect(recent.textContent).not.toMatch(/\b5 min\b|\b3 h\b/);
    // The foot is the person: avatar, name and role, a button that opens their menu. No controls, no links, no note.
    expect([...nav.querySelectorAll('.rail-foot button')].map(name)).toEqual(['Ana Pop, Revenue manager']);
    expect(nav.querySelector('.rail-foot button')?.getAttribute('aria-haspopup')).toBe('menu');
    expect(nav.querySelector('app-theme-switcher, app-density-switch')).toBeNull();
    expect(nav.textContent).not.toContain('Theme lab');
    expect(nav.textContent).not.toContain('fictional');
  });

  it('collapsed, is a rail of icons: the mark, the scope with its hotel count, badges, one Threads button', async () => {
    await render({ saved: 'collapsed' });
    expect(nav.hasAttribute('data-collapsed')).toBe(true);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(toggle().getAttribute('aria-label')).toBe('Expand sidebar');
    // The mark alone, not the wordmark.
    expect(nav.querySelector('.rail-logo app-compass-logo')?.getAttribute('data-variant')).toBe('mark');
    expect(nav.querySelector('.rail-logo .word')).toBeNull();

    const scope = nav.querySelector<HTMLButtonElement>('.sw-side')!;
    expect(scope.hasAttribute('data-compact')).toBe(true);
    expect(scope.querySelector('.sw-count')?.textContent?.trim()).toBe('20');
    expect(scope.getAttribute('aria-haspopup')).toBe('dialog');
    expect(name(scope)).toContain('20 hotels · 16 countries');

    const items = [...nav.querySelectorAll<HTMLButtonElement>('ul .rail-item')];
    expect(items.map((item) => item.querySelector('.rail-label')?.textContent)).toEqual(['Inbox', 'Boards', 'Agent Studio']);
    expect(items.map((item) => item.querySelector('.rail-count')?.textContent?.replace(/\s+/g, ' ').trim() ?? '')).toEqual([', 7 waiting', '', ', 1 waiting']);
    expect(items.map((item) => item.getAttribute('aria-current'))).toEqual(['page', null, null]);

    expect(nav.querySelector('kassandra-thread-list')).toBeNull();
    const threads = nav.querySelector<HTMLButtonElement>('app-rail-threads button')!;
    expect(threads.getAttribute('aria-label')).toBe('Recent conversations');
    expect(threads.getAttribute('aria-haspopup')).toBe('menu');

    // The foot is the same person, as the avatar alone.
    expect([...nav.querySelectorAll('.rail-foot button')].map(name)).toEqual(['Ana Pop, Revenue manager']);
    expect(nav.querySelector('[popovertarget]')).toBeNull();
    expect(nav.textContent).not.toContain('fictional');
  });

  it('gives every control in the rail a name', async () => {
    await render({ saved: 'collapsed' });
    const controls = [...nav.querySelectorAll('a, button')];
    expect(controls.length).toBeGreaterThanOrEqual(9);
    for (const control of controls) expect(name(control), control.outerHTML.slice(0, 80)).not.toBe('');
    expect(controls.map(name).slice(0, 2)).toEqual(['Compass, morning brief', 'Expand sidebar']);
  });

  it('marks the current place, in the rail as in the panel', async () => {
    await render({ saved: 'collapsed' });
    TestBed.inject(CompassStore).go('boards');
    await settle();
    const current = nav.querySelectorAll('[aria-current=page]');
    expect(current).toHaveLength(1);
    expect(current[0]!.classList.contains('rail-item--active')).toBe(true);
    expect(current[0]!.textContent).toContain('Boards');
  });

  it('the button collapses and expands, and the choice is remembered', async () => {
    await render();
    toggle().focus();
    toggle().click();
    await settle();
    expect(nav.hasAttribute('data-collapsed')).toBe(true);
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('collapsed');
    expect(document.activeElement).toBe(toggle());
    toggle().click();
    await settle();
    expect(nav.hasAttribute('data-collapsed')).toBe(false);
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('expanded');
  });

  it('"[" and ⌘\\ / Ctrl+\\ do the same from the keyboard, but "[" is a character while typing', async () => {
    await render();
    const sidebar = TestBed.inject(SidebarState);
    press({ key: '[' });
    expect(sidebar.collapsed()).toBe(true);
    press({ key: '\\', metaKey: true });
    expect(sidebar.collapsed()).toBe(false);
    press({ key: '\\', ctrlKey: true });
    expect(sidebar.collapsed()).toBe(true);
    await settle();
    expect(nav.hasAttribute('data-collapsed')).toBe(true);

    const ask = root.querySelector<HTMLInputElement>('#ask')!;
    press({ key: '[' }, ask);
    expect(sidebar.collapsed()).toBe(true);
    press({ key: '\\', metaKey: true }, ask);
    expect(sidebar.collapsed()).toBe(false);
  });

  it('leaves the keyboard to a modal dialog', async () => {
    await render();
    const dialog = document.createElement('dialog');
    document.body.appendChild(dialog);
    // jsdom has no showModal(): like the hotel picker there, the dialog opens by its attribute.
    dialog.setAttribute('open', '');
    try {
      press({ key: '[' });
      press({ key: '\\', metaKey: true });
      expect(TestBed.inject(SidebarState).collapsed()).toBe(false);
      dialog.removeAttribute('open');
      press({ key: '[' });
      expect(TestBed.inject(SidebarState).collapsed()).toBe(true);
    } finally {
      dialog.remove();
    }
  });

  it('moves the focus to the button when the control that had it goes away', async () => {
    await render();
    const thread = nav.querySelector<HTMLButtonElement>('.k-thread-open')!;
    thread.focus();
    press({ key: '[' }, thread);
    await settle();
    expect(nav.querySelector('.k-thread-open')).toBeNull();
    expect(document.activeElement).toBe(toggle());
  });

  describe('Recent', () => {
    const row = (title: string) => [...nav.querySelectorAll<HTMLElement>('.k-thread')].find((r) => r.querySelector('.k-thread-title')?.textContent === title)!;

    it('shows the title and the takeaway the server wrote, and a small icon for the answer', async () => {
      await render({ threads: [{ id: 'c-1', title: 'Tessera Dubai: business mix', summary: 'Corporate down 12% vs last year', kind: 'chart', named: true, at: Date.now() - 60_000 } as never] });
      const r = row('Tessera Dubai: business mix');
      expect(r.querySelector('.k-thread-summary')?.textContent).toBe('. Corporate down 12% vs last year');
      expect(r.querySelector('ng-icon.k-thread-icon')?.getAttribute('data-icon')).toBe('phosphorChartBarLight');
    });

    it('marks the current conversation', async () => {
      await render();
      nav.querySelector<HTMLButtonElement>('.k-thread-open')!.click();
      await settle();
      expect(nav.querySelectorAll('.k-thread--current')).toHaveLength(1);
      expect(nav.querySelector('.k-thread--current .k-thread-open')?.getAttribute('aria-current')).toBe('page');
    });

    it('renames in place: Enter keeps it (on the server too), Esc leaves it', async () => {
      await render();
      const http = TestBed.inject(HttpTestingController);
      row('ADR by segment, December').querySelector<HTMLButtonElement>('[aria-label="Rename ADR by segment, December"]')!.click();
      await settle();
      const field = nav.querySelector<HTMLInputElement>('.k-thread-input')!;
      expect(document.activeElement).toBe(field);
      field.value = 'ADR, December';
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      fixture.detectChanges();
      expect(http.match((r) => r.method === 'PATCH').map((r) => [r.request.url, r.request.body])).toEqual([['/api/kassandra/conversations/c-2', { title: 'ADR, December' }]]);
      await settle();
      expect(row('ADR, December')).toBeTruthy();
    });

    it('deletes with Undo, and the focus goes to New conversation', async () => {
      await render();
      row('Why is Lisbon pacing behind?').querySelector<HTMLButtonElement>('[aria-label="Delete Why is Lisbon pacing behind?"]')!.click();
      await settle();
      expect(row('Why is Lisbon pacing behind?')).toBeUndefined();
      expect(document.activeElement).toBe(nav.querySelector('.k-recent-new'));
    });

    it('New conversation starts an empty one', async () => {
      await render();
      nav.querySelector<HTMLButtonElement>('.k-recent-new')!.click();
      await settle();
      expect(TestBed.inject(CompassStore).view()).toBe('thread');
      expect(nav.querySelector('.k-thread--current')).toBeNull();
    });
  });

  it('Threads in the rail opens the list as a menu, and a thread opens from there', async () => {
    await render({ saved: 'collapsed' });
    const threads = nav.querySelector<HTMLButtonElement>('app-rail-threads button')!;
    threads.click();
    await settle();
    expect(threads.getAttribute('aria-expanded')).toBe('true');
    const items = [...document.querySelectorAll<HTMLElement>('[role=menu] [role=menuitem]')];
    expect(items.map((item) => item.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['New conversation', 'Why is Lisbon pacing behind?', 'ADR by segment, December']);
    items[2]!.click();
    await settle();
    expect(TestBed.inject(CompassStore).view()).toBe('thread');
    expect(document.querySelector('[role=menu]')).toBeNull();
  });

  it('with no conversations yet, the rail still offers a new one', async () => {
    await render({ saved: 'collapsed', threads: [] });
    nav.querySelector<HTMLButtonElement>('app-rail-threads button')!.click();
    await settle();
    expect([...document.querySelectorAll('[role=menu] [role=menuitem]')].map((item) => item.textContent?.trim())).toEqual(['New conversation']);
  });
});
