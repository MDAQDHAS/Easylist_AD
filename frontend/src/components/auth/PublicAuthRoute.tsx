import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { onAuthChange } from '../../services/authService';
import { ROUTES } from '../../routes/paths';

interface PublicAuthRouteProps {
  children: React.ReactNode;
}

/**
 * PublicAuthRoute
 *
 * Wraps unauthenticated entry routes (Login, Register, Forgot Password).
 * Automatically redirects returning authenticated users to /dashboard
 * while eliminating login page flickering during session restoration.
 */
export const PublicAuthRoute: React.FC<PublicAuthRouteProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Allow explicit password reset links to be viewed even if an ambient session exists
  const isResetAction =
    location.pathname === ROUTES.RESET_PASSWORD ||
    searchParams.get('mode') === 'resetPassword' ||
    searchParams.get('oobCode') !== null;

  useEffect(() => {
    return onAuthChange((user) => {
      setIsAuthenticated(Boolean(user && user.emailVerified));
    });
  }, []);

  if (isAuthenticated === null && !isResetAction) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans text-slate-600 gap-3 bg-[var(--color-page-bg,#F8FAFC)]">
        <Loader2 className="w-5 h-5 animate-spin text-[#5046F2]" />
        <span className="text-sm font-medium">Restoring EasyList session...</span>
      </div>
    );
  }

  if (isAuthenticated && !isResetAction) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <>{children}</>;
};

export default PublicAuthRoute;
