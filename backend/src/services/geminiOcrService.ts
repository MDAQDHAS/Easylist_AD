import { randomUUID } from 'node:crypto';

const MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const OCR_TIMEOUT_MS = 90_000;

const ALLOWED_UNITS = new Set([
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

const UNIT_ALIASES: Record<string, string> = {
  kilogram: 'kg',
  kilograms: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kgs: 'kg',
  'கிலோ': 'kg',
  'கி': 'kg',
  'கி.': 'kg',
  'கி.கி': 'kg',
  gram: 'g',
  grams: 'g',
  gm: 'g',
  gms: 'g',
  grm: 'g',
  grms: 'g',
  'கிராம்': 'g',
  'கி.ரா': 'g',
  'கி.ரா.': 'g',
  litre: 'ltr',
  liter: 'ltr',
  litres: 'ltr',
  liters: 'ltr',
  lt: 'ltr',
  lts: 'ltr',
  ltrs: 'ltr',
  'லிட்டர்': 'ltr',
  'லி': 'ltr',
  'லி.': 'ltr',
  millilitre: 'ml',
  milliliter: 'ml',
  millilitres: 'ml',
  milliliters: 'ml',
  mls: 'ml',
  'மில்லி': 'ml',
  'மிலி': 'ml',
  'மி.லி': 'ml',
  'மி.லி.': 'ml',
  packet: 'pkt',
  packets: 'pkt',
  pack: 'pkt',
  packs: 'pkt',
  pkts: 'pkt',
  pouch: 'pkt',
  pouches: 'pkt',
  'பாக்கெட்': 'pkt',
  'பாக்': 'pkt',
  piece: 'pcs',
  pieces: 'pcs',
  pc: 'pcs',
  nos: 'pcs',
  no: 'pcs',
  num: 'pcs',
  numbers: 'pcs',
  count: 'pcs',
  'பீஸ்': 'pcs',
  'எண்': 'pcs',
  'உருப்படி': 'pcs',
  bottle: 'bottle',
  bottles: 'bottle',
  btl: 'bottle',
  btls: 'bottle',
  'பாட்டில்': 'bottle',
  box: 'box',
  boxes: 'box',
  carton: 'box',
  cartons: 'box',
  case: 'box',
  cases: 'box',
  'பாக்ஸ்': 'box',
  'பெட்டி': 'box',
  bundle: 'bundle',
  bundles: 'bundle',
  bunch: 'bundle',
  bunches: 'bundle',
  'கட்டு': 'bundle',
  bag: 'bag',
  bags: 'bag',
  sack: 'bag',
  sacks: 'bag',
  gunny: 'bag',
  'மூட்டை': 'bag',
  'பை': 'bag',
  'ப்பை': 'bag',
  tin: 'tin',
  tins: 'tin',
  can: 'tin',
  cans: 'tin',
  'டின்': 'tin',
  dozen: 'dozen',
  dozens: 'dozen',
  dz: 'dozen',
  doz: 'dozen',
  'டஜன்': 'dozen',
};

const PLACEHOLDER_NAMES = new Set([
  '?',
  '??',
  '???',
  'unknown',
  'unreadable',
  'unclear',
  'illegible',
  'n/a',
  'na',
  'none',
]);

export interface ExtractedOrderItem {
  id: string;
  name: string;
  originalText: string;
  tamilName?: string;
  englishName?: string;
  quantity: number | '';
  unit: string;
  unitPrice: number;
  total: number;
  confidence: number;
  hasWarning: boolean;
  warningMessage?: string;
  isUncertain?: boolean;
}

export class OcrProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 422 | 429 | 502 | 503 | 504
  ) {
    super(message);
    this.name = 'OcrProviderError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeUnit(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase().replace(/\.$/, '');
  const unit = UNIT_ALIASES[normalized] ?? UNIT_ALIASES[trimmed] ?? normalized;
  return ALLOWED_UNITS.has(unit) ? unit : '';
}

function cleanRecognizedName(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value
    .trim()
    .replace(/^[\d]+[\.\)\-\s]+\s*/, '')
    .replace(/[\s\-:=,;]+$/, '')
    .trim();
  if (!trimmed || PLACEHOLDER_NAMES.has(trimmed.toLowerCase())) {
    return '';
  }
  return trimmed;
}

