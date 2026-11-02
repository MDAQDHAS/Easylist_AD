import test from 'node:test';
import assert from 'node:assert/strict';
import { supabase } from '../src/lib/supabase.js';
import {
  AccountLinkingRateLimitError,
  consumeAccountLinkingRateLimit,
} from '../src/services/accountLinkingRateLimit.js';

const internalUserId = 'c2d35e38-023d-4c7a-a87f-52a56ca6349c';
const ipAddress = '192.0.2.15';

function withRateLimitSecret<T>(run: () => Promise<T>): Promise<T> {
  const previous = process.env.ACCOUNT_LINKING_RATE_LIMIT_HMAC_KEY;
  process.env.ACCOUNT_LINKING_RATE_LIMIT_HMAC_KEY = 'test-secret-value-that-is-at-least-32-bytes';

  return run().finally(() => {
    if (previous === undefined) delete process.env.ACCOUNT_LINKING_RATE_LIMIT_HMAC_KEY;
    else process.env.ACCOUNT_LINKING_RATE_LIMIT_HMAC_KEY = previous;
  });
}

test('fails closed when the HMAC secret is missing or too short', async () => {
  const previous = process.env.ACCOUNT_LINKING_RATE_LIMIT_HMAC_KEY;
  delete process.env.ACCOUNT_LINKING_RATE_LIMIT_HMAC_KEY;

  try {
    await assert.rejects(
      consumeAccountLinkingRateLimit(internalUserId, ipAddress),
      AccountLinkingRateLimitError
    );
    process.env.ACCOUNT_LINKING_RATE_LIMIT_HMAC_KEY = 'too-short';
    await assert.rejects(
      consumeAccountLinkingRateLimit(internalUserId, ipAddress),
      AccountLinkingRateLimitError
    );
  } finally {
    if (previous === undefined) delete process.env.ACCOUNT_LINKING_RATE_LIMIT_HMAC_KEY;
    else process.env.ACCOUNT_LINKING_RATE_LIMIT_HMAC_KEY = previous;
  }
});

test('sends only HMAC-derived subject keys to the privileged rate-limit RPC', async () => {
  const hadPreviousRpc = Reflect.has(supabase, 'rpc');
  const previousRpc = hadPreviousRpc ? Reflect.get(supabase, 'rpc') : undefined;
  let functionName = '';
  let receivedParams: Record<string, unknown> | undefined;
  Reflect.set(supabase, 'rpc', async (name: string, params: Record<string, unknown>) => {
    functionName = name;
    receivedParams = params;
    return { data: { status: 'allowed' }, error: null };
  });

  try {
    const allowed = await withRateLimitSecret(() =>
      consumeAccountLinkingRateLimit(internalUserId, ipAddress)
    );

    assert.equal(allowed, true);
    assert.equal(functionName, 'consume_account_linking_rate_limit');
    assert.match(String(receivedParams?.p_account_hash), /^[a-f0-9]{64}$/);
    assert.match(String(receivedParams?.p_ip_hash), /^[a-f0-9]{64}$/);
    assert.notEqual(receivedParams?.p_account_hash, internalUserId);
    assert.notEqual(receivedParams?.p_ip_hash, ipAddress);
  } finally {
    if (hadPreviousRpc) Reflect.set(supabase, 'rpc', previousRpc);
    else Reflect.deleteProperty(supabase, 'rpc');
  }
});

test('returns a denied result when the database enforces a rate limit', async () => {
  const hadPreviousRpc = Reflect.has(supabase, 'rpc');
  const previousRpc = hadPreviousRpc ? Reflect.get(supabase, 'rpc') : undefined;
  Reflect.set(supabase, 'rpc', async () => ({
    data: { status: 'rate_limited' },
    error: null,
  }));

  try {
    const allowed = await withRateLimitSecret(() =>
      consumeAccountLinkingRateLimit(internalUserId, ipAddress)
    );
    assert.equal(allowed, false);
  } finally {
    if (hadPreviousRpc) Reflect.set(supabase, 'rpc', previousRpc);
    else Reflect.deleteProperty(supabase, 'rpc');
  }
});

test('fails closed when the database rate-limit RPC fails', async () => {
  const hadPreviousRpc = Reflect.has(supabase, 'rpc');
  const previousRpc = hadPreviousRpc ? Reflect.get(supabase, 'rpc') : undefined;
  Reflect.set(supabase, 'rpc', async () => ({
    data: null,
    error: { message: 'database unavailable' },
  }));

  try {
    await withRateLimitSecret(() =>
      assert.rejects(
        consumeAccountLinkingRateLimit(internalUserId, ipAddress),
        AccountLinkingRateLimitError
      )
    );
  } finally {
    if (hadPreviousRpc) Reflect.set(supabase, 'rpc', previousRpc);
    else Reflect.deleteProperty(supabase, 'rpc');
  }
});
