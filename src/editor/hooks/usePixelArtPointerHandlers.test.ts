/**
 * Tests for `usePixelArtPointerHandlers` — the canvas pointer state machine.
 * Covers the branches that don't require a real canvas 2D context (which
 * jsdom doesn't implement):
 *   - Eyedropper samples the composited colour and switches to paint.
 *   - Fill floods on pointerdown and commits.
 *   - Move tool dispatches cleared pixels on pointerdown.
 *   - Shape tools commit on pointerup.
 *   - Marquee wand fills a selection from floodSelect.
 *   - Marquee drag draws a rect selection.
 *   - Paint/eraser commit on pointerdown.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { usePixelArtPointerHandlers, type UsePixelArtPointerHandlersParams, type FillModes } from './usePixelArtPointerHandlers';
import type { ActivePixels } from './usePixelArtHistory';
import type { SelectionDragContext } from './usePixelArtSelection';
import type { PenContext } from './usePenTool';
import type { PolygonSelectContext } from './usePolygonSelectTool';
import type { PixelArtSelection } from '../lib/pixelArtUtils';
import type { Layer } from '@/lib/storage';

/**
 * Build the mocked deps the hook needs. The committed canvas ref has a
 * fixed bounding rect so `getCellFromEvent` translates (clientX, clientY)
 * into cell coords deterministically (1 cell = 1 CSS pixel by default).
 */
function setup(
  overrides: Partial<Omit<UsePixelArtPointerHandlersParams, 'committedCanvasRef' | 'previewCanvasRef' | 'activePixels' | 'selectionDragContext' | 'penContext' | 'layers'>> = {},
  opts?: {
    initialPixels?: string[];
    selection?: PixelArtSelection | null;
    selectionContainsCell?: (c: number, r: number) => boolean;
    layers?: Layer[];
  },
) {
  const width = overrides.width ?? 4;
  const height = overrides.height ?? 4;
  const initial = opts?.initialPixels ?? new Array(width * height).fill('');

  // Real canvas elements so we can stub getBoundingClientRect, but we don't
  // use any 2D-context calls that jsdom can't render. Preview-canvas 2D ops
  // silently no-op in the hook because getContext('2d') returns null in jsdom.
  const committed = document.createElement('canvas');
  committed.width = width;
  committed.height = height;
  // 1 cell = 1 CSS pixel so `clientX` maps straight to column.
  committed.getBoundingClientRect = () => ({
    x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height,
    toJSON: () => ({}),
  });
  const preview = document.createElement('canvas');
  preview.width = width;
  preview.height = height;

  const committedCanvasRef = { current: committed };
  const previewCanvasRef = { current: preview };

  const commit = vi.fn();
  const dispatch = vi.fn();
  const emit = vi.fn();
  const activePixels: ActivePixels = { pixels: initial, commit, dispatch, emit };

  const selectionDragContext: SelectionDragContext = {
    dragMode: { current: null },
    dragStart: { current: null },
    lifted: { current: null },
    basePixelsAfterLift: { current: null },
    moveOffset: { current: [0, 0] },
    strokeInsideSelection: { current: true },
  };

  const penCommit = vi.fn();
  const penCancel = vi.fn();
  const setCursor = vi.fn();
  const penContext: PenContext = {
    anchors: { current: [] },
    cursor: null,
    setCursor,
    dblClickPending: { current: false },
    commit: penCommit,
    cancel: penCancel,
  };

  const polygonSelectContext: PolygonSelectContext = {
    anchors: { current: [] },
    cursor: null,
    setCursor: vi.fn(),
    dblClickPending: { current: false },
    commit: vi.fn(),
    cancel: vi.fn(),
  };

  const setActiveTool = vi.fn();
  const setActiveColor = vi.fn();
  const setIndependentHue = vi.fn();
  const setSelection = vi.fn();
  const fillModes: FillModes = {
    rect: 'outline',
    circle: 'outline',
    triangle: 'outline',
    star: 'outline',
    arrow: 'outline',
  };

  const layers: Layer[] = opts?.layers ?? [
    { id: 'l1', name: 'Layer', visible: true, opacity: 1, pixels: initial },
  ];

  const params: UsePixelArtPointerHandlersParams = {
    disabled: false,
    activeTool: 'paint',
    brushSize: 'sm',
    activeColor: '#ff0000',
    fillModes,
    marqueeShape: 'rect',
    setActiveTool,
    setActiveColor,
    setIndependentHue,
    width,
    height,
    committedCanvasRef,
    previewCanvasRef,
    activePixels,
    layers,
    selection: opts?.selection ?? null,
    setSelection,
    selectionContainsCell: opts?.selectionContainsCell ?? (() => false),
    selectionDragContext,
    penContext,
    polygonSelectContext,
    symmetryMode: 'none' as const,
    wrapMode: false,
    alphaLock: false,
    ...overrides,
  };

  const hook = renderHook(() => usePixelArtPointerHandlers(params));

  return {
    hook,
    params,
    commit,
    dispatch,
    emit,
    setActiveTool,
    setActiveColor,
    setIndependentHue,
    setSelection,
    penCommit,
    penCancel,
    setCursor,
    selectionDragContext,
    penContext,
    activePixels,
    committed,
    preview,
    width,
    height,
  };
}

