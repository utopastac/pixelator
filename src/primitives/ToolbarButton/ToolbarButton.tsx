import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { useAppMobileOptional } from '@/AppMobileContext';
import styles from './ToolbarButton.module.css';
import { toolbarIconPixel } from './toolbarButtonTokens';
import { resolveSize, SizeSmMd } from '@/utils/resolveSize';
import Tooltip, { TooltipProps } from '@/overlays/Tooltip';

type TooltipConfig = string | Omit<TooltipProps, 'children'>;

interface ToolbarButtonProps {
  icon: LucideIcon | React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
  onClick?: () => void;
  size?: SizeSmMd;
  pressed?: boolean;
  inUse?: boolean;
  selected?: boolean;
  /** Required — icon-only buttons have no visible text label. */
  'aria-label': string;
  /** For disclosure toggles (e.g. drawings panel). */
  'aria-expanded'?: boolean;
  title?: string;
  tooltip?: TooltipConfig;
  className?: string;
  disabled?: boolean;
  /** When true, the button stretches to fill its parent's height (aspect-ratio 1:1). */
  fillHeight?: boolean;
  /** Arbitrary data-* attributes to forward onto the underlying button — lets callers attach stable test hooks. */
  [key: `data-${string}`]: string | number | boolean | undefined;
}

/**
 * Icon-only toolbar button with optional tooltip, toggle state (`pressed`),
 * activity indicator (`inUse`), and selection highlight (`selected`). Wraps
 * itself in a `Tooltip` when the `tooltip` prop is provided.
 */
const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon: Icon,
  onClick,
  size = 'md',
  pressed,
  inUse,
  selected,
  'aria-label': ariaLabel,
  'aria-expanded': ariaExpanded,
  title,
  tooltip,
  className = '',
  disabled,
  ...rest
}) => {
  const resolvedSize = resolveSize(size, 'md');
  const isMobile = useAppMobileOptional()?.isMobile ?? false;
  const iconPx = toolbarIconPixel(size, isMobile);
  const isToggle = pressed !== undefined;

  // Only forward data-* attrs from the rest props — nothing else should slip through.
  const dataAttrs = Object.fromEntries(
    Object.entries(rest).filter(([k]) => k.startsWith('data-')),
  );

  const button = (
    <button
      type="button"
      className={`${styles.toolbarButton} ${styles[resolvedSize]} ${pressed ? styles.pressed : ''} ${inUse ? styles.inUse : ''} ${selected ? styles.selected : ''} ${className}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-pressed={isToggle ? pressed : undefined}
      title={title}
      {...dataAttrs}
    >
      <span className={styles.iconWrap} aria-hidden>
        <Icon size={iconPx} aria-hidden />
      </span>
    </button>
  );

  if (!tooltip) return button;
  const tooltipProps = typeof tooltip === 'string' ? { content: tooltip } : tooltip;
  return <Tooltip {...tooltipProps}>{button}</Tooltip>;
};

export default ToolbarButton;
