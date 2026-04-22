import { useCallback } from 'react';
import type { Layer } from '@/lib/storage';
import { compositeToSvg, flattenLayers } from './lib/composite';
import { pixelsToPngBlob } from './lib/pixelArtPng';
import { pixelsToSvg, resizeLayerCentered } from './lib/pixelArtUtils';
import { rotatePixels90 } from './lib/transforms';
import type { PixelArtSelection } from './lib/pixelArtUtils';
import type { SelectionDragContext } from './hooks/usePixelArtSelection';

/**
 * Inputs for `useEditorCommands`. Every field is a reference to state or a
 * callback already owned by `PixelArtEditor` — this hook doesn't own any
 * state itself, it just groups the one-shot editor commands (rotate,
 * resize, selection-clear, downloads) that `PixelArtEditor.tsx` used to
 * define inline.
 *
 * Grouping them here keeps each command's dependency list local to the hook
 * and makes the editor component's JSX the main thing in the file.
 */
export interface UseEditorCommandsInput {
  // Geometry.
  width: number;
  height: number;
  pixels: string[];
  layers: Layer[];

  // Paint plumbing shared with keyboard shortcuts.
  allowCommitOrSignal: () => boolean;
  commitPixels: (next: string[]) => void;
  commitResize: (layers: Layer[], width: number, height: number) => void;
  emitChange: (next: string[]) => void;

  // Selection.
  selection: PixelArtSelection | null;
  setSelection: React.Dispatch<React.SetStateAction<PixelArtSelection | null>>;
  selectionContainsCell: (col: number, row: number) => boolean;
  dragContext: SelectionDragContext;

  // Resize gating — picker is only wired when the editor is in sizes-managed mode.
  sizesEnabled: boolean;

  // Export metadata.
  title: string | undefined;
  pngExportScale: number;
  /** When true, PNG export prefers the system share sheet (Save to Photos on iOS / similar on Android). */
  isMobile?: boolean;
}

export interface EditorCommands {
  handleRotate: (dir: 'cw' | 'ccw') => void;
  handlePickSize: (nextWidth: number, nextHeight: number) => void;
  clearSelection: () => void;
  downloadSvg: () => void;
  downloadPng: (scale?: number) => Promise<void>;
  downloadLayersSvg: () => Promise<void>;
}

/** Trigger a browser download for `blob`. Revoke is deferred — revoking
 *  synchronously can race the browser starting the download, especially
 *  when several downloads are fired in quick succession. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Mobile: `navigator.share({ files: [png] })` opens the OS share sheet, where
 * the user can pick Photos / “Save Image” (no direct Camera Roll API on the web).
 * Returns whether the flow finished without needing a file download fallback.
 */
async function trySharePngForMobile(blob: Blob, filename: string): Promise<'shared' | 'cancelled' | 'failed'> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return 'failed';
  const file = new File([blob], filename, { type: blob.type || 'image/png' });
  const data: ShareData = {
    files: [file],
    title: filename.replace(/\.png$/i, ''),
  };
  if (typeof navigator.canShare === 'function' && !navigator.canShare(data)) return 'failed';
  try {
    await navigator.share(data);
    return 'shared';
  } catch (e) {
    const name = e instanceof DOMException ? e.name : (e as Error)?.name;
    if (name === 'AbortError') return 'cancelled';
    return 'failed';
  }
}

/** Sanitise a human-readable name into something safe for a filesystem. */
function slugify(name: string, fallback: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || fallback;
}

