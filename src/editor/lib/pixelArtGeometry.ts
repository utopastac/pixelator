/** Whether a shape tool paints every cell inside the bounds or only the edge cells. */
export type PixelArtFillMode = 'fill' | 'outline';

/**
 * Rasterises a straight line between two grid cells using Bresenham's
 * line algorithm. Always includes both endpoints.
 */
export function bresenhamLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let cx = x0;
  let cy = y0;

  while (true) {
    points.push([cx, cy]);
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 < dx)  { err += dx; cy += sy; }
  }
  return points;
}

/**
 * Returns the grid cells forming a rectangle defined by two corner cells.
 * `fill` mode includes all cells; `outline` mode includes only the four edges.
 */
export function rectCells(
  x0: number, y0: number, x1: number, y1: number,
  fillMode: PixelArtFillMode = 'fill',
): Array<[number, number]> {
  const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
  const cells: Array<[number, number]> = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (fillMode === 'fill' || x === minX || x === maxX || y === minY || y === maxY) {
        cells.push([x, y]);
      }
    }
  }
  return cells;
}

/**
 * Returns the grid cells forming an ellipse fitted inside the bounding box.
 * In `outline` mode two passes are used to avoid gaps at horizontal/vertical extremes.
 */
export function ellipseCells(
  x0: number, y0: number, x1: number, y1: number,
  fillMode: PixelArtFillMode = 'fill',
): Array<[number, number]> {
  const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const rx = (maxX - minX) / 2, ry = (maxY - minY) / 2;

  const seen = new Set<number>();
  const cells: Array<[number, number]> = [];
  const add = (x: number, y: number) => {
    const key = y * 100000 + x;
    if (!seen.has(key)) { seen.add(key); cells.push([x, y]); }
  };

  for (let row = minY; row <= maxY; row++) {
    const dy = ry === 0 ? 0 : (row - cy) / ry;
    if (Math.abs(dy) > 1) continue;
    const dxf = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
    const lx = Math.round(cx - dxf), rx2 = Math.round(cx + dxf);
    if (fillMode === 'fill') {
      for (let x = lx; x <= rx2; x++) add(x, row);
    } else {
      add(lx, row);
      if (rx2 !== lx) add(rx2, row);
    }
  }

  if (fillMode === 'outline') {
    for (let col = minX; col <= maxX; col++) {
      const dx = rx === 0 ? 0 : (col - cx) / rx;
      if (Math.abs(dx) > 1) continue;
      const dyf = ry * Math.sqrt(Math.max(0, 1 - dx * dx));
      add(col, Math.round(cy - dyf));
      add(col, Math.round(cy + dyf));
    }
  }

  return cells;
}

/**
 * Returns the grid cells forming an isosceles triangle whose apex is centred
 * at the top of the bounding box and whose base spans the bottom edge.
 */
export function triangleCells(
  x0: number, y0: number, x1: number, y1: number,
  fillMode: PixelArtFillMode = 'fill',
): Array<[number, number]> {
  const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
  const apexX = Math.round((minX + maxX) / 2), apexY = minY;
  const blX = minX, blY = maxY, brX = maxX, brY = maxY;

  const seen = new Set<number>();
  const cells: Array<[number, number]> = [];
  const addUniq = (x: number, y: number) => {
    const k = y * 100000 + x;
    if (!seen.has(k)) { seen.add(k); cells.push([x, y]); }
  };

  if (fillMode === 'outline') {
    for (const [x, y] of bresenhamLine(apexX, apexY, blX, blY)) addUniq(x, y);
    for (const [x, y] of bresenhamLine(apexX, apexY, brX, brY)) addUniq(x, y);
    for (const [x, y] of bresenhamLine(blX, blY, brX, brY)) addUniq(x, y);
    return cells;
  }

  for (let y = minY; y <= maxY; y++) {
    const t = maxY === minY ? 0 : (y - minY) / (maxY - minY);
    const lx = Math.round(apexX + t * (blX - apexX));
    const rx = Math.round(apexX + t * (brX - apexX));
    for (let x = Math.min(lx, rx); x <= Math.max(lx, rx); x++) addUniq(x, y);
  }
  return cells;
}

/**
 * Returns the grid cells forming a 5-pointed star fitted inside the bounding box.
 * Inner radius is outerR × 0.382 (golden-ratio reciprocal).
 */
