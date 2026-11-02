/**
 * EasyList API Error Representation
 * Provides consistent error structure across all HTTP operations.
 */

import { ApiErrorDetail, ApiErrorResponse } from '../../types/api';

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: ApiErrorDetail[];
  public readonly isNetworkError: boolean;
  public readonly isTimeout: boolean;
  public readonly isAborted: boolean;
  public readonly rawResponse?: unknown;

  constructor(params: {
    message: string;
    status: number;
    code?: string;
    details?: ApiErrorDetail[];
    isNetworkError?: boolean;
    isTimeout?: boolean;
    isAborted?: boolean;
    rawResponse?: unknown;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
    this.isNetworkError = params.isNetworkError ?? false;
    this.isTimeout = params.isTimeout ?? false;
    this.isAborted = params.isAborted ?? false;
    this.rawResponse = params.rawResponse;

    // Restore prototype chain
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static fromNetworkError(originalError?: unknown, requestUrl?: string): ApiError {
    let message = 'Network connection error. Please check your internet connection.';

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      message = 'You appear to be offline. Please check your internet connection.';
    } else if (requestUrl) {
      try {
        const urlObj = new URL(requestUrl, typeof window !== 'undefined' ? window.location?.origin : 'http://localhost:3000');
        if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
          message = `Unable to connect to the EasyList server (${urlObj.origin}). Please ensure the backend server is running.`;
        } else {
          message = `Unable to connect to the EasyList server at ${urlObj.host}. Please check your connection.`;
        }
      } catch {
        // Fall back to clean message
      }
    } else if (originalError instanceof Error && originalError.message) {
      if (/failed to fetch|econnrefused|networkerror/i.test(originalError.message)) {
        message = 'Unable to connect to the EasyList server. Please ensure the backend server is running.';
      }
    }

    return new ApiError({
      message,
      status: 0,
      code: 'NETWORK_ERROR',
      isNetworkError: true,
      rawResponse: originalError,
    });
  }

  static fromTimeout(timeoutMs: number): ApiError {
    return new ApiError({
      message: `Request timed out after ${timeoutMs}ms. Please try again.`,
      status: 408,
      code: 'REQUEST_TIMEOUT',
      isTimeout: true,
    });
  }

  static fromAbort(): ApiError {
    return new ApiError({
      message: 'Request was cancelled.',
      status: 499,
      code: 'REQUEST_ABORTED',
      isAborted: true,
    });
  }

  static fromResponse(status: number, responseData: unknown): ApiError {
    const errorData = responseData as Partial<ApiErrorResponse> | null;
    const message = errorData?.message || `Request failed with status ${status}`;
    const code = errorData?.code || `HTTP_${status}`;
    const details = errorData?.details;

    return new ApiError({
      message,
      status,
      code,
      details,
      rawResponse: responseData,
    });
  }
}
