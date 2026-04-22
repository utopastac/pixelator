/**
 * Layer-aware undo/redo + change emission for PixelArtEditor.
 *
 * Internally owns the `useLayers` state so history can push/pop the full
 * layer stack on commit / undo / redo. `activeLayerId` is deliberately NOT
 * part of the snapshot — selection is not undoable.
 *
 * The hook returns an `ActivePixels`-shaped bundle (`pixels`, `commit`,
 * `dispatch`, `emit`) so every existing tool hook can continue using the
 * same seam. `pixels` is the active layer's pixels, `commit`/`dispatch`
 * write to the active layer, and `emit` fires the user's `onChange` with
 * the updated `Layer[]`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Layer } from '@/lib/storage';
import { createEmptyPixels, newId } from '@/lib/storage';
import { useLayers } from './useLayers';
import { rotatePixels90 } from '../lib/transforms';
import { mergeDownPixels } from '../lib/composite';

/** Maximum number of past layer stacks retained in the undo stack. */
export const HISTORY_LIMIT = 50;

interface LayerSnapshot {
  layers: Layer[];
  width: number;
  height: number;
}

export interface UsePixelArtHistoryParams {
  width: number;
  height: number;
  initialLayers: Layer[];
  initialActiveLayerId: string;
  onChange?: (layers: Layer[]) => void;
  /** Fired from undo/redo (and commitResize) when the restored snapshot has
   *  different dimensions than the current editor. Consumers update managed
   *  size / persist dimensions through this callback. */
  onSizeChange?: (width: number, height: number) => void;
}

/**
 * Bundle of the four pixel-mutation concerns every tool hook needs. Shape is
 * preserved from the pre-layers API so consumers (usePenTool,
 * usePixelArtPointerHandlers, useCanvasKeyboardShortcuts) don't need edits.
 *
 * `pixels` is the active layer's pixels. `commit` writes those pixels to the
 * active layer AND pushes a history entry. `dispatch` writes without pushing
 * (mid-drag). `emit` fires `onChange(layers)`.
 *
 * `commit` accepts an optional `beforePixels` override. When provided, the
 * history snapshot uses those pixels for the active layer instead of reading
 * from the current React state. This is necessary when a tool dispatched a
 * temporary state (e.g. "cleared" pixels during a drag) and then calls
 * `commit` in the same synchronous batch — without the override the snapshot
 * would capture the dispatched temporary state rather than the true pre-move
 * pixels, causing undo to restore an empty/cleared layer.
 */
export interface ActivePixels {
  pixels: string[];
  commit: (next: string[], beforePixels?: string[]) => void;
  dispatch: (next: string[]) => void;
  emit: (next: string[]) => void;
}

export interface UsePixelArtHistoryResult {
  /** Alias of `activeLayer.pixels`, kept for ActivePixels parity. */
  pixels: string[];
  layers: Layer[];
  activeLayerId: string;

  canUndo: boolean;
  canRedo: boolean;

  dispatchPixels: (px: string[]) => void;
  commitPixels: (px: string[], beforePixels?: string[]) => void;
  /** Atomically replace the entire layer stack AND the editor dimensions as a
   *  single undoable step. Fires `onSizeChange` and `onChange` so autosave
   *  receives the post-resize state. */
  commitResize: (nextLayers: Layer[], nextWidth: number, nextHeight: number) => void;
  undo: () => void;
  redo: () => void;
  emitChange: (nextPixels: string[]) => void;

  // useLayers CRUD passthroughs, for Phase 3 UI.
  addLayer: (name?: string) => void;
  /** Insert a new layer whose pixels are pre-populated (e.g. from an image
   *  import). The inserted layer becomes active. Single undoable step. */
  addLayerWithPixels: (pixels: string[], name?: string) => void;
  /** Insert a new layer (canvas-sized pixels) immediately above the current
   *  active layer. Used by the paste flow so the pasted content lives just
   *  above whatever was focused when the user hit ⌘V. Single undoable step. */
  pasteAsNewLayer: (pixels: string[], name?: string) => void;
  duplicateLayer: (id: string) => void;
  duplicateLayerTo: (id: string, toIndex: number) => void;
  clearLayer: (id: string) => void;
  /** Rotate a specific layer's pixels 90° CW or CCW around its centre. Clips
   *  to current `width × height` (identity on square canvases, loses corner
   *  cells otherwise). Single undo step. Ignores any active selection. */
  rotateLayer: (id: string, dir: 'cw' | 'ccw') => void;
  deleteLayer: (id: string) => void;
  mergeDown: (layerId: string) => void;
  renameLayer: (id: string, name: string) => void;
  setLayerVisibility: (id: string, visible: boolean) => void;
  setLayerLocked: (id: string, locked: boolean) => void;
  /** Solo-toggle for visibility: if `id` is the only visible layer, restore
   *  all layers to visible; otherwise hide every other layer and ensure `id`
   *  is visible. Single undo step. */
  soloLayerVisibility: (id: string) => void;
  setLayerOpacity: (id: string, opacity: number) => void;
  moveLayer: (id: string, toIndex: number) => void;
  setActiveLayerId: (id: string) => void;
}

