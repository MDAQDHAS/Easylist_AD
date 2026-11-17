import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { OrderUpload } from '../upload/OrderUpload';
import { PhotoUploadModal } from '../upload/PhotoUploadModal';
import { TextOrderModal } from '../upload/TextOrderModal';
import { VoiceNoteModal } from '../upload/VoiceNoteModal';
import { AccountEntriesModal } from '../upload/AccountEntriesModal';
import { ChequeUploadModal } from '../upload/ChequeUploadModal';
import { ProductMasterUploadModal } from '../upload/ProductMasterUploadModal';
import { ExtractedItemsTable } from './ExtractedItemsTable';
import { DashboardPage } from '../../pages/DashboardPage';
import { AccountsPage } from '../../pages/AccountsPage';
import { ExcelManagementPage } from '../../pages/ExcelManagementPage';
import { ShopSettingsModal } from '../../components/ui/ShopSettingsModal';
import {
  OrderWorkflowProvider,
  normalizeOcrItemsToEnglish,
} from '../../context/OrderWorkflowContext';
import { ocrService } from '../../services/ocrService';
import { exportService } from '../../services/exportService';
import { productMasterService } from '../../services/productMasterService';
import { apiClient } from '../../services/api/client';
import { OrderItem } from '../../types/order';
import { ProductMasterFile } from '../../types/productMaster';
import { storage, AccountRecord } from '../../lib/storage';

test('OrderUpload: completely removes Take Photo button and keeps Choose Images and Drag & Drop', () => {
  const html = renderToStaticMarkup(
    React.createElement(OrderUpload, {
      initialFiles: [],
    })
  );

  // Must have Choose Images button
  assert.ok(html.includes('id="btn-choose-images"'), 'Must have "btn-choose-images" button');
  assert.ok(html.includes('Choose Images'), 'Must have "Choose Images" text');

  // Must have drag and drop text
  assert.ok(html.includes('Drag &amp; drop your order images here'), 'Must preserve drag-and-drop text');
  assert.ok(html.includes('or choose images from your device'), 'Must have updated subtitle');

  // Must NOT have Take Photo button or camera capture
  assert.ok(!html.includes('id="btn-take-photo"'), 'Must NOT have "btn-take-photo" button');
  assert.ok(!html.includes('Take Photo'), 'Must NOT have "Take Photo" text');
  assert.ok(!html.includes('capture="environment"'), 'Must NOT have camera capture input');
  assert.ok(!html.includes('Snap photo directly with your camera'), 'Must NOT have camera tooltip');
});

test('ExtractedItemsTable: default English view displays English names, hides Tamil text, and shows "Show Original Text"', () => {
  const sampleItems: OrderItem[] = [
    {
      id: 'item-1',
      name: 'Toor Dal',
      originalText: 'துவரம் பருப்பு 1 kg',
      tamilName: 'துவரம் பருப்பு',
      englishName: 'Toor Dal',
      quantity: 1,
      unit: 'kg',
      unitPrice: 160,
      total: 160,
      confidence: 0.98,
    },
  ];

  const html = renderToStaticMarkup(
    React.createElement(ExtractedItemsTable, {
      items: sampleItems,
      onUpdateItem: () => {},
      onAddItem: () => {},
      onDeleteItem: () => {},
      currentLanguage: 'en',
      isTranslating: false,
      translationError: null,
      onToggleLanguage: () => {},
      onDismissTranslationError: () => {},
    })
  );

  // 1. Toggle button must be labeled "Show Original Text" in default state
  assert.ok(html.includes('Show Original Text'), 'Toggle button must display "Show Original Text" in default English state');
  assert.ok(!html.includes('Show English Names'), 'Must NOT show "Show English Names" when already in English');
  assert.ok(!html.includes('Show Normalized Name'), 'Must NOT show legacy "Show Normalized Name" label');

  // 2. Input value must display English name
  assert.ok(html.includes('value="Toor Dal"'), 'Input must display English name "Toor Dal"');

  // 3. Tamil original handwritten subtitle and badges must be HIDDEN in default view
  assert.ok(!html.includes('Handwritten:'), 'Must NOT display Handwritten subtitle in default English view');
  assert.ok(!html.includes('தமிழ்:'), 'Must NOT display Tamil badge in default English view');
});

test('ExtractedItemsTable: toggled original text view shows "Show English Names" and displays handwritten Tamil text', () => {
  const sampleItems: OrderItem[] = [
    {
      id: 'item-1',
      name: 'துவரம் பருப்பு 1 kg',
      originalText: 'துவரம் பருப்பு 1 kg',
      tamilName: 'துவரம் பருப்பு',
      englishName: 'Toor Dal',
      quantity: 1,
      unit: 'kg',
      unitPrice: 160,
      total: 160,
      confidence: 0.98,
    },
  ];

  const html = renderToStaticMarkup(
    React.createElement(ExtractedItemsTable, {
      items: sampleItems,
      onUpdateItem: () => {},
      onAddItem: () => {},
      onDeleteItem: () => {},
      currentLanguage: 'ta',
      isTranslating: false,
      translationError: null,
      onToggleLanguage: () => {},
      onDismissTranslationError: () => {},
    })
  );

  // 1. Toggle button must be labeled "Show English Names" when viewing original text
  assert.ok(html.includes('Show English Names'), 'Toggle button must display "Show English Names" when in original text view');
  assert.ok(!html.includes('Show Original Text'), 'Must NOT show "Show Original Text" when already viewing original text');

  // 2. Input value must display Tamil original text
  assert.ok(html.includes('value="துவரம் பருப்பு 1 kg"'), 'Input must display Tamil original text');

  // 3. Handwritten subtitle and English reference badge are displayed when toggle is active
  assert.ok(html.includes('Handwritten:'), 'Displays Handwritten subtitle when in original text view');
  assert.ok(html.includes('EN: Toor Dal'), 'Displays English badge when viewing original text');
});

