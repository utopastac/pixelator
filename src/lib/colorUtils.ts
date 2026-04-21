/**
 * Pure colour-space conversion helpers. Used by ColorPicker and the toolbar
 * HSV popover. All functions are deterministic and have no DOM dependencies.
 */

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** HSV → RGB. `h` in [0,1] (wraps), `s` and `v` in [0,1] (clamped). Returns 0-255 ints. */
export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  // Wrap hue into [0,1).
  const hh = ((h % 1) + 1) % 1;
  const ss = clamp(s, 0, 1);
  const vv = clamp(v, 0, 1);
  let r: number, g: number, b: number;
  const i = Math.floor(hh * 6);
  const f = hh * 6 - i;
  const p = vv * (1 - ss);
  const q = vv * (1 - f * ss);
  const t = vv * (1 - (1 - f) * ss);
  switch (i % 6) {
    case 0: r = vv; g = t; b = p; break;
    case 1: r = q; g = vv; b = p; break;
    case 2: r = p; g = vv; b = t; break;
    case 3: r = p; g = q; b = vv; break;
    case 4: r = t; g = p; b = vv; break;
    default: r = vv; g = p; b = q; break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/** HSV → lowercase 7-char hex string. `h` in degrees [0,360), `s`/`v` in [0,1]. */
export function hsvToHex(h: number, s: number, v: number): string {
  const rgb = hsvToRgb(h / 360, s, v);
  return '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');
}

/** 7-char hex string → HSV. `h` in degrees rounded to int, `s`/`v` to 3 decimals. */
export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const lower = hex.toLowerCase();
  const r = parseInt(lower.slice(1, 3), 16) / 255;
  const g = parseInt(lower.slice(3, 5), 16) / 255;
  const b = parseInt(lower.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: parseFloat(s.toFixed(3)), v: parseFloat(v.toFixed(3)) };
}
