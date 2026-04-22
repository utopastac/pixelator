import React from 'react';
import ColorSwatch from '@/primitives/ColorSwatch';
import styles from './RecentColorsPanel.module.css';

export interface RecentColorsPanelProps {
  recents: string[];
  activeColor: string;
  onPick: (color: string) => void;
  /** When true, adds a mobile hook class on the root for CSS overrides. */
  mobile?: boolean;
}

const PINNED = ['#000000', '#ffffff'];

/**
 * Left-center floating column of recently-used colours plus always-available
 * black and white swatches pinned at the bottom behind a divider.
 *
 * Positioned ABSOLUTELY inside the editor's `.main` area (not viewport-fixed)
 * so it moves with the editor when the DrawingsPanel pushes it right.
 */
const RecentColorsPanel: React.FC<RecentColorsPanelProps> = ({
  recents,
  activeColor,
  onPick,
  mobile = false,
}) => {
  const active = activeColor.toLowerCase();
  const displayed = recents.filter((c) => !PINNED.includes(c.toLowerCase()));

  const rootClass = [styles.panel, mobile && styles.mobile].filter(Boolean).join(' ');

  return (
    <div className={rootClass} aria-label="Recent colors">
      {displayed.length > 0 && (
        <>
          <div className={styles.stack}>
            {displayed.map((color) => (
              <ColorSwatch
                key={color}
                color={color}
                size="sm"
                shape="pill"
                selected={color === active}
                onClick={() => onPick(color)}
                aria-label={`Use recent color ${color}`}
                title={color}
              />
            ))}
          </div>
          <div className={styles.divider} role="separator" />
        </>
      )}
      <div className={styles.stack}>
        <ColorSwatch
          color="#000000"
          size="sm"
          shape="pill"
          selected={active === '#000000'}
          onClick={() => onPick('#000000')}
          aria-label="Black"
          title="#000000"
        />
        <ColorSwatch
          color="#ffffff"
          size="sm"
          shape="pill"
          selected={active === '#ffffff'}
          onClick={() => onPick('#ffffff')}
          aria-label="White"
          title="#ffffff"
        />
      </div>
    </div>
  );
};

export default RecentColorsPanel;
