import test from 'node:test';
import assert from 'node:assert/strict';
import express, { type RequestHandler } from 'express';
import { createServer, type AddressInfo } from 'node:http';
import { createOcrRouter } from '../src/routes/ocrRoutes.js';
import {
  extractOrderItems,
  isOcrModelCoolingDown,
  OcrProviderError,
  parseGeminiItems,
  resetOcrModelHealth,
} from '../src/services/geminiOcrService.js';

const VALID_PNG_BYTES = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);

const authenticatedUser: RequestHandler = (_req, res, next) => {
  res.locals.user = {
    id: 'test-user',
    uid: 'test-firebase-uid',
    email: 'test@example.com',
    emailVerified: true,
    internalUserId: 'internal-test-user',
    linkingStatus: 'LINKED',
  };
  next();
};

async function withOcrServer(
  router: ReturnType<typeof createOcrRouter>,
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const app = express();
  app.use('/api/ocr', router);

  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function createImageForm(
  bytes: Uint8Array = VALID_PNG_BYTES,
  mimeType = 'image/png'
): FormData {
  const form = new FormData();
  form.append('image', new Blob([bytes], { type: mimeType }), 'order.png');
  return form;
}

test('requires a server-side Gemini key and does not call the provider when it is missing', async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  delete process.env.GEMINI_API_KEY;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response();
  };

  try {
    await assert.rejects(
      extractOrderItems(Buffer.from(VALID_PNG_BYTES), 'image/png'),
      (error: unknown) =>
        error instanceof OcrProviderError &&
        error.statusCode === 503 &&
        error.message === 'OCR service is not configured'
    );
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});

test('sends the image to Gemini with a server-side key and parses structured results', async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalFetch = globalThis.fetch;
  const image = Buffer.from(VALID_PNG_BYTES);
  process.env.GEMINI_API_KEY = 'test-key-not-a-secret';
  globalThis.fetch = async (_input, init) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('x-goog-api-key'), 'test-key-not-a-secret');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.contents[0].parts[1].inline_data.data, image.toString('base64'));
    return new Response(
      JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                documentType: 'handwritten_grocery_order',
                items: [{
                  name: 'Toor Dal',
                  originalText: 'துவரம் பருப்பு',
                  quantity: 5,
                  unit: 'kg',
                  confidence: 0.94,
                }],
              }),
            }],
          },
        }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  try {
    const items = await extractOrderItems(image, 'image/png');
    assert.equal(items.length, 1);
    assert.equal(items[0].name, 'Toor Dal');
    assert.equal(items[0].originalText, 'துவரம் பருப்பு');
    assert.equal(items[0].quantity, 5);
    assert.equal(items[0].unit, 'kg');
    assert.equal(items[0].hasWarning, false);
    assert.equal(items[0].unitPrice, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});

