import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCustomColors } from './useCustomColors';

// Note the colon (not dot) — intentional, per CLAUDE.md.
const KEY = 'pixelator:customColors';

beforeEach(() => {
  localStorage.clear();
});

describe('useCustomColors', () => {
  it('initialises empty when localStorage is empty', () => {
    const { result } = renderHook(() => useCustomColors());
    expect(result.current.customColors).toEqual([]);
  });

  it('reads existing list from localStorage on mount', () => {
    localStorage.setItem(KEY, JSON.stringify(['#112233', '#aabbcc']));
    const { result } = renderHook(() => useCustomColors());
    expect(result.current.customColors).toEqual(['#112233', '#aabbcc']);
  });

  it('filters invalid entries when reading from storage', () => {
    localStorage.setItem(KEY, JSON.stringify(['#112233', 'nope', 9, '#short']));
    const { result } = renderHook(() => useCustomColors());
    expect(result.current.customColors).toEqual(['#112233']);
  });

  it('returns empty when storage contains malformed JSON', () => {
    localStorage.setItem(KEY, '{not json');
    const { result } = renderHook(() => useCustomColors());
    expect(result.current.customColors).toEqual([]);
  });

  it('pushCustomColor appends to the end (insertion order)', () => {
    const { result } = renderHook(() => useCustomColors());
    act(() => result.current.pushCustomColor('#111111'));
    act(() => result.current.pushCustomColor('#222222'));
    expect(result.current.customColors).toEqual(['#111111', '#222222']);
  });

  it('pushCustomColor normalises to lowercase', () => {
    const { result } = renderHook(() => useCustomColors());
    act(() => result.current.pushCustomColor('#ABCDEF'));
    expect(result.current.customColors).toEqual(['#abcdef']);
  });

  it('pushCustomColor dedupes case-insensitively (no-op if present)', () => {
    localStorage.setItem(KEY, JSON.stringify(['#ff0000']));
    const { result } = renderHook(() => useCustomColors());
    act(() => result.current.pushCustomColor('#FF0000'));
    expect(result.current.customColors).toEqual(['#ff0000']);
  });

  it('pushCustomColor ignores invalid hex input', () => {
    const { result } = renderHook(() => useCustomColors());
    act(() => result.current.pushCustomColor('red'));
    act(() => result.current.pushCustomColor('#zzz'));
    act(() => result.current.pushCustomColor('#123'));
    expect(result.current.customColors).toEqual([]);
  });

  it('removeCustomColor removes by case-insensitive match', () => {
    localStorage.setItem(KEY, JSON.stringify(['#111111', '#aabbcc', '#222222']));
    const { result } = renderHook(() => useCustomColors());
    act(() => result.current.removeCustomColor('#AABBCC'));
    expect(result.current.customColors).toEqual(['#111111', '#222222']);
  });

  it('removeCustomColor on a missing color is a no-op', () => {
    localStorage.setItem(KEY, JSON.stringify(['#111111']));
    const { result } = renderHook(() => useCustomColors());
    act(() => result.current.removeCustomColor('#999999'));
    expect(result.current.customColors).toEqual(['#111111']);
  });

  it('mergeCustomColors appends new entries, preserving order and dedupe', () => {
    localStorage.setItem(KEY, JSON.stringify(['#111111', '#222222']));
    const { result } = renderHook(() => useCustomColors());
    act(() => result.current.mergeCustomColors(['#222222', '#333333', '#444444']));
    expect(result.current.customColors).toEqual(['#111111', '#222222', '#333333', '#444444']);
  });

  it('mergeCustomColors normalises and dedupes case-insensitively', () => {
    localStorage.setItem(KEY, JSON.stringify(['#ff0000']));
    const { result } = renderHook(() => useCustomColors());
    act(() => result.current.mergeCustomColors(['#FF0000', '#00FF00']));
    expect(result.current.customColors).toEqual(['#ff0000', '#00ff00']);
  });

  it('mergeCustomColors filters invalid entries', () => {
    const { result } = renderHook(() => useCustomColors());
    act(() => result.current.mergeCustomColors(['#zzz', 'red', '#abcdef']));
    expect(result.current.customColors).toEqual(['#abcdef']);
  });

  it('mergeCustomColors is a no-op when incoming list is empty', () => {
    const { result } = renderHook(() => useCustomColors());
    const before = result.current.customColors;
    act(() => result.current.mergeCustomColors([]));
    expect(result.current.customColors).toBe(before);
  });

  it('writes through to localStorage after push and remove', () => {
    const { result } = renderHook(() => useCustomColors());
    act(() => result.current.pushCustomColor('#abcdef'));
    expect(JSON.parse(localStorage.getItem(KEY) ?? '[]')).toEqual(['#abcdef']);
    act(() => result.current.removeCustomColor('#abcdef'));
    expect(JSON.parse(localStorage.getItem(KEY) ?? '[]')).toEqual([]);
  });
});
