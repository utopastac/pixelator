import { KeyboardIcon } from '@/editor/icons/PixelToolIcons';
import ToolbarButton from '@/primitives/ToolbarButton';
import styles from './KeyboardShortcutsControl.module.css';

export interface KeyboardShortcutsControlProps {
  onOpenShortcuts: () => void;
}

export default function KeyboardShortcutsControl({ onOpenShortcuts }: KeyboardShortcutsControlProps) {
  return (
    <div className={styles.root}>
      <ToolbarButton
        icon={KeyboardIcon}
        size="sm"
        onClick={onOpenShortcuts}
        aria-label="Keyboard shortcuts"
        tooltip={{ content: 'Keyboard shortcuts', placement: 'right' }}
      />
    </div>
  );
}
