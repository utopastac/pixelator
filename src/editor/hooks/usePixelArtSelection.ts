import { useCallback, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { type PixelArtSelection } from '../lib/pixelArtUtils';

// Re-export so consumers (clipboard helpers, etc.) can import the selection
// shape from the hook that owns the selection state without reaching into
// `pixelArtUtils` directly.
export type { PixelArtSelection };

/** The rectangular slice of pixels lifted while a marquee selection is being moved. */
export interface LiftedPixels {
  colors: (string | undefined)[];
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface UsePixelArtSelectionParams {
  width: number;
}

/**
 * Mutable refs that together describe an in-progress marquee drag (either
 * drawing a new selection or moving a lifted one). Consumers take this as a
 * single bundle rather than six individual refs.
 */
export interface SelectionDragContext {
  /** 'draw' while sizing a new marquee, 'move' while dragging a lifted selection. */
  dragMode: React.MutableRefObject<'draw' | 'move' | null>;
  /** Cell where the current selection drag began. */
  dragStart: React.MutableRefObject<[number, number] | null>;
  /** Pixels lifted out of the canvas for the duration of a selection move. */
  lifted: React.MutableRefObject<LiftedPixels | null>;
  /** Pixel state with the lifted region cleared — the base for preview composites. */
  basePixelsAfterLift: React.MutableRefObject<string[] | null>;
  /** Running [dx, dy] offset of the in-progress selection move. */
  moveOffset: React.MutableRefObject<[number, number]>;
  /** Whether the current brush/shape stroke started inside the selection. */
  strokeInsideSelection: React.MutableRefObject<boolean>;
}

export interface UsePixelArtSelectionResult {
  selection: PixelArtSelection | null;
  setSelection: React.Dispatch<React.SetStateAction<PixelArtSelection | null>>;

  /** Bundle of drag-state refs used by the pointer handlers while a marquee
   *  interaction is in progress. */
  dragContext: SelectionDragContext;

  /**
   * Geometric hit test — returns whether the given cell is inside the current selection.
   * Handles rect / ellipse / free-cells ("wand") selection shapes.
   */
  selectionContainsCell: (col: number, row: number) => boolean;
}

/**
 * Owns everything about the marquee selection: its shape, the drag-state refs
 * used while resizing or moving it, and the hit-test helper. Marching-ants
 * timing is handled in `useScreenOverlayDraw` so animation does not schedule
 * React renders.
 */
export function usePixelArtSelection({
  width,
}: UsePixelArtSelectionParams): UsePixelArtSelectionResult {
  const [selection, setSelection] = useState<PixelArtSelection | null>(null);

  const dragMode = useRef<'draw' | 'move' | null>(null);
  const dragStart = useRef<[number, number] | null>(null);
  const lifted = useRef<LiftedPixels | null>(null);
  const basePixelsAfterLift = useRef<string[] | null>(null);
  const moveOffset = useRef<[number, number]>([0, 0]);
  const strokeInsideSelection = useRef(true);
  const dragContext = useMemo<SelectionDragContext>(
    () => ({ dragMode, dragStart, lifted, basePixelsAfterLift, moveOffset, strokeInsideSelection }),
    [],
  );

  const selectionContainsCell = useCallback(
    (col: number, row: number) => {
      if (!selection) return false;
      const minX = Math.min(selection.x1, selection.x2);
      const maxX = Math.max(selection.x1, selection.x2);
      const minY = Math.min(selection.y1, selection.y2);
      const maxY = Math.max(selection.y1, selection.y2);
      if (col < minX || col > maxX || row < minY || row > maxY) return false;
      if (selection.shape === 'rect') return true;
      if (selection.shape === 'cells') return selection.cells.has(row * width + col);
      // ellipse
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const rx = (maxX - minX) / 2 + 0.5;
      const ry = (maxY - minY) / 2 + 0.5;
      if (rx <= 0 || ry <= 0) return true;
      const dx = col - cx, dy = row - cy;
      return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
    },
    [selection, width],
  );

  return {
    selection,
    setSelection,
    dragContext,
    selectionContainsCell,
  };
}
