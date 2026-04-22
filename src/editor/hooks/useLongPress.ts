/**
 * React hook for distinguishing a short press (tap) from a long press on
 * toolbar buttons. Used to attach secondary actions (e.g. opening a sub-menu)
 * to the same button that performs a primary action on a quick click.
 */

import React from 'react';

/** Duration in milliseconds a pointer must be held before the long-press fires. */
export const LONG_PRESS_MS = 400;

type FinalizePayload = Pick<PointerEvent, 'pointerId' | 'type'>;

/**
 * Returns pointer event handlers to spread onto a trigger element.
 * Holding the element for at least `LONG_PRESS_MS` fires `onLongPress`;
 * releasing before that fires `onShortPress`.
 *
 * Only the **primary** pointer starts a gesture (ignores multi-touch
 * secondary pointers).
 *
 * Pointer events subsume mouse and touch, so this path works on mobile
 * browsers that prioritise the pointer event model over legacy touch events.
 *
 * **Touch:** `pointerleave` only cancels the long-press timer (small finger
 * jitter leaves the hit box before `pointerup`). A capture-phase `pointerup`
 * on `window` still completes a short press so taps are not lost.
 *
 * **Mouse:** leaving the element before release aborts the gesture entirely
 * (no short press on `pointerup` elsewhere), matching desktop expectations.
 *
 * @param onShortPress - Callback invoked when the user releases before the
 *   long-press threshold.
 * @param onLongPress - Callback invoked when the user holds for at least
 *   `LONG_PRESS_MS` milliseconds.
 * @returns Handlers: `onPointerDown`, `onPointerUp`, `onPointerLeave`,
 *   `onPointerCancel`.
 */
export function useLongPress(
  onShortPress: () => void,
  onLongPress: () => void,
) {
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedLong = React.useRef(false);
  /** Swallows the synthetic `click` that follows pointer/touch activation. */
  const suppressNextClickRef = React.useRef(false);
  const activePointerIdRef = React.useRef<number | null>(null);
  const removeGlobalListenersRef = React.useRef<(() => void) | null>(null);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const detachGlobalListeners = React.useCallback(() => {
    if (removeGlobalListenersRef.current) {
      removeGlobalListenersRef.current();
      removeGlobalListenersRef.current = null;
    }
  }, []);

  const abortGestureNoFire = React.useCallback(() => {
    clearTimer();
    detachGlobalListeners();
    activePointerIdRef.current = null;
    firedLong.current = false;
  }, [clearTimer, detachGlobalListeners]);

  const finalizePointerGesture = React.useCallback(
    (e: FinalizePayload) => {
      if (activePointerIdRef.current !== e.pointerId) return;
      activePointerIdRef.current = null;
      detachGlobalListeners();
      clearTimer();
      const isCancel = e.type === 'pointercancel';
      if (isCancel) {
        firedLong.current = false;
        return;
      }
      suppressNextClickRef.current = true;
      if (!firedLong.current) {
        onShortPress();
      }
    },
    [clearTimer, detachGlobalListeners, onShortPress],
  );

  const start = React.useCallback(
    (e: React.PointerEvent) => {
      if (!e.isPrimary) return;
      abortGestureNoFire();
      firedLong.current = false;
      activePointerIdRef.current = e.pointerId;

      if (typeof window !== 'undefined') {
        const onGlobalEnd = (ev: PointerEvent) => {
          finalizePointerGesture(ev);
        };
        window.addEventListener('pointerup', onGlobalEnd, true);
        window.addEventListener('pointercancel', onGlobalEnd, true);
        removeGlobalListenersRef.current = () => {
          window.removeEventListener('pointerup', onGlobalEnd, true);
          window.removeEventListener('pointercancel', onGlobalEnd, true);
        };
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        firedLong.current = true;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    [abortGestureNoFire, finalizePointerGesture, onLongPress],
  );

  const onPointerUp = React.useCallback(
    (e: React.PointerEvent) => {
      if (!e.isPrimary) return;
      finalizePointerGesture({ pointerId: e.pointerId, type: e.type });
    },
    [finalizePointerGesture],
  );

  const onPointerLeave = React.useCallback(
    (e?: React.PointerEvent) => {
      if (e?.pointerType === 'touch') {
        clearTimer();
        return;
      }
      abortGestureNoFire();
    },
    [abortGestureNoFire, clearTimer],
  );

  const onPointerCancel = React.useCallback(
    (e: React.PointerEvent) => {
      if (!e.isPrimary) return;
      finalizePointerGesture({ pointerId: e.pointerId, type: 'pointercancel' });
    },
    [finalizePointerGesture],
  );

  const onClick = React.useCallback(() => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    onShortPress();
  }, [onShortPress]);

  React.useEffect(
    () => () => {
      abortGestureNoFire();
    },
    [abortGestureNoFire],
  );

  return {
    onPointerDown: start,
    onPointerUp,
    onPointerLeave,
    onPointerCancel,
    onClick,
  };
}
