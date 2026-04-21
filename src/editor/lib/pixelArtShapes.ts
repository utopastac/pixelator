import type { PixelArtFillMode } from './pixelArtGeometry';
import { bresenhamLine, rectCells, ellipseCells, triangleCells, starCells, arrowCells } from './pixelArtGeometry';

/** The tools that produce geometry from a drag (start → end). */
export const SHAPE_TOOLS = ['line', 'rect', 'circle', 'triangle', 'star', 'arrow'] as const;
export type PixelArtShapeTool = (typeof SHAPE_TOOLS)[number];

/** Type guard: returns true when `tool` is one of the shape tools. */
export function isShapeTool(tool: string): tool is PixelArtShapeTool {
  return (SHAPE_TOOLS as readonly string[]).includes(tool);
}

/**
 * Returns the grid cells that a shape tool would rasterise between `start` and
 * `end`. Used for both preview rendering and pixel commitment.
 */
export function getShapeCells(
  tool: PixelArtShapeTool,
  start: [number, number],
  end: [number, number],
  fillModes: { rect: PixelArtFillMode; circle: PixelArtFillMode; triangle: PixelArtFillMode; star: PixelArtFillMode; arrow: PixelArtFillMode },
): [number, number][] {
  const [sx, sy] = start;
  const [ex, ey] = end;
  switch (tool) {
    case 'line':     return bresenhamLine(sx, sy, ex, ey);
    case 'rect':     return rectCells(sx, sy, ex, ey, fillModes.rect);
    case 'circle':   return ellipseCells(sx, sy, ex, ey, fillModes.circle);
    case 'triangle': return triangleCells(sx, sy, ex, ey, fillModes.triangle);
    case 'star':     return starCells(sx, sy, ex, ey, fillModes.star);
    case 'arrow':    return arrowCells(sx, sy, ex, ey, fillModes.arrow);
  }
}

/**
 * Adjusts `end` so the drag forms a square (equal |dx| and |dy|) while
 * preserving direction. Used when shift is held with rect/circle/triangle/star.
 */
export function constrainToSquare(
  start: [number, number],
  end: [number, number],
): [number, number] {
  const [sx, sy] = start, [ex, ey] = end;
  const dx = ex - sx, dy = ey - sy;
  const d = Math.max(Math.abs(dx), Math.abs(dy));
  return [sx + d * (dx >= 0 ? 1 : -1), sy + d * (dy >= 0 ? 1 : -1)];
}

/**
 * Snaps a line from `start` to the nearest 0°/45°/90° increment, preserving
 * direction. Used when shift is held with the line tool.
 */
export function constrainLineTo45(
  start: [number, number],
  end: [number, number],
): [number, number] {
  const [sx, sy] = start, [ex, ey] = end;
  const dx = ex - sx, dy = ey - sy;
  const absDx = Math.abs(dx), absDy = Math.abs(dy);
  const tan22_5 = Math.tan(Math.PI / 8);
  const tan67_5 = Math.tan((3 * Math.PI) / 8);
  if (absDx === 0 && absDy === 0) return [sx, sy];
  if (absDx === 0) return [sx, ey];
  const ratio = absDy / absDx;
  if (ratio < tan22_5) return [ex, sy];
  if (ratio > tan67_5) return [sx, ey];
  const d = Math.min(absDx, absDy);
  return [sx + d * (dx >= 0 ? 1 : -1), sy + d * (dy >= 0 ? 1 : -1)];
}
