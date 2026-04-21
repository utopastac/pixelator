/**
 * Tests for the v1 → v2 storage migration. These guard the promise we made
 * in the Phase-2 plan: "loading a pre-existing drawing shows exactly the
 * same pixels". The round-trip assertion — pixelsToSvg → svgToPixels →
 * original pixels — is the single most important invariant; a bug there
 * silently loses every migrated drawing's contents.
 */
import { describe, expect, it } from 'vitest';
import { migrateDrawingV1ToV2, svgToPixels } from './migrate';
import { pixelsToSvg } from '@/editor/lib/pixelArtUtils';
import type { LegacyDrawingV1 } from './storage';

const PIXEL_SAMPLE = (() => {
  const w = 6;
  const h = 4;
  const pixels = new Array<string>(w * h).fill('');
  // Diagonal of dots + a single corner cell
  pixels[0 * w + 0] = '#ff0000';
  pixels[1 * w + 1] = '#00aa00';
  pixels[2 * w + 2] = '#0000ff';
  pixels[3 * w + 3] = '#ffff00';
  pixels[0 * w + 5] = '#000000';
  return { w, h, pixels };
})();

describe('svgToPixels', () => {
  it('round-trips pixelsToSvg output cleanly', () => {
    const { w, h, pixels } = PIXEL_SAMPLE;
    const svg = pixelsToSvg(pixels, w, h);
    expect(svgToPixels(svg, w, h)).toEqual(pixels);
  });

  it('returns an empty pixel array for an empty SVG string', () => {
    expect(svgToPixels('', 3, 2)).toEqual(['', '', '', '', '', '']);
  });

  it('ignores rects outside the declared grid bounds', () => {
    // Rect at (9, 9) lies outside a 3×3 grid and must be dropped silently
    // rather than writing past the array.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 3">
      <rect x="0" y="0" width="1" height="1" fill="#ff0000"/>
      <rect x="9" y="9" width="1" height="1" fill="#0000ff"/>
    </svg>`;
    const out = svgToPixels(svg, 3, 3);
    expect(out[0]).toBe('#ff0000');
    expect(out).toHaveLength(9);
  });
});

describe('migrateDrawingV1ToV2', () => {
  it('wraps legacy pixels in a single Background layer preserving dimensions', () => {
    const { w, h, pixels } = PIXEL_SAMPLE;
    const legacy: LegacyDrawingV1 = {
      id: 'abc',
      name: 'Test',
      width: w,
      height: h,
      svg: pixelsToSvg(pixels, w, h),
      createdAt: 100,
      updatedAt: 200,
    };
    const next = migrateDrawingV1ToV2(legacy);

    expect(next.id).toBe('abc');
    expect(next.name).toBe('Test');
    expect(next.width).toBe(w);
    expect(next.height).toBe(h);
    expect(next.createdAt).toBe(100);
    expect(next.updatedAt).toBe(200);
    expect(next.layers).toHaveLength(1);
    expect(next.layers[0].name).toBe('Background');
    expect(next.layers[0].visible).toBe(true);
    expect(next.layers[0].opacity).toBe(1);
    expect(next.layers[0].pixels).toEqual(pixels);
    expect(next.activeLayerId).toBe(next.layers[0].id);
  });

  it('produces an empty Background layer when the legacy svg is empty', () => {
    const legacy: LegacyDrawingV1 = {
      id: 'new',
      name: 'Blank',
      width: 4,
      height: 4,
      svg: '',
      createdAt: 0,
      updatedAt: 0,
    };
    const next = migrateDrawingV1ToV2(legacy);
    expect(next.layers[0].pixels).toHaveLength(16);
    expect(next.layers[0].pixels.every((p) => p === '')).toBe(true);
  });
});
