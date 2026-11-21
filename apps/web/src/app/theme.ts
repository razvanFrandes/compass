import { DOCUMENT, Service, computed, inject, signal } from '@angular/core';

/** The themes the app ships. `id` is the value of `data-theme` on `<html>`; index.html maps it to `.dark` / `.light`. */
export const THEMES = [
  { id: 'light', label: 'Light', short: 'Light', icon: 'phosphorSunLight' },
  { id: 'dark', label: 'Dark', short: 'Dark', icon: 'phosphorMoonLight' },
  { id: 'juyo-concept', label: 'Juyo concept', short: 'Concept', icon: 'phosphorCompassLight' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

/** Where the choice is remembered. index.html reads the same key before the first paint. */
export const THEME_STORAGE_KEY = 'compass.theme';

export const isThemeId = (value: unknown): value is ThemeId => THEMES.some((t) => t.id === value);

/**
 * The theme of a visitor who has not chosen one: dark, like Juyo's product, whatever the OS prefers.
 * index.html repeats it before the first paint (apps/worker/test/web-default-theme.test.ts holds the two together).
 */
export const DEFAULT_THEME: ThemeId = 'dark';

/** The theme a page starts with: an explicit `data-theme`, else the class index.html set, else the default. */
export function themeOf(root: Pick<HTMLElement, 'getAttribute' | 'classList'>): ThemeId {
  const attr = root.getAttribute('data-theme');
  if (isThemeId(attr)) return attr;
  return root.classList.contains('light') ? 'light' : DEFAULT_THEME;
}

/**
 * The app's theme: one signal, written to `<html data-theme>` and remembered in local storage. Only a choice changes
 * it: the OS setting for light or dark is not followed.
 */
@Service()
export class Theme {
  private readonly doc = inject(DOCUMENT);
  private readonly current = signal<ThemeId>(themeOf(this.doc.documentElement));

  readonly id = this.current.asReadonly();
  readonly option = computed(() => THEMES.find((t) => t.id === this.current()) ?? THEMES[1]);
  /** What the toaster and other two-tone parts need. */
  readonly dark = computed(() => this.current() === 'dark');
  /** The next theme in the list, for a one-button switch on small screens. */
  readonly next = computed(() => THEMES[(THEMES.findIndex((t) => t.id === this.current()) + 1) % THEMES.length]);

  set(id: ThemeId) {
    this.doc.documentElement.setAttribute('data-theme', id);
    this.current.set(id);
    try {
      this.doc.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      // Private mode or blocked storage: the theme still applies for this visit.
    }
  }
}
