import { inject, Service } from '@angular/core';
import { ApiHttp, type ApiResult, type VoiceToken } from '../../api';

/** `POST /api/voice/token` (docs/round2-contracts.md §6): a temporary Soniox key for one voice question. */
@Service()
export class VoiceApi {
  private readonly api = inject(ApiHttp);

  /** Rate-limited per client (429 with the server's message) and counted against the daily voice budget. */
  token(): Promise<ApiResult<VoiceToken>> {
    return this.api.post<VoiceToken>('voice/token');
  }
}
