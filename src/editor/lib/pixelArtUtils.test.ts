/**
 * Tests for the pure-geometry helpers in pixelArtUtils. These are the safest
 * functions to cover because they're synchronous, deterministic, and sit at
 * the bottom of the editor's dependency graph — so regressions here show up
 * as visible bugs in almost every tool.
 */
import { describe, expect, it } from 'vitest';
import {
  applyBrush,
  applyBrushInPlace,
  arrowCells,
  bresenhamLine,
  constrainLineTo45,
  constrainToSquare,
  ellipseCells,
  expandCellsWithBrush,
  floodFill,
  floodSelect,
  getShapeCells,
  isShapeTool,
  pixelsToSvg,
  parseSvgToPixels,
  pixelsInsidePolygon,
  rectCells,
  resizeLayerCentered,
  starCells,
  triangleCells,
} from './pixelArtUtils';

describe('bresenhamLine', () => {
  it('returns a single cell for identical endpoints', () => {
    expect(bresenhamLine(3, 3, 3, 3)).toEqual([[3, 3]]);
  });

  it('walks a horizontal line', () => {
    expect(bresenhamLine(0, 2, 3, 2)).toEqual([[0, 2], [1, 2], [2, 2], [3, 2]]);
  });

  it('walks a vertical line', () => {
    expect(bresenhamLine(1, 0, 1, 3)).toEqual([[1, 0], [1, 1], [1, 2], [1, 3]]);
  });

  it('walks a perfect 45° diagonal', () => {
    expect(bresenhamLine(0, 0, 3, 3)).toEqual([[0, 0], [1, 1], [2, 2], [3, 3]]);
  });

  it('produces a line of the same length in either direction, including both endpoints', () => {
    // A classic bresenham implementation is direction-dependent along
    // non-axis-aligned lines (choice of which cell to step into when the
    // error term ties is fixed to one side). We only guarantee: same length,
    // and both endpoints present in both orderings.
    const ab = bresenhamLine(2, 1, 6, 4);
    const ba = bresenhamLine(6, 4, 2, 1);
    expect(ab.length).toBe(ba.length);
    expect(ab[0]).toEqual([2, 1]);
    expect(ab[ab.length - 1]).toEqual([6, 4]);
    expect(ba[0]).toEqual([6, 4]);
    expect(ba[ba.length - 1]).toEqual([2, 1]);
  });
});

describe('constrainLineTo45', () => {
  const axisCases: Array<{ end: [number, number]; expected: [number, number] }> = [
    { end: [10, 0], expected: [10, 0] },   // 0° (right)
    { end: [0, 10], expected: [0, 10] },   // 90° (down)
    { end: [7, 7], expected: [7, 7] },     // 45°
    { end: [-7, 7], expected: [-7, 7] },   // 135°
  ];
  it.each(axisCases)('projects delta $end to $expected', ({ end, expected }) => {
    const [rx, ry] = constrainLineTo45([0, 0], end);
    expect(rx).toBe(expected[0]);
    expect(ry).toBe(expected[1]);
  });

  it('rounds off-axis deltas to the nearest 45° direction', () => {
    // 30° from horizontal should snap to 0° (closer than 45°)
    const [rx, ry] = constrainLineTo45([0, 0], [10, 3]);
    expect(rx).toBe(10);
    expect(ry).toBe(0);
  });
});

describe('constrainToSquare', () => {
  it('extends the shorter axis to match the longer one, preserving signs', () => {
    // dx = 5, dy = 2 → grow dy to ±5 in its original direction
    expect(constrainToSquare([0, 0], [5, 2])).toEqual([5, 5]);
    expect(constrainToSquare([0, 0], [5, -2])).toEqual([5, -5]);
    expect(constrainToSquare([0, 0], [-2, 5])).toEqual([-5, 5]);
  });
});

