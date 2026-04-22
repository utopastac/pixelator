import { useCallback, useRef, useState } from 'react';
import FloatingPanel from '@/primitives/FloatingPanel';
import ToolGroupCluster from '@/editor/controls/ToolGroupCluster';
import { createEditorControls, type EditorChromeData } from './Controls';
import { useEditorSessionStore } from '@/editor/stores/useEditorSessionStore';
import styles from './EditorBars.module.css';

export interface EditorBarsProps {
  panelsVisible: boolean;
  isMobile: boolean;
  /** Palette + optional title-cluster fields from the editor hook (no popover state). */
  chrome: EditorChromeData;
}

export default function EditorBars({ panelsVisible, isMobile, chrome }: EditorBarsProps) {
  const [isBrushPopoverOpen, setIsBrushPopoverOpen] = useState(false);
  const [isShapePopoverOpen, setIsShapePopoverOpen] = useState(false);
  const [isMarqueePopoverOpen, setIsMarqueePopoverOpen] = useState(false);

  const brushSizeAnchorRef = useRef<HTMLDivElement>(null);
  const shapeAnchorRef = useRef<HTMLDivElement>(null);
  const marqueeAnchorRef = useRef<HTMLDivElement>(null);

  const closeAllToolPopovers = useCallback(() => {
    setIsBrushPopoverOpen(false);
    setIsShapePopoverOpen(false);
    setIsMarqueePopoverOpen(false);
  }, []);

  const openBrushSizePopover = useCallback(() => {
    setIsBrushPopoverOpen(true);
    setIsShapePopoverOpen(false);
    setIsMarqueePopoverOpen(false);
  }, []);

  const openShapePopover = useCallback(() => {
    setIsShapePopoverOpen(true);
    setIsBrushPopoverOpen(false);
    setIsMarqueePopoverOpen(false);
  }, []);

  const openMarqueePopover = useCallback(() => {
    const { cancelPenPath, setActiveTool } = useEditorSessionStore.getState();
    cancelPenPath();
    setActiveTool('marquee');
    setIsMarqueePopoverOpen(true);
    setIsBrushPopoverOpen(false);
    setIsShapePopoverOpen(false);
  }, []);

  const shapesShortPress = useCallback(() => {
    const {
      activeTool,
      lastShape,
      cancelPenPath,
      setActiveTool,
      setRectFillMode,
      setCircleFillMode,
      setTriangleFillMode,
      setStarFillMode,
      setArrowFillMode,
    } = useEditorSessionStore.getState();

    const isActiveToolShape =
      activeTool === 'rect' ||
      activeTool === 'circle' ||
      activeTool === 'triangle' ||
      activeTool === 'star' ||
      activeTool === 'arrow';
    if (isActiveToolShape) {
      if (activeTool === 'rect') setRectFillMode((f) => (f === 'fill' ? 'outline' : 'fill'));
      else if (activeTool === 'circle') setCircleFillMode((f) => (f === 'fill' ? 'outline' : 'fill'));
      else if (activeTool === 'triangle') setTriangleFillMode((f) => (f === 'fill' ? 'outline' : 'fill'));
      else if (activeTool === 'star') setStarFillMode((f) => (f === 'fill' ? 'outline' : 'fill'));
      else if (activeTool === 'arrow') setArrowFillMode((f) => (f === 'fill' ? 'outline' : 'fill'));
    } else {
      cancelPenPath();
      setActiveTool(lastShape);
      closeAllToolPopovers();
    }
  }, [closeAllToolPopovers]);

  const onBrushButtonPress = useCallback(() => {
    if (isBrushPopoverOpen) setIsBrushPopoverOpen(false);
    else openBrushSizePopover();
  }, [isBrushPopoverOpen, openBrushSizePopover]);

  const c = createEditorControls({
    ...chrome,
    isBrushPopoverOpen,
    setBrushPopoverOpen: setIsBrushPopoverOpen,
    brushSizeAnchorRef,
    isShapePopoverOpen,
    setShapePopoverOpen: setIsShapePopoverOpen,
    shapeAnchorRef,
    isMarqueePopoverOpen,
    setMarqueePopoverOpen: setIsMarqueePopoverOpen,
    marqueeAnchorRef,
    closeAllToolPopovers,
    openBrushSizePopover,
    openShapePopover,
    openMarqueePopover,
    shapesShortPress,
    onBrushButtonPress,
  });

  const desktopHelpPanel = (
    <FloatingPanel position="bottom-left" size="sm" direction="column" mobile={isMobile} aria-label="Help">
      <div className={styles.helpStack}>
        {c.togglePanels}
        {c.keyboardShortcuts}
        {c.themeToggle}
      </div>
    </FloatingPanel>
  );

  if (!panelsVisible && isMobile) {
    return null;
  }

  if (!panelsVisible && !isMobile) {
    return <>{desktopHelpPanel}</>;
  }

  if (isMobile) {
    return (
      <>
        <FloatingPanel position="top-center" size="sm" mobile={isMobile} aria-label="Drawing title">
          <div className={styles.barRow}>
            <ToolGroupCluster>
              {c.openDrawings}
              {c.canvasSize}
            </ToolGroupCluster>
            <ToolGroupCluster>
              {c.zoom}
              {c.layersPanelToggle}
            </ToolGroupCluster>
          </div>
        </FloatingPanel>
        <FloatingPanel
          position="bottom-center"
          direction="column"
          size="sm"
          mobile={isMobile}
          className={styles.mobileStack}
          aria-label="Editor"
        >
          <div className={styles.mobileTitleStrip} role="region" aria-label="Drawing title">
            <ToolGroupCluster trailingDivider={false}>
              {c.fill}
              {c.eyedropper}
              {c.swatches}
            </ToolGroupCluster>
          </div>
          <div role="toolbar" aria-label="Pixel art tools">
            <div className={styles.toolsRow}>
              <ToolGroupCluster>
                {c.moveTool}
                {c.marquee}
              </ToolGroupCluster>
              <ToolGroupCluster>
                {c.brushSize}
                {c.paint}
                {c.pen}
                {c.line}
                {c.shape}
                {c.eraser}
              </ToolGroupCluster>
            </div>
          </div>
        </FloatingPanel>
      </>
    );
  }

  return (
    <>
      <FloatingPanel position="top-left" size="sm" direction="column" mobile={isMobile}>
        {c.openDrawings}
      </FloatingPanel>
      <FloatingPanel role="toolbar" mobile={isMobile} aria-label="Pixel art tools">
        <div className={styles.toolsRow}>
          <ToolGroupCluster>
            {c.moveTool}
            {c.marquee}
          </ToolGroupCluster>
          <ToolGroupCluster>
            {c.brushSize}
            {c.paint}
            {c.pen}
            {c.line}
            {c.shape}
            {c.eraser}
          </ToolGroupCluster>
          <ToolGroupCluster>
            {c.fill}
            {c.eyedropper}
            {c.swatches}
          </ToolGroupCluster>
        </div>
      </FloatingPanel>
      <FloatingPanel position="top-center" size="sm" mobile={isMobile} aria-label="Drawing title">
        <div className={styles.barRow}>
          <ToolGroupCluster>
            {c.drawingTitle}
            {c.canvasSize}
          </ToolGroupCluster>
          <ToolGroupCluster>
            {c.zoom}
          </ToolGroupCluster>
          {c.gridOverlay}
          <ToolGroupCluster>
            {c.tiling}
            {c.layersPanelToggle}
          </ToolGroupCluster>
          <ToolGroupCluster>
            {c.symmetry}
            {c.wrap}
            {c.alphaLock}
          </ToolGroupCluster>
          <ToolGroupCluster trailingDivider={false}>
            {c.historyUndo}
            {c.historyRedo}
          </ToolGroupCluster>
        </div>
      </FloatingPanel>
      {desktopHelpPanel}
    </>
  );
}
