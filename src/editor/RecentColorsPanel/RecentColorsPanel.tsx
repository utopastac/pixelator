import React from 'react';
import ColorSwatch from '@/primitives/ColorSwatch';
import styles from './RecentColorsPanel.module.css';

export interface RecentColorsPanelProps {
  recents: string[];
  activeColor: string;
  onPick: (color: string) => void;
  /** When true, adds a mobile hook class on the root for CSS overrides. */
  mobile?: boolean;
  /**
   * Mobile: distance (px) from the bottom of the editor area to the bottom
   * edge of this panel — set to the measured height of the bottom `EditorBars`
   * stack so the strip sits flush above the toolbars.
   */
  mobileBottomToolbarOffsetPx?: number;
}

const PINNED = ['#000000', '#ffffff'];

/**
 * Desktop: left-center floating column of recents + divider + pinned B/W.
 * Mobile: bottom horizontal pill; `bottom` is set from the measured height of
 * the bottom tool stack (`mobileBottomToolbarOffsetPx`) so it stays flush
 * above the toolbars.
 *
 * Desktop: absolutely positioned inside the editor wrapper so it moves with
 * the canvas when the DrawingsPanel shifts `--chrome-inset`. Mobile: fixed to
 * the viewport (same as `FloatingPanel` toolbars) so `bottom` + measured
 * toolbar height stays aligned on iOS.
 */
const RecentColorsPanel: React.FC<RecentColorsPanelProps> = ({
  recents,
  activeColor,
  onPick,
  mobile = false,
  mobileBottomToolbarOffsetPx,
}) => {
  const active = activeColor.toLowerCase();
  const displayed = recents.filter((c) => !PINNED.includes(c.toLowerCase()));

  const rootClass = [styles.panel, mobile && styles.mobile].filter(Boolean).join(' ');

  const mobileLayoutStyle: React.CSSProperties | undefined =
    mobile && mobileBottomToolbarOffsetPx !== undefined
      ? { bottom: `${mobileBottomToolbarOffsetPx}px` }
      : undefined;

  const recentSwatches = displayed.map((color) => (
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
  ));

  const pinnedSwatches = (
    <>
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
    </>
  );

  return (
    <div className={rootClass} style={mobileLayoutStyle} aria-label="Recent colors">
      {displayed.length > 0 && (
        <>
          {mobile ? (
            <div className={styles.recentsScroll}>
              <div className={`${styles.stack} ${styles.row}`}>{recentSwatches}</div>
            </div>
          ) : (
            <div className={styles.stack}>{recentSwatches}</div>
          )}
          <div className={styles.divider} role="separator" />
        </>
      )}
      <div className={`${styles.stack} ${mobile ? styles.row : ''}`}>{pinnedSwatches}</div>
    </div>
  );
};

export default RecentColorsPanel;
