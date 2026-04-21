/**
 * Tests for `useLayerTransform` — the state machine for the Move-tool
 * transform box (idle tight-bbox → pending affine → commit/cancel). The hook
 * is pure React state with no DOM dependencies, so it's exercised through
 * renderHook + act and against simple fixtures.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLayerTransform } from './useLayerTransform';
import { IDENTITY, type AffineMatrix } from '../lib/transforms';
import type { ActivePixels } from './usePixelArtHistory';

/**
 * Build an ActivePixels stub. `commit` + `emit` + `dispatch` are independent
 * spies so each commit path can be asserted separately.
 */
function makeActivePixels(pixels: string[]): ActivePixels & {
  commit: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  dispatch: ReturnType<typeof vi.fn>;
} {
  return {
    pixels,
    commit: vi.fn(),
    dispatch: vi.fn(),
    emit: vi.fn(),
  };
}

/** 4×4 grid with a 2×2 red block at (1,1)–(2,2). Tight bbox = {1,1,2,2}. */
function twoByTwoFixture() {
  const pixels: string[] = Array(16).fill('');
  pixels[1 * 4 + 1] = '#ff0000';
  pixels[1 * 4 + 2] = '#ff0000';
  pixels[2 * 4 + 1] = '#ff0000';
  pixels[2 * 4 + 2] = '#ff0000';
  return pixels;
}

