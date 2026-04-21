/**
 * Tests for `usePenHoverTracker` — the window-level pointermove hook that
 * mirrors pointer events into the editor's move handler while the pen tool
 * is active.
 *
 * Events are dispatched directly on `window` via `dispatchEvent`, matching
 * the real `window.addEventListener` wiring inside the hook.
 *
 * jsdom does not implement PointerEvent, so we polyfill it here by extending
 * MouseEvent (which jsdom does support). The hook only reads clientX, clientY,
 * and shiftKey — all inherited from MouseEvent.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { usePenHoverTracker } from './usePenHoverTracker';
import type { PixelArtTool } from '../PixelArtEditor';

// ---------------------------------------------------------------------------
// PointerEvent polyfill for jsdom
// ---------------------------------------------------------------------------

if (typeof PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
    }
  }
  (globalThis as Record<string, unknown>).PointerEvent = PointerEventPolyfill;
}

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function firePointerMove(init: PointerEventInit = {}) {
  const event = new PointerEvent('pointermove', {
    clientX: 0,
    clientY: 0,
    shiftKey: false,
    bubbles: false,
    ...init,
  });
  window.dispatchEvent(event);
  return event;
}

function mount(activeTool: PixelArtTool, disabled: boolean) {
  const handleMouseMove = vi.fn();
  const { rerender, unmount } = renderHook(
    ({ tool, dis }: { tool: PixelArtTool; dis: boolean }) =>
      usePenHoverTracker(tool, handleMouseMove, dis),
    { initialProps: { tool: activeTool, dis: disabled } },
  );
  return { handleMouseMove, rerender, unmount };
}

// ---------------------------------------------------------------------------
// Non-pen tool — listener not added
// ---------------------------------------------------------------------------

describe('usePenHoverTracker — non-pen tool', () => {
  it('does not forward events when activeTool is not pen', () => {
    const { handleMouseMove } = mount('paint' as PixelArtTool, false);
    act(() => { firePointerMove({ clientX: 5, clientY: 10 }); });
    expect(handleMouseMove).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// disabled=true — listener not added
// ---------------------------------------------------------------------------

describe('usePenHoverTracker — disabled', () => {
  it('does not forward events when disabled is true', () => {
    const { handleMouseMove } = mount('pen' as PixelArtTool, true);
    act(() => { firePointerMove({ clientX: 5, clientY: 10 }); });
    expect(handleMouseMove).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Active pen tool, not disabled — events forwarded
// ---------------------------------------------------------------------------

describe('usePenHoverTracker — pen tool active', () => {
  it('forwards pointermove events with correct coordinates', () => {
    const { handleMouseMove } = mount('pen' as PixelArtTool, false);
    act(() => {
      firePointerMove({ clientX: 5, clientY: 10, shiftKey: false });
    });
    expect(handleMouseMove).toHaveBeenCalledOnce();
    expect(handleMouseMove).toHaveBeenCalledWith({ clientX: 5, clientY: 10, shiftKey: false });
  });

  it('forwards shiftKey=true when shift is held', () => {
    const { handleMouseMove } = mount('pen' as PixelArtTool, false);
    act(() => {
      firePointerMove({ clientX: 20, clientY: 30, shiftKey: true });
    });
    expect(handleMouseMove).toHaveBeenCalledOnce();
    expect(handleMouseMove).toHaveBeenCalledWith({ clientX: 20, clientY: 30, shiftKey: true });
  });
});

// ---------------------------------------------------------------------------
// Cleanup on unmount
// ---------------------------------------------------------------------------

describe('usePenHoverTracker — cleanup on unmount', () => {
  it('removes listener on unmount and stops forwarding events', () => {
    const { handleMouseMove, unmount } = mount('pen' as PixelArtTool, false);
    act(() => { unmount(); });
    act(() => { firePointerMove({ clientX: 1, clientY: 2 }); });
    expect(handleMouseMove).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// activeTool changes away from pen
// ---------------------------------------------------------------------------

describe('usePenHoverTracker — activeTool change', () => {
  it('removes listener when activeTool changes from pen to another tool', () => {
    const { handleMouseMove, rerender } = mount('pen' as PixelArtTool, false);

    // Confirm it works while pen is active
    act(() => { firePointerMove({ clientX: 1, clientY: 1 }); });
    expect(handleMouseMove).toHaveBeenCalledTimes(1);

    handleMouseMove.mockClear();

    // Switch to a different tool
    act(() => { rerender({ tool: 'paint' as PixelArtTool, dis: false }); });
    act(() => { firePointerMove({ clientX: 2, clientY: 2 }); });
    expect(handleMouseMove).not.toHaveBeenCalled();
  });
});
