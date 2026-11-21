import { TestBed } from '@angular/core/testing';
import { provideBrnTooltipGroup } from '@spartan-ng/brain/tooltip';
import { MODE_STORAGE_KEY, THEME_STORAGE_KEY, Theme } from '../theme';
import { ThemeSwitcher } from './theme-switcher';

describe('ThemeSwitcher', () => {
  const root = document.documentElement;

  beforeEach(() => TestBed.configureTestingModule({ providers: [provideBrnTooltipGroup()] }));

  afterEach(() => {
    root.removeAttribute('data-theme');
    root.removeAttribute('data-mode');
    root.classList.remove('light', 'dark');
    localStorage.removeItem(THEME_STORAGE_KEY);
    localStorage.removeItem(MODE_STORAGE_KEY);
  });

  async function render(variant?: 'rows' | 'menu') {
    const fixture = TestBed.createComponent(ThemeSwitcher);
    if (variant) fixture.componentRef.setInput('variant', variant);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const group = (name: string) => [...el.querySelectorAll<HTMLElement>('[role="radiogroup"]')].find((g) => el.querySelector(`#${g.getAttribute('aria-labelledby')}`)?.textContent?.trim() === name);
    const radios = (name: string) => [...(group(name)?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])];
    const checked = (name: string) => radios(name).find((r) => r.getAttribute('aria-checked') === 'true');
    return { fixture, el, group, radios, checked, theme: TestBed.inject(Theme) };
  }

  it('shows two labelled groups: Theme with two options, Mode with three', async () => {
    const { radios, checked } = await render();
    expect(radios('Theme').map((r) => r.textContent?.trim())).toEqual(['Default', 'Concept']);
    expect(radios('Mode').map((r) => r.getAttribute('aria-label'))).toEqual(['Light', 'Dark', 'System: follows your device']);
    // A visitor who has chosen nothing is in the default theme, in the dark mode.
    expect(checked('Theme')?.textContent?.trim()).toBe('Default');
    expect(checked('Mode')?.getAttribute('aria-label')).toBe('Dark');
  });

  it('changes the theme without touching the mode, and the mode without touching the theme', async () => {
    const { fixture, radios, checked, theme } = await render();
    radios('Theme')[1].click();
    await fixture.whenStable();
    expect(theme.id()).toBe('juyo-concept');
    expect(theme.mode()).toBe('dark');
    expect(checked('Theme')?.textContent?.trim()).toBe('Concept');

    radios('Mode')[0].click();
    await fixture.whenStable();
    expect(theme.id()).toBe('juyo-concept');
    expect(theme.mode()).toBe('light');
    expect(checked('Mode')?.getAttribute('aria-label')).toBe('Light');
    expect(root.getAttribute('data-theme')).toBe('juyo-concept');
    expect(root.classList.contains('light')).toBe(true);
  });

  it('is one tab stop per group, and the arrow keys move and choose', async () => {
    const { fixture, group, radios, theme } = await render();
    expect(radios('Mode').map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);

    radios('Mode')[1].focus();
    radios('Mode')[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(theme.mode()).toBe('system');
    expect(document.activeElement).toBe(radios('Mode')[2]);

    radios('Mode')[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    // Past the last option the group wraps to the first.
    expect(theme.mode()).toBe('light');
    expect(document.activeElement).toBe(radios('Mode')[0]);
    expect(radios('Mode').map((r) => r.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);

    radios('Mode')[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await fixture.whenStable();
    expect(theme.mode()).toBe('system');
    expect(group('Theme')).toBeTruthy();
  });

  it('as a menu is one button that names the current choice', async () => {
    const { fixture, el, theme } = await render('menu');
    const button = el.querySelector('button');
    expect(el.querySelectorAll('[role="radiogroup"]').length).toBe(0);
    expect(button?.getAttribute('aria-label')).toBe('Theme: Default, dark. Change theme or mode');
    expect(button?.getAttribute('aria-haspopup')).toBe('menu');

    theme.set('juyo-concept');
    theme.setMode('system');
    await fixture.whenStable();
    expect(button?.getAttribute('aria-label')).toBe('Theme: Concept, system (dark). Change theme or mode');
  });
});