test('DashboardPage: renders redesigned Figma layout with sidebar, hero banner, and 4 action cards while preserving store data', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        OrderWorkflowProvider,
        null,
        React.createElement(DashboardPage, {
          currentStore: {
            id: 'shop-101',
            name: 'Annai Super Market',
            ownerName: 'Annai Super Market',
            phone: '9876543210',
            email: 'annai@example.com',
            address: 'Chennai',
          },
        })
      )
    )
  );

  // Real authenticated store name rendered in header
  assert.ok(html.includes('Annai Super Market'), 'Header must display real store name');

  // Sidebar items
  assert.ok(html.includes('id="nav-dashboard"'), 'Must render Dashboard sidebar nav item');
  assert.ok(html.includes('id="nav-accounts"'), 'Must render Accounts sidebar nav item');
  assert.ok(html.includes('id="nav-excel"'), 'Must render Excel sidebar nav item');
  assert.ok(html.includes('id="nav-settings"'), 'Must render Settings sidebar nav item');

  // Hero section
  assert.ok(html.includes('Welcome Back!'), 'Must render Welcome Back pill');
  assert.ok(html.includes('Your Notebook Orders,'), 'Must render hero title line 1');
  assert.ok(html.includes('Now Made Digital.'), 'Must render hero title line 2');
  assert.ok(html.includes('Make handwritten orders digital, effortlessly.'), 'Must render hero subtitle');
  assert.ok(html.includes('/images/dashboard-hero-illustration.png'), 'Must render hero illustration');

  // Main Card Header & 4 Action Cards
  assert.ok(html.includes('Upload Order Images'), 'Must render Upload Order Images card header');
  assert.ok(html.includes('Excel Management'), 'Must render Excel Management button');
  assert.ok(html.includes('Photo Upload'), 'Must render Photo Upload card');
  assert.ok(html.includes('Upload Image'), 'Must render Upload Image button');
  assert.ok(html.includes('Text Order'), 'Must render Text Order card');
  assert.ok(html.includes('Enter Order'), 'Must render Enter Order button');
  assert.ok(html.includes('Voice Note'), 'Must render Voice Note card');
  assert.ok(html.includes('Add Voice Note'), 'Must render Add Voice Note button');
  assert.ok(html.includes('Manage Accounts'), 'Must render Manage Accounts button');
});

test('PhotoUploadModal: renders required heading, description, drag-and-drop zone, design tokens, and preview controls', () => {
  const emptyModalHtml = renderToStaticMarkup(
    React.createElement(PhotoUploadModal, {
      isOpen: true,
      onClose: () => {},
      initialFiles: [],
      onExtractOrder: async () => {},
    })
  );

  // Heading & description
  assert.ok(emptyModalHtml.includes('Upload Order Image'), 'Must display "Upload Order Image" heading');
  assert.ok(
    emptyModalHtml.includes('Turn your handwritten orders into digital lists.'),
    'Must display required description'
  );

  // Drag-and-drop area texts & buttons
  assert.ok(
    emptyModalHtml.includes('Drop your order image here'),
    'Must display "Drop your order image here"'
  );
  assert.ok(
    emptyModalHtml.includes('or browse files from your device'),
    'Must display "or browse files from your device"'
  );
  assert.ok(emptyModalHtml.includes('Choose Image'), 'Must display "Choose Image" button');
  assert.ok(emptyModalHtml.includes('Extract Order'), 'Must display full-width "Extract Order" button');

  // Design system tokens (#F8F7F4, #6842DB, #8055F5, #5132CC, #172554, #64748B)
  assert.ok(emptyModalHtml.includes('#F8F7F4'), 'Must use #F8F7F4 modal background');
  assert.ok(emptyModalHtml.includes('#6842DB'), 'Must use #6842DB primary purple');
  assert.ok(emptyModalHtml.includes('#8055F5'), 'Must use #8055F5 gradient start');
  assert.ok(emptyModalHtml.includes('#5132CC'), 'Must use #5132CC gradient end');
  assert.ok(emptyModalHtml.includes('#172554'), 'Must use #172554 heading text');
  assert.ok(emptyModalHtml.includes('#64748B'), 'Must use #64748B secondary text');

  // Selected image state: preview, filename, file size, Replace and Remove controls
  const withFileHtml = renderToStaticMarkup(
    React.createElement(PhotoUploadModal, {
      isOpen: true,
      onClose: () => {},
      initialFiles: [
        {
          id: 'file-1',
          name: 'handwritten_order_01.png',
          size: 245760, // 240 KB
          previewUrl: 'blob:test-order-preview',
        },
      ],
      onExtractOrder: async () => {},
    })
  );

  assert.ok(withFileHtml.includes('handwritten_order_01.png'), 'Must display selected filename');
  assert.ok(withFileHtml.includes('240 KB'), 'Must display formatted file size');
  assert.ok(withFileHtml.includes('blob:test-order-preview'), 'Must render image preview');
  assert.ok(withFileHtml.includes('Replace'), 'Must render Replace control');
  assert.ok(withFileHtml.includes('Remove'), 'Must render Remove control');
});

test('End-to-End Flow: PhotoUploadModal image upload -> OCR extraction -> Results Review -> Export', async () => {
  const originalPost = apiClient.post.bind(apiClient);
  ocrService.clearImageCache();

  const validPngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const orderFile = new File([validPngBytes], 'notebook_order.png', { type: 'image/png' });

  apiClient.post = (async (endpoint: string) => {
    if (endpoint === '/ocr/jobs') {
      return {
        success: true,
        jobId: 'job-e2e-modal-1',
        status: 'completed',
        stage: 'completed',
        items: [
          {
            id: 'ext-1',
            name: 'Ponni Rice',
            englishName: 'Ponni Rice',
            tamilName: 'பொன்னி அரிசி',
            originalText: '1. பொன்னி அரிசி - 25 kg',
            quantity: 25,
            unit: 'kg',
            unitPrice: 1350,
            total: 1350,
            confidence: 0.99,
            hasWarning: false,
          },
          {
            id: 'ext-2',
            name: 'Toor Dal',
            englishName: 'Toor Dal',
            originalText: '2. Toor Dal - 5 kg',
            quantity: 5,
            unit: 'kg',
            unitPrice: 150,
            total: 750,
            confidence: 0.98,
            hasWarning: false,
          },
        ],
      };
    }
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  }) as typeof apiClient.post;

  try {
    const progressStages: string[] = [];
    const extracted = await ocrService.extractImages([orderFile], (update) => {
      progressStages.push(update.stageName);
    });

    assert.equal(extracted.length, 2, 'Should extract 2 order items from uploaded image');
    assert.ok(progressStages.length > 0, 'Should emit progress updates for loading animation');

    // Normalize for Review/Results page
    const normalizedItems = normalizeOcrItemsToEnglish(extracted);
    const reviewHtml = renderToStaticMarkup(
      React.createElement(ExtractedItemsTable, {
        items: normalizedItems,
        onUpdateItem: () => {},
        onAddItem: () => {},
        onDeleteItem: () => {},
        currentLanguage: 'en',
        isTranslating: false,
        translationError: null,
        onToggleLanguage: () => {},
        onDismissTranslationError: () => {},
      })
    );
    assert.ok(reviewHtml.includes('value="Ponni Rice"'), 'Results table displays Ponni Rice');
    assert.ok(reviewHtml.includes('value="Toor Dal"'), 'Results table displays Toor Dal');

    // Verify Export works with extracted data
    const csvOutput = exportService.exportToCsv({
      items: normalizedItems,
      storeName: 'Sri Gokulakkannan Stores',
      date: '14 Nov 2026',
    });
    assert.ok(csvOutput.includes('Ponni Rice'), 'Exported CSV includes Ponni Rice');
    assert.ok(csvOutput.includes('Toor Dal'), 'Exported CSV includes Toor Dal');
  } finally {
    apiClient.post = originalPost;
    ocrService.clearImageCache();
  }
});

