import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { OrderItem, Unit, UploadedFileItem } from '../types/order';
import { storage } from '../lib/storage';
import { productMasterService } from '../services/productMasterService';

export const VALID_UNITS = new Set<string>([
  'kg',
  'g',
  'ltr',
  'ml',
  'pkt',
  'pcs',
  'box',
  'bottle',
  'bundle',
  'bag',
  'tin',
  'dozen',
]);

/**
 * Safely parse a positive quantity without ever converting empty/invalid input to 0 or 1.
 */
export function parsePositiveQuantity(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return null;
  }
  const str = String(value).trim();
  if (!str) {
    return null;
  }
  const parsed = Number(str);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed * 1000) / 1000;
}

/**
 * Sanitize monetary inputs (unitPrice, total). Invalid or negative values become 0.
 * Never invents a non-zero price.
 */
export function sanitizeMoney(value: unknown): number {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return 0;
  }
  const str = String(value).trim();
  if (!str) {
    return 0;
  }
  const parsed = Number(str);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.round(parsed * 100) / 100;
}

/**
 * Evaluate item warnings for missing/invalid fields or line-total arithmetic mismatches.
 */
export function evaluateItemWarnings(item: OrderItem): {
  hasWarning: boolean;
  warningMessage?: string;
} {
  const warnings: string[] = [];

  if (!String(item.name ?? '').trim()) {
    warnings.push('Verify the product name');
  }

  const validQty = parsePositiveQuantity(item.quantity);
  if (validQty === null) {
    warnings.push('Verify the quantity');
  }

  if (!VALID_UNITS.has(String(item.unit ?? ''))) {
    warnings.push('Select or verify the unit');
  }

  const validPrice = sanitizeMoney(item.unitPrice);
  const validTotal = sanitizeMoney(item.total);
  if (validQty !== null && validPrice > 0 && validTotal > 0) {
    const expectedTotal = Math.round(validQty * validPrice * 100) / 100;
    if (Math.abs(expectedTotal - validTotal) > 0.05) {
      warnings.push(
        `Line total (₹${validTotal}) does not match ${validQty} × ₹${validPrice} (₹${expectedTotal})`
      );
    }
  }

  if (warnings.length === 0) {
    return { hasWarning: false };
  }

  return {
    hasWarning: true,
    warningMessage: warnings.join('. '),
  };
}

/**
 * Pure reducer helper that applies user edits to a single OrderItem,
 * preserves originalText, recalculates line total, and re-evaluates warnings.
 */
export function applyItemUpdate(
  item: OrderItem,
  updates: Partial<OrderItem>,
  isOriginalView: boolean = false
): OrderItem {
  const next: OrderItem = {
    ...item,
    ...updates,
    // Always preserve originalText unless explicitly provided in updates
    originalText: updates.originalText !== undefined ? updates.originalText : item.originalText,
  };

  if ('name' in updates) {
    const updatedName = String(updates.name ?? '');
    next.name = updatedName;
    if (isOriginalView) {
      next.originalText = updatedName;
      if (item.tamilName !== undefined) {
        next.tamilName = updatedName;
      }
    } else {
      next.normalizedName = updatedName;
      next.englishName = updatedName;
      // Do not overwrite or lose original Tamil text when editing English names
      next.originalText = item.originalText;
      if (item.tamilName !== undefined) {
        next.tamilName = item.tamilName;
      }
    }
  }

  if ('quantity' in updates) {
    const rawQty = updates.quantity;
    if (rawQty === '' || rawQty === null || rawQty === undefined) {
      next.quantity = '';
    } else {
      const strQty = String(rawQty);
      const parsedQty = parsePositiveQuantity(rawQty);
      // Preserve trailing decimal while user is typing (e.g. "2."), otherwise store numeric value if valid
      if (parsedQty !== null && !strQty.endsWith('.')) {
        next.quantity = parsedQty;
      } else if (parsedQty === null) {
        // Keep empty string if non-positive/invalid number was passed, or raw string for UI feedback
        next.quantity = typeof rawQty === 'number' ? '' : strQty;
      } else {
        next.quantity = strQty;
      }
    }
  }

  if ('unit' in updates) {
    next.unit = String(updates.unit ?? '');
  }

  if ('unitPrice' in updates) {
    next.unitPrice = sanitizeMoney(updates.unitPrice);
  }

  if ('total' in updates) {
    next.total = sanitizeMoney(updates.total);
  }

  // Automatically recalculate line total whenever quantity or unitPrice changes
  if (('quantity' in updates || 'unitPrice' in updates) && !('total' in updates)) {
    const validQty = parsePositiveQuantity(next.quantity);
    const validPrice = sanitizeMoney(next.unitPrice);
    if (validQty !== null && validPrice > 0) {
      next.total = Math.round(validQty * validPrice * 100) / 100;
    } else {
      next.total = 0;
    }
  }

  const warningState = evaluateItemWarnings(next);
  if (!warningState.hasWarning) {
    next.hasWarning = false;
    delete next.warningMessage;
    next.confidence = 1.0;
  } else {
    next.hasWarning = true;
    next.warningMessage = warningState.warningMessage;
  }

  return next;
}

