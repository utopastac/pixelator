import React from 'react';
import { BRUSH_ICONS } from '../../icons/PixelArtIcons';
import PopoverMenuItem from '@/overlays/PopoverMenuItem';
import type { PixelArtBrushSize } from '../../lib/pixelArtUtils';
import MenuPopover from '@/primitives/MenuPopover';

export interface BrushSizePickerProps {
  brushSize: PixelArtBrushSize;
  onPick: (size: PixelArtBrushSize) => void;
}

const SIZES: { size: PixelArtBrushSize; label: string }[] = [
  { size: 'sm', label: 'Small' },
  { size: 'md', label: 'Medium' },
  { size: 'lg', label: 'Large' },
  { size: 'xl', label: 'Extra Large' },
];

const BrushSizePicker: React.FC<BrushSizePickerProps> = ({ brushSize, onPick }) => (
  <MenuPopover>
    {SIZES.map(({ size, label }) => (
      <PopoverMenuItem
        key={size}
        icon={BRUSH_ICONS[size]}
        label={label}
        selected={brushSize === size}
        onClick={() => onPick(size)}
      />
    ))}
  </MenuPopover>
);

export default BrushSizePicker;