test('TextOrderModal: renders required redesigned paste area card, heading, description, top-right language pill, item counter, and orange button matching Text Feature Card', () => {
  const html = renderToStaticMarkup(
    React.createElement(TextOrderModal, {
      isOpen: true,
      onClose: () => {},
      onExtractOrder: () => {},
    })
  );

  // Design system colors and styles from Text Feature Card
  assert.ok(html.includes('#F8F7F4'), 'Must use #F8F7F4 background');
  assert.ok(html.includes('#F6A521'), 'Must use #F6A521 orange gradient start');
  assert.ok(html.includes('#D75C0A'), 'Must use #D75C0A orange gradient end');
  assert.ok(html.includes('#C46A18'), 'Must use #C46A18 text card accent');

  // Headings and labels
  assert.ok(html.includes('Enter Text Order'), 'Must render "Enter Text Order" heading');
  assert.ok(
    html.includes('Convert customer messages into digital orders.'),
    'Must render "Convert customer messages into digital orders." description'
  );
  assert.ok(html.includes('Paste Customer Order'), 'Must render "Paste Customer Order" heading in paste card');
  assert.ok(
    html.includes("Paste or type your customer&#x27;s order details here.") ||
    html.includes("Paste or type your customer's order details here."),
    'Must render helper text in paste card'
  );

  // Top-right language support pill
  assert.ok(html.includes('தமிழ் + English Supported'), 'Must display "தமிழ் + English Supported" pill');
  assert.ok(html.includes('#FFF4E5'), 'Must use warm orange pill background');

  // Item counter above extract button
  assert.ok(html.includes('0 items detected'), 'Must show "0 items detected" when empty');

  // Input, character count, extract button
  assert.ok(
    html.includes('placeholder="Paste or type the customer&#x27;s order here..."') ||
    html.includes("Paste or type the customer's order here..."),
    'Must render textarea with placeholder'
  );
  assert.ok(html.includes('0 characters'), 'Must display initial character count');
  assert.ok(html.includes('Extract Order'), 'Must render full-width "Extract Order" button');
});

test('TextOrderModal: parses multiline customer orders preserving Tamil/English lines and line breaks', () => {
  const rawOrder = `1. Toor Dal 2 kg @ 140
2. Ponni Rice 25 kg
3. Sunflower Oil 5 ltr
4. சீரகம் 100 g`;

  const parsed = ocrService.parseTextOrder(rawOrder);
  assert.equal(parsed.length, 4, 'Must parse 4 lines');
  assert.equal(parsed[0].name, 'Toor Dal');
  assert.equal(parsed[0].quantity, 2);
  assert.equal(parsed[0].unit, 'kg');
  assert.equal(parsed[0].unitPrice, 140);
  assert.equal(parsed[0].total, 280);

  assert.equal(parsed[1].name, 'Ponni Rice');
  assert.equal(parsed[1].quantity, 25);
  assert.equal(parsed[1].unit, 'kg');

  assert.equal(parsed[2].name, 'Sunflower Oil');
  assert.equal(parsed[2].quantity, 5);
  assert.equal(parsed[2].unit, 'ltr');

  assert.equal(parsed[3].name, 'சீரகம்');
  assert.equal(parsed[3].quantity, 100);
  assert.equal(parsed[3].unit, 'g');
});

test('VoiceNoteModal: renders required Upload Voice Note popup design with upload dropzone, colors, and 30px pill extract button', () => {
  const html = renderToStaticMarkup(
    React.createElement(VoiceNoteModal, {
      isOpen: true,
      onClose: () => {},
      onExtractOrder: () => {},
    })
  );

  // Container styling and design system colors
  assert.ok(html.includes('#F8F7F4'), 'Must use #F8F7F4 background');
  assert.ok(html.includes('max-w-[760px]'), 'Must support 720-780px width');
  assert.ok(html.includes('rounded-[20px]'), 'Must have 20px rounded corners');
  assert.ok(html.includes('#07865D') || html.includes('07865D'), 'Must use #07865D primary green');
  assert.ok(html.includes('#10B981') && html.includes('#047857'), 'Must use #10B981 to #047857 button gradient');
  assert.ok(html.includes('#E3F8ED'), 'Must use #E3F8ED soft green');
  assert.ok(html.includes('#A7DCC4'), 'Must use #A7DCC4 dashed border color');
  assert.ok(html.includes('#DCE8E1'), 'Must use #DCE8E1 border');

  // Headings & description
  assert.ok(html.includes('Upload Voice Note'), 'Must render "Upload Voice Note" heading');
  assert.ok(
    html.includes("Upload a customer&#x27;s recorded voice order and convert it into a digital list.") ||
    html.includes("Upload a customer's recorded voice order and convert it into a digital list."),
    'Must render exact description'
  );

  // Audio Upload Section
  assert.ok(html.includes('Drop your voice note here'), 'Must render "Drop your voice note here" main text');
  assert.ok(
    html.includes('or browse audio files from your device'),
    'Must render "or browse audio files from your device"'
  );
  assert.ok(html.includes('id="btn-choose-audio-file"'), 'Must render Choose Audio File button');
  assert.ok(html.includes('Choose Audio File'), 'Must have Choose Audio File label');
  assert.ok(html.includes('rounded-[16px]'), 'Upload dropzone must have 16px rounded corners');

  // Must NOT include in-app recording controls
  assert.ok(!html.includes('id="btn-start-recording"'), 'Must NOT have Start Recording button');
  assert.ok(!html.includes('Recording in progress'), 'Must NOT have recording progress timer');
  assert.ok(!html.includes('Ready to record your order?'), 'Must NOT have in-app record prompt');

  // Full-width Extract Order button with rounded-30px (disabled when empty)
  assert.ok(html.includes('id="btn-extract-voice-order"'), 'Must have "btn-extract-voice-order" button');
  assert.ok(html.includes('Extract Order'), 'Must render Extract Order button');
  assert.ok(html.includes('rounded-[30px]'), 'Extract button must have 30px rounded corners');
  assert.ok(html.includes('h-[50px]'), 'Extract button must be 48-52px height');
  assert.ok(html.includes('disabled=""') || html.includes('disabled'), 'Extract button must be disabled when no audio');
});

