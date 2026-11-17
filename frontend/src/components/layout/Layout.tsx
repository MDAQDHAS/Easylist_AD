import React from 'react';
import { DashboardHeader } from './DashboardHeader';
import { StoreInfo } from '../../types/order';

interface LayoutProps {
  children: React.ReactNode;
  currentStore: StoreInfo;
  activeTab?: 'new-order' | 'history' | 'settings';
  onNavigate?: (tab: 'new-order' | 'history' | 'settings') => void;
  onLogout?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentStore,
  onLogout,
}) => {
  return (
    <div className="min-h-screen bg-[#F5F7FB] flex flex-col font-sans pb-10 relative overflow-x-hidden">
      <div className="relative z-50">
        <DashboardHeader
          variant="dashboard"
          currentStore={currentStore}
          onLogout={onLogout}
        />
      </div>

      <main className="flex-1 w-full max-w-[1348px] mx-auto px-4 xl:px-0 pt-6 pb-12">
        {children}
      </main>

      <footer className="no-print text-center py-6 text-xs text-slate-400 border-t border-slate-200 bg-white">
        A product by <strong className="text-slate-600 font-semibold">Avenzo Technologies</strong> · EasyList
      </footer>
    </div>
  );
};
