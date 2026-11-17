import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Trash2,
  RotateCcw,
  AlertCircle,
  Loader2,
  ArrowRight,
  Info,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';
import { UploadedFileItem } from './OrderUpload';
import {
  ALLOWED_TYPES,
  MAX_FILE_SIZE,
  MAX_IMAGES_PER_ORDER,
  ScanProgressUpdate,
} from '../../services/ocrService';
import { formatFileSize } from '../../utils';

export interface ChequeUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFiles?: UploadedFileItem[];
  onFilesChange?: (files: UploadedFileItem[]) => void;
  onExtractCheque: (
    files: UploadedFileItem[],
    onProgress?: (update: ScanProgressUpdate) => void
  ) => Promise<void>;
}

/**
 * Dedicated Cheque / Bank Draft Icon with Distinct Banking Blue Aesthetic
 */
const MiniChequeIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" fill="#2858D8" />
    <path d="M5.5 8.5H10.5M5.5 11.5H8.5" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
    <rect x="14" y="7.5" width="4.5" height="4" rx="1" fill="#EAF1FF" />
    <path d="M15.2 9.5H17.2" stroke="#2858D8" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M5.5 15.5H18.5" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="1.5 1.5" opacity="0.9" />
  </svg>
);

export const ChequeUploadModal: React.FC<ChequeUploadModalProps> = ({
  isOpen,
  onClose,
  initialFiles = [],
  onFilesChange,
  onExtractCheque,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

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

  const validateSingleFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.has(file.type)) {
      return `"${file.name}" has an unsupported format. Only JPG, PNG, and WEBP cheque images are accepted.`;
    }
    if (file.size === 0) {
      return `"${file.name}" is empty (0 bytes). Please select a valid cheque image.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `"${file.name}" exceeds the 10MB size limit (${formatFileSize(file.size)}).`;
    }
    return null;
  };

  const handleSelectedFile = (file: File) => {
    if (isExtracting) return;
    setUploadError(null);

    const error = validateSingleFile(file);
    if (error) {
      setUploadError(error);
      return;
    }

    // Clean up previous preview URL if any
    if (selectedFiles.length > 0 && selectedFiles[0].previewUrl) {
      URL.revokeObjectURL(selectedFiles[0].previewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    const newFileItem: UploadedFileItem = {
      id: `chq-file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      name: file.name,
      size: file.size,
      previewUrl,
    };

    const updated = [newFileItem];
    setSelectedFiles(updated);
    onFilesChange?.(updated);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleSelectedFile(files[0]);
    }
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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveFile = () => {
    if (isExtracting) return;
    if (selectedFiles.length > 0 && selectedFiles[0].previewUrl) {
      URL.revokeObjectURL(selectedFiles[0].previewUrl);
    }
    setSelectedFiles([]);
    onFilesChange?.([]);
  };

  const handleExtract = async () => {
    if (isExtracting || selectedFiles.length === 0) return;
    setUploadError(null);
    setIsExtracting(true);

    try {
      await onExtractCheque(selectedFiles);
    } catch (err: any) {
      setUploadError(
        err?.message || 'Failed to extract cheque details. Please try again with a clear, well-lit cheque image.'
      );
      setIsExtracting(false);
    }
  };

  if (!isOpen) return null;

  const activeCheque = selectedFiles[0];

  const content = (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 bg-[#111C35]/55 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cheque-upload-modal-title"
      aria-describedby="cheque-upload-modal-description"
      onClick={() => {
        if (!isExtracting) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[700px] bg-[#FFFFFF] rounded-[18px] border border-[#D4E1FF] shadow-[0_20px_60px_rgba(20,46,96,0.18)] p-6 sm:p-7 relative font-sans flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Hidden File Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/webp"
          className="hidden"
          disabled={isExtracting}
          onChange={handleFileInputChange}
        />
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/png, image/jpeg, image/webp"
          className="hidden"
          disabled={isExtracting}
          onChange={handleFileInputChange}
        />

        {/* Top-Right Simple Close Button */}
        <button
          id="btn-close-cheque-upload"
          type="button"
          disabled={isExtracting}
          onClick={onClose}
          aria-label="Close cheque upload popup"
          className="absolute top-5 right-5 sm:top-6 sm:right-6 p-2 rounded-xl text-[#526B96] hover:text-[#142E60] hover:bg-[#F5F8FF] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Section 2: Compact White Header */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-[#EAF1FF] pr-10 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-[#EAF1FF] border border-[#D4E1FF] text-[#2858D8] flex items-center justify-center shrink-0 shadow-2xs">
            <MiniChequeIcon className="w-5 h-5" />
          </div>
          <div>
            <h2
              id="cheque-upload-modal-title"
              className="text-lg sm:text-[20px] font-bold font-heading text-[#142E60] tracking-tight leading-snug"
            >
              Upload Cheques
            </h2>
            <p
              id="cheque-upload-modal-description"
              className="text-xs sm:text-[13px] text-[#526B96] mt-0.5 font-normal font-sans"
            >
              Digitise cheque details quickly and accurately.
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

          {/* Section 3: Upload Area (Empty State) */}
          {!activeCheque ? (
            <div
              id="dropzone-cheque-upload"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative rounded-[16px] border-2 border-dashed transition-all px-6 py-9 sm:py-11 flex flex-col items-center justify-center text-center cursor-pointer select-none bg-[#F5F8FF] ${
                isDragging
                  ? 'border-[#2858D8] bg-[#EAF1FF]/80 ring-4 ring-[#2858D8]/10'
                  : 'border-[#D4E1FF] hover:border-[#2858D8] hover:bg-[#EAF1FF]/30'
              }`}
            >
              {/* Small cheque/document icon inside soft blue circular background */}
              <div className="w-12 h-12 rounded-full bg-[#EAF1FF] text-[#2858D8] border border-[#D4E1FF] flex items-center justify-center mb-3.5 shadow-2xs">
                <MiniChequeIcon className="w-6 h-6" />
              </div>

              {/* Heading */}
              <h3 className="text-base sm:text-[18px] font-bold font-heading text-[#142E60] leading-snug">
                Upload Your Cheque Image
              </h3>

              {/* Description */}
              <p className="text-xs sm:text-sm text-[#526B96] mt-1 mb-5 max-w-sm">
                Select a clear cheque image to extract its details.
              </p>

              {/* Primary button */}
              <button
                id="btn-browse-cheque-image"
                type="button"
                disabled={isExtracting}
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-linear-to-r from-[#3B82F6] to-[#1D4ED8] hover:opacity-95 text-white font-semibold text-xs sm:text-sm shadow-xs transition-all cursor-pointer font-heading"
              >
                <span>Browse Cheque Image</span>
              </button>

              {/* Supporting text */}
              <p className="text-xs text-[#526B96] mt-3">or drag and drop your image here</p>

              {/* Supported Formats */}
              <p className="text-[11px] sm:text-xs text-[#526B96] mt-4 font-normal">
                JPG, PNG, WEBP · Max 10MB per image
              </p>
            </div>
          ) : (
            /* Section 4: Uploaded Cheque Preview Card (Active State) */
            <div className="bg-[#F5F8FF] rounded-[16px] border border-[#D4E1FF] p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#D4E1FF] text-xs font-semibold text-[#142E60]">
                <span>Selected Cheque Image</span>
                <span className="text-[11px] text-[#2858D8] font-semibold bg-[#EAF1FF] px-2 py-0.5 rounded-full">
                  1 file ready
                </span>
              </div>

              {/* Cheque Preview Row */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-[#D4E1FF] shadow-2xs">
                {/* Cheque thumbnail & details */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <img
                    src={activeCheque.previewUrl}
                    alt={activeCheque.name}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover border border-[#D4E1FF] shrink-0 bg-slate-50"
                  />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-[#142E60] truncate font-heading">
                      {activeCheque.name}
                    </p>
                    <p className="text-[11px] text-[#526B96] mt-0.5">
                      {formatFileSize(activeCheque.size)}
                    </p>
                    <div className="inline-flex items-center gap-1 text-[11px] text-[#2858D8] mt-1 font-medium">
                      <CheckCircle2 className="w-3 h-3 text-[#2858D8]" />
                      <span>Ready for cheque OCR extraction</span>
                    </div>
                  </div>
                </div>

                {/* Replace & Remove Controls */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    id="btn-replace-cheque"
                    disabled={isExtracting}
                    onClick={() => replaceInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D4E1FF] bg-white text-xs font-semibold text-[#142E60] hover:bg-[#F5F8FF] transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Replace</span>
                  </button>
                  <button
                    type="button"
                    id="btn-remove-cheque"
                    disabled={isExtracting}
                    onClick={handleRemoveFile}
                    aria-label="Remove cheque image"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 5: Main Action / Footer */}
        <div className="pt-3 border-t border-[#EAF1FF] shrink-0 text-center">
          {/* Subtle Helper Message */}
          <div className="flex items-center justify-center gap-1.5 text-xs text-[#526B96] mb-2.5 font-normal">
            <Info className="w-3.5 h-3.5 text-[#2858D8]" />
            <span>Please upload a clear and readable cheque image.</span>
          </div>

          {/* Full-width Extract Cheque Details Button */}
          <button
            id="btn-extract-cheque-details"
            type="button"
            disabled={!activeCheque || isExtracting}
            onClick={handleExtract}
            className="w-full h-[48px] rounded-[12px] bg-linear-to-r from-[#3B82F6] to-[#1D4ED8] hover:opacity-95 active:opacity-90 text-white font-heading font-bold text-sm sm:text-base shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isExtracting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Extracting Cheque Details...</span>
              </>
            ) : (
              <>
                <span>Extract Cheque Details</span>
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

