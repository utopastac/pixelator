import React from 'react';
import PopoverMenuItem from '@/overlays/PopoverMenuItem';
import PngScalePicker from '@/chrome/PngScalePicker';
import { SvgIcon, LayersIcon, ExportIcon } from '../icons/PixelToolIcons';
import MenuPopover from '@/primitives/MenuPopover';

export interface DownloadMenuProps {
  onDownloadSvg: () => void;
  onDownloadPng: (scale: number) => void;
  onDownloadLayersSvg: () => void;
  onDownloadPixelator?: () => void;
  width?: number;
  height?: number;
  onClose: () => void;
}

const PNG_SCALES: number[] = [1, 2, 4, 8, 16];

/**
 * Download-format popover content. Rendered inside a `Popover` whose open
 * state lives in the parent toolbar; this component only renders the menu
 * body and fires `onClose` + the chosen handler in the same
 * close-first-then-invoke order the inline version used.
 */
const DownloadMenu: React.FC<DownloadMenuProps> = ({
  onDownloadSvg,
  onDownloadPng,
  onDownloadLayersSvg,
  onDownloadPixelator,
  width,
  height,
  onClose,
}) => (
  <MenuPopover>
    <PopoverMenuItem
      icon={SvgIcon}
      label="Download SVG"
      testId="download-svg"
      onClick={() => { onClose(); onDownloadSvg(); }}
    />
    <PngScalePicker
      scales={PNG_SCALES}
      width={width}
      height={height}
      onPick={(scale) => { onClose(); onDownloadPng(scale); }}
    />
    <PopoverMenuItem
      icon={LayersIcon}
      label="Download all layers (SVG)"
      testId="download-layers-svg"
      onClick={() => { onClose(); onDownloadLayersSvg(); }}
    />
    {onDownloadPixelator && (
      <PopoverMenuItem
        icon={ExportIcon}
        label="Export Pixelator file"
        testId="download-pixelator"
        onClick={() => { onClose(); onDownloadPixelator(); }}
      />
    )}
  </MenuPopover>
);

export default DownloadMenu;
