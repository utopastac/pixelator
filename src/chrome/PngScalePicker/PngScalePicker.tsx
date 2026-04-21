import React from 'react';
import { PngIcon } from '@/editor/icons/PixelToolIcons';
import styles from './PngScalePicker.module.css';

export interface PngScalePickerProps {
  /** Scales offered as chips (e.g. `[1, 2, 4, 8, 16]`). */
  scales?: number[];
  /** Current canvas dimensions — used to show output size on each chip. */
  width?: number;
  height?: number;
  /** Fired when the user clicks a scale chip. */
  onPick: (scale: number) => void;
}

const DEFAULT_SCALES = [1, 2, 4, 8, 16];

/**
 * A menu-row that reads "PNG · [1×][2×][4×][8×][16×]". Designed to slot into
 * a Popover/ContextMenu alongside a normal "Download SVG" item. Each chip is
 * an independent button that fires `onPick(scale)`.
 */
const PngScalePicker: React.FC<PngScalePickerProps> = ({
  scales = DEFAULT_SCALES,
  width,
  height,
  onPick,
}) => {
  return (
    <div className={styles.row}>
      <span className={styles.icon} aria-hidden="true"><PngIcon size={16} /></span>
      <span className={styles.label}>PNG</span>
      <div className={styles.chipGroup} role="group" aria-label="PNG export scale">
        {scales.map((scale) => {
          const dims = (width && height)
            ? `${width * scale} × ${height * scale} px`
            : undefined;
          return (
            <button
              key={scale}
              type="button"
              className={styles.chip}
              onClick={() => onPick(scale)}
              aria-label={dims ? `Download PNG at ${scale}× (${dims})` : `Download PNG at ${scale}×`}
              title={dims}
              data-testid={`png-scale-${scale}`}
            >
              {scale}×
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PngScalePicker;
