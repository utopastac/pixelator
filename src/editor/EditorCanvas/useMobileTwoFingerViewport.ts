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
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

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
        panBy(cx - last.cx, cy - last.cy);
        const ratio = dist / last.dist;
        if (Math.abs(ratio - 1) > 0.006) {
          const clamped = Math.min(1.2, Math.max(1 / 1.2, ratio));
          zoomAtPoint(zoomRef.current * clamped, anchorX, anchorY);
        }
      }
      pinchLastRef.current = { dist, cx, cy };
      return true;
    },
    [disabled, isMobile, panBy, zoomAtPoint],
  );

  const onTouchPointerUpOrCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobile || e.pointerType !== 'touch') return;
    touchPointsRef.current.delete(e.pointerId);
    if (touchPointsRef.current.size < 2) {
      pinchActiveRef.current = false;
      pinchLastRef.current = null;
    }
  }, [isMobile]);

  return {
    trackTouchPoint,
    onTouchPointerDown,
    onTouchPointerMove,
    onTouchPointerUpOrCancel,
  };
}
