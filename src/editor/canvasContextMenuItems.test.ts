/**
 * Tests for the pure `buildCanvasContextMenuItems` builder. The extracted
 * builder is the source-of-truth for the canvas right-click menu's shape,
 * disabled states, and selection-conditional entries — every branch below
 * used to live inline in PixelArtEditor.tsx, so these tests replace the
 * implicit coverage that lived in whatever rendered the menu.
 */
import { describe, expect, it } from 'vitest';
import type { ContextMenuItem } from '@/overlays/ContextMenu';
import { buildCanvasContextMenuItems, type CanvasContextMenuDeps } from './canvasContextMenuItems';
import type { PixelArtSelection } from './lib/pixelArtUtils';

/** Build a deps bundle with a tracking `close` and no-op handlers. Individual
 *  tests override just the fields they care about. */
function makeDeps(overrides: Partial<CanvasContextMenuDeps> = {}): CanvasContextMenuDeps {
  const noop = () => {};
  return {
    close: noop,
    canUndo: true,
    canRedo: true,
    undo: noop,
    redo: noop,
    fit: noop,
    setZoom: noop,
    selection: null,
    setSelection: noop,
    selectionContainsCell: () => false,
    clearLiftedPixels: noop,
    addLayer: noop,
    duplicateLayer: noop,
    clearLayer: noop,
    activeLayerId: 'layer-1',
    width: 4,
    height: 4,
    pixels: ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    activeColor: '#ff0000',
    allowCommitOrSignal: () => true,
    commitPixels: noop,
    emitChange: noop,
    handleRotate: noop,
    handleCopy: noop,
    handleCut: noop,
    handlePaste: noop,
    hasClip: false,
    activeLayerLocked: false,
    downloadSvg: noop,
    downloadPng: noop,
    downloadLayersSvg: noop,
    resetDrawing: noop,
    setActiveTool: noop,
    ...overrides,
  };
}

/** Find an item by its testId. Throws if missing — keeps test assertions
 *  terse. */
function byTestId(items: ContextMenuItem[], testId: string): ContextMenuItem {
  const found = items.find((i) => i.testId === testId);
  if (!found) throw new Error(`no item with testId="${testId}"`);
  return found;
}

function labels(items: ContextMenuItem[]): string[] {
  return items.filter((i) => !i.separator).map((i) => i.label);
}

const rectSelection: PixelArtSelection = { shape: 'rect', x1: 0, y1: 0, x2: 2, y2: 2 };

