import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  UploadCloud,
  Image as ImageIcon,
  X,
  Trash2,
  RefreshCw,
  Plus,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  FileCheck2,
} from 'lucide-react';
import { UploadedFileItem } from './OrderUpload';
import { PaperToDigitalOcrAnimation } from './PaperToDigitalOcrAnimation';
import {
  ALLOWED_TYPES,
  MAX_FILE_SIZE,
  MAX_IMAGES_PER_ORDER,
  ScanProgressUpdate,
} from '../../services/ocrService';
import { formatFileSize } from '../../utils';

export interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  actionLabel?: string;
  initialFiles?: UploadedFileItem[];
  onFilesChange?: (files: UploadedFileItem[]) => void;
  onExtractOrder: (
    files: UploadedFileItem[],
    onProgress?: (update: ScanProgressUpdate) => void
  ) => Promise<void>;
}

export const PhotoUploadModal: React.FC<PhotoUploadModalProps> = ({
  isOpen,
  onClose,
  title = 'Upload Order Image',
  description = 'Turn your handwritten orders into digital lists.',
  actionLabel = 'Extract Order',
  initialFiles = [],
  onFilesChange,
  onExtractOrder,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const extractionInFlightRef = useRef(false);

  const [selectedFiles, setSelectedFiles] = useState<UploadedFileItem[]>(initialFiles);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isExtractionComplete, setIsExtractionComplete] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgressUpdate | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedFiles(initialFiles);
      setUploadError(null);
    }
  }, [isOpen, initialFiles]);

  // Close on Escape key when not actively extracting
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
      return `"${file.name}" is empty (0 bytes). Please select a valid image file.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `"${file.name}" exceeds the 10MB size limit (${formatFileSize(file.size)}).`;
    }
    return null;
  };

  const processIncomingFiles = (files: FileList | null) => {
    if (isExtracting || !files || files.length === 0) return;
    setUploadError(null);

    const incoming = Array.from(files);

    if (selectedFiles.length + incoming.length > MAX_IMAGES_PER_ORDER) {
      const remainingSlots = Math.max(0, MAX_IMAGES_PER_ORDER - selectedFiles.length);
      setUploadError(
        `Upload limit reached: Maximum ${MAX_IMAGES_PER_ORDER} images allowed per order. You can add up to ${remainingSlots} more image(s).`
      );
      return;
    }

    const validNewFiles: UploadedFileItem[] = [];
    const errorMessages: string[] = [];
    const existingKeys = new Set(selectedFiles.map((f) => `${f.name}:${f.size}`));

    for (const file of incoming) {
      const validationError = validateSingleFile(file);
      if (validationError) {
        errorMessages.push(validationError);
        continue;
      }

      const fileKey = `${file.name}:${file.size}`;
      if (existingKeys.has(fileKey)) {
        errorMessages.push(`"${file.name}" is already selected in this order.`);
        continue;
      }
      existingKeys.add(fileKey);

      validNewFiles.push({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        name: file.name,
        size: file.size,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (errorMessages.length > 0) {
      setUploadError(errorMessages.join(' '));
    }

    if (validNewFiles.length > 0) {
      const nextFiles = [...selectedFiles, ...validNewFiles];
      setSelectedFiles(nextFiles);
      onFilesChange?.(nextFiles);
    }
  };

  const handleReplaceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (replaceInputRef.current) {
      replaceInputRef.current.value = '';
    }
    if (!file || !replaceTargetId || isExtracting) return;

    setUploadError(null);
    const validationError = validateSingleFile(file);
    if (validationError) {
      setUploadError(validationError);
      setReplaceTargetId(null);
      return;
    }

    const duplicate = selectedFiles.some(
      (f) => f.id !== replaceTargetId && f.name === file.name && f.size === file.size
    );
    if (duplicate) {
      setUploadError(`"${file.name}" is already selected in this order.`);
      setReplaceTargetId(null);
      return;
    }

    const nextFiles = selectedFiles.map((item) => {
      if (item.id !== replaceTargetId) return item;
      if (item.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return {
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        name: file.name,
        size: file.size,
        previewUrl: URL.createObjectURL(file),
      };
    });

    setSelectedFiles(nextFiles);
    onFilesChange?.(nextFiles);
    setReplaceTargetId(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processIncomingFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isExtracting) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processIncomingFiles(e.dataTransfer.files);
  };

  const handleRemoveFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isExtracting) return;
    const itemToRemove = selectedFiles.find((item) => item.id === id);
    if (itemToRemove && itemToRemove.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(itemToRemove.previewUrl);
    }
    const filtered = selectedFiles.filter((item) => item.id !== id);
    setSelectedFiles(filtered);
    onFilesChange?.(filtered);
  };

  const handleTriggerReplace = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isExtracting) return;
    setReplaceTargetId(id);
    replaceInputRef.current?.click();
  };

  const handleStartExtraction = async () => {
    if (selectedFiles.length === 0 || extractionInFlightRef.current) return;
    extractionInFlightRef.current = true;
    setUploadError(null);
    setIsExtracting(true);
    setIsExtractionComplete(false);
    setScanProgress({
      stageNumber: 1,
      stageName: 'Uploading image',
      detail:
        selectedFiles.length > 1
          ? `Preparing ${selectedFiles.length} images for analysis...`
          : 'Preparing your order image for analysis...',
      percent: 5,
    });

    try {
      await onExtractOrder(selectedFiles, (update) => {
        setScanProgress(update);
      });
      setIsExtractionComplete(true);
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : 'Text extraction failed. Please check your connection and try again.'
      );
    } finally {
      extractionInFlightRef.current = false;
      setIsExtracting(false);
      setIsExtractionComplete(false);
      setScanProgress(null);
    }
  };

  if (!isOpen) return null;

  const content = (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 bg-[#111C35]/55 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-upload-modal-title"
      aria-describedby="photo-upload-modal-description"
      onClick={() => {
        if (!isExtracting) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[720px] bg-[#F8F7F4] rounded-[24px] border border-[#E5E0D8] shadow-[0_24px_70px_rgba(17,28,53,0.28)] p-6 sm:p-8 relative font-sans max-h-[92dvh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
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
          ref={replaceInputRef}
          type="file"
          accept="image/png, image/jpeg, image/webp"
          className="hidden"
          disabled={isExtracting}
          onChange={handleReplaceFileChange}
        />

        {/* Top-Right Close Button */}
        <button
          id="btn-close-photo-upload-modal"
          type="button"
          disabled={isExtracting}
          onClick={onClose}
          aria-label="Close upload popup"
          className="absolute top-5 right-5 sm:top-6 sm:right-6 p-2 rounded-xl text-[#64748B] hover:text-[#172554] hover:bg-black/5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-4 pb-5 border-b border-[#E6E2DA] pr-10 shrink-0">
          <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-[#EFE9FF] border border-[#D8CBFF] text-[#6842DB] flex items-center justify-center shrink-0 shadow-2xs">
            <UploadCloud className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h2
              id="photo-upload-modal-title"
              className="text-xl sm:text-[24px] font-bold font-heading text-[#172554] tracking-tight leading-tight"
            >
              {title}
            </h2>
            <p
              id="photo-upload-modal-description"
              className="text-xs sm:text-sm text-[#64748B] mt-1 font-normal"
            >
              {description}
            </p>
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto py-5 space-y-5 pr-0.5">
          {/* Error Banner */}
          {uploadError && (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm flex items-start justify-between gap-3 animate-in fade-in duration-150"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-rose-950 leading-snug">
                    Unable to process request
                  </p>
                  <p className="text-rose-700 mt-0.5 leading-relaxed">{uploadError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUploadError(null)}
                aria-label="Dismiss error"
                className="text-rose-400 hover:text-rose-700 p-1 rounded-lg cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Live AI Extraction Animation State */}
          {isExtracting && (
            <div className="rounded-[20px] bg-white border border-[#DED6F8] p-4 shadow-xs">
              <PaperToDigitalOcrAnimation
                progress={scanProgress}
                uploadedImagesCount={selectedFiles.length}
                currentImageNumber={scanProgress?.currentImage || 1}
                previewUrl={selectedFiles[0]?.previewUrl}
                isComplete={isExtractionComplete}
              />
            </div>
          )}

          {/* Drag-and-Drop Upload Zone */}
          {!isExtracting && (
            <div
              id="dropzone-photo-upload-modal"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative rounded-[20px] border-2 border-dashed transition-all px-5 py-7 sm:py-9 flex flex-col items-center justify-center text-center cursor-pointer select-none ${
                isDragging
                  ? 'border-[#6842DB] bg-[#F2ECFF] ring-4 ring-[#6842DB]/15'
                  : 'border-[#C9B8FF] bg-white hover:border-[#6842DB] hover:bg-[#FCFaff]'
              }`}
            >
              <div className="w-15 h-15 sm:w-16 sm:h-16 rounded-full bg-[#EFE9FF] text-[#6842DB] flex items-center justify-center mb-3.5 shadow-2xs">
                <UploadCloud className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.1]" />
              </div>

              <h3 className="text-base sm:text-[18px] font-bold font-heading text-[#172554] leading-snug">
                Drop your order image here
              </h3>

              <p className="text-xs sm:text-sm text-[#64748B] mt-1 mb-4">
                or browse files from your device
              </p>

              <button
                id="btn-modal-choose-image"
                type="button"
                disabled={isExtracting}
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-[#8055F5] to-[#5132CC] hover:opacity-95 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-white" />
                <span>Choose Image</span>
              </button>

              <p className="text-[11px] sm:text-xs text-[#64748B] mt-3.5 font-normal">
                Supports JPG, PNG, WEBP · Max 10MB per image · Up to {MAX_IMAGES_PER_ORDER} images
              </p>
            </div>
          )}

          {/* Selected Images Preview & Remove/Replace Controls */}
          {selectedFiles.length > 0 && (
            <div className="bg-white rounded-[18px] border border-[#E5E0D8] p-4 sm:p-5 shadow-2xs">
              <div className="flex items-center justify-between gap-2 mb-3.5">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-[#6842DB]" />
                  <span className="text-xs sm:text-sm font-bold font-heading text-[#172554]">
                    Selected Order {selectedFiles.length === 1 ? 'Image' : 'Images'} (
                    {selectedFiles.length}/{MAX_IMAGES_PER_ORDER})
                  </span>
                </div>

                {selectedFiles.length < MAX_IMAGES_PER_ORDER && !isExtracting && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#6842DB] hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add More</span>
                  </button>
                )}
              </div>

              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {selectedFiles.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl border border-[#E8E4DC] bg-[#F8F7F4]/70 hover:bg-[#F8F7F4] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <img
                        src={item.previewUrl}
                        alt={item.name}
                        className="w-13 h-13 sm:w-14 sm:h-14 rounded-lg object-cover border border-[#DED8CE] bg-white shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-semibold text-[#172554] truncate">
                          {item.name}
                        </p>
                        <p className="text-[11px] sm:text-xs text-[#64748B] mt-0.5">
                          {formatFileSize(item.size)}
                        </p>
                      </div>
                    </div>

                    {!isExtracting && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleTriggerReplace(item.id, e)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#DCD6CC] bg-white hover:border-[#6842DB] hover:text-[#6842DB] text-[#172554] text-xs font-medium transition-colors cursor-pointer"
                          title={`Replace ${item.name}`}
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Replace</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveFile(item.id, e)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-rose-200 hover:bg-rose-50 text-[#64748B] hover:text-rose-600 text-xs font-medium transition-colors cursor-pointer"
                          aria-label={`Remove ${item.name}`}
                          title={`Remove ${item.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Remove</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer: Full-Width "Extract Order" Button */}
        <div className="pt-4 border-t border-[#E6E2DA] shrink-0">
          <button
            id="btn-extract-order"
            type="button"
            disabled={selectedFiles.length === 0 || isExtracting}
            onClick={handleStartExtraction}
            className="w-full h-[50px] sm:h-[54px] rounded-[14px] bg-linear-to-r from-[#8055F5] to-[#5132CC] hover:opacity-95 active:opacity-90 text-white font-heading font-bold text-sm sm:text-base shadow-[0_8px_22px_rgba(104,66,219,0.28)] flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isExtracting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Extracting Order...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4.5 h-4.5" />
                <span>{actionLabel}</span>
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

export default PhotoUploadModal;

