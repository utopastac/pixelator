import { useCallback, useRef, useState } from 'react';
import {
  DuplicateIcon,
  MoreIcon,
  TrashIcon,
  SvgIcon,
  ExportIcon,
  PlusIcon,
  UploadIcon,
} from '@/editor/icons/PixelToolIcons';
import ToolbarButton from '@/primitives/ToolbarButton';
import ContextMenu, { type ContextMenuItem } from '@/overlays/ContextMenu';
import ConfirmDialog from '@/primitives/ConfirmDialog';
import PngScalePicker from '@/chrome/PngScalePicker';
import type { Drawing } from '@/lib/storage';
import { useAppMobileOptional } from '@/AppMobileContext';
import DrawingRow from './DrawingRow';
import DrawingGroup from './DrawingGroup';
import styles from './DrawingsPanel.module.css';

interface Props {
  /** Controls the slide-in animation; the panel always renders so it can
   *  animate out, only the `.panelClosed` class flips. */
  isOpen: boolean;
  /** Mobile: tapping the dimmed scrim calls this (e.g. close the panel). */
  onDismiss?: () => void;
  drawings: Drawing[];
  currentDrawingId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onExportSvg: (id: string) => void;
  /** Export a PNG at the requested integer pixel-scale. */
  onExportPng: (id: string, scale: number) => void;
  /** Export the drawing as a Pixelator JSON file (single-drawing backup
   *  envelope — round-trippable via Import, unlike SVG / PNG). */
  onExportPixelator: (id: string) => void;
  /** Export every drawing + global colours as a single JSON backup. */
  onExportAll?: () => void;
  /** Export just the currently-selected drawing as a JSON backup. */
  onExportCurrent?: () => void;
  /** Destructive: wipe every drawing and all persistent state, then reload. */
  onResetApp?: () => void;
  /** True when `onExportCurrent` has a drawing to operate on. Drives the
   *  disabled state of the corresponding menu item. */
  canExportCurrent?: boolean;
  /** Open the native file picker to import a JSON backup. */
  onImportClick?: () => void;
}

interface MenuState {
  drawingId: string;
  position: { x: number; y: number };
}

// ---------------------------------------------------------------------------
// Group helpers
// ---------------------------------------------------------------------------

/** Returns the display name for a drawing — just the part after the first `/`. */
function displayName(name: string): string {
  const slash = name.indexOf('/');
  return slash === -1 ? name : name.slice(slash + 1);
}

function groupDrawings(drawings: Drawing[]): {
  ungrouped: Drawing[];
  groups: { label: string; prefix: string; drawings: Drawing[] }[];
} {
  const ungrouped: Drawing[] = [];
  const groupMap = new Map<string, Drawing[]>();
  for (const d of drawings) {
    const slash = d.name.indexOf('/');
    if (slash === -1) {
      ungrouped.push(d);
    } else {
      const prefix = d.name.slice(0, slash);
      const label = prefix.charAt(0).toUpperCase() + prefix.slice(1);
      if (!groupMap.has(label)) groupMap.set(label, []);
      groupMap.get(label)!.push(d);
    }
  }
  return {
    ungrouped,
    groups: Array.from(groupMap.entries()).map(([label, ds]) => ({
      label,
      prefix: ds[0]!.name.slice(0, ds[0]!.name.indexOf('/')),
      drawings: ds,
    })),
  };
}

const COLLAPSED_KEY = 'pixelator:groups-collapsed';

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveCollapsed(collapsed: Set<string>): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
  } catch { /* non-fatal */ }
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

/**
 * Left-side drawings gallery. Overlays the editor inside `.main` (canvas
 * stays full-width underneath). On mobile, a full-viewport scrim sits under
 * the sheet; tap it to run `onDismiss`. The sheet uses the top of the
 * viewport on mobile (`html[data-mobile]`). Duplicate/delete/export live in
 * a per-row overflow menu (also opens on right-click).
 */
