/**
 * Tests for `useSelectionHoverTracker` — tracks whether the pointer is hovering
 * over the active marquee selection to drive the `move` cursor.
 *
 * The hook converts screen coords to grid col/row via the canvas rect, then
 * delegates the hit-test to `selectionContainsCell`. State is only updated
 * when the boolean changes to avoid per-pixel re-renders.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useSelectionHoverTracker } from './useSelectionHoverTracker';
import type { PixelArtTool } from '../PixelArtEditor';
import type { PixelArtSelection } from './usePixelArtSelection';

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_RECT = {
  left: 0, top: 0, width: 200, height: 200,
  right: 200, bottom: 200, x: 0, y: 0,
} as DOMRect;

function makeCanvasRef(rect: DOMRect = DEFAULT_RECT) {
  return {
    current: {
      getBoundingClientRect: () => rect,
    } as unknown as HTMLCanvasElement,
  };
}

interface MountOptions {
  activeTool?: PixelArtTool;
  selection?: PixelArtSelection | null;
  width?: number;
  height?: number;
  selectionContainsCellReturnValue?: boolean;
}

function mount(overrides: MountOptions = {}) {
  const selectionContainsCell = vi.fn().mockReturnValue(
    overrides.selectionContainsCellReturnValue ?? false,
  );
  const selection: PixelArtSelection = { shape: 'rect', x1: 0, y1: 0, x2: 3, y2: 3 };
  const committedCanvasRef = makeCanvasRef();

  const props = {
    activeTool: ('marquee' as PixelArtTool),
    selection,
    committedCanvasRef,
    width: 4,
    height: 4,
    selectionContainsCell,
    // apply overrides, but keep our helpers unless explicitly overridden
    ...(overrides.activeTool !== undefined && { activeTool: overrides.activeTool }),
    ...(overrides.selection !== undefined && { selection: overrides.selection }),
    ...(overrides.width !== undefined && { width: overrides.width }),
    ...(overrides.height !== undefined && { height: overrides.height }),
  };

  const { result, rerender } = renderHook(
    (p: typeof props) => useSelectionHoverTracker(p),
    { initialProps: props },
  );

  return { result, rerender, selectionContainsCell, props };
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('useSelectionHoverTracker — initial state', () => {
  it('isHoveringSelection starts false', () => {
    const { result } = mount();
    expect(result.current.isHoveringSelection).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// activeTool is not marquee
// ---------------------------------------------------------------------------

describe('useSelectionHoverTracker — activeTool not marquee', () => {
  it('does not set isHoveringSelection when activeTool is not marquee', () => {
    const { result, selectionContainsCell } = mount({
      activeTool: 'paint' as PixelArtTool,
      selectionContainsCellReturnValue: true,
    });

    act(() => {
      result.current.updateHoverOverSelection(100, 100);
    });

    expect(result.current.isHoveringSelection).toBe(false);
    // selectionContainsCell should not be reached — the guard short-circuits
    expect(selectionContainsCell).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// No selection
// ---------------------------------------------------------------------------

describe('useSelectionHoverTracker — no selection', () => {
  it('does not set isHoveringSelection when selection is null', () => {
    const { result, selectionContainsCell } = mount({
      activeTool: 'marquee' as PixelArtTool,
      selection: null,
      selectionContainsCellReturnValue: true,
    });

    act(() => {
      result.current.updateHoverOverSelection(100, 100);
    });

    expect(result.current.isHoveringSelection).toBe(false);
    expect(selectionContainsCell).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Pointer inside selection
// ---------------------------------------------------------------------------

describe('useSelectionHoverTracker — inside selection', () => {
  it('sets isHoveringSelection to true when selectionContainsCell returns true', () => {
    // width=4, height=4, rect 200x200 at (0,0)
    // clientX=100, clientY=100 → col = floor((100/200)*4) = 2, row = 2
    const { result, selectionContainsCell } = mount({
      selectionContainsCellReturnValue: true,
    });

    act(() => {
      result.current.updateHoverOverSelection(100, 100);
    });

    expect(selectionContainsCell).toHaveBeenCalledWith(2, 2);
    expect(result.current.isHoveringSelection).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Pointer outside selection
// ---------------------------------------------------------------------------

describe('useSelectionHoverTracker — outside selection', () => {
  it('keeps isHoveringSelection false when selectionContainsCell returns false', () => {
    const { result, selectionContainsCell } = mount({
      selectionContainsCellReturnValue: false,
    });

    act(() => {
      result.current.updateHoverOverSelection(100, 100);
    });

    expect(selectionContainsCell).toHaveBeenCalledWith(2, 2);
    expect(result.current.isHoveringSelection).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tool changes away from marquee resets hover
// ---------------------------------------------------------------------------

describe('useSelectionHoverTracker — tool change resets hover', () => {
  it('resets isHoveringSelection to false when activeTool changes from marquee to another tool', () => {
    const selectionContainsCell = vi.fn().mockReturnValue(true);
    const selection: PixelArtSelection = { shape: 'rect', x1: 0, y1: 0, x2: 3, y2: 3 };
    const committedCanvasRef = makeCanvasRef();

    const initialProps = {
      activeTool: 'marquee' as PixelArtTool,
      selection,
      committedCanvasRef,
      width: 4,
      height: 4,
      selectionContainsCell,
    };

    const { result, rerender } = renderHook(
      (p: typeof initialProps) => useSelectionHoverTracker(p),
      { initialProps },
    );

    // Set hover to true
    act(() => {
      result.current.updateHoverOverSelection(100, 100);
    });
    expect(result.current.isHoveringSelection).toBe(true);

    // Switch to a non-marquee tool
    act(() => {
      rerender({ ...initialProps, activeTool: 'paint' as PixelArtTool });
    });

    expect(result.current.isHoveringSelection).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Selection becomes null resets hover
// ---------------------------------------------------------------------------

describe('useSelectionHoverTracker — selection cleared resets hover', () => {
  it('resets isHoveringSelection to false when selection becomes null', () => {
    const selectionContainsCell = vi.fn().mockReturnValue(true);
    const selection: PixelArtSelection = { shape: 'rect', x1: 0, y1: 0, x2: 3, y2: 3 };
    const committedCanvasRef = makeCanvasRef();

    const initialProps = {
      activeTool: 'marquee' as PixelArtTool,
      selection: selection as PixelArtSelection | null,
      committedCanvasRef,
      width: 4,
      height: 4,
      selectionContainsCell,
    };

    const { result, rerender } = renderHook(
      (p: typeof initialProps) => useSelectionHoverTracker(p),
      { initialProps },
    );

    // Set hover to true
    act(() => {
      result.current.updateHoverOverSelection(100, 100);
    });
    expect(result.current.isHoveringSelection).toBe(true);

    // Clear the selection
    act(() => {
      rerender({ ...initialProps, selection: null });
    });

    expect(result.current.isHoveringSelection).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// No re-render spam — calling twice with same result is a no-op
// ---------------------------------------------------------------------------

describe('useSelectionHoverTracker — no redundant state updates', () => {
  it('state remains true after two consecutive calls when both map inside the selection', () => {
    const { result } = mount({ selectionContainsCellReturnValue: true });

    act(() => {
      result.current.updateHoverOverSelection(100, 100);
    });
    expect(result.current.isHoveringSelection).toBe(true);

    // Second call with same inside result — state should remain true, no flip
    act(() => {
      result.current.updateHoverOverSelection(50, 50);
    });
    expect(result.current.isHoveringSelection).toBe(true);
  });
});