/** Groups the editor's one-shot commands — rotate, resize, selection-clear, and all download variants — so PixelArtEditor.tsx stays focused on JSX. */
export function useEditorCommands(input: UseEditorCommandsInput): EditorCommands {
  const {
    width, height, pixels, layers,
    allowCommitOrSignal, commitPixels, commitResize, emitChange,
    selection, setSelection, selectionContainsCell, dragContext,
    sizesEnabled, title, pngExportScale, isMobile = false,
  } = input;

  const exportBaseName = useCallback(
    () => slugify(title ?? '', 'pixel-art'),
    [title],
  );

  const downloadSvg = useCallback(() => {
    const svg = compositeToSvg(layers, width, height);
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${exportBaseName()}.svg`);
  }, [layers, width, height, exportBaseName]);

  const downloadPng = useCallback(async (scale?: number) => {
    const s = scale ?? pngExportScale;
    const flattened = flattenLayers(layers, width, height);
    const blob = await pixelsToPngBlob(flattened, width, height, s);
    const filename = `${exportBaseName()}@${s}x.png`;
    if (isMobile) {
      const shareResult = await trySharePngForMobile(blob, filename);
      if (shareResult === 'shared' || shareResult === 'cancelled') return;
    }
    downloadBlob(blob, filename);
  }, [layers, width, height, pngExportScale, exportBaseName, isMobile]);

  const downloadLayersSvg = useCallback(async () => {
    // Visible + non-empty layers only. Hidden layers are "off" by design; empty
    // layers would produce blank SVGs.
    const exportable = layers.filter((l) => l.visible && l.pixels.some(Boolean));
    if (exportable.length === 0) return;

    // Dedupe filenames from layer names. Two layers called "Sketch" become
    // "Sketch.svg" and "Sketch-1.svg" so no file clobbers another in the
    // user's downloads folder.
    const used = new Set<string>();
    const uniqueName = (base: string) => {
      let name = base;
      let i = 1;
      while (used.has(name)) name = `${base}-${i++}`;
      used.add(name);
      return name;
    };

    // Stagger downloads — Chrome/Safari silently drop multiple programmatic
    // downloads fired in the same tick, so only the first layer would arrive.
    for (let i = 0; i < exportable.length; i++) {
      const layer = exportable[i];
      const base = slugify(layer.name, 'layer');
      const filename = `${uniqueName(base)}.svg`;
      const svg = pixelsToSvg(layer.pixels, width, height);
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), filename);
      if (i < exportable.length - 1) await new Promise((r) => setTimeout(r, 100));
    }
  }, [layers, width, height]);

  const clearSelection = useCallback(() => {
    if (!selection) return;
    const minX = Math.min(selection.x1, selection.x2);
    const maxX = Math.max(selection.x1, selection.x2);
    const minY = Math.min(selection.y1, selection.y2);
    const maxY = Math.max(selection.y1, selection.y2);
    if (!allowCommitOrSignal()) return;
    const next = [...pixels];
    for (let row = minY; row <= maxY; row++) {
      for (let col = minX; col <= maxX; col++) {
        if (selectionContainsCell(col, row)) next[row * width + col] = '';
      }
    }
    commitPixels(next);
    emitChange(next);
  }, [selection, pixels, width, emitChange, selectionContainsCell, commitPixels, allowCommitOrSignal]);

  const handlePickSize = useCallback((nextWidth: number, nextHeight: number) => {
    if (!sizesEnabled) return;
    if (nextWidth === width && nextHeight === height) return;
    // Non-destructive resize: every layer's pixels are re-centered into the
    // new grid. When growing, new cells around the edge are transparent; when
    // shrinking, the cropped edge cells are discarded. Selection is cleared
    // because its coordinates refer to the old grid.
    const resizedLayers = layers.map((l) => ({
      ...l,
      pixels: resizeLayerCentered(l.pixels, width, height, nextWidth, nextHeight),
    }));
    setSelection(null);
    dragContext.lifted.current = null;
    // commitResize captures the pre-resize snapshot (layers + dimensions) so
    // Cmd+Z restores both, and fires onSizeChange + onChange for autosave.
    commitResize(resizedLayers, nextWidth, nextHeight);
  }, [sizesEnabled, layers, width, height, commitResize, setSelection, dragContext]);

  // Rotate the active layer's pixels 90° in the given direction. When a
  // selection is active, rotation is confined to its normalised bbox;
  // otherwise the whole layer rotates. All writes go through commitPixels so
  // the change is undoable and autosaves correctly.
  const handleRotate = useCallback((dir: 'cw' | 'ccw') => {
    const bbox = selection
      ? {
          x1: Math.min(selection.x1, selection.x2),
          y1: Math.min(selection.y1, selection.y2),
          x2: Math.max(selection.x1, selection.x2),
          y2: Math.max(selection.y1, selection.y2),
        }
      : undefined;
    if (!allowCommitOrSignal()) return;
    const next = rotatePixels90(pixels, width, height, dir, bbox);
    commitPixels(next);
    emitChange(next);
  }, [pixels, width, height, selection, commitPixels, emitChange, allowCommitOrSignal]);

  return {
    handleRotate,
    handlePickSize,
    clearSelection,
    downloadSvg,
    downloadPng,
    downloadLayersSvg,
  };
}
