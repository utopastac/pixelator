/**
 * Tests for `useDrawingHashSync` — two-way sync between `window.location.hash`
 * (`#/d/<id>`) and the active drawing id.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDrawingHashSync } from './useDrawingHashSync';

beforeEach(() => {
  window.location.hash = '';
});

function fireHashChange() {
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

describe('useDrawingHashSync', () => {
  it('writes the current drawing id to location.hash', () => {
    const onSelect = vi.fn();
    renderHook(() =>
      useDrawingHashSync({
        drawings: [{ id: 'abc' }, { id: 'def' }],
        currentDrawingId: 'abc',
        onSelect,
      }),
    );
    expect(window.location.hash).toBe('#/d/abc');
  });

  it('updates the hash when currentDrawingId changes', () => {
    const onSelect = vi.fn();
    const { rerender } = renderHook(
      ({ id }: { id: string | null }) =>
        useDrawingHashSync({
          drawings: [{ id: 'abc' }, { id: 'def' }],
          currentDrawingId: id,
          onSelect,
        }),
      { initialProps: { id: 'abc' as string | null } },
    );
    expect(window.location.hash).toBe('#/d/abc');
    rerender({ id: 'def' });
    expect(window.location.hash).toBe('#/d/def');
  });

  it('adopts a valid drawing id from the URL on mount', () => {
    window.location.hash = '#/d/def';
    const onSelect = vi.fn();
    renderHook(() =>
      useDrawingHashSync({
        drawings: [{ id: 'abc' }, { id: 'def' }],
        currentDrawingId: 'abc',
        onSelect,
      }),
    );
    expect(onSelect).toHaveBeenCalledWith('def');
  });

  it('ignores an on-mount hash that does not name a known drawing', () => {
    window.location.hash = '#/d/nope';
    const onSelect = vi.fn();
    renderHook(() =>
      useDrawingHashSync({
        drawings: [{ id: 'abc' }],
        currentDrawingId: 'abc',
        onSelect,
      }),
    );
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('calls onSelect on hashchange when the new id is valid', () => {
    const onSelect = vi.fn();
    renderHook(() =>
      useDrawingHashSync({
        drawings: [{ id: 'abc' }, { id: 'def' }],
        currentDrawingId: 'abc',
        onSelect,
      }),
    );
    onSelect.mockClear();
    act(() => {
      window.location.hash = '#/d/def';
      fireHashChange();
    });
    expect(onSelect).toHaveBeenCalledWith('def');
  });

  it('ignores hashchange events pointing at unknown drawing ids', () => {
    const onSelect = vi.fn();
    renderHook(() =>
      useDrawingHashSync({
        drawings: [{ id: 'abc' }],
        currentDrawingId: 'abc',
        onSelect,
      }),
    );
    onSelect.mockClear();
    act(() => {
      window.location.hash = '#/d/ghost';
      fireHashChange();
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('ignores hashchange events whose hash lacks the #/d/ prefix', () => {
    const onSelect = vi.fn();
    renderHook(() =>
      useDrawingHashSync({
        drawings: [{ id: 'abc' }],
        currentDrawingId: 'abc',
        onSelect,
      }),
    );
    onSelect.mockClear();
    act(() => {
      window.location.hash = '#something-else';
      fireHashChange();
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('extracts the id when the hash has a trailing path segment', () => {
    const onSelect = vi.fn();
    renderHook(() =>
      useDrawingHashSync({
        drawings: [{ id: 'abc' }, { id: 'def' }],
        currentDrawingId: 'abc',
        onSelect,
      }),
    );
    onSelect.mockClear();
    act(() => {
      window.location.hash = '#/d/def/layer/xyz';
      fireHashChange();
    });
    expect(onSelect).toHaveBeenCalledWith('def');
  });

  it('same-id hashchange echo is safe (onSelect still fires, no loop)', () => {
    // The module comment explicitly says the echo is a no-op at the parent
    // layer (onSelect with an already-current id doesn't change state), not
    // that the hook suppresses it. Just confirm it doesn't throw / loop.
    const onSelect = vi.fn();
    renderHook(() =>
      useDrawingHashSync({
        drawings: [{ id: 'abc' }],
        currentDrawingId: 'abc',
        onSelect,
      }),
    );
    onSelect.mockClear();
    act(() => {
      fireHashChange();
    });
    expect(onSelect).toHaveBeenCalledWith('abc');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
