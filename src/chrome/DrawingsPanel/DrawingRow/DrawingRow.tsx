import React, { useRef, useState } from 'react';
import { MoreIcon } from '@/editor/icons/PixelToolIcons';
import ToolbarButton from '@/primitives/ToolbarButton';
import EditableText from '@/primitives/EditableText';
import Thumbnail from '@/chrome/Thumbnail';
import type { Drawing } from '@/lib/storage';
import styles from './DrawingRow.module.css';

export interface DrawingRowProps {
  drawing: Drawing;
  isActive: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onOpenMenuAtCursor: (id: string, x: number, y: number) => void;
  onOpenMenuFromButton: (id: string, anchor: HTMLElement) => void;
  isMenuOpen: boolean;
  /** When set, the row displays only the part after the slash in display mode,
   *  but edits the full name so the user can move the drawing to another group. */
  groupPrefix?: string;
}

/**
 * Single row in the drawings panel: thumbnail, editable name, dimensions,
 * and an overflow menu trigger. Right-click opens the same menu at the cursor.
 */
export default function DrawingRow({
  drawing,
  isActive,
  onSelect,
  onRename,
  onOpenMenuAtCursor,
  onOpenMenuFromButton,
  isMenuOpen,
  groupPrefix,
}: DrawingRowProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const menuAnchorRef = useRef<HTMLDivElement>(null);
  const shortName = groupPrefix != null ? drawing.name.slice(groupPrefix.length + 1) : undefined;

  const handleRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-stop-row-click]')) return;
    if (isEditingName) return;
    onSelect(drawing.id);
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    onOpenMenuAtCursor(drawing.id, e.clientX, e.clientY);
  };

  return (
    <div
      className={`${styles.row} ${isActive ? styles.rowActive : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      aria-label={`Open ${drawing.name}`}
      data-drawing-id={drawing.id}
      onClick={handleRowClick}
      onContextMenu={handleContextMenu}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest('[data-stop-row-click]')) return;
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(drawing.id);
        }
      }}
    >
      <Thumbnail
        layers={drawing.layers}
        canvasWidth={drawing.width}
        canvasHeight={drawing.height}
        width={36}
        height={36}
        className={styles.thumb}
      />
      <span className={styles.nameSlot}>
        {/* No `data-stop-row-click` — single-click on the name selects the
            drawing; EditableText enters rename mode on double-click. */}
        <EditableText
          value={drawing.name}
          displayValue={shortName}
          onChange={(next) => onRename(drawing.id, next)}
          size="sm"
          ariaLabel={`Rename drawing ${drawing.name}`}
          onEditStart={() => setIsEditingName(true)}
          onEditEnd={() => setIsEditingName(false)}
        />
      </span>
      <span className={styles.dims}>{drawing.width}×{drawing.height}</span>
      <div ref={menuAnchorRef} className={styles.overflowAnchor} data-stop-row-click>
        <ToolbarButton
          icon={MoreIcon}
          size="sm"
          selected={isMenuOpen}
          onClick={() => {
            if (menuAnchorRef.current) onOpenMenuFromButton(drawing.id, menuAnchorRef.current);
          }}
          aria-label="Drawing actions"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          title="Drawing actions"
          data-testid="drawing-actions"
        />
      </div>
    </div>
  );
}
