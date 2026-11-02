import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Scan,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  FileImage,
  ListOrdered,
  AlertCircle,
} from 'lucide-react';
import { DashboardHeader } from '../components/layout/DashboardHeader';
import { Stepper } from '../components/ui/Stepper';
import { ImageInspector } from '../features/review/ImageInspector';
import { ExtractedItemsTable } from '../features/review/ExtractedItemsTable';
import { useOrderWorkflow } from '../context/OrderWorkflowContext';
import { ROUTES } from '../routes/paths';
import { StoreInfo } from '../types/order';

interface ReviewPageProps {
  currentStore?: StoreInfo;
}

export const ReviewPage: React.FC<ReviewPageProps> = ({
  currentStore,
}) => {
  const navigate = useNavigate();
  const {
    uploadedFiles,
    items,
    activeImageIndex,
    setActiveImageIndex,
    updateItem,
    addItem,
    deleteItem,
    currentLanguage,
    isTranslating,
    translationError,
    toggleLanguage,
    clearTranslationError,
  } = useOrderWorkflow();

  // Mobile active tab view: 'split' on desktop, 'image' | 'list' selectable on small screens
  const [mobileView, setMobileView] = useState<'image' | 'list'>('list');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Validation: at least 1 item with a non-empty name
  const validItems = items.filter((item) => item.name.trim().length > 0);
  const canProceedToExport = validItems.length > 0;

  const handleBackToUpload = () => {
    navigate(ROUTES.DASHBOARD);
  };

  const handleProceedToExport = () => {
    if (!canProceedToExport) {
      setValidationError(
        'Please verify or add at least one valid product item before continuing to export.'
      );
      return;
    }
    setValidationError(null);
    navigate(ROUTES.EXPORT);
  };

  return (
    <div className="min-h-screen dashboard-bg-pattern flex flex-col font-sans pb-10 relative overflow-x-hidden">
      {/* 1. FLOATING NAVIGATION BAR */}
      <div className="relative z-50">
        <DashboardHeader
          storeName={currentStore?.name}
          onLogout={() => navigate(ROUTES.LOGIN)}
        />
      </div>

      {/* 2. MAIN WORKSPACE CONTAINER */}
      <main className="relative z-10 flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6">
        {/* Scan Accent Icon with hairline dividers */}
        <div className="flex items-center justify-center max-w-[260px] sm:max-w-[280px] mx-auto mt-2.5 mb-1.5 px-4">
          <div className="h-px bg-slate-300/70 flex-1"></div>
          <div className="mx-2.5 text-[#5046F2] flex items-center justify-center shrink-0">
            <Scan className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div className="h-px bg-slate-300/70 flex-1"></div>
        </div>

        {/* Heading & Subtitle */}
        <div className="text-center px-4">
          <h1 className="text-2xl sm:text-[32px] lg:text-[36px] font-bold font-heading text-[#111827] tracking-tight leading-tight">
            Extract & <span className="text-[#5046F2]">Review</span>
          </h1>

          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#EEF2FF] text-[#5046F2] text-xs sm:text-[13px] font-medium mt-2 shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Compare your handwritten order with the extracted items</span>
          </div>
        </div>

        {/* 3. STEPPER (Active Step: 2 Extract & Review) */}
        <div className="mt-[18px]">
          <Stepper
            currentStep="review"
            canNavigateToReview={true}
            canNavigateToExport={canProceedToExport}
            onStepChange={(targetStep) => {
              if (targetStep === 'upload') navigate(ROUTES.DASHBOARD);
              if (targetStep === 'export' && canProceedToExport) navigate(ROUTES.EXPORT);
            }}
          />
        </div>

        {/* Mobile View Toggle Bar (Only visible on screens < 1024px) */}
        <div className="lg:hidden flex items-center justify-center mb-4">
          <div className="inline-flex bg-white rounded-xl p-1 border border-[#DCE5F2] shadow-xs w-full max-w-sm">
            <button
              id="mobile-tab-image"
              type="button"
              onClick={() => setMobileView('image')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mobileView === 'image'
                  ? 'bg-[#5046F2] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileImage className="w-3.5 h-3.5" />
              <span>Original Order ({uploadedFiles.length})</span>
            </button>
            <button
              id="mobile-tab-list"
              type="button"
              onClick={() => setMobileView('list')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mobileView === 'list'
                  ? 'bg-[#5046F2] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Extracted List ({items.length})</span>
            </button>
          </div>
        </div>

        {/* Validation Error Alert if continuing with empty list */}
        {validationError && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="flex-1 font-medium">{validationError}</span>
            <button
              type="button"
              onClick={() => setValidationError(null)}
              className="text-amber-700 hover:text-amber-900 text-xs font-bold px-2 py-0.5 rounded cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 4. TWO-COLUMN WORKSPACE: Balanced Split with Wider Extracted Table */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
          {/* Left Column: Original Order Image Inspector (5 cols) */}
          <div className={`lg:col-span-5 ${mobileView === 'list' ? 'hidden lg:block' : 'block'}`}>
            <ImageInspector
              images={uploadedFiles}
              currentIndex={activeImageIndex}
              onIndexChange={setActiveImageIndex}
              onGoToUpload={handleBackToUpload}
            />
          </div>

          {/* Right Column: Extracted Items Table (7 cols for wider product display) */}
          <div className={`lg:col-span-7 ${mobileView === 'image' ? 'hidden lg:block' : 'block'}`}>
            <ExtractedItemsTable
              items={items}
              onUpdateItem={updateItem}
              onAddItem={addItem}
              onDeleteItem={deleteItem}
              currentLanguage={currentLanguage}
              isTranslating={isTranslating}
              translationError={translationError}
              onToggleLanguage={toggleLanguage}
              onDismissTranslationError={clearTranslationError}
            />
          </div>
        </div>

        {/* 5. BOTTOM NAVIGATION ACTION BAR */}
        <div className="mt-6 pt-4 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
          <button
            id="btn-back-to-upload"
            type="button"
            onClick={handleBackToUpload}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#DCE5F2] bg-white hover:bg-slate-50 text-[#111C35] text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Upload</span>
          </button>

          <div className="flex items-center gap-3">
            {!canProceedToExport && items.length > 0 && (
              <span className="text-[11px] text-amber-700 hidden sm:inline-block">
                Enter at least one item name to proceed
              </span>
            )}

            <button
              id="btn-continue-to-export"
              type="button"
              onClick={handleProceedToExport}
              disabled={!canProceedToExport}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer ${
                canProceedToExport
                  ? 'bg-[#5046F2] hover:bg-[#4338CA] active:bg-[#3730A3]'
                  : 'bg-slate-300 cursor-not-allowed opacity-70'
              }`}
            >
              <span>Continue to Export</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ReviewPage;
