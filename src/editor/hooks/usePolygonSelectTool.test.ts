/**
 * Tests for `buildPolygonSelection` (pure function) and `usePolygonSelectTool`
 * (hook). The pure function converts anchor points to a cell-based selection;
 * the hook manages anchor/cursor state and wires commit/cancel operations.
 *
 * Invariants:
 * - buildPolygonSelection returns null for fewer than 3 anchors.
 * - buildPolygonSelection returns a correct bounding box when cells are found.
 * - buildPolygonSelection returns null when the polygon has no rasterised cells.
 * - commit() with < 3 anchors does NOT call setSelection (original behaviour).
 * - commit() with a valid triangle calls setSelection with shape 'cells'.
 * - cancel() resets cursor to null without touching setSelection.
 * - The context object exposes anchors, cursor, setCursor, dblClickPending,
 *   commit, and cancel.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { buildPolygonSelection, usePolygonSelectTool } from './usePolygonSelectTool';

// ---------------------------------------------------------------------------
// buildPolygonSelection — pure function
// ---------------------------------------------------------------------------

describe('buildPolygonSelection', () => {
  it('returns null for fewer than 3 anchors', () => {
    expect(buildPolygonSelection([], 5, 5)).toBeNull();
    expect(buildPolygonSelection([[0, 0]], 5, 5)).toBeNull();
    expect(buildPolygonSelection([[0, 0], [4, 0]], 5, 5)).toBeNull();
  });

  it('returns an object with shape cells and a correct bounding box for a valid triangle', () => {
    // Right-angle triangle filling the bottom-left of a 5×5 grid
    const result = buildPolygonSelection([[0, 0], [4, 0], [0, 4]], 5, 5);
    expect(result).not.toBeNull();
    expect(result!.shape).toBe('cells');
    expect(result!.cells.size).toBeGreaterThan(0);
    // Bounding box must contain (0,0)→(4,4) or smaller — just check within range
    expect(result!.x1).toBeGreaterThanOrEqual(0);
    expect(result!.y1).toBeGreaterThanOrEqual(0);
    expect(result!.x2).toBeLessThanOrEqual(4);
    expect(result!.y2).toBeLessThanOrEqual(4);
    // x2 >= x1 and y2 >= y1
    expect(result!.x2).toBeGreaterThanOrEqual(result!.x1);
    expect(result!.y2).toBeGreaterThanOrEqual(result!.y1);
  });

  it('returns a result with cells for a proper triangle (not null)', () => {
    // Use a clearly non-degenerate triangle: (0,0),(8,0),(4,8) in a 10×10 grid
    const result = buildPolygonSelection([[0, 0], [8, 0], [4, 8]], 10, 10);
    expect(result).not.toBeNull();
    expect(result!.cells.size).toBeGreaterThan(0);
  });

  it('returns null when the polygon produces no rasterised cells (off-grid polygon)', () => {
    // All points are off-grid for a 4×4 grid
    const result = buildPolygonSelection([[10, 10], [20, 10], [15, 20]], 4, 4);
    expect(result).toBeNull();
  });

  it('bounding box tightly wraps the selected cells', () => {
    // Square: (1,1),(3,1),(3,3),(1,3) inside a 5×5 grid
    const result = buildPolygonSelection([[1, 1], [3, 1], [3, 3], [1, 3]], 5, 5);
    expect(result).not.toBeNull();
    expect(result!.x1).toBe(1);
    expect(result!.y1).toBe(1);
    expect(result!.x2).toBe(3);
    expect(result!.y2).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// usePolygonSelectTool — hook
// ---------------------------------------------------------------------------

describe('usePolygonSelectTool', () => {
  function setup() {
    const setSelection = vi.fn();
    const { result } = renderHook(() =>
      usePolygonSelectTool({ width: 10, height: 10, setSelection }),
    );
    return { result, setSelection };
  }

  it('exposes the expected context shape', () => {
    const { result } = setup();
    const { context } = result.current;
    expect(context).toHaveProperty('anchors');
    expect(context).toHaveProperty('cursor');
    expect(context).toHaveProperty('setCursor');
    expect(context).toHaveProperty('dblClickPending');
    expect(context).toHaveProperty('commit');
    expect(context).toHaveProperty('cancel');
  });

  it('cancel() resets cursor to null', () => {
    const { result } = setup();
    // First move cursor to a known position
    act(() => {
      result.current.context.setCursor([3, 4]);
    });
    expect(result.current.context.cursor).toEqual([3, 4]);

    act(() => {
      result.current.context.cancel();
    });
    expect(result.current.context.cursor).toBeNull();
  });

  it('cancel() does not call setSelection', () => {
    const { result, setSelection } = setup();
    act(() => {
      result.current.context.cancel();
    });
    expect(setSelection).not.toHaveBeenCalled();
  });

  it('commit() with fewer than 3 anchors does NOT call setSelection', () => {
    const { result, setSelection } = setup();
    // Add only 2 anchors
    act(() => {
      result.current.context.anchors.current = [[0, 0], [4, 0]];
      result.current.context.commit();
    });
    expect(setSelection).not.toHaveBeenCalled();
  });

  it('commit() with fewer than 3 anchors resets anchors and cursor', () => {
    const { result } = setup();
    act(() => {
      result.current.context.setCursor([1, 1]);
    });
    act(() => {
      result.current.context.anchors.current = [[0, 0], [4, 0]];
      result.current.context.commit();
    });
    expect(result.current.context.anchors.current).toHaveLength(0);
    expect(result.current.context.cursor).toBeNull();
  });

  it('commit() with a valid triangle calls setSelection with shape cells', () => {
    const { result, setSelection } = setup();
    act(() => {
      // Non-degenerate triangle well within the 10×10 grid
      result.current.context.anchors.current = [[0, 0], [8, 0], [4, 8]];
      result.current.context.commit();
    });
    expect(setSelection).toHaveBeenCalledOnce();
    const arg = setSelection.mock.calls[0][0];
    expect(arg).not.toBeNull();
    expect(arg.shape).toBe('cells');
    expect(arg.cells).toBeInstanceOf(Set);
    expect(arg.cells.size).toBeGreaterThan(0);
  });

  it('commit() resets anchors and cursor after a successful selection', () => {
    const { result } = setup();
    act(() => {
      result.current.context.setCursor([2, 2]);
    });
    act(() => {
      result.current.context.anchors.current = [[0, 0], [8, 0], [4, 8]];
      result.current.context.commit();
    });
    expect(result.current.context.anchors.current).toHaveLength(0);
    expect(result.current.context.cursor).toBeNull();
  });

  it('dblClickPending starts as false', () => {
    const { result } = setup();
    expect(result.current.context.dblClickPending.current).toBe(false);
  });
});
