/**
 * Tests for the `useLayers` hook — the core of the Phase-2 layered data
 * model. Every CRUD operation is exercised through renderHook + act so we
 * catch regressions in the invariant guards (min one layer, active-id must
 * reference an existing layer, etc).
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLayers } from './useLayers';
import type { Layer } from '@/lib/storage';

function makeLayer(id: string, name: string, pixels: string[] = []): Layer {
  return { id, name, visible: true, opacity: 1, pixels };
}

function setup() {
  const l1 = makeLayer('l1', 'Background', ['', '', '', '']);
  const l2 = makeLayer('l2', 'Lines', ['#ff0000', '', '', '']);
  return renderHook(() =>
    useLayers({
      width: 2,
      height: 2,
      initialLayers: [l1, l2],
      initialActiveLayerId: 'l2',
    }),
  );
}

describe('useLayers', () => {
  it('initialises with the provided layers and active id', () => {
    const { result } = setup();
    expect(result.current.layers).toHaveLength(2);
    expect(result.current.activeLayerId).toBe('l2');
    expect(result.current.activeLayer.name).toBe('Lines');
    expect(result.current.activeLayerIndex).toBe(1);
  });

  it('setActiveLayerPixels updates only the active layer', () => {
    const { result } = setup();
    const newPixels = ['#00ff00', '#00ff00', '#00ff00', '#00ff00'];
    act(() => result.current.setActiveLayerPixels(newPixels));
    expect(result.current.layers[0].pixels).toEqual(['', '', '', '']); // bg untouched
    expect(result.current.layers[1].pixels).toEqual(newPixels);
  });

  it('addLayer appends a new blank layer and makes it active', () => {
    const { result } = setup();
    act(() => result.current.addLayer());
    expect(result.current.layers).toHaveLength(3);
    expect(result.current.activeLayerId).toBe(result.current.layers[2].id);
    expect(result.current.layers[2].pixels.every((p) => p === '')).toBe(true);
  });

  it('duplicateLayer inserts a clone immediately above the source and activates it', () => {
    const { result } = setup();
    act(() => result.current.duplicateLayer('l1'));
    // Expected order: l1, l1-copy, l2
    expect(result.current.layers[0].id).toBe('l1');
    expect(result.current.layers[1].id).not.toBe('l1');
    expect(result.current.layers[1].pixels).toEqual(['', '', '', '']);
    expect(result.current.layers[2].id).toBe('l2');
    expect(result.current.activeLayerId).toBe(result.current.layers[1].id);
  });

  it('duplicateLayerTo inserts the clone at the requested array index', () => {
    const { result } = setup();
    act(() => result.current.duplicateLayerTo('l2', 0));
    // Clone of l2 should be inserted at index 0 (bottom of stack)
    expect(result.current.layers).toHaveLength(3);
    expect(result.current.layers[0].id).not.toBe('l1');
    expect(result.current.layers[0].id).not.toBe('l2');
    expect(result.current.layers[1].id).toBe('l1');
    expect(result.current.layers[2].id).toBe('l2');
    // New clone is active
    expect(result.current.activeLayerId).toBe(result.current.layers[0].id);
  });

  it('deleteLayer removes the layer and preserves the invariant min-1', () => {
    const { result } = setup();
    act(() => result.current.deleteLayer('l2'));
    expect(result.current.layers).toHaveLength(1);
    expect(result.current.layers[0].id).toBe('l1');
    expect(result.current.activeLayerId).toBe('l1');
  });

  it('deleteLayer falls back to the first layer when the active one is deleted', () => {
    const { result } = setup();
    act(() => result.current.deleteLayer('l2'));
    expect(result.current.activeLayerId).toBe('l1'); // falls back
  });

  it('deleting the only remaining layer seeds a fresh Background (invariant)', () => {
    const { result } = setup();
    // First delete the non-active, then try to delete the last one
    act(() => result.current.deleteLayer('l1'));
    // Only l2 left; try to delete it
    act(() => result.current.deleteLayer('l2'));
    // Invariant: always at least one layer
    expect(result.current.layers.length).toBeGreaterThanOrEqual(1);
    expect(result.current.activeLayerId).toBe(result.current.layers[0].id);
  });

  it('renameLayer updates only the named layer', () => {
    const { result } = setup();
    act(() => result.current.renameLayer('l1', 'Underlay'));
    expect(result.current.layers[0].name).toBe('Underlay');
    expect(result.current.layers[1].name).toBe('Lines');
  });

  it('setLayerVisibility toggles visibility without touching pixels', () => {
    const { result } = setup();
    act(() => result.current.setLayerVisibility('l2', false));
    expect(result.current.layers[1].visible).toBe(false);
    expect(result.current.layers[1].pixels).toEqual(['#ff0000', '', '', '']);
  });

  it('setLayerOpacity clamps to [0, 1]', () => {
    const { result } = setup();
    act(() => result.current.setLayerOpacity('l1', 2));
    expect(result.current.layers[0].opacity).toBe(1);
    act(() => result.current.setLayerOpacity('l1', -0.5));
    expect(result.current.layers[0].opacity).toBe(0);
    act(() => result.current.setLayerOpacity('l1', 0.4));
    expect(result.current.layers[0].opacity).toBeCloseTo(0.4);
  });

  it('moveLayer reorders the stack', () => {
    const { result } = setup();
    act(() => result.current.moveLayer('l2', 0));
    expect(result.current.layers[0].id).toBe('l2');
    expect(result.current.layers[1].id).toBe('l1');
  });

  it('setActiveLayerId only accepts ids that exist in the stack', () => {
    const { result } = setup();
    act(() => result.current.setActiveLayerId('nope'));
    expect(result.current.activeLayerId).toBe('l2'); // unchanged
    act(() => result.current.setActiveLayerId('l1'));
    expect(result.current.activeLayerId).toBe('l1');
  });

  it('replaceLayers wholesale swaps the stack and resets active via invariant', () => {
    const { result } = setup();
    const nextLayers: Layer[] = [makeLayer('z', 'Fresh', ['', '', '', ''])];
    act(() => result.current.replaceLayers(nextLayers, 'nonexistent'));
    expect(result.current.layers).toHaveLength(1);
    expect(result.current.layers[0].id).toBe('z');
    // Invariant falls back to first layer when the supplied active id is
    // missing from the new stack.
    expect(result.current.activeLayerId).toBe('z');
  });

  it('copyIntoActiveLayerPixels mutates the existing buffer in place', () => {
    const { result } = setup();
    const beforeRef = result.current.layers[1].pixels;
    const source = ['#aa', '#bb', '#cc', '#dd'];
    act(() => result.current.copyIntoActiveLayerPixels(source));
    expect(result.current.layers[1].pixels).toBe(beforeRef);
    expect(result.current.layers[1].pixels).toEqual(source);
  });
});
