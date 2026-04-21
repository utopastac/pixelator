import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

export interface UseViewportArgs {
  /** Grid columns (logical pixels wide). */
  width: number;
  /** Grid rows (logical pixels tall). */
  height: number;
  /** Ref to the element whose content size defines the viewport. */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export interface UseViewportReturn {
  /** Integer (or float) scale factor, 1 = one CSS pixel per logical pixel. */
  zoom: number;
  /** CSS pixel pan offset. */
  panX: number;
  panY: number;
  /** Recentre + scale to fit container; re-enables auto-fit. */
  fit: () => void;
  /** Set zoom to an exact value and centre. Disables auto-fit. */
  setZoom: (z: number) => void;
  /** Zoom such that the given screen point (relative to the container) stays under the cursor. */
  zoomAtPoint: (newZoom: number, screenX: number, screenY: number) => void;
  /** Relative pan delta in CSS pixels. Disables auto-fit. */
  panBy: (dx: number, dy: number) => void;
  /** True when sizing is currently driven by the container-fit algorithm. */
  isAutoFit: boolean;
  /** True while the user has space held or is actively panning. */
  isPanning: boolean;
  setIsPanning: (b: boolean) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 64;
const FIT_PADDING = 16;

function clampZoom(z: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

/**
 * Manages zoom and pan for the canvas viewport. Installs a ResizeObserver on
 * `containerRef` and re-fits the canvas whenever the container resizes while
 * auto-fit is active. Auto-fit is disabled whenever the user explicitly sets
 * zoom or pans, and re-enabled by calling `fit()`.
 */
export function useViewport({ width, height, containerRef }: UseViewportArgs): UseViewportReturn {
  const [zoom, setZoomState] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [autoFit, setAutoFit] = useState<boolean>(true);
  const [isPanning, setIsPanning] = useState<boolean>(false);

  // Track latest container size without re-running effects on every pan/zoom.
  const containerSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  // Clamp pan so that at least half of the canvas (in CSS px) stays inside the
  // container. The canvas CSS size is width*zoom × height*zoom.
  const clampPan = useCallback(
    (x: number, y: number, z: number) => {
      const { w: cw, h: ch } = containerSize.current;
      if (cw <= 0 || ch <= 0) return { x, y };
      const canvasW = width * z;
      const canvasH = height * z;
      const halfW = canvasW / 2;
      const halfH = canvasH / 2;
      // Keep at least half the canvas visible: that means the canvas's right edge
      // must be at least halfW beyond the container's left edge, and the canvas's
      // left edge must be at least halfW before the container's right edge.
      const minX = halfW - canvasW; // right edge = panX + canvasW >= halfW  =>  panX >= halfW - canvasW
      const maxX = cw - halfW;
      const minY = halfH - canvasH;
      const maxY = ch - halfH;
      return {
        x: Math.max(minX, Math.min(maxX, x)),
        y: Math.max(minY, Math.min(maxY, y)),
      };
    },
    [width, height],
  );

  const centrePan = useCallback(
    (z: number) => {
      const { w: cw, h: ch } = containerSize.current;
      return {
        x: Math.round((cw - width * z) / 2),
        y: Math.round((ch - height * z) / 2),
      };
    },
    [width, height],
  );

  const fit = useCallback(() => {
    const { w: cw, h: ch } = containerSize.current;
    if (cw <= 0 || ch <= 0) {
      setAutoFit(true);
      return;
    }
    const availW = Math.max(1, cw - FIT_PADDING * 2);
    const availH = Math.max(1, ch - FIT_PADDING * 2);
    const rawZoom = Math.min(availW / width, availH / height);
    const nextZoom = clampZoom(Math.max(1, Math.floor(rawZoom)));
    const { x, y } = centrePan(nextZoom);
    setZoomState(nextZoom);
    setPanX(x);
    setPanY(y);
    setAutoFit(true);
  }, [width, height, centrePan]);

  const setZoom = useCallback(
    (z: number) => {
      const next = clampZoom(z);
      setZoomState(next);
      const { x, y } = centrePan(next);
      setPanX(x);
      setPanY(y);
      setAutoFit(false);
    },
    [centrePan],
  );

  const zoomAtPoint = useCallback(
    (newZoom: number, screenX: number, screenY: number) => {
      const clamped = clampZoom(newZoom);
      if (clamped === zoom) {
        setAutoFit(false);
        return;
      }
      const rawX = screenX - (screenX - panX) * (clamped / zoom);
      const rawY = screenY - (screenY - panY) * (clamped / zoom);
      const { x, y } = clampPan(rawX, rawY, clamped);
      setZoomState(clamped);
      setPanX(x);
      setPanY(y);
      setAutoFit(false);
    },
    [clampPan, zoom, panX, panY],
  );

  const panBy = useCallback(
    (dx: number, dy: number) => {
      const { x, y } = clampPan(panX + dx, panY + dy, zoom);
      setPanX(x);
      setPanY(y);
      setAutoFit(false);
    },
    [clampPan, zoom, panX, panY],
  );

  // Observe container size and re-fit when autoFit is true.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerSize.current = {
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        };
      }
      // Always re-fit on size change when autoFit is on; otherwise leave zoom/pan alone.
      if (autoFit) {
        // Recompute fit inline to pick up the just-updated container size.
        const { w: cw, h: ch } = containerSize.current;
        if (cw > 0 && ch > 0) {
          const availW = Math.max(1, cw - FIT_PADDING * 2);
          const availH = Math.max(1, ch - FIT_PADDING * 2);
          const rawZoom = Math.min(availW / width, availH / height);
          const nextZoom = clampZoom(Math.max(1, Math.floor(rawZoom)));
          setZoomState(nextZoom);
          setPanX(Math.round((cw - width * nextZoom) / 2));
          setPanY(Math.round((ch - height * nextZoom) / 2));
        }
      }
    });
    observer.observe(el);
    // Seed the size immediately so the first fit() call (on mount) has a value.
    const rect = el.getBoundingClientRect();
    containerSize.current = { w: rect.width, h: rect.height };
    return () => observer.disconnect();
  }, [containerRef, autoFit, width, height]);

  // Re-run fit whenever the grid dimensions change (resize always re-centers).
  useEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  return {
    zoom,
    panX,
    panY,
    fit,
    setZoom,
    zoomAtPoint,
    panBy,
    isAutoFit: autoFit,
    isPanning,
    setIsPanning,
  };
}
