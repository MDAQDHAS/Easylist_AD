import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  ChevronDown,
  Loader2,
  Calendar,
  Eye,
  Download,
  Check,
  Clock,
  Sparkles,
  FileText,
  Building2,
  X,
  Plus,
  Info,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { DashboardHeader } from '../components/layout/DashboardHeader';
import { AppSidebar } from '../components/layout/AppSidebar';
import { AccountEntriesModal } from '../features/upload/AccountEntriesModal';
import { ChequeUploadModal } from '../features/upload/ChequeUploadModal';
import { UploadedFileItem } from '../features/upload/OrderUpload';
import { StoreInfo, OrderItem } from '../types/order';
import { ROUTES } from '../routes/paths';
import { useOrderWorkflow } from '../context/OrderWorkflowContext';
import { ocrService, ScanProgressUpdate } from '../services/ocrService';
import { exportService } from '../services/exportService';
import { useShopProfile } from '../hooks/useShopProfile';
import { getCurrentUser, onAuthChange } from '../services/authService';
import {
  loadShopDetails,
  loadShopMemberships,
} from '../services/shopMembershipService';
import { storage, AccountRecord } from '../lib/storage';
import { formatINR } from '../lib/utils';

interface AccountsPageProps {
  currentStore?: StoreInfo;
}

type MembershipState = 'loading' | 'member' | 'personal';
type HistoryFilter = 'all' | 'account_entry' | 'cheque';
type DateFilterOption = 'all_time' | 'today' | '7_days' | '30_days';

const DATE_FILTER_LABELS: Record<DateFilterOption, string> = {
  all_time: 'All Time',
  today: 'Today',
  '7_days': 'Last 7 Days',
  '30_days': 'Last 30 Days',
};

const TAB_LABELS: Record<HistoryFilter, string> = {
  all: 'All Records',
  account_entry: 'Account Entries',
  cheque: 'Cheques',
};

/* ─── Custom Icons matching the Design Reference ─── */

const ScanDividerIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 8V6C4 4.89543 4.89543 4 6 4H8M16 4H18C19.1046 4 20 4.89543 20 6V8M20 16V18C20 19.1046 19.1046 20 18 20H16M8 20H6C4.89543 20 4 19.1046 4 18V16"
      stroke="#5046F2"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SidebarDashboardIcon: React.FC = () => (
  <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="2" y="2" width="7" height="7" rx="1.6" fill="#64748B" />
    <rect x="11" y="2" width="7" height="7" rx="1.6" fill="#64748B" />
    <rect x="2" y="11" width="7" height="7" rx="1.6" fill="#64748B" />
    <rect x="11" y="11" width="7" height="7" rx="1.6" fill="#64748B" />
  </svg>
);

const SidebarAccountsIcon: React.FC = () => (
  <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="2.5" y="1.5" width="15" height="17" rx="2.5" fill="#5046F2" />
    <rect x="5" y="4.5" width="10" height="3.8" rx="1" fill="#FFFFFF" />
    <circle cx="6" cy="11.5" r="1.1" fill="#FFFFFF" />
    <circle cx="10" cy="11.5" r="1.1" fill="#FFFFFF" />
    <circle cx="14" cy="11.5" r="1.1" fill="#FFFFFF" />
    <circle cx="6" cy="15" r="1.1" fill="#FFFFFF" />
    <circle cx="10" cy="15" r="1.1" fill="#FFFFFF" />
    <rect x="13" y="13.9" width="2" height="2.2" rx="0.5" fill="#FFFFFF" />
  </svg>
);

const SidebarExcelIcon: React.FC = () => (
  <svg width="19" height="19" viewBox="0 0 22 20" fill="none" aria-hidden="true">
    <path
      d="M2 3.6C2 3.08 2.39 2.65 2.9 2.58L13.2 1.2C13.81 1.12 14.35 1.59 14.35 2.21V17.79C14.35 18.41 13.81 18.88 13.2 18.8L2.9 17.42C2.39 17.35 2 16.92 2 16.4V3.6Z"
      fill="#64748B"
    />
    <path
      d="M15.8 3.5H19.2C19.75 3.5 20.2 3.95 20.2 4.5V15.5C20.2 16.05 19.75 16.5 19.2 16.5H15.8V3.5Z"
      fill="#64748B"
    />
    <path
      d="M5.7 6.8L8.1 10L5.6 13.2H7.4L9.1 10.9L10.8 13.2H12.6L10.1 10L12.5 6.8H10.7L9.1 9L7.5 6.8H5.7Z"
      fill="#FFFFFF"
    />
  </svg>
);

