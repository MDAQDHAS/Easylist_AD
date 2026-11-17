import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  CheckCircle2,
  AlertTriangle,
  Package,
  Store,
  Warehouse,
  Clock,
  Maximize2,
  Minimize2,
  Download,
  Copy,
  Plus,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  FileCode,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Lightbulb,
  FileImage,
  FileAudio,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';
import * as XLSXModule from 'xlsx-js-style';
import { jsPDF } from 'jspdf';
import autoTableModule from 'jspdf-autotable';
import { DashboardHeader } from '../components/layout/DashboardHeader';
import { AppSidebar } from '../components/layout/AppSidebar';
import { useOrderWorkflow, parsePositiveQuantity } from '../context/OrderWorkflowContext';
import { productMasterService } from '../services/productMasterService';
import { storage } from '../lib/storage';
import { useShopProfile } from '../hooks/useShopProfile';
import { ROUTES } from '../routes/paths';
import { OrderItem, StoreInfo, Unit } from '../types/order';
import { ProductMasterFile } from '../types/productMaster';
import {
  SAMPLE_PRODUCT_MASTER_COLUMNS,
  STANDALONE_SAMPLE_PRODUCT_MASTER,
} from '../data/sampleProductMaster';

const XLSX = (
  (XLSXModule as unknown as { default?: typeof XLSXModule }).default || XLSXModule
) as typeof XLSXModule;

const autoTable = (
  typeof autoTableModule === 'function'
    ? autoTableModule
    : (
        autoTableModule as unknown as {
          default?: typeof autoTableModule;
          autoTable?: typeof autoTableModule;
        }
      ).default ||
      (autoTableModule as unknown as { autoTable?: typeof autoTableModule }).autoTable
) as typeof autoTableModule;

export type AllocationTarget = 'shop' | 'godown' | 'pending';
export type MatchingStatus = 'matched' | 'unmatched' | 'needs_review';

export interface AllocatedItem {
  id: string; // unique allocated row id e.g. `${parentItemId}-shop`
  parentItemId: string; // reference to the unique extracted order line
  requestedName: string; // original customer request (preserved)
  selectedMasterRow: Record<string, any> | null; // exact record from the uploaded Product Master
  matchingStatus: MatchingStatus;
  allocationQuantity: number | string; // allocated quantity
  unit: string;
  allocation: AllocationTarget;
  splitFromParent: boolean;
}

interface ActiveCell {
  rowId: string;
  columnKey: string;
}

interface ResultsPageProps {
  currentStore?: StoreInfo;
}

const COMMON_UNITS: { value: Unit; label: string }[] = [
  { value: 'kg', label: 'KG (Kilogram)' },
  { value: 'g', label: 'G (Gram)' },
  { value: 'ltr', label: 'LTR (Litre)' },
  { value: 'ml', label: 'ML (Millilitre)' },
  { value: 'pkt', label: 'PKT (Packet)' },
  { value: 'pcs', label: 'PCS (Pieces)' },
  { value: 'box', label: 'BOX (Box)' },
  { value: 'bottle', label: 'BOTTLE (Bottle)' },
  { value: 'bundle', label: 'BUNDLE (Bundle)' },
  { value: 'bag', label: 'BAG (Bag)' },
  { value: 'tin', label: 'TIN (Tin)' },
  { value: 'dozen', label: 'DOZEN (Dozen)' },
];

export interface UnitCategory {
  category: string;
  units: string[];
}

export const WHOLESALE_UNIT_CATEGORIES: UnitCategory[] = [
  {
    category: 'Weight',
    units: ['KG', 'G', 'MG', 'TON', 'LB', 'OZ', 'QUINTAL'],
  },
  {
    category: 'Volume',
    units: ['LTR', 'ML', 'KL', 'CL', 'GALLON', 'PINT', 'QUART'],
  },
  {
    category: 'Count and Quantity',
    units: ['PCS', 'PC', 'NOS', 'NO', 'UNIT', 'PIECE', 'DOZEN', 'PAIR', 'SET', 'EACH'],
  },
  {
    category: 'Packaging',
    units: [
      'BOX',
      'PKT',
      'PACK',
      'PACKET',
      'BAG',
      'SACK',
      'CARTON',
      'CASE',
      'BUNDLE',
      'BOTTLE',
      'CAN',
      'TIN',
      'JAR',
      'TUBE',
      'ROLL',
      'TRAY',
      'SACHET',
      'STRIP',
      'POUCH',
      'CONTAINER',
      'DRUM',
      'BUCKET',
      'CRATE',
    ],
  },
  {
    category: 'Length and Measurement',
    units: ['M', 'CM', 'MM', 'FT', 'INCH', 'YARD'],
  },
  {
    category: 'Area',
    units: ['SQFT', 'SQM', 'ACRE', 'HECTARE'],
  },
  {
    category: 'Other',
    units: ['REAM', 'SHEET', 'PLATE', 'BAR', 'DOZEN BOX', 'PAIR SET'],
  },
];

export const ALL_WHOLESALE_UNITS: string[] = WHOLESALE_UNIT_CATEGORIES.flatMap((c) => c.units);

/**
 * Scan Divider Icon matching Dashboard and Accounts pages
 */
const ScanDividerIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 8V6C4 4.89543 4.89543 4 6 4H8M16 4H18C19.1046 4 20 4.89543 20 6V8M20 16V18C20 19.1046 19.1046 20 18 20H16M8 20H6C4.89543 20 4 19.1046 4 18V16"
      stroke="#5046F2"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 9.5H16M8 12.5H16M8 15.5H12.5"
      stroke="#5046F2"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Triggers browser download of a Blob client-side (Zero backend calls).
 */
