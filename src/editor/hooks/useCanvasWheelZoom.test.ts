/**
 * Tests for `useCanvasWheelZoom` — the rAF-coalesced wheel-to-zoom/pan
 * dispatcher installed on the editor's container. Exercises the Cmd/Ctrl
 * zoom path, the plain pan path, and the cleanup on unmount.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCanvasWheelZoom } from './useCanvasWheelZoom';

function fireWheel(
  container: HTMLElement,
  init: { deltaX?: number; deltaY?: number; ctrlKey?: boolean; metaKey?: boolean; clientX?: number; clientY?: number },
) {
  // Construct a real WheelEvent. jsdom implements it; we set preventDefault
  // to a no-op by default, but the hook calls it and we don't care about the
  // return value for the test — we just check the callbacks.
  const event = new WheelEvent('wheel', {
    deltaX: init.deltaX ?? 0,
    deltaY: init.deltaY ?? 0,
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    bubbles: true,
    cancelable: true,
  });
  container.dispatchEvent(event);
}

/**
 * Manual rAF shim — captures every scheduled callback in a queue so the test
 * can flush them deterministically. Vitest's fake-timers don't cover rAF
 * cleanly, so we patch `requestAnimationFrame`/`cancelAnimationFrame`
 * directly.
 */
function installRafShim() {
  const queue: FrameRequestCallback[] = [];
  const origRaf = globalThis.requestAnimationFrame;
  const origCaf = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    queue.push(cb);
    return queue.length;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = (id: number) => {
    queue[id - 1] = () => {};
  };
  const flush = () => {
    const pending = queue.splice(0, queue.length);
    pending.forEach((cb) => cb(performance.now()));
  };
  const restore = () => {
    globalThis.requestAnimationFrame = origRaf;
    globalThis.cancelAnimationFrame = origCaf;
  };
  return { flush, restore, queue };
}

describe('useCanvasWheelZoom', () => {
  let container: HTMLDivElement;
  let raf: ReturnType<typeof installRafShim>;

  beforeEach(() => {
    container = document.createElement('div');
    // getBoundingClientRect needs meaningful dimensions; jsdom returns zero
    // by default. Stub just the read we use.
    container.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300,
      toJSON: () => ({}),
    });
    document.body.appendChild(container);
    raf = installRafShim();
  });

  afterEach(() => {
    raf.restore();
    document.body.removeChild(container);
  });

  function mount(opts?: { zoom?: number; sensitivity?: number; disabled?: boolean }) {
    const zoomAtPoint = vi.fn();
    const panBy = vi.fn();
    const containerRef = { current: container };
    const hook = renderHook(() =>
      useCanvasWheelZoom({
        containerRef,
        disabled: opts?.disabled ?? false,
        zoom: opts?.zoom ?? 1,
        zoomAtPoint,
        panBy,
        sensitivity: opts?.sensitivity ?? 0.01,
      }),
    );
    return { hook, zoomAtPoint, panBy };
  }

  it('cmd+wheel coalesces multiple events into a single zoomAtPoint call per rAF', () => {
    const { zoomAtPoint } = mount({ zoom: 2 });
    fireWheel(container, { deltaY: -100, metaKey: true, clientX: 100, clientY: 50 });
    fireWheel(container, { deltaY: -50, metaKey: true, clientX: 100, clientY: 50 });
    // No callback fires until rAF flushes.
    expect(zoomAtPoint).not.toHaveBeenCalled();
    raf.flush();
    expect(zoomAtPoint).toHaveBeenCalledTimes(1);
    // Factor = exp(-(-100)*0.01) * exp(-(-50)*0.01) = e^1 * e^0.5.
    const [nextZoom, x, y] = zoomAtPoint.mock.calls[0] as [number, number, number];
    expect(nextZoom).toBeCloseTo(2 * Math.exp(1) * Math.exp(0.5), 5);
    expect(x).toBe(100);
    expect(y).toBe(50);
  });

  it('ctrl+wheel (trackpad pinch) also routes to zoomAtPoint', () => {
    const { zoomAtPoint, panBy } = mount({ zoom: 1 });
    fireWheel(container, { deltaY: 10, ctrlKey: true, clientX: 0, clientY: 0 });
    raf.flush();
    expect(zoomAtPoint).toHaveBeenCalledTimes(1);
    expect(panBy).not.toHaveBeenCalled();
  });

  it('plain wheel coalesces deltaX/deltaY into a single panBy call per rAF', () => {
    const { zoomAtPoint, panBy } = mount();
    fireWheel(container, { deltaX: 10, deltaY: 20 });
    fireWheel(container, { deltaX: 5, deltaY: -5 });
    expect(panBy).not.toHaveBeenCalled();
    raf.flush();
    expect(panBy).toHaveBeenCalledTimes(1);
    // The hook pans by (-deltaX, -deltaY). Two events accumulate.
    expect(panBy).toHaveBeenCalledWith(-15, -15);
    expect(zoomAtPoint).not.toHaveBeenCalled();
  });

  it('second flush after a new event fires again (rAF resets after flush)', () => {
    const { panBy } = mount();
    fireWheel(container, { deltaY: 10 });
    raf.flush();
    fireWheel(container, { deltaY: 20 });
    raf.flush();
    expect(panBy).toHaveBeenCalledTimes(2);
    expect(panBy).toHaveBeenNthCalledWith(1, 0, -10);
    expect(panBy).toHaveBeenNthCalledWith(2, 0, -20);
  });

  it('unmount removes the listener and cancels any pending rAF', () => {
    const { hook, panBy } = mount();
    fireWheel(container, { deltaY: 10 });
    hook.unmount();
    // Remaining rAF callbacks should have been cancelled; even if they fire,
    // a new wheel event should not be picked up.
    raf.flush();
    fireWheel(container, { deltaY: 20 });
    raf.flush();
    expect(panBy).not.toHaveBeenCalled();
  });

  it('disabled=true skips the listener entirely', () => {
    const { zoomAtPoint, panBy } = mount({ disabled: true });
    fireWheel(container, { deltaY: 10 });
    fireWheel(container, { deltaY: 10, metaKey: true });
    raf.flush();
    expect(zoomAtPoint).not.toHaveBeenCalled();
    expect(panBy).not.toHaveBeenCalled();
  });
});
