import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Store,
  Mail,
  Phone,
  Upload,
  Trash2,
  RefreshCw,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { StoreInfo } from '../../types/order';

export interface ShopSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStore: StoreInfo;
  onSaveStore: (store: StoreInfo) => void;
}

export const ShopSettingsModal: React.FC<ShopSettingsModalProps> = ({
  isOpen,
  onClose,
  currentStore,
  onSaveStore,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: currentStore.name || '',
    email: currentStore.email || '',
    phone: currentStore.phone || '',
    logoUrl: currentStore.logoUrl || '',
  });

  // Track initial snapshot to detect unsaved changes
  const [initialData, setInitialData] = useState({
    name: currentStore.name || '',
    email: currentStore.email || '',
    phone: currentStore.phone || '',
    logoUrl: currentStore.logoUrl || '',
  });

  const [logoPreview, setLogoPreview] = useState<string | undefined>(
    currentStore.logoUrl || undefined
  );
  const [logoError, setLogoError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{
    type: 'success' | 'info';
    message: string;
  } | null>(null);

  // Confirmation dialog state when closing with unsaved changes
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Reset or prepopulate state when modal opens or currentStore updates
  useEffect(() => {
    if (isOpen) {
      const snap = {
        name: currentStore.name || '',
        email: currentStore.email || '',
        phone: currentStore.phone || '',
        logoUrl: currentStore.logoUrl || '',
      };
      setFormData(snap);
      setInitialData(snap);
      setLogoPreview(currentStore.logoUrl || undefined);
      setLogoError(null);
      setFieldErrors({});
      setShowDiscardConfirm(false);
      setFeedbackToast(null);
      setIsSaving(false);
    }
  }, [isOpen, currentStore]);

  // Determine if user has made unsaved edits
  const hasUnsavedChanges =
    formData.name.trim() !== initialData.name.trim() ||
    formData.email.trim() !== initialData.email.trim() ||
    formData.phone.trim() !== initialData.phone.trim() ||
    (formData.logoUrl || '') !== (initialData.logoUrl || '');

  // Request close: check for unsaved edits first
  const handleRequestClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  // Handle keydown (Escape closes modal)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false);
        } else {
          handleRequestClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showDiscardConfirm, handleRequestClose]);

  // Lock background scroll when open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Calculate shop initials
  const initials =
    formData.name
      .trim()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || 'EL';

  // Handle Logo Upload
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type (JPG, PNG, WEBP)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setLogoError('Unsupported format. Please upload JPG, PNG, or WEBP.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Image size exceeds the 2MB limit.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setLogoPreview(result);
      setFormData((prev) => ({ ...prev, logoUrl: result }));
    };
    reader.onerror = () => {
      setLogoError('Could not process image file. Please try another image.');
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle Remove Logo
  const handleRemoveLogo = () => {
    setLogoPreview(undefined);
    setFormData((prev) => ({ ...prev, logoUrl: '' }));
    setLogoError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const errors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      errors.name = 'Shop name is required.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSaving(true);

    try {
      const updatedStore: StoreInfo = {
        ...currentStore,
        name: formData.name.trim(),
        email: formData.email.trim() || currentStore.email || '',
        phone: formData.phone.trim(),
        logoUrl: formData.logoUrl ? formData.logoUrl : undefined,
      };

      await Promise.resolve(onSaveStore(updatedStore));

      setFeedbackToast({
        type: 'success',
        message: 'Shop details updated successfully!',
      });

      // Close modal gracefully after brief feedback
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 700);
    } catch {
      setIsSaving(false);
      setFieldErrors({ form: 'An unexpected error occurred while saving. Please try again.' });
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 bg-[#111C35]/50 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shop-settings-title"
      aria-describedby="shop-settings-desc"
      onClick={handleRequestClose}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[500px] bg-white rounded-[20px] shadow-[0_20px_60px_rgba(17,28,53,0.25)] border border-[#DCE5F2] p-7 sm:p-8 relative font-sans animate-in zoom-in-95 duration-200 max-h-[92dvh] flex flex-col overflow-hidden"
      >
        {/* Top-Right Close Button */}
        <button
          id="btn-close-shop-settings-modal"
          type="button"
          onClick={handleRequestClose}
          aria-label="Close shop settings"
          className="absolute top-5 right-5 sm:top-6 sm:right-6 p-1.5 rounded-lg text-slate-400 hover:text-[#111C35] hover:bg-slate-100 transition-colors cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="pb-4 border-b border-[#F1F5F9] shrink-0 pr-8">
          <h2
            id="shop-settings-title"
            className="text-xl sm:text-2xl font-bold font-heading text-[#111C35] tracking-tight leading-tight"
          >
            Shop Settings
          </h2>
          <p
            id="shop-settings-desc"
            className="text-xs sm:text-sm text-[#64748B] mt-1 font-normal"
          >
            Manage your shop information.
          </p>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto pt-5 pb-2 pr-1 space-y-5">
          {/* Feedback Toast Banner */}
          {feedbackToast && (
            <div className="p-3 rounded-xl bg-[#EEF0FF] border border-[#C7D2FE] text-[#312E81] text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-[#5046F2] shrink-0 stroke-[2.5]" />
              <span>{feedbackToast.message}</span>
            </div>
          )}

          {fieldErrors.form && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{fieldErrors.form}</span>
            </div>
          )}

          {/* 1. SHOP LOGO SECTION (72x72px rounded square on light accent background #EEF0FF) */}
          <div className="p-3.5 sm:p-4 rounded-[14px] bg-[#EEF0FF]/60 border border-[#DCE5F2]">
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-bold text-[#111C35] tracking-wide uppercase">
                Shop Logo
              </label>
              <span className="text-[11px] font-medium text-[#64748B] bg-white/80 px-2 py-0.5 rounded-full border border-slate-200/60">
                Optional
              </span>
            </div>

            <div className="flex items-center gap-3.5">
              {/* 72x72px Rounded Square Preview */}
              <div className="w-[72px] h-[72px] rounded-2xl border border-[#DCE5F2] bg-[#EEF0FF] flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Shop Logo Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#EEF0FF] flex items-center justify-center text-[#5046F2] font-bold text-lg font-heading">
                    {initials}
                  </div>
                )}
              </div>

              {/* Logo Buttons & Info */}
              <div className="flex-1 min-w-0">
                <input
                  ref={fileInputRef}
                  id="popup-shop-logo-file-input"
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={handleLogoFileChange}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    id="btn-popup-upload-logo"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white border border-[#DCE5F2] hover:border-[#5046F2] hover:bg-[#EEF0FF] text-[#111C35] text-xs font-semibold shadow-2xs transition cursor-pointer"
                  >
                    {logoPreview ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 text-[#5046F2]" />
                        <span>Change Logo</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5 text-[#5046F2]" />
                        <span>Upload Logo</span>
                      </>
                    )}
                  </button>

                  {logoPreview && (
                    <button
                      type="button"
                      id="btn-popup-remove-logo"
                      onClick={handleRemoveLogo}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] bg-white/70 hover:bg-rose-50 text-rose-600 hover:text-rose-700 text-xs font-semibold transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-[#64748B] mt-1.5 leading-tight">
                  JPG, PNG or WEBP · Max 2MB
                </p>

                {logoError && (
                  <p className="text-xs text-rose-600 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{logoError}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 2. SHOP NAME FIELD (Required, 48px height, 10px radius) */}
          <div className="space-y-1.5">
            <label
              htmlFor="popup-shop-name"
              className="block text-xs font-semibold text-[#111C35]"
            >
              Shop Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
                <Store className="w-4 h-4" />
              </div>
              <input
                id="popup-shop-name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: '' });
                }}
                placeholder="Enter shop name"
                className={`w-full pl-10 pr-4 h-[48px] text-sm rounded-[10px] border bg-white text-[#111827] placeholder:text-[#94A3B8] transition focus:outline-none focus:ring-2 ${
                  fieldErrors.name
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/15'
                    : 'border-[#DCE5F2] focus:border-[#5046F2] focus:ring-[#5046F2]/15'
                }`}
              />
            </div>
            {fieldErrors.name && (
              <p className="text-xs text-rose-600 font-medium">{fieldErrors.name}</p>
            )}
          </div>

          {/* 3. EMAIL ADDRESS FIELD (Authenticated user's email, 48px height, 10px radius) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="popup-shop-email"
                className="block text-xs font-semibold text-[#111C35]"
              >
                Email Address
              </label>
              <span className="text-[11px] text-[#64748B] font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                Authenticated Account
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="popup-shop-email"
                type="email"
                readOnly
                disabled
                value={formData.email}
                placeholder="No email address available"
                className="w-full pl-10 pr-4 h-[48px] text-sm rounded-[10px] border border-[#DCE5F2] bg-slate-50 text-slate-700 font-medium cursor-not-allowed select-none"
              />
            </div>
            <p className="text-[11px] text-[#64748B]">
              This is the verified email address belonging to your account.
            </p>
          </div>

          {/* 4. PHONE NUMBER FIELD (Optional, 48px height, 10px radius) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="popup-shop-phone"
                className="block text-xs font-semibold text-[#111C35]"
              >
                Phone Number
              </label>
              <span className="text-[11px] text-[#64748B] font-normal">Optional</span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
                <Phone className="w-4 h-4" />
              </div>
              <input
                id="popup-shop-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="e.g. +91 98765 43210"
                className="w-full pl-10 pr-4 h-[48px] text-sm rounded-[10px] border border-[#DCE5F2] bg-white text-[#111827] placeholder:text-[#94A3B8] transition focus:outline-none focus:border-[#5046F2] focus:ring-2 focus:ring-[#5046F2]/15"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer Buttons */}
        <div className="pt-4 mt-3 border-t border-[#F1F5F9] shrink-0 flex items-center justify-end gap-3">
          <button
            type="button"
            id="btn-cancel-shop-settings"
            onClick={handleRequestClose}
            disabled={isSaving}
            className="px-5 h-[44px] sm:h-[46px] rounded-[10px] border border-[#DCE5F2] hover:bg-slate-50 text-[#111C35] font-semibold text-xs sm:text-sm transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            id="btn-save-shop-settings-modal"
            onClick={handleSubmit}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 px-6 h-[44px] sm:h-[46px] rounded-[10px] bg-[#5046F2] hover:bg-[#4338CA] active:bg-[#3730A3] text-white font-semibold text-xs sm:text-sm shadow-sm transition cursor-pointer disabled:opacity-60"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Changes</span>
            )}
          </button>
        </div>

        {/* Unsaved Changes Confirmation Dialog Overlay */}
        {showDiscardConfirm && (
          <div className="absolute inset-0 z-50 bg-[#111C35]/60 backdrop-blur-xs rounded-[20px] p-6 flex items-center justify-center animate-in fade-in duration-150">
            <div className="w-full max-w-[360px] bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 text-center animate-in zoom-in-95 duration-150">
              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h3 className="text-base font-bold font-heading text-[#111C35]">
                Discard unsaved changes?
              </h3>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                You have unsaved changes in your shop settings. Are you sure you want to close without saving?
              </p>
              <div className="mt-4 flex items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(false)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-[10px] border border-[#DCE5F2] hover:bg-slate-50 text-[#111C35] transition cursor-pointer"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  id="btn-confirm-discard-settings"
                  onClick={() => {
                    setShowDiscardConfirm(false);
                    onClose();
                  }}
                  className="px-3.5 py-2 text-xs font-semibold rounded-[10px] bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer"
                >
                  Discard & Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
};

export default ShopSettingsModal;
