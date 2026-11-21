import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOCKET_FACTORY } from '../api';
import { FakeSocket } from '../api/testing';
import { CompassStore } from '../store';
import { MODE_STORAGE_KEY } from '../theme';
import { MobileMenu } from './mobile-menu';
import type { NavItem } from './nav';

const ITEMS: NavItem[] = [
  { view: 'inbox', label: 'Inbox', icon: 'phosphorTrayLight', iconActive: 'phosphorTrayFill', count: 6 },
  { view: 'boards', label: 'Boards', icon: 'phosphorSquaresFourLight', iconActive: 'phosphorSquaresFourFill', count: 0 },
  { view: 'watchers', label: 'Agent Studio', icon: 'phosphorLightningLight', iconActive: 'phosphorLightningFill', count: 1 },
];

@Component({
  imports: [MobileMenu],
  template: `<header><app-mobile-menu [items]="items()" /></header><main><button id="behind">Behind</button></main>`,
})
class Host {
  readonly items = signal<NavItem[]>(ITEMS);
}

const THREADS: { id: string; title: string; at: number; summary?: string; kind?: 'chart'; named?: boolean }[] = [
  { id: 'c-1', title: 'Lisbon: pace behind', summary: 'Down 17% vs last year', kind: 'chart', named: true, at: Date.now() - 5 * 60_000 },
  { id: 'c-2', title: 'ADR by segment, December', at: Date.now() - 3 * 3_600_000 },
];

/**
 * jsdom has no modal dialogs (`showModal`), so the sheet opens by its `open` attribute here, like the hotel picker.
 * What the browser does for a modal dialog (keeping Tab inside, Esc, the scrim) is checked in headless Chrome.
 */
