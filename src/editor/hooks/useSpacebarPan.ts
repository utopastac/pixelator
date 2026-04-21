import { useEffect } from 'react';

/**
 * While Space is held (and focus isn't in a text input), flags the viewport
 * into pan-mode. Consumers use that flag to reroute mouse drags to pan instead
 * of invoking the active tool.
 */
export function useSpacebarPan(setIsPanning: (b: boolean) => void, disabled: boolean) {
  useEffect(() => {
    if (disabled) return;
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      e.preventDefault();
      setIsPanning(true);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      setIsPanning(false);
    };
    document.addEventListener('keydown', onDown);
    document.addEventListener('keyup', onUp);
    return () => {
      document.removeEventListener('keydown', onDown);
      document.removeEventListener('keyup', onUp);
    };
  }, [disabled, setIsPanning]);
}
