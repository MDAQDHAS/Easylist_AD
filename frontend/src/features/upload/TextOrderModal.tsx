import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  X,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Languages,
} from 'lucide-react';
import { OrderItem } from '../../types/order';
import { ocrService } from '../../services/ocrService';

export interface TextOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExtractOrder: (items: OrderItem[], rawText?: string) => void | Promise<void>;
}

export const TextOrderModal: React.FC<TextOrderModalProps> = ({
  isOpen,
  onClose,
  onExtractOrder,
}) => {
  const [rawTextOrder, setRawTextOrder] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      // Auto-focus the textarea when modal opens
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    } else {
      setRawTextOrder('');
      setError(null);
      setIsExtracting(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExtracting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExtracting, onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Dynamically count detected order items without duplicate API calls
  const detectedItemsCount = useMemo(() => {
    const trimmed = rawTextOrder.trim();
    if (!trimmed) return 0;
    try {
      const items = ocrService.parseTextOrder(trimmed);
      return Array.isArray(items) ? items.length : 0;
    } catch {
      return 0;
    }
  }, [rawTextOrder]);

  const handleClear = () => {
    if (isExtracting) return;
    setRawTextOrder('');
    setError(null);
    textareaRef.current?.focus();
  };

  const handleExtract = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = rawTextOrder.trim();
    if (!trimmed || isExtracting) return;

    setError(null);
    setIsExtracting(true);

    try {
      // Simulate brief parsing / processing state
      await new Promise((resolve) => setTimeout(resolve, 350));
      const parsedItems = ocrService.parseTextOrder(trimmed);

      if (!parsedItems || parsedItems.length === 0) {
        throw new Error('Could not parse any order items. Please enter at least one product per line.');
      }

      await Promise.resolve(onExtractOrder(parsedItems, trimmed));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to extract text order. Please verify your input and try again.'
      );
      setIsExtracting(false);
    }
  };

  if (!isOpen) return null;

  const charCount = rawTextOrder.length;
  const isInputEmpty = rawTextOrder.trim().length === 0;

  const content = (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 bg-[#111C35]/55 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="text-order-modal-title"
      aria-describedby="text-order-modal-description"
      onClick={() => {
        if (!isExtracting) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[760px] bg-[#F8F7F4] rounded-[24px] border border-[#E5E0D8] shadow-[0_24px_70px_rgba(17,28,53,0.28)] p-6 sm:p-8 relative font-sans max-h-[92dvh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Top-Right Close Button */}
        <button
          id="btn-close-text-order-modal"
          type="button"
          disabled={isExtracting}
          onClick={onClose}
          aria-label="Close text order popup"
          className="absolute top-5 right-5 sm:top-6 sm:right-6 p-2 rounded-xl text-[#64748B] hover:text-[#3B1D06] hover:bg-black/5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header with Orange Accent from Text Feature Card */}
        <div className="flex items-start gap-4 pb-5 border-b border-[#E6E2DA] pr-10 shrink-0">
          <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-[#FFD29D] border border-[#F3CCA4] text-[#C46A18] flex items-center justify-center shrink-0 shadow-2xs">
            <FileText className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h2
              id="text-order-modal-title"
              className="text-xl sm:text-[24px] font-bold font-heading text-[#3B1D06] tracking-tight leading-tight"
            >
              Enter Text Order
            </h2>
            <p
              id="text-order-modal-description"
              className="text-xs sm:text-sm text-[#725439] mt-1 font-normal"
            >
              Convert customer messages into digital orders.
            </p>
          </div>
        </div>

        {/* Scrollable Modal Body / Form */}
        <form onSubmit={handleExtract} className="flex-1 overflow-y-auto py-5 space-y-4 pr-0.5 flex flex-col">
          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm flex items-start justify-between gap-3 animate-in fade-in duration-150 shrink-0"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-rose-950 leading-snug">
                    Unable to process text order
                  </p>
                  <p className="text-rose-700 mt-0.5 leading-relaxed">{error}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                aria-label="Dismiss error"
                className="text-rose-400 hover:text-rose-700 p-1 rounded-lg cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Paste Area Card with Warm Orange Feature Card Tint */}
          <div className="bg-white rounded-[20px] border border-[#F3CCA4] p-4 sm:p-5 shadow-2xs flex-1 flex flex-col transition-all">
            {/* Card Header: Heading, Subtitle & Top-Right Language Support Pill */}
            <div className="flex items-start justify-between gap-3 mb-3.5 shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-[16px] font-bold font-heading text-[#3B1D06] leading-tight">
                  Paste Customer Order
                </h3>
                <p className="text-xs text-[#725439] mt-0.5">
                  Paste or type your customer's order details here.
                </p>
              </div>

              {/* Language Support Label (Subtle warm orange pill with language icon at top-right corner) */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF4E5] border border-[#FED7AA] text-[#C46A18] text-[11px] sm:text-xs font-semibold shrink-0 shadow-2xs">
                <Languages className="w-3.5 h-3.5 stroke-[2.2] text-[#C46A18]" />
                <span>தமிழ் + English Supported</span>
              </div>
            </div>

            {/* Spacious comfortable Textarea with warm focus border and rounded corners */}
            <div className="relative flex-1 flex flex-col min-h-[220px]">
              <textarea
                ref={textareaRef}
                id="text-order-input"
                value={rawTextOrder}
                disabled={isExtracting}
                onChange={(e) => {
                  setRawTextOrder(e.target.value);
                  if (error) setError(null);
                }}
                rows={8}
                placeholder="Paste or type the customer's order here..."
                className="w-full flex-1 rounded-[16px] border border-[#E8DCCF] bg-[#FFFBF6]/50 hover:bg-white focus:bg-white p-4 sm:p-4.5 text-sm sm:text-[15px] text-[#111827] placeholder:text-[#94A3B8] leading-relaxed resize-y focus:outline-none focus:border-[#F6A521] focus:ring-4 focus:ring-[#F6A521]/15 transition-all font-sans disabled:bg-slate-50 disabled:opacity-75"
              />
            </div>

            {/* Card Footer: Clear Control & Character Count */}
            <div className="flex items-center justify-between text-xs text-[#725439] pt-2.5 px-1 shrink-0">
              <div>
                {charCount > 0 && !isExtracting ? (
                  <button
                    type="button"
                    id="btn-clear-text-order"
                    onClick={handleClear}
                    className="inline-flex items-center gap-1.5 text-xs text-[#725439] hover:text-[#C46A18] font-medium transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Clear text</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-[#A8907A]">Each product on a new line</span>
                )}
              </div>

              <div className="font-medium tabular-nums text-[#725439]">
                {charCount} {charCount === 1 ? 'character' : 'characters'}
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer: Item Counter & Full-Width Prominent Orange Feature Card Extract Button */}
        <div className="pt-3.5 border-t border-[#E6E2DA] shrink-0 space-y-2.5">
          {/* Item Counter dynamically updated above the Extract Order button */}
          <div className="flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold text-[#3B1D06]">
            <span className="inline-block w-2 h-2 rounded-full bg-[#F6A521]" />
            <span id="text-order-detected-count">
              {detectedItemsCount} {detectedItemsCount === 1 ? 'item' : 'items'} detected
            </span>
          </div>

          {/* Premium Orange Gradient Extract Button (from-[#F6A521] to-[#D75C0A] matching Text Feature Card) */}
          <button
            id="btn-extract-text-order"
            type="button"
            disabled={isInputEmpty || isExtracting}
            onClick={() => handleExtract()}
            className="w-full h-[50px] sm:h-[54px] rounded-[14px] bg-linear-to-r from-[#F6A521] to-[#D75C0A] hover:opacity-95 active:opacity-90 text-white font-heading font-bold text-sm sm:text-base shadow-[0_8px_22px_rgba(215,92,10,0.28)] flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isExtracting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Extracting Order...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4.5 h-4.5" />
                <span>Extract Order</span>
                <ArrowRight className="w-4.5 h-4.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return content;
  }

  return createPortal(content, document.body);
};

export default TextOrderModal;
