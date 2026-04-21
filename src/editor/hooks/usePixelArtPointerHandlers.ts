import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import { useMoveToolHandler } from './useMoveToolHandler';
import {
  applyBrush,
  bresenhamLine,
  expandCellsWithBrush,
  constrainLineTo45,
  constrainToSquare,
  floodFill,
  floodSelect,
  getShapeCells,
  isShapeTool,
  maskToSelection,
  type PixelArtFillMode,
  type PixelArtBrushSize,
  type PixelArtSelection,
} from '../lib/pixelArtUtils';
import { withSymmetry, type SymmetryMode } from '../lib/symmetry';
import { applyAlphaLock } from '../lib/alphaLock';
import { drawPreview } from '../lib/pixelArtCanvas';
import type { ActivePixels } from './usePixelArtHistory';
import type { SelectionDragContext } from './usePixelArtSelection';
import type { PenContext } from './usePenTool';
import type { PolygonSelectContext } from './usePolygonSelectTool';
import type { PixelArtTool } from '../PixelArtEditor';
import type { Layer } from '@/lib/storage';
import { flattenLayers } from '../lib/composite';

export interface FillModes {
  rect: PixelArtFillMode;
  circle: PixelArtFillMode;
  triangle: PixelArtFillMode;
  star: PixelArtFillMode;
  arrow: PixelArtFillMode;
}

export interface UsePixelArtPointerHandlersParams {
  // Base state
  disabled: boolean;
  activeTool: PixelArtTool;
  brushSize: PixelArtBrushSize;
  activeColor: string;
  fillModes: FillModes;
  marqueeShape: 'rect' | 'ellipse' | 'wand' | 'polygon';

  // Tool + color setters (eyedropper switches to paint and picks a color)
  setActiveTool: (t: PixelArtTool) => void;
  setActiveColor: (c: string) => void;
  setIndependentHue: (h: number | null) => void;

  // Canvas geometry
  width: number;
  height: number;
  committedCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;

  // Pixel state + mutation ops (see ActivePixels for shape).
  activePixels: ActivePixels;
  /** Full layer stack. Used by the eyedropper so it samples the composited
   *  colour (what the user actually sees) rather than only the active layer. */
  layers: Layer[];

  // Selection
  selection: PixelArtSelection | null;
  setSelection: React.Dispatch<React.SetStateAction<PixelArtSelection | null>>;
  selectionContainsCell: (col: number, row: number) => boolean;
  selectionDragContext: SelectionDragContext;

  // Pen tool
  penContext: PenContext;

  // Polygon select tool
  polygonSelectContext: PolygonSelectContext;

  // Symmetry
  symmetryMode: SymmetryMode;

  // Wrap mode
  wrapMode: boolean;

  // Alpha lock
  alphaLock: boolean;
}

export interface UsePixelArtPointerHandlersResult {
  handleMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleMouseMove: (e: { clientX: number; clientY: number; shiftKey: boolean }) => void;
  handleMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handlePointerCancel: () => void;
  handleDoubleClick: () => void;
}

/**
 * Owns the canvas pointer handlers: mouse down/move/up/cancel and the pen-tool double-click.
 * This is the behavioural core of the editor — all tool branching (paint/eraser/fill/
 * eyedropper/shape/pen/marquee) lives here.
 */