test('does not expose provider response details when Gemini rejects an image', async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = 'test-key-not-a-secret';
  globalThis.fetch = async () =>
    new Response('provider detail that must not be returned', { status: 401 });

  try {
    await assert.rejects(
      extractOrderItems(Buffer.from(VALID_PNG_BYTES), 'image/png'),
      (error: unknown) =>
        error instanceof OcrProviderError &&
        error.statusCode === 502 &&
        error.message === 'OCR provider could not process this image' &&
        !error.message.includes('provider detail')
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});

test('marks incomplete and uncertain rows for review without inventing values', () => {
  const items = parseGeminiItems(JSON.stringify({
    items: [{
      name: '',
      originalText: 'மிளகாய்',
      quantity: null,
      unit: null,
      confidence: 0.42,
    }],
  }));

  assert.equal(items[0].name, 'மிளகாய்');
  assert.equal(items[0].quantity, '');
  assert.equal(items[0].unit, '');
  assert.equal(items[0].hasWarning, true);
  assert.match(items[0].warningMessage ?? '', /quantity/i);
  assert.match(items[0].warningMessage ?? '', /unit/i);
  assert.match(items[0].warningMessage ?? '', /confidence/i);
});

test('rejects malformed or empty Gemini item responses', () => {
  assert.throws(() => parseGeminiItems('not json'), OcrProviderError);
  assert.throws(() => parseGeminiItems('{"items":[]}'), /No readable product rows/);
});

test('rejects blank, unrelated, and unreadable images with 422 status', () => {
  assert.throws(
    () => parseGeminiItems(JSON.stringify({ documentType: 'blank_image', items: [] })),
    (err: unknown) => err instanceof OcrProviderError && err.statusCode === 422 && /blank image/i.test(err.message)
  );
  assert.throws(
    () => parseGeminiItems(JSON.stringify({ documentType: 'unrelated_image', items: [] })),
    (err: unknown) => err instanceof OcrProviderError && err.statusCode === 422 && /unrelated image/i.test(err.message)
  );
  assert.throws(
    () => parseGeminiItems(JSON.stringify({ documentType: 'unreadable_image', items: [] })),
    (err: unknown) => err instanceof OcrProviderError && err.statusCode === 422 && /unreadable handwriting/i.test(err.message)
  );
});

test('extracts Tamil units, unit prices, totals, and flags price mismatches without inventing values', () => {
  const items = parseGeminiItems(JSON.stringify({
    documentType: 'handwritten_grocery_order',
    items: [
      {
        name: 'Ponni Rice',
        originalText: 'பொன்னி அரிசி 25 கிலோ @ 55',
        quantity: 25,
        unit: 'கிலோ',
        unitPrice: 55,
        total: null,
        confidence: 0.96,
      },
      {
        name: 'Gingelly Oil',
        originalText: 'நல்லெண்ணெய் 2 லிட்டர் = 700',
        quantity: 2,
        unit: 'லிட்டர்',
        unitPrice: 320,
        total: 700,
        confidence: 0.91,
      },
    ],
  }));

  assert.equal(items.length, 2);
  assert.equal(items[0].unit, 'kg');
  assert.equal(items[0].unitPrice, 55);
  assert.equal(items[0].total, 1375);
  assert.equal(items[0].hasWarning, false);

  assert.equal(items[1].unit, 'ltr');
  assert.equal(items[1].unitPrice, 320);
  assert.equal(items[1].total, 700);
  assert.equal(items[1].hasWarning, true);
  assert.match(items[1].warningMessage ?? '', /price and total/i);
});

test('correctly maps separated fields for product name, quantity, and unit from handwriting', () => {
  const items = parseGeminiItems(JSON.stringify({
    documentType: 'handwritten_grocery_order',
    items: [
      {
        name: 'Surf liquid - 2 bottle',
        originalText: 'Surf liquid - 2 bottle',
        quantity: null,
        unit: null,
        confidence: 0.95,
      },
      {
        name: 'Rice - 500 g',
        originalText: 'Rice - 500 g',
        quantity: null,
        unit: null,
        confidence: 0.95,
      },
      {
        name: 'Sugar - 3 kg',
        originalText: 'Sugar - 3 kg',
        quantity: null,
        unit: null,
        confidence: 0.95,
      },
      {
        name: 'Soap - 6 pcs',
        originalText: 'Soap - 6 pcs',
        quantity: null,
        unit: null,
        confidence: 0.95,
      },
      {
        name: 'Boost - 50 g',
        originalText: 'Boost - 50 g',
        quantity: null,
        unit: null,
        confidence: 0.95,
      },
      {
        name: '50g Horlicles -',
        originalText: '50g Horlicles -',
        quantity: null,
        unit: null,
        confidence: 0.92,
      },
      {
        name: '50g Horlicks',
        originalText: '50g Horlicks',
        quantity: null,
        unit: null,
        confidence: 0.95,
      },
      {
        name: 'Soap - 6',
        originalText: 'Soap - 6',
        quantity: null,
        unit: null,
        confidence: 0.9,
      },
      {
        name: 'Product name only',
        originalText: 'Product name only',
        quantity: null,
        unit: null,
        confidence: 0.85,
      },
      {
        name: 'Colgate Paste -',
        originalText: 'Colgate Paste -',
        quantity: null,
        unit: null,
        confidence: 0.85,
      },
      {
        name: 'Eggs - 1 dozen',
        originalText: 'Eggs - 1 dozen',
        quantity: null,
        unit: null,
        confidence: 0.95,
      },
      {
        name: 'சர்க்கரை - 3 கிலோ',
        originalText: 'சர்க்கரை - 3 கிலோ',
        quantity: null,
        unit: null,
        confidence: 0.95,
      },
      {
        name: 'துவரம் பருப்பு 5 kg',
        originalText: 'துவரம் பருப்பு 5 kg',
        quantity: null,
        unit: null,
        confidence: 0.95,
      },
    ],
  }));

  assert.equal(items.length, 13);

  // 1. Surf liquid - 2 bottle
  assert.equal(items[0].name, 'Surf liquid');
  assert.equal(items[0].quantity, 2);
  assert.equal(items[0].unit, 'bottle');
  assert.equal(items[0].originalText, 'Surf liquid - 2 bottle');

  // 2. Rice - 500 g
  assert.equal(items[1].name, 'Rice');
  assert.equal(items[1].quantity, 500);
  assert.equal(items[1].unit, 'g');

  // 3. Sugar - 3 kg
  assert.equal(items[2].name, 'Sugar');
  assert.equal(items[2].quantity, 3);
  assert.equal(items[2].unit, 'kg');

  // 4. Soap - 6 pcs
  assert.equal(items[3].name, 'Soap');
  assert.equal(items[3].quantity, 6);
  assert.equal(items[3].unit, 'pcs');

  // 5. Boost - 50 g
  assert.equal(items[4].name, 'Boost');
  assert.equal(items[4].quantity, 50);
  assert.equal(items[4].unit, 'g');

  // 6. 50g Horlicles - (leading qty, trailing dash stripped, originalText preserved verbatim)
  assert.equal(items[5].name, 'Horlicles');
  assert.equal(items[5].quantity, 50);
  assert.equal(items[5].unit, 'g');
  assert.equal(items[5].originalText, '50g Horlicles -');

  // 7. 50g Horlicks
  assert.equal(items[6].name, 'Horlicks');
  assert.equal(items[6].quantity, 50);
  assert.equal(items[6].unit, 'g');

  // 8. Soap - 6 (quantity present, unit blank without guessing kg/pcs)
  assert.equal(items[7].name, 'Soap');
  assert.equal(items[7].quantity, 6);
  assert.equal(items[7].unit, '');

  // 9. Product name only (missing quantity remains blank and flagged for review)
  assert.equal(items[8].name, 'Product name only');
  assert.equal(items[8].quantity, '');
  assert.equal(items[8].unit, '');
  assert.equal(items[8].hasWarning, true);
  assert.match(items[8].warningMessage ?? '', /quantity/i);

  // 10. Colgate Paste - (trailing dash stripped, missing quantity remains blank)
  assert.equal(items[9].name, 'Colgate Paste');
  assert.equal(items[9].quantity, '');
  assert.equal(items[9].unit, '');
  assert.equal(items[9].hasWarning, true);

  // 11. Eggs - 1 dozen
  assert.equal(items[10].name, 'Eggs');
  assert.equal(items[10].quantity, 1);
  assert.equal(items[10].unit, 'dozen');

  // 12. Tamil: சர்க்கரை - 3 கிலோ
  assert.equal(items[11].name, 'சர்க்கரை');
  assert.equal(items[11].quantity, 3);
  assert.equal(items[11].unit, 'kg');

  // 13. Mixed: துவரம் பருப்பு 5 kg
  assert.equal(items[12].name, 'துவரம் பருப்பு');
  assert.equal(items[12].quantity, 5);
  assert.equal(items[12].unit, 'kg');
});

test('rejects unauthenticated extraction requests before processing images', async () => {
  let extractCalled = false;
  const router = createOcrRouter({
    extract: async () => {
      extractCalled = true;
      return [];
    },
  });

  await withOcrServer(router, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/ocr/extract`, {
      method: 'POST',
      body: createImageForm(),
    });
    assert.equal(response.status, 401);
    assert.equal(extractCalled, false);
  });
});

test('rejects invalid image content and file types without calling OCR', async () => {
  let extractCalled = false;
  const router = createOcrRouter({
    authenticate: authenticatedUser,
    extract: async () => {
      extractCalled = true;
      return [];
    },
  });

  test('enforces the 10 MB upload limit', async () => {
    const router = createOcrRouter({
      authenticate: authenticatedUser,
      extract: async () => [],
    });
    const oversizedBytes = new Uint8Array(10 * 1024 * 1024 + 1);
    oversizedBytes.set(VALID_PNG_BYTES);

    await withOcrServer(router, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/ocr/extract`, {
        method: 'POST',
        body: createImageForm(oversizedBytes),
      });
      assert.equal(response.status, 413);
    });
  });

  await withOcrServer(router, async (baseUrl) => {
    const badSignature = await fetch(`${baseUrl}/api/ocr/extract`, {
      method: 'POST',
      body: createImageForm(Uint8Array.from([1, 2, 3])),
    });
    assert.equal(badSignature.status, 415);

    const unsupportedType = await fetch(`${baseUrl}/api/ocr/extract`, {
      method: 'POST',
      body: createImageForm(Uint8Array.from([1, 2, 3]), 'text/plain'),
    });
    assert.equal(unsupportedType.status, 415);
    assert.equal(extractCalled, false);
  });
});

