/**
 * React hook for distinguishing a short press (tap) from a long press on
 * toolbar buttons. Used to attach secondary actions (e.g. opening a sub-menu)
 * to the same button that performs a primary action on a quick click.
 */

import React from 'react';

/** Duration in milliseconds a pointer must be held before the long-press fires. */
export const LONG_PRESS_MS = 400;

/**
 * Returns mouse and touch event handlers to spread onto a trigger element.
 * Holding the element for at least `LONG_PRESS_MS` fires `onLongPress`;
 * releasing before that fires `onShortPress`.
 *
 * Moving the pointer off the element (`onMouseLeave`) cancels a pending long
 * press without triggering either callback.
 *
 * @param onShortPress - Callback invoked when the user releases before the
 *   long-press threshold.
 * @param onLongPress - Callback invoked when the user holds for at least
 *   `LONG_PRESS_MS` milliseconds.
 * @returns An object with `onMouseDown`, `onMouseUp`, `onMouseLeave`,
 *   `onTouchStart`, and `onTouchEnd` handlers to spread onto the element.
 */
export function useLongPress(
  onShortPress: () => void,
  onLongPress: () => void,
) {
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedLong = React.useRef(false);

  const start = React.useCallback(() => {
    firedLong.current = false;
    timerRef.current = setTimeout(() => {
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

  const end = React.useCallback(() => {
    cancel();
    if (!firedLong.current) {
      onShortPress();
    }
  }, [cancel, onShortPress]);

  return {
    onMouseDown: start,
    onMouseUp: end,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: end,
  };
}
