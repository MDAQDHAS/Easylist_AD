import React, { useState, useRef, useEffect } from 'react';
import { Store, Mail, Phone, Upload, Trash2, RefreshCw, Check, AlertCircle, Info } from 'lucide-react';
import { StoreInfo } from '../types/order';

interface SettingsPageProps {
  currentStore: StoreInfo;
  onSaveStore: (store: StoreInfo) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ currentStore, onSaveStore }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: currentStore.name || '',
    email: currentStore.email || '',
    phone: currentStore.phone || '',
    logoUrl: currentStore.logoUrl || '',
  });

  const [logoPreview, setLogoPreview] = useState<string | undefined>(currentStore.logoUrl || undefined);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sync with currentStore if it changes externally
  useEffect(() => {
    setFormData({
      name: currentStore.name || '',
      email: currentStore.email || '',
      phone: currentStore.phone || '',
      logoUrl: currentStore.logoUrl || '',
    });
    setLogoPreview(currentStore.logoUrl || undefined);
  }, [currentStore]);

  // Compute shop initials for avatar fallback
  const initials =
    formData.name
      .trim()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || 'EL';

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type (JPG, PNG, WEBP)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setLogoError('Invalid image format. Only JPG, PNG, or WEBP are supported.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Logo image is too large. Maximum allowed size is 2MB.');
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

  const handleRemoveLogo = () => {
    setLogoPreview(undefined);
    setFormData((prev) => ({ ...prev, logoUrl: '' }));
    setLogoError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      errors.name = 'Shop Name is required.';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email Address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSaving(true);

    const updatedStore: StoreInfo = {
      ...currentStore,
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      logoUrl: formData.logoUrl ? formData.logoUrl : undefined,
    };

    onSaveStore(updatedStore);

    // Broadcast update so navbar and other open views sync dynamically
    window.dispatchEvent(
      new CustomEvent('easylist_store_updated', { detail: updatedStore })
    );

    // Development-only honest feedback (satisfies requirement 6)
    setToastMessage('Shop settings updated for this session. (Local preview · Backend sync pending)');
    setIsSaving(false);

    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  return (
    <div className="w-full max-w-[680px] mx-auto pb-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold bg-[#111C35] text-white shadow-xl border border-white/10">
            <Info className="w-4 h-4 text-[#5046F2] shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Page Heading & Subtitle */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-[28px] font-bold font-heading text-[#111C35] tracking-tight leading-tight">
          Shop Settings
        </h1>
        <p className="text-sm text-[#64748B] font-normal mt-1">
          Manage your shop information.
        </p>
      </div>

      {/* Centered White Card (max-w 680px) */}
      <div className="bg-white rounded-[22px] border border-[#DCE5F2] p-6 sm:p-8 shadow-[0_2px_12px_rgba(17,28,53,0.04)]">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* FIELD 1: Shop Logo Upload */}
          <div className="pb-6 border-b border-[#F1F5F9]">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs sm:text-sm font-semibold text-[#111C35]">
                Shop Logo
              </label>
              <span className="text-[11px] font-medium text-[#64748B] bg-slate-100 px-2 py-0.5 rounded-full">
                Optional
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Logo Preview Container */}
              <div className="w-[76px] h-[76px] rounded-2xl border border-[#DCE5F2] bg-[#F8FAFF] flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Shop Logo Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#EEF2FF] flex items-center justify-center text-[#5046F2] font-bold text-lg font-heading">
                    {initials}
                  </div>
                )}
              </div>

              {/* Logo Controls */}
              <div className="flex-1 min-w-0">
                <input
                  ref={fileInputRef}
                  id="shop-logo-file-input"
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={handleLogoFileChange}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    id="btn-upload-logo"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#DCE5F2] hover:border-[#5046F2] hover:bg-[#EEF2FF]/40 text-[#111C35] text-xs font-semibold transition cursor-pointer"
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
                      id="btn-remove-logo"
                      onClick={handleRemoveLogo}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-semibold transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <p className="text-[12px] text-[#64748B] mt-2 leading-relaxed">
                  Recommended: Square JPG, PNG or WEBP, max 2MB. Appears in navigation and exports.
                </p>

                {logoError && (
                  <p className="text-xs text-rose-600 font-medium mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{logoError}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* FIELD 2: Shop Name (Required) */}
          <div className="space-y-1.5">
            <label
              htmlFor="shop-name-input"
              className="block text-xs sm:text-sm font-semibold text-[#111C35]"
            >
              Shop Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
                <Store className="w-4 h-4" />
              </div>
              <input
                id="shop-name-input"
                type="text"
                required
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: '' });
                }}
                placeholder="e.g. Sri Gokulakkannan Stores"
                className={`w-full pl-10 pr-4 py-2.5 sm:py-3 text-sm rounded-xl border bg-white text-[#111827] placeholder:text-[#94A3B8] transition focus:outline-none focus:ring-2 ${
                  fieldErrors.name
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/15'
                    : 'border-[#DCE5F2] focus:border-[#5046F2] focus:ring-[#5046F2]/15'
                }`}
              />
            </div>
            {fieldErrors.name && (
              <p className="text-xs text-rose-600 font-medium mt-1">
                {fieldErrors.name}
              </p>
            )}
          </div>

          {/* FIELD 3: Email Address (Required) */}
          <div className="space-y-1.5">
            <label
              htmlFor="shop-email-input"
              className="block text-xs sm:text-sm font-semibold text-[#111C35]"
            >
              Email Address <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="shop-email-input"
                type="email"
                required
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' });
                }}
                placeholder="e.g. shop@srigokulstores.com"
                className={`w-full pl-10 pr-4 py-2.5 sm:py-3 text-sm rounded-xl border bg-white text-[#111827] placeholder:text-[#94A3B8] transition focus:outline-none focus:ring-2 ${
                  fieldErrors.email
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/15'
                    : 'border-[#DCE5F2] focus:border-[#5046F2] focus:ring-[#5046F2]/15'
                }`}
              />
            </div>
            {fieldErrors.email && (
              <p className="text-xs text-rose-600 font-medium mt-1">
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* FIELD 4: Phone Number (Optional) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="shop-phone-input"
                className="block text-xs sm:text-sm font-semibold text-[#111C35]"
              >
                Phone Number
              </label>
              <span className="text-[11px] text-[#64748B] font-normal">
                Optional
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
                <Phone className="w-4 h-4" />
              </div>
              <input
                id="shop-phone-input"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="e.g. +91 98420 12345"
                className="w-full pl-10 pr-4 py-2.5 sm:py-3 text-sm rounded-xl border border-[#DCE5F2] bg-white text-[#111827] placeholder:text-[#94A3B8] transition focus:outline-none focus:border-[#5046F2] focus:ring-2 focus:ring-[#5046F2]/15"
              />
            </div>
          </div>

          {/* Action Footer: Save Changes Button */}
          <div className="pt-6 border-t border-[#F1F5F9] flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-[#64748B] order-2 sm:order-1 text-center sm:text-left">
              Changes apply across your active workspace immediately.
            </span>

            <button
              id="btn-save-shop-settings"
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto order-1 sm:order-2 inline-flex items-center justify-center gap-2 px-6 py-2.5 sm:py-3 rounded-xl bg-[#5046F2] hover:bg-[#4338CA] active:bg-[#3730A3] text-white font-semibold text-sm shadow-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#5046F2]/30 disabled:opacity-60"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage;
