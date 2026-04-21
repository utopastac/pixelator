import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { CheckIcon } from '@/editor/icons/PixelToolIcons';
import styles from './PopoverMenuItem.module.css';

export interface PopoverMenuItemProps {
  /** Optional leading icon (lucide or the project's icon components). */
  icon?: LucideIcon | React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  /** Visible row label. */
  label: string;
  onClick?: () => void;
  /** When a boolean is provided, the item renders as `menuitemradio` with a
   *  leading checkmark slot (the check glyph when `true`, an empty slot
   *  reserving the same space when `false`). When `undefined`, the item renders
   *  as a plain `menuitem` with no selection indicator. */
  selected?: boolean;
  disabled?: boolean;
  /** Renders the item in a destructive (red) colour to signal irreversible
   *  actions — Reset, Delete, Clear. Mirrors ContextMenuItem's `variant` prop. */
  destructive?: boolean;
  className?: string;
  /** Stable test hook forwarded as `data-testid` on the root button. */
  testId?: string;
}

const PopoverMenuItem: React.FC<PopoverMenuItemProps> = ({
  icon: Icon,
  label,
  onClick,
  selected,
  disabled,
  destructive,
  className = '',
  testId,
}) => {
  const isRadio = selected !== undefined;
  const classes = [
    styles.item,
    destructive && styles.destructive,
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      role={isRadio ? 'menuitemradio' : 'menuitem'}
      aria-checked={isRadio ? selected : undefined}
      className={classes}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
    >
      {isRadio && (
        selected
          ? <span className={styles.check} aria-hidden="true"><CheckIcon size={14} /></span>
          : <span className={styles.slot} aria-hidden="true" />
      )}
      {Icon && (
        <span className={styles.icon} aria-hidden="true">
          <Icon size={16} />
        </span>
      )}
      <span className={styles.label}>{label}</span>
    </button>
  );
};

export default PopoverMenuItem;
