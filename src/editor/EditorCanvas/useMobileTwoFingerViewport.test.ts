/**
 * Behavioural tests for two-finger viewport gestures (mobile touch only).
 */
import type React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMobileTwoFingerViewport } from './useMobileTwoFingerViewport';

function makeDivRect() {
  return { left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300, x: 0, y: 0, toJSON: () => '' };
}

function touchDown(
  api: ReturnType<typeof useMobileTwoFingerViewport>,
  id: number,
  x: number,
  y: number,
) {
  const e = {
    pointerId: id,
    pointerType: 'touch',
    clientX: x,
    clientY: y,
    currentTarget: { getBoundingClientRect: () => makeDivRect() },
  } as unknown as React.PointerEvent<HTMLDivElement>;
  let out: { consumed: boolean; shouldPreventDefault?: boolean } = { consumed: false };
  act(() => {
    out = api.onTouchPointerDown(e);
  });
  return out;
}

describe('useMobileTwoFingerViewport', () => {
  const panDragRef = { current: null as { lastX: number; lastY: number } | null };
  const setIsActivelyPanning = vi.fn();
  const panBy = vi.fn();
  const zoomAtPoint = vi.fn();
  const handlePointerCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    panDragRef.current = null;
  });

  it('returns consumed when the second touch lands (and cancels drawing)', () => {
    const { result } = renderHook(() =>
      useMobileTwoFingerViewport({
        isMobile: true,
        disabled: false,
        zoom: 4,
        panBy,
        zoomAtPoint,
        handlePointerCancel,
        panDragRef,
        setIsActivelyPanning,
      }),
    );
    expect(touchDown(result.current, 1, 10, 20).consumed).toBe(false);
    expect(touchDown(result.current, 2, 50, 20).consumed).toBe(true);
    expect(handlePointerCancel).toHaveBeenCalledOnce();
  });

  it('does nothing for non-touch pointers', () => {
    const { result } = renderHook(() =>
      useMobileTwoFingerViewport({
        isMobile: true,
        disabled: false,
        zoom: 4,
        panBy,
        zoomAtPoint,
        handlePointerCancel,
        panDragRef,
        setIsActivelyPanning,
      }),
    );
    const e = {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 10,
      clientY: 20,
      currentTarget: { getBoundingClientRect: () => makeDivRect() },
    } as unknown as React.PointerEvent<HTMLDivElement>;
    let consumed = false;
    act(() => {
      consumed = result.current.onTouchPointerDown(e).consumed;
    });
    expect(consumed).toBe(false);
    act(() => {
      consumed = result.current.onTouchPointerDown({
        ...e,
        pointerId: 2,
        clientX: 50,
      } as unknown as React.PointerEvent<HTMLDivElement>).consumed;
    });
    expect(consumed).toBe(false);
    expect(handlePointerCancel).not.toHaveBeenCalled();
  });
});
