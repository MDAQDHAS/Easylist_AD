import { createHash, randomUUID } from 'node:crypto';
import { Router, type RequestHandler, type Response } from 'express';
import multer from 'multer';
import {
  requireAuth,
  requireConfirmedLinking,
  requireVerifiedEmail,
  type AuthenticatedUser,
} from '../middleware/requireAuth.js';
import {
  extractOrderItems,
  OcrProviderError,
  type ExtractedOrderItem,
  type OcrStage,
} from '../services/geminiOcrService.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
/** Gemini-billed extractions per user per minute (cache hits and joined duplicates are free). */
const MAX_REQUESTS_PER_MINUTE = 10;
/** Coarse upload/abuse guard applied before multipart parsing. */
const MAX_UPLOADS_PER_MINUTE = 60;
/** Status polling guard (polls are cheap, but still bounded per user). */
const MAX_POLLS_PER_MINUTE = 240;
/**
 * Completed extractions are kept briefly so a retry after a dropped connection,
 * a double submission, or a partial multi-image retry never pays for Gemini twice.
 */
const DEFAULT_DEDUPLICATE_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 100;
const JOB_TTL_MS = 10 * 60_000;
const MAX_JOBS = 500;
const PROVIDER_RETRY_AFTER_SECONDS = 10;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type OcrExtractor = (
  image: Buffer,
  mimeType: string,
  options?: { onStage?: (stage: OcrStage) => void }
) => Promise<ExtractedOrderItem[]>;

interface OcrRouterOptions {
  authenticate?: RequestHandler;
  extract?: OcrExtractor;
  deduplicateTtlMs?: number;
}

export type OcrJobStage = 'queued' | OcrStage | 'completed' | 'failed';

interface OcrJob {
  id: string;
  userId: string;
  contentHash: string;
  status: 'processing' | 'completed' | 'failed';
  stage: OcrJobStage;
  items?: ExtractedOrderItem[];
  errorStatus?: number;
  message?: string;
  retryable?: boolean;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

interface InFlightExtraction {
  promise: Promise<ExtractedOrderItem[]>;
  stage: OcrJobStage;
  listeners: Set<(stage: OcrJobStage) => void>;
}

function hasExpectedImageSignature(file: Express.Multer.File): boolean {
  const bytes = file.buffer;
  if (file.mimetype === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (file.mimetype === 'image/png') {
    return (
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    );
  }
  if (file.mimetype === 'image/webp') {
    return (
      bytes.length >= 12 &&
      bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP'
    );
  }
  return false;
}

function cloneExtractedItemsWithFreshIds(items: ExtractedOrderItem[]): ExtractedOrderItem[] {
  return items.map((item) => ({
    ...item,
    id: randomUUID(),
  }));
}

interface UserWindowLimiter {
  /** Express middleware that consumes one unit per request. */
  middleware: RequestHandler;
  /** Consume one unit for a user outside the middleware chain. */
  tryConsume: (userId: string) => { allowed: boolean; retryAfterSeconds: number };
}

function createUserWindowLimiter(maxPerMinute: number, message: string): UserWindowLimiter {
  const requestsByUser = new Map<string, { count: number; expiresAt: number }>();

  const tryConsume = (userId: string) => {
    const now = Date.now();
    for (const [key, window] of requestsByUser) {
      if (window.expiresAt <= now) requestsByUser.delete(key);
    }

    const current = requestsByUser.get(userId);
    if (current && current.expiresAt > now && current.count >= maxPerMinute) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((current.expiresAt - now) / 1000)),
      };
    }

