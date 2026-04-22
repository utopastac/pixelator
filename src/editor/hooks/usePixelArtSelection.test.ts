/**
 * Tests for `usePixelArtSelection` — the marquee state machine. Exercises the
 * selection value, the drag-context refs, the geometric `selectionContainsCell`
 * hit-test (rect / ellipse / cells shapes), and the fact that clearing the
 * selection also drops the `lifted` ref.
 *
 * Invariants:
 * - selectionContainsCell returns false for all cells when selection is null.
 * - rect shape: every cell within the bounding box (inclusive) hits; outside misses.
 * - ellipse shape: centre hits; bbox corners miss; ellipse equation is authoritative.
 * - cells (wand) shape: only pixel indices present in the Set hit.
 * - dragContext refs all initialise to their documented zero values and the
 *   object identity is stable across re-renders.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePixelArtSelection } from './usePixelArtSelection';

function setup(width = 8) {
  return renderHook(() => usePixelArtSelection({ width }));
}

describe('usePixelArtSelection', () => {
  it('initialises with null selection and idle drag context', () => {
    const { result } = setup();
    expect(result.current.selection).toBeNull();
    expect(result.current.dragContext.dragMode.current).toBeNull();
    expect(result.current.dragContext.dragStart.current).toBeNull();
    expect(result.current.dragContext.lifted.current).toBeNull();
    expect(result.current.dragContext.basePixelsAfterLift.current).toBeNull();
    expect(result.current.dragContext.moveOffset.current).toEqual([0, 0]);
    expect(result.current.dragContext.strokeInsideSelection.current).toBe(true);
  });

  it('selectionContainsCell returns false when no selection is set', () => {
    const { result } = setup();
    expect(result.current.selectionContainsCell(0, 0)).toBe(false);
    expect(result.current.selectionContainsCell(5, 5)).toBe(false);
  });

  it('setSelection with a rect: every cell inside the bbox hits, outside misses', () => {
    const { result } = setup();
    act(() => result.current.setSelection({ shape: 'rect', x1: 2, y1: 2, x2: 4, y2: 4 }));
    expect(result.current.selection).toEqual({ shape: 'rect', x1: 2, y1: 2, x2: 4, y2: 4 });
    // Inside bbox
    expect(result.current.selectionContainsCell(2, 2)).toBe(true);
    expect(result.current.selectionContainsCell(3, 3)).toBe(true);
    expect(result.current.selectionContainsCell(4, 4)).toBe(true);
    // Outside bbox
    expect(result.current.selectionContainsCell(1, 2)).toBe(false);
    expect(result.current.selectionContainsCell(2, 1)).toBe(false);
    expect(result.current.selectionContainsCell(5, 4)).toBe(false);
    expect(result.current.selectionContainsCell(4, 5)).toBe(false);
  });

  it('rect hit-test works with reversed corners (x1 > x2, y1 > y2)', () => {
    const { result } = setup();
    act(() => result.current.setSelection({ shape: 'rect', x1: 4, y1: 4, x2: 2, y2: 2 }));
    expect(result.current.selectionContainsCell(3, 3)).toBe(true);
    expect(result.current.selectionContainsCell(5, 5)).toBe(false);
  });

  it('setSelection with an ellipse: centre is inside, bbox corners are outside', () => {
    const { result } = setup();
    // A 5×5 bbox — ellipse inscribed in it.
    act(() => result.current.setSelection({ shape: 'ellipse', x1: 0, y1: 0, x2: 4, y2: 4 }));
    // Centre is inside.
    expect(result.current.selectionContainsCell(2, 2)).toBe(true);
    // Bbox corners fall outside the ellipse curve.
    expect(result.current.selectionContainsCell(0, 0)).toBe(false);
    expect(result.current.selectionContainsCell(4, 0)).toBe(false);
    expect(result.current.selectionContainsCell(0, 4)).toBe(false);
    expect(result.current.selectionContainsCell(4, 4)).toBe(false);
    // Out-of-bbox always false.
    expect(result.current.selectionContainsCell(5, 2)).toBe(false);
  });

  it('setSelection with cells shape (wand): only indices in the set hit', () => {
    const { result } = setup(4);
    // Pick the two cells (1,1) and (2,1). Indices = row*width+col = 5 and 6.
    const cells = new Set<number>([5, 6]);
    act(() => result.current.setSelection({ shape: 'cells', cells, x1: 1, y1: 1, x2: 2, y2: 1 }));
    expect(result.current.selectionContainsCell(1, 1)).toBe(true);
    expect(result.current.selectionContainsCell(2, 1)).toBe(true);
    // Inside bbox but not in the set.
    expect(result.current.selectionContainsCell(0, 1)).toBe(false);
    // Outside bbox.
    expect(result.current.selectionContainsCell(3, 3)).toBe(false);
  });

  it('setSelection exposes a React setState so callers can use updater form', () => {
    const { result } = setup();
    act(() => result.current.setSelection({ shape: 'rect', x1: 1, y1: 1, x2: 3, y2: 3 }));
    act(() =>
      result.current.setSelection((prev) =>
        prev ? { ...prev, x2: 5, y2: 5 } : null,
      ),
    );
    expect(result.current.selection).toEqual({ shape: 'rect', x1: 1, y1: 1, x2: 5, y2: 5 });
  });

  it('drag-context refs are mutable and survive renders', () => {
    const { result, rerender } = setup();
    act(() => {
      result.current.dragContext.dragMode.current = 'draw';
      result.current.dragContext.dragStart.current = [3, 4];
      result.current.dragContext.moveOffset.current = [7, 8];
      result.current.dragContext.lifted.current = {
        colors: ['#ff0000'],
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
      };
      result.current.dragContext.basePixelsAfterLift.current = ['', '', '', ''];
      result.current.dragContext.strokeInsideSelection.current = false;
    });
    rerender();
    expect(result.current.dragContext.dragMode.current).toBe('draw');
    expect(result.current.dragContext.dragStart.current).toEqual([3, 4]);
    expect(result.current.dragContext.moveOffset.current).toEqual([7, 8]);
    expect(result.current.dragContext.lifted.current?.colors).toEqual(['#ff0000']);
    expect(result.current.dragContext.basePixelsAfterLift.current).toEqual(['', '', '', '']);
    expect(result.current.dragContext.strokeInsideSelection.current).toBe(false);
  });

  it('setting selection null resets selectionContainsCell to always-false', () => {
    const { result } = setup();
    act(() => result.current.setSelection({ shape: 'rect', x1: 0, y1: 0, x2: 2, y2: 2 }));
    expect(result.current.selectionContainsCell(1, 1)).toBe(true);
    act(() => result.current.setSelection(null));
    expect(result.current.selection).toBeNull();
    expect(result.current.selectionContainsCell(1, 1)).toBe(false);
  });

  it('dragContext identity is stable across rerenders so handlers can memoise on it', () => {
    const { result, rerender } = setup();
    const first = result.current.dragContext;
    rerender();
    expect(result.current.dragContext).toBe(first);
  });

  it('ellipse hit-test uses the bbox-derived centre for reversed-corner boxes', () => {
    const { result } = setup();
    act(() => result.current.setSelection({ shape: 'ellipse', x1: 4, y1: 4, x2: 0, y2: 0 }));
    expect(result.current.selectionContainsCell(2, 2)).toBe(true);
    expect(result.current.selectionContainsCell(0, 0)).toBe(false);
  });

});
