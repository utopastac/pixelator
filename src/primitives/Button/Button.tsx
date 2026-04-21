import React from 'react';
import styles from './Button.module.css';

export type ButtonSize = 'sm' | 'md';

/** Visual emphasis.
 *  - `primary` (default): filled dark, highest emphasis.
 *  - `secondary`: bordered outline on a transparent surface, lower emphasis.
 *  - `destructive`: red fill, signals irreversible action (Reset, Delete, Clear).
 *  Intentionally mutually exclusive so a single prop drives all variants. */
export type ButtonVariant = 'primary' | 'secondary' | 'destructive';

export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  /** Defaults to `sm` — matches CompactInput's height so Button fits into
   *  the same row (e.g. the canvas-size Apply button). */
  size?: ButtonSize;
  variant?: ButtonVariant;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  ref?: React.Ref<HTMLButtonElement>;
  className?: string;
  'aria-label'?: string;
  /** Stable test hook — forwarded as `data-testid` on the underlying button. */
  'data-testid'?: string;
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: styles.sm,
  md: styles.md,
};

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  destructive: styles.destructive,
};

/** Low-emphasis text button for inline actions inside popovers, dialogs,
 *  and inputs rows. Sibling of ToolbarButton (icon-only) and ReadoutButton
 *  (popover trigger with text readout). */
const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  size = 'sm',
  variant = 'primary',
  disabled,
  type = 'button',
  ref,
  className = '',
  'aria-label': ariaLabel,
  'data-testid': dataTestId,
}) => (
  <button
    ref={ref}
    type={type}
    className={[
      styles.button,
      SIZE_CLASS[size],
      VARIANT_CLASS[variant],
      className,
    ].filter(Boolean).join(' ')}
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    data-testid={dataTestId}
  >
    {children}
  </button>
);

export default Button;
