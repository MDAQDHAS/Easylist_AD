import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSXModule from 'xlsx-js-style';
import { OrderItem } from '../types/order';

const XLSX = (
  (XLSXModule as unknown as { default?: typeof XLSXModule }).default || XLSXModule
) as typeof XLSXModule;
import {
  applyItemUpdate,
  calculateOrderGrandTotal,
  createNewOrderItem,
  evaluateItemWarnings,
  normalizeOcrItemsToEnglish,
  parsePositiveQuantity,
  sanitizeMoney,
  toggleItemsLanguage,
} from '../context/OrderWorkflowContext';
import { exportService, normalizeExportData } from './exportService';
import { ocrService, validateUploadFile, ScanProgressUpdate } from './ocrService';
import { apiClient } from './api/client';
import { ApiError } from './api/error';

function createInitialOcrItems(): OrderItem[] {
  return [
    {
      id: 'item-1',
      name: 'Toor Dal',
      originalText: '1) Toor Dal - 10 kg @ 140',
      quantity: 10,
      unit: 'kg',
      unitPrice: 140,
      total: 1400,
      confidence: 0.99,
      hasWarning: false,
    },
    {
      id: 'item-2',
      name: 'Ponni Rice',
      originalText: '2. பொன்னி அரிசி - 1 மூட்டை = 1450',
      quantity: 1,
      unit: 'bag',
      unitPrice: 1450,
      total: 1450,
      confidence: 0.99,
      hasWarning: false,
    },
    {
      id: 'item-3',
      name: 'Sunflower Oil',
      originalText: '3) Sunflower Oil - 5 ltr',
      quantity: 5,
      unit: 'ltr',
      unitPrice: 0,
      total: 0,
      confidence: 0.99,
      hasWarning: false,
    },
    {
      id: 'item-4',
      name: 'Dry Chilli (மிளகாய் வத்தல்)',
      originalText: '5) மிளகாய் வத்தல்',
      quantity: '',
      unit: '',
      unitPrice: 0,
      total: 0,
      confidence: 0.99,
      hasWarning: true,
      warningMessage: 'Verify the quantity. Select or verify the unit',
    },
  ];
}

test('edits product name, quantity, unit, unitPrice, and total while preserving originalText and recalculating totals', () => {
  let items = createInitialOcrItems();

  // Initial grand total: 1400 + 1450 + 0 + 0 = 2850
  assert.equal(calculateOrderGrandTotal(items), 2850);

  // 1. Edit Item 1 quantity from 10 to 12 -> line total recalculates to 12 * 140 = 1680
  items = items.map((item) =>
    item.id === 'item-1' ? applyItemUpdate(item, { quantity: 12 }) : item
  );
  assert.equal(items[0].quantity, 12);
  assert.equal(items[0].total, 1680);
  assert.equal(items[0].originalText, '1) Toor Dal - 10 kg @ 140');
  assert.equal(calculateOrderGrandTotal(items), 3130);

  // 2. Edit Item 1 product name -> preserves originalText
  items = items.map((item) =>
    item.id === 'item-1'
      ? applyItemUpdate(item, { name: 'Premium Toor Dal (துவரம் பருப்பு)' })
      : item
  );
  assert.equal(items[0].name, 'Premium Toor Dal (துவரம் பருப்பு)');
  assert.equal(items[0].originalText, '1) Toor Dal - 10 kg @ 140');

  // 3. Edit Item 3 unitPrice from 0 to 155 -> line total recalculates to 5 * 155 = 775
  items = items.map((item) =>
    item.id === 'item-3' ? applyItemUpdate(item, { unitPrice: 155 }) : item
  );
  assert.equal(items[2].unitPrice, 155);
  assert.equal(items[2].total, 775);
  assert.equal(calculateOrderGrandTotal(items), 3905);

  // 4. Complete missing quantity & unit on Item 4 without entering a price -> warning clears, price remains 0 (not invented)
  items = items.map((item) =>
    item.id === 'item-4'
      ? applyItemUpdate(item, { quantity: 3, unit: 'kg' })
      : item
  );
  assert.equal(items[3].quantity, 3);
  assert.equal(items[3].unit, 'kg');
  assert.equal(items[3].unitPrice, 0);
  assert.equal(items[3].total, 0);
  assert.equal(items[3].hasWarning, false);
  assert.equal(items[3].warningMessage, undefined);
});

test('never invents missing quantities or prices and highlights missing or mismatched fields', () => {
  // Blank new item created with no arguments (or with a simulated click event)
  const simulatedClickEvent = { nativeEvent: {}, target: {} } as unknown as Partial<OrderItem>;
  const blankItem = createNewOrderItem(simulatedClickEvent);

  assert.equal(blankItem.name, '');
  assert.equal(blankItem.quantity, '');
  assert.equal(blankItem.unit, '');
  assert.equal(blankItem.unitPrice, 0);
  assert.equal(blankItem.total, 0);
  assert.equal(blankItem.hasWarning, true);
  assert.match(String(blankItem.warningMessage), /Verify the product name/);
  assert.match(String(blankItem.warningMessage), /Verify the quantity/);
  assert.match(String(blankItem.warningMessage), /Select or verify the unit/);

  // Arithmetic mismatch when user overrides total to disagree with quantity * unitPrice
  const mismatchItem = applyItemUpdate(
    {
      id: 'item-m',
      name: 'Sugar',
      quantity: 10,
      unit: 'kg',
      unitPrice: 45,
      total: 450,
    },
    { total: 400 }
  );
  assert.equal(mismatchItem.hasWarning, true);
  assert.match(String(mismatchItem.warningMessage), /does not match/);
});

