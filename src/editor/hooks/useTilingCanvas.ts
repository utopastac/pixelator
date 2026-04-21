import { useRef, useCallback, useEffect } from 'react';
import type React from 'react';

interface UseTilingCanvasProps {
  committedCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  width: number;
  height: number;
  enabled: boolean;
}

export function useTilingCanvas({
  committedCanvasRef,
  width,
  height,
  enabled,
}: UseTilingCanvasProps): {
  tilingCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  paintTiles: () => void;
} {
  const tilingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const paintTiles = useCallback(() => {
    const src = committedCanvasRef.current;
    const dst = tilingCanvasRef.current;
    if (!enabled || !src || !dst) return;

    const targetW = width * 3;
    const targetH = height * 3;
    if (dst.width !== targetW) dst.width = targetW;
    if (dst.height !== targetH) dst.height = targetH;

    const ctx = dst.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, targetW, targetH);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (row === 1 && col === 1) continue; // centre slot = the live committed canvas
        ctx.drawImage(src, col * width, row * height);
      }
    }
  }, [committedCanvasRef, width, height, enabled]);

  // Clear when disabled
  useEffect(() => {
    if (enabled) return;
    const dst = tilingCanvasRef.current;
    if (!dst) return;
    const ctx = dst.getContext('2d');
    ctx?.clearRect(0, 0, dst.width, dst.height);
  }, [enabled]);

  return { tilingCanvasRef, paintTiles };
}
