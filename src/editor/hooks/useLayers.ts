/**
 * Runtime layer state for the PixelArtEditor. Owns the `Layer[]` array, the
 * active layer id, and all layer-level mutations. Seeded from props on mount
 * (and via `key={drawing.id}` remount when switching drawings).
 *
 * The invariant is: `layers.length >= 1` and `activeLayerId` always refers to
 * an existing layer. If a caller violates the invariant (e.g. deletes the
 * last layer) we recover by selecting the first remaining layer, or — if the
 * array ends up empty — by inserting a fresh Background layer.
 */

import { useCallback, useMemo, useState } from 'react';
import { createDefaultLayer, createEmptyPixels, newId, type Layer } from '@/lib/storage';

export interface UseLayersArgs {
  width: number;
  height: number;
  initialLayers: Layer[];
  initialActiveLayerId: string;
}

export interface UseLayersReturn {
  layers: Layer[];
  activeLayerId: string;
  activeLayer: Layer;
  activeLayerIndex: number;

  setActiveLayerPixels: (pixels: string[]) => void;
  replaceLayers: (layers: Layer[], activeLayerId: string) => void;

  addLayer: (name?: string) => void;
  duplicateLayer: (id: string) => void;
  duplicateLayerTo: (id: string, toIndex: number) => void;
  deleteLayer: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  setLayerVisibility: (id: string, visible: boolean) => void;
  setLayerOpacity: (id: string, opacity: number) => void;
  moveLayer: (id: string, toIndex: number) => void;
  setActiveLayerId: (id: string) => void;
}

function ensureInvariants(
  width: number,
  height: number,
  layers: Layer[],
  activeLayerId: string,
): { layers: Layer[]; activeLayerId: string } {
  if (layers.length === 0) {
    const fresh = createDefaultLayer(width, height);
    return { layers: [fresh], activeLayerId: fresh.id };
  }
  if (!layers.some((l) => l.id === activeLayerId)) {
    return { layers, activeLayerId: layers[0].id };
  }
  return { layers, activeLayerId };
}

/**
 * Raw layer-stack state for the editor. Owns the `Layer[]` array and the active
 * layer id with all CRUD mutations. Enforces the invariant that `layers.length >= 1`
 * and `activeLayerId` always refers to an existing layer.
 *
 * Do not call these mutations directly from component code — route writes
 * through `usePixelArtHistory` so changes are undoable and trigger autosave.
 */