test('handles invalid numeric inputs and cleared values safely without stale line totals', () => {
  const base: OrderItem = {
    id: 'item-num',
    name: 'Mustard Seeds (கடுகு)',
    originalText: '4. கடுகு - 250 கிராம்',
    quantity: 4,
    unit: 'kg',
    unitPrice: 120,
    total: 480,
    hasWarning: false,
  };

  // Clearing quantity resets line total to 0 and flags warning
  const clearedQty = applyItemUpdate(base, { quantity: '' });
  assert.equal(clearedQty.quantity, '');
  assert.equal(clearedQty.total, 0);
  assert.equal(clearedQty.hasWarning, true);

  // Entering non-numeric quantity ("abc") sets line total to 0 and flags warning
  const invalidQty = applyItemUpdate(base, { quantity: 'abc' });
  assert.equal(invalidQty.total, 0);
  assert.equal(invalidQty.hasWarning, true);

  // Entering negative quantity (-5) sets line total to 0 and flags warning
  const negativeQty = applyItemUpdate(base, { quantity: -5 });
  assert.equal(negativeQty.quantity, '');
  assert.equal(negativeQty.total, 0);
  assert.equal(negativeQty.hasWarning, true);

  // Entering negative or NaN unitPrice clamps unitPrice to 0 and resets total to 0
  const negativePrice = applyItemUpdate(base, { unitPrice: -99 });
  assert.equal(negativePrice.unitPrice, 0);
  assert.equal(negativePrice.total, 0);

  const nanPrice = applyItemUpdate(base, { unitPrice: Number.NaN });
  assert.equal(nanPrice.unitPrice, 0);
  assert.equal(nanPrice.total, 0);

  assert.equal(parsePositiveQuantity(''), null);
  assert.equal(parsePositiveQuantity('   '), null);
  assert.equal(parsePositiveQuantity(0), null);
  assert.equal(parsePositiveQuantity(-3), null);
  assert.equal(parsePositiveQuantity('2.5'), 2.5);
  assert.equal(sanitizeMoney('-10'), 0);
  assert.equal(sanitizeMoney('abc'), 0);
  assert.equal(sanitizeMoney('140.556'), 140.56);
});

test('toggles between normalized name and original handwritten text without overwriting originalText', () => {
  const initial = createInitialOcrItems();
  const shownOriginal = toggleItemsLanguage(initial, true);

  assert.equal(shownOriginal[0].name, '1) Toor Dal - 10 kg @ 140');
  assert.equal(shownOriginal[0].originalText, '1) Toor Dal - 10 kg @ 140');
  assert.equal(shownOriginal[1].name, '2. பொன்னி அரிசி - 1 மூட்டை = 1450');
  assert.equal(shownOriginal[1].originalText, '2. பொன்னி அரிசி - 1 மூட்டை = 1450');

  const restoredNormalized = toggleItemsLanguage(shownOriginal, false);
  assert.equal(restoredNormalized[0].name, 'Toor Dal');
  assert.equal(restoredNormalized[0].originalText, '1) Toor Dal - 10 kg @ 140');
  assert.equal(restoredNormalized[1].name, 'Ponni Rice');
  assert.equal(restoredNormalized[1].originalText, '2. பொன்னி அரிசி - 1 மூட்டை = 1450');
});

test('rejects exporting empty orders across PDF, XLSX, and CSV', () => {
  assert.throws(
    () => exportService.exportToCsv({ items: [], storeName: 'Test Shop' }),
    /Cannot export an empty order/
  );
  assert.throws(
    () => exportService.exportToExcel({ items: [], storeName: 'Test Shop' }),
    /Cannot export an empty order/
  );
  assert.throws(
    () => exportService.exportToPdf({ items: [], storeName: 'Test Shop' }),
    /Cannot export an empty order/
  );
  assert.throws(
    () =>
      exportService.exportToCsv({
        items: [
          {
            id: 'blank-1',
            name: '   ',
            quantity: '',
            unit: '',
            unitPrice: 0,
            total: 0,
          },
        ],
        storeName: 'Test Shop',
      }),
    /Cannot export an empty order/
  );
});

