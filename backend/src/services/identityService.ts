import crypto from 'node:crypto';
import { SupabaseConfigurationError, supabase } from '../lib/supabase.js';

export function generateDeterministicUuid(seed: string): string {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.substring(18, 20),
    hash.substring(20, 32),
  ].join('-');
}

export interface UserIdentityRecord {
  id: string;
  internal_user_id: string;
  firebase_uid: string | null;
  email: string;
  email_verified: boolean;
  linking_status: 'UNLINKED' | 'PENDING' | 'LINKED';
  linking_token_hash: string | null;
  linking_token_expires_at: string | null;
  linking_attempts: number;
}

export interface ResolveIdentityResult {
  internalUserId: string;
  status: 'LINKED' | 'REQUIRES_LINKING';
}

export class IdentityResolutionError extends Error {
  constructor() {
    super('Unable to resolve account identity.');
    this.name = 'IdentityResolutionError';
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

/**
 * Resolves the internal UUID for an authenticated Firebase user.
 * Prevents automatic account takeover by detecting unlinked legacy accounts
 * and flagging them with REQUIRES_LINKING instead of silently upgrading them.
 */
export async function resolveUserIdentity(
  firebaseUid: string,
  email?: string,
  emailVerified = false
): Promise<ResolveIdentityResult> {
  const cleanEmail = email ? normalizeEmail(email) : null;
  const deterministicFallback = generateDeterministicUuid(firebaseUid);

  try {
    const { data: existingByUid, error: uidErr } = await supabase
      .from('user_identities')
      .select('*')
      .eq('firebase_uid', firebaseUid)
      .maybeSingle();

    if (uidErr) {
      throw new IdentityResolutionError();
    }

    if (existingByUid) {
      return {
        internalUserId: (existingByUid as UserIdentityRecord).internal_user_id,
        status: 'LINKED',
      };
    }

    if (cleanEmail) {
      const { data: unlinkedLegacy, error: legacyErr } = await supabase
        .from('user_identities')
        .select('*')
        .ilike('email', escapeIlikePattern(cleanEmail))
        .is('firebase_uid', null)
        .maybeSingle();

      if (legacyErr) {
        throw new IdentityResolutionError();
      }

      if (unlinkedLegacy) {
        return {
          internalUserId: (unlinkedLegacy as UserIdentityRecord).internal_user_id,
          status: 'REQUIRES_LINKING',
        };
      }
    }

    const internalUserId = deterministicFallback;
    const { error: insertErr } = await supabase.from('user_identities').insert({
      internal_user_id: internalUserId,
      firebase_uid: firebaseUid,
      email: cleanEmail || `${firebaseUid}@firebase.local`,
      email_verified: emailVerified,
      linking_status: 'LINKED',
      linked_at: new Date().toISOString(),
    });

    if (insertErr) {
      throw new IdentityResolutionError();
    }

    return { internalUserId, status: 'LINKED' };
  } catch (err) {
    if (err instanceof SupabaseConfigurationError || err instanceof IdentityResolutionError) {
      throw err;
    }

    throw new IdentityResolutionError();
  }
}

/**
 * Opts out of linking a legacy shop.
 * Creates an independent identity so the new user can register their own fresh shop
 * without affecting or accessing the legacy account.
 */
export async function optOutAccountLinking(
  firebaseUid: string,
  email: string
): Promise<{ success: boolean; internalUserId: string }> {
  const cleanEmail = normalizeEmail(email);
  const independentUserId = generateDeterministicUuid(`${firebaseUid}:independent`);

  const { error: insertErr } = await supabase.from('user_identities').insert({
    internal_user_id: independentUserId,
    firebase_uid: firebaseUid,
    email: cleanEmail,
    email_verified: true,
    linking_status: 'LINKED',
    linked_at: new Date().toISOString(),
  });

  if (insertErr) {
    throw new Error('Unable to create independent account.');
  }

  return {
    success: true,
    internalUserId: independentUserId,
  };
}
