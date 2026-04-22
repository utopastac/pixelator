import ToolButton from '@/editor/controls/ToolButton';
import { FillIcon } from '@/editor/icons/PixelToolIcons';
import { useEditorSessionStore } from '@/editor/stores/useEditorSessionStore';

export interface FillToolControlProps {
  onClosePopovers: () => void;
}

export default function FillToolControl({ onClosePopovers }: FillToolControlProps) {
  const activeTool = useEditorSessionStore((s) => s.activeTool);
  const setActiveTool = useEditorSessionStore((s) => s.setActiveTool);
  const cancelPenPath = useEditorSessionStore((s) => s.cancelPenPath);
  return (
    <ToolButton
      icon={FillIcon}
      size="md"
      selected={activeTool === 'fill'}
      onPress={() => {
        cancelPenPath();
        setActiveTool('fill');
        onClosePopovers();
      }}
      aria-label="Fill"
      tooltip="Fill"
    />
  );
}