test('accepts one authenticated image and returns the extracted rows', async () => {
  let extractedMimeType = '';
  const router = createOcrRouter({
    authenticate: authenticatedUser,
    extract: async (_image, mimeType) => {
      extractedMimeType = mimeType;
      return [{
        id: 'test-item',
        name: 'Rice',
        originalText: 'அரிசி',
        quantity: 10,
        unit: 'kg',
        unitPrice: 0,
        total: 0,
        confidence: 0.9,
        hasWarning: false,
      }];
    },
  });

  await withOcrServer(router, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/ocr/extract`, {
      method: 'POST',
      body: createImageForm(),
    });
    const data = await response.json() as { success: boolean; items: Array<{ name: string }> };
    assert.equal(response.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.items[0].name, 'Rice');
    assert.equal(extractedMimeType, 'image/png');
  });
});

test('limits each authenticated user to ten image requests per minute', async () => {
  const router = createOcrRouter({
    authenticate: authenticatedUser,
    extract: async () => [],
  });

  await withOcrServer(router, async (baseUrl) => {
    const statuses: number[] = [];
    for (let index = 0; index < 11; index += 1) {
      const response = await fetch(`${baseUrl}/api/ocr/extract`, {
        method: 'POST',
        body: createImageForm(),
      });
      statuses.push(response.status);
    }

    assert.equal(statuses.slice(0, 10).every((status) => status === 200), true);
    assert.equal(statuses[10], 429);
  });
});

test('retries transient 503/429 responses and falls back to GEMINI_FALLBACK_MODEL when primary model fails', async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;
  const originalFallback = process.env.GEMINI_FALLBACK_MODEL;
  const originalFetch = globalThis.fetch;

  process.env.GEMINI_API_KEY = 'test-key-not-a-secret';
  process.env.GEMINI_MODEL = 'gemini-3.8-flash';
  process.env.GEMINI_FALLBACK_MODEL = 'gemini-3.5-flash-lite';

  const calledUrls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    calledUrls.push(url);

    // Primary model returns 503 on both attempts (initial + 1 retry)
    if (url.includes('gemini-3.8-flash')) {
      return new Response(
        JSON.stringify({
          error: { code: 503, message: 'High demand', status: 'UNAVAILABLE' },
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fallback model succeeds
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    documentType: 'handwritten_grocery_order',
                    items: [
                      {
                        name: 'Turmeric Powder',
                        originalText: 'மஞ்சள் தூள் - 2 kg',
                        quantity: 2,
                        unit: 'kg',
                        confidence: 0.95,
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  try {
    const items = await extractOrderItems(Buffer.from(VALID_PNG_BYTES), 'image/png', {
      maxRetries: 1,
      baseDelayMs: 5,
      fallbackModel: 'gemini-3.5-flash-lite',
    });

    assert.equal(calledUrls.length, 3);
    assert.ok(calledUrls[0].includes('gemini-3.8-flash'));
    assert.ok(calledUrls[1].includes('gemini-3.8-flash'));
    assert.ok(calledUrls[2].includes('gemini-3.5-flash-lite'));
    assert.equal(items.length, 1);
    assert.equal(items[0].name, 'Turmeric Powder');
    assert.equal(items[0].quantity, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = originalModel;
    if (originalFallback === undefined) delete process.env.GEMINI_FALLBACK_MODEL;
    else process.env.GEMINI_FALLBACK_MODEL = originalFallback;
  }
});

test('deduplicates identical OCR image requests within the cache window to avoid duplicate API calls', async () => {
  let extractCount = 0;
  const router = createOcrRouter({
    authenticate: authenticatedUser,
    deduplicateTtlMs: 10_000,
    extract: async () => {
      extractCount += 1;
      return [
        {
          id: 'item-orig',
          name: 'Sugar',
          originalText: 'சர்க்கரை 5 kg',
          quantity: 5,
          unit: 'kg',
          unitPrice: 45,
          total: 225,
          confidence: 0.98,
          hasWarning: false,
        },
      ];
    },
  });

  await withOcrServer(router, async (baseUrl) => {
    const res1 = await fetch(`${baseUrl}/api/ocr/extract`, {
      method: 'POST',
      body: createImageForm(),
    });
    const res2 = await fetch(`${baseUrl}/api/ocr/extract`, {
      method: 'POST',
      body: createImageForm(),
    });

    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);
    assert.equal(extractCount, 1, 'Underlying OCR provider should only be called once for duplicate image');
  });
});

test('rejects unverified email or unconfirmed account linking on /api/ocr/extract with 403', async () => {
  let extractCalled = false;
  const unverifiedAuth: RequestHandler = (_req, res, next) => {
    res.locals.user = {
      id: 'unverified-user',
      uid: 'unverified-uid',
      email: 'unverified@example.com',
      emailVerified: false,
      internalUserId: 'internal-unverified',
      linkingStatus: 'LINKED',
    };
    next();
  };

  const router = createOcrRouter({
    authenticate: unverifiedAuth,
    extract: async () => {
      extractCalled = true;
      return [];
    },
  });

  await withOcrServer(router, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/ocr/extract`, {
      method: 'POST',
      body: createImageForm(),
    });
    assert.equal(response.status, 403);
    assert.equal(extractCalled, false);
  });
});

