import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PaperToDigitalOcrAnimation } from './PaperToDigitalOcrAnimation';
import { ScanProgressUpdate } from '../../services/ocrService';

test('PaperToDigitalOcrAnimation: renders exact 3-icon horizontal row with transparent background', () => {
  const html = renderToStaticMarkup(
    React.createElement(PaperToDigitalOcrAnimation, {
      progress: null,
      uploadedImagesCount: 1,
    })
  );

  // Background must be completely transparent
  assert.ok(html.includes('bg-transparent'), 'Must use completely transparent background');

  // Must NOT contain card, modal, or overlay styling
  assert.ok(!html.includes('bg-[#111C35]/50'), 'Must not have darkened backdrop overlay');
  assert.ok(!html.includes('shadow-2xl'), 'Must not have heavy card shadow');
  assert.ok(!html.includes('max-w-sm'), 'Must not use card container');

  // Must render all three icons
  assert.ok(html.includes('Handwritten paper'), 'Must render left handwritten paper icon');
  assert.ok(html.includes('Converting arrow'), 'Must render center converting arrow icon');
  assert.ok(html.includes('Digital text'), 'Must render right digital text icon');

  // Must include animation classes
  assert.ok(html.includes('handwritten-line-1'), 'Must include handwritten line animation');
  assert.ok(html.includes('converting-arrow-top'), 'Must include converting arrow animation');
  assert.ok(html.includes('digital-line-1'), 'Must include digital line animation');

  // Must NOT include old cards, progress bars or text
  assert.ok(!html.includes('Extracting your order'), 'Must not have old heading');
  assert.ok(!html.includes('Paper Chit'), 'Must not have old chit list');
  assert.ok(!html.includes('w-52'), 'Must not have old progress bar');
});

test('PaperToDigitalOcrAnimation: displays animated converting indicator when genuine percentage is unavailable', () => {
  const html = renderToStaticMarkup(
    React.createElement(PaperToDigitalOcrAnimation, {
      progress: null,
      uploadedImagesCount: 1,
    })
  );

  // Must NOT display a fake or invented percentage
  assert.ok(!html.includes('%</span>'), 'Must not invent fake percentage');

  // Must render the animated converting indicator
  assert.ok(
    html.includes('id="ocr-converting-indicator"'),
    'Must display animated converting indicator'
  );
  assert.ok(html.includes('animate-bounce'), 'Must animate converting indicator');
});

test('PaperToDigitalOcrAnimation: displays genuine percentage when available', () => {
  const genuineProgress: ScanProgressUpdate = {
    stageNumber: 2,
    stageName: 'Reading handwriting',
    detail: 'Reading handwriting with Gemini AI...',
    percent: 45,
  };

  const html = renderToStaticMarkup(
    React.createElement(PaperToDigitalOcrAnimation, {
      progress: genuineProgress,
      uploadedImagesCount: 1,
    })
  );

  // Must display 45%
  assert.ok(html.includes('45%'), 'Must display genuine 45%');
  assert.ok(
    html.includes('id="ocr-display-percentage"'),
    'Must render percentage element'
  );
  assert.ok(!html.includes('id="ocr-converting-indicator"'), 'Must not show indicator when percentage is present');
});

test('PaperToDigitalOcrAnimation: displays 100% on complete', () => {
  const html = renderToStaticMarkup(
    React.createElement(PaperToDigitalOcrAnimation, {
      progress: {
        stageNumber: 4,
        stageName: 'Completed',
        detail: 'Done',
        percent: 100,
      },
      uploadedImagesCount: 1,
      isComplete: true,
    })
  );

  // Must display 100%
  assert.ok(html.includes('100%'), 'Must display 100% upon completion');
});
