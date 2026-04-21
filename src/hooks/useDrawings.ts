import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createDefaultLayer,
  createEmptyPixels,
  newId,
  saveStore,
  type Drawing,
  type Layer,
} from '@/lib/storage';
import { loadInitialState } from '@/lib/seedDrawings';

const AUTOSAVE_DELAY_MS = 300;

export interface DrawingsApi {
  drawings: Drawing[];
  currentDrawing: Drawing | null;
  currentDrawingId: string | null;
  selectDrawing: (id: string | null) => void;
  createDrawing: (opts?: { name?: string; width?: number; height?: number }) => Drawing;
  renameDrawing: (id: string, name: string) => void;
  duplicateDrawing: (id: string) => Drawing | null;
  deleteDrawing: (id: string) => void;
  /**
   * Replace the current drawing's layers. Debounced-autosaves to localStorage.
   * The editor calls this on every pixel mutation; the store commits
   * `AUTOSAVE_DELAY_MS` after the last edit.
   */
  updateCurrentLayers: (layers: Layer[]) => void;
  resizeCurrent: (width: number, height: number) => void;
  /** Set the palette id for a specific drawing. Does not mutate canvas pixels
   *  — only changes which swatches are displayed in the toolbar. */
  setDrawingPaletteId: (drawingId: string, paletteId: string) => void;
  /** Persist the active layer id for the current drawing. Called when the user
   *  switches layers so the selection survives a page reload. */
  updateCurrentActiveLayerId: (activeLayerId: string) => void;
  /**
   * Append imported drawings (or any externally-built drawings) to the list.
   * Incoming drawings land at the front — matching the "new drawing prepends"
   * convention — and the first of them becomes selected. Caller is expected
   * to have rewritten ids already if collision is a concern.
   */
  appendDrawings: (incoming: Drawing[]) => void;
}

function cloneLayer(layer: Layer, opts?: { id?: string }): Layer {
  return {
    id: opts?.id ?? layer.id,
    name: layer.name,
    visible: layer.visible,
    opacity: layer.opacity,
    pixels: [...layer.pixels],
  };
}

/**
 * Top-level drawings store: owns the `Drawing[]` list, the current selection,
 * and all CRUD. Autosaves to localStorage via a 300 ms debounced effect on
 * pixel mutations; structural changes (rename, resize, palette) persist eagerly.
 */
