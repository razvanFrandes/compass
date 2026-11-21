import { httpResource } from '@angular/common/http';
import { computed, inject, Service } from '@angular/core';
import type { BriefOverview } from '@compass/contracts';
import { ApiHttp, toApiError } from '../api/api-http';
import { ScopeService } from '../scope/scope.service';

/**
 * The numbers around the morning brief (`GET /api/brief/overview?hotels=`), for the hotels in scope. The request
 * follows the scope: a change of scope reads again, and the page shows its skeletons meanwhile.
 */
@Service()
export class BriefOverviewApi {
  private readonly api = inject(ApiHttp);
  private readonly scope = inject(ScopeService);

  readonly overview = httpResource<BriefOverview>(() => this.api.url('brief/overview', { hotels: this.scope.hotels().join(',') || null }));

  /** The overview once it has loaded; null while it loads and when it failed. */
  readonly value = computed<BriefOverview | null>(() => (this.overview.hasValue() ? (this.overview.value() ?? null) : null));
  readonly state = computed<'loading' | 'ready' | 'error'>(() => (this.value() ? 'ready' : this.overview.error() ? 'error' : 'loading'));
  /** The server's message when the whole read failed, to show as it is. */
  readonly error = computed(() => (this.overview.error() ? toApiError(this.overview.error()).message : null));

  /** How one part reads: a part the server could not compute is an error of its own, with the rest still shown. */
  part(name: 'pulse' | 'nights' | 'pickup' | 'money' | 'health'): 'loading' | 'ready' | 'error' {
    const value = this.value();
    if (!value) return this.state();
    return value[name] === null || value.failed.includes(name) ? 'error' : 'ready';
  }

  retry(): void {
    this.overview.reload();
  }
}
