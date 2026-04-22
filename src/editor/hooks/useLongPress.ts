/**
 * React hook for distinguishing a short press (tap) from a long press on
 * toolbar buttons. Used to attach secondary actions (e.g. opening a sub-menu)
 * to the same button that performs a primary action on a quick click.
 */

import React from 'react';

/** Duration in milliseconds a pointer must be held before the long-press fires. */
export const LONG_PRESS_MS = 400;

/**
 * Returns pointer event handlers to spread onto a trigger element.
 * Holding the element for at least `LONG_PRESS_MS` fires `onLongPress`;
 * releasing before that fires `onShortPress`.
 *
 * Only the **primary** pointer starts a gesture (ignores multi-touch
 * secondary pointers). Moving off the element (`pointerleave`) or a system
 * cancel (`pointercancel`) ends a pending long-press without firing either
 * callback.
 *
 * Pointer events subsume mouse and touch, so this path works on mobile
 * browsers that prioritise the pointer event model over legacy touch events.
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

  const start = React.useCallback((e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    firedLong.current = false;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      firedLong.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  }, [onLongPress]);

  const cancel = React.useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const end = React.useCallback(
    (e: React.PointerEvent) => {
      if (!e.isPrimary) return;
      cancel();
      suppressNextClickRef.current = true;
      if (!firedLong.current) {
        onShortPress();
      }
    },
    [cancel, onShortPress],
  );

  const onClick = React.useCallback(() => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    onShortPress();
  }, [onShortPress]);

  React.useEffect(() => () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
  }, []);

  return {
    onPointerDown: start,
    onPointerUp: end,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onClick,
  };
}
