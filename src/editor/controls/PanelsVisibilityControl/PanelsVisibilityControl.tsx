import { FocusBIcon, FocusBOffIcon } from '@/editor/icons/PixelToolIcons';
import ToolbarButton from '@/primitives/ToolbarButton';
import styles from './PanelsVisibilityControl.module.css';

export interface PanelsVisibilityControlProps {
  panelsVisible: boolean;
  onTogglePanels: () => void;
}

export default function PanelsVisibilityControl({ panelsVisible, onTogglePanels }: PanelsVisibilityControlProps) {
  return (
    <div className={styles.root}>
      <ToolbarButton
        icon={panelsVisible ? FocusBIcon : FocusBOffIcon}
        size="sm"
        onClick={onTogglePanels}
        aria-label={panelsVisible ? 'Hide panels' : 'Show panels'}
        data-testid="toggle-panels"
        tooltip={{ content: panelsVisible ? 'Hide panels (\\)' : 'Show panels (\\)', placement: 'right' }}
      />
    </div>
  );
}
