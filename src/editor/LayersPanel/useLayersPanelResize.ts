import React, { useState } from 'react';

const MIN_WIDTH = 180;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 272;
const STORAGE_KEY = 'pixelator:layersPanelWidth';
const DRAG_THRESHOLD_PX = 4;

function clamp(w: number) {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w));
}

function loadWidth(): number {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = parseInt(stored, 10);
    if (!isNaN(parsed)) return clamp(parsed);
  }
  return DEFAULT_WIDTH;
}

interface UseLayersPanelResizeResult {
  width: number;
  isDragging: boolean;
  beginResize: (e: React.PointerEvent) => void;
}

export function useLayersPanelResize(): UseLayersPanelResizeResult {
  const [width, setWidth] = useState<number>(loadWidth);
  const [isDragging, setIsDragging] = useState(false);

  const beginResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    let activated = false;

    const onMove = (ev: PointerEvent) => {
      // Panel is right-anchored: moving left (negative clientX delta) expands width
      const dx = startX - ev.clientX;
      if (!activated && Math.abs(dx) >= DRAG_THRESHOLD_PX) {
        activated = true;
        setIsDragging(true);
      }
      if (activated) {
        setWidth(clamp(startWidth + dx));
      }
    };

    const onUp = (ev: PointerEvent) => {
      if (activated) {
        const finalWidth = clamp(startWidth + (startX - ev.clientX));
        setWidth(finalWidth);
        localStorage.setItem(STORAGE_KEY, String(finalWidth));
      }
      setIsDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return { width, isDragging, beginResize };
}
