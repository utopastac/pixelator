import type { RefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createEditorControls, createLayersPanelControlNodes, type EditorChromeInput } from './Controls';

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

  it('returns null download when download handlers are omitted', () => {
    const c = createEditorControls({
      palette: ['#000'],
      customColors: [],
      ...titleBase,
      ...toolPopoverStub(),
    });
    expect(c.download).toBeNull();
  });

  it('returns download control when download handlers are wired', () => {
    const c = createEditorControls({
      palette: ['#000'],
      customColors: [],
      ...titleBase,
      onDownloadSvg: vi.fn(),
      onDownloadPng: vi.fn(),
      onDownloadLayersSvg: vi.fn(),
      ...toolPopoverStub(),
    });
    expect(c.download).toBeTruthy();
  });

  it('returns null deselect when not mobile or no selection', () => {
    const c = createEditorControls({
      palette: ['#000'],
      customColors: [],
      ...titleBase,
      ...toolPopoverStub(),
    });
    expect(c.deselect).toBeNull();
  });

  it('returns deselect control on mobile when selection and handler are wired', () => {
    const c = createEditorControls({
      palette: ['#000'],
      customColors: [],
      ...titleBase,
      isMobile: true,
      selection: { shape: 'rect', x1: 0, y1: 0, x2: 1, y2: 1 },
      onDeselect: vi.fn(),
      ...toolPopoverStub(),
    });
    expect(c.deselect).toBeTruthy();
  });

  it('returns null duplicateSelection when not mobile or no selection', () => {
    const c = createEditorControls({
      palette: ['#000'],
      customColors: [],
      ...titleBase,
      ...toolPopoverStub(),
      onDuplicateSelection: vi.fn(),
    });
    expect(c.duplicateSelection).toBeNull();
  });

  it('returns duplicate selection control on mobile when selection and handler are wired', () => {
    const c = createEditorControls({
      palette: ['#000'],
      customColors: [],
      ...titleBase,
      isMobile: true,
      selection: { shape: 'rect', x1: 0, y1: 0, x2: 1, y2: 1 },
      onDuplicateSelection: vi.fn(),
      ...toolPopoverStub(),
    });
    expect(c.duplicateSelection).toBeTruthy();
  });
});

describe('createLayersPanelControlNodes', () => {
  const base = {
    onDownloadSvg: vi.fn(),
    onDownloadPng: vi.fn(),
    onDownloadLayersSvg: vi.fn(),
    onAddLayer: vi.fn(),
    importCanvasWidth: 16,
    importCanvasHeight: 16,
    onImportFileReadError: vi.fn(),
  };

  it('returns download, add, and import nodes when onImportLayerImage is set', () => {
    const n = createLayersPanelControlNodes({ ...base, onImportLayerImage: vi.fn() });
    expect(n.layersPanelDownload).toBeTruthy();
    expect(n.addLayer).toBeTruthy();
    expect(n.importLayer).toBeTruthy();
  });

  it('returns a null import node when onImportLayerImage is absent', () => {
    const n = createLayersPanelControlNodes({ ...base });
    expect(n.importLayer).toBeNull();
  });
});
