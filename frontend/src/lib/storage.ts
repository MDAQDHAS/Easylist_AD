import { Order, OrderItem, StoreInfo } from '../types/order';
import { User } from '../types/auth';
import { ProductMasterFile } from '../types/productMaster';
import { DEFAULT_STORE, DEMO_USER } from './constants';

export interface AccountRecord {
  id: string;
  recordNumber: string;
  type: 'account_entry' | 'cheque';
  title: string;
  partyName: string;
  date: string;
  time: string;
  createdAt: string;
  amount: number;
  notes?: string;
  items: OrderItem[];
  bankName?: string;
  chequeNumber?: string;
  status: 'completed' | 'pending';
}

const STORAGE_KEYS = {
  USER: 'easybill_user',
  STORE: 'easybill_store',
  ORDERS: 'easybill_orders',
  ACTIVE_DRAFT: 'easybill_active_draft',
  ACCOUNTS_RECORDS: 'easybill_accounts_records',
  PRODUCT_MASTER: 'easybill_product_master',
};

const memoryStore = new Map<string, string>();

function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // Fall back to memory
  }
  return memoryStore.get(key) || null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // Fall back to memory
  }
  memoryStore.set(key, value);
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {
    // Fall back to memory
  }
  memoryStore.delete(key);
}

export const storage = {
  getUser(): User | null {
    try {
      const data = safeGetItem(STORAGE_KEYS.USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setUser(user: User | null): void {
    if (user) {
      safeSetItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } else {
      safeRemoveItem(STORAGE_KEYS.USER);
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

  getAccountRecords(): AccountRecord[] {
    try {
      const data = safeGetItem(STORAGE_KEYS.ACCOUNTS_RECORDS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveAccountRecord(record: AccountRecord): void {
    const records = this.getAccountRecords();
    const existingIndex = records.findIndex((r) => r.id === record.id);
    if (existingIndex >= 0) {
      records[existingIndex] = record;
    } else {
      records.unshift(record);
    }
    safeSetItem(STORAGE_KEYS.ACCOUNTS_RECORDS, JSON.stringify(records));
  },

  deleteAccountRecord(id: string): void {
    const records = this.getAccountRecords().filter((r) => r.id !== id);
    safeSetItem(STORAGE_KEYS.ACCOUNTS_RECORDS, JSON.stringify(records));
  },

  getProductMaster(): ProductMasterFile | null {
    try {
      const data = safeGetItem(STORAGE_KEYS.PRODUCT_MASTER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  saveProductMaster(master: ProductMasterFile): void {
    try {
      safeSetItem(STORAGE_KEYS.PRODUCT_MASTER, JSON.stringify(master));
    } catch {
      // If quota exceeded due to rawBase64, persist without rawBase64
      try {
        const withoutBase64: ProductMasterFile = { ...master, rawBase64: undefined };
        safeSetItem(STORAGE_KEYS.PRODUCT_MASTER, JSON.stringify(withoutBase64));
      } catch (innerErr) {
        console.error('Failed to save product master to storage:', innerErr);
      }
    }
  },

  deleteProductMaster(): void {
    safeRemoveItem(STORAGE_KEYS.PRODUCT_MASTER);
  },
};
