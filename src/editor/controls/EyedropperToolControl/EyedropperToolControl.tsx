import ToolButton from '@/editor/controls/ToolButton';
import { EyedropperIcon } from '@/editor/icons/PixelToolIcons';
import { useEditorSessionStore } from '@/editor/stores/useEditorSessionStore';

export interface EyedropperToolControlProps {
  onClosePopovers: () => void;
}

export default function EyedropperToolControl({ onClosePopovers }: EyedropperToolControlProps) {
  const activeTool = useEditorSessionStore((s) => s.activeTool);
  const setActiveTool = useEditorSessionStore((s) => s.setActiveTool);
  const cancelPenPath = useEditorSessionStore((s) => s.cancelPenPath);
  return (
    <ToolButton
      icon={EyedropperIcon}
      size="md"
      selected={activeTool === 'eyedropper'}
      onPress={() => {
        cancelPenPath();
        setActiveTool('eyedropper');
        onClosePopovers();
      }}
      aria-label="Eyedropper"
      tooltip="Eyedropper"
    />
  );
}
