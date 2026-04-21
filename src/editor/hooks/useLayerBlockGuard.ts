import { useState, useCallback, useRef, useEffect } from 'react';
import type { Layer } from '@/lib/storage';

const TOAST_DURATION_MS = 2500;

export interface UseLayerBlockGuardReturn {
  /** Toast shown when a paint commit is blocked. Null when no toast is active. */
  blockToast: 'hidden' | 'locked' | null;
  /** Returns true when a paint commit may proceed. When the active layer is
   *  hidden or locked, surfaces the toast and returns false. Hidden takes
   *  priority over locked (show it before locked can even apply). */
  allowCommitOrSignal: () => boolean;
}

/**
 * Guards paint operations on a hidden or locked layer. Surfaces a short toast
 * when the user attempts a commit on a blocked layer and returns false so the
 * caller can short-circuit. Dispatches (mid-drag previews) are silent.
 */
export function useLayerBlockGuard(activeLayer: Layer | null): UseLayerBlockGuardReturn {
  const visible = activeLayer?.visible !== false;
  const locked = activeLayer?.locked === true;
  const blocked = !visible || locked;

  const [blockToast, setBlockToast] = useState<'hidden' | 'locked' | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const allowCommitOrSignal = useCallback(() => {
    if (!blocked) return true;
    const reason: 'hidden' | 'locked' = !visible ? 'hidden' : 'locked';
    setBlockToast(reason);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setBlockToast(null);
      timerRef.current = null;
    }, TOAST_DURATION_MS);
    return false;
  }, [blocked, visible]);

  return { blockToast, allowCommitOrSignal };
}
