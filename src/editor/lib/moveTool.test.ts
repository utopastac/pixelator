import { describe, expect, it } from 'vitest';
import { translatePixels } from './transforms';

// The Move tool composes `translatePixels` with a selection-contains mask for
// selection-active drags and arrow-key nudges, and calls the unmasked variant
// for whole-layer moves. These tests document the exact pixel output the
// pointer/keyboard paths expect so regressions in either call site can be
// caught without rendering a React tree.

const grid = (rows: string[][]): string[] => rows.flat();

function rectContains(x1: number, y1: number, x2: number, y2: number) {
  const mnX = Math.min(x1, x2), mxX = Math.max(x1, x2);
  const mnY = Math.min(y1, y2), mxY = Math.max(y1, y2);
  return (c: number, r: number) => c >= mnX && c <= mxX && r >= mnY && r <= mxY;
}

describe('Move tool (whole-layer drag)', () => {
  it('translates every painted cell by (dx, dy); vacated cells become transparent', () => {
    const src = grid([
      ['A', 'B', 'C'],
      ['D', 'E', 'F'],
      ['G', 'H', 'I'],
    ]);
    const out = translatePixels(src, 3, 3, 1, 1);
    // Everything shifts down-right by 1; top row + left column vacated.
    expect(out).toEqual(grid([
      ['', '', ''],
      ['', 'A', 'B'],
      ['', 'D', 'E'],
    ]));
  });

  it('a zero-delta drag returns a copy of the original pixels', () => {
    const src = grid([
      ['A', 'B'],
      ['C', 'D'],
    ]);
    const out = translatePixels(src, 2, 2, 0, 0);
    expect(out).toEqual(src);
    // Non-mutating: the return is a fresh array.
    expect(out).not.toBe(src);
  });
});

describe('Move tool (selection-masked drag)', () => {
  it('only cells inside the selection translate; outside cells untouched', () => {
    const src = grid([
      ['.', '.', '.', '.'],
      ['.', 'A', 'B', '.'],
      ['.', 'C', 'D', '.'],
      ['.', '.', '.', '.'],
    ]);
    // Selection is the central 2×2 block.
    const out = translatePixels(src, 4, 4, 1, 0, {
      bbox: { x1: 1, y1: 1, x2: 2, y2: 2 },
      contains: rectContains(1, 1, 2, 2),
    });
    // A/B/C/D shift right by 1; their originals become transparent.
    expect(out).toEqual(grid([
      ['.', '.', '.', '.'],
      ['.', '', 'A', 'B'],
      ['.', '', 'C', 'D'],
      ['.', '.', '.', '.'],
    ]));
  });

  it('a normalised reversed bbox produces the same output as the normal one', () => {
    const src = grid([
      ['A', 'B', 'C'],
      ['D', 'E', 'F'],
      ['G', 'H', 'I'],
    ]);
    const forward = translatePixels(src, 3, 3, 0, 1, {
      bbox: { x1: 0, y1: 0, x2: 2, y2: 1 },
      contains: rectContains(0, 0, 2, 1),
    });
    const reversed = translatePixels(src, 3, 3, 0, 1, {
      bbox: { x1: 2, y1: 1, x2: 0, y2: 0 },
      contains: rectContains(2, 1, 0, 0),
    });
    expect(reversed).toEqual(forward);
  });
});

describe('Move tool selection-rect clamping', () => {
  // Mirrors the inline clamp used in handleMouseUp / the arrow-nudge path.
  const clampSelection = (
    sel: { x1: number; y1: number; x2: number; y2: number },
    dx: number,
    dy: number,
    width: number,
    height: number,
  ) => {
    const clampX = (v: number) => Math.max(0, Math.min(width - 1, v));
    const clampY = (v: number) => Math.max(0, Math.min(height - 1, v));
    return {
      x1: clampX(sel.x1 + dx),
      y1: clampY(sel.y1 + dy),
      x2: clampX(sel.x2 + dx),
      y2: clampY(sel.y2 + dy),
    };
  };

  it('translates a selection rect and keeps it in-bounds', () => {
    const next = clampSelection({ x1: 1, y1: 1, x2: 3, y2: 3 }, 2, 2, 8, 8);
    expect(next).toEqual({ x1: 3, y1: 3, x2: 5, y2: 5 });
  });

  it('clamps both corners to the grid when the drag would push the selection off-canvas', () => {
    // Push a 3x3 selection far past the right/bottom edge of an 8x8 grid.
    const next = clampSelection({ x1: 5, y1: 5, x2: 7, y2: 7 }, 10, 10, 8, 8);
    expect(next).toEqual({ x1: 7, y1: 7, x2: 7, y2: 7 });
  });

  it('clamps negative drags so the selection can be nudged against 0,0', () => {
    const next = clampSelection({ x1: 1, y1: 1, x2: 3, y2: 3 }, -5, -5, 8, 8);
    expect(next).toEqual({ x1: 0, y1: 0, x2: 0, y2: 0 });
  });
});
