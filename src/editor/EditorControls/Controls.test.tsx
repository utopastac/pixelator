import type { RefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createEditorControls, type EditorChromeInput } from './Controls';

function toolPopoverStub(): Pick<
  EditorChromeInput,
  | 'isBrushPopoverOpen'
  | 'setBrushPopoverOpen'
  | 'brushSizeAnchorRef'
  | 'isShapePopoverOpen'
  | 'setShapePopoverOpen'
  | 'shapeAnchorRef'
  | 'isMarqueePopoverOpen'
  | 'setMarqueePopoverOpen'
  | 'marqueeAnchorRef'
  | 'closeAllToolPopovers'
  | 'openBrushSizePopover'
  | 'openShapePopover'
  | 'openMarqueePopover'
  | 'shapesShortPress'
  | 'onBrushButtonPress'
> {
  const nullRef = (): RefObject<HTMLDivElement | null> => ({ current: null });
  return {
    isBrushPopoverOpen: false,
    setBrushPopoverOpen: vi.fn(),
    brushSizeAnchorRef: nullRef(),
    isShapePopoverOpen: false,
    setShapePopoverOpen: vi.fn(),
    shapeAnchorRef: nullRef(),
    isMarqueePopoverOpen: false,
    setMarqueePopoverOpen: vi.fn(),
    marqueeAnchorRef: nullRef(),
    closeAllToolPopovers: vi.fn(),
    openBrushSizePopover: vi.fn(),
    openShapePopover: vi.fn(),
    openMarqueePopover: vi.fn(),
    shapesShortPress: vi.fn(),
    onBrushButtonPress: vi.fn(),
  };
}

describe('createEditorControls', () => {
  const titleBase = {
    title: 'T',
    onTitleChange: vi.fn(),
    canUndo: false,
    canRedo: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
  };

  it('returns drawingTitle and history controls when title cluster is wired', () => {
    const c = createEditorControls({
      palette: ['#000'],
      customColors: [],
      ...titleBase,
      ...toolPopoverStub(),
    });
    expect(c.drawingTitle).toBeTruthy();
    expect(c.historyUndo).toBeTruthy();
    expect(c.historyRedo).toBeTruthy();
  });

  it('returns null canvasSize when sizes omitted', () => {
    const c = createEditorControls({
      palette: ['#000'],
      customColors: [],
      ...titleBase,
      ...toolPopoverStub(),
    });
    expect(c.canvasSize).toBeNull();
  });

  it('returns canvasSize when sizes provided', () => {
    const c = createEditorControls({
      palette: ['#000'],
      customColors: [],
      ...titleBase,
      sizes: [16],
      currentWidth: 16,
      currentHeight: 16,
      onPickSize: vi.fn(),
      ...toolPopoverStub(),
    });
    expect(c.canvasSize).toBeTruthy();
  });
});