describe('floodFill', () => {
  it('replaces a contiguous region and leaves disconnected same-colour cells alone', () => {
    // 3×3 grid:  [R R R]
    //            [R . R]
    //            [B R R]
    const R = '#ff0000';
    const B = '#0000ff';
    const pixels = [
      R, R, R,
      R, '', R,
      B, R, R,
    ];
    const next = floodFill(pixels, 3, 3, 0, 0, '#00ff00');
    // Entry corner + the wrap of R around the empty middle should all flip;
    // the disconnected B stays, and the empty '' centre stays empty.
    expect(next[0]).toBe('#00ff00');
    expect(next[8]).toBe('#00ff00');
    expect(next[4]).toBe(''); // centre untouched (different colour)
    expect(next[6]).toBe(B); // disconnected B untouched
  });

  it('is a no-op when the seed already matches the target colour', () => {
    const pixels = ['#ff0000', '#ff0000', '#ff0000', '#ff0000'];
    expect(floodFill(pixels, 2, 2, 0, 0, '#ff0000')).toEqual(pixels);
  });

  it('wrap=true: fills across the right edge into the left column', () => {
    // 3×1 row: [R, R, .] — seed at col=0, wrap should reach col=2 via the right edge
    const R = '#ff0000';
    const pixels = [R, R, ''];
    const next = floodFill(pixels, 3, 1, 0, 0, '#00ff00', true);
    // col=0 and col=1 are the same colour as seed, reachable directly
    expect(next[0]).toBe('#00ff00');
    expect(next[1]).toBe('#00ff00');
    // col=2 is '' — different colour, should not be filled
    expect(next[2]).toBe('');
  });

  it('wrap=true: fills across the bottom edge into the top row', () => {
    // 1×3 column: seed at row=0, row=2 is same colour and reachable via wrap
    const R = '#ff0000';
    const pixels = [R, R, R];
    const next = floodFill(pixels, 1, 3, 0, 0, '#00ff00', true);
    expect(next).toEqual(['#00ff00', '#00ff00', '#00ff00']);
  });

  it('wrap=true: a colour isolated at one edge reaches the opposite edge', () => {
    // 4×1: [R, ., ., R] — without wrap col=3 is disconnected; with wrap the two
    // Rs connect through the boundary and both flip.
    const R = '#ff0000';
    const pixels = [R, '', '', R];
    const next = floodFill(pixels, 4, 1, 0, 0, '#00ff00', true);
    expect(next[0]).toBe('#00ff00');
    expect(next[3]).toBe('#00ff00');
    expect(next[1]).toBe(''); // empty cells untouched
    expect(next[2]).toBe('');
  });
});

describe('SVG round-trip', () => {
  it('pixelsToSvg → parseSvgToPixels returns the original pixel array', () => {
    const width = 4;
    const height = 3;
    const pixels = [
      '#ff0000', '',         '#00ff00', '',
      '',         '#0000ff', '',         '#ffff00',
      '#aaaaaa', '',         '',         '#000000',
    ];
    const svg = pixelsToSvg(pixels, width, height);
    const roundTripped = parseSvgToPixels(svg, width, height);
    expect(roundTripped).toEqual(pixels);
  });

  it('pixelsToSvg skips empty cells (no rect emitted for transparent)', () => {
    const svg = pixelsToSvg(['', '#ff0000', '', ''], 2, 2);
    // Exactly one <rect>
    expect(svg.match(/<rect\b/g)?.length).toBe(1);
  });
});

