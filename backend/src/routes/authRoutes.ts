import { Router } from 'express';
import { requireAuth, requireVerifiedEmail } from '../middleware/requireAuth.js';
import { SupabaseConfigurationError } from '../lib/supabase.js';
import { optOutAccountLinking } from '../services/identityService.js';

const router = Router();

/**
 * GET /api/auth/me
 * Returns current authenticated user and account linking status.
 */
router.get('/me', requireAuth, (_req, res) => {
  const user = res.locals.user;
  res.status(200).json({
    success: true,
    user: {
      id: user.internalUserId,
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
    },
  });
});

/**
 * POST /api/auth/link/initiate
 * Legacy linking is disabled until a safe ownership-proof process is available.
 */
router.post('/link/initiate', requireAuth, requireVerifiedEmail, (_req, res) => {
  res.status(503).json({
    success: false,
    message: 'Secure recovery for existing shop profiles is temporarily unavailable.',
  });
});

/**
 * POST /api/auth/link/confirm
 * Legacy linking is disabled until a safe ownership-proof process is available.
 */
router.post('/link/confirm', requireAuth, requireVerifiedEmail, (_req, res) => {
  res.status(503).json({
    success: false,
    message: 'Secure recovery for existing shop profiles is temporarily unavailable.',
  });
});

/**
 * POST /api/auth/link/opt-out
 * Creates an independent identity so the user can register a new shop
 * without accessing or affecting the legacy account.
 */
router.post('/link/opt-out', requireAuth, requireVerifiedEmail, async (_req, res) => {
  try {
    const user = res.locals.user;
    const result = await optOutAccountLinking(user.uid, user.email);

    res.status(200).json({
      success: true,
      message: 'Independent profile created. You can now register a fresh shop.',
      internalUserId: result.internalUserId,
    });
  } catch (err) {
    if (err instanceof SupabaseConfigurationError) {
      res.status(500).json({
        success: false,
        message: 'A server configuration error occurred',
      });
      return;
    }

    res.status(400).json({
      success: false,
      message: err instanceof Error ? err.message : 'Unable to proceed',
    });
  }
});

export default router;
