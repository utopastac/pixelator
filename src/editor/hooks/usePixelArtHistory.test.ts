/**
 * Tests for `usePixelArtHistory` — the layer-aware undo/redo wrapper that is
 * the only safe write path for layer mutations (see CLAUDE.md). Exercises the
 * snapshot / dispatch / commit / resize / structural-ops surface through
 * renderHook + act.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HISTORY_LIMIT, usePixelArtHistory } from './usePixelArtHistory';
import { usePixelArtSelection } from './usePixelArtSelection';
import type { Layer } from '@/lib/storage';

function makeLayer(id: string, name: string, pixels: string[]): Layer {
  return { id, name, visible: true, opacity: 1, pixels };
}

function setup(overrides?: { onChange?: (layers: Layer[]) => void; onSizeChange?: (w: number, h: number) => void }) {
  const l1 = makeLayer('l1', 'Background', ['', '', '', '']);
  const l2 = makeLayer('l2', 'Lines', ['#ff0000', '', '', '']);
  const onChange = overrides?.onChange ?? vi.fn();
  const onSizeChange = overrides?.onSizeChange ?? vi.fn();
  const hook = renderHook(() =>
    usePixelArtHistory({
      width: 2,
      height: 2,
      initialLayers: [l1, l2],
      initialActiveLayerId: 'l2',
      onChange,
      onSizeChange,
    }),
  );
  return { ...hook, onChange, onSizeChange };
}

describe('usePixelArtHistory', () => {
  it('initialises from initialSeed: layers, active id, and empty history', () => {
    const { result } = setup();
    expect(result.current.layers).toHaveLength(2);
    expect(result.current.activeLayerId).toBe('l2');
    expect(result.current.pixels).toEqual(['#ff0000', '', '', '']);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('commitPixels snapshots, updates active-layer pixels, and undo restores prior state', () => {
    const { result } = setup();
    const next = ['#00ff00', '#00ff00', '#00ff00', '#00ff00'];
    act(() => result.current.commitPixels(next));
    expect(result.current.pixels).toEqual(next);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => result.current.undo());
    expect(result.current.pixels).toEqual(['#ff0000', '', '', '']);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('dispatchPixels writes without snapshotting (undo does not see intermediate frames)', async () => {
    const { result } = setup();
    act(() => {
      result.current.dispatchPixels(['#111', '', '', '']);
      result.current.dispatchPixels(['#222', '', '', '']);
      result.current.dispatchPixels(['#333', '', '', '']);
    });
    await waitFor(() => {
      expect(result.current.pixels).toEqual(['#333', '', '', '']);
    });
    // No snapshots pushed.
    expect(result.current.canUndo).toBe(false);

    // A subsequent commit snapshots whatever dispatch last wrote, so undo
    // goes back to that drag frame (not to the original initial state).
    act(() => result.current.commitPixels(['#444', '', '', '']));
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    expect(result.current.pixels).toEqual(['#333', '', '', '']);
  });

  it('commitResize atomically changes layers + width/height and undo restores both', () => {
    const onSizeChange = vi.fn();
    const onChange = vi.fn();
    const { result } = setup({ onChange, onSizeChange });
    const biggerLayers: Layer[] = [
      makeLayer('l1', 'Background', Array(9).fill('')),
      makeLayer('l2', 'Lines', Array(9).fill('#abc')),
    ];
    act(() => result.current.commitResize(biggerLayers, 3, 3));
    expect(result.current.layers[1].pixels).toHaveLength(9);
    expect(onSizeChange).toHaveBeenCalledWith(3, 3);
    expect(onChange).toHaveBeenCalledWith(biggerLayers);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    // The layers snapshot is fully restored (pixels + count).
    expect(result.current.layers[1].pixels).toEqual(['#ff0000', '', '', '']);
    // onChange fires on undo with the restored layers.
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: 'l1', pixels: ['', '', '', ''] }),
      expect.objectContaining({ id: 'l2', pixels: ['#ff0000', '', '', ''] }),
    ]);
  });

  it('addLayer snapshots, fires onChange, and is undoable', () => {
    const onChange = vi.fn();
    const { result } = setup({ onChange });
    act(() => result.current.addLayer('Extra'));
    expect(result.current.layers).toHaveLength(3);
    expect(result.current.layers[2].name).toBe('Extra');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.layers).toHaveLength(2);
  });

  it('duplicateLayer snapshots and fires onChange', () => {
    const onChange = vi.fn();
    const { result } = setup({ onChange });
    act(() => result.current.duplicateLayer('l2'));
    expect(result.current.layers).toHaveLength(3);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(result.current.canUndo).toBe(true);
  });

  it('deleteLayer snapshots and fires onChange', () => {
    const onChange = vi.fn();
    const { result } = setup({ onChange });
    act(() => result.current.deleteLayer('l1'));
    expect(result.current.layers).toHaveLength(1);
    expect(result.current.layers[0].id).toBe('l2');
    expect(onChange).toHaveBeenCalledTimes(1);

    act(() => result.current.undo());
    expect(result.current.layers).toHaveLength(2);
  });

  it('renameLayer snapshots and fires onChange', () => {
    const onChange = vi.fn();
    const { result } = setup({ onChange });
    act(() => result.current.renameLayer('l1', 'Underlay'));
    expect(result.current.layers[0].name).toBe('Underlay');
    expect(onChange).toHaveBeenCalledTimes(1);

    act(() => result.current.undo());
    expect(result.current.layers[0].name).toBe('Background');
  });

  it('moveLayer snapshots, reorders, and fires onChange', () => {
    const onChange = vi.fn();
    const { result } = setup({ onChange });
    act(() => result.current.moveLayer('l2', 0));
    expect(result.current.layers[0].id).toBe('l2');
    expect(result.current.layers[1].id).toBe('l1');
    expect(onChange).toHaveBeenCalledTimes(1);

    act(() => result.current.undo());
    expect(result.current.layers[0].id).toBe('l1');
  });

  it('setLayerVisibility snapshots and fires onChange', () => {
    const onChange = vi.fn();
    const { result } = setup({ onChange });
    act(() => result.current.setLayerVisibility('l2', false));
    expect(result.current.layers[1].visible).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);

    act(() => result.current.undo());
    expect(result.current.layers[1].visible).toBe(true);
  });

  it('setLayerOpacity clamps, snapshots, and fires onChange', () => {
    const onChange = vi.fn();
    const { result } = setup({ onChange });
    act(() => result.current.setLayerOpacity('l1', 2));
    expect(result.current.layers[0].opacity).toBe(1);
    act(() => result.current.setLayerOpacity('l1', -1));
    expect(result.current.layers[0].opacity).toBe(0);
    expect(onChange).toHaveBeenCalledTimes(2);

    act(() => result.current.undo());
    expect(result.current.layers[0].opacity).toBe(1);
  });

  it('commit → commit → undo → undo → redo → redo returns to the final state', () => {
    const { result } = setup();
    const s1 = ['#111', '', '', ''];
    const s2 = ['#222', '', '', ''];
    act(() => result.current.commitPixels(s1));
    act(() => result.current.commitPixels(s2));
    expect(result.current.pixels).toEqual(s2);

    act(() => result.current.undo());
    expect(result.current.pixels).toEqual(s1);
    act(() => result.current.undo());
    expect(result.current.pixels).toEqual(['#ff0000', '', '', '']);
    expect(result.current.canUndo).toBe(false);

    act(() => result.current.redo());
    expect(result.current.pixels).toEqual(s1);
    act(() => result.current.redo());
    expect(result.current.pixels).toEqual(s2);
    expect(result.current.canRedo).toBe(false);
  });

  it('committing after an undo clears the redo stack', () => {
    const { result } = setup();
    act(() => result.current.commitPixels(['#111', '', '', '']));
    act(() => result.current.commitPixels(['#222', '', '', '']));
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.commitPixels(['#333', '', '', '']));
    expect(result.current.canRedo).toBe(false);
    expect(result.current.pixels).toEqual(['#333', '', '', '']);
  });

  it('rotateLayer rotates a 2×2 square 90° clockwise', () => {
    // Layout (row-major):  A B   →CW→  C A
    //                      C D          D B
    const l1 = makeLayer('l1', 'Background', ['', '', '', '']);
    const l2 = makeLayer('l2', 'Art', ['#a', '#b', '#c', '#d']);
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      usePixelArtHistory({
        width: 2,
        height: 2,
        initialLayers: [l1, l2],
        initialActiveLayerId: 'l2',
        onChange,
      }),
    );
    act(() => result.current.rotateLayer('l2', 'cw'));
    expect(result.current.layers[1].pixels).toEqual(['#c', '#a', '#d', '#b']);
  });

  it('rotateLayer rotates a 2×2 square 90° counter-clockwise', () => {
    const l1 = makeLayer('l1', 'Background', ['', '', '', '']);
    const l2 = makeLayer('l2', 'Art', ['#a', '#b', '#c', '#d']);
    const { result } = renderHook(() =>
      usePixelArtHistory({
        width: 2,
        height: 2,
        initialLayers: [l1, l2],
        initialActiveLayerId: 'l2',
      }),
    );
    act(() => result.current.rotateLayer('l2', 'ccw'));
    // A B  →CCW→  B D
    // C D         A C
    expect(result.current.layers[1].pixels).toEqual(['#b', '#d', '#a', '#c']);
  });

  it('rotateLayer is a single undo step: undo restores original, redo reapplies', () => {
    const { result } = setup();
    // l2 starts as ['#ff0000', '', '', '']
    act(() => result.current.rotateLayer('l2', 'cw'));
    const rotated = result.current.layers[1].pixels.slice();
    expect(rotated).not.toEqual(['#ff0000', '', '', '']);

    act(() => result.current.undo());
    expect(result.current.layers[1].pixels).toEqual(['#ff0000', '', '', '']);

    act(() => result.current.redo());
    expect(result.current.layers[1].pixels).toEqual(rotated);
  });

  it('rotateLayer fires onChange with the updated layer stack', () => {
    const onChange = vi.fn();
    const { result } = setup({ onChange });
    act(() => result.current.rotateLayer('l2', 'cw'));
    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0][0] as Layer[];
    expect(arg[1].id).toBe('l2');
    expect(arg[1].pixels).toEqual(result.current.layers[1].pixels);
  });

  it('rotateLayer is a no-op for a non-existent id (no snapshot, no onChange)', () => {
    const onChange = vi.fn();
    const { result } = setup({ onChange });
    act(() => result.current.rotateLayer('does-not-exist', 'cw'));
    expect(result.current.canUndo).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rotateLayer only touches the target layer, leaving others untouched', () => {
    const l1 = makeLayer('l1', 'Background', ['#x', '#x', '#x', '#x']);
    const l2 = makeLayer('l2', 'Art', ['#a', '#b', '#c', '#d']);
    const { result } = renderHook(() =>
      usePixelArtHistory({
        width: 2,
        height: 2,
        initialLayers: [l1, l2],
        initialActiveLayerId: 'l1', // active ≠ target
      }),
    );
    act(() => result.current.rotateLayer('l2', 'cw'));
    expect(result.current.layers[0].pixels).toEqual(['#x', '#x', '#x', '#x']);
    expect(result.current.layers[1].pixels).toEqual(['#c', '#a', '#d', '#b']);
    // Active layer selection is not affected.
    expect(result.current.activeLayerId).toBe('l1');
  });

  it('pasteAsNewLayer inserts the new layer immediately above the active layer', () => {
    // Start: [l1, l2] with l1 active → paste should land between them.
    const l1 = makeLayer('l1', 'Background', ['', '', '', '']);
    const l2 = makeLayer('l2', 'Top', ['', '', '', '']);
    const { result } = renderHook(() =>
      usePixelArtHistory({
        width: 2,
        height: 2,
        initialLayers: [l1, l2],
        initialActiveLayerId: 'l1',
      }),
    );
    act(() => result.current.pasteAsNewLayer(['#1', '', '', ''], 'Paste'));
    expect(result.current.layers).toHaveLength(3);
    expect(result.current.layers[0].id).toBe('l1');
    expect(result.current.layers[1].name).toBe('Paste');
    expect(result.current.layers[2].id).toBe('l2');
  });

  it('pasteAsNewLayer makes the new layer active', () => {
    const { result } = setup();
    act(() => result.current.pasteAsNewLayer(['#1', '', '', ''], 'Paste'));
    const pasted = result.current.layers.find((l) => l.name === 'Paste');
    expect(pasted).toBeDefined();
    expect(result.current.activeLayerId).toBe(pasted!.id);
  });

  it('pasteAsNewLayer is a single undo step — undo removes the layer and the active id is no longer the pasted one', () => {
    const { result } = setup();
    // l2 is active in setup().
    expect(result.current.activeLayerId).toBe('l2');
    act(() => result.current.pasteAsNewLayer(['#1', '', '', ''], 'Paste'));
    const pastedId = result.current.activeLayerId;
    expect(result.current.layers).toHaveLength(3);
    act(() => result.current.undo());
    expect(result.current.layers).toHaveLength(2);
    // The pasted layer is gone, and the active id is one of the surviving layers.
    expect(result.current.activeLayerId).not.toBe(pastedId);
    expect(result.current.layers.some((l) => l.id === result.current.activeLayerId)).toBe(true);
  });

  it('pasteAsNewLayer fires onChange with the updated layer stack', () => {
    const onChange = vi.fn();
    const { result } = setup({ onChange });
    act(() => result.current.pasteAsNewLayer(['#1', '', '', ''], 'Paste'));
    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0][0] as Layer[];
    expect(arg).toHaveLength(3);
    expect(arg.some((l) => l.name === 'Paste')).toBe(true);
  });

  it('selection is excluded from snapshots — undo restores pixels but leaves selection intact', () => {
    const { result } = renderHook(() => ({
      history: usePixelArtHistory({
        width: 2,
        height: 2,
        initialLayers: [
          makeLayer('l1', 'Background', ['', '', '', '']),
          makeLayer('l2', 'Lines', ['#ff0000', '', '', '']),
        ],
        initialActiveLayerId: 'l2',
        onChange: () => {},
        onSizeChange: () => {},
      }),
      selection: usePixelArtSelection({ width: 2 }),
    }));

    // Commit a pixel change to create a snapshot.
    act(() => result.current.history.commitPixels(['#0000ff', '#0000ff', '#0000ff', '#0000ff']));

    // Set a selection after the commit.
    act(() =>
      result.current.selection.setSelection({ shape: 'rect', x1: 0, y1: 0, x2: 1, y2: 1 }),
    );
    expect(result.current.selection.selection).not.toBeNull();

    // Undo the pixel change — pixels revert but selection must be unchanged.
    act(() => result.current.history.undo());
    expect(result.current.history.pixels).toEqual(['#ff0000', '', '', '']);
    expect(result.current.selection.selection).toEqual({
      shape: 'rect',
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 1,
    });
  });

  it('HISTORY_LIMIT caps the undo stack: undoing past the limit stops at the oldest retained snapshot', () => {
    const { result } = setup();
    // Commit HISTORY_LIMIT + 1 times so the very first snapshot (the initial
    // state) is evicted.
    for (let i = 0; i < HISTORY_LIMIT + 1; i += 1) {
      const px = [`#c${i}`, '', '', ''];
      act(() => result.current.commitPixels(px));
    }
    // Drain undo until it can go no further.
    let guard = 0;
    while (result.current.canUndo && guard < HISTORY_LIMIT + 5) {
      act(() => result.current.undo());
      guard += 1;
    }
    expect(guard).toBe(HISTORY_LIMIT);
    // The original initial state (#ff0000) should be unreachable — it was
    // pushed onto `past` by the first commit, then evicted by the 51st.
    expect(result.current.pixels).not.toEqual(['#ff0000', '', '', '']);
    // Instead we should sit at the first commit's pixels ('#c0').
    expect(result.current.pixels).toEqual(['#c0', '', '', '']);
  });
});

describe('commitPixels with beforePixels override', () => {
  // Grid is 2×2. Active layer is 'l2' with initial pixels ['#ff0000', '', '', ''].
  // These tests cover the undo-after-move fix: when a tool dispatches "cleared"
  // pixels during a drag and then commits the final translated result, the
  // `beforePixels` parameter lets callers supply the true pre-move state so
  // undo restores the original pixels rather than the cleared intermediate.

  it('core fix: undo after dispatch+commit(next, original) restores original, not cleared state', () => {
    const { result } = setup();
    const original = ['#ff0000', '', '', ''];
    const cleared = ['', '', '', ''];
    const translated = ['', '', '#ff0000', ''];

    // Simulate drag-start: dispatch the cleared base (pixels are vacated).
    act(() => result.current.dispatchPixels(cleared));
    // Simulate drag-end: commit the translated result, passing the original
    // pixels as `beforePixels` so the snapshot captures the pre-move state.
    act(() => result.current.commitPixels(translated, original));

    // Live pixels should reflect the translated result.
    expect(result.current.pixels).toEqual(translated);
    expect(result.current.canUndo).toBe(true);

    // Undo must restore the original pixels, not the cleared intermediate.
    act(() => result.current.undo());
    expect(result.current.pixels).toEqual(original);
  });

  it('committed value is `next`, not `beforePixels`', () => {
    const { result } = setup();
    const original = ['#ff0000', '', '', ''];
    const cleared = ['', '', '', ''];
    const translated = ['', '#ff0000', '', ''];

    act(() => result.current.dispatchPixels(cleared));
    act(() => result.current.commitPixels(translated, original));

    // The live (committed) value must be translated, not original.
    expect(result.current.pixels).toEqual(translated);
    expect(result.current.pixels).not.toEqual(original);
  });

  it('beforePixels only overrides the active layer; other layers are unaffected in the snapshot', () => {
    const { result } = setup();
    // l1 starts as ['', '', '', ''], l2 as ['#ff0000', '', '', ''].
    // We move on l2 (the active layer).
    const original = ['#ff0000', '', '', ''];
    const cleared = ['', '', '', ''];
    const translated = ['', '', '', '#ff0000'];

    act(() => result.current.dispatchPixels(cleared));
    act(() => result.current.commitPixels(translated, original));

    act(() => result.current.undo());

    // l2 must be restored to original.
    const l2 = result.current.layers.find((l) => l.id === 'l2');
    expect(l2?.pixels).toEqual(original);

    // l1 must remain untouched (all-empty initial state).
    const l1 = result.current.layers.find((l) => l.id === 'l1');
    expect(l1?.pixels).toEqual(['', '', '', '']);
  });

  it('falls back correctly without beforePixels: snapshots current layer state (regression guard)', () => {
    const { result } = setup();
    const original = ['#ff0000', '', '', ''];
    const next = ['#00ff00', '', '', ''];

    // Normal commit with no beforePixels argument.
    act(() => result.current.commitPixels(next));
    expect(result.current.pixels).toEqual(next);
    expect(result.current.canUndo).toBe(true);

    // Undo should restore the state before commit (the initial state of l2).
    act(() => result.current.undo());
    expect(result.current.pixels).toEqual(original);
  });
});

// ── clearLayer ────────────────────────────────────────────────────────────────

describe('clearLayer', () => {
  it('empties all pixels on the target layer and is undoable', () => {
    const l1 = makeLayer('l1', 'Background', ['', '', '', '']);
    const l2 = makeLayer('l2', 'Art', ['#a', '#b', '#c', '#d']);
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      usePixelArtHistory({
        width: 2,
        height: 2,
        initialLayers: [l1, l2],
        initialActiveLayerId: 'l2',
        onChange,
      }),
    );

    act(() => result.current.clearLayer('l2'));
    expect(result.current.layers[1].pixels).toEqual(['', '', '', '']);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.layers[1].pixels).toEqual(['#a', '#b', '#c', '#d']);
  });

  it('clearLayer on a non-active layer leaves the active layer untouched', () => {
    const l1 = makeLayer('l1', 'Background', ['#x', '#x', '#x', '#x']);
    const l2 = makeLayer('l2', 'Art', ['#a', '#b', '#c', '#d']);
    const { result } = renderHook(() =>
      usePixelArtHistory({
        width: 2,
        height: 2,
        initialLayers: [l1, l2],
        initialActiveLayerId: 'l2',
      }),
    );

    act(() => result.current.clearLayer('l1'));
    expect(result.current.layers[0].pixels).toEqual(['', '', '', '']);
    // Active layer (l2) is unaffected.
    expect(result.current.layers[1].pixels).toEqual(['#a', '#b', '#c', '#d']);
  });
});

// ── mergeDown ────────────────────────────────────────────────────────────────

describe('mergeDown', () => {
  function setupMerge(onChange?: ReturnType<typeof vi.fn>) {
    const l1 = makeLayer('l1', 'Background', ['', '', '', '']);
    const l2 = makeLayer('l2', 'Overlay', ['#ff0000', '', '', '']);
    const cb = onChange ?? vi.fn();
    const hook = renderHook(() =>
      usePixelArtHistory({
        width: 2,
        height: 2,
        initialLayers: [l1, l2],
        initialActiveLayerId: 'l2',
        onChange: cb,
      }),
    );
    return { ...hook, onChange: cb };
  }

  it('composites upper layer onto lower and removes the upper layer', () => {
    const { result } = setupMerge();
    act(() => result.current.mergeDown('l2'));
    expect(result.current.layers).toHaveLength(1);
    expect(result.current.layers[0].id).toBe('l1');
    // The merged layer carries l2's pixel at (0,0).
    expect(result.current.layers[0].pixels[0]).toBe('#ff0000');
  });

  it('lower layer becomes the active layer after mergeDown', () => {
    const { result } = setupMerge();
    act(() => result.current.mergeDown('l2'));
    expect(result.current.activeLayerId).toBe('l1');
  });

  it('mergeDown is a single undoable step', () => {
    const { result } = setupMerge();
    act(() => result.current.mergeDown('l2'));
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.layers).toHaveLength(2);
    expect(result.current.layers[1].id).toBe('l2');
    expect(result.current.layers[1].pixels[0]).toBe('#ff0000');
  });

  it('mergeDown on the bottom layer is a no-op (no snapshot, no onChange)', () => {
    const onChange = vi.fn();
    const { result } = setupMerge(onChange);
    act(() => result.current.mergeDown('l1'));
    expect(result.current.layers).toHaveLength(2);
    expect(result.current.canUndo).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ── soloLayerVisibility ───────────────────────────────────────────────────────

describe('soloLayerVisibility', () => {
  it('hides all layers except the target', () => {
    const onChange = vi.fn();
    const { result } = setup({ onChange });
    act(() => result.current.soloLayerVisibility('l1'));
    expect(result.current.layers[0].visible).toBe(true);  // l1 — the target
    expect(result.current.layers[1].visible).toBe(false); // l2 — hidden
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('toggling solo on an already-soloed layer restores all layers to visible', () => {
    const { result } = setup();
    act(() => result.current.soloLayerVisibility('l1')); // solo
    expect(result.current.layers[1].visible).toBe(false);
    act(() => result.current.soloLayerVisibility('l1')); // toggle off
    expect(result.current.layers[0].visible).toBe(true);
    expect(result.current.layers[1].visible).toBe(true);
  });

  it('soloLayerVisibility is undoable', () => {
    const { result } = setup();
    act(() => result.current.soloLayerVisibility('l1'));
    expect(result.current.layers[1].visible).toBe(false);
    act(() => result.current.undo());
    expect(result.current.layers[1].visible).toBe(true);
  });

  it('is a no-op when no visibility change would occur', () => {
    // Single-layer canvas: soloing the only layer doesn't change anything.
    const l1 = makeLayer('l1', 'Only', ['', '', '', '']);
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      usePixelArtHistory({
        width: 2,
        height: 2,
        initialLayers: [l1],
        initialActiveLayerId: 'l1',
        onChange,
      }),
    );
    act(() => result.current.soloLayerVisibility('l1'));
    expect(result.current.canUndo).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ── addLayerWithPixels ────────────────────────────────────────────────────────

describe('addLayerWithPixels', () => {
  it('inserts a layer pre-populated with the given pixels and makes it active', () => {
    const onChange = vi.fn();
    const { result } = setup({ onChange });
    const pixels = ['#1', '#2', '#3', '#4'];
    act(() => result.current.addLayerWithPixels(pixels, 'Imported'));

    expect(result.current.layers).toHaveLength(3);
    const imported = result.current.layers.find((l) => l.name === 'Imported');
    expect(imported).toBeDefined();
    expect(imported!.pixels).toEqual(pixels);
    expect(result.current.activeLayerId).toBe(imported!.id);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('addLayerWithPixels is undoable', () => {
    const { result } = setup();
    act(() => result.current.addLayerWithPixels(['#1', '#2', '#3', '#4'], 'X'));
    expect(result.current.layers).toHaveLength(3);
    act(() => result.current.undo());
    expect(result.current.layers).toHaveLength(2);
  });
});

// ── duplicateLayerTo ──────────────────────────────────────────────────────────

describe('duplicateLayerTo', () => {
  it('inserts a copy at the exact requested index', () => {
    // [l1, l2] → duplicateLayerTo('l2', 0) → [copy, l1, l2]
    const { result } = setup();
    act(() => result.current.duplicateLayerTo('l2', 0));
    expect(result.current.layers).toHaveLength(3);
    expect(result.current.layers[0].name).toBe('Lines copy');
    expect(result.current.layers[1].id).toBe('l1');
    expect(result.current.layers[2].id).toBe('l2');
  });

  it('copy has the same pixels as the source but a different id', () => {
    const { result } = setup();
    act(() => result.current.duplicateLayerTo('l2', 0));
    const copy = result.current.layers[0];
    const original = result.current.layers[2];
    expect(copy.pixels).toEqual(original.pixels);
    expect(copy.id).not.toBe(original.id);
  });

  it('is undoable', () => {
    const { result } = setup();
    act(() => result.current.duplicateLayerTo('l2', 0));
    expect(result.current.layers).toHaveLength(3);
    act(() => result.current.undo());
    expect(result.current.layers).toHaveLength(2);
  });
});

// ── Compound undo chains ──────────────────────────────────────────────────────

describe('compound undo chains', () => {
  it('pixel commit + addLayer creates two independent undo steps', () => {
    const { result } = setup();
    const painted = ['#abc', '', '', ''];

    act(() => result.current.commitPixels(painted));
    act(() => result.current.addLayer('New'));
    expect(result.current.layers).toHaveLength(3);

    // Undo the addLayer.
    act(() => result.current.undo());
    expect(result.current.layers).toHaveLength(2);
    // Pixels from the earlier commit are still present.
    const l2 = result.current.layers.find((l) => l.id === 'l2');
    expect(l2?.pixels).toEqual(painted);

    // Undo the pixel commit — check l2 directly since active layer may have
    // shifted when addLayer was undone.
    act(() => result.current.undo());
    const l2Restored = result.current.layers.find((l) => l.id === 'l2');
    expect(l2Restored?.pixels).toEqual(['#ff0000', '', '', '']);
    expect(result.current.canUndo).toBe(false);
  });

  it('deleteLayer on the active layer switches activeLayerId to the first surviving layer', () => {
    const { result } = setup();
    expect(result.current.activeLayerId).toBe('l2');
    act(() => result.current.deleteLayer('l2'));
    expect(result.current.layers).toHaveLength(1);
    expect(result.current.activeLayerId).toBe('l1');
  });

  it('structural op + pixel commit + undo sequence restores each step independently', () => {
    const { result } = setup();

    // Add a layer, then paint on l2.
    act(() => result.current.addLayer('Extra'));
    act(() => result.current.setActiveLayerId('l2'));
    act(() => result.current.commitPixels(['#123', '', '', '']));

    // Undo the paint.
    act(() => result.current.undo());
    expect(result.current.layers.find((l) => l.id === 'l2')?.pixels).toEqual(['#ff0000', '', '', '']);
    // Extra layer is still present.
    expect(result.current.layers).toHaveLength(3);

    // Undo the addLayer.
    act(() => result.current.undo());
    expect(result.current.layers).toHaveLength(2);
  });
});
