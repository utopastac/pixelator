/** Named brush sizes controlling how many cells are painted per cursor position. */
export type PixelArtBrushSize = 'sm' | 'md' | 'lg' | 'xl';

export const BRUSH_RADIUS: Record<PixelArtBrushSize, number> = { sm: 0, md: 1, lg: 1, xl: 2 };

/**
 * Cell offsets (in [col, row] deltas) that each brush size paints relative to
 * the cursor position. `sm` paints only the cursor cell; `md` paints a 2×2
 * block; `lg` paints a 3×3 block; `xl` paints a 5×5 block.
 */
export const BRUSH_OFFSETS: Record<PixelArtBrushSize, Array<[number, number]>> = {
  sm: [[0, 0]],
  md: [[0, 0], [1, 0], [0, 1], [1, 1]],
  lg: [[-1,-1],[0,-1],[1,-1],[-1,0],[0,0],[1,0],[-1,1],[0,1],[1,1]],
  xl: [
    [-2,-2],[-1,-2],[0,-2],[1,-2],[2,-2],
    [-2,-1],[-1,-1],[0,-1],[1,-1],[2,-1],
    [-2, 0],[-1, 0],[0, 0],[1, 0],[2, 0],
    [-2, 1],[-1, 1],[0, 1],[1, 1],[2, 1],
    [-2, 2],[-1, 2],[0, 2],[1, 2],[2, 2],
  ],
};

/**
 * Returns a new pixels array with `color` applied at all cells covered by the
 * brush centred on (col, row). Cells outside the grid bounds are silently skipped,
 * unless `wrap` is true in which case they wrap around using modulo arithmetic.
 */
/**
 * Mutates `pixels` in place (same rules as `applyBrush`). Used by tools that
 * stamp many cells per pointermove so we avoid copying the full grid per cell.
 */
export function applyBrushInPlace(
  pixels: string[],
  col: number,
  row: number,
  color: string,
  brushSize: PixelArtBrushSize,
  gridWidth: number,
  gridHeight: number,
  wrap = false,
): void {
  for (const [dc, dr] of BRUSH_OFFSETS[brushSize]) {
    const rawC = col + dc;
    const rawR = row + dr;
    if (wrap) {
      const c = ((rawC % gridWidth) + gridWidth) % gridWidth;
      const r = ((rawR % gridHeight) + gridHeight) % gridHeight;
      pixels[r * gridWidth + c] = color;
    } else if (rawC >= 0 && rawC < gridWidth && rawR >= 0 && rawR < gridHeight) {
      pixels[rawR * gridWidth + rawC] = color;
    }
  }
}

export function applyBrush(
  pixels: string[],
  col: number,
  row: number,
  color: string,
  brushSize: PixelArtBrushSize,
  gridWidth: number,
  gridHeight: number,
  wrap = false,
): string[] {
  const next = [...pixels];
  applyBrushInPlace(next, col, row, color, brushSize, gridWidth, gridHeight, wrap);
  return next;
}

/**
 * Expands a set of grid cells outward using `BRUSH_OFFSETS[brushSize]` so a
 * thin one-cell stroke becomes a thicker one. Deduplicates and clips to the grid,
 * unless `wrap` is true in which case out-of-bounds cells wrap around.
 */
export function expandCellsWithBrush(
  cells: [number, number][],
  brushSize: PixelArtBrushSize,
  gridWidth: number,
  gridHeight: number,
  wrap = false,
): [number, number][] {
  if (brushSize === 'sm') return cells;
  const seen = new Set<number>();
  const result: [number, number][] = [];
  for (const [c, r] of cells) {
    for (const [dc, dr] of BRUSH_OFFSETS[brushSize]) {
      let nc = c + dc;
      let nr = r + dr;
      if (wrap) {
        nc = ((nc % gridWidth) + gridWidth) % gridWidth;
        nr = ((nr % gridHeight) + gridHeight) % gridHeight;
      } else {
        if (nc < 0 || nc >= gridWidth || nr < 0 || nr >= gridHeight) continue;
      }
      const key = nr * gridWidth + nc;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push([nc, nr]);
    }
  }
  return result;
}
