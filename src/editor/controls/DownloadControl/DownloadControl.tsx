import { useRef, useState } from 'react';
import ToolbarButton from '@/primitives/ToolbarButton';
import Popover from '@/overlays/Popover';
import DownloadMenu from '@/editor/DownloadMenu';
import { DownloadIcon } from '@/editor/icons/PixelToolIcons';
import styles from './DownloadControl.module.css';

export interface DownloadControlProps {
  onDownloadSvg: () => void;
  onDownloadPng: (scale: number) => void;
  onDownloadLayersSvg: () => void;
  onDownloadPixelator?: () => void;
  width?: number;
  height?: number;
  /** @default "download-menu" */
  menuTestId?: string;
}

export default function DownloadControl({
  onDownloadSvg,
  onDownloadPng,
  onDownloadLayersSvg,
  onDownloadPixelator,
  width,
  height,
  menuTestId = 'download-menu',
}: DownloadControlProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div ref={anchorRef} className={styles.root}>
      <ToolbarButton
        icon={DownloadIcon}
        size="sm"
        selected={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Download"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        tooltip={{ content: 'Download', placement: 'bottom' }}
        data-testid={menuTestId}
      />
      <Popover
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        anchorRef={anchorRef}
        offsetX={-5}
        role="menu"
        aria-label="Download format"
      >
        <DownloadMenu
          onDownloadSvg={onDownloadSvg}
          onDownloadPng={onDownloadPng}
          onDownloadLayersSvg={onDownloadLayersSvg}
          onDownloadPixelator={onDownloadPixelator}
          width={width}
          height={height}
          onClose={() => setIsOpen(false)}
        />
      </Popover>
    </div>
  );
}
