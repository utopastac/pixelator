import { useEffect, useRef, type RefObject } from 'react';
import { drawGridOverlay } from '../lib/pixelArtCanvas';

export interface UseGridCanvasDrawArgs {
  gridCanvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  /** When false, the grid canvas is cleared regardless of zoom. */
  visible: boolean;
  zoom: number;
  panX: number;
  panY: number;
  width: number;
  height: number;
}

function resizeAndPaint(
  canvas: HTMLCanvasElement,
  cw: number,
  ch: number,
  params: {
    visible: boolean;
    zoom: number;
    panX: number;
    panY: number;
    width: number;
    height: number;
  },
): void {
  const w = Math.max(1, Math.floor(cw));
  const h = Math.max(1, Math.floor(ch));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  if (!params.visible || params.zoom < 4) {
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  const { zoom, panX, panY, width, height } = params;
  drawGridOverlay(canvas, { zoom, panX, panY, width, height });
}

/**
 * Manages the grid overlay canvas: keeps its raster size in sync with the
 * container via ResizeObserver, and redraws the cell grid in screen space
 * whenever viewport or grid dimensions change.
 *
 * **Important:** assigning `canvas.width` / `canvas.height` clears the bitmap.
 * Every resize (including the ResizeObserver callback) must be followed by a
 * fresh paint — otherwise the grid stays blank after layout (common on Safari
 * when the first paint used a 1×1 fallback before the real size arrived).
 */
export function useGridCanvasDraw({
  gridCanvasRef,
  containerRef,
  visible,
  zoom,
  panX,
  panY,
  width,
  height,
}: UseGridCanvasDrawArgs): void {
  const paramsRef = useRef({ visible, zoom, panX, panY, width, height });
  paramsRef.current = { visible, zoom, panX, panY, width, height };

  useEffect(() => {
    const container = containerRef.current;
    const canvas = gridCanvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: cw, height: ch } = entry.contentRect;
        resizeAndPaint(canvas, cw, ch, paramsRef.current);
      }
    });

    observer.observe(container);

    const rect = container.getBoundingClientRect();
    resizeAndPaint(canvas, rect.width, rect.height, paramsRef.current);

    return () => observer.disconnect();
  }, [containerRef, gridCanvasRef]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = gridCanvasRef.current;
    if (!container || !canvas) return;
    const rect = container.getBoundingClientRect();
    resizeAndPaint(canvas, rect.width, rect.height, paramsRef.current);
  }, [gridCanvasRef, visible, zoom, panX, panY, width, height]);
}
