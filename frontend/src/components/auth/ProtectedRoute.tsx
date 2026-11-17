import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Mail, CheckCircle2, AlertCircle, Send, LogOut } from 'lucide-react';
import { onAuthChange, sendVerificationEmail, getCurrentUser, signOutUser } from '../../services/authService';
import { ROUTES } from '../../routes/paths';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState<{
    isLoading: boolean;
    isAuthenticated: boolean;
    isEmailVerified: boolean;
    email: string;
  }>({
    isLoading: true,
    isAuthenticated: false,
    isEmailVerified: false,
    email: '',
  });

  const [isChecking, setIsChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState('');
  const [checkFeedback, setCheckFeedback] = useState('');

  useEffect(() => {
    return onAuthChange((user) => {
      if (!user) {
        setAuthState({
          isLoading: false,
          isAuthenticated: false,
          isEmailVerified: false,
          email: '',
        });
      } else {
        setAuthState({
          isLoading: false,
          isAuthenticated: true,
          isEmailVerified: Boolean(user.emailVerified),
          email: user.email || '',
        });
      }
    });
  }, []);

  const handleManualCheck = async () => {
    setIsChecking(true);
    setCheckFeedback('');
    try {
      const user = getCurrentUser();
      if (!user) {
        navigate(ROUTES.LOGIN, { replace: true });
        return;
      }
      await user.reload();
      if (user.emailVerified) {
        setAuthState((prev) => ({ ...prev, isEmailVerified: true }));
      } else {
        setCheckFeedback('Email is not verified yet. Please check your inbox and click the verification link.');
      }
    } catch {
      setCheckFeedback('Unable to check verification status. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResendStatus('');
    try {
      const user = getCurrentUser();
      await sendVerificationEmail(user);
      setResendStatus('A fresh verification link has been sent to your inbox.');
      setTimeout(() => setResendStatus(''), 6000);
    } catch {
      setResendStatus('Unable to resend verification email. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } finally {
      navigate(ROUTES.LOGIN, { replace: true });
    }
  };

  if (authState.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans text-slate-600 gap-3 bg-[var(--color-page-bg,#F8FAFC)]">
        <Loader2 className="w-5 h-5 animate-spin text-[#5046F2]" />
        <span>Loading EasyList...</span>
      </div>
    );
  }

  if (!authState.isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (!authState.isEmailVerified) {
    return (
      <div className="min-h-screen bg-[var(--color-page-bg,#F8FAFC)] flex items-center justify-center px-4 font-sans py-8">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-blue-50 text-[#087BFA] flex items-center justify-center mx-auto mb-4 border border-blue-200">
            <Mail className="w-7 h-7" />
          </div>

          <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">
            Email Verification Required
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
            Please verify your email address to access your EasyList dashboard. We sent a verification link to:
          </p>
          <p className="mt-1.5 text-xs sm:text-sm font-semibold text-slate-900 bg-slate-50 py-1.5 px-3 rounded-lg border border-slate-200 inline-block break-all">
            {authState.email}
          </p>

          {resendStatus && (
            <div className="mt-4 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{resendStatus}</span>
            </div>
          )}

          {checkFeedback && (
            <div className="mt-4 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{checkFeedback}</span>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => void handleManualCheck()}
              disabled={isChecking}
              className="w-full h-10 rounded-xl bg-[#5046F2] hover:bg-[#4338CA] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isChecking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking status...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>I’ve Verified My Email</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={resending}
              className="w-full h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {resending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Resending email...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 text-[#5046F2]" />
                  <span>Resend Verification Email</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="w-full h-9 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
