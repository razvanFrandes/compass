import { TestBed } from '@angular/core/testing';
import { SIDEBAR_STORAGE_KEY, SidebarState, isSidebarShortcut } from './sidebar-state';

/** A `matchMedia` whose answers the test sets, by a fragment of the query. */
function fakeMedia(answers: Record<string, boolean>) {
  const lists = new Map<string, { matches: boolean; listeners: ((event: { matches: boolean }) => void)[] }>();
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => {
    const key = Object.keys(answers).find((fragment) => query.includes(fragment));
    const list = { matches: key ? answers[key]! : false, listeners: [] as ((event: { matches: boolean }) => void)[] };
    lists.set(query, list);
    return { ...list, media: query, addEventListener: (_: string, listener: (event: { matches: boolean }) => void) => list.listeners.push(listener) };
  }) as unknown as typeof window.matchMedia;
  return {
    change(fragment: string, matches: boolean) {
      for (const [query, list] of lists) if (query.includes(fragment)) list.listeners.forEach((listener) => listener({ matches }));
    },
    restore: () => (window.matchMedia = original),
  };
}

const create = () => {
  TestBed.resetTestingModule();
  return TestBed.inject(SidebarState);
};

describe('SidebarState', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('starts expanded, and stores nothing until the person chooses', () => {
    const sidebar = create();
    expect(sidebar.collapsed()).toBe(false);
    expect(sidebar.available()).toBe(true);
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBeNull();
  });

  it('remembers the choice in this browser', () => {
    const sidebar = create();
    sidebar.toggle();
    expect(sidebar.collapsed()).toBe(true);
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('collapsed');
    expect(create().collapsed()).toBe(true);

    create().toggle();
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('expanded');
    expect(create().collapsed()).toBe(false);
  });

  it('ignores a stored value it does not know', () => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, 'tiny');
    expect(create().collapsed()).toBe(false);
  });

  it('still works when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const sidebar = create();
    expect(sidebar.collapsed()).toBe(false);
    sidebar.set(true);
    expect(sidebar.collapsed()).toBe(true);
  });

  it('starts as a rail on a narrow desktop, follows the window, and lets the choice win', () => {
    const media = fakeMedia({ 'max-width: 1279': true, 'min-width: 1024': true });
    try {
      const sidebar = create();
      expect(sidebar.collapsed()).toBe(true);
      expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBeNull();

      media.change('max-width: 1279', false);
      expect(sidebar.collapsed()).toBe(false);
      media.change('max-width: 1279', true);
      expect(sidebar.collapsed()).toBe(true);

      sidebar.set(false);
      expect(sidebar.collapsed()).toBe(false);
      media.change('max-width: 1279', false);
      media.change('max-width: 1279', true);
      expect(sidebar.collapsed()).toBe(false);
    } finally {
      media.restore();
    }
  });

  it('is not available on a phone', () => {
    const media = fakeMedia({ 'max-width: 1279': true, 'min-width: 1024': false });
    try {
      expect(create().available()).toBe(false);
    } finally {
      media.restore();
    }
  });
});

describe('isSidebarShortcut', () => {
  const key = (init: KeyboardEventInit, target: Element = document.body) => {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    Object.defineProperty(event, 'target', { value: target });
    return event;
  };
  const element = (html: string) => {
    const host = document.createElement('div');
    host.innerHTML = html;
    return host.firstElementChild!;
  };

  it('takes "[" on its own, and ⌘\\ or Ctrl+\\', () => {
    expect(isSidebarShortcut(key({ key: '[' }))).toBe(true);
    expect(isSidebarShortcut(key({ key: '\\', metaKey: true }))).toBe(true);
    expect(isSidebarShortcut(key({ key: '\\', ctrlKey: true }))).toBe(true);
    // A layout where the key prints something else still has the Backslash key.
    expect(isSidebarShortcut(key({ key: '#', code: 'Backslash', ctrlKey: true }))).toBe(true);
    // AltGr, which Windows reports as Ctrl+Alt, is how some layouts type "[".
    expect(isSidebarShortcut(key({ key: '[', ctrlKey: true, altKey: true }))).toBe(true);
  });

  it('leaves the browser its own keys', () => {
    expect(isSidebarShortcut(key({ key: '[', metaKey: true }))).toBe(false); // Back
    expect(isSidebarShortcut(key({ key: '[', ctrlKey: true }))).toBe(false);
    expect(isSidebarShortcut(key({ key: '\\' }))).toBe(false);
    expect(isSidebarShortcut(key({ key: '\\', metaKey: true, shiftKey: true }))).toBe(false);
    expect(isSidebarShortcut(key({ key: ']' }))).toBe(false);
  });

  it('does not take "[" from someone who is typing, but ⌘\\ works there', () => {
    for (const html of ['<input />', '<textarea></textarea>', '<select></select>', '<div contenteditable="true"></div>', '<div role="textbox"></div>', '<div role="menu"><button></button></div>']) {
      const target = element(html);
      expect(isSidebarShortcut(key({ key: '[' }, target.firstElementChild ?? target)), html).toBe(false);
    }
    expect(isSidebarShortcut(key({ key: '\\', metaKey: true }, element('<textarea></textarea>')))).toBe(true);
  });

  it('ignores a held key and a key someone else handled', () => {
    expect(isSidebarShortcut(key({ key: '[', repeat: true }))).toBe(false);
    const handled = key({ key: '[' });
    handled.preventDefault();
    expect(isSidebarShortcut(handled)).toBe(false);
  });
});
