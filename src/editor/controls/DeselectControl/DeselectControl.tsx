import ToolbarButton from '@/primitives/ToolbarButton';
import { CloseIcon } from '@/editor/icons/PixelToolIcons';
import styles from './DeselectControl.module.css';

export interface DeselectControlProps {
  onDeselect: () => void;
}

/** Clears the active marquee / polygon selection (same as ⌘D / Escape on marquee). */
export default function DeselectControl({ onDeselect }: DeselectControlProps) {
  return (
    <div className={styles.root}>
      <ToolbarButton
        icon={CloseIcon}
        size="sm"
        onClick={onDeselect}
        aria-label="Deselect"
        tooltip={{ content: 'Deselect', placement: 'bottom' }}
      />
    </div>
  );
}
