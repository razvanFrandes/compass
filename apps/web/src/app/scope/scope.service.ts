import { DOCUMENT, Service, computed, effect, inject, signal, type Signal } from '@angular/core';
import { HotelsApi } from '../api/hotels-api';
import { setHotelCatalog } from '../charts/hotel-names';
import { HALCYON_HOTELS, isHotelList, normalizeCodes, parseScopeParam, scopeLabel, scopePhrase, withScopeParam, type HotelRef } from './hotels';

export const SCOPE_STORAGE_KEY = 'compass.scope';

/**
 * The hotels the person works on: the whole group, a region, a brand or any set (plan-round2.md A4).
 * One scope for the whole app. It lives in the address (`?hotels=LIS,PAR`), so a link carries it, and in local
 * storage, so it is still there on the next visit. An empty list means the whole group.
 *
 * Read `hotels()` to scope a request (Kassandra sends it as `scope.hotels`), `includes(code)` to filter rows on
 * the client, and `label()` to show it.
 */
@Service()
export class ScopeService {
  private readonly api = inject(HotelsApi);
  private readonly view = inject(DOCUMENT).defaultView;
  private readonly remote = this.api.listResource();

  /**
   * The group's hotels from `GET /api/hotels`. Until it answers, and when it cannot be reached or is not
   * deployed yet, this is the built-in list of the 20 Halcyon hotels (`source()` says which).
   */
  readonly catalog: Signal<readonly HotelRef[]> = computed(() => {
    const value = this.remote.hasValue() ? this.remote.value() : undefined;
    return isHotelList(value) ? value : HALCYON_HOTELS;
  });
  readonly source = computed<'api' | 'built-in'>(() => (this.catalog() === HALCYON_HOTELS ? 'built-in' : 'api'));

  private readonly chosen = signal<string[]>(this.restore());

  /** Hotel codes in scope, in the catalog's order. Empty means the whole group. */
  readonly hotels: Signal<string[]> = computed(() => normalizeCodes(this.chosen(), this.catalog()), { equal: (a, b) => a.length === b.length && a.every((code, i) => code === b[i]) });
  readonly isAll = computed(() => this.hotels().length === 0);
  /** "All 20 hotels", "Europe · 8 hotels", "Arbor Lisbon Chiado", "Lisbon Chiado + 2 more". */
  readonly label = computed(() => scopeLabel(this.hotels(), this.catalog()));
  /** For a sentence: "all 20 hotels", "8 hotels in Europe", "Arbor Lisbon Chiado". */
  readonly phrase = computed(() => scopePhrase(this.hotels(), this.catalog()));
  /** How many hotels the scope covers (the whole catalog when nothing narrower is chosen). */
  readonly count = computed(() => this.hotels().length || this.catalog().length);

  constructor() {
    effect(() => this.persist(this.hotels()));
    // Charts name hotels from the same list the scope picker uses.
    effect(() => setHotelCatalog(this.catalog()));
    // Back and Forward change the place, not the scope: the scope is written again on the address they land on.
    this.view?.addEventListener?.('popstate', () => this.writeUrl(this.hotels()));
  }

  set(codes: readonly string[]): void {
    this.chosen.set(normalizeCodes(codes, this.catalog()));
  }

  toggle(code: string): void {
    const now = this.hotels();
    this.set(now.includes(code) ? now.filter((c) => c !== code) : [...now, code]);
  }

  /** Back to the whole group. */
  clear(): void {
    this.chosen.set([]);
  }

  /** Whether a row of this hotel is in scope. Use it to filter lists that the server sends unscoped. */
  includes(code: string | null | undefined): boolean {
    const hotels = this.hotels();
    return !hotels.length || (!!code && hotels.includes(code.toUpperCase()));
  }

  /** "Arbor Lisbon Chiado" for `LIS`; the code itself when the catalog does not know it. */
  nameOf(code: string): string {
    return this.catalog().find((hotel) => hotel.code === code)?.name ?? code;
  }

  /** An address of the app with the scope on it. Use it wherever the app writes to the address bar. */
  href(href: string): string {
    return withScopeParam(href, this.hotels());
  }

  /** The address wins over what was stored: a shared link opens with the sender's scope. */
  private restore(): string[] {
    try {
      const fromUrl = parseScopeParam(new URLSearchParams(this.view?.location?.search ?? '').get('hotels'));
      if (fromUrl) return fromUrl;
      const stored: unknown = JSON.parse(this.view?.localStorage?.getItem(SCOPE_STORAGE_KEY) ?? 'null');
      return Array.isArray(stored) ? (parseScopeParam(stored.filter((code) => typeof code === 'string').join(',')) ?? []) : [];
    } catch {
      return [];
    }
  }

  private persist(codes: readonly string[]): void {
    try {
      this.view?.localStorage?.setItem(SCOPE_STORAGE_KEY, JSON.stringify(codes));
    } catch {
      /* private mode: the scope lives in the address and for this visit only */
    }
    this.writeUrl(codes);
  }

  private writeUrl(codes: readonly string[]): void {
    const location = this.view?.location;
    if (!location) return;
    const here = `${location.pathname}${location.search}${location.hash}`;
    const next = withScopeParam(here, codes);
    try {
      if (next !== here) this.view?.history?.replaceState(this.view.history.state, '', next);
    } catch {
      /* sandboxed frames may refuse history access; the scope still works */
    }
  }
}
