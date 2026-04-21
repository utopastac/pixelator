/**
 * Tests for `useSpacebarPan` — the document-level keyboard hook that flags
 * the viewport into pan mode while Space is held.
 *
 * Events are dispatched directly on `document` via `dispatchEvent`, matching
 * the real `document.addEventListener` wiring inside the hook.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useSpacebarPan } from './useSpacebarPan';

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fireKeyDown(code: string, overrides: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', {
    code,
    bubbles: true,
    cancelable: true,
    ...overrides,
  });
  document.dispatchEvent(event);
  return event;
}

function fireKeyUp(code: string) {
  document.dispatchEvent(
    new KeyboardEvent('keyup', { code, bubbles: true, cancelable: true }),
  );
}

function mount(disabled = false) {
  const setIsPanning = vi.fn();
  const { rerender, unmount } = renderHook(
    ({ dis }: { dis: boolean }) => useSpacebarPan(setIsPanning, dis),
    { initialProps: { dis: disabled } },
  );
  return { setIsPanning, rerender, unmount };
}

// ---------------------------------------------------------------------------
// Space keydown / keyup
// ---------------------------------------------------------------------------

describe('useSpacebarPan — Space keydown / keyup', () => {
  it('Space keydown calls setIsPanning(true)', () => {
    const { setIsPanning } = mount();
    act(() => { fireKeyDown('Space'); });
    expect(setIsPanning).toHaveBeenCalledWith(true);
  });

  it('Space keydown calls preventDefault', () => {
    const { setIsPanning: _s } = mount();
    let prevented = false;
    const orig = document.dispatchEvent.bind(document);
    // Dispatch ourselves and inspect the event
    const event = new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true });
    act(() => {
      Object.defineProperty(event, 'preventDefault', {
        value: () => { prevented = true; },
        writable: true,
      });
      document.dispatchEvent(event);
    });
    expect(prevented).toBe(true);
    void orig; // silence unused-var TS check
  });

  it('Space keyup calls setIsPanning(false)', () => {
    const { setIsPanning } = mount();
    act(() => { fireKeyUp('Space'); });
    expect(setIsPanning).toHaveBeenCalledWith(false);
  });

  it('non-Space keydown does NOT call setIsPanning', () => {
    const { setIsPanning } = mount();
    act(() => { fireKeyDown('KeyA'); });
    act(() => { fireKeyDown('Enter'); });
    act(() => { fireKeyDown('ArrowRight'); });
    expect(setIsPanning).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// disabled=true
// ---------------------------------------------------------------------------

describe('useSpacebarPan — disabled=true', () => {
  it('does not call setIsPanning when disabled', () => {
    const { setIsPanning } = mount(true);
    act(() => { fireKeyDown('Space'); });
    act(() => { fireKeyUp('Space'); });
    expect(setIsPanning).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Text input targets are ignored
// ---------------------------------------------------------------------------

describe('useSpacebarPan — text input targets', () => {
  it('does NOT call setIsPanning when target is an INPUT element', () => {
    const { setIsPanning } = mount();
    const input = document.createElement('input');
    document.body.appendChild(input);
    act(() => {
      const event = new KeyboardEvent('keydown', {
        code: 'Space', bubbles: true, cancelable: true,
      });
      Object.defineProperty(event, 'target', { value: input, configurable: true });
      // Dispatch from the input so the event target is the input
      input.dispatchEvent(event);
    });
    // The hook listens on document, but checks event.target
    // We need to dispatch the event directly on document but with the target set.
    // Instead dispatch directly via document with a proper target set:
    act(() => {
      const evt = new KeyboardEvent('keydown', {
        code: 'Space', bubbles: true, cancelable: true,
      });
      // Override the target getter on this event
      Object.defineProperty(evt, 'target', {
        get: () => input,
        configurable: true,
      });
      document.dispatchEvent(evt);
    });
    document.body.removeChild(input);
    expect(setIsPanning).not.toHaveBeenCalled();
  });

  it('does NOT call setIsPanning when target is a TEXTAREA element', () => {
    const { setIsPanning } = mount();
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    act(() => {
      const evt = new KeyboardEvent('keydown', {
        code: 'Space', bubbles: true, cancelable: true,
      });
      Object.defineProperty(evt, 'target', {
        get: () => textarea,
        configurable: true,
      });
      document.dispatchEvent(evt);
    });
    document.body.removeChild(textarea);
    expect(setIsPanning).not.toHaveBeenCalled();
  });

  it('does NOT call setIsPanning when target has isContentEditable=true', () => {
    const { setIsPanning } = mount();
    const div = document.createElement('div');
    Object.defineProperty(div, 'isContentEditable', { get: () => true, configurable: true });
    document.body.appendChild(div);
    act(() => {
      const evt = new KeyboardEvent('keydown', {
        code: 'Space', bubbles: true, cancelable: true,
      });
      Object.defineProperty(evt, 'target', {
        get: () => div,
        configurable: true,
      });
      document.dispatchEvent(evt);
    });
    document.body.removeChild(div);
    expect(setIsPanning).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Cleanup on unmount
// ---------------------------------------------------------------------------

describe('useSpacebarPan — cleanup on unmount', () => {
  it('no longer calls setIsPanning after the hook is unmounted', () => {
    const { setIsPanning, unmount } = mount();
    act(() => { unmount(); });
    act(() => { fireKeyDown('Space'); });
    expect(setIsPanning).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Re-render with disabled toggled true
// ---------------------------------------------------------------------------

describe('useSpacebarPan — re-render disabled toggle', () => {
  it('stops responding after re-rendering with disabled=true', () => {
    const { setIsPanning, rerender } = mount(false);

    // Confirm it works while enabled
    act(() => { fireKeyDown('Space'); });
    expect(setIsPanning).toHaveBeenCalledTimes(1);

    setIsPanning.mockClear();

    // Disable and confirm listener is removed
    act(() => { rerender({ dis: true }); });
    act(() => { fireKeyDown('Space'); });
    expect(setIsPanning).not.toHaveBeenCalled();
  });

  it('resumes responding after re-rendering back to disabled=false', () => {
    const { setIsPanning, rerender } = mount(true);

    act(() => { fireKeyDown('Space'); });
    expect(setIsPanning).not.toHaveBeenCalled();

    act(() => { rerender({ dis: false }); });
    act(() => { fireKeyDown('Space'); });
    expect(setIsPanning).toHaveBeenCalledWith(true);
  });
});