test('exports edited order to CSV, XLSX, and PDF and verifies actual exported file contents', () => {
  let items = createInitialOcrItems();

  // Apply realistic user edits on the Review page:
  // - Edit Item 1 (Toor Dal): quantity 10 -> 12 (total becomes 1680)
  // - Edit Item 2 (Ponni Rice): name -> 'Ponni Boiled Rice (பொன்னி அரிசி)' (total stays 1450)
  // - Leave Item 3 (Sunflower Oil) unpriced (unitPrice = 0, total = 0)
  // - Fix Item 4 (Dry Chilli): set quantity = 2, unit = 'kg', unitPrice = 210 (total becomes 420)
  items = items.map((item) => {
    if (item.id === 'item-1') return applyItemUpdate(item, { quantity: 12 });
    if (item.id === 'item-2') {
      return applyItemUpdate(item, { name: 'Ponni Boiled Rice (பொன்னி அரிசி)' });
    }
    if (item.id === 'item-4') {
      return applyItemUpdate(item, { quantity: 2, unit: 'kg', unitPrice: 210 });
    }
    return item;
  });

  const expectedGrandTotal = 1680 + 1450 + 0 + 420; // 3550
  assert.equal(calculateOrderGrandTotal(items), expectedGrandTotal);

  const exportPayload = {
    items,
    storeName: 'Sri Murugan Wholesale Mart',
    date: '31 Oct 2026',
    storePhone: '+91 98765 43210',
  };

  // 1. Verify CSV Export Content (Strict 5 fields: S.No., Product Name, Original Handwritten Text, Quantity, Unit)
  const csvContent = exportService.exportToCsv(exportPayload);
  assert.ok(csvContent.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');
  const csvLines = csvContent.slice(1).split('\r\n');
  assert.equal(
    csvLines[0],
    'S.No.,Product Name,Original Handwritten Text,Quantity,Unit'
  );
  assert.equal(
    csvLines[1],
    '1,Toor Dal,1) Toor Dal - 10 kg @ 140,12,kg'
  );
  assert.equal(
    csvLines[2],
    '2,Ponni Boiled Rice (பொன்னி அரிசி),2. பொன்னி அரிசி - 1 மூட்டை = 1450,1,bag'
  );
  assert.equal(
    csvLines[3],
    '3,Sunflower Oil,3) Sunflower Oil - 5 ltr,5,ltr'
  );
  assert.equal(
    csvLines[4],
    '4,Dry Chilli (மிளகாய் வத்தல்),5) மிளகாய் வத்தல்,2,kg'
  );
  assert.equal(csvLines[5], ',Total Products,,4,items');
  assert.ok(!csvContent.includes('Unit Price'), 'CSV must not contain Unit Price');
  assert.ok(!csvContent.includes('Line Total'), 'CSV must not contain Line Total');
  assert.ok(!csvContent.includes('Grand Total'), 'CSV must not contain Grand Total');

  // 2. Verify XLSX Export Workbook Binary & Cells (Strict 5 columns A-E, no pricing columns)
  const xlsxBytes = exportService.exportToExcel(exportPayload);
  assert.ok(xlsxBytes.byteLength > 1000, 'XLSX buffer must be non-empty');
  assert.equal(xlsxBytes[0], 0x50); // 'P'
  assert.equal(xlsxBytes[1], 0x4b); // 'K'

  const parsedWb = XLSX.read(xlsxBytes, { type: 'array' });
  assert.ok(parsedWb.SheetNames.includes('Order_List'));
  const ws = parsedWb.Sheets['Order_List'];

  assert.equal(ws['B2']?.v, 'Sri Murugan Wholesale Mart');
  assert.equal(ws['B3']?.v, '31 Oct 2026');
  assert.equal(ws['B4']?.v, '4 products');
  assert.equal(ws['F4'], undefined, 'No Grand Total cell in header');
  assert.equal(ws['G4'], undefined, 'No Grand Total value in header');

  // Row 6: Table Headers (S.No., Product Name, Original Handwritten Text, Quantity, Unit)
  assert.equal(ws['A6']?.v, 'S.No.');
  assert.equal(ws['B6']?.v, 'Product Name');
  assert.equal(ws['C6']?.v, 'Original Handwritten Text');
  assert.equal(ws['D6']?.v, 'Quantity');
  assert.equal(ws['E6']?.v, 'Unit');
  assert.equal(ws['F6'], undefined, 'No Unit Price column');
  assert.equal(ws['G6'], undefined, 'No Line Total column');

  // Row 7: Item 1 (Toor Dal, qty 12, unit kg)
  assert.equal(ws['A7']?.v, 1);
  assert.equal(ws['B7']?.v, 'Toor Dal');
  assert.equal(ws['C7']?.v, '1) Toor Dal - 10 kg @ 140');
  assert.equal(ws['D7']?.v, 12);
  assert.equal(ws['E7']?.v, 'kg');
  assert.equal(ws['F7'], undefined, 'No price cell in Row 7');
  assert.equal(ws['G7'], undefined, 'No line total in Row 7');

  // Row 8: Item 2 (Tamil Unicode product name & original text)
  assert.equal(ws['A8']?.v, 2);
  assert.equal(ws['B8']?.v, 'Ponni Boiled Rice (பொன்னி அரிசி)');
  assert.equal(ws['C8']?.v, '2. பொன்னி அரிசி - 1 மூட்டை = 1450');
  assert.equal(ws['D8']?.v, 1);
  assert.equal(ws['E8']?.v, 'bag');

  // Row 9: Item 3 (Sunflower Oil, unpriced)
  assert.equal(ws['A9']?.v, 3);
  assert.equal(ws['B9']?.v, 'Sunflower Oil');
  assert.equal(ws['D9']?.v, 5);
  assert.equal(ws['E9']?.v, 'ltr');

  // Row 10: Item 4 (Dry Chilli edited -> qty 2, unit kg)
  assert.equal(ws['A10']?.v, 4);
  assert.equal(ws['B10']?.v, 'Dry Chilli (மிளகாய் வத்தல்)');
  assert.equal(ws['C10']?.v, '5) மிளகாய் வத்தல்');
  assert.equal(ws['D10']?.v, 2);
  assert.equal(ws['E10']?.v, 'kg');

  // Row 11: Summary row (Total Products: 4 items, no grand total price)
  assert.equal(ws['B11']?.v, 'Total Products');
  assert.equal(ws['D11']?.v, 4);
  assert.equal(ws['E11']?.v, 'items');
  assert.equal(ws['F11'], undefined, 'No summary price label');
  assert.equal(ws['G11'], undefined, 'No summary price calculation');

  // 3. Verify TXT Export Content (No price fields)
  const txtContent = exportService.exportToTxt(exportPayload);
  assert.ok(txtContent.includes('EASYLIST ORDER'));
  assert.ok(txtContent.includes('Shop: Sri Murugan Wholesale Mart'));
  assert.ok(txtContent.includes('Total Items: 4'));
  assert.ok(txtContent.includes('1. Toor Dal | Handwritten: 1) Toor Dal - 10 kg @ 140 — 12 kg'));
  assert.ok(!txtContent.includes('Grand Total: ₹'), 'TXT must not contain Grand Total');
  assert.ok(!txtContent.includes('Rate: ₹'), 'TXT must not contain Rate/Unit Price');
  assert.ok(!txtContent.includes('Total: ₹'), 'TXT must not contain Line Total');

  // 4. Verify PDF Export Binary & Embedded Content (Price & Total removed, Tamil Unicode preserved)
  const pdfBytes = exportService.exportToPdf(exportPayload);
  assert.ok(pdfBytes.byteLength > 2000, 'PDF buffer must be non-empty');
  const pdfAscii = Buffer.from(pdfBytes).toString('latin1');
  const pdfUtf8 = Buffer.from(pdfBytes).toString('utf8');

  assert.ok(pdfAscii.startsWith('%PDF-1.3'), 'PDF must start with %PDF-1.3 header');
  assert.ok(pdfAscii.includes('%%EOF'), 'PDF must contain %%EOF marker');
  assert.ok(pdfAscii.includes('ToUnicode'), 'PDF must contain ToUnicode CMap for Unicode rendering');
  assert.ok(pdfAscii.includes('CIDFontType2'), 'PDF must embed TrueType CID font for Tamil support');

  // Verify Unit Price and Line Total columns are completely removed from PDF
  assert.ok(!pdfAscii.includes('Unit Price (Rs.)'), 'Unit Price column must be absent from PDF');
  assert.ok(!pdfAscii.includes('Line Total (Rs.)'), 'Line Total column must be absent from PDF');
  assert.ok(!pdfAscii.includes('Rs. 3550.00'), 'Monetary Grand Total must be absent from PDF presentation');

  // Verify UTF-8 manifest embedded in PDF preserves Tamil Unicode and exact edited fields
  const manifestMatch = pdfUtf8.match(/%EASYLIST_UTF8_MANIFEST:(.+)/);
  assert.ok(manifestMatch, 'PDF must contain lossless UTF-8 order manifest');
  const manifest = JSON.parse(manifestMatch[1]);
  assert.equal(manifest.storeName, 'Sri Murugan Wholesale Mart');
  assert.equal(manifest.items.length, 4);
  assert.equal(manifest.items[1].name, 'Ponni Boiled Rice (பொன்னி அரிசி)');
  assert.equal(manifest.items[1].originalText, '2. பொன்னி அரிசி - 1 மூட்டை = 1450');
  assert.equal(manifest.items[3].quantity, 2);
  assert.equal(manifest.items[3].total, 420);
});

test('validates uploaded image MIME type, size, magic header bytes, and image count before OCR API call', async () => {
  const validPngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const validFile = new File([validPngBytes], 'order.png', { type: 'image/png' });

  // Valid PNG passes
  await validateUploadFile(validFile);

  // 1. Unsupported MIME type rejected
  const textFile = new File(['hello'], 'notes.txt', { type: 'text/plain' });
  await assert.rejects(() => validateUploadFile(textFile), /not a supported image/i);

  // 2. Empty (0-byte) file rejected
  const emptyFile = new File([], 'empty.png', { type: 'image/png' });
  await assert.rejects(() => validateUploadFile(emptyFile), /empty \(0 bytes\)/i);

  // 3. Oversized (> 10 MB) file rejected
  const oversizedBytes = new Uint8Array(10 * 1024 * 1024 + 10);
  oversizedBytes.set(validPngBytes);
  const oversizedFile = new File([oversizedBytes], 'huge.png', { type: 'image/png' });
  await assert.rejects(() => validateUploadFile(oversizedFile), /exceeds the 10 MB size limit/i);

  // 4. Corrupt / spoofed magic bytes rejected
  const corruptPng = new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])], 'spoofed.png', {
    type: 'image/png',
  });
  await assert.rejects(() => validateUploadFile(corruptPng), /corrupted or is not a valid PNG/i);

  // 5. Image count boundaries (0 images and > 10 images) rejected
  await assert.rejects(() => ocrService.extractImages([]), /Choose between 1 and 10/);
  const elevenFiles = Array.from({ length: 11 }, (_, idx) =>
    new File([validPngBytes], `order-${idx + 1}.png`, { type: 'image/png' })
  );
  await assert.rejects(() => ocrService.extractImages(elevenFiles), /Choose between 1 and 10/);
});

