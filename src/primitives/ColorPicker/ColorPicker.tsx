import React, { useRef, useEffect, useCallback, useMemo, useLayoutEffect, useState } from 'react';
import { useAppMobileOptional } from '@/AppMobileContext';
import { hsvToRgb } from '@/lib/colorUtils';
import styles from './ColorPicker.module.css';

interface ColorPickerProps {
  hue: number;
  saturation: number;
  brightness: number;
  onChange: (h: number, s: number, v: number) => void;
  /** Logical pixel width/height of the SV square when not using `fillWidth`. */
  size?: number;
  /** When true, SV square uses 100% of the parent width (see ResizeObserver). */
  fillWidth?: boolean;
  'data-testid'?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const HUE_BAR_HEIGHT_DESKTOP = 18;
const HUE_BAR_HEIGHT_MOBILE = 32;
const SV_CELLS = 20;
const HUE_CELLS = 24;

/** Fallback when `isMobile` but parent does not use `fillWidth` (tests / rare). */
const MOBILE_SPECTRUM_PX = 272;

const SPECTRUM_MIN = 160;
const SPECTRUM_MAX = 520;

/**
 * HSV colour picker: a saturation/brightness square plus a hue bar underneath.
 * Both canvases are drag-interactive. Colour state is fully controlled via
 * (hue, saturation, brightness) props; the parent decides how to convert
 * to/from hex (see `hsvToHex` / `hexToHsv` helpers in this module).
 *
 * Dragging uses **Pointer Events** on `document` (non-passive `pointermove`)
 * so touch drags work reliably; legacy mouse events alone miss `mousemove`
 * during many mobile touch gestures.
 */
const ColorPicker: React.FC<ColorPickerProps> = ({
  hue,
  saturation,
  brightness,
  onChange,
  size: sizeProp,
  fillWidth = false,
  'data-testid': dataTestId,
}) => {
  const isMobile = useAppMobileOptional()?.isMobile ?? false;
  const hueBarHeight = isMobile ? HUE_BAR_HEIGHT_MOBILE : HUE_BAR_HEIGHT_DESKTOP;

  const rootRef = useRef<HTMLDivElement>(null);
  const [measuredSpectrum, setMeasuredSpectrum] = useState<number | null>(null);

  const spectrumSize = useMemo(() => {
    if (sizeProp != null) return sizeProp;
    if (fillWidth) {
      if (measuredSpectrum != null && measuredSpectrum > 0) {
        return clamp(Math.floor(measuredSpectrum), SPECTRUM_MIN, SPECTRUM_MAX);
      }
      return 200;
    }
    return isMobile ? MOBILE_SPECTRUM_PX : 200;
  }, [sizeProp, fillWidth, measuredSpectrum, isMobile]);

  const svHeight = spectrumSize;

  const readSpectrumWidth = useCallback((el: HTMLElement) => {
    const inlineWidth = (node: HTMLElement | null) => {
      if (!node) return 0;
      const attr = node.getAttribute('style') ?? '';
      const m = /width\s*:\s*(\d+(?:\.\d+)?)px/i.exec(attr);
      if (!m) return 0;
      const parsed = parseFloat(m[1]);
      return Number.isFinite(parsed) ? Math.floor(parsed) : 0;
    };

    let node: HTMLElement | null = el;
    for (let depth = 0; depth < 5 && node; depth += 1) {
      const fromLayout = Math.floor(node.offsetWidth || node.getBoundingClientRect().width);
      if (fromLayout > 0) return fromLayout;
      const fromStyle = inlineWidth(node);
      if (fromStyle > 0) return fromStyle;
      node = node.parentElement;
    }
    return 0;
  }, []);

  useLayoutEffect(() => {
    if (!fillWidth || !rootRef.current) return;
    const w = readSpectrumWidth(rootRef.current);
    if (w > 0) setMeasuredSpectrum(w);
  }, [fillWidth, readSpectrumWidth]);

  useEffect(() => {
    if (!fillWidth || !rootRef.current || typeof ResizeObserver === 'undefined') return;
    const el = rootRef.current;
    const ro = new ResizeObserver(() => {
      const w = readSpectrumWidth(el);
      if (w > 0) setMeasuredSpectrum(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fillWidth, readSpectrumWidth]);

  const svCanvasRef = useRef<HTMLCanvasElement>(null);
  const hueCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef<'sv' | 'hue' | null>(null);

  const drawSV = useCallback(() => {
    const canvas = svCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = spectrumSize;
    canvas.width = size * dpr;
    canvas.height = svHeight * dpr;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    for (let cy = 0; cy < SV_CELLS; cy++) {
      const y0 = Math.round((cy * svHeight) / SV_CELLS);
      const y1 = Math.round(((cy + 1) * svHeight) / SV_CELLS);
      const v = 1 - (cy + 0.5) / SV_CELLS;
      for (let cx = 0; cx < SV_CELLS; cx++) {
        const x0 = Math.round((cx * size) / SV_CELLS);
        const x1 = Math.round(((cx + 1) * size) / SV_CELLS);
        const s = (cx + 0.5) / SV_CELLS;
        const [r, g, b] = hsvToRgb(hue / 360, s, v);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
    }

    const selCx = clamp(Math.floor(saturation * SV_CELLS), 0, SV_CELLS - 1);
    const selCy = clamp(Math.floor((1 - brightness) * SV_CELLS), 0, SV_CELLS - 1);
    const sx0 = Math.round((selCx * size) / SV_CELLS);
    const sx1 = Math.round(((selCx + 1) * size) / SV_CELLS);
    const sy0 = Math.round((selCy * svHeight) / SV_CELLS);
    const sy1 = Math.round(((selCy + 1) * svHeight) / SV_CELLS);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(sx0 + 0.5, sy0 + 0.5, sx1 - sx0 - 1, sy1 - sy0 - 1);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(sx0 + 0.5, sy0 + 0.5, sx1 - sx0 - 1, sy1 - sy0 - 1);
  }, [hue, saturation, brightness, spectrumSize, svHeight]);

  const drawHue = useCallback(() => {
    const canvas = hueCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = spectrumSize;
    canvas.width = size * dpr;
    canvas.height = hueBarHeight * dpr;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    for (let i = 0; i < HUE_CELLS; i++) {
      const x0 = Math.round((i * size) / HUE_CELLS);
      const x1 = Math.round(((i + 1) * size) / HUE_CELLS);
      const h = (i + 0.5) / HUE_CELLS;
      const [r, g, b] = hsvToRgb(h, 1, 1);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x0, 0, x1 - x0, hueBarHeight);
    }

    const selH = clamp(Math.floor((hue / 360) * HUE_CELLS), 0, HUE_CELLS - 1);
    const hx0 = Math.round((selH * size) / HUE_CELLS);
    const hx1 = Math.round(((selH + 1) * size) / HUE_CELLS);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(hx0 + 0.5, 0.5, hx1 - hx0 - 1, hueBarHeight - 1);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(hx0 + 0.5, 0.5, hx1 - hx0 - 1, hueBarHeight - 1);
  }, [hue, spectrumSize, hueBarHeight]);

  useEffect(() => {
    drawSV();
  }, [drawSV]);

  useEffect(() => {
    drawHue();
  }, [drawHue]);

  const handleSVInteraction = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = svCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const size = spectrumSize;
      const x = ((clientX - rect.left) / rect.width) * size;
      const y = ((clientY - rect.top) / rect.height) * svHeight;
      const s = clamp(x / size, 0, 1);
      const v = clamp(1 - y / svHeight, 0, 1);
      onChange(hue, parseFloat(s.toFixed(3)), parseFloat(v.toFixed(3)));
    },
    [spectrumSize, svHeight, hue, onChange],
  );

  const handleHueInteraction = useCallback(
    (clientX: number) => {
      const canvas = hueCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const size = spectrumSize;
      const x = ((clientX - rect.left) / rect.width) * size;
      const h = clamp((x / size) * 360, 0, 360);
      onChange(Math.round(h), saturation, brightness);
    },
    [spectrumSize, saturation, brightness, onChange],
  );

  const handleSVInteractionRef = useRef(handleSVInteraction);
  const handleHueInteractionRef = useRef(handleHueInteraction);
  useLayoutEffect(() => {
    handleSVInteractionRef.current = handleSVInteraction;
    handleHueInteractionRef.current = handleHueInteraction;
  }, [handleSVInteraction, handleHueInteraction]);

  const pointerOpts = useMemo(
    () => ({ capture: true, passive: false }) as const,
    [],
  );

  useEffect(() => {
    const svCanvas = svCanvasRef.current;
    const hueCanvas = hueCanvasRef.current;
    if (!svCanvas || !hueCanvas) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      e.preventDefault();
      e.stopPropagation();
      if (svCanvas.contains(e.target as Node)) {
        isDraggingRef.current = 'sv';
        try {
          svCanvas.setPointerCapture(e.pointerId);
        } catch {
          /* no-op: jsdom / older engines */
        }
        handleSVInteractionRef.current(e.clientX, e.clientY);
      } else if (hueCanvas.contains(e.target as Node)) {
        isDraggingRef.current = 'hue';
        try {
          hueCanvas.setPointerCapture(e.pointerId);
        } catch {
          /* no-op */
        }
        handleHueInteractionRef.current(e.clientX);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      if (isDraggingRef.current === 'sv') {
        e.preventDefault();
        handleSVInteractionRef.current(e.clientX, e.clientY);
      } else if (isDraggingRef.current === 'hue') {
        e.preventDefault();
        handleHueInteractionRef.current(e.clientX);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      if (isDraggingRef.current === 'sv' && svCanvas.hasPointerCapture?.(e.pointerId)) {
        try {
          svCanvas.releasePointerCapture(e.pointerId);
        } catch {
          /* no-op */
        }
      }
      if (isDraggingRef.current === 'hue' && hueCanvas.hasPointerCapture?.(e.pointerId)) {
        try {
          hueCanvas.releasePointerCapture(e.pointerId);
        } catch {
          /* no-op */
        }
      }
      isDraggingRef.current = null;
    };

    svCanvas.addEventListener('pointerdown', handlePointerDown);
    hueCanvas.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('pointermove', handlePointerMove, pointerOpts);
    document.addEventListener('pointerup', handlePointerUp, pointerOpts);
    document.addEventListener('pointercancel', handlePointerUp, pointerOpts);

    return () => {
      svCanvas.removeEventListener('pointerdown', handlePointerDown);
      hueCanvas.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointermove', handlePointerMove, pointerOpts);
      document.removeEventListener('pointerup', handlePointerUp, pointerOpts);
      document.removeEventListener('pointercancel', handlePointerUp, pointerOpts);
    };
  }, [pointerOpts]);

  const rootClass = fillWidth ? `${styles.root} ${styles.rootFill}` : styles.root;

  return (
    <div
      ref={rootRef}
      data-testid={dataTestId}
      className={rootClass}
      style={fillWidth ? undefined : { width: spectrumSize }}
    >
      <div className={styles.canvasWrap}>
        <canvas
          ref={svCanvasRef}
          className={styles.canvas}
          style={{
            width: spectrumSize,
            height: svHeight,
          }}
        />
      </div>
      <div className={styles.canvasWrap}>
        <canvas
          ref={hueCanvasRef}
          className={styles.canvas}
          style={{
            width: spectrumSize,
            height: hueBarHeight,
          }}
        />
      </div>
    </div>
  );
};

export default ColorPicker;
