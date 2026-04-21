/**
 * Tests for `useEditorCanvasSetup` — the hook that owns canvas sizing,
 * per-layer offscreen management, and composite rendering.
 *
 * Both rendering helpers (`drawLayer`, `compositeLayers`) are mocked so
 * the tests never exercise the real 2D canvas API.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type React from 'react';
import type { Layer } from '@/lib/storage';
import { useEditorCanvasSetup } from './useEditorCanvasSetup';

// ---------------------------------------------------------------------------
// Module mocks — must live at the top level, before any imports that might
// transitively import the real modules.
// ---------------------------------------------------------------------------

vi.mock('../lib/pixelArtCanvas', () => ({ drawLayer: vi.fn() }));
vi.mock('../lib/composite', () => ({ compositeLayers: vi.fn() }));

// Pull the mocked references so we can inspect call counts / args.
import { drawLayer } from '../lib/pixelArtCanvas';
import { compositeLayers } from '../lib/composite';

const mockDrawLayer = vi.mocked(drawLayer);
const mockCompositeLayers = vi.mocked(compositeLayers);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLayer(id: string): Layer {
  return { id, name: id, visible: true, locked: false, opacity: 1, pixels: [] };
}

function makeCanvasRef(): React.RefObject<HTMLCanvasElement | null> {
  const canvas = document.createElement('canvas');
  return { current: canvas } as React.RefObject<HTMLCanvasElement | null>;
}

function makeNullRef(): React.RefObject<HTMLCanvasElement | null> {
  return { current: null } as React.RefObject<HTMLCanvasElement | null>;
}

/** Default props used across most tests. Override individual keys as needed. */
function defaultProps(overrides: Partial<Parameters<typeof useEditorCanvasSetup>[0]> = {}) {
  return {
    committedCanvasRef: makeCanvasRef(),
    previewCanvasRef: makeCanvasRef(),
    canvasMounted: true,
    width: 8,
    height: 8,
    layers: [makeLayer('l1')],
    layerTransformIsPending: false,
    activeLayerId: 'l1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset mock state between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockDrawLayer.mockClear();
  mockCompositeLayers.mockClear();
});

// ---------------------------------------------------------------------------
// Canvas resize effect
// ---------------------------------------------------------------------------

