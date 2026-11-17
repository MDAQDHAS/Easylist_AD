import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Store,
  User as UserIcon,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Send,
  RefreshCw,
} from 'lucide-react';
import { ROUTES } from '../../routes/paths';
import { storage } from '../../lib/storage';
import {
  registerWithEmailPassword,
  onAuthChange,
  sendVerificationEmail,
  getFriendlyAuthErrorMessage,
  getCurrentUser,
} from '../../services/authService';

interface RegisterFormProps {
  onSuccess?: (email: string) => void;
  onSwitchToLogin?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, onSwitchToLogin }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [shopName, setShopName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isVerificationStep, setIsVerificationStep] = useState(false);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState('');
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendStatus, setResendStatus] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const pollingRef = useRef<number | null>(null);

  // Sync initial email from navigation state if present
  useEffect(() => {
    const stateEmail = (location.state as { email?: string } | null)?.email;
    if (stateEmail) {
      setEmail(stateEmail);
    }
  }, [location.state]);

  // Listen to auth changes: if ambient user is already verified, redirect immediately to dashboard
  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthChange((user) => {
      if (!mounted) return;

      if (user) {
        if (user.emailVerified) {
          // Email already verified -> proceed directly to dashboard
          const resolvedShopName = shopName.trim() || user.displayName || 'My Shop';
          const syncedStore = {
            id: '',
            name: resolvedShopName,
            ownerName: resolvedShopName,
            phone: '',
            email: user.email || email.trim(),
            address: '',
          };
          storage.saveStore(syncedStore, user.uid);
          storage.setUser({
            id: user.uid,
            email: user.email || email.trim(),
            name: resolvedShopName,
            role: 'owner',
            store: syncedStore,
          });
          onSuccess?.(user.email || email.trim());
          navigate(ROUTES.DASHBOARD, { replace: true });
        } else if (user.email) {
          setEmail(user.email);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [email, shopName, navigate, onSuccess]);

  // Polling interval while on verification screen
  useEffect(() => {
    if (!isVerificationStep) {
      if (pollingRef.current !== null) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const checkStatus = async () => {
      const user = getCurrentUser();
      if (!user) return;
      try {
        await user.reload();
        if (user.emailVerified) {
          if (pollingRef.current !== null) {
            window.clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          const resolvedShopName = shopName.trim() || user.displayName || 'My Shop';
          const syncedStore = {
            id: '',
            name: resolvedShopName,
            ownerName: resolvedShopName,
            phone: '',
            email: user.email || email.trim(),
            address: '',
          };
          storage.saveStore(syncedStore, user.uid);
          storage.setUser({
            id: user.uid,
            email: user.email || email.trim(),
            name: resolvedShopName,
            role: 'owner',
            store: syncedStore,
          });
          onSuccess?.(user.email || email.trim());
          navigate(ROUTES.DASHBOARD, { replace: true });
        }
      } catch {
        // Non-fatal background polling error
      }
    };

    pollingRef.current = window.setInterval(() => {
      void checkStatus();
    }, 3000);

    return () => {
      if (pollingRef.current !== null) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isVerificationStep, email, shopName, navigate, onSuccess]);

  const handleManualCheckVerification = async () => {
    setIsCheckingVerification(true);
    setVerificationFeedback('');
    setError('');

    try {
      const user = getCurrentUser();
      if (!user) {
        setError('No active session found. Please sign in to verify.');
        return;
      }

      await user.reload();

      if (user.emailVerified) {
        const resolvedShopName = shopName.trim() || user.displayName || 'My Shop';
        const syncedStore = {
          id: '',
          name: resolvedShopName,
          ownerName: resolvedShopName,
          phone: '',
          email: user.email || email.trim(),
          address: '',
        };
        storage.saveStore(syncedStore, user.uid);
        storage.setUser({
          id: user.uid,
          email: user.email || email.trim(),
          name: resolvedShopName,
          role: 'owner',
          store: syncedStore,
        });
        onSuccess?.(user.email || email.trim());
        navigate(ROUTES.DASHBOARD, { replace: true });
      } else {
        setVerificationFeedback(
          'Email not verified yet. Please click the confirmation link sent to your email, then click this button again.'
        );
      }
    } catch {
      setVerificationFeedback('Unable to verify status right now. Please try again in a moment.');
    } finally {
      setIsCheckingVerification(false);
    }
  };

  const handleResendVerification = async () => {
    setResendingEmail(true);
    setResendStatus('');
    setError('');
    setVerificationFeedback('');

    try {
      const user = getCurrentUser();
      await sendVerificationEmail(user);
      setResendStatus('A fresh verification link was sent to your inbox.');
      setTimeout(() => setResendStatus(''), 6000);
    } catch (resendError: unknown) {
      const code =
        resendError && typeof resendError === 'object' && 'code' in resendError
          ? String(resendError.code)
          : '';
      setError(getFriendlyAuthErrorMessage(code, 'Unable to dispatch verification email. Please try again.'));
    } finally {
      setResendingEmail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setResendStatus('');
    setVerificationFeedback('');

    const cleanShopName = shopName.trim();
    if (!cleanShopName) {
      setError('Please enter your shop name.');
      return;
    }

    if (cleanShopName.length > 150) {
      setError('Shop name must be at most 150 characters.');
      return;
    }

    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const user = await registerWithEmailPassword(cleanEmail, password, cleanShopName);

      // Account created -> prompt email verification
      if (user.emailVerified) {
        const syncedStore = {
          id: '',
          name: cleanShopName,
          ownerName: cleanShopName,
          phone: '',
          email: cleanEmail,
          address: '',
        };
        storage.saveStore(syncedStore, user.uid);
        storage.setUser({
          id: user.uid,
          email: cleanEmail,
          name: cleanShopName,
          role: 'owner',
          store: syncedStore,
        });
        onSuccess?.(cleanEmail);
        navigate(ROUTES.DASHBOARD, { replace: true });
      } else {
        setIsVerificationStep(true);
      }
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
      const message =
        err instanceof Error ? err.message : 'Unable to create your account. Please try again.';
      setError(getFriendlyAuthErrorMessage(code, message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[1040px] bg-white rounded-[24px] sm:rounded-[28px] shadow-[0_10px_40px_rgba(17,28,53,0.08)] border border-[#E2E8F0]/80 p-3 sm:p-4 lg:p-4.5 flex flex-col lg:flex-row gap-4 sm:gap-5 lg:gap-6 overflow-hidden">
      {/* LEFT PANE: Executive Brand Artwork */}
      <div className="w-full lg:w-[40%] xl:w-[38%] bg-[#111C35] rounded-[20px] sm:rounded-[22px] p-5 sm:p-6 lg:p-6.5 flex flex-col justify-between relative overflow-hidden text-white shadow-inner">
        <div className="absolute top-0 right-0 w-52 h-52 bg-[#087BFA]/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        {/* Top Header Group */}
        <div>
          <div className="flex items-center gap-2.5">
            <img
              src="/images/EasyList logo.png"
              alt="EasyList Logo"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain shadow-md"
            />
            <span className="text-xl sm:text-2xl font-bold font-heading tracking-tight text-white select-none">
              Easy<span className="text-[#087BFA]">List</span>
            </span>
          </div>

          <div className="mt-4 sm:mt-5">
            <h2 className="text-xl sm:text-2xl lg:text-[26px] font-bold text-white font-heading leading-tight tracking-tight">
              From Handwritten <br />
              to <span className="text-[#087BFA]">Digital.</span>
            </h2>
            <p className="text-xs sm:text-[13px] text-slate-300 font-normal mt-1.5 leading-relaxed max-w-xs">
              Turn handwritten grocery orders into editable, exportable digital lists in seconds.
            </p>
          </div>
        </div>

        {/* Scaled & Proportionate Image Section */}
        <div className="my-3 sm:my-4 flex items-center justify-center flex-1">
          <img
            src="/images/EasyList login image.png"
            alt="Handwritten to Digital Order Conversion"
            className="w-full max-w-[260px] sm:max-w-[280px] lg:max-w-[300px] max-h-[220px] sm:max-h-[240px] lg:max-h-[250px] object-contain drop-shadow-xl select-none"
          />
        </div>

        {/* Bottom Attribution */}
        <div className="pt-2.5 border-t border-slate-700/40 text-center">
          <span className="text-[11px] text-slate-400 font-medium tracking-wide">
            A product by Avenzo Technologies
          </span>
        </div>
      </div>

      {/* RIGHT PANE: Account Creation or Verification Pending */}
      <div className="w-full lg:w-[60%] xl:w-[62%] bg-white flex flex-col justify-center items-center p-3 sm:p-5 lg:p-6">
        <div className="w-full max-w-[400px]">
          {/* Logo Icon Badge */}
          <div className="flex justify-center mb-2.5 sm:mb-3">
            <div className="w-12 h-12 rounded-full bg-[#111C35] flex items-center justify-center shadow-sm p-2.5 ring-3 ring-[#F0F5FC]">
              <img
                src="/images/EasyList logo.png"
                alt="EasyList"
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Verification Pending View */}
          {isVerificationStep ? (
            <div className="animate-in fade-in duration-200">
              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-[#087BFA] flex items-center justify-center mx-auto mb-3 border border-blue-200">
                  <Mail className="w-6 h-6 animate-pulse" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold font-heading text-[#111827] tracking-tight">
                  Verify Your <span className="text-[#087BFA]">Email</span>
                </h1>
                <p className="text-xs sm:text-sm text-[#64748B] mt-1.5 leading-relaxed">
                  We sent a verification link to:
                </p>
                <p className="text-sm font-semibold text-[#111C35] mt-1 bg-slate-50 py-1.5 px-3 rounded-lg border border-slate-200 inline-block break-all">
                  {email}
                </p>
                <p className="text-xs text-[#64748B] mt-2">
                  Please click the link in your email to activate your account.
                </p>
              </div>

              {resendStatus && (
                <div className="mb-4 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{resendStatus}</span>
                </div>
              )}

              {verificationFeedback && (
                <div className="mb-4 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{verificationFeedback}</span>
                </div>
              )}

              {error && (
                <div className="mb-4 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-3">
                <button
                  type="button"
                  id="btn-verified-continue"
                  onClick={() => void handleManualCheckVerification()}
                  disabled={isCheckingVerification}
                  className="w-full h-10 rounded-xl bg-[#5046F2] hover:bg-[#4338CA] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isCheckingVerification ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Checking verification status...</span>
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
                  id="btn-resend-verification"
                  onClick={() => void handleResendVerification()}
                  disabled={resendingEmail}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {resendingEmail ? (
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
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsVerificationStep(false);
                    setError('');
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  &larr; Use a different email address
                </button>
              </div>
            </div>
          ) : (
            /* Account Creation Form View */
            <div className="animate-in fade-in duration-200">
              <div className="text-center mb-4 sm:mb-5">
                <h1 className="text-xl sm:text-2xl font-bold font-heading text-[#111827] tracking-tight">
                  Create <span className="text-[#087BFA]">Account</span>
                </h1>
                <p className="text-xs text-[#64748B] mt-1 font-normal">
                  Sign up to start converting handwritten grocery orders
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mb-3.5 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 animate-in fade-in duration-150"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Shop Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#111827] uppercase tracking-wider mb-1">
                    Shop Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Store className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="input-shop-name"
                      data-testid="input-shop-name"
                      type="text"
                      required
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="e.g. Sri Krishna Stores"
                      className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-xs text-[#111827] placeholder:text-slate-400 font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#5046F2]/30 focus:border-[#5046F2]"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#111827] uppercase tracking-wider mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="input-register-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-xs text-[#111827] placeholder:text-slate-400 font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#5046F2]/30 focus:border-[#5046F2]"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#111827] uppercase tracking-wider mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="input-register-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full h-9 pl-9 pr-9 rounded-lg border border-slate-200 text-xs text-[#111827] placeholder:text-slate-400 font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#5046F2]/30 focus:border-[#5046F2]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#111827] uppercase tracking-wider mb-1">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="input-register-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      className="w-full h-9 pl-9 pr-9 rounded-lg border border-slate-200 text-xs text-[#111827] placeholder:text-slate-400 font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#5046F2]/30 focus:border-[#5046F2]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    id="btn-register-submit"
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-10 rounded-xl bg-[#087BFA] hover:bg-[#076ee2] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating account...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Account</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Footer Switch to Login */}
              <div className="mt-4 pt-3.5 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-500">
                  Already have an account?{' '}
                  <Link
                    to={ROUTES.LOGIN}
                    onClick={onSwitchToLogin}
                    className="font-semibold text-[#087BFA] hover:underline cursor-pointer"
                  >
                    Sign In
                  </Link>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;