/**
 * Pure helper to create a new OrderItem without inventing missing quantities, units, or prices.
 * Ignores DOM/React SyntheticEvent objects if accidentally passed via onClick.
 */
export function createNewOrderItem(initial?: Partial<OrderItem>): OrderItem {
  const safeInitial =
    initial &&
      typeof initial === 'object' &&
      !('nativeEvent' in initial) &&
      !('target' in initial)
      ? initial
      : undefined;

  const rawQty = safeInitial?.quantity;
  const parsedQty = parsePositiveQuantity(rawQty);
  const quantity: number | string = parsedQty !== null ? parsedQty : '';
  const unit: Unit | string =
    safeInitial?.unit && VALID_UNITS.has(String(safeInitial.unit))
      ? (safeInitial.unit as Unit)
      : '';
  const unitPrice = sanitizeMoney(safeInitial?.unitPrice ?? 0);
  const total =
    safeInitial?.total !== undefined
      ? sanitizeMoney(safeInitial.total)
      : parsedQty !== null && unitPrice > 0
        ? Math.round(parsedQty * unitPrice * 100) / 100
        : 0;

  const baseItem: OrderItem = {
    id:
      safeInitial?.id ||
      `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: String(safeInitial?.name ?? ''),
    ...(safeInitial?.originalText ? { originalText: safeInitial.originalText } : {}),
    quantity,
    unit,
    unitPrice,
    total,
    confidence: safeInitial?.confidence ?? 1.0,
    hasWarning: false,
  };

  const warningState = evaluateItemWarnings(baseItem);
  baseItem.hasWarning = warningState.hasWarning;
  if (warningState.warningMessage) {
    baseItem.warningMessage = warningState.warningMessage;
  }

  return baseItem;
}

/**
 * Pure helper to calculate the order grand total across all items.
 */
export function calculateOrderGrandTotal(items: OrderItem[]): number {
  const sum = items.reduce((acc, item) => acc + sanitizeMoney(item.total), 0);
  return Math.round(sum * 100) / 100;
}

/**
 * Normalizes OCR items to display in English by default.
 * Uses the existing normalized English product name from the OCR response
 * (`item.englishName || item.normalizedName || item.name`).
 * Strictly preserves `originalText` and `tamilName` without guessing or synthetic translation.
 */
export function normalizeOcrItemsToEnglish(items: OrderItem[]): OrderItem[] {
  return items.map((item) => {
    // English name priority: existing englishName -> normalizedName -> name
    const englishName =
      (typeof item.englishName === 'string' && item.englishName.trim()) ||
      (typeof item.normalizedName === 'string' && item.normalizedName.trim()) ||
      item.name ||
      '';

    // Original text priority: item.originalText -> item.tamilName -> item.name
    const originalText =
      (typeof item.originalText === 'string' && item.originalText.trim()) ||
      (typeof item.tamilName === 'string' && item.tamilName.trim()) ||
      item.name ||
      '';

    return {
      ...item,
      name: englishName,
      normalizedName: englishName,
      ...(item.englishName ? { englishName: item.englishName } : englishName ? { englishName } : {}),
      originalText: originalText || item.originalText,
      ...(item.tamilName ? { tamilName: item.tamilName } : {}),
    };
  });
}

/**
 * Toggle between normalized product name and originalText without ever overwriting originalText.
 */
export function toggleItemsLanguage(
  items: OrderItem[],
  showOriginal: boolean
): OrderItem[] {
  return items.map((item) => {
    const original =
      (typeof item.originalText === 'string' && item.originalText.trim()) ||
      (typeof item.tamilName === 'string' && item.tamilName.trim());
    if (!original) return item;

    if (showOriginal) {
      const savedNormalized = item.normalizedName ?? item.englishName ?? item.name;
      return {
        ...item,
        normalizedName: savedNormalized,
        name: original,
        originalText: item.originalText || original,
      };
    }

    const englishName = item.normalizedName ?? item.englishName ?? item.name;
    return {
      ...item,
      name: englishName,
      originalText: item.originalText || original,
    };
  });
}

interface OrderWorkflowContextType {
  uploadedFiles: UploadedFileItem[];
  items: OrderItem[];
  grandTotal: number;
  activeImageIndex: number;
  currentLanguage: 'ta' | 'en';
  isTranslating: boolean;
  translationError: string | null;
  orderSource: 'image' | 'text' | 'voice';
  sourceText?: string;
  sourceAudio?: { fileName: string; duration?: number; audioUrl?: string };
  setUploadedFiles: (files: UploadedFileItem[]) => void;
  addUploadedFiles: (files: UploadedFileItem[]) => void;
  removeUploadedFile: (id: string) => void;
  setActiveImageIndex: (index: number) => void;
  setItems: (items: OrderItem[]) => void;
  updateItem: (id: string, updates: Partial<OrderItem>) => void;
  addItem: (initial?: Partial<OrderItem>) => void;
  deleteItem: (id: string) => void;
  toggleLanguage: () => Promise<void>;
  clearTranslationError: () => void;
  clearWorkflow: () => void;
  setOrderSourceInfo: (
    source: 'image' | 'text' | 'voice',
    details?: { text?: string; audio?: { fileName: string; duration?: number; audioUrl?: string } }
  ) => void;
}

const OrderWorkflowContext = createContext<OrderWorkflowContextType | undefined>(undefined);

const STORAGE_KEY_ITEMS = 'easylist_workflow_items_v2';
const STORAGE_KEY_SOURCE = 'easylist_workflow_source_meta_v2';

export const OrderWorkflowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [uploadedFiles, setUploadedFilesState] = useState<UploadedFileItem[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [currentLanguage, setCurrentLanguage] = useState<'ta' | 'en'>('en');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  const [sourceMeta, setSourceMeta] = useState<{
    orderSource: 'image' | 'text' | 'voice';
    sourceText?: string;
    sourceAudio?: { fileName: string; duration?: number; audioUrl?: string };
  }>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY_SOURCE);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return { orderSource: 'image' };
  });

  const setOrderSourceInfo = useCallback(
    (
      source: 'image' | 'text' | 'voice',
      details?: { text?: string; audio?: { fileName: string; duration?: number; audioUrl?: string } }
    ) => {
      const updated = {
        orderSource: source,
        sourceText: details?.text,
        sourceAudio: details?.audio,
      };
      setSourceMeta(updated);
      try {
        sessionStorage.setItem(STORAGE_KEY_SOURCE, JSON.stringify(updated));
      } catch {
        // ignore
      }
    },
    []
  );

  // Initialize only reviewed workflow items; normalized to English by default.
  const [items, setItemsState] = useState<OrderItem[]>(() => {
    try {
      if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
        const saved = sessionStorage.getItem(STORAGE_KEY_ITEMS);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return normalizeOcrItemsToEnglish(parsed);
          }
        }
      }
    } catch (e) {
      console.warn('Could not read saved workflow items', e);
    }
    return [];
  });

  const grandTotal = useMemo(() => calculateOrderGrandTotal(items), [items]);

  // Sync items to sessionStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
        sessionStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
      }
    } catch (e) {
      console.warn('Could not save workflow items', e);
    }
  }, [items]);

  const setUploadedFiles = useCallback((files: UploadedFileItem[]) => {
    setUploadedFilesState(files);
    setActiveImageIndex(0);
  }, []);

  const addUploadedFiles = useCallback((newFiles: UploadedFileItem[]) => {
    setUploadedFilesState((prev) => [...prev, ...newFiles]);
  }, []);

  const removeUploadedFile = useCallback((id: string) => {
    setUploadedFilesState((prev) => {
      const next = prev.filter((f) => f.id !== id);
      setActiveImageIndex((currentIdx) => {
        if (next.length === 0) return 0;
        return Math.min(currentIdx, next.length - 1);
      });
      return next;
    });
  }, []);

  const setItems = useCallback((newItems: OrderItem[]) => {
    const normalized = normalizeOcrItemsToEnglish(newItems);
    const master = storage.getProductMaster();
    const matched = master
      ? normalized.map((item) => productMasterService.enhanceOrderItemWithMaster(item, master))
      : normalized;
    setItemsState(matched);
    setCurrentLanguage('en');
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<OrderItem>) => {
    const isOriginal = currentLanguage === 'ta';
    setItemsState((prev) =>
      prev.map((item) => (item.id === id ? applyItemUpdate(item, updates, isOriginal) : item))
    );
  }, [currentLanguage]);

  const addItem = useCallback((initial?: Partial<OrderItem>) => {
    const newItem = createNewOrderItem(initial);
    setItemsState((prev) => [...prev, newItem]);
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItemsState((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearTranslationError = useCallback(() => {
    setTranslationError(null);
  }, []);

  const toggleLanguage = useCallback(async () => {
    setIsTranslating(true);
    setTranslationError(null);

    const hasOriginalText = items.some(
      (item) =>
        (item.originalText && item.originalText.trim().length > 0) ||
        (item.tamilName && item.tamilName.trim().length > 0)
    );

    if (hasOriginalText) {
      // Default view is 'en'. When currentLanguage is 'en', clicking the button ("Show Original Text")
      // shows the original handwritten Tamil names (willShowOriginal: true) and sets currentLanguage to 'ta'.
      // When currentLanguage is 'ta', clicking the button ("Show English Names")
      // restores the English names (willShowOriginal: false) and sets currentLanguage to 'en'.
      const willShowOriginal = currentLanguage === 'en';
      setItemsState((prev) => toggleItemsLanguage(prev, willShowOriginal));
      setCurrentLanguage(willShowOriginal ? 'ta' : 'en');
      setIsTranslating(false);
      return;
    }

    setIsTranslating(false);
    setTranslationError(
      'Original handwritten text matches current item names. You can edit product names directly.'
    );
  }, [items, currentLanguage]);

  const clearWorkflow = useCallback(() => {
    setUploadedFilesState([]);
    setItemsState([]);
    setActiveImageIndex(0);
    setTranslationError(null);
    setSourceMeta({ orderSource: 'image' });
    try {
      sessionStorage.removeItem(STORAGE_KEY_ITEMS);
      sessionStorage.removeItem(STORAGE_KEY_SOURCE);
    } catch {
      // ignore
    }
  }, []);

  return (
    <OrderWorkflowContext.Provider
      value={{
        uploadedFiles,
        items,
        grandTotal,
        activeImageIndex,
        currentLanguage,
        isTranslating,
        translationError,
        orderSource: sourceMeta.orderSource,
        sourceText: sourceMeta.sourceText,
        sourceAudio: sourceMeta.sourceAudio,
        setUploadedFiles,
        addUploadedFiles,
        removeUploadedFile,
        setActiveImageIndex,
        setItems,
        updateItem,
        addItem,
        deleteItem,
        toggleLanguage,
        clearTranslationError,
        clearWorkflow,
        setOrderSourceInfo,
      }}
    >
      {children}
    </OrderWorkflowContext.Provider>
  );
};

/* eslint-disable-next-line react-refresh/only-export-components */
export function useOrderWorkflow(): OrderWorkflowContextType {
  const context = useContext(OrderWorkflowContext);
  if (!context) {
    throw new Error('useOrderWorkflow must be used within an OrderWorkflowProvider');
  }
  return context;
}
