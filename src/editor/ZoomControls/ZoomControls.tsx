import React, { useRef, useState } from 'react';
import { PlusIcon, MinusIcon } from '../icons/PixelToolIcons';
import ToolbarButton from '@/primitives/ToolbarButton';
import Popover from '@/overlays/Popover';
import ReadoutButton from '@/primitives/ReadoutButton';
import Tooltip from '@/overlays/Tooltip';
import MenuPopover from '@/primitives/MenuPopover';
import PopoverMenuItem from '@/overlays/PopoverMenuItem';
import styles from './ZoomControls.module.css';
import type { UseViewportReturn } from '../hooks/useViewport';

export interface ZoomControlsProps {
  viewport: Pick<UseViewportReturn, 'zoom' | 'setZoom' | 'fit' | 'isAutoFit'>;
}

const PRESETS: number[] = [1, 2, 4, 8, 16];
const MIN_ZOOM = 1;
const MAX_ZOOM = 64;

/**
 * Photoshop-style zoom controls: minus, current-percentage picker, plus.
 * Fit is available inside the percentage popover. Drives a `useViewport`
 * instance via the props bag.
 */
const ZoomControls: React.FC<ZoomControlsProps> = ({ viewport }) => {
  const { zoom, setZoom, fit, isAutoFit } = viewport;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const percentAnchorRef = useRef<HTMLButtonElement>(null);

  const zoomOut = () => setZoom(Math.max(MIN_ZOOM, zoom / 2));
  const zoomIn = () => setZoom(Math.min(MAX_ZOOM, zoom * 2));
  const percentText = `${Math.round(zoom * 100)}%`;

  return (
    <div className={styles.wrapper} role="group" aria-label="Zoom controls">
      <ToolbarButton
        icon={MinusIcon}
        size="sm"
        onClick={zoomOut}
        disabled={zoom <= MIN_ZOOM}
        aria-label="Zoom out"
        tooltip={{ content: 'Zoom out (Cmd+-)', placement: 'bottom' }}
      />
      <Tooltip content="Zoom level" placement="bottom" delay={400}>
        <ReadoutButton
          ref={percentAnchorRef}
          active={isMenuOpen}
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-label={`Zoom: ${percentText}`}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
        >
          {percentText}
        </ReadoutButton>
      </Tooltip>
      <Popover
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        anchorRef={percentAnchorRef}
        offsetX={-5}
        role="menu"
        aria-label="Zoom presets"
      >
        <MenuPopover>
          {PRESETS.map((z) => (
            <PopoverMenuItem
              key={z}
              label={`${z * 100}%`}
              selected={!isAutoFit && Math.abs(zoom - z) < 0.001}
              onClick={() => { setZoom(z); setIsMenuOpen(false); }}
            />
          ))}
          <PopoverMenuItem
            label="Fit"
            selected={isAutoFit}
            onClick={() => { fit(); setIsMenuOpen(false); }}
          />
        </MenuPopover>
      </Popover>
      <ToolbarButton
        icon={PlusIcon}
        size="sm"
        onClick={zoomIn}
        disabled={zoom >= MAX_ZOOM}
        aria-label="Zoom in"
        tooltip={{ content: 'Zoom in (Cmd+=)', placement: 'bottom' }}
      />
    </div>
  );
};

export default ZoomControls;
