import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, Settings, LogOut, Headphones, Info } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { ROUTES } from '../../routes/paths';
import { ContactSupportModal } from '../ui/ContactSupportModal';
import { ShopSettingsModal } from '../ui/ShopSettingsModal';
import { AboutModal } from '../ui/AboutModal';
import { storage } from '../../lib/storage';
import { StoreInfo } from '../../types/order';
import { signOutUser, getCurrentUser } from '../../services/authService';
import { useShopProfile } from '../../hooks/useShopProfile';

export interface DashboardHeaderProps {
  storeName?: string;
  isPersonalWorkspace?: boolean;
  onLogout?: () => void;
  variant?: 'dashboard' | 'default';
  externalSettingsOpen?: boolean;
  onExternalSettingsClose?: () => void;
  currentStore?: StoreInfo;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  storeName,
  isPersonalWorkspace,
  onLogout,
  variant = 'dashboard',
  externalSettingsOpen,
  onExternalSettingsClose,
  currentStore,
}) => {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const _isDashboardVariant = variant === 'dashboard';
  const effectiveSettingsOpen = isSettingsModalOpen || Boolean(externalSettingsOpen);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; right: number } | null>(null);
  const [imageError, setImageError] = useState(false);

  // Single authoritative shop profile data source for the authenticated account
  const profile = useShopProfile(currentStore);

  useEffect(() => {
    const handleOpenSettingsEvent = () => {
      setIsSettingsModalOpen(true);
    };
    window.addEventListener('easylist_open_settings', handleOpenSettingsEvent);

    return () => {
      window.removeEventListener('easylist_open_settings', handleOpenSettingsEvent);
    };
  }, []);

  // Authenticated shop details resolution - strictly uniform across all application screens
  const activeStoreName =
    storeName?.trim() ||
    profile.shopName ||
    'My Shop';
  const activeEmail = profile.email;
  const activePhone = profile.phone;
  const logoUrl = profile.logoUrl;
  const initials =
    activeStoreName
      .trim()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || 'EL';

  // Position calculation: directly below button (8px gap), aligned to right edge, clamped for viewport safety
  const updateDropdownPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = 270;
    const top = rect.bottom + 8;

    // Calculate right offset from window edge
    const rightFromWindow = window.innerWidth - rect.right;
    // Ensure the menu doesn't overflow the left or right edges of viewport
    const clampedRight = Math.max(12, Math.min(rightFromWindow, window.innerWidth - dropdownWidth - 12));

    setDropdownCoords({
      top,
      right: clampedRight,
    });
  }, []);

  // Recalculate position on open, scroll, or window resize
  useEffect(() => {
    if (dropdownOpen) {
      updateDropdownPosition();
      window.addEventListener('resize', updateDropdownPosition);
      window.addEventListener('scroll', updateDropdownPosition, true);
    }
    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [dropdownOpen, updateDropdownPosition]);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  const handleSignOut = async () => {
    setDropdownOpen(false);
    const user = getCurrentUser();
    const storedUser = storage.getUser();
    const effectiveUid = user?.uid || storedUser?.id;
    try {
      await signOutUser();
    } catch (err) {
      console.warn('Sign out error:', err);
    }
    storage.setUser(null);
    storage.clearStore(effectiveUid);
    if (onLogout) {
      onLogout();
    }
    navigate(ROUTES.LOGIN, { replace: true });
  };

  const handleOpenSettings = () => {
    setDropdownOpen(false);
    setIsSettingsModalOpen(true);
  };

  const handleOpenSupport = () => {
    setDropdownOpen(false);
    setIsSupportModalOpen(true);
  };

  return (
    <header className="w-full max-w-[1348px] mx-auto pt-4 sm:pt-[33px] pb-0 px-4 xl:px-0 relative z-50">
      <div className="bg-[#111C35] text-white rounded-[16px] h-[63px] px-5 sm:px-7 flex items-center justify-between shadow-[0_8px_25px_rgba(17,28,53,0.16)] border border-white/10">
        {/* Logo on the left */}
        <Link to={ROUTES.DASHBOARD} className="flex items-center gap-3 group">
          <img
            src="/images/EasyList logo.png"
            alt="EasyList Logo"
            className="w-9 h-9 rounded-full object-contain shadow-sm"
          />
          <span className="text-[19px] sm:text-[21px] font-bold font-heading tracking-tight text-white select-none">
            Easy
            <span className="text-[#3B9BFF]">
              List
            </span>
          </span>
        </Link>

        {/* Shop profile dropdown trigger on the right */}
        <div className="relative">
          <button
            ref={buttonRef}
            id="btn-shop-profile-trigger"
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-3 hover:opacity-90 py-1.5 px-2 rounded-full transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3B9BFF]/50"
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            {/* Shop Initials or Uploaded Logo */}
            {logoUrl && !imageError ? (
              <img
                src={logoUrl}
                alt={activeStoreName}
                onError={() => setImageError(true)}
                className="w-[37px] h-[37px] rounded-full object-cover shrink-0 border border-white/20 shadow-xs"
              />
            ) : (
              <div className="w-[37px] h-[37px] rounded-full bg-[#E0E7FF] text-[#282466] font-bold text-[13.5px] flex items-center justify-center shrink-0 shadow-xs">
                {initials}
              </div>
            )}

            {/* Shop Name */}
            <span className="text-xs sm:text-[15px] font-semibold text-white tracking-wide max-w-[150px] sm:max-w-none truncate">
              {activeStoreName}
            </span>

            {/* Small Chevron Icon */}
            <span className="w-[22px] h-[22px] rounded-full border-[1.5px] border-white/85 flex items-center justify-center shrink-0 ml-1">
              <ChevronDown
                className={`w-3.5 h-3.5 text-white stroke-[2.2] transition-transform duration-200 ${
                  dropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Redesigned Compact SaaS Dropdown Menu Rendered in React Portal to escape any stacking context */}
      {dropdownOpen &&
        dropdownCoords &&
        createPortal(
          <div
            ref={menuRef}
            id="menu-shop-profile-dropdown"
            style={{
              position: 'fixed',
              top: `${dropdownCoords.top}px`,
              right: `${dropdownCoords.right}px`,
              zIndex: 100,
              width: 'min(270px, calc(100vw - 24px))',
            }}
            className="bg-white rounded-[14px] shadow-[0_12px_40px_rgba(17,28,53,0.18)] border border-[#E2E8F0] p-2.5 text-[#111827] animate-in fade-in zoom-in-95 duration-150"
            role="menu"
            aria-orientation="vertical"
          >
            {/* Top Section */}
            <div className="flex items-center gap-2.5 px-2.5 py-1.5">
              {logoUrl && !imageError ? (
                <img
                  src={logoUrl}
                  alt={activeStoreName}
                  onError={() => setImageError(true)}
                  className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#EEF2FF] text-[#5046F2] font-bold text-xs flex items-center justify-center shrink-0">
                  {initials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-[#64748B] tracking-wider block">
                    {isPersonalWorkspace ? 'PERSONAL WORKSPACE' : 'SHOP PROFILE'}
                  </span>
                  {isPersonalWorkspace && (
                    <span className="text-[9px] font-semibold bg-[#EEF2FF] text-[#5046F2] px-1.5 py-0.5 rounded">
                      Personal
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-[#111C35] truncate mt-0.5">
                  {activeStoreName}
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-slate-100 my-1.5" />

            {/* Menu Items: Shop Settings -> Contact Support -> About -> Sign Out */}
            <div className="space-y-0.5">
              <button
                id="btn-header-shop-settings"
                type="button"
                onClick={handleOpenSettings}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-[#111C35] hover:bg-blue-50/70 hover:text-[#5046F2] rounded-lg transition-colors cursor-pointer text-left"
                role="menuitem"
              >
                <Settings className="w-4 h-4 text-[#5046F2]" />
                <span>{isPersonalWorkspace ? 'Workspace Settings' : 'Shop Settings'}</span>
              </button>

              <button
                id="btn-header-contact-support"
                type="button"
                onClick={handleOpenSupport}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-[#111C35] hover:bg-blue-50/70 hover:text-[#5046F2] rounded-lg transition-colors cursor-pointer text-left"
                role="menuitem"
              >
                <Headphones className="w-4 h-4 text-[#5046F2]" />
                <span>Contact Support</span>
              </button>

              <button
                id="btn-header-about"
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  setIsAboutModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-[#111C35] hover:bg-blue-50/70 hover:text-[#5046F2] rounded-lg transition-colors cursor-pointer text-left"
                role="menuitem"
              >
                <Info className="w-4 h-4 text-[#5046F2]" />
                <span>About</span>
              </button>

              <button
                id="btn-header-sign-out"
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer text-left"
                role="menuitem"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* EasyList Contact Support Popup */}
      <ContactSupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
      />

      {/* EasyList About Popup */}
      <AboutModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
      />

      {/* EasyList Premium Shop Settings Popup */}
      <ShopSettingsModal
        isOpen={effectiveSettingsOpen}
        onClose={() => {
          setIsSettingsModalOpen(false);
          onExternalSettingsClose?.();
          buttonRef.current?.focus();
        }}
        currentStore={profile.store}
        onSaveStore={async (updated) => {
          await profile.saveShopProfile(updated);
        }}
      />
    </header>
  );
};

export default DashboardHeader;