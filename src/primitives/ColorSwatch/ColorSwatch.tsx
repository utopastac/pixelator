import React from 'react';
import styles from './ColorSwatch.module.css';

export type ColorSwatchSize = 'xs' | 'sm' | 'md';
export type ColorSwatchShape = 'rounded' | 'pill';

export interface ColorSwatchProps {
  /** Hex colour rendered as the fill. */
  color: string;
  /** Adds the blue active-ring outline when the swatch matches the current selection. */
  selected?: boolean;
  /** Size token. `xs` = 20px grid swatch, `sm` = icon-xs (24px), `md` = icon-md (35px). */
  size?: ColorSwatchSize;
  /** Corner shape. */
  shape?: ColorSwatchShape;
  /** When true, renders a thick surface-coloured border so the coloured dot
   *  reads as a bead inside a pill — used for the primary colour trigger in
   *  the tools pill. */
  ring?: boolean;
  onClick?: () => void;
  /** Required — swatches render only a coloured box, no visible label. */
  'aria-label': string;
  'aria-haspopup'?: React.ButtonHTMLAttributes<HTMLButtonElement>['aria-haspopup'];
  'aria-expanded'?: boolean;
  title?: string;
  className?: string;
  'data-testid'?: string;
}

const SIZE_CLASS: Record<ColorSwatchSize, string> = {
  xs: styles.sizeXs,
  sm: styles.sizeSm,
  md: styles.sizeMd,
};

const SHAPE_CLASS: Record<ColorSwatchShape, string> = {
  rounded: styles.shapeRounded,
  pill: styles.shapePill,
};

/**
 * A colour swatch button — the single visual primitive used for palette
 * entries, recent-colour shortcuts, and the active-colour trigger. Size and
 * shape are orthogonal; `ring` adds a thick surface-coloured frame for the
 * trigger variant.
 */
const ColorSwatch = React.forwardRef<HTMLButtonElement, ColorSwatchProps>(function ColorSwatch(
  {
    color,
    selected = false,
    size = 'xs',
    shape = 'rounded',
    ring = false,
    onClick,
    title,
    className = '',
    'aria-label': ariaLabel,
    'aria-haspopup': ariaHaspopup,
    'aria-expanded': ariaExpanded,
    'data-testid': dataTestId,
  },
  ref,
) {
  const classes = [
    styles.swatch,
    SIZE_CLASS[size],
    SHAPE_CLASS[shape],
    ring ? styles.ring : '',
    selected ? styles.selected : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type="button"
      className={classes}
      style={{ backgroundColor: color }}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-haspopup={ariaHaspopup}
      aria-expanded={ariaExpanded}
      title={title}
      data-testid={dataTestId}
    />
  );
});

export default ColorSwatch;
