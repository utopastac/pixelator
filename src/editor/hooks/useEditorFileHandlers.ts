import React, { useRef, useCallback, useEffect, useState } from 'react';
import { importImageAsPixels, layerNameFromFile } from '@/lib/imageImport';
import {
  applyClipToNewLayer,
  buildClip,
  clearSelectionCells,
  getClip,
  hasClip,
  resolveAnchor,
  setClip,
} from '@/lib/clipboard';
import type { Layer } from '@/lib/storage';
import type { PixelArtSelection } from './usePixelArtSelection';
import type { PenContext } from './usePenTool';

interface UseEditorFileHandlersProps {
  width: number;
  height: number;
  addLayerWithPixels: (pixels: string[], name: string) => void;
  pasteAsNewLayer: (pixels: string[], name: string) => void;
  commitPixels: (px: string[]) => void;
  emitChange: (px: string[]) => void;
  selection: PixelArtSelection | null;
  activeLayer: Layer | null;
  activeLayerLocked: boolean;
  selectionContainsCell: (col: number, row: number) => boolean;
  penContext: PenContext;
}

interface UseEditorFileHandlersReturn {
  onWrapperDragOver: (e: React.DragEvent) => void;
  onWrapperDrop: (e: React.DragEvent) => void;
  handleCopy: () => void;
  handleCut: () => void;
  handlePaste: () => void;
  importToast: string | null;
}

/**
 * Wires up all ways an image can enter the editor: file drag-drop onto the
 * canvas wrapper, a window-level paste event (system clipboard image or
 * internal PixelClip), and the Cut / Copy / Paste clipboard verbs shared
 * between keyboard shortcuts and the context menu. Installs a window
 * `paste` listener on mount.
 */
export function useEditorFileHandlers({
  width,
  height,
  addLayerWithPixels,
  pasteAsNewLayer,
  commitPixels,
  emitChange,
  selection,
  activeLayer,
  activeLayerLocked,
  selectionContainsCell,
  penContext,
}: UseEditorFileHandlersProps): UseEditorFileHandlersReturn {
  // ── Import toast ─────────────────────────────────────────────────────────────
  const [importToast, setImportToast] = useState<string | null>(null);
  const importToastTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (importToastTimerRef.current !== null) window.clearTimeout(importToastTimerRef.current);
  }, []);

  // ── Image import ────────────────────────────────────────────────────────────
  // Single entry point for every way an image can enter the drawing. Resolves
  // the layer name from File metadata when available (upload / drop), or
  // falls back to a caller-supplied label (paste has no filename).
  const handleImportFile = useCallback(
    async (file: Blob, fallbackName: string) => {
      try {
        const importedPixels = await importImageAsPixels(file, width, height);
        const name = file instanceof File ? layerNameFromFile(file) : fallbackName;
        addLayerWithPixels(importedPixels, name);
      } catch (err) {
        if (importToastTimerRef.current !== null) window.clearTimeout(importToastTimerRef.current);
        setImportToast('Could not read that file');
        importToastTimerRef.current = window.setTimeout(() => {
          setImportToast(null);
          importToastTimerRef.current = null;
        }, 2500);
      }
    },
    [width, height, addLayerWithPixels],
  );

  // `handlePaste` is declared later; ref bridge lets the window listener close
  // over the current value without rebinding on every render.
  const handlePasteRef = useRef<() => void>(() => {});

  // Window-level paste listener. Scoped so it doesn't hijack ⌘V in text-editing
  // surfaces (layer names, drawing titles, hex inputs).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt) {
        const tag = tgt.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tgt.isContentEditable) return;
      }
      // Internal PixelClip takes priority: if the user just copied from the
      // canvas, that selection should paste — not whatever image was previously
      // in the system clipboard. Image import from the system clipboard only
      // fires when there is no internal clip (e.g. first paste after opening).
      if (hasClip()) {
        e.preventDefault();
        handlePasteRef.current();
        return;
      }
      const items = e.clipboardData?.items;
      if (items) {
        for (const item of Array.from(items)) {
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              void handleImportFile(file, 'Pasted');
              return;
            }
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleImportFile]);

  // ── Drag-drop ───────────────────────────────────────────────────────────────
  // Only react to file drags (not internal DnD like layer reorder).
  const onWrapperDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const onWrapperDrop = useCallback(
    (e: React.DragEvent) => {
      const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'));
      if (!file) return;
      e.preventDefault();
      void handleImportFile(file, 'Dropped image');
    },
    [handleImportFile],
  );

  // ── Clipboard verbs (Cut / Copy / Paste) ────────────────────────────────────
  // Shared between keyboard shortcuts and the canvas context menu.
  const handleCopy = useCallback(() => {
    if (!selection || !activeLayer) return;
    const clip = buildClip(
      activeLayer.pixels,
      width,
      height,
      selection,
      selectionContainsCell,
      activeLayer.name,
    );
    setClip(clip);
  }, [selection, activeLayer, width, height, selectionContainsCell]);

  const handleCut = useCallback(() => {
    if (!selection || !activeLayer || activeLayerLocked) return;
    const clip = buildClip(
      activeLayer.pixels,
      width,
      height,
      selection,
      selectionContainsCell,
      activeLayer.name,
    );
    setClip(clip);
    const nextPixels = clearSelectionCells(
      activeLayer.pixels,
      selection,
      width,
      height,
      selectionContainsCell,
    );
    commitPixels(nextPixels);
    emitChange(nextPixels);
  }, [
    selection, activeLayer, activeLayerLocked,
    width, height, selectionContainsCell, commitPixels, emitChange,
  ]);

  const handlePaste = useCallback(() => {
    const clip = getClip();
    if (!clip) return;
    // Cancel any in-flight pen path so its anchors don't bleed onto the new
    // layer mid-paste — matches the "Escape first" muscle memory.
    penContext.cancel();
    const anchor = resolveAnchor(clip, selection, width, height);
    const layerPixels = applyClipToNewLayer(clip, width, height, anchor);
    const name = clip.sourceLayerName ? `Copy of ${clip.sourceLayerName}` : 'Paste';
    pasteAsNewLayer(layerPixels, name);
  }, [selection, width, height, pasteAsNewLayer, penContext]);

  // Keep the paste listener's ref in sync so the window `paste` handler
  // calls the current `handlePaste`.
  useEffect(() => {
    handlePasteRef.current = handlePaste;
  }, [handlePaste]);

  return {
    onWrapperDragOver,
    onWrapperDrop,
    handleCopy,
    handleCut,
    handlePaste,
    importToast,
  };
}
