import React from 'react';
import { ScanProgressUpdate } from '../../services/ocrService';

export interface PaperToDigitalOcrAnimationProps {
  progress?: ScanProgressUpdate | null;
  uploadedImagesCount?: number;
  currentImageNumber?: number;
  previewUrl?: string;
  isComplete?: boolean;
}

export const PaperToDigitalOcrAnimation: React.FC<PaperToDigitalOcrAnimationProps> = ({
  progress,
  isComplete = false,
}) => {
  // Determine if genuine percentage is available from the backend
  const hasGenuineProgress =
    isComplete ||
    (progress?.percent !== undefined &&
      typeof progress.percent === 'number' &&
      !isNaN(progress.percent));

  const displayPercent = isComplete
    ? 100
    : hasGenuineProgress && progress?.percent !== undefined
      ? Math.min(100, Math.max(0, Math.round(progress.percent)))
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-transparent select-none pointer-events-auto"
      role="status"
      aria-live="polite"
      aria-label="Converting order"
    >
      {/* Exact Horizontal Row: 3 Animated Icons (Handwritten Paper -> Converting Arrow -> Digital Text) */}
      <div className="flex items-center justify-center gap-6 sm:gap-8">
        {/* LEFT: Handwritten Paper Icon */}
        <div
          className="flex items-center justify-center"
          aria-label="Handwritten paper"
          title="Handwritten Paper"
        >
          <svg
            width="52"
            height="60"
            viewBox="0 0 52 60"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-11 h-[52px] sm:w-[52px] sm:h-[60px]"
          >
            {/* Paper Outline */}
            <path
              d="M6 4C6 2.89543 6.89543 2 8 2H34L46 14V56C46 57.1046 45.1046 58 44 58H8C6.89543 58 6 57.1046 6 56V4Z"
              stroke="#111C35"
              strokeWidth="2.5"
              strokeLinejoin="round"
              fill="#FFFFFF"
            />
            {/* Paper Fold */}
            <path
              d="M34 2V14H46"
              stroke="#111C35"
              strokeWidth="2.5"
              strokeLinejoin="round"
              fill="#F8FAFC"
            />
            {/* Handwritten Wavy Line 1 */}
            <path
              className={isComplete ? undefined : 'handwritten-line-1'}
              d="M14 22C17 21 20 23 23 22C26 21 29 22 32 21C35 20.5 37 22 38 21.5"
              stroke="#5046F2"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Handwritten Wavy Line 2 */}
            <path
              className={isComplete ? undefined : 'handwritten-line-2'}
              d="M14 32C18 33 21 31 25 32C28 32.5 31 31 35 32"
              stroke="#5046F2"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Handwritten Wavy Line 3 */}
            <path
              className={isComplete ? undefined : 'handwritten-line-3'}
              d="M14 42C17 41.5 20 43 24 42C27 41 30 42.5 33 42"
              stroke="#5046F2"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* CENTER: Converting Arrow Icon (⇄) */}
        <div
          className="flex items-center justify-center"
          aria-label="Converting arrow"
          title="Converting"
        >
          <svg
            width="44"
            height="44"
            viewBox="0 0 44 44"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-8 h-8 sm:w-10 sm:h-10"
          >
            {/* Top Arrow: Pointing Right */}
            <g className={isComplete ? undefined : 'converting-arrow-top'}>
              <path
                d="M10 16H32M32 16L25 10M32 16L25 22"
                stroke="#5046F2"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
            {/* Bottom Arrow: Pointing Left */}
            <g className={isComplete ? undefined : 'converting-arrow-bottom'}>
              <path
                d="M34 28H12M12 28L19 22M12 28L19 34"
                stroke="#5046F2"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        </div>

        {/* RIGHT: Digital Document Icon */}
        <div
          className="flex items-center justify-center"
          aria-label="Digital text"
          title="Digital Text"
        >
          <svg
            width="52"
            height="60"
            viewBox="0 0 52 60"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-11 h-[52px] sm:w-[52px] sm:h-[60px]"
          >
            {/* Paper Outline */}
            <path
              d="M6 4C6 2.89543 6.89543 2 8 2H34L46 14V56C46 57.1046 45.1046 58 44 58H8C6.89543 58 6 57.1046 6 56V4Z"
              stroke="#111C35"
              strokeWidth="2.5"
              strokeLinejoin="round"
              fill="#FFFFFF"
            />
            {/* Paper Fold */}
            <path
              d="M34 2V14H46"
              stroke="#111C35"
              strokeWidth="2.5"
              strokeLinejoin="round"
              fill="#F8FAFC"
            />
            {/* Clean Digital Text Line 1 */}
            <line
              className={isComplete ? undefined : 'digital-line-1'}
              x1="14"
              y1="22"
              x2="38"
              y2="22"
              stroke="#5046F2"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Clean Digital Text Line 2 */}
            <line
              className={isComplete ? undefined : 'digital-line-2'}
              x1="14"
              y1="32"
              x2="34"
              y2="32"
              stroke="#111C35"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Clean Digital Text Line 3 */}
            <line
              className={isComplete ? undefined : 'digital-line-3'}
              x1="14"
              y1="42"
              x2="28"
              y2="42"
              stroke="#5046F2"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* BELOW THE ICONS: Percentage or simple animated converting indicator */}
      <div className="mt-4 sm:mt-5 flex items-center justify-center min-h-[32px]">
        {hasGenuineProgress && displayPercent !== null ? (
          <span
            id="ocr-display-percentage"
            className="text-xl sm:text-2xl font-bold font-mono text-[#111C35] tracking-tight"
          >
            {displayPercent}%
          </span>
        ) : (
          <div
            id="ocr-converting-indicator"
            className="flex items-center justify-center gap-1.5 h-6"
            aria-label="Converting order"
          >
            <span
              className="w-2 h-2 rounded-full bg-[#5046F2] animate-bounce"
              style={{ animationDuration: '1s', animationDelay: '0ms' }}
            />
            <span
              className="w-2 h-2 rounded-full bg-[#5046F2] animate-bounce"
              style={{ animationDuration: '1s', animationDelay: '180ms' }}
            />
            <span
              className="w-2 h-2 rounded-full bg-[#5046F2] animate-bounce"
              style={{ animationDuration: '1s', animationDelay: '360ms' }}
            />
          </div>
        )}
      </div>

      {/* Lightweight CSS animations for writing lines, converting arrow, and digital lines */}
      <style>{`
        /* 1. Left Handwritten Text Lines (appearing as if being written) */
        .handwritten-line-1 {
          stroke-dasharray: 40;
          stroke-dashoffset: 40;
          animation: writeHandwritten1 2.2s ease-in-out infinite;
        }
        .handwritten-line-2 {
          stroke-dasharray: 35;
          stroke-dashoffset: 35;
          animation: writeHandwritten2 2.2s ease-in-out infinite;
        }
        .handwritten-line-3 {
          stroke-dasharray: 30;
          stroke-dashoffset: 30;
          animation: writeHandwritten3 2.2s ease-in-out infinite;
        }

        @keyframes writeHandwritten1 {
          0% { stroke-dashoffset: 40; opacity: 0; }
          10% { opacity: 1; }
          35%, 85% { stroke-dashoffset: 0; opacity: 1; }
          95%, 100% { opacity: 0; stroke-dashoffset: 40; }
        }
        @keyframes writeHandwritten2 {
          0%, 15% { stroke-dashoffset: 35; opacity: 0; }
          25% { opacity: 1; }
          45%, 85% { stroke-dashoffset: 0; opacity: 1; }
          95%, 100% { opacity: 0; stroke-dashoffset: 35; }
        }
        @keyframes writeHandwritten3 {
          0%, 30% { stroke-dashoffset: 30; opacity: 0; }
          40% { opacity: 1; }
          55%, 85% { stroke-dashoffset: 0; opacity: 1; }
          95%, 100% { opacity: 0; stroke-dashoffset: 30; }
        }

        /* 2. Center Converting Arrow (smooth converting flow) */
        .converting-arrow-top {
          animation: convertTopArrow 1.4s ease-in-out infinite;
        }
        .converting-arrow-bottom {
          animation: convertBottomArrow 1.4s ease-in-out infinite;
        }

        @keyframes convertTopArrow {
          0%, 100% {
            transform: translateX(0);
            opacity: 0.7;
          }
          50% {
            transform: translateX(4px);
            opacity: 1;
          }
        }
        @keyframes convertBottomArrow {
          0%, 100% {
            transform: translateX(0);
            opacity: 0.7;
          }
          50% {
            transform: translateX(-4px);
            opacity: 1;
          }
        }

        /* 3. Right Digital Text Lines (appearing line by line) */
        .digital-line-1 {
          animation: revealDigital1 2.2s ease-in-out infinite;
        }
        .digital-line-2 {
          animation: revealDigital2 2.2s ease-in-out infinite;
        }
        .digital-line-3 {
          animation: revealDigital3 2.2s ease-in-out infinite;
        }

        @keyframes revealDigital1 {
          0%, 25% { opacity: 0; transform: scaleX(0); transform-origin: left; }
          35%, 85% { opacity: 1; transform: scaleX(1); transform-origin: left; }
          95%, 100% { opacity: 0; }
        }
        @keyframes revealDigital2 {
          0%, 45% { opacity: 0; transform: scaleX(0); transform-origin: left; }
          55%, 85% { opacity: 1; transform: scaleX(1); transform-origin: left; }
          95%, 100% { opacity: 0; }
        }
        @keyframes revealDigital3 {
          0%, 65% { opacity: 0; transform: scaleX(0); transform-origin: left; }
          75%, 85% { opacity: 1; transform: scaleX(1); transform-origin: left; }
          95%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default PaperToDigitalOcrAnimation;
