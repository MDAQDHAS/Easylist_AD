/**
 * EasyList Reusable HTTP Client
 * Production-ready fetch client supporting cancellation, timeouts, auth token injection,
 * and unified error handling without any hardcoded endpoints.
 */

import { apiConfig } from './config';
import { ApiError } from './error';
import { AuthTokenProvider, RequestConfig } from '../../types/api';

export class HttpClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private defaultTimeoutMs: number;
  private tokenProvider: AuthTokenProvider | null = null;

  constructor(config = apiConfig) {
    this.baseUrl = config.baseUrl;
    this.defaultHeaders = config.defaultHeaders;
    this.defaultTimeoutMs = config.timeoutMs;
  }

  /**
   * Set dynamic auth token provider once the backend auth mechanism is finalized.
   */
  public setTokenProvider(provider: AuthTokenProvider | null): void {
    this.tokenProvider = provider;
  }

  /**
   * Update base URL dynamically if required.
   */
  public setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * Core request execution method.
   */
  public async request<T>(endpoint: string, options: RequestConfig = {}): Promise<T> {
    const {
      method = 'GET',
      headers = {},
      params,
      body,
      timeoutMs = this.defaultTimeoutMs,
      requiresAuth = true,
      signal: callerSignal,
    } = options;

    // Build URL with query params
    const fullUrl = this.buildUrl(endpoint, params);

    // Prepare Request Headers
    const requestHeaders: Record<string, string> = {
      ...this.defaultHeaders,
      ...headers,
    };

    // Attach Bearer token if required and available
    if (requiresAuth && this.tokenProvider) {
      try {
        const token = await this.tokenProvider();
        if (token) {
          requestHeaders['Authorization'] = `Bearer ${token}`;
        }
      } catch (authErr) {
        console.warn('Failed to obtain auth token for request:', authErr);
        if (authErr instanceof Error && /not logged in|unauthenticated/i.test(authErr.message)) {
          throw new ApiError({
            message: 'Please sign in to upload and extract order chits.',
            status: 401,
            code: 'UNAUTHENTICATED',
          });
        }
      }
    }

    // Set up Timeout and Abort handling
    const abortController = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        abortController.abort(new Error('TIMEOUT'));
      }, timeoutMs);
    }

    // Link caller signal if provided
    if (callerSignal) {
      callerSignal.addEventListener('abort', () => {
        abortController.abort(callerSignal.reason);
      });
    }

    // Body preparation (JSON vs FormData)
    let formattedBody: BodyInit | null = null;
    if (body !== undefined && body !== null) {
      if (body instanceof FormData || body instanceof Blob) {
        // Let the browser set the boundary header for multipart/form-data
        delete requestHeaders['Content-Type'];
        formattedBody = body;
      } else {
        formattedBody = JSON.stringify(body);
      }
    }

    try {
      const response = await fetch(fullUrl, {
        method,
        headers: requestHeaders,
        body: formattedBody,
        signal: abortController.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const responseData = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        throw ApiError.fromResponse(response.status, responseData);
      }

      return responseData as T;
    } catch (error: unknown) {
      if (timeoutId) clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError' || abortController.signal.aborted) {
          if (abortController.signal.reason?.message === 'TIMEOUT') {
            throw ApiError.fromTimeout(timeoutMs);
          }
          throw ApiError.fromAbort();
        }
      }

      throw ApiError.fromNetworkError(error, fullUrl);
    }
  }

  public get<T>(endpoint: string, options?: Omit<RequestConfig, 'method'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T>(endpoint: string, body?: unknown, options?: Omit<RequestConfig, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  public put<T>(endpoint: string, body?: unknown, options?: Omit<RequestConfig, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  public patch<T>(endpoint: string, body?: unknown, options?: Omit<RequestConfig, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  public delete<T>(endpoint: string, options?: Omit<RequestConfig, 'method'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined | null>): string {
    const isAbsolute = endpoint.startsWith('http://') || endpoint.startsWith('https://');
    let urlString = isAbsolute ? endpoint : `${this.baseUrl.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        urlString += (urlString.includes('?') ? '&' : '?') + queryString;
      }
    }

    return urlString;
  }
}

export const apiClient = new HttpClient();