export function useLayers(args: UseLayersArgs): UseLayersReturn {
  const { width, height } = args;
  const [state, setState] = useState<{ layers: Layer[]; activeLayerId: string }>(() =>
    ensureInvariants(width, height, args.initialLayers, args.initialActiveLayerId),
  );

  const layers = state.layers;
  const activeLayerId = state.activeLayerId;
  const activeLayerIndex = useMemo(
    () => Math.max(0, layers.findIndex((l) => l.id === activeLayerId)),
    [layers, activeLayerId],
  );
  const activeLayer = layers[activeLayerIndex];

  const setActiveLayerPixels = useCallback((pixels: string[]) => {
    setState((prev) => {
      const idx = prev.layers.findIndex((l) => l.id === prev.activeLayerId);
      if (idx < 0) return prev;
      const nextLayers = prev.layers.slice();
      nextLayers[idx] = { ...nextLayers[idx], pixels };
      return { layers: nextLayers, activeLayerId: prev.activeLayerId };
    });
  }, []);

  const replaceLayers = useCallback(
    (nextLayers: Layer[], nextActiveId: string) => {
      setState(() => ensureInvariants(width, height, nextLayers, nextActiveId));
    },
    [width, height],
  );

  // ── CRUD (unused in Phase 2; exposed for Phase 3 UI) ──────────────────────

  const addLayer = useCallback(
    (name?: string) => {
      setState((prev) => {
        const layer: Layer = {
          id: newId(),
          name: name ?? `Layer ${prev.layers.length + 1}`,
          visible: true,
          opacity: 1,
          pixels: createEmptyPixels(width, height),
        };
        // New layer goes on top (end of array = bottom→top ordering).
        return { layers: [...prev.layers, layer], activeLayerId: layer.id };
      });
    },
    [width, height],
  );

  const duplicateLayer = useCallback((id: string) => {
    setState((prev) => {
      const idx = prev.layers.findIndex((l) => l.id === id);
      if (idx < 0) return prev;
      const src = prev.layers[idx];
      const copy: Layer = {
        id: newId(),
        name: `${src.name} copy`,
        visible: src.visible,
        opacity: src.opacity,
        pixels: [...src.pixels],
      };
      const nextLayers = prev.layers.slice();
      nextLayers.splice(idx + 1, 0, copy);
      return { layers: nextLayers, activeLayerId: copy.id };
    });
  }, []);

  /**
   * Duplicate `id` and insert the clone at array index `toIndex` in the
   * resulting array (clamped to [0, length]). Used by alt-drag reorder to
   * drop a copy at an arbitrary stack position.
   */
  const duplicateLayerTo = useCallback((id: string, toIndex: number) => {
    setState((prev) => {
      const src = prev.layers.find((l) => l.id === id);
      if (!src) return prev;
      const copy: Layer = {
        id: newId(),
        name: `${src.name} copy`,
        visible: src.visible,
        opacity: src.opacity,
        pixels: [...src.pixels],
      };
      const clamped = Math.min(Math.max(0, toIndex), prev.layers.length);
      const nextLayers = prev.layers.slice();
      nextLayers.splice(clamped, 0, copy);
      return { layers: nextLayers, activeLayerId: copy.id };
    });
  }, []);

  const deleteLayer = useCallback(
    (id: string) => {
      setState((prev) => {
        const nextLayers = prev.layers.filter((l) => l.id !== id);
        const nextActive = prev.activeLayerId === id
          ? (nextLayers[0]?.id ?? '')
          : prev.activeLayerId;
        return ensureInvariants(width, height, nextLayers, nextActive);
      });
    },
    [width, height],
  );

  const renameLayer = useCallback((id: string, name: string) => {
    setState((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? { ...l, name } : l)),
    }));
  }, []);

  const setLayerVisibility = useCallback((id: string, visible: boolean) => {
    setState((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? { ...l, visible } : l)),
    }));
  }, []);

  const setLayerOpacity = useCallback((id: string, opacity: number) => {
    const clamped = Math.min(1, Math.max(0, opacity));
    setState((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? { ...l, opacity: clamped } : l)),
    }));
  }, []);

  const moveLayer = useCallback((id: string, toIndex: number) => {
    setState((prev) => {
      const from = prev.layers.findIndex((l) => l.id === id);
      if (from < 0) return prev;
      const target = Math.min(Math.max(0, toIndex), prev.layers.length - 1);
      if (from === target) return prev;
      const nextLayers = prev.layers.slice();
      const [moved] = nextLayers.splice(from, 1);
      nextLayers.splice(target, 0, moved);
      return { ...prev, layers: nextLayers };
    });
  }, []);

  const setActiveLayerId = useCallback((id: string) => {
    setState((prev) => (prev.layers.some((l) => l.id === id)
      ? { ...prev, activeLayerId: id }
      : prev));
  }, []);

  return {
    layers,
    activeLayerId,
    activeLayer,
    activeLayerIndex,
    setActiveLayerPixels,
    replaceLayers,
    addLayer,
    duplicateLayer,
    duplicateLayerTo,
    deleteLayer,
    renameLayer,
    setLayerVisibility,
    setLayerOpacity,
    moveLayer,
    setActiveLayerId,
  };
}

// Re-export Layer so consumers inside the editor package can import from here
// without round-tripping through `@/lib/storage`.
export type { Layer };
