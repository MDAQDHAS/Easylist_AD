import React, { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { onAuthChange } from '../../services/authService';
import { ROUTES } from '../../routes/paths';

export const RootRedirect: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [authState, setAuthState] = useState<{
    isLoading: boolean;
    isAuthenticated: boolean;
    isEmailVerified: boolean;
  }>({
    isLoading: true,
    isAuthenticated: false,
    isEmailVerified: false,
  });

  // Preserve password reset action links arriving at root
  const hasResetCode = Boolean(searchParams.get('oobCode'));
  const isResetMode = searchParams.get('mode') === 'resetPassword';

  useEffect(() => {
    return onAuthChange((user) => {
      setAuthState({
        isLoading: false,
        isAuthenticated: Boolean(user),
        isEmailVerified: Boolean(user?.emailVerified),
      });
    });
  }, []);

  if (hasResetCode || isResetMode) {
    return <Navigate to={`${ROUTES.RESET_PASSWORD}?${searchParams.toString()}`} replace />;
  }

  if (authState.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans text-slate-600 gap-3 bg-[var(--color-page-bg,#F8FAFC)]">
        <Loader2 className="w-5 h-5 animate-spin text-[#5046F2]" />
        <span className="text-sm font-medium">Restoring EasyList session...</span>
      </div>
    );
  }

  return (
    <Navigate
      to={authState.isAuthenticated && authState.isEmailVerified ? ROUTES.DASHBOARD : ROUTES.LOGIN}
      replace
    />
  );
};

export default RootRedirect;
