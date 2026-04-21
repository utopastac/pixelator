import React, { useEffect } from 'react';
import { CloseIcon } from '@/editor/icons/PixelToolIcons';
import Kbd from '@/primitives/Kbd';
import ToolbarButton from '@/primitives/ToolbarButton';
import styles from './ShortcutsDialog.module.css';

export interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutRow {
  keys: React.ReactNode;
  label: string;
}

interface ShortcutGroup {
  title: string;
  rows: ShortcutRow[];
}

const IS_MAC = /mac/i.test(navigator.userAgent);
// Modifier + action keys. Mac uses conventional single-glyph names that
// match the OS system font's keycap glyphs; Windows/Linux conventionally
// spell these out, so fall back to text there.
const MOD = IS_MAC ? '⌘' : 'Ctrl';
const SHIFT = IS_MAC ? '⇧' : 'Shift';
const ALT = IS_MAC ? '⌥' : 'Alt';
const RETURN = IS_MAC ? '⏎' : 'Enter';
const DELETE = IS_MAC ? '⌦' : 'Delete';

const keys = (parts: string[]): React.ReactNode => (
  <span className={styles.keys}>
    {parts.map((p, i) => (
      <Kbd key={i}>{p}</Kbd>
    ))}
  </span>
);

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Tools',
    rows: [
      { keys: keys(['B']), label: 'Pencil' },
      { keys: keys(['E']), label: 'Eraser' },
      { keys: keys(['G']), label: 'Fill' },
      { keys: keys(['L']), label: 'Line' },
      { keys: keys(['P']), label: 'Pen' },
      { keys: keys(['M']), label: 'Marquee selection' },
      { keys: keys(['U']), label: 'Shapes' },
      { keys: keys(['I']), label: 'Eyedropper' },
      { keys: keys(['V']), label: 'Move' },
    ],
  },
  {
    title: 'History',
    rows: [
      { keys: keys([MOD, 'Z']), label: 'Undo' },
      { keys: keys([MOD, SHIFT, 'Z']), label: 'Redo' },
    ],
  },
  {
    title: 'Clipboard',
    rows: [
      { keys: keys([MOD, 'C']), label: 'Copy' },
      { keys: keys([MOD, 'X']), label: 'Cut' },
      { keys: keys([MOD, 'V']), label: 'Paste' },
    ],
  },
  {
    title: 'Zoom & pan',
    rows: [
      { keys: keys([MOD, '0']), label: 'Fit to screen' },
      { keys: keys([MOD, '1']), label: 'Zoom to 100%' },
      { keys: keys([MOD, '+']), label: 'Zoom in' },
      { keys: keys([MOD, '−']), label: 'Zoom out' },
      { keys: keys([MOD, 'scroll']), label: 'Zoom at cursor' },
      { keys: keys(['scroll']), label: 'Pan canvas' },
      { keys: keys(['Space', 'drag']), label: 'Pan (hold + drag)' },
    ],
  },
  {
    title: 'Selection (marquee)',
    rows: [
      { keys: keys([DELETE]), label: 'Clear selection' },
      { keys: keys([ALT, DELETE]), label: 'Fill selection' },
      { keys: keys([MOD, 'D']), label: 'Deselect' },
      { keys: keys(['Esc']), label: 'Dismiss selection' },
    ],
  },
  {
    title: 'Pen tool',
    rows: [
      { keys: keys([RETURN]), label: 'Commit path' },
      { keys: keys(['Esc']), label: 'Cancel path' },
    ],
  },
  {
    title: 'Move tool',
    rows: [
      { keys: keys(['←', '↑', '↓', '→']), label: 'Nudge 1 cell' },
      { keys: keys([SHIFT, '←', '↑', '↓', '→']), label: 'Nudge 10 cells' },
      { keys: keys([RETURN]), label: 'Commit transform' },
      { keys: keys(['Esc']), label: 'Cancel transform' },
      { keys: keys(['H']), label: 'Flip horizontal' },
      { keys: keys(['V']), label: 'Flip vertical' },
    ],
  },
  {
    title: 'Shape tools',
    rows: [
      { keys: keys([SHIFT, 'drag']), label: 'Constrain' },
      { keys: keys(['Long-press']), label: 'Open tool options' },
    ],
  },
];

/** Modal dialog listing all keyboard shortcuts, grouped by category.
 *  Closes on Escape or a click on the backdrop. */
const ShortcutsDialog: React.FC<ShortcutsDialogProps> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.dialog}>
        <header className={styles.header}>
          <h2 className={styles.title}>Keyboard shortcuts</h2>
          <ToolbarButton
            icon={CloseIcon}
            size="sm"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          />
        </header>
        <div className={styles.body}>
          {GROUPS.map((group) => (
            <section key={group.title} className={styles.group}>
              <h3 className={styles.groupTitle}>{group.title}</h3>
              <ul className={styles.rows}>
                {group.rows.map((row, i) => (
                  <li key={i} className={styles.row}>
                    <span className={styles.rowLabel}>{row.label}</span>
                    {row.keys}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ShortcutsDialog;
