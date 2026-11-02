import { apiClient } from './api/client';
import { ApiError } from './api/error';
import { OrderItem, Unit } from '../types/order';
import { generateId } from '../lib/utils';
import { preprocessImageForOcr } from './imagePreprocessing';

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_IMAGES_PER_ORDER = 10;
export const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const TEXT_ORDER_UNITS = new Set<Unit>([
  'kg',
  'g',
  'ltr',
  'ml',
  'pkt',
  'pcs',
  'box',
  'bottle',
  'bundle',
  'bag',
  'tin',
  'dozen',
]);

export interface ScanProgressUpdate {
  stageNumber: number;
  stageName: string;
  detail: string;
  percent: number;
  currentImage?: number;
  totalImages?: number;
}

interface ExtractionResponse {
  success: boolean;
  items?: OrderItem[];
  jobId?: string;
  status?: 'processing' | 'completed' | 'failed';
  stage?: string;
  message?: string;
  retryable?: boolean;
  retryAfterSeconds?: number;
}

const STAGE_PROGRESS_WEIGHT: Record<string, { stageNumber: number; stageName: string; detail: string; weight: number }> = {
  queued: {
    stageNumber: 1,
    stageName: 'Uploading image',
    detail: 'Uploading image for analysis...',
    weight: 0.15,
  },
  reading_handwriting: {
    stageNumber: 2,
    stageName: 'Reading handwriting',
    detail: 'Reading Tamil and English handwriting with Gemini AI...',
    weight: 0.40,
  },
  switching_to_backup: {
    stageNumber: 2,
    stageName: 'Reading handwriting',
    detail: 'Primary model busy. Switching to backup AI model...',
    weight: 0.55,
  },
  retrying: {
    stageNumber: 2,
    stageName: 'Reading handwriting',
    detail: 'Retrying with AI reading service...',
    weight: 0.65,
  },
  extracting_products: {
    stageNumber: 3,
    stageName: 'Extracting products',
    detail: 'Extracting product names, units, and quantities...',
    weight: 0.85,
  },
  validating_results: {
    stageNumber: 4,
    stageName: 'Validating results',
    detail: 'Validating product list and price calculations...',
    weight: 0.95,
  },
  completed: {
    stageNumber: 4,
    stageName: 'Completed',
    detail: 'Order items extracted successfully.',
    weight: 1.0,
  },
};

/**
 * Session cache of extracted items per file to prevent redundant re-extractions
 * when retrying after a single image failure in a multi-image order.
 */
const imageResultCache = new Map<string, OrderItem[]>();

function getFileCacheKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function reportProgress(
  onProgress: ((update: ScanProgressUpdate) => void) | undefined,
  stageNumber: number,
  stageName: string,
  detail: string,
  percent: number,
  currentImage?: number,
  totalImages?: number
): void {
  onProgress?.({
    stageNumber,
    stageName,
    detail,
    percent: Math.min(100, Math.max(0, percent)),
    currentImage,
    totalImages,
  });
}

function reportStageProgress(
  onProgress: ((update: ScanProgressUpdate) => void) | undefined,
  stage: string,
  imageNumber: number,
  totalImages: number
): void {
  const meta = STAGE_PROGRESS_WEIGHT[stage] ?? {
    stageNumber: 2,
    stageName: 'Reading handwriting',
    detail: 'Analyzing order chit with AI...',
    weight: 0.5,
  };

  const imageBasePercent = ((imageNumber - 1) / totalImages) * 100;
  const imageSlice = 100 / totalImages;
  const currentPercent = Math.round(imageBasePercent + imageSlice * meta.weight);

  const detail = totalImages > 1
    ? `Image ${imageNumber} of ${totalImages}: ${meta.detail}`
    : meta.detail;

  reportProgress(
    onProgress,
    meta.stageNumber,
    meta.stageName,
    detail,
    currentPercent,
    imageNumber,
    totalImages
  );
}

export function hasValidImageHeaderBytes(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    const pngSig = [137, 80, 78, 71, 13, 10, 26, 10];
    return bytes.length >= 8 && pngSig.every((b, idx) => bytes[idx] === b);
  }
  if (mimeType === 'image/webp') {
    const riff = [0x52, 0x49, 0x46, 0x46]; // 'RIFF'
    const webp = [0x57, 0x45, 0x42, 0x50]; // 'WEBP'
    return (
      bytes.length >= 12 &&
      riff.every((b, idx) => bytes[idx] === b) &&
      webp.every((b, idx) => bytes[8 + idx] === b)
    );
  }
  return false;
}

