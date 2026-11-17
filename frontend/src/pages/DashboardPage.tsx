import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Loader2,
  X,
  FileText,
  Mic,
  ArrowRight,
  Info,
} from 'lucide-react';
import { DashboardHeader } from '../components/layout/DashboardHeader';
import { AppSidebar } from '../components/layout/AppSidebar';
import { UploadedFileItem } from '../features/upload/OrderUpload';
import { PhotoUploadModal } from '../features/upload/PhotoUploadModal';
import { TextOrderModal } from '../features/upload/TextOrderModal';
import { VoiceNoteModal } from '../features/upload/VoiceNoteModal';
import { StoreInfo, OrderItem } from '../types/order';
import { ROUTES } from '../routes/paths';
import { useOrderWorkflow } from '../context/OrderWorkflowContext';
import { ocrService, ScanProgressUpdate } from '../services/ocrService';
import { getCurrentUser, onAuthChange } from '../services/authService';
import {
  loadShopDetails,
  loadShopMemberships,
  registerShop,
} from '../services/shopMembershipService';
import { storage } from '../lib/storage';

interface DashboardPageProps {
  currentStore?: StoreInfo;
}

type MembershipState = 'loading' | 'member' | 'personal';

/* ─── Custom SVGs matching the Figma Reference Screenshot ─── */

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

const SidebarDashboardIcon: React.FC = () => (
  <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="1.5" y="1.5" width="7.2" height="7.2" rx="1.6" fill="#5046F2" />
    <rect x="1.5" y="10.5" width="7.2" height="8" rx="1.6" fill="#5046F2" />
    <rect x="10.8" y="1.5" width="7.2" height="8" rx="1.6" fill="#5046F2" />
    <rect x="10.8" y="11.3" width="7.2" height="7.2" rx="1.6" fill="#5046F2" />
  </svg>
);

const SidebarAccountsIcon: React.FC = () => (
  <svg width="19" height="19" viewBox="0 0 20 22" fill="none" aria-hidden="true">
    <rect x="1.5" y="1" width="17" height="20" rx="2.6" fill="#64748B" />
    <rect x="4" y="3.5" width="12" height="4.2" rx="1" fill="#FFFFFF" />
    <rect x="4" y="10.2" width="2.6" height="2.6" rx="0.6" fill="#FFFFFF" />
    <rect x="8.5" y="10.2" width="2.6" height="2.6" rx="0.6" fill="#FFFFFF" />
    <rect x="4" y="14.8" width="2.6" height="2.6" rx="0.6" fill="#FFFFFF" />
    <rect x="8.5" y="14.8" width="2.6" height="2.6" rx="0.6" fill="#FFFFFF" />
    <rect x="13.2" y="10.2" width="2.8" height="7.2" rx="0.6" fill="#FFFFFF" />
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

const HeaderUploadDocIcon: React.FC = () => (
  <svg width="26" height="28" viewBox="0 0 28 32" fill="none" aria-hidden="true">
    <path
      d="M5 4C5 2.34315 6.34315 1 8 1H16.5V8.5C16.5 10.1569 17.8431 11.5 19.5 11.5H25V28C25 29.6569 23.6569 31 22 31H8C6.34315 31 5 29.6569 5 28V4Z"
      fill="#5046F2"
    />
    <path d="M18.5 1.2L24.8 9.5H19.5C18.9477 9.5 18.5 9.05228 18.5 8.5V1.2Z" fill="#5046F2" />
    <circle cx="19" cy="17.5" r="2.1" fill="#FFFFFF" />
    <path
      d="M7.5 27.5L12.2 21.5L15.8 25.3L18.2 22.8L22.5 27.5H7.5Z"
      fill="#FFFFFF"
    />
  </svg>
);

const ExcelColorIcon: React.FC = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="6" y="2" width="16" height="20" rx="2.5" fill="#21A366" />
    <path d="M6 2H14V12H6V2Z" fill="#33C481" />
    <path d="M14 2H19.5C20.88 2 22 3.12 22 4.5V12H14V2Z" fill="#107C41" opacity="0.35" />
    <path d="M6 12H14V22H8.5C7.12 22 6 20.88 6 19.5V12Z" fill="#185C37" />
    <rect x="2" y="10" width="11" height="11" rx="2" fill="#107C41" />
    <path
      d="M5.1 13L6.9 15.5L5 18H6.5L7.6 16.3L8.7 18H10.2L8.3 15.5L10.1 13H8.6L7.6 14.6L6.6 13H5.1Z"
      fill="#FFFFFF"
    />
  </svg>
);

