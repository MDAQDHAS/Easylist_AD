import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from 'lucide-react';
import { ROUTES } from '../../routes/paths';
import {
  signInWithEmailPassword,
  onAuthChange,
  sendVerificationEmail,
  getFriendlyAuthErrorMessage,
  getCurrentUser,
} from '../../services/authService';
import { storage } from '../../lib/storage';

interface LoginFormProps {
  onSuccess?: (email: string) => void;
  onSwitchToRegister?: () => void;
  onForgotPassword?: () => void;
  defaultEmail?: string;
  skipSessionRouting?: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onSwitchToRegister,
  onForgotPassword,
  defaultEmail = '',
  skipSessionRouting = false,
}) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showResend, setShowResend] = useState(false);
  const [resendStatus, setResendStatus] = useState('');
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (skipSessionRouting) return;

    return onAuthChange((user) => {
      if (user && user.emailVerified) navigate(ROUTES.DASHBOARD, { replace: true });
    });
  }, [navigate, skipSessionRouting]);

  const handleResend = async () => {
    setIsResending(true);
    setResendStatus('');
    try {
      const user = getCurrentUser();
      await sendVerificationEmail(user);
      setResendStatus('A fresh verification link was sent to your inbox.');
    } catch {
      setResendStatus('Unable to resend verification link. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setShowResend(false);
    setResendStatus('');
    setIsLoading(true);

    try {
      const user = await signInWithEmailPassword(email.trim(), password);
      if (!user.emailVerified) {
        setError('Please verify your email address before signing in. Check your inbox for the confirmation link.');
        setShowResend(true);
        setIsLoading(false);
        return;
      }

      storage.setUser({
        id: user.uid,
        email: user.email || email.trim(),
        name: user.displayName || user.email?.split('@')[0] || 'User',
        role: 'owner',
      });

      onSuccess?.(user.email || email.trim());
      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch (authError: unknown) {
      const code =
        authError && typeof authError === 'object' && 'code' in authError
          ? String(authError.code)
          : '';
      setError(
        getFriendlyAuthErrorMessage(
          code,
          'Unable to sign in. Check your email and password.'
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[1080px] bg-white rounded-[24px] sm:rounded-[32px] shadow-[0_12px_45px_rgba(17,28,53,0.08)] border border-[#E2E8F0]/80 p-3 sm:p-4 lg:p-5 flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-8 overflow-hidden">
      {/* LEFT PANE: Balanced Width & Proportionate Image */}
      <div className="w-full lg:w-[40%] xl:w-[38%] bg-[#111C35] rounded-[20px] sm:rounded-[24px] p-6 sm:p-7 lg:p-8 flex flex-col justify-between relative overflow-hidden text-white shadow-inner">
        <div className="absolute top-0 right-0 w-56 h-56 bg-[#087BFA]/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        <div>
          <div className="flex items-center gap-3">
            <img
              src="/images/EasyList logo.png"
              alt="EasyList Logo"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain shadow-md"
            />
            <span className="text-xl sm:text-2xl font-bold font-heading tracking-tight text-white select-none">
              Easy<span className="text-[#087BFA]">List</span>
            </span>
          </div>

          <div className="mt-6 sm:mt-8">
            <h2 className="text-2xl sm:text-[28px] lg:text-[30px] font-bold text-white font-heading leading-tight tracking-tight">
              From Handwritten <br />
              to <span className="text-[#087BFA]">Digital.</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-normal mt-2.5 leading-relaxed max-w-xs">
              Turn handwritten grocery orders into editable, exportable digital lists in seconds.
            </p>
          </div>
        </div>

        {/* Scaled & Non-distorted Image Section */}
        <div className="my-5 sm:my-6 flex items-center justify-center">
          <img
            src="/images/EasyList login image.png"
            alt="Handwritten to Digital Order Conversion"
            className="w-full max-w-[240px] sm:max-w-[270px] lg:max-w-[280px] max-h-[220px] sm:max-h-[250px] object-contain drop-shadow-2xl select-none"
          />
        </div>

        <div className="pt-3 border-t border-slate-700/40 text-center">
          <span className="text-[11px] sm:text-xs text-slate-400 font-medium tracking-wide">
            A product by Avenzo Technologies
          </span>
        </div>
      </div>

      {/* RIGHT PANE: Comfortable Form Space */}
      <div className="w-full lg:w-[60%] xl:w-[62%] bg-white flex flex-col justify-center items-center p-4 sm:p-8 lg:p-10">
        <div className="w-full max-w-[420px]">
          <div className="flex justify-center mb-4 sm:mb-5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#111C35] flex items-center justify-center shadow-md p-3 ring-4 ring-[#F0F5FC]">
              <img
                src="/images/EasyList logo.png"
                alt="EasyList"
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          <div className="text-center mb-6 sm:mb-7">
            <h1 className="text-2xl sm:text-3xl font-bold font-heading text-[#111827] tracking-tight">
              Welcome <span className="text-[#087BFA]">Back</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1.5">
              Sign in to manage your grocery orders on EasyList
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex flex-col gap-2 animate-in fade-in duration-150"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
              {showResend && (
                <button
                  type="button"
                  onClick={() => void handleResend()}
                  disabled={isResending}
                  className="self-start text-xs font-semibold text-[#087BFA] hover:underline cursor-pointer disabled:opacity-50"
                >
                  {isResending ? 'Resending verification link...' : 'Resend verification email'}
                </button>
              )}
            </div>
          )}

          {resendStatus && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{resendStatus}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-4.5">
            <div>
              <label
                htmlFor="email-input"
                className="block text-xs sm:text-sm font-semibold text-[#111827] mb-1.5"
              >
                Email
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 w-4 h-4 sm:w-5 sm:h-5 text-[#8296B5] pointer-events-none" />
                <input
                  id="email-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email"
                  className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white border border-[#DCE5F2] focus:border-[#087BFA] focus:ring-[#087BFA]/15 rounded-xl text-sm text-[#111827] placeholder-[#8296B5] transition-all focus:outline-none focus:ring-4"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password-input"
                  className="block text-xs sm:text-sm font-semibold text-[#111827]"
                >
                  Password
                </label>
                {onForgotPassword && (
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    className="text-xs font-semibold text-[#087BFA] hover:text-[#076ee2] cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 w-4 h-4 sm:w-5 sm:h-5 text-[#8296B5] pointer-events-none" />
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 sm:pl-11 pr-11 py-2.5 sm:py-3 bg-white border border-[#DCE5F2] focus:border-[#087BFA] focus:ring-[#087BFA]/15 rounded-xl text-sm text-[#111827] placeholder-[#8296B5] transition-all focus:outline-none focus:ring-4"
                  required
                />
                <button
                  type="button"
                  id="btn-toggle-password-visibility"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 p-1 rounded-lg text-[#8296B5] hover:text-[#111827] hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="btn-sign-in-submit"
              disabled={isLoading}
              className="w-full py-3 sm:py-3.5 px-6 rounded-xl bg-[#087BFA] hover:bg-[#076ee2] active:bg-[#0660c5] text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(8,123,250,0.3)] transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed mt-5"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ChevronRight className="w-5 h-5 stroke-[2.5]" />
                </>
              )}
            </button>
          </form>

          <div className="text-center text-xs sm:text-sm text-[#64748B] pt-6 sm:pt-7">
            Don't have an account?{' '}
            {onSwitchToRegister ? (
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="text-[#087BFA] font-semibold hover:underline cursor-pointer"
              >
                Create Account
              </button>
            ) : (
              <Link
                to={ROUTES.REGISTER}
                className="text-[#087BFA] font-semibold hover:underline"
              >
                Create Account
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
