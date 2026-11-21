import { DOCUMENT, Service, computed, inject, signal } from '@angular/core';

/*
  Two independent choices: a theme (which design) and a mode (light, dark, or what the device says).

  On <html>: `data-theme` is the theme, `data-mode` is the mode as chosen, and the class `.light` or `.dark` is the
  mode in effect. The class is what CSS reads: Spartan, Tailwind's `dark:`, the default themes (`:root.light`) and
  the concept theme (`[data-theme='juyo-concept'].dark`). The script in index.html applies the same three before
  the first paint; this service takes over from there.

  With no choice the theme is Default and the mode is Dark. The device's preference counts only under System.
*/

/** The themes the app ships. `id` is the value of `data-theme` on `<html>`. */
export const THEMES = [
  { id: 'default', label: 'Default', name: 'Default' },
  { id: 'juyo-concept', label: 'Concept', name: 'Juyo concept' },
] as const;

/** The modes a person can choose. `system` follows `prefers-color-scheme`, and keeps following it; it is never assumed. */
export const MODES = [
  { id: 'light', label: 'Light', hint: 'Light', icon: 'phosphorSunLight' },
  { id: 'dark', label: 'Dark', hint: 'Dark', icon: 'phosphorMoonLight' },
  { id: 'system', label: 'System', hint: 'System: follows your device', icon: 'phosphorDesktopLight' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];
export type ModeId = (typeof MODES)[number]['id'];
/** The mode in effect: what `system` resolves to. */
export type Scheme = 'light' | 'dark';

/** The mode of a visitor who has chosen nothing: dark, like Juyo's product, whatever the device prefers. */
export const DEFAULT_MODE: ModeId = 'dark';

/** Where the choices are remembered. index.html reads the same keys before the first paint. */
export const THEME_STORAGE_KEY = 'compass.theme';
export const MODE_STORAGE_KEY = 'compass.mode';

export const isThemeId = (value: unknown): value is ThemeId => THEMES.some((t) => t.id === value);
export const isModeId = (value: unknown): value is ModeId => MODES.some((m) => m.id === value);

export interface ThemeChoice {
  theme: ThemeId;
  mode: ModeId;
}

/**
 * The two stored values as a choice. Until the mode was a choice of its own, one value held everything: `light`,
 * `dark` or `juyo-concept`, which was a light theme. Those still read as what the person had. Nothing stored is the
 * default theme in the dark mode: the device's preference counts only when the person chooses System.
 * index.html applies the same rules; apps/worker/test/web-theme-script.test.ts holds the two together.
 */
export function choiceFrom(theme: string | null | undefined, mode: string | null | undefined): ThemeChoice {
  const former: ModeId = theme === 'light' || theme === 'dark' ? theme : theme === 'juyo-concept' ? 'light' : DEFAULT_MODE;
  return { theme: theme === 'juyo-concept' ? 'juyo-concept' : 'default', mode: isModeId(mode) ? mode : former };
}

/** The app's theme and mode: written to `<html>` and remembered in local storage. */
@Service()
export class Theme {
  private readonly doc = inject(DOCUMENT);
  private readonly root = this.doc.documentElement;
  private readonly media = this.doc.defaultView?.matchMedia?.('(prefers-color-scheme: light)') ?? null;
  private readonly start = this.read();
  private readonly theme = signal<ThemeId>(this.start.theme);
  private readonly chosenMode = signal<ModeId>(this.start.mode);
  /** What the device asks for, which only the System mode reads. With no answer it is dark. */
  private readonly systemLight = signal(this.media?.matches ?? false);

  /** The theme: `default` or `juyo-concept`. */
  readonly id = this.theme.asReadonly();
  /** The mode as chosen: `light`, `dark` or `system`. */
  readonly mode = this.chosenMode.asReadonly();
  /** The mode in effect. */
  readonly scheme = computed<Scheme>(() => {
    const mode = this.chosenMode();
    return mode === 'system' ? (this.systemLight() ? 'light' : 'dark') : mode;
  });
  /** What the toaster and other two-tone parts need. */
  readonly dark = computed(() => this.scheme() === 'dark');
  readonly option = computed(() => THEMES.find((t) => t.id === this.theme()) ?? THEMES[0]);
  readonly modeOption = computed(() => MODES.find((m) => m.id === this.chosenMode()) ?? MODES[1]);

  constructor() {
    this.media?.addEventListener?.('change', (e) => {
      this.systemLight.set(e.matches);
      this.apply();
    });
    this.apply();
    // A value from before the two choices existed is rewritten once, in the new form.
    if (this.start.former) this.remember();
  }

  set(id: ThemeId) {
    this.theme.set(id);
    this.apply();
    this.remember();
  }

  setMode(mode: ModeId) {
    this.chosenMode.set(mode);
    this.apply();
    this.remember();
  }

  /** What index.html left on `<html>`, else what this browser remembers. */
  private read(): ThemeChoice & { former: boolean } {
    let theme: string | null = null;
    let mode: string | null = null;
    try {
      const store = this.doc.defaultView?.localStorage;
      theme = store?.getItem(THEME_STORAGE_KEY) ?? null;
      mode = store?.getItem(MODE_STORAGE_KEY) ?? null;
    } catch {
      // Private mode or blocked storage: the attributes or the defaults decide.
    }
    const former = theme !== null && (!isThemeId(theme) || !isModeId(mode));
    return { ...choiceFrom(this.root.getAttribute('data-theme') ?? theme, this.root.getAttribute('data-mode') ?? mode), former };
  }

  private apply() {
    const light = this.scheme() === 'light';
    this.root.setAttribute('data-theme', this.theme());
    this.root.setAttribute('data-mode', this.chosenMode());
    this.root.classList.toggle('light', light);
    this.root.classList.toggle('dark', !light);
  }

  private remember() {
    try {
      const store = this.doc.defaultView?.localStorage;
      store?.setItem(THEME_STORAGE_KEY, this.theme());
      store?.setItem(MODE_STORAGE_KEY, this.chosenMode());
    } catch {
      // Private mode or blocked storage: the choice still applies for this visit.
    }
  }
}
