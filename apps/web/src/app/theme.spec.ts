import { TestBed } from '@angular/core/testing';
import { MODES, MODE_STORAGE_KEY, THEMES, THEME_STORAGE_KEY, Theme, choiceFrom, isModeId, isThemeId } from './theme';

/** A `prefers-color-scheme: light` query the test can flip, as the OS would. */
function fakeDevice(light: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const query = {
    matches: light,
    media: '(prefers-color-scheme: light)',
    addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.delete(fn),
  };
  const original = window.matchMedia;
  window.matchMedia = (() => query) as unknown as typeof window.matchMedia;
  return {
    set(next: boolean) {
      query.matches = next;
      for (const fn of listeners) fn({ matches: next });
    },
    restore: () => (window.matchMedia = original),
  };
}

describe('Theme', () => {
  const root = document.documentElement;
  let device: ReturnType<typeof fakeDevice>;

  beforeEach(() => {
    device = fakeDevice(false);
  });

  afterEach(() => {
    device.restore();
    root.removeAttribute('data-theme');
    root.removeAttribute('data-mode');
    root.classList.remove('light', 'dark');
    localStorage.removeItem(THEME_STORAGE_KEY);
    localStorage.removeItem(MODE_STORAGE_KEY);
  });

  const state = () => ({ theme: root.getAttribute('data-theme'), mode: root.getAttribute('data-mode'), light: root.classList.contains('light'), dark: root.classList.contains('dark') });
  const stored = () => ({ theme: localStorage.getItem(THEME_STORAGE_KEY), mode: localStorage.getItem(MODE_STORAGE_KEY) });

  it('offers two themes and three modes, as independent choices', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['default', 'juyo-concept']);
    expect(MODES.map((m) => m.id)).toEqual(['light', 'dark', 'system']);
    expect(isThemeId('juyo-concept')).toBe(true);
    expect(isThemeId('light')).toBe(false);
    expect(isModeId('system')).toBe(true);
    expect(isModeId('sepia')).toBe(false);
  });

  describe('choiceFrom', () => {
    it('reads the two values as they are stored today', () => {
      expect(choiceFrom('default', 'dark')).toEqual({ theme: 'default', mode: 'dark' });
      expect(choiceFrom('juyo-concept', 'dark')).toEqual({ theme: 'juyo-concept', mode: 'dark' });
      expect(choiceFrom('juyo-concept', 'system')).toEqual({ theme: 'juyo-concept', mode: 'system' });
    });

    it('reads the single value of before as what the person had', () => {
      expect(choiceFrom('light', null)).toEqual({ theme: 'default', mode: 'light' });
      expect(choiceFrom('dark', null)).toEqual({ theme: 'default', mode: 'dark' });
      // The concept theme was a light theme.
      expect(choiceFrom('juyo-concept', null)).toEqual({ theme: 'juyo-concept', mode: 'light' });
    });

    it('falls back to the default theme following the device', () => {
      expect(choiceFrom(null, null)).toEqual({ theme: 'default', mode: 'system' });
      expect(choiceFrom('sepia', 'dim')).toEqual({ theme: 'default', mode: 'system' });
      expect(choiceFrom(undefined, 'light')).toEqual({ theme: 'default', mode: 'light' });
    });
  });

  it('starts as the default theme in the device’s mode, and stores nothing until a choice is made', () => {
    const theme = TestBed.inject(Theme);
    expect(theme.id()).toBe('default');
    expect(theme.mode()).toBe('system');
    expect(theme.scheme()).toBe('dark');
    expect(state()).toEqual({ theme: 'default', mode: 'system', light: false, dark: true });
    expect(stored()).toEqual({ theme: null, mode: null });
  });

  it('starts from what index.html left on <html>', () => {
    root.setAttribute('data-theme', 'juyo-concept');
    root.setAttribute('data-mode', 'dark');
    const theme = TestBed.inject(Theme);
    expect(theme.id()).toBe('juyo-concept');
    expect(theme.mode()).toBe('dark');
    expect(theme.dark()).toBe(true);
    expect(state()).toEqual({ theme: 'juyo-concept', mode: 'dark', light: false, dark: true });
  });

  it('starts from what the browser remembers when <html> says nothing', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'juyo-concept');
    localStorage.setItem(MODE_STORAGE_KEY, 'light');
    const theme = TestBed.inject(Theme);
    expect(theme.id()).toBe('juyo-concept');
    expect(theme.scheme()).toBe('light');
    expect(state()).toEqual({ theme: 'juyo-concept', mode: 'light', light: true, dark: false });
  });

  it('changes the theme and the mode independently, and remembers both', () => {
    const theme = TestBed.inject(Theme);
    theme.set('juyo-concept');
    expect(state()).toEqual({ theme: 'juyo-concept', mode: 'system', light: false, dark: true });
    expect(stored()).toEqual({ theme: 'juyo-concept', mode: 'system' });
    expect(theme.option().name).toBe('Juyo concept');

    theme.setMode('light');
    expect(theme.id()).toBe('juyo-concept');
    expect(theme.dark()).toBe(false);
    expect(state()).toEqual({ theme: 'juyo-concept', mode: 'light', light: true, dark: false });
    expect(stored()).toEqual({ theme: 'juyo-concept', mode: 'light' });

    theme.set('default');
    expect(theme.mode()).toBe('light');
    expect(state()).toEqual({ theme: 'default', mode: 'light', light: true, dark: false });

    theme.setMode('dark');
    expect(state()).toEqual({ theme: 'default', mode: 'dark', light: false, dark: true });
    expect(stored()).toEqual({ theme: 'default', mode: 'dark' });
  });

  describe('system mode', () => {
    it('follows the device, and keeps following it', () => {
      const theme = TestBed.inject(Theme);
      theme.set('juyo-concept');
      expect(theme.scheme()).toBe('dark');
      device.set(true);
      expect(theme.mode()).toBe('system');
      expect(theme.scheme()).toBe('light');
      expect(state()).toEqual({ theme: 'juyo-concept', mode: 'system', light: true, dark: false });
      device.set(false);
      expect(state()).toEqual({ theme: 'juyo-concept', mode: 'system', light: false, dark: true });
      // The mode in effect is never what is remembered: the choice is "system".
      expect(stored().mode).toBe('system');
    });

    it('starts light on a light device', () => {
      device.set(true);
      const theme = TestBed.inject(Theme);
      expect(theme.scheme()).toBe('light');
      expect(state().light).toBe(true);
    });

    it('does not move an explicit mode when the device changes', () => {
      const theme = TestBed.inject(Theme);
      theme.setMode('dark');
      device.set(true);
      expect(theme.scheme()).toBe('dark');
      expect(state()).toEqual({ theme: 'default', mode: 'dark', light: false, dark: true });
    });

    it('is dark when the device cannot be asked', () => {
      device.restore();
      const original = window.matchMedia;
      window.matchMedia = undefined as unknown as typeof window.matchMedia;
      try {
        expect(TestBed.inject(Theme).scheme()).toBe('dark');
      } finally {
        window.matchMedia = original;
      }
    });
  });

  describe('a value stored before the mode was a choice', () => {
    it.each([
      ['light', { theme: 'default', mode: 'light' }],
      ['dark', { theme: 'default', mode: 'dark' }],
      ['juyo-concept', { theme: 'juyo-concept', mode: 'light' }],
    ])('"%s" is read as it looked and stored again as two values', (former, expected) => {
      localStorage.setItem(THEME_STORAGE_KEY, former);
      const theme = TestBed.inject(Theme);
      expect({ theme: theme.id(), mode: theme.mode() }).toEqual(expected);
      expect(stored()).toEqual(expected);
      expect(state().light).toBe(expected.mode === 'light');
    });

    it('is not touched again once both values are there', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'juyo-concept');
      localStorage.setItem(MODE_STORAGE_KEY, 'system');
      TestBed.inject(Theme);
      expect(stored()).toEqual({ theme: 'juyo-concept', mode: 'system' });
    });
  });
});
