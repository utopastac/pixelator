import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { DEFAULT_PALETTE, pixelsToSvg } from '../lib/pixelArtUtils';
import { usePixelArtHistory, type ActivePixels } from './usePixelArtHistory';
import { useEditorCommands } from '../useEditorCommands';
import { usePixelArtSelection } from './usePixelArtSelection';
import { usePenTool } from './usePenTool';
import { usePolygonSelectTool } from './usePolygonSelectTool';
import { usePixelArtPointerHandlers } from './usePixelArtPointerHandlers';
import { useViewport } from './useViewport';
import { useScreenOverlayDraw } from './useScreenOverlayDraw';
import { useGridCanvasDraw } from './useGridCanvasDraw';
import { useLayerTransform } from './useLayerTransform';
import { useMoveTransformTool } from './useMoveTransformTool';
import { useCanvasWheelZoom } from './useCanvasWheelZoom';
import { useCanvasKeyboardShortcuts } from './useCanvasKeyboardShortcuts';
import { useSpacebarPan } from './useSpacebarPan';
import { usePenHoverTracker } from './usePenHoverTracker';
import { useEditorManagedSize } from './useEditorManagedSize';
import { useEditorColorState } from './useEditorColorState';
import { useEditorFileHandlers } from './useEditorFileHandlers';
import { useEditorCanvasSetup } from './useEditorCanvasSetup';
import { useTilingCanvas } from './useTilingCanvas';
import { useLayerBlockGuard } from './useLayerBlockGuard';
import { useSelectionHoverTracker } from './useSelectionHoverTracker';
import { useEditorContextMenu } from './useEditorContextMenu';
import { createDefaultLayer } from '@/lib/storage';
import type { SymmetryMode } from '../lib/symmetry';
import type { PixelArtEditorProps } from '../PixelArtEditor';

const ZOOM_SENSITIVITY = 0.01;