// ---------------------------------------------------------------------------
// OCR reliability: timeouts, fallback, circuit breaker, async jobs
// ---------------------------------------------------------------------------

function geminiSuccessResponse(name = 'Toor Dal', originalText = 'துவரம் பருப்பு 5 kg'): Response {
  return new Response(
    JSON.stringify({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              documentType: 'handwritten_grocery_order',
              items: [{ name, originalText, quantity: 5, unit: 'kg', confidence: 0.95 }],
            }),
          }],
        },
      }],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

/** A fetch that never resolves until its AbortSignal fires (simulates a stalled model). */
function hangingFetch(init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    });
  });
}

async function withGeminiEnv(run: () => Promise<void>): Promise<void> {
  const saved = {
    key: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
    fallback: process.env.GEMINI_FALLBACK_MODEL,
  };
  const originalFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = 'test-key-not-a-secret';
  process.env.GEMINI_MODEL = 'gemini-3.8-flash';
  process.env.GEMINI_FALLBACK_MODEL = 'gemini-3.5-flash-lite';
  resetOcrModelHealth();
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    resetOcrModelHealth();
    for (const [envName, value] of [
      ['GEMINI_API_KEY', saved.key],
      ['GEMINI_MODEL', saved.model],
      ['GEMINI_FALLBACK_MODEL', saved.fallback],
    ] as const) {
      if (value === undefined) delete process.env[envName];
      else process.env[envName] = value;
    }
  }
}

