import { httpResource } from '@angular/common/http';
import { computed, inject, Service } from '@angular/core';
import type { Brief } from '@compass/contracts';
import { ApiHttp, toApiError, type ApiError, type ApiResult } from './api-http';

/** Today's usage of the shared daily budget (`GET /api/budget`). */
export type BudgetKind = 'question' | 'workflow_run' | 'decision' | 'brief_refresh' | 'embedding';
export type Budget = Record<BudgetKind, { used: number; limit: number }>;

/** The morning brief. The request starts when the service is first injected. */
@Service()
export class BriefApi {
  private readonly api = inject(ApiHttp);

  /** `GET /api/brief`. Items come ranked: critical first, then by absolute EUR impact. */
  readonly brief = httpResource<Brief>(() => this.api.url('brief'));

  /** The load error as a value, or null. */
  readonly error = computed<ApiError | null>(() => {
    const cause = this.brief.error();
    return cause ? toApiError(cause) : null;
  });

  /** `POST /api/brief/refresh` (rate-limited and budgeted), then shows the new brief. */
  async refresh(): Promise<ApiResult<Brief>> {
    const result = await this.api.post<Brief>('brief/refresh');
    if (result.ok) this.brief.set(result.value);
    return result;
  }

  budget(): Promise<ApiResult<Budget>> {
    return this.api.get<Budget>('budget');
  }

  health(): Promise<ApiResult<{ ok: boolean; businessDate: string }>> {
    return this.api.get('health');
  }
}
