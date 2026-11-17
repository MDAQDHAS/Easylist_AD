import React, { useState, useRef, useCallback } from 'react';
import {
  X,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { productMasterService } from '../../services/productMasterService';
import { ProductMasterFile } from '../../types/productMaster';

interface ProductMasterUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (newMaster: ProductMasterFile) => void;
  existingMaster: ProductMasterFile | null;
}

export const ProductMasterUploadModal: React.FC<ProductMasterUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  existingMaster,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isReplacing = Boolean(existingMaster);

  const resetState = useCallback(() => {
    setSelectedFile(null);
    setIsDragOver(false);
    setIsProcessing(false);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleClose = () => {
    if (isProcessing) return;
    resetState();
    onClose();
  };

  const validateAndSelectFile = (file: File) => {
    setErrorMessage(null);
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const lowerName = file.name.toLowerCase();
    const isValidExt = validExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isValidExt) {
      setErrorMessage('Please upload a valid Excel or CSV spreadsheet (.xlsx, .xls, .csv).');
      return;
    }

    const MAX_SIZE = 15 * 1024 * 1024; // 15MB
    if (file.size > MAX_SIZE) {
      setErrorMessage('Spreadsheet file size exceeds 15MB. Please upload a smaller file.');
      return;
    }

    setSelectedFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSelectFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSelectFile(file);
    }
  };

  const handleProcessUpload = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const parsedMaster = await productMasterService.parseSpreadsheetFile(selectedFile);
      productMasterService.saveProductMaster(parsedMaster);
      onUploadSuccess(parsedMaster);
      resetState();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to parse spreadsheet file.';
      setErrorMessage(msg);
      setIsProcessing(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-product-master"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-[680px] bg-[#F8F7F4] rounded-[20px] border border-[#DCE8E1] shadow-2xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200 relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E7EFEA]">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#E3F7EF] border border-[#C5EDE0] flex items-center justify-center text-[#0D9668] shrink-0">
              <FileSpreadsheet className="w-6 h-6 stroke-[1.8]" />
            </div>
            <div>
              <h2
                id="modal-title-product-master"
                className="text-[19px] sm:text-[21px] font-bold font-heading text-[#172554] leading-tight"
              >
                {isReplacing ? 'Replace Product Master' : 'Upload Product Master'}
              </h2>
              <p className="text-xs sm:text-[13px] text-[#64748B] mt-0.5 font-sans">
                Upload your shop&apos;s product Excel file to manage product information and improve order matching.
              </p>
            </div>
          </div>

          <button
            id="btn-close-product-master-modal"
            type="button"
            onClick={handleClose}
            disabled={isProcessing}
            aria-label="Close upload modal"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#172554] hover:bg-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5 stroke-[2]" />
          </button>
        </div>

        {/* Replacement Notice Banner */}
        {isReplacing && (
          <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 flex items-start gap-3 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold">Important Notice: </span>
              Uploading a new file will completely replace your current Product Master (
              <span className="font-semibold underline decoration-amber-400">
                {existingMaster?.fileName}
              </span>{' '}
              with {existingMaster?.productCount.toLocaleString()} products).
            </div>
          </div>
        )}

        {/* Drag and Drop Upload Card */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-[16px] p-6 sm:p-8 text-center transition-all bg-white flex flex-col items-center justify-center cursor-pointer ${
            isDragOver
              ? 'border-[#0D9668] bg-[#E3F7EF]/30 scale-[0.995]'
              : 'border-[#A7DCC4] hover:border-[#0D9668] hover:bg-[#F9FCFA]'
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            className="hidden"
            id="input-product-master-file"
          />

          <div className="w-14 h-14 rounded-2xl bg-[#E3F7EF] text-[#0D9668] flex items-center justify-center mb-3.5 border border-[#C5EDE0]">
            <UploadCloud className="w-7 h-7 stroke-[1.8]" />
          </div>

          <h3 className="text-base sm:text-[17px] font-bold font-heading text-[#172554]">
            Drop your product Excel or CSV file here
          </h3>
          <p className="text-xs sm:text-[13px] text-[#64748B] mt-1 mb-4 font-sans">
            or browse files from your device
          </p>

          <button
            id="btn-browse-product-master"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-[#DCE8E1] hover:border-[#0D9668] hover:bg-[#F2FBF7] text-[#0D9668] text-xs sm:text-sm font-semibold transition-all shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Browse Spreadsheet</span>
          </button>

          <p className="text-[11px] text-slate-400 mt-4">
            Supports XLSX, XLS and CSV files · Max 15MB
          </p>
        </div>

        {/* Selected File Card */}
        {selectedFile && (
          <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-[#DCE8E1] shadow-2xs flex items-center justify-between gap-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-[#E3F7EF] text-[#0D9668] flex items-center justify-center shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-[#172554] truncate">
                  {selectedFile.name}
                </p>
                <p className="text-[11px] text-[#64748B]">
                  {formatFileSize(selectedFile.size)} · Ready to import
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="px-2.5 py-1 text-xs font-semibold text-[#0D9668] hover:bg-[#E3F7EF] rounded-lg transition-colors cursor-pointer"
              >
                Change
              </button>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                disabled={isProcessing}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Error Feedback */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Footer & Submit Button */}
        <div className="pt-2">
          <button
            id="btn-submit-product-master"
            type="button"
            onClick={handleProcessUpload}
            disabled={!selectedFile || isProcessing}
            className="w-full h-[48px] rounded-[12px] bg-linear-to-r from-[#0D9668] to-[#07865D] hover:opacity-95 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Reading & Validating Products...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                <span>{isReplacing ? 'Replace Product Master' : 'Upload Product Master'}</span>
              </>
            )}
          </button>
          <p className="text-center text-[11px] text-slate-400 mt-2.5 font-sans">
            Products from your spreadsheet will be indexed for instant order matching.
          </p>
        </div>
      </div>
    </div>
  );
};