test('ocrService handles async jobs with polling and reports live stage transitions', async () => {
  const originalPost = apiClient.post.bind(apiClient);
  const originalGet = apiClient.get.bind(apiClient);

  ocrService.clearImageCache();
  const validPngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const testFile = new File([validPngBytes], 'job-test-order.png', { type: 'image/png' });

  const progressUpdates: ScanProgressUpdate[] = [];
  let pollCount = 0;

  apiClient.post = (async (endpoint: string) => {
    if (endpoint === '/ocr/jobs') {
      return {
        success: true,
        jobId: 'job-stage-test',
        status: 'processing',
        stage: 'reading_handwriting',
      };
    }
    throw new Error(`Unexpected endpoint ${endpoint}`);
  }) as typeof apiClient.post;

  apiClient.get = (async (endpoint: string) => {
    if (endpoint === '/ocr/jobs/job-stage-test') {
      pollCount += 1;
      if (pollCount === 1) {
        return {
          success: true,
          jobId: 'job-stage-test',
          status: 'processing',
          stage: 'extracting_products',
        };
      }
      return {
        success: true,
        jobId: 'job-stage-test',
        status: 'completed',
        stage: 'completed',
        items: [
          {
            id: 'item-job-1',
            name: 'Toor Dal',
            originalText: 'துவரம் பருப்பு 5 kg',
            quantity: 5,
            unit: 'kg',
            unitPrice: 140,
            total: 700,
            confidence: 0.95,
            hasWarning: false,
          },
        ],
      };
    }
    throw new Error(`Unexpected GET ${endpoint}`);
  }) as typeof apiClient.get;

  try {
    const items = await ocrService.extractImages([testFile], (update) => {
      progressUpdates.push(update);
    });

    assert.equal(items.length, 1);
    assert.equal(items[0].name, 'Toor Dal');
    assert.ok(pollCount >= 2);
    assert.ok(progressUpdates.length >= 3);
    assert.ok(progressUpdates.some((p) => p.stageName === 'Uploading image'));
    assert.ok(progressUpdates.some((p) => p.stageName === 'Extracting products'));
    assert.ok(progressUpdates.some((p) => p.percent === 100));
  } finally {
    apiClient.post = originalPost;
    apiClient.get = originalGet;
    ocrService.clearImageCache();
  }
});

