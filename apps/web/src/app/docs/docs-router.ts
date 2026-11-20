import { DOCUMENT, Service, computed, inject, signal } from '@angular/core';
import { ScopeService } from '../scope/scope.service';
import { CompassStore } from '../store';
import { type DocsPageId, docsPageOf, docsPath, docsTitle } from './docs-pages';

/**
 * Which docs page is open. The app's own navigation (`CompassStore.view`, `Live.applyUrl`) only knows the view
 * `docs`; the page inside it lives here and in the address, so a reload and Back land on the same page.
 */
@Service()
export class DocsRouter {
  private readonly store = inject(CompassStore);
  private readonly scope = inject(ScopeService);
  private readonly view = inject(DOCUMENT).defaultView;

  readonly page = signal<DocsPageId>(docsPageOf(this.view?.location.pathname ?? '') ?? 'index');
  readonly title = computed(() => docsTitle(this.page()));

  constructor() {
    // Back and Forward: the address has already changed, so the page follows it.
    this.view?.addEventListener('popstate', () => this.sync());
  }

  /** Opens a docs page from anywhere in the app. */
  open(id: DocsPageId) {
    const path = docsPath(id);
    const loc = this.view?.location;
    if (loc && loc.pathname.replace(/\/+$/, '') !== path) this.view?.history.pushState(null, '', this.scope.href(path));
    this.page.set(id);
    this.store.view.set('docs');
  }

  private sync() {
    const page = docsPageOf(this.view?.location.pathname ?? '');
    if (page) this.page.set(page);
  }
}
