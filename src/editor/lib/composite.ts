/**
 * Layer composition helpers for the PixelArtEditor.
 *
 * `compositeLayers` paints a stack of per-layer offscreen canvases onto a
 * target (typically the committed canvas) in bottom → top order, applying
 * each layer's opacity. A white fullbleed is painted first so the composite
 * matches the pre-layers visual (white background).
 *
 * `flattenLayers` produces a single flat pixel array by overwriting cells
 * with each visible layer's non-empty pixels bottom → top. Used by export
 * paths and the popover preview that round-trip through `pixelsToSvg`.
 */

import type { Layer } from '@/lib/storage';
import { createEmptyPixels } from '@/lib/storage';
import { pixelsToSvg } from './pixelArtUtils';

/**
 * Flatten a layer stack into a single pixel array. Visible layers overwrite
 * lower layers for every non-empty cell. Opacity is intentionally ignored —
 * Phase 2 only supports binary composition, since the export / preview paths
 * go through hex-only pixel arrays.
 */
export function flattenLayers(
  layers: Layer[],
  width: number,
  height: number,
): string[] {
  const out = createEmptyPixels(width, height);
  for (const layer of layers) {
    if (!layer.visible) continue;
    for (let i = 0; i < layer.pixels.length; i++) {
      const c = layer.pixels[i];
      if (c) out[i] = c;
    }
  }
  return out;
}

/** Flatten `upper` onto `lower`, overwriting any non-empty cell. Both layers
 *  must share the same pixel array length; the caller is responsible for that. */
export function mergeDownPixels(upper: Layer, lower: Layer): string[] {
  const out = [...lower.pixels];
  for (let i = 0; i < upper.pixels.length; i++) {
    const c = upper.pixels[i];
    if (c) out[i] = c;
  }
  return out;
}

/**
 * Flatten + serialise a layer stack to SVG. Used by the popover preview so
 * the trigger thumbnail reflects the composite, not an individual layer.
 */
export function compositeToSvg(
  layers: Layer[],
  width: number,
  height: number,
): string {
  return pixelsToSvg(flattenLayers(layers, width, height), width, height);
}

/**
 * Paint `layers` onto `target` by blitting each layer's offscreen canvas in
 * order, with the layer's opacity applied. The target is cleared to white
 * before any layer is drawn so the final image matches the pre-layers look
 * of the editor when no layers are visible or populated.
 *
 * Offscreens are expected to be transparent where no cell is painted; the
 * caller owns their lifecycle (creation, re-rasterise on pixel change,
 * resize, eviction).
 */
export function compositeLayers(
  target: HTMLCanvasElement,
  layers: Layer[],
  offscreens: Map<string, HTMLCanvasElement>,
  width: number,
  height: number,
  options?: { skipLayerId?: string },
): void {
  if (target.width !== width) target.width = width;
  if (target.height !== height) target.height = height;
  const ctx = target.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    if (options?.skipLayerId === layer.id) continue;
    const off = offscreens.get(layer.id);
    if (!off) continue;
    ctx.globalAlpha = Math.min(1, Math.max(0, layer.opacity));
    ctx.drawImage(off, 0, 0);
  }
  ctx.globalAlpha = 1;
}
