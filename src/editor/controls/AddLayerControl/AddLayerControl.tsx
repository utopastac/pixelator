import ToolbarButton from '@/primitives/ToolbarButton';
import { PlusIcon } from '@/editor/icons/PixelToolIcons';
import styles from './AddLayerControl.module.css';

export interface AddLayerControlProps {
  onAddLayer: () => void;
}

export default function AddLayerControl({ onAddLayer }: AddLayerControlProps) {
  return (
    <div className={styles.root}>
      <ToolbarButton
        icon={PlusIcon}
        size="sm"
        onClick={() => onAddLayer()}
        aria-label="Add layer"
        tooltip={{ content: 'Add layer', placement: 'bottom' }}
        data-testid="add-layer"
      />
    </div>
  );
}