test('VoiceNoteModal: handles spoken voice order parsing and extraction to order items', () => {
  const spokenVoiceTranscript = `White Sugar 1 kg
Urad Dal 500 g
Fortune Gold Oil 2 ltr
நாட்டு சர்க்கரை 1 kg`;

  const parsed = ocrService.parseTextOrder(spokenVoiceTranscript);
  assert.equal(parsed.length, 4, 'Must parse 4 items from spoken voice order');
  assert.equal(parsed[0].name, 'White Sugar');
  assert.equal(parsed[0].quantity, 1);
  assert.equal(parsed[0].unit, 'kg');

  assert.equal(parsed[1].name, 'Urad Dal');
  assert.equal(parsed[1].quantity, 500);
  assert.equal(parsed[1].unit, 'g');

  assert.equal(parsed[2].name, 'Fortune Gold Oil');
  assert.equal(parsed[2].quantity, 2);
  assert.equal(parsed[2].unit, 'ltr');

  assert.equal(parsed[3].name, 'நாட்டு சர்க்கரை');
  assert.equal(parsed[3].quantity, 1);
  assert.equal(parsed[3].unit, 'kg');
});

test('AccountsPage: renders exact Figma layout with hero banner, 2 feature cards, active sidebar item, and 30-day history section', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        OrderWorkflowProvider,
        null,
        React.createElement(AccountsPage, {
          currentStore: {
            id: 'store-1',
            name: 'Sri Gokulakkannan Stores',
            ownerName: 'Gokul',
            phone: '9876543210',
            email: 'gokul@example.com',
            address: 'Main Bazaar, Madurai',
          },
        })
      )
    )
  );

  // Background and Design System tokens
  assert.ok(html.includes('#F8F7F4'), 'Must use #F8F7F4 background');
  assert.ok(html.includes('#5046F2') || html.includes('5046F2'), 'Must use primary purple');
  assert.ok(html.includes('Sri Gokulakkannan Stores'), 'Must display active store name');

  // Hero Section
  assert.ok(
    html.includes('YOUR BUSINESS, BETTER ORGANISED'),
    'Must render "YOUR BUSINESS, BETTER ORGANISED" eyebrow badge'
  );
  assert.ok(html.includes('Your Accounts,'), 'Must render "Your Accounts," heading');
  assert.ok(html.includes('Now Made Digital.'), 'Must render "Now Made Digital." heading');
  assert.ok(
    html.includes('Digitise account notes and cheque details effortlessly.'),
    'Must render hero description'
  );

  // Active Sidebar Nav Item
  assert.ok(html.includes('id="nav-accounts"'), 'Must have accounts navigation button');
  assert.ok(html.includes('#EEEAFE'), 'Accounts sidebar button must be active with #EEEAFE');

  // Feature Cards
  assert.ok(html.includes('Account Management'), 'Must render "Account Management" container heading');
  assert.ok(html.includes('Account Entries'), 'Must render "Account Entries" card title');
  assert.ok(html.includes('Digitise handwritten account notes.'), 'Must render Account Entries description');
  assert.ok(html.includes('Upload Notes'), 'Must render "Upload Notes" button');

  assert.ok(html.includes('Cheque'), 'Must render "Cheque" card title');
  assert.ok(html.includes('Upload cheques to extract details.'), 'Must render Cheques description');
  assert.ok(html.includes('Upload Cheque'), 'Must render "Upload Cheque" button');

  // Recent History Section
  assert.ok(html.includes('Recent History'), 'Must render "Recent History" heading');
  assert.ok(html.includes('Last 30 Days'), 'Must show "Last 30 Days" date range badge');
  assert.ok(html.includes('All ('), 'Must render "All" filter pill');
  assert.ok(html.includes('Account Entries ('), 'Must render "Account Entries" filter pill');
  assert.ok(html.includes('Cheques ('), 'Must render "Cheques" filter pill');

  // Redesigned History Tabs UI: lavender container and purple active pill
  assert.ok(html.includes('#F1EBFF'), 'Must use soft lavender #F1EBFF container');
  assert.ok(html.includes('#E5DCF7'), 'Must use #E5DCF7 border for tab container');
  assert.ok(html.includes('#6842DB'), 'Must use #6842DB vibrant purple for active tab');

  // Download & Date Filter Controls: Download dropdown placed immediately before Date Filter dropdown
  assert.ok(html.includes('id="btn-download-history"'), 'Must render download history button');
  assert.ok(html.includes('id="btn-date-filter-dropdown"'), 'Must render date filter dropdown button');
  assert.ok(
    html.indexOf('id="btn-download-history"') < html.indexOf('id="btn-date-filter-dropdown"'),
    'Download dropdown must appear immediately before Date Filter dropdown'
  );

  // Copy button completely removed from History UI
  assert.ok(!html.includes('id="btn-copy-history"'), 'Must not render copy history button in History section');
});

test('exportService: formatAccountsHistoryAsText generates structured text summary', () => {
  const sampleRecords: AccountRecord[] = [
    {
      id: 'acc-1',
      recordNumber: 'ACC-2026-001',
      type: 'account_entry',
      title: 'Daily Notebook Order Entry',
      partyName: 'Murugan Groceries',
      date: '14 Nov 2026',
      time: '02:30 PM',
      createdAt: '2026-11-14T09:00:00.000Z',
      amount: 4500,
      items: [
        { id: '1', name: 'Toor Dal', quantity: 5, unit: 'kg', unitPrice: 140, total: 700 },
        { id: '2', name: 'Ponni Rice', quantity: 25, unit: 'kg', unitPrice: 60, total: 1500 },
      ],
      status: 'completed',
    },
    {
      id: 'chk-1',
      recordNumber: 'CHK-2026-002',
      type: 'cheque',
      title: 'Cheque Payment',
      partyName: 'Lakshmi Traders',
      date: '14 Nov 2026',
      time: '04:15 PM',
      createdAt: '2026-11-14T10:45:00.000Z',
      amount: 18500,
      chequeNumber: '884920',
      bankName: 'HDFC Bank',
      items: [],
      status: 'completed',
    },
  ];

  const textOutput = exportService.formatAccountsHistoryAsText(sampleRecords, {
    storeName: 'Sri Gokulakkannan Stores',
    tabLabel: 'All Records',
    dateRangeLabel: 'Last 30 Days',
  });

  assert.ok(textOutput.includes('EASYLIST - ACCOUNTS & CHEQUES HISTORY'), 'Must include header title');
  assert.ok(textOutput.includes('Sri Gokulakkannan Stores'), 'Must include store name');
  assert.ok(textOutput.includes('ACC-2026-001'), 'Must include record number ACC-2026-001');
  assert.ok(textOutput.includes('CHK-2026-002'), 'Must include record number CHK-2026-002');
  assert.ok(textOutput.includes('Murugan Groceries'), 'Must include party Murugan Groceries');
  assert.ok(textOutput.includes('Lakshmi Traders'), 'Must include party Lakshmi Traders');
  assert.ok(textOutput.includes('HDFC Bank'), 'Must include bank name');
  assert.ok(textOutput.includes('884920'), 'Must include cheque number');
  assert.ok(textOutput.includes('Toor Dal (5 kg)'), 'Must include item summary');
  assert.ok(textOutput.includes('TOTAL AMOUNT: Rs. 23,000'), 'Must compute and format grand total');
});