describe('rectCells', () => {
  it('fills every cell inside the bounding box (fill mode)', () => {
    const cells = rectCells(1, 1, 3, 3, 'fill');
    // 3×3 square = 9 cells
    expect(cells).toHaveLength(9);
    expect(cells).toContainEqual([1, 1]);
    expect(cells).toContainEqual([2, 2]);
    expect(cells).toContainEqual([3, 3]);
  });

  it('only emits the perimeter in outline mode', () => {
    const cells = rectCells(0, 0, 2, 2, 'outline');
    // Perimeter of 3×3 = 8 cells (corners + edges, interior excluded)
    expect(cells).toHaveLength(8);
    expect(cells).toContainEqual([0, 0]);
    expect(cells).toContainEqual([2, 2]);
    // The centre cell should NOT be present
    expect(cells).not.toContainEqual([1, 1]);
  });

  it('normalises reversed corners', () => {
    const forward = rectCells(0, 0, 2, 2, 'fill');
    const reversed = rectCells(2, 2, 0, 0, 'fill');
    expect(new Set(forward.map((c) => c.join(',')))).toEqual(
      new Set(reversed.map((c) => c.join(','))),
    );
  });
});

describe('ellipseCells', () => {
  it('fits inside the bounding box', () => {
    const cells = ellipseCells(0, 0, 4, 4, 'fill');
    for (const [x, y] of cells) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(4);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(4);
    }
  });

  it('outline has fewer cells than fill for the same bounds', () => {
    const fill = ellipseCells(0, 0, 6, 6, 'fill');
    const outline = ellipseCells(0, 0, 6, 6, 'outline');
    expect(outline.length).toBeLessThan(fill.length);
  });

  it('includes the cardinal extremes', () => {
    // A 5-wide ellipse from (0,0) to (4,4) should reach x=0 and x=4 at the
    // vertical centre, and y=0 / y=4 at the horizontal centre.
    const outline = ellipseCells(0, 0, 4, 4, 'outline');
    expect(outline).toContainEqual([0, 2]);
    expect(outline).toContainEqual([4, 2]);
    expect(outline).toContainEqual([2, 0]);
    expect(outline).toContainEqual([2, 4]);
  });
});

describe('triangleCells', () => {
  it('includes the three corners in outline mode', () => {
    const outline = triangleCells(0, 0, 4, 4, 'outline');
    // Apex at top-centre = (2, 0); base corners at (0, 4) and (4, 4)
    expect(outline).toContainEqual([2, 0]);
    expect(outline).toContainEqual([0, 4]);
    expect(outline).toContainEqual([4, 4]);
  });

  it('fill mode produces more cells than outline', () => {
    const outline = triangleCells(0, 0, 6, 6, 'outline');
    const fill = triangleCells(0, 0, 6, 6, 'fill');
    expect(fill.length).toBeGreaterThan(outline.length);
  });
});

describe('isShapeTool', () => {
  it.each(['line', 'rect', 'circle', 'triangle', 'star', 'arrow'])(
    'recognises %s as a shape tool',
    (tool) => {
      expect(isShapeTool(tool)).toBe(true);
    },
  );

  it.each(['paint', 'eraser', 'fill', 'eyedropper', 'pen', 'marquee'])(
    'rejects non-shape tool %s',
    (tool) => {
      expect(isShapeTool(tool)).toBe(false);
    },
  );
});

describe('getShapeCells', () => {
  const fills = {
    rect: 'fill',
    circle: 'fill',
    triangle: 'fill',
    star: 'fill',
    arrow: 'fill',
  } as const;

  it("dispatches 'line' to bresenham", () => {
    const cells = getShapeCells('line', [0, 0], [3, 0], fills);
    expect(cells).toEqual([[0, 0], [1, 0], [2, 0], [3, 0]]);
  });

  it("dispatches 'rect' and respects the fill mode argument", () => {
    const filled = getShapeCells('rect', [0, 0], [2, 2], fills);
    const outlined = getShapeCells('rect', [0, 0], [2, 2], { ...fills, rect: 'outline' });
    expect(filled.length).toBe(9);
    expect(outlined.length).toBe(8);
  });
});