export function useDrawings(): DrawingsApi {
  // `loadInitialState` handles both the "load persisted state" and the
  // "first-launch seed" paths. Calling it via a ref guarantees it runs
  // exactly once per hook mount so both useState initializers see the same
  // result (the seed path persists the store on its first call, but calling
  // it twice from independent initializers would still be wasteful).
  const initialRef = useRef<ReturnType<typeof loadInitialState> | null>(null);
  if (initialRef.current === null) initialRef.current = loadInitialState();

  const [drawings, setDrawings] = useState<Drawing[]>(initialRef.current.drawings);
  const [currentDrawingId, setCurrentDrawingId] = useState<string | null>(
    initialRef.current.currentDrawingId,
  );
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback((next: Drawing[], currentId: string | null) => {
    saveStore({ schemaVersion: 2, drawings: next, currentDrawingId: currentId });
  }, []);

  useEffect(() => {
    persist(drawings, currentDrawingId);
  }, [drawings, currentDrawingId, persist]);

  const selectDrawing = useCallback((id: string | null) => {
    setCurrentDrawingId(id);
  }, []);

  const createDrawing = useCallback(
    (opts?: { name?: string; width?: number; height?: number }) => {
      const now = Date.now();
      const width = opts?.width ?? 16;
      const height = opts?.height ?? 16;
      const layer = createDefaultLayer(width, height);
      const drawing: Drawing = {
        id: newId(),
        name: opts?.name ?? 'Untitled',
        width,
        height,
        layers: [layer],
        activeLayerId: layer.id,
        createdAt: now,
        updatedAt: now,
      };
      setDrawings((prev) => [drawing, ...prev]);
      setCurrentDrawingId(drawing.id);
      return drawing;
    },
    [],
  );

  const renameDrawing = useCallback((id: string, name: string) => {
    setDrawings((prev) =>
      prev.map((d) => (d.id === id ? { ...d, name, updatedAt: Date.now() } : d)),
    );
  }, []);

  const duplicateDrawing = useCallback(
    (id: string): Drawing | null => {
      const source = drawings.find((d) => d.id === id);
      if (!source) return null;
      const now = Date.now();
      // Deep-clone layers: each gets a fresh id + its own pixel array so
      // future edits don't alias the source drawing.
      const idMap = new Map<string, string>();
      const clonedLayers = source.layers.map((l) => {
        const fresh = newId();
        idMap.set(l.id, fresh);
        return cloneLayer(l, { id: fresh });
      });
      const copy: Drawing = {
        id: newId(),
        name: `${source.name} copy`,
        width: source.width,
        height: source.height,
        layers: clonedLayers,
        activeLayerId: idMap.get(source.activeLayerId) ?? clonedLayers[0].id,
        createdAt: now,
        updatedAt: now,
      };
      setDrawings((prev) => [copy, ...prev]);
      setCurrentDrawingId(copy.id);
      return copy;
    },
    [drawings],
  );

  const deleteDrawing = useCallback(
    (id: string) => {
      setDrawings((prev) => prev.filter((d) => d.id !== id));
      if (currentDrawingId === id) setCurrentDrawingId(null);
    },
    [currentDrawingId],
  );

  const updateCurrentLayers = useCallback(
    (layers: Layer[]) => {
      if (!currentDrawingId) return;
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => {
        setDrawings((prev) =>
          prev.map((d) =>
            d.id === currentDrawingId ? { ...d, layers, updatedAt: Date.now() } : d,
          ),
        );
      }, AUTOSAVE_DELAY_MS);
    },
    [currentDrawingId],
  );

  const resizeCurrent = useCallback(
    (width: number, height: number) => {
      if (!currentDrawingId) return;
      setDrawings((prev) =>
        prev.map((d) => {
          if (d.id !== currentDrawingId) return d;
          // Resetting size clears all layers' pixels but preserves layer
          // metadata (name/visibility/opacity) and ids.
          const layers: Layer[] = d.layers.map((l) => ({
            ...l,
            pixels: createEmptyPixels(width, height),
          }));
          return { ...d, width, height, layers, updatedAt: Date.now() };
        }),
      );
    },
    [currentDrawingId],
  );

  const updateCurrentActiveLayerId = useCallback(
    (activeLayerId: string) => {
      if (!currentDrawingId) return;
      setDrawings((prev) =>
        prev.map((d) => (d.id === currentDrawingId ? { ...d, activeLayerId } : d)),
      );
    },
    [currentDrawingId],
  );

  const setDrawingPaletteId = useCallback((drawingId: string, paletteId: string) => {
    setDrawings((prev) =>
      prev.map((d) =>
        d.id === drawingId ? { ...d, paletteId, updatedAt: Date.now() } : d,
      ),
    );
  }, []);

  const appendDrawings = useCallback((incoming: Drawing[]) => {
    if (incoming.length === 0) return;
    setDrawings((prev) => [...incoming, ...prev]);
    setCurrentDrawingId(incoming[0].id);
  }, []);

  const currentDrawing = drawings.find((d) => d.id === currentDrawingId) ?? null;

  return {
    drawings,
    currentDrawing,
    currentDrawingId,
    selectDrawing,
    createDrawing,
    renameDrawing,
    duplicateDrawing,
    deleteDrawing,
    updateCurrentLayers,
    updateCurrentActiveLayerId,
    resizeCurrent,
    setDrawingPaletteId,
    appendDrawings,
  };
}
