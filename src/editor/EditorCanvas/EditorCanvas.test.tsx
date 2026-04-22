/**
 * Tests for `EditorCanvas` — the canvas area component responsible for
 * rendering the committed canvas, preview canvas, screen overlay, grid
 * overlay, hidden-layer overlay, block toasts, and context-menu delegation.
 *
 * Cursor logic, grid visibility, overlay visibility, toast text, and context
 * menu callback are all verified here. Pointer-event routing into the
 * useMoveTransformTool / pan / draw branches is exercised at the hook level
 * and not duplicated here.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EditorCanvas, { type EditorCanvasProps } from './EditorCanvas';

// ---------------------------------------------------------------------------
// Minimal props helper
// ---------------------------------------------------------------------------

const noop = () => {};

function makeProps(overrides: Partial<EditorCanvasProps> = {}): EditorCanvasProps {
  return {
    width: 16,
    height: 16,
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    isActivelyPanning: false,
    panDragRef: { current: null },
    setIsActivelyPanning: noop,
    panBy: noop,
    zoomAtPoint: vi.fn(),
    disabled: false,
    activeTool: 'paint',
    selection: null,
    isHoveringSelection: false,
    setIsHoveringSelection: noop,
    updateHoverOverSelection: noop,
    moveTransform: {
      handlePointerDown: vi.fn(() => false),
      handlePointerMove: vi.fn(() => false),
      handlePointerUp: vi.fn(() => false),
      handlePointerCancel: noop,
      renderPreview: noop,
      clearPreview: noop,
    },
    handleMouseDown: noop,
    handleMouseMove: noop,
    handleMouseUp: noop,
    handlePointerCancel: noop,
    handleDoubleClick: noop,
    committedCanvasCallbackRef: noop,
    previewCanvasRef: { current: null },
    overlayCanvasRef: { current: null },
    gridCanvasRef: { current: null },
    onContextMenu: vi.fn(),
    activeLayerVisible: true,
    blockToast: null,
    importToast: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Rendering basics
// ---------------------------------------------------------------------------

describe('EditorCanvas — rendering basics', () => {
  it('renders the committed canvas with data-testid="editor-canvas"', () => {
    render(<EditorCanvas {...makeProps()} />);
    expect(screen.getByTestId('editor-canvas')).toBeInTheDocument();
  });

  it('renders a preview canvas as a second canvas element', () => {
    render(<EditorCanvas {...makeProps()} />);
    const canvases = document.querySelectorAll('canvas');
    // At minimum: committed + preview + screen overlay = 3 canvases
    expect(canvases.length).toBeGreaterThanOrEqual(2);
    // The preview canvas is the second one (inside canvasInner, after committed)
    const innerCanvases = document
      .querySelector('[style*="scale"]')
      ?.querySelectorAll('canvas');
    expect(innerCanvases).toBeDefined();
    expect(innerCanvases!.length).toBeGreaterThanOrEqual(2);
  });

  it('renders a screen overlay canvas with aria-hidden="true"', () => {
    render(<EditorCanvas {...makeProps()} />);
    const hiddenCanvases = document.querySelectorAll('canvas[aria-hidden="true"]');
    expect(hiddenCanvases.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Grid overlay
// ---------------------------------------------------------------------------

describe('EditorCanvas — grid overlay', () => {
  // The grid is now a <canvas> managed imperatively by useGridCanvasDraw.
  // It is always mounted; the hook clears it when zoom < 4, when the user
  // hides the grid overlay, or draws when visible and zoom >= 4.
  // DOM tests verify the canvas is always present regardless of zoom.

  it('the grid canvas element is always present in the DOM', () => {
    render(<EditorCanvas {...makeProps({ zoom: 1 })} />);
    // All aria-hidden canvases: committed, preview, grid, screen-overlay.
    const hiddenCanvases = document.querySelectorAll('canvas[aria-hidden="true"]');
    expect(hiddenCanvases.length).toBeGreaterThanOrEqual(1);
  });

  it('the grid canvas is still present at zoom >= 4', () => {
    render(<EditorCanvas {...makeProps({ zoom: 4 })} />);
    const hiddenCanvases = document.querySelectorAll('canvas[aria-hidden="true"]');
    expect(hiddenCanvases.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Hidden-layer overlay
// ---------------------------------------------------------------------------

describe('EditorCanvas — hidden-layer overlay', () => {
  it('is absent when activeLayerVisible is true', () => {
    render(<EditorCanvas {...makeProps({ activeLayerVisible: true })} />);
    // The hidden-layer overlay is a non-canvas aria-hidden div without backgroundSize
    const overlays = document.querySelectorAll('[aria-hidden="true"]:not(canvas)');
    const hiddenLayerOverlays = Array.from(overlays).filter(
      (el) => (el as HTMLElement).style.backgroundSize === '',
    );
    expect(hiddenLayerOverlays).toHaveLength(0);
  });

  it('is present when activeLayerVisible is false', () => {
    render(<EditorCanvas {...makeProps({ activeLayerVisible: false })} />);
    const overlays = document.querySelectorAll('[aria-hidden="true"]:not(canvas)');
    const hiddenLayerOverlays = Array.from(overlays).filter(
      (el) => (el as HTMLElement).style.backgroundSize === '',
    );
    expect(hiddenLayerOverlays.length).toBeGreaterThanOrEqual(1);
  });

  it('is present when layer is hidden even with zoom >= 4 (grid canvas and div coexist)', () => {
    render(
      <EditorCanvas {...makeProps({ activeLayerVisible: false, zoom: 4 })} />,
    );
    // The grid is now a canvas; the hidden-layer overlay is a div.
    const nonCanvasOverlays = document.querySelectorAll('[aria-hidden="true"]:not(canvas)');
    expect(nonCanvasOverlays.length).toBeGreaterThanOrEqual(1);
    const gridCanvases = document.querySelectorAll('canvas[aria-hidden="true"]');
    expect(gridCanvases.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Block toast
// ---------------------------------------------------------------------------

describe('EditorCanvas — block toast', () => {
  it('shows the hidden-layer message when blockToast === "hidden"', () => {
    render(<EditorCanvas {...makeProps({ blockToast: 'hidden' })} />);
    expect(
      screen.getByText('Layer is hidden — show it to draw'),
    ).toBeInTheDocument();
  });

  it('shows the locked message when blockToast === "locked"', () => {
    render(<EditorCanvas {...makeProps({ blockToast: 'locked' })} />);
    expect(
      screen.getByText('Layer is locked — unlock it to draw'),
    ).toBeInTheDocument();
  });

  it('is absent when blockToast === null', () => {
    render(<EditorCanvas {...makeProps({ blockToast: null })} />);
    expect(
      screen.queryByText('Layer is hidden — show it to draw'),
    ).toBeNull();
    expect(
      screen.queryByText('Layer is locked — unlock it to draw'),
    ).toBeNull();
  });

  it('toast has role="status" and aria-live="polite"', () => {
    render(<EditorCanvas {...makeProps({ blockToast: 'hidden' })} />);
    const toast = screen.getByRole('status');
    expect(toast).toHaveAttribute('aria-live', 'polite');
  });
});

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------

describe('EditorCanvas — context menu', () => {
  it('right-clicking the canvas container calls onContextMenu', () => {
    const onContextMenu = vi.fn();
    render(<EditorCanvas {...makeProps({ onContextMenu })} />);
    // The container is the outermost div; fire contextmenu on the committed canvas
    fireEvent.contextMenu(screen.getByTestId('editor-canvas'));
    expect(onContextMenu).toHaveBeenCalledTimes(1);
  });

  it('right-clicking outside the canvas (but inside container) also calls onContextMenu', () => {
    const onContextMenu = vi.fn();
    const { container } = render(<EditorCanvas {...makeProps({ onContextMenu })} />);
    fireEvent.contextMenu(container.firstChild as HTMLElement);
    expect(onContextMenu).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Cursor state
// ---------------------------------------------------------------------------

describe('EditorCanvas — cursor state', () => {
  // Cursor is now set on the container div (the outermost element), not the
  // committed canvas, so pointer events in the gutter work for clamped handles.
  function getContainer() {
    return screen.getByTestId('editor-canvas').closest('[style*="cursor"]') as HTMLElement;
  }

  it('cursor is "not-allowed" when disabled is true', () => {
    render(<EditorCanvas {...makeProps({ disabled: true })} />);
    expect(getContainer()).toHaveStyle({ cursor: 'not-allowed' });
  });

  it('cursor is "grab" when isPanning and not isActivelyPanning', () => {
    render(
      <EditorCanvas
        {...makeProps({ isPanning: true, isActivelyPanning: false })}
      />,
    );
    expect(getContainer()).toHaveStyle({ cursor: 'grab' });
  });

  it('cursor is "grabbing" when isPanning and isActivelyPanning', () => {
    render(
      <EditorCanvas
        {...makeProps({ isPanning: true, isActivelyPanning: true })}
      />,
    );
    expect(getContainer()).toHaveStyle({ cursor: 'grabbing' });
  });

  it('cursor is "move" when activeTool === "move"', () => {
    render(<EditorCanvas {...makeProps({ activeTool: 'move' })} />);
    expect(getContainer()).toHaveStyle({ cursor: 'move' });
  });

  it('cursor is "move" when isHoveringSelection is true (non-panning, non-disabled)', () => {
    render(<EditorCanvas {...makeProps({ isHoveringSelection: true })} />);
    expect(getContainer()).toHaveStyle({ cursor: 'move' });
  });

  it('cursor is "crosshair" for a normal paint tool with no special state', () => {
    render(
      <EditorCanvas
        {...makeProps({
          activeTool: 'paint',
          disabled: false,
          isPanning: false,
          isHoveringSelection: false,
        })}
      />,
    );
    expect(getContainer()).toHaveStyle({ cursor: 'crosshair' });
  });

  it('disabled takes precedence over isPanning for cursor', () => {
    render(
      <EditorCanvas
        {...makeProps({ disabled: true, isPanning: true, isActivelyPanning: false })}
      />,
    );
    expect(getContainer()).toHaveStyle({ cursor: 'not-allowed' });
  });
});

// ---------------------------------------------------------------------------
// Mobile viewport gestures
// ---------------------------------------------------------------------------

describe('EditorCanvas — mobile touch', () => {
  it('sets data-mobile on the container when isMobile', () => {
    render(<EditorCanvas {...makeProps({ isMobile: true })} />);
    expect(screen.getByTestId('editor-canvas')).toHaveAttribute('data-mobile', 'true');
  });

});
