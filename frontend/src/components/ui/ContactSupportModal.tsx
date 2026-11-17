import React, { useEffect, useRef, useState } from 'react';
import { Mail, MessageCircle, X, ChevronRight, Headphones, Copy, Check } from 'lucide-react';

export interface ContactSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  emailAddress?: string;
  whatsappHref?: string;
}

export const ContactSupportModal: React.FC<ContactSupportModalProps> = ({
  isOpen,
  onClose,
  emailAddress = 'avenzotechnologies05@gmail.com',
  whatsappHref = 'https://wa.me/918220575776?text=Hi%20Avenzo%20Team%2C%20I%20need%20help%20with%20EasyList',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(emailAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-[#111C35]/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-support-title"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] bg-white rounded-[22px] shadow-[0_20px_50px_rgba(17,28,53,0.18)] border border-[#DCE5F2] p-6 sm:p-7 relative font-sans animate-in zoom-in-95 duration-200"
      >
        {/* Close Button */}
        <button
          id="btn-close-support-modal"
          type="button"
          onClick={onClose}
          aria-label="Close support popup"
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="w-11 h-11 rounded-2xl bg-[#EEF2FF] text-[#5046F2] flex items-center justify-center mb-3.5 shadow-2xs">
          <Headphones className="w-5 h-5 stroke-[2.2]" />
        </div>

        {/* Title & Description */}
        <h2
          id="contact-support-title"
          className="text-xl sm:text-2xl font-bold font-heading text-[#111827] tracking-tight"
        >
          Contact Support
        </h2>
        <p className="text-xs sm:text-sm text-[#64748B] mt-1 leading-relaxed">
          Need help with EasyList? Contact our support team.
        </p>

        {/* Contact Options */}
        <div className="mt-5 space-y-3">
          {/* 1. Email Support Card (Plain text, selectable, with copy button; no navigation) */}
          <div
            id="card-email-support"
            className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl border border-[#DCE5F2] bg-[#F8FAFF] shadow-2xs"
          >
            <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-2">
              <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#5046F2] flex items-center justify-center shrink-0 shadow-2xs">
                <Mail className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-sm sm:text-base font-bold text-[#111827] block font-heading leading-tight">
                  Email Support
                </span>
                <span className="text-xs text-[#64748B] block mt-0.5 select-all font-mono sm:font-sans break-all">
                  {emailAddress}
                </span>
              </div>
            </div>

            {/* Small Copy Email Button */}
            <button
              type="button"
              id="btn-copy-support-email"
              onClick={handleCopyEmail}
              aria-label="Copy email address"
              title={copied ? 'Copied to clipboard!' : 'Copy email address'}
              className={`p-2 rounded-lg border transition-all cursor-pointer shrink-0 flex items-center gap-1.5 text-xs font-semibold ${
                copied
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-white text-slate-600 border-[#DCE5F2] hover:border-[#5046F2] hover:text-[#5046F2] hover:bg-[#EEF2FF]/50 shadow-2xs'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                  <span className="hidden sm:inline">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Copy</span>
                </>
              )}
            </button>
          </div>

          {/* 2. WhatsApp Support Card (Clickable, directly opens chat) */}
          <a
            id="link-whatsapp-support"
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl border border-[#DCE5F2] hover:border-emerald-500 hover:bg-emerald-50/30 transition-all cursor-pointer group text-left shadow-2xs hover:shadow-xs no-underline"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-2xs">
                <MessageCircle className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="min-w-0">
                <span className="text-sm sm:text-base font-bold text-[#111827] block group-hover:text-emerald-700 transition-colors font-heading leading-tight">
                  WhatsApp Support
                </span>
                <span className="text-xs text-[#64748B] block mt-0.5">
                  Chat directly with our team
                </span>
              </div>
            </div>
            <div className="w-7 h-7 rounded-lg text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 flex items-center justify-center shrink-0 transition-all ml-2">
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </div>
          </a>
        </div>

        {/* Footer Attribution */}
        <div className="mt-5 pt-3.5 border-t border-slate-100 text-center">
          <p className="text-xs text-[#64748B] font-medium tracking-wide">
            Support by <span className="font-semibold text-[#111C35]">Avenzo Technologies</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ContactSupportModal;
