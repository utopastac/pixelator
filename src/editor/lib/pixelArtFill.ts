/** Number of animation positions in one marching-ants cycle. */
export const MARCHING_ANTS_STEPS = 8;

/** Milliseconds between each marching-ants animation tick. */
export const MARCHING_ANTS_INTERVAL_MS = 80;

/** A selection in grid-cell coordinates. All variants carry a bounding box (x1/y1/x2/y2, inclusive). */
export type PixelArtSelection =
  | { shape: 'rect';    x1: number; y1: number; x2: number; y2: number }
  | { shape: 'ellipse'; x1: number; y1: number; x2: number; y2: number }
  | { shape: 'cells';   cells: ReadonlySet<number>; x1: number; y1: number; x2: number; y2: number };

/**
 * Performs a 4-connected flood fill replacing all contiguous cells that share
 * the same colour as the start cell with `fillColor`. Returns the input array
 * unchanged if the start cell already contains `fillColor`. When `wrap` is
 * true, edges wrap around using modulo arithmetic instead of clamping.
 */
export function floodFill(
  pixels: string[],
  width: number,
  height: number,
  startCol: number,
  startRow: number,
  fillColor: string,
  wrap = false,
): string[] {
  const next = [...pixels];
  const targetColor = next[startRow * width + startCol];
  if (targetColor === fillColor) return next;

  const queue: Array<[number, number]> = [[startCol, startRow]];
  const visited = new Set<number>();

  while (queue.length > 0) {
    const [col, row] = queue.shift()!;
    const c = wrap ? ((col % width) + width) % width : col;
    const r = wrap ? ((row % height) + height) % height : row;
    if (!wrap && (c < 0 || c >= width || r < 0 || r >= height)) continue;
    const idx = r * width + c;
    if (visited.has(idx)) continue;
    if (next[idx] !== targetColor) continue;
    visited.add(idx);
    next[idx] = fillColor;
    queue.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
  }

  return next;
}

/**
 * 4-connected flood select from (startCol, startRow). Returns a ReadonlySet of
 * flat pixel indices contiguous with and sharing the colour of the start cell.
 */
export function floodSelect(
  pixels: string[],
  width: number,
  height: number,
  startCol: number,
  startRow: number,
): ReadonlySet<number> {
  const targetColor = pixels[startRow * width + startCol];
  const visited = new Set<number>();
  const queue: Array<[number, number]> = [[startCol, startRow]];
  while (queue.length > 0) {
    const [col, row] = queue.shift()!;
    if (col < 0 || col >= width || row < 0 || row >= height) continue;
    const idx = row * width + col;
    if (visited.has(idx)) continue;
    if (pixels[idx] !== targetColor) continue;
    visited.add(idx);
    queue.push([col + 1, row], [col - 1, row], [col, row + 1], [col, row - 1]);
  }
  return visited;
}

/**
 * Returns a new pixel array where changes made in `next` relative to `base` are
 * restricted to one side of `selection`. Returns `next` unchanged when
 * `selection` is null.
 */
export function maskToSelection(
  next: string[],
  base: string[],
  gridWidth: number,
  selection: PixelArtSelection | null,
  keepInside: boolean,
): string[] {
  if (!selection) return next;
  const result = [...next];

  if (selection.shape === 'cells') {
    for (let i = 0; i < result.length; i++) {
      const inside = selection.cells.has(i);
      if (inside !== keepInside) result[i] = base[i];
    }
    return result;
  }

  const minX = Math.min(selection.x1, selection.x2);
  const maxX = Math.max(selection.x1, selection.x2);
  const minY = Math.min(selection.y1, selection.y2);
  const maxY = Math.max(selection.y1, selection.y2);

  for (let i = 0; i < result.length; i++) {
    const c = i % gridWidth;
    const r = Math.floor(i / gridWidth);
    const inBounds = c >= minX && c <= maxX && r >= minY && r <= maxY;
    let inside: boolean;
    if (!inBounds) {
      inside = false;
    } else if (selection.shape === 'rect') {
      inside = true;
    } else {
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      const rx = (maxX - minX) / 2 + 0.5, ry = (maxY - minY) / 2 + 0.5;
      const dx = c - cx, dy = r - cy;
      inside = rx <= 0 || ry <= 0 ? true : (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
    }
    if (inside !== keepInside) result[i] = base[i];
  }
  return result;
}

/**
 * Same rules as `maskToSelection`, but mutates `next` in place (cells that must
 * stay unchanged are copied from `base`).
 */
export function maskToSelectionInPlace(
  next: string[],
  base: string[],
  gridWidth: number,
  selection: PixelArtSelection | null,
  keepInside: boolean,
): void {
  if (!selection) return;

  if (selection.shape === 'cells') {
    for (let i = 0; i < next.length; i++) {
      const inside = selection.cells.has(i);
      if (inside !== keepInside) next[i] = base[i];
    }
    return;
  }

  const minX = Math.min(selection.x1, selection.x2);
  const maxX = Math.max(selection.x1, selection.x2);
  const minY = Math.min(selection.y1, selection.y2);
  const maxY = Math.max(selection.y1, selection.y2);

  for (let i = 0; i < next.length; i++) {
    const c = i % gridWidth;
    const r = Math.floor(i / gridWidth);
    const inBounds = c >= minX && c <= maxX && r >= minY && r <= maxY;
    let inside: boolean;
    if (!inBounds) {
      inside = false;
    } else if (selection.shape === 'rect') {
      inside = true;
    } else {
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const rx = (maxX - minX) / 2 + 0.5;
      const ry = (maxY - minY) / 2 + 0.5;
      const dx = c - cx;
      const dy = r - cy;
      inside = rx <= 0 || ry <= 0 ? true : (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
    }
    if (inside !== keepInside) next[i] = base[i];
  }
}
