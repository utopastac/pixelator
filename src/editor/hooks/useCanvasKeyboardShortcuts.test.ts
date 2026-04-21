/**
 * Tests for `useCanvasKeyboardShortcuts` — the document-level keydown
 * dispatcher that powers every editor keyboard shortcut. Events are fired on
 * `document` via `fireEvent.keyDown` and asserted through the mocked setters.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { useCanvasKeyboardShortcuts } from './useCanvasKeyboardShortcuts';
import type { UseCanvasKeyboardShortcutsArgs } from './useCanvasKeyboardShortcuts';
import type { PixelArtSelection } from '../lib/pixelArtUtils';
import type { LiftedPixels } from './usePixelArtSelection';
import type { UseLayerTransformReturn } from './useLayerTransform';

/**
 * Build a default args bundle with vi.fn() mocks and identity refs. Overrides
 * are shallow-merged; the returned mocks object exposes every vi.fn() so tests
 * can assert on them directly.
 */
function buildArgs(
  overrides: Partial<UseCanvasKeyboardShortcutsArgs> = {},
): {
  args: UseCanvasKeyboardShortcutsArgs;
  mocks: {
    setActiveTool: ReturnType<typeof vi.fn>;
    commitPenPath: ReturnType<typeof vi.fn>;
    cancelPenPath: ReturnType<typeof vi.fn>;
    cancelPolygonSelect: ReturnType<typeof vi.fn>;
    commitPolygonSelect: ReturnType<typeof vi.fn>;
    setSelection: ReturnType<typeof vi.fn>;
    clearSelection: ReturnType<typeof vi.fn>;
    commit: ReturnType<typeof vi.fn>;
    dispatch: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
    undo: ReturnType<typeof vi.fn>;
    redo: ReturnType<typeof vi.fn>;
    fit: ReturnType<typeof vi.fn>;
    setZoom: ReturnType<typeof vi.fn>;
    layerTransformCommit: ReturnType<typeof vi.fn>;
    layerTransformCancel: ReturnType<typeof vi.fn>;
    layerTransformSetMatrix: ReturnType<typeof vi.fn>;
    onCopy: ReturnType<typeof vi.fn>;
    onCut: ReturnType<typeof vi.fn>;
    onPaste: ReturnType<typeof vi.fn>;
  };
} {
  const mocks = {
    setActiveTool: vi.fn(),
    commitPenPath: vi.fn(),
    cancelPenPath: vi.fn(),
    cancelPolygonSelect: vi.fn(),
    commitPolygonSelect: vi.fn(),
    setSelection: vi.fn(),
    clearSelection: vi.fn(),
    commit: vi.fn(),
    dispatch: vi.fn(),
    emit: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    fit: vi.fn(),
    setZoom: vi.fn(),
    layerTransformCommit: vi.fn(),
    layerTransformCancel: vi.fn(),
    layerTransformSetMatrix: vi.fn(),
    onCopy: vi.fn(),
    onCut: vi.fn(),
    onPaste: vi.fn(),
  };
  const liftedPixels: { current: LiftedPixels | null } = { current: null };
  const layerTransform: UseLayerTransformReturn = {
    bbox: null,
    pending: null,
    isPending: false,
    beginPending: () => null,
    setMatrix: mocks.layerTransformSetMatrix,
    multiplyMatrixLeft: vi.fn(),
    commit: mocks.layerTransformCommit,
    cancel: mocks.layerTransformCancel,
    hitTestHandle: () => null,
    transformedCorners: () => null,
  };
  const args: UseCanvasKeyboardShortcutsArgs = {
    disabled: false,
    activeTool: 'paint',
    setActiveTool: mocks.setActiveTool,
    lastShape: 'rect',
    marqueeShape: 'rect',
    commitPenPath: mocks.commitPenPath,
    cancelPenPath: mocks.cancelPenPath,
    cancelPolygonSelect: mocks.cancelPolygonSelect,
    commitPolygonSelect: mocks.commitPolygonSelect,
    selection: null,
    setSelection: mocks.setSelection,
    liftedPixels,
    selectionContainsCell: () => false,
    clearSelection: mocks.clearSelection,
    activePixels: {
      pixels: new Array(16).fill(''),
      commit: mocks.commit,
      dispatch: mocks.dispatch,
      emit: mocks.emit,
    },
    width: 4,
    height: 4,
    activeColor: '#ff0000',
    previewCanvasRef: { current: null },
    undo: mocks.undo,
    redo: mocks.redo,
    fit: mocks.fit,
    setZoom: mocks.setZoom,
    zoom: 1,
    layerTransform,
    onCopy: mocks.onCopy,
    onCut: mocks.onCut,
    onPaste: mocks.onPaste,
    ...overrides,
  };
  return { args, mocks };
}

