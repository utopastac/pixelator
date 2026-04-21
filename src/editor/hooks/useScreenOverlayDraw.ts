import { useEffect, type MutableRefObject, type RefObject } from 'react';
import { drawScreenOverlay, type TransformBoxOverlay } from '../lib/pixelArtCanvas';
import type { PixelArtSelection } from '../lib/pixelArtUtils';
import type { PixelArtTool } from '../PixelArtEditor';

export interface UseScreenOverlayDrawArgs {
  overlayCanvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  selection: PixelArtSelection | null;
  marchingAntsOffset: number;
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
 */
export function useScreenOverlayDraw({
  overlayCanvasRef,
  containerRef,
  selection,
  marchingAntsOffset,
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
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    drawScreenOverlay(canvas, {
      selection,
      anchors: activeTool === 'pen' ? penAnchors.current : [],
      polygonAnchors: activeTool === 'marquee' && marqueeShape === 'polygon' ? polygonSelectAnchors.current : [],
      polygonCursor: activeTool === 'marquee' && marqueeShape === 'polygon' ? polygonSelectCursor : null,
      gridWidth,
      zoom,
      panX,
      panY,
      marchingAntsOffset,
      transformBox,
    });
    void penCursor;
  }, [
    overlayCanvasRef, selection, marchingAntsOffset, activeTool, marqueeShape, penCursor, polygonSelectCursor,
    zoom, panX, panY, gridWidth, penAnchors, polygonSelectAnchors, transformBox,
  ]);
}
