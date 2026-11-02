import React from 'react';
import { Header } from './Header';
import { StoreInfo } from '../../types/order';

interface LayoutProps {
  children: React.ReactNode;
  currentStore: StoreInfo;
  activeTab: 'new-order' | 'history' | 'settings';
  onNavigate: (tab: 'new-order' | 'history' | 'settings') => void;
  onLogout?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentStore,
  activeTab,
  onNavigate,
  onLogout,
}) => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        currentStore={currentStore}
        activeTab={activeTab}
        onNavigate={onNavigate}
        onLogout={onLogout}
      />

      <main style={{ flex: 1, paddingBottom: '3rem' }}>
        <div className="container">{children}</div>
      </main>

      <footer
        className="no-print"
        style={{
          padding: '1.5rem',
          textAlign: 'center',
          fontSize: '0.82rem',
          color: '#94a3b8',
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
        }}
      >
        A product by <strong style={{ color: '#475569' }}>Avenzo Technologies</strong> · EasyBill v1.0
      </footer>
    </div>
  );
};
