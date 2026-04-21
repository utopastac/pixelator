import React from 'react';
import styles from './ReadoutButton.module.css';

export interface ReadoutButtonProps {
  children: React.ReactNode;
  /** Flips the button into its "popover is open" visual state. */
  active?: boolean;
  onClick?: () => void;
  ref?: React.Ref<HTMLButtonElement>;
  className?: string;
  /** Required — readout buttons may render non-text children (icons, swatches). */
  'aria-label': string;
  'aria-haspopup'?: React.AriaAttributes['aria-haspopup'];
  'aria-expanded'?: boolean;
  /** Stable test hook — forwarded as `data-testid` on the underlying button. */
  'data-testid'?: string;
}

/**
 * Popover-trigger button that displays a text or icon readout of the current
 * value. Flips into an "active" visual state while the popover it opens is
 * visible. Sibling of ToolbarButton (icon-only) and Button (text action).
 */
const ReadoutButton: React.FC<ReadoutButtonProps> = ({
  children,
  active,
  onClick,
  ref,
  className = '',
  'aria-label': ariaLabel,
  'aria-haspopup': ariaHaspopup,
  'aria-expanded': ariaExpanded,
  'data-testid': dataTestId,
}) => (
  <button
    ref={ref}
    type="button"
    className={`${styles.readout} ${active ? styles.active : ''} ${className}`}
    onClick={onClick}
    aria-label={ariaLabel}
    aria-haspopup={ariaHaspopup}
    aria-expanded={ariaExpanded}
    data-testid={dataTestId}
  >
    {children}
  </button>
);

export default ReadoutButton;
