/**
 * TRAJECT Centralized API Client (Milestone 5B)
 *
 * Provides a unified, typed HTTP client:
 * - Environment-driven Base URL (VITE_API_BASE_URL) defaults to http://localhost:8000/api/v1
 * - Mock vs Live API switching (VITE_USE_MOCK_DATA: default false in production)
 * - Strict 5A Error Envelope parsing (error.code, error.message, error.details)
 * - Request cancellation via AbortSignal
 * - In-memory GET caching with TTL
 */

import type { ErrorEnvelope } from '../types/api.ts';

const env = (import.meta as unknown as { env?: Record<string, string> }).env;

export const API_BASE_URL =
  env?.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

// In production, live API is default. Mock data is active ONLY when explicitly set to 'true'.
export const USE_MOCK_DATA =
  env?.VITE_USE_MOCK_DATA === 'true';

export class ApiError extends Error {
  public status: number;
  public friendlyMessage: string;
  public endpoint: string;
  public code?: string;
  public details?: Record<string, unknown>;
  public timestampUtc?: string;

  constructor(
    status: number,
    message: string,
    endpoint: string,
    code?: string,
    details?: Record<string, unknown>,
    timestampUtc?: string
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
    this.code = code;
    this.details = details;
    this.timestampUtc = timestampUtc;
    this.friendlyMessage = ApiError.getFriendlyMessage(status, message, code);
  }

  private static getFriendlyMessage(status: number, rawMessage: string, code?: string): string {
    if (code === 'ARTIFACT_NOT_FOUND' || code === 'ARTIFACT_CORRUPTED') {
      return 'The backend analytics artifacts are currently unavailable or being processed.';
    }
    if (code === 'RESOURCE_NOT_FOUND') {
      return rawMessage || 'The requested entity could not be found.';
    }
    if (code === 'INVALID_QUERY_PARAMETER' || code === 'INVALID_FILTER_VALUE') {
      return `Invalid query parameters: ${rawMessage}`;
    }

    switch (status) {
      case 400:
        return rawMessage || 'The request contains invalid parameters. Please review your query filters.';
      case 401:
        return 'Your monitoring session has expired. Please refresh credentials.';
      case 403:
        return 'Access forbidden for this telemetry stream.';
      case 404:
        return rawMessage || 'The requested intelligence record or entity could not be found.';
      case 429:
        return 'Rate limit exceeded on telemetry ingest. Please wait a moment before retrying.';
      case 500:
      case 502:
        return 'TRAJECT encountered an internal server error while serving analytics.';
      case 503:
        return 'The backend analytics service or precomputed artifacts are currently unavailable.';
      default:
        return rawMessage || 'An unexpected communication error occurred.';
    }
  }
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  cacheTtlMs?: number;
  skipCache?: boolean;
}

// In-memory cache for GET queries
const cache = new Map<string, { data: unknown; expiresAt: number }>();

export const apiClient = {
  /**
   * Helper to construct safe, clean URL query strings from parameters.
   */
  buildQueryString(params?: Record<string, unknown>): string {
    if (!params) return '';
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '' || value === 'All') {
        continue;
      }
      searchParams.append(key, String(value));
    }

    const qs = searchParams.toString();
    return qs ? `?${qs}` : '';
  },

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const {
      timeoutMs = 15000,
      cacheTtlMs = 0,
      skipCache = false,
      headers = {},
      ...fetchOptions
    } = options;

    const base = API_BASE_URL.replace(/\/+$/, '');
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = endpoint.startsWith('http') ? endpoint : `${base}${path}`;
    const isGet = !fetchOptions.method || fetchOptions.method.toUpperCase() === 'GET';

    // Cache hit check
    if (isGet && !skipCache && cacheTtlMs > 0) {
      const cached = cache.get(url);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data as T;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    if (fetchOptions.signal) {
      fetchOptions.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errMessage = response.statusText;
        let errCode: string | undefined;
        let errDetails: Record<string, unknown> | undefined;
        let errTimestamp: string | undefined;

        try {
          const errBody = await response.json();
          // Milestone 5A Standard Error Envelope
          if (errBody && typeof errBody === 'object' && 'error' in errBody) {
            const envelope = errBody as ErrorEnvelope;
            errMessage = envelope.error.message;
            errCode = envelope.error.code;
            errDetails = envelope.error.details;
            errTimestamp = envelope.error.timestamp_utc;
          } else if (errBody?.detail) {
            errMessage = typeof errBody.detail === 'string' ? errBody.detail : JSON.stringify(errBody.detail);
          } else if (errBody?.message) {
            errMessage = errBody.message;
          }
        } catch {
          // ignore non-json error responses
        }

        throw new ApiError(response.status, errMessage, endpoint, errCode, errDetails, errTimestamp);
      }

      if (response.status === 204) {
        return {} as T;
      }

      const data = (await response.json()) as T;

      if (isGet && cacheTtlMs > 0) {
        cache.set(url, { data, expiresAt: Date.now() + cacheTtlMs });
      }

      return data;
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof ApiError) {
        throw err;
      }

      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ApiError(408, 'Request timed out or was cancelled.', endpoint);
      }

      throw new ApiError(
        0,
        'Network communication failure. Unable to reach TRAJECT API gateway.',
        endpoint
      );
    }
  },

  get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  },

  post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  },

  clearCache(): void {
    cache.clear();
  },
};

/**
 * Isolated offline fallback fetcher strictly for isolated development / fallback testing.
 */
export async function simulateFetch<T>(data: T, delayMs = 60): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), delayMs));
}