test('ocrService caches successfully extracted files in session memory to prevent re-extracting on retry', async () => {
  const originalPost = apiClient.post.bind(apiClient);
  const originalGet = apiClient.get.bind(apiClient);

  ocrService.clearImageCache();
  const validPngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const testFile = new File([validPngBytes], 'cache-test-order.png', { type: 'image/png' });

  let serverCallCount = 0;
  apiClient.post = (async () => {
    serverCallCount += 1;
    return {
      success: true,
      jobId: 'job-cache-1',
      status: 'completed',
      stage: 'completed',
      items: [
        {
          id: 'item-cache-1',
          name: 'Sugar',
          originalText: 'Sugar 5 kg',
          quantity: 5,
          unit: 'kg',
          unitPrice: 42,
          total: 210,
          confidence: 0.96,
          hasWarning: false,
        },
      ],
    };
  }) as typeof apiClient.post;

  try {
    const firstRun = await ocrService.extractImages([testFile]);
    assert.equal(firstRun.length, 1);
    assert.equal(serverCallCount, 1);

    // Second call with same file should hit memory cache immediately without calling server
    const secondRun = await ocrService.extractImages([testFile]);
    assert.equal(secondRun.length, 1);
    assert.equal(serverCallCount, 1, 'File should be returned from session cache without a second network call');

    // After clearing cache, next call should hit server again
    ocrService.clearImageCache();
    const thirdRun = await ocrService.extractImages([testFile]);
    assert.equal(thirdRun.length, 1);
    assert.equal(serverCallCount, 2, 'After clearing cache, server should be called again');
  } finally {
    apiClient.post = originalPost;
    apiClient.get = originalGet;
    ocrService.clearImageCache();
  }
});

test('ocrService recovers from transient network blips during polling', async () => {
  const originalPost = apiClient.post.bind(apiClient);
  const originalGet = apiClient.get.bind(apiClient);

  ocrService.clearImageCache();
  const validPngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const testFile = new File([validPngBytes], 'network-blip-order.png', { type: 'image/png' });

  let pollAttempts = 0;
  apiClient.post = (async () => ({
    success: true,
    jobId: 'job-blip-1',
    status: 'processing',
    stage: 'reading_handwriting',
  })) as typeof apiClient.post;

  apiClient.get = (async () => {
    pollAttempts += 1;
    if (pollAttempts === 1 || pollAttempts === 2) {
      // Simulate transient network drops
      throw new Error('fetch failed: network error');
    }
    return {
      success: true,
      jobId: 'job-blip-1',
      status: 'completed',
      stage: 'completed',
      items: [
        {
          id: 'item-blip-1',
          name: 'Rice',
          originalText: 'Rice 25 kg',
          quantity: 25,
          unit: 'kg',
          unitPrice: 1250,
          total: 1250,
          confidence: 0.99,
          hasWarning: false,
        },
      ],
    };
  }) as typeof apiClient.get;

  try {
    const items = await ocrService.extractImages([testFile]);
    assert.equal(items.length, 1);
    assert.equal(items[0].name, 'Rice');
    assert.equal(pollAttempts, 3, 'Should retry through network blips and succeed on recovery');
  } finally {
    apiClient.post = originalPost;
    apiClient.get = originalGet;
    ocrService.clearImageCache();
  }
});

test('ocrService extracts multiple images concurrently with capped concurrency = 2 and aggregate progress', async () => {
  const originalPost = apiClient.post.bind(apiClient);
  const originalGet = apiClient.get.bind(apiClient);

  ocrService.clearImageCache();
  const validPngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const files = [
    new File([validPngBytes], 'order-page-1.png', { type: 'image/png' }),
    new File([validPngBytes], 'order-page-2.png', { type: 'image/png' }),
    new File([validPngBytes], 'order-page-3.png', { type: 'image/png' }),
  ];

  let activeJobs = 0;
  let maxActiveJobs = 0;
  const progressCalls: ScanProgressUpdate[] = [];

  apiClient.post = (async (endpoint: string, body?: unknown) => {
    if (endpoint === '/ocr/jobs') {
      activeJobs += 1;
      if (activeJobs > maxActiveJobs) maxActiveJobs = activeJobs;
      const fileId = activeJobs;

      // Small async yield to observe concurrency
      await new Promise((resolve) => setTimeout(resolve, 20));

      activeJobs -= 1;
      return {
        success: true,
        jobId: `job-page-${fileId}`,
        status: 'completed',
        stage: 'completed',
        items: [
          {
            id: `item-page-${fileId}`,
            name: `Item from file ${fileId}`,
            originalText: `Item from file ${fileId}`,
            quantity: 1,
            unit: 'pcs',
            unitPrice: 100,
            total: 100,
            confidence: 0.95,
            hasWarning: false,
          },
        ],
      };
    }
    throw new Error(`Unexpected endpoint ${endpoint}`);
  }) as typeof apiClient.post;

  try {
    const items = await ocrService.extractImages(files, (update) => {
      progressCalls.push(update);
    });

    assert.equal(items.length, 3, 'Should extract items from all 3 files');
    assert.ok(maxActiveJobs <= 2, `Active jobs (${maxActiveJobs}) must not exceed concurrency limit of 2`);
    assert.ok(progressCalls.length >= 3, 'Should emit aggregated progress updates');
    assert.equal(progressCalls[progressCalls.length - 1].percent, 100);
  } finally {
    apiClient.post = originalPost;
    apiClient.get = originalGet;
    ocrService.clearImageCache();
  }
});

test('ocrService re-throws actionable server rejections (401, 403, 429) without swallowing or double-calling', async () => {
  const originalPost = apiClient.post.bind(apiClient);

  ocrService.clearImageCache();
  const validPngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const testFile = new File([validPngBytes], 'auth-error-order.png', { type: 'image/png' });

  let jobCalls = 0;
  let extractCalls = 0;

  apiClient.post = (async (endpoint: string) => {
    if (endpoint === '/ocr/jobs') {
      jobCalls += 1;
      throw ApiError.fromResponse(401, {
        success: false,
        message: 'Authentication token is required',
      });
    }
    if (endpoint === '/ocr/extract') {
      extractCalls += 1;
      throw new Error('Should not call /ocr/extract when /ocr/jobs failed with 401');
    }
    throw new Error(`Unexpected endpoint ${endpoint}`);
  }) as typeof apiClient.post;

  try {
    await assert.rejects(
      () => ocrService.extractImages([testFile]),
      (err: any) => {
        assert.equal(err.status, 401);
        assert.ok(err.message.includes('Authentication') || err.message.includes('sign in'));
        return true;
      }
    );
    assert.equal(jobCalls, 1);
    assert.equal(extractCalls, 0, 'Must NOT fall through to /ocr/extract on auth failure');
  } finally {
    apiClient.post = originalPost;
    ocrService.clearImageCache();
  }
});

