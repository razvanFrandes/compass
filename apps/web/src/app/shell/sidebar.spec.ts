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

  it('is the Main navigation landmark, expanded: the wordmark, labels, the thread list and the note in place', async () => {
    await render();
    expect(nav.getAttribute('aria-label')).toBe('Main');
    expect(nav.hasAttribute('data-collapsed')).toBe(false);
    expect(nav.querySelector('.rail-logo svg')?.getAttribute('viewBox')).toBe('0 0 102 32');
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(toggle().getAttribute('aria-label')).toBe('Collapse sidebar');
    expect(toggle().getAttribute('aria-controls')).toBe(nav.id);
    expect(nav.querySelector('kassandra-thread-list')?.textContent).toContain('Why is Lisbon pacing behind?');
    expect(nav.querySelector('app-rail-threads')).toBeNull();
    expect(nav.querySelector('.sw-side')?.hasAttribute('data-compact')).toBe(false);
    // Theme (two radios) and Mode (three), from the theme switcher's rows.
    expect([...nav.querySelectorAll('app-theme-switcher [role=radio]')].map((radio) => radio.textContent?.trim())).toEqual(['Default', 'Concept', 'Light', 'Dark', 'System']);
    // The density switch sits under the theme, and is its own group.
    expect([...nav.querySelectorAll('app-density-switch [role=radio]')].map((radio) => radio.textContent?.trim())).toEqual(['Comfortable', 'Compact']);
    expect(nav.querySelector('#rail-note')?.hasAttribute('popover')).toBe(false);
    expect(nav.querySelector('[popovertarget]')).toBeNull();
  });

  it('collapsed, is a rail of icons: the mark, the scope with its hotel count, badges, one Threads button', async () => {
    await render({ saved: 'collapsed' });
    expect(nav.hasAttribute('data-collapsed')).toBe(true);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(toggle().getAttribute('aria-label')).toBe('Expand sidebar');
    // The mark alone, not the wordmark.
    expect(nav.querySelector('.rail-logo svg')?.getAttribute('viewBox')).toBe('0 0 32 32');

    const scope = nav.querySelector<HTMLButtonElement>('.sw-side')!;
    expect(scope.hasAttribute('data-compact')).toBe(true);
    expect(scope.querySelector('.sw-count')?.textContent?.trim()).toBe('20');
    expect(scope.getAttribute('aria-haspopup')).toBe('dialog');
    expect(name(scope)).toContain('All 20 hotels');

    const items = [...nav.querySelectorAll<HTMLButtonElement>('ul .rail-item')];
    expect(items.map((item) => item.querySelector('.rail-label')?.textContent)).toEqual(['Inbox', 'Boards', 'Agent Studio']);
    expect(items.map((item) => item.querySelector('.rail-count')?.textContent?.trim() ?? '')).toEqual(['7', '', '1']);
    expect(items.map((item) => item.getAttribute('aria-current'))).toEqual(['page', null, null]);

    expect(nav.querySelector('kassandra-thread-list')).toBeNull();
    const threads = nav.querySelector<HTMLButtonElement>('app-rail-threads button')!;
    expect(threads.getAttribute('aria-label')).toBe('Conversations');
    expect(threads.getAttribute('aria-haspopup')).toBe('menu');

    // Theme and mode are one button with a menu (the theme switcher's "menu" shape); the two rows are for the panel.
    expect(nav.querySelectorAll('app-theme-switcher [role=radio]').length).toBe(0);
    // The density switch is two icons, named.
    const densities = [...nav.querySelectorAll('app-density-switch [role=radio]')];
    expect(densities.map((radio) => radio.getAttribute('aria-label'))).toEqual(['Comfortable', 'Compact']);
    expect(densities.every((radio) => radio.querySelector('ng-icon') !== null)).toBe(true);
    const themeButton = nav.querySelector<HTMLButtonElement>('app-theme-switcher button')!;
    expect(themeButton.getAttribute('aria-label')).toMatch(/^Theme: .+\. Change theme or mode$/);
    expect(themeButton.querySelector('ng-icon')).not.toBeNull();

    // The note about the demo data moves into a popover, behind its own button.
    expect(nav.querySelector('#rail-note')?.getAttribute('popover')).toBe('auto');
    expect(nav.querySelector('[popovertarget="rail-note"]')?.getAttribute('aria-label')).toBe('About this demo');
  });

  it('gives every control in the rail a name', async () => {
    await render({ saved: 'collapsed' });
    const controls = [...nav.querySelectorAll('a, button')];
    expect(controls.length).toBeGreaterThanOrEqual(11);
    for (const control of controls) expect(name(control), control.outerHTML.slice(0, 80)).not.toBe('');
    expect(controls.map(name).slice(0, 2)).toEqual(['Juyo, morning brief', 'Expand sidebar']);
  });

  it('marks the current place, in the rail as in the panel', async () => {
    await render({ saved: 'collapsed' });
    TestBed.inject(CompassStore).go('boards');
    await settle();
    const current = nav.querySelectorAll('[aria-current=page]');
    expect(current).toHaveLength(1);
    expect(current[0]!.classList.contains('rail-item--active')).toBe(true);
    expect(current[0]!.textContent).toContain('Boards');
    TestBed.inject(CompassStore).go('theme-lab');
    await settle();
    expect(nav.querySelector('[aria-current=page]')?.textContent).toContain('Theme lab');
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

  it('Threads in the rail opens the list as a menu, and a thread opens from there', async () => {
    await render({ saved: 'collapsed' });
    const threads = nav.querySelector<HTMLButtonElement>('app-rail-threads button')!;
    threads.click();
    await settle();
    expect(threads.getAttribute('aria-expanded')).toBe('true');
    const items = [...document.querySelectorAll<HTMLElement>('[role=menu] [role=menuitem]')];
    expect(items.map((item) => item.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['Why is Lisbon pacing behind? 5 min', 'ADR by segment, December 3 h']);
    items[1]!.click();
    await settle();
    expect(TestBed.inject(CompassStore).view()).toBe('thread');
    expect(document.querySelector('[role=menu]')).toBeNull();
  });

  it('shows no Threads button when there are no threads', async () => {
    await render({ saved: 'collapsed', threads: [] });
    expect(nav.querySelector('app-rail-threads button')).toBeNull();
  });
});
