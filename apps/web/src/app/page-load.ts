import { Component, DOCUMENT, DestroyRef, InjectionToken, inject, input, signal } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';

/**
 * Pages whose code loads on first visit (`@defer`). Their chunks are named by content hash, and a deploy replaces
 * them: a tab opened before the deploy asks for a chunk that no longer exists. The static assets answer that with
 * index.html (the single-page fallback), the browser refuses it as a module ("MIME type text/html"), and Angular
 * stops with NG0750. Without an `@error` block the placeholder stayed on screen forever.
 *
 * Use `@placeholder { <app-page-loading … /> }` and `@error { <app-page-load-failed … /> }` on every such block.
 */

/** Reloads the page; a test passes a spy. */
export const PAGE_RELOAD = new InjectionToken<() => void>('PAGE_RELOAD', {
  providedIn: 'root',
  factory: () => {
    const doc = inject(DOCUMENT);
    return () => doc.defaultView?.location.reload();
  },
});

/** sessionStorage key: when the page last reloaded itself to pick up a new version. */
export const RELOAD_KEY = 'compass:reloaded-for-new-build';
/** Within this long of an automatic reload, a second failure is not a stale build: show it, do not loop. */
const RELOAD_GUARD_MS = 60_000;
/** After this long, the loading text admits it and offers Retry. */
export const SLOW_LOAD_MS = 8_000;

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

/** Reloads once to fetch the new index.html and its chunks; false when it already did so a moment ago. */
export function reloadOnceForNewBuild(storage: KeyValueStore | null, reload: () => void, now: number): boolean {
  if (!storage) return false;
  try {
    const last = Number(storage.getItem(RELOAD_KEY));
    if (Number.isFinite(last) && last > 0 && now - last < RELOAD_GUARD_MS) return false;
    storage.setItem(RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  reload();
  return true;
}

function sessionStore(doc: Document): KeyValueStore | null {
  try {
    return doc.defaultView?.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** A deferred page's placeholder: what is loading, then, if it takes long, Retry. */
@Component({
  selector: 'app-page-loading',
  imports: [HlmButtonImports],
  host: { class: 'block' },
  template: `
    <div class="text-muted-foreground grid min-h-[inherit] place-items-center px-page-x text-[14px]" role="status">
      <div class="flex flex-col items-center gap-2 text-center">
        <p>{{ slow() ? 'This is taking longer than usual.' : label() }}</p>
        @if (slow()) {
          <button hlmBtn type="button" variant="outline" size="sm" (click)="reload()">Retry</button>
        }
      </div>
    </div>
  `,
})
export class PageLoading {
  readonly label = input.required<string>();
  protected readonly reload = inject(PAGE_RELOAD);
  protected readonly slow = signal(false);

  constructor() {
    const timer = setTimeout(() => this.slow.set(true), SLOW_LOAD_MS);
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }
}

/** A deferred page's code failed to load: reload once for the new version, then explain and offer Retry. */
@Component({
  selector: 'app-page-load-failed',
  imports: [HlmButtonImports],
  host: { class: 'block' },
  template: `
    @if (reloading) {
      <p class="text-muted-foreground grid min-h-[inherit] place-items-center px-page-x text-[14px]" role="status">Loading the latest version of Compass…</p>
    } @else {
      <div class="grid min-h-[inherit] place-items-center px-page-x" role="alert">
        <div class="flex max-w-sm flex-col items-center gap-2 text-center text-[14px]">
          <p class="text-foreground font-medium">Couldn’t open {{ what() }}.</p>
          <p class="text-muted-foreground">The connection may have dropped. Check it and try again.</p>
          <button hlmBtn type="button" variant="outline" size="sm" (click)="reload()">Retry</button>
        </div>
      </div>
    }
  `,
})
export class PageLoadFailed {
  /** "the agent builder", "the docs"… */
  readonly what = input.required<string>();
  protected readonly reload = inject(PAGE_RELOAD);
  protected readonly reloading = reloadOnceForNewBuild(sessionStore(inject(DOCUMENT)), this.reload, Date.now());
}