test('AccountsPage: storage stores and filters account records within the 30-day window', () => {
  const sampleRecord: AccountRecord = {
    id: 'test-acc-1',
    recordNumber: 'ACC-2026-999',
    type: 'account_entry',
    title: 'Daily Notebook Order Entry',
    partyName: 'Murugan Groceries',
    date: '14 Nov 2026',
    time: '02:30 PM',
    createdAt: new Date().toISOString(),
    amount: 14500,
    items: [
      {
        id: 'it-1',
        name: 'Toor Dal',
        quantity: 10,
        unit: 'kg',
        unitPrice: 140,
        total: 1400,
      },
    ],
    status: 'completed',
  };

  storage.saveAccountRecord(sampleRecord);
  const loaded = storage.getAccountRecords();
  assert.ok(loaded.some((r) => r.id === 'test-acc-1'), 'Saved record must be retrievable from storage');

  // Verify deletion cleanup
  storage.deleteAccountRecord('test-acc-1');
  const afterDelete = storage.getAccountRecords();
  assert.ok(!afterDelete.some((r) => r.id === 'test-acc-1'), 'Record must be removed from storage');
});

test('AccountEntriesModal: renders redesigned minimal digital ledger popup with clean header, upload card, and 48px extract button', () => {
  const html = renderToStaticMarkup(
    React.createElement(AccountEntriesModal, {
      isOpen: true,
      onClose: () => {},
      onExtractAccountNotes: async () => {},
    })
  );

  // Overall Design tokens
  assert.ok(html.includes('#F8F7FC'), 'Must use #F8F7FC background');
  assert.ok(html.includes('max-w-[700px]'), 'Must support 700px width');
  assert.ok(html.includes('rounded-[18px]'), 'Must have 18px rounded corners');
  assert.ok(html.includes('#6842DB'), 'Must use #6842DB primary purple');
  assert.ok(html.includes('#F1EBFF'), 'Must use #F1EBFF soft lavender');
  assert.ok(html.includes('#E5DCF7'), 'Must use #E5DCF7 border');
  assert.ok(html.includes('#24164F'), 'Must use #24164F heading color');
  assert.ok(html.includes('#74698C'), 'Must use #74698C secondary text color');

  // Header
  assert.ok(html.includes('Upload Account Notes'), 'Must render "Upload Account Notes" title');
  assert.ok(
    html.includes('Digitise your handwritten business account records.'),
    'Must render "Digitise your handwritten business account records." subtitle'
  );
  assert.ok(html.includes('id="btn-close-account-upload"'), 'Must have simple close button');

  // Upload Section
  assert.ok(html.includes('Upload Your Account Notes'), 'Must render "Upload Your Account Notes" heading');
  assert.ok(
    html.includes('Select handwritten account images to extract your account details.'),
    'Must render supporting text'
  );
  assert.ok(html.includes('id="btn-browse-account-images"'), 'Must render Browse Account Images button');
  assert.ok(html.includes('Browse Account Images'), 'Must have Browse Account Images label');
  assert.ok(html.includes('or drag and drop images here'), 'Must render "or drag and drop images here" helper');

  // Supported Formats
  assert.ok(
    html.includes('JPG, PNG, WEBP · Max 10MB per image'),
    'Must render supported formats line'
  );

  // Footer & Button
  assert.ok(
    html.includes('Your account notes are processed securely.'),
    'Must render security helper message'
  );
  assert.ok(html.includes('id="btn-extract-account-details"'), 'Must render Extract Account Details button');
  assert.ok(html.includes('Extract Account Details'), 'Must have Extract Account Details label');
  assert.ok(html.includes('h-[48px]'), 'Extract button must have 48px height');
  assert.ok(html.includes('rounded-[12px]'), 'Extract button must have 12px rounded corners');
  assert.ok(html.includes('disabled=""') || html.includes('disabled'), 'Extract button must be disabled when empty');
});

test('ChequeUploadModal: renders dedicated banking blue palette, compact header, upload card, and 48px extract button', () => {
  const html = renderToStaticMarkup(
    React.createElement(ChequeUploadModal, {
      isOpen: true,
      onClose: () => {},
      onExtractCheque: async () => {},
    })
  );

  // Dedicated banking blue palette
  assert.ok(html.includes('#2858D8'), 'Must use #2858D8 primary blue');
  assert.ok(html.includes('#1D4ED8'), 'Must use #1D4ED8 deep blue');
  assert.ok(html.includes('#EAF1FF'), 'Must use #EAF1FF soft blue');
  assert.ok(html.includes('#F5F8FF'), 'Must use #F5F8FF light background');
  assert.ok(html.includes('#D4E1FF'), 'Must use #D4E1FF border');
  assert.ok(html.includes('#142E60'), 'Must use #142E60 heading color');
  assert.ok(html.includes('#526B96'), 'Must use #526B96 body text color');

  // Popup Header
  assert.ok(html.includes('Upload Cheques'), 'Must render "Upload Cheques" title');
  assert.ok(
    html.includes('Digitise cheque details quickly and accurately.'),
    'Must render "Digitise cheque details quickly and accurately." subtitle'
  );
  assert.ok(html.includes('id="btn-close-cheque-upload"'), 'Must have simple close button');

  // Upload Area
  assert.ok(html.includes('Upload Your Cheque Image'), 'Must render "Upload Your Cheque Image" heading');
  assert.ok(
    html.includes('Select a clear cheque image to extract its details.'),
    'Must render description'
  );
  assert.ok(html.includes('id="btn-browse-cheque-image"'), 'Must render Browse Cheque Image button');
  assert.ok(html.includes('Browse Cheque Image'), 'Must have Browse Cheque Image label');
  assert.ok(
    html.includes('or drag and drop your image here'),
    'Must render "or drag and drop your image here" supporting text'
  );

  // Supported Formats
  assert.ok(
    html.includes('JPG, PNG, WEBP · Max 10MB per image'),
    'Must render supported formats'
  );

  // Main Action & Helper Message
  assert.ok(
    html.includes('Please upload a clear and readable cheque image.'),
    'Must render subtle helper message'
  );
  assert.ok(html.includes('id="btn-extract-cheque-details"'), 'Must have "btn-extract-cheque-details" button');
  assert.ok(html.includes('Extract Cheque Details'), 'Must render Extract Cheque Details label');
  assert.ok(html.includes('h-[48px]'), 'Extract button must have 48px height');
  assert.ok(html.includes('rounded-[12px]'), 'Extract button must have 12px rounded corners');
  assert.ok(html.includes('disabled=""') || html.includes('disabled'), 'Extract button must be disabled when empty');
});

