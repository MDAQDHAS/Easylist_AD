import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import { DashboardHeader } from '../components/layout/DashboardHeader';
import { AppSidebar } from '../components/layout/AppSidebar';
import { SettingsPage } from './SettingsPage';
import { StoreInfo } from '../types/order';
import { storage } from '../lib/storage';
import { DEFAULT_STORE } from '../lib/constants';
import { isDemoMode } from '../config';
import { ROUTES } from '../routes/paths';

export const SettingsPageWrapper: React.FC = () => {
  const navigate = useNavigate();
  const [store, setStore] = useState<StoreInfo>(() => {
    return (
      storage.getStore() || {
        id: '',
        name: '',
        ownerName: '',
        phone: '',
        email: '',
        address: '',
      }
    );
  });

  const handleSaveStore = (updated: StoreInfo) => {
    setStore(updated);
    storage.saveStore(updated);
    window.dispatchEvent(new CustomEvent('easylist_store_updated', { detail: updated }));
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] flex flex-col font-sans pb-12 relative overflow-x-hidden">
      {/* 1. Floating Navigation Bar */}
      <div className="relative z-50">
        <DashboardHeader
          variant="dashboard"
          onLogout={() => navigate(ROUTES.LOGIN)}
        />
      </div>

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 w-full max-w-[1348px] mx-auto px-4 xl:px-0 pt-6 sm:pt-8">
        <div className="flex flex-col lg:flex-row items-start gap-6 xl:gap-[47px]">
          {/* Left Sidebar Navigation Card */}
          <AppSidebar activeTab="settings" />

          {/* Right Main Content */}
          <main className="flex-1 min-w-0 w-full max-w-[1094px]">
            {/* Back Link */}
            <div className="mb-4">
              <button
                type="button"
                onClick={() => navigate(ROUTES.DASHBOARD)}
                className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#5046F2] hover:text-[#4338CA] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Dashboard</span>
              </button>
            </div>

            {/* Demo Mode Notice Banner */}
            {isDemoMode && (
              <div className="mb-6 p-3.5 sm:p-4 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs sm:text-sm flex items-start gap-2.5 shadow-2xs">
                <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="leading-relaxed">
                  <span className="font-bold">Demo Mode Active: </span>
                  Store profile changes here are saved locally for this demonstration session.
                  Production shop records and backend databases are never modified.
                </div>
              </div>
            )}

            {/* The Core Settings Form */}
            <SettingsPage
              currentStore={store}
              onSaveStore={handleSaveStore}
            />
          </main>
        </div>
      </div>
    </div>
  );
};

export default SettingsPageWrapper;
