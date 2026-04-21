/**
 * Tests for `useTilingCanvas` — the hook that paints a 3×3 tiling preview
 * around the committed canvas and clears itself when disabled.
 *
 * Canvas `getContext` is stubbed with a minimal mock because jsdom does not
 * implement a real 2D rendering context.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createRef } from 'react';
import { useTilingCanvas } from './useTilingCanvas';

// ── Canvas mock ──────────────────────────────────────────────────────────────

const ctxMock = {
  clearRect: vi.fn(),
  drawImage: vi.fn(),
};

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctxMock as unknown as CanvasRenderingContext2D,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  ctxMock.clearRect.mockClear();
  ctxMock.drawImage.mockClear();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Create a real HTMLCanvasElement wired up as a committedCanvasRef. */
function makeCommittedRef(w = 8, h = 8) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ref = createRef<HTMLCanvasElement | null>();
  (ref as { current: HTMLCanvasElement | null }).current = canvas;
  return ref;
}

/** Mount the hook and return the renderHook result. */
function mount(opts: {
  enabled: boolean;
  width?: number;
  height?: number;
  committedRef?: React.RefObject<HTMLCanvasElement | null>;
}) {
  const width = opts.width ?? 8;
  const height = opts.height ?? 8;
  const committedCanvasRef = opts.committedRef ?? makeCommittedRef(width, height);

  return renderHook(
    (props: { enabled: boolean }) =>
      useTilingCanvas({ committedCanvasRef, width, height, enabled: props.enabled }),
    { initialProps: { enabled: opts.enabled } },
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useTilingCanvas', () => {
  describe('paintTiles with enabled=false', () => {
    it('does not call drawImage', () => {
      const { result } = mount({ enabled: false });
      act(() => { result.current.paintTiles(); });
      expect(ctxMock.drawImage).not.toHaveBeenCalled();
    });

    it('does not call clearRect from paintTiles itself', () => {
      const { result } = mount({ enabled: false });
      // Clear any calls that came from the useEffect on mount.
      ctxMock.clearRect.mockClear();
      act(() => { result.current.paintTiles(); });
      expect(ctxMock.clearRect).not.toHaveBeenCalled();
    });
  });

  describe('paintTiles with enabled=true and a valid committed canvas', () => {
    it('sets the tiling canvas dimensions to width*3 × height*3', () => {
      const W = 8, H = 6;
      const { result } = mount({ enabled: true, width: W, height: H });
      // Attach a real canvas to tilingCanvasRef so we can check its dimensions.
      const tilingCanvas = document.createElement('canvas');
      (result.current.tilingCanvasRef as { current: HTMLCanvasElement | null }).current =
        tilingCanvas;

      act(() => { result.current.paintTiles(); });

      expect(tilingCanvas.width).toBe(W * 3);
      expect(tilingCanvas.height).toBe(H * 3);
    });

    it('calls clearRect exactly once', () => {
      const { result } = mount({ enabled: true });
      const tilingCanvas = document.createElement('canvas');
      (result.current.tilingCanvasRef as { current: HTMLCanvasElement | null }).current =
        tilingCanvas;

      ctxMock.clearRect.mockClear();
      act(() => { result.current.paintTiles(); });

      expect(ctxMock.clearRect).toHaveBeenCalledTimes(1);
    });

    it('calls drawImage exactly 8 times (3×3 grid minus the center)', () => {
      const { result } = mount({ enabled: true });
      const tilingCanvas = document.createElement('canvas');
      (result.current.tilingCanvasRef as { current: HTMLCanvasElement | null }).current =
        tilingCanvas;

      act(() => { result.current.paintTiles(); });

      expect(ctxMock.drawImage).toHaveBeenCalledTimes(8);
    });

    it('drawImage calls use offsets col*width and row*height, skipping center', () => {
      const W = 8, H = 6;
      const committedRef = makeCommittedRef(W, H);
      const { result } = mount({ enabled: true, width: W, height: H, committedRef });
      const tilingCanvas = document.createElement('canvas');
      (result.current.tilingCanvasRef as { current: HTMLCanvasElement | null }).current =
        tilingCanvas;

      act(() => { result.current.paintTiles(); });

      // Build the expected set of (col*W, row*H) pairs, skipping (1,1).
      const expected: Array<[number, number]> = [];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          if (row === 1 && col === 1) continue;
          expected.push([col * W, row * H]);
        }
      }

      const calls = ctxMock.drawImage.mock.calls as Array<[unknown, number, number]>;
      const actualOffsets = calls.map(([, x, y]) => [x, y] as [number, number]);

      for (const [expectedX, expectedY] of expected) {
        expect(actualOffsets).toContainEqual([expectedX, expectedY]);
      }
      expect(actualOffsets).toHaveLength(8);
    });
  });

  describe('paintTiles with null refs', () => {
    it('does not throw when committedCanvasRef.current is null', () => {
      const nullRef = createRef<HTMLCanvasElement | null>();
      // current is null by default on createRef
      const { result } = mount({ enabled: true, committedRef: nullRef });
      const tilingCanvas = document.createElement('canvas');
      (result.current.tilingCanvasRef as { current: HTMLCanvasElement | null }).current =
        tilingCanvas;

      expect(() => {
        act(() => { result.current.paintTiles(); });
      }).not.toThrow();
      expect(ctxMock.drawImage).not.toHaveBeenCalled();
    });

    it('does not throw when tilingCanvasRef.current is null', () => {
      const { result } = mount({ enabled: true });
      // tilingCanvasRef starts as null from useRef — do not attach anything.

      expect(() => {
        act(() => { result.current.paintTiles(); });
      }).not.toThrow();
      expect(ctxMock.drawImage).not.toHaveBeenCalled();
    });
  });

  describe('disabled → enabled transition', () => {
    it('does not fire the clear effect when transitioning to enabled', () => {
      const { result, rerender } = mount({ enabled: false });
      const tilingCanvas = document.createElement('canvas');
      (result.current.tilingCanvasRef as { current: HTMLCanvasElement | null }).current =
        tilingCanvas;

      // Flush any effects from the initial disabled render.
      ctxMock.clearRect.mockClear();

      // Transition to enabled — clearRect should NOT fire (the effect only
      // runs when enabled is false).
      rerender({ enabled: true });

      // Only paintTiles would call clearRect; the effect returning early
      // means it won't. No paintTiles call here.
      expect(ctxMock.clearRect).not.toHaveBeenCalled();
    });
  });

  describe('enabled=false effect clears the tiling canvas', () => {
    it('calls clearRect when transitioning from enabled to disabled with a canvas attached', () => {
      // Start enabled so the canvas is "live".
      const { result, rerender } = mount({ enabled: true });

      // Attach a real canvas to the tiling ref so the effect has something to clear.
      const tilingCanvas = document.createElement('canvas');
      tilingCanvas.width = 24;
      tilingCanvas.height = 18;
      (result.current.tilingCanvasRef as { current: HTMLCanvasElement | null }).current =
        tilingCanvas;

      // Flush any in-flight effects from the enabled render.
      act(() => {});
      ctxMock.clearRect.mockClear();

      // Transition to disabled — the useEffect should fire and clear the canvas.
      rerender({ enabled: false });

      expect(ctxMock.clearRect).toHaveBeenCalledTimes(1);
    });
  });
});