test('slow Gemini response within the fallback budget succeeds instead of timing out', async () => {
  await withGeminiEnv(async () => {
    const calledUrls: string[] = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      calledUrls.push(url);
      if (url.includes('gemini-3.8-flash')) return hangingFetch(init);
      // Fallback is slow (300 ms) but well within its own timeout.
      await new Promise((resolve) => setTimeout(resolve, 300));
      return geminiSuccessResponse();
    };

    const stages: string[] = [];
    const items = await extractOrderItems(Buffer.from(VALID_PNG_BYTES), 'image/png', {
      primaryTimeoutMs: 100,
      fallbackTimeoutMs: 2_000,
      baseDelayMs: 1,
      onStage: (stage) => stages.push(stage),
    });

    assert.equal(items.length, 1);
    assert.equal(items[0].originalText, 'துவரம் பருப்பு 5 kg');
    // A timed-out primary is not retried; it switches straight to the backup model.
    assert.equal(calledUrls.filter((url) => url.includes('gemini-3.8-flash')).length, 1);
    assert.equal(calledUrls.filter((url) => url.includes('gemini-3.5-flash-lite')).length, 1);
    assert.deepEqual(stages, [
      'reading_handwriting',
      'switching_to_backup',
      'extracting_products',
      'validating_results',
    ]);
  });
});