describe('buildCanvasContextMenuItems', () => {
  it('includes selection items only when a selection is present', () => {
    const without = buildCanvasContextMenuItems(makeDeps({ selection: null }));
    expect(labels(without)).not.toContain('Fill selection with colour');
    expect(labels(without)).not.toContain('Deselect');

    const withSel = buildCanvasContextMenuItems(makeDeps({ selection: rectSelection }));
    expect(labels(withSel)).toContain('Fill selection with colour');
    expect(labels(withSel)).toContain('Deselect');
  });

  it('rotate labels flip between "layer" and "selection" text based on selection', () => {
    const noSel = buildCanvasContextMenuItems(makeDeps({ selection: null }));
    expect(byTestId(noSel, 'canvas-menu-rotate-cw').label).toBe('Rotate layer 90° CW');
    expect(byTestId(noSel, 'canvas-menu-rotate-ccw').label).toBe('Rotate layer 90° CCW');

    const withSel = buildCanvasContextMenuItems(makeDeps({ selection: rectSelection }));
    expect(byTestId(withSel, 'canvas-menu-rotate-cw').label).toBe('Rotate selection 90° CW');
    expect(byTestId(withSel, 'canvas-menu-rotate-ccw').label).toBe('Rotate selection 90° CCW');
  });

  it('undo/redo are disabled when canUndo/canRedo are false', () => {
    const items = buildCanvasContextMenuItems(makeDeps({ canUndo: false, canRedo: false }));
    expect(byTestId(items, 'canvas-menu-undo').disabled).toBe(true);
    expect(byTestId(items, 'canvas-menu-redo').disabled).toBe(true);
  });

  it('action items close the menu after invoking their handler', () => {
    let closed = 0;
    let undone = 0;
    const items = buildCanvasContextMenuItems(
      makeDeps({
        close: () => closed++,
        undo: () => undone++,
      }),
    );
    const undo = byTestId(items, 'canvas-menu-undo');
    undo.onClick?.();
    expect(undone).toBe(1);
    expect(closed).toBe(1);
  });

  it('reset drawing is marked destructive and calls resetDrawing after close', () => {
    const calls: string[] = [];
    const items = buildCanvasContextMenuItems(
      makeDeps({
        close: () => calls.push('close'),
        resetDrawing: () => calls.push('reset'),
      }),
    );
    const reset = items.find((i) => i.label === 'Reset drawing');
    expect(reset?.variant).toBe('destructive');
    reset?.onClick?.();
    // Close fires before resetDrawing so the menu is gone before any
    // follow-up confirm dialog renders on top of it.
    expect(calls).toEqual(['close', 'reset']);
  });

  it('select all sets the marquee tool, selects the whole grid, clears lifted pixels, and closes', () => {
    const events: string[] = [];
    let appliedSelection: PixelArtSelection | null | undefined;
    const items = buildCanvasContextMenuItems(
      makeDeps({
        width: 8,
        height: 6,
        close: () => events.push('close'),
        setActiveTool: (t) => events.push(`tool:${t}`),
        setSelection: (s) => {
          events.push('setSelection');
          appliedSelection = s as PixelArtSelection;
        },
        clearLiftedPixels: () => events.push('clearLifted'),
      }),
    );
    byTestId(items, 'canvas-menu-select-all').onClick?.();
    expect(events).toEqual(['tool:marquee', 'setSelection', 'clearLifted', 'close']);
    expect(appliedSelection).toEqual({ shape: 'rect', x1: 0, y1: 0, x2: 7, y2: 5 });
  });

  it('fill-selection short-circuits (and still closes) when allowCommitOrSignal returns false', () => {
    const events: string[] = [];
    const items = buildCanvasContextMenuItems(
      makeDeps({
        selection: rectSelection,
        allowCommitOrSignal: () => false,
        commitPixels: () => events.push('commit'),
        emitChange: () => events.push('emit'),
        close: () => events.push('close'),
      }),
    );
    const fill = items.find((i) => i.label === 'Fill selection with colour');
    fill?.onClick?.();
    // Nothing is written, but the menu still closes so the user isn't left
    // with a dead open menu.
    expect(events).toEqual(['close']);
  });

  it('fill-selection paints the selection bbox with the active colour', () => {
    const captured: { pixels?: string[] } = {};
    const items = buildCanvasContextMenuItems(
      makeDeps({
        width: 3,
        height: 3,
        pixels: ['', '', '', '', '', '', '', '', ''],
        selection: { shape: 'rect', x1: 0, y1: 0, x2: 1, y2: 1 },
        selectionContainsCell: (col, row) => col <= 1 && row <= 1,
        activeColor: '#abcdef',
        commitPixels: (px) => { captured.pixels = px; },
      }),
    );
    const fill = items.find((i) => i.label === 'Fill selection with colour');
    fill?.onClick?.();
    // Top-left 2x2 filled; rest untouched.
    expect(captured.pixels).toEqual([
      '#abcdef', '#abcdef', '',
      '#abcdef', '#abcdef', '',
      '', '', '',
    ]);
  });

  it('deselect clears the selection and lifted pixels', () => {
    const events: string[] = [];
    const items = buildCanvasContextMenuItems(
      makeDeps({
        selection: rectSelection,
        setSelection: (s) => events.push(`sel:${s === null ? 'null' : 'obj'}`),
        clearLiftedPixels: () => events.push('clearLifted'),
        close: () => events.push('close'),
      }),
    );
    const deselect = items.find((i) => i.label === 'Deselect');
    deselect?.onClick?.();
    expect(events).toEqual(['sel:null', 'clearLifted', 'close']);
  });

  it('download PNG item carries a content node (the scale picker) rather than an onClick', () => {
    const items = buildCanvasContextMenuItems(makeDeps());
    const png = items.find((i) => i.label === 'Download PNG');
    expect(png?.content).toBeTruthy();
    expect(png?.onClick).toBeUndefined();
  });

  it('copy item fires handleCopy and then closes the menu', () => {
    const events: string[] = [];
    const items = buildCanvasContextMenuItems(
      makeDeps({
        selection: rectSelection,
        handleCopy: () => events.push('copy'),
        close: () => events.push('close'),
      }),
    );
    byTestId(items, 'canvas-menu-copy').onClick?.();
    expect(events).toEqual(['copy', 'close']);
  });

  it('cut item fires handleCut, closes, and is disabled when locked or selection is null', () => {
    const events: string[] = [];
    const items = buildCanvasContextMenuItems(
      makeDeps({
        selection: rectSelection,
        handleCut: () => events.push('cut'),
        close: () => events.push('close'),
      }),
    );
    byTestId(items, 'canvas-menu-cut').onClick?.();
    expect(events).toEqual(['cut', 'close']);

    const lockedItems = buildCanvasContextMenuItems(
      makeDeps({ selection: rectSelection, activeLayerLocked: true }),
    );
    expect(byTestId(lockedItems, 'canvas-menu-cut').disabled).toBe(true);

    const noSelItems = buildCanvasContextMenuItems(makeDeps({ selection: null }));
    expect(byTestId(noSelItems, 'canvas-menu-cut').disabled).toBe(true);
  });

  it('paste item fires handlePaste, closes, and is disabled when hasClip is false', () => {
    const events: string[] = [];
    const items = buildCanvasContextMenuItems(
      makeDeps({
        hasClip: true,
        handlePaste: () => events.push('paste'),
        close: () => events.push('close'),
      }),
    );
    byTestId(items, 'canvas-menu-paste').onClick?.();
    expect(events).toEqual(['paste', 'close']);

    const disabledItems = buildCanvasContextMenuItems(makeDeps({ hasClip: false }));
    expect(byTestId(disabledItems, 'canvas-menu-paste').disabled).toBe(true);
  });
});
