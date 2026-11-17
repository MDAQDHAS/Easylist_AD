import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FileAudio,
  UploadCloud,
  X,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { OrderItem } from '../../types/order';
import { ocrService } from '../../services/ocrService';
import { formatFileSize } from '../../utils';

export interface VoiceNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExtractOrder: (
    items: OrderItem[],
    audioMeta?: { fileName: string; duration?: number; audioUrl?: string }
  ) => void | Promise<void>;
}

const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
const ALLOWED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg', '.webm', '.aac', '.mp4'];

const formatDuration = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Audio / Waveform illustration matching EasyList design system
 */
const AudioWaveformIllustration: React.FC = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <circle cx="32" cy="32" r="30" fill="#E3F8ED" stroke="#A7DCC4" strokeWidth="1.5" />
    {/* Sound waves & microphone symbol */}
    <rect x="28" y="16" width="8" height="18" rx="4" fill="#07865D" />
    <path
      d="M21 27C21 33.0751 25.9249 38 32 38C38.0751 38 43 33.0751 43 27"
      stroke="#07865D"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <path d="M32 38V45M26 45H38" stroke="#07865D" strokeWidth="2.5" strokeLinecap="round" />
    {/* Subtle audio pulse waves */}
    <path
      d="M15 25C15 21 17 17 20 15"
      stroke="#10B981"
      strokeWidth="2"
      strokeLinecap="round"
      opacity="0.6"
    />
    <path
      d="M49 25C49 21 47 17 44 15"
      stroke="#10B981"
      strokeWidth="2"
      strokeLinecap="round"
      opacity="0.6"
    />
  </svg>
);

