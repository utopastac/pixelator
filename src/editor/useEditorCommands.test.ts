/**
 * Tests for `useEditorCommands` — the hook that groups the editor's one-shot
 * commands: rotate, resize, selection-clear, and all download variants.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEditorCommands } from './useEditorCommands';
import type { UseEditorCommandsInput } from './useEditorCommands';
import type { Layer } from '@/lib/storage';

vi.mock('./lib/pixelArtPng', () => ({
  pixelsToPngBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));

function makeLayer(id: string, pixels: string[], visible = true): Layer {
  return { id, name: id, visible, opacity: 1, pixels };
}

function setup(overrides?: Partial<UseEditorCommandsInput>) {
  const commitPixels = vi.fn();
  const commitResize = vi.fn();
  const emitChange = vi.fn();
  const allowCommitOrSignal = vi.fn(() => true);
  const setSelection = vi.fn();
  const dragContext = {
    dragMode: { current: null } as React.MutableRefObject<null>,
    dragStart: { current: null } as React.MutableRefObject<null>,
    lifted: { current: null } as React.MutableRefObject<null>,
    basePixelsAfterLift: { current: null } as React.MutableRefObject<null>,
    moveOffset: { current: [0, 0] as [number, number] },
    strokeInsideSelection: { current: true },
  };
  const pixels = new Array(16).fill('');
  pixels[0] = '#ff0000';
  const layers: Layer[] = [makeLayer('l1', pixels)];

  const input: UseEditorCommandsInput = {
    width: 4,
    height: 4,
    pixels,
    layers,
    allowCommitOrSignal,
    commitPixels,
    commitResize,
    emitChange,
    selection: null,
    setSelection,
    selectionContainsCell: () => false,
    dragContext,
    sizesEnabled: true,
    title: 'My Drawing',
    pngExportScale: 2,
    ...overrides,
  };
  const hook = renderHook(() => useEditorCommands(input));
  return { hook, commitPixels, commitResize, emitChange, allowCommitOrSignal, setSelection, dragContext, input };
}

// ── Anchor / URL helpers ───────────────────────────────────────────────────────

// Capture the real createElement once, before any mocking, so fallback calls
// can invoke it without recursion.
const _realCreateElement = document.createElement.bind(document);

function stubDownload() {
  let anchorEl: { href: string; download: string; click: ReturnType<typeof vi.fn> };
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'a') {
      anchorEl = { href: '', download: '', click: vi.fn() };
      return anchorEl as unknown as HTMLElement;
    }
    return _realCreateElement(tag) as HTMLElement;
  });
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
  const getAnchor = () => anchorEl;
  return { getAnchor };
}

function restoreDownload() {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
}

// ── handleRotate ───────────────────────────────────────────────────────────────

describe('handleRotate', () => {
  it('cw: calls commitPixels with rotated pixels and emitChange', () => {
    const { hook, commitPixels, emitChange } = setup();
    act(() => { hook.result.current.handleRotate('cw'); });
    expect(commitPixels).toHaveBeenCalledTimes(1);
    expect(emitChange).toHaveBeenCalledTimes(1);
    // The rotated array should differ from the original (pixel moved from [0] to another position)
    const rotated = commitPixels.mock.calls[0][0] as string[];
    expect(rotated).not.toEqual(new Array(16).fill('').map((_, i) => i === 0 ? '#ff0000' : ''));
  });

  it('ccw: calls commitPixels with rotated pixels and emitChange', () => {
    const { hook, commitPixels, emitChange } = setup();
    act(() => { hook.result.current.handleRotate('ccw'); });
    expect(commitPixels).toHaveBeenCalledTimes(1);
    expect(emitChange).toHaveBeenCalledTimes(1);
    const rotated = commitPixels.mock.calls[0][0] as string[];
    expect(rotated).not.toEqual(new Array(16).fill('').map((_, i) => i === 0 ? '#ff0000' : ''));
  });

  it('when allowCommitOrSignal returns false: nothing is called', () => {
    const { hook, commitPixels, emitChange } = setup({ allowCommitOrSignal: vi.fn(() => false) });
    act(() => { hook.result.current.handleRotate('cw'); });
    expect(commitPixels).not.toHaveBeenCalled();
    expect(emitChange).not.toHaveBeenCalled();
  });

  it('with a selection: rotation is confined to the selection bbox — pixel outside bbox is unchanged', () => {
    // 4×4 grid. Paint cell (0,0)='#ff0000' and cell (2,2)='#0000ff'.
    // Select only top-left 2×2 (x1=0,y1=0,x2=1,y2=1). Rotating CW inside that
    // bbox must move #ff0000 but leave #0000ff at index 2*4+2=10 untouched.
    const pixels = new Array(16).fill('');
    pixels[0] = '#ff0000';   // (col=0, row=0) — inside selection
    pixels[10] = '#0000ff';  // (col=2, row=2) — outside selection
    const layers = [makeLayer('l1', pixels)];
    const selection = { shape: 'rect' as const, x1: 0, y1: 0, x2: 1, y2: 1 };

    const { hook, commitPixels } = setup({ pixels, layers, selection });
    act(() => { hook.result.current.handleRotate('cw'); });

    const rotated = commitPixels.mock.calls[0][0] as string[];
    expect(rotated[10]).toBe('#0000ff'); // cell outside bbox unchanged
    // #ff0000 should no longer be at index 0 (it was rotated within the 2×2 bbox)
    expect(rotated[0]).not.toBe('#ff0000');
  });
});

// ── handlePickSize ─────────────────────────────────────────────────────────────

describe('handlePickSize', () => {
  it('same dimensions (4×4 → 4×4): no-op — commitResize not called', () => {
    const { hook, commitResize } = setup();
    act(() => { hook.result.current.handlePickSize(4, 4); });
    expect(commitResize).not.toHaveBeenCalled();
  });

  it('sizesEnabled=false: no-op — commitResize not called', () => {
    const { hook, commitResize } = setup({ sizesEnabled: false });
    act(() => { hook.result.current.handlePickSize(8, 8); });
    expect(commitResize).not.toHaveBeenCalled();
  });

  it('different size: commitResize called with resized layers and new dims; setSelection called with null', () => {
    const { hook, commitResize, setSelection } = setup();
    act(() => { hook.result.current.handlePickSize(8, 8); });
    expect(commitResize).toHaveBeenCalledTimes(1);
    const [resizedLayers, newWidth, newHeight] = commitResize.mock.calls[0] as [Layer[], number, number];
    expect(newWidth).toBe(8);
    expect(newHeight).toBe(8);
    expect(resizedLayers[0].pixels).toHaveLength(8 * 8);
    expect(setSelection).toHaveBeenCalledWith(null);
  });

  it('dragContext.lifted.current is set to null after resize', () => {
    const { hook, dragContext } = setup();
    dragContext.lifted.current = { colors: ['#f00'], x1: 0, y1: 0, x2: 0, y2: 0 } as unknown as null;
    act(() => { hook.result.current.handlePickSize(8, 8); });
    expect(dragContext.lifted.current).toBeNull();
  });
});

// ── clearSelection ─────────────────────────────────────────────────────────────

describe('clearSelection', () => {
  it('selection=null: no-op — commitPixels not called', () => {
    const { hook, commitPixels } = setup({ selection: null });
    act(() => { hook.result.current.clearSelection(); });
    expect(commitPixels).not.toHaveBeenCalled();
  });

  it('with rect selection and selectionContainsCell matching all cells in bbox: commitPixels clears those cells; emitChange called', () => {
    // 4×4 grid. Red pixel at (0,0). Selection covers (0,0)→(1,1).
    // selectionContainsCell returns true for any cell within that bbox.
    const pixels = new Array(16).fill('');
    pixels[0] = '#ff0000'; // (col=0, row=0) inside selection
    const selection = { shape: 'rect' as const, x1: 0, y1: 0, x2: 1, y2: 1 };
    const { hook, commitPixels, emitChange } = setup({
      pixels,
      selection,
      selectionContainsCell: (col, row) => col <= 1 && row <= 1,
    });
    act(() => { hook.result.current.clearSelection(); });
    expect(commitPixels).toHaveBeenCalledTimes(1);
    expect(emitChange).toHaveBeenCalledTimes(1);
    const cleared = commitPixels.mock.calls[0][0] as string[];
    expect(cleared[0]).toBe(''); // cell (0,0) was cleared
  });

  it('when allowCommitOrSignal returns false: nothing called', () => {
    const pixels = new Array(16).fill('');
    pixels[0] = '#ff0000';
    const selection = { shape: 'rect' as const, x1: 0, y1: 0, x2: 1, y2: 1 };
    const { hook, commitPixels, emitChange } = setup({
      pixels,
      selection,
      allowCommitOrSignal: vi.fn(() => false),
      selectionContainsCell: () => true,
    });
    act(() => { hook.result.current.clearSelection(); });
    expect(commitPixels).not.toHaveBeenCalled();
    expect(emitChange).not.toHaveBeenCalled();
  });
});

// ── slugify (tested via download filenames) ────────────────────────────────────

describe('slugify (via downloadSvg filename)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { restoreDownload(); vi.useRealTimers(); });

  it("title 'My Drawing' → 'My-Drawing' in filename", async () => {
    const { getAnchor } = stubDownload();
    const { hook } = setup({ title: 'My Drawing' });
    await act(async () => { hook.result.current.downloadSvg(); });
    expect(getAnchor().download).toBe('My-Drawing.svg');
  });

  it("title 'hello!!world' → 'hello-world' in filename (runs collapsed)", async () => {
    const { getAnchor } = stubDownload();
    const { hook } = setup({ title: 'hello!!world' });
    await act(async () => { hook.result.current.downloadSvg(); });
    expect(getAnchor().download).toBe('hello-world.svg');
  });

  it("empty title → fallback 'pixel-art' in filename", async () => {
    const { getAnchor } = stubDownload();
    const { hook } = setup({ title: '' });
    await act(async () => { hook.result.current.downloadSvg(); });
    expect(getAnchor().download).toBe('pixel-art.svg');
  });

  it("undefined title → fallback 'pixel-art' in filename", async () => {
    const { getAnchor } = stubDownload();
    const { hook } = setup({ title: undefined });
    await act(async () => { hook.result.current.downloadSvg(); });
    expect(getAnchor().download).toBe('pixel-art.svg');
  });
});

// ── downloadSvg ───────────────────────────────────────────────────────────────

describe('downloadSvg', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { restoreDownload(); vi.useRealTimers(); });

  it('creates an anchor element and calls click()', async () => {
    const { getAnchor } = stubDownload();
    const { hook } = setup();
    await act(async () => { hook.result.current.downloadSvg(); });
    expect(getAnchor().click).toHaveBeenCalledTimes(1);
  });

  it('filename ends with .svg', async () => {
    const { getAnchor } = stubDownload();
    const { hook } = setup();
    await act(async () => { hook.result.current.downloadSvg(); });
    expect(getAnchor().download).toMatch(/\.svg$/);
  });

  it('title-derived slug is used in filename', async () => {
    const { getAnchor } = stubDownload();
    const { hook } = setup({ title: 'Test Art' });
    await act(async () => { hook.result.current.downloadSvg(); });
    expect(getAnchor().download).toBe('Test-Art.svg');
  });
});

// ── downloadPng ───────────────────────────────────────────────────────────────

describe('downloadPng', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { restoreDownload(); vi.useRealTimers(); });

  it('calls click() on anchor', async () => {
    const { getAnchor } = stubDownload();
    const { hook } = setup();
    await act(async () => { await hook.result.current.downloadPng(); });
    expect(getAnchor().click).toHaveBeenCalledTimes(1);
  });

  it('filename contains @2x.png (default pngExportScale=2)', async () => {
    const { getAnchor } = stubDownload();
    const { hook } = setup({ pngExportScale: 2 });
    await act(async () => { await hook.result.current.downloadPng(); });
    expect(getAnchor().download).toContain('@2x.png');
  });

  it('custom scale override: downloadPng(4) → @4x.png', async () => {
    const { getAnchor } = stubDownload();
    const { hook } = setup();
    await act(async () => { await hook.result.current.downloadPng(4); });
    expect(getAnchor().download).toContain('@4x.png');
  });
});

// ── downloadLayersSvg ─────────────────────────────────────────────────────────

describe('downloadLayersSvg', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { restoreDownload(); vi.useRealTimers(); });

  it('all-invisible layers: resolves without triggering any download', async () => {
    const pixels = new Array(16).fill('');
    pixels[0] = '#ff0000';
    const layers = [makeLayer('l1', pixels, false)]; // visible=false
    const { hook } = setup({ layers });

    let clicked = false;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const el = { href: '', download: '', click: () => { clicked = true; } };
        return el as unknown as HTMLElement;
      }
      return _realCreateElement(tag) as HTMLElement;
    });
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });

    await act(async () => { await hook.result.current.downloadLayersSvg(); });
    expect(clicked).toBe(false);
  });

  it('all-empty visible layers: resolves without triggering any download', async () => {
    const emptyPixels = new Array(16).fill('');
    const layers = [makeLayer('l1', emptyPixels, true)]; // visible but empty
    const { hook } = setup({ layers });

    let clicked = false;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const el = { href: '', download: '', click: () => { clicked = true; } };
        return el as unknown as HTMLElement;
      }
      return _realCreateElement(tag) as HTMLElement;
    });
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });

    await act(async () => { await hook.result.current.downloadLayersSvg(); });
    expect(clicked).toBe(false);
  });

  it('one visible non-empty layer: exactly one download; filename ends .svg', async () => {
    const clicks: string[] = [];
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const el = { href: '', download: '', click: () => {} };
        el.click = () => { clicks.push(el.download); };
        return el as unknown as HTMLElement;
      }
      return _realCreateElement(tag) as HTMLElement;
    });
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });

    const pixels = new Array(16).fill('');
    pixels[0] = '#ff0000';
    const layers = [makeLayer('l1', pixels, true)];
    const { hook } = setup({ layers });

    await act(async () => {
      const p = hook.result.current.downloadLayersSvg();
      vi.runAllTimers();
      await p;
    });
    expect(clicks).toHaveLength(1);
    expect(clicks[0]).toMatch(/\.svg$/);
  });

  it('two layers both named "Sketch": filenames deduplicated to Sketch.svg and Sketch-1.svg', async () => {
    const downloads: string[] = [];
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const el = { href: '', download: '', click: () => {} };
        el.click = () => { downloads.push(el.download); };
        return el as unknown as HTMLElement;
      }
      return _realCreateElement(tag) as HTMLElement;
    });
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });

    const pixels1 = new Array(16).fill('');
    pixels1[0] = '#ff0000';
    const pixels2 = new Array(16).fill('');
    pixels2[1] = '#00ff00';

    const layers: Layer[] = [
      { id: 'a', name: 'Sketch', visible: true, opacity: 1, pixels: pixels1 },
      { id: 'b', name: 'Sketch', visible: true, opacity: 1, pixels: pixels2 },
    ];

    const { hook } = setup({ layers });
    await act(async () => {
      const p = hook.result.current.downloadLayersSvg();
      // Advance past the 100ms stagger between layers
      vi.advanceTimersByTime(200);
      await p;
    });

    expect(downloads).toHaveLength(2);
    expect(downloads).toContain('Sketch.svg');
    expect(downloads).toContain('Sketch-1.svg');
  });
});
