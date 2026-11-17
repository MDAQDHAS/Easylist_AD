/**
 * EasyList Centralized Configuration
 * Reads environment variables with safe defaults.
 */

const parseBoolean = (value: string | boolean | undefined, defaultValue: boolean): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
  }
  return defaultValue;
};

/**
 * When true, EasyList launches in Demo Mode without requiring login or signup.
 * Visitors directly access the Dashboard, Review and Export screens.
 * When false, the standard Supabase/backend authentication flow is restored.
 */
export const isDemoMode = false;

export const appConfig = {
  appName: import.meta.env.VITE_APP_NAME || 'EasyList',
  appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
  companyName: import.meta.env.VITE_COMPANY_NAME || 'Avenzo Technologies',
  isDemoMode,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  apiTimeoutMs: Number(import.meta.env.VITE_API_TIMEOUT_MS) || 30000,
} as const;