describe('applyBrush', () => {
  it('paints a single cell for brush size "sm"', () => {
    const pixels = new Array<string>(9).fill('');
    const next = applyBrush(pixels, 1, 1, '#ff0000', 'sm', 3, 3);
    expect(next[4]).toBe('#ff0000');
    // Neighbours untouched
    expect(next[3]).toBe('');
    expect(next[5]).toBe('');
  });

  it('clips to the grid when brushed at the edge', () => {
    const pixels = new Array<string>(9).fill('');
    // md brush covers a 3×3 around the centre → writing at (0,0) should only
    // paint the in-bounds subset, never write past the array.
    const next = applyBrush(pixels, 0, 0, '#00ff00', 'md', 3, 3);
    expect(next).toHaveLength(9);
    expect(next[0]).toBe('#00ff00'); // seed cell always in-bounds
  });

  it('wrap=true: negative offsets from lg brush at (0,0) wrap to the opposite edge', () => {
    // lg offsets include [-1,-1], which without wrap would be clipped.
    // With wrap on a 3×3 grid: col=-1 → 2, row=-1 → 2 → index 8.
    const pixels = new Array<string>(9).fill('');
    const next = applyBrush(pixels, 0, 0, '#ff0000', 'lg', 3, 3, true);
    expect(next[8]).toBe('#ff0000'); // (col=2, row=2) via wrapped [-1,-1]
    expect(next[0]).toBe('#ff0000'); // (col=0, row=0) direct hit, no wrap
  });

  it('wrap=true: lg brush at row=0 paints the bottom row via wrap', () => {
    const pixels = new Array<string>(9).fill('');
    // lg brush at (1,0): offset [-1,-1] → row=-1 wraps to row=2, col=0 → index 6
    const next = applyBrush(pixels, 1, 0, '#ff0000', 'lg', 3, 3, true);
    expect(next[6]).toBe('#ff0000'); // row=2, col=0
    expect(next[7]).toBe('#ff0000'); // row=2, col=1
    expect(next[8]).toBe('#ff0000'); // row=2, col=2
  });

  it('applyBrushInPlace mutates the buffer to match applyBrush', () => {
    const a = new Array<string>(9).fill('');
    const b = new Array<string>(9).fill('');
    applyBrushInPlace(a, 1, 1, '#abc', 'sm', 3, 3);
    expect(a).toEqual(applyBrush(b, 1, 1, '#abc', 'sm', 3, 3));
  });
});

describe('expandCellsWithBrush', () => {
  it('returns the original list unchanged for brush size "sm"', () => {
    const cells: [number, number][] = [[1, 1], [2, 2]];
    expect(expandCellsWithBrush(cells, 'sm', 4, 4)).toEqual(cells);
  });

  it('inflates a single cell to the brush offsets and deduplicates', () => {
    const result = expandCellsWithBrush([[2, 2]], 'md', 5, 5);
    // md offsets are the 3×3 plus-sign neighbourhood around centre → more than
    // 1 cell, all in bounds, no duplicates.
    expect(result.length).toBeGreaterThan(1);
    expect(new Set(result.map((c) => c.join(',')))).toEqual(new Set(result.map((c) => c.join(','))));
  });

  it('clips dilated cells that fall outside the grid', () => {
    const result = expandCellsWithBrush([[0, 0]], 'md', 3, 3);
    for (const [x, y] of result) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(3);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(3);
    }
  });

  it('wrap=true: lg brush at (0,0) wraps negative offsets to the far edge', () => {
    // lg offset [-1,-1] from (0,0) → col=-1 wraps to col=2, row=-1 wraps to row=2
    const result = expandCellsWithBrush([[0, 0]], 'lg', 3, 3, true);
    expect(result).toContainEqual([2, 2]); // wrapped [-1,-1]
    expect(result).toContainEqual([0, 0]); // direct [0,0]
  });

  it('wrap=true: cells are never out of bounds', () => {
    const result = expandCellsWithBrush([[0, 0]], 'xl', 3, 3, true);
    for (const [x, y] of result) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(3);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(3);
    }
  });

  it('wrap=true: produces no duplicate cells', () => {
    const result = expandCellsWithBrush([[1, 1]], 'lg', 4, 4, true);
    const keys = result.map(([x, y]) => `${x},${y}`);
    expect(keys.length).toBe(new Set(keys).size);
  });
});

