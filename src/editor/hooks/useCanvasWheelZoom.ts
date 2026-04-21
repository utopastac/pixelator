import { useEffect, useRef, type RefObject } from 'react';

export interface UseCanvasWheelZoomArgs {
  containerRef: RefObject<HTMLDivElement | null>;
  disabled: boolean;
  zoom: number;
  zoomAtPoint: (newZoom: number, screenX: number, screenY: number) => void;
  panBy: (dx: number, dy: number) => void;
  /** `exp(-deltaY * sensitivity)` factor per wheel tick. Lower = slower. */
  sensitivity: number;
}

/**
 * Installs a wheel listener on `containerRef`:
 *   - Cmd/Ctrl+wheel (and trackpad pinch, which browsers emit as ctrl+wheel)
 *     zooms around the cursor using an exponential factor.
 *   - Plain wheel pans the viewport.
 * Both paths call preventDefault so the host page never scrolls.
 *
 * Trackpad scroll/pinch fires wheel events at ~120Hz. Each event used to
 * trigger its own setState → full editor re-render, which queued faster than
 * React could flush on files with 10+ layers. Events are now coalesced into
 * a single update per animation frame: we accumulate zoom factor and pan
 * delta in refs and flush them in one `zoomAtPoint`/`panBy` call per rAF.
 */
export function useCanvasWheelZoom({
  containerRef,
  disabled,
  zoom,
  zoomAtPoint,
  panBy,
  sensitivity,
}: UseCanvasWheelZoomArgs) {
  // Keep latest setters/state in a ref so the wheel listener doesn't need to
  // be re-bound every time `zoom` changes (which it does on every frame).
  const latestRef = useRef({ zoom, zoomAtPoint, panBy });
  latestRef.current = { zoom, zoomAtPoint, panBy };

  useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled) return;

    let rafId: number | null = null;
    // Pending zoom is accumulated as a multiplicative factor so multiple
    // wheel events in one frame compose exactly like sequential calls would.
    let pendingZoomFactor = 1;
    let pendingZoomX = 0;
    let pendingZoomY = 0;
    let pendingPanDx = 0;
    let pendingPanDy = 0;

    const flush = () => {
      rafId = null;
      const { zoom: z, zoomAtPoint: zap, panBy: pb } = latestRef.current;
      if (pendingZoomFactor !== 1) {
        zap(z * pendingZoomFactor, pendingZoomX, pendingZoomY);
        pendingZoomFactor = 1;
      }
      if (pendingPanDx !== 0 || pendingPanDy !== 0) {
        pb(pendingPanDx, pendingPanDy);
        pendingPanDx = 0;
        pendingPanDy = 0;
      }
    };

    const schedule = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(flush);
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = container.getBoundingClientRect();
        pendingZoomFactor *= Math.exp(-e.deltaY * sensitivity);
        pendingZoomX = e.clientX - rect.left;
        pendingZoomY = e.clientY - rect.top;
        schedule();
        return;
      }
      if (e.deltaX !== 0 || e.deltaY !== 0) {
        e.preventDefault();
        pendingPanDx += -e.deltaX;
        pendingPanDy += -e.deltaY;
        schedule();
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', onWheel);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [containerRef, disabled, sensitivity]);
}
