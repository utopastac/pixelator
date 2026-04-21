import { useCallback, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { pixelsInsidePolygon } from '../lib/pixelArtGeometry';
import type { PixelArtSelection } from '../lib/pixelArtUtils';

export function buildPolygonSelection(
  anchors: Array<[number, number]>,
  width: number,
  height: number,
): { shape: 'cells'; cells: Set<number>; x1: number; y1: number; x2: number; y2: number } | null {
  if (anchors.length < 3) return null;
  const cells = pixelsInsidePolygon(anchors, width, height);
  if (cells.size === 0) return null;
  let mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity;
  for (const idx of cells) {
    const c = idx % width, r = Math.floor(idx / width);
    if (c < mnX) mnX = c; if (c > mxX) mxX = c;
    if (r < mnY) mnY = r; if (r > mxY) mxY = r;
  }
  return { shape: 'cells', cells, x1: mnX, y1: mnY, x2: mxX, y2: mxY };
}

export interface PolygonSelectContext {
  anchors: React.MutableRefObject<Array<[number, number]>>;
  cursor: [number, number] | null;
  setCursor: React.Dispatch<React.SetStateAction<[number, number] | null>>;
  dblClickPending: React.MutableRefObject<boolean>;
  commit: () => void;
  cancel: () => void;
}

export interface UsePolygonSelectToolParams {
  width: number;
  height: number;
  setSelection: React.Dispatch<React.SetStateAction<PixelArtSelection | null>>;
}

export function usePolygonSelectTool({
  width,
  height,
  setSelection,
}: UsePolygonSelectToolParams): { context: PolygonSelectContext } {
  const anchors = useRef<Array<[number, number]>>([]);
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const dblClickPending = useRef(false);

  const cancel = useCallback(() => {
    anchors.current = [];
    setCursor(null);
  }, []);

  const commit = useCallback(() => {
    if (anchors.current.length < 3) {
      anchors.current = [];
      setCursor(null);
      return;
    }
    const result = buildPolygonSelection(anchors.current, width, height);
    setSelection(result ?? null);
    anchors.current = [];
    setCursor(null);
  }, [width, height, setSelection]);

  const context = useMemo<PolygonSelectContext>(
    () => ({ anchors, cursor, setCursor, dblClickPending, commit, cancel }),
    [cursor, commit, cancel],
  );

  return { context };
}