test('a failing primary model is bypassed during cooldown so later images go straight to the fallback', async () => {
  await withGeminiEnv(async () => {
    const calledUrls: string[] = [];
    globalThis.fetch = async (input) => {
      const url = String(input);
      calledUrls.push(url);
      if (url.includes('gemini-3.8-flash')) {
        return new Response('{"error":"busy"}', { status: 503 });
      }
      return geminiSuccessResponse();
    };

    await extractOrderItems(Buffer.from(VALID_PNG_BYTES), 'image/png', { baseDelayMs: 1 });
    assert.equal(calledUrls.length, 3, 'first image: 2 primary attempts + 1 fallback');
    assert.equal(isOcrModelCoolingDown('gemini-3.8-flash'), true);

    calledUrls.length = 0;
    await extractOrderItems(Buffer.from(VALID_PNG_BYTES), 'image/png', { baseDelayMs: 1 });
    assert.deepEqual(
      calledUrls.map((url) => (url.includes('gemini-3.8-flash') ? 'primary' : 'fallback')),
      ['fallback'],
      'second image must skip the degraded primary model entirely'
    );
  });
});

test('both models unavailable fails with a bounded number of attempts and a sanitized message', async () => {
  await withGeminiEnv(async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return new Response('internal provider detail: quota project 1234', { status: 503 });
    };

    await assert.rejects(
      extractOrderItems(Buffer.from(VALID_PNG_BYTES), 'image/png', { baseDelayMs: 1 }),
      (error: unknown) =>
        error instanceof OcrProviderError &&
        error.statusCode === 503 &&
        /temporarily busy/i.test(error.message) &&
        !error.message.includes('quota') &&
        !error.message.includes('1234')
    );
    assert.equal(calls, 4, '2 primary attempts + 2 fallback attempts, then stop');
  });
});

test('both models timing out returns 504 within the total budget', async () => {
  await withGeminiEnv(async () => {
    let calls = 0;
    globalThis.fetch = async (_input, init) => {
      calls += 1;
      return hangingFetch(init);
    };

    const started = Date.now();
    await assert.rejects(
      extractOrderItems(Buffer.from(VALID_PNG_BYTES), 'image/png', {
        primaryTimeoutMs: 50,
        fallbackTimeoutMs: 50,
        baseDelayMs: 1,
        totalBudgetMs: 5_000,
      }),
      (error: unknown) =>
        error instanceof OcrProviderError &&
        error.statusCode === 504 &&
        /took too long/i.test(error.message)
    );
    assert.ok(Date.now() - started < 5_000);
    assert.equal(calls, 3, '1 primary (timeout → switch) + 2 fallback attempts');
  });
});

test('malformed model output is retried, but a 422 document rejection is never retried', async () => {
  await withGeminiEnv(async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"items": [' }] } }] }),
          { status: 200 }
        );
      }
      return geminiSuccessResponse('Sugar', 'சர்க்கரை 5 kg');
    };
    const items = await extractOrderItems(Buffer.from(VALID_PNG_BYTES), 'image/png', {
      baseDelayMs: 1,
    });
    assert.equal(calls, 2);
    assert.equal(items[0].name, 'Sugar');
  });

  await withGeminiEnv(async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          candidates: [{
            content: { parts: [{ text: JSON.stringify({ documentType: 'blank_image', items: [] }) }] },
          }],
        }),
        { status: 200 }
      );
    };
    await assert.rejects(
      extractOrderItems(Buffer.from(VALID_PNG_BYTES), 'image/png', { baseDelayMs: 1 }),
      (error: unknown) => error instanceof OcrProviderError && error.statusCode === 422
    );
    assert.equal(calls, 1, 'blank image must not be retried or sent to the fallback model');
  });
});

interface JobPayload {
  success: boolean;
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  stage: string;
  items?: Array<{ name: string; originalText: string }>;
  message?: string;
  retryable?: boolean;
  errorStatus?: number;
}

