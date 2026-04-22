import React from 'react';
import Popover from '@/overlays/Popover';
import ShapePicker, { type ShapeType } from '@/editor/controls/ShapePicker';
import ToolButton from '@/editor/controls/ToolButton';
import {
  ArrowFilledIcon,
  ArrowIcon,
  CircleFilledIcon,
  CircleIcon,
  RectFilledIcon,
  RectIcon,
  StarFilledIcon,
  StarIcon,
  TriangleFilledIcon,
  TriangleIcon,
} from '@/editor/icons/PixelToolIcons';
import { useEditorSessionStore } from '@/editor/stores/useEditorSessionStore';

export interface ShapeControlProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onOpenShapeOptions: () => void;
  onShortPress: () => void;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}

export default function ShapeControl({
  isOpen,
  setIsOpen,
  onOpenShapeOptions,
  onShortPress,
  anchorRef,
}: ShapeControlProps) {
  const activeTool = useEditorSessionStore((s) => s.activeTool);
  const lastShape = useEditorSessionStore((s) => s.lastShape);
  const rectFillMode = useEditorSessionStore((s) => s.rectFillMode);
  const circleFillMode = useEditorSessionStore((s) => s.circleFillMode);
  const triangleFillMode = useEditorSessionStore((s) => s.triangleFillMode);
  const starFillMode = useEditorSessionStore((s) => s.starFillMode);
  const arrowFillMode = useEditorSessionStore((s) => s.arrowFillMode);
  const setActiveTool = useEditorSessionStore((s) => s.setActiveTool);
  const setLastShape = useEditorSessionStore((s) => s.setLastShape);
  const setRectFillMode = useEditorSessionStore((s) => s.setRectFillMode);
  const setCircleFillMode = useEditorSessionStore((s) => s.setCircleFillMode);
  const setTriangleFillMode = useEditorSessionStore((s) => s.setTriangleFillMode);
  const setStarFillMode = useEditorSessionStore((s) => s.setStarFillMode);
  const setArrowFillMode = useEditorSessionStore((s) => s.setArrowFillMode);
  const cancelPenPath = useEditorSessionStore((s) => s.cancelPenPath);

  const shape = (['rect', 'circle', 'triangle', 'star', 'arrow'] as const).includes(activeTool as 'rect')
    ? (activeTool as 'rect' | 'circle' | 'triangle' | 'star' | 'arrow')
    : lastShape;
  const fillMode =
    shape === 'rect'
      ? rectFillMode
      : shape === 'circle'
        ? circleFillMode
        : shape === 'triangle'
          ? triangleFillMode
          : shape === 'star'
            ? starFillMode
            : arrowFillMode;

  const iconByShape = {
    rect: fillMode === 'fill' ? RectFilledIcon : RectIcon,
    circle: fillMode === 'fill' ? CircleFilledIcon : CircleIcon,
    triangle: fillMode === 'fill' ? TriangleFilledIcon : TriangleIcon,
    star: fillMode === 'fill' ? StarFilledIcon : StarIcon,
    arrow: fillMode === 'fill' ? ArrowFilledIcon : ArrowIcon,
  };

  const isShapeToolSelected =
    activeTool === 'rect' ||
    activeTool === 'circle' ||
    activeTool === 'triangle' ||
    activeTool === 'star' ||
    activeTool === 'arrow';

  return (
    <>
      <ToolButton
        ref={anchorRef}
        icon={iconByShape[shape]}
        size="md"
        selected={isShapeToolSelected}
        onPress={onShortPress}
        aria-label="Shapes"
        tooltip="Shapes"
        chevron={{
          onClick: onOpenShapeOptions,
          'aria-label': 'Shape options',
          isOpen,
        }}
      />
      <Popover
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        anchorRef={anchorRef}
        offsetX={-5}
        role="dialog"
        aria-label="Shape picker"
      >
        <ShapePicker
          activeTool={activeTool}
          fillModes={{
            rect: rectFillMode,
            circle: circleFillMode,
            triangle: triangleFillMode,
            star: starFillMode,
            arrow: arrowFillMode,
          }}
          onPick={(picked: ShapeType) => {
            if (activeTool === picked) {
              const togglers = {
                rect: () => setRectFillMode((f) => (f === 'fill' ? 'outline' : 'fill')),
                circle: () => setCircleFillMode((f) => (f === 'fill' ? 'outline' : 'fill')),
                triangle: () => setTriangleFillMode((f) => (f === 'fill' ? 'outline' : 'fill')),
                star: () => setStarFillMode((f) => (f === 'fill' ? 'outline' : 'fill')),
                arrow: () => setArrowFillMode((f) => (f === 'fill' ? 'outline' : 'fill')),
              } as const;
              togglers[picked]();
            } else {
              cancelPenPath();
              setActiveTool(picked);
              setLastShape(picked);
            }
            setIsOpen(false);
          }}
        />
      </Popover>
    </>
  );
}
