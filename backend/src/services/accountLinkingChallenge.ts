import crypto from 'node:crypto';

const CHALLENGE_LIFETIME_MS = 15 * 60 * 1000;

export interface AccountLinkingChallenge {
  token: string;
  tokenHash: string;
  expiresAt: string;
}

export function createAccountLinkingChallenge(
  now = new Date()
): AccountLinkingChallenge {
  const token = crypto.randomBytes(32).toString('base64url');

  return {
    token,
    tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(now.getTime() + CHALLENGE_LIFETIME_MS).toISOString(),
  };
}
