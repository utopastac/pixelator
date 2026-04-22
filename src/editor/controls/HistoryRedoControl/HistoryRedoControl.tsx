import ToolbarButton from '@/primitives/ToolbarButton';
import { ForwardIcon } from '@/editor/icons/PixelToolIcons';
import styles from './HistoryRedoControl.module.css';

export interface HistoryRedoControlProps {
  canRedo: boolean;
  onRedo: () => void;
}

export default function HistoryRedoControl({ canRedo, onRedo }: HistoryRedoControlProps) {
  return (
    <div className={styles.root}>
      <ToolbarButton
        icon={ForwardIcon}
        size="sm"
        onClick={onRedo}
        disabled={!canRedo}
        aria-label="Redo"
        tooltip={{ content: 'Redo (Cmd+Shift+Z)', placement: 'bottom' }}
      />
    </div>
  );
}