export default function DrawingsPanel({
  isOpen,
  drawings,
  currentDrawingId,
  onSelect,
  onNew,
  onDuplicate,
  onDelete,
  onRename,
  onExportSvg,
  onExportPng,
  onExportPixelator,
  onExportAll,
  onExportCurrent,
  canExportCurrent = false,
  onImportClick,
  onResetApp,
  onDismiss,
}: Props) {
  const isMobile = useAppMobileOptional()?.isMobile ?? false;
  const showMobileBackdrop = isMobile && isOpen && onDismiss != null;
  const hasPanelMenu = Boolean(onExportAll || onExportCurrent || onImportClick || onResetApp);
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  // Panel-level "more" menu. Separate state from the per-row menu so both can
  // live on screen without interference (only one visually, but the state
  // stays clean).
  const [panelMenuPos, setPanelMenuPos] = useState<{ x: number; y: number } | null>(null);
  const panelMenuAnchorRef = useRef<HTMLDivElement>(null);
  // Per-row Delete confirmation. We stash the drawing being deleted so the
  // dialog body can interpolate its name and `onConfirm` knows which id to
  // pass to `onDelete`.
  const [deleteTarget, setDeleteTarget] = useState<Drawing | null>(null);
  const confirmDeleteTarget = useCallback(() => {
    if (deleteTarget) onDelete(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, onDelete]);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => loadCollapsed());

  const toggleGroup = (label: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      saveCollapsed(next);
      return next;
    });
  };

  const { ungrouped, groups } = groupDrawings(drawings);

  const menuPosFromButton = (anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect();
    return { x: rect.right, y: rect.bottom + 4 };
  };

  const openMenuAtCursor = (drawingId: string, x: number, y: number) => {
    setMenuState({ drawingId, position: { x, y } });
  };

  const openMenuFromButton = (drawingId: string, anchor: HTMLElement) => {
    setMenuState({ drawingId, position: menuPosFromButton(anchor) });
  };

  const closeMenu = () => setMenuState(null);

  const buildMenuItems = (drawing: Drawing): ContextMenuItem[] => {
    const canDelete = drawings.length > 1;
    return [
      {
        label: 'Duplicate',
        icon: DuplicateIcon,
        testId: 'drawing-menu-duplicate',
        onClick: () => { closeMenu(); onDuplicate(drawing.id); },
      },
      { separator: true, label: '' },
      {
        label: 'Download SVG',
        icon: SvgIcon,
        onClick: () => { closeMenu(); onExportSvg(drawing.id); },
      },
      {
        label: 'Download PNG',
        content: (
          <PngScalePicker
            width={drawing.width}
            height={drawing.height}
            onPick={(scale) => { closeMenu(); onExportPng(drawing.id, scale); }}
          />
        ),
      },
      {
        label: 'Export Pixelator file',
        icon: ExportIcon,
        testId: 'drawing-menu-export-pixelator',
        onClick: () => { closeMenu(); onExportPixelator(drawing.id); },
      },
      { separator: true, label: '' },
      {
        label: 'Delete',
        icon: TrashIcon,
        variant: 'destructive',
        disabled: !canDelete,
        testId: 'drawing-menu-delete',
        onClick: () => {
          closeMenu();
          setDeleteTarget(drawing);
        },
      },
    ];
  };

  const menuDrawing = menuState ? drawings.find((d) => d.id === menuState.drawingId) : null;

  return (
    <>
      {showMobileBackdrop && (
        <button
          type="button"
          className={styles.mobileBackdrop}
          aria-label="Close drawings panel"
          onClick={onDismiss}
        />
      )}
      <aside
        className={`${styles.panel} ${isOpen ? '' : styles.panelClosed}`}
        aria-label="Drawings"
        aria-hidden={!isOpen}
      >
        <div className={styles.header}>
          <span className={styles.headerTitle}>Drawings</span>
          <div className={styles.headerActions}>
            <ToolbarButton
              icon={PlusIcon}
              size="sm"
              onClick={onNew}
              aria-label="New drawing"
              tooltip={{ content: 'New drawing', placement: 'bottom' }}
              data-testid="new-drawing"
            />
            {hasPanelMenu && (
              <div ref={panelMenuAnchorRef}>
                <ToolbarButton
                  icon={MoreIcon}
                  size="sm"
                  selected={panelMenuPos !== null}
                  onClick={() => {
                    if (panelMenuAnchorRef.current) {
                      setPanelMenuPos(menuPosFromButton(panelMenuAnchorRef.current));
                    }
                  }}
                  aria-label="Drawings menu"
                  aria-haspopup="menu"
                  aria-expanded={panelMenuPos !== null}
                  tooltip={{ content: 'More', placement: 'bottom' }}
                  data-testid="drawings-menu"
                />
              </div>
            )}
          </div>
        </div>
        <div className={styles.list} role="list">
          {ungrouped.map((d) => (
            <DrawingRow
              key={d.id}
              drawing={d}
              isActive={d.id === currentDrawingId}
              onSelect={onSelect}
              onRename={onRename}
              onOpenMenuAtCursor={openMenuAtCursor}
              onOpenMenuFromButton={openMenuFromButton}
              isMenuOpen={menuState?.drawingId === d.id}
            />
          ))}
          {groups.map(({ label, prefix, drawings: groupDrawings }) => (
            <DrawingGroup
              key={label}
              label={label}
              isCollapsed={collapsed.has(label)}
              onToggle={() => toggleGroup(label)}
            >
              {groupDrawings.map((d) => (
                <DrawingRow
                  key={d.id}
                  drawing={d}
                  isActive={d.id === currentDrawingId}
                  onSelect={onSelect}
                  onRename={onRename}
                  onOpenMenuAtCursor={openMenuAtCursor}
                  onOpenMenuFromButton={openMenuFromButton}
                  isMenuOpen={menuState?.drawingId === d.id}
                  groupPrefix={prefix}
                />
              ))}
            </DrawingGroup>
          ))}
        </div>
      </aside>

      {menuDrawing && (
        <ContextMenu
          open={menuState !== null}
          position={menuState?.position}
          onClose={closeMenu}
          items={buildMenuItems(menuDrawing)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete drawing?"
        body={`Delete "${deleteTarget ? displayName(deleteTarget.name) : ''}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDeleteTarget}
        onCancel={() => setDeleteTarget(null)}
        testId="confirm-delete-drawing"
      />

      {hasPanelMenu && panelMenuPos && (
        <ContextMenu
          open
          position={panelMenuPos}
          onClose={() => setPanelMenuPos(null)}
          items={[
            ...(onExportAll
              ? [{
                  label: 'Export all drawings',
                  icon: ExportIcon,
                  testId: 'drawings-menu-export-all',
                  onClick: () => {
                    setPanelMenuPos(null);
                    onExportAll();
                  },
                }]
              : []),
            ...(onExportCurrent
              ? [{
                  label: 'Export current drawing',
                  icon: ExportIcon,
                  disabled: !canExportCurrent,
                  testId: 'drawings-menu-export-current',
                  onClick: () => {
                    setPanelMenuPos(null);
                    onExportCurrent();
                  },
                }]
              : []),
            ...(onImportClick
              ? [
                  { separator: true as const, label: '' },
                  {
                    label: 'Import…',
                    icon: UploadIcon,
                    testId: 'drawings-menu-import',
                    onClick: () => {
                      setPanelMenuPos(null);
                      onImportClick();
                    },
                  },
                ]
              : []),
            ...(onResetApp
              ? [
                  { separator: true as const, label: '' },
                  {
                    label: 'Reset app…',
                    icon: TrashIcon,
                    variant: 'destructive' as const,
                    testId: 'drawings-menu-reset-app',
                    onClick: () => {
                      setPanelMenuPos(null);
                      onResetApp();
                    },
                  },
                ]
              : []),
          ]}
        />
      )}
    </>
  );
}
