/**
 * Tests for `useMoveTransformTool` — pointer-gesture → affine-matrix driver
 * for the Move-tool transform box. The hook is pointer-handler heavy and
 * leans on a companion `useLayerTransform` instance for its state, so we
 * exercise both together and focus on the public gesture contract:
 *
 *   - handlePointerDown return values for each short-circuit branch.
 *   - Matrix updates when dragging the body handle.
 *   - pointer up / cancel semantics (clears drag state, preserves pending).
 *
 * Canvas rendering is not asserted — jsdom's 2D context is effectively a
 * no-op, and the hook already forwards preview draws through a single
 * `renderPreview` helper that early-exits when the context is null.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLayerTransform } from './useLayerTransform';
import { useMoveTransformTool } from './useMoveTransformTool';
import type { ActivePixels } from './usePixelArtHistory';

/** 2×2 painted block at (1,1)–(2,2) in a 4×4 grid. Tight bbox = {1,1,2,2}. */
function blockFixture(): string[] {
  const pixels = Array(16).fill('') as string[];
  pixels[1 * 4 + 1] = '#00ff00';
  pixels[1 * 4 + 2] = '#00ff00';
  pixels[2 * 4 + 1] = '#00ff00';
  pixels[2 * 4 + 2] = '#00ff00';
  return pixels;
}

function makeActivePixels(pixels: string[]): ActivePixels {
  return {
    pixels,
    commit: vi.fn(),
    dispatch: vi.fn(),
    emit: vi.fn(),
    flushPendingPixelsSync: vi.fn(),
  };
}

/** Stub HTMLCanvasElement.getContext so the hook's preview helpers don't
 *  explode and getBoundingClientRect returns a 4×4 CSS-pixel rect (so
 *  getCellFromEvent maps clientX/Y 1:1 onto grid cells). */
let getContextSpy: ReturnType<typeof vi.spyOn> | null = null;
let getRectSpy: ReturnType<typeof vi.spyOn> | null = null;

// Render the test canvas at 32 CSS px per grid cell so the 12-pixel handle
// hit radius never spans the whole bbox. All client coords in the tests below
// are in this 32-px-per-cell screen space; grid ↔ screen conversions happen
// inside the hook via getBoundingClientRect and the matching zoom value.
const CELL_PX = 32;
const GRID_W = 4;