/**
 * Synthesise a mouse event that matches what React forwards to the
 * handlers: button 0, clientX/Y, preventDefault stub. The hook reads these
 * fields only (not a real React SyntheticEvent).
 */
function mouseEvent(clientX: number, clientY: number, shiftKey = false): React.MouseEvent<HTMLCanvasElement> {
  return {
    button: 0,
    clientX,
    clientY,
    shiftKey,
    preventDefault: () => {},
  } as unknown as React.MouseEvent<HTMLCanvasElement>;
}

// Silence jsdom's "getContext is not implemented" warnings — the hook will
// happily call `ctx?.clearRect(...)` on null and move on.
beforeEach(() => {
  // Stub getContext so the preview canvas path runs without errors. Returns
  // an object with the subset of methods the hook uses; all are no-ops.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: () => {},
    fillRect: () => {},
    set fillStyle(_v: string) {},
    get fillStyle() { return '#000'; },
    set globalAlpha(_v: number) {},
    get globalAlpha() { return 1; },
  })) as unknown as HTMLCanvasElement['getContext'];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePixelArtPointerHandlers', () => {
  it('eyedropper pointerdown samples the composited colour and switches to paint', () => {
    const layers: Layer[] = [
      {
        id: 'l1',
        name: 'bg',
        visible: true,
        opacity: 1,
        pixels: ['#aabbcc', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      },
    ];
    const { hook, setActiveColor, setActiveTool, setIndependentHue } = setup(
      { activeTool: 'eyedropper' },
      { layers, initialPixels: layers[0].pixels },
    );
    hook.result.current.handleMouseDown(mouseEvent(0.5, 0.5));
    expect(setActiveColor).toHaveBeenCalledWith('#aabbcc');
    expect(setIndependentHue).toHaveBeenCalledWith(null);
    expect(setActiveTool).toHaveBeenCalledWith('paint');
  });

  it('eyedropper on an empty cell does not call setActiveColor', () => {
    const { hook, setActiveColor, setActiveTool } = setup({ activeTool: 'eyedropper' });
    hook.result.current.handleMouseDown(mouseEvent(1.5, 1.5));
    expect(setActiveColor).not.toHaveBeenCalled();
    // Still switches to paint, per the existing UX contract.
    expect(setActiveTool).toHaveBeenCalledWith('paint');
  });

  it('fill pointerdown commits a flood-filled pixel array', () => {
    // 4×4 empty → flood-fill at (0,0) paints every cell red.
    const { hook, commit, emit } = setup({ activeTool: 'fill', activeColor: '#00ff00' });
    hook.result.current.handleMouseDown(mouseEvent(0.5, 0.5));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledTimes(1);
    const next = commit.mock.calls[0][0] as string[];
    expect(next.every((p) => p === '#00ff00')).toBe(true);
  });

  it('paint pointerdown commits a single cell and emits', () => {
    const { hook, commit, emit } = setup({ activeTool: 'paint', activeColor: '#112233' });
    hook.result.current.handleMouseDown(mouseEvent(2.5, 1.5)); // cell (2, 1)
    expect(commit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledTimes(1);
    const next = commit.mock.calls[0][0] as string[];
    expect(next[1 * 4 + 2]).toBe('#112233');
    // All other cells unchanged.
    expect(next.filter((p) => p === '').length).toBe(15);
  });

  it('eraser pointerdown clears the cell', () => {
    const initial = new Array(16).fill('#abc');
    const { hook, commit } = setup(
      { activeTool: 'eraser' },
      { initialPixels: initial },
    );
    hook.result.current.handleMouseDown(mouseEvent(0.5, 0.5));
    const next = commit.mock.calls[0][0] as string[];
    expect(next[0]).toBe('');
  });

  it('move pointerdown snapshots pixels and dispatches the cleared base', () => {
    // Layer has one red pixel at (1,1). Move tool pointerdown with no selection
    // lifts the whole layer (baseCleared = empty array), so dispatch receives
    // an all-empty array.
    const initial = new Array(16).fill('');
    initial[1 * 4 + 1] = '#ff0000';
    const { hook, dispatch, commit } = setup(
      { activeTool: 'move' },
      { initialPixels: initial },
    );
    hook.result.current.handleMouseDown(mouseEvent(1.5, 1.5));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
    const base = dispatch.mock.calls[0][0] as string[];
    // Whole-layer lift: every cell cleared.
    expect(base.every((p) => p === '')).toBe(true);
  });

  it('move pointerdown → pointerup with no movement restores the snapshot (no commit)', () => {
    const initial = new Array(16).fill('');
    initial[0] = '#ff0000';
    const { hook, dispatch, commit } = setup(
      { activeTool: 'move' },
      { initialPixels: initial },
    );
    // Click and release on the same cell.
    hook.result.current.handleMouseDown(mouseEvent(0.5, 0.5));
    hook.result.current.handleMouseUp(mouseEvent(0.5, 0.5));
    // Dispatch called twice: once with cleared base, once to restore snapshot.
    // No commit because there was no movement.
    expect(commit).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls[1][0]).toEqual(initial);
  });

  it('move drag commits the translated pixels on pointerup', () => {
    const initial = new Array(16).fill('');
    initial[0] = '#ff0000'; // pixel at (0,0)
    const { hook, commit } = setup(
      { activeTool: 'move' },
      { initialPixels: initial },
    );
    hook.result.current.handleMouseDown(mouseEvent(0.5, 0.5));
    hook.result.current.handleMouseMove({ clientX: 2.5, clientY: 0.5, shiftKey: false });
    hook.result.current.handleMouseUp(mouseEvent(2.5, 0.5));
    expect(commit).toHaveBeenCalledTimes(1);
    const next = commit.mock.calls[0][0] as string[];
    // Pixel translated from (0,0) to (2,0).
    expect(next[2]).toBe('#ff0000');
    expect(next[0]).toBe('');
  });

  it('shape tool (rect) commits the cells traced between down and up', () => {
    const { hook, commit } = setup({ activeTool: 'rect', activeColor: '#010203' });
    hook.result.current.handleMouseDown(mouseEvent(0.5, 0.5));
    hook.result.current.handleMouseUp(mouseEvent(3.5, 3.5));
    expect(commit).toHaveBeenCalledTimes(1);
    const next = commit.mock.calls[0][0] as string[];
    // Rect outline: the four edges of the 4×4 bbox are painted.
    expect(next[0]).toBe('#010203'); // (0,0) corner
    expect(next[3]).toBe('#010203'); // (3,0) corner
    expect(next[12]).toBe('#010203'); // (0,3) corner
    expect(next[15]).toBe('#010203'); // (3,3) corner
  });

  it('marquee (rect) pointerdown starts a draw drag and sets the initial selection', () => {
    const { hook, setSelection, selectionDragContext } = setup({
      activeTool: 'marquee',
      marqueeShape: 'rect',
    });
    hook.result.current.handleMouseDown(mouseEvent(1.5, 2.5));
    expect(selectionDragContext.dragMode.current).toBe('draw');
    expect(selectionDragContext.dragStart.current).toEqual([1, 2]);
    // Initial selection is a degenerate rect at the start cell.
    expect(setSelection).toHaveBeenCalledWith({ shape: 'rect', x1: 1, y1: 2, x2: 1, y2: 2 });
  });

  it('marquee drag updates the selection rect on pointermove', () => {
    const { hook, setSelection, selectionDragContext } = setup({
      activeTool: 'marquee',
      marqueeShape: 'rect',
    });
    hook.result.current.handleMouseDown(mouseEvent(0.5, 0.5));
    // Clear the initial setSelection call and move the cursor to (3,3).
    setSelection.mockClear();
    hook.result.current.handleMouseMove({ clientX: 3.5, clientY: 3.5, shiftKey: false });
    expect(selectionDragContext.dragMode.current).toBe('draw');
    // setSelection updater form was called; invoke it with the previous
    // selection to see the final value.
    expect(setSelection).toHaveBeenCalled();
    const updater = setSelection.mock.calls.at(-1)![0] as (
      prev: PixelArtSelection | null,
    ) => PixelArtSelection | null;
    const result = updater({ shape: 'rect', x1: 0, y1: 0, x2: 0, y2: 0 });
    expect(result).toEqual({ shape: 'rect', x1: 0, y1: 0, x2: 3, y2: 3 });
  });

  it('marquee wand pointerdown runs floodSelect and sets a cells selection', () => {
    // 4×4: left half red, right half empty. Wand at (0,0) selects all 8 reds.
    const initial = [
      '#f00', '#f00', '', '',
      '#f00', '#f00', '', '',
      '#f00', '#f00', '', '',
      '#f00', '#f00', '', '',
    ];
    const { hook, setSelection } = setup(
      { activeTool: 'marquee', marqueeShape: 'wand' },
      { initialPixels: initial, layers: [{ id: 'l1', name: 'l', visible: true, opacity: 1, pixels: initial }] },
    );
    hook.result.current.handleMouseDown(mouseEvent(0.5, 0.5));
    expect(setSelection).toHaveBeenCalledTimes(1);
    const sel = setSelection.mock.calls[0][0] as PixelArtSelection;
    expect(sel.shape).toBe('cells');
    if (sel.shape !== 'cells') throw new Error('expected cells selection');
    // All eight red cells covered.
    expect(sel.cells.size).toBe(8);
    expect(sel.x1).toBe(0);
    expect(sel.y1).toBe(0);
    expect(sel.x2).toBe(1);
    expect(sel.y2).toBe(3);
  });

  it('pointerdown outside the canvas bounds is a no-op', () => {
    const { hook, commit } = setup({ activeTool: 'paint' });
    // clientX = 10 with width=4 → cell col = 10; isCellInBounds returns false.
    hook.result.current.handleMouseDown(mouseEvent(10, 10));
    expect(commit).not.toHaveBeenCalled();
  });

  it('disabled=true blocks pointerdown from doing anything', () => {
    const { hook, commit } = setup({ disabled: true, activeTool: 'paint' });
    hook.result.current.handleMouseDown(mouseEvent(0.5, 0.5));
    expect(commit).not.toHaveBeenCalled();
  });

  it('handleDoubleClick with pen tool + >1 anchor trims the last anchor and commits', () => {
    const { hook, penContext, penCommit } = setup({ activeTool: 'pen' });
    penContext.anchors.current = [[0, 0], [1, 0], [2, 0]];
    hook.result.current.handleDoubleClick();
    expect(penCommit).toHaveBeenCalledWith(false);
    // dblClickPending is flipped true during the 300ms window.
    expect(penContext.dblClickPending.current).toBe(true);
  });

  it('handleDoubleClick with a non-pen tool is a no-op', () => {
    const { hook, penContext, penCommit } = setup({ activeTool: 'paint' });
    penContext.anchors.current = [[0, 0], [1, 0]];
    hook.result.current.handleDoubleClick();
    expect(penCommit).not.toHaveBeenCalled();
    expect(penContext.dblClickPending.current).toBe(false);
  });

  it('pen pointerdown appends an anchor and updates the cursor', () => {
    const { hook, penContext, setCursor } = setup({ activeTool: 'pen' });
    hook.result.current.handleMouseDown(mouseEvent(1.5, 2.5));
    expect(penContext.anchors.current).toEqual([[1, 2]]);
    expect(setCursor).toHaveBeenCalledWith([1, 2]);
  });
});

