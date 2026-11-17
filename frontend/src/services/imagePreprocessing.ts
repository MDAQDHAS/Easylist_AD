/**
 * Client-Side Smart Image Preprocessor for EasyList OCR
 *
 * Optimizes mobile camera order chits before AI extraction:
 * 1. Resizing: Scales down oversized phone images (3000px - 4000px) to max 1920px
 *    while upscaling very small photos (< 720px) to preserve fine ink strokes.
 * 2. Adaptive Contrast Normalization: Calculates the luminance histogram and stretches
 *    levels so faint ink strokes become darker and shadowed/yellowish paper becomes bright white.
 * 3. Preserves original File untouched in memory for user inspection and comparison.
 * 4. Gracefully falls back to original File in Node.js (tests/SSR) or when Canvas is unavailable.
 */

const MAX_DIMENSION = 1920;
const MIN_DIMENSION = 720;
const TARGET_UPSCALE_WIDTH = 1200;
const JPEG_QUALITY = 0.92;

/**
 * Normalizes contrast and removes paper shadows using a dynamic range stretch (3rd to 97th percentile).
 * Enhances handwriting stroke legibility for both Tamil curves and English alphanumeric characters.
 */
function enhanceContrastAndLighting(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const len = data.length;

    // 1. Build luminance histogram (sampling every 4th pixel for high performance ~5-10ms)
    const hist = new Uint32Array(256);
    let sampleCount = 0;
    for (let i = 0; i < len; i += 16) {
      // Rec. 709 luminance weights: 0.2126 R + 0.7152 G + 0.0722 B
      const lum = (data[i] * 54 + data[i + 1] * 183 + data[i + 2] * 19) >> 8;
      hist[lum]++;
      sampleCount++;
    }

    if (sampleCount === 0) return;

    // 2. Identify 3rd percentile (ink strokes) and 97th percentile (paper background)
    const lowCount = Math.floor(sampleCount * 0.03);
    const highCount = Math.floor(sampleCount * 0.97);

    let acc = 0;
    let pLow = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= lowCount) {
        pLow = v;
        break;
      }
    }

    acc = 0;
    let pHigh = 255;
    for (let v = 255; v >= 0; v--) {
      acc += hist[v];
      if (acc >= sampleCount - highCount) {
        pHigh = v;
        break;
      }
    }

    // Guard against solid-color or already extreme-contrast images
    if (pHigh - pLow < 35) {
      pLow = Math.max(0, pLow - 20);
      pHigh = Math.min(255, pHigh + 20);
    }

    // 3. Precompute lookup table (LUT) for fast O(N) pixel transformation
    const range = pHigh - pLow || 1;
    const lut = new Uint8Array(256);
    for (let v = 0; v < 256; v++) {
      const stretched = Math.round(((v - pLow) / range) * 255);
      lut[v] = Math.max(0, Math.min(255, stretched));
    }

    // 4. Apply stretch to RGB channels
    for (let i = 0; i < len; i += 4) {
      data[i] = lut[data[i]];         // Red
      data[i + 1] = lut[data[i + 1]]; // Green
      data[i + 2] = lut[data[i + 2]]; // Blue
    }

    ctx.putImageData(imgData, 0, 0);
  } catch (err) {
    // If pixel manipulation fails, keep canvas as-is
    console.warn('Contrast enhancement skipped:', err);
  }
}

export async function preprocessImageForOcr(file: File): Promise<File> {
  // 1. Guard against non-files or empty files
  if (!file || typeof file !== 'object' || !file.size) {
    return file;
  }

  // 2. Fall back gracefully to original file in non-browser Node environments (tests/SSR)
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof document.createElement !== 'function'
  ) {
    return file;
  }

  try {
    let sourceWidth = 0;
    let sourceHeight = 0;
    let drawable: ImageBitmap | HTMLImageElement;

    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      sourceWidth = bitmap.width;
      sourceHeight = bitmap.height;
      drawable = bitmap;
    } else {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image for preprocessing'));
        img.src = objectUrl;
      });
      URL.revokeObjectURL(objectUrl);
      sourceWidth = img.naturalWidth || img.width;
      sourceHeight = img.naturalHeight || img.height;
      drawable = img;
    }

    if (!sourceWidth || !sourceHeight) {
      if ('close' in drawable && typeof drawable.close === 'function') {
        drawable.close();
      }
      return file;
    }

    // 3. Calculate target dimensions:
    // - Scale down oversized camera images (> 1920px)
    // - Upscale small photos (< 720px width) so fine handwriting curves are legible
    let targetWidth = sourceWidth;
    let targetHeight = sourceHeight;

    if (sourceWidth > MAX_DIMENSION || sourceHeight > MAX_DIMENSION) {
      if (sourceWidth >= sourceHeight) {
        targetWidth = MAX_DIMENSION;
        targetHeight = Math.round((sourceHeight * MAX_DIMENSION) / sourceWidth);
      } else {
        targetHeight = MAX_DIMENSION;
        targetWidth = Math.round((sourceWidth * MAX_DIMENSION) / sourceHeight);
      }
    } else if (sourceWidth < MIN_DIMENSION && sourceWidth > 0) {
      targetWidth = TARGET_UPSCALE_WIDTH;
      targetHeight = Math.round((sourceHeight * TARGET_UPSCALE_WIDTH) / sourceWidth);
    }

    // 4. Create canvas with high-quality rendering
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      if ('close' in drawable && typeof drawable.close === 'function') {
        drawable.close();
      }
      return file;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(drawable, 0, 0, targetWidth, targetHeight);

    if ('close' in drawable && typeof drawable.close === 'function') {
      drawable.close();
    }

    // 5. Apply adaptive contrast and illumination normalization
    enhanceContrastAndLighting(ctx, targetWidth, targetHeight);

    // 6. Export high-quality JPEG Blob for OCR extraction
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
    });

    if (!blob) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, '');
    const preprocessedName = `${baseName}_enhanced.jpg`;

    return new File([blob], preprocessedName, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch (err) {
    console.warn('EasyList image preprocessing fallback to original file:', err);
    return file;
  }
}