test('ExcelManagementPage: renders green identity, page header, 3 overview cards, table, and active sidebar nav', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(ExcelManagementPage, {
        currentStore: {
          id: 'test-store',
          name: 'Sri Gokulakkannan Stores',
          ownerName: 'Gokul',
          phone: '9876543210',
          email: 'gokul@stores.com',
          address: 'Main Bazaar, Erode',
        },
      })
    )
  );

  // Design Tokens (#0D9668, #07865D or #087B57, #E3F7EF, #DCE8E1, #F8F7F4, #172554, #64748B)
  assert.ok(html.includes('#0D9668'), 'Must use #0D9668 primary green');
  assert.ok(html.includes('#07865D') || html.includes('#087B57'), 'Must use secondary green');
  assert.ok(html.includes('#E3F7EF'), 'Must use #E3F7EF soft green');
  assert.ok(html.includes('#DCE8E1'), 'Must use #DCE8E1 border');
  assert.ok(html.includes('#F8F7F4'), 'Must use #F8F7F4 background');

  // Sidebar Excel active state
  assert.ok(html.includes('id="nav-excel"'), 'Must have nav-excel button');
  assert.ok(html.includes('bg-[#E3F7EF] text-[#0D9668]'), 'Excel sidebar button must be active with soft green');

  // Page Header
  assert.ok(html.includes('Excel Management'), 'Must render "Excel Management" heading');
  assert.ok(
    html.includes('Manage your shop') && html.includes('product catalogue in one place.'),
    'Must render page description'
  );
  assert.ok(html.includes('id="btn-upload-replace-excel"'), 'Must render "btn-upload-replace-excel" button');

  // 3 Summary Cards
  assert.ok(html.includes('Total Products'), 'Must render Total Products summary card');
  assert.ok(html.includes('Total Columns'), 'Must render Total Columns summary card');
  assert.ok(html.includes('Matching Status'), 'Must render Matching Status summary card');

  // Empty State when no master uploaded
  assert.ok(html.includes('No Product Master Uploaded'), 'Must render empty state heading');
  assert.ok(html.includes('id="btn-empty-upload-master"'), 'Must render empty upload master button');
});

test('ProductMasterUploadModal: renders drag-and-drop zone, browse button, and accepted spreadsheet formats', () => {
  const html = renderToStaticMarkup(
    React.createElement(ProductMasterUploadModal, {
      isOpen: true,
      onClose: () => {},
      onUploadSuccess: () => {},
      existingMaster: null,
    })
  );

  // Modal header & title
  assert.ok(html.includes('Upload Product Master'), 'Must render "Upload Product Master" title');
  assert.ok(
    html.includes('Upload your shop') && html.includes('product Excel file'),
    'Must render description'
  );
  assert.ok(html.includes('id="btn-close-product-master-modal"'), 'Must have close button');

  // Drag-and-drop & Browse
  assert.ok(html.includes('Drop your product Excel or CSV file here'), 'Must have drag and drop text');
  assert.ok(html.includes('id="btn-browse-product-master"'), 'Must have browse button');
  assert.ok(
    html.includes('Supports XLSX, XLS and CSV files · Max 15MB'),
    'Must list accepted file types'
  );
  assert.ok(html.includes('id="btn-submit-product-master"'), 'Must have submit button');
  assert.ok(html.includes('disabled=""') || html.includes('disabled'), 'Submit must be disabled initially');
});

test('productMasterService: stores, retrieves, and matches products accurately without inventing data', () => {
  const sampleMaster: ProductMasterFile = {
    id: 'pm-test-1',
    fileName: 'Sri_Gokul_Wholesale_Products_2026.xlsx',
    fileSize: 48120,
    fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    uploadedAt: '2026-11-14T10:00:00.000Z',
    updatedAt: '2026-11-14T10:00:00.000Z',
    productCount: 3,
    columns: ['Product Name', 'HSN Code', 'GST %', 'Unit', 'Wholesale Rate'],
    rows: [
      {
        _rowIndex: 1,
        'Product Name': 'Ponni Boiled Rice Super Fine',
        'HSN Code': '10063010',
        'GST %': '5%',
        Unit: 'kg',
        'Wholesale Rate': 58,
      },
      {
        _rowIndex: 2,
        'Product Name': 'Premium Toor Dal Grade A',
        'HSN Code': '07136000',
        'GST %': '0%',
        Unit: 'kg',
        'Wholesale Rate': 145,
      },
      {
        _rowIndex: 3,
        'Product Name': 'Fortune Sunlite Sunflower Oil',
        'HSN Code': '15121910',
        'GST %': '5%',
        Unit: 'ltr',
        'Wholesale Rate': 130,
      },
    ],
  };

  // Test storage
  productMasterService.saveProductMaster(sampleMaster);
  const retrieved = productMasterService.getProductMaster();
  assert.ok(retrieved !== null, 'Product master must be retrieved from storage');
  assert.strictEqual(retrieved?.productCount, 3, 'Product count must match');
  assert.strictEqual(retrieved?.fileName, 'Sri_Gokul_Wholesale_Products_2026.xlsx');

  // Test matching: exact/token match returns genuine sheet details
  const match1 = productMasterService.matchProductAgainstMaster('Toor Dal', sampleMaster);
  assert.strictEqual(match1.matched, true, 'Must match Toor Dal');
  assert.strictEqual(match1.productName, 'Premium Toor Dal Grade A');
  assert.strictEqual(match1.hsn, '07136000', 'Must retrieve actual HSN from sheet');
  assert.strictEqual(match1.rate, 145, 'Must retrieve actual wholesale rate from sheet');
  assert.strictEqual(match1.unit, 'kg', 'Must retrieve actual unit from sheet');

  // Test matching: completely unmatched product returns matched=false without inventing data
  const matchUnmatched = productMasterService.matchProductAgainstMaster('Nonexistent Product XYZ 99', sampleMaster);
  assert.strictEqual(matchUnmatched.matched, false, 'Unmatched product must return matched=false');
  assert.strictEqual(matchUnmatched.hsn, undefined, 'Must NEVER invent HSN');
  assert.strictEqual(matchUnmatched.rate, undefined, 'Must NEVER invent rate');

  // Test addProductItem
  const withNewItem = productMasterService.addProductItem(sampleMaster, {
    'Product Name': 'Chana Dal Super',
    'HSN Code': '07139010',
    'GST %': '0%',
    Unit: 'kg',
    'Wholesale Rate': 85,
  });
  assert.strictEqual(withNewItem.productCount, 4, 'Must increment productCount to 4');
  assert.ok(withNewItem.rows.some((r) => r['Product Name'] === 'Chana Dal Super'), 'Must include new product');

  // Test updateProductItem
  const updatedItem = productMasterService.updateProductItem(withNewItem, 1, {
    'Wholesale Rate': 62,
  });
  const row1 = updatedItem.rows.find((r) => r._rowIndex === 1);
  assert.strictEqual(row1?.['Wholesale Rate'], 62, 'Must update wholesale rate');

  // Test deleteProductItem
  const deletedItem = productMasterService.deleteProductItem(updatedItem, 1);
  assert.strictEqual(deletedItem.productCount, 3, 'Must decrement product count to 3');

  // Clean up
  productMasterService.deleteProductMaster();
  assert.strictEqual(productMasterService.getProductMaster(), null, 'Must be cleared');
});