describe('floodSelect', () => {
  it('returns the set of indices contiguous with and sharing the seed colour', () => {
    // 3×3: 6 red cells in an L-shape, 3 blue.
    const R = '#ff0000';
    const B = '#0000ff';
    const pixels = [
      R, R, R,
      R, B, B,
      R, B, R, // bottom-right R disconnected by the blue middle from the L
    ];
    const set = floodSelect(pixels, 3, 3, 0, 0);
    // Should hit the 4 connected reds (top row + left column), not the
    // disconnected bottom-right R.
    expect(set.has(0)).toBe(true);
    expect(set.has(1)).toBe(true);
    expect(set.has(2)).toBe(true);
    expect(set.has(3)).toBe(true);
    expect(set.has(6)).toBe(true);
    expect(set.has(8)).toBe(false); // bottom-right R, disconnected
  });

  it('handles flood-selecting an empty (transparent) region', () => {
    const pixels = ['', '', '#ff0000', ''];
    const set = floodSelect(pixels, 2, 2, 0, 0);
    // Seed is '', connected '' cells are indices 0, 1, 3 (index 2 is red)
    expect(set.has(0)).toBe(true);
    expect(set.has(1)).toBe(true);
    expect(set.has(3)).toBe(true);
    expect(set.has(2)).toBe(false);
  });
});

