import SwatchesPopover from '@/editor/controls/SwatchesPopover';
import { useEditorSessionStore } from '@/editor/stores/useEditorSessionStore';
import styles from './SwatchesPopoverControl.module.css';

export interface SwatchesPopoverControlProps {
  palette: string[];
  paletteId?: string;
  onPaletteChange?: (id: string) => void;
  customColors: string[];
  onAddCustomColor?: (color: string) => void;
}

export default function SwatchesPopoverControl({
  palette,
  paletteId,
  onPaletteChange,
  customColors,
  onAddCustomColor,
}: SwatchesPopoverControlProps) {
  const activeColor = useEditorSessionStore((s) => s.activeColor);
  const setActiveColor = useEditorSessionStore((s) => s.setActiveColor);
  const independentHue = useEditorSessionStore((s) => s.independentHue);
  const setIndependentHue = useEditorSessionStore((s) => s.setIndependentHue);

  return (
    <div className={styles.root}>
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
    </div>
  );
}
