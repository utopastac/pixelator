import { useCallback, useRef } from 'react';
import type React from 'react';
import { translatePixels } from '../lib/transforms';
import type { ActivePixels } from './usePixelArtHistory';
import type { PixelArtSelection } from '../lib/pixelArtUtils';

interface MoveDragState {
  start: [number, number];
  pixelsSnapshot: string[];
  baseCleared: string[];
  lastDelta: [number, number];
}

interface UseMoveToolHandlerParams {
  isDragging: React.MutableRefObject<boolean>;
  activePixels: ActivePixels;
  previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  selection: PixelArtSelection | null;
  selectionContainsCell: (col: number, row: number) => boolean;
  setSelection: React.Dispatch<React.SetStateAction<PixelArtSelection | null>>;
  width: number;
  height: number;
}

export interface UseMoveToolHandlerResult {
  moveDragRef: React.MutableRefObject<MoveDragState | null>;
  onDown: (col: number, row: number) => void;
  onMove: (col: number, row: number) => void;
  onUp: () => void;
  onCancel: () => void;
}

export function useMoveToolHandler({
  isDragging,
  activePixels,
  previewCanvasRef,
  selection,
  selectionContainsCell,
  setSelection,
  width,
  height,
}: UseMoveToolHandlerParams): UseMoveToolHandlerResult {
  const moveDragRef = useRef<MoveDragState | null>(null);

  const onDown = useCallback(
    (col: number, row: number) => {
      const snapshot = activePixels.pixels.slice();
      let baseCleared: string[];
      if (selection) {
        // Selection mode: only masked cells lift — base has them cleared.
        baseCleared = snapshot.slice();
        const minX = Math.min(selection.x1, selection.x2);
        const maxX = Math.max(selection.x1, selection.x2);
        const minY = Math.min(selection.y1, selection.y2);
        const maxY = Math.max(selection.y1, selection.y2);
        for (let r = minY; r <= maxY; r++) {
          for (let c = minX; c <= maxX; c++) {
            if (c >= 0 && c < width && r >= 0 && r < height && selectionContainsCell(c, r)) {
              baseCleared[r * width + c] = '';
            }
          }
        }
      } else {
        // Whole-layer mode: everything lifts.
        baseCleared = new Array<string>(width * height).fill('');
      }
      moveDragRef.current = {
        start: [col, row],
        pixelsSnapshot: snapshot,
        baseCleared,
        lastDelta: [0, 0],
      };
      isDragging.current = true;
      // Dispatch the cleared base so the committed canvas stops showing
      // the pre-drag pixels. The preview canvas shows them translated.
      activePixels.dispatch(baseCleared);
      // Paint the unmoved pixels onto the preview immediately (dx=0, dy=0).
      if (previewCanvasRef.current) {
        const ctx = previewCanvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
          // Paint every cell that differs between snapshot and baseCleared
          // (i.e. the lifted cells) at their original position.
          for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
              const idx = r * width + c;
              if (snapshot[idx] && snapshot[idx] !== baseCleared[idx]) {
                ctx.fillStyle = snapshot[idx];
                ctx.fillRect(c, r, 1, 1);
              }
            }
          }
        }
      }
    },
    [activePixels, previewCanvasRef, selection, selectionContainsCell, isDragging, width, height],
  );

  const onMove = useCallback(
    (col: number, row: number) => {
      if (!isDragging.current || !moveDragRef.current) return;
      const drag = moveDragRef.current;
      const dx = col - drag.start[0];
      const dy = row - drag.start[1];
      drag.lastDelta = [dx, dy];
      // Selection present → masked translate; else whole-layer translate.
      const translated = selection
        ? translatePixels(drag.pixelsSnapshot, width, height, dx, dy, {
            bbox: { x1: selection.x1, y1: selection.y1, x2: selection.x2, y2: selection.y2 },
            contains: selectionContainsCell,
          })
        : translatePixels(drag.pixelsSnapshot, width, height, dx, dy);
      // Paint the diff between baseCleared and translated onto the preview
      // canvas. The committed canvas still shows baseCleared (dispatched at
      // pointerdown), so the user sees the pixels riding with the pointer.
      if (previewCanvasRef.current) {
        const ctx = previewCanvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
          for (let r = 0; r < height; r++) {
            for (let cc = 0; cc < width; cc++) {
              const idx = r * width + cc;
              const color = translated[idx];
              if (color && color !== drag.baseCleared[idx]) {
                ctx.fillStyle = color;
                ctx.fillRect(cc, r, 1, 1);
              }
            }
          }
        }
      }
    },
    [isDragging, selection, selectionContainsCell, width, height, previewCanvasRef],
  );

  const onUp = useCallback(
    () => {
      if (!moveDragRef.current) return;
      const drag = moveDragRef.current;
      const [dx, dy] = drag.lastDelta;
      // Clear the preview first; the committed canvas picks up the final state.
      if (previewCanvasRef.current) {
        const ctx = previewCanvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
      }
      if (dx === 0 && dy === 0) {
        // No-op: restore the snapshot (we dispatched baseCleared on down)
        // and skip the commit so history stays clean.
        activePixels.dispatch(drag.pixelsSnapshot);
      } else {
        const translated = selection
          ? translatePixels(drag.pixelsSnapshot, width, height, dx, dy, {
              bbox: { x1: selection.x1, y1: selection.y1, x2: selection.x2, y2: selection.y2 },
              contains: selectionContainsCell,
            })
          : translatePixels(drag.pixelsSnapshot, width, height, dx, dy);
        // Pass pixelsSnapshot as `beforePixels` so the history entry captures
        // the pre-move state. We cannot rely on layersApi.layers here because
        // it reflects the baseCleared dispatch from pointerdown (React batches
        // the two setActiveLayerPixels calls, so the snapshot read from the
        // closure would capture the cleared state rather than the original).
        activePixels.commit(translated, drag.pixelsSnapshot);
        activePixels.emit(translated);
        // Translate the selection rect so chained moves work. Clamp each
        // corner to the grid so the selection can't drift off-canvas.
        if (selection) {
          const clampX = (v: number) => Math.max(0, Math.min(width - 1, v));
          const clampY = (v: number) => Math.max(0, Math.min(height - 1, v));
          setSelection((prev) => prev ? {
            ...prev,
            x1: clampX(prev.x1 + dx),
            y1: clampY(prev.y1 + dy),
            x2: clampX(prev.x2 + dx),
            y2: clampY(prev.y2 + dy),
          } : null);
        }
      }
      moveDragRef.current = null;
      isDragging.current = false;
    },
    [activePixels, previewCanvasRef, selection, selectionContainsCell, setSelection, width, height, isDragging],
  );

  const onCancel = useCallback(
    () => {
      if (!moveDragRef.current) return;
      // Restore the original pixels — we dispatched baseCleared on pointerdown
      // and never committed, so no history pollution.
      activePixels.dispatch(moveDragRef.current.pixelsSnapshot);
      moveDragRef.current = null;
      isDragging.current = false;
      if (previewCanvasRef.current) {
        const ctx = previewCanvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
      }
    },
    [activePixels, isDragging, previewCanvasRef],
  );

  return { moveDragRef, onDown, onMove, onUp, onCancel };
}
