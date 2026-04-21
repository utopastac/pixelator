/**
 * Module-local pixel clipboard used by Copy / Cut / Paste.
 *
 * Intentionally NOT the system clipboard — the clips carry layer-colour
 * strings (our canonical pixel representation) so we can round-trip them
 * losslessly inside the app without ever going through the OS clipboard's
 * image-encoding pipeline. A single slot is sufficient for the "one
 * current clip" UX we want; there's no history stack.
 */

import type { PixelArtSelection } from '@/editor/hooks/usePixelArtSelection';

export interface PixelClip {
  width: number;
  height: number;
  /** Row-major, tight-rect pixels. `''` encodes both transparent cells and
   *  cells outside the selection mask (for non-rect shapes). */
  pixels: string[];
  /** Name of the layer the clip was lifted from. Used to derive the pasted
   *  layer's name ("Copy of <source>") and nothing else. */
  sourceLayerName?: string;
}

// ── Pure helpers ───────────────────────────────────────────────────────────────

/**
 * Normalise selection corners to a bbox, then walk it and emit a tight
 * rectangle of pixels. Cells outside the selection mask (ellipse / wand
 * shapes) are baked to `''` so paste doesn't accidentally resurrect the
 * bounding-box rectangle.
 */
export function buildClip(
  layerPixels: string[],
  layerW: number,
  layerH: number,
  selection: PixelArtSelection,
  containsCell: (col: number, row: number) => boolean,
  sourceLayerName?: string,
): PixelClip {
  // Clamp to canvas bounds defensively — the UI prevents out-of-bounds
  // selections, but clipping here keeps this helper safe to unit-test with
  // adversarial inputs.
  const minX = Math.max(0, Math.min(layerW - 1, Math.min(selection.x1, selection.x2)));
  const maxX = Math.max(0, Math.min(layerW - 1, Math.max(selection.x1, selection.x2)));
  const minY = Math.max(0, Math.min(layerH - 1, Math.min(selection.y1, selection.y2)));
  const maxY = Math.max(0, Math.min(layerH - 1, Math.max(selection.y1, selection.y2)));

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const pixels = new Array<string>(width * height).fill('');

  for (let row = minY; row <= maxY; row++) {
    for (let col = minX; col <= maxX; col++) {
      if (!containsCell(col, row)) continue;
      const src = row * layerW + col;
      const dst = (row - minY) * width + (col - minX);
      pixels[dst] = layerPixels[src] ?? '';
    }
  }

  return { width, height, pixels, sourceLayerName };
}

/**
 * Return a new pixels array with every mask-contained cell reset to `''`.
 * Input is never mutated; the returned array is a fresh copy.
 */
export function clearSelectionCells(
  layerPixels: string[],
  selection: PixelArtSelection,
  layerW: number,
  layerH: number,
  containsCell: (col: number, row: number) => boolean,
): string[] {
  const minX = Math.max(0, Math.min(layerW - 1, Math.min(selection.x1, selection.x2)));
  const maxX = Math.max(0, Math.min(layerW - 1, Math.max(selection.x1, selection.x2)));
  const minY = Math.max(0, Math.min(layerH - 1, Math.min(selection.y1, selection.y2)));
  const maxY = Math.max(0, Math.min(layerH - 1, Math.max(selection.y1, selection.y2)));

  const next = layerPixels.slice();
  for (let row = minY; row <= maxY; row++) {
    for (let col = minX; col <= maxX; col++) {
      if (containsCell(col, row)) next[row * layerW + col] = '';
    }
  }
  return next;
}

/**
 * Place a clip onto a canvas-sized pixel array at the given anchor. Cells
 * that fall outside the canvas are silently dropped so partial pastes at
 * the edges don't crash.
 */
export function applyClipToNewLayer(
  clip: PixelClip,
  canvasW: number,
  canvasH: number,
  anchor: { x: number; y: number },
): string[] {
  const out = new Array<string>(canvasW * canvasH).fill('');
  for (let row = 0; row < clip.height; row++) {
    for (let col = 0; col < clip.width; col++) {
      const px = clip.pixels[row * clip.width + col];
      if (!px) continue;
      const destX = anchor.x + col;
      const destY = anchor.y + row;
      if (destX < 0 || destX >= canvasW || destY < 0 || destY >= canvasH) continue;
      out[destY * canvasW + destX] = px;
    }
  }
  return out;
}

/**
 * Decide where to drop a paste. When a selection exists we honour its
 * top-left so "Copy → click somewhere → Paste" feels controllable. Without
 * a selection we centre — integer floor so the clip lands on the grid.
 */
export function resolveAnchor(
  clip: PixelClip,
  selection: PixelArtSelection | null,
  canvasW: number,
  canvasH: number,
): { x: number; y: number } {
  if (selection) {
    return {
      x: Math.min(selection.x1, selection.x2),
      y: Math.min(selection.y1, selection.y2),
    };
  }
  return {
    x: Math.floor((canvasW - clip.width) / 2),
    y: Math.floor((canvasH - clip.height) / 2),
  };
}

// ── Module state ───────────────────────────────────────────────────────────────
// Single-slot clipboard. Lives at module scope so cross-editor paste
// (switching drawings mid-session) works without threading state through
// the React tree.

let currentClip: PixelClip | null = null;

export function hasClip(): boolean {
  return currentClip !== null;
}

export function getClip(): PixelClip | null {
  return currentClip;
}

export function setClip(clip: PixelClip | null): void {
  currentClip = clip;
}

/** Test-only reset. Exposed so unit tests can isolate the module slot. */
export function __resetClipForTests(): void {
  currentClip = null;
}
