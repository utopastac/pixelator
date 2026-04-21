/**
 * Tests for `usePenTool` — pen-path state (anchors + cursor) and the two
 * commit / cancel operations. Commit rasterises anchor-to-anchor bresenham
 * lines through the active-pixels seam; cancel drops everything.
 *
 * Invariants:
 * - commit() with fewer than 2 anchors is always a no-op (no pixel write).
 * - commit() with N>=2 anchors produces a bresenham line for each consecutive
 *   anchor pair, optionally closing back to anchor[0].
 * - commit() applies the selection mask via maskToSelection before writing.
 * - cancel() zeros anchors, cursor, liftedPixelsRef, and calls clearRect on
 *   the preview canvas.
 * - dblClickPending starts false and is freely mutable as a plain ref.
 * - setCursor is a React state setter that triggers re-renders.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type React from 'react';
import { useRef } from 'react';
import { usePenTool } from './usePenTool';
import type { ActivePixels } from './usePixelArtHistory';
import type { LiftedPixels } from './usePixelArtSelection';

function makeActivePixels(initial: string[]): {
  active: ActivePixels;
  commit: ReturnType<typeof vi.fn>;
  dispatch: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
} {
  const commit = vi.fn();
  const dispatch = vi.fn();
  const emit = vi.fn();
  return {
    active: { pixels: initial, commit, dispatch, emit },
    commit,
    dispatch,
    emit,
  };
}

// Minimal preview canvas ref. jsdom doesn't implement a 2D context, so
// clearPreview's `getContext('2d')` returns null and no-ops are safe.
function usePreviewRef() {
  return useRef<HTMLCanvasElement | null>(null);
}

// A mock canvas whose 2D context is fully observable. Use this when a test
// needs to assert that clearRect was called.
function makeMockCanvasRef() {
  const clearRect = vi.fn();
  const fillRect = vi.fn();
  const ctx = { clearRect, fillRect, fillStyle: '' } as unknown as CanvasRenderingContext2D;
  const canvas = {
    getContext: vi.fn(() => ctx),
    width: 10,
    height: 10,
  } as unknown as HTMLCanvasElement;
  const ref = { current: canvas } as React.RefObject<HTMLCanvasElement | null>;
  return { ref, clearRect };
}

function setup(overrides?: {
  width?: number;
  height?: number;
  selection?: Parameters<typeof usePenTool>[0]['selection'];
  selectionContainsCell?: (c: number, r: number) => boolean;
  activeColor?: string;
  initialPixels?: string[];
  customPreviewRef?: React.RefObject<HTMLCanvasElement | null>;
}) {
  const width = overrides?.width ?? 4;
  const height = overrides?.height ?? 4;
  const initial = overrides?.initialPixels ?? new Array(width * height).fill('');
  const { active, commit, dispatch, emit } = makeActivePixels(initial);
  const liftedRef: { current: LiftedPixels | null } = { current: null };
  const customRef = overrides?.customPreviewRef;
  const hook = renderHook(() => {
    const defaultPreviewRef = usePreviewRef();
    const previewCanvasRef = customRef ?? defaultPreviewRef;
    return usePenTool({
      width,
      height,
      activePixels: active,
      activeColor: overrides?.activeColor ?? '#ff0000',
      brushSize: 'sm',
      selection: overrides?.selection ?? null,
      selectionContainsCell: overrides?.selectionContainsCell ?? (() => true),
      previewCanvasRef,
      liftedPixelsRef: liftedRef,
      symmetryMode: 'none',
      wrapMode: false,
      alphaLock: false,
    });
  });
  return { hook, commit, dispatch, emit, liftedRef, width, height };
}

describe('usePenTool', () => {
  it('initialises with an empty anchors ref, null cursor, dblClickPending=false', () => {
    const { hook } = setup();
    expect(hook.result.current.context.anchors.current).toEqual([]);
    expect(hook.result.current.context.cursor).toBeNull();
    expect(hook.result.current.context.dblClickPending.current).toBe(false);
  });

  it('commit with <2 anchors clears state without calling activePixels.commit', () => {
    const { hook, commit } = setup();
    // Single anchor → commit is a no-op for history.
    hook.result.current.context.anchors.current = [[1, 1]];
    act(() => hook.result.current.context.commit());
    expect(commit).not.toHaveBeenCalled();
    expect(hook.result.current.context.anchors.current).toEqual([]);
    expect(hook.result.current.context.cursor).toBeNull();
  });

  it('commit with 0 anchors clears state without calling activePixels.commit', () => {
    const { hook, commit } = setup();
    act(() => hook.result.current.context.commit());
    expect(commit).not.toHaveBeenCalled();
    expect(hook.result.current.context.anchors.current).toEqual([]);
  });

  it('commit with 2 anchors rasterises a bresenham line into activePixels.commit', () => {
    const { hook, commit, emit } = setup({ width: 4, height: 4, activeColor: '#123456' });
    // Horizontal line from (0,0) → (3,0).
    hook.result.current.context.anchors.current = [[0, 0], [3, 0]];
    act(() => hook.result.current.context.commit());
    expect(commit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledTimes(1);
    const next = commit.mock.calls[0][0] as string[];
    // The four cells in row 0 should be painted #123456.
    expect(next[0]).toBe('#123456');
    expect(next[1]).toBe('#123456');
    expect(next[2]).toBe('#123456');
    expect(next[3]).toBe('#123456');
    // Rest of the grid is untouched.
    expect(next.slice(4)).toEqual(new Array(12).fill(''));
  });

  it('commit clears anchors and cursor after writing', () => {
    const { hook } = setup();
    hook.result.current.context.anchors.current = [[0, 0], [1, 0]];
    act(() => hook.result.current.context.setCursor([2, 2]));
    act(() => hook.result.current.context.commit());
    expect(hook.result.current.context.anchors.current).toEqual([]);
    expect(hook.result.current.context.cursor).toBeNull();
  });

  it('commit(closeShape=true) appends the first anchor back onto the path', () => {
    // 4×4; anchors form an L: (0,0) → (2,0) → (2,2). Closing adds → (0,0).
    const { hook, commit } = setup({ width: 4, height: 4 });
    hook.result.current.context.anchors.current = [[0, 0], [2, 0], [2, 2]];
    act(() => hook.result.current.context.commit(true));
    const next = commit.mock.calls[0][0] as string[];
    // Closing the shape must draw the diagonal back to (0,0). That segment
    // passes through (1,1) (bresenham from (2,2)→(0,0)).
    expect(next[1 * 4 + 1]).toBe('#ff0000');
  });

  it('cancel drops anchors, clears cursor, and nulls the liftedPixels ref', () => {
    const { hook, liftedRef } = setup();
    hook.result.current.context.anchors.current = [[0, 0], [1, 1]];
    act(() => hook.result.current.context.setCursor([2, 2]));
    liftedRef.current = { colors: ['#abc'], x1: 0, y1: 0, x2: 0, y2: 0 };
    act(() => hook.result.current.context.cancel());
    expect(hook.result.current.context.anchors.current).toEqual([]);
    expect(hook.result.current.context.cursor).toBeNull();
    expect(liftedRef.current).toBeNull();
  });

  it('cancel calls clearRect on the preview canvas', () => {
    const { ref, clearRect } = makeMockCanvasRef();
    const { hook } = setup({ customPreviewRef: ref });
    hook.result.current.context.anchors.current = [[0, 0], [1, 1]];
    act(() => hook.result.current.context.cancel());
    expect(clearRect).toHaveBeenCalledWith(0, 0, 10, 10);
  });

  it('dblClickPending is mutable via the ref and persists across renders', () => {
    const { hook } = setup();
    expect(hook.result.current.context.dblClickPending.current).toBe(false);
    hook.result.current.context.dblClickPending.current = true;
    hook.rerender();
    expect(hook.result.current.context.dblClickPending.current).toBe(true);
  });

  it('setCursor updates the cursor state and triggers a re-render', () => {
    const { hook } = setup();
    act(() => hook.result.current.context.setCursor([3, 4]));
    expect(hook.result.current.context.cursor).toEqual([3, 4]);
    act(() => hook.result.current.context.setCursor(null));
    expect(hook.result.current.context.cursor).toBeNull();
  });

  it('commit respects the selection mask: pixels outside selection are not painted', () => {
    // 4×4, selection is the top-left 2×2 (rect). Commit a horizontal line
    // across the whole top row: only cells (0,0) and (1,0) land, (2,0) and
    // (3,0) are masked out because they fall outside the selection rect.
    const { hook, commit } = setup({
      width: 4,
      height: 4,
      selection: { shape: 'rect', x1: 0, y1: 0, x2: 1, y2: 1 },
      // The first anchor (0,0) is inside the selection, so keepInside is true
      // and pixels outside get clipped to the untouched value ('' here).
      selectionContainsCell: (c, r) => c <= 1 && r <= 1,
    });
    hook.result.current.context.anchors.current = [[0, 0], [3, 0]];
    act(() => hook.result.current.context.commit());
    const next = commit.mock.calls[0][0] as string[];
    expect(next[0]).toBe('#ff0000');
    expect(next[1]).toBe('#ff0000');
    expect(next[2]).toBe(''); // outside selection → preserved
    expect(next[3]).toBe('');
  });
});
