/**
 * EasyList Centralized API Configuration
 * Reads from environment variables (VITE_API_BASE_URL)
 */

export interface ApiConfig {
  baseUrl: string;
  timeoutMs: number;
  defaultHeaders: Record<string, string>;
}

export const apiConfig: ApiConfig = {
  baseUrl: import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000/api',
  timeoutMs: Number(import.meta.env?.VITE_API_TIMEOUT_MS) || 30000,
  defaultHeaders: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
};
