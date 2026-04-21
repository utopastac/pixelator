/**
 * Tests for `useTheme` — light/dark theme hook that persists to localStorage
 * and writes `data-theme` on `<html>`. Mocks `window.matchMedia` so the
 * system-default branch is deterministic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTheme } from './useTheme';

const KEY = 'pixelator.theme';

function stubMatchMedia(matches: boolean) {
  const fake = (query: string) =>
    ({
      matches: query === '(prefers-color-scheme: dark)' ? matches : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
  vi.stubGlobal('matchMedia', fake);
  // Some code paths (like `window.matchMedia`) read off `window` directly.
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: fake });
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  stubMatchMedia(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useTheme', () => {
  it('defaults to light when nothing is stored and OS prefers light', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('defaults to dark when nothing is stored and OS prefers dark', () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('reads a valid stored theme, ignoring the OS preference', () => {
    stubMatchMedia(true);
    localStorage.setItem(KEY, 'light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('ignores garbage in localStorage and falls back to the system default', () => {
    localStorage.setItem(KEY, 'chartreuse');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('writes data-theme on <html> on mount and on change', () => {
    const { result } = renderHook(() => useTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    act(() => result.current.setTheme('dark'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggleTheme flips light <-> dark', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('dark');
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('light');
  });

  it('persists the theme to localStorage after a change', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('dark'));
    expect(localStorage.getItem(KEY)).toBe('dark');
  });

  it('round-trips: a persisted theme is restored by a fresh hook instance', () => {
    const first = renderHook(() => useTheme());
    act(() => first.result.current.setTheme('dark'));
    first.unmount();
    const second = renderHook(() => useTheme());
    expect(second.result.current.theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
