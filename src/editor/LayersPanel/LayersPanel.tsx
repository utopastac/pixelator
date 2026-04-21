import React, { useEffect, useRef, useState } from 'react';
import { DownloadIcon as LucideDownloadIcon } from 'lucide-react';
import {
  DownloadIcon,
  EraserIcon,
  DuplicateIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PlusIcon,
  RotateCWIcon,
  RotateCCWIcon,
  ImageIcon,
  MergeDownIcon,
  ChevronSmIcon,
} from '../icons/PixelToolIcons';
import { importImageAsPixels, layerNameFromFile } from '@/lib/imageImport';
import Toast from '@/primitives/Toast';
import FloatingPanel from '@/primitives/FloatingPanel';
import ToolbarButton from '@/primitives/ToolbarButton';
import Popover from '@/overlays/Popover';
import ContextMenu, { type ContextMenuItem } from '@/overlays/ContextMenu';
import DownloadMenu from '../DownloadMenu';
import type { Layer } from '@/lib/storage';
import LayerRow from './LayerRow';
import { useLayerDrag } from './useLayerDrag';
import { useLayersPanelResize } from './useLayersPanelResize';
import styles from './LayersPanel.module.css';

export interface LayersPanelProps {
  layers: Layer[];
  activeLayerId: string;
  width: number;
  height: number;
  onAddLayer: () => void;
  /** Insert a downsampled image as a new layer. LayersPanel owns the file
   *  picker + decode; caller receives the pixel array + suggested name.
   *  Single undo step. */
  onImportLayerImage?: (pixels: string[], name?: string) => void;
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
  onDownloadSvg: () => void;
  onDownloadPng: (scale: number) => void;
  onDownloadLayersSvg: () => void;
  onDownloadPixelator?: () => void;
  currentWidth?: number;
  currentHeight?: number;
}

interface MenuState {
  layerId: string;
  position: { x: number; y: number };
}

const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
  activeLayerId,
  width,
  height,
  onAddLayer,
  onImportLayerImage,
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
  onDownloadSvg,
  onDownloadPng,
  onDownloadLayersSvg,
  onDownloadPixelator,
  currentWidth,
  currentHeight,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const downloadAnchorRef = useRef<HTMLDivElement>(null);
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('pixelator:layersCollapsed') === 'true'
  );
  const [importToast, setImportToast] = useState<string | null>(null);
  const importToastTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (importToastTimerRef.current !== null) window.clearTimeout(importToastTimerRef.current);
  }, []);

  const { width: panelWidth, isDragging: isResizing, beginResize } = useLayersPanelResize();

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

  const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input's value unconditionally so picking the same file twice
    // in a row still fires `change`. Do it early — any await below could
    // complete after the user has moved on.
    e.target.value = '';
    if (!file || !onImportLayerImage) return;
    try {
      const pixels = await importImageAsPixels(file, width, height);
      onImportLayerImage(pixels, layerNameFromFile(file));
    } catch (err) {
      if (importToastTimerRef.current !== null) window.clearTimeout(importToastTimerRef.current);
      setImportToast('Could not read that file');
      importToastTimerRef.current = window.setTimeout(() => {
        setImportToast(null);
        importToastTimerRef.current = null;
      }, 2500);
    }
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
        className={`${styles.panel}${isResizing ? ` ${styles.panelResizing}` : ''}`}
        style={{ width: panelWidth }}
        aria-label="Layers"
      >
        <div
          className={styles.resizeHandle}
          onPointerDown={beginResize}
          aria-hidden="true"
          data-testid="layers-panel-resize"
        />
        {importToast !== null && (
          <div className={styles.importToast}>
            <Toast message={importToast} />
          </div>
        )}
        <div
          className={styles.utilitiesBar}
          aria-label="Editor utilities"
        >
          <div className={styles.utilitiesSlot}>
            <div ref={downloadAnchorRef} className={styles.downloadAnchor}>
              <ToolbarButton
                icon={DownloadIcon}
                size="sm"
                selected={isDownloadMenuOpen}
                onClick={() => setIsDownloadMenuOpen((prev) => !prev)}
                aria-label="Download"
                aria-haspopup="menu"
                aria-expanded={isDownloadMenuOpen}
                tooltip={{ content: 'Download', placement: 'bottom' }}
                data-testid="download-menu"
              />
              <Popover
                isOpen={isDownloadMenuOpen}
                onClose={() => setIsDownloadMenuOpen(false)}
                anchorRef={downloadAnchorRef}
                offsetX={-5}
                role="menu"
                aria-label="Download format"
              >
                <DownloadMenu
                  onDownloadSvg={onDownloadSvg}
                  onDownloadPng={onDownloadPng}
                  onDownloadLayersSvg={onDownloadLayersSvg}
                  onDownloadPixelator={onDownloadPixelator}
                  width={currentWidth}
                  height={currentHeight}
                  onClose={() => setIsDownloadMenuOpen(false)}
                />
              </Popover>
            </div>
          </div>
          {onImportLayerImage && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImportChange}
              />
              <ToolbarButton
                icon={ImageIcon}
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Import image as layer"
                tooltip={{ content: 'Import image', placement: 'bottom' }}
              />
            </>
          )}
          <ToolbarButton
            icon={PlusIcon}
            size="sm"
            onClick={() => onAddLayer()}
            aria-label="Add layer"
            tooltip={{ content: 'Add layer', placement: 'bottom' }}
          />
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
