import { Service, signal, type Signal } from '@angular/core';

/**
 * PLACEHOLDER (r2/fe-kassandra): the global hotel scope, until the scope switcher's branch lands its own
 * `ScopeService` at this path. Kassandra only reads `hotels`: the codes every question is asked for, where an empty
 * list means the whole group (docs/round2-contracts.md §1).
 */
@Service()
export class ScopeService {
  private readonly selected = signal<string[]>([]);
  readonly hotels: Signal<string[]> = this.selected.asReadonly();

  set(hotels: readonly string[]): void {
    this.selected.set([...new Set(hotels)]);
  }
}
