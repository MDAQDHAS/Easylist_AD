import test from 'node:test';
import assert from 'node:assert/strict';
import { loadShopDetails, loadShopMemberships, registerShop, updateShopDetails } from './shopMembershipService';

const membership = {
  shop_id: 'shop-1',
  role: 'owner',
  created_at: '2026-01-01T00:00:00.000Z',
};

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const defaultOptions = {
  getIdToken: async (forceRefresh: boolean) => {
    assert.equal(forceRefresh, true);
    return 'test-token';
  },
  apiBaseUrl: 'http://localhost:8000/api/',
};

test('returns confirmed shop memberships', async () => {
  const memberships = await loadShopMemberships({
    ...defaultOptions,
    fetcher: async (input, init) => {
      assert.equal(input, 'http://localhost:8000/api/shops/memberships');
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-token');
      return response(200, { success: true, memberships: [membership] });
    },
  });

  assert.deepEqual(memberships, [membership]);
});

test('returns an empty list only for a successful empty membership response', async () => {
  const memberships = await loadShopMemberships({
    ...defaultOptions,
    fetcher: async () => response(200, { success: true, memberships: [] }),
  });

  assert.deepEqual(memberships, []);
});

test('rejects membership API failures rather than treating them as empty', async () => {
  await assert.rejects(
    loadShopMemberships({
      ...defaultOptions,
      fetcher: async () => response(401, { success: false }),
    }),
    /membership request failed/i
  );
});

test('times out a stalled membership request', async () => {
  await assert.rejects(
    loadShopMemberships({
      ...defaultOptions,
      timeoutMs: 10,
      fetcher: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    }),
    /timed out/i
  );
});

test('returns shop details for an authorized member', async () => {
  const shop = {
    id: 'shop-1',
    name: 'Sri Gokulam Wholesale',
    phone: '+91 98765 43210',
    created_at: '2026-01-01T00:00:00.000Z',
    callerRole: 'owner',
  };

  const result = await loadShopDetails({
    shopId: 'shop-1',
    getIdToken: async () => 'test-token',
    apiBaseUrl: 'http://localhost:8000/api/',
    fetcher: async (input, init) => {
      assert.equal(input, 'http://localhost:8000/api/shops/shop-1');
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-token');
      return response(200, { success: true, shop });
    },
  });

  assert.deepEqual(result, shop);
});

test('registerShop: registers shop via POST /api/shops/register', async () => {
  const newShop = {
    id: 'shop-registered-1',
    name: 'Balaji Provisions',
    phone: '+91 91234 56789',
    created_at: '2026-01-01T00:00:00.000Z',
  };
  const newMembership = {
    shop_id: 'shop-registered-1',
    role: 'owner',
    created_at: '2026-01-01T00:00:00.000Z',
  };

  let payloadSent: any;
  const result = await registerShop({
    shopName: 'Balaji Provisions',
    phone: '+91 91234 56789',
    getIdToken: async () => 'test-token',
    apiBaseUrl: 'http://localhost:8000/api/',
    fetcher: async (input, init) => {
      assert.equal(input, 'http://localhost:8000/api/shops/register');
      assert.equal(init?.method, 'POST');
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-token');
      payloadSent = JSON.parse(init?.body as string);
      return response(201, { success: true, shop: newShop, membership: newMembership });
    },
  });

  assert.deepEqual(result.shop, newShop);
  assert.deepEqual(payloadSent, {
    shopName: 'Balaji Provisions',
    phone: '+91 91234 56789',
  });
});

test('updateShopDetails: updates shop via PATCH /api/shops/:shopId', async () => {
  const updatedShop = {
    id: 'shop-1',
    name: 'Balaji Super Bazaar',
    phone: '+91 99999 00000',
    created_at: '2026-01-01T00:00:00.000Z',
  };

  let payloadSent: any;
  const result = await updateShopDetails({
    shopId: 'shop-1',
    shopName: 'Balaji Super Bazaar',
    phone: '+91 99999 00000',
    getIdToken: async () => 'test-token',
    apiBaseUrl: 'http://localhost:8000/api/',
    fetcher: async (input, init) => {
      assert.equal(input, 'http://localhost:8000/api/shops/shop-1');
      assert.equal(init?.method, 'PATCH');
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-token');
      payloadSent = JSON.parse(init?.body as string);
      return response(200, { success: true, shop: updatedShop });
    },
  });

  assert.deepEqual(result, updatedShop);
  assert.deepEqual(payloadSent, {
    shopName: 'Balaji Super Bazaar',
    phone: '+91 99999 00000',
  });
});
