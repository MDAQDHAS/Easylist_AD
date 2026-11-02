import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSupabaseAdminClient,
  getSupabaseAdminClient,
  SupabaseConfigurationError,
} from '../src/lib/supabase.js';

test('admin client requires a service-role key and never accepts a publishable-key fallback', () => {
  assert.throws(
    () => createSupabaseAdminClient({
      url: 'https://example.supabase.co',
      serviceRoleKey: undefined,
    }),
    (error: unknown) => {
      assert.ok(error instanceof SupabaseConfigurationError);
      assert.equal(error.message, 'Supabase service configuration is unavailable.');
      return true;
    }
  );
});

test('admin client remains unavailable when only a publishable key is configured', () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalPublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = '';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';

  try {
    assert.throws(
      () => getSupabaseAdminClient(),
      (error: unknown) => {
        assert.ok(error instanceof SupabaseConfigurationError);
        assert.equal(error.message, 'Supabase service configuration is unavailable.');
        assert.equal(error.message.includes('test-publishable-key'), false);
        return true;
      }
    );
  } finally {
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
    if (originalPublishableKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = originalPublishableKey;
  }
});

test('admin client rejects a publishable or anon key passed as SUPABASE_SERVICE_ROLE_KEY', () => {
  assert.throws(
    () => createSupabaseAdminClient({
      url: 'https://example.supabase.co',
      serviceRoleKey: 'sb_publishable_fake_key_value',
    }),
    SupabaseConfigurationError
  );

  const anonPayload = Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url');
  const anonJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${anonPayload}.signature`;
  assert.throws(
    () => createSupabaseAdminClient({
      url: 'https://example.supabase.co',
      serviceRoleKey: anonJwt,
    }),
    SupabaseConfigurationError
  );
});
