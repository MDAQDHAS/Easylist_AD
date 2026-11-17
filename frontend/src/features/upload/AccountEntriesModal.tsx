import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Trash2,
  Plus,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { UploadedFileItem } from './OrderUpload';
import {
  ALLOWED_TYPES,
  MAX_FILE_SIZE,
  MAX_IMAGES_PER_ORDER,
  ScanProgressUpdate,
} from '../../services/ocrService';
import { formatFileSize } from '../../utils';

export interface AccountEntriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFiles?: UploadedFileItem[];
  onFilesChange?: (files: UploadedFileItem[]) => void;
  onExtractAccountNotes: (
    files: UploadedFileItem[],
    onProgress?: (update: ScanProgressUpdate) => void
  ) => Promise<void>;
}

/**
 * Clean Mini Ledger Icon for Minimal Digital Ledger Theme
 */
const MiniLedgerIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="4" y="3" width="16" height="18" rx="2.5" fill="#6842DB" />
    <path d="M4 7.5H8M4 12H8M4 16.5H8" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M11 8H17M11 12.5H17M11 16.5H15" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />
  </svg>
);

export const AccountEntriesModal: React.FC<AccountEntriesModalProps> = ({
  isOpen,
  onClose,
  initialFiles = [],
  onFilesChange,
  onExtractAccountNotes,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  const [selectedFiles, setSelectedFiles] = useState<UploadedFileItem[]>(initialFiles);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedFiles(initialFiles);
      setUploadError(null);
      setIsExtracting(false);
    }
  }, [isOpen, initialFiles]);

  // Close on Escape key when not extracting
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

  const validateSingleFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.has(file.type)) {
      return `"${file.name}" has an unsupported format. Only JPG, PNG, and WEBP images are accepted.`;
    }
    if (file.size === 0) {
      return `"${file.name}" is empty (0 bytes). Please select a valid account note image.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `"${file.name}" exceeds the 10MB size limit (${formatFileSize(file.size)}).`;
    }
    return null;
  };

  const processIncomingFiles = (files: FileList | null, isAddingMore = false) => {
    if (isExtracting || !files || files.length === 0) return;
    setUploadError(null);

    const newItems: UploadedFileItem[] = [];
    let errorMessage: string | null = null;

    const currentTotal = isAddingMore ? selectedFiles.length : 0;
    if (currentTotal + files.length > MAX_IMAGES_PER_ORDER) {
      setUploadError(
        `You can upload a maximum of ${MAX_IMAGES_PER_ORDER} account note images at a time.`
      );
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const err = validateSingleFile(file);
      if (err) {
        errorMessage = err;
        break;
      }
      const previewUrl = URL.createObjectURL(file);
      newItems.push({
        id: `acc-file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        name: file.name,
        size: file.size,
        previewUrl,
      });
    }

    if (errorMessage) {
      newItems.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setUploadError(errorMessage);
      return;
    }

    const updated = isAddingMore ? [...selectedFiles, ...newItems] : newItems;
    setSelectedFiles(updated);
    onFilesChange?.(updated);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processIncomingFiles(e.target.files, false);
    e.target.value = '';
  };

  const handleAddMoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processIncomingFiles(e.target.files, true);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isExtracting) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isExtracting) return;
    processIncomingFiles(e.dataTransfer.files, false);
  };

  const handleRemoveFile = (idToRemove: string) => {
    if (isExtracting) return;
    const removedItem = selectedFiles.find((f) => f.id === idToRemove);
    if (removedItem?.previewUrl) {
      URL.revokeObjectURL(removedItem.previewUrl);
    }
    const nextFiles = selectedFiles.filter((f) => f.id !== idToRemove);
    setSelectedFiles(nextFiles);
    onFilesChange?.(nextFiles);
  };

  const handleExtract = async () => {
    if (isExtracting || selectedFiles.length === 0) return;
    setUploadError(null);
    setIsExtracting(true);

    try {
      await onExtractAccountNotes(selectedFiles);
    } catch (err: any) {
      setUploadError(
        err?.message || 'Failed to extract account details. Please try again with a clearer image.'
      );
      setIsExtracting(false);
    }
  };

  if (!isOpen) return null;

  const content = (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 bg-[#111C35]/55 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-upload-modal-title"
      aria-describedby="account-upload-modal-description"
      onClick={() => {
        if (!isExtracting) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[700px] bg-[#FFFFFF] rounded-[18px] border border-[#E5DCF7] shadow-[0_20px_60px_rgba(36,22,79,0.18)] p-6 sm:p-7 relative font-sans flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Hidden File Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png, image/jpeg, image/webp"
          className="hidden"
          disabled={isExtracting}
          onChange={handleFileChange}
        />
        <input
          ref={addMoreInputRef}
          type="file"
          multiple
          accept="image/png, image/jpeg, image/webp"
          className="hidden"
          disabled={isExtracting}
          onChange={handleAddMoreChange}
        />

        {/* Top-Right Simple Close Button */}
        <button
          id="btn-close-account-upload"
          type="button"
          disabled={isExtracting}
          onClick={onClose}
          aria-label="Close upload popup"
          className="absolute top-5 right-5 sm:top-6 sm:right-6 p-2 rounded-xl text-[#74698C] hover:text-[#24164F] hover:bg-[#F8F7FC] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Section 2: Compact, Clean White Header */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-[#F1EBFF] pr-10 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-[#F1EBFF] border border-[#E5DCF7] text-[#6842DB] flex items-center justify-center shrink-0 shadow-2xs">
            <MiniLedgerIcon className="w-5 h-5" />
          </div>
          <div>
            <h2
              id="account-upload-modal-title"
              className="text-lg sm:text-[20px] font-bold font-heading text-[#24164F] tracking-tight leading-snug"
            >
              Upload Account Notes
            </h2>
            <p
              id="account-upload-modal-description"
              className="text-xs sm:text-[13px] text-[#74698C] mt-0.5 font-normal font-sans"
            >
              Digitise your handwritten business account records.
            </p>
          </div>
        </div>

        {/* Main Body */}
        <div className="py-5 space-y-4">
          {/* Error Banner */}
          {uploadError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm flex items-start justify-between gap-3 animate-in fade-in duration-150"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                <p className="text-rose-700 leading-snug">{uploadError}</p>
              </div>
              <button
                type="button"
                onClick={() => setUploadError(null)}
                aria-label="Dismiss error"
                className="text-rose-400 hover:text-rose-700 p-0.5 rounded cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Section 3 & 4: Upload Card (Empty State) */}
          {selectedFiles.length === 0 ? (
            <div
              id="dropzone-account-notes"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative rounded-[16px] border-2 border-dashed transition-all px-6 py-9 sm:py-11 flex flex-col items-center justify-center text-center cursor-pointer select-none bg-[#F8F7FC] ${
                isDragging
                  ? 'border-[#6842DB] bg-[#F1EBFF]/70 ring-4 ring-[#6842DB]/10'
                  : 'border-[#E5DCF7] hover:border-[#6842DB] hover:bg-[#F1EBFF]/30'
              }`}
            >
              {/* Small ledger icon inside soft lavender circle */}
              <div className="w-12 h-12 rounded-full bg-[#F1EBFF] text-[#6842DB] border border-[#E5DCF7] flex items-center justify-center mb-3.5 shadow-2xs">
                <MiniLedgerIcon className="w-6 h-6" />
              </div>

              {/* Heading */}
              <h3 className="text-base sm:text-[18px] font-bold font-heading text-[#24164F] leading-snug">
                Upload Your Account Notes
              </h3>

              {/* Supporting Text */}
              <p className="text-xs sm:text-sm text-[#74698C] mt-1 mb-5 max-w-sm">
                Select handwritten account images to extract your account details.
              </p>

              {/* Primary Button */}
              <button
                id="btn-browse-account-images"
                type="button"
                disabled={isExtracting}
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-linear-to-r from-[#8055F5] to-[#5132CC] hover:opacity-95 text-white font-semibold text-xs sm:text-sm shadow-xs transition-all cursor-pointer font-heading"
              >
                <span>Browse Account Images</span>
              </button>

              {/* Small helper text */}
              <p className="text-xs text-[#74698C] mt-3">or drag and drop images here</p>

              {/* Section 4: Supported formats line */}
              <p className="text-[11px] sm:text-xs text-[#74698C] mt-4 font-normal">
                JPG, PNG, WEBP · Max 10MB per image
              </p>
            </div>
          ) : (
            /* Section 5: After Image Selection (Uploaded File Preview Section) */
            <div className="bg-[#F8F7FC] rounded-[16px] border border-[#E5DCF7] p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#E5DCF7] text-xs font-semibold text-[#24164F]">
                <span>Selected Account Notes ({selectedFiles.length})</span>
                {selectedFiles.length < MAX_IMAGES_PER_ORDER && (
                  <button
                    type="button"
                    id="btn-add-more-account-images"
                    onClick={() => addMoreInputRef.current?.click()}
                    disabled={isExtracting}
                    className="inline-flex items-center gap-1 text-[#6842DB] hover:text-[#5132CC] font-semibold text-xs cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add More Images</span>
                  </button>
                )}
              </div>

              {/* Compact Image List */}
              <div className="max-h-56 overflow-y-auto space-y-2 pr-0.5">
                {selectedFiles.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white border border-[#E5DCF7] shadow-2xs"
                  >
                    {/* Small thumbnail & file info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={item.previewUrl}
                        alt={item.name}
                        className="w-10 h-10 rounded-lg object-cover border border-[#E5DCF7] shrink-0 bg-slate-50"
                      />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-[#24164F] truncate">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-[#74698C] mt-0.5">
                          {formatFileSize(item.size)}
                        </p>
                      </div>
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      disabled={isExtracting}
                      onClick={() => handleRemoveFile(item.id)}
                      aria-label={`Remove ${item.name}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section 6: Simple Clean Footer */}
        <div className="pt-3 border-t border-[#F1EBFF] shrink-0 text-center">
          {/* Helper Message */}
          <div className="flex items-center justify-center gap-1.5 text-xs text-[#74698C] mb-2.5 font-normal">
            <ShieldCheck className="w-3.5 h-3.5 text-[#6842DB]" />
            <span>Your account notes are processed securely.</span>
          </div>

          {/* Primary Action Button */}
          <button
            id="btn-extract-account-details"
            type="button"
            disabled={selectedFiles.length === 0 || isExtracting}
            onClick={handleExtract}
            className="w-full h-[48px] rounded-[12px] bg-linear-to-r from-[#8055F5] to-[#5132CC] hover:opacity-95 active:opacity-90 text-white font-heading font-bold text-sm sm:text-base shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isExtracting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Extracting Account Details...</span>
              </>
            ) : (
              <>
                <span>Extract Account Details</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Render via portal in browser environment, fallback to direct JSX in test/SSR
  if (typeof document !== 'undefined' && document.body) {
    return createPortal(content, document.body);
  }
  return content;
};

