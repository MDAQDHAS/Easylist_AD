import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OrderUpload } from '../upload/OrderUpload';
import { ExtractedItemsTable } from './ExtractedItemsTable';
import { OrderItem } from '../../types/order';

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

