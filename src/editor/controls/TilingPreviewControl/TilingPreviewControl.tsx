import ToolbarButton from '@/primitives/ToolbarButton';
import { TilingIcon } from '@/editor/icons/PixelToolIcons';
import styles from './TilingPreviewControl.module.css';

export interface TilingPreviewControlProps {
  tilingEnabled: boolean;
  setTilingEnabled: (v: boolean) => void;
}

/** Tiling preview toggle (title bar). Parent omits this control by not rendering it. */
export default function TilingPreviewControl({ tilingEnabled, setTilingEnabled }: TilingPreviewControlProps) {
  return (
    <div className={styles.root}>
      <ToolbarButton
        icon={TilingIcon}
        size="sm"
        onClick={() => setTilingEnabled(!tilingEnabled)}
        selected={tilingEnabled}
        aria-label="Tiling preview"
        tooltip={{ content: 'Tiling preview', placement: 'bottom' }}
      />
    </div>
  );
}
