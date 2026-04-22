import { useCallback, useRef, type MutableRefObject } from 'react';

type TouchPoint = { clientX: number; clientY: number };

export interface UseMobileTwoFingerViewportArgs {
  isMobile: boolean;
  disabled: boolean;
  zoom: number;
  panBy: (dx: number, dy: number) => void;
  zoomAtPoint: (newZoom: number, screenX: number, screenY: number) => void;
  handlePointerCancel: () => void;
  panDragRef: MutableRefObject<{ lastX: number; lastY: number } | null>;
  setIsActivelyPanning: (v: boolean) => void;
}

export interface UseMobileTwoFingerViewportResult {
  /** Merge latest coords for this pointer id (call from pointermove). */
  trackTouchPoint: (pointerId: number, clientX: number, clientY: number) => void;
  /** Register touch pointer; when the second touch lands, cancels drawing and arms pinch/pan. */
  onTouchPointerDown: (
    e: React.PointerEvent<HTMLDivElement>,
  ) => { consumed: boolean; shouldPreventDefault?: boolean };
  /** Apply two-finger pan + pinch when armed; returns true if event was consumed. */
  onTouchPointerMove: (e: React.PointerEvent<HTMLDivElement>) => boolean;
  /** Remove touch; clears pinch state when fewer than two touches remain. */
  onTouchPointerUpOrCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
}

/**
 * Two-finger pan and pinch-zoom on the editor canvas (mobile `touch` pointers
 * only). When a second finger lands, in-flight drawing is cancelled via
 * `handlePointerCancel`, then centroid motion pans and finger separation
 * scales zoom around the pinch centroid.
 *
 * Touch streams fire at high frequency; updates are coalesced to one
 * `panBy` / `zoomAtPoint` flush per animation frame (same idea as
 * `useCanvasWheelZoom`) so React is not re-rendered on every pointer event.
 */
export function useMobileTwoFingerViewport({
  isMobile,
  disabled,
  zoom,
  panBy,
  zoomAtPoint,
  handlePointerCancel,
  panDragRef,
  setIsActivelyPanning,
}: UseMobileTwoFingerViewportArgs): UseMobileTwoFingerViewportResult {
  const touchPointsRef = useRef(new Map<number, TouchPoint>());
  const pinchActiveRef = useRef(false);
  const pinchLastRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);

  const latestRef = useRef({ zoom, panBy, zoomAtPoint });
  latestRef.current = { zoom, panBy, zoomAtPoint };

  const rafIdRef = useRef<number | null>(null);
  const pendingPanRef = useRef({ dx: 0, dy: 0 });
  const pendingZoomRef = useRef({ factor: 1, ax: 0, ay: 0 });

  const applyPending = useCallback(() => {
    const { zoom: z, panBy: pb, zoomAtPoint: zap } = latestRef.current;
    const p = pendingPanRef.current;
    if (p.dx !== 0 || p.dy !== 0) {
      pb(p.dx, p.dy);
      pendingPanRef.current = { dx: 0, dy: 0 };
    }
    const q = pendingZoomRef.current;
    if (q.factor !== 1) {
      zap(z * q.factor, q.ax, q.ay);
      pendingZoomRef.current = { factor: 1, ax: 0, ay: 0 };
    }
  }, []);

  const flush = useCallback(() => {
    rafIdRef.current = null;
    applyPending();
  }, [applyPending]);

  const scheduleFlush = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(flush);
  }, [flush]);

  const cancelScheduledFlush = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const trackTouchPoint = useCallback((pointerId: number, clientX: number, clientY: number) => {
    if (!touchPointsRef.current.has(pointerId)) return;
    touchPointsRef.current.set(pointerId, { clientX, clientY });
  }, []);

  const onTouchPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isMobile || disabled || e.pointerType !== 'touch') {
        return { consumed: false };
      }
      touchPointsRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
      if (touchPointsRef.current.size === 2) {
        pinchActiveRef.current = true;
        pinchLastRef.current = null;
        handlePointerCancel();
        if (panDragRef.current) {
          panDragRef.current = null;
          setIsActivelyPanning(false);
        }
        const pts = [...touchPointsRef.current.values()];
        const a = pts[0]!;
        const b = pts[1]!;
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const cx = (a.clientX + b.clientX) / 2;
        const cy = (a.clientY + b.clientY) / 2;
        pinchLastRef.current = { dist, cx, cy };
        return { consumed: true, shouldPreventDefault: true };
      }
      return { consumed: false };
    },
    [disabled, handlePointerCancel, isMobile, panDragRef, setIsActivelyPanning],
  );

  const onTouchPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isMobile || disabled || !pinchActiveRef.current || touchPointsRef.current.size < 2) {
        return false;
      }
      if (e.pointerType !== 'touch' || !touchPointsRef.current.has(e.pointerId)) {
        return false;
      }
      touchPointsRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
      const pts = [...touchPointsRef.current.values()];
      const a = pts[0]!;
      const b = pts[1]!;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const cx = (a.clientX + b.clientX) / 2;
      const cy = (a.clientY + b.clientY) / 2;
      const rect = e.currentTarget.getBoundingClientRect();
      const anchorX = cx - rect.left;
      const anchorY = cy - rect.top;
      const last = pinchLastRef.current;
      if (last && dist > 6 && last.dist > 6) {
        pendingPanRef.current.dx += cx - last.cx;
        pendingPanRef.current.dy += cy - last.cy;
        const ratio = dist / last.dist;
        if (Math.abs(ratio - 1) > 0.006) {
          const clamped = Math.min(1.2, Math.max(1 / 1.2, ratio));
          pendingZoomRef.current.factor *= clamped;
          pendingZoomRef.current.ax = anchorX;
          pendingZoomRef.current.ay = anchorY;
        }
        scheduleFlush();
      }
      pinchLastRef.current = { dist, cx, cy };
      return true;
    },
    [disabled, isMobile, scheduleFlush],
  );

  const onTouchPointerUpOrCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isMobile || e.pointerType !== 'touch') return;
      cancelScheduledFlush();
      applyPending();
      touchPointsRef.current.delete(e.pointerId);
      if (touchPointsRef.current.size < 2) {
        pinchActiveRef.current = false;
        pinchLastRef.current = null;
      }
    },
    [applyPending, cancelScheduledFlush, isMobile],
  );

  return {
    trackTouchPoint,
    onTouchPointerDown,
    onTouchPointerMove,
    onTouchPointerUpOrCancel,
  };
}
