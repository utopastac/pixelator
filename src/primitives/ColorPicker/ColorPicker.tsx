import React, { useRef, useEffect, useCallback } from 'react';
import { hsvToRgb } from '@/lib/colorUtils';

interface ColorPickerProps {
  hue: number;
  saturation: number;
  brightness: number;
  onChange: (h: number, s: number, v: number) => void;
  size?: number;
  'data-testid'?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const HUE_BAR_HEIGHT = 18;
const GAP = 8;
const SV_CELLS = 20;
const HUE_CELLS = 24;

/**
 * HSV colour picker: a saturation/brightness square plus a hue bar underneath.
 * Both canvases are drag-interactive. Colour state is fully controlled via
 * (hue, saturation, brightness) props; the parent decides how to convert
 * to/from hex (see `hsvToHex` / `hexToHsv` helpers in this module).
 */
const ColorPicker: React.FC<ColorPickerProps> = ({
  hue,
  saturation,
  brightness,
  onChange,
  size = 200,
  'data-testid': dataTestId,
}) => {
  const svCanvasRef = useRef<HTMLCanvasElement>(null);
  const hueCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef<'sv' | 'hue' | null>(null);

  const svHeight = size;

  // Draw the saturation/brightness gradient area
  const drawSV = useCallback(() => {
    const canvas = svCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = svHeight * dpr;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    // Pixellated SV grid: sample HSV at each cell centre.
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

    // Draw SV indicator as a pixel-aligned square around the selected cell.
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
  }, [hue, saturation, brightness, size, svHeight]);

  // Draw the hue bar
  const drawHue = useCallback(() => {
    const canvas = hueCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = HUE_BAR_HEIGHT * dpr;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    // Pixellated hue strip: one discrete cell per hue step.
    for (let i = 0; i < HUE_CELLS; i++) {
      const x0 = Math.round((i * size) / HUE_CELLS);
      const x1 = Math.round(((i + 1) * size) / HUE_CELLS);
      const h = (i + 0.5) / HUE_CELLS;
      const [r, g, b] = hsvToRgb(h, 1, 1);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x0, 0, x1 - x0, HUE_BAR_HEIGHT);
    }

    // Draw hue indicator as a pixel-aligned square around the selected cell.
    const selH = clamp(Math.floor((hue / 360) * HUE_CELLS), 0, HUE_CELLS - 1);
    const hx0 = Math.round((selH * size) / HUE_CELLS);
    const hx1 = Math.round(((selH + 1) * size) / HUE_CELLS);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(hx0 + 0.5, 0.5, hx1 - hx0 - 1, HUE_BAR_HEIGHT - 1);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(hx0 + 0.5, 0.5, hx1 - hx0 - 1, HUE_BAR_HEIGHT - 1);
  }, [hue, size]);

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
      const x = ((clientX - rect.left) / rect.width) * size;
      const y = ((clientY - rect.top) / rect.height) * svHeight;
      const s = clamp(x / size, 0, 1);
      const v = clamp(1 - y / svHeight, 0, 1);
      onChange(hue, parseFloat(s.toFixed(3)), parseFloat(v.toFixed(3)));
    },
    [size, svHeight, hue, onChange],
  );

  const handleHueInteraction = useCallback(
    (clientX: number) => {
      const canvas = hueCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * size;
      const h = clamp((x / size) * 360, 0, 360);
      onChange(Math.round(h), saturation, brightness);
    },
    [size, saturation, brightness, onChange],
  );

  useEffect(() => {
    const svCanvas = svCanvasRef.current;
    const hueCanvas = hueCanvasRef.current;
    if (!svCanvas || !hueCanvas) return;

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (svCanvas.contains(e.target as Node)) {
        isDraggingRef.current = 'sv';
        handleSVInteraction(e.clientX, e.clientY);
      } else if (hueCanvas.contains(e.target as Node)) {
        isDraggingRef.current = 'hue';
        handleHueInteraction(e.clientX);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current === 'sv') {
        handleSVInteraction(e.clientX, e.clientY);
      } else if (isDraggingRef.current === 'hue') {
        handleHueInteraction(e.clientX);
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = null;
    };

    svCanvas.addEventListener('mousedown', handleMouseDown);
    hueCanvas.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      svCanvas.removeEventListener('mousedown', handleMouseDown);
      hueCanvas.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleSVInteraction, handleHueInteraction]);

  return (
    <div
      data-testid={dataTestId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: GAP,
        width: size,
      }}
    >
      <div style={{ overflow: 'hidden', lineHeight: 0 }}>
        <canvas
          ref={svCanvasRef}
          style={{
            width: size,
            height: svHeight,
            cursor: 'crosshair',
            display: 'block',
            imageRendering: 'pixelated',
          }}
        />
      </div>
      <div style={{ overflow: 'hidden', lineHeight: 0 }}>
        <canvas
          ref={hueCanvasRef}
          style={{
            width: size,
            height: HUE_BAR_HEIGHT,
            cursor: 'crosshair',
            display: 'block',
            imageRendering: 'pixelated',
          }}
        />
      </div>
    </div>
  );
};

export default ColorPicker;
