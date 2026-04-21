import React, { forwardRef } from 'react';
import { CornerIcon } from '../../icons/PixelToolIcons';
import { useLongPress } from '../../hooks/useLongPress';
import Tooltip, { type TooltipProps } from '@/overlays/Tooltip';
import styles from './ToolButton.module.css';

type TooltipConfig = string | Omit<TooltipProps, 'children'>;

interface ChevronConfig {
  onClick: () => void;
  'aria-label': string;
  'aria-haspopup'?: 'dialog' | 'menu' | 'listbox' | 'tree' | 'grid' | boolean;
  isOpen?: boolean;
}

export interface ToolButtonProps {
  icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  'aria-label': string;
  selected?: boolean;
  size?: 'sm' | 'md';
  onPress: () => void;
  /** When provided, long-pressing the main button fires chevron.onClick. */
  chevron?: ChevronConfig;
  /** Show the corner triangle indicator. Defaults to true when chevron is set. */
  hasOptions?: boolean;
  'aria-haspopup'?: 'menu' | 'dialog' | 'listbox' | boolean;
  'aria-expanded'?: boolean;
  tooltip?: TooltipConfig;
}

const ToolButton = forwardRef<HTMLDivElement, ToolButtonProps>(({
  icon: Icon,
  'aria-label': ariaLabel,
  selected,
  size = 'md',
  onPress,
  chevron,
  hasOptions,
  'aria-haspopup': ariaHaspopup,
  'aria-expanded': ariaExpanded,
  tooltip,
}, ref) => {
  const iconSize = size === 'sm' ? 16 : 18;

  const longPress = useLongPress(
    onPress,
    chevron ? chevron.onClick : onPress,
  );

  const tooltipProps = typeof tooltip === 'string' ? { content: tooltip } : tooltip;

  const button = (
    <div
      ref={ref}
      className={`${styles.toolButton} ${selected ? styles.selected : ''}`}
    >
      <button
        type="button"
        className={`${styles.main} ${styles[size]}`}
        aria-label={ariaLabel}
        aria-haspopup={ariaHaspopup}
        aria-expanded={ariaExpanded}
        {...(chevron ? longPress : { onClick: onPress })}
      >
        <Icon size={iconSize} aria-hidden />
      </button>
      {(hasOptions ?? !!chevron) && <span className={styles.cornerIndicator}><CornerIcon size={4} aria-hidden /></span>}
    </div>
  );

  if (!tooltipProps) return button;
  return <Tooltip {...tooltipProps}>{button}</Tooltip>;
});

ToolButton.displayName = 'ToolButton';

export default ToolButton;
