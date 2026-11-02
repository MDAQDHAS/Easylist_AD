import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, ChevronRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { ROUTES } from '../routes/paths';
import { requestPasswordReset } from '../services/passwordRecoveryService';
import { getFriendlyAuthErrorMessage } from '../services/authService';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please provide a valid registered email address');
      return;
    }

    setIsLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setIsSubmitted(true);
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
      setError(
        code
          ? getFriendlyAuthErrorMessage(code, 'Unable to send password reset instructions.')
          : 'Unable to send password reset instructions. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-[var(--color-page-bg)] flex items-center justify-center p-3 sm:p-6 lg:p-10 font-sans">
      <div className="w-full max-w-md bg-white rounded-[24px] sm:rounded-[32px] shadow-[0_12px_45px_rgba(17,28,53,0.08)] border border-[#E2E8F0]/80 p-6 sm:p-10">
        {/* Brand Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full bg-[#111C35] flex items-center justify-center shadow-md p-3.5 ring-4 ring-[#F0F5FC]">
            <img
              src="/images/EasyList logo.png"
              alt="EasyList"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-[#111827] tracking-tight">
            Reset <span className="text-[#087BFA]">Password</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1.5">
            Enter your registered email address to receive password recovery instructions.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {isSubmitted ? (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">Instructions Sent!</span>
                If an account exists for <span className="font-mono font-semibold">{email}</span>, a password reset link has been dispatched.
              </div>
            </div>

            <Link
              to={ROUTES.LOGIN}
              className="w-full py-3 px-6 rounded-xl bg-[#087BFA] hover:bg-[#076ee2] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Sign In</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="forgot-email"
                className="block text-xs sm:text-sm font-semibold text-[#111827] mb-1.5"
              >
                Email address
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-[#8296B5] pointer-events-none flex items-center">
                  <Mail className="w-4 h-4 sm:w-5 sm:h-5" />
                </span>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3.5 bg-white border border-[#DCE5F2] focus:border-[#087BFA] focus:ring-[#087BFA]/15 rounded-xl text-sm sm:text-base text-[#111827] placeholder-[#8296B5] transition-all focus:outline-none focus:ring-4 hover:border-[#B8CDE6]"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 sm:py-3.5 px-6 rounded-xl bg-[#087BFA] hover:bg-[#076ee2] text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(8,123,250,0.3)] hover:shadow-[0_6px_20px_rgba(8,123,250,0.38)] transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Sending Instructions...</span>
                </>
              ) : (
                <>
                  <span>Send Reset Instructions</span>
                  <ChevronRight className="w-5 h-5 stroke-[2.5]" />
                </>
              )}
            </button>

            <div className="text-center pt-4">
              <Link
                to={ROUTES.LOGIN}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#64748B] hover:text-[#087BFA] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
};

export default ForgotPasswordPage;
