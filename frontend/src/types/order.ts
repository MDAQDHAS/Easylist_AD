export type Unit = 'kg' | 'g' | 'ltr' | 'ml' | 'pkt' | 'pcs' | 'box' | 'bottle' | 'bundle' | 'bag' | 'tin' | 'dozen';

export interface OrderItem {
  id: string;
  name: string;
  originalText?: string;
  tamilName?: string;
  englishName?: string;
  normalizedName?: string;
  quantity: number | string;
  unit: Unit | string;
  unitPrice: number;
  total: number;
  confidence?: number; // 0 to 1
  category?: string;
  hasWarning?: boolean;
  warningMessage?: string;
  isUncertain?: boolean;
}

export interface UploadedFileItem {
  id: string;
  file?: File;
  name: string;
  size: number;
  previewUrl: string;
}

export interface StoreInfo {
  id: string;
  name: string;
  tagline?: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  gstin?: string;
  upiId?: string;
  logoUrl?: string;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  address?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  date: string;
  time: string;
  customer: CustomerInfo;
  store: StoreInfo;
  items: OrderItem[];
  subtotal: number;
  taxRate: number; // percentage (e.g. 5 for 5%)
  taxAmount: number;
  discount: number;
  grandTotal: number;
  status: 'draft' | 'extracted' | 'reviewed' | 'completed';
  originalImageUrl?: string;
  imageFileName?: string;
  createdAt: string;
}

export type OrderWorkflowStep = 'upload' | 'review' | 'export';

export interface ScanStage {
  id: number;
  label: string;
  detail: string;
}
