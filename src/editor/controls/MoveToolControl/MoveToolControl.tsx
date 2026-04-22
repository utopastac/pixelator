import ToolButton from '@/editor/controls/ToolButton';
import { MoveIcon } from '@/editor/icons/PixelToolIcons';
import { useEditorSessionStore } from '@/editor/stores/useEditorSessionStore';

export interface MoveToolControlProps {
  onClosePopovers: () => void;
}

export default function MoveToolControl({ onClosePopovers }: MoveToolControlProps) {
  const activeTool = useEditorSessionStore((s) => s.activeTool);
  const setActiveTool = useEditorSessionStore((s) => s.setActiveTool);
  const cancelPenPath = useEditorSessionStore((s) => s.cancelPenPath);
  return (
    <ToolButton
      icon={MoveIcon}
      size="md"
      selected={activeTool === 'move'}
      onPress={() => {
        cancelPenPath();
        setActiveTool('move');
        onClosePopovers();
      }}
      aria-label="Move"
      tooltip="Move"
    />
  );
}
