import {
  sendPasswordReset,
  confirmPasswordResetCode,
  verifyResetCode,
  updateUserPassword,
} from './authService';
import { ROUTES } from '../routes/paths';

/**
 * Returns the canonical password reset continue URL.
 * Guarantees that password reset email links direct to the deployed EasyList website,
 * never localhost, a broken URL, or an unrelated domain.
 */
export function getResetRedirectUrl(): string {
  let envUrl: string | undefined;
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      envUrl = (import.meta as any).env.VITE_APP_URL || (import.meta as any).env.VITE_SITE_URL;
    }
  } catch {
    // import.meta may not exist in pure Node CommonJS/legacy mode
  }

  if (!envUrl && typeof process !== 'undefined' && process.env) {
    envUrl = process.env.VITE_APP_URL || process.env.VITE_SITE_URL;
  }

  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return `${envUrl.replace(/\/+$/, '')}${ROUTES.RESET_PASSWORD}`;
  }

  // If in browser and on a live production domain, use the current origin
  if (
    typeof window !== 'undefined' &&
    window.location.origin &&
    !window.location.origin.includes('localhost') &&
    !window.location.origin.includes('127.0.0.1')
  ) {
    return `${window.location.origin}${ROUTES.RESET_PASSWORD}`;
  }

  // Canonical production deployed EasyList website
  return `https://easylist-588d9.web.app${ROUTES.RESET_PASSWORD}`;
}

export async function requestPasswordReset(
  email: string,
  redirectTo?: string
): Promise<void> {
  const targetUrl = redirectTo || getResetRedirectUrl();
  await sendPasswordReset(email, targetUrl);
}

export async function verifyActionCode(oobCode: string): Promise<string> {
  return await verifyResetCode(oobCode);
}

export async function confirmReset(oobCode: string, newPassword: string): Promise<void> {
  await confirmPasswordResetCode(oobCode, newPassword);
}

export async function updatePassword(password: string): Promise<void> {
  await updateUserPassword(password);
}