function mount(overrides: Partial<UseCanvasKeyboardShortcutsArgs> = {}) {
  const bundle = buildArgs(overrides);
  const hook = renderHook(() => useCanvasKeyboardShortcuts(bundle.args));
  return { ...bundle, hook };
}

afterEach(() => cleanup());

describe('useCanvasKeyboardShortcuts', () => {
  it('single-letter tool shortcut (B) switches to paint', () => {
    const { mocks } = mount({ activeTool: 'eraser' });
    fireEvent.keyDown(document, { key: 'b' });
    expect(mocks.setActiveTool).toHaveBeenCalledWith('paint');
  });

  it('E switches to eraser, V to move, I to eyedropper, M to marquee', () => {
    const { mocks } = mount();
    fireEvent.keyDown(document, { key: 'e' });
    fireEvent.keyDown(document, { key: 'v' });
    fireEvent.keyDown(document, { key: 'i' });
    fireEvent.keyDown(document, { key: 'm' });
    expect(mocks.setActiveTool).toHaveBeenNthCalledWith(1, 'eraser');
    expect(mocks.setActiveTool).toHaveBeenNthCalledWith(2, 'move');
    expect(mocks.setActiveTool).toHaveBeenNthCalledWith(3, 'eyedropper');
    expect(mocks.setActiveTool).toHaveBeenNthCalledWith(4, 'marquee');
  });

  it('U resolves to the lastShape', () => {
    const { mocks } = mount({ lastShape: 'circle' });
    fireEvent.keyDown(document, { key: 'u' });
    expect(mocks.setActiveTool).toHaveBeenCalledWith('circle');
  });

  it('cmd/ctrl+Z calls undo, cmd/ctrl+Shift+Z calls redo, cmd/ctrl+Y also calls redo', () => {
    const { mocks } = mount();
    const isMac = /mac/i.test(navigator.userAgent);
    const mods = isMac ? { metaKey: true } : { ctrlKey: true };
    fireEvent.keyDown(document, { key: 'z', ...mods });
    fireEvent.keyDown(document, { key: 'z', ...mods, shiftKey: true });
    fireEvent.keyDown(document, { key: 'y', ...mods });
    expect(mocks.undo).toHaveBeenCalledTimes(1);
    expect(mocks.redo).toHaveBeenCalledTimes(2);
  });

  it('cmd/ctrl+C / X / V route to the clipboard handlers', () => {
    // The hook reads `navigator.userAgent` to decide between Cmd and Ctrl.
    // Detect jsdom's UA at runtime so we fire the right modifier.
    // Only C and X are handled on keydown. V intentionally falls through so
    // the browser's native `paste` event fires — the window-level listener
    // in PixelArtEditor handles image-from-clipboard + internal-clip paste.
    const isMac = /mac/i.test(navigator.userAgent);
    const mods = isMac ? { metaKey: true } : { ctrlKey: true };
    const { mocks } = mount();
    fireEvent.keyDown(document, { key: 'c', ...mods });
    fireEvent.keyDown(document, { key: 'x', ...mods });
    fireEvent.keyDown(document, { key: 'v', ...mods });
    expect(mocks.onCopy).toHaveBeenCalledTimes(1);
    expect(mocks.onCut).toHaveBeenCalledTimes(1);
    expect(mocks.onPaste).not.toHaveBeenCalled();
  });

  it('keys fired from an <input> target are ignored', () => {
    const { mocks } = mount();
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'b' });
    expect(mocks.setActiveTool).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('keys fired from a contentEditable target are ignored', () => {
    const { mocks } = mount();
    const div = document.createElement('div');
    // jsdom doesn't populate `isContentEditable` from the `contentEditable`
    // attribute alone, so stub the getter directly to match what the hook reads.
    Object.defineProperty(div, 'isContentEditable', { get: () => true });
    document.body.appendChild(div);
    fireEvent.keyDown(div, { key: 'b' });
    expect(mocks.setActiveTool).not.toHaveBeenCalled();
    document.body.removeChild(div);
  });

  it('Enter commits the pen path when the pen tool is active', () => {
    const { mocks } = mount({ activeTool: 'pen' });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(mocks.commitPenPath).toHaveBeenCalledWith(false);
  });

  it('Escape cancels the pen path when the pen tool is active', () => {
    const { mocks } = mount({ activeTool: 'pen' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mocks.cancelPenPath).toHaveBeenCalledTimes(1);
  });

  it('Escape deselects + drops liftedPixels when marquee is active', () => {
    const { mocks, args } = mount({ activeTool: 'marquee' });
    args.liftedPixels.current = {
      colors: ['#abc'],
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
    };
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mocks.setSelection).toHaveBeenCalledWith(null);
    expect(args.liftedPixels.current).toBeNull();
  });

  it('Delete with marquee + no Alt clears the selection', () => {
    const selection: PixelArtSelection = { shape: 'rect', x1: 0, y1: 0, x2: 2, y2: 2 };
    const { mocks } = mount({ activeTool: 'marquee', selection });
    fireEvent.keyDown(document, { key: 'Delete' });
    expect(mocks.clearSelection).toHaveBeenCalledTimes(1);
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it('Alt+Delete with marquee + selection fills the selection with activeColor', () => {
    const selection: PixelArtSelection = { shape: 'rect', x1: 0, y1: 0, x2: 1, y2: 1 };
    const { mocks } = mount({
      activeTool: 'marquee',
      selection,
      activeColor: '#abcdef',
      selectionContainsCell: (c, r) => c <= 1 && r <= 1,
    });
    fireEvent.keyDown(document, { key: 'Backspace', altKey: true });
    expect(mocks.commit).toHaveBeenCalledTimes(1);
    const filled = (mocks.commit.mock.calls[0] as unknown as [string[]])[0];
    // The top-left 2×2 block should be filled; the rest untouched.
    expect(filled[0]).toBe('#abcdef');
    expect(filled[1]).toBe('#abcdef');
    expect(filled[4]).toBe('#abcdef');
    expect(filled[5]).toBe('#abcdef');
    expect(filled[2]).toBe(''); // outside selection
  });

  it('arrow key with move tool commits a 1-cell nudge (no modifiers)', () => {
    // 4×4 grid, active layer has a single red pixel at (1, 1).
    const pixels = new Array(16).fill('');
    pixels[1 * 4 + 1] = '#ff0000';
    const { mocks, args } = mount({ activeTool: 'move' });
    args.activePixels.pixels = pixels;
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(mocks.commit).toHaveBeenCalledTimes(1);
    const next = (mocks.commit.mock.calls[0] as unknown as [string[]])[0];
    expect(next[1 * 4 + 2]).toBe('#ff0000');
    expect(next[1 * 4 + 1]).toBe('');
  });

  it('arrow key with move tool + Shift nudges by 10 cells', () => {
    // 20×1 grid, pixel at col 0.
    const pixels = new Array(20).fill('');
    pixels[0] = '#ff0000';
    const { mocks, args } = mount({ activeTool: 'move', width: 20, height: 1 });
    args.activePixels.pixels = pixels;
    fireEvent.keyDown(document, { key: 'ArrowRight', shiftKey: true });
    const next = (mocks.commit.mock.calls[0] as unknown as [string[]])[0];
    expect(next[10]).toBe('#ff0000');
    expect(next[0]).toBe('');
  });

  it('arrow key with modifiers other than Shift is ignored (no nudge)', () => {
    const { mocks } = mount({ activeTool: 'move' });
    fireEvent.keyDown(document, { key: 'ArrowRight', metaKey: true });
    fireEvent.keyDown(document, { key: 'ArrowRight', ctrlKey: true });
    fireEvent.keyDown(document, { key: 'ArrowRight', altKey: true });
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it('cmd/ctrl+0 fires fit; +1 sets zoom to 1; += zooms in; +- zooms out', () => {
    const { mocks } = mount({ zoom: 4 });
    const isMac = /mac/i.test(navigator.userAgent);
    const mods = isMac ? { metaKey: true } : { ctrlKey: true };
    fireEvent.keyDown(document, { key: '0', ...mods });
    fireEvent.keyDown(document, { key: '1', ...mods });
    fireEvent.keyDown(document, { key: '=', ...mods });
    fireEvent.keyDown(document, { key: '-', ...mods });
    expect(mocks.fit).toHaveBeenCalledTimes(1);
    expect(mocks.setZoom).toHaveBeenNthCalledWith(1, 1); // "1"
    expect(mocks.setZoom).toHaveBeenNthCalledWith(2, 8); // 4*2
    expect(mocks.setZoom).toHaveBeenNthCalledWith(3, 2); // 4/2
  });

  it('cmd/ctrl+D deselects and clears liftedPixels', () => {
    const { mocks, args } = mount();
    args.liftedPixels.current = {
      colors: ['#f00'],
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
    };
    const isMac = /mac/i.test(navigator.userAgent);
    const mods = isMac ? { metaKey: true } : { ctrlKey: true };
    fireEvent.keyDown(document, { key: 'd', ...mods });
    expect(mocks.setSelection).toHaveBeenCalledWith(null);
    expect(args.liftedPixels.current).toBeNull();
  });

  it('disabled=true skips all handlers (undo no-op)', () => {
    const { mocks } = mount({ disabled: true });
    const isMac = /mac/i.test(navigator.userAgent);
    const mods = isMac ? { metaKey: true } : { ctrlKey: true };
    fireEvent.keyDown(document, { key: 'z', ...mods });
    fireEvent.keyDown(document, { key: 'b' });
    expect(mocks.undo).not.toHaveBeenCalled();
    expect(mocks.setActiveTool).not.toHaveBeenCalled();
  });

  it('move + layerTransform pending: Enter commits, Escape cancels, H flips', () => {
    const layerTransformCommit = vi.fn();
    const layerTransformCancel = vi.fn();
    const layerTransformSetMatrix = vi.fn();
    const pendingTransform: UseLayerTransformReturn = {
      bbox: null,
      pending: {
        snapshotPixels: [],
        snapshotBBox: { x1: 0, y1: 0, x2: 1, y2: 1 },
        matrix: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
      },
      isPending: true,
      beginPending: () => null,
      setMatrix: layerTransformSetMatrix,
      multiplyMatrixLeft: vi.fn(),
      commit: layerTransformCommit,
      cancel: layerTransformCancel,
      hitTestHandle: () => null,
      transformedCorners: () => null,
    };
    mount({ activeTool: 'move', layerTransform: pendingTransform });
    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'h' });
    expect(layerTransformCommit).toHaveBeenCalledTimes(1);
    expect(layerTransformCancel).toHaveBeenCalledTimes(1);
    expect(layerTransformSetMatrix).toHaveBeenCalledTimes(1);
  });
});

describe('polygon select keyboard shortcuts', () => {
  it('Enter commits the polygon when marquee+polygon is active', () => {
    const { mocks } = mount({ activeTool: 'marquee', marqueeShape: 'polygon' });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(mocks.commitPolygonSelect).toHaveBeenCalledOnce();
    expect(mocks.commitPenPath).not.toHaveBeenCalled();
  });

  it('Enter does not commit polygon when marqueeShape is not polygon', () => {
    const { mocks } = mount({ activeTool: 'marquee', marqueeShape: 'rect' });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(mocks.commitPolygonSelect).not.toHaveBeenCalled();
  });

  it('Escape cancels the polygon and clears selection when marquee+polygon is active', () => {
    const { mocks } = mount({ activeTool: 'marquee', marqueeShape: 'polygon' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mocks.cancelPolygonSelect).toHaveBeenCalledOnce();
    expect(mocks.setSelection).toHaveBeenCalledWith(null);
  });

  it('Escape with marquee+rect does not call cancelPolygonSelect', () => {
    const { mocks } = mount({ activeTool: 'marquee', marqueeShape: 'rect' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mocks.cancelPolygonSelect).not.toHaveBeenCalled();
  });
});