const UNIT_REGEX_PART =
  '(?:kg|kgs|kilo|kilos|kilogram|kilograms|g|gm|gms|grm|grms|gram|grams|ltr|lt|lts|ltrs|liter|liters|litre|litres|ml|mls|milli|millilitre|milliliter|pkt|pkts|pack|packs|packet|packets|pouch|pouches|pcs|pc|piece|pieces|nos|no|num|numbers|count|bottle|bottles|btl|btls|box|boxes|carton|cartons|case|cases|bundle|bundles|bunch|bunches|bag|bags|sack|sacks|gunny|tin|tins|can|cans|dozen|dozens|dz|doz|கிலோ|கி\\.?|கிராம்|கி\\.ரா\\.?|லிட்டர்|லி\\.?|மில்லி|மிலி|மி\\.லி\\.?|பாக்கெட்|பாக்|பீஸ்|எண்|உருப்படி|பாட்டில்|பாக்ஸ்|பெட்டி|கட்டு|மூட்டை|பை|ப்பை|டின்|டஜன்)';

const LEADING_QTY_UNIT_REGEX = new RegExp(
  `^(\\d+(?:\\s+\\d+\\/\\d+|\\s*\\/\\s*\\d+|\\.\\d+)?)\\s*(${UNIT_REGEX_PART})?\\b[\\s\\-:=]*(.+)$`,
  'i'
);

const TRAILING_QTY_UNIT_REGEX = new RegExp(
  `^(.+?)(?:\\s*[-:=@,]\\s*|\\s+)(\\d+(?:\\s+\\d+\\/\\d+|\\s*\\/\\s*\\d+|\\.\\d+)?)\\s*(${UNIT_REGEX_PART})?[\\s.]*$`,
  'i'
);

function separateProductFields(candidate: Record<string, unknown>): {
  name: string;
  originalText: string;
  quantity: number | '';
  unit: string;
} {
  const rawOriginalText =
    typeof candidate.originalText === 'string' ? candidate.originalText.trim() : '';
  const candidateName =
    typeof candidate.name === 'string' ? candidate.name.trim() : '';

  const originalText = rawOriginalText || candidateName;
  let cleanName = cleanRecognizedName(candidateName || rawOriginalText);

  let quantity = parseQuantityValue(candidate.quantity);
  let unit = normalizeUnit(candidate.unit);

  // 1. If quantity is missing or empty, attempt extraction from cleanName
  if (quantity === '') {
    // Check trailing first (e.g. 'Surf liquid - 2 bottle', 'Rice - 500 g', 'Soap - 6', '50g வரமிளகாய் - 1/2 கி.')
    const trailMatch = cleanName.match(TRAILING_QTY_UNIT_REGEX);
    if (trailMatch && trailMatch[1].trim()) {
      const candidateQty = parseQuantityValue(trailMatch[2]);
      if (candidateQty !== '') {
        cleanName = cleanRecognizedName(trailMatch[1]);
        quantity = candidateQty;
        if (!unit && trailMatch[3]) {
          unit = normalizeUnit(trailMatch[3]);
        }
      }
    } else {
      // Check leading (e.g. '50g Horlicles', '500g Rice', '2 ltr Milk')
      const leadMatch = cleanName.match(LEADING_QTY_UNIT_REGEX);
      if (leadMatch && leadMatch[3].trim()) {
        const candidateQty = parseQuantityValue(leadMatch[1]);
        if (candidateQty !== '') {
          quantity = candidateQty;
          if (!unit && leadMatch[2]) {
            unit = normalizeUnit(leadMatch[2]);
          }
          cleanName = cleanRecognizedName(leadMatch[3]);
        }
      }
    }
  } else {
    // 2. Quantity was present, but check if cleanName still contains redundant quantity/unit suffix or prefix
    const trailMatch = cleanName.match(TRAILING_QTY_UNIT_REGEX);
    if (trailMatch && trailMatch[1].trim()) {
      const parsedTrailQty = parseQuantityValue(trailMatch[2]);
      if (parsedTrailQty === quantity) {
        cleanName = cleanRecognizedName(trailMatch[1]);
        if (!unit && trailMatch[3]) {
          unit = normalizeUnit(trailMatch[3]);
        }
      }
    } else {
      const leadMatch = cleanName.match(LEADING_QTY_UNIT_REGEX);
      if (leadMatch && leadMatch[3].trim()) {
        const parsedLeadQty = parseQuantityValue(leadMatch[1]);
        if (parsedLeadQty === quantity) {
          cleanName = cleanRecognizedName(leadMatch[3]);
          if (!unit && leadMatch[2]) {
            unit = normalizeUnit(leadMatch[2]);
          }
        }
      }
    }
  }

  cleanName = cleanRecognizedName(cleanName);

  return {
    name: cleanName || originalText,
    originalText,
    quantity,
    unit,
  };
}

