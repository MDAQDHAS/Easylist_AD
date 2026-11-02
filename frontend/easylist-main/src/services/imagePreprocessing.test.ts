import test from 'node:test';
import assert from 'node:assert/strict';
import { preprocessImageForOcr } from './imagePreprocessing';

test('preprocessImageForOcr: returns original file directly when file is already small (<800KB)', async () => {
  const smallBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const smallFile = new File([smallBytes], 'sample-order.png', { type: 'image/png' });

  const result = await preprocessImageForOcr(smallFile);
  assert.equal(result, smallFile, 'Small file must be returned directly without recompression');
  assert.equal(result.size, smallFile.size);
  assert.equal(result.name, 'sample-order.png');
});

test('preprocessImageForOcr: safely handles null, undefined, or empty files without throwing', async () => {
  // @ts-expect-error testing null safety
  const nullResult = await preprocessImageForOcr(null);
  assert.equal(nullResult, null);

  const emptyFile = new File([], 'empty.png', { type: 'image/png' });
  const emptyResult = await preprocessImageForOcr(emptyFile);
  assert.equal(emptyResult, emptyFile);
});

test('preprocessImageForOcr: falls back gracefully to original file in non-browser Node environments', async () => {
  // Create a 1MB file that triggers the size threshold in a Node test environment
  const largeBytes = new Uint8Array(900 * 1024);
  const largeFile = new File([largeBytes], 'camera-capture.jpg', { type: 'image/jpeg' });

  const result = await preprocessImageForOcr(largeFile);
  assert.ok(result instanceof File);
  assert.equal(result.name, 'camera-capture.jpg');
});