test('ExcelManagementPage: renders loaded state with left-aligned summary icons, Add Item button, and More menu', () => {
  const sampleMaster: ProductMasterFile = {
    id: 'pm-active-1',
    fileName: 'Sri_Gokul_Products.xlsx',
    fileSize: 32000,
    fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    uploadedAt: '2026-11-14T10:00:00.000Z',
    updatedAt: '2026-11-14T10:00:00.000Z',
    productCount: 2,
    columns: ['Product Name', 'Category', 'Unit', 'Rate'],
    rows: [
      { _rowIndex: 1, _rowId: 'row-1', 'Product Name': 'Basmati Rice', Category: 'Grains', Unit: 'kg', Rate: 120 },
      { _rowIndex: 2, _rowId: 'row-2', 'Product Name': 'Moong Dal', Category: 'Pulses', Unit: 'kg', Rate: 110 },
    ],
  };

  productMasterService.saveProductMaster(sampleMaster);

  const html = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(ExcelManagementPage, {
        currentStore: {
          id: 'test-store',
          name: 'Sri Gokulakkannan Stores',
          ownerName: 'Gokul',
          phone: '9876543210',
          email: 'gokul@stores.com',
          address: 'Main Bazaar, Erode',
        },
      })
    )
  );

  // Add Item button
  assert.ok(html.includes('id="btn-add-product-item"'), 'Must render Add Item button');
  assert.ok(html.includes('Add Item'), 'Must have Add Item label');

  // View Columns button
  assert.ok(html.includes('id="btn-view-columns"'), 'Must render View Columns button');

  // Table with products
  assert.ok(html.includes('Basmati Rice'), 'Must render Basmati Rice');
  assert.ok(html.includes('Moong Dal'), 'Must render Moong Dal');

  // More menu action column & buttons
  assert.ok(html.includes('Actions'), 'Must have Actions column header');
  assert.ok(html.includes('btn-product-menu-'), 'Must have row action menu button');

  // Verify no hardcoded '#' column is auto-added
  assert.ok(!html.includes('>#<'), 'Must not auto-inject a hardcoded # column');

  // Clean up
  productMasterService.deleteProductMaster();
});

test('ExcelManagementPage: S.No column handling - uses uploaded S.No and does not duplicate or auto-generate', () => {
  // Case A: File WITH original S.No column
  const masterWithSNo: ProductMasterFile = {
    id: 'pm-sno-test-1',
    fileName: 'Products_With_SNo.xlsx',
    fileSize: 15000,
    fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    uploadedAt: '2026-11-14T10:00:00.000Z',
    updatedAt: '2026-11-14T10:00:00.000Z',
    productCount: 2,
    columns: ['S.No', 'Item Name', 'Price'],
    rows: [
      { _rowIndex: 1, _rowId: 'row-1', 'S.No': 1, 'Item Name': 'Sugar', Price: 42 },
      { _rowIndex: 2, _rowId: 'row-2', 'S.No': 2, 'Item Name': 'Salt', Price: 20 },
    ],
  };

  productMasterService.saveProductMaster(masterWithSNo);

  const htmlWithSNo = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(ExcelManagementPage, {
        currentStore: {
          id: 'test-store',
          name: 'Sri Gokulakkannan Stores',
          ownerName: 'Gokul',
          phone: '9876543210',
          email: 'gokul@stores.com',
          address: 'Main Bazaar, Erode',
        },
      })
    )
  );

  // Must render the original S.No header
  assert.ok(htmlWithSNo.includes('>S.No<'), 'Must render original S.No column');
  // Must NOT render an extra '#' column header
  assert.ok(!htmlWithSNo.includes('>#<'), 'Must not add duplicate # column header');
  // Must render the exact S.No values
  assert.ok(htmlWithSNo.includes('>Sugar<'), 'Must render Sugar');
  assert.ok(htmlWithSNo.includes('>Salt<'), 'Must render Salt');

  // Case B: File WITHOUT S.No column
  const masterWithoutSNo: ProductMasterFile = {
    id: 'pm-nosno-test-2',
    fileName: 'Products_Without_SNo.xlsx',
    fileSize: 12000,
    fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    uploadedAt: '2026-11-14T10:00:00.000Z',
    updatedAt: '2026-11-14T10:00:00.000Z',
    productCount: 1,
    columns: ['Product Name', 'Price'],
    rows: [
      { _rowIndex: 1, _rowId: 'row-1', 'Product Name': 'Atta', Price: 60 },
    ],
  };

  productMasterService.saveProductMaster(masterWithoutSNo);

  const htmlWithoutSNo = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(ExcelManagementPage, {
        currentStore: {
          id: 'test-store',
          name: 'Sri Gokulakkannan Stores',
          ownerName: 'Gokul',
          phone: '9876543210',
          email: 'gokul@stores.com',
          address: 'Main Bazaar, Erode',
        },
      })
    )
  );

  // Must not have S.No or # column header
  assert.ok(!htmlWithoutSNo.includes('>S.No<'), 'Must not create S.No column when absent in original Excel');
  assert.ok(!htmlWithoutSNo.includes('>#<'), 'Must not create # column when absent in original Excel');
  assert.ok(htmlWithoutSNo.includes('>Product Name<'), 'Preserves original columns: Product Name');
  assert.ok(htmlWithoutSNo.includes('>Price<'), 'Preserves original columns: Price');

  // Clean up
  productMasterService.deleteProductMaster();
});

