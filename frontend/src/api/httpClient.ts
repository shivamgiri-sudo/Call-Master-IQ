/**
 * httpClient — central API client.
 *
 * Responsibilities:
 *   1. Bearer-token injection (token read from AuthContext via getToken callback)
 *   2. Base URL from import.meta.env.VITE_API_BASE_URL (or default http://localhost:5050)
 *   3. JSON encode/decode
 *   4. Standard-envelope classification:
 *        - 2xx + data           → ApiOk<T>
 *        - 2xx + supported:false→ ApiUnsupported
 *        - 2xx + empty data     → ApiEmpty
 *        - non-2xx              → ApiError
 *   5. NEVER logs Authorization header, token, password, or raw Authorization value
 *   6. NEVER throws — every call returns a discriminated ApiResult<T>
 */

import type {
  ApiOk,
  ApiUnsupported,
  ApiEmpty,
  ApiError,
  ApiResult,
  MetaEnvelope,
} from './types';

const DEFAULT_BASE_URL = 'http://localhost:5050';

let _baseUrl: string = import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL;
let _token: string | null = null;
let _authFailureHandler: ((status: 401 | 403) => void) | null = null;

export function configureHttp(opts: { baseUrl?: string; token?: string | null }): void {
  if (opts.baseUrl !== undefined) _baseUrl = opts.baseUrl;
  _token = opts.token ?? _token;
}

export function setAuthFailureHandler(handler: ((status: 401 | 403) => void) | null): void {
  _authFailureHandler = handler;
}

export function getBaseUrl(): string {
  return _baseUrl;
}

function classifyEmpty(data: unknown): boolean {
  if (data === null || data === undefined) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === 'object') {
    // supported:false is NOT empty — it is unsupported (handled separately)
    return Object.keys(data as object).length === 0;
  }
  return false;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  opts?: { query?: { [key: string]: string | number | null | undefined }; body?: unknown },
): Promise<ApiResult<T>> {
  const url = new URL(_baseUrl + path);
  if (opts?.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (opts?.body !== undefined) headers['Content-Type'] = 'application/json';
  if (_token) headers['Authorization'] = `Bearer ${_token}`;

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
      // Note: do NOT include credentials by default; backend uses Bearer-only auth
    });
  } catch (err: any) {
    // Network error / CORS / unreachable host
    return {
      kind: 'error',
      status: 0,
      code: 'NETWORK_ERROR',
      message: err?.message || 'Network error: backend unreachable',
      retryable: true,
    } satisfies ApiError;
  }

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON response
    return {
      kind: 'error',
      status: response.status,
      code: 'INVALID_RESPONSE',
      message: `Server returned non-JSON (HTTP ${response.status})`,
      retryable: response.status >= 500,
    } satisfies ApiError;
  }

  if (!response.ok || payload?.success === false) {
    if ((response.status === 401 || response.status === 403) && _authFailureHandler) {
      _authFailureHandler(response.status as 401 | 403);
    }
    return {
      kind: 'error',
      status: response.status,
      code: payload?.code,
      message: payload?.message || `HTTP ${response.status}`,
      retryable: response.status >= 500 || response.status === 0,
    } satisfies ApiError;
  }

  // 2xx success path — classify the data
  const data = payload?.data as T | undefined;
  const meta: MetaEnvelope = payload?.meta ?? {
    source: 'generic',
    cacheHit: false,
    queryMs: 0,
    totalMs: 0,
    from: '',
    to: '',
  };

  if (data && typeof data === 'object' && (data as any).supported === false) {
    return {
      kind: 'unsupported',
      reason: String((data as any).reason ?? 'UNSUPPORTED'),
    } satisfies ApiUnsupported;
  }

  if (classifyEmpty(data)) {
    return { kind: 'empty', meta } satisfies ApiEmpty;
  }

  return { kind: 'ok', data: data as T, meta } satisfies ApiOk<T>;
}

export const http = {
  get: <T>(path: string, query?: { [key: string]: string | number | null | undefined }) =>
    request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown, query?: { [key: string]: string | number | null | undefined }) =>
    request<T>('POST', path, { query, body }),
};
