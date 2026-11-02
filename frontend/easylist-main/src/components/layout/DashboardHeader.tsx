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
import { updateShopDetails, registerShop } from '../../services/shopMembershipService';

interface DashboardHeaderProps {
  storeName?: string;
  isPersonalWorkspace?: boolean;
  onLogout?: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  storeName,
  isPersonalWorkspace,
  onLogout,
}) => {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; right: number } | null>(null);

  // Authenticated user resolution
  const firebaseUser = getCurrentUser();
  const storedUser = storage.getUser();
  const effectiveUid = firebaseUser?.uid || storedUser?.id;

  // Dynamic store profile state with event synchronization (strictly scoped to user)
  const [store, setStore] = useState<StoreInfo | null>(() => storage.getStore(effectiveUid));
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const handleStoreUpdate = (e?: Event) => {
      const customEvt = e as CustomEvent;
      if (customEvt?.detail) {
        setStore(customEvt.detail);
      } else {
        setStore(storage.getStore(effectiveUid));
      }
      setImageError(false);
    };

    window.addEventListener('easylist_store_updated', handleStoreUpdate);
    window.addEventListener('storage', handleStoreUpdate);
    return () => {
      window.removeEventListener('easylist_store_updated', handleStoreUpdate);
      window.removeEventListener('storage', handleStoreUpdate);
    };
  }, [effectiveUid]);

  // Authenticated shop details resolution - strictly tied to currently authenticated account
  const activeStoreName =
    storeName ||
    store?.name ||
    firebaseUser?.displayName ||
    storedUser?.store?.name ||
    storedUser?.name ||
    'My Shop';
  const activeEmail = firebaseUser?.email || storedUser?.email || store?.email || '';
  const activePhone = store?.phone || storedUser?.store?.phone || '';
  const logoUrl = store?.logoUrl || storedUser?.store?.logoUrl;
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
    <header className="w-full max-w-[970px] mx-auto pt-3.5 sm:pt-4 pb-0 px-4 sm:px-0 relative z-50">
      <div className="bg-[#111C35] text-white rounded-[18px] h-[65px] px-5 sm:px-7 flex items-center justify-between shadow-[0_8px_25px_rgba(17,28,53,0.18)] border border-white/10">
        {/* Logo on the left */}
        <Link to={ROUTES.DASHBOARD} className="flex items-center gap-2.5 group">
          <img
            src="/images/EasyList logo.png"
            alt="EasyList Logo"
            className="w-8 h-8 rounded-lg object-contain shadow-sm"
          />
          <span className="text-lg sm:text-xl font-bold font-heading tracking-tight text-white select-none">
            Easy<span className="text-[#5046F2]">List</span>
          </span>
        </Link>

        {/* Shop profile dropdown trigger on the right */}
        <div className="relative">
          <button
            ref={buttonRef}
            id="btn-shop-profile-trigger"
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2.5 bg-white/5 hover:bg-white/10 border border-white/10 h-[40px] px-3 sm:px-4 rounded-full transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#5046F2]/50"
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            {/* Shop Initials or Uploaded Logo */}
            {logoUrl && !imageError ? (
              <img
                src={logoUrl}
                alt={activeStoreName}
                onError={() => setImageError(true)}
                className="w-7 h-7 rounded-full object-cover shrink-0 border border-white/20 shadow-xs"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#C7D2FE] text-[#312E81] font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                {initials}
              </div>
            )}

            {/* Shop Name */}
            <span className="text-xs sm:text-sm font-semibold text-white tracking-wide max-w-[140px] sm:max-w-none truncate">
              {activeStoreName}
            </span>

            {/* Small Chevron Icon */}
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-300 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''
                }`}
            />
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
        isOpen={isSettingsModalOpen}
        onClose={() => {
          setIsSettingsModalOpen(false);
          buttonRef.current?.focus();
        }}
        currentStore={{
          id: store?.id || '',
          name: activeStoreName,
          ownerName: activeStoreName,
          phone: activePhone,
          email: activeEmail,
          address: store?.address || '',
          logoUrl,
        }}
        onSaveStore={async (updated) => {
          const user = getCurrentUser();
          const apiBaseUrl =
            (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
            'http://localhost:8000/api';
          let savedShopId = updated.id || store?.id;

          if (user) {
            try {
              if (savedShopId) {
                const res = await updateShopDetails({
                  shopId: savedShopId,
                  shopName: updated.name,
                  phone: updated.phone,
                  getIdToken: (force) => user.getIdToken(force),
                  apiBaseUrl,
                });
                savedShopId = res.id;
              } else {
                const res = await registerShop({
                  shopName: updated.name,
                  phone: updated.phone,
                  getIdToken: (force) => user.getIdToken(force),
                  apiBaseUrl,
                });
                savedShopId = res.shop.id;
              }
            } catch (err) {
              console.warn('Backend shop sync (saved to session):', err);
            }

            try {
              await updateProfile(user, { displayName: updated.name });
            } catch {
              // Non-fatal
            }
          }

          const finalizedStore: StoreInfo = {
            ...updated,
            id: savedShopId || '',
            email: activeEmail || updated.email,
          };

          setStore(finalizedStore);
          storage.saveStore(finalizedStore, effectiveUid);
          if (storedUser) {
            storage.setUser({
              ...storedUser,
              name: finalizedStore.name,
              store: finalizedStore,
            });
          }
          window.dispatchEvent(
            new CustomEvent('easylist_store_updated', { detail: finalizedStore })
          );
        }}
      />
    </header>
  );
};

export default DashboardHeader;