export async function validateUploadFile(file: File): Promise<void> {
  if (!file || typeof file !== 'object') {
    throw new Error('Invalid image file selected.');
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(`"${file.name}" is not a supported image. Use JPG, PNG, or WEBP.`);
  }
  if (file.size === 0) {
    throw new Error(`"${file.name}" is empty (0 bytes). Please upload a valid image.`);
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`"${file.name}" exceeds the 10 MB size limit.`);
  }

  if (typeof file.slice === 'function') {
    const headerBuffer = await file.slice(0, 12).arrayBuffer();
    const headerBytes = new Uint8Array(headerBuffer);
    if (!hasValidImageHeaderBytes(headerBytes, file.type)) {
      throw new Error(
        `"${file.name}" is corrupted or is not a valid ${file.type.replace('image/', '').toUpperCase()} image.`
      );
    }
  }
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Worker pool to process items with controlled parallelism.
 */
async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await fn(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Polls an async OCR job until completion or failure.
 * Tolerates temporary network drops during polling so a brief mobile disconnect
 * never loses the server-side extraction results.
 */
async function pollOcrJob(
  jobId: string,
  imageNumber: number,
  totalImages: number,
  onProgress?: (update: ScanProgressUpdate) => void
): Promise<OrderItem[]> {
  const MAX_POLLS = 180; // up to 3 minutes budget per image
  let consecutiveNetworkErrors = 0;

  for (let poll = 0; poll < MAX_POLLS; poll += 1) {
    if (poll > 0) {
      // Responsive poll cadence: 300ms, 500ms, 800ms, then 1000ms
      const intervalMs =
        poll === 1 ? 300 : poll === 2 ? 500 : poll === 3 ? 800 : 1000;
      await sleep(intervalMs);
    }

    try {
      const response = await apiClient.get<ExtractionResponse>(`/ocr/jobs/${encodeURIComponent(jobId)}`, {
        timeoutMs: 15_000,
      });
      consecutiveNetworkErrors = 0;

      if (response.stage) {
        reportStageProgress(onProgress, response.stage, imageNumber, totalImages);
      }

      if (response.status === 'completed') {
        reportStageProgress(onProgress, 'completed', imageNumber, totalImages);
        return Array.isArray(response.items) ? response.items : [];
      }

      if (response.status === 'failed') {
        const errorMsg = response.message || 'Image extraction failed. Please try again.';
        throw new Error(errorMsg);
      }
    } catch (err: unknown) {
      // Re-throw if it was an explicit HTTP error from the server (e.g. 401, 403, 404, 429)
      if (err instanceof ApiError && err.status > 0) {
        throw err;
      }

      // Re-throw if it was a non-network logical error
      if (
        err instanceof Error &&
        !err.message.includes('fetch') &&
        !err.message.includes('timeout') &&
        !err.message.includes('network') &&
        !err.message.includes('connect')
      ) {
        throw err;
      }

      consecutiveNetworkErrors += 1;
      // Allow up to 8 consecutive network blips (~8-10 seconds of disconnect) during polling before giving up
      if (consecutiveNetworkErrors >= 8) {
        throw err instanceof Error ? err : new Error('Connection lost while waiting for OCR results. Please try again.');
      }
    }
  }

  throw new Error('OCR extraction took too long to complete. Please try again.');
}

async function extractOneImage(
  file: File,
  imageNumber: number,
  totalImages: number,
  onProgress?: (update: ScanProgressUpdate) => void
): Promise<OrderItem[]> {
  await validateUploadFile(file);

  const cacheKey = getFileCacheKey(file);
  const cachedItems = imageResultCache.get(cacheKey);
  if (cachedItems && cachedItems.length > 0) {
    reportStageProgress(onProgress, 'completed', imageNumber, totalImages);
    return cachedItems;
  }

  reportStageProgress(onProgress, 'queued', imageNumber, totalImages);

  const uploadFile = await preprocessImageForOcr(file);

  const formData = new FormData();
  formData.append('image', uploadFile, uploadFile.name);

  // 1. Attempt async job creation first (immune to HTTP/proxy timeouts)
  try {
    const jobRes = await apiClient.post<ExtractionResponse>('/ocr/jobs', formData, {
      timeoutMs: 60_000,
    });

    if (jobRes?.status === 'completed' && Array.isArray(jobRes.items)) {
      reportStageProgress(onProgress, 'completed', imageNumber, totalImages);
      imageResultCache.set(cacheKey, jobRes.items);
      return jobRes.items;
    }

    if (jobRes?.jobId) {
      const items = await pollOcrJob(jobRes.jobId, imageNumber, totalImages, onProgress);
      imageResultCache.set(cacheKey, items);
      return items;
    }
  } catch (err: unknown) {
    // ONLY fall back to synchronous /ocr/extract if the /ocr/jobs endpoint returned 404
    // (legacy server compatibility). All real errors (auth, validation, 429, network offline) must be thrown immediately!
    if (err instanceof ApiError && err.status === 404) {
      // Proceed to synchronous fallback below
    } else {
      throw err;
    }
  }

  // 2. Synchronous fallback for legacy / compatibility callers
  reportStageProgress(onProgress, 'reading_handwriting', imageNumber, totalImages);
  const response = await apiClient.post<ExtractionResponse>(
    '/ocr/extract',
    formData,
    { timeoutMs: 150_000 }
  );

  if (!response.success || !Array.isArray(response.items)) {
    throw new Error('The OCR service returned an invalid response. Please try again.');
  }

  reportStageProgress(onProgress, 'completed', imageNumber, totalImages);
  imageResultCache.set(cacheKey, response.items);
  return response.items;
}

export const ocrService = {
  async extractImages(
    files: File[],
    onProgress?: (update: ScanProgressUpdate) => void
  ): Promise<OrderItem[]> {
    if (!Array.isArray(files) || files.length === 0 || files.length > MAX_IMAGES_PER_ORDER) {
      throw new Error(`Choose between 1 and ${MAX_IMAGES_PER_ORDER} order images.`);
    }

    // Validate all uploaded files upfront before making any network calls
    for (const file of files) {
      await validateUploadFile(file);
    }

    // Fast-path for single image
    if (files.length === 1) {
      const items = await extractOneImage(files[0], 1, 1, onProgress);
      reportProgress(onProgress, 4, 'Extraction complete', 'All items ready for review', 100);
      return items;
    }

    // Multi-image: controlled concurrency = 2 (respects 10 req/min rate limit while ~40% faster)
    const CONCURRENCY = 2;
    const imageProgressPercents = new Array<number>(files.length).fill(0);

    const updateAggregatedProgress = (
      imgIndex: number,
      stageNumber: number,
      stageName: string,
      detail: string,
      percent: number
    ) => {
      imageProgressPercents[imgIndex] = percent;
      const totalPercent = Math.round(
        imageProgressPercents.reduce((sum, p) => sum + p, 0) / files.length
      );
      reportProgress(
        onProgress,
        stageNumber,
        stageName,
        detail,
        totalPercent,
        imgIndex + 1,
        files.length
      );
    };

    const results = await mapConcurrent(files, CONCURRENCY, async (file, index) => {
      return extractOneImage(
        file,
        index + 1,
        files.length,
        (update) => {
          updateAggregatedProgress(
            index,
            update.stageNumber,
            update.stageName,
            update.detail,
            update.percent
          );
        }
      );
    });

    const extractedItems = results.flat();
    reportProgress(onProgress, 4, 'Extraction complete', 'All items ready for review', 100);
    return extractedItems;
  },

  clearImageCache(): void {
    imageResultCache.clear();
  },

  async scanHandwrittenChit(
    imageSrc: string,
    onProgress?: (update: ScanProgressUpdate) => void
  ): Promise<OrderItem[]> {
    const response = await fetch(imageSrc);
    if (!response.ok) {
      throw new Error('Unable to read the selected order image.');
    }

    const image = await response.blob();
    const file = new File([image], 'order-image', { type: image.type });
    return this.extractImages([file], onProgress);
  },

  parseTextOrder(rawText: string): OrderItem[] {
    const lines = rawText.split('\n').filter((line) => line.trim().length > 0);
    const parsed: OrderItem[] = [];

    for (const line of lines) {
      const cleanLine = line.replace(/^\d+[.)-]\s*/, '').trim();
      const match = cleanLine.match(
        /^(.*?)\s+(\d+(?:\.\d+)?)\s*(kg|g|ltr|ml|pkt|pcs|box|bottle|bundle|bag|tin|dozen)?\s*(?:(?:@|rs|inr|₹)?\s*(\d+(?:\.\d+)?))?$/i
      );

      if (match) {
        const name = match[1].trim();
        const quantity = Number.parseFloat(match[2]) || 1;
        const rawUnit = match[3]?.toLowerCase();
        const unit: Unit =
          rawUnit && TEXT_ORDER_UNITS.has(rawUnit as Unit)
            ? (rawUnit as Unit)
            : 'pcs';
        const unitPrice = Number.parseFloat(match[4]) || 50;
        parsed.push({
          id: generateId('item'),
          name,
          quantity,
          unit,
          unitPrice,
          total: Math.round(quantity * unitPrice * 100) / 100,
          confidence: 0.95,
        });
      } else {
        parsed.push({
          id: generateId('item'),
          name: cleanLine,
          quantity: 1,
          unit: 'pcs',
          unitPrice: 50,
          total: 50,
          confidence: 0.85,
        });
      }
    }

    return parsed;
  },
};
