import { describe, expect, it } from 'vitest';
import { maskToSelection, maskToSelectionInPlace, type PixelArtSelection } from './pixelArtFill';

describe('maskToSelectionInPlace', () => {
  it('matches maskToSelection for a rect selection (keepInside)', () => {
    const base = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
    const width = 3;
    const sel: PixelArtSelection = { shape: 'rect', x1: 0, y1: 0, x2: 1, y2: 0 };

    const next1 = ['x', 'x', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
    const expected = maskToSelection([...next1], base, width, sel, true);
    const nextIn = [...next1];
    maskToSelectionInPlace(nextIn, base, width, sel, true);
    expect(nextIn).toEqual(expected);
  });

  it('matches maskToSelection when painting outside keepInside', () => {
    const base = new Array(9).fill('');
    base[0] = '#old';
    const width = 3;
    const sel: PixelArtSelection = { shape: 'rect', x1: 0, y1: 0, x2: 1, y2: 1 };
    const next = new Array(9).fill('#new');
    const expected = maskToSelection([...next], base, width, sel, false);
    const inPlace = [...next];
    maskToSelectionInPlace(inPlace, base, width, sel, false);
    expect(inPlace).toEqual(expected);
  });
});
