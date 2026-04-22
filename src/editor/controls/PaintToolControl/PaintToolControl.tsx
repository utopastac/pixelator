import ToolButton from '@/editor/controls/ToolButton';
import { PencilIcon } from '@/editor/icons/PixelToolIcons';
import { useEditorSessionStore } from '@/editor/stores/useEditorSessionStore';

export interface PaintToolControlProps {
  onClosePopovers: () => void;
}

export default function PaintToolControl({ onClosePopovers }: PaintToolControlProps) {
  const activeTool = useEditorSessionStore((s) => s.activeTool);
  const setActiveTool = useEditorSessionStore((s) => s.setActiveTool);
  const cancelPenPath = useEditorSessionStore((s) => s.cancelPenPath);
  return (
    <ToolButton
      icon={PencilIcon}
      size="md"
      selected={activeTool === 'paint'}
      onPress={() => {
        cancelPenPath();
        setActiveTool('paint');
        onClosePopovers();
      }}
      aria-label="Paint"
      tooltip="Paint"
    />
  );
}