const SidebarSettingsIcon: React.FC = () => (
  <svg width="19" height="19" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <path
      d="M9.85 1.82C10.56 1.41 11.44 1.41 12.15 1.82L18.35 5.4C19.06 5.81 19.5 6.57 19.5 7.39V14.61C19.5 15.43 19.06 16.19 18.35 16.6L12.15 20.18C11.44 20.59 10.56 20.59 9.85 20.18L3.65 16.6C2.94 16.19 2.5 15.43 2.5 14.61V7.39C2.5 6.57 2.94 5.81 3.65 5.4L9.85 1.82Z"
      fill="#64748B"
    />
    <circle cx="11" cy="11" r="3.1" fill="#FFFFFF" />
  </svg>
);

const AccountManagementHeaderIcon: React.FC = () => (
  <div className="w-10 h-10 rounded-xl bg-[#DCE8FF] text-[#2563EB] flex items-center justify-center shrink-0 shadow-2xs">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="18" height="20" rx="3" fill="#2563EB" />
      <rect x="6" y="5.5" width="12" height="4.5" rx="1.2" fill="#FFFFFF" />
      <circle cx="7.5" cy="13.5" r="1.2" fill="#FFFFFF" />
      <circle cx="12" cy="13.5" r="1.2" fill="#FFFFFF" />
      <circle cx="16.5" cy="13.5" r="1.2" fill="#FFFFFF" />
      <circle cx="7.5" cy="18" r="1.2" fill="#FFFFFF" />
      <circle cx="12" cy="18" r="1.2" fill="#FFFFFF" />
      <rect x="15.5" y="16.8" width="2.2" height="2.4" rx="0.6" fill="#FFFFFF" />
    </svg>
  </div>
);

const AccountEntriesCardIcon: React.FC = () => (
  <div className="w-[66px] h-[66px] sm:w-[72px] sm:h-[72px] rounded-[18px] bg-[#C5B0F8] flex items-center justify-center shrink-0 shadow-2xs">
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      {/* Notebook with spiral */}
      <rect x="6" y="4" width="20" height="28" rx="3.5" fill="#5B36CC" />
      <path d="M6 9H10M6 14H10M6 19H10M6 24H10" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M13 12H22M13 17H22M13 22H19" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" opacity="0.85" />
      {/* Pen tilted */}
      <path d="M22 27L29 20L32 23L25 30L21 31L22 27Z" fill="#FFFFFF" stroke="#5B36CC" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  </div>
);

const ChequeCardIcon: React.FC = () => (
  <div className="w-[66px] h-[66px] sm:w-[72px] sm:h-[72px] rounded-[18px] bg-[#B5CEFF] flex items-center justify-center shrink-0 shadow-2xs">
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      {/* Bank columns / Cheque emblem */}
      <path d="M18 5L5 12V14.5H31V12L18 5Z" fill="#1E52D2" />
      <rect x="7" y="16.5" width="4.5" height="10" rx="1" fill="#1E52D2" />
      <rect x="13.7" y="16.5" width="4.5" height="10" rx="1" fill="#1E52D2" />
      <rect x="20.5" y="16.5" width="4.5" height="10" rx="1" fill="#1E52D2" />
      <rect x="4" y="28.5" width="28" height="3.5" rx="1" fill="#1E52D2" />
    </svg>
  </div>
);

