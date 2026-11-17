import { useState, useEffect, useCallback, useRef } from 'react';
import { StoreInfo } from '../types/order';
import { storage } from '../lib/storage';
import { getCurrentUser, onAuthChange } from '../services/authService';
import {
  loadShopDetails,
  loadShopMemberships,
  registerShop,
  updateShopDetails,
} from '../services/shopMembershipService';
import { updateProfile } from 'firebase/auth';

export interface ShopProfileState {
  store: StoreInfo;
  shopName: string;
  email: string;
  phone: string;
  logoUrl?: string;
  initials: string;
  isLoading: boolean;
  isPersonalWorkspace: boolean;
  saveShopProfile: (updated: StoreInfo) => Promise<StoreInfo>;
}

/**
 * Synchronous resolution of the authenticated user's shop profile.
 * Guarantees zero flash of wrong or placeholder names across every page in EasyList.
 */
export function getAuthenticatedShopProfile(overrideStore?: StoreInfo): {
  store: StoreInfo;
  shopName: string;
  email: string;
  phone: string;
  logoUrl?: string;
  initials: string;
  isPersonalWorkspace: boolean;
} {
  // If explicitly provided via props (e.g. in test suites or direct injections), use it
  if (overrideStore && overrideStore.name && overrideStore.name.trim()) {
    const name = overrideStore.name.trim();
    const initials =
      name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('') || 'EL';
    return {
      store: overrideStore,
      shopName: name,
      email: overrideStore.email || '',
      phone: overrideStore.phone || '',
      logoUrl: overrideStore.logoUrl,
      initials,
      isPersonalWorkspace: false,
    };
  }

  const firebaseUser = getCurrentUser();
  const storedUser = storage.getUser();
  const effectiveUid = firebaseUser?.uid || storedUser?.id;

  // Retrieve cached store strictly scoped to the user (with fallback)
  const cachedStore = storage.getStore(effectiveUid) || (effectiveUid ? null : storage.getStore());
  const storedUserStore = storedUser?.store;

  const resolvedName =
    cachedStore?.name?.trim() ||
    storedUserStore?.name?.trim() ||
    firebaseUser?.displayName?.trim() ||
    storedUser?.name?.trim() ||
    '';

  const resolvedEmail =
    cachedStore?.email?.trim() ||
    storedUserStore?.email?.trim() ||
    firebaseUser?.email?.trim() ||
    storedUser?.email?.trim() ||
    '';

  const resolvedPhone =
    cachedStore?.phone?.trim() ||
    storedUserStore?.phone?.trim() ||
    '';

  const resolvedAddress =
    cachedStore?.address?.trim() ||
    storedUserStore?.address?.trim() ||
    '';

  const logoUrl = cachedStore?.logoUrl || storedUserStore?.logoUrl;

  const initials =
    resolvedName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || 'EL';

  const store: StoreInfo = {
    id: cachedStore?.id || storedUserStore?.id || '',
    name: resolvedName,
    ownerName: cachedStore?.ownerName || storedUserStore?.ownerName || resolvedName,
    phone: resolvedPhone,
    email: resolvedEmail,
    address: resolvedAddress,
    logoUrl,
  };

  return {
    store,
    shopName: resolvedName,
    email: resolvedEmail,
    phone: resolvedPhone,
    logoUrl,
    initials,
    isPersonalWorkspace: false,
  };
}

/**
 * Universal hook providing the single source of truth for the authenticated shop profile
 * across all EasyList application pages (Dashboard, Excel, Accounts, History, Results, Settings).
 */
