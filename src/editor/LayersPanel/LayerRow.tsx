import React, { useState, useRef } from 'react';
import {
  EyeIcon,
  EyeOffIcon,
  MoreIcon,
  GripVerticalIcon,
  LockFillIcon,
  UnlockedFillIcon,
} from '../icons/PixelToolIcons';
import ToolbarButton from '@/primitives/ToolbarButton';
import EditableText from '@/primitives/EditableText';
import CompactInput from '@/primitives/CompactInput';
import Thumbnail from '@/chrome/Thumbnail';
import type { Layer } from '@/lib/storage';
import styles from './LayersPanel.module.css';

export interface LayerRowProps {
  layer: Layer;
  isActive: boolean;
  isDragging: boolean;
  layerIndex: number;
  displayIndex: number;
  totalLayers: number;
  width: number;
  height: number;
  onSetActive: (id: string) => void;
  onSetVisibility: (id: string, visible: boolean) => void;
  onSoloVisibility: (id: string) => void;
  onSetLocked: (id: string, locked: boolean) => void;
  onSetOpacity: (id: string, opacity: number) => void;
  onRenameLayer: (id: string, name: string) => void;
  onRowPointerDown: (layerId: string, displayIndex: number, e: React.PointerEvent<HTMLDivElement>) => void;
  onOpenMenuAtCursor: (layerId: string, x: number, y: number) => void;
  onOpenMenuFromButton: (layerId: string, anchor: HTMLElement) => void;
  isMenuOpen: boolean;
}

const LayerRow: React.FC<LayerRowProps> = ({
  layer,
  isActive,
  isDragging,
  width,
  height,
  displayIndex,
  onSetActive,
  onSetVisibility,
  onSoloVisibility,
  onSetLocked,
  onSetOpacity,
  onRenameLayer,
  onRowPointerDown,
  onOpenMenuAtCursor,
  onOpenMenuFromButton,
  isMenuOpen,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const menuAnchorRef = useRef<HTMLDivElement>(null);

  const handleGripPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isEditingName) return;
    if (e.button !== 0) return;
    onRowPointerDown(layer.id, displayIndex, e);
  };

  const handleRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-stop-row-click]')) return;
    if (isEditingName) return;
    onSetActive(layer.id);
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    onOpenMenuAtCursor(layer.id, e.clientX, e.clientY);
  };

  return (
    <div
      className={`${styles.row} ${isActive ? styles.rowActive : ''} ${isDragging ? styles.rowDragging : ''} ${!layer.visible ? styles.rowHidden : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      aria-label={`Layer ${layer.name}`}
      onClick={handleRowClick}
      onContextMenu={handleContextMenu}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if ((e.target as HTMLElement).closest('[data-stop-row-click]')) return;
          if ((e.target as HTMLElement).tagName === 'INPUT') return;
          e.preventDefault();
          onSetActive(layer.id);
        }
      }}
    >
      <span
        data-stop-row-click
        className={styles.grip}
        onPointerDown={handleGripPointerDown}
        aria-hidden="true"
      >
        <GripVerticalIcon size={16} aria-hidden />
      </span>
      <span
        data-stop-row-click
        onClick={(e) => {
          // Alt/Option-click: solo this layer across the whole stack. Normal
          // click: toggle this layer only. Handled on the wrapper so we can
          // read modifier keys — ToolbarButton's onClick has no event arg.
          if (e.altKey) {
            onSoloVisibility(layer.id);
          } else {
            onSetVisibility(layer.id, !layer.visible);
          }
        }}
      >
        <ToolbarButton
          icon={layer.visible ? EyeIcon : EyeOffIcon}
          size="sm"
          aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
          title={layer.visible ? 'Hide layer (Alt-click: solo)' : 'Show layer (Alt-click: solo)'}
        />
      </span>
      {/* Thumbnail always reflects the layer's raw pixels, regardless of
          visibility — the eye toggles playback on the canvas, not whether
          the thumbnail shows. */}
      <Thumbnail
        layers={[layer]}
        canvasWidth={width}
        canvasHeight={height}
        respectVisibility={false}
        width={32}
        height={32}
        className={styles.thumb}
      />
      <span className={styles.nameSlot}>
        {/* No `data-stop-row-click` — single-click on the name selects the
            layer (like Finder); EditableText enters rename mode on
            double-click. Drag threshold means clicks-without-motion never
            escalate into a reorder. */}
        <EditableText
          value={layer.name}
          onChange={(next) => onRenameLayer(layer.id, next)}
          size="sm"
          ariaLabel={`Rename layer ${layer.name}`}
          onEditStart={() => setIsEditingName(true)}
          onEditEnd={() => setIsEditingName(false)}
        />
      </span>
      <span className={styles.opacityWrap} data-stop-row-click>
        <CompactInput
          prefix="%"
          value={String(Math.round(layer.opacity * 100))}
          onChange={(raw) => {
            const n = parseInt(raw, 10);
            if (!Number.isFinite(n)) return;
            onSetOpacity(layer.id, Math.max(0, Math.min(100, n)) / 100);
          }}
          min={0}
          max={100}
          step={1}
          scrub
          width={52}
        />
      </span>
      <span
        data-stop-row-click
        className={`${styles.lockSlot} ${layer.locked ? styles.lockActive : ''}`}
      >
        <ToolbarButton
          icon={layer.locked ? LockFillIcon : UnlockedFillIcon}
          size="sm"
          onClick={() => onSetLocked(layer.id, !layer.locked)}
          aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
          aria-pressed={layer.locked === true}
          title={layer.locked ? 'Unlock layer' : 'Lock layer'}
        />
      </span>
      <div
        ref={menuAnchorRef}
        className={styles.overflowAnchor}
        data-stop-row-click
      >
        <ToolbarButton
          icon={MoreIcon}
          size="sm"
          selected={isMenuOpen}
          onClick={() => {
            if (menuAnchorRef.current) onOpenMenuFromButton(layer.id, menuAnchorRef.current);
          }}
          aria-label="Layer actions"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          title="Layer actions"
        />
      </div>
    </div>
  );
};

export default LayerRow;
