/**
 * Tests for the pixel-clipboard helpers (`src/lib/clipboard.ts`). The module
 * holds a single clip slot plus four pure helpers; the pure ones are the
 * load-bearing part of the Copy / Cut / Paste feature and deserve explicit
 * coverage. The slot-level API is exercised at the end to prove set/get/has
 * round-trip cleanly and that `__resetClipForTests` actually resets.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  __resetClipForTests,
  applyClipToNewLayer,
  buildClip,
  clearSelectionCells,
  getClip,
  hasClip,
  resolveAnchor,
  setClip,
  type PixelClip,
} from './clipboard';
import type { PixelArtSelection } from '@/editor/hooks/usePixelArtSelection';

// Canvas helper — 4×4 grid with a couple of distinctive cells.
const W = 4;
const H = 4;
const SAMPLE: string[] = [
  '#a', '#b', '#c', '#d',
  '#e', '#f', '#g', '#h',
  '#i', '#j', '#k', '#l',
  '#m', '#n', '#o', '#p',
];

function rectContains(sel: { x1: number; y1: number; x2: number; y2: number }) {
  const minX = Math.min(sel.x1, sel.x2);
  const maxX = Math.max(sel.x1, sel.x2);
  const minY = Math.min(sel.y1, sel.y2);
  const maxY = Math.max(sel.y1, sel.y2);
  return (col: number, row: number) =>
    col >= minX && col <= maxX && row >= minY && row <= maxY;
}

describe('buildClip', () => {
  it('returns a tight rect for a rect selection', () => {
    const sel: PixelArtSelection = { shape: 'rect', x1: 1, y1: 1, x2: 2, y2: 2 };
    const clip = buildClip(SAMPLE, W, H, sel, rectContains(sel), 'Art');
    expect(clip.width).toBe(2);
    expect(clip.height).toBe(2);
    expect(clip.pixels).toEqual(['#f', '#g', '#j', '#k']);
    expect(clip.sourceLayerName).toBe('Art');
  });

  it('bakes a mask selection into transparent cells outside the mask', () => {
    // Diagonal mask inside a 2×2 bbox — only (1,1) and (2,2) are set.
    const sel: PixelArtSelection = {
      shape: 'cells',
      x1: 1, y1: 1, x2: 2, y2: 2,
      cells: new Set([1 * W + 1, 2 * W + 2]),
    };
    const contains = (col: number, row: number) => sel.cells.has(row * W + col);
    const clip = buildClip(SAMPLE, W, H, sel, contains);
    expect(clip.width).toBe(2);
    expect(clip.height).toBe(2);
    // Row-major over the bbox: (1,1)=#f, (2,1)='' (masked), (1,2)='' (masked), (2,2)=#k.
    expect(clip.pixels).toEqual(['#f', '', '', '#k']);
  });

  it('clamps when the selection bbox extends past the canvas', () => {
    // UI guards against this, but the helper has to stay safe anyway.
    const sel: PixelArtSelection = { shape: 'rect', x1: 2, y1: 2, x2: 10, y2: 10 };
    const clip = buildClip(SAMPLE, W, H, sel, rectContains(sel));
    // Clipped bbox is (2,2)–(3,3) → 2×2.
    expect(clip.width).toBe(2);
    expect(clip.height).toBe(2);
    expect(clip.pixels).toEqual(['#k', '#l', '#o', '#p']);
  });
});

describe('clearSelectionCells', () => {
  it('returns a copy with masked cells blanked and leaves the rest untouched', () => {
    const sel: PixelArtSelection = { shape: 'rect', x1: 1, y1: 1, x2: 2, y2: 2 };
    const next = clearSelectionCells(SAMPLE, sel, W, H, rectContains(sel));
    expect(next[1 * W + 1]).toBe('');
    expect(next[2 * W + 2]).toBe('');
    expect(next[0]).toBe('#a');
    expect(next[3 * W + 3]).toBe('#p');
    // Input is untouched (defensive — callers rely on immutability).
    expect(SAMPLE[1 * W + 1]).toBe('#f');
  });
});

describe('applyClipToNewLayer', () => {
  it('places clip pixels at the anchor and drops cells outside the canvas', () => {
    const clip: PixelClip = {
      width: 2,
      height: 2,
      pixels: ['#x', '#y', '#z', '#w'],
    };
    const layer = applyClipToNewLayer(clip, W, H, { x: 3, y: 3 });
    // Only (3,3) is in-bounds; the rest of the 2×2 falls off the right/bottom edge.
    expect(layer[3 * W + 3]).toBe('#x');
    // Everything else is blank.
    const nonEmpty = layer.reduce((n, p) => (p ? n + 1 : n), 0);
    expect(nonEmpty).toBe(1);
  });

  it('skips empty-cell clips so partial-mask pastes stay transparent', () => {
    const clip: PixelClip = {
      width: 2,
      height: 2,
      pixels: ['#x', '', '', '#y'],
    };
    const layer = applyClipToNewLayer(clip, W, H, { x: 0, y: 0 });
    expect(layer[0]).toBe('#x');
    expect(layer[1]).toBe('');
    expect(layer[W]).toBe('');
    expect(layer[W + 1]).toBe('#y');
  });
});

describe('resolveAnchor', () => {
  it('returns the selection top-left when a selection is active', () => {
    const clip: PixelClip = { width: 2, height: 2, pixels: ['', '', '', ''] };
    const sel: PixelArtSelection = { shape: 'rect', x1: 3, y1: 1, x2: 1, y2: 3 };
    expect(resolveAnchor(clip, sel, W, H)).toEqual({ x: 1, y: 1 });
  });

  it('centres the clip on the canvas when no selection exists (integer floor)', () => {
    const clip: PixelClip = { width: 3, height: 3, pixels: new Array(9).fill('') };
    // (4 - 3) / 2 = 0.5 → floor → 0.
    expect(resolveAnchor(clip, null, W, H)).toEqual({ x: 0, y: 0 });
  });
});

describe('clipboard module state', () => {
  afterEach(() => __resetClipForTests());

  it('setClip / getClip / hasClip round-trip and reset clears the slot', () => {
    expect(hasClip()).toBe(false);
    expect(getClip()).toBeNull();

    const clip: PixelClip = { width: 1, height: 1, pixels: ['#ff0000'], sourceLayerName: 'L' };
    setClip(clip);
    expect(hasClip()).toBe(true);
    expect(getClip()).toEqual(clip);

    __resetClipForTests();
    expect(hasClip()).toBe(false);
    expect(getClip()).toBeNull();
  });
});