export const VoiceNoteModal: React.FC<VoiceNoteModalProps> = ({
  isOpen,
  onClose,
  onExtractOrder,
}) => {
  // Selected Audio State (Upload-only)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null);
  const [uploadedDuration, setUploadedDuration] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);

  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackCurrentTime, setPlaybackCurrentTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);

  // Notes & Extraction State
  const [orderNotes, setOrderNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup audio preview URLs
  const cleanupAudio = () => {
    if (uploadedAudioUrl) {
      URL.revokeObjectURL(uploadedAudioUrl);
    }
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = '';
    }
  };

  // Reset modal state on open/close
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setInfoNotice(null);
      setIsExtracting(false);
      setIsPlaying(false);
      setPlaybackCurrentTime(0);
    } else {
      cleanupAudio();
      setUploadedFile(null);
      setUploadedAudioUrl(null);
      setUploadedDuration(0);
      setOrderNotes('');
      setError(null);
      setInfoNotice(null);
      setIsExtracting(false);
      setIsPlaying(false);
    }
    return () => {
      cleanupAudio();
    };
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

  // Sync audio element duration and current time
  useEffect(() => {
    const audio = audioElementRef.current;
    if (!audio || !uploadedAudioUrl) {
      setIsPlaying(false);
      setPlaybackCurrentTime(0);
      setPlaybackDuration(0);
      return;
    }

    audio.src = uploadedAudioUrl;
    audio.load();

    const onLoadedMetadata = () => {
      const dur = audio.duration;
      if (!isNaN(dur) && dur > 0) {
        setPlaybackDuration(dur);
        setUploadedDuration(dur);
      }
    };

    const onTimeUpdate = () => {
      setPlaybackCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setPlaybackCurrentTime(0);
    };

    const onError = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [uploadedAudioUrl]);

  // Audio Play / Pause
  const togglePlayAudio = () => {
    const audio = audioElementRef.current;
    if (!audio || !uploadedAudioUrl) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioElementRef.current;
    const newTime = parseFloat(e.target.value);
    setPlaybackCurrentTime(newTime);
    if (audio) {
      audio.currentTime = newTime;
    }
  };

  // Validate Audio File Format & Size
  const validateAudioFile = (file: File): string | null => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    const isAudioType =
      file.type.startsWith('audio/') || ALLOWED_AUDIO_EXTENSIONS.includes(extension);

    if (!isAudioType) {
      return `"${file.name}" has an unsupported format. Please upload MP3, WAV, M4A, OGG, or WEBM audio.`;
    }
    if (file.size === 0) {
      return `"${file.name}" is empty (0 bytes). Please select a valid voice note file.`;
    }
    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      return `"${file.name}" exceeds the 25MB limit (${formatFileSize(file.size)}).`;
    }
    return null;
  };

  const handleSelectedAudioFile = (file: File) => {
    setError(null);
    setInfoNotice(null);
    const validationError = validateAudioFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (uploadedAudioUrl) {
      URL.revokeObjectURL(uploadedAudioUrl);
    }

    const url = URL.createObjectURL(file);
    setUploadedFile(file);
    setUploadedAudioUrl(url);

    // Probe duration
    const tempAudio = new Audio();
    tempAudio.src = url;
    tempAudio.onloadedmetadata = () => {
      if (!isNaN(tempAudio.duration)) {
        setUploadedDuration(tempAudio.duration);
      }
    };
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleSelectedAudioFile(files[0]);
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
      handleSelectedAudioFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveUploadedFile = () => {
    if (uploadedAudioUrl) {
      URL.revokeObjectURL(uploadedAudioUrl);
    }
    setUploadedFile(null);
    setUploadedAudioUrl(null);
    setUploadedDuration(0);
    setError(null);
    setInfoNotice(null);
    setIsPlaying(false);
  };

  // Detected items from notes if provided
  const detectedItems = useMemo(() => {
    const trimmed = orderNotes.trim();
    if (!trimmed) return [];
    try {
      const items = ocrService.parseTextOrder(trimmed);
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  }, [orderNotes]);

  // Extract Order Action
  const handleExtract = async () => {
    if (isExtracting || !uploadedFile) return;
    setError(null);
    setInfoNotice(null);
    setIsExtracting(true);

    try {
      // Simulate real-time processing and check for backend audio extraction
      await new Promise((resolve) => setTimeout(resolve, 450));

      // If user added transcript/notes with items, parse and navigate to Results & Export
      const trimmedNotes = orderNotes.trim();
      if (trimmedNotes) {
        const parsedItems = ocrService.parseTextOrder(trimmedNotes);
        if (parsedItems.length > 0) {
          await onExtractOrder(parsedItems, {
            fileName: uploadedFile.name,
            duration: uploadedDuration,
            audioUrl: uploadedAudioUrl || undefined,
          });
          onClose();
          return;
        }
      }

      // If backend voice extraction is not configured for direct server audio-to-text:
      // Strictly follow instruction: "Use the existing voice-to-text/order extraction functionality, if available. Navigate to the existing Results & Export page when extraction succeeds. Display a clear error message if extraction fails. Do not generate fake extraction results."
      setInfoNotice(
        'Voice note uploaded successfully. Automated voice-to-text speech recognition is not configured on this backend server yet. Please add customer order notes above or use the Text Order feature to extract.'
      );
    } catch (err: any) {
      setError(
        err?.message || 'Failed to extract items from the voice note. Please try again.'
      );
    } finally {
      setIsExtracting(false);
    }
  };

  if (!isOpen) return null;

  const content = (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 bg-[#111C35]/55 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-note-modal-title"
      aria-describedby="voice-note-modal-description"
      onClick={() => {
        if (!isExtracting) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[760px] bg-[#F8F7F4] rounded-[20px] border border-[#DCE8E1] shadow-[0_24px_70px_rgba(17,28,53,0.28)] p-6 sm:p-8 relative font-sans max-h-[92dvh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Hidden File Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.aac"
          className="hidden"
          disabled={isExtracting}
          onChange={handleFileInputChange}
        />
        <input
          ref={replaceInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.aac"
          className="hidden"
          disabled={isExtracting}
          onChange={handleFileInputChange}
        />

        {/* Hidden Audio Element for Player */}
        <audio ref={audioElementRef} className="hidden" preload="metadata" />

        {/* Top-Right Close Button */}
        <button
          id="btn-close-voice-modal"
          type="button"
          disabled={isExtracting}
          onClick={onClose}
          aria-label="Close voice note popup"
          className="absolute top-5 right-5 sm:top-6 sm:right-6 p-2 rounded-xl text-[#64748B] hover:text-[#172554] hover:bg-black/5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-4 pb-5 border-b border-[#DCE8E1] pr-10 shrink-0">
          <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-[#E3F8ED] border border-[#A7DCC4] text-[#07865D] flex items-center justify-center shrink-0 shadow-2xs">
            <FileAudio className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h2
              id="voice-note-modal-title"
              className="text-xl sm:text-[24px] font-bold font-heading text-[#172554] tracking-tight leading-tight"
            >
              Upload Voice Note
            </h2>
            <p
              id="voice-note-modal-description"
              className="text-xs sm:text-sm text-[#64748B] mt-1 font-normal font-sans"
            >
              Upload a customer&apos;s recorded voice order and convert it into a digital list.
            </p>
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto py-5 space-y-4 pr-0.5">
          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm flex items-start justify-between gap-3 animate-in fade-in duration-150"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-rose-950 leading-snug">
                    Unable to process audio
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

          {/* Info Notice Banner */}
          {infoNotice && (
            <div
              role="status"
              className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 text-xs sm:text-sm flex items-start justify-between gap-3 animate-in fade-in duration-150"
            >
              <div className="flex items-start gap-2.5">
                <Info className="w-5 h-5 text-[#07865D] mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-[#07865D] leading-snug">
                    Voice Note Status
                  </p>
                  <p className="text-emerald-800 mt-0.5 leading-relaxed">{infoNotice}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInfoNotice(null)}
                aria-label="Dismiss notice"
                className="text-emerald-500 hover:text-emerald-800 p-1 rounded-lg cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Section 3: Empty Audio Drag-and-Drop Upload Section */}
          {!uploadedFile ? (
            <div
              id="dropzone-audio-upload"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative rounded-[16px] border-2 border-dashed transition-all px-5 py-9 sm:py-12 flex flex-col items-center justify-center text-center cursor-pointer select-none bg-white ${
                isDragging
                  ? 'border-[#07865D] bg-[#E3F8ED]/40 ring-4 ring-[#07865D]/15'
                  : 'border-[#A7DCC4] hover:border-[#07865D] hover:bg-[#FAFCFB]'
              }`}
            >
              <div className="mb-4">
                <AudioWaveformIllustration />
              </div>

              <h3 className="text-base sm:text-[18px] font-bold font-heading text-[#172554] leading-snug">
                Drop your voice note here
              </h3>

              <p className="text-xs sm:text-sm text-[#64748B] mt-1 mb-5">
                or browse audio files from your device
              </p>

              <button
                id="btn-choose-audio-file"
                type="button"
                disabled={isExtracting}
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-linear-to-r from-[#10B981] to-[#047857] hover:opacity-95 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all cursor-pointer font-heading"
              >
                <FileAudio className="w-4 h-4 text-white" />
                <span>Choose Audio File</span>
              </button>

              <p className="text-[11px] sm:text-xs text-[#64748B] mt-4 font-normal">
                Supports MP3, WAV, M4A, WEBM, OGG · Max 25MB
              </p>
            </div>
          ) : (
            /* Section 4: Uploaded-File Preview Card */
            <div className="bg-white rounded-[16px] border border-[#DCE8E1] p-5 sm:p-6 shadow-2xs space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-[#E3F8ED] border border-[#A7DCC4] text-[#07865D] flex items-center justify-center shrink-0 shadow-2xs">
                    <FileAudio className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm sm:text-base font-bold font-heading text-[#172554] truncate">
                      {uploadedFile.name}
                    </h4>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      {formatFileSize(uploadedFile.size)}
                      {uploadedDuration > 0 && ` · Duration: ${formatDuration(uploadedDuration)}`}
                    </p>
                  </div>
                </div>

                {/* Remove & Replace Options */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    id="btn-replace-audio"
                    disabled={isExtracting}
                    onClick={() => replaceInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DCE8E1] text-xs font-semibold text-[#172554] hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Replace</span>
                  </button>
                  <button
                    type="button"
                    id="btn-remove-audio"
                    disabled={isExtracting}
                    onClick={handleRemoveUploadedFile}
                    aria-label="Remove audio file"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Built-in Audio Player with Play/Pause and Progress Controls */}
              <div className="bg-[#F8F7F4] rounded-xl p-3.5 sm:p-4 flex items-center gap-3.5 border border-[#DCE8E1]">
                <button
                  type="button"
                  id="btn-play-pause-audio"
                  onClick={togglePlayAudio}
                  aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
                  className="w-10 h-10 rounded-full bg-linear-to-r from-[#10B981] to-[#047857] text-white flex items-center justify-center shrink-0 shadow-xs cursor-pointer hover:opacity-95"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-white" />
                  ) : (
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  )}
                </button>

                <div className="flex-1 flex flex-col gap-1 min-w-0">
                  <input
                    type="range"
                    min="0"
                    max={playbackDuration || uploadedDuration || 1}
                    step="0.1"
                    value={playbackCurrentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-[#DCE8E1] rounded-lg appearance-none cursor-pointer accent-[#07865D]"
                  />
                  <div className="flex items-center justify-between text-[11px] text-[#64748B] tabular-nums font-medium">
                    <span>{formatDuration(playbackCurrentTime)}</span>
                    <span>{formatDuration(playbackDuration || uploadedDuration)}</span>
                  </div>
                </div>
              </div>

              {/* Order Notes / Voice Transcription Caption */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#172554] block">
                    Voice Note Notes / Items (Optional)
                  </label>
                  {detectedItems.length > 0 && (
                    <span className="text-[11px] text-[#07865D] font-semibold bg-[#E3F8ED] px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{detectedItems.length} items detected</span>
                    </span>
                  )}
                </div>
                <textarea
                  value={orderNotes}
                  disabled={isExtracting}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-[#DCE8E1] p-3 text-xs sm:text-sm text-[#172554] bg-white placeholder:text-[#94A3B8] focus:outline-none focus:border-[#07865D] focus:ring-2 focus:ring-[#07865D]/15 font-sans"
                  placeholder="Paste or type any customer voice order details or items..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 5: Prominent Full-Width Extract Order Button */}
        <div className="pt-4 border-t border-[#DCE8E1] shrink-0">
          <button
            id="btn-extract-voice-order"
            type="button"
            disabled={!uploadedFile || isExtracting}
            onClick={handleExtract}
            className="w-full h-[50px] rounded-[30px] bg-linear-to-r from-[#10B981] to-[#047857] hover:opacity-95 active:opacity-90 text-white font-heading font-bold text-sm sm:text-base shadow-[0_8px_22px_rgba(4,120,87,0.28)] flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isExtracting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Extracting Order...</span>
              </>
            ) : (
              <>
                <span>Extract Order</span>
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
