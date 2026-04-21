import React, { useRef, useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Popover.module.css';

export interface PopoverProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  className?: string;
  matchWidth?: boolean;
  overlap?: boolean;
  offsetX?: number;
  offsetY?: number;
  role?: string;
  'aria-label'?: string;
  /** By default, clicks inside another Popover portal (matching
   *  `[data-admin-popover]`) are ignored — this keeps parent popovers open
   *  while the user interacts with a nested child popover. Set this to `true`
   *  for child popovers that should dismiss when the user clicks anywhere
   *  outside the popover itself (including inside a parent popover). */
  closeOnAnyOutsideClick?: boolean;
  'data-testid'?: string;
}

const GAP = 4;

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Module-level stack of open popover content refs. Only the popover at the top
// of the stack traps Tab — parents pause trapping while a child is open.
const popoverStack: Array<React.RefObject<HTMLDivElement | null>> = [];

function getScrollParent(el: HTMLElement | null): HTMLElement | Window {
  if (!el) return window;
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const { overflow, overflowY, overflowX } = window.getComputedStyle(node);
    if (/auto|scroll/.test(overflow + overflowY + overflowX)) {
      return node;
    }
    node = node.parentElement;
  }
  return window;
}

/**
 * Floating popover that portals to `document.body` and positions itself
 * below (or above) its anchor. Manages focus trapping via a module-level stack
 * so nested popovers each trap Tab independently. Closes on Escape, outside
 * click, and scroll of the nearest scroll ancestor.
 *
 * @param closeOnAnyOutsideClick - When true, clicking inside a parent popover
 *   also closes this one. Leave false (default) for nested popovers that should
 *   stay open while the user interacts with a child.
 */
const Popover: React.FC<PopoverProps> = ({
  isOpen,
  onClose,
  anchorRef,
  children,
  className,
  matchWidth = false,
  overlap = false,
  offsetX = 0,
  offsetY = 0,
  role,
  'aria-label': ariaLabel,
  closeOnAnyOutsideClick = false,
  'data-testid': dataTestId,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<React.CSSProperties | null>(null);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const content = contentRef.current;
    if (!anchor || !content) return;

    const anchorRect = anchor.getBoundingClientRect();
    const contentHeight = content.offsetHeight;
    const viewportHeight = window.innerHeight;

    let top: number;
    if (overlap) {
      // Align content top to anchor top, fall back upward if it clips the viewport
      const spaceBelow = viewportHeight - anchorRect.top - GAP;
      if (spaceBelow >= contentHeight) {
        top = anchorRect.top;
      } else {
        top = Math.max(GAP, viewportHeight - contentHeight - GAP);
      }
    } else {
      const spaceBelow = viewportHeight - anchorRect.bottom - GAP;
      const spaceAbove = anchorRect.top - GAP;
      if (spaceBelow >= contentHeight) {
        top = anchorRect.bottom + GAP;
      } else if (spaceAbove >= contentHeight) {
        top = anchorRect.top - contentHeight - GAP;
      } else {
        top = Math.max(GAP, viewportHeight - contentHeight - GAP);
      }
    }

    top += offsetY;

    // Clamp horizontal position so the popover stays within the viewport
    const contentWidth = content.offsetWidth;
    const viewportWidth = window.innerWidth;
    let left = anchorRect.left + offsetX;
    if (left + contentWidth > viewportWidth - GAP) {
      left = Math.max(GAP, viewportWidth - contentWidth - GAP);
    }

    setPosition({
      top: `${top}px`,
      left: `${left}px`,
      ...(matchWidth ? { width: `${anchorRect.width}px` } : {}),
      maxHeight: `${viewportHeight - GAP * 2}px`,
    });
  }, [anchorRef, matchWidth, overlap, offsetX, offsetY]);

  useEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }

    // When matchWidth is true, pre-apply the anchor width so the content
    // lays out at the correct width before we measure its height.
    if (matchWidth && anchorRef.current && contentRef.current) {
      const anchorWidth = anchorRef.current.getBoundingClientRect().width;
      contentRef.current.style.width = `${anchorWidth}px`;
    }

    // Double-rAF: first frame lets the DOM render and lay out the content,
    // second frame measures the actual dimensions and positions correctly.
    requestAnimationFrame(() => {
      requestAnimationFrame(updatePosition);
    });

    // Reposition on scroll (nearest scroll ancestor only), window resize, and content resize
    const handleReposition = () => updatePosition();

    // Scoped scroll listener — only fires for this popover's scroll ancestor
    const scrollParent = getScrollParent(anchorRef.current);
    scrollParent.addEventListener('scroll', handleReposition);
    window.addEventListener('resize', handleReposition);

    // Throttled ResizeObserver — at most one measurement per animation frame
    let rafId: number | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (rafId !== null) return; // already queued
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updatePosition();
      });
    });
    if (contentRef.current) resizeObserver.observe(contentRef.current);

    return () => {
      scrollParent.removeEventListener('scroll', handleReposition);
      window.removeEventListener('resize', handleReposition);
      resizeObserver.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isOpen, updatePosition, matchWidth, anchorRef]);

  // Focus management + trap: move focus into the popover when it opens, trap
  // Tab while this popover is at the top of the stack, restore on close.
  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    popoverStack.push(contentRef);

    // Focus first focusable element inside the popover after positioning; if
    // none, focus the container itself (it has tabindex="-1").
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const content = contentRef.current;
        if (!content) return;
        const firstFocusable = content.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        if (firstFocusable) firstFocusable.focus();
        else content.focus();
      });
    });

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      // Only the top-of-stack popover traps Tab.
      if (popoverStack[popoverStack.length - 1] !== contentRef) return;
      const content = contentRef.current;
      if (!content) return;
      const focusables = Array.from(content.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) {
        e.preventDefault();
        content.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !content.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTab);

    return () => {
      document.removeEventListener('keydown', handleTab);
      const idx = popoverStack.lastIndexOf(contentRef);
      if (idx !== -1) popoverStack.splice(idx, 1);
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        anchorRef.current?.contains(target) ||
        contentRef.current?.contains(target)
      ) {
        return;
      }
      // Don't close if the click landed inside any other Popover portal
      // (handles nested popovers, e.g. ColorPicker inside ShadowEditor).
      // Skipped when `closeOnAnyOutsideClick` is set — useful for child
      // popovers that should dismiss on interaction with their parent.
      if (
        !closeOnAnyOutsideClick &&
        target instanceof Element &&
        target.closest('[data-admin-popover]')
      ) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    // `pointerdown` rather than `mousedown` — some elements (the canvas)
    // call `preventDefault()` on pointerdown, which suppresses the
    // compatibility mousedown event the browser would otherwise emit.
    // Listening on pointerdown ensures the popover still dismisses on
    // canvas interactions.
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, anchorRef, closeOnAnyOutsideClick]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={contentRef}
      className={`${styles.popover} ${className || ''}`}
      style={position ?? { top: -9999, left: -9999 }}
      role={role}
      aria-label={ariaLabel}
      aria-modal="true"
      tabIndex={-1}
      data-admin-popover
      data-testid={dataTestId}
    >
      {children}
    </div>,
    document.body,
  );
};

export default Popover;
