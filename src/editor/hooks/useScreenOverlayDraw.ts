import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from 'react';
import { drawScreenOverlay, type TransformBoxOverlay } from '../lib/pixelArtCanvas';
import {
  MARCHING_ANTS_INTERVAL_MS,
  MARCHING_ANTS_STEPS,
  type PixelArtSelection,
} from '../lib/pixelArtUtils';
import type { PixelArtTool } from '../PixelArtEditor';

export interface UseScreenOverlayDrawArgs {
  overlayCanvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  selection: PixelArtSelection | null;
  activeTool: PixelArtTool;
  penAnchors: MutableRefObject<Array<[number, number]>>;
  /** Change-ticking dependency so the effect re-runs when an anchor is added
   *  or the hover cell moves. Value isn't read — only its identity matters. */
  penCursor: [number, number] | null;
  gridWidth: number;
  zoom: number;
  panX: number;
  panY: number;
  /** Optional Move-tool transform frame. When non-null, the overlay paints a
   *  tight-bbox rectangle + 8 scale/stretch handles + a rotate handle. */
  transformBox?: TransformBoxOverlay | null;
  polygonSelectAnchors: MutableRefObject<Array<[number, number]>>;
  polygonSelectCursor: [number, number] | null;
  marqueeShape: 'rect' | 'ellipse' | 'wand' | 'polygon';
}

/**
 * Owns the screen-space overlay canvas: keeps its raster size in sync with
 * the container (ResizeObserver), and redraws marching-ants + pen anchor
 * dots on top of the transformed canvas stack whenever any input changes.
 * Marching-ants dash offset advances on `requestAnimationFrame` (throttled to
 * `MARCHING_ANTS_INTERVAL_MS`) so the animation does not trigger React renders.
 */
export function useScreenOverlayDraw({
  overlayCanvasRef,
  containerRef,
  selection,
  activeTool,
  penAnchors,
  penCursor,
  gridWidth,
  zoom,
  panX,
  panY,
  transformBox,
  polygonSelectAnchors,
  polygonSelectCursor,
  marqueeShape,
}: UseScreenOverlayDrawArgs) {
  const antsOffsetRef = useRef(0);
  const paramsRef = useRef({
    selection,
    activeTool,
    penAnchors,
    penCursor,
    gridWidth,
    zoom,
    panX,
    panY,
    transformBox,
    polygonSelectAnchors,
    polygonSelectCursor,
    marqueeShape,
  });
  paramsRef.current = {
    selection,
    activeTool,
    penAnchors,
    penCursor,
    gridWidth,
    zoom,
    panX,
    panY,
    transformBox,
    polygonSelectAnchors,
    polygonSelectCursor,
    marqueeShape,
  };

  const paintOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const p = paramsRef.current;
    drawScreenOverlay(canvas, {
      selection: p.selection,
      anchors: p.activeTool === 'pen' ? p.penAnchors.current : [],
      polygonAnchors:
        p.activeTool === 'marquee' && p.marqueeShape === 'polygon'
          ? p.polygonSelectAnchors.current
          : [],
      polygonCursor:
        p.activeTool === 'marquee' && p.marqueeShape === 'polygon' ? p.polygonSelectCursor : null,
      gridWidth: p.gridWidth,
      zoom: p.zoom,
      panX: p.panX,
      panY: p.panY,
      marchingAntsOffset: antsOffsetRef.current,
      transformBox: p.transformBox,
    });
  }, [overlayCanvasRef]);
  // Keep raster size in sync with the container, in CSS pixels.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = overlayCanvasRef.current;
    if (!container || !canvas) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: cw, height: ch } = entry.contentRect;
        canvas.width = Math.max(1, Math.floor(cw));
        canvas.height = Math.max(1, Math.floor(ch));
      }
    });
    observer.observe(container);
    const rect = container.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width));
    canvas.height = Math.max(1, Math.floor(rect.height));
    return () => observer.disconnect();
  }, [containerRef, overlayCanvasRef]);

  // Redraw when any visual input changes. `penAnchors` is a ref — we read
  // `.current` at effect time and rely on `penCursor` state updates to make
  // the effect rerun when an anchor is added or the cursor moves.
  useEffect(() => {
    paintOverlay();
    void penCursor;
  }, [
    paintOverlay,
    selection,
    activeTool,
    marqueeShape,
    penCursor,
    polygonSelectCursor,
    zoom,
    panX,
    panY,
    gridWidth,
    penAnchors,
    polygonSelectAnchors,
    transformBox,
  ]);

  const hasSelection = selection != null;

  useEffect(() => {
    if (!hasSelection) {
      antsOffsetRef.current = 0;
      return;
    }

    let rafId = 0;
    /** `null` until the first visible frame anchors elapsed time. */
    let lastAdvance: number | null = null;

    const schedule = () => {
      if (rafId !== 0) return;
      rafId = requestAnimationFrame(loop);
    };

    const loop = (now: number) => {
      rafId = 0;
      if (document.visibilityState === 'hidden') return;

      if (lastAdvance === null) {
        lastAdvance = now;
      } else {
        while (now - lastAdvance >= MARCHING_ANTS_INTERVAL_MS) {
          lastAdvance += MARCHING_ANTS_INTERVAL_MS;
          antsOffsetRef.current = (antsOffsetRef.current + 1) % MARCHING_ANTS_STEPS;
          paintOverlay();
        }
      }
      schedule();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastAdvance = null;
        schedule();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    schedule();

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (rafId !== 0) cancelAnimationFrame(rafId);
    };
  }, [hasSelection, paintOverlay]);
}
