import PixelArtEditor from '@/editor';
import { useAppMobile } from '@/AppMobileContext';
import { getPalette } from '@/lib/palettes';
import type { Drawing, Layer } from '@/lib/storage';
import type { Theme } from '@/hooks/useTheme';
import styles from './EditorView.module.css';

interface Props {
  drawing: Drawing;
  onChange: (layers: Layer[]) => void;
  onActiveLayerIdChange: (id: string) => void;
  onSizeChange: (width: number, height: number) => void;
  onRename: (id: string, name: string) => void;
  onPaletteChange: (id: string) => void;
  theme: Theme;
  onThemeToggle: () => void;
  drawingsPanelOpen: boolean;
  onToggleDrawingsPanel: () => void;
  /** Export the current drawing as a Pixelator JSON backup — surfaces in the
   *  toolbar's Download menu. Parent owns the envelope build. */
  onDownloadPixelator?: () => void;
  panelsVisible?: boolean;
  onTogglePanels?: () => void;
}

export default function EditorView({
  drawing,
  onChange,
  onActiveLayerIdChange,
  onSizeChange,
  onRename,
  onPaletteChange,
  theme,
  onThemeToggle,
  drawingsPanelOpen,
  onToggleDrawingsPanel,
  onDownloadPixelator,
  panelsVisible,
  onTogglePanels,
}: Props) {
  const { isMobile } = useAppMobile();
  const palette = getPalette(drawing.paletteId);
  return (
    <div className={styles.view}>
      <div className={styles.editor}>
        <PixelArtEditor
          key={drawing.id}
          isMobile={isMobile}
          width={drawing.width}
          height={drawing.height}
          value={drawing.layers}
          activeLayerId={drawing.activeLayerId}
          onActiveLayerIdChange={onActiveLayerIdChange}
          palette={palette.colors}
          paletteId={palette.id}
          onPaletteChange={onPaletteChange}
          sizes={[8, 16, 24, 32, 64]}
          onChange={onChange}
          onSizeChange={onSizeChange}
          title={drawing.name}
          onTitleChange={(name) => onRename(drawing.id, name)}
          theme={theme}
          onThemeToggle={onThemeToggle}
          drawingsPanelOpen={drawingsPanelOpen}
          onToggleDrawingsPanel={onToggleDrawingsPanel}
          onDownloadPixelator={onDownloadPixelator}
          panelsVisible={panelsVisible}
          onTogglePanels={onTogglePanels}
        />
      </div>
    </div>
  );
}
