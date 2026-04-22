import ToolButton from '@/editor/controls/ToolButton';
import { EraserIcon } from '@/editor/icons/PixelToolIcons';
import { useEditorSessionStore } from '@/editor/stores/useEditorSessionStore';

export interface EraserToolControlProps {
  onClosePopovers: () => void;
}

export default function EraserToolControl({ onClosePopovers }: EraserToolControlProps) {
  const activeTool = useEditorSessionStore((s) => s.activeTool);
  const setActiveTool = useEditorSessionStore((s) => s.setActiveTool);
  const cancelPenPath = useEditorSessionStore((s) => s.cancelPenPath);
  return (
    <ToolButton
      icon={EraserIcon}
      size="md"
      selected={activeTool === 'eraser'}
      onPress={() => {
        cancelPenPath();
        setActiveTool('eraser');
        onClosePopovers();
      }}
      aria-label="Eraser"
      tooltip="Eraser"
    />
  );
}
