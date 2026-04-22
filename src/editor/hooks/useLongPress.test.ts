/**
 * Tests for `useLongPress` and `LONG_PRESS_MS`.
 *
 * Uses vi.useFakeTimers() to control the internal setTimeout precisely.
 * `renderHook` from @testing-library/react drives the hook lifecycle.
 */
import type { PointerEvent as ReactPointerEvent } from 'react';
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
    expect(result.current).toHaveProperty('onPointerDown');
    expect(result.current).toHaveProperty('onPointerUp');
    expect(result.current).toHaveProperty('onPointerLeave');
    expect(result.current).toHaveProperty('onPointerCancel');
    expect(result.current).toHaveProperty('onClick');
  });
});

// ---------------------------------------------------------------------------
// Short press (pointer)
// ---------------------------------------------------------------------------

const primaryPointer = { isPrimary: true, pointerId: 1 } as unknown as ReactPointerEvent<HTMLButtonElement>;

describe('useLongPress — short press (pointer)', () => {
  it('fires onShortPress when pointerup arrives before LONG_PRESS_MS', () => {
    const { result, onShortPress, onLongPress } = mount();

    act(() => { result.current.onPointerDown(primaryPointer); });
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS - 1); });
    act(() => { result.current.onPointerUp(primaryPointer); });

    expect(onShortPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('does not fire onLongPress after a short press', () => {
    const { result, onLongPress } = mount();

    act(() => { result.current.onPointerDown(primaryPointer); });
    act(() => { result.current.onPointerUp(primaryPointer); });
    // Advance well past threshold — timer should already be cleared
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS * 2); });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('ignores the synthetic click after a pointer short press', () => {
    const { result, onShortPress } = mount();

    act(() => { result.current.onPointerDown(primaryPointer); });
    act(() => { result.current.onPointerUp(primaryPointer); });
    act(() => { result.current.onClick(); });

    expect(onShortPress).toHaveBeenCalledTimes(1);
  });

  it('fires onShortPress from click alone (keyboard-style activation)', () => {
    const { result, onShortPress } = mount();

    act(() => { result.current.onClick(); });

    expect(onShortPress).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Long press (pointer)
// ---------------------------------------------------------------------------

describe('useLongPress — long press (pointer)', () => {
  it('fires onLongPress when held past LONG_PRESS_MS', () => {
    const { result, onShortPress, onLongPress } = mount();

    act(() => { result.current.onPointerDown(primaryPointer); });
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS); });

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onShortPress).not.toHaveBeenCalled();
  });

  it('does NOT fire onShortPress when pointerup follows a long press', () => {
    const { result, onShortPress, onLongPress } = mount();

    act(() => { result.current.onPointerDown(primaryPointer); });
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS); });
    act(() => { result.current.onPointerUp(primaryPointer); });

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onShortPress).not.toHaveBeenCalled();
  });

  it('ignores the synthetic click after a long press', () => {
    const { result, onShortPress, onLongPress } = mount();

    act(() => { result.current.onPointerDown(primaryPointer); });
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS); });
    act(() => { result.current.onPointerUp(primaryPointer); });
    act(() => { result.current.onClick(); });

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onShortPress).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Mouse leave cancels
// ---------------------------------------------------------------------------

describe('useLongPress — pointer leave', () => {
  it('cancels a pending long press without firing either callback', () => {
    const { result, onShortPress, onLongPress } = mount();

    act(() => { result.current.onPointerDown(primaryPointer); });
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS / 2); });
    act(() => { result.current.onPointerLeave(); });
    // Advance past threshold — timer should already be cleared
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS); });

    expect(onShortPress).not.toHaveBeenCalled();
    expect(onLongPress).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Non-primary pointer (multi-touch)
// ---------------------------------------------------------------------------

describe('useLongPress — non-primary pointer', () => {
  it('ignores non-primary pointerdown', () => {
    const { result, onShortPress, onLongPress } = mount();
    const secondary = { isPrimary: false, pointerId: 2 } as unknown as ReactPointerEvent<HTMLButtonElement>;

    act(() => { result.current.onPointerDown(secondary); });
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS); });

    expect(onLongPress).not.toHaveBeenCalled();
    expect(onShortPress).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Unmount cleanup
// ---------------------------------------------------------------------------

describe('useLongPress — unmount cleanup', () => {
  it('a pending timer is running before unmount', () => {
    const { result, unmount } = mount();

    act(() => { result.current.onPointerDown(primaryPointer); });

    // The timer should be pending after pointerdown
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    // Clean up
    act(() => { result.current.onPointerUp(primaryPointer); }); // cancel the timer via short-press
    act(() => { unmount(); });
  });

  it('short-press before unmount does not leave any pending timer', () => {
    const { result, unmount } = mount();

    act(() => { result.current.onPointerDown(primaryPointer); });
    act(() => { result.current.onPointerUp(primaryPointer); }); // short press clears the timer

    expect(vi.getTimerCount()).toBe(0);

    act(() => { unmount(); });
  });

  it('pointerLeave clears the timer before unmount', () => {
    const { result, unmount } = mount();

    act(() => { result.current.onPointerDown(primaryPointer); });
    act(() => { result.current.onPointerLeave(); }); // cancel clears the timer

    expect(vi.getTimerCount()).toBe(0);

    act(() => { unmount(); });
  });
});
