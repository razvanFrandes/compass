import { TestBed } from '@angular/core/testing';
import { PAGE_RELOAD, PageLoadFailed, PageLoading, RELOAD_KEY, SLOW_LOAD_MS, reloadOnceForNewBuild } from './page-load';

const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

class MemoryStorage {
  readonly data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe('reloadOnceForNewBuild', () => {
  it('reloads the first time a page fails to load: a new version was deployed and the old chunks are gone', () => {
    const storage = new MemoryStorage();
    const reload = vi.fn();
    expect(reloadOnceForNewBuild(storage, reload, 1_000_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.getItem(RELOAD_KEY)).toBe('1000000');
  });

  it('does not reload again right after a reload: the failure is not a stale build, so it would loop', () => {
    const storage = new MemoryStorage();
    storage.setItem(RELOAD_KEY, '1000000');
    const reload = vi.fn();
    expect(reloadOnceForNewBuild(storage, reload, 1_010_000)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads again once the last automatic reload is a while ago', () => {
    const storage = new MemoryStorage();
    storage.setItem(RELOAD_KEY, '1000000');
    const reload = vi.fn();
    expect(reloadOnceForNewBuild(storage, reload, 1_000_000 + 5 * 60_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('without storage (blocked site data) it never reloads by itself', () => {
    const reload = vi.fn();
    expect(reloadOnceForNewBuild(null, reload, 1)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('PageLoading', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('says it is loading, and after a while offers Retry instead of spinning forever', async () => {
    const reload = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: PAGE_RELOAD, useValue: reload }] });
    const fixture = TestBed.createComponent(PageLoading);
    fixture.componentRef.setInput('label', 'Opening the agent builder…');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el)).toBe('Opening the agent builder…');
    expect(el.querySelector('button')).toBeNull();

    vi.advanceTimersByTime(SLOW_LOAD_MS);
    fixture.detectChanges();
    expect(text(el)).toContain('This is taking longer than usual');
    const retry = el.querySelector('button')!;
    expect(text(retry)).toBe('Retry');
    retry.click();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('PageLoadFailed', () => {
  afterEach(() => sessionStorage.removeItem(RELOAD_KEY));

  it('reloads once by itself when the page code fails to load', () => {
    sessionStorage.removeItem(RELOAD_KEY);
    const reload = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: PAGE_RELOAD, useValue: reload }] });
    const fixture = TestBed.createComponent(PageLoadFailed);
    fixture.componentRef.setInput('what', 'the agent builder');
    fixture.detectChanges();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(text(fixture.nativeElement)).toContain('Loading the latest version of Compass');
  });

  it('after an automatic reload that did not help, it explains and offers Retry', () => {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    const reload = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: PAGE_RELOAD, useValue: reload }] });
    const fixture = TestBed.createComponent(PageLoadFailed);
    fixture.componentRef.setInput('what', 'the agent builder');
    fixture.detectChanges();
    expect(reload).not.toHaveBeenCalled();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    expect(text(el)).toContain('Couldn’t open the agent builder');
    el.querySelector('button')!.click();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
