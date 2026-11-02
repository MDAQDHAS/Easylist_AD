import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { ROUTES } from '../../routes/paths';
import {
  requestPasswordReset,
  confirmReset,
  verifyActionCode,
  updatePassword,
} from '../../services/passwordRecoveryService';
import {
  getCurrentUser,
  getFriendlyAuthErrorMessage,
} from '../../services/authService';

type RecoveryStage = 'request' | 'sent' | 'reset' | 'success';

interface PasswordRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  isResetRoute?: boolean;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export const PasswordRecoveryModal: React.FC<PasswordRecoveryModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
  isResetRoute = false,
  triggerRef,
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const modalRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const oobCode = searchParams.get('oobCode') || '';
  const isResetAction = isResetRoute || Boolean(oobCode);

  const [stage, setStage] = useState<RecoveryStage>(
    isResetAction ? 'reset' : 'request'
  );
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(!isResetAction);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    setPassword('');
    setConfirmPassword('');
    setErrorMessage(null);
    setStatusMessage(null);
    onClose();
    triggerRef?.current?.focus();
    if (isResetRoute || oobCode) {
      navigate(ROUTES.LOGIN, { replace: true });
    }
  }, [isResetRoute, navigate, onClose, oobCode, triggerRef]);

  useEffect(() => {
    if (!isOpen || !isResetAction) return;

    let active = true;

    if (oobCode) {
      setIsLoading(true);
      verifyActionCode(oobCode)
        .then((userEmail) => {
          if (!active) return;
          if (userEmail) setEmail(userEmail);
          setRecoveryReady(true);
          setErrorMessage(null);
        })
        .catch((err: unknown) => {
          if (!active) return;
          const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
          setRecoveryReady(false);
          setErrorMessage(
            getFriendlyAuthErrorMessage(
              code,
              'The password reset link is invalid or has expired. Please request a new one.'
            )
          );
        })
        .finally(() => {
          if (active) setIsLoading(false);
        });
    } else {
      // Check if user is currently authenticated
      const user = getCurrentUser();
      if (user) {
        setRecoveryReady(true);
        setErrorMessage(null);
      } else {
        setRecoveryReady(false);
        setErrorMessage(
          'No valid password reset code found in URL. Please use the reset link from your email.'
        );
      }
    }

    return () => {
      active = false;
    };
  }, [isOpen, isResetAction, oobCode]);

  useEffect(() => {
    if (!isOpen) return;
    const target = stage === 'request' ? emailInputRef.current : passwordInputRef.current;
    const timer = window.setTimeout(() => target?.focus(), 100);
    return () => window.clearTimeout(timer);
  }, [stage, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
        return;
      }
      if (event.key !== 'Tab' || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const handleRequestReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      await requestPasswordReset(cleanEmail);
      setStage('sent');
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
      setErrorMessage(
        getFriendlyAuthErrorMessage(
          code,
          'Unable to send password reset instructions. Please try again.'
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    if (!recoveryReady) {
      setErrorMessage('A valid password reset link is required.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      if (oobCode) {
        await confirmReset(oobCode, password);
      } else {
        await updatePassword(password);
      }
      setStage('success');
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
      setErrorMessage(
        getFriendlyAuthErrorMessage(
          code,
          'Unable to update your password. Please request a new reset link.'
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const focusableInputClass =
    'w-full pl-10 pr-4 py-3 bg-white border border-[#DCE5F2] hover:border-slate-300 focus:border-[#087BFA] focus:ring-4 focus:ring-[#087BFA]/15 rounded-xl text-sm sm:text-base text-[#111827] placeholder-[#8296B5] transition-all outline-none';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#111C35]/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-modal-title"
    >
      <div
        ref={modalRef}
        className="w-[calc(100%-16px)] sm:w-full max-w-[460px] bg-white rounded-[20px] shadow-[0_20px_50px_rgba(17,28,53,0.18)] border border-[#DCE5F2] p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 font-sans"
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close recovery popup"
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-5">
          <span className="font-heading text-[#111C35] font-semibold">
            EasyList Password Recovery
          </span>
          <div className="h-1.5 rounded-full bg-[#087BFA] mt-3" />
        </div>

        {errorMessage && (
          <div role="alert" className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}
        {statusMessage && (
          <div role="status" className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
            <span>{statusMessage}</span>
          </div>
        )}

        {stage === 'request' && (
          <section>
            <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] text-[#087BFA] flex items-center justify-center mb-4">
              <Mail className="w-6 h-6" />
            </div>
            <h2 id="recovery-modal-title" className="text-xl sm:text-2xl font-bold font-heading text-[#111827]">
              Forgot Password?
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1.5">
              Enter your registered email and we’ll send a password reset link.
            </p>
            <form onSubmit={handleRequestReset} className="mt-5 space-y-4">
              <label htmlFor="recovery-email-input" className="block text-xs sm:text-sm font-semibold text-[#111827]">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 w-4 h-4 text-[#8296B5]" />
                <input
                  ref={emailInputRef}
                  id="recovery-email-input"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email"
                  required
                  autoComplete="email"
                  className={focusableInputClass}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-5 rounded-xl bg-[#087BFA] hover:bg-[#076ee2] text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer shadow-sm transition-all"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
              </button>
              <button type="button" onClick={handleClose} className="w-full inline-flex justify-center items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#64748B] hover:text-[#111827]">
                <ArrowLeft className="w-4 h-4" /> Back to Sign In
              </button>
            </form>
          </section>
        )}

        {stage === 'sent' && (
          <section className="text-center py-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
            <h2 id="recovery-modal-title" className="text-xl sm:text-2xl font-bold font-heading text-[#111827]">
              Check Your Email
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] mt-2">
              If an account exists for {email.trim()}, a password reset link has been sent. Follow the link to choose a new password.
            </p>
            <button type="button" onClick={handleClose} className="w-full py-3.5 px-5 rounded-xl bg-[#087BFA] text-white font-semibold mt-6 cursor-pointer hover:bg-[#076ee2] transition-colors">
              Back to Sign In
            </button>
          </section>
        )}

        {stage === 'reset' && (
          <section>
            <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] text-[#087BFA] flex items-center justify-center mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h2 id="recovery-modal-title" className="text-xl sm:text-2xl font-bold font-heading text-[#111827]">
              Create New Password
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1.5">
              Choose a new password for your account.
            </p>
            {isResetAction && !recoveryReady && !errorMessage && (
              <p className="mt-4 text-sm text-[#64748B]">Verifying reset link...</p>
            )}
            <form onSubmit={handleUpdatePassword} className="mt-5 space-y-4">
              {[{
                id: 'new-password-input',
                label: 'New Password',
                value: password,
                setValue: setPassword,
                visible: showPassword,
                toggle: () => setShowPassword((value) => !value),
                ref: passwordInputRef,
              }, {
                id: 'confirm-password-input',
                label: 'Confirm New Password',
                value: confirmPassword,
                setValue: setConfirmPassword,
                visible: showConfirmPassword,
                toggle: () => setShowConfirmPassword((value) => !value),
              }].map((field) => (
                <div key={field.id}>
                  <label htmlFor={field.id} className="block text-xs sm:text-sm font-semibold text-[#111827] mb-1.5">
                    {field.label}
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-3.5 w-4 h-4 text-[#8296B5]" />
                    <input
                      ref={field.ref}
                      id={field.id}
                      type={field.visible ? 'text' : 'password'}
                      value={field.value}
                      onChange={(event) => field.setValue(event.target.value)}
                      placeholder={field.label}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className={`${focusableInputClass} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={field.toggle}
                      aria-label={field.visible ? 'Hide password' : 'Show password'}
                      className="absolute right-3.5 text-[#8296B5]"
                    >
                      {field.visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="submit"
                disabled={isLoading || !recoveryReady}
                className="w-full py-3 px-5 rounded-xl bg-[#087BFA] hover:bg-[#076ee2] text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer shadow-sm transition-all"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
              </button>
            </form>
          </section>
        )}

        {stage === 'success' && (
          <section className="text-center py-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
            <h2 id="recovery-modal-title" className="text-xl sm:text-2xl font-bold font-heading text-[#111827]">
              Password Updated
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] mt-2">
              Your password was updated successfully. You can now sign in with your new credentials.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-3.5 px-5 rounded-xl bg-[#087BFA] text-white font-semibold mt-6 cursor-pointer hover:bg-[#076ee2] transition-colors"
            >
              Sign In
            </button>
          </section>
        )}
      </div>
    </div>
  );
};

export default PasswordRecoveryModal;
