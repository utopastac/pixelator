import React from 'react';
import {
  RectIcon, RectFilledIcon,
  CircleIcon, CircleFilledIcon,
  TriangleIcon, TriangleFilledIcon,
  StarIcon, StarFilledIcon,
  ArrowIcon, ArrowFilledIcon,
} from '../../icons/PixelToolIcons';
import PopoverMenuItem from '@/overlays/PopoverMenuItem';
import type { PixelArtFillMode } from '../../lib/pixelArtUtils';
import type { PixelArtTool } from '../../PixelArtEditor';
import MenuPopover from '@/primitives/MenuPopover';

export type ShapeType = 'rect' | 'circle' | 'triangle' | 'star' | 'arrow';

export interface ShapePickerProps {
  activeTool: PixelArtTool;
  fillModes: Record<ShapeType, PixelArtFillMode>;
  /** Called when the user clicks a shape row. Caller decides whether to
   *  activate the tool or toggle its fill mode based on whether it is
   *  already the active tool. */
  onPick: (shape: ShapeType) => void;
}

const SHAPES: {
  shape: ShapeType;
  label: string;
  filledIcon: React.ComponentType;
  outlineIcon: React.ComponentType;
}[] = [
  { shape: 'rect',     label: 'Rectangle', filledIcon: RectFilledIcon,     outlineIcon: RectIcon     },
  { shape: 'circle',   label: 'Circle',    filledIcon: CircleFilledIcon,   outlineIcon: CircleIcon   },
  { shape: 'triangle', label: 'Triangle',  filledIcon: TriangleFilledIcon, outlineIcon: TriangleIcon },
  { shape: 'star',     label: 'Star',      filledIcon: StarFilledIcon,     outlineIcon: StarIcon     },
  { shape: 'arrow',    label: 'Arrow',     filledIcon: ArrowFilledIcon,    outlineIcon: ArrowIcon    },
];

const ShapePicker: React.FC<ShapePickerProps> = ({ activeTool, fillModes, onPick }) => (
  <MenuPopover>
    {SHAPES.map(({ shape, label, filledIcon, outlineIcon }) => {
      const fillMode = fillModes[shape];
      return (
        <PopoverMenuItem
          key={shape}
          icon={fillMode === 'fill' ? filledIcon : outlineIcon}
          label={`${label} (${fillMode === 'fill' ? 'filled' : 'outline'})`}
          selected={activeTool === shape}
          onClick={() => onPick(shape)}
        />
      );
    })}
  </MenuPopover>
);

export default ShapePicker;
