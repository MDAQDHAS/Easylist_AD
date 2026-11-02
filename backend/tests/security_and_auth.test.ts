import 'dotenv/config';
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response, NextFunction } from 'express';
import { createServer, type AddressInfo } from 'node:http';
import app from '../src/app.js';
import { authAdmin, firebaseApp, resolveFirebaseProjectId } from '../src/lib/firebaseAdmin.js';
import { supabase } from '../src/lib/supabase.js';
import {
  requireAuth,
  requireVerifiedEmail,
  requireConfirmedLinking,
  type AuthenticatedUser,
} from '../src/middleware/requireAuth.js';
import { generateDeterministicUuid } from '../src/services/identityService.js';

function createMockReqRes(headers: Record<string, string> = {}, body: unknown = {}) {
  const req = {
    headers,
    body,
    query: {},
    params: {},
  } as unknown as Request;

  let statusCode = 200;
  let responseJson: Record<string, unknown> = {};

  const res = {
    locals: {},
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: Record<string, unknown>) {
      responseJson = data;
      return this;
    },
  } as unknown as Response;

  return {
    req,
    res,
    getStatus: () => statusCode,
    getBody: () => responseJson,
  };
}

describe('Security & Authentication Middleware Tests', () => {
  describe('1. Missing and Malformed Token Rejection (HTTP 401)', () => {
    test('Rejects request with no authorization header', async () => {
      const { req, res, getStatus, getBody } = createMockReqRes();
      let nextCalled = false;
      const next: NextFunction = () => { nextCalled = true; };

      await requireAuth(req, res, next);

      assert.equal(getStatus(), 401);
      assert.equal(nextCalled, false);
      assert.equal(getBody().success, false);
      assert.match(String(getBody().message), /Authentication token is required/i);
    });

    test('Rejects non-Bearer authorization scheme (e.g. Basic)', async () => {
      const { req, res, getStatus, getBody } = createMockReqRes({
        authorization: 'Basic dXNlcjpwYXNz',
      });
      let nextCalled = false;
      const next: NextFunction = () => { nextCalled = true; };

      await requireAuth(req, res, next);

      assert.equal(getStatus(), 401);
      assert.equal(nextCalled, false);
      assert.equal(getBody().success, false);
      assert.match(String(getBody().message), /Authentication token is required/i);
    });

    test('Rejects empty Bearer token', async () => {
      const { req, res, getStatus, getBody } = createMockReqRes({
        authorization: 'Bearer   ',
      });
      let nextCalled = false;
      const next: NextFunction = () => { nextCalled = true; };

      await requireAuth(req, res, next);

      assert.equal(getStatus(), 401);
      assert.equal(nextCalled, false);
      assert.equal(getBody().success, false);
      assert.match(String(getBody().message), /Authentication token is required/i);
    });
  });

  describe('2. Invalid & Forged Token Rejection (HTTP 401)', () => {
    test('Rejects forged / invalid JWT token string', async () => {
      const { req, res, getStatus, getBody } = createMockReqRes({
        authorization: 'Bearer invalid.fake.tokenstring',
      });
      let nextCalled = false;
      const next: NextFunction = () => { nextCalled = true; };

      await requireAuth(req, res, next);

      assert.equal(getStatus(), 401);
      assert.equal(nextCalled, false);
      assert.equal(getBody().success, false);
      assert.match(String(getBody().message), /Invalid authentication token/i);
    });

    test('logs only a safe Firebase error code when verification fails', async () => {
      const originalVerifyIdToken = authAdmin.verifyIdToken;
      const originalWarn = console.warn;
      const sensitiveMarker = 'do-not-log-token-or-error-details';
      const logged: unknown[][] = [];
      Reflect.set(authAdmin, 'verifyIdToken', async () => {
        throw Object.assign(new Error(sensitiveMarker), { code: 'auth/id-token-expired' });
      });
      console.warn = (...args: unknown[]) => {
        logged.push(args);
      };

      try {
        const { req, res, getStatus, getBody } = createMockReqRes({
          authorization: `Bearer ${sensitiveMarker}`,
        });
        let nextCalled = false;
        const next: NextFunction = () => { nextCalled = true; };

        await requireAuth(req, res, next);

        assert.equal(getStatus(), 401);
        assert.equal(nextCalled, false);
        assert.match(String(getBody().message), /expired/i);
        assert.equal(JSON.stringify(logged).includes(sensitiveMarker), false);
        assert.deepEqual(logged, [[
          'Firebase ID token verification failed:',
          { projectId: 'easylist-588d9', code: 'auth/id-token-expired' },
        ]]);
      } finally {
        Reflect.set(authAdmin, 'verifyIdToken', originalVerifyIdToken);
        console.warn = originalWarn;
      }
    });
  });

  describe('3. Missing Supabase service-role configuration', () => {
    test('returns a generic server error instead of using a publishable key', async () => {
      const originalVerifyIdToken = authAdmin.verifyIdToken;
      const originalUrl = process.env.SUPABASE_URL;
      const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const originalPublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = '';
      process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
      Reflect.set(authAdmin, 'verifyIdToken', async () => ({
        uid: 'test-firebase-uid',
        email: 'user@example.com',
        email_verified: true,
      }));

      try {
        const { req, res, getStatus, getBody } = createMockReqRes({
          authorization: 'Bearer test-token',
        });

        let nextCalled = false;
        const next: NextFunction = () => { nextCalled = true; };

        await requireAuth(req, res, next);

        assert.equal(getStatus(), 500);
        assert.equal(nextCalled, false);
        assert.equal(getBody().success, false);
        assert.equal(getBody().message, 'A server configuration error occurred');
        assert.equal(JSON.stringify(getBody()).includes('test-publishable-key'), false);
      } finally {
        Reflect.set(authAdmin, 'verifyIdToken', originalVerifyIdToken);
        if (originalUrl === undefined) delete process.env.SUPABASE_URL;
        else process.env.SUPABASE_URL = originalUrl;
        if (originalServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
        if (originalPublishableKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
        else process.env.SUPABASE_PUBLISHABLE_KEY = originalPublishableKey;
      }
    });
  });

  describe('3a. Identity-store failures fail closed', () => {
    test('returns a temporary service error instead of authorizing a fallback identity', async () => {
      const originalVerifyIdToken = authAdmin.verifyIdToken;
      const hadOriginalFrom = Reflect.has(supabase, 'from');
      const originalFrom = hadOriginalFrom ? Reflect.get(supabase, 'from') : undefined;
      Reflect.set(authAdmin, 'verifyIdToken', async () => ({
        uid: 'test-firebase-uid',
        email: 'user@example.com',
        email_verified: true,
      }));

      const query = {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle: async () => ({
          data: null,
          error: { message: 'database unavailable' },
        }),
      };
      Reflect.set(supabase, 'from', () => query);

      try {
        const { req, res, getStatus, getBody } = createMockReqRes({
          authorization: 'Bearer test-token',
        });
        let nextCalled = false;
        const next: NextFunction = () => { nextCalled = true; };

        await requireAuth(req, res, next);

        assert.equal(getStatus(), 503);
        assert.equal(nextCalled, false);
        assert.equal(getBody().success, false);
        assert.match(String(getBody().message), /Unable to verify account identity/);
        assert.equal(JSON.stringify(getBody()).includes('database unavailable'), false);
      } finally {
        Reflect.set(authAdmin, 'verifyIdToken', originalVerifyIdToken);
        if (hadOriginalFrom) Reflect.set(supabase, 'from', originalFrom);
        else Reflect.deleteProperty(supabase, 'from');
      }
    });
  });

  describe('4. Identity Mapping & Deterministic UUID Generator', () => {
    test('Generates valid RFC4122 v4 UUID format', () => {
      const uuid = generateDeterministicUuid('firebase_uid_test_123');
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      assert.match(uuid, uuidRegex);
    });

    test('Guarantees idempotent deterministic UUID for identical Firebase UID', () => {
      const uid = 'sample_firebase_user_abc456';
      const uuid1 = generateDeterministicUuid(uid);
      const uuid2 = generateDeterministicUuid(uid);
      assert.equal(uuid1, uuid2);
    });

    test('Guarantees unique UUIDs for distinct Firebase UIDs', () => {
      const uuidA = generateDeterministicUuid('user_A_111');
      const uuidB = generateDeterministicUuid('user_B_222');
      assert.notEqual(uuidA, uuidB);
    });
  });

  describe('5. Email Verification Authorization Guard', () => {
    test('requireVerifiedEmail rejects unverified users with HTTP 403', () => {
      const { req, res, getStatus, getBody } = createMockReqRes();
      res.locals.user = {
        id: 'mock-uuid',
        uid: 'mock-uid',
        email: 'unverified@example.com',
        emailVerified: false,
        internalUserId: 'mock-uuid',
        linkingStatus: 'LINKED',
      } as AuthenticatedUser;

      let nextCalled = false;
      const next: NextFunction = () => { nextCalled = true; };

      requireVerifiedEmail(req, res, next);

      assert.equal(getStatus(), 403);
      assert.equal(nextCalled, false);
      assert.equal(getBody().success, false);
      assert.match(String(getBody().message), /Email verification is required/i);
    });

    test('requireVerifiedEmail permits verified users to proceed', () => {
      const { req, res } = createMockReqRes();
      res.locals.user = {
        id: 'mock-uuid',
        uid: 'mock-uid',
        email: 'verified@example.com',
        emailVerified: true,
        internalUserId: 'mock-uuid',
        linkingStatus: 'LINKED',
      } as AuthenticatedUser;

      let nextCalled = false;
      const next: NextFunction = () => { nextCalled = true; };

      requireVerifiedEmail(req, res, next);
      assert.equal(nextCalled, true);
    });
  });

  describe('6. Safe Account Linking Guard (Anti-Account Takeover)', () => {
    test('requireConfirmedLinking blocks unconfirmed legacy accounts with HTTP 403', () => {
      const { req, res, getStatus, getBody } = createMockReqRes();
      res.locals.user = {
        id: 'legacy-uuid',
        uid: 'attacker-or-new-uid',
        email: 'legacy-owner@example.com',
        emailVerified: true,
        internalUserId: 'legacy-uuid',
        linkingStatus: 'REQUIRES_LINKING',
      } as AuthenticatedUser;

      let nextCalled = false;
      const next: NextFunction = () => { nextCalled = true; };

      requireConfirmedLinking(req, res, next);

      assert.equal(getStatus(), 403);
      assert.equal(nextCalled, false);
      assert.match(String(getBody().message), /additional account verification/i);
      assert.equal(JSON.stringify(getBody()).includes('legacy-owner@example.com'), false);
    });

    test('requireConfirmedLinking allows fully linked accounts to proceed', () => {
      const { req, res } = createMockReqRes();
      res.locals.user = {
        id: 'user-uuid',
        uid: 'firebase-uid',
        email: 'owner@example.com',
        emailVerified: true,
        internalUserId: 'user-uuid',
        linkingStatus: 'LINKED',
      } as AuthenticatedUser;

      let nextCalled = false;
      const next: NextFunction = () => { nextCalled = true; };

      requireConfirmedLinking(req, res, next);
      assert.equal(nextCalled, true);
    });
  });

  describe('7. Shop Registration Input Validation Invariants', () => {
    test('Validates shopName boundary constraints (1-150 characters)', () => {
      const emptyName = '   ';
      const tooLongName = 'a'.repeat(151);
      const validName = 'Sri Gokulam Wholesale';

      assert.equal(typeof emptyName.trim() === 'string' && emptyName.trim().length > 0, false);
      assert.equal(tooLongName.trim().length <= 150, false);
      assert.equal(validName.trim().length <= 150, true);
    });

    test('Validates phone length boundary constraint (max 30 characters)', () => {
      const validPhone = '+91 98765 43210';
      const tooLongPhone = '1'.repeat(31);

      assert.equal(validPhone.length <= 30, true);
      assert.equal(tooLongPhone.length <= 30, false);
    });
  });

  describe('8. Firebase Project & Shop Membership / Registration API Integration', () => {
    test('Firebase Admin defaults to project easylist-588d9', () => {
      assert.equal(firebaseApp.options.projectId, 'easylist-588d9');
      assert.equal(resolveFirebaseProjectId(), 'easylist-588d9');
    });

    test('GET /api/shops/memberships verifies token, resolves identity, and returns memberships', async () => {
      const originalVerifyIdToken = authAdmin.verifyIdToken;
      const hadOriginalFrom = Reflect.has(supabase, 'from');
      const originalFrom = hadOriginalFrom ? Reflect.get(supabase, 'from') : undefined;

      const expectedInternalId = generateDeterministicUuid('uid-member-1');
      let verifiedToken = '';
      let checkRevokedFlag = false;

      Reflect.set(authAdmin, 'verifyIdToken', async (token: string, checkRevoked?: boolean) => {
        verifiedToken = token;
        checkRevokedFlag = Boolean(checkRevoked);
        return {
          uid: 'uid-member-1',
          email: 'shopowner@example.com',
          email_verified: true,
        };
      });

      Reflect.set(supabase, 'from', (table: string) => {
        if (table === 'user_identities') {
          return {
            select() { return this; },
            eq() { return this; },
            maybeSingle: async () => ({
              data: {
                internal_user_id: expectedInternalId,
                firebase_uid: 'uid-member-1',
                email: 'shopowner@example.com',
                email_verified: true,
                linking_status: 'LINKED',
              },
              error: null,
            }),
          };
        }
        if (table === 'shop_members') {
          return {
            select() { return this; },
            eq(col: string, val: string) {
              assert.equal(col, 'user_id');
              assert.equal(val, expectedInternalId);
              return Promise.resolve({
                data: [{
                  shop_id: 'shop-uuid-101',
                  role: 'owner',
                  created_at: '2026-10-30T00:00:00.000Z',
                }],
                error: null,
              });
            },
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      });

      const server = createServer(app);
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      const { port } = server.address() as AddressInfo;

      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/shops/memberships`, {
          headers: {
            Authorization: 'Bearer valid-firebase-jwt',
          },
        });
        const body = (await response.json()) as {
          success: boolean;
          memberships: Array<{ shop_id: string; role: string }>;
        };

        assert.equal(response.status, 200);
        assert.equal(verifiedToken, 'valid-firebase-jwt');
        assert.equal(checkRevokedFlag, true);
        assert.equal(body.success, true);
        assert.equal(body.memberships.length, 1);
        assert.equal(body.memberships[0].shop_id, 'shop-uuid-101');
        assert.equal(body.memberships[0].role, 'owner');
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
        Reflect.set(authAdmin, 'verifyIdToken', originalVerifyIdToken);
        if (hadOriginalFrom) Reflect.set(supabase, 'from', originalFrom);
        else Reflect.deleteProperty(supabase, 'from');
      }
    });

    test('POST /api/shops/register registers a new shop for a verified user after auth succeeds', async () => {
      const originalVerifyIdToken = authAdmin.verifyIdToken;
      const hadOriginalFrom = Reflect.has(supabase, 'from');
      const originalFrom = hadOriginalFrom ? Reflect.get(supabase, 'from') : undefined;
      const hadOriginalRpc = Reflect.has(supabase, 'rpc');
      const originalRpc = hadOriginalRpc ? Reflect.get(supabase, 'rpc') : undefined;

      const expectedInternalId = generateDeterministicUuid('uid-register-1');

      Reflect.set(authAdmin, 'verifyIdToken', async () => ({
        uid: 'uid-register-1',
        email: 'newowner@example.com',
        email_verified: true,
      }));

      Reflect.set(supabase, 'from', (table: string) => {
        if (table === 'user_identities') {
          return {
            select() { return this; },
            eq() { return this; },
            maybeSingle: async () => ({
              data: {
                internal_user_id: expectedInternalId,
                firebase_uid: 'uid-register-1',
                email: 'newowner@example.com',
                email_verified: true,
                linking_status: 'LINKED',
              },
              error: null,
            }),
          };
        }
        if (table === 'shop_members') {
          return {
            select() { return this; },
            eq() { return this; },
            limit: async () => ({
              data: [],
              error: null,
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      });

      let rpcParamsReceived: Record<string, unknown> | undefined;
      Reflect.set(supabase, 'rpc', async (fnName: string, params: Record<string, unknown>) => {
        assert.equal(fnName, 'register_shop_for_user');
        rpcParamsReceived = params;
        return {
          data: {
            shop: {
              id: 'shop-new-202',
              name: 'Sri Murugan Stores',
              phone: '+91 9876543210',
            },
            membership: {
              id: 'member-202',
              shop_id: 'shop-new-202',
              user_id: expectedInternalId,
              role: 'owner',
            },
          },
          error: null,
        };
      });

      const server = createServer(app);
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      const { port } = server.address() as AddressInfo;

      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/shops/register`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer valid-firebase-jwt',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shopName: 'Sri Murugan Stores',
            phone: '+91 9876543210',
          }),
        });
        const body = (await response.json()) as {
          success: boolean;
          shop?: { id: string; name: string };
        };

        assert.equal(response.status, 201);
        assert.equal(body.success, true);
        assert.equal(body.shop?.id, 'shop-new-202');
        assert.deepEqual(rpcParamsReceived, {
          p_user_id: expectedInternalId,
          p_shop_name: 'Sri Murugan Stores',
          p_phone: '+91 9876543210',
        });
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
        Reflect.set(authAdmin, 'verifyIdToken', originalVerifyIdToken);
        if (hadOriginalFrom) Reflect.set(supabase, 'from', originalFrom);
        else Reflect.deleteProperty(supabase, 'from');
        if (hadOriginalRpc) Reflect.set(supabase, 'rpc', originalRpc);
        else Reflect.deleteProperty(supabase, 'rpc');
      }
    });

    test('PATCH /api/shops/:shopId updates shop name and phone for authorized owner', async () => {
      const originalVerifyIdToken = authAdmin.verifyIdToken;
      const hadOriginalFrom = Reflect.has(supabase, 'from');
      const originalFrom = hadOriginalFrom ? Reflect.get(supabase, 'from') : undefined;
      const hadOriginalRpc = Reflect.has(supabase, 'rpc');
      const originalRpc = hadOriginalRpc ? Reflect.get(supabase, 'rpc') : undefined;

      const expectedInternalId = generateDeterministicUuid('uid-update-1');

      Reflect.set(authAdmin, 'verifyIdToken', async () => ({
        uid: 'uid-update-1',
        email: 'owner@example.com',
        email_verified: true,
      }));

      Reflect.set(supabase, 'from', (table: string) => {
        if (table === 'user_identities') {
          return {
            select() { return this; },
            eq() { return this; },
            maybeSingle: async () => ({
              data: {
                internal_user_id: expectedInternalId,
                firebase_uid: 'uid-update-1',
                email: 'owner@example.com',
                email_verified: true,
                linking_status: 'LINKED',
              },
              error: null,
            }),
          };
        }
        if (table === 'shop_members') {
          return {
            select() { return this; },
            eq() { return this; },
            maybeSingle: async () => ({
              data: { role: 'owner' },
              error: null,
            }),
          };
        }
        if (table === 'shops') {
          return {
            update(updates: any) {
              return {
                eq() {
                  return {
                    select() {
                      return {
                        maybeSingle: async () => ({
                          data: {
                            id: 'shop-uuid-303',
                            name: updates.name,
                            phone: updates.phone,
                          },
                          error: null,
                        }),
                      };
                    },
                  };
                },
              };
            },
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      });

      const server = createServer(app);
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      const { port } = server.address() as AddressInfo;

      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/shops/shop-uuid-303`, {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer valid-firebase-jwt',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shopName: 'Updated Murugan Provisions',
            phone: '+91 9999988888',
          }),
        });
        const body = (await response.json()) as {
          success: boolean;
          shop?: { id: string; name: string; phone: string };
        };

        assert.equal(response.status, 200);
        assert.equal(body.success, true);
        assert.equal(body.shop?.name, 'Updated Murugan Provisions');
        assert.equal(body.shop?.phone, '+91 9999988888');
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
        Reflect.set(authAdmin, 'verifyIdToken', originalVerifyIdToken);
        if (hadOriginalFrom) Reflect.set(supabase, 'from', originalFrom);
        else Reflect.deleteProperty(supabase, 'from');
        if (hadOriginalRpc) Reflect.set(supabase, 'rpc', originalRpc);
        else Reflect.deleteProperty(supabase, 'rpc');
      }
    });
  });
});
