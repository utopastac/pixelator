/**
 * Tests for `imageImport`. Only `layerNameFromFile` is testable under jsdom —
 * `importImageAsPixels` depends on `createImageBitmap`, which jsdom does not
 * implement, so it's skipped here.
 */
import { describe, expect, it } from 'vitest';
import { layerNameFromFile } from './imageImport';

function file(name: string): File {
  return new File([''], name, { type: 'image/png' });
}

describe('layerNameFromFile', () => {
  it('strips the extension', () => {
    expect(layerNameFromFile(file('photo.png'))).toBe('photo');
  });

  it('replaces runs of dashes and underscores with a single space', () => {
    expect(layerNameFromFile(file('my-photo.png'))).toBe('my photo');
    expect(layerNameFromFile(file('my_photo.png'))).toBe('my photo');
    expect(layerNameFromFile(file('a--b__c.png'))).toBe('a b c');
  });

  it('trims surrounding whitespace left by leading/trailing separators', () => {
    expect(layerNameFromFile(file('__photo__.png'))).toBe('photo');
  });

  it('clamps the result to 24 characters', () => {
    const long = 'a'.repeat(50) + '.png';
    expect(layerNameFromFile(file(long))).toBe('a'.repeat(24));
  });

  it('falls back to "Image" when the cleaned name is empty', () => {
    expect(layerNameFromFile(file('.png'))).toBe('Image');
    expect(layerNameFromFile(file('___.png'))).toBe('Image');
  });

  it('only strips the final extension, not earlier dots', () => {
    expect(layerNameFromFile(file('my.photo.v2.png'))).toBe('my.photo.v2');
  });
});