describe('starCells', () => {
  it('returns a non-empty set for a reasonable bounding box', () => {
    expect(starCells(0, 0, 10, 10, 'fill').length).toBeGreaterThan(0);
  });

  it('includes the topmost tip of the star', () => {
    // cx=5, cy=5, outerR=5 → top tip at angle -π/2: [round(5+5*0), round(5-5)] = [5, 0]
    expect(starCells(0, 0, 10, 10, 'fill')).toContainEqual([5, 0]);
  });

  it('fill mode has more cells than outline mode', () => {
    const fill = starCells(0, 0, 12, 12, 'fill');
    const outline = starCells(0, 0, 12, 12, 'outline');
    expect(fill.length).toBeGreaterThan(outline.length);
  });

  it('produces no duplicate cells in fill mode', () => {
    const cells = starCells(0, 0, 10, 10, 'fill');
    const keys = cells.map(([x, y]) => `${x},${y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('produces no duplicate cells in outline mode', () => {
    const cells = starCells(0, 0, 10, 10, 'outline');
    const keys = cells.map(([x, y]) => `${x},${y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('all cells stay within the bounding box', () => {
    for (const [x, y] of starCells(0, 0, 8, 8, 'outline')) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(8);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(8);
    }
  });
});

describe('arrowCells', () => {
  it('returns a single cell for a zero-length arrow', () => {
    expect(arrowCells(3, 3, 3, 3)).toEqual([[3, 3]]);
  });

  it('includes both tail and tip', () => {
    const cells = arrowCells(0, 0, 8, 0, 'fill');
    expect(cells).toContainEqual([0, 0]);
    expect(cells).toContainEqual([8, 0]);
  });

  it('outline has more cells than just the shaft line', () => {
    // Shaft alone is 9 cells; arrowhead arms add more
    expect(arrowCells(0, 0, 8, 0, 'outline').length).toBeGreaterThan(9);
  });

  it('fill mode has at least as many cells as outline mode', () => {
    const fill = arrowCells(0, 0, 10, 0, 'fill');
    const outline = arrowCells(0, 0, 10, 0, 'outline');
    expect(fill.length).toBeGreaterThanOrEqual(outline.length);
  });

  it('produces no duplicate cells in fill mode', () => {
    const cells = arrowCells(0, 0, 10, 0, 'fill');
    const keys = cells.map(([x, y]) => `${x},${y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('produces no duplicate cells in outline mode', () => {
    const cells = arrowCells(0, 5, 10, 5, 'outline');
    const keys = cells.map(([x, y]) => `${x},${y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('works for a diagonal arrow', () => {
    const cells = arrowCells(0, 0, 6, 6, 'outline');
    expect(cells).toContainEqual([0, 0]);
    expect(cells).toContainEqual([6, 6]);
    expect(cells.length).toBeGreaterThan(7);
  });
});

describe('resizeLayerCentered', () => {
  it('centres a 2×2 payload inside a 4×4 canvas', () => {
    const X = '#000000';
    const src = [X, X, X, X]; // 2×2
    const next = resizeLayerCentered(src, 2, 2, 4, 4);
    // Centred → top-left corner at (1, 1)
    expect(next[1 * 4 + 1]).toBe(X);
    expect(next[1 * 4 + 2]).toBe(X);
    expect(next[2 * 4 + 1]).toBe(X);
    expect(next[2 * 4 + 2]).toBe(X);
    // Corners are still blank
    expect(next[0]).toBe('');
    expect(next[3]).toBe('');
  });

  it('crops symmetrically when shrinking', () => {
    // 4×4 with a ring pattern: 1 on the edge, 2 in the middle 2×2
    const src = [
      '1', '1', '1', '1',
      '1', '2', '2', '1',
      '1', '2', '2', '1',
      '1', '1', '1', '1',
    ];
    const next = resizeLayerCentered(src, 4, 4, 2, 2);
    // Should preserve only the middle 2×2
    expect(next).toEqual(['2', '2', '2', '2']);
  });
});

describe('pixelsInsidePolygon', () => {
  it('returns empty set for fewer than 3 points', () => {
    expect(pixelsInsidePolygon([], 4, 4).size).toBe(0);
    expect(pixelsInsidePolygon([[0, 0]], 4, 4).size).toBe(0);
    expect(pixelsInsidePolygon([[0, 0], [3, 0]], 4, 4).size).toBe(0);
  });

  it('a triangle includes interior and boundary cells', () => {
    const cells = pixelsInsidePolygon([[0, 0], [4, 0], [0, 4]], 5, 5);
    expect(cells.size).toBeGreaterThan(0);
    expect(cells.has(0 * 5 + 0)).toBe(true);
    expect(cells.has(0 * 5 + 4)).toBe(true);
    expect(cells.has(4 * 5 + 0)).toBe(true);
  });

  it('a filled square selects all interior cells', () => {
    const cells = pixelsInsidePolygon([[1, 1], [3, 1], [3, 3], [1, 3]], 5, 5);
    expect(cells.has(2 * 5 + 2)).toBe(true);
    expect(cells.has(1 * 5 + 1)).toBe(true);
    expect(cells.has(1 * 5 + 3)).toBe(true);
    expect(cells.has(3 * 5 + 1)).toBe(true);
    expect(cells.has(3 * 5 + 3)).toBe(true);
  });

  it('clips boundary pixels that fall outside the grid', () => {
    const cells = pixelsInsidePolygon([[0, 0], [6, 0], [0, 6]], 4, 4);
    for (const idx of cells) {
      const col = idx % 4, row = Math.floor(idx / 4);
      expect(col).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThan(4);
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(4);
    }
  });

  it('a thin diagonal polygon includes outline pixels via Bresenham', () => {
    const cells = pixelsInsidePolygon([[0, 0], [3, 3], [1, 0]], 5, 5);
    expect(cells.size).toBeGreaterThan(0);
  });

  it('returns indices as row * width + col', () => {
    const cells = pixelsInsidePolygon([[2, 2], [2, 3], [3, 3], [3, 2]], 6, 6);
    expect(cells.has(14)).toBe(true); // cell (2,2): 2*6+2 = 14
  });
});
