import { describe, expect, it } from 'vitest';
import { rotatePixels90, translatePixels } from './transforms';

// Small helper: lay out a rectangular pixel grid from a string literal so the
// test fixtures read in the same orientation as the grid.
const grid = (rows: string[][]): string[] => rows.flat();

describe('rotatePixels90', () => {
  it('four CW rotations on a square return the original', () => {
    const src = grid([
      ['A', 'B', 'C'],
      ['D', 'E', 'F'],
      ['G', 'H', 'I'],
    ]);
    let r = src.slice();
    for (let i = 0; i < 4; i++) r = rotatePixels90(r, 3, 3, 'cw');
    expect(r).toEqual(src);
  });

  it('CW then CCW returns the original', () => {
    const src = grid([
      ['A', 'B', 'C'],
      ['D', 'E', 'F'],
      ['G', 'H', 'I'],
    ]);
    const cw = rotatePixels90(src, 3, 3, 'cw');
    const back = rotatePixels90(cw, 3, 3, 'ccw');
    expect(back).toEqual(src);
  });

  it('rotates a 3×3 fixture CW as expected', () => {
    const src = grid([
      ['A', 'B', 'C'],
      ['D', 'E', 'F'],
      ['G', 'H', 'I'],
    ]);
    const expected = grid([
      ['G', 'D', 'A'],
      ['H', 'E', 'B'],
      ['I', 'F', 'C'],
    ]);
    expect(rotatePixels90(src, 3, 3, 'cw')).toEqual(expected);
  });

  it('rotates a 3×3 fixture CCW as expected', () => {
    const src = grid([
      ['A', 'B', 'C'],
      ['D', 'E', 'F'],
      ['G', 'H', 'I'],
    ]);
    const expected = grid([
      ['C', 'F', 'I'],
      ['B', 'E', 'H'],
      ['A', 'D', 'G'],
    ]);
    expect(rotatePixels90(src, 3, 3, 'ccw')).toEqual(expected);
  });

  it('clips non-square (4×2) — cells outside the rotated region become transparent', () => {
    const src = grid([
      ['A', 'B', 'C', 'D'],
      ['E', 'F', 'G', 'H'],
    ]);
    const out = rotatePixels90(src, 4, 2, 'cw');
    // Corners that rotate outside the 4×2 footprint are dropped; only the
    // centred 2×2 block survives the rotation.
    expect(out[0 * 4 + 0]).toBe('');
    expect(out[0 * 4 + 3]).toBe('');
    expect(out[1 * 4 + 0]).toBe('');
    expect(out[1 * 4 + 3]).toBe('');
    // Central cells carry rotated colours (non-empty).
    expect(out[0 * 4 + 1]).not.toBe('');
    expect(out[0 * 4 + 2]).not.toBe('');
  });

  it('with a bbox: cells outside the bbox are untouched', () => {
    const src = grid([
      ['.', '.', '.', '.'],
      ['.', 'A', 'B', '.'],
      ['.', 'C', 'D', '.'],
      ['.', '.', '.', '.'],
    ]);
    const out = rotatePixels90(src, 4, 4, 'cw', { x1: 1, y1: 1, x2: 2, y2: 2 });
    // Border cells (the dots) must not change.
    for (const i of [0, 1, 2, 3, 4, 7, 8, 11, 12, 13, 14, 15]) {
      expect(out[i]).toBe('.');
    }
  });

  it('with a bbox: inside rotates CW', () => {
    const src = grid([
      ['.', '.', '.', '.'],
      ['.', 'A', 'B', '.'],
      ['.', 'C', 'D', '.'],
      ['.', '.', '.', '.'],
    ]);
    const out = rotatePixels90(src, 4, 4, 'cw', { x1: 1, y1: 1, x2: 2, y2: 2 });
    // A 2×2 rotates: A B / C D  →  C A / D B
    expect(out[1 * 4 + 1]).toBe('C');
    expect(out[1 * 4 + 2]).toBe('A');
    expect(out[2 * 4 + 1]).toBe('D');
    expect(out[2 * 4 + 2]).toBe('B');
  });

  it('with a non-square bbox: clips corners that fall outside the bbox', () => {
    const src = grid([
      ['.', '.', '.', '.', '.'],
      ['.', 'A', 'B', 'C', 'D'],
      ['.', 'E', 'F', 'G', 'H'],
      ['.', '.', '.', '.', '.'],
    ]);
    // Rotating a 4×2 bbox CW — only the middle columns survive.
    const out = rotatePixels90(src, 5, 4, 'cw', { x1: 1, y1: 1, x2: 4, y2: 2 });
    // Leftmost and rightmost bbox columns at each row become '' (outside rotated region).
    expect(out[1 * 5 + 1]).toBe('');
    expect(out[1 * 5 + 4]).toBe('');
    expect(out[2 * 5 + 1]).toBe('');
    expect(out[2 * 5 + 4]).toBe('');
    // Outside-bbox cells are still untouched.
    expect(out[0 * 5 + 0]).toBe('.');
    expect(out[3 * 5 + 4]).toBe('.');
  });

  it('normalises a reversed bbox (x1>x2, y1>y2)', () => {
    const src = grid([
      ['.', '.', '.', '.'],
      ['.', 'A', 'B', '.'],
      ['.', 'C', 'D', '.'],
      ['.', '.', '.', '.'],
    ]);
    const forward = rotatePixels90(src, 4, 4, 'cw', { x1: 1, y1: 1, x2: 2, y2: 2 });
    const reversed = rotatePixels90(src, 4, 4, 'cw', { x1: 2, y1: 2, x2: 1, y2: 1 });
    expect(reversed).toEqual(forward);
  });
});

