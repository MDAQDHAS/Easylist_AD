import React, { useRef, useState, useEffect } from 'react';
import {
  UploadCloud,
  Image as ImageIcon,
  FileUp,
  X,
  FileCheck,
  ArrowRight,
  Plus,
  AlertCircle,
  Loader2,
  RotateCw,
  CheckCircle2,
} from 'lucide-react';
import { formatFileSize } from '../../utils';
import { ScanProgressUpdate } from '../../services/ocrService';
import { PaperToDigitalOcrAnimation } from './PaperToDigitalOcrAnimation';

export interface UploadedFileItem {
  id: string;
  file?: File;
  name: string;
  size: number;
  previewUrl: string;
}

interface OrderUploadProps {
  initialFiles?: UploadedFileItem[];
  onProceedToReview?: (
    files: UploadedFileItem[],
    onProgress?: (update: ScanProgressUpdate) => void
  ) => void | Promise<void>;
  onFilesChange?: (files: UploadedFileItem[]) => void;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMAGES_PER_ORDER = 10;

export const OrderUpload: React.FC<OrderUploadProps> = ({
  initialFiles = [],
  onProceedToReview,
  onFilesChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const extractionInFlightRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<UploadedFileItem[]>(initialFiles);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isExtractionComplete, setIsExtractionComplete] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgressUpdate | null>(null);

  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      setSelectedFiles(initialFiles);
    }
  }, [initialFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFiles = (files: FileList | null) => {
    if (isExtracting || !files || files.length === 0) return;
    setUploadError(null);

    const incoming = Array.from(files);

    // 1. Image count validation
    if (selectedFiles.length + incoming.length > MAX_IMAGES_PER_ORDER) {
      const remainingSlots = Math.max(0, MAX_IMAGES_PER_ORDER - selectedFiles.length);
      setUploadError(
        `Upload limit reached: Maximum ${MAX_IMAGES_PER_ORDER} images allowed per order. You can add up to ${remainingSlots} more image(s).`
      );
      return;
    }

    const validNewFiles: UploadedFileItem[] = [];
    const errorMessages: string[] = [];
    const existingKeys = new Set(
      selectedFiles.map((f) => `${f.name}:${f.size}`)
    );

    for (const file of incoming) {
      // 2. File type validation
      if (!ALLOWED_TYPES.includes(file.type)) {
        errorMessages.push(`"${file.name}" has an unsupported format. Only JPG, PNG, and WEBP images are accepted.`);
        continue;
      }

      // 3. Empty file validation
      if (file.size === 0) {
        errorMessages.push(`"${file.name}" is empty (0 bytes). Please select a valid image file.`);
        continue;
      }

      // 4. File size validation
      if (file.size > MAX_FILE_SIZE) {
        errorMessages.push(`"${file.name}" exceeds the 10MB size limit (${formatFileSize(file.size)}).`);
        continue;
      }

      // 5. Duplicate file check within the current order
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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

  const handleStartExtraction = async () => {
    if (selectedFiles.length === 0 || extractionInFlightRef.current) return;
    extractionInFlightRef.current = true;
    setUploadError(null);
    setIsExtracting(true);
    setIsExtractionComplete(false);
    setScanProgress({
      stageNumber: 1,
      stageName: 'Uploading image',
      detail: selectedFiles.length > 1
        ? `Preparing ${selectedFiles.length} images for analysis...`
        : 'Preparing your order image for analysis...',
      percent: 5,
    });

    try {
      await onProceedToReview?.(selectedFiles, (update) => {
        setScanProgress(update);
      });
      setIsExtractionComplete(true);
      await new Promise((resolve) => setTimeout(resolve, 800));
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

  return (
    <div className="w-full max-w-[970px] mx-auto px-4 sm:px-0">
      {/* Main Upload Card */}
      <div className="w-full bg-white rounded-[22px] border border-[#DCE5F2] shadow-xs px-6 py-6 sm:px-8 sm:py-[28px] lg:px-9 lg:py-[28px] transition-all">
        {/* Card Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#EEF2FF] text-[#5046F2] flex items-center justify-center shrink-0">
              <FileUp className="w-4.5 h-4.5 sm:w-5 sm:h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-heading text-[#111827] leading-tight">
                New Order
              </h2>
              <p className="text-xs sm:text-[13px] text-[#64748B] mt-0.5">
                Upload your handwritten order images (Tamil & English).
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-100/80">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>{isExtracting ? 'Analyzing order...' : 'Ready to upload'}</span>
          </div>
        </div>

        {/* Upload Error Banner with Preserved Image Confirmation & Retry Action */}
        {uploadError && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm flex flex-col gap-2.5 animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-rose-900 leading-snug">Extraction could not complete</p>
                  <p className="text-rose-700 mt-0.5 leading-relaxed">{uploadError}</p>
                  {selectedFiles.length > 0 && (
                    <p className="text-rose-600 text-[11px] sm:text-xs mt-1.5 font-medium">
                      Your {selectedFiles.length} selected {selectedFiles.length === 1 ? 'order image is' : 'order images are'} preserved below. You do not need to re-select your files.
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUploadError(null)}
                className="text-rose-400 hover:text-rose-700 p-0.5 cursor-pointer shrink-0"
                aria-label="Dismiss alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {selectedFiles.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-rose-200/60">
                <button
                  type="button"
                  id="btn-retry-extraction-banner"
                  disabled={isExtracting}
                  onClick={handleStartExtraction}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Retry Extraction</span>
                </button>
                <span className="text-[11px] text-rose-600">
                  Retrying will automatically route via backup AI models and re-use completed images.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Paper to Digital Animated OCR Experience */}
        {isExtracting && (
          <PaperToDigitalOcrAnimation
            progress={scanProgress}
            uploadedImagesCount={selectedFiles.length}
            currentImageNumber={scanProgress?.currentImage || 1}
            previewUrl={selectedFiles[0]?.previewUrl}
            isComplete={isExtractionComplete}
          />
        )}

        {/* Upload Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative rounded-[20px] border border-[#C7D2FE] bg-[#F8FAFF] hover:bg-[#F3F6FE] transition-all min-h-[240px] sm:h-[250px] flex flex-col items-center justify-center p-4 sm:p-5 text-center cursor-pointer mt-[18px] select-none ${
            isDragging
              ? 'border-[#5046F2] bg-[#EEF2FF]/60 ring-4 ring-[#5046F2]/10'
              : ''
          } ${isExtracting ? 'opacity-60 pointer-events-none' : ''}`}
        >
          {/* Multi-image file input for gallery / device file selection */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png, image/jpeg, image/webp"
            className="hidden"
            disabled={isExtracting}
            onChange={handleFileChange}
          />

          {/* Upload Cloud Icon */}
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#EEF2FF] text-[#5046F2] flex items-center justify-center mb-2.5 shadow-xs">
            <UploadCloud className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
          </div>

          {/* Primary Text */}
          <h3 className="text-base sm:text-[17px] font-bold font-heading text-[#111827] leading-snug">
            Drag & drop your order images here
          </h3>

          {/* Secondary Text */}
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 mb-3">
            or choose images from your device
          </p>

          {/* Upload Action Button: File Picker */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
            <button
              id="btn-choose-images"
              type="button"
              disabled={isExtracting}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5046F2] hover:bg-[#4338CA] active:bg-[#3730A3] text-white font-semibold text-xs sm:text-sm shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <ImageIcon className="w-4 h-4 text-white" />
              <span>Choose Images</span>
            </button>
          </div>

          {/* Formats Helper */}
          <div className="text-[11px] sm:text-xs text-[#94A3B8] mt-2.5 font-normal">
            JPG, PNG, WEBP · Max 10MB per image · Up to 10 images
          </div>
        </div>

        {/* Selected Files Preview Tray */}
        {selectedFiles.length > 0 && (
          <div className="mt-5 pt-5 border-t border-slate-100 animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs sm:text-sm font-bold text-[#111827] flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                Selected Orders ({selectedFiles.length}/{MAX_IMAGES_PER_ORDER})
              </span>
              {selectedFiles.length < MAX_IMAGES_PER_ORDER && !isExtracting && (
                <button
                  type="button"
                  disabled={isExtracting}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#5046F2] hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add More</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {selectedFiles.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 bg-white shadow-xs relative group"
                >
                  <img
                    src={item.previewUrl}
                    alt={item.name}
                    className="w-12 h-12 rounded-lg object-cover border border-slate-100 bg-slate-50 shrink-0"
                  />
                  <div className="flex-1 min-w-0 pr-6">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {item.name}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {formatFileSize(item.size)}
                    </p>
                  </div>
                  {!isExtracting && (
                    <button
                      type="button"
                      onClick={(e) => handleRemoveFile(item.id, e)}
                      className="absolute right-2 top-2 p-1 text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                      aria-label={`Remove ${item.name}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-[#64748B]">
                Images are sent to the AI service for extraction; EasyList never discards your selected files.
              </span>

              <button
                type="button"
                id="btn-process-extract-order"
                disabled={isExtracting}
                onClick={handleStartExtraction}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-xs sm:text-sm shadow-sm transition-all cursor-pointer ${
                  uploadError
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#5046F2] hover:bg-[#4338CA]'
                } disabled:opacity-60`}
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Extracting Order Details...</span>
                  </>
                ) : uploadError ? (
                  <>
                    <RotateCw className="w-4 h-4" />
                    <span>Retry Extraction</span>
                  </>
                ) : (
                  <>
                    <span>Process & Extract Order</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderUpload;
