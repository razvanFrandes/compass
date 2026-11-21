import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE, apiUrl, type QueryParams } from './api-config';

/** A failed call, as a value. `message` is the server's `error` text: show it as is. */
export interface ApiError {
  /** The HTTP status; 0 when the request never got an answer (offline, DNS, CORS). */
  status: number;
  message: string;
  /** 429 only: when the daily budget resets (ISO). */
  resetsAt?: string;
}

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: ApiError };

const FALLBACK: Record<number, string> = {
  0: 'Couldn’t reach Compass. Check your connection and try again.',
  403: 'That isn’t allowed from this page. Reload and try again.',
  404: 'That no longer exists. Reload to see the latest.',
  413: 'That’s too long to send. Shorten it and try again.',
  429: 'Today’s limit is reached. Try again tomorrow.',
};

function field(body: unknown, key: string): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' && value ? value : undefined;
}

/** Any thrown value (an `HttpErrorResponse`, a resource's `error()`) as an `ApiError`. */
export function toApiError(cause: unknown): ApiError {
  if (cause instanceof HttpErrorResponse) {
    const message = field(cause.error, 'error') ?? FALLBACK[cause.status] ?? 'Something went wrong on our side. Try again in a moment.';
    const resetsAt = field(cause.error, 'resetsAt');
    return { status: cause.status, message, ...(resetsAt ? { resetsAt } : {}) };
  }
  // A resource wraps the cause of a failed load in an Error.
  if (cause instanceof Error && cause.cause instanceof HttpErrorResponse) return toApiError(cause.cause);
  return { status: 0, message: FALLBACK[0]! };
}

/** JSON calls to `/api/…` that never throw: every call resolves to an `ApiResult`. */
@Service()
export class ApiHttp {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  url(path: string, query?: QueryParams): string {
    return apiUrl(this.base, path, query);
  }

  get<T>(path: string, query?: QueryParams): Promise<ApiResult<T>> {
    return this.settle(this.http.get<T>(this.url(path, query)));
  }

  post<T>(path: string, body: unknown = {}): Promise<ApiResult<T>> {
    return this.settle(this.http.post<T>(this.url(path), body));
  }

  patch<T>(path: string, body: unknown): Promise<ApiResult<T>> {
    return this.settle(this.http.patch<T>(this.url(path), body));
  }

  /** A `DELETE` answers 204 with no body: `value` is then null. */
  delete<T = null>(path: string): Promise<ApiResult<T>> {
    return this.settle(this.http.delete<T>(this.url(path)));
  }

  private async settle<T>(request: ReturnType<HttpClient['get']>): Promise<ApiResult<T>> {
    try {
      return { ok: true, value: (await firstValueFrom(request)) as T };
    } catch (cause) {
      return { ok: false, error: toApiError(cause) };
    }
  }
}
