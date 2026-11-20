import { computed, inject, Service, signal } from '@angular/core';
import { ApiHttp } from '../api';
import { HOTELS } from '../filters';
import type { HotelRef } from './types';

/**
 * Hotel names by code, so a table never shows "LIS" where it can say "Arbor Lisbon Chiado".
 *
 * `GET /api/hotels` (contracts §1) is the source. Until it answers, or if it fails, the names come from the hotel
 * list the app already ships with; a code neither knows is shown as the code.
 */
@Service()
export class HotelDirectory {
  private readonly api = inject(ApiHttp);
  private readonly served = signal<readonly HotelRef[]>([]);

  /** Code → name, from the server where it has answered. */
  readonly names = computed<ReadonlyMap<string, string>>(() => {
    const names = new Map<string, string>(HOTELS.map((hotel) => [hotel.code, hotel.name]));
    for (const hotel of this.served()) names.set(hotel.code, hotel.name);
    return names;
  });

  constructor() {
    void this.load();
  }

  /** The hotel's name, or undefined for a code that is not a hotel. Reads a signal, so templates follow it. */
  readonly name = (code: string): string | undefined => this.names().get(code);

  readonly has = (code: string): boolean => this.names().has(code);

  private async load(): Promise<void> {
    const result = await this.api.get<HotelRef[]>('hotels');
    if (result.ok && Array.isArray(result.value)) {
      this.served.set(result.value.filter((hotel) => typeof hotel?.code === 'string' && typeof hotel?.name === 'string'));
    }
  }
}
