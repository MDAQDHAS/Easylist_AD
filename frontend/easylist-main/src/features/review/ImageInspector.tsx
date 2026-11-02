import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  FileImage,
  Upload,
} from 'lucide-react';
import { UploadedFileItem } from '../../types/order';

interface ImageInspectorProps {
  images: UploadedFileItem[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onGoToUpload?: () => void;
}

export const ImageInspector: React.FC<ImageInspectorProps> = ({
  images,
  currentIndex,
  onIndexChange,
  onGoToUpload,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [prevIndex, setPrevIndex] = useState<number>(currentIndex);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset zoom & pan when image changes (standard React pattern)
  if (currentIndex !== prevIndex) {
    setPrevIndex(currentIndex);
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }

  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;

  const handleZoomIn = () => setZoom((z) => Math.min(Math.round((z + 0.25) * 100) / 100, 3.5));
  const handleZoomOut = () => {
    setZoom((z) => {
      const next = Math.max(Math.round((z - 0.25) * 100) / 100, 0.75);
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      onIndexChange(currentIndex - 1);
    }
  }, [currentIndex, onIndexChange]);

  const handleNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      onIndexChange(currentIndex + 1);
    }
  }, [currentIndex, images.length, onIndexChange]);

  // Keyboard navigation for Prev/Next
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext]);

  // Pan / Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || zoom <= 1) return;
    setPan({
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y,
    });
  };

  const handleMouseUp = () => setIsPanning(false);

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  // Empty state when no images are uploaded
  if (!images || images.length === 0 || !currentImage) {
    return (
      <div className="w-full bg-white rounded-[22px] border border-[#DCE5F2] shadow-xs p-6 sm:p-8 flex flex-col items-center justify-center text-center min-h-[460px]">
        <div className="w-16 h-16 rounded-2xl bg-[#EEF2FF] text-[#5046F2] flex items-center justify-center mb-4 shadow-xs">
          <FileImage className="w-8 h-8 stroke-[1.8]" />
        </div>
        <h3 className="text-base sm:text-lg font-bold font-heading text-[#111827]">
          No Order Image Available
        </h3>
        <p className="text-xs sm:text-sm text-[#64748B] mt-1 mb-5 max-w-sm">
          Please upload your handwritten order chit image in the Upload step to compare it with extracted items.
        </p>
        {onGoToUpload && (
          <button
            type="button"
            onClick={onGoToUpload}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5046F2] hover:bg-[#4338CA] text-white text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Go to Upload</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-[22px] border border-[#DCE5F2] shadow-xs p-4 sm:p-5 flex flex-col transition-all">
      {/* Top Header & Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] text-[#5046F2] flex items-center justify-center shrink-0">
            <FileImage className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold font-heading text-[#111827] leading-tight">
                Original Order
              </h3>
              {hasMultiple && (
                <span className="px-2 py-0.5 rounded-md bg-[#EEF2FF] text-[#5046F2] text-[11px] font-bold">
                  {currentIndex + 1} of {images.length}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#64748B] truncate max-w-[200px] sm:max-w-xs mt-0.5">
              {currentImage.name}
            </p>
          </div>
        </div>

        {/* Zoom & Inspect Controls */}
        <div className="flex items-center gap-1 bg-[#F8FAFF] p-1 rounded-xl border border-[#DCE5F2]/80">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= 0.75}
            title="Zoom Out"
            className="p-1.5 rounded-lg text-slate-600 hover:text-[#5046F2] hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="text-[11px] font-semibold text-slate-700 min-w-[40px] text-center select-none">
            {Math.round(zoom * 100)}%
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= 3.5}
            title="Zoom In"
            className="p-1.5 rounded-lg text-slate-600 hover:text-[#5046F2] hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-slate-200 mx-0.5" />

          <button
            type="button"
            onClick={handleRotate}
            title="Rotate Clockwise 90°"
            className="p-1.5 rounded-lg text-slate-600 hover:text-[#5046F2] hover:bg-white cursor-pointer transition-colors"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleReset}
            title="Reset Zoom & Rotation"
            className="p-1.5 rounded-lg text-slate-600 hover:text-[#5046F2] hover:bg-white cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Image Canvas Viewport */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative w-full h-[380px] sm:h-[450px] lg:h-[490px] bg-[#0A0F1D] rounded-xl overflow-hidden select-none border border-slate-800 flex items-center justify-center ${
          zoom > 1 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
        }`}
      >
        <div
          className="w-full h-full flex items-center justify-center transition-transform"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: 'center center',
            transition: isPanning ? 'none' : 'transform 120ms ease-out',
          }}
        >
          <img
            src={currentImage.previewUrl}
            alt={currentImage.name}
            draggable={false}
            className="max-w-full max-h-full object-contain pointer-events-none drop-shadow-md"
          />
        </div>

        {/* Floating Prev / Next Controls */}
        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              aria-label="Previous Image"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur-xs border border-white/10 disabled:opacity-20 disabled:pointer-events-none transition-all shadow-md cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={currentIndex === images.length - 1}
              aria-label="Next Image"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur-xs border border-white/10 disabled:opacity-20 disabled:pointer-events-none transition-all shadow-md cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Pan hint when zoomed in */}
        {zoom > 1 && (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/70 text-white/90 text-[11px] font-medium backdrop-blur-xs pointer-events-none shadow-xs">
            Drag to pan image
          </div>
        )}
      </div>

      {/* Thumbnails Tray for Multiple Images */}
      {hasMultiple && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1">
          {images.map((item, index) => {
            const isActive = index === currentIndex;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onIndexChange(index)}
                className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                  isActive
                    ? 'border-[#5046F2] ring-2 ring-[#5046F2]/30 scale-102'
                    : 'border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100'
                }`}
                title={item.name}
              >
                <img
                  src={item.previewUrl}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0 right-0 px-1 text-[9px] font-bold bg-black/60 text-white rounded-tl">
                  {index + 1}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ImageInspector;
