import React, { useState } from 'react';
import { ChevronDown, History, Store, LogOut, PlusCircle } from 'lucide-react';
import { StoreInfo } from '../../types/order';
import { signOutUser } from '../../services/authService';
import { storage } from '../../lib/storage';

interface HeaderProps {
  currentStore: StoreInfo;
  activeTab: 'new-order' | 'history' | 'settings';
  onNavigate: (tab: 'new-order' | 'history' | 'settings') => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentStore,
  activeTab,
  onNavigate,
  onLogout,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Generate store initials (e.g. SG for Sri Gokulakkannan)
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="nav-pill-header no-print">
      <div className="container">
        <div className="nav-pill">
          {/* Brand Logo */}
          <div
            className="brand-logo-wrap"
            style={{ cursor: 'pointer' }}
            onClick={() => onNavigate('new-order')}
          >
            <img
              src="/images/EasyList logo.png"
              alt="EasyList Logo"
              className="brand-icon-img"
            />
            <span>
              <span className="brand-name-easy">Easy</span>
              <span className="brand-name-bill">Bill</span>
            </span>
          </div>

          {/* Center Navigation Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => onNavigate('new-order')}
              style={{
                background: activeTab === 'new-order' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                color: activeTab === 'new-order' ? '#38bdf8' : '#cbd5e1',
                border: 'none',
                padding: '0.45rem 0.9rem',
                borderRadius: '9999px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 150ms ease',
              }}
            >
              <PlusCircle size={15} />
              New Order
            </button>

            <button
              onClick={() => onNavigate('history')}
              style={{
                background: activeTab === 'history' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                color: activeTab === 'history' ? '#38bdf8' : '#cbd5e1',
                border: 'none',
                padding: '0.45rem 0.9rem',
                borderRadius: '9999px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 150ms ease',
              }}
            >
              <History size={15} />
              History
            </button>
          </div>

          {/* Store Selector Profile Badge */}
          <div style={{ position: 'relative' }}>
            <div
              className="store-selector-badge"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <div className="store-avatar">{getInitials(currentStore.name)}</div>
              <span className="store-name-text">{currentStore.name}</span>
              <ChevronDown size={15} color="#94a3b8" />
            </div>

            {dropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '115%',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                  minWidth: '220px',
                  padding: '0.5rem',
                  zIndex: 100,
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ padding: '0.6rem 0.8rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Active Store</div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{currentStore.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{currentStore.phone}</div>
                </div>

                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onNavigate('settings');
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.6rem 0.8rem',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    color: '#334155',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <Store size={16} />
                  Store Settings
                </button>

                {onLogout && (
                  <button
                    onClick={async () => {
                      setDropdownOpen(false);
                      try {
                        await signOutUser();
                      } catch (err) {
                        console.warn('Sign out error:', err);
                      }
                      storage.setUser(null);
                      onLogout();
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      padding: '0.6rem 0.8rem',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      color: '#ef4444',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
