/**
 * Tests for `useLongPress` and `LONG_PRESS_MS`.
 *
 * Uses vi.useFakeTimers() to control the internal setTimeout precisely.
 * `renderHook` from @testing-library/react drives the hook lifecycle.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLongPress, LONG_PRESS_MS } from './useLongPress';

// ---------------------------------------------------------------------------
// Timer setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mount() {
  const onShortPress = vi.fn();
  const onLongPress = vi.fn();
  const { result, unmount } = renderHook(() =>
    useLongPress(onShortPress, onLongPress),
  );
  return { result, onShortPress, onLongPress, unmount };
}

// ---------------------------------------------------------------------------
// Returned handler keys
// ---------------------------------------------------------------------------

describe('useLongPress — returned keys', () => {
  it('returns the five expected event-handler keys', () => {
    const { result } = mount();
    expect(result.current).toHaveProperty('onMouseDown');
    expect(result.current).toHaveProperty('onMouseUp');
    expect(result.current).toHaveProperty('onMouseLeave');
    expect(result.current).toHaveProperty('onTouchStart');
    expect(result.current).toHaveProperty('onTouchEnd');
  });
});

// ---------------------------------------------------------------------------
// Short press (mouse)
// ---------------------------------------------------------------------------

describe('useLongPress — short press (mouse)', () => {
  it('fires onShortPress when mouseup arrives before LONG_PRESS_MS', () => {
    const { result, onShortPress, onLongPress } = mount();

    act(() => { result.current.onMouseDown(); });
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS - 1); });
    act(() => { result.current.onMouseUp(); });

    expect(onShortPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('does not fire onLongPress after a short press', () => {
    const { result, onLongPress } = mount();

    act(() => { result.current.onMouseDown(); });
    act(() => { result.current.onMouseUp(); });
    // Advance well past threshold — timer should already be cleared
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS * 2); });

    expect(onLongPress).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Long press (mouse)
// ---------------------------------------------------------------------------

describe('useLongPress — long press (mouse)', () => {
  it('fires onLongPress when held past LONG_PRESS_MS', () => {
    const { result, onShortPress, onLongPress } = mount();

    act(() => { result.current.onMouseDown(); });
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS); });

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onShortPress).not.toHaveBeenCalled();
  });

  it('does NOT fire onShortPress when mouseup follows a long press', () => {
    const { result, onShortPress, onLongPress } = mount();

    act(() => { result.current.onMouseDown(); });
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS); });
    act(() => { result.current.onMouseUp(); });

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onShortPress).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Mouse leave cancels
// ---------------------------------------------------------------------------

describe('useLongPress — mouse leave', () => {
  it('cancels a pending long press without firing either callback', () => {
    const { result, onShortPress, onLongPress } = mount();

    act(() => { result.current.onMouseDown(); });
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS / 2); });
    act(() => { result.current.onMouseLeave(); });
    // Advance past threshold — timer should already be cleared
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS); });

    expect(onShortPress).not.toHaveBeenCalled();
    expect(onLongPress).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Touch: short press
// ---------------------------------------------------------------------------

describe('useLongPress — short press (touch)', () => {
  it('fires onShortPress when touchend arrives before LONG_PRESS_MS', () => {
    const { result, onShortPress, onLongPress } = mount();

    act(() => { result.current.onTouchStart(); });
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS - 1); });
    act(() => { result.current.onTouchEnd(); });

    expect(onShortPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Touch: long press
// ---------------------------------------------------------------------------

describe('useLongPress — long press (touch)', () => {
  it('fires onLongPress when held past LONG_PRESS_MS via touch', () => {
    const { result, onShortPress, onLongPress } = mount();

    act(() => { result.current.onTouchStart(); });
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS); });

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onShortPress).not.toHaveBeenCalled();
  });

  it('does NOT fire onShortPress when touchend follows a long press', () => {
    const { result, onShortPress, onLongPress } = mount();

    act(() => { result.current.onTouchStart(); });
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS); });
    act(() => { result.current.onTouchEnd(); });

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onShortPress).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Unmount cleanup
// ---------------------------------------------------------------------------

describe('useLongPress — unmount cleanup', () => {
  it('a pending timer is running before unmount', () => {
    const { result, unmount } = mount();

    act(() => { result.current.onMouseDown(); });

    // The timer should be pending after mousedown
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    // Clean up
    act(() => { result.current.onMouseUp(); }); // cancel the timer via short-press
    act(() => { unmount(); });
  });

  it('short-press before unmount does not leave any pending timer', () => {
    const { result, unmount } = mount();

    act(() => { result.current.onMouseDown(); });
    act(() => { result.current.onMouseUp(); }); // short press clears the timer

    expect(vi.getTimerCount()).toBe(0);

    act(() => { unmount(); });
  });

  it('mouseLeave clears the timer before unmount', () => {
    const { result, unmount } = mount();

    act(() => { result.current.onMouseDown(); });
    act(() => { result.current.onMouseLeave(); }); // cancel clears the timer

    expect(vi.getTimerCount()).toBe(0);

    act(() => { unmount(); });
  });
});
