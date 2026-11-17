import React, { useState } from 'react';
import { ShieldCheck, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { getCurrentUserToken } from '../../services/authService';

interface AccountLinkingModalProps {
  isOpen: boolean;
  onOptOut: () => void;
}

export const AccountLinkingModal: React.FC<AccountLinkingModalProps> = ({
  isOpen,
  onOptOut,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const apiBaseUrl =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
    'http://localhost:8000/api';

  const handleOptOut = async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const token = await getCurrentUserToken();
      const res = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/auth/link/opt-out`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Unable to create independent profile.');
      }

      onOptOut();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Operation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#111C35]/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-[480px] bg-white rounded-[24px] shadow-2xl border border-slate-200 p-6 sm:p-8 font-sans">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#087BFA] flex items-center justify-center mb-4">
          <ShieldCheck className="w-7 h-7" />
        </div>

        <h2 className="text-xl sm:text-2xl font-bold font-heading text-slate-900 mb-1.5">
          Account Recovery Required
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 mb-5 leading-relaxed">
          Additional verification is required before continuing. Email verification alone cannot authorize
          access to legacy shop data, and secure recovery is temporarily unavailable.
        </p>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <p className="mb-5 text-xs text-slate-600">
          If you need access to the existing shop, contact EasyList support. You can also create a separate
          shop profile; doing so will not link to or expose the existing shop.
        </p>

        <button
          type="button"
          onClick={handleOptOut}
          disabled={isLoading}
          className="w-full py-3 px-5 rounded-xl bg-[#087BFA] hover:bg-[#076ee2] text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 transition-colors shadow-sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Creating separate profile...</span>
            </>
          ) : (
            <>
              <span>Register a separate shop</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