describe('useLayerTransform', () => {
  it('bbox is null when the layer has no painted pixels', () => {
    const ap = makeActivePixels(Array(16).fill(''));
    const { result } = renderHook(() =>
      useLayerTransform({ pixels: ap.pixels, width: 4, height: 4, activePixels: ap }),
    );
    expect(result.current.bbox).toBeNull();
    expect(result.current.isPending).toBe(false);
    expect(result.current.pending).toBeNull();
    expect(result.current.transformedCorners()).toBeNull();
  });

  it('bbox tracks the tight bounds of non-empty pixels while idle', () => {
    const ap = makeActivePixels(twoByTwoFixture());
    const { result } = renderHook(() =>
      useLayerTransform({ pixels: ap.pixels, width: 4, height: 4, activePixels: ap }),
    );
    expect(result.current.bbox).toEqual({ x1: 1, y1: 1, x2: 2, y2: 2 });
  });

  it('beginPending snapshots current pixels + bbox and starts with the identity matrix', () => {
    const ap = makeActivePixels(twoByTwoFixture());
    const { result } = renderHook(() =>
      useLayerTransform({ pixels: ap.pixels, width: 4, height: 4, activePixels: ap }),
    );
    act(() => {
      result.current.beginPending();
    });
    expect(result.current.isPending).toBe(true);
    const p = result.current.pending!;
    expect(p.snapshotBBox).toEqual({ x1: 1, y1: 1, x2: 2, y2: 2 });
    expect(p.snapshotPixels).toEqual(ap.pixels);
    // Snapshot is a copy — mutating it must not mutate the hook's view.
    expect(p.snapshotPixels).not.toBe(ap.pixels);
    expect(p.matrix).toEqual(IDENTITY);
  });

  it('beginPending is idempotent — a second call returns the same pending state', () => {
    const ap = makeActivePixels(twoByTwoFixture());
    const { result } = renderHook(() =>
      useLayerTransform({ pixels: ap.pixels, width: 4, height: 4, activePixels: ap }),
    );
    let first: ReturnType<typeof result.current.beginPending> = null;
    act(() => {
      first = result.current.beginPending();
    });
    let second: ReturnType<typeof result.current.beginPending> = null;
    act(() => {
      second = result.current.beginPending();
    });
    expect(second).toBe(first);
    expect(result.current.pending).toBe(first);
  });

  it('beginPending on an empty layer returns null and does not enter pending state', () => {
    const ap = makeActivePixels(Array(16).fill(''));
    const { result } = renderHook(() =>
      useLayerTransform({ pixels: ap.pixels, width: 4, height: 4, activePixels: ap }),
    );
    let started: ReturnType<typeof result.current.beginPending> = null;
    act(() => {
      started = result.current.beginPending();
    });
    expect(started).toBeNull();
    expect(result.current.isPending).toBe(false);
  });

  it('setMatrix + multiplyMatrixLeft are no-ops when nothing is pending', () => {
    const ap = makeActivePixels(twoByTwoFixture());
    const { result } = renderHook(() =>
      useLayerTransform({ pixels: ap.pixels, width: 4, height: 4, activePixels: ap }),
    );
    act(() => {
      result.current.setMatrix({ a: 2, b: 0, c: 0, d: 2, tx: 0, ty: 0 });
      result.current.multiplyMatrixLeft({ a: 2, b: 0, c: 0, d: 2, tx: 0, ty: 0 });
    });
    expect(result.current.pending).toBeNull();
  });

  it('setMatrix replaces the pending matrix', () => {
    const ap = makeActivePixels(twoByTwoFixture());
    const { result } = renderHook(() =>
      useLayerTransform({ pixels: ap.pixels, width: 4, height: 4, activePixels: ap }),
    );
    act(() => {
      result.current.beginPending();
    });
    const newM: AffineMatrix = { a: 1, b: 0, c: 0, d: 1, tx: 3, ty: -2 };
    act(() => {
      result.current.setMatrix(newM);
    });
    expect(result.current.pending?.matrix).toEqual(newM);
  });

  it('multiplyMatrixLeft composes the delta onto the current matrix', () => {
    const ap = makeActivePixels(twoByTwoFixture());
    const { result } = renderHook(() =>
      useLayerTransform({ pixels: ap.pixels, width: 4, height: 4, activePixels: ap }),
    );
    act(() => {
      result.current.beginPending();
    });
    // Translate by (1, 0) then by (0, 1). Result should be (1, 1).
    act(() => {
      result.current.multiplyMatrixLeft({ a: 1, b: 0, c: 0, d: 1, tx: 1, ty: 0 });
    });
    act(() => {
      result.current.multiplyMatrixLeft({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 1 });
    });
    const m = result.current.pending!.matrix;
    expect(m.tx).toBeCloseTo(1, 9);
    expect(m.ty).toBeCloseTo(1, 9);
    // Linear part untouched.
    expect(m.a).toBeCloseTo(1, 9);
    expect(m.d).toBeCloseTo(1, 9);
  });

  it('commit with an identity matrix is a no-op: neither commit nor emit fire, pending clears', () => {
    const ap = makeActivePixels(twoByTwoFixture());
    const { result } = renderHook(() =>
      useLayerTransform({ pixels: ap.pixels, width: 4, height: 4, activePixels: ap }),
    );
    act(() => {
      result.current.beginPending();
    });
    act(() => {
      result.current.commit();
    });
    expect(ap.commit).not.toHaveBeenCalled();
    expect(ap.emit).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(false);
  });

  it('commit with a non-identity translation routes the transformed pixels through activePixels.commit + emit', () => {
    const ap = makeActivePixels(twoByTwoFixture());
    const { result } = renderHook(() =>
      useLayerTransform({ pixels: ap.pixels, width: 4, height: 4, activePixels: ap }),
    );
    act(() => {
      result.current.beginPending();
    });
    // Translate everything 1 cell right.
    act(() => {
      result.current.setMatrix({ a: 1, b: 0, c: 0, d: 1, tx: 1, ty: 0 });
    });
    act(() => {
      result.current.commit();
    });
    expect(ap.commit).toHaveBeenCalledTimes(1);
    expect(ap.emit).toHaveBeenCalledTimes(1);
    const committed = ap.commit.mock.calls[0][0] as string[];
    // The original 2×2 red block at cols 1–2 should land at cols 2–3.
    expect(committed[1 * 4 + 2]).toBe('#ff0000');
    expect(committed[1 * 4 + 3]).toBe('#ff0000');
    expect(committed[2 * 4 + 2]).toBe('#ff0000');
    expect(committed[2 * 4 + 3]).toBe('#ff0000');
    // And the original positions should be empty.
    expect(committed[1 * 4 + 1]).toBe('');
    expect(committed[2 * 4 + 1]).toBe('');
    expect(result.current.isPending).toBe(false);
  });

  it('cancel clears the pending transform without invoking activePixels', () => {
    const ap = makeActivePixels(twoByTwoFixture());
    const { result } = renderHook(() =>
      useLayerTransform({ pixels: ap.pixels, width: 4, height: 4, activePixels: ap }),
    );
    act(() => {
      result.current.beginPending();
      result.current.setMatrix({ a: 1, b: 0, c: 0, d: 1, tx: 5, ty: 5 });
    });
    act(() => {
      result.current.cancel();
    });
    expect(result.current.isPending).toBe(false);
    expect(result.current.pending).toBeNull();
    expect(ap.commit).not.toHaveBeenCalled();
    expect(ap.emit).not.toHaveBeenCalled();
  });

  it('commit/cancel on a fresh (never-pending) hook are safe no-ops', () => {
    const ap = makeActivePixels(twoByTwoFixture());
    const { result } = renderHook(() =>
      useLayerTransform({ pixels: ap.pixels, width: 4, height: 4, activePixels: ap }),
    );
    expect(() => act(() => result.current.commit())).not.toThrow();
    expect(() => act(() => result.current.cancel())).not.toThrow();
    expect(ap.commit).not.toHaveBeenCalled();
  });

  it('transformedCorners returns the raw bbox corners when idle and matrix-applied corners when pending', () => {
    const ap = makeActivePixels(twoByTwoFixture());
    const { result } = renderHook(() =>
      useLayerTransform({ pixels: ap.pixels, width: 4, height: 4, activePixels: ap }),
    );
    // Idle: corners follow the tight bbox {1,1,2,2}. Edges are +1 on max side.
    expect(result.current.transformedCorners()).toEqual([
      [1, 1], [3, 1], [3, 3], [1, 3],
    ]);
    act(() => {
      result.current.beginPending();
      // Translate by (+2, 0).
      result.current.setMatrix({ a: 1, b: 0, c: 0, d: 1, tx: 2, ty: 0 });
    });
    const corners = result.current.transformedCorners()!;
    expect(corners[0]).toEqual([3, 1]);
    expect(corners[1]).toEqual([5, 1]);
    expect(corners[2]).toEqual([5, 3]);
    expect(corners[3]).toEqual([3, 3]);
  });

  it('hitTestHandle finds each corner handle and the body, at a zoom where handles are well-separated', () => {
    const ap = makeActivePixels(twoByTwoFixture());
    const { result } = renderHook(() =>
      useLayerTransform({ pixels: ap.pixels, width: 4, height: 4, activePixels: ap }),
    );
    // At zoom=32, source corners (1,1) / (3,1) / (3,3) / (1,3) in grid coords
    // map to screen coords (32, 32) / (96, 32) / (96, 96) / (32, 96). The
    // 12-CSS-pixel hit radius then only catches the intended handle.
    expect(result.current.hitTestHandle(32, 32, 0, 0, 32)).toBe('nw');
    expect(result.current.hitTestHandle(96, 32, 0, 0, 32)).toBe('ne');
    expect(result.current.hitTestHandle(96, 96, 0, 0, 32)).toBe('se');
    expect(result.current.hitTestHandle(32, 96, 0, 0, 32)).toBe('sw');
    // Edge midpoints: n=(64,32), s=(64,96), w=(32,64), e=(96,64).
    expect(result.current.hitTestHandle(64, 32, 0, 0, 32)).toBe('n');
    expect(result.current.hitTestHandle(64, 96, 0, 0, 32)).toBe('s');
    expect(result.current.hitTestHandle(32, 64, 0, 0, 32)).toBe('w');
    expect(result.current.hitTestHandle(96, 64, 0, 0, 32)).toBe('e');
    // Centre of the bbox → inside the body quad.
    expect(result.current.hitTestHandle(64, 64, 0, 0, 32)).toBe('body');
    // Far outside → nothing.
    expect(result.current.hitTestHandle(500, 500, 0, 0, 32)).toBeNull();
  });

  it('hitTestHandle returns null when there is no bbox', () => {
    const ap = makeActivePixels(Array(16).fill(''));
    const { result } = renderHook(() =>
      useLayerTransform({ pixels: ap.pixels, width: 4, height: 4, activePixels: ap }),
    );
    expect(result.current.hitTestHandle(0, 0, 0, 0, 1)).toBeNull();
  });

  it('bbox correctly bounds a single non-empty pixel', () => {
    // Only one painted cell at (col=2, row=3) in a 4×4 grid.
    const pixels = Array(16).fill('') as string[];
    pixels[3 * 4 + 2] = '#abcdef';
    const ap = makeActivePixels(pixels);
    const { result } = renderHook(() =>
      useLayerTransform({ pixels: ap.pixels, width: 4, height: 4, activePixels: ap }),
    );
    expect(result.current.bbox).toEqual({ x1: 2, y1: 3, x2: 2, y2: 3 });
  });

  it('bbox updates when pixels prop changes via re-render', () => {
    // Start with no painted pixels, then re-render with a painted pixel.
    let currentPixels = Array(16).fill('') as string[];
    const ap = makeActivePixels(currentPixels);
    const { result, rerender } = renderHook(
      ({ pixels }: { pixels: string[] }) =>
        useLayerTransform({ pixels, width: 4, height: 4, activePixels: ap }),
      { initialProps: { pixels: currentPixels } },
    );
    expect(result.current.bbox).toBeNull();

    const updatedPixels = Array(16).fill('') as string[];
    updatedPixels[0 * 4 + 0] = '#ff0000'; // top-left corner
    updatedPixels[3 * 4 + 3] = '#00ff00'; // bottom-right corner
    rerender({ pixels: updatedPixels });

    expect(result.current.bbox).toEqual({ x1: 0, y1: 0, x2: 3, y2: 3 });
  });

  it('hitTestHandle respects panX and panY offsets', () => {
    const ap = makeActivePixels(twoByTwoFixture());
    const { result } = renderHook(() =>
      useLayerTransform({ pixels: ap.pixels, width: 4, height: 4, activePixels: ap }),
    );
    // At zoom=32, the bbox corners in grid coords (1,1)–(3,3) normally map to
    // screen (32,32)–(96,96). Adding panX=100, panY=50 shifts everything:
    // nw corner is now at screen (100+32, 50+32) = (132, 82).
    expect(result.current.hitTestHandle(132, 82, 100, 50, 32)).toBe('nw');
    expect(result.current.hitTestHandle(196, 82, 100, 50, 32)).toBe('ne');
    // Point at the original (un-panned) nw corner should miss.
    expect(result.current.hitTestHandle(32, 32, 100, 50, 32)).toBeNull();
  });

  it('hitTestHandle detects the rotate handle above the north midpoint', () => {
    const ap = makeActivePixels(twoByTwoFixture());
    const { result } = renderHook(() =>
      useLayerTransform({ pixels: ap.pixels, width: 4, height: 4, activePixels: ap }),
    );
    // At zoom=32, panX=0, panY=0:
    //   nw=(32,32), ne=(96,32). n midpoint = (64,32).
    //   rotate handle is ROTATE_OFFSET_PX=24 px above n, away from centre.
    //   Centre y = (32+96)/2 = 64. Vector from centre to n = (0, 32-64) = (0,-32).
    //   Unit = (0,-1). Rotate = (64, 32 + (-1)*24) = (64, 8).
    expect(result.current.hitTestHandle(64, 8, 0, 0, 32)).toBe('rotate');
    // Just past the 12-px hit radius should miss rotate.
    expect(result.current.hitTestHandle(64, 8 + 13, 0, 0, 32)).not.toBe('rotate');
  });

  it('commit with a scaling matrix transforms pixels and calls activePixels.commit', () => {
    // Use a 6×6 grid with a single pixel at (2,2) to verify scale mapping.
    // Scale by 2× centred at origin: matrix = {a:2,b:0,c:0,d:2,tx:0,ty:0}.
    // The pixel at grid (2,2) should appear at grid (4,4) in the output.
    const pixels = Array(36).fill('') as string[];
    pixels[2 * 6 + 2] = '#123456';
    const ap = makeActivePixels(pixels);
    const { result } = renderHook(() =>
      useLayerTransform({ pixels: ap.pixels, width: 6, height: 6, activePixels: ap }),
    );
    act(() => {
      result.current.beginPending();
    });
    act(() => {
      result.current.setMatrix({ a: 2, b: 0, c: 0, d: 2, tx: 0, ty: 0 });
    });
    act(() => {
      result.current.commit();
    });
    expect(ap.commit).toHaveBeenCalledTimes(1);
    const committed = ap.commit.mock.calls[0][0] as string[];
    // Source (2,2) forward-maps to dest (4,4). Inverse maps dest (4,4) back
    // to source (2,2), picking up '#123456'.
    expect(committed[4 * 6 + 4]).toBe('#123456');
    expect(result.current.isPending).toBe(false);
  });

  it('pending state is frozen at the snapshotted bbox even as idle bbox would change', () => {
    // Once pending starts, snapshotBBox must not update even if the caller
    // provides new pixel data (the layer is hidden during pending — but the
    // API contract is snapshot stability).
    const original = twoByTwoFixture();
    const ap = makeActivePixels(original);
    const { result, rerender } = renderHook(
      ({ pixels }: { pixels: string[] }) =>
        useLayerTransform({ pixels, width: 4, height: 4, activePixels: ap }),
      { initialProps: { pixels: original } },
    );
    act(() => {
      result.current.beginPending();
    });
    const frozenBBox = result.current.pending!.snapshotBBox;
    expect(frozenBBox).toEqual({ x1: 1, y1: 1, x2: 2, y2: 2 });

    // Simulate "all pixels cleared" update — idle bbox would become null,
    // but snapshotBBox must remain stable.
    const cleared = Array(16).fill('') as string[];
    rerender({ pixels: cleared });

    expect(result.current.pending!.snapshotBBox).toEqual(frozenBBox);
    expect(result.current.bbox).toEqual(frozenBBox); // bbox reads from snapshot when pending
  });
});