export function starCells(
  x0: number, y0: number, x1: number, y1: number,
  fillMode: PixelArtFillMode = 'fill',
): Array<[number, number]> {
  const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const outerR = Math.min(maxX - minX, maxY - minY) / 2;
  const innerR = outerR * 0.382;

  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI / 5) - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push([Math.round(cx + r * Math.cos(angle)), Math.round(cy + r * Math.sin(angle))]);
  }

  const seen = new Set<number>();
  const cells: Array<[number, number]> = [];
  const addUniq = (x: number, y: number) => {
    const k = y * 100000 + x;
    if (!seen.has(k)) { seen.add(k); cells.push([x, y]); }
  };

  if (fillMode === 'outline') {
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % pts.length];
      for (const [x, y] of bresenhamLine(ax, ay, bx, by)) addUniq(x, y);
    }
    return cells;
  }

  const minPY = Math.min(...pts.map(([, y]) => y));
  const maxPY = Math.max(...pts.map(([, y]) => y));
  for (let y = minPY; y <= maxPY; y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.round(xs[i]); x <= Math.round(xs[i + 1]); x++) addUniq(x, y);
    }
  }
  return cells;
}

/**
 * Returns the grid cells forming an arrow from `(x0, y0)` → `(x1, y1)`.
 * Shaft is a Bresenham line; head is two arms angled ~30° back from the direction.
 */
/**
 * Returns the set of pixel indices (row * width + col) that fall inside the
 * given polygon, using ray-casting for interior cells plus Bresenham lines for
 * boundary cells so edge pixels are always included.
 */
export function pixelsInsidePolygon(
  points: Array<[number, number]>,
  width: number,
  height: number,
): Set<number> {
  if (points.length < 3) return new Set();
  const cells = new Set<number>();

  // Interior: ray-cast from each pixel centre.
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const px = c + 0.5, py = r + 0.5;
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      if (inside) cells.add(r * width + c);
    }
  }

  // Boundary: Bresenham lines around every edge so thin polygons still select
  // their outline pixels.
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    for (const [bc, br] of bresenhamLine(x0, y0, x1, y1)) {
      if (bc >= 0 && bc < width && br >= 0 && br < height) {
        cells.add(br * width + bc);
      }
    }
  }

  return cells;
}

export function arrowCells(
  x0: number, y0: number, x1: number, y1: number,
  fillMode: PixelArtFillMode = 'fill',
): Array<[number, number]> {
  const seen = new Set<number>();
  const cells: Array<[number, number]> = [];
  const addUniq = (x: number, y: number) => {
    const k = y * 100000 + x;
    if (!seen.has(k)) { seen.add(k); cells.push([x, y]); }
  };

  if (x0 === x1 && y0 === y1) { addUniq(x0, y0); return cells; }

  for (const [x, y] of bresenhamLine(x0, y0, x1, y1)) addUniq(x, y);

  const dx = x1 - x0, dy = y1 - y0;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const headLen = Math.max(2, Math.min(Math.round(length * 0.35), 12));
  const headAngle = Math.PI / 6;

  const armLx = Math.round(x1 + Math.cos(angle + Math.PI - headAngle) * headLen);
  const armLy = Math.round(y1 + Math.sin(angle + Math.PI - headAngle) * headLen);
  const armRx = Math.round(x1 + Math.cos(angle + Math.PI + headAngle) * headLen);
  const armRy = Math.round(y1 + Math.sin(angle + Math.PI + headAngle) * headLen);

  for (const [x, y] of bresenhamLine(x1, y1, armLx, armLy)) addUniq(x, y);
  for (const [x, y] of bresenhamLine(x1, y1, armRx, armRy)) addUniq(x, y);

  if (fillMode === 'outline') return cells;

  for (const [x, y] of bresenhamLine(armLx, armLy, armRx, armRy)) addUniq(x, y);

  const tri: Array<[number, number]> = [[x1, y1], [armLx, armLy], [armRx, armRy]];
  const minY = Math.min(tri[0][1], tri[1][1], tri[2][1]);
  const maxY = Math.max(tri[0][1], tri[1][1], tri[2][1]);
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    for (let i = 0; i < 3; i++) {
      const [ax, ay] = tri[i], [bx, by] = tri[(i + 1) % 3];
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.round(xs[i]); x <= Math.round(xs[i + 1]); x++) addUniq(x, y);
    }
  }
  return cells;
}
