import { useEffect, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react';
import type { PixelArtSelection } from '../lib/pixelArtUtils';
import type { ActivePixels } from './usePixelArtHistory';
import type { LiftedPixels } from './usePixelArtSelection';
import type { PixelArtTool } from '../PixelArtEditor';
import { multiplyMatrix, translatePixels, type AffineMatrix } from '../lib/transforms';
import type { UseLayerTransformReturn } from './useLayerTransform';

export interface UseCanvasKeyboardShortcutsArgs {
  disabled: boolean;
  activeTool: PixelArtTool;
  setActiveTool: (tool: PixelArtTool) => void;
  /** Which shape tool the "shapes" shortcut resolves to. */
  lastShape: 'rect' | 'circle' | 'triangle' | 'star' | 'arrow';
  /** Current marquee sub-shape (rect/ellipse/wand/polygon). */
  marqueeShape: 'rect' | 'ellipse' | 'wand' | 'polygon';

  // Pen
  commitPenPath: (closeShape?: boolean) => void;
  cancelPenPath: () => void;

  // Polygon select
  cancelPolygonSelect: () => void;
  commitPolygonSelect: () => void;

  // Selection / marquee
  selection: PixelArtSelection | null;
  setSelection: Dispatch<SetStateAction<PixelArtSelection | null>>;
  liftedPixels: MutableRefObject<LiftedPixels | null>;
  selectionContainsCell: (col: number, row: number) => boolean;
  clearSelection: () => void;

  // Pixels + colour (for Alt+Delete/Backspace fill-selection)
  activePixels: ActivePixels;
  width: number;
  height: number;
  activeColor: string;
  /** Preview canvas ref. Cleared after arrow-key nudges so stale lifted
   *  pixels from a previous Move drag don't occlude the committed state. */
  previewCanvasRef: RefObject<HTMLCanvasElement | null>;

  // History
  undo: () => void;
  redo: () => void;

  // Viewport
  fit: () => void;
  setZoom: (z: number) => void;
  zoom: number;

  // Move-tool transform (bbox + handles). When a transform is pending, the
  // shortcut handler intercepts Enter / Escape / H / V; otherwise they fall
  // through to the existing behaviour (pen commit, marquee deselect, tool
  // switches, etc).
  layerTransform: UseLayerTransformReturn;

  // Clipboard verbs. The editor component owns the implementations (so the
  // canvas context menu can reuse them) and passes them in here — the hook
  // is just the keyboard dispatcher.
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
}

/**
 * Global document-level keydown listener that implements every editor
 * keyboard shortcut. Skips when focus is in a text input so global
 * shortcuts don't steal keystrokes from the title bar etc.
 *
 *   Enter        — commit pen path (pen tool)
 *   Escape       — cancel pen path / deselect marquee
 *   Delete/Back  — clear selection (marquee tool)
 *   Alt+Del/Back — fill selection with active colour (marquee tool)
 *   B/E/G/L/P/M/U/I — switch tools (paint / eraser / fill / line / pen /
 *                    marquee / shapes / eyedropper)
 *   Cmd/Ctrl+D   — deselect
 *   Cmd/Ctrl+C/X/V — clipboard copy / cut / paste
 *   Cmd/Ctrl+Z   — undo
 *   Cmd/Ctrl+Shift+Z / Y — redo
 *   Cmd/Ctrl+0   — fit to screen
 *   Cmd/Ctrl+1   — zoom to 100%
 *   Cmd/Ctrl+=/+ — zoom in (×2)
 *   Cmd/Ctrl+-   — zoom out (÷2)
 */
export function useCanvasKeyboardShortcuts(args: UseCanvasKeyboardShortcutsArgs) {
  const {
    disabled, activeTool, setActiveTool, lastShape, marqueeShape,
    commitPenPath, cancelPenPath,
    cancelPolygonSelect, commitPolygonSelect,
    selection, setSelection, liftedPixels, selectionContainsCell, clearSelection,
    activePixels, width, height, activeColor,
    previewCanvasRef,
    undo, redo,
    fit, setZoom, zoom,
    layerTransform,
    onCopy, onCut, onPaste,
  } = args;

  useEffect(() => {
    if (disabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      // Move-tool transform shortcuts. Run BEFORE the pen/marquee branches so
      // Enter/Escape commit/cancel the pending transform rather than falling
      // through. H/V flip the pending bitmap around its bbox centre (in
      // destination space, applied as a left-multiplied scale about the
      // transformed centre).
      if (activeTool === 'move' && layerTransform.isPending) {
        if (e.key === 'Enter') {
          e.preventDefault();
          layerTransform.commit();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          layerTransform.cancel();
          return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          // Delete what's being moved: clear the source bbox on the active
          // layer and cancel the pending transform. Single undo step.
          e.preventDefault();
          const pending = layerTransform.pending;
          if (!pending) return;
          const { snapshotPixels, snapshotBBox: b } = pending;
          const cleared = snapshotPixels.slice();
          for (let r = b.y1; r <= b.y2; r++) {
            for (let c = b.x1; c <= b.x2; c++) {
              if (c >= 0 && c < width && r >= 0 && r < height) {
                cleared[r * width + c] = '';
              }
            }
          }
          activePixels.commit(cleared);
          activePixels.emit(cleared);
          layerTransform.cancel();
          const preview = previewCanvasRef.current;
          if (preview) {
            const ctx = preview.getContext('2d');
            ctx?.clearRect(0, 0, preview.width, preview.height);
          }
          return;
        }
        if (e.key === 'h' || e.key === 'H' || e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          const pending = layerTransform.pending;
          if (!pending) return;
          // Compute the current destination-space centre of the bbox so the
          // flip anchors visually "in place".
          const b = pending.snapshotBBox;
          const cxSrc = (b.x1 + b.x2 + 1) / 2;
          const cySrc = (b.y1 + b.y2 + 1) / 2;
          const m = pending.matrix;
          const mcx = m.a * cxSrc + m.c * cySrc + m.tx;
          const mcy = m.b * cxSrc + m.d * cySrc + m.ty;
          const horizontal = e.key === 'h' || e.key === 'H';
          const sx = horizontal ? -1 : 1;
          const sy = horizontal ? 1 : -1;
          const flip: AffineMatrix = {
            a: sx, b: 0, c: 0, d: sy,
            tx: mcx * (1 - sx),
            ty: mcy * (1 - sy),
          };
          layerTransform.setMatrix(multiplyMatrix(flip, m));
          return;
        }
      }

      if (e.key === 'Enter' && activeTool === 'marquee' && marqueeShape === 'polygon') {
        e.preventDefault();
        commitPolygonSelect();
        return;
      }
      if (e.key === 'Enter' && activeTool === 'pen') {
        e.preventDefault();
        commitPenPath(false);
        return;
      }
      if (e.key === 'Escape') {
        if (activeTool === 'pen') {
          e.preventDefault();
          cancelPenPath();
        } else if (activeTool === 'marquee' && marqueeShape === 'polygon') {
          e.preventDefault();
          cancelPolygonSelect(); // cancels in-progress polygon if any
          setSelection(null);    // clears committed selection if any
          liftedPixels.current = null;
        } else if (activeTool === 'marquee') {
          e.preventDefault();
          setSelection(null);
          liftedPixels.current = null;
        }
        return;
      }
      // Arrow-key nudges while the Move tool is active. 1 cell per press,
      // 10 with Shift. Each press = one commitPixels = one undo step.
      if (activeTool === 'move' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        // No modifiers other than Shift allowed — Cmd+Arrow etc. would conflict
        // with browser navigation.
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        let dx = 0, dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        else if (e.key === 'ArrowRight') dx = step;
        else if (e.key === 'ArrowUp') dy = -step;
        else if (e.key === 'ArrowDown') dy = step;
        const translated = selection
          ? translatePixels(activePixels.pixels, width, height, dx, dy, {
              bbox: { x1: selection.x1, y1: selection.y1, x2: selection.x2, y2: selection.y2 },
              contains: selectionContainsCell,
            })
          : translatePixels(activePixels.pixels, width, height, dx, dy);
        activePixels.commit(translated);
        activePixels.emit(translated);
        // Clear stale preview pixels from a prior drag so the new committed
        // state isn't occluded (thumbnail updates without this fix but the
        // on-screen canvas looked static).
        const preview = previewCanvasRef.current;
        if (preview) {
          const ctx = preview.getContext('2d');
          ctx?.clearRect(0, 0, preview.width, preview.height);
        }
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
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && activeTool === 'marquee') {
        e.preventDefault();
        if (e.altKey && selection) {
          const minX = Math.min(selection.x1, selection.x2);
          const maxX = Math.max(selection.x1, selection.x2);
          const minY = Math.min(selection.y1, selection.y2);
          const maxY = Math.max(selection.y1, selection.y2);
          const next = [...activePixels.pixels];
          for (let row = minY; row <= maxY; row++) {
            for (let col = minX; col <= maxX; col++) {
              if (selectionContainsCell(col, row)) next[row * width + col] = activeColor;
            }
          }
          activePixels.commit(next);
          activePixels.emit(next);
        } else {
          clearSelection();
        }
        return;
      }

      // Single-letter tool shortcuts (no modifiers). Must come before the
      // ctrl/cmd early-return below, since they don't require a modifier.
      if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const toolShortcuts: Record<string, PixelArtTool | 'shapes'> = {
          b: 'paint',
          e: 'eraser',
          g: 'fill',
          l: 'line',
          p: 'pen',
          m: 'marquee',
          u: 'shapes',
          i: 'eyedropper',
          v: 'move',
        };
        const next = toolShortcuts[e.key];
        if (next) {
          e.preventDefault();
          cancelPenPath();
          setActiveTool(next === 'shapes' ? lastShape : next);
          return;
        }
      }

      const isMac = /mac/i.test(navigator.userAgent);
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
      if (!ctrlOrCmd) return;

      if (e.key === 'd') {
        e.preventDefault();
        setSelection(null);
        liftedPixels.current = null;
        return;
      }
      // Clipboard verbs. Guard logic (empty selection, locked layers, no
      // clip) lives inside the handlers so keyboard + menu paths share one
      // source of truth.
      if (e.key === 'c' && !e.shiftKey) {
        e.preventDefault();
        onCopy();
        return;
      }
      if (e.key === 'x' && !e.shiftKey) {
        e.preventDefault();
        onCut();
        return;
      }
      // ⌘V intentionally NOT handled here. The browser fires a native `paste`
      // event on ⌘V, which PixelArtEditor's window-level paste listener uses
      // to import images from the system clipboard. That listener also falls
      // through to the internal clip when no image is present. Intercepting
      // on keydown (and calling preventDefault) would suppress the native
      // paste event entirely and break the image-import path.
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === '0') {
        e.preventDefault();
        fit();
      } else if (e.key === '1') {
        e.preventDefault();
        setZoom(1);
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setZoom(Math.min(64, zoom * 2));
      } else if (e.key === '-') {
        e.preventDefault();
        setZoom(Math.max(1, zoom / 2));
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    disabled, activeTool, setActiveTool, lastShape, marqueeShape,
    commitPenPath, cancelPenPath, clearSelection,
    cancelPolygonSelect, commitPolygonSelect,
    selection, activePixels, activeColor, width, height, selectionContainsCell,
    previewCanvasRef,
    undo, redo, setSelection, liftedPixels,
    fit, setZoom, zoom,
    layerTransform,
    onCopy, onCut, onPaste,
  ]);
}