const PhotoUploadCardIcon: React.FC = () => (
  <svg width="38" height="34" viewBox="0 0 42 36" fill="none" aria-hidden="true">
    {/* Back frame */}
    <path
      d="M4 24V6C4 4.34315 5.34315 3 7 3H29C30.6569 3 32 4.34315 32 6V8H11C7.68629 8 5 10.6863 5 14V26.5C4.4 25.8 4 24.9 4 24Z"
      fill="#6842DB"
    />
    {/* Front frame */}
    <rect x="8" y="10" width="30" height="23" rx="3.5" fill="#6842DB" />
    <circle cx="16.5" cy="17.5" r="3" fill="#EAE0FF" />
    <path
      d="M11 29.5L16.5 23.5L20.5 27.2L27.5 19.8L35 29.5H11Z"
      fill="#EAE0FF"
    />
  </svg>
);

const TextOrderCardIcon: React.FC = () => (
  <svg width="34" height="38" viewBox="0 0 34 38" fill="none" aria-hidden="true">
    <path
      d="M4 5C4 2.79086 5.79086 1 8 1H20.5L30 10.5V33C30 35.2091 28.2091 37 26 37H8C5.79086 37 4 35.2091 4 33V5Z"
      fill="#C46A18"
    />
    <path d="M20.5 2.5V9.5C20.5 10.0523 20.9477 10.5 21.5 10.5H28.5L20.5 2.5Z" fill="#FFE6C2" />
    <rect x="9" y="18" width="16" height="2.6" rx="1.3" fill="#FFE6C2" />
    <rect x="9" y="23" width="16" height="2.6" rx="1.3" fill="#FFE6C2" />
    <rect x="9" y="28" width="10.5" height="2.6" rx="1.3" fill="#FFE6C2" />
  </svg>
);

const VoiceNoteCardIcon: React.FC = () => (
  <svg width="38" height="38" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    {/* Microphone capsule */}
    <rect x="11.5" y="5" width="9" height="17" rx="4.5" fill="#07865D" />
    {/* Microphone U-holder & stand */}
    <path
      d="M7.5 16.5V17.5C7.5 22.1944 11.3056 26 16 26C20.6944 26 24.5 22.1944 24.5 17.5V16.5"
      stroke="#07865D"
      strokeWidth="3"
      strokeLinecap="round"
    />
    <path
      d="M16 26V32.5M10.5 32.5H21.5"
      stroke="#07865D"
      strokeWidth="3"
      strokeLinecap="round"
    />
    {/* Bold 'T' symbol on upper right */}
    <path
      d="M25.5 12H34.5M30 12V22"
      stroke="#07865D"
      strokeWidth="3.2"
      strokeLinecap="round"
    />
  </svg>
);

const AccountsCardIcon: React.FC = () => (
  <svg width="34" height="38" viewBox="0 0 34 38" fill="none" aria-hidden="true">
    <rect x="3" y="1" width="28" height="36" rx="4" fill="#2858D8" />
    <rect x="7.5" y="5.5" width="19" height="8" rx="1.5" fill="#DCE8FF" />
    <rect x="7.5" y="18.5" width="4.2" height="4.2" rx="1" fill="#DCE8FF" />
    <rect x="14.8" y="18.5" width="4.2" height="4.2" rx="1" fill="#DCE8FF" />
    <rect x="7.5" y="26.5" width="4.2" height="4.2" rx="1" fill="#DCE8FF" />
    <rect x="14.8" y="26.5" width="4.2" height="4.2" rx="1" fill="#DCE8FF" />
    <rect x="22.2" y="18.5" width="4.3" height="12.2" rx="1" fill="#DCE8FF" />
  </svg>
);

