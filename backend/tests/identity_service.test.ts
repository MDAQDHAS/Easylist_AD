import test from 'node:test';
import assert from 'node:assert/strict';
import { supabase } from '../src/lib/supabase.js';
import {
  generateDeterministicUuid,
  IdentityResolutionError,
  resolveUserIdentity,
} from '../src/services/identityService.js';

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function installFromMock(results: QueryResult[], onInsert?: () => void): () => void {
  Reflect.set(supabase, 'from', () => {
    const result = results.shift() ?? { data: null, error: null };
    const query: any = {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      ilike() {
        return this;
      },
      is() {
        return this;
      },
      insert() {
        onInsert?.();
        return this;
      },
      maybeSingle: async () => result,
      then(resolve: (value: QueryResult) => unknown) {
        return Promise.resolve(result).then(resolve);
      },
    };
    return query;
  });

  return () => {
    Reflect.deleteProperty(supabase, 'from');
  };
}

test('resolves an identity already bound to the verified Firebase UID', async () => {
  const restoreFrom = installFromMock([
    {
      data: {
        internal_user_id: 'internal-user-id',
        firebase_uid: 'firebase-uid',
      },
      error: null,
    },
  ]);

  try {
    const result = await resolveUserIdentity('firebase-uid', 'user@example.com', true);
    assert.deepEqual(result, {
      internalUserId: 'internal-user-id',
      status: 'LINKED',
    });
  } finally {
    restoreFrom();
  }
});

test('requires recovery rather than linking a legacy identity by email', async () => {
  let inserted = false;
  const restoreFrom = installFromMock([
    { data: null, error: null },
    {
      data: {
        internal_user_id: 'legacy-user-id',
        email: 'user@example.com',
        firebase_uid: null,
      },
      error: null,
    },
  ], () => {
    inserted = true;
  });

  try {
    const result = await resolveUserIdentity('new-firebase-uid', 'User@Example.com', true);
    assert.equal(result.internalUserId, 'legacy-user-id');
    assert.equal(result.status, 'REQUIRES_LINKING');
    assert.equal(inserted, false);
  } finally {
    restoreFrom();
  }
});

test('fails closed when the Firebase UID lookup fails', async () => {
  const restoreFrom = installFromMock([
    { data: null, error: { message: 'database unavailable' } },
  ]);

  try {
    await assert.rejects(
      resolveUserIdentity('firebase-uid', 'user@example.com', true),
      IdentityResolutionError
    );
  } finally {
    restoreFrom();
  }
});

test('fails closed when the legacy email lookup fails', async () => {
  const restoreFrom = installFromMock([
    { data: null, error: null },
    { data: null, error: { message: 'database unavailable' } },
  ]);

  try {
    await assert.rejects(
      resolveUserIdentity('firebase-uid', 'user@example.com', true),
      IdentityResolutionError
    );
  } finally {
    restoreFrom();
  }
});

test('fails closed when identity creation fails', async () => {
  const restoreFrom = installFromMock([
    { data: null, error: null },
    { data: null, error: null },
    { data: null, error: { message: 'database unavailable' } },
  ]);

  try {
    await assert.rejects(
      resolveUserIdentity('firebase-uid', 'user@example.com', true),
      IdentityResolutionError
    );
  } finally {
    restoreFrom();
  }
});

test('creates a new identity using the deterministic internal UUID', async () => {
  const restoreFrom = installFromMock([
    { data: null, error: null },
    { data: null, error: null },
    { data: null, error: null },
  ]);

  try {
    const result = await resolveUserIdentity('firebase-uid', 'user@example.com', true);
    assert.equal(result.internalUserId, generateDeterministicUuid('firebase-uid'));
    assert.equal(result.status, 'LINKED');
  } finally {
    restoreFrom();
  }
});