test('ApiError.fromNetworkError distinguishes localhost server unreachable from offline', () => {
  const localhostErr = ApiError.fromNetworkError(new Error('Failed to fetch'), 'http://localhost:8000/api/ocr/jobs');
  assert.ok(localhostErr.message.includes('http://localhost:8000'), 'Should identify localhost server origin');
  assert.ok(localhostErr.message.includes('backend server is running'), 'Should advise checking if backend is running');

  const remoteErr = ApiError.fromNetworkError(new Error('Failed to fetch'), 'https://api.easylist.com/api/ocr/jobs');
  assert.ok(remoteErr.message.includes('api.easylist.com'), 'Should name remote host');

  const genericErr = ApiError.fromNetworkError(new Error('Failed to fetch'));
  assert.ok(genericErr.message.includes('EasyList server'), 'Generic fetch failure identifies EasyList server');
});

test('extracted items preserve underlying unitPrice and line total calculations for downstream exports without price UI', () => {
  const item = createNewOrderItem();
  assert.equal(item.unitPrice, 0);
  assert.equal(item.total, 0);

  // Updating name, quantity, and unit retains numeric total calculation
  const updated = applyItemUpdate(item, {
    name: 'Toor Dal / துவரம் பருப்பு',
    quantity: '5',
    unit: 'kg',
  });

  assert.equal(updated.name, 'Toor Dal / துவரம் பருப்பு');
  assert.equal(updated.quantity, 5);
  assert.equal(updated.unit, 'kg');
  assert.equal(updated.unitPrice, 0);
  assert.equal(updated.total, 0);

  // Grand total calculates cleanly with unpriced items
  const grandTotal = calculateOrderGrandTotal([updated]);
  assert.equal(grandTotal, 0);
});

test('PDF export: English order without pricing columns and monetary grand total', () => {
  const englishOrder = {
    storeName: 'Sunrise Supermarket',
    items: [
      {
        id: 'en-1',
        name: 'Wheat Flour',
        originalText: '1. Wheat Flour - 10 kg',
        quantity: 10,
        unit: 'kg' as const,
        unitPrice: 45,
        total: 450,
        confidence: 0.99,
        hasWarning: false,
      },
      {
        id: 'en-2',
        name: 'Refined Sugar',
        originalText: '2. Sugar - 5 kg',
        quantity: 5,
        unit: 'kg' as const,
        unitPrice: 42,
        total: 210,
        confidence: 0.99,
        hasWarning: false,
      },
    ],
  };

  const pdfBytes = exportService.exportToPdf(englishOrder);
  assert.ok(pdfBytes.byteLength > 2000);
  const pdfAscii = Buffer.from(pdfBytes).toString('latin1');
  const pdfUtf8 = Buffer.from(pdfBytes).toString('utf8');

  // Must not contain Price or Total columns
  assert.ok(!pdfAscii.includes('Unit Price (Rs.)'));
  assert.ok(!pdfAscii.includes('Line Total (Rs.)'));
  assert.ok(!pdfAscii.includes('Grand Total: Rs.'));

  // Must contain item count and manifest
  const manifestMatch = pdfUtf8.match(/%EASYLIST_UTF8_MANIFEST:(.+)/);
  assert.ok(manifestMatch);
  const manifest = JSON.parse(manifestMatch[1]);
  assert.equal(manifest.items.length, 2);
  assert.equal(manifest.items[0].name, 'Wheat Flour');
  assert.equal(manifest.items[0].originalText, '1. Wheat Flour - 10 kg');
});

test('PDF export: pure Tamil order preserves authentic Tamil Unicode characters and originalText', () => {
  const tamilOrder = {
    storeName: 'ஸ்ரீ மீனாட்சி ஸ்டோர்ஸ்',
    items: [
      {
        id: 'ta-1',
        name: 'துவரம் பருப்பு',
        originalText: '1. துவரம் பருப்பு 10 கிலோ',
        quantity: 10,
        unit: 'kg' as const,
        unitPrice: 150,
        total: 1500,
        confidence: 0.98,
        hasWarning: false,
      },
      {
        id: 'ta-2',
        name: 'பொன்னி புழுங்கல் அரிசி',
        originalText: '2. பொன்னி அரிசி 1 மூட்டை',
        quantity: 1,
        unit: 'bag' as const,
        unitPrice: 1400,
        total: 1400,
        confidence: 0.99,
        hasWarning: false,
      },
    ],
  };

  const pdfBytes = exportService.exportToPdf(tamilOrder);
  assert.ok(pdfBytes.byteLength > 2000);
  const pdfAscii = Buffer.from(pdfBytes).toString('latin1');
  const pdfUtf8 = Buffer.from(pdfBytes).toString('utf8');

  // Verify CID font and ToUnicode CMap are present
  assert.ok(pdfAscii.includes('ToUnicode'));
  assert.ok(pdfAscii.includes('CIDFontType2'));

  // Ensure no corrupted Latin-1 characters like "¤ μ ¤ ¦"
  assert.ok(!pdfUtf8.includes('¤ μ ¤ ¦'));

  // Verify exact Tamil strings preserved in manifest
  const manifestMatch = pdfUtf8.match(/%EASYLIST_UTF8_MANIFEST:(.+)/);
  assert.ok(manifestMatch);
  const manifest = JSON.parse(manifestMatch[1]);
  assert.equal(manifest.storeName, 'ஸ்ரீ மீனாட்சி ஸ்டோர்ஸ்');
  assert.equal(manifest.items[0].name, 'துவரம் பருப்பு');
  assert.equal(manifest.items[0].originalText, '1. துவரம் பருப்பு 10 கிலோ');
  assert.equal(manifest.items[1].name, 'பொன்னி புழுங்கல் அரிசி');
  assert.equal(manifest.items[1].originalText, '2. பொன்னி அரிசி 1 மூட்டை');
});

