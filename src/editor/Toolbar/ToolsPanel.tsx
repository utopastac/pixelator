import React, { useCallback, useRef, useState } from 'react';
import { BRUSH_ICONS } from '../icons/PixelArtIcons';
import {
  PencilIcon,
  EraserIcon,
  FillIcon,
  EyedropperIcon,
  PenIcon,
  LineIcon,
  RectMarqueeIcon,
  CircleMarqueeIcon,
  MagicWandIcon,
  RectIcon, RectFilledIcon,
  CircleIcon, CircleFilledIcon,
  TriangleIcon, TriangleFilledIcon,
  StarIcon, StarFilledIcon,
  ArrowIcon, ArrowFilledIcon,
  MoveIcon,
  PolygonSelectIcon,
} from '../icons/PixelToolIcons';
import Popover from '@/overlays/Popover';
import FloatingPanel from '@/primitives/FloatingPanel';
import SwatchesPopover from '../SwatchesPopover';
import BrushSizePicker from './BrushSizePicker';
import MarqueePicker from './MarqueePicker';
import ShapePicker, { type ShapeType } from './ShapePicker';
import ToolButton from './ToolButton';
import { type PixelArtFillMode, type PixelArtBrushSize } from '../lib/pixelArtUtils';
import type { PixelArtTool } from '../PixelArtEditor';
import sharedStyles from './toolbarShared.module.css';

export interface ToolsPanelProps {
  // Tool state
  activeTool: PixelArtTool;
  setActiveTool: (t: PixelArtTool) => void;
  brushSize: PixelArtBrushSize;
  setBrushSize: (b: PixelArtBrushSize) => void;

  // Colors
  activeColor: string;
  setActiveColor: (c: string) => void;
  palette: string[];
  paletteId?: string;
  onPaletteChange?: (id: string) => void;
  customColors: string[];
  onAddCustomColor?: (color: string) => void;
  setIndependentHue: (h: number | null) => void;
  independentHue: number | null;

  // Shapes
  rectFillMode: PixelArtFillMode;
  setRectFillMode: React.Dispatch<React.SetStateAction<PixelArtFillMode>>;
  circleFillMode: PixelArtFillMode;
  setCircleFillMode: React.Dispatch<React.SetStateAction<PixelArtFillMode>>;
  triangleFillMode: PixelArtFillMode;
  setTriangleFillMode: React.Dispatch<React.SetStateAction<PixelArtFillMode>>;
  starFillMode: PixelArtFillMode;
  setStarFillMode: React.Dispatch<React.SetStateAction<PixelArtFillMode>>;
  arrowFillMode: PixelArtFillMode;
  setArrowFillMode: React.Dispatch<React.SetStateAction<PixelArtFillMode>>;
  lastShape: 'rect' | 'circle' | 'triangle' | 'star' | 'arrow';
  setLastShape: (s: 'rect' | 'circle' | 'triangle' | 'star' | 'arrow') => void;

  // Marquee
  marqueeShape: 'rect' | 'ellipse' | 'wand' | 'polygon';
  setMarqueeShape: (s: 'rect' | 'ellipse' | 'wand' | 'polygon') => void;

  /** Fired whenever switching active tool — dismisses any in-progress pen path. */
  cancelPenPath: () => void;

}

