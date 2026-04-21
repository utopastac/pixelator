/**
 * Tests for `useViewport` — zoom/pan math. jsdom has no `ResizeObserver`, so
 * we stub it. The hook seeds container size once on mount via
 * `getBoundingClientRect`; we spy on that to control the simulated viewport.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { useViewport } from './useViewport';

class MockResizeObserver {
  cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * Mount the hook with a real <div> as the container and a stubbed bounding
 * rect. Returns the renderHook result plus the container element for any
 * follow-up tweaks.
 */
function mount(opts: {
  width: number;
  height: number;
  containerW?: number;
  containerH?: number;
}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const rect = {
    width: opts.containerW ?? 800,
    height: opts.containerH ?? 600,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: opts.containerW ?? 800,
    bottom: opts.containerH ?? 600,
    toJSON: () => ({}),
  } as DOMRect;
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(rect);
  const ref = createRef<HTMLDivElement>();
  (ref as { current: HTMLDivElement | null }).current = container;
  const hook = renderHook(() =>
    useViewport({ width: opts.width, height: opts.height, containerRef: ref }),
  );
  return { ...hook, container };
}

describe('useViewport', () => {
  it('fit() computes integer zoom that fits the canvas inside the container minus padding, and centres the pan', () => {
    // 8×8 canvas, 800×600 container. Padding is 16 each side → avail 768×568.
    // Floor(min(96, 71)) = 71 → clamped to MAX 64.
    const { result } = mount({ width: 8, height: 8 });
    act(() => result.current.fit());
    expect(result.current.zoom).toBe(64);
    expect(result.current.panX).toBe(Math.round((800 - 8 * 64) / 2));
    expect(result.current.panY).toBe(Math.round((600 - 8 * 64) / 2));
    expect(result.current.isAutoFit).toBe(true);
  });

  it('fit() yields an integer zoom floor for non-exact fits', () => {
    // 100×100 canvas, 800×600 container → avail 768×568. 568/100 = 5.68, floor = 5.
    const { result } = mount({ width: 100, height: 100 });
    act(() => result.current.fit());
    expect(result.current.zoom).toBe(5);
  });

  it('setZoom clamps to [1, 64]', () => {
    const { result } = mount({ width: 16, height: 16 });
    act(() => result.current.setZoom(0.1));
    expect(result.current.zoom).toBe(1);
    act(() => result.current.setZoom(9999));
    expect(result.current.zoom).toBe(64);
    act(() => result.current.setZoom(8));
    expect(result.current.zoom).toBe(8);
  });

  it('setZoom disables auto-fit', () => {
    const { result } = mount({ width: 16, height: 16 });
    expect(result.current.isAutoFit).toBe(true);
    act(() => result.current.setZoom(4));
    expect(result.current.isAutoFit).toBe(false);
  });

  it('setZoom centres the canvas in the container', () => {
    const { result } = mount({ width: 16, height: 16, containerW: 800, containerH: 600 });
    act(() => result.current.setZoom(10));
    // Expected centre: (800 - 160)/2 = 320; (600 - 160)/2 = 220.
    expect(result.current.panX).toBe(320);
    expect(result.current.panY).toBe(220);
  });

  it('zoomAtPoint keeps the screen point anchored under the cursor', () => {
    const { result } = mount({ width: 32, height: 32 });
    // Start from a known state.
    act(() => result.current.setZoom(4));
    const { panX, panY, zoom } = result.current;
    const sx = 400;
    const sy = 300;
    const newZoom = 8;
    act(() => result.current.zoomAtPoint(newZoom, sx, sy));
    // Forward transform: screen = pan + world * zoom. For the invariant to hold
    // the world point (sx - pan)/zoom must map back to the same screen point at
    // the new zoom. `clampPan` may adjust slightly — verify the formula pre-clamp.
    const worldX = (sx - panX) / zoom;
    const worldY = (sy - panY) / zoom;
    const expectedRawX = sx - worldX * newZoom;
    const expectedRawY = sy - worldY * newZoom;
    // With an 800×600 container and a 32×32 canvas at zoom 8 (= 256 px), the
    // clamp bounds are wide enough that the anchored pan is not clamped.
    expect(result.current.panX).toBe(expectedRawX);
    expect(result.current.panY).toBe(expectedRawY);
    expect(result.current.zoom).toBe(8);
    expect(result.current.isAutoFit).toBe(false);
  });

  it('zoomAtPoint is a no-op (value-wise) when the clamped target equals the current zoom, and still flips autoFit off', () => {
    const { result } = mount({ width: 16, height: 16 });
    act(() => result.current.setZoom(10));
    const prevPanX = result.current.panX;
    const prevPanY = result.current.panY;
    // Ask to go to the same zoom → should exit early without moving the pan.
    act(() => result.current.zoomAtPoint(10, 100, 100));
    expect(result.current.zoom).toBe(10);
    expect(result.current.panX).toBe(prevPanX);
    expect(result.current.panY).toBe(prevPanY);
    expect(result.current.isAutoFit).toBe(false);
  });

  it('panBy translates the pan and disables auto-fit', () => {
    const { result } = mount({ width: 16, height: 16 });
    act(() => result.current.setZoom(4)); // centres pan, autoFit=false
    const startX = result.current.panX;
    const startY = result.current.panY;
    act(() => result.current.panBy(10, -5));
    expect(result.current.panX).toBe(startX + 10);
    expect(result.current.panY).toBe(startY - 5);
    expect(result.current.isAutoFit).toBe(false);
  });

  it('panBy clamps so at least half of the canvas stays inside the container', () => {
    // 16×16 canvas @ zoom=10 → 160×160 CSS px. halfW=80.
    // minX = 80 - 160 = -80;  maxX = 800 - 80 = 720.
    const { result } = mount({ width: 16, height: 16, containerW: 800, containerH: 600 });
    act(() => result.current.setZoom(10));
    act(() => result.current.panBy(-10_000, 0));
    expect(result.current.panX).toBe(-80);
    act(() => result.current.panBy(20_000, 0));
    expect(result.current.panX).toBe(720);
  });

  it('fit() flips isAutoFit back to true after it has been cleared', () => {
    const { result } = mount({ width: 16, height: 16 });
    act(() => result.current.setZoom(8));
    expect(result.current.isAutoFit).toBe(false);
    act(() => result.current.fit());
    expect(result.current.isAutoFit).toBe(true);
  });

  it('setIsPanning toggles the flag', () => {
    const { result } = mount({ width: 8, height: 8 });
    expect(result.current.isPanning).toBe(false);
    act(() => result.current.setIsPanning(true));
    expect(result.current.isPanning).toBe(true);
    act(() => result.current.setIsPanning(false));
    expect(result.current.isPanning).toBe(false);
  });
});
