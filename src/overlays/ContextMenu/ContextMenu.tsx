import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import styles from './ContextMenu.module.css';

export interface ContextMenuItem {
  label: string;
  onClick?: () => void;
  shortcut?: string;
  icon?: LucideIcon | React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
  separator?: boolean;
  /** Custom row content. When provided, the menu renders this node instead of
   *  the default button — used to embed inline controls (e.g. a PNG scale
   *  picker with export chips). Keyboard navigation skips custom rows. */
  content?: React.ReactNode;
  /** Stable test hook forwarded as `data-testid` on the item button. */
  testId?: string;
}

interface ContextMenuProps {
  /** Wrap children to intercept right-click. Omit to use controlled mode. */
  children?: React.ReactNode;
  items: ContextMenuItem[];
  className?: string;
  /** Controlled mode: whether the menu is open. */
  open?: boolean;
  /** Controlled mode: position of the menu. */
  position?: { x: number; y: number };
  /** Controlled mode: called when the menu should close. */
  onClose?: () => void;
}

interface MenuPosition {
  x: number;
  y: number;
}

/**
 * Right-click context menu. Supports two modes: wrap `children` to intercept
 * `contextmenu` events automatically, or pass `open`/`position`/`onClose` for
 * fully controlled placement (e.g. triggered programmatically from the canvas).
 * The menu portal renders into `document.body` and clamps to the viewport.
 */
const ContextMenu: React.FC<ContextMenuProps> = ({
  children,
  items,
  className = '',
  open: controlledOpen,
  position: controlledPosition,
  onClose,
}) => {
  const isControlled = controlledOpen !== undefined;
  const [internalVisible, setInternalVisible] = useState(false);
  const [internalPosition, setInternalPosition] = useState<MenuPosition>({ x: 0, y: 0 });
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const visible = isControlled ? controlledOpen : internalVisible;
  // Render always uses `internalPosition`; in controlled mode we mirror
  // `controlledPosition` into it synchronously below so the viewport-clamp
  // effect can refine it without diverging from the parent's intent.
  const position = internalPosition;

  // Keep `internalPosition` in sync with the incoming `controlledPosition`
  // in controlled mode. `useLayoutEffect` so first paint doesn't briefly show
  // the menu at its previous position.
  useLayoutEffect(() => {
    if (!isControlled || !controlledPosition) return;
    if (controlledPosition.x === internalPosition.x && controlledPosition.y === internalPosition.y) return;
    setInternalPosition(controlledPosition);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isControlled, controlledPosition?.x, controlledPosition?.y]);

  // Actionable (non-separator, non-custom, non-disabled) item indices for
  // keyboard navigation.
  const navigableIndices = items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => !item.separator && !item.content && !item.disabled)
    .map(({ idx }) => idx);

  const closeMenu = useCallback(() => {
    if (isControlled) {
      onClose?.();
    } else {
      setInternalVisible(false);
    }
    setFocusedIndex(-1);
    // Return focus to the element that triggered the menu
    if (triggerRef.current) {
      triggerRef.current.focus();
    }
  }, [isControlled, onClose]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Remember the element the right-click originated from
      triggerRef.current = e.target instanceof HTMLElement ? e.target : null;
      setInternalPosition({ x: e.clientX, y: e.clientY });
      setInternalVisible(true);
    },
    []
  );

  const handleItemClick = useCallback(
    (item: ContextMenuItem) => {
      if (item.disabled) return;
      closeMenu();
      item.onClick?.();
    },
    [closeMenu]
  );

  // Focus the first navigable item when the menu opens
  useEffect(() => {
    if (visible && navigableIndices.length > 0) {
      setFocusedIndex(navigableIndices[0]);
    }
  // Only run when visibility changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Move DOM focus to the focused item button
  useEffect(() => {
    if (visible && focusedIndex >= 0 && menuRef.current) {
      const target = menuRef.current.querySelector<HTMLButtonElement>(
        `[data-item-index="${focusedIndex}"]`
      );
      target?.focus();
    }
  }, [visible, focusedIndex]);

  // Adjust position to keep menu within viewport. The effect runs on every
  // (visible, position.x, position.y) change and writes back to
  // `internalPosition` in BOTH modes — in controlled mode we render from
  // `internalPosition` once it's been clamped, falling back to the controlled
  // position on the very first render before measurement.
  useEffect(() => {
    if (!visible || !menuRef.current) return;
    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const GUTTER = 8;

    let adjustedX = position.x;
    let adjustedY = position.y;

    if (position.x + rect.width > viewportWidth - GUTTER) {
      adjustedX = Math.max(GUTTER, viewportWidth - rect.width - GUTTER);
    }
    if (position.y + rect.height > viewportHeight - GUTTER) {
      adjustedY = Math.max(GUTTER, viewportHeight - rect.height - GUTTER);
    }

    if (adjustedX !== internalPosition.x || adjustedY !== internalPosition.y) {
      setInternalPosition({ x: adjustedX, y: adjustedY });
    }
  }, [visible, position.x, position.y, internalPosition.x, internalPosition.y]);

  // Close on outside click or Escape key; arrow-key navigation
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentPosInNav = navigableIndices.indexOf(focusedIndex);

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const nextPos = currentPosInNav < navigableIndices.length - 1
            ? currentPosInNav + 1
            : 0;
          setFocusedIndex(navigableIndices[nextPos]);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prevPos = currentPosInNav > 0
            ? currentPosInNav - 1
            : navigableIndices.length - 1;
          setFocusedIndex(navigableIndices[prevPos]);
          break;
        }
        case 'Home': {
          e.preventDefault();
          setFocusedIndex(navigableIndices[0]);
          break;
        }
        case 'End': {
          e.preventDefault();
          setFocusedIndex(navigableIndices[navigableIndices.length - 1]);
          break;
        }
        case 'Escape': {
          closeMenu();
          break;
        }
        case 'Tab': {
          // Don't trap focus — Tab closes the menu
          closeMenu();
          break;
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, closeMenu, focusedIndex, navigableIndices]);

  const menu = visible
    ? ReactDOM.createPortal(
        <div
          ref={menuRef}
          className={styles.menu}
          style={{
            left: position.x,
            top: position.y,
          }}
          role="menu"
          data-admin-popover
        >
          {items.map((item, index) => {
            if (item.separator) {
              return <div key={index} className={styles.separator} role="separator" />;
            }

            if (item.content) {
              return <React.Fragment key={index}>{item.content}</React.Fragment>;
            }

            const itemClass = [
              styles.item,
              item.variant === 'destructive' && styles.destructive,
              item.disabled && styles.disabled,
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                key={index}
                type="button"
                className={itemClass}
                onClick={() => handleItemClick(item)}
                role="menuitem"
                aria-disabled={item.disabled}
                disabled={item.disabled}
                tabIndex={index === focusedIndex ? 0 : -1}
                data-item-index={index}
                data-testid={item.testId}
              >
                {item.icon && <item.icon size={16} className={styles.icon} aria-hidden />}
                <span className={styles.label}>{item.label}</span>
                {item.shortcut && (
                  <span className={styles.shortcut}>{item.shortcut}</span>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )
    : null;

  if (isControlled) {
    return <>{menu}</>;
  }

  return (
    <div className={className} onContextMenu={handleContextMenu}>
      {children}
      {menu}
    </div>
  );
};

export default ContextMenu;