export function usePixelArtEditorState(props: PixelArtEditorProps) {
  const {
    width: widthProp,
    height: heightProp,
    value,
    onChange,
    activeLayerId: activeLayerIdProp,
    onActiveLayerIdChange,
    palette = DEFAULT_PALETTE,
    sizes,
    onSizeChange,
    title,
    onTitleChange,
    helpUtilities,
    onDownloadPixelator,
    paletteId,
    onPaletteChange,
  } = props;

  const disabled = false;

  const {
    width,
    height,
    sizesEnabled,
    managedWidth,
    managedHeight,
    handleHistorySizeChange,
  } = useEditorManagedSize({ widthProp, heightProp, sizes, onSizeChange });


  // ── Canvas refs ─────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const committedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasMounted, setCanvasMounted] = useState(false);
  const committedCanvasCallbackRef = useCallback((el: HTMLCanvasElement | null) => {
    committedCanvasRef.current = el;
    setCanvasMounted(el !== null);
  }, []);

  // ── Viewport ─────────────────────────────────────────────────────────────────
  const viewport = useViewport({ width, height, containerRef });
  const { zoom, panX, panY, fit, setZoom, zoomAtPoint, panBy, isAutoFit, isPanning, setIsPanning } = viewport;
  const viewportPropsForToolbar = { zoom, setZoom, fit, isAutoFit };
  const panDragRef = useRef<{ lastX: number; lastY: number } | null>(null);
  const [isActivelyPanning, setIsActivelyPanning] = useState(false);

  // ── Modal state ──────────────────────────────────────────────────────────────
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // ── Drawing mode state ───────────────────────────────────────────────────────
  const [symmetryMode, setSymmetryMode] = useState<SymmetryMode>('none');
  const [tilingEnabled, setTilingEnabled] = useState(false);
  const [wrapMode, setWrapMode] = useState(false);
  const [alphaLock, setAlphaLock] = useState(false);

  // ── History (mount-only seed) ────────────────────────────────────────────────
  const initialSeed = useMemo(() => {
    if (value && value.length > 0) {
      return { layers: value, activeLayerId: activeLayerIdProp ?? value[0].id };
    }
    const fresh = createDefaultLayer(width, height);
    return { layers: [fresh], activeLayerId: fresh.id };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only

  const {
    pixels,
    layers,
    activeLayerId,
    canUndo,
    canRedo,
    dispatchPixels,
    commitPixels,
    commitResize,
    undo,
    redo,
    emitChange,
    addLayer,
    addLayerWithPixels,
    pasteAsNewLayer,
    duplicateLayer,
    duplicateLayerTo,
    clearLayer,
    rotateLayer,
    deleteLayer,
    mergeDown,
    renameLayer,
    setLayerVisibility,
    soloLayerVisibility,
    setLayerLocked,
    setLayerOpacity,
    moveLayer,
    setActiveLayerId,
  } = usePixelArtHistory({
    width,
    height,
    initialLayers: initialSeed.layers,
    initialActiveLayerId: initialSeed.activeLayerId,
    onChange,
    onSizeChange: handleHistorySizeChange,
  });

  useEffect(() => {
    if (onActiveLayerIdChange) onActiveLayerIdChange(activeLayerId);
  }, [activeLayerId, onActiveLayerIdChange]);

  // ── Tool & color state ───────────────────────────────────────────────────────
  const {
    activeTool,
    setActiveTool,
    brushSize,
    setBrushSize,
    lastShape,
    setLastShape,
    rectFillMode,
    setRectFillMode,
    circleFillMode,
    setCircleFillMode,
    triangleFillMode,
    setTriangleFillMode,
    starFillMode,
    setStarFillMode,
    arrowFillMode,
    setArrowFillMode,
    activeColor,
    setActiveColor,
    independentHue,
    setIndependentHue,
    recents,
    customColors,
    pushCustomColor,
    marqueeShape,
    setMarqueeShape,
    commitPixelsWithColor,
  } = useEditorColorState({ palette, commitPixels });

  const activeLayer = useMemo(
    () => layers.find((l) => l.id === activeLayerId) ?? null,
    [layers, activeLayerId],
  );
  const activeLayerLocked = activeLayer?.locked === true;
  const { blockToast, allowCommitOrSignal } = useLayerBlockGuard(activeLayer);

  const activeLayerBlocked = activeLayer?.visible === false || activeLayerLocked;
  const activePixels = useMemo<ActivePixels>(
    () => ({
      pixels,
      commit: (px: string[], beforePixels?: string[]) => {
        if (!allowCommitOrSignal()) return;
        commitPixelsWithColor(px, beforePixels);
      },
      dispatch: (px: string[]) => {
        if (activeLayerBlocked) return;
        dispatchPixels(px);
      },
      emit: emitChange,
    }),
    [pixels, commitPixelsWithColor, dispatchPixels, emitChange, allowCommitOrSignal, activeLayerBlocked],
  );

  // ── Transform tools ──────────────────────────────────────────────────────────
  const layerTransform = useLayerTransform({ pixels, width, height, activePixels });

  const {
    selection,
    setSelection,
    marchingAntsOffset,
    dragContext,
    selectionContainsCell,
  } = usePixelArtSelection({ width });

  const { context: penContext } = usePenTool({
    width,
    height,
    activePixels,
    activeColor,
    brushSize,
    selection,
    selectionContainsCell,
    previewCanvasRef,
    liftedPixelsRef: dragContext.lifted,
    symmetryMode,
    wrapMode,
    alphaLock,
  });

  const { context: polygonSelectContext } = usePolygonSelectTool({
    width,
    height,
    setSelection,
  });

  const { handleMouseDown, handleMouseMove, handleMouseUp, handlePointerCancel, handleDoubleClick } =
    usePixelArtPointerHandlers({
      disabled,
      activeTool,
      brushSize,
      activeColor,
      fillModes: { rect: rectFillMode, circle: circleFillMode, triangle: triangleFillMode, star: starFillMode, arrow: arrowFillMode },
      marqueeShape,
      setActiveTool,
      setActiveColor,
      setIndependentHue,
      width,
      height,
      committedCanvasRef,
      previewCanvasRef,
      activePixels,
      layers,
      selection,
      setSelection,
      selectionContainsCell,
      selectionDragContext: dragContext,
      penContext,
      polygonSelectContext,
      symmetryMode,
      wrapMode,
      alphaLock,
    });

  // ── Editor commands ──────────────────────────────────────────────────────────
  const {
    handleRotate,
    handlePickSize,
    clearSelection,
    downloadSvg,
    downloadPng,
    downloadLayersSvg,
  } = useEditorCommands({
    width,
    height,
    pixels,
    layers,
    allowCommitOrSignal,
    commitPixels,
    commitResize,
    emitChange,
    selection,
    setSelection,
    selectionContainsCell,
    dragContext,
    sizesEnabled,
    title,
    pngExportScale: 8,
  });

  const exportLayerSvg = useCallback((layerId: string) => {
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) return;
    const svg = pixelsToSvg(layer.pixels, width, height);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${layer.name || 'layer'}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [layers, width, height]);

  // ── File handlers ────────────────────────────────────────────────────────────
  const {
    onWrapperDragOver,
    onWrapperDrop,
    handleCopy,
    handleCut,
    handlePaste,
    importToast,
  } = useEditorFileHandlers({
    width,
    height,
    addLayerWithPixels,
    pasteAsNewLayer,
    commitPixels,
    emitChange,
    selection,
    activeLayer,
    activeLayerLocked,
    selectionContainsCell,
    penContext,
  });

  // ── Canvas rendering ─────────────────────────────────────────────────────────
  const { tilingCanvasRef, paintTiles } = useTilingCanvas({
    committedCanvasRef,
    width,
    height,
    enabled: tilingEnabled,
  });

  useEditorCanvasSetup({
    committedCanvasRef,
    previewCanvasRef,
    canvasMounted,
    width,
    height,
    layers,
    layerTransformIsPending: layerTransform.isPending,
    activeLayerId,
    onAfterComposite: paintTiles,
  });

  const moveTransform = useMoveTransformTool({
    width,
    height,
    disabled,
    committedCanvasRef,
    previewCanvasRef,
    transform: layerTransform,
    panX,
    panY,
    zoom,
  });

  const transformBoxForOverlay = useMemo(() => {
    if (activeTool !== 'move') return null;
    if (selection) return null;
    const corners = layerTransform.transformedCorners();
    if (!corners) return null;
    return { corners };
  }, [activeTool, selection, layerTransform]);

  useScreenOverlayDraw({
    overlayCanvasRef,
    containerRef,
    selection,
    marchingAntsOffset,
    activeTool,
    penAnchors: penContext.anchors,
    penCursor: penContext.cursor,
    polygonSelectAnchors: polygonSelectContext.anchors,
    polygonSelectCursor: polygonSelectContext.cursor,
    gridWidth: width,
    zoom,
    panX,
    panY,
    transformBox: transformBoxForOverlay,
    marqueeShape,
  });

  useGridCanvasDraw({
    gridCanvasRef,
    containerRef,
    zoom,
    panX,
    panY,
    width,
    height,
  });

  // Auto-commit pending transform on tool/layer change.
  useEffect(() => {
    if (activeTool === 'move') return;
    if (layerTransform.isPending) {
      layerTransform.commit();
      moveTransform.clearPreview();
    }
  }, [activeTool, layerTransform, moveTransform]);

  useEffect(() => {
    if (layerTransform.isPending) {
      layerTransform.commit();
      moveTransform.clearPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayerId]);

  // ── Input hooks ──────────────────────────────────────────────────────────────
  const cancelAllPaths = useCallback(() => {
    penContext.cancel();
    polygonSelectContext.cancel();
  }, [penContext, polygonSelectContext]);

  useCanvasKeyboardShortcuts({
    disabled,
    activeTool,
    setActiveTool,
    lastShape,
    marqueeShape,
    commitPenPath: penContext.commit,
    cancelPenPath: cancelAllPaths,
    cancelPolygonSelect: polygonSelectContext.cancel,
    commitPolygonSelect: polygonSelectContext.commit,
    selection,
    setSelection,
    liftedPixels: dragContext.lifted,
    selectionContainsCell,
    clearSelection,
    activePixels,
    width,
    height,
    activeColor,
    previewCanvasRef,
    undo,
    redo,
    fit,
    setZoom,
    zoom,
    layerTransform,
    onCopy: handleCopy,
    onCut: handleCut,
    onPaste: handlePaste,
  });

  useSpacebarPan(setIsPanning, disabled);

  useCanvasWheelZoom({
    containerRef,
    disabled,
    zoom,
    zoomAtPoint,
    panBy,
    sensitivity: ZOOM_SENSITIVITY,
  });

  usePenHoverTracker(activeTool, handleMouseMove, disabled);

  const { isHoveringSelection, setIsHoveringSelection, updateHoverOverSelection } =
    useSelectionHoverTracker({
      activeTool,
      selection,
      committedCanvasRef,
      width,
      height,
      selectionContainsCell,
    });

  // ── Context menu ─────────────────────────────────────────────────────────────
  const clearLiftedPixels = useCallback(() => { dragContext.lifted.current = null; }, [dragContext.lifted]);

  const { onContextMenu, contextMenuProps } = useEditorContextMenu({
    canUndo,
    canRedo,
    undo,
    redo,
    fit,
    setZoom,
    selection,
    setSelection,
    selectionContainsCell,
    clearLiftedPixels,
    addLayer,
    duplicateLayer,
    clearLayer,
    activeLayerId,
    width,
    height,
    pixels,
    activeColor,
    allowCommitOrSignal,
    commitPixels,
    emitChange,
    handleRotate,
    handleCopy,
    handleCut,
    handlePaste,
    activeLayerLocked,
    downloadSvg,
    downloadPng,
    downloadLayersSvg,
    resetDrawing: () => setIsResetConfirmOpen(true),
    setActiveTool,
  });

  // ── Derived prop bundles ─────────────────────────────────────────────────────
  const hasTitlePanel = typeof title === 'string' && typeof onTitleChange === 'function';
  const currentWidthForToolbar = sizesEnabled ? managedWidth : undefined;
  const currentHeightForToolbar = sizesEnabled ? managedHeight : undefined;

  const toolsPanelBaseProps = {
    activeTool,
    setActiveTool,
    brushSize,
    setBrushSize,
    activeColor,
    setActiveColor,
    palette,
    paletteId,
    onPaletteChange,
    customColors,
    onAddCustomColor: pushCustomColor,
    setIndependentHue,
    independentHue,
    rectFillMode,
    setRectFillMode,
    circleFillMode,
    setCircleFillMode,
    triangleFillMode,
    setTriangleFillMode,
    starFillMode,
    setStarFillMode,
    arrowFillMode,
    setArrowFillMode,
    lastShape,
    setLastShape,
    marqueeShape,
    setMarqueeShape,
    cancelPenPath: cancelAllPaths,
  };

  const titlePanelProps = {
    title: title!,
    onTitleChange: onTitleChange!,
    sizes,
    currentWidth: currentWidthForToolbar,
    currentHeight: currentHeightForToolbar,
    onPickSize: handlePickSize,
    viewport: viewportPropsForToolbar,
    tilingEnabled,
    setTilingEnabled,
    wrapMode,
    setWrapMode,
    symmetryMode,
    setSymmetryMode,
    alphaLock,
    setAlphaLock,
    canUndo,
    canRedo,
    onUndo: undo,
    onRedo: redo,
  };

  const editorCanvasProps = {
    width,
    height,
    zoom,
    panX,
    panY,
    isPanning,
    isActivelyPanning,
    panDragRef,
    setIsActivelyPanning,
    panBy,
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
    tilingCanvasRef,
    tilingEnabled,
    symmetryMode,
    onContextMenu,
    activeLayerVisible: activeLayer?.visible !== false,
    blockToast,
    importToast,
  };

  const layersPanelProps = {
    layers,
    activeLayerId,
    width,
    height,
    onAddLayer: addLayer,
    onImportLayerImage: addLayerWithPixels,
    onDuplicateLayer: duplicateLayer,
    onDuplicateLayerTo: duplicateLayerTo,
    onClearLayer: clearLayer,
    onRotateLayer: rotateLayer,
    onDeleteLayer: deleteLayer,
    onRenameLayer: renameLayer,
    onSetVisibility: setLayerVisibility,
    onSoloVisibility: soloLayerVisibility,
    onSetLocked: setLayerLocked,
    onSetOpacity: setLayerOpacity,
    onMoveLayer: moveLayer,
    onMergeDown: mergeDown,
    onExportLayerSvg: exportLayerSvg,
    onSetActive: setActiveLayerId,
    onDownloadSvg: downloadSvg,
    onDownloadPng: downloadPng,
    onDownloadLayersSvg: downloadLayersSvg,
    onDownloadPixelator,
    currentWidth: currentWidthForToolbar,
    currentHeight: currentHeightForToolbar,
  };

  const recentColorsPanelProps = {
    recents,
    activeColor,
    onPick: setActiveColor,
  };

  const onResetConfirm = useCallback(() => {
    const fresh = createDefaultLayer(width, height);
    commitResize([fresh], width, height);
    setSelection(null);
    dragContext.lifted.current = null;
    setIsResetConfirmOpen(false);
  }, [width, height, commitResize, setSelection, dragContext.lifted]);

  const onResetCancel = useCallback(() => setIsResetConfirmOpen(false), []);
  const onOpenShortcuts = useCallback(() => setIsShortcutsOpen(true), []);
  const onCloseShortcuts = useCallback(() => setIsShortcutsOpen(false), []);

  return {
    // Wrapper
    onDragOver: onWrapperDragOver,
    onDrop: onWrapperDrop,
    // Panel props
    hasTitlePanel,
    toolsPanelBaseProps,
    titlePanelProps,
    // Canvas
    containerRef,
    editorCanvasProps,
    // Context menu
    contextMenuProps,
    // Layers
    layersPanelProps,
    // Recent colors
    recentColorsPanelProps,
    // Help
    helpUtilities,
    isShortcutsOpen,
    onOpenShortcuts,
    onCloseShortcuts,
    // Reset confirm
    isResetConfirmOpen,
    onResetConfirm,
    onResetCancel,
  };
}