describe('MobileMenu', () => {
  let fixture: ComponentFixture<Host>;
  let root: HTMLElement;
  let store: CompassStore;

  const answer = () => {
    for (const request of TestBed.inject(HttpTestingController).match(() => true)) if (!request.cancelled) request.flush({ error: 'Not found.' }, { status: 404, statusText: 'Not Found' });
  };
  const settle = async () => {
    fixture.detectChanges();
    answer();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const trigger = () => root.querySelector<HTMLButtonElement>('.mm-trigger')!;
  const sheet = () => root.querySelector<HTMLDialogElement>('dialog.mm-sheet')!;
  const isOpen = () => sheet().hasAttribute('open');
  const closeButton = () => sheet().querySelector<HTMLButtonElement>('.mm-close')!;
  const places = () => [...sheet().querySelectorAll<HTMLButtonElement>('nav[aria-label=Main] button')];
  const section = (title: string) => [...sheet().querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent?.trim() === title);
  const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  const open = async () => {
    trigger().click();
    await settle();
  };

  async function render({ threads = THREADS, items = ITEMS }: { threads?: typeof THREADS; items?: NavItem[] } = {}) {
    localStorage.clear();
    localStorage.setItem('compass.conversations', JSON.stringify(threads));
    history.replaceState(null, '', '/');
    FakeSocket.reset();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: SOCKET_FACTORY, useValue: (url: string) => new FakeSocket(url) }] });
    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.items.set(items);
    root = fixture.nativeElement as HTMLElement;
    document.body.appendChild(root);
    store = TestBed.inject(CompassStore);
    await settle();
    await settle();
  }

  afterEach(() => {
    root.remove();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-mode');
    document.documentElement.removeAttribute('data-density');
    document.documentElement.classList.remove('light', 'dark');
    localStorage.clear();
  });

  describe('the button', () => {
    it('is called "Menu", says it opens a dialog, and starts closed', async () => {
      await render();
      expect(trigger().getAttribute('aria-label')).toBe('Menu');
      expect(trigger().getAttribute('aria-haspopup')).toBe('dialog');
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
      expect(trigger().getAttribute('aria-controls')).toBe(sheet().id);
      expect(isOpen()).toBe(false);
    });

    it('carries a dot while anything waits, and says what in its description', async () => {
      await render();
      expect(trigger().querySelector('.mm-dot')?.getAttribute('aria-hidden')).toBe('true');
      const note = root.querySelector(`#${trigger().getAttribute('aria-describedby')}`)!;
      expect(text(note)).toBe('6 in Inbox, 1 in Agent Studio waiting');
    });

    it('has no dot and no description when nothing waits', async () => {
      await render({ items: ITEMS.map((item) => ({ ...item, count: 0 })) });
      expect(trigger().querySelector('.mm-dot')).toBeNull();
      expect(trigger().hasAttribute('aria-describedby')).toBe(false);
    });
  });

  describe('opening and closing', () => {
    it('opens a dialog named "Menu" and puts the focus on its close button', async () => {
      await render();
      trigger().focus();
      await open();
      expect(isOpen()).toBe(true);
      expect(trigger().getAttribute('aria-expanded')).toBe('true');
      expect(sheet().getAttribute('aria-label')).toBe('Menu');
      expect(document.activeElement).toBe(closeButton());
      expect(closeButton().getAttribute('aria-label')).toBe('Close menu');
    });

    it('closes from its close button and gives the focus back to the Menu button', async () => {
      await render();
      await open();
      closeButton().click();
      await settle();
      expect(isOpen()).toBe(false);
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(trigger());
    });

    it('follows the dialog when the browser closes it (Esc, the back button)', async () => {
      await render();
      await open();
      // What a browser does on Esc: the dialog closes itself, then says so.
      sheet().removeAttribute('open');
      sheet().dispatchEvent(new Event('close'));
      await settle();
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(trigger());
    });

    it('closes on a tap on the scrim, and not on a tap inside the sheet', async () => {
      await render();
      await open();
      sheet().getBoundingClientRect = () => ({ left: 48, right: 390, top: 0, bottom: 844, width: 342, height: 844, x: 48, y: 0, toJSON: () => ({}) });

      // The sheet's own padding: the click lands on the dialog element, inside its box.
      sheet().dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 400 }));
      await settle();
      expect(isOpen()).toBe(true);
      // A heading inside it.
      sheet().querySelector('h2')!.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 20, clientY: 400 }));
      await settle();
      expect(isOpen()).toBe(true);

      // The scrim: the backdrop belongs to the dialog element, outside its box.
      sheet().dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 20, clientY: 400 }));
      await settle();
      expect(isOpen()).toBe(false);
      expect(document.activeElement).toBe(trigger());
    });

    it('opens again after it was closed', async () => {
      await render();
      await open();
      closeButton().click();
      await settle();
      await open();
      expect(isOpen()).toBe(true);
      expect(document.activeElement).toBe(closeButton());
    });
  });

  describe('what the sheet holds', () => {
    it('leads with the Compass logo, not the Juyo one, and the hotel scope', async () => {
      await render();
      await open();
      const logo = sheet().querySelector('.mm-head app-compass-logo')!;
      expect(logo.getAttribute('role')).toBe('img');
      expect(logo.getAttribute('aria-label')).toBe('Compass');
      expect(text(logo)).toBe('Compass');
      expect(sheet().querySelector('app-juyo-logo, [aria-label=Juyo]')).toBeNull();
      const scope = sheet().querySelector<HTMLButtonElement>('.mm-scope button[aria-haspopup=dialog]')!;
      expect(text(scope)).toContain('Halcyon Hospitality');
      expect(text(scope)).toContain('20 hotels · 16 countries');
    });

    it('lists Inbox, Boards and Agent Studio with what waits there and the current place', async () => {
      await render();
      await open();
      expect(places().map(text)).toEqual(['Inbox, 6 waiting', 'Boards', 'Agent Studio, 1 waiting']);
      expect(places().map((button) => button.getAttribute('aria-current'))).toEqual(['page', null, null]);
    });

    it('goes to a place and closes', async () => {
      await render();
      await open();
      places()[1]!.click();
      await settle();
      expect(store.view()).toBe('boards');
      expect(isOpen()).toBe(false);
      expect(places().map((button) => button.getAttribute('aria-current'))).toEqual([null, 'page', null]);
    });

    it('lists the recent conversations and opens one', async () => {
      await render();
      await open();
      // Titled "Recent", in sentence case; each row is the title and the takeaway, no "3 h" on every row.
      const threads = [...section('Recent')!.querySelectorAll('button')];
      expect(threads.map(text)).toEqual(['Lisbon: pace behind. Down 17% vs last year', 'ADR by segment, December']);
      threads[0]!.click();
      await settle();
      expect(store.view()).toBe('thread');
    });

    it('has no Recent section before the first conversation', async () => {
      await render({ threads: [] });
      await open();
      expect(section('Recent')).toBeUndefined();
    });

    it('ends with the person, as on the desktop: Ana Pop, revenue manager, and the data is fictional', async () => {
      await render();
      await open();
      const foot = sheet().querySelector('.mm-foot')!;
      expect(text(foot.querySelector('.mm-user')!)).toContain('Ana Pop');
      expect(foot.textContent).toContain('Revenue manager');
      expect(foot.textContent).toContain('Demo · fictional data');
    });

    it('ends with the appearance controls: a choice there applies and is remembered', async () => {
      await render();
      await open();
      // The same switchers as the desktop sidebar: Theme (2) and Mode (3), then Density (2).
      const radios = [...sheet().querySelectorAll<HTMLButtonElement>('.mm-foot app-theme-switcher [role=radiogroup] [role=radio]')];
      expect(radios.map((radio) => radio.getAttribute('aria-label') ?? radio.textContent?.trim())).toEqual(['Default', 'Concept', 'Light', 'Dark', 'System: follows your device']);
      // Nobody has chosen yet: the default theme, dark.
      expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'true', 'false']);
      const densities = [...sheet().querySelectorAll<HTMLButtonElement>('.mm-foot app-density-switch [role=radio]')];
      expect(densities.map((radio) => radio.getAttribute('aria-label'))).toEqual(['Comfortable', 'Compact']);
      radios[2]!.click();
      await settle();
      expect(document.documentElement.getAttribute('data-mode')).toBe('light');
      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('light');
      // Changing the theme is not leaving: the sheet stays open.
      expect(isOpen()).toBe(true);
    });

    it('keeps every control inside the dialog, so a modal dialog holds the focus there', async () => {
      await render();
      await open();
      const inside = [...sheet().querySelectorAll<HTMLElement>('button, a[href], input')];
      expect(inside.length).toBeGreaterThanOrEqual(10);
      expect(inside[0]).toBe(closeButton());
      expect(sheet().contains(trigger())).toBe(false);
    });
  });
});
