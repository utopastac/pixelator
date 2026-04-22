import ToolbarButton from '@/primitives/ToolbarButton';
import { GridIcon } from '@/editor/icons/PixelToolIcons';
import styles from './GridOverlayControl.module.css';

export interface GridOverlayControlProps {
  gridOverlayVisible: boolean;
  setGridOverlayVisible: (v: boolean) => void;
}

/** Toggles the pixel grid overlay (shown at zoom ≥ 4× when enabled). */
export default function GridOverlayControl({
  gridOverlayVisible,
  setGridOverlayVisible,
}: GridOverlayControlProps) {
  return (
    <div className={styles.root}>
      <ToolbarButton
        icon={GridIcon}
        size="sm"
        onClick={() => setGridOverlayVisible(!gridOverlayVisible)}
        selected={gridOverlayVisible}
        aria-label="Grid overlay"
        tooltip={{ content: 'Grid overlay (zoom 4×+)', placement: 'bottom' }}
      />
    </div>
  );
}
