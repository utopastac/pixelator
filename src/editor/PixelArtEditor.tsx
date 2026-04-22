import React from 'react';
import ShortcutsDialog from '@/chrome/ShortcutsDialog';
import ConfirmDialog from '@/primitives/ConfirmDialog';
import ContextMenu from '@/overlays/ContextMenu';
import RecentColorsPanel from './RecentColorsPanel';
import styles from './PixelArtEditor.module.css';
import EditorBars from '@/editor/EditorControls/EditorBars';
import LayersPanel from './LayersPanel/LayersPanel';
import EditorCanvas from './EditorCanvas/EditorCanvas';
import { usePixelArtEditorState } from './hooks/usePixelArtEditorState';
import { useEditorSessionStore } from '@/editor/stores/useEditorSessionStore';
import type { Layer } from '@/lib/storage';
import type { Theme } from '@/hooks/useTheme';

export type PixelArtTool = 'paint' | 'eraser' | 'fill' | 'eyedropper' | 'line' | 'rect' | 'circle' | 'triangle' | 'star' | 'arrow' | 'pen' | 'marquee' | 'move';
export type { PixelArtFillMode, PixelArtBrushSize } from './lib/pixelArtUtils';

export interface PixelArtEditorProps {
  /** Logical canvas width in pixels (number of columns) */
  width: number;
  /** Logical canvas height in pixels (number of rows) */
  height: number;
  /** Current layer stack (bottom → top). When omitted, a single empty
   *  Background layer is seeded on mount. */
  value?: Layer[];
  /** Fired with the updated layer stack on every edit. */
  onChange?: (layers: Layer[]) => void;
  /** Which layer the editor should treat as active. Defaults to `value[0].id`. */
  activeLayerId?: string;
  /** Fired when the editor changes the active layer id internally. */
  onActiveLayerIdChange?: (id: string) => void;
  /** Colour swatches shown in toolbar */
  palette?: string[];
  /** Optional list of preset square grid sizes. When provided, a picker button
   *  is rendered in the toolbar. The component manages its own size after mount
   *  when this prop is set. When omitted, `width`/`height` props are the source
   *  of truth. */
  sizes?: number[];
  /** Fired when the grid size changes via the picker. */
  onSizeChange?: (width: number, height: number) => void;
  /** Editable drawing title. When provided alongside `onTitleChange`, a
   *  top-center floating panel renders with the title + zoom controls, and
   *  zoom is removed from the top-right utilities cluster. */
  title?: string;
  /** Fired when the user commits a new title. */
  onTitleChange?: (next: string) => void;
  /** When set, a "Export Pixelator file" entry appears in the Download menu. */
  onDownloadPixelator?: () => void;
  /** When false, editor chrome is hidden; desktop still shows the bottom-left help cluster. */
  panelsVisible?: boolean;
  /** Called when the user clicks the panels visibility control in that cluster. */
  onTogglePanels?: () => void;
  /** App theme — bottom-left help cluster (desktop only). */
  theme: Theme;
  /** Toggle light / dark theme. */
  onThemeToggle: () => void;
  /** Drawings gallery open state (menu vs close icon). */
  drawingsPanelOpen: boolean;
  /** Toggle the drawings gallery panel. */
  onToggleDrawingsPanel: () => void;
  /** Id of the currently-selected palette. */
  paletteId?: string;
  /** Fired when the user picks a different palette from the swatches popover. */
  onPaletteChange?: (id: string) => void;
  /** App-driven viewport layout (`useAppMobile`); defaults false when omitted. */
  isMobile?: boolean;
}

const PixelArtEditor: React.FC<PixelArtEditorProps> = (props) => {
  const {
    onDragOver,
    onDrop,
    editorChromeData,
    containerRef,
    editorCanvasProps,
    contextMenuProps,
    layersPanelProps,
    recentColorsPanelProps,
    isShortcutsOpen,
    onCloseShortcuts,
    isResetConfirmOpen,
    onResetConfirm,
    onResetCancel,
  } = usePixelArtEditorState(props);

  const { panelsVisible = true, isMobile = false } = props;
  const layersPanelVisible = useEditorSessionStore((s) => s.layersPanelVisible);

  return (
    <div
      className={styles.wrapper}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <EditorBars isMobile={isMobile} panelsVisible={panelsVisible} chrome={editorChromeData} />

      <EditorCanvas ref={containerRef} {...editorCanvasProps} />

      <ContextMenu {...contextMenuProps} />

      {panelsVisible && layersPanelVisible && <LayersPanel {...layersPanelProps} />}

      {panelsVisible && <RecentColorsPanel {...recentColorsPanelProps} />}

      <ShortcutsDialog open={isShortcutsOpen} onClose={onCloseShortcuts} />

      <ConfirmDialog
        open={isResetConfirmOpen}
        title="Reset drawing?"
        body="All layers and pixels will be cleared. You can undo this with ⌘Z."
        confirmLabel="Reset"
        destructive
        onConfirm={onResetConfirm}
        onCancel={onResetCancel}
        testId="confirm-reset-drawing"
      />
    </div>
  );
};

export default PixelArtEditor;
