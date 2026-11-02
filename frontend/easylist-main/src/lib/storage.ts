import { Order, StoreInfo } from '../types/order';
import { User } from '../types/auth';
import { DEFAULT_STORE, DEMO_USER } from './constants';

const STORAGE_KEYS = {
  USER: 'easybill_user',
  STORE: 'easybill_store',
  ORDERS: 'easybill_orders',
  ACTIVE_DRAFT: 'easybill_active_draft',
};

export const storage = {
  getUser(): User | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setUser(user: User | null): void {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  },

  getStore(userId?: string): StoreInfo | null {
    try {
      const effectiveUserId = userId || this.getUser()?.id;
      const key = effectiveUserId ? `easybill_store_${effectiveUserId}` : STORAGE_KEYS.STORE;
      let data = localStorage.getItem(key);
      if (!data && effectiveUserId) {
        // Fall back to legacy key only if matching user
        const legacy = localStorage.getItem(STORAGE_KEYS.STORE);
        const legacyUser = this.getUser();
        if (legacy && legacyUser?.id === effectiveUserId) {
          data = legacy;
        }
      }
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.logoUrl === '/images/Easybill logo.png') {
          delete parsed.logoUrl;
        }
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  },

  saveStore(store: StoreInfo, userId?: string): void {
    const effectiveUserId = userId || this.getUser()?.id;
    if (effectiveUserId) {
      localStorage.setItem(`easybill_store_${effectiveUserId}`, JSON.stringify(store));
    }
    localStorage.setItem(STORAGE_KEYS.STORE, JSON.stringify(store));
  },

  clearStore(userId?: string): void {
    const effectiveUserId = userId || this.getUser()?.id;
    if (effectiveUserId) {
      localStorage.removeItem(`easybill_store_${effectiveUserId}`);
    }
    localStorage.removeItem(STORAGE_KEYS.STORE);
  },

  getOrders(): Order[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveOrder(order: Order): void {
    const orders = this.getOrders();
    const existingIndex = orders.findIndex((o) => o.id === order.id);
    if (existingIndex >= 0) {
      orders[existingIndex] = order;
    } else {
      orders.unshift(order);
    }
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  },

  deleteOrder(id: string): void {
    const orders = this.getOrders().filter((o) => o.id !== id);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  },

  getOrderById(id: string): Order | undefined {
    return this.getOrders().find((o) => o.id === id);
  },
};