describe('canvas resize effect', () => {
  it('sets width and height on both canvas elements on mount', () => {
    const committedCanvasRef = makeCanvasRef();
    const previewCanvasRef = makeCanvasRef();

    renderHook(() =>
      useEditorCanvasSetup(
        defaultProps({ committedCanvasRef, previewCanvasRef, width: 16, height: 24 }),
      ),
    );

    expect(committedCanvasRef.current!.width).toBe(16);
    expect(committedCanvasRef.current!.height).toBe(24);
    expect(previewCanvasRef.current!.width).toBe(16);
    expect(previewCanvasRef.current!.height).toBe(24);
  });

  it('updates canvas dimensions when width/height props change', () => {
    const committedCanvasRef = makeCanvasRef();
    const previewCanvasRef = makeCanvasRef();
    const props = defaultProps({ committedCanvasRef, previewCanvasRef, width: 8, height: 8 });

    const { rerender } = renderHook(
      (p: Parameters<typeof useEditorCanvasSetup>[0]) => useEditorCanvasSetup(p),
      { initialProps: props },
    );

    expect(committedCanvasRef.current!.width).toBe(8);

    act(() => {
      rerender({ ...props, width: 32, height: 16 });
    });

    expect(committedCanvasRef.current!.width).toBe(32);
    expect(committedCanvasRef.current!.height).toBe(16);
    expect(previewCanvasRef.current!.width).toBe(32);
    expect(previewCanvasRef.current!.height).toBe(16);
  });

  it('does not crash when refs are null', () => {
    expect(() =>
      renderHook(() =>
        useEditorCanvasSetup(
          defaultProps({
            committedCanvasRef: makeNullRef(),
            previewCanvasRef: makeNullRef(),
          }),
        ),
      ),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// syncOffscreens / composite effect
// ---------------------------------------------------------------------------

describe('syncOffscreens / composite effect', () => {
  it('calls compositeLayers once on initial mount', () => {
    renderHook(() => useEditorCanvasSetup(defaultProps()));

    expect(mockCompositeLayers).toHaveBeenCalledTimes(1);
  });

  it('calls compositeLayers again when layers array changes', () => {
    const props = defaultProps({ layers: [makeLayer('l1')] });

    const { rerender } = renderHook(
      (p: Parameters<typeof useEditorCanvasSetup>[0]) => useEditorCanvasSetup(p),
      { initialProps: props },
    );

    expect(mockCompositeLayers).toHaveBeenCalledTimes(1);

    act(() => {
      rerender({ ...props, layers: [makeLayer('l1'), makeLayer('l2')] });
    });

    expect(mockCompositeLayers).toHaveBeenCalledTimes(2);
  });

  it('calls drawLayer once per layer on initial mount (1 layer)', () => {
    renderHook(() => useEditorCanvasSetup(defaultProps({ layers: [makeLayer('l1')] })));

    expect(mockDrawLayer).toHaveBeenCalledTimes(1);
  });

  it('calls drawLayer twice per render when there are 2 layers', () => {
    renderHook(() =>
      useEditorCanvasSetup(
        defaultProps({ layers: [makeLayer('l1'), makeLayer('l2')], activeLayerId: 'l1' }),
      ),
    );

    expect(mockDrawLayer).toHaveBeenCalledTimes(2);
  });

  it('passes skipLayerId: activeLayerId to compositeLayers when layerTransformIsPending is true', () => {
    renderHook(() =>
      useEditorCanvasSetup(
        defaultProps({
          layers: [makeLayer('l1')],
          activeLayerId: 'l1',
          layerTransformIsPending: true,
        }),
      ),
    );

    expect(mockCompositeLayers).toHaveBeenCalledTimes(1);
    const callArgs = mockCompositeLayers.mock.calls[0];
    // compositeLayers(target, layers, map, width, height, options)
    const options = callArgs[5] as { skipLayerId?: string } | undefined;
    expect(options?.skipLayerId).toBe('l1');
  });

  it('passes skipLayerId: undefined to compositeLayers when layerTransformIsPending is false', () => {
    renderHook(() =>
      useEditorCanvasSetup(
        defaultProps({
          layers: [makeLayer('l1')],
          activeLayerId: 'l1',
          layerTransformIsPending: false,
        }),
      ),
    );

    expect(mockCompositeLayers).toHaveBeenCalledTimes(1);
    const callArgs = mockCompositeLayers.mock.calls[0];
    const options = callArgs[5] as { skipLayerId?: string } | undefined;
    expect(options?.skipLayerId).toBeUndefined();
  });

  it('skips composite entirely when committedCanvasRef is null', () => {
    renderHook(() =>
      useEditorCanvasSetup(
        defaultProps({ committedCanvasRef: makeNullRef() }),
      ),
    );

    expect(mockCompositeLayers).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Offscreen map bookkeeping (tested via drawLayer call counts)
// ---------------------------------------------------------------------------

describe('offscreen map bookkeeping', () => {
  it('drawLayer is called once per render for 1 layer', () => {
    const props = defaultProps({ layers: [makeLayer('l1')] });

    const { rerender } = renderHook(
      (p: Parameters<typeof useEditorCanvasSetup>[0]) => useEditorCanvasSetup(p),
      { initialProps: props },
    );

    // Trigger another render with the same layers reference replaced (new pixels)
    act(() => {
      rerender({ ...props, layers: [makeLayer('l1')] });
    });

    // 1 call on mount + 1 call on rerender
    expect(mockDrawLayer).toHaveBeenCalledTimes(2);
  });

  it('drawLayer is called twice per render for 2 layers', () => {
    const layers = [makeLayer('l1'), makeLayer('l2')];
    const props = defaultProps({ layers, activeLayerId: 'l1' });

    const { rerender } = renderHook(
      (p: Parameters<typeof useEditorCanvasSetup>[0]) => useEditorCanvasSetup(p),
      { initialProps: props },
    );

    act(() => {
      rerender({ ...props, layers: [makeLayer('l1'), makeLayer('l2')] });
    });

    // 2 calls on mount + 2 calls on rerender
    expect(mockDrawLayer).toHaveBeenCalledTimes(4);
  });

  it('evicts offscreen entries for removed layers (drawLayer count drops after removal)', () => {
    const props = defaultProps({
      layers: [makeLayer('l1'), makeLayer('l2')],
      activeLayerId: 'l1',
    });

    const { rerender } = renderHook(
      (p: Parameters<typeof useEditorCanvasSetup>[0]) => useEditorCanvasSetup(p),
      { initialProps: props },
    );

    // Initial mount: 2 drawLayer calls
    expect(mockDrawLayer).toHaveBeenCalledTimes(2);
    mockDrawLayer.mockClear();

    // Remove l2
    act(() => {
      rerender({ ...props, layers: [makeLayer('l1')] });
    });

    // Only 1 layer remains → drawLayer called once
    expect(mockDrawLayer).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Unmount
// ---------------------------------------------------------------------------

describe('unmount', () => {
  it('unmounts without throwing errors', () => {
    const { unmount } = renderHook(() =>
      useEditorCanvasSetup(defaultProps()),
    );

    expect(() => unmount()).not.toThrow();
  });

  it('does not call drawLayer or compositeLayers after unmount when previous effects are replayed', () => {
    const { unmount } = renderHook(() =>
      useEditorCanvasSetup(defaultProps()),
    );

    mockDrawLayer.mockClear();
    mockCompositeLayers.mockClear();

    unmount();

    // After unmount, the cleanup ran (cleared the map). No new render calls
    // should have been made after clearing.
    expect(mockDrawLayer).not.toHaveBeenCalled();
    expect(mockCompositeLayers).not.toHaveBeenCalled();
  });
});
