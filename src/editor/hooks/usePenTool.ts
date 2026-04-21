import { useCallback, useMemo, useRef, useState } from 'react';
import type React from 'react';
import {
  bresenhamLine,
  expandCellsWithBrush,
  maskToSelection,
  type PixelArtBrushSize,
  type PixelArtSelection,
} from '../lib/pixelArtUtils';
import { withSymmetry, type SymmetryMode } from '../lib/symmetry';
import { applyAlphaLock } from '../lib/alphaLock';
import type { ActivePixels } from './usePixelArtHistory';
import type { LiftedPixels } from './usePixelArtSelection';

export interface UsePenToolParams {
  width: number;
  height: number;
  activePixels: ActivePixels;
  activeColor: string;
  brushSize: PixelArtBrushSize;
  selection: PixelArtSelection | null;
  selectionContainsCell: (col: number, row: number) => boolean;
  previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Selection-lift ref — cancelPenPath clears it to preserve the pre-refactor behaviour
   *  where switching tools via cancelPenPath also dropped any lifted marquee pixels. */
  liftedPixelsRef: React.MutableRefObject<LiftedPixels | null>;
  symmetryMode: SymmetryMode;
  wrapMode: boolean;
  alphaLock: boolean;
}

/**
 * The pen tool's complete state + operations, bundled for consumers. Pointer
 * handlers and the editor pass this around as a single `penContext` prop
 * instead of six individual fields.
 */
export interface PenContext {
  /** Anchor cells placed so far (mutable by pointer handlers). */
  anchors: React.MutableRefObject<Array<[number, number]>>;
  /** Current cursor cell while hovering with pen active. Used only to trigger re-renders. */
  cursor: [number, number] | null;
  setCursor: React.Dispatch<React.SetStateAction<[number, number] | null>>;
  /** True between the dblclick fire and the ~300ms debounce window. */
  dblClickPending: React.MutableRefObject<boolean>;
  /** Commit the in-progress pen path as bresenham lines, optionally closing back to the first anchor. */
  commit: (closeShape?: boolean) => void;
  /** Drop the in-progress pen path and clear preview/cursor state. */
  cancel: () => void;
}

export interface UsePenToolResult {
  context: PenContext;
}

/**
 * Owns the pen-tool state: anchor list, cursor cell, double-click debounce, and
 * the commit/cancel operations that translate anchors into bresenham lines.
 */
export function usePenTool({
  width,
  height,
  activePixels,
  activeColor,
  brushSize,
  selection,
  selectionContainsCell,
  previewCanvasRef,
  liftedPixelsRef,
  symmetryMode,
  wrapMode,
  alphaLock,
}: UsePenToolParams): UsePenToolResult {
  const anchors = useRef<Array<[number, number]>>([]);
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const dblClickPending = useRef(false);

  const clearPreview = useCallback(() => {
    if (previewCanvasRef.current) {
      const ctx = previewCanvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
    }
  }, [previewCanvasRef]);

  const cancel = useCallback(() => {
    anchors.current = [];
    setCursor(null);
    liftedPixelsRef.current = null;
    clearPreview();
  }, [clearPreview, liftedPixelsRef]);

  const commit = useCallback(
    (closeShape = false) => {
      const currentAnchors = anchors.current;
      if (currentAnchors.length < 2) {
        anchors.current = [];
        setCursor(null);
        clearPreview();
        return;
      }
      const segments = closeShape ? [...currentAnchors, currentAnchors[0]] : currentAnchors;
      const keepInside = selectionContainsCell(currentAnchors[0][0], currentAnchors[0][1]);
      const raw: Array<[number, number]> = [];
      for (let i = 0; i < segments.length - 1; i++) {
        const [x0, y0] = segments[i];
        const [x1, y1] = segments[i + 1];
        for (const [lx, ly] of bresenhamLine(x0, y0, x1, y1)) raw.push([lx, ly]);
      }
      const thickened = expandCellsWithBrush(raw, brushSize, width, height, wrapMode);
      const allCells = withSymmetry(thickened, width, height, symmetryMode);
      const next = [...activePixels.pixels];
      for (const [lx, ly] of allCells) {
        if (lx >= 0 && lx < width && ly >= 0 && ly < height) next[ly * width + lx] = activeColor;
      }
      const alphaLocked = activeColor !== '' ? applyAlphaLock(next, activePixels.pixels, alphaLock) : next;
      const masked = maskToSelection(alphaLocked, activePixels.pixels, width, selection, keepInside);
      activePixels.commit(masked);
      activePixels.emit(masked);
      anchors.current = [];
      setCursor(null);
      clearPreview();
    },
    [activePixels, width, height, activeColor, brushSize, selection, selectionContainsCell, clearPreview, symmetryMode, wrapMode, alphaLock],
  );

  const context = useMemo<PenContext>(
    () => ({ anchors, cursor, setCursor, dblClickPending, commit, cancel }),
    [cursor, commit, cancel],
  );

  return { context };
}
