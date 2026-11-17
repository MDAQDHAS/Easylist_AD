/**
 * EasyList UI State Management Patterns
 * Defines consistent states for asynchronous UI operations (loading, success, empty, error).
 */

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export interface AsyncState<T, E = Error> {
  status: AsyncStatus;
  data: T | null;
  error: E | null;
  isLoading: boolean;
  isSuccess: boolean;
  isEmpty: boolean;
  isError: boolean;
}

export function createInitialState<T, E = Error>(initialData: T | null = null): AsyncState<T, E> {
  return {
    status: 'idle',
    data: initialData,
    error: null,
    isLoading: false,
    isSuccess: false,
    isEmpty: false,
    isError: false,
  };
}

export function createLoadingState<T, E = Error>(previousData: T | null = null): AsyncState<T, E> {
  return {
    status: 'loading',
    data: previousData,
    error: null,
    isLoading: true,
    isSuccess: false,
    isEmpty: false,
    isError: false,
  };
}

export function createSuccessState<T, E = Error>(data: T): AsyncState<T, E> {
  // If array is empty, mark as empty state
  const isEmpty = Array.isArray(data) ? data.length === 0 : data === null || data === undefined;
  return {
    status: isEmpty ? 'empty' : 'success',
    data,
    error: null,
    isLoading: false,
    isSuccess: !isEmpty,
    isEmpty,
    isError: false,
  };
}

export function createErrorState<T, E = Error>(error: E, fallbackData: T | null = null): AsyncState<T, E> {
  return {
    status: 'error',
    data: fallbackData,
    error,
    isLoading: false,
    isSuccess: false,
    isEmpty: false,
    isError: true,
  };
}