export function usePixelArtPointerHandlers({
  disabled,
  activeTool,
  brushSize,
  activeColor,
  fillModes,
  marqueeShape,
  setActiveTool,
  setActiveColor,
  setIndependentHue,
  width,
  height,
  committedCanvasRef,
  previewCanvasRef,
  activePixels,
  layers,
  selection,
  setSelection,
  selectionContainsCell,
  selectionDragContext,
  penContext,
  polygonSelectContext,
  symmetryMode,
  wrapMode,
  alphaLock,
}: UsePixelArtPointerHandlersParams): UsePixelArtPointerHandlersResult {
  const isDragging = useRef(false);
  const dragStart = useRef<[number, number] | null>(null);
  // Last cell the cursor was over during a drag. Used by the shift key listener
  // to re-render the preview without requiring mouse movement.
  const lastHoverCell = useRef<[number, number] | null>(null);
  // Last cell painted during a paint/eraser stroke. Used to interpolate between
  // consecutive pointermove events so fast strokes don't leave gaps.
  const lastPaintCell = useRef<[number, number] | null>(null);
  const { rect: rectFillMode, circle: circleFillMode, triangle: triangleFillMode, star: starFillMode, arrow: arrowFillMode } = fillModes;

  const {
    moveDragRef,
    onDown: moveOnDown,
    onMove: moveOnMove,
    onUp: moveOnUp,
    onCancel: moveOnCancel,
  } = useMoveToolHandler({
    isDragging,
    activePixels,
    previewCanvasRef,
    selection,
    selectionContainsCell,
    setSelection,
    width,
    height,
  });

  // Computes the current drag's end point based on whether shift is held and
  // which tool is active. Lines snap to 0°/45°/90°; shapes and rect/ellipse
  // selections snap to square.
  const applyShiftConstraint = useCallback(
    (start: [number, number], end: [number, number], shiftKey: boolean, tool: PixelArtTool): [number, number] => {
      if (!shiftKey) return end;
      if (tool === 'line') return constrainLineTo45(start, end);
      return constrainToSquare(start, end);
    },
    [],
  );

  // Handles the magic-wand variant of marquee mousedown: flood-selects the
  // contiguous region under the cursor and sets the selection bounding box.
  const handleWandSelect = useCallback(
    (col: number, row: number) => {
      const cells = floodSelect(activePixels.pixels, width, height, col, row);
      if (cells.size > 0) {
        let mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity;
        for (const idx of cells) {
          const c = idx % width, r = Math.floor(idx / width);
          if (c < mnX) mnX = c; if (c > mxX) mxX = c;
          if (r < mnY) mnY = r; if (r > mxY) mxY = r;
        }
        setSelection({ shape: 'cells', cells, x1: mnX, y1: mnY, x2: mxX, y2: mxY });
      } else {
        setSelection(null);
      }
      isDragging.current = false;
    },
    [activePixels, width, height, setSelection],
  );

  // Lifts the pixels inside `sel` off the active layer: collects their colours
  // into a `colors` array (undefined where the cell isn't in the selection) and
  // clears those cells from a copy of `activePixels.pixels`. Returns the data
  // needed to set up a move drag without the caller needing to know the shape of
  // the lifted object.
  const liftSelectionPixels = useCallback(
    (sel: PixelArtSelection) => {
      const minX = Math.min(sel.x1, sel.x2);
      const maxX = Math.max(sel.x1, sel.x2);
      const minY = Math.min(sel.y1, sel.y2);
      const maxY = Math.max(sel.y1, sel.y2);
      const colors: (string | undefined)[] = [];
      const next = [...activePixels.pixels];
      for (let r = minY; r <= maxY; r++) {
        for (let c = minX; c <= maxX; c++) {
          if (selectionContainsCell(c, r)) {
            colors.push(activePixels.pixels[r * width + c]);
            next[r * width + c] = '';
          } else {
            colors.push(undefined);
          }
        }
      }
      return { colors, next, minX, minY, maxX, maxY };
    },
    [activePixels, width, selectionContainsCell],
  );

  // Paints `colors` (a flat row-major lifted-pixel array for the bounding box
  // x1..x2 × y1..y2) onto the preview canvas at offset (dx, dy). Used both at
  // the moment of lifting (dx=dy=0) and during drag (dx/dy = cumulative offset).
  const paintLiftedToPreview = useCallback(
    (
      colors: (string | undefined)[],
      x1: number, y1: number, x2: number,
      dx = 0, dy = 0,
    ) => {
      const canvas = previewCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const selW = x2 - x1 + 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 0.85;
      colors.forEach((color, i) => {
        if (!color) return;
        const destCol = x1 + (i % selW) + dx;
        const destRow = y1 + Math.floor(i / selW) + dy;
        if (destCol >= 0 && destCol < width && destRow >= 0 && destRow < height) {
          ctx.fillStyle = color;
          ctx.fillRect(destCol, destRow, 1, 1);
        }
      });
      ctx.globalAlpha = 1;
    },
    [previewCanvasRef, width, height],
  );

  // Re-renders the in-progress shape preview or selection rectangle for the
  // given cursor cell and shift state. Safe to call when no drag is in progress
  // (returns immediately).
  const renderShiftAwarePreview = useCallback(
    (col: number, row: number, shiftKey: boolean) => {
      if (!isDragging.current) return;
      if (activeTool === 'marquee' && selectionDragContext.dragMode.current === 'draw' && selectionDragContext.dragStart.current) {
        const [endCol, endRow] = shiftKey
          ? constrainToSquare(selectionDragContext.dragStart.current, [col, row])
          : [col, row];
        setSelection(prev => prev ? { ...prev, x2: endCol, y2: endRow } : null);
        return;
      }
      if (isShapeTool(activeTool) && dragStart.current && previewCanvasRef.current) {
        const endPoint = applyShiftConstraint(dragStart.current, [col, row], shiftKey, activeTool);
        const rawCells = getShapeCells(activeTool, dragStart.current, endPoint, {
          rect: rectFillMode, circle: circleFillMode, triangle: triangleFillMode, star: starFillMode, arrow: arrowFillMode,
        });
        // Thicken whenever the produced cells are a 1-cell stroke: the line
        // tool always; shapes only in outline mode (thickening a filled shape
        // would just add a ring of extra cells around the bounds).
        const thicken =
          activeTool === 'line' ||
          (activeTool === 'rect' && rectFillMode === 'outline') ||
          (activeTool === 'circle' && circleFillMode === 'outline') ||
          (activeTool === 'triangle' && triangleFillMode === 'outline') ||
          (activeTool === 'star' && starFillMode === 'outline') ||
          (activeTool === 'arrow' && arrowFillMode === 'outline');
        const cells = thicken ? expandCellsWithBrush(rawCells, brushSize, width, height, wrapMode) : rawCells;
        const wrappedCells = wrapMode
          ? cells.map(([x, y]) => [((x % width) + width) % width, ((y % height) + height) % height] as [number, number])
          : cells;
        const allCells = symmetryMode !== 'none' ? withSymmetry(wrappedCells, width, height, symmetryMode) : wrappedCells;
        drawPreview(previewCanvasRef.current, allCells, activeColor);
      }
    },
    [
      activeTool, rectFillMode, circleFillMode, triangleFillMode, starFillMode, arrowFillMode,
      activeColor, brushSize, width, height, setSelection, previewCanvasRef,
      selectionDragContext, applyShiftConstraint, symmetryMode, wrapMode,
    ],
  );

  // Re-render when shift is pressed or released mid-drag so the user doesn't
  // need to move the cursor to see the constraint apply/release.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Shift') return;
      const cell = lastHoverCell.current;
      if (!cell) return;
      renderShiftAwarePreview(cell[0], cell[1], e.type === 'keydown');
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('keyup', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('keyup', handleKey);
    };
  }, [renderShiftAwarePreview]);

  const getCellFromEvent = useCallback(
    (e: { clientX: number; clientY: number }): [number, number] | null => {
      const canvas = committedCanvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      // Phase 1: the canvas is rendered via CSS transform, so one "cell" on
      // screen is `rect.width / width` CSS pixels. Derive everything from the
      // live bounding rect instead of any external `cellSize` state.
      // Coords are NOT clamped — callers that need in-bounds writes (commit
      // paths) already clamp. Tool previews (pen line, shape drag) extend
      // toward the cursor even when it's off-canvas.
      const cellPx = rect.width / width;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      return [Math.floor(x / cellPx), Math.floor(y / cellPx)];
    },
    [width, committedCanvasRef],
  );

  const isCellInBounds = useCallback(
    (cell: [number, number]) => cell[0] >= 0 && cell[0] < width && cell[1] >= 0 && cell[1] < height,
    [width, height],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (disabled) return;
      if (e.button !== 0) return;
      e.preventDefault();
      const cell = getCellFromEvent(e);
      if (!cell || !isCellInBounds(cell)) return;
      const [col, row] = cell;

      if (activeTool === 'move') {
        moveOnDown(col, row);
        return;
      }

      if (activeTool === 'pen') {
        if (penContext.dblClickPending.current) return;
        const anchorsList = penContext.anchors.current;
        if (anchorsList.length > 0) {
          const [fx, fy] = anchorsList[0];
          const dist = Math.abs(col - fx) + Math.abs(row - fy);
          if (dist <= 1) {
            penContext.commit(true);
            return;
          }
        }
        anchorsList.push([col, row]);
        penContext.setCursor([col, row]);
        return;
      }

      if (activeTool === 'marquee') {
        if (marqueeShape === 'wand') {
          handleWandSelect(col, row);
          return;
        }

        if (marqueeShape === 'polygon') {
          if (polygonSelectContext.dblClickPending.current) return;
          if (selection && selectionContainsCell(col, row)) {
            // Move drag — identical to rect/ellipse move path
            const { colors, next, minX, minY, maxX, maxY } = liftSelectionPixels(selection);
            selectionDragContext.dragMode.current = 'move';
            selectionDragContext.dragStart.current = [col, row];
            selectionDragContext.moveOffset.current = [0, 0];
            selectionDragContext.lifted.current = { colors, x1: minX, y1: minY, x2: maxX, y2: maxY };
            selectionDragContext.basePixelsAfterLift.current = next;
            activePixels.dispatch(next);
            paintLiftedToPreview(colors, minX, minY, maxX);
            isDragging.current = true;
          } else {
            // Place anchor
            const anchorsList = polygonSelectContext.anchors.current;
            if (anchorsList.length >= 2) {
              const [fx, fy] = anchorsList[0];
              if (Math.abs(col - fx) + Math.abs(row - fy) <= 1) {
                polygonSelectContext.commit();
                return;
              }
            }
            anchorsList.push([col, row]);
            polygonSelectContext.setCursor([col, row]);
          }
          return;
        }

        if (selection && selectionContainsCell(col, row)) {
          const { colors, next, minX, minY, maxX, maxY } = liftSelectionPixels(selection);
          selectionDragContext.dragMode.current = 'move';
          selectionDragContext.dragStart.current = [col, row];
          selectionDragContext.moveOffset.current = [0, 0];
          selectionDragContext.lifted.current = { colors, x1: minX, y1: minY, x2: maxX, y2: maxY };
          selectionDragContext.basePixelsAfterLift.current = next;
          activePixels.dispatch(next);
          // Paint lifted pixels immediately so they don't blink transparent
          // between pointerdown and the first pointermove.
          paintLiftedToPreview(colors, minX, minY, maxX);
        } else {
          selectionDragContext.dragMode.current = 'draw';
          selectionDragContext.dragStart.current = [col, row];
          setSelection({ shape: marqueeShape as 'rect' | 'ellipse', x1: col, y1: row, x2: col, y2: row });
          selectionDragContext.lifted.current = null;
          selectionDragContext.basePixelsAfterLift.current = null;
        }
        isDragging.current = true;
        return;
      }

      isDragging.current = true;

      if (activeTool === 'paint') {
        selectionDragContext.strokeInsideSelection.current = selectionContainsCell(col, row);
        lastPaintCell.current = [col, row];
        const positions = withSymmetry([[col, row]], width, height, symmetryMode);
        let paintNext = [...activePixels.pixels];
        for (const [mc, mr] of positions) {
          paintNext = applyBrush(paintNext, mc, mr, activeColor, brushSize, width, height, wrapMode);
        }
        const alphaLocked = applyAlphaLock(paintNext, activePixels.pixels, alphaLock);
        const next = maskToSelection(alphaLocked, activePixels.pixels, width, selection, selectionDragContext.strokeInsideSelection.current);
        activePixels.commit(next);
        activePixels.emit(next);
      } else if (activeTool === 'eraser') {
        selectionDragContext.strokeInsideSelection.current = selectionContainsCell(col, row);
        lastPaintCell.current = [col, row];
        const eraserPositions = withSymmetry([[col, row]], width, height, symmetryMode);
        let eraseNext = [...activePixels.pixels];
        for (const [mc, mr] of eraserPositions) {
          eraseNext = applyBrush(eraseNext, mc, mr, '', brushSize, width, height, wrapMode);
        }
        const next = maskToSelection(eraseNext, activePixels.pixels, width, selection, selectionDragContext.strokeInsideSelection.current);
        activePixels.commit(next);
        activePixels.emit(next);
      } else if (activeTool === 'fill') {
        if (selection) {
          if (selectionContainsCell(col, row)) {
            const minX = Math.min(selection.x1, selection.x2);
            const maxX = Math.max(selection.x1, selection.x2);
            const minY = Math.min(selection.y1, selection.y2);
            const maxY = Math.max(selection.y1, selection.y2);
            const filled = [...activePixels.pixels];
            for (let r = minY; r <= maxY; r++) {
              for (let c = minX; c <= maxX; c++) {
                if (selectionContainsCell(c, r)) filled[r * width + c] = activeColor;
              }
            }
            const alphaLocked = applyAlphaLock(filled, activePixels.pixels, alphaLock);
            const next = maskToSelection(alphaLocked, activePixels.pixels, width, selection, true);
            activePixels.commit(next);
            activePixels.emit(next);
          } else {
            const filled = floodFill(activePixels.pixels, width, height, col, row, activeColor, wrapMode);
            const alphaLocked = applyAlphaLock(filled, activePixels.pixels, alphaLock);
            const next = maskToSelection(alphaLocked, activePixels.pixels, width, selection, false);
            activePixels.commit(next);
            activePixels.emit(next);
          }
        } else {
          const filled = floodFill(activePixels.pixels, width, height, col, row, activeColor, wrapMode);
          const next = applyAlphaLock(filled, activePixels.pixels, alphaLock);
          activePixels.commit(next);
          activePixels.emit(next);
        }
        isDragging.current = false;
      } else if (activeTool === 'eyedropper') {
        // Sample the composited pixel (topmost visible non-empty layer) so the
        // eyedropper picks up what the user actually sees, not just the active
        // layer. `flattenLayers` is O(W×H×L) but eyedropper fires once per
        // click, so the cost is negligible at editor grid sizes.
        const flat = flattenLayers(layers, width, height);
        const color = flat[row * width + col];
        if (color) { setActiveColor(color); setIndependentHue(null); }
        setActiveTool('paint');
        isDragging.current = false;
      } else if (isShapeTool(activeTool)) {
        dragStart.current = [col, row];
        selectionDragContext.strokeInsideSelection.current = selectionContainsCell(col, row);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- previewCanvasRef is a stable ref
    [
      disabled, activeTool, brushSize, activeColor, width, height,
      getCellFromEvent, isCellInBounds, selection, selectionContainsCell,
      marqueeShape, setSelection, setActiveColor, setIndependentHue, setActiveTool, layers,
      activePixels, penContext, polygonSelectContext, selectionDragContext, symmetryMode, wrapMode, alphaLock, moveOnDown,
      handleWandSelect, liftSelectionPixels, paintLiftedToPreview,
    ],
  );

  const handleMouseMove = useCallback(
    (e: { clientX: number; clientY: number; shiftKey: boolean }) => {
      if (disabled) return;
      const cell = getCellFromEvent(e);
      if (!cell) return;
      const [col, row] = cell;

      if (activeTool === 'move' && isDragging.current) {
        moveOnMove(col, row);
        return;
      }

      if (activeTool === 'pen') {
        penContext.setCursor([col, row]);
        const anchorsList = penContext.anchors.current;
        if (anchorsList.length > 0 && previewCanvasRef.current) {
          const raw: Array<[number, number]> = [];
          for (let i = 0; i < anchorsList.length - 1; i++) {
            raw.push(...bresenhamLine(anchorsList[i][0], anchorsList[i][1], anchorsList[i + 1][0], anchorsList[i + 1][1]));
          }
          const last = anchorsList[anchorsList.length - 1];
          raw.push(...bresenhamLine(last[0], last[1], col, row));
          const cells = expandCellsWithBrush(raw, brushSize, width, height, wrapMode);
          const allPenCells = symmetryMode !== 'none' ? withSymmetry(cells, width, height, symmetryMode) : cells;
          drawPreview(previewCanvasRef.current, allPenCells, activeColor);
        }
        return;
      }

      if (activeTool === 'marquee' && marqueeShape === 'polygon' && !isDragging.current) {
        polygonSelectContext.setCursor([col, row]);
        return;
      }

      if (activeTool === 'paint' || activeTool === 'eraser') {
        if (previewCanvasRef.current) {
          const previewColor = activeTool === 'eraser' ? '#ff000033' : activeColor;
          const positions = symmetryMode !== 'none'
            ? withSymmetry([[col, row]], width, height, symmetryMode)
            : [[col, row] as [number, number]];
          const allPreviewCells = positions.flatMap(
            pos => expandCellsWithBrush([pos], brushSize, width, height, wrapMode),
          );
          drawPreview(previewCanvasRef.current, allPreviewCells, previewColor);
        }
      }

      if (activeTool === 'marquee' && isDragging.current && selectionDragContext.dragStart.current) {
        if (selectionDragContext.dragMode.current === 'draw') {
          lastHoverCell.current = [col, row];
          renderShiftAwarePreview(col, row, e.shiftKey);
        } else if (selectionDragContext.dragMode.current === 'move' && selectionDragContext.lifted.current) {
          const [startCol, startRow] = selectionDragContext.dragStart.current;
          const dx = col - startCol;
          const dy = row - startRow;
          selectionDragContext.moveOffset.current = [dx, dy];
          const lifted = selectionDragContext.lifted.current;
          setSelection(prev => prev ? { ...prev, x1: lifted.x1 + dx, y1: lifted.y1 + dy, x2: lifted.x2 + dx, y2: lifted.y2 + dy } : null);
          paintLiftedToPreview(lifted.colors, lifted.x1, lifted.y1, lifted.x2, dx, dy);
        }
        return;
      }

      if (!isDragging.current) return;

      if (activeTool === 'paint') {
        // Interpolate between the last painted cell and the current one so that
        // fast pointer movement doesn't leave gaps in the stroke.
        const prev = lastPaintCell.current ?? [col, row];
        const strokeCells = bresenhamLine(prev[0], prev[1], col, row);
        lastPaintCell.current = [col, row];
        const wrappedStrokeCells = wrapMode
          ? strokeCells.map(([c, r]) => [((c % width) + width) % width, ((r % height) + height) % height] as [number, number])
          : strokeCells;
        const dragPositions = withSymmetry(wrappedStrokeCells, width, height, symmetryMode);
        let dragPaintNext = [...activePixels.pixels];
        for (const [mc, mr] of dragPositions) {
          dragPaintNext = applyBrush(dragPaintNext, mc, mr, activeColor, brushSize, width, height, wrapMode);
        }
        const alphaLocked = applyAlphaLock(dragPaintNext, activePixels.pixels, alphaLock);
        const next = maskToSelection(alphaLocked, activePixels.pixels, width, selection, selectionDragContext.strokeInsideSelection.current);
        activePixels.dispatch(next);
        activePixels.emit(next);
      } else if (activeTool === 'eraser') {
        // Interpolate between the last erased cell and the current one.
        const eraserPrev = lastPaintCell.current ?? [col, row];
        const eraserStrokeCells = bresenhamLine(eraserPrev[0], eraserPrev[1], col, row);
        lastPaintCell.current = [col, row];
        const wrappedEraserStrokeCells = wrapMode
          ? eraserStrokeCells.map(([c, r]) => [((c % width) + width) % width, ((r % height) + height) % height] as [number, number])
          : eraserStrokeCells;
        const dragEraserPositions = withSymmetry(wrappedEraserStrokeCells, width, height, symmetryMode);
        let dragEraseNext = [...activePixels.pixels];
        for (const [mc, mr] of dragEraserPositions) {
          dragEraseNext = applyBrush(dragEraseNext, mc, mr, '', brushSize, width, height, wrapMode);
        }
        const next = maskToSelection(dragEraseNext, activePixels.pixels, width, selection, selectionDragContext.strokeInsideSelection.current);
        activePixels.dispatch(next);
        activePixels.emit(next);
      } else if (isShapeTool(activeTool) && dragStart.current && previewCanvasRef.current) {
        lastHoverCell.current = [col, row];
        renderShiftAwarePreview(col, row, e.shiftKey);
      }
    },
    [
      disabled, activeTool, marqueeShape, rectFillMode, circleFillMode, triangleFillMode, starFillMode, arrowFillMode,
      brushSize, activeColor, width, height, getCellFromEvent,
      selection, setSelection, activePixels, selectionDragContext, penContext, polygonSelectContext,
      previewCanvasRef, renderShiftAwarePreview, symmetryMode, wrapMode, alphaLock, selectionContainsCell, moveOnMove,
      paintLiftedToPreview,
    ],
  );

  // Writes `cells` to the canvas in `activeColor`, constrained to the same side
  // of the selection as the stroke started on (tracked by strokeInsideSelection).
  const commitCells = useCallback(
    (cells: [number, number][]) => {
      const wrappedCells = wrapMode
        ? cells.map(([x, y]) => [((x % width) + width) % width, ((y % height) + height) % height] as [number, number])
        : cells;
      const allCells = symmetryMode !== 'none' ? withSymmetry(wrappedCells, width, height, symmetryMode) : wrappedCells;
      const next = [...activePixels.pixels];
      for (const [x, y] of allCells) {
        if (x >= 0 && x < width && y >= 0 && y < height) next[y * width + x] = activeColor;
      }
      const alphaLocked = applyAlphaLock(next, activePixels.pixels, alphaLock);
      const masked = maskToSelection(alphaLocked, activePixels.pixels, width, selection, selectionDragContext.strokeInsideSelection.current);
      activePixels.commit(masked);
      activePixels.emit(masked);
    },
    [activePixels, width, height, activeColor, selection, selectionDragContext, symmetryMode, wrapMode, alphaLock],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging.current || disabled) return;

      if (activeTool === 'move' && moveDragRef.current) {
        moveOnUp();
        return;
      }

      if (activeTool === 'marquee') {
        isDragging.current = false;
        lastHoverCell.current = null;
        if (selectionDragContext.dragMode.current === 'move' && selectionDragContext.lifted.current) {
          const lifted = selectionDragContext.lifted.current;
          const [dx, dy] = selectionDragContext.moveOffset.current;
          const selW = lifted.x2 - lifted.x1 + 1;
          const base = selectionDragContext.basePixelsAfterLift.current ?? activePixels.pixels;
          // Reconstruct the pre-lift pixels for the undo snapshot. At mouseup,
          // layersApi.layers reflects the lifted (cleared) state dispatched at
          // mousedown, so reading it directly would snapshot the wrong state.
          const originalPixels = [...base];
          lifted.colors.forEach((color, i) => {
            if (color === undefined) return;
            const localCol = i % selW;
            const localRow = Math.floor(i / selW);
            originalPixels[(lifted.y1 + localRow) * width + (lifted.x1 + localCol)] = color ?? '';
          });
          const next = [...base];
          lifted.colors.forEach((color, i) => {
            if (color === undefined || !color) return;
            const localCol = i % selW;
            const localRow = Math.floor(i / selW);
            const destCol = lifted.x1 + localCol + dx;
            const destRow = lifted.y1 + localRow + dy;
            if (destCol >= 0 && destCol < width && destRow >= 0 && destRow < height) {
              next[destRow * width + destCol] = color;
            }
          });
          activePixels.commit(next, originalPixels);
          activePixels.emit(next);
          selectionDragContext.lifted.current = null;
          selectionDragContext.basePixelsAfterLift.current = null;
          if (previewCanvasRef.current) {
            const ctx = previewCanvasRef.current.getContext('2d');
            ctx?.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
          }
        } else if (selectionDragContext.dragMode.current === 'draw') {
          const cell = getCellFromEvent(e);
          if (cell) {
            const [col, row] = cell;
            if (selectionDragContext.dragStart.current &&
                selectionDragContext.dragStart.current[0] === col &&
                selectionDragContext.dragStart.current[1] === row) {
              setSelection(null);
            }
          }
        }
        selectionDragContext.dragMode.current = null;
        selectionDragContext.dragStart.current = null;
        return;
      }

      isDragging.current = false;
      lastPaintCell.current = null;

      const cell = getCellFromEvent(e);

      if (previewCanvasRef.current) {
        const ctx = previewCanvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
      }

      if (isShapeTool(activeTool) && dragStart.current && cell) {
        // Commit even if `cell` is out of bounds — commitCells clamps.
        const endPoint = applyShiftConstraint(dragStart.current, cell, e.shiftKey, activeTool);
        const rawCells = getShapeCells(activeTool, dragStart.current, endPoint, {
          rect: rectFillMode, circle: circleFillMode, triangle: triangleFillMode, star: starFillMode, arrow: arrowFillMode,
        });
        // Mirror the preview's thickness gate — see renderShiftAwarePreview.
        const thicken =
          activeTool === 'line' ||
          (activeTool === 'rect' && rectFillMode === 'outline') ||
          (activeTool === 'circle' && circleFillMode === 'outline') ||
          (activeTool === 'triangle' && triangleFillMode === 'outline') ||
          (activeTool === 'star' && starFillMode === 'outline') ||
          (activeTool === 'arrow' && arrowFillMode === 'outline');
        const cells = thicken ? expandCellsWithBrush(rawCells, brushSize, width, height, wrapMode) : rawCells;
        commitCells(cells);
      }

      dragStart.current = null;
      lastHoverCell.current = null;
    },
    [
      disabled, activeTool, rectFillMode, circleFillMode, triangleFillMode, starFillMode, arrowFillMode,
      brushSize, getCellFromEvent, activePixels, width, height, commitCells,
      previewCanvasRef, setSelection, selectionDragContext, applyShiftConstraint,
      selection, selectionContainsCell, moveOnUp, moveDragRef,
    ],
  );

  const handlePointerCancel = useCallback(() => {
    if (activeTool === 'move' && moveDragRef.current) {
      moveOnCancel();
      return;
    }

    if (activeTool === 'marquee' && isDragging.current && selectionDragContext.dragMode.current === 'move' && selectionDragContext.lifted.current) {
      const lifted = selectionDragContext.lifted.current;
      const selW = lifted.x2 - lifted.x1 + 1;
      const next = [...(selectionDragContext.basePixelsAfterLift.current ?? activePixels.pixels)];
      lifted.colors.forEach((color, i) => {
        if (color === undefined) return;
        const localCol = i % selW;
        const localRow = Math.floor(i / selW);
        next[(lifted.y1 + localRow) * width + (lifted.x1 + localCol)] = color;
      });
      activePixels.dispatch(next);
      selectionDragContext.lifted.current = null;
      selectionDragContext.basePixelsAfterLift.current = null;
      setSelection(prev => prev ? { ...prev, x1: lifted.x1, y1: lifted.y1, x2: lifted.x2, y2: lifted.y2 } : null);
    }
    if (activeTool === 'marquee' && marqueeShape === 'polygon') {
      polygonSelectContext.cancel();
    }
    isDragging.current = false;
    lastPaintCell.current = null;
    selectionDragContext.dragMode.current = null;
    lastHoverCell.current = null;

    if (previewCanvasRef.current) {
      const ctx = previewCanvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
    }
  }, [
    activeTool, marqueeShape, activePixels, width, previewCanvasRef, setSelection, selectionDragContext,
    polygonSelectContext, moveOnCancel, moveDragRef,
  ]);

  const handleDoubleClick = useCallback(() => {
    if (activeTool === 'pen') {
      penContext.dblClickPending.current = true;
      if (penContext.anchors.current.length > 1) {
        penContext.anchors.current = penContext.anchors.current.slice(0, -1);
      }
      penContext.commit(false);
      setTimeout(() => { penContext.dblClickPending.current = false; }, 300);
      return;
    }
    if (activeTool === 'marquee' && marqueeShape === 'polygon') {
      polygonSelectContext.dblClickPending.current = true;
      if (polygonSelectContext.anchors.current.length > 1) {
        polygonSelectContext.anchors.current = polygonSelectContext.anchors.current.slice(0, -1);
      }
      polygonSelectContext.commit();
      setTimeout(() => { polygonSelectContext.dblClickPending.current = false; }, 300);
    }
  }, [activeTool, marqueeShape, penContext, polygonSelectContext]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handlePointerCancel,
    handleDoubleClick,
  };
}