export const DashboardPage: React.FC<DashboardPageProps> = ({ currentStore }) => {
  const navigate = useNavigate();
  const [membershipState, setMembershipState] = useState<MembershipState>(() =>
    currentStore?.name ? 'member' : 'personal'
  );
  const [isMembershipLoading, setIsMembershipLoading] = useState<boolean>(() =>
    Boolean(getCurrentUser()) && !currentStore?.name
  );
  const [resolvedStoreName, setResolvedStoreName] = useState<string | undefined>(
    currentStore?.name
  );
  const [isPhotoUploadModalOpen, setIsPhotoUploadModalOpen] = useState(false);
  const [isTextOrderModalOpen, setIsTextOrderModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const requestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);
  const { uploadedFiles, setUploadedFiles, items, setItems, setOrderSourceInfo } = useOrderWorkflow();

  const showToast = useCallback((msg: string) => {
    setToastNotice(msg);
    setTimeout(() => {
      setToastNotice((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

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
              const syncedStore: StoreInfo = {
                id: shop.id,
                name: shop.name,
                ownerName: user.displayName || shop.name,
                phone: shop.phone || '',
                email: user.email || '',
                address: cachedStore?.address || '',
                logoUrl: cachedStore?.logoUrl,
              };
              storage.saveStore(syncedStore, user.uid);
              storage.setUser({
                id: user.uid,
                email: user.email || '',
                name: syncedStore.name,
                role: 'owner',
                store: syncedStore,
              });
              window.dispatchEvent(
                new CustomEvent('easylist_store_updated', { detail: syncedStore })
              );
            }
          } catch {
            // Non-fatal: membership is already confirmed even if secondary shop details fetch fails
          }
        } else {
          // Account verified with Shop Name entered during creation -> automatically register shop in database
          const targetShopName = user.displayName?.trim() || 'My Shop';
          try {
            const registered = await registerShop({
              shopName: targetShopName,
              getIdToken: (forceRefresh) => user.getIdToken(forceRefresh),
              apiBaseUrl,
              signal: controller.signal,
            });
            if (mountedRef.current && requestRef.current === controller) {
              setMembershipState('member');
              setResolvedStoreName(registered.shop.name);
              const syncedStore: StoreInfo = {
                id: registered.shop.id,
                name: registered.shop.name,
                ownerName: registered.shop.name,
                phone: registered.shop.phone || '',
                email: user.email || '',
                address: '',
              };
              storage.saveStore(syncedStore, user.uid);
              storage.setUser({
                id: user.uid,
                email: user.email || '',
                name: syncedStore.name,
                role: 'owner',
                store: syncedStore,
              });
              window.dispatchEvent(
                new CustomEvent('easylist_store_updated', { detail: syncedStore })
              );
            }
          } catch {
            // Offline fallback: preserve exact shop name entered during account creation
            setMembershipState('member');
            setResolvedStoreName(targetShopName);
            const cachedStore = storage.getStore(user.uid);
            const fallbackStore: StoreInfo = {
              id: '',
              name: targetShopName,
              ownerName: targetShopName,
              phone: cachedStore?.phone || '',
              email: user.email || '',
              address: '',
            };
            storage.saveStore(fallbackStore, user.uid);
          }
        }
      }
    } catch {
      // Graceful fallback to user-scoped cached shop or profile shop name so users are never blocked
      if (!controller.signal.aborted && mountedRef.current && requestRef.current === controller) {
        const cachedStore = storage.getStore(user.uid);
        const resolvedName = cachedStore?.name || user.displayName?.trim() || 'My Shop';
        setMembershipState('member');
        setResolvedStoreName(resolvedName);
      }
    } finally {
      if (mountedRef.current && requestRef.current === controller) {
        requestRef.current = null;
        setIsMembershipLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
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
  }, [loadMembership]);

  const handleProceedToReview = async (
    files: UploadedFileItem[],
    onProgress?: (update: ScanProgressUpdate) => void
  ) => {
    // 1. Immediately sync selected files to context so they are never lost on network or OCR failure
    setUploadedFiles(files);
    setOrderSourceInfo('image');

    const imageFiles: File[] = [];
    for (const item of files) {
      if (!item.file) {
        throw new Error(
          'One or more selected images are no longer available. Please add them again.'
        );
      }
      imageFiles.push(item.file);
    }

    const extractedItems = await ocrService.extractImages(imageFiles, onProgress);
    if (extractedItems.length === 0) {
      throw new Error('No product rows were extracted. Try a clearer image.');
    }

    setItems(extractedItems);
    setIsPhotoUploadModalOpen(false);
    navigate(ROUTES.RESULTS);
  };

  const handleOpenPhotoUpload = () => {
    setIsPhotoUploadModalOpen(true);
  };

  const handleExcelManagement = () => {
    navigate(ROUTES.EXCEL);
  };

  const handleTextOrderExtracted = (parsedItems: OrderItem[], rawText?: string) => {
    setItems(parsedItems);
    setOrderSourceInfo('text', { text: rawText });
    setIsTextOrderModalOpen(false);
    navigate(ROUTES.RESULTS);
  };

  const handleVoiceOrderExtracted = (
    parsedItems: OrderItem[],
    audioMeta?: { fileName: string; duration?: number; audioUrl?: string }
  ) => {
    setItems(parsedItems);
    setOrderSourceInfo('voice', { audio: audioMeta });
    setIsVoiceModalOpen(false);
    navigate(ROUTES.RESULTS);
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] flex flex-col font-sans pb-10 relative overflow-x-hidden">
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
          <span>Loading your workspace...</span>
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
              activeTab="dashboard"
              onOpenSettings={() => setIsSettingsModalOpen(true)}
              onNavigateTab={(tab) => {
                if (tab === 'dashboard') {
                  setIsPhotoUploadModalOpen(false);
                } else if (tab === 'accounts') {
                  navigate(ROUTES.ACCOUNTS);
                } else if (tab === 'excel') {
                  navigate(ROUTES.EXCEL);
                }
              }}
            />

            {/* Right Main Content Column */}
            <main className="flex-1 min-w-0 w-full max-w-[1094px]">
              {/* Hero Banner Section */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-1 pb-1.5 relative">
                {/* Left Hero Text */}
                <div className="pt-2 md:pt-5 pl-1 sm:pl-3 z-10 max-w-[540px]">
                  <div className="inline-flex items-center gap-1.5 px-4 h-[39px] rounded-full bg-[#EAE8FF] border border-[#DFDCFF] text-[#5046F2] text-[13.5px] font-medium mb-4 shadow-2xs">
                    <span>Welcome Back!</span>
                    <span role="img" aria-label="waving hand">
                      👋
                    </span>
                  </div>

                  <h1 className="text-[28px] sm:text-[36px] xl:text-[42px] font-semibold font-heading text-[#111C35] tracking-[-0.02em] leading-[1.22]">
                    Your Notebook Orders,
                    <span className="block text-[#5046F2] mt-1">Now Made Digital.</span>
                  </h1>

                  <p className="text-[14px] sm:text-[15.5px] text-[#526077] mt-3 font-normal">
                    Make handwritten orders digital, effortlessly.
                  </p>
                </div>

                {/* Right 3D Hero Illustration */}
                <div className="w-full md:w-[450px] xl:w-[490px] shrink-0 flex justify-center md:justify-end md:-mt-3 xl:mr-6 select-none pointer-events-none">
                  <img
                    src="/images/dashboard-hero-illustration.png"
                    alt="Notebook orders converted to digital checklist"
                    className="w-full max-w-[420px] md:max-w-[490px] h-auto object-contain"
                  />
                </div>
              </div>

              {/* Main Card: Upload Order Images */}
              <section
                aria-label="Upload Order Images"
                className="w-full bg-white rounded-[18px] border border-[#E2E8F0] shadow-[0_2px_12px_rgba(17,28,53,0.03)] overflow-hidden"
              >
                {/* Card Header Bar */}
                <div className="bg-[#F6F8FC] border-b border-[#E2E8F0] px-5 sm:px-[26px] py-3.5 sm:h-[75px] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-[48px] h-[48px] sm:w-[54px] sm:h-[54px] rounded-full bg-[#EEF1FF] flex items-center justify-center shrink-0">
                      <HeaderUploadDocIcon />
                    </div>
                    <div>
                      <h2 className="text-[16px] sm:text-[18px] font-bold font-heading text-[#0B0F19] leading-tight">
                        Upload Order Images
                      </h2>
                      <p className="text-[12.5px] sm:text-[14px] text-[#64748B] mt-0.5">
                        Upload handwritten orders for quick digital conversion.
                      </p>
                    </div>
                  </div>

                  <button
                    id="btn-excel-management"
                    type="button"
                    onClick={handleExcelManagement}
                    className="inline-flex items-center gap-2.5 h-[42px] sm:h-[45px] px-4 rounded-[12px] bg-[#F0EDFF] hover:bg-[#E6E1FF] border border-[#DED8FC] text-[#18113C] text-[13.5px] sm:text-[15px] font-medium transition-colors cursor-pointer"
                  >
                    <ExcelColorIcon />
                    <span>Excel Management</span>
                    <ChevronRight className="w-4 h-4 text-[#18113C] stroke-[2.2]" />
                  </button>
                </div>

                {/* Card Body: 4 Feature Cards */}
                <div className="p-5 sm:px-[26px] sm:py-[24px] bg-white">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-[22px] xl:gap-[26px]">
                    {/* Card 1: Photo Upload */}
                    <div
                      onClick={handleOpenPhotoUpload}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleOpenPhotoUpload();
                        }
                      }}
                      className="min-h-[246px] rounded-[14px] border border-[#D6C5FF] bg-linear-to-b from-[#F0E7FF] to-[#DACDFF] px-4 pt-6 pb-4 flex flex-col items-center justify-between text-center transition-transform hover:-translate-y-0.5 cursor-pointer"
                    >
                      <div className="w-[74px] h-[74px] rounded-full bg-[#D4C3FF] flex items-center justify-center shrink-0">
                        <PhotoUploadCardIcon />
                      </div>

                      <div className="w-full mt-3">
                        <h3 className="text-[17px] font-bold font-heading text-[#211548] leading-snug">
                          Photo Upload
                        </h3>
                        <p className="text-[12.5px] text-[#5D4F7E] mt-1">
                          Upload handwritten orders
                        </p>
                        <div className="w-full h-px bg-[#8E80B2]/40 mt-3 mb-3" />
                      </div>

                      <button
                        id="btn-photo-upload-card"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenPhotoUpload();
                        }}
                        className="h-[38px] px-5 rounded-full bg-linear-to-r from-[#8359F4] to-[#5736D1] hover:opacity-95 text-white text-[13.5px] font-medium inline-flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <span>Upload Image</span>
                        <ChevronRight className="w-4 h-4 stroke-[2.2]" />
                      </button>
                    </div>

                    {/* Card 2: Text Order */}
                    <div
                      onClick={() => setIsTextOrderModalOpen(true)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setIsTextOrderModalOpen(true);
                        }
                      }}
                      className="min-h-[246px] rounded-[14px] border border-[#F3CCA4] bg-linear-to-b from-[#FEEFD7] to-[#FFD9B6] px-4 pt-6 pb-4 flex flex-col items-center justify-between text-center transition-transform hover:-translate-y-0.5 cursor-pointer"
                    >
                      <div className="w-[74px] h-[74px] rounded-full bg-[#FFD29D] flex items-center justify-center shrink-0">
                        <TextOrderCardIcon />
                      </div>

                      <div className="w-full mt-3">
                        <h3 className="text-[17px] font-bold font-heading text-[#3B1D06] leading-snug">
                          Text Order
                        </h3>
                        <p className="text-[12.5px] text-[#725439] mt-1">
                          Paste or type customer orders
                        </p>
                        <div className="w-full h-px bg-[#AE8E72]/40 mt-3 mb-3" />
                      </div>

                      <button
                        id="btn-text-order-card"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsTextOrderModalOpen(true);
                        }}
                        className="h-[38px] px-5 rounded-full bg-linear-to-r from-[#F6A521] to-[#D75C0A] hover:opacity-95 text-white text-[13.5px] font-medium inline-flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <span>Enter Order</span>
                        <ChevronRight className="w-4 h-4 stroke-[2.2]" />
                      </button>
                    </div>

                    {/* Card 3: Voice Note */}
                    <div
                      onClick={() => setIsVoiceModalOpen(true)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setIsVoiceModalOpen(true);
                        }
                      }}
                      className="min-h-[246px] rounded-[14px] border border-[#A6E3C8] bg-linear-to-b from-[#DDF8EB] to-[#BDEED9] px-4 pt-6 pb-4 flex flex-col items-center justify-between text-center transition-transform hover:-translate-y-0.5 cursor-pointer"
                    >
                      <div className="w-[74px] h-[74px] rounded-full bg-[#A9EBCB] flex items-center justify-center shrink-0">
                        <VoiceNoteCardIcon />
                      </div>

                      <div className="w-full mt-3">
                        <h3 className="text-[17px] font-bold font-heading text-[#083326] leading-snug">
                          Voice Note
                        </h3>
                        <p className="text-[12.5px] text-[#3E6B5C] mt-1">
                          Upload or record voice orders
                        </p>
                        <div className="w-full h-px bg-[#7AA898]/40 mt-3 mb-3" />
                      </div>

                      <button
                        id="btn-voice-note-card"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsVoiceModalOpen(true);
                        }}
                        className="h-[38px] px-5 rounded-full bg-linear-to-r from-[#0FB37D] to-[#047D5A] hover:opacity-95 text-white text-[13.5px] font-medium inline-flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <span>Add Voice Note</span>
                        <ChevronRight className="w-4 h-4 stroke-[2.2]" />
                      </button>
                    </div>

                    {/* Card 4: Accounts */}
                    <div
                      onClick={() => navigate(ROUTES.ACCOUNTS)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(ROUTES.ACCOUNTS);
                        }
                      }}
                      className="min-h-[246px] rounded-[14px] border border-[#B5CEFF] bg-linear-to-b from-[#E1ECFF] to-[#C7D9FF] px-4 pt-6 pb-4 flex flex-col items-center justify-between text-center transition-transform hover:-translate-y-0.5 cursor-pointer"
                    >
                      <div className="w-[74px] h-[74px] rounded-full bg-[#BBD0FF] flex items-center justify-center shrink-0">
                        <AccountsCardIcon />
                      </div>

                      <div className="w-full mt-3">
                        <h3 className="text-[17px] font-bold font-heading text-[#11224D] leading-snug">
                          Accounts
                        </h3>
                        <p className="text-[12.5px] text-[#4A608A] mt-1">
                          Digitise account notes.
                        </p>
                        <div className="w-full h-px bg-[#839AC4]/40 mt-3 mb-3" />
                      </div>

                      <button
                        id="btn-accounts-card"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(ROUTES.ACCOUNTS);
                        }}
                        className="h-[38px] px-5 rounded-full bg-linear-to-r from-[#4384F6] to-[#1F52DB] hover:opacity-95 text-white text-[13.5px] font-medium inline-flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <span>Manage Accounts</span>
                        <ChevronRight className="w-4 h-4 stroke-[2.2]" />
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </main>
          </div>
        </div>
      )}

      {/* Photo Upload Popup Modal */}
      <PhotoUploadModal
        isOpen={isPhotoUploadModalOpen}
        onClose={() => setIsPhotoUploadModalOpen(false)}
        initialFiles={uploadedFiles}
        onFilesChange={setUploadedFiles}
        onExtractOrder={handleProceedToReview}
      />

      {/* Text Order Popup Modal */}
      <TextOrderModal
        isOpen={isTextOrderModalOpen}
        onClose={() => setIsTextOrderModalOpen(false)}
        onExtractOrder={handleTextOrderExtracted}
      />

      {/* Voice Note Modal */}
      <VoiceNoteModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onExtractOrder={handleVoiceOrderExtracted}
      />
    </div>
  );
};

export default DashboardPage;