test('PDF export: mixed Tamil-English order renders correctly without pricing columns', () => {
  const mixedOrder = {
    storeName: 'Saravana Maligai (சரவண மளிகை)',
    items: [
      {
        id: 'mix-1',
        name: 'Toor Dal (துவரம் பருப்பு)',
        originalText: '1) துவரம் பருப்பு - 5 kg @ 140',
        quantity: 5,
        unit: 'kg' as const,
        unitPrice: 140,
        total: 700,
        confidence: 0.95,
        hasWarning: false,
      },
      {
        id: 'mix-2',
        name: 'Sunflower Oil (சூரியகாந்தி எண்ணெய்)',
        originalText: '2) Sunflower Oil 2 ltr',
        quantity: 2,
        unit: 'ltr' as const,
        unitPrice: 160,
        total: 320,
        confidence: 0.97,
        hasWarning: false,
      },
    ],
  };

  const pdfBytes = exportService.exportToPdf(mixedOrder);
  assert.ok(pdfBytes.byteLength > 2000);
  const pdfAscii = Buffer.from(pdfBytes).toString('latin1');

  // Verify columns removed
  assert.ok(!pdfAscii.includes('Unit Price (Rs.)'));
  assert.ok(!pdfAscii.includes('Line Total (Rs.)'));
  assert.ok(!pdfAscii.includes('Grand Total: Rs.'));
});

test('PDF export: large order spanning multiple pages generates valid multi-page PDF structure', () => {
  const largeItems = Array.from({ length: 35 }, (_, idx) => ({
    id: `item-${idx + 1}`,
    name: `Grocery Product ${idx + 1} / மளிகை பொருள் ${idx + 1}`,
    originalText: `${idx + 1}) பொருள் ${idx + 1} - 1 kg`,
    quantity: 1,
    unit: 'kg' as const,
    unitPrice: 100,
    total: 100,
    confidence: 0.99,
    hasWarning: false,
  }));

  const largeOrder = {
    storeName: 'Wholesale Depot Mart',
    items: largeItems,
  };

  const pdfBytes = exportService.exportToPdf(largeOrder);
  const pdfAscii = Buffer.from(pdfBytes).toString('latin1');

  // 35 rows in autoTable easily span across multiple pages (at least 2 pages)
  const pageMatches = pdfAscii.match(/\/Type\s*\/Page\b/g);
  assert.ok(pageMatches && pageMatches.length >= 2, 'Large order must span across multiple pages');

  // Multi-page PDF has valid start and EOF markers
  assert.ok(pdfAscii.startsWith('%PDF-1.3'));
  assert.ok(pdfAscii.includes('%%EOF'));
});

test('PDF export: executive header renders shop name, order date, and phone number with clean fallback', () => {
  // Test case 1: Phone number provided
  const orderWithPhone = {
    storeName: 'Sri Gokulam Wholesale Stores',
    storePhone: '+91 98765 43210',
    date: '31/10/2026',
    orderNumber: 'ORD-7890',
    items: [
      {
        id: 'p-1',
        name: 'Turmeric Powder (மஞ்சள் தூள்)',
        originalText: 'மஞ்சள் தூள் 500g',
        quantity: 0.5,
        unit: 'kg' as const,
        unitPrice: 120,
        total: 60,
        confidence: 0.99,
        hasWarning: false,
      },
    ],
  };

  const pdfWithPhone = exportService.exportToPdf(orderWithPhone);
  const utf8WithPhone = Buffer.from(pdfWithPhone).toString('utf8');
  const matchWithPhone = utf8WithPhone.match(/%EASYLIST_UTF8_MANIFEST:(.+)/);
  assert.ok(matchWithPhone);
  const dataWithPhone = JSON.parse(matchWithPhone[1]);
  assert.equal(dataWithPhone.storeName, 'Sri Gokulam Wholesale Stores');
  assert.equal(dataWithPhone.storePhone, '+91 98765 43210');
  assert.equal(dataWithPhone.date, '31/10/2026');

  // Test case 2: Phone number missing -> clean fallback 'Not provided'
  const orderWithoutPhone = {
    storeName: 'Annai Supermarket',
    date: '31/10/2026',
    items: [
      {
        id: 'p-2',
        name: 'Basmati Rice',
        originalText: 'Basmati Rice 10kg',
        quantity: 10,
        unit: 'kg' as const,
        unitPrice: 110,
        total: 1100,
        confidence: 0.99,
        hasWarning: false,
      },
    ],
  };

  const pdfWithoutPhone = exportService.exportToPdf(orderWithoutPhone);
  const utf8WithoutPhone = Buffer.from(pdfWithoutPhone).toString('utf8');
  const matchWithoutPhone = utf8WithoutPhone.match(/%EASYLIST_UTF8_MANIFEST:(.+)/);
  assert.ok(matchWithoutPhone);
  const dataWithoutPhone = JSON.parse(matchWithoutPhone[1]);
  assert.equal(dataWithoutPhone.storeName, 'Annai Supermarket');
  assert.equal(dataWithoutPhone.storePhone, 'Not provided');
});

