import ToolButton from '@/editor/controls/ToolButton';
import { LineIcon } from '@/editor/icons/PixelToolIcons';
import { useEditorSessionStore } from '@/editor/stores/useEditorSessionStore';

export interface LineToolControlProps {
  onClosePopovers: () => void;
}

export default function LineToolControl({ onClosePopovers }: LineToolControlProps) {
  const activeTool = useEditorSessionStore((s) => s.activeTool);
  const setActiveTool = useEditorSessionStore((s) => s.setActiveTool);
  const cancelPenPath = useEditorSessionStore((s) => s.cancelPenPath);
  return (
    <ToolButton
      icon={LineIcon}
      size="md"
      selected={activeTool === 'line'}
      onPress={() => {
        cancelPenPath();
        setActiveTool('line');
        onClosePopovers();
      }}
      aria-label="Line"
      tooltip="Line"
    />
  );
}
