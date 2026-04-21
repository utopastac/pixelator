import { BrushSmIcon, BrushMdIcon, BrushLgIcon, BrushXlIcon } from './PixelToolIcons';
import { PixelArtBrushSize } from '../lib/pixelArtUtils';

export const BRUSH_ICONS: Record<PixelArtBrushSize, React.ComponentType> = {
  sm: BrushSmIcon,
  md: BrushMdIcon,
  lg: BrushLgIcon,
  xl: BrushXlIcon,
};
