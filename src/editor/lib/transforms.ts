/**
 * Pure, React-free transforms for the layer pixel array. Mirrors the
 * row-major `string[]` storage used by pixelArtUtils: index = row * width + col,
 * '' = transparent. All functions are non-mutating — they return a new array.
 */

/** Normalised, inclusive bounding box in grid-cell coordinates. */
export interface TransformBBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function normBBox(b: TransformBBox): TransformBBox {
  return {
    x1: Math.min(b.x1, b.x2),
    y1: Math.min(b.y1, b.y2),
    x2: Math.max(b.x1, b.x2),
    y2: Math.max(b.y1, b.y2),
  };
}

/**
 * Rotate `pixels` 90° CW or CCW, either across the whole canvas or inside a
 * bounding box. The output array has the same dimensions as the input:
 * rotated cells that fall outside the operative region (layer bounds without a
 * bbox, or bbox bounds with one) are discarded, and destination cells whose
 * source falls outside become `''`.
 *
 * Rotation is taken around the centre of the operative region. For a non-square
 * region a 90° rotation is not area-preserving in the row/col basis — the
 * "corners" that fall outside the original aspect ratio get dropped.
 */
export function rotatePixels90(
  pixels: string[],
  width: number,
  height: number,
  dir: 'cw' | 'ccw',
  bbox?: TransformBBox,
): string[] {
  const result = pixels.slice();
  const b = bbox ? normBBox(bbox) : { x1: 0, y1: 0, x2: width - 1, y2: height - 1 };
  const cx = (b.x1 + b.x2) / 2;
  const cy = (b.y1 + b.y2) / 2;

  // Iterate every destination cell in the operative region, compute the source
  // cell by inverse rotation, copy if in-region, otherwise write ''.
  for (let rd = b.y1; rd <= b.y2; rd++) {
    for (let cd = b.x1; cd <= b.x2; cd++) {
      let cs: number;
      let rs: number;
      if (dir === 'cw') {
        // CW forward: (dx, dy) → (-dy, dx). Inverse: (dx, dy) → (dy, -dx).
        cs = Math.round(cx + (rd - cy));
        rs = Math.round(cy - (cd - cx));
      } else {
        // CCW forward: (dx, dy) → (dy, -dx). Inverse: (dx, dy) → (-dy, dx).
        cs = Math.round(cx - (rd - cy));
        rs = Math.round(cy + (cd - cx));
      }
      const inRegion =
        cs >= b.x1 && cs <= b.x2 && rs >= b.y1 && rs <= b.y2 &&
        cs >= 0 && cs < width && rs >= 0 && rs < height;
      result[rd * width + cd] = inRegion ? pixels[rs * width + cs] : '';
    }
  }
  return result;
}

export interface TranslateMask {
  bbox: TransformBBox;
  contains: (col: number, row: number) => boolean;
}

/**
 * Translate pixels by `(dx, dy)`. Without a mask every painted pixel shifts;
 * destinations off-canvas are discarded and vacated cells become `''`.
 *
 * With a mask, only cells where `mask.contains(col, row)` participate: their
 * originals are cleared, and their colour is written at the shifted position.
 * Non-masked cells are untouched unless a masked cell lands on top of one.
 */
/**
 * Compute the tight bbox around non-empty cells. Returns null when the pixel
 * array is entirely empty. Inclusive, in grid-cell coordinates.
 */
export function tightBBox(
  pixels: string[],
  width: number,
  height: number,
): TransformBBox | null {
  let mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!pixels[r * width + c]) continue;
      if (c < mnX) mnX = c;
      if (c > mxX) mxX = c;
      if (r < mnY) mnY = r;
      if (r > mxY) mxY = r;
    }
  }
  if (mxX < mnX) return null;
  return { x1: mnX, y1: mnY, x2: mxX, y2: mxY };
}

/**
 * 2×3 affine matrix in row-major form: [[a, c, tx], [b, d, ty]]. Applies as
 *   x' = a*x + c*y + tx
 *   y' = b*x + d*y + ty
 * The identity matrix is `[1, 0, 0, 1, 0, 0]`.
 */
