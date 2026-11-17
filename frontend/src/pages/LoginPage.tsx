import React, { useState, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { LoginForm } from '../features/auth/LoginForm';
import { PasswordRecoveryModal } from '../features/auth/PasswordRecoveryModal';
import { ROUTES } from '../routes/paths';

interface LoginPageProps {
  initialShowRecovery?: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  initialShowRecovery = false,
}) => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const oobCode = searchParams.get('oobCode');
  const mode = searchParams.get('mode');
  const isResetRoute = location.pathname === ROUTES.RESET_PASSWORD || Boolean(oobCode) || mode === 'resetPassword';
  const isInitiallyOpen =
    initialShowRecovery ||
    isResetRoute ||
    searchParams.get('forgot') === 'true' ||
    searchParams.get('recovery') === 'true';

  const [isRecoveryOpen, setIsRecoveryOpen] = useState<boolean>(isInitiallyOpen);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <main className="min-h-screen w-full bg-[var(--color-page-bg)] flex items-center justify-center p-3 sm:p-6 lg:p-10 font-sans relative">
      <LoginForm
        onForgotPassword={() => setIsRecoveryOpen(true)}
        skipSessionRouting={isInitiallyOpen}
      />

      <PasswordRecoveryModal
        isOpen={isRecoveryOpen}
        onClose={() => setIsRecoveryOpen(false)}
        isResetRoute={isResetRoute}
        triggerRef={triggerRef}
      />
    </main>
  );
};

export default LoginPage;