function cleanProductFieldText(text: unknown, quantity: number | ''): string | undefined {
  if (typeof text !== 'string' || !text.trim()) return undefined;
  let cleaned = cleanRecognizedName(text);
  if (!cleaned) return undefined;

  const trailMatch = cleaned.match(TRAILING_QTY_UNIT_REGEX);
  if (trailMatch && trailMatch[1].trim()) {
    if (quantity === '' || parseQuantityValue(trailMatch[2]) === quantity) {
      cleaned = cleanRecognizedName(trailMatch[1]);
    }
  } else {
    const leadMatch = cleaned.match(LEADING_QTY_UNIT_REGEX);
    if (leadMatch && leadMatch[3].trim()) {
      if (quantity === '' || parseQuantityValue(leadMatch[1]) === quantity) {
        cleaned = cleanRecognizedName(leadMatch[3]);
      }
    }
  }
  return cleaned || undefined;
}

function parseQuantityValue(value: unknown): number | '' {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value * 1000) / 1000;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    // Handle fractions like "1/2", "1/4", "3/4"
    if (/^\d+\s*\/\s*\d+$/.test(trimmed)) {
      const [num, den] = trimmed.split('/').map(Number);
      if (den > 0) {
        return Math.round((num / den) * 1000) / 1000;
      }
    }
    // Handle mixed fractions like "1 1/2"
    const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
    if (mixedMatch) {
      const whole = Number(mixedMatch[1]);
      const num = Number(mixedMatch[2]);
      const den = Number(mixedMatch[3]);
      if (den > 0) {
        return Math.round((whole + num / den) * 1000) / 1000;
      }
    }
    const num = Number.parseFloat(trimmed);
    if (Number.isFinite(num) && num > 0) {
      return Math.round(num * 1000) / 1000;
    }
  }
  return '';
}

export function parseGeminiItems(responseText: string): ExtractedOrderItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new OcrProviderError('OCR returned an invalid response', 502);
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.items)) {
    throw new OcrProviderError('OCR returned an invalid response', 502);
  }

  const documentType =
    typeof parsed.documentType === 'string' ? parsed.documentType.trim() : '';

  if (documentType === 'blank_image') {
    throw new OcrProviderError(
      'Blank image detected: No handwritten grocery order content was found. Please upload a clear order photo.',
      422
    );
  }

  if (documentType === 'unrelated_image') {
    throw new OcrProviderError(
      'Unrelated image detected: This image does not appear to be a grocery order list. Please upload a handwritten grocery order.',
      422
    );
  }

  if (documentType === 'unreadable_image') {
    throw new OcrProviderError(
      'Unreadable handwriting detected: No readable product rows were found because the image is too blurry or illegible.',
      422
    );
  }

  const items = parsed.items.flatMap((candidate): ExtractedOrderItem[] => {
    if (!isRecord(candidate)) return [];

    const separated = separateProductFields(candidate);
    const { name, originalText, quantity, unit } = separated;

    if (!name || PLACEHOLDER_NAMES.has(name.toLowerCase())) return [];

    const tamilName = cleanProductFieldText(candidate.tamilName, quantity);
    const englishName = cleanProductFieldText(candidate.englishName, quantity);

    const warnings: string[] = [];
    if (!name || PLACEHOLDER_NAMES.has(name.toLowerCase())) warnings.push('Verify the product name');
    if (quantity === '') warnings.push('Verify the quantity');
    if (!unit) warnings.push('Select or verify the unit');

    const rawUnitPrice =
      typeof candidate.unitPrice === 'number' &&
      Number.isFinite(candidate.unitPrice) &&
      candidate.unitPrice > 0
        ? Math.round(candidate.unitPrice * 100) / 100
        : 0;

    const rawTotal =
      typeof candidate.total === 'number' &&
      Number.isFinite(candidate.total) &&
      candidate.total > 0
        ? Math.round(candidate.total * 100) / 100
        : 0;

    const computedTotal =
      rawTotal > 0
        ? rawTotal
        : rawUnitPrice > 0 && typeof quantity === 'number'
          ? Math.round(quantity * rawUnitPrice * 100) / 100
          : 0;

    const effectiveUnitPrice =
      rawUnitPrice > 0
        ? rawUnitPrice
        : rawTotal > 0 && typeof quantity === 'number' && quantity > 0
          ? Math.round((rawTotal / quantity) * 100) / 100
          : 0;

    if (
      rawUnitPrice > 0 &&
      rawTotal > 0 &&
      typeof quantity === 'number' &&
      Math.abs(quantity * rawUnitPrice - rawTotal) > 1
    ) {
      warnings.push('Verify unit price and total calculation');
    }

    const confidence =
      typeof candidate.confidence === 'number' && Number.isFinite(candidate.confidence)
        ? Math.min(1, Math.max(0, candidate.confidence))
        : 0;
    if (confidence < 0.8) warnings.push('Low OCR confidence');

    if (
      candidate.isUncertain === true &&
      typeof candidate.warningNote === 'string' &&
      candidate.warningNote.trim()
    ) {
      warnings.push(candidate.warningNote.trim());
    }

    const isUncertainFlag =
      candidate.isUncertain === true ||
      confidence < 0.8 ||
      warnings.length > 0;

    return [{
      id: randomUUID(),
      name,
      originalText,
      ...(tamilName ? { tamilName } : {}),
      ...(englishName ? { englishName } : {}),
      quantity,
      unit,
      unitPrice: effectiveUnitPrice,
      total: computedTotal,
      confidence,
      hasWarning: isUncertainFlag,
      isUncertain: isUncertainFlag,
      ...(warnings.length > 0 ? { warningMessage: warnings.join('. ') } : {}),
    }];
  });

  if (items.length === 0) {
    throw new OcrProviderError('No readable product rows were found', 422);
  }

  return items;
}

