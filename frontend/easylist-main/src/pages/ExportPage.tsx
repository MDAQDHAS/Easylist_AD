import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Scan,
  Sparkles,
  FileText,
  Table,
  FileSpreadsheet,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { DashboardHeader } from '../components/layout/DashboardHeader';
import { Stepper } from '../components/ui/Stepper';
import { OrderExportTable } from '../features/export/OrderExportTable';
import { useOrderWorkflow } from '../context/OrderWorkflowContext';
import { exportService } from '../services/exportService';
import { ROUTES } from '../routes/paths';
import { StoreInfo } from '../types/order';
import { storage } from '../lib/storage';

interface ExportPageProps {
  currentStore?: StoreInfo;
}

export const ExportPage: React.FC<ExportPageProps> = ({
  currentStore,
}) => {
  const navigate = useNavigate();
  const { items, clearWorkflow } = useOrderWorkflow();
  const [toastMessage, setToastMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [showConfirmReset, setShowConfirmReset] = useState<boolean>(false);

  const resolvedStore =
    currentStore ||
    storage.getStore() ||
    storage.getUser()?.store || {
      id: '',
      name: 'EasyList Shop',
      ownerName: '',
      phone: '',
      email: '',
      address: '',
    };

  const displayItems = items.filter((item) => item.name.trim().length > 0);

  const exportData = {
    items: displayItems,
    storeName: resolvedStore.name,
    orderNumber: undefined, // Only include Order ID if genuinely available from backend; do NOT generate random IDs
    date: new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    storeAddress: resolvedStore.address,
    storePhone: resolvedStore.phone,
  };

  const showToast = (text: string, isError = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Download handlers
  const handleDownloadPdf = () => {
    try {
      exportService.exportToPdf(exportData);
      showToast('PDF Document downloaded successfully');
    } catch (err) {
      console.error(err);
      showToast('Failed to generate PDF document', true);
    }
  };

  const handleDownloadExcel = () => {
    try {
      exportService.exportToExcel(exportData);
      showToast('Excel Spreadsheet (.xlsx) downloaded successfully');
    } catch (err) {
      console.error(err);
      showToast('Failed to generate Excel spreadsheet', true);
    }
  };

  const handleDownloadCsv = () => {
    try {
      exportService.exportToCsv(exportData);
      showToast('CSV File downloaded successfully');
    } catch (err) {
      console.error(err);
      showToast('Failed to generate CSV file', true);
    }
  };

  const handleDownloadTxt = () => {
    try {
      exportService.exportToTxt(exportData);
      showToast('Text File (.txt) downloaded successfully');
    } catch (err) {
      console.error(err);
      showToast('Failed to generate Text file', true);
    }
  };

  // Navigation handlers
  const handleBackToReview = () => {
    navigate(ROUTES.REVIEW);
  };

  const handleConfirmStartNewOrder = () => {
    clearWorkflow();
    setShowConfirmReset(false);
    navigate(ROUTES.DASHBOARD);
  };

  if (displayItems.length === 0) {
    return <Navigate to={ROUTES.REVIEW} replace />;
  }

  return (
    <div className="min-h-screen dashboard-bg-pattern flex flex-col font-sans pb-12 relative overflow-x-hidden">
      {/* 1. FLOATING NAVIGATION BAR */}
      <div className="relative z-50">
        <DashboardHeader
          storeName={resolvedStore.name}
          onLogout={() => navigate(ROUTES.LOGIN)}
        />
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 right-4 sm:right-8 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-lg border ${
              toastMessage.isError
                ? 'bg-rose-900 text-white border-rose-700'
                : 'bg-slate-900 text-white border-slate-700'
            }`}
          >
            {toastMessage.isError ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* 2. MAIN WORKSPACE CONTAINER */}
      <main className="relative z-10 flex-1 w-full max-w-[1140px] mx-auto px-4 sm:px-6">
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
            Your Order is <span className="text-[#5046F2]">Ready</span>
          </h1>

          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#EEF2FF] text-[#5046F2] text-xs sm:text-[13px] font-medium mt-2 shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Review your items and choose how to export them.</span>
          </div>
        </div>

        {/* 3. STEPPER (Active Step: 3 Export) */}
        <div className="mt-[18px] mb-6">
          <Stepper
            currentStep="export"
            canNavigateToReview={true}
            canNavigateToExport={true}
            onStepChange={(targetStep) => {
              if (targetStep === 'upload') navigate(ROUTES.DASHBOARD);
              if (targetStep === 'review') navigate(ROUTES.REVIEW);
            }}
          />
        </div>

        {/* 4. TWO-COLUMN WORKSPACE: 70% Product List / 30% Download Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-5 sm:gap-6 items-start">
          {/* LEFT COLUMN (~70% width): Final Order List Card */}
          <div className="lg:col-span-7 w-full order-1">
            <OrderExportTable
              items={displayItems}
              onEditItems={handleBackToReview}
              onToast={showToast}
            />
          </div>

          {/* RIGHT COLUMN (~30% width): Download Order Card */}
          <div className="lg:col-span-3 w-full order-2">
            <div className="w-full bg-white rounded-[22px] border border-[#DCE5F2] shadow-xs p-5 sm:p-6 flex flex-col transition-all">
              {/* Header */}
              <div className="pb-3.5 border-b border-slate-100">
                <h2 className="text-base sm:text-lg font-bold font-heading text-[#111827] leading-tight">
                  Download Order
                </h2>
                <p className="text-xs text-[#64748B] mt-1 leading-snug">
                  Download your finalized order with shop details.
                </p>
              </div>

              {/* Four Vertically Arranged Compact Format Rows */}
              <div className="py-3.5 space-y-2.5">
                {/* 1. PDF Document */}
                <button
                  id="btn-download-pdf"
                  type="button"
                  onClick={handleDownloadPdf}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200/90 hover:border-[#5046F2] hover:bg-[#F8FAFF] transition-all cursor-pointer group text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#EEF2FF] text-[#5046F2] flex items-center justify-center shrink-0 group-hover:bg-[#5046F2] group-hover:text-white transition-colors">
                      <FileText className="w-4.5 h-4.5 stroke-[2]" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-[13px] font-bold text-[#111827] block group-hover:text-[#5046F2] transition-colors">
                        PDF Document
                      </span>
                      <span className="text-[11px] text-[#64748B] block truncate">
                        Print / Save as PDF (Tamil Unicode)
                      </span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-lg text-slate-400 group-hover:text-[#5046F2] group-hover:bg-indigo-50 flex items-center justify-center shrink-0 transition-colors ml-2">
                    <Download className="w-3.5 h-3.5" />
                  </div>
                </button>

                {/* 2. Excel Spreadsheet */}
                <button
                  id="btn-download-excel"
                  type="button"
                  onClick={handleDownloadExcel}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200/90 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all cursor-pointer group text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <Table className="w-4.5 h-4.5 stroke-[2]" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-[13px] font-bold text-[#111827] block group-hover:text-emerald-700 transition-colors">
                        Excel Spreadsheet
                      </span>
                      <span className="text-[11px] text-[#64748B] block truncate">
                        Styled .xlsx with column widths
                      </span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-lg text-slate-400 group-hover:text-emerald-600 group-hover:bg-emerald-50 flex items-center justify-center shrink-0 transition-colors ml-2">
                    <Download className="w-3.5 h-3.5" />
                  </div>
                </button>

                {/* 3. CSV File */}
                <button
                  id="btn-download-csv"
                  type="button"
                  onClick={handleDownloadCsv}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200/90 hover:border-blue-500 hover:bg-blue-50/30 transition-all cursor-pointer group text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <FileSpreadsheet className="w-4.5 h-4.5 stroke-[2]" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-[13px] font-bold text-[#111827] block group-hover:text-blue-700 transition-colors">
                        CSV File
                      </span>
                      <span className="text-[11px] text-[#64748B] block truncate">
                        Clean format for billing import
                      </span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-lg text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 flex items-center justify-center shrink-0 transition-colors ml-2">
                    <Download className="w-3.5 h-3.5" />
                  </div>
                </button>

                {/* 4. Text File */}
                <button
                  id="btn-download-txt"
                  type="button"
                  onClick={handleDownloadTxt}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200/90 hover:border-slate-500 hover:bg-slate-50 transition-all cursor-pointer group text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:bg-slate-700 group-hover:text-white transition-colors">
                      <FileText className="w-4.5 h-4.5 stroke-[2]" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-[13px] font-bold text-[#111827] block group-hover:text-slate-900 transition-colors">
                        Text File
                      </span>
                      <span className="text-[11px] text-[#64748B] block truncate">
                        Clean numbered list (.txt)
                      </span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-lg text-slate-400 group-hover:text-slate-700 group-hover:bg-slate-200 flex items-center justify-center shrink-0 transition-colors ml-2">
                    <Download className="w-3.5 h-3.5" />
                  </div>
                </button>
              </div>

              {/* Supporting Note & Start New Order Action */}
              <div className="pt-3 border-t border-slate-100">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-[#64748B] leading-relaxed">
                  Documents include shop name, date and order details.
                </div>

                <button
                  id="btn-start-new-order"
                  type="button"
                  onClick={() => setShowConfirmReset(true)}
                  className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#DCE5F2] hover:bg-slate-50 text-[#111C35] text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Start New Order</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Confirmation Modal for Start New Order */}
      {showConfirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-[#DCE5F2] p-5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
              <RotateCcw className="w-5 h-5 stroke-[2.2]" />
            </div>
            <h3 className="text-base font-bold font-heading text-[#111827]">
              Start New Order?
            </h3>
            <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
              This will clear the current verified order list and return to the upload screen. Ensure you have copied or downloaded your order first.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmReset(false)}
                className="px-3.5 py-2 rounded-xl border border-[#DCE5F2] text-[#111C35] hover:bg-slate-50 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-start-new"
                type="button"
                onClick={handleConfirmStartNewOrder}
                className="px-3.5 py-2 rounded-xl bg-[#5046F2] hover:bg-[#4338CA] text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
              >
                Start New Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportPage;
