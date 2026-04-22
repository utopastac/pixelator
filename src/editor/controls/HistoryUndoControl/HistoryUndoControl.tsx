import ToolbarButton from '@/primitives/ToolbarButton';
import { BackIcon } from '@/editor/icons/PixelToolIcons';
import styles from './HistoryUndoControl.module.css';

export interface HistoryUndoControlProps {
  canUndo: boolean;
  onUndo: () => void;
}

export default function HistoryUndoControl({ canUndo, onUndo }: HistoryUndoControlProps) {
  return (
    <div className={styles.root}>
      <ToolbarButton
        icon={BackIcon}
        size="sm"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo"
        tooltip={{ content: 'Undo (Cmd+Z)', placement: 'bottom' }}
      />
    </div>
  );
}
