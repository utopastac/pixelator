import { describe, it, expect } from 'vitest';
import { applyAlphaLock } from './alphaLock';

describe('applyAlphaLock', () => {
  it('disabled: returns newPixels reference unchanged', () => {
    const newPixels = ['#ff0000', '', '#00ff00'];
    const current  = ['#aaaaaa', '', '#bbbbbb'];
    expect(applyAlphaLock(newPixels, current, false)).toBe(newPixels);
  });

  it('enabled: transparent cells in current stay transparent regardless of newPixels', () => {
    const newPixels = ['#ff0000', '#ff0000', '#ff0000'];
    const current  = ['#aaaaaa', '',         '#bbbbbb'];
    const result = applyAlphaLock(newPixels, current, true);
    expect(result[0]).toBe('#ff0000'); // opaque → new colour applied
    expect(result[1]).toBe('');        // transparent → locked out
    expect(result[2]).toBe('#ff0000'); // opaque → new colour applied
  });

  it('enabled: fully transparent layer produces an all-transparent result', () => {
    const newPixels = ['#ff0000', '#00ff00', '#0000ff'];
    const current  = ['', '', ''];
    const result = applyAlphaLock(newPixels, current, true);
    expect(result).toEqual(['', '', '']);
  });

  it('enabled: fully opaque layer passes all new colours through', () => {
    const newPixels = ['#ff0000', '#00ff00', '#0000ff'];
    const current  = ['#111111', '#222222', '#333333'];
    const result = applyAlphaLock(newPixels, current, true);
    expect(result).toEqual(newPixels);
  });

  it('enabled: erase stroke (newPixels contain empty strings) still respects alpha lock', () => {
    // The caller is expected to skip applyAlphaLock for the eraser, but if it
    // is called, transparent cells in current are preserved as '' (same outcome
    // for a different reason) and opaque cells get the '' from newPixels.
    const newPixels = ['', '', ''];
    const current  = ['#aaaaaa', '',         '#bbbbbb'];
    const result = applyAlphaLock(newPixels, current, true);
    expect(result[0]).toBe('');  // opaque → erased to ''
    expect(result[1]).toBe('');  // transparent → stays ''
    expect(result[2]).toBe('');  // opaque → erased to ''
  });

  it('does not mutate the input arrays', () => {
    const newPixels = ['#ff0000', '#00ff00'];
    const current   = ['#aaaaaa', ''];
    const newCopy  = [...newPixels];
    const currCopy = [...current];
    applyAlphaLock(newPixels, current, true);
    expect(newPixels).toEqual(newCopy);
    expect(current).toEqual(currCopy);
  });
});
