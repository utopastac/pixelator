import ToolbarButton from '@/primitives/ToolbarButton';
import { PaintInsideIcon } from '@/editor/icons/PixelToolIcons';
import styles from './AlphaLockControl.module.css';

export interface AlphaLockControlProps {
  alphaLock: boolean;
  setAlphaLock: (v: boolean) => void;
}

export default function AlphaLockControl({ alphaLock, setAlphaLock }: AlphaLockControlProps) {
  return (
    <div className={styles.root}>
      <ToolbarButton
        icon={PaintInsideIcon}
        size="sm"
        onClick={() => setAlphaLock(!alphaLock)}
        selected={alphaLock}
        aria-label="Alpha lock"
        tooltip={{ content: 'Paint inside', placement: 'bottom' }}
      />
    </div>
  );
}
