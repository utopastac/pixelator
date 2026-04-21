import { useEffect } from 'react';
import type { PixelArtTool } from '../PixelArtEditor';

/**
 * Mirrors window-level pointermove events into the editor's move handler
 * while the pen tool is active. The pen tool is click-based (no pressed
 * button between anchors), so pointer capture doesn't deliver moves when
 * the cursor leaves the canvas — this hook restores that behaviour so the
 * rubber-band preview keeps tracking.
 */
export function usePenHoverTracker(
  activeTool: PixelArtTool,
  handleMouseMove: (e: { clientX: number; clientY: number; shiftKey: boolean }) => void,
  disabled: boolean,
) {
  useEffect(() => {
    if (disabled || activeTool !== 'pen') return;
    const onWindowMove = (e: PointerEvent) => {
      handleMouseMove({ clientX: e.clientX, clientY: e.clientY, shiftKey: e.shiftKey });
    };
    window.addEventListener('pointermove', onWindowMove);
    return () => window.removeEventListener('pointermove', onWindowMove);
  }, [disabled, activeTool, handleMouseMove]);
}