async function pollJob(baseUrl: string, jobId: string): Promise<JobPayload> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/ocr/jobs/${jobId}`);
    const payload = await response.json() as JobPayload;
    if (payload.status !== 'processing') return payload;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('job did not finish');
}

test('async OCR job: returns immediately, reports live stages, and completes with items', async () => {
  let releaseExtraction: () => void = () => {};
  const gate = new Promise<void>((resolve) => { releaseExtraction = resolve; });
  let extractCount = 0;

  const router = createOcrRouter({
    authenticate: authenticatedUser,
    extract: async (_image, _mime, options) => {
      extractCount += 1;
      options?.onStage?.('reading_handwriting');
      await gate;
      options?.onStage?.('validating_results');
      return [{
        id: 'job-item',
        name: 'Ponni Rice',
        originalText: 'பொன்னி அரிசி 2 மூட்டை',
        quantity: 2,
        unit: 'bag',
        unitPrice: 0,
        total: 0,
        confidence: 0.92,
        hasWarning: false,
      }];
    },
  });

  await withOcrServer(router, async (baseUrl) => {
    const created = await fetch(`${baseUrl}/api/ocr/jobs`, { method: 'POST', body: createImageForm() });
    assert.equal(created.status, 202);
    const createdBody = await created.json() as JobPayload;
    assert.equal(createdBody.status, 'processing');

    const midway = await (await fetch(`${baseUrl}/api/ocr/jobs/${createdBody.jobId}`)).json() as JobPayload;
    assert.equal(midway.status, 'processing');
    assert.equal(midway.stage, 'reading_handwriting');

    // Duplicate submission while processing joins the same job (no second Gemini call).
    const duplicate = await fetch(`${baseUrl}/api/ocr/jobs`, { method: 'POST', body: createImageForm() });
    const duplicateBody = await duplicate.json() as JobPayload;
    assert.equal(duplicateBody.jobId, createdBody.jobId);

    releaseExtraction();
    const finished = await pollJob(baseUrl, createdBody.jobId);
    assert.equal(finished.status, 'completed');
    assert.equal(finished.items?.[0].originalText, 'பொன்னி அரிசி 2 மூட்டை');
    assert.equal(extractCount, 1);

    // Retry after a dropped connection: same image returns the finished job instantly.
    const resubmitted = await fetch(`${baseUrl}/api/ocr/jobs`, { method: 'POST', body: createImageForm() });
    assert.equal(resubmitted.status, 200);
    const resubmittedBody = await resubmitted.json() as JobPayload;
    assert.equal(resubmittedBody.status, 'completed');
    assert.equal(extractCount, 1, 'completed results are reused, not re-billed');
  });
});

test('async OCR job: another user cannot read a job, and provider failures are reported safely', async () => {
  let currentUser = 'owner-a';
  const switchableAuth: RequestHandler = (_req, res, next) => {
    res.locals.user = {
      id: currentUser,
      uid: `${currentUser}-uid`,
      email: `${currentUser}@example.com`,
      emailVerified: true,
      internalUserId: currentUser,
      linkingStatus: 'LINKED',
    };
    next();
  };

  const router = createOcrRouter({
    authenticate: switchableAuth,
    extract: async () => {
      throw new OcrProviderError('The AI reading service is temporarily busy. Please try again in a moment.', 503);
    },
  });

  await withOcrServer(router, async (baseUrl) => {
    const created = await fetch(`${baseUrl}/api/ocr/jobs`, { method: 'POST', body: createImageForm() });
    const { jobId } = await created.json() as JobPayload;

    currentUser = 'owner-b';
    const foreign = await fetch(`${baseUrl}/api/ocr/jobs/${jobId}`);
    assert.equal(foreign.status, 404);

    currentUser = 'owner-a';
    const failed = await pollJob(baseUrl, jobId);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.errorStatus, 503);
    assert.equal(failed.retryable, true);
    assert.match(failed.message ?? '', /temporarily busy/i);

    // A failed job is not reused: retrying the same image starts a fresh attempt.
    const retried = await fetch(`${baseUrl}/api/ocr/jobs`, { method: 'POST', body: createImageForm() });
    const retriedBody = await retried.json() as JobPayload;
    assert.notEqual(retriedBody.jobId, jobId);
  });
});

test('cached duplicate uploads do not consume the per-user Gemini rate limit', async () => {
  let extractCount = 0;
  const router = createOcrRouter({
    authenticate: authenticatedUser,
    extract: async () => {
      extractCount += 1;
      return [{
        id: 'cached-item',
        name: 'Salt',
        originalText: 'உப்பு 1 kg',
        quantity: 1,
        unit: 'kg',
        unitPrice: 0,
        total: 0,
        confidence: 0.9,
        hasWarning: false,
      }];
    },
  });

  await withOcrServer(router, async (baseUrl) => {
    const statuses: number[] = [];
    for (let index = 0; index < 12; index += 1) {
      const response = await fetch(`${baseUrl}/api/ocr/extract`, { method: 'POST', body: createImageForm() });
      statuses.push(response.status);
    }
    assert.equal(statuses.every((status) => status === 200), true);
    assert.equal(extractCount, 1);
  });
});