    requestsByUser.set(userId, {
      count: current && current.expiresAt > now ? current.count + 1 : 1,
      expiresAt: current && current.expiresAt > now ? current.expiresAt : now + 60_000,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  };

  const middleware: RequestHandler = (_req, res, next) => {
    const user = res.locals.user as AuthenticatedUser | undefined;
    if (!user?.internalUserId) {
      res.status(401).json({ success: false, message: 'Authentication is required' });
      return;
    }
    const result = tryConsume(user.internalUserId);
    if (!result.allowed) {
      sendRateLimited(res, result.retryAfterSeconds, message);
      return;
    }
    next();
  };

  return { middleware, tryConsume };
}

function sendRateLimited(res: Response, retryAfterSeconds: number, message: string): void {
  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.status(429).json({ success: false, message, retryAfterSeconds });
}

function createUploadMiddleware(): RequestHandler {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: 1,
      fields: 0,
      parts: 1,
    },
    fileFilter: (_req, file, callback) => {
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        callback(new Error('Unsupported image type'));
        return;
      }
      callback(null, true);
    },
  });

  return (req, res, next) => {
    upload.single('image')(req, res, (error?: unknown) => {
      if (!error) {
        next();
        return;
      }

      if (error instanceof multer.MulterError) {
        const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        res.status(status).json({
          success: false,
          message:
            status === 413 ? 'Image exceeds the 10 MB limit' : 'Invalid image upload',
        });
        return;
      }

      if (error instanceof Error && error.message === 'Unsupported image type') {
        res.status(415).json({
          success: false,
          message: 'Only JPG, PNG, and WEBP images are supported',
        });
        return;
      }

      console.error('OCR image upload parsing failed');
      res.status(500).json({
        success: false,
        message: 'Unable to process image upload',
      });
    });
  };
}

/** Returns the validated file, or sends the error response and returns null. */
function validateUploadedImage(
  file: Express.Multer.File | undefined,
  res: Response
): Express.Multer.File | null {
  if (!file) {
    res.status(400).json({ success: false, message: 'An image is required' });
    return null;
  }
  if (file.size === 0 || file.buffer.length === 0) {
    res.status(400).json({ success: false, message: 'Uploaded image file is empty' });
    return null;
  }
  if (!hasExpectedImageSignature(file)) {
    res.status(415).json({
      success: false,
      message: 'The uploaded file is not a valid supported image',
    });
    return null;
  }
  return file;
}

function describeFailure(error: unknown): { status: number; message: string; retryable: boolean } {
  if (error instanceof OcrProviderError) {
    return {
      status: error.statusCode,
      message: error.message,
      // 422 = the image itself was rejected (blank/unrelated/unreadable): retrying won't help.
      retryable: error.statusCode !== 422,
    };
  }
  console.error(
    'Unexpected OCR extraction failure:',
    error instanceof Error ? error.name : 'unknown error'
  );
  return {
    status: 502,
    message: 'Image extraction failed. Please try again.',
    retryable: true,
  };
}

