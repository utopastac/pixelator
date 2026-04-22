import FillToolControl from '@/editor/controls/FillToolControl';
import EyedropperToolControl from '@/editor/controls/EyedropperToolControl';
import SwatchesPopover from '@/editor/controls/SwatchesPopover';
import { useEditorSessionStore } from '@/editor/stores/useEditorSessionStore';

export interface ColorControlsProps {
  palette: string[];
  paletteId?: string;
  onPaletteChange?: (id: string) => void;
  customColors: string[];
  onAddCustomColor?: (color: string) => void;
  onClosePopovers: () => void;
}

export default function ColorControls({
  palette,
  paletteId,
  onPaletteChange,
  customColors,
  onAddCustomColor,
  onClosePopovers,
}: ColorControlsProps) {
  const activeColor = useEditorSessionStore((s) => s.activeColor);
  const setActiveColor = useEditorSessionStore((s) => s.setActiveColor);
  const independentHue = useEditorSessionStore((s) => s.independentHue);
  const setIndependentHue = useEditorSessionStore((s) => s.setIndependentHue);

  return (
    <>
      <FillToolControl onClosePopovers={onClosePopovers} />
      <EyedropperToolControl onClosePopovers={onClosePopovers} />
      <SwatchesPopover
        activeColor={activeColor}
        setActiveColor={setActiveColor}
        palette={palette}
        paletteId={paletteId}
        onPaletteChange={onPaletteChange}
        customColors={customColors}
        onAddCustomColor={onAddCustomColor}
        independentHue={independentHue}
        setIndependentHue={setIndependentHue}
      />
    </>
  );
}
