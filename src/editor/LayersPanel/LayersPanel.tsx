import React, { useState } from 'react';
import { DownloadIcon as LucideDownloadIcon } from 'lucide-react';
import {
  EraserIcon,
  DuplicateIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  RotateCWIcon,
  RotateCCWIcon,
  MergeDownIcon,
  ChevronSmIcon,
} from '../icons/PixelToolIcons';
import type { EditorLayersPanelControlNodes } from '@/editor/EditorControls';
import Toast from '@/primitives/Toast';
import FloatingPanel from '@/primitives/FloatingPanel';
import ToolbarButton from '@/primitives/ToolbarButton';
import ContextMenu, { type ContextMenuItem } from '@/overlays/ContextMenu';
import type { Layer } from '@/lib/storage';
import LayerRow from './LayerRow';
import { useLayerDrag } from './useLayerDrag';
import { useLayersPanelResize } from './useLayersPanelResize';
import styles from './LayersPanel.module.css';

type LayersPanelBaseProps = {
  layers: Layer[];
  activeLayerId: string;
  width: number;
  height: number;
  /** Shown when `ImportLayerImageControl` reports a read error (wiring from `usePixelArtEditorState`). */
  layerImageImportError: string | null;
  onDuplicateLayer: (id: string) => void;
  onDuplicateLayerTo: (id: string, toIndex: number) => void;
  onClearLayer: (id: string) => void;
  /** Rotate the layer's pixels 90° around its centre. Clips to canvas bounds
   *  (identity on square canvases, drops corners otherwise). Single undo step. */
  onRotateLayer: (id: string, dir: 'cw' | 'ccw') => void;
  onDeleteLayer: (id: string) => void;
  onRenameLayer: (id: string, name: string) => void;
  onSetVisibility: (id: string, visible: boolean) => void;
  /** Alt-click on the eye icon: solo this layer (hide others), or if already
   *  soloed, restore all layers to visible. Single undo step. */
  onSoloVisibility: (id: string) => void;
  /** Toggle the layer's locked state. Locked layers reject paint/erase/fill
   *  commits until unlocked. Single undo step. */
  onSetLocked: (id: string, locked: boolean) => void;
  onSetOpacity: (id: string, opacity: number) => void;
  onMoveLayer: (id: string, toIndex: number) => void;
  onMergeDown: (id: string) => void;
  onExportLayerSvg: (id: string) => void;
  onSetActive: (id: string) => void;
  /** When true, adds a mobile hook class on the panel root for CSS overrides. */
  mobile?: boolean;
};

export type LayersPanelProps = LayersPanelBaseProps & EditorLayersPanelControlNodes;

interface MenuState {
  layerId: string;
  position: { x: number; y: number };
}