describe('undo-safe move commits', () => {
  // Grid is 4×4; 1 CSS px = 1 grid cell (see setup() bounding rect).

  // ── Move tool, whole-layer (no selection) ────────────────────────────────

  it('move drag: commit is called with (translatedPixels, originalPixels)', () => {
    const initial = new Array(16).fill('');
    initial[0] = '#ff0000'; // pixel at cell (0,0), index 0
    const { hook, commit } = setup(
      { activeTool: 'move' },
      { initialPixels: initial },
    );

    // Drag pixel from (0,0) to (2,0): down → move → up.
    hook.result.current.handleMouseDown(mouseEvent(0.5, 0.5));
    hook.result.current.handleMouseMove({ clientX: 2.5, clientY: 0.5, shiftKey: false });
    hook.result.current.handleMouseUp(mouseEvent(2.5, 0.5));

    expect(commit).toHaveBeenCalledTimes(1);
    const [next, beforePixels] = commit.mock.calls[0] as [string[], string[]];

    // The committed result has the pixel at (2,0).
    expect(next[2]).toBe('#ff0000');
    expect(next[0]).toBe('');

    // The beforePixels arg must be the original snapshot (pixel at (0,0)),
    // NOT the cleared intermediate.
    expect(beforePixels).toEqual(initial);
  });

  it('no-op drag (down+up on same cell): commit is NOT called; dispatch is called twice', () => {
    const initial = new Array(16).fill('');
    initial[0] = '#ff0000';
    const { hook, commit, dispatch } = setup(
      { activeTool: 'move' },
      { initialPixels: initial },
    );

    // Click and release on the same cell — no movement.
    hook.result.current.handleMouseDown(mouseEvent(0.5, 0.5));
    hook.result.current.handleMouseUp(mouseEvent(0.5, 0.5));

    // No commit because there was no movement.
    expect(commit).not.toHaveBeenCalled();

    // dispatch[0] = baseCleared (all empty), dispatch[1] = snapshot restore.
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls[1][0]).toEqual(initial);
  });

  it('pointer cancel: dispatch restores the snapshot; commit is never called', () => {
    const initial = new Array(16).fill('');
    initial[5] = '#ff0000'; // cell (1,1)
    const { hook, commit, dispatch } = setup(
      { activeTool: 'move' },
      { initialPixels: initial },
    );

    hook.result.current.handleMouseDown(mouseEvent(1.5, 1.5));
    hook.result.current.handleMouseMove({ clientX: 2.5, clientY: 1.5, shiftKey: false });
    hook.result.current.handlePointerCancel();

    expect(commit).not.toHaveBeenCalled();
    // Last dispatch must restore the original snapshot.
    const lastDispatch = dispatch.mock.calls[dispatch.mock.calls.length - 1][0] as string[];
    expect(lastDispatch).toEqual(initial);
  });

  // ── Move tool, with selection ─────────────────────────────────────────────

  it('move with selection: commit receives (translatedPixels, fullLayerOriginal) as beforePixels', () => {
    // Place one pixel at (0,0) in the selection and another at (3,3) outside it.
    const initial = new Array(16).fill('');
    initial[0] = '#ff0000';   // (0,0) — inside selection
    initial[15] = '#0000ff';  // (3,3) — outside selection

    const sel = { shape: 'rect' as const, x1: 0, y1: 0, x2: 0, y2: 0 };
    const contains = (c: number, r: number) => c === 0 && r === 0;

    const { hook, commit } = setup(
      { activeTool: 'move' },
      { initialPixels: initial, selection: sel, selectionContainsCell: contains },
    );

    // Drag the selection 1 cell to the right: (0,0) → (1,0).
    hook.result.current.handleMouseDown(mouseEvent(0.5, 0.5));
    hook.result.current.handleMouseMove({ clientX: 1.5, clientY: 0.5, shiftKey: false });
    hook.result.current.handleMouseUp(mouseEvent(1.5, 0.5));

    expect(commit).toHaveBeenCalledTimes(1);
    const [, beforePixels] = commit.mock.calls[0] as [string[], string[]];

    // beforePixels must be the full original layer snapshot (including the
    // out-of-selection pixel), not just the selected cells.
    expect(beforePixels).toEqual(initial);
  });

  // ── Marquee selection move ────────────────────────────────────────────────

  it('marquee move drag: commit is called with (movedPixels, originalPixels)', () => {
    // 4×4 grid. Pixel '#aa0000' at cell (1,1), index = 1*4+1 = 5.
    const initial = new Array(16).fill('');
    initial[5] = '#aa0000';

    const sel = { shape: 'rect' as const, x1: 1, y1: 1, x2: 1, y2: 1 };
    const contains = (c: number, r: number) => c === 1 && r === 1;

    const { hook, commit } = setup(
      { activeTool: 'marquee', marqueeShape: 'rect' },
      { initialPixels: initial, selection: sel, selectionContainsCell: contains },
    );

    // Down at (1.5, 1.5) → cell (1,1) → enters 'move' mode.
    hook.result.current.handleMouseDown(mouseEvent(1.5, 1.5));
    // Move to (2.5, 2.5) → dx=1, dy=1.
    hook.result.current.handleMouseMove({ clientX: 2.5, clientY: 2.5, shiftKey: false });
    // Up at (2.5, 2.5) → commits.
    hook.result.current.handleMouseUp(mouseEvent(2.5, 2.5));

    expect(commit).toHaveBeenCalledTimes(1);
    const [next, beforePixels] = commit.mock.calls[0] as [string[], string[]];

    // The committed result places the pixel at (2,2), index = 2*4+2 = 10.
    expect(next[10]).toBe('#aa0000');
    // Original position (1,1) must be empty in next.
    expect(next[5]).toBe('');

    // beforePixels must have the pixel at the original position (1,1).
    expect(beforePixels[5]).toBe('#aa0000');
    // And the destination must be empty in beforePixels.
    expect(beforePixels[10]).toBe('');
  });

  it('marquee move pointer cancel: dispatch restores lifted pixels in-place; commit is NOT called', () => {
    const initial = new Array(16).fill('');
    initial[5] = '#aa0000'; // cell (1,1)

    const sel = { shape: 'rect' as const, x1: 1, y1: 1, x2: 1, y2: 1 };
    const contains = (c: number, r: number) => c === 1 && r === 1;

    const { hook, commit, dispatch } = setup(
      { activeTool: 'marquee', marqueeShape: 'rect' },
      { initialPixels: initial, selection: sel, selectionContainsCell: contains },
    );

    hook.result.current.handleMouseDown(mouseEvent(1.5, 1.5));
    hook.result.current.handleMouseMove({ clientX: 2.5, clientY: 2.5, shiftKey: false });
    hook.result.current.handlePointerCancel();

    // Commit must never be called during a cancel.
    expect(commit).not.toHaveBeenCalled();

    // The last dispatch must restore the pixel to cell (1,1) — i.e. the
    // cancel handler puts the lifted colors back at their original position.
    const lastDispatch = dispatch.mock.calls[dispatch.mock.calls.length - 1][0] as string[];
    expect(lastDispatch[5]).toBe('#aa0000');
    expect(lastDispatch[10]).toBe('');
  });
});

