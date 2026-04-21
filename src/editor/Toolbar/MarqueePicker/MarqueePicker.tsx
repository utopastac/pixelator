import React from 'react';
import { RectMarqueeIcon, CircleMarqueeIcon, MagicWandIcon, PolygonSelectIcon } from '../../icons/PixelToolIcons';
import PopoverMenuItem from '@/overlays/PopoverMenuItem';
import MenuPopover from '@/primitives/MenuPopover';

export interface MarqueePickerProps {
  marqueeShape: 'rect' | 'ellipse' | 'wand' | 'polygon';
  onPick: (shape: 'rect' | 'ellipse' | 'wand' | 'polygon') => void;
}

const MarqueePicker: React.FC<MarqueePickerProps> = ({ marqueeShape, onPick }) => (
  <MenuPopover>
    <PopoverMenuItem
      icon={RectMarqueeIcon}
      label="Rectangular"
      selected={marqueeShape === 'rect'}
      onClick={() => onPick('rect')}
    />
    <PopoverMenuItem
      icon={CircleMarqueeIcon}
      label="Elliptical"
      selected={marqueeShape === 'ellipse'}
      onClick={() => onPick('ellipse')}
    />
    <PopoverMenuItem
      icon={MagicWandIcon}
      label="Magic wand"
      selected={marqueeShape === 'wand'}
      onClick={() => onPick('wand')}
    />
    <PopoverMenuItem
      icon={PolygonSelectIcon}
      label="Polygon"
      selected={marqueeShape === 'polygon'}
      onClick={() => onPick('polygon')}
    />
  </MenuPopover>
);

export default MarqueePicker;