export function useShopProfile(overrideStore?: StoreInfo): ShopProfileState {
  const [profile, setProfile] = useState(() => getAuthenticatedShopProfile(overrideStore));
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const user = getCurrentUser();
    const stored = storage.getUser();
    return Boolean((user || stored) && !profile.shopName);
  });
  const syncRef = useRef<AbortController | null>(null);

  // Sync state if overrideStore changes
  useEffect(() => {
    if (overrideStore?.name) {
      setProfile(getAuthenticatedShopProfile(overrideStore));
    }
  }, [overrideStore]);

  // Synchronize in real time with shop updates (Settings modal save, cross-tab, auth changes)
  useEffect(() => {
    const handleStoreUpdated = (e?: Event) => {
      const customEvt = e as CustomEvent<StoreInfo>;
      if (customEvt?.detail?.name) {
        setProfile(getAuthenticatedShopProfile(customEvt.detail));
      } else {
        setProfile(getAuthenticatedShopProfile(overrideStore));
      }
    };

    window.addEventListener('easylist_store_updated', handleStoreUpdated);
    window.addEventListener('storage', handleStoreUpdated);

    const unsubscribeAuth = onAuthChange(() => {
      setProfile(getAuthenticatedShopProfile(overrideStore));
    });

    return () => {
      window.removeEventListener('easylist_store_updated', handleStoreUpdated);
      window.removeEventListener('storage', handleStoreUpdated);
      unsubscribeAuth();
    };
  }, [overrideStore]);

  // Background server synchronization with shop memberships & shop details
  useEffect(() => {
    if (overrideStore?.name) return; // Prop override takes priority in isolated tests

    const user = getCurrentUser();
    if (!user) return;

    syncRef.current?.abort();
    const controller = new AbortController();
    syncRef.current = controller;

    const apiBaseUrl =
      (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
      'http://localhost:8000/api';

    const syncShopWithBackend = async () => {
      try {
        const memberships = await loadShopMemberships({
          getIdToken: (force) => user.getIdToken(force),
          apiBaseUrl,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (memberships.length > 0) {
          const primary = memberships[0];
          const cached = storage.getStore(user.uid);
          if (cached?.id === primary.shop_id && cached.name) {
            setProfile(getAuthenticatedShopProfile(cached));
          }

          try {
            const shop = await loadShopDetails({
              shopId: primary.shop_id,
              getIdToken: (force) => user.getIdToken(force),
              apiBaseUrl,
              signal: controller.signal,
            });

            if (!controller.signal.aborted && shop.name) {
              const syncedStore: StoreInfo = {
                id: shop.id,
                name: shop.name,
                ownerName: user.displayName || shop.name,
                phone: shop.phone || cached?.phone || '',
                email: user.email || '',
                address: cached?.address || '',
                logoUrl: cached?.logoUrl,
              };
              storage.saveStore(syncedStore, user.uid);
              const storedUser = storage.getUser();
              storage.setUser({
                id: user.uid,
                email: user.email || '',
                name: syncedStore.name,
                role: storedUser?.role || 'owner',
                store: syncedStore,
              });
              setProfile(getAuthenticatedShopProfile(syncedStore));
              window.dispatchEvent(
                new CustomEvent('easylist_store_updated', { detail: syncedStore })
              );
            }
          } catch {
            // Keep local cached store
          }
        } else {
          // New account or offline: auto-register shop using displayName if available
          const targetName = user.displayName?.trim() || profile.shopName || 'My Shop';
          try {
            const registered = await registerShop({
              shopName: targetName,
              getIdToken: (force) => user.getIdToken(force),
              apiBaseUrl,
              signal: controller.signal,
            });
            if (!controller.signal.aborted && registered.shop.name) {
              const syncedStore: StoreInfo = {
                id: registered.shop.id,
                name: registered.shop.name,
                ownerName: registered.shop.name,
                phone: registered.shop.phone || '',
                email: user.email || '',
                address: '',
              };
              storage.saveStore(syncedStore, user.uid);
              const storedUser = storage.getUser();
              storage.setUser({
                id: user.uid,
                email: user.email || '',
                name: syncedStore.name,
                role: storedUser?.role || 'owner',
                store: syncedStore,
              });
              setProfile(getAuthenticatedShopProfile(syncedStore));
              window.dispatchEvent(
                new CustomEvent('easylist_store_updated', { detail: syncedStore })
              );
            }
          } catch {
            // Keep local cached store
          }
        }
      } catch {
        // Safe offline fallback
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          syncRef.current = null;
        }
      }
    };

    void syncShopWithBackend();

    return () => {
      controller.abort();
    };
  }, [overrideStore]);

  // Save updated store to backend, localStorage and session
  const saveShopProfile = useCallback(
    async (updated: StoreInfo): Promise<StoreInfo> => {
      const user = getCurrentUser();
      const storedUser = storage.getUser();
      const effectiveUid = user?.uid || storedUser?.id;
      const apiBaseUrl =
        (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
        'http://localhost:8000/api';

      let savedShopId = updated.id || profile.store.id;

      if (user) {
        try {
          if (savedShopId) {
            const res = await updateShopDetails({
              shopId: savedShopId,
              shopName: updated.name,
              phone: updated.phone,
              getIdToken: (force) => user.getIdToken(force),
              apiBaseUrl,
            });
            savedShopId = res.id;
          } else {
            const res = await registerShop({
              shopName: updated.name,
              phone: updated.phone,
              getIdToken: (force) => user.getIdToken(force),
              apiBaseUrl,
            });
            savedShopId = res.shop.id;
          }
        } catch (err) {
          console.warn('Backend shop sync error (saving locally):', err);
        }

        try {
          await updateProfile(user, { displayName: updated.name });
        } catch {
          // Non-fatal
        }
      }

      const finalizedStore: StoreInfo = {
        ...updated,
        id: savedShopId || '',
        email: profile.email || updated.email,
      };

      storage.saveStore(finalizedStore, effectiveUid);
      if (storedUser) {
        storage.setUser({
          ...storedUser,
          name: finalizedStore.name,
          store: finalizedStore,
        });
      }

      setProfile(getAuthenticatedShopProfile(finalizedStore));
      window.dispatchEvent(
        new CustomEvent('easylist_store_updated', { detail: finalizedStore })
      );

      return finalizedStore;
    },
    [profile.email, profile.store.id]
  );

  return {
    ...profile,
    isLoading,
    saveShopProfile,
  };
}