const SYSTEM_PROMPT = [
  'You are an expert OCR and grocery recognition specialist for Indian retail and wholesale grocery orders written in Tamil, English, or mixed Tamil-English (Tanglish).',
  'CORE GOAL: Accurately read what is ACTUALLY WRITTEN in the image. Never guess, invent, or substitute words based on what a product "should" be.',
  '',
  '1. DOCUMENT CLASSIFICATION (documentType):',
  '   - Set documentType to "handwritten_grocery_order" (or "grocery_order_list") for any handwritten order chit, grocery list, wholesale provisioning list, or store order.',
  '   - Set documentType to "blank_image" ONLY if the image is empty or blank paper with no readable text.',
  '   - Set documentType to "unrelated_image" ONLY if the document has nothing to do with groceries/shopping (e.g. selfies, landscapes, vehicles, non-order documents).',
  '   - Set documentType to "unreadable_image" ONLY if the handwriting is completely destroyed, illegible black blur, or impossible to decipher.',
  '',
  '2. LINE-BY-LINE SEQUENTIAL READING (TOP TO BOTTOM):',
  '   - Read the image carefully, line by line, from top to bottom and margin to margin.',
  '   - Transcribe every single visible product line into a separate item. Preserve the original order of items.',
  '   - NEVER omit or skip a visible line simply because it is difficult to read. If difficult to read, transcribe whatever characters are visible, set isUncertain to true, and explain in warningNote.',
  '   - Avoid duplicate rows if lines are repeated in overlapping sections.',
  '',
  '3. SEPARATE ORIGINAL TEXT FROM STANDARD PRODUCT NAMES (DO NOT MIX):',
  '   Maintain three distinct values for every item:',
  '   A. "originalText": The exact text detected in the source image line verbatim (e.g., "50g வரமிளகாய் - 1/2 கி", "356 அரிசி - 426", "துவரம் பருப்பு 25 kg @ 140").',
  '   B. "tamilName": A clear, readable Tamil transcription, ONLY when confidently recognized in Tamil (e.g., "வரமிளகாய்", "அரிசி", "துவரம் பருப்பு"). Set to null if not Tamil or if uncertain.',
  '   C. "englishName": A natural, correctly spelled standard English grocery name, ONLY when the intended product is 100% confidently identified (e.g. "Dry Red Chilli" for வரமிளகாய், "Toor Dal" for துவரம் பருப்பு, "Rice" for அரிசி, "Sugar" for சர்க்கரை, "Surf Soap" for Surf Soap).',
  '      * STRICT RULE: If the product cannot be confidently identified, set englishName to null!',
  '      * NEVER produce awkward, pseudo-phonetic, or guessed English spellings (e.g. NEVER output "Soju Varamalagai", "Soju Kitchili Samba", or "356 Arival").',
  '   D. "name": The verified primary product name (preferring the clear readable Tamil or English product name if confident, or verbatim recognized text if uncertain).',
  '',
  '4. STRICT 3-FIELD SEPARATION (Product Name vs. Quantity vs. Unit):',
  '   Every extracted item must have three strictly separated fields:',
  '   - "name": ONLY the product name (e.g. "Horlicks", "Surf Liquid", "Rice", "Sugar", "Soap", "Boost", "Colgate Paste", "துவரம் பருப்பு", "அரிசி").',
  '     * Remove quantity and unit information from "name" whenever they are identified.',
  '     * NEVER leave quantities or units inside "name" (e.g. do NOT output "50g Horlicks", "Surf liquid - 2 bottle", "Rice - 500 g", "Sugar - 3 kg", or "50g Horlicles -" as the name).',
  '     * Strip trailing punctuation, dashes, hyphens, colons, equals, or commas (e.g. convert "Horlicles -" to "Horlicles", "Colgate Paste -" to "Colgate Paste").',
  '   - "quantity": ONLY the numeric amount (e.g. 50, 2, 500, 3, 6, 0.5, 0.25).',
  '     * If the handwriting says "50g Horlicks", name is "Horlicks", quantity is 50, unit is "g".',
  '     * If the handwriting says "Surf liquid - 2 bottle", name is "Surf Liquid", quantity is 2, unit is "bottle".',
  '     * If the handwriting says "Rice - 500 g", name is "Rice", quantity is 500, unit is "g".',
  '     * If the handwriting says "Sugar - 3 kg", name is "Sugar", quantity is 3, unit is "kg".',
  '     * If the handwriting says "Soap - 6 pcs", name is "Soap", quantity is 6, unit is "pcs".',
  '     * If the handwriting says "Boost - 50 g", name is "Boost", quantity is 50, unit is "g".',
  '     * Support integers, decimals, and fractions (e.g. 1/2 -> 0.5, 1/4 -> 0.25).',
  '     * Do not leave Quantity blank when a readable quantity is present in the original handwriting.',
  '     * If the quantity is genuinely missing or unreadable (e.g. "Colgate Paste -"), leave quantity null and flag for review. NEVER invent a quantity.',
  '   - "unit": ONLY the measurement or packaging unit (e.g. "g", "kg", "ltr", "ml", "pkt", "pcs", "box", "bottle", "bundle", "bag", "tin", "dozen").',
  '     * Keep unit separate from the numeric quantity.',
  '     * If no unit is written or confidently identifiable (e.g. "Soap - 6"), set unit to null. NEVER automatically assign kg, pcs, or any default unit when the original order does not specify one.',
  '',
  '5. ACCURATE FRACTIONS AND UNITS:',
  '   - Preserve fractions and decimals accurately:',
  '     * அரை or 1/2 -> quantity: 0.5',
  '     * கால் or 1/4 -> quantity: 0.25',
  '     * முக்கால் or 3/4 -> quantity: 0.75',
  '     * ஒன்றரை or 1 1/2 -> quantity: 1.5',
  '     * இரண்டரை or 2 1/2 -> quantity: 2.5',
  '   - Canonical unit mappings: கிலோ/கி/kilo/kgs -> "kg", கிராம்/கி.ரா/gm/gms -> "g", லிட்டர்/லி/lt -> "ltr", மில்லி/மி.லி/ml -> "ml", பாக்கெட்/பாக்/pack/pouch -> "pkt", பீஸ்/எண்/nos/no/pc -> "pcs", பெட்டி/பாக்ஸ்/carton -> "box", பாட்டில்/btl -> "bottle", கட்டு/bunch -> "bundle", மூட்டை/பை/sack -> "bag", டின்/can -> "tin". Allowed canonical units are strictly: ' + [...ALLOWED_UNITS].join(', ') + ' or null.',
  '',
  '6. STRICT HORIZONTAL ROW ALIGNMENT:',
  '   - Maintain the correct relationship between each product, its quantity, and its unit.',
  '   - Quantities and units strictly belong to the line they appear on. Never assign a quantity to the row above or below.',
  '',
  '7. CROSSED-OUT & STRUCK-THROUGH ITEMS:',
  '   - If a line is scratched out, crossed out with a horizontal or diagonal strike, or has an X over it, completely omit it.',
  '   - If a number was crossed out and replaced (e.g. "20 25 kg"), extract the replacement value (25).',
  '',
  '8. UNCERTAINTY HANDLING & AMBIGUITY FLAGGING:',
  '   - Whenever handwriting is cursive, faint, smudged, or abbreviated:',
  '     * Transcribe visible characters verbatim into originalText and name.',
  '     * Set isUncertain to true.',
  '     * Set confidence below 0.75 (e.g. 0.5).',
  '     * Provide a clear explanation in warningNote (e.g., "Handwriting cursive or abbreviated: verify product name", "Quantity unwritten on chit").',
  '   - Do NOT present an uncertain reading with high confidence.',
].join('\n');

