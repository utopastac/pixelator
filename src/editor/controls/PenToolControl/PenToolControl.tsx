import ToolButton from '@/editor/controls/ToolButton';
import { PenIcon } from '@/editor/icons/PixelToolIcons';
import { useEditorSessionStore } from '@/editor/stores/useEditorSessionStore';

export interface PenToolControlProps {
  onClosePopovers: () => void;
}

export default function PenToolControl({ onClosePopovers }: PenToolControlProps) {
  const activeTool = useEditorSessionStore((s) => s.activeTool);
  const setActiveTool = useEditorSessionStore((s) => s.setActiveTool);
  return (
    <ToolButton
      icon={PenIcon}
      size="md"
      selected={activeTool === 'pen'}
      onPress={() => {
        setActiveTool('pen');
        onClosePopovers();
      }}
      aria-label="Pen"
      tooltip="Pen"
    />
  );
}
