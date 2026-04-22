import React, { forwardRef } from 'react';
import styles from './FloatingPanel.module.css';

export type FloatingPanelPosition =
  | 'bottom-center'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-center'
  | 'top-right'
  | 'top-left'
  | 'right-center'
  | 'left-center';

export type FloatingPanelSize = 'sm' | 'md';

export type FloatingPanelDirection = 'row' | 'column';

export interface FloatingPanelProps {
  children: React.ReactNode;
  position?: FloatingPanelPosition;
  /** Controls inner padding and gap. `md` (default) fits md-sized controls;
   *  `sm` gives a tighter pill for rows of sm-sized controls. */
  size?: FloatingPanelSize;
  /** Lay children out horizontally (default — pill shape) or stacked
   *  vertically (column — for side-of-viewport toolboxes). */
  direction?: FloatingPanelDirection;
  className?: string;
  style?: React.CSSProperties;
  role?: string;
  'aria-label'?: string;
  /** When true, adds `styles.mobile` on the root for layout-specific overrides. */
  mobile?: boolean;
}

const POSITION_CLASS: Record<FloatingPanelPosition, string> = {
  'bottom-center': styles.bottomCenter,
  'bottom-right': styles.bottomRight,
  'bottom-left': styles.bottomLeft,
  'top-center': styles.topCenter,
  'top-right': styles.topRight,
  'top-left': styles.topLeft,
  'right-center': styles.rightCenter,
  'left-center': styles.leftCenter,
};

const SIZE_CLASS: Record<FloatingPanelSize, string> = {
  sm: styles.sm,
  md: styles.md,
};

const DIRECTION_CLASS: Record<FloatingPanelDirection, string> = {
  row: styles.row,
  column: styles.column,
};

/**
 * Fixed-positioned panel for floating toolbars and utility clusters. Supports
 * `ref` for layout measurement (e.g. offsetting the recent-colors strip on mobile).
 */
const FloatingPanel = forwardRef<HTMLDivElement, FloatingPanelProps>(function FloatingPanel(
  {
    children,
    position = 'bottom-center',
    size = 'md',
    direction = 'row',
    className = '',
    style,
    role,
    'aria-label': ariaLabel,
    mobile = false,
  },
  ref,
) {
  const rootClass = [
    styles.panel,
    mobile && styles.mobile,
    POSITION_CLASS[position],
    SIZE_CLASS[size],
    DIRECTION_CLASS[direction],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={ref}
      className={rootClass}
      style={style}
      role={role}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
});

export default FloatingPanel;