function cloneLayers(layers: Layer[]): Layer[] {
  // Shallow-per-layer is enough because pixels are replaced wholesale on
  // commit — we never mutate the pixel array in place.
  return layers.map((l) => ({ ...l }));
}

/**
 * Layer-aware undo/redo history for the editor. Wraps `useLayers` and adds a
 * past/future snapshot stack (capped at `HISTORY_LIMIT`). Every structural
 * layer operation (`addLayer`, `deleteLayer`, `renameLayer`, etc.) routes
 * through `applyLayers` so each change is undoable and fires `onChange` for
 * autosave. `dispatchPixels` writes mid-drag without a snapshot (coalesced to
 * one `requestAnimationFrame` per frame). `commitPixels` pushes a history entry.
 */
export function usePixelArtHistory(
  params: UsePixelArtHistoryParams,
): UsePixelArtHistoryResult {
  const { width, height, initialLayers, initialActiveLayerId, onChange, onSizeChange } = params;

  const layersApi = useLayers({
    width,
    height,
    initialLayers,
    initialActiveLayerId,
  });

  const [past, setPast] = useState<LayerSnapshot[]>([]);
  const [future, setFuture] = useState<LayerSnapshot[]>([]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const pixels = layersApi.activeLayer.pixels;
  const layers = layersApi.layers;
  const activeLayerId = layersApi.activeLayerId;

  const pendingDispatchRef = useRef<string[] | null>(null);
  const dispatchRafRef = useRef<number | null>(null);

  const cancelDispatchRaf = useCallback(() => {
    if (dispatchRafRef.current !== null) {
      cancelAnimationFrame(dispatchRafRef.current);
      dispatchRafRef.current = null;
    }
  }, []);

  const discardPendingDispatch = useCallback(() => {
    cancelDispatchRaf();
    pendingDispatchRef.current = null;
  }, [cancelDispatchRaf]);

  const flushDispatchPixelsToLayers = useCallback(() => {
    dispatchRafRef.current = null;
    const px = pendingDispatchRef.current;
    pendingDispatchRef.current = null;
    if (px !== null) {
      layersApi.setActiveLayerPixels(px);
    }
  }, [layersApi]);

  const takePendingDispatchOrNull = useCallback((): string[] | null => {
    cancelDispatchRaf();
    const p = pendingDispatchRef.current;
    pendingDispatchRef.current = null;
    return p;
  }, [cancelDispatchRaf]);

  const dispatchPixels = useCallback(
    (px: string[]) => {
      pendingDispatchRef.current = px;
      if (dispatchRafRef.current === null) {
        dispatchRafRef.current = requestAnimationFrame(() => {
          flushDispatchPixelsToLayers();
        });
      }
    },
    [flushDispatchPixelsToLayers],
  );

  const commitPixels = useCallback(
    (px: string[], beforePixels?: string[]) => {
      const pending = takePendingDispatchOrNull();

      // Snapshot current layers (pre-mutation), push onto past, clear future,
      // then apply the new pixels. `layersApi.layers` is the state as of this
      // render — a shallow clone is sufficient because we never mutate pixel
      // arrays in place.
      //
      // When `beforePixels` is provided, substitute the active layer's pixels
      // in the snapshot. This handles the case where a tool dispatched a
      // temporary "cleared" state during a drag: by the time commit is called,
      // `layersApi.layers` reflects that temporary state rather than the
      // original pixels, so the snapshot would be wrong without the override.
      //
      // When RAF-coalesced dispatches are pending, merge `pending` into the
      // active layer in the snapshot clone (React state may not have flushed yet).
      let snapshotLayers: Layer[];
      if (beforePixels !== undefined) {
        const cloned = cloneLayers(layersApi.layers);
        const idx = cloned.findIndex((l) => l.id === layersApi.activeLayerId);
        if (idx >= 0) cloned[idx] = { ...cloned[idx], pixels: beforePixels };
        snapshotLayers = cloned;
      } else {
        const cloned = cloneLayers(layersApi.layers);
        const idx = cloned.findIndex((l) => l.id === layersApi.activeLayerId);
        if (idx >= 0 && pending !== null) {
          cloned[idx] = { ...cloned[idx], pixels: pending };
        }
        snapshotLayers = cloned;
      }
      const snapshot: LayerSnapshot = { layers: snapshotLayers, width, height };
      setPast((prev) => [...prev, snapshot].slice(-HISTORY_LIMIT));
      setFuture([]);
      layersApi.setActiveLayerPixels(px);
    },
    [layersApi, width, height, takePendingDispatchOrNull],
  );

  const clearLayer = useCallback(
    (id: string) => {
      discardPendingDispatch();
      // Snapshot current layers, then replace the target layer's pixels with
      // an empty array. Undoable like any other commit.
      const snapshot: LayerSnapshot = { layers: cloneLayers(layersApi.layers), width, height };
      const nextLayers = layersApi.layers.map((l) =>
        l.id === id ? { ...l, pixels: createEmptyPixels(width, height) } : l,
      );
      setPast((prev) => [...prev, snapshot].slice(-HISTORY_LIMIT));
      setFuture([]);
      layersApi.replaceLayers(nextLayers, layersApi.activeLayerId);
      if (onChange) onChange(nextLayers);
    },
    [layersApi, width, height, onChange, discardPendingDispatch],
  );

  const rotateLayer = useCallback(
    (id: string, dir: 'cw' | 'ccw') => {
      discardPendingDispatch();
      const target = layersApi.layers.find((l) => l.id === id);
      if (!target) return;
      const snapshot: LayerSnapshot = { layers: cloneLayers(layersApi.layers), width, height };
      const rotated = rotatePixels90(target.pixels, width, height, dir);
      const nextLayers = layersApi.layers.map((l) =>
        l.id === id ? { ...l, pixels: rotated } : l,
      );
      setPast((prev) => [...prev, snapshot].slice(-HISTORY_LIMIT));
      setFuture([]);
      layersApi.replaceLayers(nextLayers, layersApi.activeLayerId);
      if (onChange) onChange(nextLayers);
    },
    [layersApi, width, height, onChange, discardPendingDispatch],
  );

  const commitResize = useCallback(
    (nextLayers: Layer[], nextWidth: number, nextHeight: number) => {
      discardPendingDispatch();
      // Snapshot the pre-resize layers AND dimensions so undo can restore both.
      const snapshot: LayerSnapshot = { layers: cloneLayers(layersApi.layers), width, height };
      setPast((prev) => [...prev, snapshot].slice(-HISTORY_LIMIT));
      setFuture([]);
      layersApi.replaceLayers(nextLayers, layersApi.activeLayerId);
      if (nextWidth !== width || nextHeight !== height) {
        onSizeChange?.(nextWidth, nextHeight);
      }
      if (onChange) onChange(nextLayers);
    },
    [layersApi, width, height, onSizeChange, onChange, discardPendingDispatch],
  );

  const emitChange = useCallback(
    (nextPixels: string[]) => {
      if (!onChange) return;
      // Do not call `discardPendingDispatch` here: paint/eraser pointer handlers
      // invoke `emit` immediately after `dispatch` on each move; discarding would
      // cancel the scheduled RAF and drop the pending pixels before they flush.
      // Build the post-mutation layer stack synchronously so autosave sees
      // the up-to-date shape regardless of React batching. `layersApi.layers`
      // is the pre-mutation value at this render; the active layer's pixels
      // need to be swapped for `nextPixels`.
      const idx = layersApi.layers.findIndex((l) => l.id === layersApi.activeLayerId);
      if (idx < 0) {
        onChange(layersApi.layers);
        return;
      }
      const next = layersApi.layers.slice();
      next[idx] = { ...next[idx], pixels: nextPixels };
      onChange(next);
    },
    [onChange, layersApi],
  );

  const undo = useCallback(() => {
    if (past.length === 0) return;
    discardPendingDispatch();
    const target = past[past.length - 1];
    const currentSnapshot: LayerSnapshot = { layers: cloneLayers(layersApi.layers), width, height };
    setPast(past.slice(0, -1));
    setFuture([currentSnapshot, ...future]);
    layersApi.replaceLayers(target.layers, layersApi.activeLayerId);
    if (target.width !== width || target.height !== height) {
      onSizeChange?.(target.width, target.height);
    }
    if (onChange) onChange(target.layers);
  }, [past, future, layersApi, width, height, onSizeChange, onChange, discardPendingDispatch]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    discardPendingDispatch();
    const target = future[0];
    const currentSnapshot: LayerSnapshot = { layers: cloneLayers(layersApi.layers), width, height };
    setPast([...past, currentSnapshot].slice(-HISTORY_LIMIT));
    setFuture(future.slice(1));
    layersApi.replaceLayers(target.layers, layersApi.activeLayerId);
    if (target.width !== width || target.height !== height) {
      onSizeChange?.(target.width, target.height);
    }
    if (onChange) onChange(target.layers);
  }, [past, future, layersApi, width, height, onSizeChange, onChange, discardPendingDispatch]);

  // ── Layer CRUD: snapshot for undo, apply via replaceLayers, fire onChange ──
  // Each helper reads the current `layersApi.layers` at call time, computes
  // the next stack, records a history entry, then emits so autosave picks it
  // up. Centralising here means every user-visible structural change is
  // undoable AND persisted — bypassing useLayers' direct setState paths which
  // do neither.

  const applyLayers = useCallback(
    (nextLayers: Layer[], nextActiveId: string) => {
      discardPendingDispatch();
      const snapshot: LayerSnapshot = { layers: cloneLayers(layersApi.layers), width, height };
      setPast((prev) => [...prev, snapshot].slice(-HISTORY_LIMIT));
      setFuture([]);
      layersApi.replaceLayers(nextLayers, nextActiveId);
      if (onChange) onChange(nextLayers);
    },
    [layersApi, width, height, onChange, discardPendingDispatch],
  );

  const addLayer = useCallback(
    (name?: string) => {
      const layer: Layer = {
        id: newId(),
        name: name ?? `Layer ${layersApi.layers.length + 1}`,
        visible: true,
        opacity: 1,
        pixels: createEmptyPixels(width, height),
      };
      applyLayers([...layersApi.layers, layer], layer.id);
    },
    [applyLayers, layersApi.layers, width, height],
  );

  const addLayerWithPixels = useCallback(
    (pixelsToInsert: string[], name?: string) => {
      // Caller is responsible for passing an array of length width*height —
      // the importer guarantees this because it draws into a canvas of the
      // exact same dimensions.
      const layer: Layer = {
        id: newId(),
        name: name ?? `Layer ${layersApi.layers.length + 1}`,
        visible: true,
        opacity: 1,
        pixels: pixelsToInsert,
      };
      applyLayers([...layersApi.layers, layer], layer.id);
    },
    [applyLayers, layersApi.layers],
  );

  const pasteAsNewLayer = useCallback(
    (pixelsToInsert: string[], name?: string) => {
      // Inserted immediately above the current active layer so a paste on a
      // mid-stack layer doesn't silently sink below higher layers. If the
      // active layer is at the top, the new layer goes at the end.
      const layer: Layer = {
        id: newId(),
        name: name ?? 'Paste',
        visible: true,
        opacity: 1,
        pixels: pixelsToInsert,
      };
      const activeIdx = layersApi.layers.findIndex((l) => l.id === layersApi.activeLayerId);
      const insertAt = activeIdx < 0 ? layersApi.layers.length : activeIdx + 1;
      const nextLayers = layersApi.layers.slice();
      nextLayers.splice(insertAt, 0, layer);
      applyLayers(nextLayers, layer.id);
    },
    [applyLayers, layersApi.layers, layersApi.activeLayerId],
  );

  const duplicateLayer = useCallback(
    (id: string) => {
      const idx = layersApi.layers.findIndex((l) => l.id === id);
      if (idx < 0) return;
      const src = layersApi.layers[idx];
      const copy: Layer = {
        id: newId(),
        name: `${src.name} copy`,
        visible: src.visible,
        opacity: src.opacity,
        pixels: [...src.pixels],
      };
      const nextLayers = layersApi.layers.slice();
      nextLayers.splice(idx + 1, 0, copy);
      applyLayers(nextLayers, copy.id);
    },
    [applyLayers, layersApi.layers],
  );

  const duplicateLayerTo = useCallback(
    (id: string, toIndex: number) => {
      const src = layersApi.layers.find((l) => l.id === id);
      if (!src) return;
      const copy: Layer = {
        id: newId(),
        name: `${src.name} copy`,
        visible: src.visible,
        opacity: src.opacity,
        pixels: [...src.pixels],
      };
      const clamped = Math.min(Math.max(0, toIndex), layersApi.layers.length);
      const nextLayers = layersApi.layers.slice();
      nextLayers.splice(clamped, 0, copy);
      applyLayers(nextLayers, copy.id);
    },
    [applyLayers, layersApi.layers],
  );

  const deleteLayer = useCallback(
    (id: string) => {
      const nextLayers = layersApi.layers.filter((l) => l.id !== id);
      // useLayers' replaceLayers runs ensureInvariants which keeps ≥1 layer,
      // so if the caller tries to delete the last one we just no-op here.
      if (nextLayers.length === 0) return;
      const nextActive = layersApi.activeLayerId === id
        ? (nextLayers[0]?.id ?? '')
        : layersApi.activeLayerId;
      applyLayers(nextLayers, nextActive);
    },
    [applyLayers, layersApi.layers, layersApi.activeLayerId],
  );

  const mergeDown = useCallback(
    (layerId: string) => {
      const idxInArray = layersApi.layers.findIndex((l) => l.id === layerId);
      if (idxInArray === 0) return;
      const currentLayer = layersApi.layers[idxInArray];
      const lowerLayer = layersApi.layers[idxInArray - 1];
      const mergedPixels = mergeDownPixels(currentLayer, lowerLayer);
      const nextLayers = layersApi.layers
        .map((l) => l.id === lowerLayer.id ? { ...lowerLayer, pixels: mergedPixels, opacity: 1, visible: true } : l)
        .filter((l) => l.id !== layerId);
      applyLayers(nextLayers, lowerLayer.id);
    },
    [applyLayers, layersApi.layers],
  );

  const renameLayer = useCallback(
    (id: string, name: string) => {
      const nextLayers = layersApi.layers.map((l) => (l.id === id ? { ...l, name } : l));
      applyLayers(nextLayers, layersApi.activeLayerId);
    },
    [applyLayers, layersApi.layers, layersApi.activeLayerId],
  );

  const setLayerVisibility = useCallback(
    (id: string, visible: boolean) => {
      const nextLayers = layersApi.layers.map((l) => (l.id === id ? { ...l, visible } : l));
      applyLayers(nextLayers, layersApi.activeLayerId);
    },
    [applyLayers, layersApi.layers, layersApi.activeLayerId],
  );

  const setLayerLocked = useCallback(
    (id: string, locked: boolean) => {
      const nextLayers = layersApi.layers.map((l) => (l.id === id ? { ...l, locked } : l));
      applyLayers(nextLayers, layersApi.activeLayerId);
    },
    [applyLayers, layersApi.layers, layersApi.activeLayerId],
  );

  const soloLayerVisibility = useCallback(
    (id: string) => {
      const current = layersApi.layers;
      const target = current.find((l) => l.id === id);
      if (!target) return;
      const onlyTargetVisible =
        target.visible && current.every((l) => (l.id === id ? true : !l.visible));
      const nextLayers = onlyTargetVisible
        ? current.map((l) => (l.visible ? l : { ...l, visible: true }))
        : current.map((l) => ({ ...l, visible: l.id === id }));
      const changed = current.some((l, i) => l.visible !== nextLayers[i].visible);
      if (!changed) return;
      applyLayers(nextLayers, layersApi.activeLayerId);
    },
    [applyLayers, layersApi.layers, layersApi.activeLayerId],
  );

  const setLayerOpacity = useCallback(
    (id: string, opacity: number) => {
      const clamped = Math.min(1, Math.max(0, opacity));
      const nextLayers = layersApi.layers.map((l) => (l.id === id ? { ...l, opacity: clamped } : l));
      applyLayers(nextLayers, layersApi.activeLayerId);
    },
    [applyLayers, layersApi.layers, layersApi.activeLayerId],
  );

  const moveLayer = useCallback(
    (id: string, toIndex: number) => {
      const from = layersApi.layers.findIndex((l) => l.id === id);
      if (from < 0) return;
      const target = Math.min(Math.max(0, toIndex), layersApi.layers.length - 1);
      if (from === target) return;
      const nextLayers = layersApi.layers.slice();
      const [moved] = nextLayers.splice(from, 1);
      nextLayers.splice(target, 0, moved);
      applyLayers(nextLayers, layersApi.activeLayerId);
    },
    [applyLayers, layersApi.layers, layersApi.activeLayerId],
  );

  useEffect(
    () => () => {
      discardPendingDispatch();
    },
    [discardPendingDispatch],
  );

  return {
    pixels,
    layers,
    activeLayerId,
    canUndo,
    canRedo,
    dispatchPixels,
    commitPixels,
    commitResize,
    undo,
    redo,
    emitChange,
    addLayer,
    addLayerWithPixels,
    pasteAsNewLayer,
    duplicateLayer,
    duplicateLayerTo,
    clearLayer,
    rotateLayer,
    deleteLayer,
    mergeDown,
    renameLayer,
    setLayerVisibility,
    soloLayerVisibility,
    setLayerLocked,
    setLayerOpacity,
    moveLayer,
    setActiveLayerId: layersApi.setActiveLayerId,
  };
}
