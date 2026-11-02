import { StoreInfo } from './order';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'manager' | 'cashier';
  store?: StoreInfo;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
