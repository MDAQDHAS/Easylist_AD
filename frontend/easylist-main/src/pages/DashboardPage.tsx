import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Scan, Sparkles } from 'lucide-react';
import { DashboardHeader } from '../components/layout/DashboardHeader';
import { Stepper } from '../components/ui/Stepper';
import { OrderUpload, UploadedFileItem } from '../features/upload/OrderUpload';
import { StoreInfo, OrderWorkflowStep } from '../types/order';
import { ROUTES } from '../routes/paths';
import { useOrderWorkflow } from '../context/OrderWorkflowContext';
import { ocrService, ScanProgressUpdate } from '../services/ocrService';
import { getCurrentUser, onAuthChange } from '../services/authService';
import { loadShopDetails, loadShopMemberships, registerShop } from '../services/shopMembershipService';
import { storage } from '../lib/storage';

interface DashboardPageProps {
  currentStore?: StoreInfo;
}

type MembershipState = 'loading' | 'member' | 'personal';

export const DashboardPage: React.FC<DashboardPageProps> = ({ currentStore }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<OrderWorkflowStep>('upload');
  const [membershipState, setMembershipState] = useState<MembershipState>('loading');
  const [isMembershipLoading, setIsMembershipLoading] = useState(true);
  const [resolvedStoreName, setResolvedStoreName] = useState<string | undefined>(
    currentStore?.name
  );
  const requestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);
  const { uploadedFiles, setUploadedFiles, setItems } = useOrderWorkflow();

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

    const imageFiles: File[] = [];
    for (const item of files) {
      if (!item.file) {
        throw new Error('One or more selected images are no longer available. Please add them again.');
      }
      imageFiles.push(item.file);
    }

    const extractedItems = await ocrService.extractImages(imageFiles, onProgress);
    if (extractedItems.length === 0) {
      throw new Error('No product rows were extracted. Try a clearer image.');
    }

    setItems(extractedItems);
    navigate(ROUTES.REVIEW);
  };

  return (
    <div className="min-h-screen dashboard-bg-pattern flex flex-col font-sans pb-8 sm:pb-10 relative overflow-x-hidden">
      <div className="relative z-50">
        <DashboardHeader
          storeName={
            membershipState === 'member'
              ? currentStore?.name || resolvedStoreName || 'EasyList'
              : resolvedStoreName || 'Personal Workspace'
          }
          isPersonalWorkspace={membershipState === 'personal'}
          onLogout={() => navigate(ROUTES.LOGIN)}
        />
      </div>

      {isMembershipLoading && (
        <div className="flex flex-1 items-center justify-center gap-3 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin text-[#087BFA]" />
          <span>Loading your workspace...</span>
        </div>
      )}

      {!isMembershipLoading && (
        <main className="relative z-10 flex-1 w-full max-w-[970px] mx-auto">
          <div className="flex items-center justify-center max-w-[260px] sm:max-w-[280px] mx-auto mt-2.5 mb-1.5 px-4">
            <div className="h-px bg-slate-300/70 flex-1" />
            <div className="mx-2.5 text-[#5046F2] flex items-center justify-center shrink-0">
              <Scan className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="h-px bg-slate-300/70 flex-1" />
          </div>

          <div className="text-center px-4">
            <h1 className="text-2xl sm:text-[32px] lg:text-[36px] font-bold font-heading text-[#111827] tracking-tight leading-tight">
              Upload Your <span className="text-[#5046F2]">Order</span>
            </h1>
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#EEF2FF] text-[#5046F2] text-xs sm:text-[13px] font-medium mt-2 shadow-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Convert handwritten orders into editable product lists</span>
            </div>
          </div>

          <div className="mt-[18px]">
            <Stepper
              currentStep={step}
              canNavigateToReview={uploadedFiles.length > 0}
              onStepChange={(newStep) => {
                if (newStep === 'review') {
                  navigate(ROUTES.REVIEW);
                } else {
                  setStep(newStep);
                }
              }}
            />
          </div>

          {step === 'upload' && (
            <OrderUpload
              initialFiles={uploadedFiles}
              onProceedToReview={handleProceedToReview}
              onFilesChange={setUploadedFiles}
            />
          )}
        </main>
      )}
    </div>
  );
};

export default DashboardPage;