const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
  activeLayerId,
  width,
  height,
  layerImageImportError,
  layersPanelDownload,
  addLayer,
  importLayer,
  onDuplicateLayer,
  onClearLayer,
  onRotateLayer,
  onDeleteLayer,
  onRenameLayer,
  onSetVisibility,
  onSoloVisibility,
  onSetLocked,
  onSetOpacity,
  onMoveLayer,
  onMergeDown,
  onExportLayerSvg,
  onSetActive,
  // onDuplicateLayerTo is used by the drag handler below via closure.
  onDuplicateLayerTo,
  mobile = false,
}) => {
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('pixelator:layersCollapsed') === 'true'
  );

  const { width: panelWidth, isDragging: isResizing, beginResize } = useLayersPanelResize({
    enabled: !mobile,
  });

  const { listRef, dragState, beginDrag } = useLayerDrag({
    layers,
    onSetActive,
    onDuplicateLayerTo,
    onMoveLayer,
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('pixelator:layersCollapsed', String(next));
      return next;
    });
  };

  const displayOrder = layers.map((layer, idx) => ({ layer, idx }));
  displayOrder.reverse();

  // ── Menu (used by right-click AND the 3-dots button) ──────────────────────
  const openMenuAtCursor = (layerId: string, x: number, y: number) => {
    setMenuState({ layerId, position: { x, y } });
  };

  const openMenuFromButton = (layerId: string, anchor: HTMLElement) => {
    // Anchor the menu just below the 3-dots button's bottom-right corner so it
    // reads as "belonging to" this row. ContextMenu clamps to viewport itself.
    const rect = anchor.getBoundingClientRect();
    setMenuState({ layerId, position: { x: rect.right, y: rect.bottom + 4 } });
  };

  const closeMenu = () => setMenuState(null);

  const buildMenuItems = (layer: Layer): ContextMenuItem[] => {
    const idxInArray = layers.findIndex((l) => l.id === layer.id);
    const isArrayTop = idxInArray === layers.length - 1;
    const isArrayBottom = idxInArray === 0;
    const canDelete = layers.length > 1;

    return [
      {
        label: 'Duplicate',
        icon: DuplicateIcon,
        onClick: () => { closeMenu(); onDuplicateLayer(layer.id); },
      },
      {
        label: 'Export as SVG',
        icon: LucideDownloadIcon,
        onClick: () => { closeMenu(); onExportLayerSvg(layer.id); },
      },
      {
        label: 'Move up',
        icon: ArrowUpIcon,
        disabled: isArrayTop,
        onClick: () => { closeMenu(); onMoveLayer(layer.id, idxInArray + 1); },
      },
      {
        label: 'Move down',
        icon: ArrowDownIcon,
        disabled: isArrayBottom,
        onClick: () => { closeMenu(); onMoveLayer(layer.id, idxInArray - 1); },
      },
      {
        label: 'Merge down',
        icon: MergeDownIcon,
        disabled: isArrayBottom,
        onClick: () => { closeMenu(); onMergeDown(layer.id); },
      },
      { separator: true, label: '' },
      {
        label: 'Clear',
        icon: EraserIcon,
        onClick: () => { closeMenu(); onClearLayer(layer.id); },
      },
      {
        label: 'Rotate 90° CW',
        icon: RotateCWIcon,
        testId: 'layer-menu-rotate-cw',
        onClick: () => { closeMenu(); onRotateLayer(layer.id, 'cw'); },
      },
      {
        label: 'Rotate 90° CCW',
        icon: RotateCCWIcon,
        testId: 'layer-menu-rotate-ccw',
        onClick: () => { closeMenu(); onRotateLayer(layer.id, 'ccw'); },
      },
      {
        label: 'Delete',
        icon: TrashIcon,
        variant: 'destructive',
        disabled: !canDelete,
        testId: 'layer-menu-delete',
        onClick: () => { closeMenu(); onDeleteLayer(layer.id); },
      },
    ];
  };

  const listClass = `${styles.list}${
    dragState?.activated
      ? ` ${dragState.altKey ? styles.listDuplicating : styles.listDragging}`
      : ''
  }`;

  const menuLayer = menuState ? layers.find((l) => l.id === menuState.layerId) : null;

  return (
    <>
      <FloatingPanel
        position="top-right"
        mobile={mobile}
        className={`${styles.panel}${isResizing ? ` ${styles.panelResizing}` : ''}${mobile ? ` ${styles.mobile}` : ''}`}
        style={mobile ? undefined : { width: panelWidth }}
        aria-label="Layers"
      >
        {!mobile && (
          <div
            className={styles.resizeHandle}
            onPointerDown={beginResize}
            aria-hidden="true"
            data-testid="layers-panel-resize"
          />
        )}
        {layerImageImportError !== null && (
          <div className={styles.importToast}>
            <Toast message={layerImageImportError} />
          </div>
        )}
        <div
          className={styles.utilitiesBar}
          aria-label="Layer actions"
        >
          <div className={styles.utilitiesSlot}>
            {layersPanelDownload}
          </div>
          {importLayer}
          {addLayer}
          <ToolbarButton
            icon={ChevronSmIcon}
            size="sm"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Show layers' : 'Hide layers'}
            aria-expanded={!collapsed}
            className={collapsed ? styles.chevronCollapsed : styles.chevronExpanded}
            tooltip={{ content: collapsed ? 'Show layers' : 'Hide layers', placement: 'bottom' }}
          />
        </div>
        {!collapsed && <div ref={listRef} className={listClass} role="list">
          {displayOrder.map(({ layer, idx }, displayIdx) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              layerIndex={idx}
              displayIndex={displayIdx}
              totalLayers={layers.length}
              isActive={layer.id === activeLayerId}
              isDragging={dragState?.activated === true && dragState.srcLayerId === layer.id}
              width={width}
              height={height}
              onSetActive={onSetActive}
              onSetVisibility={onSetVisibility}
              onSoloVisibility={onSoloVisibility}
              onSetLocked={onSetLocked}
              onSetOpacity={onSetOpacity}
              onRenameLayer={onRenameLayer}
              onRowPointerDown={beginDrag}
              onOpenMenuAtCursor={openMenuAtCursor}
              onOpenMenuFromButton={openMenuFromButton}
              isMenuOpen={menuState?.layerId === layer.id}
            />
          ))}
          {dragState?.activated && (
            <div
              className={`${styles.dropIndicator} ${dragState.altKey ? styles.dropIndicatorDuplicate : ''}`}
              style={{
                // Sit in the middle of the gap between row k-1 and row k
                // (or just above row 0 for slot 0, just past the last row
                // for slot N). `rowStride - rowHeight` === the list gap.
                top: `${dragState.paddingTop + dragState.dropSlot * dragState.rowStride - (dragState.rowStride - dragState.rowHeight) / 2}px`,
              }}
              aria-hidden="true"
            />
          )}
        </div>}
      </FloatingPanel>

      {menuLayer && (
        <ContextMenu
          open={menuState !== null}
          position={menuState?.position}
          onClose={closeMenu}
          items={buildMenuItems(menuLayer)}
        />
      )}
    </>
  );
};

export default LayersPanel;
