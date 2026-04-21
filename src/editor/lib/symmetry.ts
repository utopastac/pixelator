export type SymmetryMode = 'none' | 'vertical' | 'horizontal' | 'both';

/**
 * Returns all cells to write: originals + mirrors, deduped and clamped to bounds.
 * When mode is 'none', returns a copy of cells unchanged.
 *
 * - vertical:   for each (x,y) also add (width-1-x, y)
 * - horizontal: for each (x,y) also add (x, height-1-y)
 * - both:       for each (x,y) also add the three mirrored variants
 *
 * Center-axis cells that mirror to themselves are deduped by the Set-based
 * index check (y*width+x). All output cells are clamped to [0..width-1] × [0..height-1].
 */
export function withSymmetry(
  cells: ReadonlyArray<[number, number]>,
  width: number,
  height: number,
  mode: SymmetryMode,
): [number, number][] {
  if (mode === 'none') return cells.slice() as [number, number][];

  const seen = new Set<number>();
  const result: [number, number][] = [];

  const add = (x: number, y: number) => {
    const cx = Math.max(0, Math.min(width - 1, x));
    const cy = Math.max(0, Math.min(height - 1, y));
    const idx = cy * width + cx;
    if (seen.has(idx)) return;
    seen.add(idx);
    result.push([cx, cy]);
  };

  for (const [x, y] of cells) {
    add(x, y);
    if (mode === 'vertical' || mode === 'both') {
      add(width - 1 - x, y);
    }
    if (mode === 'horizontal' || mode === 'both') {
      add(x, height - 1 - y);
    }
    if (mode === 'both') {
      add(width - 1 - x, height - 1 - y);
    }
  }

  return result;
}
