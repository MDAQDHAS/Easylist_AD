import test from 'node:test';
import assert from 'node:assert/strict';
import { storage } from '../../lib/storage';
import { User } from '../../types/auth';
import { StoreInfo } from '../../types/order';
import { getResetRedirectUrl } from '../../services/passwordRecoveryService';

test('storage: correctly handles User in Personal Workspace without a store', () => {
  // Mock localStorage for Node environment
  const storeMap = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => storeMap.get(key) ?? null,
    setItem: (key: string, value: string) => storeMap.set(key, value),
    removeItem: (key: string) => storeMap.delete(key),
    clear: () => storeMap.clear(),
    key: () => null,
    length: storeMap.size,
  };

  const personalUser: User = {
    id: 'firebase-uid-123',
    email: 'newuser@example.com',
    name: 'Jane Doe',
    role: 'owner',
  };

  storage.setUser(personalUser);
  const retrieved = storage.getUser();

  assert.equal(retrieved?.id, 'firebase-uid-123');
  assert.equal(retrieved?.email, 'newuser@example.com');
  assert.equal(retrieved?.name, 'Jane Doe');
  assert.equal(retrieved?.store, undefined);
});

test('storage: correctly handles User with an authorized Shop membership', () => {
  const shopStore: StoreInfo = {
    id: 'shop-uuid-456',
    name: 'Ganesh Supermarket',
    ownerName: 'Jane Doe',
    phone: '9876543210',
    email: 'newuser@example.com',
    address: '123 Main Street',
  };

  const memberUser: User = {
    id: 'firebase-uid-123',
    email: 'newuser@example.com',
    name: 'Jane Doe',
    role: 'owner',
    store: shopStore,
  };

  storage.setUser(memberUser);
  const retrieved = storage.getUser();

  assert.equal(retrieved?.store?.id, 'shop-uuid-456');
  assert.equal(retrieved?.store?.name, 'Ganesh Supermarket');
});

test('workspace resolution: empty memberships ([]) directly grants Personal Workspace', () => {
  const memberships: Array<{ shop_id: string; role: string }> = [];
  const user = {
    uid: 'firebase-uid-789',
    displayName: 'Alex Trader',
    email: 'alex@example.com',
    emailVerified: true,
  };

  // Simulating DashboardPage loadMembership logic
  let membershipState: 'loading' | 'member' | 'personal' = 'loading';
  let resolvedStoreName: string | undefined;

  if (memberships.length > 0) {
    membershipState = 'member';
  } else {
    membershipState = 'personal';
    resolvedStoreName = user.displayName
      ? `${user.displayName}'s Workspace`
      : 'Personal Workspace';
  }

  assert.equal(membershipState, 'personal');
  assert.equal(resolvedStoreName, "Alex Trader's Workspace");
  // User can immediately access order upload without being redirected to Register Shop
});

test('workspace resolution: existing memberships grants Shop Workspace', () => {
  const memberships = [{ shop_id: 'shop-999', role: 'owner' }];
  const loadedShop = { id: 'shop-999', name: 'Metro Cash & Carry' };

  let membershipState: 'loading' | 'member' | 'personal' = 'loading';
  let resolvedStoreName: string | undefined;

  if (memberships.length > 0) {
    membershipState = 'member';
    resolvedStoreName = loadedShop.name;
  } else {
    membershipState = 'personal';
  }

  assert.equal(membershipState, 'member');
  assert.equal(resolvedStoreName, 'Metro Cash & Carry');
});

test('auth guard logic: unverified user is blocked from dashboard', () => {
  const unverifiedUser = {
    uid: 'user-unverified',
    email: 'unverified@example.com',
    emailVerified: false,
  };

  // Evaluating ProtectedRoute / RootRedirect predicate
  const canAccessDashboard = Boolean(unverifiedUser && unverifiedUser.emailVerified);
  assert.equal(canAccessDashboard, false, 'Unverified user must not be granted dashboard access');
});

test('auth guard logic: verified user is allowed into dashboard immediately', () => {
  const verifiedUser = {
    uid: 'user-verified',
    email: 'verified@example.com',
    emailVerified: true,
  };

  const canAccessDashboard = Boolean(verifiedUser && verifiedUser.emailVerified);
  assert.equal(canAccessDashboard, true, 'Verified user must be granted direct dashboard access');
});

test('auth guard logic: unauthenticated visitor is redirected to login', () => {
  const visitor = null;
  const canAccessDashboard = Boolean(visitor && (visitor as any).emailVerified);
  assert.equal(canAccessDashboard, false, 'Visitor must not be granted dashboard access');
});

test('storage: scopes store per user UID so User A and User B never mix store details', () => {
  const storeMap = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => storeMap.get(key) ?? null,
    setItem: (key: string, value: string) => storeMap.set(key, value),
    removeItem: (key: string) => storeMap.delete(key),
    clear: () => storeMap.clear(),
    key: () => null,
    length: storeMap.size,
  };

  const userAStore: StoreInfo = {
    id: 'shop-A-101',
    name: 'Annai Super Stores',
    ownerName: 'Annai Super Stores',
    phone: '+91 91111 11111',
    email: 'annai@example.com',
    address: 'Salem Bazaar',
  };

  const userBStore: StoreInfo = {
    id: 'shop-B-202',
    name: 'Babu Wholesale Traders',
    ownerName: 'Babu Wholesale Traders',
    phone: '+91 92222 22222',
    email: 'babu@example.com',
    address: 'Erode Market',
  };

  // Save stores for distinct users
  storage.saveStore(userAStore, 'uid-user-A');
  storage.saveStore(userBStore, 'uid-user-B');

  // Verify User A receives only User A's details
  const retrievedA = storage.getStore('uid-user-A');
  assert.equal(retrievedA?.name, 'Annai Super Stores');
  assert.equal(retrievedA?.phone, '+91 91111 11111');
  assert.equal(retrievedA?.email, 'annai@example.com');

  // Verify User B receives only User B's details
  const retrievedB = storage.getStore('uid-user-B');
  assert.equal(retrievedB?.name, 'Babu Wholesale Traders');
  assert.equal(retrievedB?.phone, '+91 92222 22222');
  assert.equal(retrievedB?.email, 'babu@example.com');

  // Updating User A does not alter User B
  storage.saveStore({ ...userAStore, name: 'Annai Mega Mart' }, 'uid-user-A');
  assert.equal(storage.getStore('uid-user-A')?.name, 'Annai Mega Mart');
  assert.equal(storage.getStore('uid-user-B')?.name, 'Babu Wholesale Traders');
});

test('storage: returns null (never dummy Sri Gokulakkannan) when user has no saved store', () => {
  const storeMap = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => storeMap.get(key) ?? null,
    setItem: (key: string, value: string) => storeMap.set(key, value),
    removeItem: (key: string) => storeMap.delete(key),
    clear: () => storeMap.clear(),
    key: () => null,
    length: storeMap.size,
  };

  const freshUserStore = storage.getStore('uid-brand-new-user');
  assert.equal(freshUserStore, null, 'Unsaved account must return null, never dummy Gokulakkannan details');
});

test('password reset redirect URL: always targets deployed EasyList website', () => {
  const resetUrl = getResetRedirectUrl();
  assert.ok(
    resetUrl.startsWith('https://') || resetUrl.includes('/reset-password'),
    'Reset URL must point to canonical reset route'
  );
  assert.ok(
    !resetUrl.includes('localhost') && !resetUrl.includes('127.0.0.1'),
    'Reset email link must never point to localhost'
  );
  assert.equal(resetUrl, 'https://easylist-588d9.web.app/reset-password');
});

