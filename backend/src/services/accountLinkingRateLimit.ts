import crypto from 'node:crypto';
import { SupabaseConfigurationError, supabase } from '../lib/supabase.js';

export class AccountLinkingRateLimitError extends Error {
  constructor() {
    super('Account verification is temporarily unavailable.');
    this.name = 'AccountLinkingRateLimitError';
  }
}

function createSubjectHash(secret: string, scope: 'account' | 'ip', subject: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${scope}:${subject}`)
    .digest('hex');
}

export async function consumeAccountLinkingRateLimit(
  internalUserId: string,
  ipAddress: string
): Promise<boolean> {
  const secret = process.env.ACCOUNT_LINKING_RATE_LIMIT_HMAC_KEY?.trim();
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new AccountLinkingRateLimitError();
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(internalUserId)) {
    throw new AccountLinkingRateLimitError();
  }

  const normalizedIp = ipAddress.trim();
  if (!normalizedIp || normalizedIp.length > 128) {
    throw new AccountLinkingRateLimitError();
  }

  let result;
  try {
    result = await supabase.rpc('consume_account_linking_rate_limit', {
      p_account_hash: createSubjectHash(secret, 'account', internalUserId),
      p_ip_hash: createSubjectHash(secret, 'ip', normalizedIp),
    });
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      throw error;
    }
    throw new AccountLinkingRateLimitError();
  }

  if (result.error) {
    throw new AccountLinkingRateLimitError();
  }

  if (
    typeof result.data !== 'object' ||
    result.data === null ||
    Array.isArray(result.data) ||
    !('status' in result.data)
  ) {
    throw new AccountLinkingRateLimitError();
  }

  const status = (result.data as { status?: unknown }).status;
  if (status === 'allowed') {
    return true;
  }
  if (status === 'rate_limited') {
    return false;
  }
  throw new AccountLinkingRateLimitError();
}
