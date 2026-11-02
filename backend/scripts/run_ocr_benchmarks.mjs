import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { extractOrderItems, OcrProviderError } from '../dist/services/geminiOcrService.js';

const SCRATCH_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\3bd441ae-6af7-4e53-828f-c22d0885d2b3\\scratch';
const TEST_IMAGES_DIR = path.join(SCRATCH_DIR, 'test_images');

// Ensure API key is configured from .env
const envFile = fs.readFileSync(path.resolve('backend/.env'), 'utf8');
for (const line of envFile.split('\n')) {
  const trimmed = line.trim();
  if (trimmed.startsWith('GEMINI_API_KEY=')) {
    process.env.GEMINI_API_KEY = trimmed.replace('GEMINI_API_KEY=', '').trim();
  }
  if (trimmed.startsWith('GEMINI_MODEL=')) {
    process.env.GEMINI_MODEL = trimmed.replace('GEMINI_MODEL=', '').trim();
  }
}

console.log('=== EasyList Real-World OCR Benchmark ===\n');
console.log(`Active Model: ${process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'}`);

const benchmarkResults = [];

async function benchmarkImage(filename, expectedBehavior) {
  const filePath = path.join(TEST_IMAGES_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`File ${filename} not found in ${TEST_IMAGES_DIR}, skipping.`);
    return;
  }

  const imageBuffer = fs.readFileSync(filePath);
  const start = performance.now();
  console.log(`Testing ${filename} (${expectedBehavior.description})...`);

  try {
    const items = await extractOrderItems(imageBuffer, 'image/png');
    const duration = Math.round(performance.now() - start);

    console.log(`  ✔ Completed in ${duration}ms | Extracted ${items.length} items`);
    for (const item of items) {
      console.log(`     - [${item.name}] Qty: ${item.quantity} ${item.unit} | Original: "${item.originalText}" | Warning: ${item.hasWarning ? item.warningMessage : 'None'}`);
    }

    if (expectedBehavior.minItems) {
      assert.ok(items.length >= expectedBehavior.minItems, `Expected at least ${expectedBehavior.minItems} items, got ${items.length}`);
    }
    if (expectedBehavior.mustIncludeTamil) {
      assert.ok(items.some(i => /[\u0B80-\u0BFF]/.test(i.originalText)), 'Original text must preserve Tamil characters');
    }
    if (expectedBehavior.mustExcludeCrossedOut) {
      assert.ok(!items.some(i => i.name.toLowerCase().includes('crossed') || i.originalText.includes('Crossed')), 'Crossed-out item must not be included');
    }

    benchmarkResults.push({
      file: filename,
      durationMs: duration,
      itemsCount: items.length,
      status: 'SUCCESS',
      type: expectedBehavior.type,
    });
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    if (expectedBehavior.expectRejection) {
      console.log(`  ✔ Correctly rejected in ${duration}ms: "${err.message}" (Status: ${err.statusCode || 422})`);
      benchmarkResults.push({
        file: filename,
        durationMs: duration,
        status: 'REJECTED_AS_EXPECTED',
        type: expectedBehavior.type,
      });
    } else {
      console.error(`  ✖ Failed in ${duration}ms:`, err.message);
      benchmarkResults.push({
        file: filename,
        durationMs: duration,
        status: 'FAILED',
        error: err.message,
        type: expectedBehavior.type,
      });
    }
  }
}

async function run() {
  // 1. English Handwriting
  await benchmarkImage('order_1_english.png', {
    type: 'English Handwriting',
    description: 'Standard English handwritten wholesale grocery chit',
    minItems: 2,
  });

  // 2. Tamil Handwriting
  await benchmarkImage('order_2_tamil.png', {
    type: 'Tamil Handwriting',
    description: 'Pure Tamil handwritten grocery order with Tamil units & prices',
    minItems: 3,
    mustIncludeTamil: true,
  });

  // 3. Mixed Tamil-English (Tanglish)
  await benchmarkImage('order_3_mixed.png', {
    type: 'Mixed Tamil-English',
    description: 'Bilingual chit with mixed Tamil names and English quantities',
    minItems: 2,
    mustIncludeTamil: true,
  });

  // 4. Challenging: Tilted, Crossed-out, Dim Handwriting
  await benchmarkImage('order_8_tilted_crossed_dim.png', {
    type: 'Challenging (Tilted/Dim/Crossed)',
    description: 'Dim lighting, slight tilt, crossed-out line, missing prices',
    minItems: 2,
    mustExcludeCrossedOut: true,
  });

  // 5. Blank Image Rejection
  await benchmarkImage('order_5_blank.png', {
    type: 'Blank Image',
    description: 'Empty chit without handwriting',
    expectRejection: true,
  });

  // 6. Unreadable Image Rejection
  await benchmarkImage('order_7_unreadable.png', {
    type: 'Unreadable Image',
    description: 'Extreme blur and scribbles',
    expectRejection: true,
  });

  console.log('\n=== Benchmark Summary ===');
  console.table(benchmarkResults);
}

run();
