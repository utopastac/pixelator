import { CloseIcon, MenuIcon } from '@/editor/icons/PixelToolIcons';
import ToolbarButton from '@/primitives/ToolbarButton';
import styles from './DrawingsPanelToggleControl.module.css';

export interface DrawingsPanelToggleControlProps {
  drawingsPanelOpen: boolean;
  onToggleDrawingsPanel: () => void;
}

export default function DrawingsPanelToggleControl({
  drawingsPanelOpen,
  onToggleDrawingsPanel,
}: DrawingsPanelToggleControlProps) {
  const tip = drawingsPanelOpen ? 'Close drawings' : 'Open drawings';
  return (
    <div className={styles.root}>
      <ToolbarButton
        icon={drawingsPanelOpen ? CloseIcon : MenuIcon}
        size="sm"
        onClick={onToggleDrawingsPanel}
        aria-label="Drawings"
        aria-expanded={drawingsPanelOpen}
        tooltip={{ content: tip, placement: 'right' }}
        data-testid="open-drawings"
      />
    </div>
  );
}