export function createOcrRouter(options: OcrRouterOptions = {}): Router {
  const router = Router();
  const authenticate = options.authenticate ?? requireAuth;
  const extract: OcrExtractor = options.extract ?? extractOrderItems;
  const deduplicateTtlMs = options.deduplicateTtlMs ?? DEFAULT_DEDUPLICATE_TTL_MS;

  const billedLimiter = createUserWindowLimiter(
    MAX_REQUESTS_PER_MINUTE,
    'Too many image extraction requests. Please wait and try again.'
  );
  const uploadLimiter = createUserWindowLimiter(
    MAX_UPLOADS_PER_MINUTE,
    'Too many image uploads. Please wait and try again.'
  );
  const pollLimiter = createUserWindowLimiter(
    MAX_POLLS_PER_MINUTE,
    'Too many status checks. Please wait and try again.'
  );

  const inFlightExtractions = new Map<string, InFlightExtraction>();
  const recentExtractions = new Map<string, { items: ExtractedOrderItem[]; expiresAt: number }>();
  const jobs = new Map<string, OcrJob>();

  const sweepExpired = () => {
    const now = Date.now();
    for (const [key, entry] of recentExtractions) {
      if (entry.expiresAt <= now) recentExtractions.delete(key);
    }
    for (const [key, job] of jobs) {
      if (job.expiresAt <= now) jobs.delete(key);
    }
  };

  const getCachedItems = (contentHash: string): ExtractedOrderItem[] | null => {
    if (deduplicateTtlMs <= 0) return null;
    const cached = recentExtractions.get(contentHash);
    return cached && cached.expiresAt > Date.now() ? cached.items : null;
  };

  const rememberItems = (contentHash: string, items: ExtractedOrderItem[]) => {
    if (deduplicateTtlMs <= 0 || items.length === 0) return;
    if (recentExtractions.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = recentExtractions.keys().next().value;
      if (oldestKey) recentExtractions.delete(oldestKey);
    }
    recentExtractions.set(contentHash, { items, expiresAt: Date.now() + deduplicateTtlMs });
  };

  /**
   * Starts (or joins) the single extraction for this user+image. Concurrent duplicate
   * submissions share one Gemini call.
   */
  const startOrJoinExtraction = (
    contentHash: string,
    file: Express.Multer.File,
    onStage?: (stage: OcrJobStage) => void
  ): Promise<ExtractedOrderItem[]> => {
    const existing = inFlightExtractions.get(contentHash);
    if (existing) {
      if (onStage) {
        existing.listeners.add(onStage);
        onStage(existing.stage);
      }
      return existing.promise;
    }

    const entry: InFlightExtraction = {
      promise: Promise.resolve([]),
      stage: 'queued',
      listeners: new Set(onStage ? [onStage] : []),
    };
    const broadcast = (stage: OcrJobStage) => {
      entry.stage = stage;
      for (const listener of entry.listeners) listener(stage);
    };

    entry.promise = extract(file.buffer, file.mimetype, { onStage: broadcast })
      .then((items) => {
        rememberItems(contentHash, items);
        return items;
      })
      .finally(() => {
        inFlightExtractions.delete(contentHash);
      });
    inFlightExtractions.set(contentHash, entry);
    return entry.promise;
  };

  const computeContentHash = (user: AuthenticatedUser, file: Express.Multer.File) =>
    createHash('sha256')
      .update(user.internalUserId)
      .update(':')
      .update(file.mimetype)
      .update(':')
      .update(file.buffer)
      .digest('hex');

  const protectedChain: RequestHandler[] = [
    authenticate,
    requireVerifiedEmail,
    requireConfirmedLinking,
  ];

  /**
   * POST /api/ocr/extract — synchronous extraction (kept for compatibility).
   */
  router.post(
    '/extract',
    ...protectedChain,
    uploadLimiter.middleware,
    createUploadMiddleware(),
    async (req, res) => {
      const file = validateUploadedImage(req.file, res);
      if (!file) return;

      const user = res.locals.user as AuthenticatedUser;
      const contentHash = computeContentHash(user, file);
      sweepExpired();

      const cached = getCachedItems(contentHash);
      if (cached) {
        res.status(200).json({ success: true, items: cloneExtractedItemsWithFreshIds(cached) });
        return;
      }

      if (!inFlightExtractions.has(contentHash)) {
        const limit = billedLimiter.tryConsume(user.internalUserId);
        if (!limit.allowed) {
          sendRateLimited(
            res,
            limit.retryAfterSeconds,
            'Too many image extraction requests. Please wait and try again.'
          );
          return;
        }
      }

      try {
        const items = await startOrJoinExtraction(contentHash, file);
        res.status(200).json({ success: true, items });
      } catch (error) {
        const failure = describeFailure(error);
        if (failure.status === 503 || failure.status === 504) {
          res.setHeader('Retry-After', String(PROVIDER_RETRY_AFTER_SECONDS));
        }
        res.status(failure.status).json({
          success: false,
          message: failure.message,
          retryable: failure.retryable,
          ...(failure.retryable ? { retryAfterSeconds: PROVIDER_RETRY_AFTER_SECONDS } : {}),
        });
      }
    }
  );

  /**
   * POST /api/ocr/jobs — validates the upload and starts extraction in the background.
   * Returns immediately with a jobId so long Gemini retries can never hit HTTP timeouts.
   */
  router.post(
    '/jobs',
    ...protectedChain,
    uploadLimiter.middleware,
    createUploadMiddleware(),
    async (req, res) => {
      const file = validateUploadedImage(req.file, res);
      if (!file) return;

      const user = res.locals.user as AuthenticatedUser;
      const contentHash = computeContentHash(user, file);
      sweepExpired();

      // Re-use an existing processing/completed job for the same user+image
      // (double submission, or retry after a dropped connection).
      for (const job of jobs.values()) {
        if (
          job.userId === user.internalUserId &&
          job.contentHash === contentHash &&
          job.status !== 'failed'
        ) {
          res.status(job.status === 'completed' ? 200 : 202).json(serializeJob(job));
          return;
        }
      }

      const now = Date.now();
      const job: OcrJob = {
        id: randomUUID(),
        userId: user.internalUserId,
        contentHash,
        status: 'processing',
        stage: 'queued',
        createdAt: now,
        updatedAt: now,
        expiresAt: now + JOB_TTL_MS,
      };

      const cached = getCachedItems(contentHash);
      if (cached) {
        job.status = 'completed';
        job.stage = 'completed';
        job.items = cloneExtractedItemsWithFreshIds(cached);
        storeJob(job);
        res.status(200).json(serializeJob(job));
        return;
      }

      if (!inFlightExtractions.has(contentHash)) {
        const limit = billedLimiter.tryConsume(user.internalUserId);
        if (!limit.allowed) {
          sendRateLimited(
            res,
            limit.retryAfterSeconds,
            'Too many image extraction requests. Please wait and try again.'
          );
          return;
        }
      }

      storeJob(job);
      const updateStage = (stage: OcrJobStage) => {
        if (job.status !== 'processing') return;
        job.stage = stage;
        job.updatedAt = Date.now();
      };

      const extractionPromise = startOrJoinExtraction(contentHash, file, updateStage)
        .then((items) => {
          job.status = 'completed';
          job.stage = 'completed';
          job.items = cloneExtractedItemsWithFreshIds(items);
          job.updatedAt = Date.now();
          job.expiresAt = job.updatedAt + JOB_TTL_MS;
        })
        .catch((error: unknown) => {
          const failure = describeFailure(error);
          job.status = 'failed';
          job.stage = 'failed';
          job.errorStatus = failure.status;
          job.message = failure.message;
          job.retryable = failure.retryable;
          job.updatedAt = Date.now();
          job.expiresAt = job.updatedAt + JOB_TTL_MS;
        });

      // On serverless environments (e.g. Vercel Functions), complete the extraction
      // within the request lifecycle so in-memory jobs are never lost across instances.
      if (process.env.VERCEL === '1') {
        await extractionPromise;
        if (job.status === 'failed') {
          res.status(job.errorStatus ?? 503).json(serializeJob(job));
          return;
        }
        res.status(200).json(serializeJob(job));
        return;
      }

      res.status(202).json(serializeJob(job));
    }
  );

  /**
   * GET /api/ocr/jobs/:jobId — live status for the caller's own job only.
   */
  router.get(
    '/jobs/:jobId',
    ...protectedChain,
    pollLimiter.middleware,
    (req, res) => {
      const user = res.locals.user as AuthenticatedUser;
      sweepExpired();
      const job = jobs.get(String(req.params.jobId));
      // Unknown and foreign jobs are indistinguishable to the caller.
      if (!job || job.userId !== user.internalUserId) {
        res.status(404).json({ success: false, message: 'Extraction job not found' });
        return;
      }
      res.status(200).json(serializeJob(job));
    }
  );

  function storeJob(job: OcrJob) {
    if (jobs.size >= MAX_JOBS) {
      const oldestKey = jobs.keys().next().value;
      if (oldestKey) jobs.delete(oldestKey);
    }
    jobs.set(job.id, job);
  }

  function serializeJob(job: OcrJob) {
    return {
      success: true,
      jobId: job.id,
      status: job.status,
      stage: job.stage,
      ...(job.status === 'completed' ? { items: job.items ?? [] } : {}),
      ...(job.status === 'failed'
        ? {
            errorStatus: job.errorStatus,
            message: job.message,
            retryable: job.retryable ?? true,
            ...(job.retryable ? { retryAfterSeconds: PROVIDER_RETRY_AFTER_SECONDS } : {}),
          }
        : {}),
    };
  }

  return router;
}

export default createOcrRouter();
