import { useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import type React from 'react';
import type { Layer } from '@/lib/storage';
import { drawLayer, patchOpaqueCells } from '../lib/pixelArtCanvas';
import { compositeLayers } from '../lib/composite';
import type { PaintDragCanvasFlushFn } from './usePixelArtHistory';

interface UseEditorCanvasSetupProps {
  committedCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  canvasMounted: boolean;
  width: number;
  height: number;
  layers: Layer[];
  layerTransformIsPending: boolean;
  activeLayerId: string;
  onAfterComposite?: () => void;
  /** Stroke cells to patch on the active layer offscreen (same `pixels` ref as last draw). */
  activeLayerRasterPatchAccRef?: React.MutableRefObject<Set<number>> | null;
  /** Latest layer stack for paint-drag canvas bypass (same order as `layers`). */
  layersRef?: React.MutableRefObject<Layer[]>;
  paintDragFlushRef?: React.MutableRefObject<PaintDragCanvasFlushFn | null>;
  /** Redraw committed canvas from React layer pixels after aborting a bypassed stroke. */
  paintDragAbortResyncRef?: React.MutableRefObject<(() => void) | null>;
}

/**
 * Manages offscreen-canvas allocation and the committed-canvas composite pipeline.
 * Keeps one offscreen per layer, rasterises each layer's pixels onto it, and
 * blits them onto the committed canvas in bottom-to-top order. Mounts a cleanup
 * effect that evicts the entire offscreen map on unmount.
 *
 * Rasterisation is **dirty-tracked** by `layer.pixels` reference equality (and
 * by grid width/height): unchanged layers skip `drawLayer`. While painting, the
 * active layer buffer may be updated in place with accumulated stroke indices
 * in `activeLayerRasterPatchAccRef` so only touched cells are re-rasterised.
 */
export function useEditorCanvasSetup({
  committedCanvasRef,
  previewCanvasRef,
  canvasMounted,
  width,
  height,
  layers,
  layerTransformIsPending,
  activeLayerId,
  onAfterComposite,
  activeLayerRasterPatchAccRef,
  layersRef,
  paintDragFlushRef,
  paintDragAbortResyncRef,
}: UseEditorCanvasSetupProps): void {
  // Resize all canvases when dimensions change. Canvases are sized 1:1 with
  // the logical grid — one raster pixel = one logical pixel — and visual
  // scaling is done via CSS transform on the wrapper.
  useEffect(() => {
    if (committedCanvasRef.current) {
      committedCanvasRef.current.width = width;
      committedCanvasRef.current.height = height;
    }
    if (previewCanvasRef.current) {
      previewCanvasRef.current.width = width;
      previewCanvasRef.current.height = height;
    }
  }, [committedCanvasRef, previewCanvasRef, width, height, canvasMounted]);

  // Per-layer offscreen canvases, keyed by layer id. Each offscreen holds
  // the rasterised pixels for one layer at grid dimensions; the composite
  // pipeline blits them in order to the committed canvas.
  const offscreensRef = useRef<Map<string, HTMLCanvasElement>>(new Map());

  /** Last `width×height` we rasterised for; any change forces all layers dirty. */
  const lastRasterSizeKeyRef = useRef<string | null>(null);
  /** Last `layer.pixels` array we drew per layer id — reference equality with incoming `Layer`. */
  const lastDrawnPixelsRef = useRef<Map<string, string[]>>(new Map());

  // Ensure offscreens exist for every current layer, are sized to
  // `width × height`, and that orphaned entries are evicted.
  const syncOffscreens = useCallback(() => {
    const map = offscreensRef.current;
    const validIds = new Set(layers.map((l) => l.id));
    for (const key of Array.from(map.keys())) {
      if (!validIds.has(key)) map.delete(key);
    }
    for (const layer of layers) {
      let off = map.get(layer.id);
      if (!off) {
        off = document.createElement('canvas');
        map.set(layer.id, off);
      }
      if (off.width !== width) off.width = width;
      if (off.height !== height) off.height = height;
    }
    return map;
  }, [layers, width, height]);

  // Rasterise each layer's pixels onto its offscreen, then composite onto
  // the committed canvas. Runs on any layers/pixels/dimension change.
  // While a move-tool transform is pending, the active layer is skipped in
  // the composite so the committed canvas stops showing its original pixels —
  // the preview canvas draws the transformed version on top. Skipping (rather
  // than dispatching empty pixels) preserves the active layer's real pixel
  // state, so `commitPixels` at commit time captures the correct pre-transform
  // snapshot as the undo target.
  useLayoutEffect(() => {
    if (!committedCanvasRef.current) return;
    const map = syncOffscreens();
    const sizeKey = `${width}x${height}`;
    const sizeChanged = lastRasterSizeKeyRef.current !== sizeKey;
    if (sizeChanged) lastRasterSizeKeyRef.current = sizeKey;

    const validIds = new Set(layers.map((l) => l.id));
    for (const id of Array.from(lastDrawnPixelsRef.current.keys())) {
      if (!validIds.has(id)) lastDrawnPixelsRef.current.delete(id);
    }

    for (const layer of layers) {
      const off = map.get(layer.id);
      if (!off) continue;
      const prevPixels = lastDrawnPixelsRef.current.get(layer.id);
      const needsFullRaster = sizeChanged || prevPixels !== layer.pixels || prevPixels === undefined;

      const acc = activeLayerRasterPatchAccRef;
      if (layer.id === activeLayerId && acc && acc.current.size) {
        if (!needsFullRaster && prevPixels === layer.pixels) {
          const batch = Array.from(acc.current);
          acc.current.clear();
          if (batch.length > 0) {
            patchOpaqueCells(off, layer.pixels, width, batch);
          }
          continue;
        }
        acc.current.clear();
      }

      if (needsFullRaster) {
        drawLayer(off, layer.pixels, width);
        lastDrawnPixelsRef.current.set(layer.id, layer.pixels);
      }
    }
    const skipLayerId = layerTransformIsPending ? activeLayerId : undefined;
    compositeLayers(committedCanvasRef.current, layers, map, width, height, { skipLayerId });
    onAfterComposite?.();
  }, [
    committedCanvasRef,
    layers,
    width,
    height,
    canvasMounted,
    syncOffscreens,
    layerTransformIsPending,
    activeLayerId,
    onAfterComposite,
    activeLayerRasterPatchAccRef,
  ]);

  // Paint/eraser mid-stroke: RAF dispatch can rasterise pending pixels straight
  // onto offscreens + committed canvas (see `usePixelArtHistory` bypass) so
  // React is not driven every frame. `layersRef` keeps inactive layers current.
  useLayoutEffect(() => {
    if (!layersRef || !paintDragFlushRef || !paintDragAbortResyncRef) {
      if (paintDragFlushRef) paintDragFlushRef.current = null;
      if (paintDragAbortResyncRef) paintDragAbortResyncRef.current = null;
      return;
    }

    const syncMapForLayerList = (layerList: Layer[]) => {
      const map = offscreensRef.current;
      const validIds = new Set(layerList.map((l) => l.id));
      for (const key of Array.from(map.keys())) {
        if (!validIds.has(key)) map.delete(key);
      }
      for (const layer of layerList) {
        let off = map.get(layer.id);
        if (!off) {
          off = document.createElement('canvas');
          map.set(layer.id, off);
        }
        if (off.width !== width) off.width = width;
        if (off.height !== height) off.height = height;
      }
      return map;
    };

    const flush: PaintDragCanvasFlushFn = (buffer, cloneToLayer) => {
      const canvas = committedCanvasRef.current;
      if (!canvas) return;
      const L = layersRef.current;
      const map = syncMapForLayerList(L);
      const off = map.get(activeLayerId);
      if (!off) return;

      const acc = activeLayerRasterPatchAccRef;
      if (cloneToLayer || !acc || acc.current.size === 0) {
        acc?.current.clear();
        drawLayer(off, buffer as string[], width);
      } else {
        const batch = Array.from(acc.current);
        acc.current.clear();
        if (batch.length > 0) {
          patchOpaqueCells(off, buffer, width, batch);
        } else {
          drawLayer(off, buffer as string[], width);
        }
      }

      const compositeInput = L.map((l) =>
        l.id === activeLayerId ? { ...l, pixels: buffer as string[] } : l,
      );
      const skipLayerId = layerTransformIsPending ? activeLayerId : undefined;
      compositeLayers(canvas, compositeInput, map, width, height, { skipLayerId });
      onAfterComposite?.();
    };

    const abortResync = () => {
      const canvas = committedCanvasRef.current;
      if (!canvas) return;
      const L = layersRef.current;
      const map = syncMapForLayerList(L);
      for (const layer of L) {
        const off = map.get(layer.id);
        if (!off) continue;
        drawLayer(off, layer.pixels, width);
        lastDrawnPixelsRef.current.set(layer.id, layer.pixels);
      }
      const skipLayerId = layerTransformIsPending ? activeLayerId : undefined;
      compositeLayers(canvas, L, map, width, height, { skipLayerId });
      onAfterComposite?.();
    };

    paintDragFlushRef.current = flush;
    paintDragAbortResyncRef.current = abortResync;
    return () => {
      paintDragFlushRef.current = null;
      paintDragAbortResyncRef.current = null;
    };
  }, [
    layersRef,
    paintDragFlushRef,
    paintDragAbortResyncRef,
    committedCanvasRef,
    width,
    height,
    activeLayerId,
    layerTransformIsPending,
    activeLayerRasterPatchAccRef,
    onAfterComposite,
  ]);

  // Evict the entire offscreen map on unmount.
  useEffect(() => {
    const map = offscreensRef.current;
    return () => {
      map.clear();
      lastDrawnPixelsRef.current.clear();
      lastRasterSizeKeyRef.current = null;
    };
  }, []);
}