function triggerBrowserDownload(blob: Blob, fileName: string): void {
  if (typeof window === 'undefined') return;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Initial Realistic Order Items for Standalone Preview Mode
 */
function createInitialPreviewItems(master: ProductMasterFile): AllocatedItem[] {
  const findRow = (code: string) => master.rows.find((r) => String(r['CODE']) === code) || null;

  const initialSpecs = [
    {
      parentId: 'order-item-1',
      requestedName: 'Good Day Biscuit',
      code: null,
      qty: 10,
      unit: 'PKT',
      status: 'needs_review' as MatchingStatus,
    },
    {
      parentId: 'order-item-2',
      requestedName: 'Gold Winner Refined Oil',
      code: '1201',
      qty: 6,
      unit: 'LTR',
      status: 'matched' as MatchingStatus,
    },
    {
      parentId: 'order-item-3',
      requestedName: 'Toor Dal Premium Grade',
      code: '1305',
      qty: 75,
      unit: 'KG',
      status: 'matched' as MatchingStatus,
    },
    {
      parentId: 'order-item-4',
      requestedName: 'Aachi Sambar Powder 200g',
      code: '1401',
      qty: 5,
      unit: 'KG',
      status: 'matched' as MatchingStatus,
    },
    {
      parentId: 'order-item-5',
      requestedName: 'Ponni Boiled Rice',
      code: '1301',
      qty: 10,
      unit: 'KG',
      status: 'matched' as MatchingStatus,
    },
    {
      parentId: 'order-item-6',
      requestedName: 'White Crystal Sugar',
      code: '1302',
      qty: 2,
      unit: 'KG',
      status: 'matched' as MatchingStatus,
    },
    {
      parentId: 'order-item-7',
      requestedName: 'Coconut Oil Pure 1 Ltr',
      code: '1205',
      qty: 6,
      unit: 'PCS',
      status: 'matched' as MatchingStatus,
    },
    {
      parentId: 'order-item-8',
      requestedName: 'Aashirvaad Shudh Chakki Atta',
      code: '1303',
      qty: 1,
      unit: 'KG',
      status: 'matched' as MatchingStatus,
    },
    {
      parentId: 'order-item-9',
      requestedName: 'Special Kashmiri Saffron',
      code: null,
      qty: 5,
      unit: 'G',
      status: 'unmatched' as MatchingStatus,
    },
  ];

  const list: AllocatedItem[] = [];

  initialSpecs.forEach((spec) => {
    const selectedMasterRow = spec.code ? findRow(spec.code) : null;
    const numQty = spec.qty;

    if (numQty > 25) {
      list.push({
        id: `${spec.parentId}-shop`,
        parentItemId: spec.parentId,
        requestedName: spec.requestedName,
        selectedMasterRow,
        matchingStatus: spec.status,
        allocationQuantity: 25,
        unit: spec.unit,
        allocation: 'shop',
        splitFromParent: true,
      });

      list.push({
        id: `${spec.parentId}-godown`,
        parentItemId: spec.parentId,
        requestedName: spec.requestedName,
        selectedMasterRow,
        matchingStatus: spec.status,
        allocationQuantity: numQty - 25,
        unit: spec.unit,
        allocation: 'godown',
        splitFromParent: true,
      });
    } else {
      list.push({
        id: `${spec.parentId}-shop`,
        parentItemId: spec.parentId,
        requestedName: spec.requestedName,
        selectedMasterRow,
        matchingStatus: spec.status,
        allocationQuantity: numQty,
        unit: spec.unit,
        allocation: 'shop',
        splitFromParent: false,
      });
    }
  });

  return list;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({ currentStore }) => {
  const navigate = useNavigate();
  const profile = useShopProfile(currentStore);

  const {
    items: workflowItems,
    uploadedFiles,
    orderSource,
    sourceText,
    sourceAudio,
  } = useOrderWorkflow();

  // Load the shop's actual uploaded Product Master or fallback to the comprehensive standalone sample
  const [productMaster, setProductMaster] = useState<ProductMasterFile>(() => {
    const saved = storage.getProductMaster();
    if (saved && saved.rows && saved.rows.length > 0) {
      return saved;
    }
    return STANDALONE_SAMPLE_PRODUCT_MASTER;
  });

  // Active Allocation Tab: 'shop' | 'godown' | 'pending'
  const [activeTab, setActiveTab] = useState<AllocationTarget>('shop');

  // Maximize / Minimize view state
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  // UI Popovers & Modals
  const [isDownloadOpen, setIsDownloadOpen] = useState<boolean>(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [activeRowMenuId, setActiveRowMenuId] = useState<string | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // Active Unit Portal Dropdown state (renders into document.body to avoid table overflow clipping)
  const [activeUnitDropdown, setActiveUnitDropdown] = useState<{
    itemId: string;
    columnKey: string;
    currentUnit: string;
    searchQuery: string;
    coords: {
      top: number;
      left: number;
      openUpwards: boolean;
    };
  } | null>(null);
  const unitDropdownRef = useRef<HTMLDivElement | null>(null);
  const unitSearchInputRef = useRef<HTMLInputElement | null>(null);

  // Selected row checkboxes state
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // DIRECT INLINE EXCEL-STYLE EDITING STATE
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [activeCellValue, setActiveCellValue] = useState<string>('');
  const [editingSuggestions, setEditingSuggestions] = useState<Array<Record<string, any>>>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(-1);

  // Add Item Modal form state with search
  const [addSearchQuery, setAddSearchQuery] = useState<string>('');
  const [addSelectedMasterRow, setAddSelectedMasterRow] = useState<Record<string, any> | null>(null);
  const [addName, setAddName] = useState<string>('');
  const [addQty, setAddQty] = useState<string>('1');
  const [addUnit, setAddUnit] = useState<string>('kg');
  const [addAllocationTarget, setAddAllocationTarget] = useState<AllocationTarget>('shop');
  const [addError, setAddError] = useState<string | null>(null);

  // Pagination (8 items per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 8;

  // Image Inspector State
  const [imageZoom, setImageZoom] = useState<number>(1);
  const [imagePan, setImagePan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Audio playback ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastNotice(msg);
    setTimeout(() => {
      setToastNotice((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  // Sync Product Master from storage if available
  useEffect(() => {
    const saved = storage.getProductMaster();
    if (saved && saved.rows && saved.rows.length > 0) {
      setProductMaster(saved);
    }
  }, []);

  // Close menus and dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown="download"]')) {
        setIsDownloadOpen(false);
      }
      if (!target.closest('[data-dropdown="row-action"]')) {
        setActiveRowMenuId(null);
      }
      // Close Unit Portal dropdown when clicking outside
      if (
        unitDropdownRef.current &&
        !unitDropdownRef.current.contains(target) &&
        !target.closest('[data-unit-trigger="true"]')
      ) {
        setActiveUnitDropdown(null);
      }
      // If clicking outside an active cell, commit the edit
      if (
        !target.closest('[data-cell-input="true"]') &&
        !target.closest('[data-popover="item-suggestions"]') &&
        !target.closest('[data-popover="unit-suggestions"]')
      ) {
        // Will be handled by onBlur on the input
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Handle escape key and scroll for active unit dropdown
  useEffect(() => {
    if (!activeUnitDropdown) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveUnitDropdown(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeUnitDropdown]);

  /**
   * Initialize Allocated Items
   */
  const [allocatedItems, setAllocatedItems] = useState<AllocatedItem[]>(() => {
    const effectiveMaster = storage.getProductMaster() || STANDALONE_SAMPLE_PRODUCT_MASTER;

    if (workflowItems && workflowItems.length > 0) {
      const list: AllocatedItem[] = [];
      for (const item of workflowItems) {
        const rawQty = item.quantity;
        const numQty = parsePositiveQuantity(rawQty);
        const unit = String(item.unit || 'KG').toUpperCase();
        const requestedName = (item.originalText && item.originalText.trim()) || item.name;

        const match = productMasterService.matchProductAgainstMaster(item.name, effectiveMaster);

        let matchingStatus: MatchingStatus = 'unmatched';
        let selectedMasterRow: Record<string, any> | null = null;

        if (match && match.matched && match.matchedRow) {
          matchingStatus = 'matched';
          selectedMasterRow = match.matchedRow;
        } else if (match && match.isAmbiguous) {
          matchingStatus = 'needs_review';
          selectedMasterRow = null;
        } else {
          matchingStatus = 'unmatched';
          selectedMasterRow = null;
        }

        if (numQty !== null && numQty > 25) {
          const shopQty = 25;
          const godownQty = Math.round((numQty - 25) * 1000) / 1000;

          list.push({
            id: `${item.id}-shop`,
            parentItemId: item.id,
            requestedName,
            selectedMasterRow,
            matchingStatus,
            allocationQuantity: shopQty,
            unit,
            allocation: 'shop',
            splitFromParent: true,
          });

          list.push({
            id: `${item.id}-godown`,
            parentItemId: item.id,
            requestedName,
            selectedMasterRow,
            matchingStatus,
            allocationQuantity: godownQty,
            unit,
            allocation: 'godown',
            splitFromParent: true,
          });
        } else {
          list.push({
            id: `${item.id}-shop`,
            parentItemId: item.id,
            requestedName,
            selectedMasterRow,
            matchingStatus,
            allocationQuantity: numQty !== null ? numQty : rawQty || 1,
            unit,
            allocation: 'shop',
            splitFromParent: false,
          });
        }
      }
      return list;
    }

    return createInitialPreviewItems(effectiveMaster);
  });

  // Re-sync if real workflow items change externally
  useEffect(() => {
    if (!workflowItems || workflowItems.length === 0) return;
    const existingParentIds = new Set(allocatedItems.map((i) => i.parentItemId));
    const isDifferent =
      workflowItems.length !== existingParentIds.size ||
      workflowItems.some((i) => !existingParentIds.has(i.id));

    if (isDifferent) {
      const list: AllocatedItem[] = [];
      const effectiveMaster = productMaster;

      for (const item of workflowItems) {
        const rawQty = item.quantity;
        const numQty = parsePositiveQuantity(rawQty);
        const unit = String(item.unit || 'KG').toUpperCase();
        const requestedName = (item.originalText && item.originalText.trim()) || item.name;

        const match = productMasterService.matchProductAgainstMaster(item.name, effectiveMaster);

        let matchingStatus: MatchingStatus = 'unmatched';
        let selectedMasterRow: Record<string, any> | null = null;

        if (match && match.matched && match.matchedRow) {
          matchingStatus = 'matched';
          selectedMasterRow = match.matchedRow;
        } else if (match && match.isAmbiguous) {
          matchingStatus = 'needs_review';
          selectedMasterRow = null;
        } else {
          matchingStatus = 'unmatched';
          selectedMasterRow = null;
        }

        if (numQty !== null && numQty > 25) {
          const shopQty = 25;
          const godownQty = Math.round((numQty - 25) * 1000) / 1000;

          list.push({
            id: `${item.id}-shop`,
            parentItemId: item.id,
            requestedName,
            selectedMasterRow,
            matchingStatus,
            allocationQuantity: shopQty,
            unit,
            allocation: 'shop',
            splitFromParent: true,
          });

          list.push({
            id: `${item.id}-godown`,
            parentItemId: item.id,
            requestedName,
            selectedMasterRow,
            matchingStatus,
            allocationQuantity: godownQty,
            unit,
            allocation: 'godown',
            splitFromParent: true,
          });
        } else {
          list.push({
            id: `${item.id}-shop`,
            parentItemId: item.id,
            requestedName,
            selectedMasterRow,
            matchingStatus,
            allocationQuantity: numQty !== null ? numQty : rawQty || 1,
            unit,
            allocation: 'shop',
            splitFromParent: false,
          });
        }
      }
      setAllocatedItems(list);
    }
  }, [workflowItems, productMaster]);

  /**
   * Summary Cards dynamically calculated
   */
  const summaryCards = useMemo(() => {
    const parentMap = new Map<string, MatchingStatus>();

    for (const alloc of allocatedItems) {
      if (!parentMap.has(alloc.parentItemId)) {
        parentMap.set(alloc.parentItemId, alloc.matchingStatus);
      } else {
        const existing = parentMap.get(alloc.parentItemId);
        if (existing !== 'matched' && alloc.matchingStatus === 'matched') {
          parentMap.set(alloc.parentItemId, 'matched');
        }
      }
    }

    const totalItems = parentMap.size;
    let inOurShopCount = 0;
    let notInOurShopCount = 0;

    parentMap.forEach((status) => {
      if (status === 'matched') {
        inOurShopCount++;
      } else {
        notInOurShopCount++;
      }
    });

    return {
      totalItems,
      inOurShop: inOurShopCount,
      notInOurShop: notInOurShopCount,
    };
  }, [allocatedItems]);

  // Tab filtered items
  const shopItems = useMemo(
    () => allocatedItems.filter((i) => i.allocation === 'shop'),
    [allocatedItems]
  );
  const godownItems = useMemo(
    () => allocatedItems.filter((i) => i.allocation === 'godown'),
    [allocatedItems]
  );
  const pendingItems = useMemo(
    () => allocatedItems.filter((i) => i.allocation === 'pending'),
    [allocatedItems]
  );

  const activeTabItems = useMemo(() => {
    if (activeTab === 'shop') return shopItems;
    if (activeTab === 'godown') return godownItems;
    return pendingItems;
  }, [activeTab, shopItems, godownItems, pendingItems]);

  // Pagination for active table
  const totalPages = Math.max(1, Math.ceil(activeTabItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return activeTabItems.slice(start, start + pageSize);
  }, [activeTabItems, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  /**
   * Table Columns:
   * Uses exact columns from uploaded Product Master or standard wholesale columns.
   */
  const dynamicColumns = useMemo(() => {
    if (productMaster && productMaster.columns && productMaster.columns.length > 0) {
      return productMaster.columns;
    }
    return SAMPLE_PRODUCT_MASTER_COLUMNS;
  }, [productMaster]);

  const hasSnoColumn = useMemo(
    () => dynamicColumns.some((c) => /^(s\.?\s*no\.?|sno|sl\.?\s*no\.?)$/i.test(c)),
    [dynamicColumns]
  );
  const hasQtyColumn = useMemo(
    () => dynamicColumns.some((c) => /^(qty|quantity|order\s*qty|allocated\s*qty)$/i.test(c)),
    [dynamicColumns]
  );
  const hasUnitColumn = useMemo(
    () => dynamicColumns.some((c) => /^(unit|uom)$/i.test(c)),
    [dynamicColumns]
  );
  const nameColumn = useMemo(() => {
    return (
      dynamicColumns.find((c) =>
        /^(item\s*name|product\s*name|particular|description|item|product)$/i.test(c)
      ) || 'ITEM NAME'
    );
  }, [dynamicColumns]);

  // Manual Reallocation handler
  const handleReallocate = (allocatedId: string, target: AllocationTarget) => {
    setAllocatedItems((prev) =>
      prev.map((item) => (item.id === allocatedId ? { ...item, allocation: target } : item))
    );
    setActiveRowMenuId(null);
    showToast(`Item moved to ${target.charAt(0).toUpperCase() + target.slice(1)}.`);
  };

  // Mark as Received handler for Pending items
  const handleMarkAsReceived = (allocatedId: string) => {
    setAllocatedItems((prev) =>
      prev.map((item) => {
        if (item.id === allocatedId) {
          return { ...item, allocation: 'shop' };
        }
        return item;
      })
    );
    setActiveRowMenuId(null);
    showToast('Item marked as received and moved to Shop allocation.');
  };

  // Dynamic column detection helper from productMaster.columns (for real uploaded Excel sheets)
  const detectedHsnCol = useMemo(
    () => productMaster.columns.find((c) => /hsn|sac/i.test(c)),
    [productMaster]
  );
  const detectedCodeCol = useMemo(
    () => productMaster.columns.find((c) => /code|id|item\s*code/i.test(c)),
    [productMaster]
  );
  const detectedBrandCol = useMemo(
    () => productMaster.columns.find((c) => /brand|mfr|company|make/i.test(c)),
    [productMaster]
  );
  const detectedRateCol = useMemo(
    () => productMaster.columns.find((c) => /rate|price|mrp|cost/i.test(c)),
    [productMaster]
  );
  const detectedPackCol = useMemo(
    () => productMaster.columns.find((c) => /pack|size|weight|uom/i.test(c)),
    [productMaster]
  );

  const isRealProductMasterUploaded = useMemo(() => {
    const saved = storage.getProductMaster();
    return Boolean(
      saved &&
      saved.rows &&
      saved.rows.length > 0 &&
      saved.id !== 'sample-master-standalone-v1'
    );
  }, [productMaster]);

  /**
   * Search suggestions helper for Item Name cell:
   * Uses productMasterService.searchProductMaster to search dynamically across
   * EVERY column in the uploaded Product Master Excel sheet.
   */
  const getProductSuggestions = useCallback(
    (query: string) => {
      return productMasterService.searchProductMaster(productMaster, query, 20);
    },
    [productMaster]
  );

  /**
   * DIRECT EXCEL-STYLE INLINE CELL EDITING LOGIC
   */

  // Start editing ANY cell on click
  const handleStartCellEdit = (
    rowId: string,
    columnKey: string,
    currentValue: string | number
  ) => {
    setActiveCell({ rowId, columnKey });
    const strVal = currentValue !== undefined && currentValue !== null ? String(currentValue) : '';
    setActiveCellValue(strVal);

    if (columnKey === nameColumn) {
      const matches = getProductSuggestions(strVal);
      setEditingSuggestions(matches);
      setSelectedSuggestionIndex(-1);
    } else {
      setEditingSuggestions([]);
      setSelectedSuggestionIndex(-1);
    }
  };

  // Commit changes when user presses Enter or clicks outside (blur)
  const handleCommitCellEdit = useCallback(() => {
    if (!activeCell) return;
    const { rowId, columnKey } = activeCell;
    const trimmedVal = activeCellValue.trim();

    setAllocatedItems((prev) =>
      prev.map((item) => {
        if (item.id !== rowId) return item;

        // 1. Editing Item Name
        if (columnKey === nameColumn) {
          const updatedName = trimmedVal || item.requestedName;
          const updatedRow = item.selectedMasterRow
            ? { ...item.selectedMasterRow, [nameColumn]: updatedName, 'ITEM NAME': updatedName }
            : { [nameColumn]: updatedName, 'ITEM NAME': updatedName };
          return {
            ...item,
            requestedName: updatedName,
            selectedMasterRow: updatedRow,
          };
        }

        // 2. Editing Quantity
        if (/^(qty|quantity|allocated\s*qty|order\s*qty)$/i.test(columnKey) || columnKey === '__qty__') {
          const parsed = parsePositiveQuantity(trimmedVal);
          const newQty = parsed !== null ? parsed : trimmedVal || item.allocationQuantity;
          const updatedRow = item.selectedMasterRow
            ? { ...item.selectedMasterRow, [columnKey]: newQty }
            : null;
          return {
            ...item,
            allocationQuantity: newQty,
            selectedMasterRow: updatedRow,
          };
        }

        // 3. Editing Unit (allows predefined or custom typed units like SACK, or clearing unit)
        if (/^(unit|uom)$/i.test(columnKey) || columnKey === '__unit__') {
          const newUnit = trimmedVal ? trimmedVal.toUpperCase() : '';
          const updatedRow = item.selectedMasterRow
            ? { ...item.selectedMasterRow, [columnKey]: newUnit }
            : null;
          return {
            ...item,
            unit: newUnit,
            selectedMasterRow: updatedRow,
          };
        }

        // 4. Editing any other available Product Master field (HSN CODE, CODE, ALIAS, RATE, BRAND, etc.)
        const updatedMasterRow = item.selectedMasterRow
          ? { ...item.selectedMasterRow, [columnKey]: trimmedVal }
          : (() => {
              const emptyRow: Record<string, any> = {};
              dynamicColumns.forEach((c) => {
                emptyRow[c] = '';
              });
              emptyRow[nameColumn] = item.requestedName;
              emptyRow['ITEM NAME'] = item.requestedName;
              emptyRow[columnKey] = trimmedVal;
              return emptyRow;
            })();

        return {
          ...item,
          selectedMasterRow: updatedMasterRow,
        };
      })
    );

    setActiveCell(null);
    setEditingSuggestions([]);
  }, [activeCell, activeCellValue, nameColumn, dynamicColumns]);

  // Cancel editing on Escape
  const handleCancelCellEdit = () => {
    setActiveCell(null);
    setEditingSuggestions([]);
  };

  /**
   * Unit Selection handler:
   * Sets the unit directly, updating both item.unit and any active dynamic unit column.
   * Does NOT alter or convert the allocationQuantity.
   */
  const handleSelectUnit = (allocatedId: string, columnKey: string, selectedUnit: string) => {
    const cleanUnit = selectedUnit.trim().toUpperCase();
    setAllocatedItems((prev) =>
      prev.map((item) => {
        if (item.id === allocatedId) {
          const updatedRow = item.selectedMasterRow
            ? { ...item.selectedMasterRow, [columnKey]: cleanUnit }
            : null;
          return {
            ...item,
            unit: cleanUnit,
            selectedMasterRow: updatedRow,
          };
        }
        return item;
      })
    );
    setActiveUnitDropdown(null);
    setActiveCell(null);
    showToast(cleanUnit ? `Updated unit to "${cleanUnit}".` : 'Unit cleared.');
  };

  /**
   * Opens the Portal-Based Unit Dropdown:
   * Positions immediately next to clicked element, immune to any table scroll container clipping.
   */
  const handleOpenUnitDropdown = (
    e: React.MouseEvent<HTMLElement>,
    itemId: string,
    columnKey: string,
    currentUnit: string
  ) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const dropdownHeight = 360;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    const top = openUpwards ? Math.max(10, rect.top - dropdownHeight - 6) : rect.bottom + 6;
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - 330 - 12));

    setActiveUnitDropdown({
      itemId,
      columnKey,
      currentUnit,
      searchQuery: '',
      coords: {
        top,
        left,
        openUpwards,
      },
    });
  };

  /**
   * Suggestion Selection for Item Name:
   * Updates all corresponding available Excel fields from the selected Product Master record.
   * Preserves requestedName, quantity, and unit.
   */
  const handleSelectSuggestion = (allocatedId: string, suggestion: Record<string, any>) => {
    setAllocatedItems((prev) =>
      prev.map((item) => {
        if (item.id === allocatedId) {
          return {
            ...item,
            selectedMasterRow: { ...suggestion },
            matchingStatus: 'matched',
            unit: suggestion['UNIT'] || suggestion['UOM'] || item.unit,
          };
        }
        return item;
      })
    );
    setActiveCell(null);
    setEditingSuggestions([]);
    showToast(`Selected "${suggestion[nameColumn] || suggestion['ITEM NAME']}" from Product Master.`);
  };

  // Handle cell input keydown (Enter to save, Escape to cancel, Arrow keys for dropdown)
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowId: string,
    columnKey: string
  ) => {
    if (columnKey === nameColumn && editingSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          prev < editingSuggestions.length - 1 ? prev + 1 : prev
        );
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : 0));
        return;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < editingSuggestions.length) {
          handleSelectSuggestion(rowId, editingSuggestions[selectedSuggestionIndex]);
          return;
        }
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommitCellEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelCellEdit();
    }
  };

  // Row selection checkboxes
  const handleToggleRowSelection = (id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedRowIds.size === paginatedItems.length) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(paginatedItems.map((i) => i.id)));
    }
  };

  // Add Item Modal submit handler
  const handleAddItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = addName.trim();
    if (!trimmedName) {
      setAddError('Please enter or select a product name.');
      return;
    }

    const numQty = parsePositiveQuantity(addQty) || 1;
    const parentId = `order-item-custom-${Date.now()}`;

    const newAlloc: AllocatedItem = {
      id: `${parentId}-${addAllocationTarget}`,
      parentItemId: parentId,
      requestedName: trimmedName,
      selectedMasterRow: addSelectedMasterRow
        ? addSelectedMasterRow
        : {
            'S.NO': productMaster.rows.length + 1,
            CODE: '',
            'HSN CODE': '',
            'ITEM NAME': trimmedName,
            'ALIAS NAME': trimmedName,
            'PRINT NAME': trimmedName.toUpperCase(),
            BRAND: '',
            'PACK SIZE': '',
            RATE: '',
          },
      matchingStatus: addSelectedMasterRow ? 'matched' : 'unmatched',
      allocationQuantity: numQty,
      unit: addUnit.toUpperCase(),
      allocation: addAllocationTarget,
      splitFromParent: false,
    };

    setAllocatedItems((prev) => [newAlloc, ...prev]);
    setIsAddItemModalOpen(false);
    setAddName('');
    setAddSearchQuery('');
    setAddSelectedMasterRow(null);
    setAddQty('1');
    setAddError(null);
    showToast(`Added "${trimmedName}" to ${addAllocationTarget} allocation.`);
  };

  // Copy All Items from active allocation tab
  const handleCopyAllItems = () => {
    if (activeTabItems.length === 0) {
      showToast('No items to copy in this tab.');
      return;
    }

    const textLines = activeTabItems.map((item, idx) => {
      const displayName = item.selectedMasterRow
        ? item.selectedMasterRow[nameColumn] || item.selectedMasterRow['ITEM NAME'] || item.requestedName
        : item.requestedName;
      return `${idx + 1}. ${displayName} - ${item.allocationQuantity} ${item.unit}`;
    });

    const output = [
      `EasyList Order - ${activeTab.toUpperCase()} Allocation`,
      `Total Lines: ${activeTabItems.length}`,
      '----------------------------------------',
      ...textLines,
    ].join('\n');

    navigator.clipboard
      .writeText(output)
      .then(() => showToast(`Copied ${activeTabItems.length} items from ${activeTab.toUpperCase()} tab!`))
      .catch(() => showToast('Failed to copy to clipboard.'));
  };

  // Exports reflecting the currently selected allocation tab
  const handleDownloadExcel = () => {
    const rows = activeTabItems.map((item, idx) => {
      const rowData: Record<string, any> = {};
      dynamicColumns.forEach((col) => {
        if (/^(s\.?\s*no\.?|sno|sl\.?\s*no\.?)$/i.test(col)) {
          rowData[col] = idx + 1;
        } else if (/^(qty|quantity|allocated\s*qty|order\s*qty)$/i.test(col)) {
          rowData[col] = item.allocationQuantity;
        } else if (/^(unit|uom)$/i.test(col)) {
          rowData[col] = item.unit;
        } else if (col === nameColumn) {
          rowData[col] = item.selectedMasterRow
            ? item.selectedMasterRow[col] || item.selectedMasterRow['ITEM NAME'] || item.requestedName
            : item.requestedName;
        } else {
          rowData[col] = item.selectedMasterRow ? item.selectedMasterRow[col] ?? '' : '';
        }
      });
      if (!hasQtyColumn) rowData['Order Qty'] = item.allocationQuantity;
      if (!hasUnitColumn) rowData['Unit'] = item.unit;

      return rowData;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, activeTab.toUpperCase());
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    triggerBrowserDownload(blob, `EasyList_${activeTab}_Allocation_${Date.now()}.xlsx`);
    setIsDownloadOpen(false);
    showToast(`Downloaded Excel (${activeTab.toUpperCase()}).`);
  };

  const handleDownloadCSV = () => {
    const rows = activeTabItems.map((item, idx) => {
      const rowData: Record<string, any> = {};
      dynamicColumns.forEach((col) => {
        if (/^(s\.?\s*no\.?|sno|sl\.?\s*no\.?)$/i.test(col)) {
          rowData[col] = idx + 1;
        } else if (/^(qty|quantity|allocated\s*qty|order\s*qty)$/i.test(col)) {
          rowData[col] = item.allocationQuantity;
        } else if (/^(unit|uom)$/i.test(col)) {
          rowData[col] = item.unit;
        } else if (col === nameColumn) {
          rowData[col] = item.selectedMasterRow
            ? item.selectedMasterRow[col] || item.selectedMasterRow['ITEM NAME'] || item.requestedName
            : item.requestedName;
        } else {
          rowData[col] = item.selectedMasterRow ? item.selectedMasterRow[col] ?? '' : '';
        }
      });
      if (!hasQtyColumn) rowData['Order Qty'] = item.allocationQuantity;
      if (!hasUnitColumn) rowData['Unit'] = item.unit;
      return rowData;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    triggerBrowserDownload(blob, `EasyList_${activeTab}_Allocation_${Date.now()}.csv`);
    setIsDownloadOpen(false);
    showToast(`Downloaded CSV (${activeTab.toUpperCase()}).`);
  };

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      doc.setFontSize(14);
      doc.text(`EasyList - ${activeTab.toUpperCase()} Allocation`, 40, 40);
      doc.setFontSize(9);
      doc.text(`Generated on ${new Date().toLocaleDateString()}`, 40, 56);

      const headers = [...dynamicColumns];
      if (!hasQtyColumn) headers.push('Order Qty');
      if (!hasUnitColumn) headers.push('Unit');

      const body = activeTabItems.map((item, idx) => {
        const rowValues: string[] = dynamicColumns.map((col) => {
          if (/^(s\.?\s*no\.?|sno|sl\.?\s*no\.?)$/i.test(col)) {
            return String(idx + 1);
          } else if (/^(qty|quantity|allocated\s*qty|order\s*qty)$/i.test(col)) {
            return String(item.allocationQuantity);
          } else if (/^(unit|uom)$/i.test(col)) {
            return String(item.unit);
          } else if (col === nameColumn) {
            return String(
              item.selectedMasterRow
                ? item.selectedMasterRow[col] || item.selectedMasterRow['ITEM NAME'] || item.requestedName
                : item.requestedName
            );
          } else {
            return String(item.selectedMasterRow ? item.selectedMasterRow[col] ?? '' : '');
          }
        });

        if (!hasQtyColumn) rowValues.push(String(item.allocationQuantity));
        if (!hasUnitColumn) rowValues.push(String(item.unit));
        return rowValues;
      });

      autoTable(doc, {
        head: [headers],
        body,
        startY: 70,
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [104, 66, 219] },
      });

      doc.save(`EasyList_${activeTab}_Allocation_${Date.now()}.pdf`);
      setIsDownloadOpen(false);
      showToast(`Downloaded PDF (${activeTab.toUpperCase()}).`);
    } catch (e) {
      console.error(e);
      showToast('Could not generate PDF.');
    }
  };

  const handleDownloadTXT = () => {
    const textLines = activeTabItems.map((item, idx) => {
      const displayName = item.selectedMasterRow
        ? item.selectedMasterRow[nameColumn] || item.selectedMasterRow['ITEM NAME'] || item.requestedName
        : item.requestedName;
      return `${idx + 1}. ${displayName} | ${item.allocationQuantity} ${item.unit}`;
    });

    const content = [
      `EasyList Order Export - ${activeTab.toUpperCase()} Allocation`,
      `Date: ${new Date().toLocaleString()}`,
      `Total Items: ${activeTabItems.length}`,
      '========================================',
      ...textLines,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    triggerBrowserDownload(blob, `EasyList_${activeTab}_Allocation_${Date.now()}.txt`);
    setIsDownloadOpen(false);
    showToast(`Downloaded Text File (${activeTab.toUpperCase()}).`);
  };

  // Zoom handlers for Original Order Preview
  const handleZoomIn = () => setImageZoom((prev) => Math.min(3.0, prev + 0.25));
  const handleZoomOut = () => setImageZoom((prev) => Math.max(0.75, prev - 0.25));
  const handleResetImage = () => {
    setImageZoom(1);
    setImagePan({ x: 0, y: 0 });
  };

  // Drag to pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (imageZoom <= 1) return;
    e.preventDefault();
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - imagePan.x, y: e.clientY - imagePan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || imageZoom <= 1) return;
    setImagePan({
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y,
    });
  };

  const handleMouseUp = () => setIsPanning(false);

  /**
   * Searchable Unit Dropdown Cell Renderer
   * Renders the trigger button in the table cell.
   * Clicking immediately opens the portal-based searchable unit dropdown into document.body.
   */
  const renderUnitCell = (
    item: AllocatedItem,
    colKey: string,
    _rIdx: number,
    cIdx?: number
  ) => {
    const currentUnit = item.unit || item.selectedMasterRow?.[colKey] || '';
    const isOpen =
      activeUnitDropdown?.itemId === item.id && activeUnitDropdown?.columnKey === colKey;

    return (
      <td
        key={`cell-${item.id}-${colKey}-${cIdx ?? 'fallback'}`}
        className="py-3.5 px-3.5 whitespace-nowrap font-semibold text-[#64748B] min-w-[110px]"
      >
        <button
          type="button"
          data-unit-trigger="true"
          onClick={(e) => handleOpenUnitDropdown(e, item.id, colKey, currentUnit)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold uppercase transition-all cursor-pointer ${
            isOpen
              ? 'border-[#6842DB] ring-1 ring-[#6842DB] bg-[#F1EDFF] text-[#6842DB]'
              : 'border-[#E2E8F0] hover:border-[#6842DB] bg-white text-[#172554] hover:bg-[#F8FAFC]'
          }`}
          title="Click to select or search unit"
        >
          <span>{currentUnit || '-'}</span>
          <ChevronDown
            className={`w-3 h-3 text-[#6842DB] shrink-0 transition-transform duration-150 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      </td>
    );
  };

  // Active uploaded image URL: falls back to sample chit if no upload exists
  const activeImageUrl =
    uploadedFiles && uploadedFiles.length > 0 && uploadedFiles[0].previewUrl
      ? uploadedFiles[0].previewUrl
      : '/images/sample-order-chit.jpg';

  const uploadedFileName =
    uploadedFiles && uploadedFiles.length > 0 ? uploadedFiles[0].name : 'Handwritten Order Chit';

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col font-sans pb-12 relative overflow-x-hidden">
      {/* 1. Global Shared Top Navigation */}
      <div className="relative z-50">
        <DashboardHeader
          variant="dashboard"
          currentStore={currentStore}
          onLogout={() => navigate(ROUTES.LOGIN)}
          externalSettingsOpen={isSettingsModalOpen}
          onExternalSettingsClose={() => setIsSettingsModalOpen(false)}
        />
      </div>

      {/* Floating Toast Notification */}
      {toastNotice && (
        <div className="fixed top-24 right-4 sm:right-8 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-[#111C35] text-white shadow-lg border border-white/10">
            <Info className="w-4 h-4 text-[#6842DB] shrink-0" />
            <span>{toastNotice}</span>
          </div>
        </div>
      )}

      {/* Top Center Scan Icon with Hairline Dividers */}
      <div className="flex items-center justify-center w-full max-w-[550px] mx-auto mt-7 mb-1">
        <div className="h-px bg-[#DCE3EE] flex-1" />
        <div className="mx-6 flex items-center justify-center shrink-0">
          <ScanDividerIcon />
        </div>
        <div className="h-px bg-[#DCE3EE] flex-1" />
      </div>

      {/* 2. Main Page Body Container */}
      <div className="relative z-10 flex-1 w-full max-w-[1348px] mx-auto px-4 xl:px-0">
        <div className="flex flex-col lg:flex-row items-start gap-6 xl:gap-[47px]">
          {/* Left App Sidebar Navigation Card */}
          <AppSidebar
            activeTab="dashboard"
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            onNavigateTab={(tab) => {
              if (tab === 'dashboard') navigate(ROUTES.DASHBOARD);
              else if (tab === 'accounts') navigate(ROUTES.ACCOUNTS);
              else if (tab === 'excel') navigate(ROUTES.EXCEL);
            }}
          />

          {/* Right Main Content Area */}
          <main className="flex-1 min-w-0 w-full max-w-[1094px] space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 pb-1">
              <div>
                <h1 className="text-2xl sm:text-[30px] font-bold font-heading text-[#111C35] tracking-[-0.02em] leading-tight">
                  Results &amp; Download
                </h1>
                <p className="text-xs sm:text-sm text-[#526077] mt-1 font-normal">
                  Review your extracted order, select the correct products and prepare your final order.
                </p>
              </div>

              {/* Standalone Preview Mode Indicator */}
              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EEEAFE] text-[#5046F2] text-xs font-semibold border border-[#DED8FD]">
                  <Sparkles className="w-3.5 h-3.5 text-[#5046F2]" />
                  <span>Preview Mode · Local Data</span>
                </span>
              </div>
            </div>

            {/* Summary Cards */}
            <section
              aria-label="Order Metrics Overview"
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              {/* Card 1: Total Items */}
              <div className="bg-white rounded-2xl border border-[#EAEEF5] p-5 shadow-[0_2px_10px_rgba(17,28,53,0.03)] hover:shadow-md transition-shadow flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#F1EDFF] border border-[#DDD6FE] flex items-center justify-center text-[#6842DB] shadow-2xs shrink-0">
                  <Package className="w-6 h-6 stroke-[2]" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
                    Total Items
                  </span>
                  <p className="text-2xl sm:text-[28px] font-extrabold font-heading text-[#172554] leading-tight mt-0.5">
                    {summaryCards.totalItems}
                  </p>
                  <p className="text-[11.5px] text-[#6842DB] font-medium mt-0.5 truncate">
                    Unique customer requests
                  </p>
                </div>
              </div>

              {/* Card 2: In Our Shop */}
              <div className="bg-white rounded-2xl border border-[#EAEEF5] p-5 shadow-[0_2px_10px_rgba(17,28,53,0.03)] hover:shadow-md transition-shadow flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#E3F7EF] border border-[#C5EDE0] flex items-center justify-center text-[#0D9668] shadow-2xs shrink-0">
                  <CheckCircle2 className="w-6 h-6 stroke-[2]" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
                    In Our Shop
                  </span>
                  <p className="text-2xl sm:text-[28px] font-extrabold font-heading text-[#172554] leading-tight mt-0.5">
                    {summaryCards.inOurShop}
                  </p>
                  <p className="text-[11.5px] text-[#0D9668] font-medium mt-0.5 truncate">
                    Confirmed catalog matches
                  </p>
                </div>
              </div>

              {/* Card 3: Not in Our Shop */}
              <div className="bg-white rounded-2xl border border-[#EAEEF5] p-5 shadow-[0_2px_10px_rgba(17,28,53,0.03)] hover:shadow-md transition-shadow flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#FFF4E5] border border-[#FED7AA] flex items-center justify-center text-[#EA580C] shadow-2xs shrink-0">
                  <AlertTriangle className="w-6 h-6 stroke-[2]" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
                    Not in Our Shop
                  </span>
                  <p className="text-2xl sm:text-[28px] font-extrabold font-heading text-[#172554] leading-tight mt-0.5">
                    {summaryCards.notInOurShop}
                  </p>
                  <p className="text-[11.5px] text-[#EA580C] font-medium mt-0.5 truncate">
                    Uncatalogued or pending selection
                  </p>
                </div>
              </div>
            </section>

            {/* Main Workspace (Equal Height Preview & Results Table) */}
            <div className="flex flex-col lg:flex-row gap-5 items-stretch lg:h-[640px]">
              {/* LEFT PANEL: Original Order Preview */}
              {!isMaximized && (
                <div className="w-full lg:w-[350px] xl:w-[370px] shrink-0 h-full flex flex-col">
                  <div className="bg-white rounded-2xl border border-[#EAEEF5] shadow-[0_2px_10px_rgba(17,28,53,0.03)] p-4 sm:p-5 flex flex-col h-full">
                    {/* Header with Title & Compact Image Controls */}
                    <div className="flex items-center justify-between pb-3 border-b border-[#F0F2F6] shrink-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#EEEAFE] text-[#5046F2] flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <h2 className="text-sm font-bold font-heading text-[#172554]">
                            Original Order Preview
                          </h2>
                          <p className="text-[11px] text-[#64748B]">Customer Request</p>
                        </div>
                      </div>

                      {/* Compact Image Toolbar */}
                      <div className="inline-flex items-center bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-0.5 gap-0.5 text-xs text-[#64748B]">
                        <button
                          type="button"
                          onClick={handleZoomOut}
                          disabled={imageZoom <= 0.75}
                          title="Zoom Out"
                          className="p-1 rounded-md hover:text-[#172554] hover:bg-white disabled:opacity-30 cursor-pointer transition-colors"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[11px] font-semibold text-[#172554] min-w-[34px] text-center select-none">
                          {Math.round(imageZoom * 100)}%
                        </span>
                        <button
                          type="button"
                          onClick={handleZoomIn}
                          disabled={imageZoom >= 3.0}
                          title="Zoom In"
                          className="p-1 rounded-md hover:text-[#172554] hover:bg-white disabled:opacity-30 cursor-pointer transition-colors"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleResetImage}
                          title="Reset Zoom"
                          className="p-1 rounded-md hover:text-[#172554] hover:bg-white cursor-pointer transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Centered Document Viewport Frame (Preserves Proportions) */}
                    <div className="flex-1 min-h-0 my-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] overflow-hidden relative flex items-center justify-center p-2">
                      {orderSource === 'text' ? (
                        <div className="w-full h-full p-4 overflow-y-auto text-xs text-[#172554] font-mono leading-relaxed bg-[#FFFBF6]/60">
                          <pre className="whitespace-pre-wrap font-sans">
                            {sourceText ||
                              '1. Good Day Biscuit - 10 pockets\n2. Gold Winner Refined Oil - 6 ltr\n3. Toor Dal - 75 kg\n4. Sambar Powder - 5 kg\n5. Rice - 10 kg\n6. Sugar - 2 kg\n7. Coconut Oil - 6 pcs\n8. Wheat Flour - 1 kg\n9. Special Kashmiri Saffron - 5 g'}
                          </pre>
                        </div>
                      ) : orderSource === 'voice' ? (
                        <div className="w-full h-full p-5 flex flex-col items-center justify-center text-center space-y-4">
                          <div className="w-16 h-16 rounded-2xl bg-[#E3F7EF] text-[#0D9668] flex items-center justify-center border border-[#C5EDE0]">
                            <FileAudio className="w-8 h-8" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-[#172554]">
                              {sourceAudio?.fileName || 'Recorded Voice Note'}
                            </div>
                            <div className="text-xs text-[#64748B] mt-0.5">
                              {sourceAudio?.duration ? `Duration: ${Math.round(sourceAudio.duration)}s` : 'Voice note order'}
                            </div>
                          </div>
                          {sourceAudio?.audioUrl && (
                            <audio ref={audioRef} src={sourceAudio.audioUrl} className="w-full max-w-xs" controls />
                          )}
                        </div>
                      ) : activeImageUrl ? (
                        <div
                          onMouseDown={handleMouseDown}
                          onMouseMove={handleMouseMove}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseUp}
                          className={`w-full h-full flex items-center justify-center overflow-hidden select-none ${
                            imageZoom > 1 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
                          }`}
                        >
                          <img
                            src={activeImageUrl}
                            alt="Uploaded handwritten chit"
                            className="max-w-full max-h-full object-contain pointer-events-none rounded-lg drop-shadow-sm transition-transform duration-100"
                            style={{
                              transform: `scale(${imageZoom}) translate(${imagePan.x / imageZoom}px, ${imagePan.y / imageZoom}px)`,
                            }}
                          />
                        </div>
                      ) : (
                        <div className="text-center p-6 space-y-2 text-[#64748B]">
                          <FileImage className="w-8 h-8 mx-auto opacity-50" />
                          <div className="text-xs font-medium">No order image uploaded</div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Document Viewer Footer */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-[#F0F2F6] text-xs text-[#64748B] shrink-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileImage className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                        <span className="truncate max-w-[180px] font-medium text-[#172554]">
                          {uploadedFileName}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetImage}
                        className="hover:text-[#6842DB] font-semibold cursor-pointer inline-flex items-center gap-1 text-[11.5px] transition-colors"
                      >
                        <Maximize2 className="w-3 h-3" />
                        <span>Fit View</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* RIGHT PANEL: Extracted Order Data Workspace (Excel-Style Direct Editing) */}
              <div className="flex-1 min-w-0 w-full h-full flex flex-col">
                <div className="bg-white rounded-2xl border border-[#EAEEF5] shadow-[0_2px_10px_rgba(17,28,53,0.03)] p-4 sm:p-5 flex flex-col h-full">
                  {/* Top Bar: Allocation Tabs & Maximize Control */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#F0F2F6] shrink-0">
                    {/* Allocation Tabs (Shop, Godown, Pending) */}
                    <div className="inline-flex items-center bg-[#F1F5F9]/90 p-1 rounded-xl border border-[#E2E8F0] gap-1">
                      {/* Shop Tab */}
                      <button
                        type="button"
                        onClick={() => setActiveTab('shop')}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          activeTab === 'shop'
                            ? 'bg-[#6842DB] text-white shadow-2xs font-bold'
                            : 'text-[#64748B] hover:text-[#172554] hover:bg-white/60'
                        }`}
                      >
                        <Store className="w-3.5 h-3.5" />
                        <span>Shop</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            activeTab === 'shop'
                              ? 'bg-white/20 text-white'
                              : 'bg-[#E2E8F0] text-[#475569]'
                          }`}
                        >
                          {shopItems.length}
                        </span>
                      </button>

                      {/* Godown Tab */}
                      <button
                        type="button"
                        onClick={() => setActiveTab('godown')}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          activeTab === 'godown'
                            ? 'bg-[#6842DB] text-white shadow-2xs font-bold'
                            : 'text-[#64748B] hover:text-[#172554] hover:bg-white/60'
                        }`}
                      >
                        <Warehouse className="w-3.5 h-3.5" />
                        <span>Godown</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            activeTab === 'godown'
                              ? 'bg-white/20 text-white'
                              : 'bg-[#E2E8F0] text-[#475569]'
                          }`}
                        >
                          {godownItems.length}
                        </span>
                      </button>

                      {/* Pending Tab */}
                      <button
                        type="button"
                        onClick={() => setActiveTab('pending')}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          activeTab === 'pending'
                            ? 'bg-[#6842DB] text-white shadow-2xs font-bold'
                            : 'text-[#64748B] hover:text-[#172554] hover:bg-white/60'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Pending</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            activeTab === 'pending'
                              ? 'bg-white/20 text-white'
                              : 'bg-[#E2E8F0] text-[#475569]'
                          }`}
                        >
                          {pendingItems.length}
                        </span>
                      </button>
                    </div>

                    {/* Maximize / Minimize Control */}
                    <button
                      type="button"
                      onClick={() => setIsMaximized(!isMaximized)}
                      title={isMaximized ? 'Restore two-panel layout' : 'Maximize results table'}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E2E8F0] hover:border-[#6842DB] hover:bg-[#F8FAFC] text-[#172554] text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                    >
                      {isMaximized ? (
                        <>
                          <Minimize2 className="w-3.5 h-3.5 text-[#6842DB]" />
                          <span>Minimize</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 className="w-3.5 h-3.5 text-[#6842DB]" />
                          <span>Maximize</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Context Sub-Banner for Active Allocation */}
                  <div className="py-2.5 flex items-center justify-between text-xs shrink-0">
                    <div className="flex items-center gap-2">
                      {activeTab === 'shop' && (
                        <>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E3F7EF] text-[#087B57] font-bold border border-[#C5EDE0]">
                            <Check className="w-3 h-3 stroke-[3]" />
                            Shop Allocation
                          </span>
                          <span className="text-[#64748B]">
                            Items allocated to front shop inventory for immediate customer billing.
                          </span>
                        </>
                      )}
                      {activeTab === 'godown' && (
                        <>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EBF3FF] text-[#0369A1] font-bold border border-[#BAE6FD]">
                            <Warehouse className="w-3 h-3" />
                            Godown Allocation
                          </span>
                          <span className="text-[#64748B]">
                            Bulk quantities (over 25 units) routed to secondary warehouse storage.
                          </span>
                        </>
                      )}
                      {activeTab === 'pending' && (
                        <>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFF4E5] text-[#D97706] font-bold border border-[#FED7AA]">
                            <Clock className="w-3 h-3" />
                            Pending Allocation
                          </span>
                          <span className="text-[#64748B]">
                            Items awaiting verification. Use &quot;Mark as Received&quot; to transfer to Shop.
                          </span>
                        </>
                      )}
                    </div>
                    <div className="hidden sm:flex items-center text-[11px] text-[#64748B] italic">
                      Click any cell to edit directly like an Excel sheet
                    </div>
                  </div>

                  {/* DIRECT INLINE EDITABLE EXCEL SPREADSHEET TABLE */}
                  <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto relative rounded-xl border border-[#E2E8F0] shadow-2xs">
                    <table className="w-full text-left border-collapse text-xs select-none">
                      <thead className="sticky top-0 z-10 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                        <tr className="text-[#475569] font-bold uppercase text-[11px] tracking-wider">
                          {!hasSnoColumn && (
                            <th className="py-3 px-3.5 whitespace-nowrap bg-[#F8FAFC]">
                              S.No
                            </th>
                          )}
                          {dynamicColumns.map((col, idx) => (
                            <th
                              key={`th-${col}-${idx}`}
                              className="py-3 px-3.5 whitespace-nowrap bg-[#F8FAFC]"
                            >
                              {col}
                            </th>
                          ))}
                          {!hasQtyColumn && (
                            <th className="py-3 px-3.5 whitespace-nowrap bg-[#F8FAFC]">
                              Order Qty
                            </th>
                          )}
                          {!hasUnitColumn && (
                            <th className="py-3 px-3.5 whitespace-nowrap bg-[#F8FAFC]">
                              Unit
                            </th>
                          )}
                          <th className="py-3 px-3.5 whitespace-nowrap text-center bg-[#F8FAFC]">
                            ACTION
                          </th>
                          <th className="py-3 px-3.5 text-center bg-[#F8FAFC] w-10">
                            <input
                              type="checkbox"
                              checked={
                                paginatedItems.length > 0 &&
                                selectedRowIds.size === paginatedItems.length
                              }
                              onChange={handleToggleSelectAll}
                              className="rounded border-[#CBD5E1] text-[#6842DB] focus:ring-[#6842DB] cursor-pointer"
                            />
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9] font-sans">
                        {paginatedItems.length === 0 ? (
                          <tr>
                            <td
                              colSpan={dynamicColumns.length + 3}
                              className="py-16 text-center text-[#64748B] text-xs font-medium"
                            >
                              <div className="max-w-xs mx-auto space-y-2">
                                <Package className="w-8 h-8 mx-auto opacity-40 text-[#6842DB]" />
                                <div className="font-bold text-sm text-[#172554]">
                                  No items in {activeTab} allocation
                                </div>
                                <p className="text-[11.5px] text-[#64748B]">
                                  Items allocated to other tabs can be moved here using the Action dropdown.
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          paginatedItems.map((item, rowIdx) => {
                            const globalRowIndex = (currentPage - 1) * pageSize + rowIdx + 1;

                            return (
                              <tr
                                key={item.id}
                                className="hover:bg-[#F8FAFC]/90 transition-colors group text-[#172554]"
                              >
                                {/* S.No column (Non-editable sequence number) */}
                                {!hasSnoColumn && (
                                  <td className="py-3.5 px-3.5 whitespace-nowrap font-medium text-[#64748B]">
                                    {globalRowIndex}
                                  </td>
                                )}

                                {/* Dynamic Columns: EVERY field is directly clickable and editable! */}
                                {dynamicColumns.map((col, cIdx) => {
                                  // S.No in columns (Non-editable)
                                  if (/^(s\.?\s*no\.?|sno|sl\.?\s*no\.?)$/i.test(col)) {
                                    return (
                                      <td
                                        key={`cell-${item.id}-${col}-${cIdx}`}
                                        className="py-3.5 px-3.5 whitespace-nowrap font-medium text-[#64748B]"
                                      >
                                        {globalRowIndex}
                                      </td>
                                    );
                                  }

                                  const isCellActive =
                                    activeCell?.rowId === item.id && activeCell?.columnKey === col;

                                  // Quantity in dynamic columns
                                  if (/^(qty|quantity|allocated\s*qty|order\s*qty)$/i.test(col)) {
                                    const rawVal = item.allocationQuantity;
                                    return (
                                      <td
                                        key={`cell-${item.id}-${col}-${cIdx}`}
                                        onClick={() => !isCellActive && handleStartCellEdit(item.id, col, rawVal)}
                                        className="py-3.5 px-3.5 whitespace-nowrap font-bold text-[#172554] cursor-text"
                                      >
                                        {isCellActive ? (
                                          <input
                                            data-cell-input="true"
                                            type="text"
                                            value={activeCellValue}
                                            onChange={(e) => setActiveCellValue(e.target.value)}
                                            onKeyDown={(e) => handleCellKeyDown(e, item.id, col)}
                                            onBlur={handleCommitCellEdit}
                                            autoFocus
                                            className="w-20 px-2 py-1 text-xs font-bold rounded border border-[#6842DB] ring-1 ring-[#6842DB] bg-white text-[#172554] focus:outline-hidden shadow-2xs"
                                          />
                                        ) : (
                                          <div className="hover:bg-slate-100/70 rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 transition-colors">
                                            {rawVal}
                                          </div>
                                        )}
                                      </td>
                                    );
                                  }

                                  // Unit in dynamic columns (Searchable dropdown + custom typing)
                                  if (/^(unit|uom)$/i.test(col)) {
                                    return renderUnitCell(item, col, rowIdx, cIdx);
                                  }

                                  // ITEM NAME Column: Directly editable input + Search suggestions dropdown
                                  if (col === nameColumn) {
                                    const currentDisplayName = item.selectedMasterRow
                                      ? item.selectedMasterRow[col] ||
                                        item.selectedMasterRow['ITEM NAME'] ||
                                        item.requestedName
                                      : item.requestedName;

                                    return (
                                      <td
                                        key={`cell-${item.id}-${col}-${cIdx}`}
                                        className="py-3.5 px-3.5 whitespace-nowrap text-[#172554] relative cursor-text min-w-[200px]"
                                      >
                                        {isCellActive ? (
                                          <div className="relative">
                                            <input
                                              data-cell-input="true"
                                              type="text"
                                              value={activeCellValue}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                setActiveCellValue(val);
                                                const matches = getProductSuggestions(val);
                                                setEditingSuggestions(matches);
                                                setSelectedSuggestionIndex(-1);
                                              }}
                                              onKeyDown={(e) => handleCellKeyDown(e, item.id, col)}
                                              onBlur={() => {
                                                // Brief delay so clicking a suggestion popover works before blur commits
                                                setTimeout(() => {
                                                  handleCommitCellEdit();
                                                }, 180);
                                              }}
                                              autoFocus
                                              placeholder="Type or search product..."
                                              className="w-full px-2.5 py-1 text-xs font-semibold rounded border border-[#6842DB] ring-1 ring-[#6842DB] bg-white text-[#172554] focus:outline-hidden shadow-2xs"
                                            />

                                            {/* Attached Search Suggestions Popover */}
                                            {editingSuggestions.length > 0 && (
                                              <div
                                                data-popover="item-suggestions"
                                                className="absolute left-0 top-full mt-1.5 w-84 bg-white rounded-xl shadow-xl border border-[#EAEEF5] p-1.5 z-50 max-h-64 overflow-y-auto"
                                              >
                                                <div className="text-[10px] font-bold text-[#64748B] px-2.5 py-1 uppercase tracking-wider flex items-center justify-between">
                                                  <span>Product Master Matches</span>
                                                  <span>{editingSuggestions.length} found</span>
                                                </div>
                                                {editingSuggestions.map((sug, sIdx) => {
                                                  const sugName =
                                                    sug[nameColumn] || sug['ITEM NAME'] || sug['Product Name'] || sug['Description'] || '';
                                                  const sugBrand =
                                                    (detectedBrandCol && sug[detectedBrandCol]) || sug['BRAND'] || sug['Brand'];
                                                  const sugPack =
                                                    (detectedPackCol && sug[detectedPackCol]) || sug['PACK SIZE'] || sug['SIZE'] || sug['UOM'];
                                                  const sugHsn =
                                                    (detectedHsnCol && sug[detectedHsnCol]) || sug['HSN CODE'] || sug['HSN'];
                                                  const sugRate =
                                                    (detectedRateCol && sug[detectedRateCol]) || sug['RATE'] || sug['Rate'] || sug['PRICE'];
                                                  const isSelected = selectedSuggestionIndex === sIdx;

                                                  return (
                                                    <button
                                                      key={`sug-${sIdx}`}
                                                      type="button"
                                                      onMouseDown={(e) => {
                                                        e.preventDefault(); // Prevents input blur before select
                                                        handleSelectSuggestion(item.id, sug);
                                                      }}
                                                      className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors cursor-pointer group/sug ${
                                                        isSelected
                                                          ? 'bg-[#F1EDFF] text-[#6842DB]'
                                                          : 'hover:bg-[#F8FAFC] text-[#172554]'
                                                      }`}
                                                    >
                                                      <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-bold truncate">
                                                          {sugName}
                                                        </span>
                                                        {sugRate && (
                                                          <span className="text-[11px] font-semibold text-[#087B57] shrink-0">
                                                            ₹{sugRate}
                                                          </span>
                                                        )}
                                                      </div>
                                                      <div className="flex items-center gap-2 text-[10.5px] text-[#64748B] mt-0.5 flex-wrap">
                                                        {sugBrand && (
                                                          <span className="font-medium text-[#1E40AF] bg-blue-50 px-1 rounded">
                                                            {sugBrand}
                                                          </span>
                                                        )}
                                                        {sugPack && <span>{sugPack}</span>}
                                                        {sugHsn && (
                                                          <span className="font-mono text-slate-500">
                                                            HSN: {sugHsn}
                                                          </span>
                                                        )}
                                                      </div>
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <div
                                            onClick={() => handleStartCellEdit(item.id, col, currentDisplayName)}
                                            className="font-bold hover:bg-slate-100/70 rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 transition-colors truncate max-w-[240px]"
                                            title="Click to edit or search product"
                                          >
                                            {currentDisplayName}
                                          </div>
                                        )}
                                      </td>
                                    );
                                  }

                                  // ANY OTHER SPREADSHEET CELL: CODE, HSN CODE, ALIAS, PRINT NAME, RATE, BRAND, etc.
                                  // Directly editable on click!
                                  const cellVal = item.selectedMasterRow
                                    ? item.selectedMasterRow[col] ?? ''
                                    : '';

                                  return (
                                    <td
                                      key={`cell-${item.id}-${col}-${cIdx}`}
                                      onClick={() => !isCellActive && handleStartCellEdit(item.id, col, cellVal)}
                                      className="py-3.5 px-3.5 whitespace-nowrap text-[#172554] cursor-text min-w-[90px]"
                                    >
                                      {isCellActive ? (
                                        <input
                                          data-cell-input="true"
                                          type="text"
                                          value={activeCellValue}
                                          onChange={(e) => setActiveCellValue(e.target.value)}
                                          onKeyDown={(e) => handleCellKeyDown(e, item.id, col)}
                                          onBlur={handleCommitCellEdit}
                                          autoFocus
                                          className="w-full px-2 py-1 text-xs font-medium rounded border border-[#6842DB] ring-1 ring-[#6842DB] bg-white text-[#172554] focus:outline-hidden shadow-2xs"
                                        />
                                      ) : (
                                        <div className="hover:bg-slate-100/70 rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 transition-colors">
                                          {cellVal !== '' ? String(cellVal) : '-'}
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}

                                {/* Order Qty fallback if not in dynamic columns (Editable on click) */}
                                {!hasQtyColumn && (
                                  <td
                                    onClick={() =>
                                      activeCell?.rowId !== item.id || activeCell?.columnKey !== '__qty__'
                                        ? handleStartCellEdit(item.id, '__qty__', item.allocationQuantity)
                                        : null
                                    }
                                    className="py-3.5 px-3.5 whitespace-nowrap font-bold text-[#172554] cursor-text"
                                  >
                                    {activeCell?.rowId === item.id && activeCell?.columnKey === '__qty__' ? (
                                      <input
                                        data-cell-input="true"
                                        type="text"
                                        value={activeCellValue}
                                        onChange={(e) => setActiveCellValue(e.target.value)}
                                        onKeyDown={(e) => handleCellKeyDown(e, item.id, '__qty__')}
                                        onBlur={handleCommitCellEdit}
                                        autoFocus
                                        className="w-20 px-2 py-1 text-xs font-bold rounded border border-[#6842DB] ring-1 ring-[#6842DB] bg-white text-[#172554] focus:outline-hidden shadow-2xs"
                                      />
                                    ) : (
                                      <div className="hover:bg-slate-100/70 rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 transition-colors">
                                        {item.allocationQuantity}
                                      </div>
                                    )}
                                  </td>
                                )}

                                {/* Unit fallback if not in dynamic columns (Searchable dropdown + custom typing) */}
                                {!hasUnitColumn && renderUnitCell(item, '__unit__', rowIdx)}

                                {/* Allocation Action Dropdown (Shop ▾, Godown ▾, Pending ▾) */}
                                <td className="py-3.5 px-3.5 whitespace-nowrap text-center relative">
                                  <div className="relative inline-block text-left" data-dropdown="row-action">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setActiveRowMenuId(
                                          activeRowMenuId === item.id ? null : item.id
                                        )
                                      }
                                      className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] hover:border-[#6842DB] bg-white text-[#172554] text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                                    >
                                      <span>
                                        {item.allocation.charAt(0).toUpperCase() +
                                          item.allocation.slice(1)}
                                      </span>
                                      <ChevronDown className="w-3 h-3 text-[#64748B]" />
                                    </button>

                                    {activeRowMenuId === item.id && (
                                      <div
                                        className={`absolute right-0 ${
                                          rowIdx >= paginatedItems.length - 2 && paginatedItems.length > 3
                                            ? 'bottom-full mb-1'
                                            : 'top-full mt-1'
                                        } w-44 bg-white rounded-xl shadow-xl border border-[#EAEEF5] py-1 z-50 animate-in fade-in zoom-in-95 duration-100 text-left`}
                                      >
                                        <div className="px-3 py-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                                          Change Allocation
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleReallocate(item.id, 'shop')}
                                          className={`w-full px-3 py-2 text-xs flex items-center justify-between hover:bg-[#F1EDFF] transition-colors cursor-pointer ${
                                            item.allocation === 'shop'
                                              ? 'text-[#6842DB] font-bold bg-[#F1EDFF]/60'
                                              : 'text-[#172554]'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2">
                                            <Store className="w-3.5 h-3.5 text-[#6842DB]" />
                                            <span>Shop</span>
                                          </div>
                                          {item.allocation === 'shop' && (
                                            <Check className="w-3.5 h-3.5 text-[#6842DB] stroke-[2.5]" />
                                          )}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleReallocate(item.id, 'godown')}
                                          className={`w-full px-3 py-2 text-xs flex items-center justify-between hover:bg-[#F1EDFF] transition-colors cursor-pointer ${
                                            item.allocation === 'godown'
                                              ? 'text-[#6842DB] font-bold bg-[#F1EDFF]/60'
                                              : 'text-[#172554]'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2">
                                            <Warehouse className="w-3.5 h-3.5 text-[#6842DB]" />
                                            <span>Godown</span>
                                          </div>
                                          {item.allocation === 'godown' && (
                                            <Check className="w-3.5 h-3.5 text-[#6842DB] stroke-[2.5]" />
                                          )}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleReallocate(item.id, 'pending')}
                                          className={`w-full px-3 py-2 text-xs flex items-center justify-between hover:bg-[#F1EDFF] transition-colors cursor-pointer ${
                                            item.allocation === 'pending'
                                              ? 'text-[#6842DB] font-bold bg-[#F1EDFF]/60'
                                              : 'text-[#172554]'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5 text-[#6842DB]" />
                                            <span>Pending</span>
                                          </div>
                                          {item.allocation === 'pending' && (
                                            <Check className="w-3.5 h-3.5 text-[#6842DB] stroke-[2.5]" />
                                          )}
                                        </button>

                                        {item.allocation === 'pending' && (
                                          <div className="border-t border-[#F0F2F6] mt-1 pt-1">
                                            <button
                                              type="button"
                                              onClick={() => handleMarkAsReceived(item.id)}
                                              className="w-full px-3 py-2 text-xs flex items-center gap-2 text-[#087B57] font-bold hover:bg-[#E3F7EF] transition-colors cursor-pointer"
                                            >
                                              <Check className="w-3.5 h-3.5" />
                                              <span>Mark as Received</span>
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </td>

                                {/* Checkbox Column */}
                                <td className="py-3.5 px-3.5 whitespace-nowrap text-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedRowIds.has(item.id)}
                                    onChange={() => handleToggleRowSelection(item.id)}
                                    className="rounded border-[#CBD5E1] text-[#6842DB] focus:ring-[#6842DB] cursor-pointer"
                                  />
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer with Pagination Controls */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#F0F2F6] shrink-0 text-xs text-[#64748B]">
                    <div>
                      Showing {activeTabItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
                      {Math.min(currentPage * pageSize, activeTabItems.length)} of {activeTabItems.length} items
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-30 cursor-pointer text-[#172554] transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                        const pageNum = idx + 1;
                        return (
                          <button
                            key={`page-${pageNum}`}
                            type="button"
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              currentPage === pageNum
                                ? 'bg-[#6842DB] text-white shadow-2xs'
                                : 'hover:bg-slate-100 text-[#172554]'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-30 cursor-pointer text-[#172554] transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Action Section (Aligned, Consistent Heights) */}
            <div className="bg-white rounded-2xl border border-[#EAEEF5] shadow-[0_2px_10px_rgba(17,28,53,0.03)] p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Left Side: Reallocation Guidance */}
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#F1EDFF] border border-[#DDD6FE] text-[#6842DB] flex items-center justify-center shrink-0">
                  <Lightbulb className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#172554]">
                    Need to reallocate items?
                  </h4>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Use the allocation dropdown in any row to route items between Shop, Godown, or Pending.
                  </p>
                </div>
              </div>

              {/* Right Side: Three Aligned Main Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
                {/* 1. Add Another Item (Secondary Action) */}
                <button
                  type="button"
                  onClick={() => setIsAddItemModalOpen(true)}
                  className="h-10 px-4 rounded-xl border border-[#CBD5E1] hover:border-[#6842DB] hover:bg-[#F8FAFC] text-[#172554] font-semibold text-xs sm:text-sm inline-flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
                >
                  <Plus className="w-4 h-4 text-[#6842DB]" />
                  <span>Add Another Item</span>
                </button>

                {/* 2. Download ▾ (Primary Solid Purple Action) */}
                <div className="relative" data-dropdown="download">
                  <button
                    type="button"
                    onClick={() => setIsDownloadOpen(!isDownloadOpen)}
                    className="h-10 px-5 rounded-xl bg-[#6842DB] hover:bg-[#5835C4] text-white font-bold text-xs sm:text-sm inline-flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                    <ChevronDown className="w-4 h-4 text-white/80" />
                  </button>

                  {isDownloadOpen && (
                    <div className="absolute right-0 bottom-full mb-2 w-56 bg-white rounded-xl shadow-xl border border-[#EAEEF5] py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3.5 py-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                        Export {activeTab.toUpperCase()} Items
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadPDF}
                        className="w-full px-3.5 py-2.5 text-xs font-semibold text-[#172554] hover:bg-[#F1EDFF] flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <FileText className="w-4 h-4 text-red-500" />
                        <span>PDF Document (.pdf)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadExcel}
                        className="w-full px-3.5 py-2.5 text-xs font-semibold text-[#172554] hover:bg-[#F1EDFF] flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        <span>Excel Spreadsheet (.xlsx)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadCSV}
                        className="w-full px-3.5 py-2.5 text-xs font-semibold text-[#172554] hover:bg-[#F1EDFF] flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <FileCode className="w-4 h-4 text-teal-600" />
                        <span>CSV File (.csv)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadTXT}
                        className="w-full px-3.5 py-2.5 text-xs font-semibold text-[#172554] hover:bg-[#F1EDFF] flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span>Plain Text File (.txt)</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. Copy All Items (Secondary Action) */}
                <button
                  type="button"
                  onClick={handleCopyAllItems}
                  className="h-10 px-4 rounded-xl border border-[#CBD5E1] hover:border-[#6842DB] hover:bg-[#F8FAFC] text-[#172554] font-semibold text-xs sm:text-sm inline-flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
                >
                  <Copy className="w-4 h-4 text-[#6842DB]" />
                  <span>Copy All Items</span>
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Add Another Item Modal */}
      {isAddItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-[#EAEEF5] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0F2F6]">
              <div className="flex items-center gap-2 text-[#172554]">
                <Plus className="w-5 h-5 text-[#6842DB]" />
                <h3 className="text-base font-bold font-heading">Add Another Item to Order</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddItemModalOpen(false)}
                className="text-[#64748B] hover:text-[#172554] p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddItemSubmit} className="space-y-4 text-xs">
              {/* Product Master Live Search */}
              <div>
                <label className="block font-bold text-[#172554] mb-1">
                  Search Product Master Catalogue
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={addSearchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAddSearchQuery(val);
                      setAddName(val);
                    }}
                    placeholder="Type to search (e.g. Good Day, Refined Oil, Toor Dal)..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#CBD5E1] text-xs font-medium text-[#172554] focus:outline-hidden focus:border-[#6842DB] focus:ring-1 focus:ring-[#6842DB]"
                  />
                </div>

                {/* Quick Results Picker */}
                {addSearchQuery.trim() && (
                  <div className="mt-1.5 max-h-40 overflow-y-auto border border-[#E2E8F0] rounded-xl p-1 bg-[#F8FAFC]">
                    {getProductSuggestions(addSearchQuery).map((sug, sIdx) => (
                      <button
                        key={`add-sug-${sIdx}`}
                        type="button"
                        onClick={() => {
                          const sugName = sug[nameColumn] || sug['ITEM NAME'];
                          setAddSelectedMasterRow(sug);
                          setAddName(sugName);
                          setAddSearchQuery(sugName);
                          if (sug['UNIT']) setAddUnit(String(sug['UNIT']).toLowerCase());
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white text-xs transition-colors cursor-pointer flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-[#172554]">
                            {sug[nameColumn] || sug['ITEM NAME'] || sug['Product Name']}
                          </div>
                          <div className="text-[10px] text-[#64748B]">
                            {((detectedBrandCol && sug[detectedBrandCol]) || sug['BRAND']) && (
                              <span className="text-[#1E40AF]">
                                {(detectedBrandCol && sug[detectedBrandCol]) || sug['BRAND']} ·{' '}
                              </span>
                            )}
                            {((detectedHsnCol && sug[detectedHsnCol]) || sug['HSN CODE']) && (
                              <span>HSN: {(detectedHsnCol && sug[detectedHsnCol]) || sug['HSN CODE']}</span>
                            )}
                          </div>
                        </div>
                        {((detectedRateCol && sug[detectedRateCol]) || sug['RATE']) && (
                          <span className="text-[11px] font-semibold text-[#087B57]">
                            ₹{(detectedRateCol && sug[detectedRateCol]) || sug['RATE']}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Product Name Confirmation */}
              <div>
                <label className="block font-bold text-[#172554] mb-1">
                  Product / Item Name *
                </label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Good Day Butter 100g"
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] text-xs font-medium text-[#172554] focus:outline-hidden focus:border-[#6842DB] focus:ring-1 focus:ring-[#6842DB]"
                />
              </div>

              {/* Quantity and Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#172554] mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                    placeholder="1"
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] text-xs font-medium text-[#172554] focus:outline-hidden focus:border-[#6842DB] focus:ring-1 focus:ring-[#6842DB]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#172554] mb-1">
                    Unit
                  </label>
                  <select
                    value={addUnit}
                    onChange={(e) => setAddUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] text-xs font-medium text-[#172554] bg-white focus:outline-hidden focus:border-[#6842DB] focus:ring-1 focus:ring-[#6842DB]"
                  >
                    {COMMON_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Initial Allocation */}
              <div>
                <label className="block font-bold text-[#172554] mb-1">
                  Initial Allocation
                </label>
                <select
                  value={addAllocationTarget}
                  onChange={(e) => setAddAllocationTarget(e.target.value as AllocationTarget)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] text-xs font-medium text-[#172554] bg-white focus:outline-hidden focus:border-[#6842DB] focus:ring-1 focus:ring-[#6842DB]"
                >
                  <option value="shop">Shop (Immediate customer order)</option>
                  <option value="godown">Godown (Warehouse storage)</option>
                  <option value="pending">Pending (Awaiting arrival)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F0F2F6]">
                <button
                  type="button"
                  onClick={() => setIsAddItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#CBD5E1] text-[#64748B] hover:text-[#172554] font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#6842DB] hover:bg-[#5835C4] text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 4. Portal-Based Expandable Unit Dropdown Menu (Immune to Table Overflow Clipping) */}
      {activeUnitDropdown &&
        createPortal(
          <div
            ref={unitDropdownRef}
            data-popover="unit-portal"
            style={{
              position: 'fixed',
              top: `${activeUnitDropdown.coords.top}px`,
              left: `${activeUnitDropdown.coords.left}px`,
              zIndex: 9999,
              width: 'min(330px, calc(100vw - 24px))',
            }}
            className="bg-white rounded-2xl shadow-[0_16px_48px_rgba(17,28,53,0.22)] border border-[#EAEEF5] p-3 animate-in fade-in zoom-in-95 duration-150 text-[#172554] flex flex-col max-h-[380px]"
          >
            {/* Header with Title and Close Button */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F1F5F9] shrink-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#172554]">
                <Package className="w-3.5 h-3.5 text-[#6842DB]" />
                <span>Select or Search Unit</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveUnitDropdown(null)}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Live Search Input */}
            <div className="relative mb-2.5 shrink-0">
              <Search className="w-3.5 h-3.5 text-[#6842DB] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={unitSearchInputRef}
                type="text"
                value={activeUnitDropdown.searchQuery}
                onChange={(e) =>
                  setActiveUnitDropdown((prev) =>
                    prev ? { ...prev, searchQuery: e.target.value } : null
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const query = activeUnitDropdown.searchQuery.trim().toUpperCase();
                    handleSelectUnit(
                      activeUnitDropdown.itemId,
                      activeUnitDropdown.columnKey,
                      query
                    );
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setActiveUnitDropdown(null);
                  }
                }}
                autoFocus
                placeholder="Search unit or type custom (e.g. KG, BOX, SACK)..."
                className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-[#CBD5E1] text-xs font-semibold text-[#172554] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#6842DB] focus:ring-1 focus:ring-[#6842DB] bg-[#F8FAFC]"
              />
              {activeUnitDropdown.searchQuery && (
                <button
                  type="button"
                  onClick={() =>
                    setActiveUnitDropdown((prev) =>
                      prev ? { ...prev, searchQuery: '' } : null
                    )
                  }
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Custom Unit Option when query is typed and not an exact match */}
            {(() => {
              const query = activeUnitDropdown.searchQuery.trim().toUpperCase();
              const isExact = ALL_WHOLESALE_UNITS.includes(query);
              if (!query || isExact) return null;

              return (
                <button
                  type="button"
                  onClick={() =>
                    handleSelectUnit(
                      activeUnitDropdown.itemId,
                      activeUnitDropdown.columnKey,
                      query
                    )
                  }
                  className="w-full text-left px-3 py-2 rounded-xl bg-[#F1EDFF] hover:bg-[#E5DEFD] text-[#6842DB] font-bold text-xs flex items-center justify-between transition-colors mb-2.5 shrink-0 cursor-pointer border border-[#DED8FD] shadow-2xs"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Use custom unit: &quot;{query}&quot;</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-[#6842DB] font-bold border border-[#DED8FD] shrink-0">
                    Press Enter ↵
                  </span>
                </button>
              );
            })()}

            {/* Scrollable Categories List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {(() => {
                const query = activeUnitDropdown.searchQuery.trim().toUpperCase();
                const filteredCats = WHOLESALE_UNIT_CATEGORIES.map((cat) => ({
                  category: cat.category,
                  units: query ? cat.units.filter((u) => u.includes(query)) : cat.units,
                })).filter((cat) => cat.units.length > 0);

                if (filteredCats.length === 0) {
                  return (
                    <div className="py-6 text-center text-xs text-[#64748B]">
                      <p>No predefined units matching &quot;{query}&quot;</p>
                      <button
                        type="button"
                        onClick={() =>
                          handleSelectUnit(
                            activeUnitDropdown.itemId,
                            activeUnitDropdown.columnKey,
                            query
                          )
                        }
                        className="mt-2 px-3 py-1.5 rounded-lg bg-[#6842DB] text-white font-bold text-xs hover:bg-[#5835C4] transition-colors cursor-pointer"
                      >
                        Save &quot;{query}&quot; as Custom Unit
                      </button>
                    </div>
                  );
                }

                return filteredCats.map((cat) => (
                  <div key={cat.category} className="space-y-1.5">
                    <div className="text-[10.5px] font-bold text-[#64748B] uppercase tracking-wider px-1">
                      {cat.category}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {cat.units.map((u) => {
                        const isSelected =
                          (activeUnitDropdown.currentUnit || '').toUpperCase() === u;
                        return (
                          <button
                            key={u}
                            type="button"
                            onClick={() =>
                              handleSelectUnit(
                                activeUnitDropdown.itemId,
                                activeUnitDropdown.columnKey,
                                u
                              )
                            }
                            className={`px-2 py-1.5 rounded-lg text-xs font-bold text-center transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'bg-[#6842DB] text-white shadow-xs'
                                : 'bg-[#F8FAFC] hover:bg-[#F1EDFF] text-[#172554] hover:text-[#6842DB] border border-[#E2E8F0]'
                            }`}
                          >
                            <span className="truncate">{u}</span>
                            {isSelected && (
                              <Check className="w-3 h-3 text-white stroke-[3] shrink-0 ml-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* Clear Unit Quick Action Footer */}
            <div className="pt-2 mt-2 border-t border-[#F1F5F9] flex items-center justify-between text-[11px] text-[#64748B] shrink-0">
              <button
                type="button"
                onClick={() =>
                  handleSelectUnit(
                    activeUnitDropdown.itemId,
                    activeUnitDropdown.columnKey,
                    ''
                  )
                }
                className="text-red-500 hover:text-red-700 font-medium hover:underline cursor-pointer"
              >
                Clear Unit
              </button>
              <span>Esc to cancel</span>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default ResultsPage;