/** Tools cluster: selection, stroke tools, shapes, fill, eyedropper, swatches. */
const ToolsPanel: React.FC<ToolsPanelProps> = ({
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
  onAddCustomColor,
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
  cancelPenPath,
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

  const shapesShortPress = useCallback(() => {
    const isActiveToolShape = activeTool === 'rect' || activeTool === 'circle' || activeTool === 'triangle' || activeTool === 'star' || activeTool === 'arrow';
    if (isActiveToolShape) {
      if (activeTool === 'rect') setRectFillMode(f => f === 'fill' ? 'outline' : 'fill');
      else if (activeTool === 'circle') setCircleFillMode(f => f === 'fill' ? 'outline' : 'fill');
      else if (activeTool === 'triangle') setTriangleFillMode(f => f === 'fill' ? 'outline' : 'fill');
      else if (activeTool === 'star') setStarFillMode(f => f === 'fill' ? 'outline' : 'fill');
      else if (activeTool === 'arrow') setArrowFillMode(f => f === 'fill' ? 'outline' : 'fill');
    } else {
      cancelPenPath();
      setActiveTool(lastShape);
      closeAllToolPopovers();
    }
  }, [activeTool, lastShape, cancelPenPath, setActiveTool, closeAllToolPopovers, setRectFillMode, setCircleFillMode, setTriangleFillMode, setStarFillMode, setArrowFillMode]);

  const openShapePopover = useCallback(() => {
    setIsShapePopoverOpen(true);
    setIsBrushPopoverOpen(false);
    setIsMarqueePopoverOpen(false);
  }, []);

  const openMarqueePopover = useCallback(() => {
    cancelPenPath();
    setActiveTool('marquee');
    setIsMarqueePopoverOpen(true);
    setIsBrushPopoverOpen(false);
    setIsShapePopoverOpen(false);
  }, [cancelPenPath, setActiveTool]);

  const toolsClusterContent = (
    <>
      {/* Selection / transform group */}
      <ToolButton
        icon={MoveIcon}
        size="md"
        selected={activeTool === 'move'}
        onPress={() => { cancelPenPath(); setActiveTool('move'); closeAllToolPopovers(); }}
        aria-label="Move"
        tooltip="Move"
      />
      <ToolButton
        ref={marqueeAnchorRef}
        icon={
          marqueeShape === 'ellipse' ? CircleMarqueeIcon
          : marqueeShape === 'wand' ? MagicWandIcon
          : marqueeShape === 'polygon' ? PolygonSelectIcon
          : RectMarqueeIcon
        }
        size="md"
        selected={activeTool === 'marquee'}
        onPress={() => { cancelPenPath(); setActiveTool('marquee'); closeAllToolPopovers(); }}
        aria-label="Marquee selection"
        tooltip="Marquee selection"
        chevron={{
          onClick: openMarqueePopover,
          'aria-label': 'Marquee options',
          isOpen: isMarqueePopoverOpen,
        }}
      />
      <Popover
        isOpen={isMarqueePopoverOpen}
        onClose={() => setIsMarqueePopoverOpen(false)}
        anchorRef={marqueeAnchorRef}
        offsetX={-5}
        role="dialog"
        aria-label="Selection mode"
      >
        <MarqueePicker
          marqueeShape={marqueeShape}
          onPick={(shape) => { setMarqueeShape(shape); setActiveTool('marquee'); setIsMarqueePopoverOpen(false); cancelPenPath(); }}
        />
      </Popover>
      <div className={sharedStyles.toolDivider} aria-hidden="true" />
      {/* Stroke tools — brush size leads the group so the setting reads
          as governing what follows; eraser trails so it sits next to the
          fills/shapes divider rather than between paint and line. */}
      <ToolButton
        ref={brushSizeAnchorRef}
        icon={BRUSH_ICONS[brushSize]}
        size="md"
        selected={isBrushPopoverOpen}
        onPress={() => {
          if (isBrushPopoverOpen) setIsBrushPopoverOpen(false);
          else openBrushSizePopover();
        }}
        aria-label="Brush size"
        tooltip="Brush size"
        hasOptions
        aria-haspopup="menu"
        aria-expanded={isBrushPopoverOpen}
      />
      <Popover
        isOpen={isBrushPopoverOpen}
        onClose={() => setIsBrushPopoverOpen(false)}
        anchorRef={brushSizeAnchorRef}
        offsetX={-5}
        role="menu"
        aria-label="Brush size"
      >
        <BrushSizePicker
          brushSize={brushSize}
          onPick={(size) => { setBrushSize(size); setIsBrushPopoverOpen(false); }}
        />
      </Popover>
      <ToolButton
        icon={PencilIcon}
        size="md"
        selected={activeTool === 'paint'}
        onPress={() => { cancelPenPath(); setActiveTool('paint'); closeAllToolPopovers(); }}
        aria-label="Paint"
        tooltip="Paint"
      />
      <ToolButton
        icon={PenIcon}
        size="md"
        selected={activeTool === 'pen'}
        onPress={() => { setActiveTool('pen'); closeAllToolPopovers(); }}
        aria-label="Pen"
        tooltip="Pen"
      />
      <ToolButton
        icon={LineIcon}
        size="md"
        selected={activeTool === 'line'}
        onPress={() => { cancelPenPath(); setActiveTool('line'); closeAllToolPopovers(); }}
        aria-label="Line"
        tooltip="Line"
      />
      <ToolButton
        ref={shapeAnchorRef}
        icon={(() => {
            const shape = (['rect', 'circle', 'triangle', 'star', 'arrow'] as const).includes(activeTool as 'rect')
              ? (activeTool as 'rect' | 'circle' | 'triangle' | 'star' | 'arrow')
              : lastShape;
            const fillMode =
              shape === 'rect' ? rectFillMode
              : shape === 'circle' ? circleFillMode
              : shape === 'triangle' ? triangleFillMode
              : shape === 'star' ? starFillMode
              : arrowFillMode;
            const icons = {
              rect: fillMode === 'fill' ? RectFilledIcon : RectIcon,
              circle: fillMode === 'fill' ? CircleFilledIcon : CircleIcon,
              triangle: fillMode === 'fill' ? TriangleFilledIcon : TriangleIcon,
              star: fillMode === 'fill' ? StarFilledIcon : StarIcon,
              arrow: fillMode === 'fill' ? ArrowFilledIcon : ArrowIcon,
            };
            return icons[shape];
          })()}
          size="md"
          selected={activeTool === 'rect' || activeTool === 'circle' || activeTool === 'triangle' || activeTool === 'star' || activeTool === 'arrow'}
          onPress={shapesShortPress}
          aria-label="Shapes"
          tooltip="Shapes"
          chevron={{
            onClick: openShapePopover,
            'aria-label': 'Shape options',
            isOpen: isShapePopoverOpen,
          }}
        />
      <Popover
        isOpen={isShapePopoverOpen}
        onClose={() => setIsShapePopoverOpen(false)}
        anchorRef={shapeAnchorRef}
        offsetX={-5}
        role="dialog"
        aria-label="Shape picker"
      >
        <ShapePicker
          activeTool={activeTool}
          fillModes={{ rect: rectFillMode, circle: circleFillMode, triangle: triangleFillMode, star: starFillMode, arrow: arrowFillMode }}
          onPick={(shape) => {
            if (activeTool === shape) {
              const togglers: Record<ShapeType, () => void> = {
                rect:     () => setRectFillMode(f => f === 'fill' ? 'outline' : 'fill'),
                circle:   () => setCircleFillMode(f => f === 'fill' ? 'outline' : 'fill'),
                triangle: () => setTriangleFillMode(f => f === 'fill' ? 'outline' : 'fill'),
                star:     () => setStarFillMode(f => f === 'fill' ? 'outline' : 'fill'),
                arrow:    () => setArrowFillMode(f => f === 'fill' ? 'outline' : 'fill'),
              };
              togglers[shape]();
            } else {
              cancelPenPath();
              setActiveTool(shape);
              setLastShape(shape);
            }
            setIsShapePopoverOpen(false);
          }}
        />
      </Popover>
      <ToolButton
        icon={EraserIcon}
        size="md"
        selected={activeTool === 'eraser'}
        onPress={() => { cancelPenPath(); setActiveTool('eraser'); closeAllToolPopovers(); }}
        aria-label="Eraser"
        tooltip="Eraser"
      />
      <div className={sharedStyles.toolDivider} aria-hidden="true" />
      {/* Colour pickers group */}
      <ToolButton
        icon={FillIcon}
        size="md"
        selected={activeTool === 'fill'}
        onPress={() => { cancelPenPath(); setActiveTool('fill'); closeAllToolPopovers(); }}
        aria-label="Fill"
        tooltip="Fill"
      />
      <ToolButton
        icon={EyedropperIcon}
        size="md"
        selected={activeTool === 'eyedropper'}
        onPress={() => { cancelPenPath(); setActiveTool('eyedropper'); closeAllToolPopovers(); }}
        aria-label="Eyedropper"
        tooltip="Eyedropper"
      />
      <SwatchesPopover
        activeColor={activeColor}
        setActiveColor={setActiveColor}
        palette={palette}
        paletteId={paletteId}
        onPaletteChange={onPaletteChange}
        customColors={customColors}
        onAddCustomColor={onAddCustomColor}
        independentHue={independentHue}
        setIndependentHue={setIndependentHue}
      />
    </>
  );

  return (
    <FloatingPanel role="toolbar" aria-label="Pixel art tools">
      {toolsClusterContent}
    </FloatingPanel>
  );
};

export default ToolsPanel;
