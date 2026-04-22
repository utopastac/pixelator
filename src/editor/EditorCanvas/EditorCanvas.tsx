import React, { forwardRef } from 'react';
import type { PixelArtTool } from '../PixelArtEditor';
import type { UseMoveTransformToolReturn } from '../hooks/useMoveTransformTool';
import type { PixelArtSelection } from '../hooks/usePixelArtSelection';
import type { SymmetryMode } from '../lib/symmetry';
import Toast from '@/primitives/Toast';
import styles from './EditorCanvas.module.css';
import { useMobileTwoFingerViewport } from './useMobileTwoFingerViewport';

export interface EditorCanvasProps {
  // Dimensions
  width: number;
  height: number;
  tilingCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  tilingEnabled?: boolean;
  // Viewport
  zoom: number;
  panX: number;
  panY: number;
  isPanning: boolean;
  isActivelyPanning: boolean;
  panDragRef: React.MutableRefObject<{ lastX: number; lastY: number } | null>;
  setIsActivelyPanning: (v: boolean) => void;
  panBy: (dx: number, dy: number) => void;
  zoomAtPoint: (newZoom: number, screenX: number, screenY: number) => void;
  /** Enables touch-action + two-finger pan/pinch on the canvas container. */
  isMobile?: boolean;
  // Tool / selection state
  disabled: boolean;
  activeTool: PixelArtTool;
  selection: PixelArtSelection | null;
  isHoveringSelection: boolean;
  setIsHoveringSelection: (v: boolean) => void;
  updateHoverOverSelection: (clientX: number, clientY: number) => void;
  // Move transform
  moveTransform: UseMoveTransformToolReturn;
  // Pointer handlers (from usePixelArtPointerHandlers)
  handleMouseDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  handleMouseMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  handleMouseUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerCancel: () => void;
  handleDoubleClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  // Canvas refs
  committedCanvasCallbackRef: (el: HTMLCanvasElement | null) => void;
  previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  gridCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  // Context menu
  onContextMenu: (e: React.MouseEvent) => void;
  symmetryMode?: SymmetryMode;
  // Overlays / toasts
  activeLayerVisible: boolean;
  blockToast: 'hidden' | 'locked' | null;
  importToast: string | null;
}

/**
 * The editor's canvas area: three stacked canvases (committed, preview, overlay)
 * inside a CSS-transformed wrapper that applies zoom/pan. Handles pointer routing
 * between spacebar-pan, the move-tool transform, and the active drawing tool.
 * The grid overlay and block toast are rendered here as well.
 */
