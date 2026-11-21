import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { DocsRouter } from '../docs/docs-router';
import { CompassStore } from '../store';
import { PERSONA, UserMenu } from './user-menu';

@Component({
  imports: [UserMenu],
  template: `<app-user-menu [collapsed]="collapsed()" />`,
})
class Host {
  readonly collapsed = signal(false);
}

describe('UserMenu', () => {
  let fixture: ComponentFixture<Host>;
  let root: HTMLElement;

  /** The API is not there: every request gets a 404 (the hotel list falls back to the built-in one). */
  const answer = () => {
    for (const request of TestBed.inject(HttpTestingController).match(() => true)) if (!request.cancelled) request.flush({ error: 'Not found.' }, { status: 404, statusText: 'Not Found' });
  };
  const settle = async () => {
    fixture.detectChanges();
    answer();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const trigger = () => root.querySelector<HTMLButtonElement>('.um-trigger')!;
  const menu = () => document.querySelector<HTMLElement>('[role=menu]');
  const items = () => [...(menu()?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
  const panel = () => document.querySelector<HTMLElement>('.cdk-overlay-container [role=dialog]');
  const key = (target: Element, key: string, keyCode: number) => target.dispatchEvent(new KeyboardEvent('keydown', { key, keyCode, bubbles: true, cancelable: true }));
  const open = async () => {
    trigger().focus();
    trigger().click();
    await settle();
  };
  const choose = async (label: string) => {
    items()
      .find((item) => item.textContent?.includes(label))!
      .click();
    await settle();
  };

  beforeEach(async () => {
    history.replaceState(null, '', '/');
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    fixture = TestBed.createComponent(Host);
    root = fixture.nativeElement as HTMLElement;
    document.body.appendChild(root);
    await settle();
  });
  afterEach(() => {
    root.remove();
    document.querySelector('.cdk-overlay-container')?.replaceChildren();
  });

  it('is the demo persona from the fictional team: Ana Pop, revenue manager', () => {
    expect(PERSONA).toEqual({ name: 'Ana Pop', role: 'Revenue manager', initials: 'AP' });
  });

  it('shows the avatar, the name and the role, and says it opens a menu', () => {
    expect(trigger().querySelector('.um-avatar')?.getAttribute('data-initials')).toBe('AP');
    expect(trigger().textContent).toContain('Ana Pop');
    expect(trigger().textContent).toContain('Revenue manager');
    // Open, the words on screen are its name (label in name); only the rail's avatar needs a label.
    expect(trigger().getAttribute('aria-label')).toBeNull();
    expect(trigger().querySelector('.um-text')?.getAttribute('aria-hidden')).toBeNull();
    expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('opens a menu: Docs, Appearance, Keyboard shortcuts, and a quiet line that the data is fictional', async () => {
    await open();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(items().map((item) => item.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['Docs', 'Appearance', 'Keyboard shortcuts']);
    expect(menu()!.textContent).toContain('Demo · fictional data');
    expect(items()[1]!.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('Esc closes the menu and gives the focus back to the button', async () => {
    await open();
    key(document.activeElement ?? menu()!, 'Escape', 27);
    await settle();
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('Docs opens the docs hub', async () => {
    await open();
    await choose('Docs');
    expect(TestBed.inject(CompassStore).view()).toBe('docs');
    expect(TestBed.inject(DocsRouter).page()).toBe('index');
    expect(menu()).toBeNull();
  });

  it('Keyboard shortcuts opens the keyboard section of the accessibility docs', async () => {
    await open();
    await choose('Keyboard shortcuts');
    expect(TestBed.inject(DocsRouter).page()).toBe('accessibility');
  });

  describe('Appearance', () => {
    const openPanel = async () => {
      await open();
      await choose('Appearance');
      await new Promise((resolve) => setTimeout(resolve, 0));
      await settle();
    };

    it('opens a panel with Theme, Mode and Density; the focus goes to the chosen theme', async () => {
      await openPanel();
      expect(menu()).toBeNull();
      expect(panel()!.getAttribute('aria-label')).toBe('Appearance');
      expect([...panel()!.querySelectorAll('[role=radiogroup]')].map((group) => document.getElementById(group.getAttribute('aria-labelledby')!)?.textContent?.trim())).toEqual(['Theme', 'Mode', 'Density']);
      expect(document.activeElement).toBe(panel()!.querySelector('app-theme-switcher [role=radio][aria-checked=true]'));
    });

    it('a choice applies and the panel stays open', async () => {
      await openPanel();
      panel()!.querySelector<HTMLButtonElement>('[data-density-option=compact]')!.click();
      await settle();
      expect(document.documentElement.getAttribute('data-density')).toBe('compact');
      expect(panel()).not.toBeNull();
      panel()!.querySelector<HTMLButtonElement>('[data-density-option=comfortable]')!.click();
      await settle();
    });

    it('Esc closes it and gives the focus back to the button', async () => {
      await openPanel();
      key(document.activeElement!, 'Escape', 27);
      await settle();
      expect(panel()).toBeNull();
      expect(document.activeElement).toBe(trigger());
    });

    it('a click outside closes it', async () => {
      await openPanel();
      document.body.click();
      await settle();
      expect(panel()).toBeNull();
    });

    it('closes when the sidebar changes shape', async () => {
      await openPanel();
      fixture.componentInstance.collapsed.set(true);
      await settle();
      expect(panel()).toBeNull();
    });
  });

  it('collapsed, is the avatar alone with the persona as its name, and the same menu', async () => {
    fixture.componentInstance.collapsed.set(true);
    await settle();
    expect(trigger().getAttribute('aria-label')).toBe('Ana Pop, Revenue manager');
    await open();
    expect(items()).toHaveLength(3);
  });
});
