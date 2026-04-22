import ToolbarButton from '@/primitives/ToolbarButton';
import { DuplicateIcon } from '@/editor/icons/PixelToolIcons';
import styles from './DuplicateSelectionControl.module.css';

export interface DuplicateSelectionControlProps {
  onDuplicateSelection: () => void;
  /** When true, the button is inactive (e.g. no active layer to copy from). */
  disabled?: boolean;
}

/** Runs internal copy then paste — same as context menu Copy + Paste, for mobile. */
export default function DuplicateSelectionControl({
  onDuplicateSelection,
  disabled,
}: DuplicateSelectionControlProps) {
  return (
    <div className={styles.root}>
      <ToolbarButton
        icon={DuplicateIcon}
        size="sm"
        onClick={onDuplicateSelection}
        disabled={disabled}
        aria-label="Duplicate selection"
        tooltip={{ content: 'Duplicate selection', placement: 'bottom' }}
      />
    </div>
  );
}