beforeEach(() => {
  const fakeCtx = {
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    set fillStyle(_v: string) { /* swallow */ },
    get fillStyle() { return '#000'; },
    get imageSmoothingEnabled() { return false; },
    set imageSmoothingEnabled(_v: boolean) { /* swallow */ },
  } as unknown as CanvasRenderingContext2D;
  getContextSpy = vi.spyOn(
    HTMLCanvasElement.prototype,
    'getContext',
  ) as unknown as ReturnType<typeof vi.spyOn>;
  // Type note: getContext is overloaded; we just return the stub for any call.
  (getContextSpy as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(fakeCtx);

  // Rect width = GRID_W × CELL_PX so getCellFromEvent's clientX/cellPx matches
  // the hook's screen-space coords at zoom = CELL_PX.
  const screenW = GRID_W * CELL_PX;
  getRectSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect');
  getRectSpy.mockReturnValue({
    left: 0, top: 0, right: screenW, bottom: screenW,
    width: screenW, height: screenW, x: 0, y: 0,
    toJSON: () => ({}),
  } as DOMRect);
});

afterEach(() => {
  getContextSpy?.mockRestore();
  getRectSpy?.mockRestore();
});

/** Render both hooks in a single harness so they share transform state. */
function renderTool(
  pixels: string[],
  opts: { disabled?: boolean } = {},
) {
  const activePixels = makeActivePixels(pixels);
  const committedCanvasRef = { current: document.createElement('canvas') };
  const previewCanvasRef = { current: document.createElement('canvas') };
  committedCanvasRef.current.width = 4;
  committedCanvasRef.current.height = 4;
  previewCanvasRef.current.width = 4;
  previewCanvasRef.current.height = 4;

  const harness = renderHook(() => {
    const transform = useLayerTransform({
      pixels,
      width: GRID_W,
      height: GRID_W,
      activePixels,
    });
    const tool = useMoveTransformTool({
      width: GRID_W,
      height: GRID_W,
      disabled: opts.disabled ?? false,
      committedCanvasRef,
      previewCanvasRef,
      transform,
      panX: 0,
      panY: 0,
      zoom: CELL_PX,
    });
    return { transform, tool };
  });

  return { harness, activePixels, committedCanvasRef, previewCanvasRef };
}

/** Build a minimal pointer-event-like object — the hooks only touch `button`,
 *  `clientX`, `clientY`, and `preventDefault`. */
function pe(clientX: number, clientY: number, button = 0) {
  return {
    button,
    clientX,
    clientY,
    preventDefault: vi.fn(),
  } as unknown as React.PointerEvent<HTMLCanvasElement>;
}

// Handy screen-space coordinates (CELL_PX = 32 per grid cell).
// Block bbox corners in grid coords: (1,1), (3,1), (3,3), (1,3).
//   → screen: (32,32), (96,32), (96,96), (32,96). Body centre: (64,64).
const BODY_CENTRE: [number, number] = [64, 64];
const FAR_OUTSIDE: [number, number] = [500, 500];

describe('useMoveTransformTool.handlePointerDown', () => {
  it('returns false when disabled (lets other tool handlers run)', () => {
    const { harness } = renderTool(blockFixture(), { disabled: true });
    let handled = false;
    act(() => {
      handled = harness.result.current.tool.handlePointerDown(pe(...BODY_CENTRE));
    });
    expect(handled).toBe(false);
    expect(harness.result.current.transform.isPending).toBe(false);
  });

  it('returns false for non-left-button clicks (right-click passes through)', () => {
    const { harness } = renderTool(blockFixture());
    let handled = false;
    act(() => {
      handled = harness.result.current.tool.handlePointerDown(pe(BODY_CENTRE[0], BODY_CENTRE[1], 2));
    });
    expect(handled).toBe(false);
  });

  it('returns true and does nothing when the layer is empty (bbox is null)', () => {
    const { harness, activePixels } = renderTool(Array(16).fill(''));
    let handled = false;
    act(() => {
      handled = harness.result.current.tool.handlePointerDown(pe(0, 0));
    });
    expect(handled).toBe(true);
    expect(harness.result.current.transform.isPending).toBe(false);
    expect(activePixels.commit).not.toHaveBeenCalled();
  });

  it('click outside the bbox with no pending transform is swallowed (true) with no commit', () => {
    const { harness, activePixels } = renderTool(blockFixture());
    let handled = false;
    act(() => {
      handled = harness.result.current.tool.handlePointerDown(pe(...FAR_OUTSIDE));
    });
    expect(handled).toBe(true);
    expect(activePixels.commit).not.toHaveBeenCalled();
    expect(harness.result.current.transform.isPending).toBe(false);
  });

  it('click outside the bbox WHILE pending commits the transform', () => {
    const { harness, activePixels } = renderTool(blockFixture());
    // Start a pending transform and apply a translation so commit isn't a
    // no-op identity.
    act(() => {
      harness.result.current.transform.beginPending();
      harness.result.current.transform.setMatrix({
        a: 1, b: 0, c: 0, d: 1, tx: 1, ty: 0,
      });
    });
    expect(harness.result.current.transform.isPending).toBe(true);
    act(() => {
      harness.result.current.tool.handlePointerDown(pe(...FAR_OUTSIDE));
    });
    expect(activePixels.commit).toHaveBeenCalledTimes(1);
    expect(harness.result.current.transform.isPending).toBe(false);
  });

  it('click on the body handle begins a pending transform and captures the drag', () => {
    const { harness } = renderTool(blockFixture());
    // BODY_CENTRE falls inside the body quad and is > 12 px from every corner.
    act(() => {
      harness.result.current.tool.handlePointerDown(pe(...BODY_CENTRE));
    });
    expect(harness.result.current.transform.isPending).toBe(true);
    expect(harness.result.current.transform.pending?.snapshotBBox).toEqual({
      x1: 1, y1: 1, x2: 2, y2: 2,
    });
  });
});

describe('useMoveTransformTool.handlePointerMove', () => {
  it('returns false before any drag has started', () => {
    const { harness } = renderTool(blockFixture());
    const handled = harness.result.current.tool.handlePointerMove({ clientX: BODY_CENTRE[0], clientY: BODY_CENTRE[1] });
    expect(handled).toBe(false);
  });

  it('a body drag composes a translation matrix by the grid-space delta', () => {
    const { harness } = renderTool(blockFixture());
    // Start at BODY_CENTRE (screen 64,64 = grid 2,2). Move by (+CELL_PX, +2×CELL_PX)
    // → screen (96, 128) → grid (3, 4). Expected matrix delta (1, 2).
    act(() => {
      harness.result.current.tool.handlePointerDown(pe(BODY_CENTRE[0], BODY_CENTRE[1]));
    });
    act(() => {
      harness.result.current.tool.handlePointerMove({
        clientX: BODY_CENTRE[0] + CELL_PX,
        clientY: BODY_CENTRE[1] + 2 * CELL_PX,
      });
    });
    const m = harness.result.current.transform.pending!.matrix;
    expect(m.a).toBeCloseTo(1, 9);
    expect(m.d).toBeCloseTo(1, 9);
    expect(m.tx).toBeCloseTo(1, 9);
    expect(m.ty).toBeCloseTo(2, 9);
  });
});

describe('useMoveTransformTool pointer lifecycle', () => {
  it('pointer up clears the drag state but keeps the pending transform live', () => {
    const { harness } = renderTool(blockFixture());
    act(() => {
      harness.result.current.tool.handlePointerDown(pe(BODY_CENTRE[0], BODY_CENTRE[1]));
      harness.result.current.tool.handlePointerMove({ clientX: BODY_CENTRE[0] + CELL_PX, clientY: BODY_CENTRE[1] });
    });
    const matrixBeforeUp = { ...harness.result.current.transform.pending!.matrix };
    let handled = false;
    act(() => {
      handled = harness.result.current.tool.handlePointerUp(pe(BODY_CENTRE[0] + CELL_PX, BODY_CENTRE[1]));
    });
    expect(handled).toBe(true);
    expect(harness.result.current.transform.isPending).toBe(true);
    expect(harness.result.current.transform.pending!.matrix).toEqual(matrixBeforeUp);
    // A move after pointer-up shouldn't touch the matrix any more.
    act(() => {
      const still = harness.result.current.tool.handlePointerMove({ clientX: 10, clientY: 10 });
      expect(still).toBe(false);
    });
    expect(harness.result.current.transform.pending!.matrix).toEqual(matrixBeforeUp);
  });

  it('pointer cancel clears the drag state but keeps pending (same as up)', () => {
    const { harness } = renderTool(blockFixture());
    act(() => {
      harness.result.current.tool.handlePointerDown(pe(BODY_CENTRE[0], BODY_CENTRE[1]));
      harness.result.current.tool.handlePointerMove({ clientX: BODY_CENTRE[0] + CELL_PX, clientY: BODY_CENTRE[1] });
    });
    expect(harness.result.current.transform.isPending).toBe(true);
    act(() => {
      harness.result.current.tool.handlePointerCancel();
    });
    expect(harness.result.current.transform.isPending).toBe(true);
    // Subsequent move no longer affects the matrix.
    const snap = { ...harness.result.current.transform.pending!.matrix };
    act(() => {
      harness.result.current.tool.handlePointerMove({ clientX: 10, clientY: 10 });
    });
    expect(harness.result.current.transform.pending!.matrix).toEqual(snap);
  });

  it('pointer up without an in-flight drag returns false', () => {
    const { harness } = renderTool(blockFixture());
    const handled = harness.result.current.tool.handlePointerUp(pe(BODY_CENTRE[0], BODY_CENTRE[1]));
    expect(handled).toBe(false);
  });
});
