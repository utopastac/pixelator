import React from 'react';
import { ChevronSmIcon } from '@/editor/icons/PixelToolIcons';
import styles from './ToolbarChevron.module.css';

export interface ToolbarChevronProps {
  onClick: () => void;
  'aria-label': string;
  /** ARIA popup type the chevron opens. Defaults to 'dialog' — the most
   *  common case for tool-option popovers. */
  'aria-haspopup'?: 'dialog' | 'menu' | 'listbox' | 'tree' | 'grid' | boolean;
  'data-testid'?: string;
}

/**
 * Secondary-affordance chevron that sits flush against a ToolbarButton and
 * opens the same popover the button's long-press gesture would. Used across
 * the pixel-art toolbar for brush size, shape, marquee, line-thickness etc.
 */
const ToolbarChevron: React.FC<ToolbarChevronProps> = ({
  onClick,
  'aria-label': ariaLabel,
  'aria-haspopup': ariaHaspopup = 'dialog',
  'data-testid': dataTestId,
}) => {
  return (
    <button
      type="button"
      className={styles.chevron}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-haspopup={ariaHaspopup}
      data-testid={dataTestId}
    >
      <ChevronSmIcon size={12} />
    </button>
  );
};

export default ToolbarChevron;
