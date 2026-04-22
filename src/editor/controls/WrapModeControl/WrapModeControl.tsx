import ToolbarButton from '@/primitives/ToolbarButton';
import { WrapIcon } from '@/editor/icons/PixelToolIcons';
import styles from './WrapModeControl.module.css';

export interface WrapModeControlProps {
  wrapMode: boolean;
  setWrapMode: (v: boolean) => void;
}

export default function WrapModeControl({ wrapMode, setWrapMode }: WrapModeControlProps) {
  return (
    <div className={styles.root}>
      <ToolbarButton
        icon={WrapIcon}
        size="sm"
        onClick={() => setWrapMode(!wrapMode)}
        selected={wrapMode}
        aria-label="Wrap mode"
        tooltip={{ content: 'Wrap', placement: 'bottom' }}
      />
    </div>
  );
}
