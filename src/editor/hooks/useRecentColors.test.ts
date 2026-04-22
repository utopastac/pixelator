import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRecentColors } from './useRecentColors';

const KEY = 'pixelator.recentColors';

beforeEach(() => {
  localStorage.clear();
});

describe('useRecentColors', () => {
  it('seeds with black + white when localStorage is empty', () => {
    const { result } = renderHook(() => useRecentColors());
    expect(result.current.recents).toEqual(['#000000', '#ffffff']);
  });

  it('reads existing list from localStorage on mount', () => {
    localStorage.setItem(KEY, JSON.stringify(['#112233', '#445566']));
    const { result } = renderHook(() => useRecentColors());
    expect(result.current.recents).toEqual(['#112233', '#445566']);
  });

  it('filters invalid entries when reading from storage', () => {
    localStorage.setItem(KEY, JSON.stringify(['#112233', 'not-a-hex', 42, '#zzzzzz']));
    const { result } = renderHook(() => useRecentColors());
    expect(result.current.recents).toEqual(['#112233']);
  });

  it('falls back to seed when storage contains malformed JSON', () => {
    localStorage.setItem(KEY, '{not json');
    const { result } = renderHook(() => useRecentColors());
    expect(result.current.recents).toEqual(['#000000', '#ffffff']);
  });

  it('pushRecent adds a new color to the front', () => {
    const { result } = renderHook(() => useRecentColors());
    act(() => result.current.pushRecent('#112233'));
    expect(result.current.recents[0]).toBe('#112233');
    expect(result.current.recents).toEqual(['#112233', '#000000', '#ffffff']);
  });

  it('normalises uppercase hex to lowercase when pushing', () => {
    const { result } = renderHook(() => useRecentColors());
    act(() => result.current.pushRecent('#ABCDEF'));
    expect(result.current.recents[0]).toBe('#abcdef');
  });

  it('ignores invalid hex input', () => {
    const { result } = renderHook(() => useRecentColors());
    const before = result.current.recents;
    act(() => result.current.pushRecent('red'));
    act(() => result.current.pushRecent('#zzz'));
    act(() => result.current.pushRecent('#123'));
    expect(result.current.recents).toEqual(before);
  });

  it('caps the list at 15 entries, dropping the oldest', () => {
    localStorage.setItem(KEY, JSON.stringify([]));
    const { result } = renderHook(() => useRecentColors());
    const fifteen = Array.from({ length: 15 }, (_, i) => {
      const n = i + 1;
      const pair = n.toString(16).padStart(2, '0');
      return `#${pair}${pair}${pair}` as const;
    });
    for (const c of fifteen) {
      act(() => result.current.pushRecent(c));
    }
    expect(result.current.recents).toHaveLength(15);
    expect(result.current.recents[0]).toBe('#0f0f0f');
    expect(result.current.recents[14]).toBe('#010101');

    act(() => result.current.pushRecent('#101010'));
    expect(result.current.recents).toHaveLength(15);
    expect(result.current.recents[0]).toBe('#101010');
    expect(result.current.recents).not.toContain('#010101');
  });

  it('pushing an existing color is a no-op and does NOT reorder', () => {
    localStorage.setItem(KEY, JSON.stringify(['#111111', '#222222', '#333333']));
    const { result } = renderHook(() => useRecentColors());
    // Push middle entry — must not move it to the front.
    act(() => result.current.pushRecent('#222222'));
    expect(result.current.recents).toEqual(['#111111', '#222222', '#333333']);
  });

  it('dedupes case-insensitively — #FF0000 and #ff0000 are the same entry', () => {
    localStorage.setItem(KEY, JSON.stringify(['#ff0000', '#000000']));
    const { result } = renderHook(() => useRecentColors());
    act(() => result.current.pushRecent('#FF0000'));
    expect(result.current.recents).toEqual(['#ff0000', '#000000']);
  });

  it('mergeRecentColors appends new hexes after existing, keeping order, and clamps to cap', () => {
    localStorage.setItem(KEY, JSON.stringify(['#111111', '#222222', '#333333', '#444444', '#555555', '#666666']));
    const { result } = renderHook(() => useRecentColors());
    act(() => result.current.mergeRecentColors(['#777777', '#666666', '#888888', '#999999']));
    // Existing order preserved; duplicates dropped; newcomers appended; under cap 15.
    expect(result.current.recents).toEqual([
      '#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777', '#888888', '#999999',
    ]);
  });

  it('mergeRecentColors is a no-op when the list is empty', () => {
    const { result } = renderHook(() => useRecentColors());
    const before = result.current.recents;
    act(() => result.current.mergeRecentColors([]));
    expect(result.current.recents).toBe(before);
  });

  it('mergeRecentColors filters invalid hex entries', () => {
    localStorage.setItem(KEY, JSON.stringify([]));
    const { result } = renderHook(() => useRecentColors());
    act(() => result.current.mergeRecentColors(['#abc', 'red', '#112233', 42 as unknown as string]));
    expect(result.current.recents).toEqual(['#112233']);
  });

  it('mergeRecentColors dedupes case-insensitively against existing', () => {
    localStorage.setItem(KEY, JSON.stringify(['#ff0000']));
    const { result } = renderHook(() => useRecentColors());
    act(() => result.current.mergeRecentColors(['#FF0000', '#00FF00']));
    expect(result.current.recents).toEqual(['#ff0000', '#00ff00']);
  });

  it('writes through to localStorage after a push', () => {
    localStorage.setItem(KEY, JSON.stringify([]));
    const { result } = renderHook(() => useRecentColors());
    act(() => result.current.pushRecent('#abcdef'));
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
    expect(stored[0]).toBe('#abcdef');
  });
});
