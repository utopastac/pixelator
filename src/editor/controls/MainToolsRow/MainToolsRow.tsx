import React, { useCallback, useRef, useState } from 'react';
import BrushSizeControl from '@/editor/controls/BrushSizeControl';
import ColorControls from '@/editor/controls/ColorControls';
import EraserToolControl from '@/editor/controls/EraserToolControl';
import LineToolControl from '@/editor/controls/LineToolControl';
import MarqueeControl from '@/editor/controls/MarqueeControl';
import MoveToolControl from '@/editor/controls/MoveToolControl';
import PaintToolControl from '@/editor/controls/PaintToolControl';
import PenToolControl from '@/editor/controls/PenToolControl';
import ShapeControl from '@/editor/controls/ShapeControl';
import sharedStyles from '@/editor/controls/toolbarShared.module.css';
import { useEditorSessionStore } from '@/editor/stores/useEditorSessionStore';
import styles from './MainToolsRow.module.css';

export interface MainToolsRowProps {
  palette: string[];
  paletteId?: string;
  onPaletteChange?: (id: string) => void;
  customColors: string[];
  onAddCustomColor?: (color: string) => void;
  showColorControls?: boolean;
}

const MainToolsRow: React.FC<MainToolsRowProps> = ({
  palette,
  paletteId,
  onPaletteChange,
  customColors,
  onAddCustomColor,
  showColorControls = true,
}) => {
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

  return (
    <div className={styles.row}>
      <MoveToolControl onClosePopovers={closeAllToolPopovers} />
      <MarqueeControl
        isOpen={isMarqueePopoverOpen}
        setIsOpen={setIsMarqueePopoverOpen}
        onOpenMarqueeOptions={openMarqueePopover}
        anchorRef={marqueeAnchorRef}
        onClosePopovers={closeAllToolPopovers}
      />
      <div className={sharedStyles.toolDivider} aria-hidden="true" />
      <BrushSizeControl
        isOpen={isBrushPopoverOpen}
        onButtonPress={onBrushButtonPress}
        onClose={() => setIsBrushPopoverOpen(false)}
        anchorRef={brushSizeAnchorRef}
      />
      <PaintToolControl onClosePopovers={closeAllToolPopovers} />
      <PenToolControl onClosePopovers={closeAllToolPopovers} />
      <LineToolControl onClosePopovers={closeAllToolPopovers} />
      <ShapeControl
        isOpen={isShapePopoverOpen}
        setIsOpen={setIsShapePopoverOpen}
        onOpenShapeOptions={openShapePopover}
        onShortPress={shapesShortPress}
        anchorRef={shapeAnchorRef}
      />
      <EraserToolControl onClosePopovers={closeAllToolPopovers} />
      {showColorControls && (
        <>
          <div className={sharedStyles.toolDivider} aria-hidden="true" />
          <ColorControls
            palette={palette}
            paletteId={paletteId}
            onPaletteChange={onPaletteChange}
            customColors={customColors}
            onAddCustomColor={onAddCustomColor}
            onClosePopovers={closeAllToolPopovers}
          />
        </>
      )}
    </div>
  );
};

export default MainToolsRow;
