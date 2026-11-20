import { httpResource, type HttpResourceRef } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { ApiHttp, type ApiResult } from './api-http';

/**
 * One hotel of the group, as `GET /api/hotels` returns it (docs/round2-contracts.md §1).
 * Mirrors the contract until `@compass/contracts` exports `HotelRef`; then import it from there.
 */
export interface HotelRef {
  code: string;
  name: string;
  city: string;
  country: string;
  region: string;
  brand: string;
  rooms: number;
}

/** The hotels of the group, for the scope switcher and the workflow builder. */
@Service()
export class HotelsApi {
  private readonly api = inject(ApiHttp);

  list(): Promise<ApiResult<HotelRef[]>> {
    return this.api.get('hotels');
  }

  /** `value()` is undefined until the list loads; check `hasValue()` first, since the endpoint may be missing. */
  listResource(): HttpResourceRef<HotelRef[] | undefined> {
    return httpResource<HotelRef[]>(() => this.api.url('hotels'));
  }
}
