/**
 * v1 → v2 migration for the pixelator localStorage store.
 *
 * v1 persisted each drawing as an SVG string (`svg`). v2 persists layered
 * pixel arrays (`layers` + `activeLayerId`). The migration parses each v1
 * SVG into a flat pixel array and wraps it in a single "Background" layer.
 *
 * The parser mirrors the output of `pixelsToSvg` — a list of
 * `<rect x=.. y=.. width="1" height="1" fill=".."/>` elements — and tolerates
 * whitespace / attribute ordering differences. When DOMParser is unavailable
 * (SSR, worker) it falls back to a regex-based scan.
 */

import {
  createDefaultLayer,
  createEmptyPixels,
  type Drawing,
  type LegacyDrawingV1,
  type StoreShape,
} from './storage';

interface LegacyStoreV1 {
  schemaVersion: 1;
  drawings: LegacyDrawingV1[];
  currentDrawingId: string | null;
}

/**
 * Parses an SVG emitted by `pixelsToSvg` back into a flat pixel array of
 * length `width * height`. Cells without a matching `<rect>` stay `''`.
 * Rects outside the grid bounds or without a fill are ignored.
 */
export function svgToPixels(svg: string, width: number, height: number): string[] {
  const pixels = createEmptyPixels(width, height);
  if (!svg) return pixels;

  const applyRect = (x: number, y: number, fill: string) => {
    if (!fill) return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    pixels[y * width + x] = fill;
  };

  // Prefer DOMParser when available — more forgiving of attribute ordering.
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      const rects = doc.querySelectorAll('rect');
      rects.forEach((rect) => {
        const x = parseInt(rect.getAttribute('x') ?? '', 10);
        const y = parseInt(rect.getAttribute('y') ?? '', 10);
        const fill = rect.getAttribute('fill') ?? '';
        applyRect(x, y, fill);
      });
      return pixels;
    } catch (err) {
      console.warn('[pixelator] svgToPixels: DOMParser failed, falling back to regex', err);
    }
  }

  // Regex fallback. Matches `<rect ... />` and extracts x / y / fill separately.
  const rectRe = /<rect\b([^>]*)\/?>/g;
  const attr = (frag: string, name: string): string | null => {
    const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`).exec(frag);
    return m ? m[1] : null;
  };
  let m: RegExpExecArray | null;
  while ((m = rectRe.exec(svg)) !== null) {
    const frag = m[1];
    const x = parseInt(attr(frag, 'x') ?? '', 10);
    const y = parseInt(attr(frag, 'y') ?? '', 10);
    const fill = attr(frag, 'fill') ?? '';
    applyRect(x, y, fill);
  }
  return pixels;
}

/**
 * Convert a single v1 drawing into its v2 shape. Preserves id, name,
 * width/height, createdAt/updatedAt. Wraps the parsed pixels in one
 * "Background" layer and sets `activeLayerId` to that layer's id.
 */
export function migrateDrawingV1ToV2(legacy: LegacyDrawingV1): Drawing {
  const width = legacy.width;
  const height = legacy.height;
  const pixels = legacy.svg
    ? svgToPixels(legacy.svg, width, height)
    : createEmptyPixels(width, height);
  const layer = createDefaultLayer(width, height, pixels);
  return {
    id: legacy.id,
    name: legacy.name,
    width,
    height,
    layers: [layer],
    activeLayerId: layer.id,
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
  };
}

/**
 * Convert the entire persisted v1 store into v2. Preserves `currentDrawingId`.
 */
export function migrateStoreV1ToV2(legacy: LegacyStoreV1): StoreShape {
  return {
    schemaVersion: 2,
    drawings: legacy.drawings.map(migrateDrawingV1ToV2),
    currentDrawingId: legacy.currentDrawingId,
  };
}

