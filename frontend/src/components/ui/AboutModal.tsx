import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Globe, Mail, Copy, Check, ExternalLink, Info } from 'lucide-react';

export interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const emailAddress = 'avenzotechnologies05@gmail.com';
  const websiteUrl = 'https://avenzo-technologies.web.app';

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(emailAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Close on Escape key
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

  // Prevent background scrolling while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      id="about-modal-backdrop"
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-[#111C35]/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-easylist-title"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        id="about-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] bg-white rounded-[22px] shadow-[0_20px_50px_rgba(17,28,53,0.18)] border border-[#DCE5F2] p-6 sm:p-7 relative font-sans animate-in zoom-in-95 duration-200"
      >
        {/* Close Button */}
        <button
          id="btn-close-about-modal"
          type="button"
          onClick={onClose}
          aria-label="Close about popup"
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="w-11 h-11 rounded-2xl bg-[#EEF2FF] text-[#5046F2] flex items-center justify-center mb-4 shadow-2xs">
          <Info className="w-5 h-5 stroke-[2.2]" />
        </div>

        {/* Section 1: About EasyList */}
        <div className="mb-4">
          <h2
            id="about-easylist-title"
            className="text-xl sm:text-2xl font-bold font-heading text-[#111C35] tracking-tight"
          >
            About EasyList
          </h2>
          <p className="text-xs sm:text-sm text-[#475569] mt-2 leading-relaxed">
            EasyList simplifies wholesale order management by converting handwritten Tamil and English orders into organized digital product lists. Upload an order image, extract product details, edit the results, and export them in seconds.
          </p>
        </div>

        {/* Subtle Divider */}
        <div className="h-px bg-[#E2E8F0] my-4" />

        {/* Section 2: Built by Avenzo Technologies */}
        <div className="mb-5">
          <h3 className="text-base sm:text-lg font-bold font-heading text-[#111C35] tracking-tight">
            Built by Avenzo Technologies
          </h3>
          <p className="text-xs sm:text-sm text-[#475569] mt-1.5 leading-relaxed">
            Avenzo Technologies builds practical digital products that simplify everyday business operations.
          </p>
        </div>

        {/* Links / Contact Info */}
        <div className="space-y-2.5">
          {/* Website Link (Opens in new tab) */}
          <a
            id="link-about-website"
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl border border-[#DCE5F2] bg-[#F8FAFF] hover:bg-[#EEF2FF] hover:border-[#C7D2FE] transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white border border-[#DCE5F2] text-[#5046F2] flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
                  Website
                </span>
                <span className="text-xs sm:text-sm font-semibold text-[#111C35] group-hover:text-[#5046F2] truncate block">
                  avenzo-technologies.web.app
                </span>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-[#5046F2] shrink-0 ml-2" />
          </a>

          {/* Email (Selectable text + copy button, NO mailto link) */}
          <div
            id="card-about-email"
            className="flex items-center justify-between p-3 rounded-xl border border-[#DCE5F2] bg-[#F8FAFF]"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
              <div className="w-8 h-8 rounded-lg bg-white border border-[#DCE5F2] text-[#5046F2] flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
                  Email
                </span>
                <span className="text-xs sm:text-sm font-medium text-[#111C35] select-all font-mono sm:font-sans break-all block">
                  {emailAddress}
                </span>
              </div>
            </div>
            <button
              id="btn-copy-about-email"
              type="button"
              onClick={handleCopyEmail}
              aria-label={copied ? 'Email copied' : 'Copy email address'}
              title={copied ? 'Copied!' : 'Copy email address'}
              className="p-1.5 rounded-lg border border-[#DCE5F2] bg-white hover:bg-slate-50 text-slate-600 hover:text-[#5046F2] transition-colors shrink-0 cursor-pointer"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AboutModal;