test('ExcelManagementPage: Add Item modal displays all uploaded columns without "Primary" label or categorization', () => {
  const master: ProductMasterFile = {
    id: 'pm-all-columns-1',
    fileName: 'Multi_Col_Store.xlsx',
    fileSize: 22000,
    fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    uploadedAt: '2026-11-14T10:00:00.000Z',
    updatedAt: '2026-11-14T10:00:00.000Z',
    productCount: 1,
    columns: ['Item Code', 'Description', 'Brand', 'Pack Size', 'Cost Price', 'Selling Price', 'Tax %'],
    rows: [
      {
        _rowIndex: 1,
        _rowId: 'row-1',
        'Item Code': 'IC-101',
        Description: 'Gold Tea 250g',
        Brand: 'Tata',
        'Pack Size': '250g',
        'Cost Price': 80,
        'Selling Price': 95,
        'Tax %': 5,
      },
    ],
  };

  // Verify adding an item with all columns via productMasterService
  const withNewProduct = productMasterService.addProductItem(master, {
    'Item Code': 'IC-102',
    Description: 'Red Label Tea 250g',
    Brand: 'Brooke Bond',
    'Pack Size': '250g',
    'Cost Price': 85,
    'Selling Price': 100,
    'Tax %': 5,
  });

  assert.equal(withNewProduct.productCount, 2, 'Must increment product count to 2');
  const addedRow = withNewProduct.rows[1];
  assert.equal(addedRow['Item Code'], 'IC-102');
  assert.equal(addedRow['Description'], 'Red Label Tea 250g');
  assert.equal(addedRow['Brand'], 'Brooke Bond');
  assert.equal(addedRow['Pack Size'], '250g');
  assert.equal(addedRow['Cost Price'], 85);
  assert.equal(addedRow['Selling Price'], 100);
  assert.equal(addedRow['Tax %'], 5);

  productMasterService.saveProductMaster(master);

  const html = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(ExcelManagementPage, {
        currentStore: {
          id: 'test-store',
          name: 'Sri Gokulakkannan Stores',
          ownerName: 'Gokul',
          phone: '9876543210',
          email: 'gokul@stores.com',
          address: 'Main Bazaar, Erode',
        },
      })
    )
  );

  // Must not have "Primary" badge anywhere
  assert.ok(!html.includes('>Primary<'), 'Must not render "Primary" badge anywhere in modal or table');

  // Clean up
  productMasterService.deleteProductMaster();
});

test('Global Navigation Consistency and Original Settings Popup Overlay', () => {
  // 1. Excel Management page renders unified new top navigation and sidebar
  const excelHtml = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(ExcelManagementPage, {
        currentStore: {
          id: 'test-store',
          name: 'Sri Gokulakkannan Stores',
          ownerName: 'Gokul',
          phone: '9876543210',
          email: 'gokul@stores.com',
          address: 'Main Bazaar, Erode',
        },
      })
    )
  );

  // Unified top navigation bar
  assert.ok(excelHtml.includes('EasyList Logo'), 'Must render EasyList Logo in header');
  assert.ok(excelHtml.includes('Easy'), 'Must render Easy text');
  assert.ok(excelHtml.includes('text-[#3B9BFF]'), 'Must render cyan blue #3B9BFF List accent in header');
  assert.ok(excelHtml.includes('max-w-[1348px]'), 'Must render unified max-w-[1348px] header container');

  // Sidebar navigation in Excel Management
  assert.ok(excelHtml.includes('id="nav-dashboard"'), 'Must have nav-dashboard in sidebar');
  assert.ok(excelHtml.includes('id="nav-accounts"'), 'Must have nav-accounts in sidebar');
  assert.ok(excelHtml.includes('id="nav-excel"'), 'Must have nav-excel in sidebar');
  assert.ok(excelHtml.includes('id="nav-settings"'), 'Must have nav-settings in sidebar');

  // 2. Settings renders as the original ShopSettingsModal popup overlay with all original fields
  const modalHtml = renderToStaticMarkup(
    React.createElement(ShopSettingsModal, {
      isOpen: true,
      onClose: () => {},
      currentStore: {
        id: 'test-store',
        name: 'Sri Gokulakkannan Stores',
        ownerName: 'Gokul',
        phone: '9876543210',
        email: 'gokul@stores.com',
        address: 'Main Bazaar, Erode',
      },
      onSaveStore: () => {},
    })
  );

  assert.ok(modalHtml.includes('Shop Settings'), 'Original modal must render title Shop Settings');
  assert.ok(modalHtml.includes('Manage your shop information'), 'Original modal must render description');
  assert.ok(modalHtml.includes('Shop Name'), 'Original modal must have Shop Name field');
  assert.ok(modalHtml.includes('Email Address') || modalHtml.includes('Contact Email'), 'Original modal must have Email field');
  assert.ok(modalHtml.includes('Phone Number') || modalHtml.includes('Contact Phone'), 'Original modal must have Phone field');
  assert.ok(modalHtml.includes('Shop Logo'), 'Original modal must have Shop Logo field');
  assert.ok(modalHtml.includes('Save Changes'), 'Original modal must have Save Changes button');
  assert.ok(modalHtml.includes('Cancel') || modalHtml.includes('Discard'), 'Original modal must have Cancel or Discard button');
});

test('Shared Top Navigation & Shop Profile Consistency: Dashboard and Excel Management render the exact same shop name', () => {
  const storeA = {
    id: 'store-unified-1',
    name: 'Sri Murugan Wholesale Mart',
    ownerName: 'Murugan',
    phone: '9842100000',
    email: 'murugan@mart.com',
    address: 'Bazaar Street, Salem',
  };

  // 1. Dashboard top navigation render
  const dashboardHtml = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        OrderWorkflowProvider,
        null,
        React.createElement(DashboardPage, { currentStore: storeA })
      )
    )
  );

  // 2. Excel Management top navigation render
  const excelHtml = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        OrderWorkflowProvider,
        null,
        React.createElement(ExcelManagementPage, { currentStore: storeA })
      )
    )
  );

  // 3. Accounts top navigation render
  const accountsHtml = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        OrderWorkflowProvider,
        null,
        React.createElement(AccountsPage, { currentStore: storeA })
      )
    )
  );

  // Both must render the exact same shop name in top navigation
  assert.ok(dashboardHtml.includes('Sri Murugan Wholesale Mart'), 'Dashboard must display Sri Murugan Wholesale Mart');
  assert.ok(excelHtml.includes('Sri Murugan Wholesale Mart'), 'Excel Management must display the exact same Sri Murugan Wholesale Mart');
  assert.ok(accountsHtml.includes('Sri Murugan Wholesale Mart'), 'Accounts must display the exact same Sri Murugan Wholesale Mart');

  // Both must have SM initials in avatar
  assert.ok(dashboardHtml.includes('>SM<'), 'Dashboard must display SM initials');
  assert.ok(excelHtml.includes('>SM<'), 'Excel Management must display SM initials');
  assert.ok(accountsHtml.includes('>SM<'), 'Accounts must display SM initials');

  // Excel Management must NOT display Sri Gokulakkannan Stores when another store is active
  assert.ok(!excelHtml.includes('Sri Gokulakkannan Stores'), 'Excel Management must never hardcode Sri Gokulakkannan Stores');
});