export interface AffineMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

export const IDENTITY: AffineMatrix = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

export function multiplyMatrix(m1: AffineMatrix, m2: AffineMatrix): AffineMatrix {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    tx: m1.a * m2.tx + m1.c * m2.ty + m1.tx,
    ty: m1.b * m2.tx + m1.d * m2.ty + m1.ty,
  };
}

/** Returns the inverse of an affine matrix, or null if singular. */
export function invertMatrix(m: AffineMatrix): AffineMatrix | null {
  const det = m.a * m.d - m.b * m.c;
  if (Math.abs(det) < 1e-9) return null;
  const inv = 1 / det;
  return {
    a: m.d * inv,
    b: -m.b * inv,
    c: -m.c * inv,
    d: m.a * inv,
    tx: (m.c * m.ty - m.d * m.tx) * inv,
    ty: (m.b * m.tx - m.a * m.ty) * inv,
  };
}

export function applyMatrix(m: AffineMatrix, x: number, y: number): [number, number] {
  return [m.a * x + m.c * y + m.tx, m.b * x + m.d * y + m.ty];
}

/**
 * Apply an affine `matrix` to `pixels`, producing a new `width × height`
 * layer via inverse-mapping nearest-neighbour resampling. The matrix is the
 * FORWARD transform: source → destination. For each destination cell, we
 * sample the source at the inverse-mapped position (centre-of-cell).
 *
 * Cells whose inverse-mapped source falls outside `[0, width) × [0, height)`
 * or outside the source bbox (when provided) become `''`.
 */
export function applyAffineToPixels(
  pixels: string[],
  width: number,
  height: number,
  matrix: AffineMatrix,
  sourceBBox?: TransformBBox,
): string[] {
  const out = new Array<string>(width * height).fill('');
  const inv = invertMatrix(matrix);
  if (!inv) return out;
  const b = sourceBBox ? normBBox(sourceBBox) : null;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const [sx, sy] = applyMatrix(inv, c + 0.5, r + 0.5);
      const ss = Math.floor(sx);
      const rr = Math.floor(sy);
      if (ss < 0 || ss >= width || rr < 0 || rr >= height) continue;
      if (b && (ss < b.x1 || ss > b.x2 || rr < b.y1 || rr > b.y2)) continue;
      const color = pixels[rr * width + ss];
      if (color) out[r * width + c] = color;
    }
  }
  return out;
}

export function translatePixels(
  pixels: string[],
  width: number,
  height: number,
  dx: number,
  dy: number,
  mask?: TranslateMask,
): string[] {
  if (!mask) {
    const result = new Array<string>(width * height).fill('');
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const color = pixels[r * width + c];
        if (!color) continue;
        const nc = c + dx;
        const nr = r + dy;
        if (nc < 0 || nc >= width || nr < 0 || nr >= height) continue;
        result[nr * width + nc] = color;
      }
    }
    return result;
  }

  const result = pixels.slice();
  const b = normBBox(mask.bbox);

  // Phase 1: clear the masked source cells so non-masked destinations end up
  // with '' when nothing lands on them.
  for (let r = b.y1; r <= b.y2; r++) {
    for (let c = b.x1; c <= b.x2; c++) {
      if (c < 0 || c >= width || r < 0 || r >= height) continue;
      if (mask.contains(c, r)) result[r * width + c] = '';
    }
  }
  // Phase 2: paint each masked cell's original colour at the translated position.
  for (let r = b.y1; r <= b.y2; r++) {
    for (let c = b.x1; c <= b.x2; c++) {
      if (c < 0 || c >= width || r < 0 || r >= height) continue;
      if (!mask.contains(c, r)) continue;
      const color = pixels[r * width + c];
      const nc = c + dx;
      const nr = r + dy;
      if (nc < 0 || nc >= width || nr < 0 || nr >= height) continue;
      result[nr * width + nc] = color;
    }
  }
  return result;
}