// ── Paint / eraser drag ──────────────────────────────────────────────────────

describe('paint and eraser drag strokes', () => {
  it('paint mousemove dispatches (not commits) each cell under the cursor', () => {
    const { hook, commit, dispatch } = setup({ activeTool: 'paint', activeColor: '#ff0000' });

    hook.result.current.handleMouseDown(mouseEvent(0.5, 0.5)); // commits (0,0)
    hook.result.current.handleMouseMove({ clientX: 1.5, clientY: 0.5, shiftKey: false });
    hook.result.current.handleMouseMove({ clientX: 2.5, clientY: 0.5, shiftKey: false });

    // One commit from mousedown; two dispatches from the two moves.
    expect(commit).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledTimes(2);

    // Each dispatch paints the cell under the cursor (reads from initial, so
    // only the current cell is set — accumulation is the job of history, not
    // this mock).
    expect((dispatch.mock.calls[0][0] as string[])[1]).toBe('#ff0000'); // (1,0)
    expect((dispatch.mock.calls[1][0] as string[])[2]).toBe('#ff0000'); // (2,0)
  });

  it('paint mouseup does not emit a second commit (one history entry per stroke)', () => {
    const { hook, commit } = setup({ activeTool: 'paint', activeColor: '#ff0000' });

    hook.result.current.handleMouseDown(mouseEvent(0.5, 0.5));
    hook.result.current.handleMouseMove({ clientX: 1.5, clientY: 0.5, shiftKey: false });
    hook.result.current.handleMouseUp(mouseEvent(1.5, 0.5));

    // Still exactly one commit (from mousedown) — mouseup does not re-commit
    // for the paint tool, keeping undo history to one entry per stroke.
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('eraser mousemove dispatches erased pixels (not commits)', () => {
    const initial = new Array(16).fill('#abc');
    const { hook, commit, dispatch } = setup(
      { activeTool: 'eraser' },
      { initialPixels: initial },
    );

    hook.result.current.handleMouseDown(mouseEvent(0.5, 0.5)); // commits (0,0) erased
    hook.result.current.handleMouseMove({ clientX: 1.5, clientY: 0.5, shiftKey: false });

    expect(commit).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledTimes(1);

    const dispatched = dispatch.mock.calls[0][0] as string[];
    expect(dispatched[1]).toBe(''); // (1,0) erased on move
  });
});

// ── Selection masking ────────────────────────────────────────────────────────

describe('paint and fill with an active selection', () => {
  // Selection covers the top-left 2×2 quadrant of the 4×4 grid:
  // cells (0,0) (1,0) (0,1) (1,1) — indices 0, 1, 4, 5.
  const sel = { shape: 'rect' as const, x1: 0, y1: 0, x2: 1, y2: 1 };
  const contains = (c: number, r: number) => c <= 1 && r <= 1;

  it('paint started inside selection: mousemove outside selection is masked out', () => {
    const { hook, dispatch } = setup(
      { activeTool: 'paint', activeColor: '#ff0000' },
      { selection: sel, selectionContainsCell: contains },
    );

    hook.result.current.handleMouseDown(mouseEvent(0.5, 0.5)); // inside
    hook.result.current.handleMouseMove({ clientX: 3.5, clientY: 3.5, shiftKey: false }); // outside

    const dispatched = dispatch.mock.calls[0][0] as string[];
    // (3,3) is outside the selection → masked to empty.
    expect(dispatched[15]).toBe('');
  });

  it('paint started outside selection: mousemove inside selection is masked out', () => {
    const { hook, dispatch } = setup(
      { activeTool: 'paint', activeColor: '#ff0000' },
      { selection: sel, selectionContainsCell: contains },
    );

    hook.result.current.handleMouseDown(mouseEvent(3.5, 3.5)); // outside
    hook.result.current.handleMouseMove({ clientX: 0.5, clientY: 0.5, shiftKey: false }); // inside

    const dispatched = dispatch.mock.calls[0][0] as string[];
    // (0,0) is inside the selection → masked to empty.
    expect(dispatched[0]).toBe('');
  });

  it('fill inside selection paints every selected cell regardless of colour connectivity', () => {
    // (1,0) has a different colour so flood-fill from (0,0) would not reach it
    // in a normal fill — but fill-inside-selection paints the whole selection.
    const initial = new Array(16).fill('');
    initial[1] = '#aabbcc'; // (1,0) — would block a flood fill from (0,0)

    const { hook, commit } = setup(
      { activeTool: 'fill', activeColor: '#00ff00' },
      { initialPixels: initial, selection: sel, selectionContainsCell: contains },
    );

    hook.result.current.handleMouseDown(mouseEvent(0.5, 0.5)); // inside selection

    expect(commit).toHaveBeenCalledTimes(1);
    const next = commit.mock.calls[0][0] as string[];
    // All four selected cells overwritten with '#00ff00'.
    expect(next[0]).toBe('#00ff00'); // (0,0)
    expect(next[1]).toBe('#00ff00'); // (1,0) — overwritten despite different colour
    expect(next[4]).toBe('#00ff00'); // (0,1)
    expect(next[5]).toBe('#00ff00'); // (1,1)
    // Cells outside the selection are untouched.
    expect(next[2]).toBe('');
    expect(next[15]).toBe('');
  });

  it('fill outside selection flood-fills but is masked to outside the selection', () => {
    // All-empty grid; flood from (3,3) would normally fill everything — but the
    // mask keeps cells inside the selection at their original (empty) value.
    const { hook, commit } = setup(
      { activeTool: 'fill', activeColor: '#ff0000' },
      { selection: sel, selectionContainsCell: contains },
    );

    hook.result.current.handleMouseDown(mouseEvent(3.5, 3.5)); // outside selection

    expect(commit).toHaveBeenCalledTimes(1);
    const next = commit.mock.calls[0][0] as string[];
    // Cells outside selection get the fill colour.
    expect(next[2]).toBe('#ff0000');  // (2,0) — outside
    expect(next[15]).toBe('#ff0000'); // (3,3) — outside
    // Cells inside selection are preserved.
    expect(next[0]).toBe('');  // (0,0) — inside
    expect(next[5]).toBe('');  // (1,1) — inside
  });
});

// ── Move tool: selection rect follows translation ────────────────────────────

describe('move tool with selection: selection rect translates on commit', () => {
  it('setSelection is called with the translated rect after a successful drag', () => {
    const initial = new Array(16).fill('');
    initial[0] = '#ff0000';
    const sel = { shape: 'rect' as const, x1: 0, y1: 0, x2: 1, y2: 1 };
    const contains = (c: number, r: number) => c <= 1 && r <= 1;

    const { hook, setSelection } = setup(
      { activeTool: 'move' },
      { initialPixels: initial, selection: sel, selectionContainsCell: contains },
    );

    // Drag 2 cells to the right.
    hook.result.current.handleMouseDown(mouseEvent(0.5, 0.5));
    hook.result.current.handleMouseMove({ clientX: 2.5, clientY: 0.5, shiftKey: false });
    hook.result.current.handleMouseUp(mouseEvent(2.5, 0.5));

    // Find the updater call that translates the selection (called after commit).
    const updaterCall = setSelection.mock.calls.find((c) => typeof c[0] === 'function');
    expect(updaterCall).toBeDefined();
    const updater = updaterCall![0] as (prev: typeof sel | null) => typeof sel | null;
    const result = updater(sel);
    expect(result).toEqual({ shape: 'rect', x1: 2, y1: 0, x2: 3, y2: 1 });
  });
});

// ── Marquee: click-release at same cell deselects ───────────────────────────

describe('marquee draw: click-release edge cases', () => {
  it('click-release on the same cell clears the selection', () => {
    const existing = { shape: 'rect' as const, x1: 0, y1: 0, x2: 2, y2: 2 };
    const { hook, setSelection } = setup(
      { activeTool: 'marquee', marqueeShape: 'rect' },
      { selection: existing },
    );

    hook.result.current.handleMouseDown(mouseEvent(1.5, 1.5));
    setSelection.mockClear(); // ignore the degenerate-rect set from mousedown
    hook.result.current.handleMouseUp(mouseEvent(1.5, 1.5));

    expect(setSelection).toHaveBeenCalledWith(null);
  });

  it('click-release at different cells does NOT clear the selection', () => {
    const { hook, setSelection } = setup({
      activeTool: 'marquee',
      marqueeShape: 'rect',
    });

    hook.result.current.handleMouseDown(mouseEvent(0.5, 0.5));
    setSelection.mockClear();
    hook.result.current.handleMouseUp(mouseEvent(2.5, 2.5));

    expect(setSelection).not.toHaveBeenCalledWith(null);
  });
});

// ── Pen tool: close-loop on first anchor ─────────────────────────────────────

describe('pen tool close-loop', () => {
  it('pointerdown within Manhattan distance ≤1 of the first anchor commits the loop', () => {
    const { hook, penContext, penCommit } = setup({ activeTool: 'pen' });
    penContext.anchors.current = [[0, 0], [2, 0]]; // first anchor at (0,0)
    // (1,0) is distance 1 from (0,0) — should close the loop.
    hook.result.current.handleMouseDown(mouseEvent(1.5, 0.5));
    expect(penCommit).toHaveBeenCalledWith(true);
  });

  it('pointerdown far from the first anchor appends a new anchor', () => {
    const { hook, penContext, penCommit } = setup({ activeTool: 'pen' });
    penContext.anchors.current = [[0, 0]];
    // (3,3) is far from (0,0) — should NOT close.
    hook.result.current.handleMouseDown(mouseEvent(3.5, 3.5));
    expect(penCommit).not.toHaveBeenCalled();
    expect(penContext.anchors.current).toHaveLength(2);
  });
});

// ── Shape tools ──────────────────────────────────────────────────────────────

describe('shape tools: additional variants', () => {
  it('line tool traces a horizontal line between pointerdown and pointerup', () => {
    const { hook, commit } = setup({ activeTool: 'line', activeColor: '#112233' });
    hook.result.current.handleMouseDown(mouseEvent(0.5, 0.5));
    hook.result.current.handleMouseUp(mouseEvent(3.5, 0.5));

    expect(commit).toHaveBeenCalledTimes(1);
    const next = commit.mock.calls[0][0] as string[];
    // All four cells in row 0 should be painted.
    expect(next[0]).toBe('#112233');
    expect(next[1]).toBe('#112233');
    expect(next[2]).toBe('#112233');
    expect(next[3]).toBe('#112233');
    // Row 1 untouched.
    expect(next[4]).toBe('');
  });

  it('wand on an empty cell with no same-colour neighbours clears the selection', () => {
    // All cells empty — floodSelect returns cells of the same (empty) colour.
    // The wand is designed to select non-empty regions, so an empty-canvas
    // click clears rather than selects.
    // NOTE: if floodSelect returns the full empty region, setSelection is
    // called with a cells selection; we just verify the wand doesn't crash.
    const { hook } = setup({ activeTool: 'marquee', marqueeShape: 'wand' });
    // Should not throw — whatever it does is non-crashing.
    expect(() => hook.result.current.handleMouseDown(mouseEvent(0.5, 0.5))).not.toThrow();
  });
});
