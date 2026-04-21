/**
 * Tests for HSV/RGB/hex colour-space helpers. Fixtures are inline and small;
 * round-trip checks cover hexToHsv ↔ hsvToHex.
 */
import { describe, expect, it } from 'vitest';
import { hexToHsv, hsvToHex, hsvToRgb } from './colorUtils';

describe('hsvToRgb', () => {
  // h in [0,1). Fixtures at the primary/secondary corners.
  const fixtures: Array<{ name: string; hsv: [number, number, number]; rgb: [number, number, number] }> = [
    { name: 'red', hsv: [0, 1, 1], rgb: [255, 0, 0] },
    { name: 'green', hsv: [1 / 3, 1, 1], rgb: [0, 255, 0] },
    { name: 'blue', hsv: [2 / 3, 1, 1], rgb: [0, 0, 255] },
    { name: 'white', hsv: [0, 0, 1], rgb: [255, 255, 255] },
    { name: 'black', hsv: [0, 0, 0], rgb: [0, 0, 0] },
    { name: '50% grey', hsv: [0, 0, 0.5], rgb: [128, 128, 128] },
  ];
  it.each(fixtures)('$name → rgb', ({ hsv, rgb }) => {
    expect(hsvToRgb(...hsv)).toEqual(rgb);
  });

  it('clamps saturation above 1', () => {
    expect(hsvToRgb(0, 2, 1)).toEqual([255, 0, 0]);
  });

  it('clamps saturation below 0', () => {
    expect(hsvToRgb(0, -0.5, 1)).toEqual([255, 255, 255]);
  });

  it('clamps value above 1', () => {
    expect(hsvToRgb(0, 1, 2)).toEqual([255, 0, 0]);
  });

  it('clamps value below 0', () => {
    expect(hsvToRgb(0, 1, -1)).toEqual([0, 0, 0]);
  });

  // Hue wraps; hsvToRgb takes h in [0,1) but accepts out-of-range.
  it('wraps hue at 1.0 (= red)', () => {
    expect(hsvToRgb(1, 1, 1)).toEqual([255, 0, 0]);
  });

  it('wraps hue at 2.0 (= red)', () => {
    expect(hsvToRgb(2, 1, 1)).toEqual([255, 0, 0]);
  });

  it('wraps negative hue -1/6 (= -60° in 0..1) back to magenta', () => {
    // -1/6 wraps to 5/6 which is magenta (255, 0, 255).
    expect(hsvToRgb(-1 / 6, 1, 1)).toEqual([255, 0, 255]);
  });
});

describe('hsvToHex', () => {
  const fixtures: Array<{ hsv: [number, number, number]; hex: string }> = [
    { hsv: [0, 1, 1], hex: '#ff0000' },
    { hsv: [120, 1, 1], hex: '#00ff00' },
    { hsv: [240, 1, 1], hex: '#0000ff' },
    { hsv: [0, 0, 1], hex: '#ffffff' },
    { hsv: [0, 0, 0], hex: '#000000' },
    { hsv: [60, 1, 1], hex: '#ffff00' },
    { hsv: [180, 1, 1], hex: '#00ffff' },
    { hsv: [300, 1, 1], hex: '#ff00ff' },
  ];
  it.each(fixtures)('$hsv → $hex', ({ hsv, hex }) => {
    expect(hsvToHex(...hsv)).toBe(hex);
  });

  it('always returns lowercase hex', () => {
    const hex = hsvToHex(15, 0.73, 0.42);
    expect(hex).toBe(hex.toLowerCase());
  });

  it('always returns 7 chars including leading #', () => {
    // Low values pad with leading zeros.
    const hex = hsvToHex(0, 0, 0.01);
    expect(hex.length).toBe(7);
    expect(hex[0]).toBe('#');
  });

  it('wraps hue at 360°', () => {
    expect(hsvToHex(360, 1, 1)).toBe('#ff0000');
  });

  it('wraps hue at 720°', () => {
    expect(hsvToHex(720, 1, 1)).toBe('#ff0000');
  });

  it('wraps hue at -60° (= 300°, magenta)', () => {
    expect(hsvToHex(-60, 1, 1)).toBe('#ff00ff');
  });
});

describe('hexToHsv', () => {
  it('parses pure red', () => {
    expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 1, v: 1 });
  });

  it('parses black', () => {
    expect(hexToHsv('#000000')).toEqual({ h: 0, s: 0, v: 0 });
  });

  it('parses white', () => {
    expect(hexToHsv('#ffffff')).toEqual({ h: 0, s: 0, v: 1 });
  });

  it('accepts uppercase input', () => {
    expect(hexToHsv('#FF0000')).toEqual({ h: 0, s: 1, v: 1 });
  });

  it('accepts mixed case input', () => {
    expect(hexToHsv('#Ff00Ff')).toEqual(hexToHsv('#ff00ff'));
  });

  // Round-trip a grid of fixtures through hsvToHex → hexToHsv.
  const grid: string[] = [
    '#ff0000', '#00ff00', '#0000ff',
    '#ffff00', '#00ffff', '#ff00ff',
    '#808080', '#123456', '#abcdef',
  ];
  it.each(grid)('round-trips %s through hsvToHex', (hex) => {
    const { h, s, v } = hexToHsv(hex);
    expect(hsvToHex(h, s, v)).toBe(hex.toLowerCase());
  });
});
