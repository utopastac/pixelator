import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { drawScreenOverlay } from '../lib/pixelArtCanvas';
import type { PixelArtSelection } from '../lib/pixelArtUtils';
import { useScreenOverlayDraw } from './useScreenOverlayDraw';

vi.mock('../lib/pixelArtCanvas', () => ({
  drawScreenOverlay: vi.fn(),
}));

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

const drawMock = vi.mocked(drawScreenOverlay);

/** Captures rAF callbacks so tests can flush them with explicit timestamps. */
function installRafShim() {
  const queue: FrameRequestCallback[] = [];
  const origRaf = globalThis.requestAnimationFrame;
  const origCaf = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    queue.push(cb);
    return queue.length;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = (id: number) => {
    if (id >= 1) queue[id - 1] = () => {};
  };
  const flush = (now: number) => {
    const pending = queue.splice(0, queue.length);
    pending.forEach((cb) => cb(now));
  };
  const restore = () => {
    globalThis.requestAnimationFrame = origRaf;
    globalThis.cancelAnimationFrame = origCaf;
  };
  return { flush, restore };
}

function makeProps() {
  const overlayCanvasRef = { current: {} as HTMLCanvasElement };
  const fakeContainer = {
    getBoundingClientRect: () => ({ width: 200, height: 150 }),
  } as unknown as HTMLDivElement;
  const containerRef = { current: fakeContainer };
  return {
    overlayCanvasRef,
    containerRef,
    selection: null as PixelArtSelection | null,
    activeTool: 'paint' as const,
    penAnchors: { current: [] as Array<[number, number]> },
    penCursor: null as [number, number] | null,
    polygonSelectAnchors: { current: [] as Array<[number, number]> },
    polygonSelectCursor: null as [number, number] | null,
    marqueeShape: 'rect' as const,
    gridWidth: 16,
    zoom: 20,
    panX: 0,
    panY: 0,
  };
}

beforeEach(() => {
  drawMock.mockClear();
});

describe('useScreenOverlayDraw', () => {
  it('calls drawScreenOverlay on initial render', () => {
    renderHook(() => useScreenOverlayDraw(makeProps()));
    expect(drawMock).toHaveBeenCalledTimes(1);
  });

  it('passes anchors: [] when activeTool is not pen, even if penAnchors.current is non-empty', () => {
    const props = makeProps();
    props.activeTool = 'paint' as const;
    props.penAnchors = { current: [[1, 2], [3, 4]] };

    renderHook(() => useScreenOverlayDraw(props));

    expect(drawMock).toHaveBeenCalledTimes(1);
    const params = drawMock.mock.calls[0][1];
    expect(params.anchors).toEqual([]);
  });

  it('passes penAnchors.current as anchors when activeTool is pen', () => {
    const props = makeProps();
    // Cast through unknown to avoid the narrow 'paint' const type
    (props as { activeTool: string }).activeTool = 'pen';
    props.penAnchors = { current: [[5, 6], [7, 8]] };

    renderHook(() => useScreenOverlayDraw(props));

    expect(drawMock).toHaveBeenCalledTimes(1);
    const params = drawMock.mock.calls[0][1];
    expect(params.anchors).toEqual([[5, 6], [7, 8]]);
  });

  describe('marching ants via requestAnimationFrame', () => {
    let raf: ReturnType<typeof installRafShim>;

    beforeEach(() => {
      raf = installRafShim();
    });

    afterEach(() => {
      raf.restore();
    });

    it('advances marchingAntsOffset on the overlay after the interval elapses', () => {
      const props = makeProps();
      props.selection = { shape: 'rect', x1: 0, y1: 0, x2: 1, y2: 1 };

      renderHook(() => useScreenOverlayDraw(props));

      expect(drawMock).toHaveBeenCalledTimes(1);
      expect(drawMock.mock.calls[0][1].marchingAntsOffset).toBe(0);

      raf.flush(0);
      expect(drawMock).toHaveBeenCalledTimes(1);

      raf.flush(80);
      expect(drawMock).toHaveBeenCalledTimes(2);
      expect(drawMock.mock.calls[1][1].marchingAntsOffset).toBe(1);
    });
  });

  it('forwards the selection object to drawScreenOverlay', () => {
    const selection = {
      x: 1,
      y: 2,
      width: 4,
      height: 4,
      pixels: null,
      floatingX: null,
      floatingY: null,
    } as unknown as import('../lib/pixelArtUtils').PixelArtSelection;

    const props = { ...makeProps(), selection };

    renderHook(() => useScreenOverlayDraw(props));

    expect(drawMock).toHaveBeenCalledTimes(1);
    const params = drawMock.mock.calls[0][1];
    expect(params.selection).toBe(selection);
  });

  it('passes polygonAnchors: [] when activeTool is not marquee+polygon, even if polygonSelectAnchors.current is non-empty', () => {
    const props = makeProps();
    props.activeTool = 'paint' as const;
    props.polygonSelectAnchors = { current: [[1, 2], [3, 4]] };

    renderHook(() => useScreenOverlayDraw(props));

    expect(drawMock).toHaveBeenCalledTimes(1);
    const params = drawMock.mock.calls[0][1];
    expect(params.polygonAnchors).toEqual([]);
  });

  it('passes polygonSelectAnchors.current as polygonAnchors when activeTool is marquee+polygon', () => {
    const props = makeProps();
    (props as { activeTool: string }).activeTool = 'marquee';
    (props as { marqueeShape: string }).marqueeShape = 'polygon';
    props.polygonSelectAnchors = { current: [[10, 20], [30, 40]] };

    renderHook(() => useScreenOverlayDraw(props));

    expect(drawMock).toHaveBeenCalledTimes(1);
    const params = drawMock.mock.calls[0][1];
    expect(params.polygonAnchors).toEqual([[10, 20], [30, 40]]);
  });

  it('re-runs drawScreenOverlay when polygonSelectCursor changes', () => {
    const props = makeProps();
    (props as { activeTool: string }).activeTool = 'marquee';
    (props as { marqueeShape: string }).marqueeShape = 'polygon';

    const { rerender } = renderHook(
      (p: Parameters<typeof useScreenOverlayDraw>[0]) => useScreenOverlayDraw(p),
      { initialProps: props },
    );

    expect(drawMock).toHaveBeenCalledTimes(1);

    rerender({ ...props, polygonSelectCursor: [5, 7] });

    expect(drawMock).toHaveBeenCalledTimes(2);
  });
});
