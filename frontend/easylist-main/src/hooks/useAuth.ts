import { useState, useEffect } from 'react';
import { User, AuthState } from '../types/auth';
import { StoreInfo } from '../types/order';
import { storage } from '../lib/storage';
import { DEFAULT_STORE } from '../lib/constants';
import { onAuthChange, signOutUser } from '../services/authService';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const user = storage.getUser();
    return {
      user,
      isAuthenticated: !!user,
      isLoading: true,
    };
  });

  const [store, setStore] = useState<StoreInfo>(() => {
    const storedStore = storage.getStore();
    return (
      storedStore || {
        id: '',
        name: '',
        ownerName: '',
        phone: '',
        email: '',
        address: '',
      }
    );
  });

  useEffect(() => {
    const unsubscribe = onAuthChange((firebaseUser) => {
      if (firebaseUser) {
        const storedUser = storage.getUser();
        const user: User = storedUser && storedUser.email === firebaseUser.email
          ? storedUser
          : {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Shop Owner',
              email: firebaseUser.email || '',
              role: 'owner',
              store,
            };
        setAuthState({
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        storage.setUser(null);
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    });

    return () => unsubscribe();
  }, [store]);

  const logout = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.warn('Sign out error:', err);
    }
    storage.setUser(null);
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  const updateStore = (updatedStore: StoreInfo) => {
    setStore(updatedStore);
    storage.saveStore(updatedStore);
    if (authState.user) {
      const updatedUser = { ...authState.user, store: updatedStore };
      setAuthState((prev) => ({ ...prev, user: updatedUser }));
      storage.setUser(updatedUser);
    }
  };

  return {
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    store,
    logout,
    updateStore,
  };
}