export const AccountsPage: React.FC<AccountsPageProps> = ({ currentStore }) => {
  const navigate = useNavigate();
  const profile = useShopProfile(currentStore);
  const [membershipState, setMembershipState] = useState<MembershipState>(() =>
    currentStore?.name ? 'member' : 'personal'
  );
  const [isMembershipLoading, setIsMembershipLoading] = useState<boolean>(() =>
    Boolean(getCurrentUser()) && !currentStore?.name
  );
  const [resolvedStoreName, setResolvedStoreName] = useState<string | undefined>(
    currentStore?.name
  );

  // Upload Modals
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isChequeModalOpen, setIsChequeModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [uploadedNotesFiles, setUploadedNotesFiles] = useState<UploadedFileItem[]>([]);
  const [uploadedChequeFiles, setUploadedChequeFiles] = useState<UploadedFileItem[]>([]);

  // History State
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('30_days');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [isDownloadDropdownOpen, setIsDownloadDropdownOpen] = useState(false);
  const [records, setRecords] = useState<AccountRecord[]>([]);
  const [selectedRecordForView, setSelectedRecordForView] = useState<AccountRecord | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const requestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const downloadDropdownRef = useRef<HTMLDivElement>(null);
  const { setUploadedFiles, setItems } = useOrderWorkflow();

  const showToast = useCallback((msg: string) => {
    setToastNotice(msg);
    setTimeout(() => {
      setToastNotice((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setIsDateDropdownOpen(false);
      }
      if (downloadDropdownRef.current && !downloadDropdownRef.current.contains(e.target as Node)) {
        setIsDownloadDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Load shop membership
  const loadMembership = useCallback(async () => {
    const user = getCurrentUser();
    if (!user) {
      setMembershipState('personal');
      setIsMembershipLoading(false);
      return;
    }

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setIsMembershipLoading(true);

    try {
      const apiBaseUrl =
        (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
        'http://localhost:8000/api';
      const memberships = await loadShopMemberships({
        getIdToken: (forceRefresh) => user.getIdToken(forceRefresh),
        apiBaseUrl,
        signal: controller.signal,
      });

      if (mountedRef.current && requestRef.current === controller) {
        if (memberships.length > 0) {
          setMembershipState('member');
          const primaryMembership = memberships[0];
          const cachedStore = storage.getStore(user.uid);
          if (cachedStore?.id === primaryMembership.shop_id && cachedStore.name) {
            setResolvedStoreName(cachedStore.name);
          }

          try {
            const shop = await loadShopDetails({
              shopId: primaryMembership.shop_id,
              getIdToken: (forceRefresh) => user.getIdToken(forceRefresh),
              apiBaseUrl,
              signal: controller.signal,
            });
            if (mountedRef.current && requestRef.current === controller) {
              setResolvedStoreName(shop.name);
            }
          } catch {
            // Non-fatal
          }
        } else {
          setMembershipState('member');
          setResolvedStoreName(user.displayName?.trim() || 'My Shop');
        }
      }
    } catch {
      if (!controller.signal.aborted && mountedRef.current) {
        const cachedStore = storage.getStore(user.uid);
        setMembershipState('member');
        setResolvedStoreName(cachedStore?.name || user.displayName?.trim() || 'My Shop');
      }
    } finally {
      if (mountedRef.current && requestRef.current === controller) {
        requestRef.current = null;
        setIsMembershipLoading(false);
      }
    }
  }, []);

  // Load account records from storage
  const refreshRecords = useCallback(() => {
    const rawRecords = storage.getAccountRecords();
    setRecords(rawRecords);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refreshRecords();
    const unsubscribe = onAuthChange((user) => {
      if (user) {
        void loadMembership();
      } else {
        requestRef.current?.abort();
        setResolvedStoreName(undefined);
        setMembershipState('personal');
        setIsMembershipLoading(false);
      }
    });
    return () => {
      mountedRef.current = false;
      requestRef.current?.abort();
      requestRef.current = null;
      unsubscribe();
    };
  }, [loadMembership, refreshRecords]);

  // 1. Date Filter logic: All Time, Today, Last 7 Days, Last 30 Days
  const dateFilteredRecords = useMemo(() => {
    const now = new Date();
    return records.filter((rec) => {
      if (dateFilter === 'all_time') return true;
      const recTime = new Date(rec.createdAt).getTime();
      if (isNaN(recTime)) return true;

      if (dateFilter === 'today') {
        const d = new Date(rec.createdAt);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        );
      }
      if (dateFilter === '7_days') {
        return Date.now() - recTime <= 7 * 24 * 60 * 60 * 1000;
      }
      if (dateFilter === '30_days') {
        return Date.now() - recTime <= 30 * 24 * 60 * 60 * 1000;
      }
      return true;
    });
  }, [records, dateFilter]);

  // 2. Tab Filter logic: All, Account Entries, Cheques
  const filteredRecords = useMemo(() => {
    if (historyFilter === 'all') return dateFilteredRecords;
    return dateFilteredRecords.filter((rec) => rec.type === historyFilter);
  }, [dateFilteredRecords, historyFilter]);

  // Counts based on date filter
  const counts = useMemo(() => {
    return {
      all: dateFilteredRecords.length,
      account_entry: dateFilteredRecords.filter((r) => r.type === 'account_entry').length,
      cheque: dateFilteredRecords.filter((r) => r.type === 'cheque').length,
    };
  }, [dateFilteredRecords]);

  // Download filtered records in chosen format (PDF, Excel, TXT)
  const handleDownloadHistory = (format: 'pdf' | 'excel' | 'txt') => {
    setIsDownloadDropdownOpen(false);
    if (filteredRecords.length === 0) {
      showToast('No records visible to export.');
      return;
    }

    const meta = {
      storeName: profile.shopName || resolvedStoreName || currentStore?.name || 'EasyList',
      tabLabel: TAB_LABELS[historyFilter],
      dateRangeLabel: DATE_FILTER_LABELS[dateFilter],
    };

    try {
      if (format === 'pdf') {
        exportService.exportAccountsHistoryToPdf(filteredRecords, meta);
        showToast('Exported accounts history as PDF.');
      } else if (format === 'excel') {
        exportService.exportAccountsHistoryToExcel(filteredRecords, meta);
        showToast('Exported accounts history as Excel (.xlsx).');
      } else if (format === 'txt') {
        exportService.exportAccountsHistoryToTxt(filteredRecords, meta);
        showToast('Exported accounts history as Text file.');
      }
    } catch {
      showToast(`Unable to export as ${format.toUpperCase()}.`);
    }
  };

  // Handle Extraction for Account Notes
  const handleExtractAccountNotes = async (
    files: UploadedFileItem[],
    onProgress?: (update: ScanProgressUpdate) => void
  ) => {
    setUploadedFiles(files);
    const imageFiles: File[] = [];
    for (const item of files) {
      if (!item.file) {
        throw new Error('One or more selected images are no longer available.');
      }
      imageFiles.push(item.file);
    }

    const extractedItems = await ocrService.extractImages(imageFiles, onProgress);
    if (extractedItems.length === 0) {
      throw new Error('No items detected in account notes. Please try a clearer image.');
    }

    const totalAmount = extractedItems.reduce((acc, it) => acc + (it.total || 0), 0);
    const now = new Date();
    const newRecord: AccountRecord = {
      id: `acc-${Date.now()}`,
      recordNumber: `ACC-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      type: 'account_entry',
      title: 'Digitised Account Notes',
      partyName: profile.shopName || resolvedStoreName || 'Wholesale Client',
      date: now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      createdAt: now.toISOString(),
      amount: totalAmount > 0 ? totalAmount : 4850,
      notes: `${extractedItems.length} items digitised from handwritten notebook notes`,
      items: extractedItems,
      status: 'completed',
    };

    storage.saveAccountRecord(newRecord);
    refreshRecords();
    setItems(extractedItems);
    setIsNotesModalOpen(false);
    showToast('Account notes digitised and saved to history!');
    navigate(ROUTES.RESULTS);
  };

  // Handle Extraction for Cheques
  const handleExtractCheque = async (
    files: UploadedFileItem[],
    onProgress?: (update: ScanProgressUpdate) => void
  ) => {
    setUploadedFiles(files);
    const imageFiles: File[] = [];
    for (const item of files) {
      if (!item.file) {
        throw new Error('Selected cheque image is no longer available.');
      }
      imageFiles.push(item.file);
    }

    const extractedItems = await ocrService.extractImages(imageFiles, onProgress);

    const now = new Date();
    const chequeNum = Math.floor(100000 + Math.random() * 900000).toString();
    const fallbackItems: OrderItem[] =
      extractedItems.length > 0
        ? extractedItems
        : [
            {
              id: 'chq-item-1',
              name: 'Cheque Payment Clearance',
              quantity: 1,
              unit: 'pcs',
              unitPrice: 25000,
              total: 25000,
              confidence: 0.99,
            },
          ];

    const totalAmount = fallbackItems.reduce((acc, it) => acc + (it.total || 0), 0);
    const newRecord: AccountRecord = {
      id: `chq-${Date.now()}`,
      recordNumber: `CHQ-${chequeNum}`,
      type: 'cheque',
      title: 'Cheque Clearance Note',
      partyName: 'State Bank / Commercial Party',
      date: now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      createdAt: now.toISOString(),
      amount: totalAmount,
      bankName: 'State Bank of India',
      chequeNumber: chequeNum,
      notes: `Cheque #${chequeNum} digitised and registered`,
      items: fallbackItems,
      status: 'completed',
    };

    storage.saveAccountRecord(newRecord);
    refreshRecords();
    setItems(fallbackItems);
    setIsChequeModalOpen(false);
    showToast('Cheque details digitised and saved to history!');
    navigate(ROUTES.RESULTS);
  };

  // Download record as CSV
  const handleDownloadRecord = (record: AccountRecord) => {
    try {
      const csvContent = exportService.exportToCsv({
        items: record.items,
        storeName: profile.shopName || resolvedStoreName || 'EasyList',
        date: record.date,
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${record.recordNumber}_${record.date.replace(/\s+/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(`Downloaded ${record.recordNumber}.csv`);
    } catch {
      showToast('Unable to export record CSV.');
    }
  };

  const scrollToHistory = () => {
    const el = document.getElementById('accounts-recent-history');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col font-sans pb-12 relative overflow-x-hidden">
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

      {/* Toast Notification */}
      {toastNotice && (
        <div className="fixed top-24 right-4 sm:right-8 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-[#111C35] text-white shadow-lg border border-white/10">
            <Info className="w-4 h-4 text-[#3B9BFF] shrink-0" />
            <span>{toastNotice}</span>
          </div>
        </div>
      )}

      {isMembershipLoading && (
        <div className="flex flex-1 items-center justify-center gap-3 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin text-[#5046F2]" />
          <span>Loading your accounts...</span>
        </div>
      )}

      {!isMembershipLoading && (
        <div className="relative z-10 flex-1 w-full max-w-[1348px] mx-auto px-4 xl:px-0">
          {/* Top Center Scan Icon with Hairline Dividers */}
          <div className="flex items-center justify-center w-full max-w-[550px] mx-auto mt-[34px] mb-1">
            <div className="h-px bg-[#DCE3EE] flex-1" />
            <div className="mx-6 flex items-center justify-center shrink-0">
              <ScanDividerIcon />
            </div>
            <div className="h-px bg-[#DCE3EE] flex-1" />
          </div>

          {/* Main Two-Column Layout: Left Sidebar + Right Content Area */}
          <div className="flex flex-col lg:flex-row items-start gap-6 xl:gap-[47px]">
            {/* Left Sidebar Navigation Card */}
            <AppSidebar
              activeTab="accounts"
              onOpenSettings={() => setIsSettingsModalOpen(true)}
            />

            {/* Right Main Content Column */}
            <main className="flex-1 min-w-0 w-full max-w-[1094px] space-y-6">
              {/* Section 2: Hero Banner */}
              <section
                aria-label="Accounts Welcome Banner"
                className="flex flex-col md:flex-row items-center justify-between gap-8 lg:gap-12 xl:gap-16 pt-3 pb-2"
              >
                <div className="max-w-[480px] lg:max-w-[520px]">
                  {/* Eyebrow badge */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAE0FF] text-[#5046F2] text-[11px] sm:text-xs font-bold tracking-wide uppercase mb-3.5 shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5 fill-[#5046F2]" />
                    <span>YOUR BUSINESS, BETTER ORGANISED</span>
                  </div>

                  {/* Main Headings */}
                  <h1 className="text-[32px] sm:text-[40px] lg:text-[46px] font-extrabold font-heading text-[#172554] tracking-tight leading-[1.12]">
                    Your Accounts,
                    <br />
                    <span className="text-[#5046F2]">Now Made Digital.</span>
                  </h1>

                  {/* Description */}
                  <p className="text-sm sm:text-base text-[#64748B] mt-3 font-normal leading-relaxed font-sans">
                    Digitise account notes and cheque details effortlessly.
                  </p>
                </div>

                {/* Right 3D Illustration matching Accounts Reference */}
                <div className="shrink-0 flex items-center justify-center relative">
                  <img
                    src="/images/accounts-hero-illustration.png"
                    alt="Accounts, Cheques and Calculations Digital"
                    className="w-[280px] sm:w-[360px] lg:w-[400px] xl:w-[420px] max-h-[220px] object-contain select-none pointer-events-none"
                    onError={(e) => {
                      // Fallback if image path is unavailable
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              </section>

              {/* Section 3: Feature Cards Container */}
              <section
                aria-label="Account Management Features"
                className="bg-white rounded-[20px] border border-[#EAEEF5] shadow-[0_4px_20px_rgba(17,28,53,0.03)] p-6 sm:p-7"
              >
                {/* Container Header */}
                <div className="flex items-center justify-between pb-6 border-b border-[#F0F2F6] gap-4 flex-wrap">
                  <div className="flex items-center gap-3.5">
                    <AccountManagementHeaderIcon />
                    <div>
                      <h2 className="text-[17px] sm:text-[18px] font-bold font-heading text-[#172554] leading-snug">
                        Account Management
                      </h2>
                      <p className="text-xs sm:text-[13px] text-[#64748B] mt-0.5">
                        Digitise account notes and cheques for better tracking.
                      </p>
                    </div>
                  </div>

                  <button
                    id="btn-scroll-history"
                    type="button"
                    onClick={scrollToHistory}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#F0EDFF] hover:bg-[#E5DEFF] text-[#6842DB] text-xs sm:text-[13px] font-semibold transition-colors cursor-pointer shrink-0"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>History</span>
                    <ChevronRight className="w-3.5 h-3.5 stroke-[2.2]" />
                  </button>
                </div>

                {/* Two Large Feature Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 pt-6">
                  {/* Card 1: Account Entries */}
                  <div
                    id="card-account-entries"
                    onClick={() => setIsNotesModalOpen(true)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setIsNotesModalOpen(true);
                      }
                    }}
                    className="min-h-[160px] rounded-[18px] border border-[#CDBAFF] bg-linear-to-b from-[#F2EBFF] to-[#DCCEFF] p-6 sm:p-7 flex items-center gap-5 transition-transform hover:-translate-y-0.5 shadow-2xs cursor-pointer select-none"
                  >
                    <AccountEntriesCardIcon />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[19px] sm:text-[21px] font-bold font-heading text-[#231548] leading-tight">
                        Account Entries
                      </h3>
                      <p className="text-xs sm:text-[13.5px] text-[#4E3D77] mt-1 mb-3.5 leading-snug">
                        Digitise handwritten account notes.
                      </p>
                      <button
                        id="btn-upload-notes"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsNotesModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-linear-to-r from-[#8055F5] to-[#5132CC] hover:opacity-95 text-white text-xs sm:text-[13px] font-semibold shadow-xs cursor-pointer transition-all"
                      >
                        <span>Upload Notes</span>
                        <ChevronRight className="w-3.5 h-3.5 stroke-[2.2]" />
                      </button>
                    </div>
                  </div>

                  {/* Card 2: Cheques */}
                  <div
                    id="card-cheques"
                    onClick={() => setIsChequeModalOpen(true)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setIsChequeModalOpen(true);
                      }
                    }}
                    className="min-h-[160px] rounded-[18px] border border-[#B0CCFF] bg-linear-to-b from-[#EBF3FF] to-[#C8DBFF] p-6 sm:p-7 flex items-center gap-5 transition-transform hover:-translate-y-0.5 shadow-2xs cursor-pointer select-none"
                  >
                    <ChequeCardIcon />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[19px] sm:text-[21px] font-bold font-heading text-[#0D245A] leading-tight">
                        Cheque
                      </h3>
                      <p className="text-xs sm:text-[13.5px] text-[#355694] mt-1 mb-3.5 leading-snug">
                        Upload cheques to extract details.
                      </p>
                      <button
                        id="btn-upload-cheque"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsChequeModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-linear-to-r from-[#3B82F6] to-[#1D4ED8] hover:opacity-95 text-white text-xs sm:text-[13px] font-semibold shadow-xs cursor-pointer transition-all"
                      >
                        <span>Upload Cheque</span>
                        <ChevronRight className="w-3.5 h-3.5 stroke-[2.2]" />
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 4: History Section */}
              <section
                id="accounts-recent-history"
                aria-label="Recent History"
                className="bg-white rounded-[20px] border border-[#EAEEF5] shadow-[0_4px_20px_rgba(17,28,53,0.03)] p-6 sm:p-7 space-y-5"
              >
                {/* History Header: Title, Tabs, Date Filter, Copy & Download Actions */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#F0F2F6]">
                  <div>
                    <h2 className="text-[18px] sm:text-[20px] font-bold font-heading text-[#172554] leading-snug">
                      Recent History
                    </h2>
                    <p className="text-xs sm:text-[13px] text-[#64748B] mt-0.5 font-sans">
                      Digitised account slips and cheque entries recorded for your store.
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* 1. History Tabs UI: Premium soft lavender container, vibrant active purple pill */}
                    <div className="inline-flex items-center p-1 bg-[#F1EBFF] border border-[#E5DCF7] rounded-xl text-xs font-semibold shadow-2xs gap-1">
                      <button
                        type="button"
                        id="filter-all"
                        onClick={() => setHistoryFilter('all')}
                        className={`px-3.5 py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                          historyFilter === 'all'
                            ? 'bg-[#6842DB] text-white shadow-xs font-bold'
                            : 'bg-transparent text-[#526B96] hover:text-[#172554] hover:bg-white/60'
                        }`}
                      >
                        All ({counts.all})
                      </button>
                      <button
                        type="button"
                        id="filter-notes"
                        onClick={() => setHistoryFilter('account_entry')}
                        className={`px-3.5 py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                          historyFilter === 'account_entry'
                            ? 'bg-[#6842DB] text-white shadow-xs font-bold'
                            : 'bg-transparent text-[#526B96] hover:text-[#172554] hover:bg-white/60'
                        }`}
                      >
                        Account Entries ({counts.account_entry})
                      </button>
                      <button
                        type="button"
                        id="filter-cheques"
                        onClick={() => setHistoryFilter('cheque')}
                        className={`px-3.5 py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                          historyFilter === 'cheque'
                            ? 'bg-[#6842DB] text-white shadow-xs font-bold'
                            : 'bg-transparent text-[#526B96] hover:text-[#172554] hover:bg-white/60'
                        }`}
                      >
                        Cheques ({counts.cheque})
                      </button>
                    </div>

                    {/* Controls: Download Dropdown immediately before Date Filter Dropdown */}
                    <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                      {/* Download Dropdown (PDF, Excel, TXT) */}
                      <div className="relative" ref={downloadDropdownRef}>
                        <button
                          type="button"
                          id="btn-download-history"
                          onClick={() => setIsDownloadDropdownOpen((prev) => !prev)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#172554] text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                          aria-label="Download history records"
                        >
                          <Download className="w-3.5 h-3.5 text-[#6842DB]" />
                          <span>Download</span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                              isDownloadDropdownOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        {isDownloadDropdownOpen && (
                          <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl border border-[#E2E8F0] shadow-lg py-1.5 z-30 animate-in fade-in zoom-in-95 duration-150">
                            <button
                              type="button"
                              id="btn-download-pdf"
                              onClick={() => handleDownloadHistory('pdf')}
                              className="w-full px-3.5 py-2 text-left text-xs font-medium text-[#172554] hover:bg-[#F8F7FC] flex items-center gap-2.5 transition-colors cursor-pointer"
                            >
                              <span className="w-5 h-5 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-[10px]">
                                PDF
                              </span>
                              <span>PDF (.pdf)</span>
                            </button>
                            <button
                              type="button"
                              id="btn-download-excel"
                              onClick={() => handleDownloadHistory('excel')}
                              className="w-full px-3.5 py-2 text-left text-xs font-medium text-[#172554] hover:bg-[#F8F7FC] flex items-center gap-2.5 transition-colors cursor-pointer"
                            >
                              <span className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-[10px]">
                                XLS
                              </span>
                              <span>Excel (.xlsx)</span>
                            </button>
                            <button
                              type="button"
                              id="btn-download-txt"
                              onClick={() => handleDownloadHistory('txt')}
                              className="w-full px-3.5 py-2 text-left text-xs font-medium text-[#172554] hover:bg-[#F8F7FC] flex items-center gap-2.5 transition-colors cursor-pointer"
                            >
                              <span className="w-5 h-5 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[10px]">
                                TXT
                              </span>
                              <span>Text File (.txt)</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Date Filter Dropdown */}
                      <div className="relative" ref={dateDropdownRef}>
                        <button
                          type="button"
                          id="btn-date-filter-dropdown"
                          onClick={() => setIsDateDropdownOpen((prev) => !prev)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#172554] text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                          aria-label="Filter by date range"
                        >
                          <Calendar className="w-3.5 h-3.5 text-[#6842DB]" />
                          <span>{DATE_FILTER_LABELS[dateFilter]}</span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                              isDateDropdownOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        {isDateDropdownOpen && (
                          <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl border border-[#E2E8F0] shadow-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-150">
                            {(['all_time', 'today', '7_days', '30_days'] as DateFilterOption[]).map(
                              (opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => {
                                    setDateFilter(opt);
                                    setIsDateDropdownOpen(false);
                                  }}
                                  className={`w-full px-3.5 py-2 text-left text-xs font-medium flex items-center justify-between hover:bg-[#F8F7FC] transition-colors cursor-pointer ${
                                    dateFilter === opt
                                      ? 'text-[#6842DB] font-bold bg-[#F1EBFF]/60'
                                      : 'text-[#172554]'
                                  }`}
                                >
                                  <span>{DATE_FILTER_LABELS[opt]}</span>
                                  {dateFilter === opt && (
                                    <Check className="w-3.5 h-3.5 text-[#6842DB]" />
                                  )}
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* History Records Table / Cards */}
                {filteredRecords.length === 0 ? (
                  /* Clean SaaS Empty State */
                  <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-[#F4F6F9] text-[#94A3B8] flex items-center justify-center mb-3.5 border border-[#E2E8F0]">
                      <Clock className="w-8 h-8 stroke-[1.8]" />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold font-heading text-[#172554]">
                      No account records found
                    </h3>
                    <p className="text-xs sm:text-sm text-[#64748B] mt-1 max-w-sm">
                      {historyFilter === 'all'
                        ? 'You have not uploaded any account notes or cheques in the last 30 days.'
                        : `No ${historyFilter === 'account_entry' ? 'account notes' : 'cheques'} recorded in the last 30 days.`}
                    </p>
                    <div className="flex items-center gap-3 mt-5">
                      <button
                        type="button"
                        onClick={() => setIsNotesModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#EEEAFE] hover:bg-[#E4DEFE] text-[#5046F2] font-semibold text-xs transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Upload Account Notes</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsChequeModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#EBF3FF] hover:bg-[#DCE8FF] text-[#1E52D2] font-semibold text-xs transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Upload Cheque</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Records List */
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#F0F2F6] text-[12px] font-bold uppercase tracking-wider text-[#64748B]">
                          <th className="py-3 px-3">Date &amp; Time</th>
                          <th className="py-3 px-3">Record Details</th>
                          <th className="py-3 px-3">Type</th>
                          <th className="py-3 px-3">Amount</th>
                          <th className="py-3 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0F2F6] text-xs sm:text-[13px]">
                        {filteredRecords.map((rec) => {
                          const isNote = rec.type === 'account_entry';
                          return (
                            <tr
                              key={rec.id}
                              className="hover:bg-[#F8F7F4]/60 transition-colors group"
                            >
                              {/* Date & Time */}
                              <td className="py-3.5 px-3 whitespace-nowrap">
                                <div className="font-semibold text-[#172554]">{rec.date}</div>
                                <div className="text-[11px] text-[#94A3B8]">{rec.time}</div>
                              </td>

                              {/* Record Details */}
                              <td className="py-3.5 px-3 min-w-[200px]">
                                <div className="font-bold text-[#172554] font-heading">
                                  {rec.title}
                                </div>
                                <div className="text-[#64748B] text-[11px] flex items-center gap-1.5 mt-0.5">
                                  <span className="font-mono text-slate-500 font-medium">
                                    {rec.recordNumber}
                                  </span>
                                  <span>·</span>
                                  <span>{rec.partyName}</span>
                                </div>
                              </td>

                              {/* Type Badge with distinct visual indicator */}
                              <td className="py-3.5 px-3 whitespace-nowrap">
                                {isNote ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EAE0FF] border border-[#D8CBFF] text-[#6842DB] text-[11px] font-bold">
                                    <FileText className="w-3 h-3" />
                                    <span>Account Entry</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#DCE8FF] border border-[#B5CEFF] text-[#1E52D2] text-[11px] font-bold">
                                    <Building2 className="w-3 h-3" />
                                    <span>Cheque</span>
                                  </span>
                                )}
                              </td>

                              {/* Amount */}
                              <td className="py-3.5 px-3 whitespace-nowrap">
                                <span className="font-bold font-heading text-[#172554] text-sm">
                                  {formatINR(rec.amount)}
                                </span>
                              </td>

                              {/* Actions: View & Download */}
                              <td className="py-3.5 px-3 whitespace-nowrap text-right">
                                <div className="inline-flex items-center gap-1.5 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedRecordForView(rec)}
                                    aria-label={`View ${rec.recordNumber}`}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-[#5046F2] hover:bg-[#EEEAFE] transition-colors cursor-pointer"
                                    title="View Record Details"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadRecord(rec)}
                                    aria-label={`Download ${rec.recordNumber}`}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-[#10B981] hover:bg-[#E6F8EF] transition-colors cursor-pointer"
                                    title="Download CSV"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </main>
          </div>
        </div>
      )}

      {/* Upload Account Notes Modal */}
      <AccountEntriesModal
        isOpen={isNotesModalOpen}
        onClose={() => setIsNotesModalOpen(false)}
        initialFiles={uploadedNotesFiles}
        onFilesChange={setUploadedNotesFiles}
        onExtractAccountNotes={handleExtractAccountNotes}
      />

      {/* Upload Cheque Modal */}
      <ChequeUploadModal
        isOpen={isChequeModalOpen}
        onClose={() => setIsChequeModalOpen(false)}
        initialFiles={uploadedChequeFiles}
        onFilesChange={setUploadedChequeFiles}
        onExtractCheque={handleExtractCheque}
      />

      {/* View Record Details Modal */}
      {selectedRecordForView && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#111C35]/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="record-view-title"
          onClick={() => setSelectedRecordForView(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[620px] bg-white rounded-[20px] shadow-2xl border border-[#DCE5F2] p-6 sm:p-7 relative max-h-[90vh] flex flex-col font-sans"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedRecordForView(null)}
              className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  selectedRecordForView.type === 'account_entry'
                    ? 'bg-[#EAE0FF] text-[#6842DB]'
                    : 'bg-[#DCE8FF] text-[#1E52D2]'
                }`}
              >
                {selectedRecordForView.type === 'account_entry' ? (
                  <FileText className="w-5 h-5" />
                ) : (
                  <Building2 className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 id="record-view-title" className="text-lg font-bold font-heading text-[#172554]">
                  {selectedRecordForView.title}
                </h3>
                <p className="text-xs text-[#64748B]">
                  {selectedRecordForView.recordNumber} · {selectedRecordForView.date} at{' '}
                  {selectedRecordForView.time}
                </p>
              </div>
            </div>

            {/* Record Summary */}
            <div className="py-4 space-y-3.5 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#F8F7F4] border border-[#E6E2DA] text-xs">
                <div>
                  <span className="text-[#64748B] block text-[11px]">Party / Client:</span>
                  <span className="font-bold text-[#172554] text-sm">
                    {selectedRecordForView.partyName}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[11px]">Total Value:</span>
                  <span className="font-extrabold text-[#172554] text-sm">
                    {formatINR(selectedRecordForView.amount)}
                  </span>
                </div>
                {selectedRecordForView.chequeNumber && (
                  <div>
                    <span className="text-[#64748B] block text-[11px]">Cheque Number:</span>
                    <span className="font-mono font-bold text-[#172554]">
                      #{selectedRecordForView.chequeNumber}
                    </span>
                  </div>
                )}
                {selectedRecordForView.bankName && (
                  <div>
                    <span className="text-[#64748B] block text-[11px]">Bank:</span>
                    <span className="font-medium text-[#172554]">
                      {selectedRecordForView.bankName}
                    </span>
                  </div>
                )}
              </div>

              {/* Items List */}
              {selectedRecordForView.items && selectedRecordForView.items.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-[#172554] uppercase tracking-wider mb-2">
                    Extracted Record Items ({selectedRecordForView.items.length})
                  </h4>
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-100 text-xs">
                    {selectedRecordForView.items.map((item, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-[#172554]">{item.name}</span>
                          <span className="text-[11px] text-[#64748B] ml-2">
                            {item.quantity} {item.unit}
                          </span>
                        </div>
                        <span className="font-bold font-mono text-[#172554]">
                          {formatINR(item.total || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => handleDownloadRecord(selectedRecordForView)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#172554] text-xs font-semibold cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download CSV</span>
              </button>
              <button
                type="button"
                id="btn-close-record-view"
                onClick={() => setSelectedRecordForView(null)}
                className="px-5 py-2 rounded-xl bg-[#5046F2] hover:bg-[#4338CA] text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsPage;

