import { LayersIcon } from '@/editor/icons/PixelToolIcons';
import ToolbarButton from '@/primitives/ToolbarButton';
import { useEditorSessionStore } from '@/editor/stores/useEditorSessionStore';
import styles from './LayersPanelToggleControl.module.css';

/** Toggles the right-side layers stack (independent of the global panels shortcut). */
export default function LayersPanelToggleControl() {
  const layersPanelVisible = useEditorSessionStore((s) => s.layersPanelVisible);
  const setLayersPanelVisible = useEditorSessionStore((s) => s.setLayersPanelVisible);

  const label = layersPanelVisible ? 'Hide layers panel' : 'Show layers panel';
  return (
    <div className={styles.root}>
      <ToolbarButton
        icon={LayersIcon}
        size="sm"
        selected={layersPanelVisible}
        onClick={() => setLayersPanelVisible(!layersPanelVisible)}
        aria-label={label}
        tooltip={{ content: label, placement: 'bottom' }}
        data-testid="toggle-layers-panel"
      />
    </div>
  );
}
