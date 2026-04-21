/**
 * Tests for `useDrawings` — app-level state for the drawings list, current
 * selection, and autosave to localStorage. The autosave debounce inside
 * `updateCurrentLayers` is skipped (timer-based and not the interesting
 * behaviour); create/rename/duplicate/delete/select are the high-signal
 * operations.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDrawings } from './useDrawings';
import { SEEDED_KEY, SEED_VERSION } from '@/lib/seedDrawings';

beforeEach(() => {
  localStorage.clear();
  // Every test below operates on a fresh empty store. The seed-once behaviour
  // has its own describe block — set the flag to the latest version so the
  // general CRUD tests keep their historical "starts empty" assumption.
  localStorage.setItem(SEEDED_KEY, String(SEED_VERSION));
});

describe('useDrawings', () => {
  it('initialises empty when localStorage is empty', () => {
    const { result } = renderHook(() => useDrawings());
    expect(result.current.drawings).toEqual([]);
    expect(result.current.currentDrawing).toBeNull();
    expect(result.current.currentDrawingId).toBeNull();
  });

  it('createDrawing prepends a new drawing and selects it', () => {
    const { result } = renderHook(() => useDrawings());
    act(() => {
      result.current.createDrawing({ name: 'First', width: 8, height: 8 });
    });
    expect(result.current.drawings).toHaveLength(1);
    expect(result.current.drawings[0].name).toBe('First');
    expect(result.current.drawings[0].width).toBe(8);
    expect(result.current.drawings[0].layers).toHaveLength(1);
    expect(result.current.currentDrawingId).toBe(result.current.drawings[0].id);
    expect(result.current.currentDrawing?.name).toBe('First');
  });

  it('renameDrawing updates only the named drawing and bumps updatedAt', () => {
    const { result } = renderHook(() => useDrawings());
    act(() => {
      result.current.createDrawing({ name: 'A' });
      result.current.createDrawing({ name: 'B' });
    });
    const targetId = result.current.drawings[1].id; // 'A' — prepended first, so it's at index 1
    const beforeUpdate = result.current.drawings[1].updatedAt;
    act(() => result.current.renameDrawing(targetId, 'A (renamed)'));
    const renamed = result.current.drawings.find((d) => d.id === targetId)!;
    expect(renamed.name).toBe('A (renamed)');
    expect(renamed.updatedAt).toBeGreaterThanOrEqual(beforeUpdate);
    // The other drawing is untouched
    expect(result.current.drawings.find((d) => d.id !== targetId)?.name).toBe('B');
  });

  it('duplicateDrawing deep-clones layers with fresh ids and activates the copy', () => {
    const { result } = renderHook(() => useDrawings());
    act(() => { result.current.createDrawing({ name: 'Original' }); });
    const sourceId = result.current.drawings[0].id;
    const sourceLayerIds = result.current.drawings[0].layers.map((l) => l.id);

    act(() => { result.current.duplicateDrawing(sourceId); });

    expect(result.current.drawings).toHaveLength(2);
    const copy = result.current.drawings[0];
    expect(copy.name).toBe('Original copy');
    expect(copy.id).not.toBe(sourceId);
    // Each cloned layer must have a fresh id that doesn't collide with the source
    for (const l of copy.layers) {
      expect(sourceLayerIds).not.toContain(l.id);
    }
    // The active layer id points at one of the new layer ids (not a source id)
    expect(copy.layers.some((l) => l.id === copy.activeLayerId)).toBe(true);
    // The duplicate is the new current drawing
    expect(result.current.currentDrawingId).toBe(copy.id);
  });

  it('deleteDrawing removes the drawing and clears current if it was selected', () => {
    const { result } = renderHook(() => useDrawings());
    act(() => {
      result.current.createDrawing({ name: 'Keep' });
      result.current.createDrawing({ name: 'Delete me' });
    });
    const deleteId = result.current.currentDrawingId!;
    act(() => result.current.deleteDrawing(deleteId));
    expect(result.current.drawings).toHaveLength(1);
    expect(result.current.drawings[0].name).toBe('Keep');
    // Current is cleared because we deleted the selected drawing
    expect(result.current.currentDrawingId).toBeNull();
  });

  it('selectDrawing switches the current selection', () => {
    const { result } = renderHook(() => useDrawings());
    act(() => {
      result.current.createDrawing({ name: 'A' });
      result.current.createDrawing({ name: 'B' });
    });
    const aId = result.current.drawings[1].id; // A was prepended first
    act(() => result.current.selectDrawing(aId));
    expect(result.current.currentDrawingId).toBe(aId);
    expect(result.current.currentDrawing?.name).toBe('A');
  });

  it('appendDrawings prepends incoming drawings and selects the first of them', () => {
    const { result } = renderHook(() => useDrawings());
    act(() => { result.current.createDrawing({ name: 'Existing' }); });
    const existingId = result.current.drawings[0].id;

    const now = Date.now();
    const incoming = [
      { id: 'new-1', name: 'New A', width: 4, height: 4, layers: [
        { id: 'la', name: 'Background', visible: true, opacity: 1, pixels: new Array(16).fill('') },
      ], activeLayerId: 'la', createdAt: now, updatedAt: now },
      { id: 'new-2', name: 'New B', width: 4, height: 4, layers: [
        { id: 'lb', name: 'Background', visible: true, opacity: 1, pixels: new Array(16).fill('') },
      ], activeLayerId: 'lb', createdAt: now, updatedAt: now },
    ];
    act(() => { result.current.appendDrawings(incoming); });

    // Incoming drawings land at the front, in order.
    expect(result.current.drawings.map((d) => d.name)).toEqual(['New A', 'New B', 'Existing']);
    // First incoming drawing becomes the current selection.
    expect(result.current.currentDrawingId).toBe('new-1');
    // Existing drawing id is preserved.
    expect(result.current.drawings[2].id).toBe(existingId);
  });

  it('appendDrawings is a no-op when given an empty list', () => {
    const { result } = renderHook(() => useDrawings());
    act(() => { result.current.createDrawing({ name: 'A' }); });
    const before = result.current.drawings;
    const beforeId = result.current.currentDrawingId;
    act(() => { result.current.appendDrawings([]); });
    expect(result.current.drawings).toBe(before);
    expect(result.current.currentDrawingId).toBe(beforeId);
  });

  it('persists to localStorage and restores across mounts', () => {
    const { result, unmount } = renderHook(() => useDrawings());
    act(() => result.current.createDrawing({ name: 'Persisted', width: 8, height: 8 }));
    const drawing = result.current.drawings[0];
    unmount();

    // Fresh mount — full Drawing shape restores from localStorage
    const remounted = renderHook(() => useDrawings());
    expect(remounted.result.current.drawings).toHaveLength(1);
    const restored = remounted.result.current.drawings[0];
    expect(restored.id).toBe(drawing.id);
    expect(restored.name).toBe(drawing.name);
    expect(restored.width).toBe(drawing.width);
    expect(restored.height).toBe(drawing.height);
    expect(restored.activeLayerId).toBe(drawing.activeLayerId);
    expect(restored.layers).toHaveLength(drawing.layers.length);
    expect(remounted.result.current.currentDrawingId).toBe(drawing.id);
  });

  it('updateCurrentActiveLayerId persists the active layer across mounts', () => {
    const { result, unmount } = renderHook(() => useDrawings());
    act(() => result.current.createDrawing({ name: 'A' }));
    const drawingId = result.current.drawings[0].id;
    const originalLayerId = result.current.drawings[0].activeLayerId;
    const fakeSecondLayerId = 'layer-2';

    act(() => result.current.updateCurrentActiveLayerId(fakeSecondLayerId));
    expect(result.current.drawings[0].activeLayerId).toBe(fakeSecondLayerId);
    expect(result.current.drawings[0].activeLayerId).not.toBe(originalLayerId);
    unmount();

    // Fresh mount — activeLayerId survives the reload
    const remounted = renderHook(() => useDrawings());
    const restored = remounted.result.current.drawings.find((d) => d.id === drawingId)!;
    expect(restored.activeLayerId).toBe(fakeSecondLayerId);
  });

  it('setDrawingPaletteId updates paletteId without touching layers or pixels', () => {
    const { result } = renderHook(() => useDrawings());
    act(() => result.current.createDrawing({ name: 'A', width: 4, height: 4 }));
    const before = result.current.drawings[0];
    const pixelsBefore = [...before.layers[0].pixels];

    act(() => result.current.setDrawingPaletteId(before.id, 'pico-8'));

    const after = result.current.drawings[0];
    expect(after.paletteId).toBe('pico-8');
    expect(after.layers).toHaveLength(before.layers.length);
    expect(after.layers[0].id).toBe(before.layers[0].id);
    expect(after.layers[0].pixels).toEqual(pixelsBefore);
  });

  it('updateCurrentLayers is debounced — state updates after 300 ms, not immediately', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useDrawings());
      act(() => result.current.createDrawing({ name: 'A', width: 2, height: 2 }));
      const drawing = result.current.drawings[0];
      const updatedLayer = {
        ...drawing.layers[0],
        pixels: ['#ff0000', '#ff0000', '#ff0000', '#ff0000'],
      };

      act(() => result.current.updateCurrentLayers([updatedLayer]));
      // State not updated yet — debounce hasn't fired.
      expect(result.current.drawings[0].layers[0].pixels[0]).toBe('');

      act(() => vi.advanceTimersByTime(300));
      expect(result.current.drawings[0].layers[0].pixels[0]).toBe('#ff0000');
    } finally {
      vi.useRealTimers();
    }
  });

  it('structural mutations (rename, palette) persist immediately without waiting for a debounce', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useDrawings());
      act(() => result.current.createDrawing({ name: 'Before' }));
      const drawingId = result.current.drawings[0].id;

      act(() => result.current.renameDrawing(drawingId, 'After'));
      // No timer advance — should be reflected in state immediately.
      expect(result.current.drawings[0].name).toBe('After');

      act(() => result.current.setDrawingPaletteId(drawingId, 'pico-8'));
      expect(result.current.drawings[0].paletteId).toBe('pico-8');
    } finally {
      vi.useRealTimers();
    }
  });

  it('updateCurrentActiveLayerId is a no-op when no drawing is selected', () => {
    const { result } = renderHook(() => useDrawings());
    // No drawing created — currentDrawingId is null
    expect(result.current.currentDrawingId).toBeNull();
    act(() => result.current.updateCurrentActiveLayerId('any-id'));
    expect(result.current.drawings).toHaveLength(0);
  });
});

describe('useDrawings seed-once', () => {
  beforeEach(() => {
    // Full reset — the outer beforeEach sets the seed flag. For these tests
    // we want to control the flag explicitly per case.
    localStorage.clear();
  });

  it('seeds the full set on first launch', () => {
    const { result } = renderHook(() => useDrawings());
    expect(result.current.drawings).toHaveLength(9);
    expect(result.current.drawings.map((d) => d.name)).toEqual([
      'template/Turtle', 'template/Face', 'template/Beach', 'template/Cityscape',
      'template/Heart', 'template/Mushroom', 'template/Cat', 'template/Rocket',
      'icons/Icons-16',
    ]);
    // Canvas sizes per drawing match their planned values.
    expect(result.current.drawings.map((d) => d.width)).toEqual([
      16, 32, 64, 128, 8, 16, 24, 24, 16,
    ]);
    // Flag records the latest version so subsequent loads don't re-seed.
    expect(localStorage.getItem(SEEDED_KEY)).toBe(String(SEED_VERSION));
    // The first seed is selected.
    expect(result.current.currentDrawingId).toBe(result.current.drawings[0].id);
  });

  it('does not re-seed if the flag is at the current version and the store is empty', () => {
    // Simulate: user deleted every seed, refreshed. Flag stays at current.
    localStorage.setItem(SEEDED_KEY, String(SEED_VERSION));
    const { result } = renderHook(() => useDrawings());
    expect(result.current.drawings).toEqual([]);
    expect(result.current.currentDrawingId).toBeNull();
  });

  it('appends only the new batch for users at an older seed version', () => {
    // Simulate: user installed before v2 and still has their original 4 seeds
    // + a user-created drawing. On reload they should get the 4 v2 drawings
    // appended, with their existing state preserved.
    localStorage.setItem(SEEDED_KEY, '1');
    const existing = [
      { id: 'user-1', name: 'My Drawing', width: 16, height: 16, layers: [
        { id: 'l1', name: 'Background', visible: true, opacity: 1, pixels: new Array(256).fill('') },
      ], activeLayerId: 'l1', createdAt: 1, updatedAt: 1 },
    ];
    localStorage.setItem('pixelator.store', JSON.stringify({
      schemaVersion: 2, drawings: existing, currentDrawingId: 'user-1',
    }));

    const { result } = renderHook(() => useDrawings());
    // User's existing drawing stays at index 0; v2 + v3 batches appended after.
    expect(result.current.drawings[0].id).toBe('user-1');
    expect(result.current.drawings.slice(1).map((d) => d.name)).toEqual([
      'template/Heart', 'template/Mushroom', 'template/Cat', 'template/Rocket',
      'icons/Icons-16',
    ]);
    // Current selection preserved.
    expect(result.current.currentDrawingId).toBe('user-1');
    // Flag advanced to the latest version.
    expect(localStorage.getItem(SEEDED_KEY)).toBe(String(SEED_VERSION));
  });
});
