/**
 * Tests for `palettes` — pure palette definitions + `getPalette` lookup.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_PALETTE_ID, PALETTES, getPalette } from './palettes';

describe('palettes', () => {
  it('exports a non-empty list of palettes', () => {
    expect(PALETTES.length).toBeGreaterThan(0);
  });

  it('includes a palette whose id matches DEFAULT_PALETTE_ID', () => {
    expect(PALETTES.some((p) => p.id === DEFAULT_PALETTE_ID)).toBe(true);
  });

  it('DEFAULT_PALETTE_ID resolves to the first palette', () => {
    expect(PALETTES[0].id).toBe(DEFAULT_PALETTE_ID);
  });

  it('every palette has a unique id, a name, and at least one colour', () => {
    const ids = new Set<string>();
    for (const p of PALETTES) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.colors.length).toBeGreaterThan(0);
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
    }
  });

  it('every palette colour is a lowercase hex string', () => {
    const hex = /^#[0-9a-f]{6}$/;
    for (const p of PALETTES) {
      for (const c of p.colors) {
        expect(c).toMatch(hex);
      }
    }
  });

  it('getPalette returns the palette with the matching id', () => {
    const picoId = 'pico-8';
    const p = getPalette(picoId);
    expect(p.id).toBe(picoId);
    expect(p.name).toBe('Pico-8');
  });

  it('getPalette falls back to the default for an unknown id', () => {
    const p = getPalette('does-not-exist');
    expect(p.id).toBe(DEFAULT_PALETTE_ID);
  });

  it('getPalette falls back to the default when id is undefined', () => {
    const p = getPalette(undefined);
    expect(p.id).toBe(DEFAULT_PALETTE_ID);
  });
});
