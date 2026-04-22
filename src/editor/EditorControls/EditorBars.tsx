import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import FloatingPanel from '@/primitives/FloatingPanel';
import ToolbarButton from '@/primitives/ToolbarButton';
import ToolGroupCluster from '@/editor/controls/ToolGroupCluster';
import { createEditorControls, type EditorChromeData } from './Controls';
import { useEditorSessionStore } from '@/editor/stores/useEditorSessionStore';
import styles from './EditorBars.module.css';

export interface EditorBarsProps {
  panelsVisible: boolean;
  isMobile: boolean;
  /** Palette + optional title-cluster fields from the editor hook (no popover state). */
  chrome: EditorChromeData;
  /**
   * Mobile only: called with the measured on-screen height (px) of the bottom
   * fixed tool stack so the recent-colors strip can sit flush above it.
   * Report `0` when the stack is not mounted.
   */
  onMobileBottomToolbarHeight?: (heightPx: number) => void;
}

export default function EditorBars({
  panelsVisible,
  isMobile,
  chrome,
  onMobileBottomToolbarHeight,
}: EditorBarsProps) {
  const [isBrushPopoverOpen, setIsBrushPopoverOpen] = useState(false);
  const [isShapePopoverOpen, setIsShapePopoverOpen] = useState(false);
  const [isMarqueePopoverOpen, setIsMarqueePopoverOpen] = useState(false);

  const brushSizeAnchorRef = useRef<HTMLDivElement>(null);
  const shapeAnchorRef = useRef<HTMLDivElement>(null);
  const marqueeAnchorRef = useRef<HTMLDivElement>(null);
  const mobileBottomToolbarRef = useRef<HTMLDivElement>(null);
  const [mobileAdvancedStripOpen, setMobileAdvancedStripOpen] = useState(false);

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

  useLayoutEffect(() => {
    if (!onMobileBottomToolbarHeight) return;
    if (!isMobile || !panelsVisible) {
      onMobileBottomToolbarHeight(0);
      return;
    }
    const el = mobileBottomToolbarRef.current;
    if (!el) {
      onMobileBottomToolbarHeight(0);
      return;
    }
    const report = () => {
      const h = el.getBoundingClientRect().height;
      onMobileBottomToolbarHeight(h > 0 ? Math.round(h) : 0);
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [isMobile, panelsVisible, mobileAdvancedStripOpen, onMobileBottomToolbarHeight]);

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
        <FloatingPanel
          position="top-center"
          size="sm"
          mobile={isMobile}
          role="region"
          aria-label="Drawing title"
        >
          <div className={styles.barRow}>
            <ToolGroupCluster>
              {c.openDrawings}
            </ToolGroupCluster>
            <ToolGroupCluster>
              {c.canvasSize}
            </ToolGroupCluster>
            <ToolGroupCluster>
              {c.historyUndo}
              {c.historyRedo}
            </ToolGroupCluster>
            <ToolGroupCluster>
              {c.gridOverlay}
            </ToolGroupCluster>
            <ToolGroupCluster trailingDivider={false}>
              {c.tiling}
            </ToolGroupCluster>
            <ToolGroupCluster align="right" trailingDivider={false} leadingDivider={true}>
              {c.themeToggle}
              {c.download}
              {c.layersPanelToggle}
            </ToolGroupCluster>
          </div>
        </FloatingPanel>
        <FloatingPanel
          ref={mobileBottomToolbarRef}
          position="bottom-center"
          direction="column"
          size="sm"
          mobile={isMobile}
          className={styles.mobileStack}
          aria-label="Editor"
        >
          {mobileAdvancedStripOpen && (
            <div
              id="editor-mobile-advanced-tools"
              className={styles.toolsStrip}
              role="region"
              aria-label="Advanced tools"
            >
              <ToolGroupCluster>
                {c.moveTool}
                {c.marquee}
                {c.deselect}
                {c.duplicateSelection}
              </ToolGroupCluster>
              <ToolGroupCluster>
                {c.eyedropper}
              </ToolGroupCluster>
              <ToolGroupCluster>
                {c.symmetry}
              </ToolGroupCluster>
              <ToolGroupCluster>
                {c.wrap}
              </ToolGroupCluster>
              <ToolGroupCluster trailingDivider={false}>
                {c.alphaLock}
              </ToolGroupCluster>
            </div>
          )}
          <div className={styles.mobileToolsToolbar} role="toolbar" aria-label="Pixel art tools">
            <div className={styles.mobileAdvancedToggleDock}>
              <ToolbarButton
                icon={SlidersHorizontal}
                aria-label="Advanced tools"
                selected={mobileAdvancedStripOpen}
                fillHeight
                onClick={() => setMobileAdvancedStripOpen((v) => !v)}
              />
            </div>
            <div className={styles.toolsRowScroll}>
              <div className={styles.toolsRow}>
                <ToolGroupCluster trailingDivider={false}>
                  {c.brushSize}
                  {c.paint}
                  {c.pen}
                  {c.line}
                  {c.shape}
                  {c.eraser}
                  {c.fill}
                </ToolGroupCluster>
              </div>
            </div>
            <div className={styles.mobileSwatchesDock} role="group" aria-label="Color">
              {c.swatches}
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
          <ToolGroupCluster>
            {c.gridOverlay}
          </ToolGroupCluster>
          <ToolGroupCluster>
            {c.tiling}
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
          <ToolGroupCluster align="right" trailingDivider={false} leadingDivider={true}>
            {c.download}
            {c.layersPanelToggle}
          </ToolGroupCluster>
        </div>
      </FloatingPanel>
      {desktopHelpPanel}
    </>
  );
}
