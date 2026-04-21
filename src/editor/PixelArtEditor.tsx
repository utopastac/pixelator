import React from 'react';
import { KeyboardIcon, FocusBIcon, FocusBOffIcon } from './icons/PixelToolIcons';
import ShortcutsDialog from '@/chrome/ShortcutsDialog';
import ConfirmDialog from '@/primitives/ConfirmDialog';
import ContextMenu from '@/overlays/ContextMenu';
import FloatingPanel from '@/primitives/FloatingPanel';
import ToolbarButton from '@/primitives/ToolbarButton';
import RecentColorsPanel from './RecentColorsPanel';
import styles from './PixelArtEditor.module.css';
import ToolsPanel from './Toolbar/ToolsPanel';
import TitlePanel from './TitlePanel';
import LayersPanel from './LayersPanel/LayersPanel';
import EditorCanvas from './EditorCanvas/EditorCanvas';
import { usePixelArtEditorState } from './hooks/usePixelArtEditorState';
import type { Layer } from '@/lib/storage';

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
  /** Extra chrome alongside the Keyboard-shortcuts button in the help pill. */
  helpUtilities?: React.ReactNode;
  /** When set, a "Export Pixelator file" entry appears in the Download menu. */
  onDownloadPixelator?: () => void;
  /** When false, all panels except the help pill are hidden (clean canvas view). */
  panelsVisible?: boolean;
  /** Called when the user clicks the toggle in the help pill. */
  onTogglePanels?: () => void;
  /** Id of the currently-selected palette. */
  paletteId?: string;
  /** Fired when the user picks a different palette from the swatches popover. */
  onPaletteChange?: (id: string) => void;
}

const PixelArtEditor: React.FC<PixelArtEditorProps> = (props) => {
  const {
    onDragOver,
    onDrop,
    hasTitlePanel,
    toolsPanelBaseProps,
    titlePanelProps,
    containerRef,
    editorCanvasProps,
    contextMenuProps,
    layersPanelProps,
    recentColorsPanelProps,
    helpUtilities,
    isShortcutsOpen,
    onOpenShortcuts,
    onCloseShortcuts,
    isResetConfirmOpen,
    onResetConfirm,
    onResetCancel,
  } = usePixelArtEditorState(props);

  const { panelsVisible = true, onTogglePanels } = props;

  return (
    <div
      className={styles.wrapper}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {panelsVisible && <ToolsPanel {...toolsPanelBaseProps} />}

      {panelsVisible && hasTitlePanel ? <TitlePanel {...titlePanelProps} /> : null}

      <EditorCanvas ref={containerRef} {...editorCanvasProps} />

      <ContextMenu {...contextMenuProps} />

      {panelsVisible && <LayersPanel {...layersPanelProps} />}

      {panelsVisible && <RecentColorsPanel {...recentColorsPanelProps} />}

      <FloatingPanel position="bottom-left" size="sm" direction="column" aria-label="Help">
        {onTogglePanels && (
          <ToolbarButton
            icon={panelsVisible ? FocusBIcon : FocusBOffIcon}
            size="sm"
            onClick={onTogglePanels}
            aria-label={panelsVisible ? 'Hide panels' : 'Show panels'}
            data-testid="toggle-panels"
            tooltip={{ content: panelsVisible ? 'Hide panels (\\)' : 'Show panels (\\)', placement: 'right' }}
          />
        )}
        <ToolbarButton
          icon={KeyboardIcon}
          size="sm"
          onClick={onOpenShortcuts}
          aria-label="Keyboard shortcuts"
          tooltip={{ content: 'Keyboard shortcuts', placement: 'right' }}
        />
        {helpUtilities}
      </FloatingPanel>

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
