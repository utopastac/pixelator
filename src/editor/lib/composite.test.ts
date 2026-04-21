/**
 * Tests for the pure flatten/composite helpers. The canvas-targeting
 * `compositeLayers` is skipped here — it requires a real canvas 2D context
 * which jsdom doesn't fully implement. The pure-pixel flatten path is what
 * exports and thumbnails rely on, so that's the invariant worth guarding.
 */
import { describe, expect, it } from 'vitest';
import { flattenLayers, compositeToSvg } from './composite';
import type { Layer } from '@/lib/storage';

const makeLayer = (
  id: string,
  pixels: string[],
  opts: { visible?: boolean; opacity?: number } = {},
): Layer => ({
  id,
  name: id,
  visible: opts.visible ?? true,
  opacity: opts.opacity ?? 1,
  pixels,
});

describe('flattenLayers', () => {
  it('returns an all-empty result for no layers', () => {
    const out = flattenLayers([], 2, 2);
    expect(out).toEqual(['', '', '', '']);
  });

  it('upper layer overwrites lower layer where both are opaque', () => {
    const bottom = makeLayer('a', ['#ff0000', '#ff0000', '#ff0000', '#ff0000']); // all red
    const top = makeLayer('b', ['', '', '#0000ff', '']);                          // one blue cell bottom-left
    expect(flattenLayers([bottom, top], 2, 2)).toEqual([
      '#ff0000', '#ff0000',
      '#0000ff', '#ff0000',
    ]);
  });

  it('lower layer shows through where upper cell is empty', () => {
    const bottom = makeLayer('a', ['#ff0000', '#ff0000', '#ff0000', '#ff0000']);
    const top = makeLayer('b', ['', '', '', '']); // fully transparent
    expect(flattenLayers([bottom, top], 2, 2)).toEqual([
      '#ff0000', '#ff0000',
      '#ff0000', '#ff0000',
    ]);
  });

  it('hidden layers are skipped entirely regardless of pixel contents', () => {
    const bottom = makeLayer('a', ['#ff0000', '', '', '']);
    const hiddenTop = makeLayer(
      'b',
      ['#0000ff', '#0000ff', '#0000ff', '#0000ff'],
      { visible: false },
    );
    expect(flattenLayers([bottom, hiddenTop], 2, 2)).toEqual([
      '#ff0000', '',
      '',        '',
    ]);
  });

  it('order in the array is bottom → top: last layer wins', () => {
    const a = makeLayer('a', ['#111111', '#111111', '#111111', '#111111']);
    const b = makeLayer('b', ['#222222', '#222222', '#222222', '#222222']);
    const c = makeLayer('c', ['#333333', '#333333', '#333333', '#333333']);
    expect(flattenLayers([a, b, c], 2, 2)).toEqual([
      '#333333', '#333333', '#333333', '#333333',
    ]);
  });
});

describe('compositeToSvg', () => {
  it('emits no <rect> for an all-empty composite', () => {
    const layer = makeLayer('a', ['', '', '', '']);
    const svg = compositeToSvg([layer], 2, 2);
    expect(svg).not.toMatch(/<rect/);
  });

  it('emits one <rect> per filled composite cell', () => {
    const bottom = makeLayer('a', ['#ff0000', '', '', '']);
    const top = makeLayer('b', ['', '#00ff00', '', '']);
    const svg = compositeToSvg([bottom, top], 2, 2);
    // Two filled cells in the composite → two rects.
    expect(svg.match(/<rect\b/g)).toHaveLength(2);
  });
});
