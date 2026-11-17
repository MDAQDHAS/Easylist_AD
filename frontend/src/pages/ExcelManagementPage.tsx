import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet,
  UploadCloud,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Trash2,
  X,
  Package,
  Columns as ColumnsIcon,
  ShieldCheck,
  Eye,
  Check,
  Plus,
  MoreVertical,
  Edit,
  RotateCcw,
  CheckSquare,
  Square,
  AlertTriangle,
} from 'lucide-react';
import { DashboardHeader } from '../components/layout/DashboardHeader';
import { AppSidebar } from '../components/layout/AppSidebar';
import { ProductMasterUploadModal } from '../features/upload/ProductMasterUploadModal';
import { productMasterService } from '../services/productMasterService';
import { ProductMasterFile } from '../types/productMaster';
import { ROUTES } from '../routes/paths';
import { StoreInfo } from '../types/order';

interface ExcelManagementPageProps {
  currentStore?: StoreInfo;
}

// Sidebar Icons matching Dashboard and Accounts
const SidebarDashboardIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const SidebarAccountsIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <line x1="8" y1="6" x2="16" y2="6" />
    <line x1="8" y1="10" x2="16" y2="10" />
    <line x1="8" y1="14" x2="12" y2="14" />
    <line x1="8" y1="18" x2="16" y2="18" />
  </svg>
);

const SidebarExcelIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const SidebarSettingsIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const ExcelManagementPage: React.FC<ExcelManagementPageProps> = ({ currentStore }) => {
  const navigate = useNavigate();

  // State
  const [productMaster, setProductMaster] = useState<ProductMasterFile | null>(() =>
    productMasterService.getProductMaster()
  );
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isViewColumnsModalOpen, setIsViewColumnsModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [activeItemForDetails, setActiveItemForDetails] = useState<Record<string, any> | null>(null);
  const [activeItemForEdit, setActiveItemForEdit] = useState<Record<string, any> | null>(null);
  const [activeItemForDelete, setActiveItemForDelete] = useState<Record<string, any> | null>(null);
  const [activeMenuRowId, setActiveMenuRowId] = useState<string | number | null>(null);

  // Column visibility state: set of visible column names
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    const master = productMasterService.getProductMaster();
    return new Set(master?.columns || []);
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [toastNotice, setToastNotice] = useState<string | null>(null);
  const [showConfirmDeleteMaster, setShowConfirmDeleteMaster] = useState(false);
  const [columnSearchTerm, setColumnSearchTerm] = useState('');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Form states for Add / Edit item
  const [itemFormData, setItemFormData] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const menuContainerRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg: string) => {
    setToastNotice(msg);
    setTimeout(() => {
      setToastNotice((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  // Sync visible columns when product master is uploaded/replaced
  useEffect(() => {
    if (productMaster) {
      setVisibleColumns(new Set(productMaster.columns));
    }
  }, [productMaster?.id, productMaster?.columns]);

  // Close row action menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-product-menu]')) {
        setActiveMenuRowId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Filtered rows based on search query
  const filteredRows = useMemo(() => {
    if (!productMaster || !productMaster.rows) return [];
    if (!searchQuery.trim()) return productMaster.rows;

    const q = searchQuery.toLowerCase().trim();
    return productMaster.rows.filter((row) => {
      return productMaster.columns.some((col) => {
        const val = row[col];
        if (val === undefined || val === null) return false;
        return String(val).toLowerCase().includes(q);
      });
    });
  }, [productMaster, searchQuery]);

  // Displayed columns based on visibility settings
  const displayedColumns = useMemo(() => {
    if (!productMaster) return [];
    return productMaster.columns.filter((c) => visibleColumns.has(c));
  }, [productMaster, visibleColumns]);

  // Pagination calculation
  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRows.slice(startIndex, startIndex + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Reset page when search query or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize]);

  const handleUploadSuccess = (newMaster: ProductMasterFile) => {
    setProductMaster(newMaster);
    setVisibleColumns(new Set(newMaster.columns));
    setSearchQuery('');
    setCurrentPage(1);
    showToast(`Product Master imported successfully! ${newMaster.productCount.toLocaleString()} products active.`);
  };

  const handleDownloadOriginal = () => {
    if (!productMaster) return;
    try {
      productMasterService.downloadOriginalFile(productMaster);
      showToast(`Downloading original file "${productMaster.fileName}"...`);
    } catch {
      showToast('Unable to download original file.');
    }
  };

  const handleDeleteMaster = () => {
    productMasterService.deleteProductMaster();
    setProductMaster(null);
    setShowConfirmDeleteMaster(false);
    showToast('Product Master removed from shop catalog.');
  };

  // Column Visibility Handlers
  const handleToggleColumn = (colName: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(colName)) {
        if (next.size <= 1) {
          showToast('At least one column must remain visible.');
          return prev;
        }
        next.delete(colName);
      } else {
        next.add(colName);
      }
      return next;
    });
  };

  const handleSelectAllColumns = () => {
    if (!productMaster) return;
    setVisibleColumns(new Set(productMaster.columns));
  };

  const handleResetColumns = () => {
    if (!productMaster) return;
    setVisibleColumns(new Set(productMaster.columns));
    showToast('Column visibility reset to default.');
  };

  // Add Item Handlers
  const handleOpenAddModal = () => {
    if (!productMaster) return;
    const initial: Record<string, string> = {};
    for (const c of productMaster.columns) {
      initial[c] = '';
    }
    setItemFormData(initial);
    setFormError(null);
    setIsAddItemModalOpen(true);
  };

  const handleSaveNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productMaster) return;

    // Validate: At least one field (specifically product name / first column) must be non-empty
    const firstCol = productMaster.columns[0];
    const nameCol = productMaster.columns.find((c) => /name|product|item|description/i.test(c)) || firstCol;
    const nameVal = itemFormData[nameCol]?.trim();

    if (!nameVal && !Object.values(itemFormData).some((v) => v.trim().length > 0)) {
      setFormError(`Please enter a value for ${nameCol || 'Product Name'}.`);
      return;
    }

    try {
      const updated = productMasterService.addProductItem(productMaster, itemFormData);
      setProductMaster(updated);
      setIsAddItemModalOpen(false);
      showToast(`Product "${nameVal || 'Item'}" added to catalogue successfully!`);
    } catch (err) {
      setFormError('Failed to save item. Please verify your input.');
    }
  };

  // Edit Item Handlers
  const handleOpenEditModal = (row: Record<string, any>) => {
    setActiveMenuRowId(null);
    const initial: Record<string, string> = {};
    if (productMaster) {
      for (const c of productMaster.columns) {
        initial[c] = row[c] !== undefined && row[c] !== null ? String(row[c]) : '';
      }
    }
    setItemFormData(initial);
    setActiveItemForEdit(row);
    setFormError(null);
  };

  const handleSaveEditItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productMaster || !activeItemForEdit) return;

    const rowId = activeItemForEdit._rowId || activeItemForEdit._rowIndex;
    try {
      const updated = productMasterService.updateProductItem(productMaster, rowId, itemFormData);
      setProductMaster(updated);
      setActiveItemForEdit(null);
      showToast('Product item updated successfully!');
    } catch {
      setFormError('Failed to update item.');
    }
  };

  // Delete Item Handlers
  const handleConfirmDeleteItem = () => {
    if (!productMaster || !activeItemForDelete) return;
    const rowId = activeItemForDelete._rowId || activeItemForDelete._rowIndex;
    try {
      const updated = productMasterService.deleteProductItem(productMaster, rowId);
      setProductMaster(updated);
      setActiveItemForDelete(null);
      showToast('Product item deleted from catalogue.');
    } catch {
      showToast('Unable to delete item.');
    }
  };

  const formatDateTime = (isoString?: string): string => {
    if (!isoString) return 'Not yet uploaded';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return 'Not yet uploaded';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Columns filtered for the View Columns search
  const filteredColumnsForSearch = useMemo(() => {
    if (!productMaster) return [];
    if (!columnSearchTerm.trim()) return productMaster.columns;
    const term = columnSearchTerm.toLowerCase();
    return productMaster.columns.filter((c) => c.toLowerCase().includes(term));
  }, [productMaster, columnSearchTerm]);

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col font-sans">
      {/* Toast Notification */}
      {toastNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 bg-[#172554] text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <CheckCircle2 className="w-4 h-4 text-[#0D9668]" />
          <span className="text-xs sm:text-sm font-medium">{toastNotice}</span>
        </div>
      )}

      {/* Top Floating Header Bar */}
      <div className="relative z-50">
        <DashboardHeader
          variant="dashboard"
          currentStore={currentStore}
          onLogout={() => navigate(ROUTES.LOGIN)}
          externalSettingsOpen={isSettingsModalOpen}
          onExternalSettingsClose={() => setIsSettingsModalOpen(false)}
        />
      </div>

      {/* Main Body */}
      <div className="flex-1 w-full max-w-[1348px] mx-auto px-4 xl:px-0 pt-6 sm:pt-8">
        <div className="flex flex-col lg:flex-row items-start gap-6 xl:gap-[47px]">
          {/* Left Sidebar Navigation Card */}
          <AppSidebar
            activeTab="excel"
            onOpenSettings={() => setIsSettingsModalOpen(true)}
          />

          {/* Right Main Content Column */}
          <main className="flex-1 min-w-0 w-full max-w-[1094px] space-y-6">
            {/* Section 2: Page Header */}
            <section
              aria-label="Excel Management Header"
              className="bg-white rounded-[20px] border border-[#DCE8E1] shadow-[0_4px_20px_rgba(17,28,53,0.03)] p-6 sm:p-7"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                  {/* 52px Soft Green Icon Container */}
                  <div className="w-[52px] h-[52px] rounded-2xl bg-[#E3F7EF] border border-[#C5EDE0] flex items-center justify-center text-[#0D9668] shadow-xs shrink-0">
                    <FileSpreadsheet className="w-7 h-7 stroke-[1.9]" />
                  </div>
                  <div>
                    <h1 className="text-[24px] sm:text-[28px] font-extrabold font-heading text-[#172554] tracking-tight leading-tight">
                      Excel Management
                    </h1>
                    <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 font-normal font-sans">
                      Manage your shop&apos;s product catalogue in one place.
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-3">
                  <button
                    id="btn-upload-replace-excel"
                    type="button"
                    onClick={() => setIsUploadModalOpen(true)}
                    className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-linear-to-r from-[#0D9668] to-[#087B57] hover:opacity-95 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4 stroke-[2.2]" />
                    <span>Upload Excel</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Section 3: Summary Cards (Left Icon Vertically Centered with Content) */}
            <section
              aria-label="Product Master Overview"
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              {/* Card 1: Total Products (Soft Green #E3F7EF with Left Centered Icon) */}
              <div className="bg-[#E3F7EF]/70 border border-[#C5EDE0] rounded-2xl p-5 shadow-[0_2px_12px_rgba(13,150,104,0.04)] flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/90 border border-[#C5EDE0] flex items-center justify-center text-[#0D9668] shadow-2xs shrink-0">
                  <Package className="w-6 h-6 stroke-[2]" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-[#087B57] uppercase tracking-wider block">
                    Total Products
                  </span>
                  <p className="text-2xl sm:text-[28px] font-extrabold font-heading text-[#172554] leading-tight mt-0.5">
                    {productMaster ? productMaster.productCount.toLocaleString() : '0'}
                  </p>
                  <p className="text-[11.5px] text-[#087B57] mt-0.5 font-medium truncate">
                    {productMaster ? 'Items in catalogue' : 'No catalogue uploaded'}
                  </p>
                </div>
              </div>

              {/* Card 2: Total Columns (Light Blue #EAF1FF with Left Centered Icon) */}
              <div className="bg-[#EAF1FF]/70 border border-[#CFE0FF] rounded-2xl p-5 shadow-[0_2px_12px_rgba(37,99,235,0.04)] flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/90 border border-[#CFE0FF] flex items-center justify-center text-[#2563EB] shadow-2xs shrink-0">
                  <ColumnsIcon className="w-6 h-6 stroke-[2]" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-[#1E40AF] uppercase tracking-wider block">
                    Total Columns
                  </span>
                  <p className="text-2xl sm:text-[28px] font-extrabold font-heading text-[#172554] leading-tight mt-0.5">
                    {productMaster ? productMaster.columns.length.toLocaleString() : '0'}
                  </p>
                  <p className="text-[11.5px] text-[#1E40AF] mt-0.5 font-medium truncate">
                    Preserved from spreadsheet
                  </p>
                </div>
              </div>

              {/* Card 3: Matching Status (Light Lavender #F1EDFF with Left Centered Icon) */}
              <div className="bg-[#F1EDFF]/70 border border-[#DDD6FE] rounded-2xl p-5 shadow-[0_2px_12px_rgba(124,58,237,0.04)] flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/90 border border-[#DDD6FE] flex items-center justify-center text-[#7C3AED] shadow-2xs shrink-0">
                  <ShieldCheck className="w-6 h-6 stroke-[2]" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-[#6D28D9] uppercase tracking-wider block">
                    Matching Status
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        productMaster ? 'bg-[#0D9668]' : 'bg-amber-400'
                      }`}
                    />
                    <p className="text-xl sm:text-[22px] font-extrabold font-heading text-[#172554] leading-tight truncate">
                      {productMaster ? 'Active & Ready' : 'Awaiting File'}
                    </p>
                  </div>
                  <p className="text-[11.5px] text-[#6D28D9] mt-0.5 font-medium truncate">
                    {productMaster ? 'Auto-matches order items' : 'Upload to enable'}
                  </p>
                </div>
              </div>
            </section>

            {/* Section 4: Product Master File Card (When Master Uploaded) */}
            {productMaster && (
              <section
                aria-label="Active Product Master File"
                className="bg-linear-to-r from-[#F4FAF7] via-white to-[#F7FCF9] rounded-2xl border border-[#D0E7DC] p-5 sm:p-6 shadow-[0_2px_14px_rgba(13,150,104,0.04)]"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                  {/* Left: Larger Excel icon & File Metadata */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-14 h-14 rounded-2xl bg-[#E3F7EF] border border-[#BCE8D8] text-[#0D9668] flex items-center justify-center shadow-xs shrink-0">
                      <FileSpreadsheet className="w-7 h-7 stroke-[2]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-base sm:text-[17px] font-bold text-[#172554] truncate">
                          {productMaster.fileName}
                        </h3>
                        {/* Green Active Badge */}
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E3F7EF] text-[#087B57] text-[11px] font-bold border border-[#C5EDE0]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0D9668] animate-pulse" />
                          <span>Active</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-white border border-[#DCE8E1] text-[#64748B] text-[11px] font-semibold uppercase">
                          {productMaster.fileName.endsWith('.csv') ? 'CSV File' : 'XLSX Spreadsheet'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-[#64748B] mt-1.5 flex-wrap font-sans">
                        <span className="font-medium text-[#172554]">{formatFileSize(productMaster.fileSize)}</span>
                        <span>•</span>
                        <span>{productMaster.productCount.toLocaleString()} products</span>
                        <span>•</span>
                        <span>{productMaster.columns.length} columns</span>
                        <span>•</span>
                        <span>Uploaded on {formatDateTime(productMaster.uploadedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions (Replace, Download Original, Delete) */}
                  <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                    <button
                      id="btn-download-original-excel"
                      type="button"
                      onClick={handleDownloadOriginal}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0D9668] hover:bg-[#087B57] text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
                      title="Download the exact original spreadsheet without altering any cell data"
                    >
                      <Download className="w-3.5 h-3.5 stroke-[2.2]" />
                      <span>Download Original</span>
                    </button>

                    <button
                      id="btn-replace-excel-file"
                      type="button"
                      onClick={() => setIsUploadModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#DCE8E1] hover:border-[#0D9668] hover:bg-[#F2FBF7] text-[#087B57] text-xs font-bold transition-all shadow-2xs cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Replace Excel</span>
                    </button>

                    <button
                      id="btn-delete-product-master"
                      type="button"
                      onClick={() => setShowConfirmDeleteMaster(true)}
                      className="w-8 h-8 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                      title="Remove Product Master"
                      aria-label="Remove Product Master"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Confirm Delete Banner */}
                {showConfirmDeleteMaster && (
                  <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 text-xs text-rose-900 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Are you sure you want to remove this Product Master? Order matching will be disabled until a new spreadsheet is uploaded.</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleDeleteMaster}
                        className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer"
                      >
                        Yes, Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowConfirmDeleteMaster(false)}
                        className="px-3 py-1 rounded-lg bg-white border border-rose-200 text-slate-700 hover:bg-rose-100/50 font-medium text-xs transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Section 5: Product Master Table */}
            <section
              aria-label="Product Master Data Table"
              className="bg-white rounded-[20px] border border-[#DCE8E1] shadow-[0_4px_24px_rgba(17,28,53,0.03)] p-6 sm:p-7 space-y-5"
            >
              {/* Header: Title, Count Badge, Search, Add Item Button, View Columns, Rows Selector */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E7EFEA]">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-[19px] sm:text-[21px] font-bold font-heading text-[#172554] leading-snug">
                      Product Master
                    </h2>
                    {productMaster && (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#E3F7EF] text-[#087B57] text-xs font-bold font-mono border border-[#C5EDE0]">
                        {totalRows.toLocaleString()} Records
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-[13px] text-[#64748B] mt-0.5 font-sans">
                    {productMaster
                      ? `Showing ${displayedColumns.length} of ${productMaster.columns.length} columns. Preserving all original data records.`
                      : 'Upload your shop spreadsheet to explore products, rates, and catalog fields.'}
                  </p>
                </div>

                {productMaster && (
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Search Field */}
                    <div className="relative w-full sm:w-60">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="input-search-products"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search products..."
                        className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-white border border-[#DCE8E1] focus:border-[#0D9668] focus:ring-1 focus:ring-[#0D9668] text-[#172554] placeholder-slate-400 transition-colors shadow-2xs"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          aria-label="Clear search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Add Item Button */}
                    <button
                      id="btn-add-product-item"
                      type="button"
                      onClick={handleOpenAddModal}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-linear-to-r from-[#0D9668] to-[#087B57] hover:opacity-95 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Add Item</span>
                    </button>

                    {/* View Columns Button */}
                    <button
                      id="btn-view-columns"
                      type="button"
                      onClick={() => setIsViewColumnsModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#DCE8E1] hover:bg-[#F2FBF7] text-[#087B57] text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                      title="Toggle and manage column visibility"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Columns ({displayedColumns.length}/{productMaster.columns.length})</span>
                    </button>

                    {/* Page Size Selector */}
                    <select
                      id="select-page-size"
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="px-3 py-2 text-xs rounded-xl bg-white border border-[#DCE8E1] text-[#172554] font-medium transition-colors cursor-pointer focus:border-[#0D9668] focus:ring-1 focus:ring-[#0D9668] shadow-2xs"
                      aria-label="Rows per page"
                    >
                      <option value={10}>10 / page</option>
                      <option value={25}>25 / page</option>
                      <option value={50}>50 / page</option>
                      <option value={100}>100 / page</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Table or Empty State */}
              {!productMaster ? (
                /* Empty State: No Excel Uploaded */
                <div className="py-14 px-4 text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#E3F7EF] text-[#0D9668] flex items-center justify-center mb-3.5 border border-[#C5EDE0]">
                    <FileSpreadsheet className="w-8 h-8 stroke-[1.8]" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold font-heading text-[#172554]">
                    No Product Master Uploaded
                  </h3>
                  <p className="text-xs sm:text-sm text-[#64748B] mt-1 max-w-md font-sans">
                    Upload your shop&apos;s product spreadsheet (XLSX, XLS or CSV) to manage your product catalogue, maintain rates, and enable automated order matching.
                  </p>
                  <button
                    id="btn-empty-upload-master"
                    type="button"
                    onClick={() => setIsUploadModalOpen(true)}
                    className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-xl bg-linear-to-r from-[#0D9668] to-[#087B57] hover:opacity-95 text-white text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload Product Master</span>
                  </button>
                </div>
              ) : filteredRows.length === 0 ? (
                /* Empty State: Search Results Found Nothing */
                <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3 border border-slate-200">
                    <Search className="w-6 h-6 stroke-[1.8]" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold font-heading text-[#172554]">
                    No products matching &quot;{searchQuery}&quot;
                  </h3>
                  <p className="text-xs text-[#64748B] mt-1">
                    Try searching with another keyword or clear the search filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="mt-3 px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-[#172554] transition-colors cursor-pointer"
                  >
                    Clear Search
                  </button>
                </div>
              ) : (
                /* Actual Product Master Data Table */
                <div>
                  <div className="overflow-x-auto rounded-xl border border-[#DCE8E1] max-h-[580px] shadow-2xs">
                    <table className="w-full text-left border-collapse text-xs">
                      {/* Sticky Column Header */}
                      <thead className="sticky top-0 z-10 bg-[#F4F9F6] border-b border-[#DCE8E1] shadow-xs">
                        <tr className="text-[#172554] font-bold uppercase tracking-wider select-none text-[11px]">
                          {/* Dynamic Displayed Columns */}
                          {displayedColumns.map((col, idx) => (
                            <th
                              key={idx}
                              className="py-3 px-4 font-bold whitespace-nowrap border-r border-[#E7EFEA] last:border-r-0"
                            >
                              {col}
                            </th>
                          ))}
                          {/* Sticky Right: Actions column (Always accessible) */}
                          <th className="py-3 px-3.5 w-14 text-center sticky right-0 z-20 bg-[#F4F9F6] border-l border-[#E2ECE6]">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      {/* Table Rows */}
                      <tbody className="divide-y divide-[#EBF2EE] font-sans">
                        {paginatedRows.map((row, rIdx) => {
                          const rowId = row._rowId || row._rowIndex || rIdx;
                          const isMenuOpen = activeMenuRowId === rowId;

                          return (
                            <tr
                              key={rowId}
                              className="even:bg-[#FAFCFB] odd:bg-white hover:bg-[#F0FAF5] transition-colors group"
                            >
                              {/* Visible Cells */}
                              {displayedColumns.map((col, cIdx) => {
                                const val = row[col];
                                const isNameCol = /name|product|item|description/i.test(col);

                                return (
                                  <td
                                    key={cIdx}
                                    className={`py-3.5 px-4 whitespace-nowrap max-w-[320px] truncate border-r border-[#F0F4F2] last:border-r-0 ${
                                      isNameCol
                                        ? 'font-semibold text-[#172554]'
                                        : 'text-[#475569]'
                                    }`}
                                    title={val !== undefined && val !== null ? String(val) : ''}
                                  >
                                    {val !== undefined && val !== null && String(val).trim().length > 0 ? (
                                      String(val)
                                    ) : (
                                      <span className="text-slate-300 font-normal">—</span>
                                    )}
                                  </td>
                                );
                              })}

                              {/* Sticky Right: 3-dot More Menu */}
                              <td
                                data-product-menu
                                className="py-2.5 px-2 text-center sticky right-0 z-10 bg-inherit border-l border-[#E2ECE6]"
                              >
                                <div className="relative inline-block text-left">
                                  <button
                                    id={`btn-product-menu-${rowId}`}
                                    type="button"
                                    onClick={() => setActiveMenuRowId((prev) => (prev === rowId ? null : rowId))}
                                    className="w-7 h-7 rounded-lg text-slate-400 hover:text-[#0D9668] hover:bg-white flex items-center justify-center transition-colors cursor-pointer"
                                    aria-label="Product options"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>

                                  {/* Dropdown Menu */}
                                  {isMenuOpen && (
                                    <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl border border-[#DCE8E1] shadow-xl py-1 z-30 animate-in fade-in zoom-in-95 duration-150">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveMenuRowId(null);
                                          setActiveItemForDetails(row);
                                        }}
                                        className="w-full px-3 py-1.5 text-left text-xs text-[#172554] hover:bg-[#F2FBF7] hover:text-[#0D9668] flex items-center gap-2 transition-colors cursor-pointer"
                                      >
                                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                                        <span>View Details</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditModal(row)}
                                        className="w-full px-3 py-1.5 text-left text-xs text-[#172554] hover:bg-[#F2FBF7] hover:text-[#0D9668] flex items-center gap-2 transition-colors cursor-pointer"
                                      >
                                        <Edit className="w-3.5 h-3.5 text-slate-400" />
                                        <span>Edit Item</span>
                                      </button>
                                      <div className="h-px bg-slate-100 my-0.5" />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveMenuRowId(null);
                                          setActiveItemForDelete(row);
                                        }}
                                        className="w-full px-3 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                        <span>Delete Item</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer: Summary & Pagination Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3.5">
                    <p className="text-xs text-[#64748B]">
                      Showing{' '}
                      <span className="font-semibold text-[#172554]">
                        {(currentPage - 1) * pageSize + 1}
                      </span>{' '}
                      to{' '}
                      <span className="font-semibold text-[#172554]">
                        {Math.min(currentPage * pageSize, totalRows)}
                      </span>{' '}
                      of{' '}
                      <span className="font-semibold text-[#172554]">
                        {totalRows.toLocaleString()}
                      </span>{' '}
                      products
                      {searchQuery && ' (filtered)'}
                    </p>

                    {totalPages > 1 && (
                      <div className="flex items-center gap-1.5 self-center sm:self-auto">
                        <button
                          id="btn-prev-page"
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1.5 rounded-lg border border-[#DCE8E1] bg-white hover:bg-[#F2FBF7] text-xs font-medium text-[#172554] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                        >
                          <ChevronLeft className="w-3.5 h-3.5 inline mr-0.5" />
                          <span>Previous</span>
                        </button>

                        <span className="px-3 py-1.5 text-xs font-bold text-[#172554] bg-[#F4F9F6] rounded-lg border border-[#DCE8E1]">
                          Page {currentPage} of {totalPages}
                        </span>

                        <button
                          id="btn-next-page"
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1.5 rounded-lg border border-[#DCE8E1] bg-white hover:bg-[#F2FBF7] text-xs font-medium text-[#172554] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                        >
                          <span>Next</span>
                          <ChevronRight className="w-3.5 h-3.5 inline ml-0.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </main>
        </div>
      </div>

      {/* Upload / Replace Product Master Popup */}
      <ProductMasterUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
        existingMaster={productMaster}
      />

      {/* View Columns Modal with Checkbox Controls */}
      {isViewColumnsModalOpen && productMaster && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-view-columns-title"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setIsViewColumnsModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl border border-[#DCE8E1] shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200 relative my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E7EFEA]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#EAF1FF] text-[#2563EB] flex items-center justify-center">
                  <ColumnsIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    id="modal-view-columns-title"
                    className="text-base font-bold font-heading text-[#172554]"
                  >
                    Manage Columns ({visibleColumns.size}/{productMaster.columns.length})
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Check columns to show or uncheck to hide in the table.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsViewColumnsModalOpen(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions: Select All & Reset */}
            <div className="flex items-center justify-between gap-2 pt-1 text-xs">
              <span className="text-[#64748B] text-[11px]">
                {visibleColumns.size} of {productMaster.columns.length} columns active
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-select-all-columns"
                  onClick={handleSelectAllColumns}
                  className="px-2.5 py-1 rounded-lg bg-[#E3F7EF] text-[#087B57] hover:bg-[#D4F3E6] font-semibold text-[11px] transition-colors cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  id="btn-reset-columns"
                  onClick={handleResetColumns}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-semibold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Column Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={columnSearchTerm}
                onChange={(e) => setColumnSearchTerm(e.target.value)}
                placeholder="Filter columns..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[#DCE8E1] focus:border-[#0D9668] text-[#172554] placeholder-slate-400 transition-colors"
              />
            </div>

            {/* Columns List with Individual Checkboxes */}
            <div className="max-h-72 overflow-y-auto divide-y divide-[#F0F4F2] border border-[#DCE8E1] rounded-xl text-xs">
              {filteredColumnsForSearch.map((col, idx) => {
                const isChecked = visibleColumns.has(col);
                return (
                  <label
                    key={idx}
                    className="p-2.5 flex items-center justify-between gap-3 hover:bg-[#F9FCFA] cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleColumn(col)}
                        className="w-4 h-4 rounded text-[#0D9668] focus:ring-[#0D9668] border-slate-300 cursor-pointer"
                      />
                      <span className={`truncate ${isChecked ? 'font-semibold text-[#172554]' : 'text-slate-400 line-through'}`}>
                        {col}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      #{idx + 1}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsViewColumnsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#0D9668] hover:bg-[#087B57] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Apply & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Item Modal */}
      {isAddItemModalOpen && productMaster && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-add-item-title"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setIsAddItemModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl border border-[#DCE8E1] shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200 relative my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E7EFEA]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E3F7EF] text-[#0D9668] flex items-center justify-center">
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3
                    id="modal-add-item-title"
                    className="text-base font-bold font-heading text-[#172554]"
                  >
                    Add Product Item
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Add a new item to your wholesale catalogue using existing columns.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddItemModalOpen(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Clean, Unified Form with All Product Master Columns */}
            <form onSubmit={handleSaveNewItem} className="space-y-4">
              <div className="max-h-[420px] overflow-y-auto space-y-3.5 pr-1.5">
                {productMaster.columns.map((col, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#172554] block">
                      {col}
                    </label>
                    <input
                      type="text"
                      value={itemFormData[col] || ''}
                      onChange={(e) =>
                        setItemFormData((prev) => ({ ...prev, [col]: e.target.value }))
                      }
                      placeholder={`Enter ${col}...`}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#DCE8E1] focus:border-[#0D9668] focus:ring-1 focus:ring-[#0D9668] text-[#172554] placeholder-slate-400 bg-white transition-colors"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E7EFEA]">
                <button
                  type="button"
                  onClick={() => setIsAddItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-[#172554] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-submit-add-item"
                  className="px-5 py-2 rounded-xl bg-linear-to-r from-[#0D9668] to-[#087B57] hover:opacity-95 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Item Modal */}
      {activeItemForEdit && productMaster && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-edit-item-title"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setActiveItemForEdit(null)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl border border-[#DCE8E1] shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200 relative my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E7EFEA]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E3F7EF] text-[#0D9668] flex items-center justify-center">
                  <Edit className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <h3
                    id="modal-edit-item-title"
                    className="text-base font-bold font-heading text-[#172554]"
                  >
                    Edit Product Item
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Update product details for row #{activeItemForEdit._rowIndex || '1'}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveItemForEdit(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Dynamic Form for Editing */}
            <form onSubmit={handleSaveEditItem} className="space-y-3.5">
              <div className="max-h-[380px] overflow-y-auto space-y-3 pr-1">
                {productMaster.columns.map((col, idx) => (
                  <div key={idx} className="space-y-1">
                    <label className="text-xs font-semibold text-[#172554] block">
                      {col}
                    </label>
                    <input
                      type="text"
                      value={itemFormData[col] !== undefined ? itemFormData[col] : ''}
                      onChange={(e) =>
                        setItemFormData((prev) => ({ ...prev, [col]: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-[#DCE8E1] focus:border-[#0D9668] focus:ring-1 focus:ring-[#0D9668] text-[#172554] transition-colors"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E7EFEA]">
                <button
                  type="button"
                  onClick={() => setActiveItemForEdit(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-[#172554] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-submit-edit-item"
                  className="px-5 py-2 rounded-xl bg-linear-to-r from-[#0D9668] to-[#087B57] hover:opacity-95 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {activeItemForDetails && productMaster && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-view-details-title"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setActiveItemForDetails(null)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl border border-[#DCE8E1] shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200 relative my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E7EFEA]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E3F7EF] text-[#0D9668] flex items-center justify-center">
                  <Eye className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <h3
                    id="modal-view-details-title"
                    className="text-base font-bold font-heading text-[#172554]"
                  >
                    Product Details (Row #{activeItemForDetails._rowIndex || '1'})
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Full attributes from {productMaster.fileName}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveItemForDetails(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Details List */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-[#F0F4F2] border border-[#DCE8E1] rounded-xl text-xs">
              {productMaster.columns.map((col, idx) => {
                const val = activeItemForDetails[col];
                return (
                  <div key={idx} className="p-3 flex items-start justify-between gap-4">
                    <span className="font-semibold text-[#64748B] text-xs max-w-[160px] shrink-0">
                      {col}
                    </span>
                    <span className="font-medium text-[#172554] text-right break-words max-w-[280px]">
                      {val !== undefined && val !== null && String(val).trim().length > 0 ? (
                        String(val)
                      ) : (
                        <span className="text-slate-300 font-normal">—</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const item = activeItemForDetails;
                  setActiveItemForDetails(null);
                  handleOpenEditModal(item);
                }}
                className="px-4 py-2 rounded-xl bg-white border border-[#DCE8E1] hover:bg-[#F2FBF7] text-[#087B57] text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Item</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveItemForDetails(null)}
                className="px-4 py-2 rounded-xl bg-[#0D9668] hover:bg-[#087B57] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Product Item Dialog */}
      {activeItemForDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setActiveItemForDelete(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl border border-rose-200 shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200 relative my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#172554]">Delete Product Item?</h3>
                <p className="text-xs text-[#64748B] mt-1 leading-snug">
                  Are you sure you want to delete this product from your Product Master catalogue? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setActiveItemForDelete(null)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-[#172554] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-delete-item"
                onClick={handleConfirmDeleteItem}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExcelManagementPage;
