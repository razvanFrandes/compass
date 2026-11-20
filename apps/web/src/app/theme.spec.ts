import { TestBed } from '@angular/core/testing';
import { THEMES, THEME_STORAGE_KEY, Theme, isThemeId, themeOf } from './theme';

describe('Theme', () => {
  const root = document.documentElement;

  afterEach(() => {
    root.removeAttribute('data-theme');
    root.classList.remove('light', 'dark');
    localStorage.removeItem(THEME_STORAGE_KEY);
  });

  it('offers light, dark and the Juyo concept', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['light', 'dark', 'juyo-concept']);
    expect(isThemeId('juyo-concept')).toBe(true);
    expect(isThemeId('sepia')).toBe(false);
  });

  it('reads the starting theme from data-theme, then from the class index.html set', () => {
    expect(themeOf(root)).toBe('dark');
    root.classList.add('light');
    expect(themeOf(root)).toBe('light');
    root.setAttribute('data-theme', 'juyo-concept');
    expect(themeOf(root)).toBe('juyo-concept');
    root.setAttribute('data-theme', 'unknown');
    expect(themeOf(root)).toBe('light');
  });

  it('writes the choice to <html> and remembers it', () => {
    const theme = TestBed.inject(Theme);
    expect(theme.id()).toBe('dark');
    theme.set('juyo-concept');
    expect(root.getAttribute('data-theme')).toBe('juyo-concept');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('juyo-concept');
    expect(theme.dark()).toBe(false);
    expect(theme.option().label).toBe('Juyo concept');
  });

  it('cycles through the themes for the one-button switch', () => {
    const theme = TestBed.inject(Theme);
    theme.set('light');
    expect(theme.next().id).toBe('dark');
    theme.set('dark');
    expect(theme.next().id).toBe('juyo-concept');
    theme.set('juyo-concept');
    expect(theme.next().id).toBe('light');
  });
});
