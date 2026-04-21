/**
 * Tests for `useEditorFileHandlers` — drag-drop image import, clipboard
 * copy/cut/paste, and the window-level paste listener.
 *
 * `importImageAsPixels` is mocked at the top level so no real canvas is
 * needed.  The internal pixel-clipboard (`@/lib/clipboard`) is used directly
 * so `handleCopy` / `handlePaste` round-trips can be asserted through real
 * module state rather than a separate spy.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useEditorFileHandlers } from './useEditorFileHandlers';
import { __resetClipForTests, hasClip, setClip } from '@/lib/clipboard';
import type { PixelArtSelection } from './usePixelArtSelection';
import type { Layer } from '@/lib/storage';
import type { PenContext } from './usePenTool';

// ── Mock image import ──────────────────────────────────────────────────────────
vi.mock('@/lib/imageImport', () => ({
  importImageAsPixels: vi.fn().mockResolvedValue(Array(64).fill('')),
  layerNameFromFile: vi.fn((f: File) => f.name.replace(/\.[^.]+$/, '')),
}));

// Import after mock so the reference is the stubbed version.
import { importImageAsPixels } from '@/lib/imageImport';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeLayer(overrides: Partial<Layer> = {}): Layer {
  return {
    id: 'layer-1',
    name: 'Background',
    visible: true,
    opacity: 1,
    pixels: Array(256).fill(''),
    ...overrides,
  };
}

function makeSelection(): PixelArtSelection {
  return { shape: 'rect', x1: 0, y1: 0, x2: 3, y2: 3 };
}

function makePenContext(overrides: Partial<PenContext> = {}): PenContext {
  return {
    cancel: vi.fn(),
    commit: vi.fn(),
    anchors: [],
    cursor: null,
    ...overrides,
  } as unknown as PenContext;
}

interface SetupOptions {
  selection?: PixelArtSelection | null;
  activeLayer?: Layer | null;
  activeLayerLocked?: boolean;
  selectionContainsCell?: (col: number, row: number) => boolean;
  penContext?: PenContext;
}

function setup(opts: SetupOptions = {}) {
  const addLayerWithPixels = vi.fn();
  const pasteAsNewLayer = vi.fn();
  const commitPixels = vi.fn();
  const emitChange = vi.fn();
  const penContext = opts.penContext ?? makePenContext();

  const { result, unmount } = renderHook(() =>
    useEditorFileHandlers({
      width: 16,
      height: 16,
      addLayerWithPixels,
      pasteAsNewLayer,
      commitPixels,
      emitChange,
      selection: opts.selection ?? null,
      activeLayer: opts.activeLayer ?? null,
      activeLayerLocked: opts.activeLayerLocked ?? false,
      selectionContainsCell: opts.selectionContainsCell ?? (() => false),
      penContext,
    }),
  );

  return { result, unmount, addLayerWithPixels, pasteAsNewLayer, commitPixels, emitChange, penContext };
}

// ── Setup / teardown ───────────────────────────────────────────────────────────

beforeEach(() => {
  __resetClipForTests();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// ── onWrapperDragOver ──────────────────────────────────────────────────────────

describe('onWrapperDragOver', () => {
  it('calls preventDefault and sets dropEffect=copy when types includes Files', () => {
    const { result } = setup();
    const preventDefault = vi.fn();
    const e = {
      preventDefault,
      dataTransfer: { types: ['Files'], dropEffect: '' },
    } as unknown as React.DragEvent;

    act(() => result.current.onWrapperDragOver(e));

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(e.dataTransfer.dropEffect).toBe('copy');
  });

  it('does nothing when types does not include Files', () => {
    const { result } = setup();
    const preventDefault = vi.fn();
    const e = {
      preventDefault,
      dataTransfer: { types: ['text/plain'], dropEffect: '' },
    } as unknown as React.DragEvent;

    act(() => result.current.onWrapperDragOver(e));

    expect(preventDefault).not.toHaveBeenCalled();
    expect(e.dataTransfer.dropEffect).toBe('');
  });
});

// ── onWrapperDrop ─────────────────────────────────────────────────────────────

describe('onWrapperDrop', () => {
  it('calls preventDefault and addLayerWithPixels when an image file is dropped', async () => {
    const { result, addLayerWithPixels } = setup();
    const imageFile = new File([''], 'art.png', { type: 'image/png' });
    const preventDefault = vi.fn();
    const e = {
      preventDefault,
      dataTransfer: { files: [imageFile] },
    } as unknown as React.DragEvent;

    await act(async () => {
      result.current.onWrapperDrop(e);
      // Allow the async importImageAsPixels microtask to resolve.
      await Promise.resolve();
    });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(importImageAsPixels).toHaveBeenCalledOnce();
    expect(addLayerWithPixels).toHaveBeenCalledOnce();
  });

  it('does nothing when no image file is present', async () => {
    const { result, addLayerWithPixels } = setup();
    const textFile = new File(['hello'], 'note.txt', { type: 'text/plain' });
    const preventDefault = vi.fn();
    const e = {
      preventDefault,
      dataTransfer: { files: [textFile] },
    } as unknown as React.DragEvent;

    await act(async () => {
      result.current.onWrapperDrop(e);
      await Promise.resolve();
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(addLayerWithPixels).not.toHaveBeenCalled();
  });
});

// ── handleCopy ────────────────────────────────────────────────────────────────

describe('handleCopy', () => {
  it('does nothing when selection is null', () => {
    const { result } = setup({ selection: null, activeLayer: makeLayer() });

    act(() => result.current.handleCopy());

    expect(hasClip()).toBe(false);
  });

  it('does nothing when activeLayer is null', () => {
    const { result } = setup({ selection: makeSelection(), activeLayer: null });

    act(() => result.current.handleCopy());

    expect(hasClip()).toBe(false);
  });

  it('populates the clipboard when selection and activeLayer both exist', () => {
    const layer = makeLayer({ pixels: Array(256).fill('#ff0000') });
    const selection = makeSelection();
    const { result } = setup({
      selection,
      activeLayer: layer,
      selectionContainsCell: (col, row) => col <= 1 && row <= 1,
    });

    act(() => result.current.handleCopy());

    expect(hasClip()).toBe(true);
  });
});

// ── handleCut ─────────────────────────────────────────────────────────────────

describe('handleCut', () => {
  it('does nothing when activeLayerLocked is true', () => {
    const layer = makeLayer({ pixels: Array(256).fill('#ff0000') });
    const selection = makeSelection();
    const { result, commitPixels, emitChange } = setup({
      selection,
      activeLayer: layer,
      activeLayerLocked: true,
      selectionContainsCell: () => true,
    });

    act(() => result.current.handleCut());

    expect(commitPixels).not.toHaveBeenCalled();
    expect(emitChange).not.toHaveBeenCalled();
    expect(hasClip()).toBe(false);
  });

  it('does nothing when selection is null', () => {
    const layer = makeLayer({ pixels: Array(256).fill('#ff0000') });
    const { result, commitPixels, emitChange } = setup({
      selection: null,
      activeLayer: layer,
      activeLayerLocked: false,
    });

    act(() => result.current.handleCut());

    expect(commitPixels).not.toHaveBeenCalled();
    expect(emitChange).not.toHaveBeenCalled();
  });

  it('does nothing when activeLayer is null', () => {
    const { result, commitPixels, emitChange } = setup({
      selection: makeSelection(),
      activeLayer: null,
      activeLayerLocked: false,
    });

    act(() => result.current.handleCut());

    expect(commitPixels).not.toHaveBeenCalled();
    expect(emitChange).not.toHaveBeenCalled();
  });

  it('calls commitPixels and emitChange when not locked and selection + layer present', () => {
    const layer = makeLayer({ pixels: Array(256).fill('#ff0000') });
    const selection = makeSelection();
    const { result, commitPixels, emitChange } = setup({
      selection,
      activeLayer: layer,
      activeLayerLocked: false,
      selectionContainsCell: (col, row) => col <= 1 && row <= 1,
    });

    act(() => result.current.handleCut());

    expect(commitPixels).toHaveBeenCalledOnce();
    expect(emitChange).toHaveBeenCalledOnce();
    expect(hasClip()).toBe(true);
  });
});

// ── handlePaste ───────────────────────────────────────────────────────────────

describe('handlePaste', () => {
  it('does nothing when there is no clip in the clipboard', () => {
    const { result, pasteAsNewLayer } = setup();

    act(() => result.current.handlePaste());

    expect(pasteAsNewLayer).not.toHaveBeenCalled();
  });

  it('calls pasteAsNewLayer and penContext.cancel when a clip exists', () => {
    // Seed the clipboard directly.
    setClip({ width: 2, height: 2, pixels: ['#f00', '#f00', '#f00', '#f00'], sourceLayerName: 'Art' });

    const penContext = makePenContext();
    const { result, pasteAsNewLayer } = setup({ penContext });

    act(() => result.current.handlePaste());

    expect(pasteAsNewLayer).toHaveBeenCalledOnce();
    expect(penContext.cancel).toHaveBeenCalledOnce();
  });

  it('derives paste layer name from sourceLayerName when present', () => {
    setClip({ width: 1, height: 1, pixels: ['#abc'], sourceLayerName: 'Sketch' });
    const { result, pasteAsNewLayer } = setup();

    act(() => result.current.handlePaste());

    const [, name] = pasteAsNewLayer.mock.calls[0] as [string[], string];
    expect(name).toBe('Copy of Sketch');
  });

  it('uses "Paste" as fallback name when sourceLayerName is absent', () => {
    setClip({ width: 1, height: 1, pixels: ['#abc'] });
    const { result, pasteAsNewLayer } = setup();

    act(() => result.current.handlePaste());

    const [, name] = pasteAsNewLayer.mock.calls[0] as [string[], string];
    expect(name).toBe('Paste');
  });
});

// ── Window paste listener ─────────────────────────────────────────────────────

describe('window paste listener', () => {
  /**
   * jsdom doesn't expose ClipboardEvent as a global, so we build a minimal
   * Event with the `clipboardData` property grafted on manually, then
   * dispatch it on the target element via `dispatchEvent`.
   */
  function makePasteEvent(clipboardData: Partial<DataTransfer>, target: EventTarget = window): Event {
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: clipboardData, configurable: true });
    Object.defineProperty(event, 'target', { value: target, configurable: true });
    return event;
  }

  function makeClipboardItem(type: string): DataTransferItem {
    const file = new File([''], 'paste.png', { type });
    return {
      kind: 'file',
      type,
      getAsFile: () => file,
      getAsString: vi.fn(),
      webkitGetAsEntry: vi.fn(),
    } as unknown as DataTransferItem;
  }

  it('calls addLayerWithPixels when paste event carries an image file', async () => {
    const { addLayerWithPixels } = setup();

    const item = makeClipboardItem('image/png');
    const event = makePasteEvent({ items: [item] as unknown as DataTransferItemList });

    await act(async () => {
      window.dispatchEvent(event);
      await Promise.resolve();
    });

    expect(importImageAsPixels).toHaveBeenCalledOnce();
    expect(addLayerWithPixels).toHaveBeenCalledOnce();
  });

  it('does nothing when the paste target is an INPUT element', async () => {
    const { addLayerWithPixels } = setup();

    const input = document.createElement('input');
    document.body.appendChild(input);

    const item = makeClipboardItem('image/png');
    // Simulate the event target being the input by setting target before dispatch.
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: { items: [item] as unknown as DataTransferItemList },
      configurable: true,
    });
    // We cannot override `target` on a live event — instead dispatch directly on input
    // and rely on the hook's `e.target.tagName === 'INPUT'` guard to bail out.
    // The window listener receives the bubbled event; jsdom sets target correctly.
    await act(async () => {
      input.dispatchEvent(event);
      await Promise.resolve();
    });

    expect(addLayerWithPixels).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('uses internal clip when system clipboard has no image', () => {
    setClip({ width: 1, height: 1, pixels: ['#abc'], sourceLayerName: 'Sketch' });

    const penContext = makePenContext();
    const { pasteAsNewLayer } = setup({ penContext });

    act(() => {
      const event = makePasteEvent({ items: [] as unknown as DataTransferItemList });
      window.dispatchEvent(event);
    });

    expect(pasteAsNewLayer).toHaveBeenCalledOnce();
    expect(penContext.cancel).toHaveBeenCalledOnce();
  });

  it('prefers internal clip over system clipboard image', async () => {
    // Internal clip set (user just copied from canvas) — should win over
    // any image that happens to be in the system clipboard.
    setClip({ width: 1, height: 1, pixels: ['#abc'], sourceLayerName: 'Sketch' });

    const penContext = makePenContext();
    const { pasteAsNewLayer, addLayerWithPixels } = setup({ penContext });

    const item = makeClipboardItem('image/png');
    const event = makePasteEvent({ items: [item] as unknown as DataTransferItemList });

    await act(async () => {
      window.dispatchEvent(event);
      await Promise.resolve();
    });

    expect(pasteAsNewLayer).toHaveBeenCalledOnce();
    expect(addLayerWithPixels).not.toHaveBeenCalled();
  });

  it('removes the window listener after unmount so paste no longer triggers', async () => {
    const { addLayerWithPixels, unmount } = setup();

    unmount();

    const item = makeClipboardItem('image/png');
    const event = makePasteEvent({ items: [item] as unknown as DataTransferItemList });

    await act(async () => {
      window.dispatchEvent(event);
      await Promise.resolve();
    });

    expect(addLayerWithPixels).not.toHaveBeenCalled();
  });
});

// React import needed for the DragEvent type in inline casts above.
import type React from 'react';
