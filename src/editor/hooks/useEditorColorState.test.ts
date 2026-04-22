/**
 * Tests for `useEditorColorState` — the editor's combined colour/tool state
 * hook. Covers default values, simple setters, and the `commitPixelsWithColor`
 * side-effects (pushRecent + onColorCommit callback).
 *
 * No DOM or canvas needed — the hook is pure React state + callbacks.
 */
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEditorColorState } from './useEditorColorState';
import { useEditorSessionStore } from '@/editor/stores/useEditorSessionStore';

beforeEach(() => {
  localStorage.clear();
  useEditorSessionStore.getState().resetSession('#000000');
});

const PALETTE = ['#ff0000', '#00ff00'];

function setup(overrides: Partial<Parameters<typeof useEditorColorState>[0]> = {}) {
  const commitPixels = vi.fn();
  const { result, rerender } = renderHook(
    (props: Parameters<typeof useEditorColorState>[0]) => useEditorColorState(props),
    {
      initialProps: {
        palette: PALETTE,
        commitPixels,
        onColorCommit: undefined,
        ...overrides,
      },
    },
  );
  return { result, rerender, commitPixels };
}

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

describe('defaults', () => {
  it('activeTool defaults to "paint"', () => {
    const { result } = setup();
    expect(result.current.activeTool).toBe('paint');
  });

  it('brushSize defaults to "sm"', () => {
    const { result } = setup();
    expect(result.current.brushSize).toBe('sm');
  });

  it('marqueeShape defaults to "rect"', () => {
    const { result } = setup();
    expect(result.current.marqueeShape).toBe('rect');
  });

  it('independentHue defaults to null', () => {
    const { result } = setup();
    expect(result.current.independentHue).toBeNull();
  });

  it('activeColor defaults to recents seed when no prior picks exist', () => {
    // recents initialises from a ['#000000', '#ffffff'] seed when localStorage
    // is empty, so the active colour starts there rather than at palette[0].
    const { result } = setup();
    expect(result.current.activeColor).toBe('#000000');
  });

  it('customColors starts as an array', () => {
    const { result } = setup();
    expect(Array.isArray(result.current.customColors)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Simple state setters
// ---------------------------------------------------------------------------

describe('simple setters', () => {
  it('setActiveTool updates activeTool', () => {
    const { result } = setup();
    act(() => result.current.setActiveTool('eraser'));
    expect(result.current.activeTool).toBe('eraser');
  });

  it('setBrushSize updates brushSize', () => {
    const { result } = setup();
    act(() => result.current.setBrushSize('lg'));
    expect(result.current.brushSize).toBe('lg');
  });

  it('setLastShape updates lastShape', () => {
    const { result } = setup();
    act(() => result.current.setLastShape('circle'));
    expect(result.current.lastShape).toBe('circle');
  });

  it('setMarqueeShape updates marqueeShape', () => {
    const { result } = setup();
    act(() => result.current.setMarqueeShape('ellipse'));
    expect(result.current.marqueeShape).toBe('ellipse');
  });

  it('setIndependentHue updates independentHue', () => {
    const { result } = setup();
    act(() => result.current.setIndependentHue(180));
    expect(result.current.independentHue).toBe(180);
  });

  it('setRectFillMode updates rectFillMode', () => {
    const { result } = setup();
    act(() => result.current.setRectFillMode('fill'));
    expect(result.current.rectFillMode).toBe('fill');
  });

  it('setCircleFillMode updates circleFillMode', () => {
    const { result } = setup();
    act(() => result.current.setCircleFillMode('fill'));
    expect(result.current.circleFillMode).toBe('fill');
  });

  it('setTriangleFillMode updates triangleFillMode', () => {
    const { result } = setup();
    act(() => result.current.setTriangleFillMode('fill'));
    expect(result.current.triangleFillMode).toBe('fill');
  });

  it('setStarFillMode updates starFillMode', () => {
    const { result } = setup();
    act(() => result.current.setStarFillMode('fill'));
    expect(result.current.starFillMode).toBe('fill');
  });

  it('setArrowFillMode updates arrowFillMode', () => {
    const { result } = setup();
    act(() => result.current.setArrowFillMode('fill'));
    expect(result.current.arrowFillMode).toBe('fill');
  });

  it('setActiveColor updates the internal colour', () => {
    const { result } = setup();
    act(() => result.current.setActiveColor('#0000ff'));
    expect(result.current.activeColor).toBe('#0000ff');
  });
});

// ---------------------------------------------------------------------------
// commitPixelsWithColor
// ---------------------------------------------------------------------------

describe('commitPixelsWithColor', () => {
  it('always calls commitPixels with the provided pixels', () => {
    const { result, commitPixels } = setup();
    const px = ['#ff0000', '', ''];
    act(() => result.current.commitPixelsWithColor(px));
    expect(commitPixels).toHaveBeenCalledOnce();
    expect(commitPixels).toHaveBeenCalledWith(px, undefined);
  });

  it('does NOT fire onColorCommit when activeTool is "eraser"', () => {
    const onColorCommit = vi.fn();
    const { result } = setup({ onColorCommit });
    act(() => result.current.setActiveTool('eraser'));
    act(() => result.current.commitPixelsWithColor([]));
    expect(onColorCommit).not.toHaveBeenCalled();
  });

  it('fires onColorCommit with activeColor when activeTool is "paint" and color is valid hex', () => {
    const onColorCommit = vi.fn();
    const { result } = setup({ onColorCommit });
    act(() => result.current.setActiveColor('#ff0000'));
    act(() => result.current.commitPixelsWithColor([]));
    expect(onColorCommit).toHaveBeenCalledOnce();
    expect(onColorCommit).toHaveBeenCalledWith('#ff0000');
  });

  it('does NOT fire onColorCommit when activeColor is not a valid 6-char hex', () => {
    const onColorCommit = vi.fn();
    const { result } = setup({ onColorCommit });
    // Set an invalid colour (e.g. 3-char shorthand — not valid per the regex)
    act(() => result.current.setActiveColor('#fff'));
    act(() => result.current.commitPixelsWithColor([]));
    expect(onColorCommit).not.toHaveBeenCalled();
  });

  it('setActiveColor does not push to recent colors', () => {
    const { result } = setup();
    const before = [...result.current.recents];
    act(() => result.current.setActiveColor('#aabbcc'));
    expect(result.current.recents).toEqual(before);
  });

  it('commitPixelsWithColor pushes the active color to recents; setActiveColor alone does not', () => {
    const { result } = setup();
    act(() => result.current.setActiveColor('#aabbcc'));
    // Color change alone — recents unchanged.
    expect(result.current.recents).not.toContain('#aabbcc');

    // Commit — now it appears.
    act(() => result.current.commitPixelsWithColor([]));
    expect(result.current.recents[0]).toBe('#aabbcc');
  });

  it('does NOT fire onColorCommit when activeTool is "eraser" even if color would normally qualify', () => {
    const onColorCommit = vi.fn();
    const { result } = setup({ onColorCommit });
    act(() => result.current.setActiveTool('eraser'));
    act(() => result.current.setActiveColor('#0000ff'));
    act(() => result.current.commitPixelsWithColor([]));
    expect(onColorCommit).not.toHaveBeenCalled();
  });
});
