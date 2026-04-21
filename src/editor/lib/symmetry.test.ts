/**
 * Tests for `withSymmetry` — the pure cell-mirroring helper used by all
 * drawing tools to paint symmetrically. A 4×4 grid is used for most tests.
 */
import { describe, expect, it } from 'vitest';
import { withSymmetry } from './symmetry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stringify a cell pair so it can be used in Set comparisons. */
const key = (x: number, y: number) => `${x},${y}`;

/** Return the keys of every [x,y] pair in the output as a Set. */
function cellSet(cells: ReadonlyArray<[number, number]>): Set<string> {
  return new Set(cells.map(([x, y]) => key(x, y)));
}

/** Assert that the output contains no duplicate [x,y] pairs. */
function expectNoDuplicates(cells: [number, number][]) {
  expect(cells.length).toBe(cellSet(cells).size);
}

/** Assert every cell is within [0, w-1] × [0, h-1]. */
function expectInBounds(cells: [number, number][], w: number, h: number) {
  for (const [x, y] of cells) {
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(w - 1);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(h - 1);
  }
}

const W = 4;
const H = 4;

// ---------------------------------------------------------------------------
// 'none' mode
// ---------------------------------------------------------------------------

describe("withSymmetry — 'none' mode", () => {
  it('returns a copy of the input unchanged', () => {
    const input: [number, number][] = [[0, 0], [1, 2], [3, 3]];
    const result = withSymmetry(input, W, H, 'none');
    expect(result).toEqual(input);
  });

  it('does not return the same array reference', () => {
    const input: [number, number][] = [[1, 1]];
    const result = withSymmetry(input, W, H, 'none');
    expect(result).not.toBe(input);
  });

  it('does NOT deduplicate repeated input cells', () => {
    // 'none' is a straight slice() — duplicates are preserved
    const input: [number, number][] = [[1, 1], [1, 1]];
    const result = withSymmetry(input, W, H, 'none');
    expect(result).toHaveLength(2);
  });

  it('does NOT clamp out-of-bounds input (slice only)', () => {
    const input: [number, number][] = [[-1, 10]];
    const result = withSymmetry(input, W, H, 'none');
    // Still returned as-is — no clamping in none mode
    expect(result).toEqual([[-1, 10]]);
  });

  it('returns an empty array for empty input', () => {
    expect(withSymmetry([], W, H, 'none')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 'vertical' mode
// ---------------------------------------------------------------------------

describe("withSymmetry — 'vertical' mode", () => {
  it('mirrors each cell to (width-1-x, y)', () => {
    // (1, 2) should also produce (4-1-1, 2) = (2, 2)
    const result = withSymmetry([[1, 2]], W, H, 'vertical');
    const keys = cellSet(result);
    expect(keys.has(key(1, 2))).toBe(true);
    expect(keys.has(key(2, 2))).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('cells on the vertical axis (x === width-1-x) appear only once', () => {
    // For W=4: x === 4-1-x → 2x = 3, no integer solution — so use W=5.
    // With W=5 the vertical axis is x=2 (5-1-2 = 2).
    const result = withSymmetry([[2, 1]], 5, H, 'vertical');
    expectNoDuplicates(result);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([2, 1]);
  });

  it('does not add a horizontal mirror', () => {
    const result = withSymmetry([[0, 0]], W, H, 'vertical');
    const keys = cellSet(result);
    // (0, H-1-0) = (0, 3) should NOT appear
    expect(keys.has(key(0, 3))).toBe(false);
  });

  it('produces no duplicates for multiple input cells', () => {
    const input: [number, number][] = [[0, 0], [1, 1], [2, 2], [3, 3]];
    const result = withSymmetry(input, W, H, 'vertical');
    expectNoDuplicates(result);
  });

  it('returns empty for empty input', () => {
    expect(withSymmetry([], W, H, 'vertical')).toEqual([]);
  });

  it('all output cells are in bounds', () => {
    const result = withSymmetry([[0, 0], [3, 3]], W, H, 'vertical');
    expectInBounds(result, W, H);
  });
});

// ---------------------------------------------------------------------------
// 'horizontal' mode
// ---------------------------------------------------------------------------

describe("withSymmetry — 'horizontal' mode", () => {
  it('mirrors each cell to (x, height-1-y)', () => {
    // (1, 1) should also produce (1, 4-1-1) = (1, 2)
    const result = withSymmetry([[1, 1]], W, H, 'horizontal');
    const keys = cellSet(result);
    expect(keys.has(key(1, 1))).toBe(true);
    expect(keys.has(key(1, 2))).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('cells on the horizontal axis (y === height-1-y) appear only once', () => {
    // For H=5 the horizontal axis is y=2.
    const result = withSymmetry([[1, 2]], W, 5, 'horizontal');
    expectNoDuplicates(result);
    expect(result).toHaveLength(1);
  });

  it('does not add a vertical mirror', () => {
    const result = withSymmetry([[0, 0]], W, H, 'horizontal');
    const keys = cellSet(result);
    // (W-1-0, 0) = (3, 0) should NOT appear
    expect(keys.has(key(3, 0))).toBe(false);
  });

  it('produces no duplicates for multiple input cells', () => {
    const input: [number, number][] = [[0, 0], [1, 1], [2, 2], [3, 3]];
    const result = withSymmetry(input, W, H, 'horizontal');
    expectNoDuplicates(result);
  });

  it('returns empty for empty input', () => {
    expect(withSymmetry([], W, H, 'horizontal')).toEqual([]);
  });

  it('all output cells are in bounds', () => {
    const result = withSymmetry([[0, 0], [3, 3]], W, H, 'horizontal');
    expectInBounds(result, W, H);
  });
});

// ---------------------------------------------------------------------------
// 'both' mode
// ---------------------------------------------------------------------------

describe("withSymmetry — 'both' mode", () => {
  it('produces all four variants for an off-axis cell', () => {
    // (0, 0) with 4×4 → (0,0), (3,0), (0,3), (3,3)
    const result = withSymmetry([[0, 0]], W, H, 'both');
    const keys = cellSet(result);
    expect(keys.has(key(0, 0))).toBe(true);
    expect(keys.has(key(3, 0))).toBe(true);
    expect(keys.has(key(0, 3))).toBe(true);
    expect(keys.has(key(3, 3))).toBe(true);
    expect(result).toHaveLength(4);
  });

  it('cells on both axes appear only once (W=5, H=5: centre = (2,2))', () => {
    const result = withSymmetry([[2, 2]], 5, 5, 'both');
    expectNoDuplicates(result);
    expect(result).toHaveLength(1);
  });

  it('cell on vertical axis only (H=5: y=2 is centre) produces two unique cells', () => {
    // With W=4 there is no vertical centre. Use a cell on the horizontal centre only.
    // H=5: y=2 centre; W=4: no vertical centre.
    // (1, 2) → (1,2), (2,2), (1,2), (2,2) → deduped to (1,2) and (2,2)
    const result = withSymmetry([[1, 2]], W, 5, 'both');
    expectNoDuplicates(result);
    expect(result).toHaveLength(2);
  });

  it('produces no duplicates for multiple input cells', () => {
    const input: [number, number][] = [[0, 1], [2, 3]];
    const result = withSymmetry(input, W, H, 'both');
    expectNoDuplicates(result);
  });

  it('returns empty for empty input', () => {
    expect(withSymmetry([], W, H, 'both')).toEqual([]);
  });

  it('all output cells are in bounds', () => {
    const result = withSymmetry([[0, 0], [1, 2], [3, 3]], W, H, 'both');
    expectInBounds(result, W, H);
  });
});

// ---------------------------------------------------------------------------
// Out-of-bounds clamping (all symmetry modes except 'none')
// ---------------------------------------------------------------------------

describe('withSymmetry — out-of-bounds clamping', () => {
  it.each(['vertical', 'horizontal', 'both'] as const)(
    '%s mode: negative x is clamped to 0',
    (mode) => {
      const result = withSymmetry([[-5, 1]], W, H, mode);
      expectInBounds(result, W, H);
    },
  );

  it.each(['vertical', 'horizontal', 'both'] as const)(
    '%s mode: x >= width is clamped to width-1',
    (mode) => {
      const result = withSymmetry([[100, 1]], W, H, mode);
      expectInBounds(result, W, H);
    },
  );

  it.each(['vertical', 'horizontal', 'both'] as const)(
    '%s mode: y >= height is clamped to height-1',
    (mode) => {
      const result = withSymmetry([[1, 100]], W, H, mode);
      expectInBounds(result, W, H);
    },
  );

  it('clamping two distinct out-of-bounds cells that clamp to the same cell produces one output cell', () => {
    // Both (-1, 0) and (-5, 0) clamp to (0, 0) — should deduplicate to 1 cell.
    const result = withSymmetry([[-1, 0], [-5, 0]], W, H, 'vertical');
    // Clamped to (0,0) — mirror is (3,0) → at most 2 unique cells
    expectNoDuplicates(result);
  });
});

// ---------------------------------------------------------------------------
// No-duplicate guarantee (Set check)
// ---------------------------------------------------------------------------

describe('withSymmetry — result never contains duplicates', () => {
  it.each(['vertical', 'horizontal', 'both'] as const)(
    '%s: painting every cell in a 4×4 grid never produces duplicates',
    (mode) => {
      const allCells: [number, number][] = [];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          allCells.push([x, y]);
        }
      }
      const result = withSymmetry(allCells, W, H, mode);
      expectNoDuplicates(result);
    },
  );
});