describe('translatePixels', () => {
  it('shifts right by (1, 0); leftmost column becomes transparent', () => {
    const src = grid([
      ['A', 'B', 'C'],
      ['D', 'E', 'F'],
    ]);
    const out = translatePixels(src, 3, 2, 1, 0);
    expect(out).toEqual(grid([
      ['', 'A', 'B'],
      ['', 'D', 'E'],
    ]));
  });

  it('shifts left by (-1, 0); rightmost column becomes transparent', () => {
    const src = grid([
      ['A', 'B', 'C'],
      ['D', 'E', 'F'],
    ]);
    const out = translatePixels(src, 3, 2, -1, 0);
    expect(out).toEqual(grid([
      ['B', 'C', ''],
      ['E', 'F', ''],
    ]));
  });

  it('shifts down by (0, 1); top row becomes transparent', () => {
    const src = grid([
      ['A', 'B'],
      ['C', 'D'],
    ]);
    const out = translatePixels(src, 2, 2, 0, 1);
    expect(out).toEqual(grid([
      ['', ''],
      ['A', 'B'],
    ]));
  });

  it('shifts up by (0, -1); bottom row becomes transparent', () => {
    const src = grid([
      ['A', 'B'],
      ['C', 'D'],
    ]);
    const out = translatePixels(src, 2, 2, 0, -1);
    expect(out).toEqual(grid([
      ['C', 'D'],
      ['', ''],
    ]));
  });

  it('discards pixels moved off-canvas', () => {
    const src = grid([
      ['A', 'B'],
      ['C', 'D'],
    ]);
    const out = translatePixels(src, 2, 2, 5, 5);
    expect(out).toEqual(grid([
      ['', ''],
      ['', ''],
    ]));
  });

  it('with mask: only masked cells move; unmasked cells unchanged', () => {
    const src = grid([
      ['A', 'B', 'C'],
      ['D', 'E', 'F'],
      ['G', 'H', 'I'],
    ]);
    // Mask covers only the centre cell.
    const out = translatePixels(src, 3, 3, 1, 0, {
      bbox: { x1: 1, y1: 1, x2: 1, y2: 1 },
      contains: (c, r) => c === 1 && r === 1,
    });
    // Centre E vacated → ''; shifted into (2, 1), overwriting F.
    expect(out[1 * 3 + 1]).toBe('');
    expect(out[1 * 3 + 2]).toBe('E');
    // Every other cell untouched.
    expect(out[0]).toBe('A');
    expect(out[1]).toBe('B');
    expect(out[2]).toBe('C');
    expect(out[3]).toBe('D');
    expect(out[6]).toBe('G');
    expect(out[7]).toBe('H');
    expect(out[8]).toBe('I');
  });

  it('with mask: source cells vacated by the move become transparent', () => {
    const src = grid([
      ['A', 'B', 'C'],
      ['D', 'E', 'F'],
    ]);
    // Mask covers the whole top row.
    const out = translatePixels(src, 3, 2, 0, 1, {
      bbox: { x1: 0, y1: 0, x2: 2, y2: 0 },
      contains: (_c, r) => r === 0,
    });
    // Top row vacated → '' everywhere; bottom row gets A/B/C (overwriting D/E/F).
    expect(out).toEqual(grid([
      ['', '', ''],
      ['A', 'B', 'C'],
    ]));
  });
});