function resolveGeminiApiKey(): string {
  const raw = process.env.GEMINI_API_KEY?.trim() ?? '';
  const unquoted = raw.replace(/^['"]|['"]$/g, '').trim();
  if (!unquoted || /^your[_-]/i.test(unquoted)) {
    return '';
  }
  return unquoted;
}

/**
 * Live extraction stages reported to callers (route handlers / async OCR jobs).
 * These are real lifecycle transitions, not simulated progress.
 */
export type OcrStage =
  | 'reading_handwriting'
  | 'retrying'
  | 'switching_to_backup'
  | 'extracting_products'
  | 'validating_results';

export interface ExtractOrderOptions {
  /** Retries on the primary model after its first attempt (bounded to 0..3). */
  maxRetries?: number;
  /** Retries on the fallback model after its first attempt (bounded to 0..3). */
  fallbackMaxRetries?: number;
  baseDelayMs?: number;
  /** Legacy single per-attempt timeout, used when model-specific timeouts are not provided. */
  timeoutMs?: number;
  /** Per-attempt timeout for the primary model (fast probe). */
  primaryTimeoutMs?: number;
  /** Per-attempt timeout for the fallback model (full budget for large photos / long orders). */
  fallbackTimeoutMs?: number;
  /** Hard ceiling for the whole extraction including retries, backoff and fallback. */
  totalBudgetMs?: number;
  fallbackModel?: string;
  /** How long a failing primary model is bypassed before it is probed again. */
  primaryCooldownMs?: number;
  onStage?: (stage: OcrStage) => void;
}

const RETRYABLE_HTTP_STATUSES = new Set([429, 500, 502, 503, 504]);

const DEFAULT_PRIMARY_TIMEOUT_MS = 25_000;
const DEFAULT_FALLBACK_TIMEOUT_MS = 45_000;
const DEFAULT_TOTAL_BUDGET_MS = 150_000;
const DEFAULT_PRIMARY_COOLDOWN_MS = 60_000;
const MIN_USEFUL_ATTEMPT_MS = 1_000;

const PROVIDER_BUSY_MESSAGE =
  'The AI reading service is temporarily busy. Please try again in a moment.';
const PROVIDER_TIMEOUT_MESSAGE =
  'The AI reading service took too long to respond. Please try again in a moment.';

type RetryableReason = 'timeout' | 'unavailable' | 'invalid_response' | 'network';

class RetryableGeminiError extends Error {
  readonly statusCode: 422 | 429 | 502 | 503 | 504;
  readonly reason: RetryableReason;

  constructor(
    message: string,
    statusCode: 422 | 429 | 502 | 503 | 504,
    reason: RetryableReason
  ) {
    super(message);
    this.name = 'RetryableGeminiError';
    this.statusCode = statusCode;
    this.reason = reason;
  }
}

class QuotaExhaustedGeminiError extends Error {
  readonly statusCode = 429;
  constructor(message: string, public readonly details?: string) {
    super(message);
    this.name = 'QuotaExhaustedGeminiError';
  }
}

/**
 * In-memory model health tracking (circuit breaker). When the primary model is
 * exhausted with retryable failures, it is bypassed for a short cooldown so that
 * every subsequent image in a multi-image order does not wait on a degraded model.
 */
const modelCooldownUntil = new Map<string, number>();

export function resetOcrModelHealth(): void {
  modelCooldownUntil.clear();
}

export function isOcrModelCoolingDown(modelName: string, now = Date.now()): boolean {
  const until = modelCooldownUntil.get(modelName);
  if (until === undefined) return false;
  if (until <= now) {
    modelCooldownUntil.delete(modelName);
    return false;
  }
  return true;
}

function buildModelEndpoint(modelName: string): string {
  if (modelName === MODEL) {
    return ENDPOINT;
  }
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`;
}

function computeBackoffDelayMs(attempt: number, baseDelayMs: number): number {
  const exponential = baseDelayMs * Math.pow(2, attempt);
  const maxJitter = Math.max(1, Math.floor(baseDelayMs / 2));
  const jitter = Math.floor(Math.random() * maxJitter);
  return exponential + jitter;
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function readBoundedInt(
  optionValue: number | undefined,
  envName: string,
  fallback: number,
  min: number,
  max: number
): number {
  const envRaw = process.env[envName];
  const raw =
    optionValue ??
    (envRaw !== undefined && envRaw.trim() !== '' ? Number.parseInt(envRaw, 10) : fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(raw)));
}

async function callGeminiOnce(
  endpointUrl: string,
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  timeoutMs: number,
  onStage?: (stage: OcrStage) => void
): Promise<ExtractedOrderItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: SYSTEM_PROMPT,
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
          ],
        }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              documentType: {
                type: 'STRING',
                enum: [
                  'handwritten_grocery_order',
                  'grocery_order_list',
                  'blank_image',
                  'unrelated_image',
                  'unreadable_image',
                ],
              },
              rejectionReason: {
                type: 'STRING',
                nullable: true,
              },
              items: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    name: { type: 'STRING' },
                    originalText: { type: 'STRING' },
                    tamilName: { type: 'STRING', nullable: true },
                    englishName: { type: 'STRING', nullable: true },
                    quantity: { type: 'NUMBER', nullable: true },
                    unit: {
                      type: 'STRING',
                      nullable: true,
                      enum: [...ALLOWED_UNITS],
                    },
                    unitPrice: { type: 'NUMBER', nullable: true },
                    total: { type: 'NUMBER', nullable: true },
                    confidence: { type: 'NUMBER' },
                    isUncertain: { type: 'BOOLEAN', nullable: true },
                    warningNote: { type: 'STRING', nullable: true },
                  },
                  required: ['name', 'originalText', 'quantity', 'unit', 'confidence'],
                },
              },
            },
            required: ['documentType', 'items'],
          },
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        const errorBody = await response.text().catch(() => '');
        const isPlanQuota =
          errorBody.includes('exceeded your current quota') ||
          errorBody.includes('quota') ||
          errorBody.includes('RESOURCE_EXHAUSTED');
        if (isPlanQuota) {
          throw new QuotaExhaustedGeminiError(
            'Model quota is currently exhausted for this plan',
            errorBody
          );
        }
        throw new RetryableGeminiError(PROVIDER_BUSY_MESSAGE, 503, 'unavailable');
      }

      if (RETRYABLE_HTTP_STATUSES.has(response.status)) {
        throw new RetryableGeminiError(PROVIDER_BUSY_MESSAGE, 503, 'unavailable');
      }
      // 400/401/403 etc. are configuration or request problems; retrying will not help.
      throw new OcrProviderError('OCR provider could not process this image', 502);
    }

    let responseData: unknown;
    try {
      responseData = await response.json();
    } catch {
      // The per-attempt timer also covers the body download; an abort here is a timeout.
      if (controller.signal.aborted) {
        throw new RetryableGeminiError(PROVIDER_TIMEOUT_MESSAGE, 504, 'timeout');
      }
      throw new RetryableGeminiError(PROVIDER_BUSY_MESSAGE, 502, 'invalid_response');
    }

    if (!isRecord(responseData) || !Array.isArray(responseData.candidates)) {
      throw new RetryableGeminiError(PROVIDER_BUSY_MESSAGE, 502, 'invalid_response');
    }

    const candidate = responseData.candidates[0];
    if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) {
      throw new RetryableGeminiError(PROVIDER_BUSY_MESSAGE, 502, 'invalid_response');
    }

    const textPart = candidate.content.parts.find(
      (part: unknown) => isRecord(part) && typeof part.text === 'string'
    );
    if (!isRecord(textPart) || typeof textPart.text !== 'string') {
      throw new RetryableGeminiError(PROVIDER_BUSY_MESSAGE, 502, 'invalid_response');
    }

    onStage?.('extracting_products');
    try {
      const items = parseGeminiItems(textPart.text);
      onStage?.('validating_results');
      return items;
    } catch (parseError) {
      // 422 = genuine document rejection (blank / unrelated / unreadable): never retried.
      if (parseError instanceof OcrProviderError && parseError.statusCode === 422) {
        throw parseError;
      }
      // Truncated or malformed model JSON is transient; a bounded retry may succeed.
      throw new RetryableGeminiError(PROVIDER_BUSY_MESSAGE, 502, 'invalid_response');
    }
  } catch (error) {
    if (
      error instanceof OcrProviderError ||
      error instanceof RetryableGeminiError ||
      error instanceof QuotaExhaustedGeminiError
    ) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw new RetryableGeminiError(PROVIDER_TIMEOUT_MESSAGE, 504, 'timeout');
    }
    throw new RetryableGeminiError(PROVIDER_BUSY_MESSAGE, 502, 'network');
  } finally {
    clearTimeout(timeout);
  }
}

interface ModelPlanStep {
  model: string;
  role: 'primary' | 'fallback';
  attempts: number;
  timeoutMs: number;
}

export async function extractOrderItems(
  image: Buffer,
  mimeType: string,
  options: ExtractOrderOptions = {}
): Promise<ExtractedOrderItem[]> {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    throw new OcrProviderError('OCR service is not configured', 503);
  }

  const primaryModel = process.env.GEMINI_MODEL?.trim() || MODEL;
  const fallbackModel = (
    options.fallbackModel ??
    process.env.GEMINI_FALLBACK_MODEL ??
    ''
  ).trim();
  const hasFallback = Boolean(fallbackModel) && fallbackModel !== primaryModel;

  const primaryRetries = readBoundedInt(options.maxRetries, 'GEMINI_MAX_RETRIES', 1, 0, 3);
  const fallbackRetries = readBoundedInt(
    options.fallbackMaxRetries,
    'GEMINI_FALLBACK_MAX_RETRIES',
    1,
    0,
    3
  );
  const baseDelayMs = readBoundedInt(
    options.baseDelayMs,
    'GEMINI_RETRY_BASE_DELAY_MS',
    300,
    0,
    5_000
  );

  // Legacy GEMINI_ATTEMPT_TIMEOUT_MS / options.timeoutMs remain supported.
  const legacyTimeout =
    options.timeoutMs ??
    (process.env.GEMINI_ATTEMPT_TIMEOUT_MS
      ? Number.parseInt(process.env.GEMINI_ATTEMPT_TIMEOUT_MS, 10)
      : undefined);
  const primaryTimeoutMs = readBoundedInt(
    options.primaryTimeoutMs ?? options.timeoutMs,
    'GEMINI_PRIMARY_TIMEOUT_MS',
    legacyTimeout ?? DEFAULT_PRIMARY_TIMEOUT_MS,
    1,
    OCR_TIMEOUT_MS
  );
  const fallbackTimeoutMs = readBoundedInt(
    options.fallbackTimeoutMs,
    'GEMINI_FALLBACK_TIMEOUT_MS',
    options.timeoutMs ?? DEFAULT_FALLBACK_TIMEOUT_MS,
    1,
    OCR_TIMEOUT_MS
  );
  const totalBudgetMs = readBoundedInt(
    options.totalBudgetMs,
    'GEMINI_TOTAL_BUDGET_MS',
    DEFAULT_TOTAL_BUDGET_MS,
    1,
    300_000
  );
  const primaryCooldownMs = readBoundedInt(
    options.primaryCooldownMs,
    'GEMINI_PRIMARY_COOLDOWN_MS',
    DEFAULT_PRIMARY_COOLDOWN_MS,
    0,
    600_000
  );

  const primaryStep: ModelPlanStep = {
    model: primaryModel,
    role: 'primary',
    attempts: primaryRetries + 1,
    timeoutMs: primaryTimeoutMs,
  };
  const fallbackStep: ModelPlanStep | null = hasFallback
    ? {
        model: fallbackModel,
        role: 'fallback',
        attempts: fallbackRetries + 1,
        timeoutMs: fallbackTimeoutMs,
      }
    : null;

  // If the primary model recently failed, go straight to the fallback and keep a
  // single primary attempt as a last resort.
  const plan: ModelPlanStep[] =
    fallbackStep && isOcrModelCoolingDown(primaryModel)
      ? [fallbackStep, { ...primaryStep, attempts: 1 }]
      : fallbackStep
        ? [primaryStep, fallbackStep]
        : [primaryStep];

  const imageBase64 = image.toString('base64');
  const deadline = Date.now() + totalBudgetMs;
  const onStage = options.onStage;
  let lastRetryableError: RetryableGeminiError | undefined;
  let sawTimeout = false;

  onStage?.('reading_handwriting');

  for (let stepIndex = 0; stepIndex < plan.length; stepIndex += 1) {
    const step = plan[stepIndex];
    const hasNextStep = stepIndex < plan.length - 1;

    if (stepIndex > 0) {
      onStage?.('switching_to_backup');
    }

    let stepFailedRetryably = false;

    for (let attempt = 0; attempt < step.attempts; attempt += 1) {
      if (attempt > 0) {
        onStage?.('retrying');
        const delay = computeBackoffDelayMs(attempt - 1, baseDelayMs);
        if (Date.now() + delay + MIN_USEFUL_ATTEMPT_MS > deadline) break;
        await sleep(delay);
      }

      const remainingMs = deadline - Date.now();
      if (remainingMs < MIN_USEFUL_ATTEMPT_MS) break;
      const attemptTimeoutMs = Math.min(step.timeoutMs, remainingMs);

      try {
        const items = await callGeminiOnce(
          buildModelEndpoint(step.model),
          apiKey,
          imageBase64,
          mimeType,
          attemptTimeoutMs,
          onStage
        );
        if (step.role === 'primary') {
          modelCooldownUntil.delete(step.model);
        }
        return items;
      } catch (error) {
        if (error instanceof OcrProviderError) {
          // Non-retryable (422 document rejection, 400/401/403 provider rejection).
          throw error;
        }
        if (error instanceof QuotaExhaustedGeminiError) {
          stepFailedRetryably = true;
          if (step.role === 'primary' && fallbackStep && primaryCooldownMs > 0) {
            modelCooldownUntil.set(step.model, Date.now() + primaryCooldownMs);
          }
          if (hasNextStep) {
            // Instant circuit-break transition to fallback model without burning retry attempts or sleep delays
            break;
          }
          throw new OcrProviderError(PROVIDER_BUSY_MESSAGE, 503);
        }
        if (error instanceof RetryableGeminiError) {
          lastRetryableError = error;
          stepFailedRetryably = true;
          if (error.reason === 'timeout') {
            sawTimeout = true;
            // A timed-out primary is unlikely to be faster on an immediate retry;
            // switch straight to the backup model instead of waiting again.
            if (step.role === 'primary' && hasNextStep) break;
          }
          continue;
        }
        throw new OcrProviderError(PROVIDER_BUSY_MESSAGE, 502);
      }
    }

    if (stepFailedRetryably && step.role === 'primary' && fallbackStep && primaryCooldownMs > 0) {
      modelCooldownUntil.set(step.model, Date.now() + primaryCooldownMs);
    }
  }

  if (sawTimeout && lastRetryableError?.reason === 'timeout') {
    throw new OcrProviderError(PROVIDER_TIMEOUT_MESSAGE, 504);
  }
  throw new OcrProviderError(PROVIDER_BUSY_MESSAGE, 503);
}
