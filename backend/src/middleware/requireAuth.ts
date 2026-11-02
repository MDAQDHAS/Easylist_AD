import type { RequestHandler } from 'express';
import { authAdmin, firebaseApp } from '../lib/firebaseAdmin.js';
import { SupabaseConfigurationError } from '../lib/supabase.js';
import {
  IdentityResolutionError,
  resolveUserIdentity,
} from '../services/identityService.js';

export interface AuthenticatedUser {
  id: string; // maps to internalUserId for backwards compatibility
  uid: string; // Firebase UID
  email: string;
  emailVerified: boolean;
  internalUserId: string; // UUID used in DB tables (shop_members, etc.)
  linkingStatus: 'LINKED' | 'REQUIRES_LINKING';
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Authentication token is required',
    });
    return;
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Authentication token is required',
    });
    return;
  }

  let tokenVerificationCompleted = false;

  try {
    // Verify the Firebase ID token and ensure it has not been revoked
    const decodedToken = await authAdmin.verifyIdToken(token, true);
    tokenVerificationCompleted = true;

    if (!decodedToken || !decodedToken.uid) {
      console.warn('Firebase ID token verification failed:', {
        projectId: firebaseApp.options.projectId || 'unknown',
        code: 'auth/invalid-id-token',
      });
      res.status(401).json({
        success: false,
        message: 'Invalid authentication token',
      });
      return;
    }

    const email = decodedToken.email || '';
    const emailVerified = Boolean(decodedToken.email_verified);
    
    // Resolve identity with explicit account linking verification
    const identityResult = await resolveUserIdentity(
      decodedToken.uid,
      email,
      emailVerified
    );

    const authenticatedUser: AuthenticatedUser = {
      id: identityResult.internalUserId,
      uid: decodedToken.uid,
      email,
      emailVerified,
      internalUserId: identityResult.internalUserId,
      linkingStatus: identityResult.status,
    };

    res.locals.user = authenticatedUser;
    res.locals.idToken = token;
    next();
  } catch (err: unknown) {
    if (err instanceof SupabaseConfigurationError) {
      res.status(500).json({
        success: false,
        message: 'A server configuration error occurred',
      });
      return;
    }

    if (err instanceof IdentityResolutionError) {
      res.status(503).json({
        success: false,
        message: 'Unable to verify account identity. Please try again.',
      });
      return;
    }

    const errorObj = err && typeof err === 'object' ? (err as Record<string, unknown>) : {};
    const rawErrorCode = typeof errorObj.code === 'string' ? errorObj.code : '';
    const errorCode = /^(?:auth|app)\/[a-z0-9-]+$/i.test(rawErrorCode)
      ? rawErrorCode
      : 'unknown';
    if (!tokenVerificationCompleted) {
      console.warn('Firebase ID token verification failed:', {
        projectId: firebaseApp.options.projectId || 'unknown',
        code: errorCode,
      });
    }

    if (errorCode === 'auth/id-token-revoked') {
      res.status(401).json({
        success: false,
        message: 'Authentication token has been revoked',
      });
      return;
    }

    if (errorCode === 'auth/id-token-expired') {
      res.status(401).json({
        success: false,
        message: 'Authentication token has expired',
      });
      return;
    }

    res.status(401).json({
      success: false,
      message: 'Invalid authentication token',
    });
  }
};

/**
 * Middleware that requires the authenticated user to have a verified email.
 */
export const requireVerifiedEmail: RequestHandler = (_req, res, next) => {
  const user = res.locals.user as AuthenticatedUser | undefined;

  if (!user || !user.emailVerified) {
    res.status(403).json({
      success: false,
      message: 'Email verification is required to perform this action',
    });
    return;
  }

  next();
};

/**
 * Middleware that requires any legacy account linking to be confirmed
 * before accessing sensitive shop data. Prevents unauthorized legacy shop access.
 */
export const requireConfirmedLinking: RequestHandler = (_req, res, next) => {
  const user = res.locals.user as AuthenticatedUser | undefined;

  if (!user) {
    res.status(401).json({
      success: false,
      message: 'Authentication is required',
    });
    return;
  }

  if (user && user.linkingStatus === 'REQUIRES_LINKING') {
    res.status(403).json({
      success: false,
      message: 'Additional account verification is required before continuing.',
    });
    return;
  }

  next();
};
