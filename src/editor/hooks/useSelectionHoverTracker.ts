import { useState, useCallback, useEffect } from 'react';
import type { PixelArtTool } from '../PixelArtEditor';
import type { PixelArtSelection } from './usePixelArtSelection';

interface UseSelectionHoverTrackerArgs {
  activeTool: PixelArtTool;
  selection: PixelArtSelection | null;
  committedCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  width: number;
  height: number;
  selectionContainsCell: (col: number, row: number) => boolean;
}

export interface UseSelectionHoverTrackerReturn {
  isHoveringSelection: boolean;
  setIsHoveringSelection: React.Dispatch<React.SetStateAction<boolean>>;
  updateHoverOverSelection: (clientX: number, clientY: number) => void;
}

/**
 * Tracks whether the pointer is hovering over the active marquee selection.
 * Drives the `move` cursor so the user knows they can drag the selection
 * contents. Updates state only on boolean change to avoid per-pixel re-renders.
 */
export function useSelectionHoverTracker({
  activeTool,
  selection,
  committedCanvasRef,
  width,
  height,
  selectionContainsCell,
}: UseSelectionHoverTrackerArgs): UseSelectionHoverTrackerReturn {
  const [isHoveringSelection, setIsHoveringSelection] = useState(false);

  const updateHoverOverSelection = useCallback(
    (clientX: number, clientY: number) => {
      if (activeTool !== 'marquee' || !selection || !committedCanvasRef.current) {
        if (isHoveringSelection) setIsHoveringSelection(false);
        return;
      }
      const rect = committedCanvasRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const col = Math.floor(((clientX - rect.left) / rect.width) * width);
      const row = Math.floor(((clientY - rect.top) / rect.height) * height);
      const inside =
        col >= 0 &&
        col < width &&
        row >= 0 &&
        row < height &&
        selectionContainsCell(col, row);
      if (inside !== isHoveringSelection) setIsHoveringSelection(inside);
    },
    [activeTool, selection, selectionContainsCell, width, height, isHoveringSelection, committedCanvasRef],
  );

  // Reset when the tool changes away from marquee or the selection is cleared —
  // prevents the cursor getting stuck in `move` after a deselect.
  useEffect(() => {
    if (activeTool !== 'marquee' || !selection) setIsHoveringSelection(false);
  }, [activeTool, selection]);

  return { isHoveringSelection, setIsHoveringSelection, updateHoverOverSelection };
}
