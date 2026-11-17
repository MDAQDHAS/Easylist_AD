import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../routes/paths';

export interface AppSidebarProps {
  activeTab: 'dashboard' | 'accounts' | 'excel' | 'settings';
  onNavigateTab?: (tab: 'dashboard' | 'accounts' | 'excel' | 'settings') => void;
  onOpenSettings?: () => void;
}

export const SidebarDashboardIcon: React.FC<{ isActive?: boolean }> = ({ isActive }) => (
  <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="1.5" y="1.5" width="7.2" height="7.2" rx="1.6" fill={isActive ? '#5046F2' : '#64748B'} />
    <rect x="1.5" y="10.5" width="7.2" height="8" rx="1.6" fill={isActive ? '#5046F2' : '#64748B'} />
    <rect x="10.8" y="1.5" width="7.2" height="8" rx="1.6" fill={isActive ? '#5046F2' : '#64748B'} />
    <rect x="10.8" y="11.3" width="7.2" height="7.2" rx="1.6" fill={isActive ? '#5046F2' : '#64748B'} />
  </svg>
);

export const SidebarAccountsIcon: React.FC<{ isActive?: boolean }> = ({ isActive }) => (
  <svg width="19" height="19" viewBox="0 0 20 22" fill="none" aria-hidden="true">
    <rect x="1.5" y="1" width="17" height="20" rx="2.6" fill={isActive ? '#5046F2' : '#64748B'} />
    <rect x="4" y="3.5" width="12" height="4.2" rx="1" fill="#FFFFFF" />
    <rect x="4" y="10.2" width="2.6" height="2.6" rx="0.6" fill="#FFFFFF" />
    <rect x="8.5" y="10.2" width="2.6" height="2.6" rx="0.6" fill="#FFFFFF" />
    <rect x="4" y="14.8" width="2.6" height="2.6" rx="0.6" fill="#FFFFFF" />
    <rect x="8.5" y="14.8" width="2.6" height="2.6" rx="0.6" fill="#FFFFFF" />
    <rect x="13.2" y="10.2" width="2.8" height="7.2" rx="0.6" fill="#FFFFFF" />
  </svg>
);

export const SidebarExcelIcon: React.FC<{ isActive?: boolean }> = ({ isActive }) => (
  <svg width="19" height="19" viewBox="0 0 22 20" fill="none" aria-hidden="true">
    <path
      d="M2 3.6C2 3.08 2.39 2.65 2.9 2.58L13.2 1.2C13.81 1.12 14.35 1.59 14.35 2.21V17.79C14.35 18.41 13.81 18.88 13.2 18.8L2.9 17.42C2.39 17.35 2 16.92 2 16.4V3.6Z"
      fill={isActive ? '#0D9668' : '#64748B'}
    />
    <path
      d="M15.8 3.5H19.2C19.75 3.5 20.2 3.95 20.2 4.5V15.5C20.2 16.05 19.75 16.5 19.2 16.5H15.8V3.5Z"
      fill={isActive ? '#0D9668' : '#64748B'}
    />
    <path
      d="M5.7 6.8L8.1 10L5.6 13.2H7.4L9.1 10.9L10.8 13.2H12.6L10.1 10L12.5 6.8H10.7L9.1 9L7.5 6.8H5.7Z"
      fill="#FFFFFF"
    />
  </svg>
);

export const SidebarSettingsIcon: React.FC<{ isActive?: boolean }> = ({ isActive }) => (
  <svg width="19" height="19" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <path
      d="M9.85 1.82C10.56 1.41 11.44 1.41 12.15 1.82L18.35 5.4C19.06 5.81 19.5 6.57 19.5 7.39V14.61C19.5 15.43 19.06 16.19 18.35 16.6L12.15 20.18C11.44 20.59 10.56 20.59 9.85 20.18L3.65 16.6C2.94 16.19 2.5 15.43 2.5 14.61V7.39C2.5 6.57 2.94 5.81 3.65 5.4L9.85 1.82Z"
      fill={isActive ? '#5046F2' : '#64748B'}
    />
    <circle cx="11" cy="11" r="3.1" fill="#FFFFFF" />
  </svg>
);

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeTab,
  onNavigateTab,
  onOpenSettings,
}) => {
  const navigate = useNavigate();

  const handleNav = (tab: 'dashboard' | 'accounts' | 'excel' | 'settings', path: string) => {
    if (onNavigateTab) {
      onNavigateTab(tab);
    } else {
      navigate(path);
    }
  };

  return (
    <aside
      aria-label="Dashboard Navigation"
      className="w-full lg:w-[196px] lg:min-h-[299px] bg-white rounded-[14px] border border-[#EAEEF5] shadow-[0_2px_10px_rgba(17,28,53,0.03)] p-2.5 lg:px-4 lg:py-6 flex lg:flex-col items-center lg:items-stretch justify-start lg:justify-center gap-2 lg:gap-4 overflow-x-auto shrink-0"
    >
      <button
        id="nav-dashboard"
        type="button"
        onClick={() => handleNav('dashboard', ROUTES.DASHBOARD)}
        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] font-medium text-[15px] transition-colors cursor-pointer shrink-0 ${
          activeTab === 'dashboard'
            ? 'bg-[#EEEAFE] text-[#5046F2] font-bold'
            : 'text-[#5A6578] hover:text-[#111C35] hover:bg-slate-50'
        }`}
      >
        <SidebarDashboardIcon isActive={activeTab === 'dashboard'} />
        <span>Dashboard</span>
      </button>

      <button
        id="nav-accounts"
        type="button"
        onClick={() => handleNav('accounts', ROUTES.ACCOUNTS)}
        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] font-medium text-[15px] transition-colors cursor-pointer shrink-0 ${
          activeTab === 'accounts'
            ? 'bg-[#EEEAFE] text-[#5046F2] font-bold'
            : 'text-[#5A6578] hover:text-[#111C35] hover:bg-slate-50'
        }`}
      >
        <SidebarAccountsIcon isActive={activeTab === 'accounts'} />
        <span>Accounts</span>
      </button>

      <button
        id="nav-excel"
        type="button"
        onClick={() => handleNav('excel', ROUTES.EXCEL)}
        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] font-medium text-[15px] transition-colors cursor-pointer shrink-0 ${
          activeTab === 'excel'
            ? 'bg-[#E3F7EF] text-[#0D9668] font-bold'
            : 'text-[#5A6578] hover:text-[#111C35] hover:bg-slate-50'
        }`}
      >
        <SidebarExcelIcon isActive={activeTab === 'excel'} />
        <span>Excel</span>
      </button>

      <button
        id="nav-settings"
        type="button"
        onClick={() => {
          if (onOpenSettings) {
            onOpenSettings();
          } else {
            window.dispatchEvent(new CustomEvent('easylist_open_settings'));
          }
        }}
        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] font-medium text-[15px] transition-colors cursor-pointer shrink-0 ${
          activeTab === 'settings'
            ? 'bg-[#EEEAFE] text-[#5046F2] font-bold'
            : 'text-[#5A6578] hover:text-[#111C35] hover:bg-slate-50'
        }`}
      >
        <SidebarSettingsIcon isActive={activeTab === 'settings'} />
        <span>Settings</span>
      </button>
    </aside>
  );
};