const EditorCanvas = forwardRef<HTMLDivElement, EditorCanvasProps>(function EditorCanvas(
  {
    width,
    height,
    tilingCanvasRef,
    tilingEnabled,
    zoom,
    panX,
    panY,
    isPanning,
    isActivelyPanning,
    panDragRef,
    setIsActivelyPanning,
    panBy,
    zoomAtPoint,
    isMobile = false,
    disabled,
    activeTool,
    selection,
    isHoveringSelection,
    setIsHoveringSelection,
    updateHoverOverSelection,
    moveTransform,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handlePointerCancel,
    handleDoubleClick,
    committedCanvasCallbackRef,
    previewCanvasRef,
    overlayCanvasRef,
    gridCanvasRef,
    symmetryMode,
    onContextMenu,
    activeLayerVisible,
    blockToast,
    importToast,
  },
  ref,
) {
  const touchVp = useMobileTwoFingerViewport({
    isMobile,
    disabled,
    zoom,
    panBy,
    zoomAtPoint,
    handlePointerCancel,
    panDragRef,
    setIsActivelyPanning,
  });

  return (
    /* Canvas area. onContextMenu lives on the container (not the canvas)
       so right-click anywhere in the editor area — including the grey
       gutter around the canvas — opens the canvas menu. */
    <div
      ref={ref}
      data-testid="editor-canvas"
      data-mobile={isMobile ? 'true' : undefined}
      className={styles.canvasContainer}
      onContextMenu={onContextMenu}
      style={{
        cursor: disabled
          ? 'not-allowed'
          : isPanning
            ? (isActivelyPanning ? 'grabbing' : 'grab')
            : activeTool === 'move' || isHoveringSelection
              ? 'move'
              : 'crosshair',
      }}
      onPointerDown={(e) => {
        // Capture on the container so pointer events keep arriving here even
        // when the cursor wanders outside the committed-canvas bounds mid-drag
        // (e.g. dragging a clamped rotate handle in the gutter).
        e.currentTarget.setPointerCapture?.(e.pointerId);
        const touchDown = touchVp.onTouchPointerDown(e);
        if (touchDown.shouldPreventDefault) {
          e.preventDefault();
        }
        if (touchDown.consumed) {
          return;
        }
        if (isPanning) {
          e.preventDefault();
          panDragRef.current = { lastX: e.clientX, lastY: e.clientY };
          setIsActivelyPanning(true);
          return;
        }
        // Move-tool transform branch: only when no selection — the
        // selection-masked translate path is still handled by
        // handleMouseDown below.
        if (activeTool === 'move' && !selection) {
          if (moveTransform.handlePointerDown(e as unknown as React.PointerEvent<HTMLCanvasElement>)) return;
        }
        handleMouseDown(e as unknown as React.PointerEvent<HTMLCanvasElement>);
      }}
      onPointerMove={(e) => {
        if (isMobile && e.pointerType === 'touch') {
          touchVp.trackTouchPoint(e.pointerId, e.clientX, e.clientY);
        }
        if (touchVp.onTouchPointerMove(e)) {
          e.preventDefault();
          return;
        }
        if (isPanning && panDragRef.current) {
          const dx = e.clientX - panDragRef.current.lastX;
          const dy = e.clientY - panDragRef.current.lastY;
          panDragRef.current = { lastX: e.clientX, lastY: e.clientY };
          panBy(dx, dy);
          return;
        }
        if (activeTool === 'move' && !selection) {
          if (moveTransform.handlePointerMove(e)) return;
        }
        updateHoverOverSelection(e.clientX, e.clientY);
        handleMouseMove(e as unknown as React.PointerEvent<HTMLCanvasElement>);
      }}
      onPointerLeave={() => {
        if (isHoveringSelection) setIsHoveringSelection(false);
      }}
      onPointerUp={(e) => {
        touchVp.onTouchPointerUpOrCancel(e);
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
          e.currentTarget.releasePointerCapture?.(e.pointerId);
        }
        if (panDragRef.current) {
          panDragRef.current = null;
          setIsActivelyPanning(false);
          return;
        }
        if (activeTool === 'move' && !selection) {
          if (moveTransform.handlePointerUp(e as unknown as React.PointerEvent<HTMLCanvasElement>)) return;
        }
        handleMouseUp(e as unknown as React.PointerEvent<HTMLCanvasElement>);
      }}
      onPointerCancel={(e) => {
        touchVp.onTouchPointerUpOrCancel(e);
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
          e.currentTarget.releasePointerCapture?.(e.pointerId);
        }
        if (panDragRef.current) {
          panDragRef.current = null;
          setIsActivelyPanning(false);
          return;
        }
        if (activeTool === 'move' && !selection) {
          moveTransform.handlePointerCancel();
        }
        handlePointerCancel();
      }}
      onDoubleClick={(e) => handleDoubleClick(e as unknown as React.MouseEvent<HTMLCanvasElement>)}
    >
      <div
        className={styles.canvasInner}
        data-panning={isPanning ? 'true' : undefined}
        data-actively-panning={isActivelyPanning ? 'true' : undefined}
        style={{
          width,
          height,
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {tilingEnabled && tilingCanvasRef && (
          <canvas
            ref={tilingCanvasRef}
            style={{
              position: 'absolute',
              left: -width,
              top: -height,
              pointerEvents: 'none',
              zIndex: -1,
              imageRendering: 'pixelated',
            }}
            aria-hidden="true"
          />
        )}
        <canvas
          ref={committedCanvasCallbackRef}
          className={styles.canvas}
          style={{ pointerEvents: 'none' }}
        />
        <canvas
          ref={previewCanvasRef}
          className={`${styles.canvas} ${styles.canvasPreview}`}
          style={{ pointerEvents: 'none' }}
        />
      </div>
      <canvas
        ref={gridCanvasRef}
        className={styles.gridCanvas}
        aria-hidden="true"
      />
      {!activeLayerVisible && (
        <div
          className={styles.hiddenLayerOverlay}
          style={{
            transform: `translate(${panX}px, ${panY}px)`,
            width: width * zoom,
            height: height * zoom,
          }}
          aria-hidden="true"
        />
      )}
      {symmetryMode != null && symmetryMode !== 'none' && (
        <div
          className={`${styles.symmetryOverlay} ${styles[`symmetryOverlay_${symmetryMode}`]}`}
          style={{
            transform: `translate(${panX}px, ${panY}px)`,
            width: width * zoom,
            height: height * zoom,
          }}
          aria-hidden="true"
        />
      )}
      {/* No overlay for locked-but-visible layers — the content is still
          visible and a diagonal stripe would misrepresent the layer. The
          toast + the lock indicator in the layers panel carry the signal. */}
      <canvas
        ref={overlayCanvasRef}
        className={styles.screenOverlay}
        aria-hidden="true"
      />
      {(blockToast !== null || importToast !== null) && (
        <div className={styles.canvasToast}>
          <Toast message={blockToast !== null
            ? (blockToast === 'hidden' ? 'Layer is hidden — show it to draw' : 'Layer is locked — unlock it to draw')
            : importToast!} />
        </div>
      )}
    </div>
  );
});

EditorCanvas.displayName = 'EditorCanvas';

export default EditorCanvas;