test('3-tier product naming and PDF layout: preserves originalText, tamilName, and englishName distinctly', () => {
  const threeTierOrder = {
    storeName: 'Velan Provisions',
    items: [
      {
        id: 'tier-1',
        name: '50g வரமிளகாய்',
        originalText: '50g வரமிளகாய் - 1/2 கி',
        tamilName: 'வரமிளகாய்',
        englishName: 'Dry Red Chilli',
        quantity: 0.5,
        unit: 'kg' as const,
        unitPrice: 0,
        total: 0,
        confidence: 0.95,
        hasWarning: false,
      },
      {
        id: 'tier-2',
        name: '356 அரிசி',
        originalText: '356 அரிசி - 426',
        tamilName: 'அரிசி',
        englishName: 'Rice',
        quantity: 1,
        unit: 'bag' as const,
        unitPrice: 0,
        total: 0,
        confidence: 0.9,
        hasWarning: false,
      },
      {
        id: 'tier-3',
        name: 'கிட்ணபொடி',
        originalText: '50g கிட்ணபொடி',
        tamilName: 'கிட்ணபொடி',
        englishName: undefined, // Uncertain or ambiguous, should remain undefined
        quantity: '',
        unit: '',
        unitPrice: 0,
        total: 0,
        confidence: 0.6,
        hasWarning: true,
        isUncertain: true,
      },
    ],
  };

  const normalized = normalizeExportData(threeTierOrder);
  assert.equal(normalized.items.length, 3);
  assert.equal(normalized.items[0].originalText, '50g வரமிளகாய் - 1/2 கி');
  assert.equal(normalized.items[0].tamilName, 'வரமிளகாய்');
  assert.equal(normalized.items[0].englishName, 'Dry Red Chilli');
  assert.equal(normalized.items[1].name, '356 அரிசி');
  assert.equal(normalized.items[2].englishName, undefined);

  const pdfBytes = exportService.exportToPdf(threeTierOrder);
  assert.ok(pdfBytes.byteLength > 2000);
  const pdfUtf8 = Buffer.from(pdfBytes).toString('utf8');
  const manifestMatch = pdfUtf8.match(/%EASYLIST_UTF8_MANIFEST:(.+)/);
  assert.ok(manifestMatch);
  const manifest = JSON.parse(manifestMatch[1]);
  assert.equal(manifest.items[0].englishName, 'Dry Red Chilli');
  assert.equal(manifest.items[0].tamilName, 'வரமிளகாய்');
  assert.equal(manifest.items[0].originalText, '50g வரமிளகாய் - 1/2 கி');
});

test('English by default: normalizeOcrItemsToEnglish sets English names, preserves originalText, and toggles cleanly', () => {
  const rawOcrItems: OrderItem[] = [
    {
      id: 'item-101',
      name: 'துவரம் பருப்பு',
      originalText: '1. துவரம் பருப்பு 1 kg',
      tamilName: 'துவரம் பருப்பு',
      englishName: 'Toor Dal',
      quantity: 1,
      unit: 'kg',
      unitPrice: 160,
      total: 160,
      confidence: 0.98,
    },
    {
      id: 'item-102',
      name: 'வரமிளகாய்',
      originalText: '2. வரமிளகாய் 500g',
      tamilName: 'வரமிளகாய்',
      englishName: 'Dry Red Chilli',
      quantity: 500,
      unit: 'g',
      unitPrice: 0,
      total: 0,
      confidence: 0.95,
    },
    {
      id: 'item-103',
      name: '356 Arival',
      originalText: '3. 356 அரிவாள் 1 pcs',
      tamilName: '356 அரிவாள்',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 250,
      total: 250,
      confidence: 0.75,
      isUncertain: true,
    },
  ];

  // 1. By default, items must be normalized to English
  const englishByDefault = normalizeOcrItemsToEnglish(rawOcrItems);

  assert.equal(englishByDefault[0].name, 'Toor Dal', 'Item 1 name must be English "Toor Dal"');
  assert.equal(englishByDefault[0].originalText, '1. துவரம் பருப்பு 1 kg', 'Original handwritten text preserved');
  assert.equal(englishByDefault[0].tamilName, 'துவரம் பருப்பு', 'Tamil name preserved');
  assert.equal(englishByDefault[0].quantity, 1, 'Quantity preserved');
  assert.equal(englishByDefault[0].unit, 'kg', 'Unit preserved');

  assert.equal(englishByDefault[1].name, 'Dry Red Chilli', 'Item 2 name must be English "Dry Red Chilli"');
  assert.equal(englishByDefault[1].quantity, 500, 'Quantity preserved');
  assert.equal(englishByDefault[1].unit, 'g', 'Unit preserved');

  // Item without englishName must safely fallback to its existing name without guessing
  assert.equal(englishByDefault[2].name, '356 Arival', 'Uncertain item keeps its original extracted name without guessing');

  // 2. Toggle to original text ("Show Original Text" clicked -> Tamil displayed)
  const originalTamilView = toggleItemsLanguage(englishByDefault, true);
  assert.equal(originalTamilView[0].name, '1. துவரம் பருப்பு 1 kg', 'Displays original handwritten Tamil text');
  assert.equal(originalTamilView[0].quantity, 1, 'Quantity unchanged when toggled');
  assert.equal(originalTamilView[0].unit, 'kg', 'Unit unchanged when toggled');
  assert.equal(originalTamilView[1].name, '2. வரமிளகாய் 500g', 'Displays original handwritten Tamil text');

  // 3. Toggle back to English ("Show English Names" clicked -> English restored)
  const restoredEnglishView = toggleItemsLanguage(originalTamilView, false);
  assert.equal(restoredEnglishView[0].name, 'Toor Dal', 'Restores English product name');
  assert.equal(restoredEnglishView[0].originalText, '1. துவரம் பருப்பு 1 kg', 'Original text strictly preserved');
  assert.equal(restoredEnglishView[1].name, 'Dry Red Chilli', 'Restores English product name');

  // 4. User edits product name in English view: preserves originalText
  const editedItem = applyItemUpdate(restoredEnglishView[0], { name: 'Premium Toor Dal' }, false);
  assert.equal(editedItem.name, 'Premium Toor Dal', 'Displays updated English name');
  assert.equal(editedItem.normalizedName, 'Premium Toor Dal', 'Stores updated normalized name');
  assert.equal(editedItem.originalText, '1. துவரம் பருப்பு 1 kg', 'Does not overwrite or lose original handwritten Tamil text');
  assert.equal(editedItem.tamilName, 'துவரம் பருப்பு', 'Tamil name remains intact');

  // 5. Subsequent toggle to original text and back reflects both original text and updated edit
  const toggleAfterEdit = toggleItemsLanguage([editedItem], true);
  assert.equal(toggleAfterEdit[0].name, '1. துவரம் பருப்பு 1 kg', 'Shows original text when toggled to original');
  const toggleBackAfterEdit = toggleItemsLanguage(toggleAfterEdit, false);
  assert.equal(toggleBackAfterEdit[0].name, 'Premium Toor Dal', 'Restores user-edited English name when toggled back');
});





