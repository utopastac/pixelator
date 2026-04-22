import React, { useState, useRef, useCallback, useId, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppMobileOptional } from '@/AppMobileContext';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  children: React.ReactElement;
  className?: string;
}

/** Gap in px between the trigger edge and the tooltip's near edge. */
const GAP = 6;
/** Viewport-edge safety margin so the tooltip doesn't touch the screen side. */
const VIEWPORT_MARGIN = 4;

/** App-wide hover-to-show delay. Callers that don't pass a `delay` prop
 *  inherit this; explicit `delay` overrides (e.g. `0` for immediate). */
export const TOOLTIP_DELAY_MS = 400;

/** Grace window after a tooltip hides during which the next tooltip skips its
 *  delay entirely. Matches the "chained tooltips" behaviour in Apple / VS Code /
 *  Material: once you've seen one, sliding onto an adjacent trigger shows its
 *  tooltip instantly until you dwell elsewhere for longer than this window. */
const TOOLTIP_CHAIN_GRACE_MS = 500;

// Module-level chain state — shared across every Tooltip instance in the tree.
// `chainActive` is true while any tooltip is open OR within the grace window of
// the last one hiding. While true, new `show()` calls resolve their effective
// delay to 0.
let chainActive = false;
let graceTimer: ReturnType<typeof setTimeout> | undefined;

function enterChain() {
  chainActive = true;
  if (graceTimer !== undefined) {
    clearTimeout(graceTimer);
    graceTimer = undefined;
  }
}

function leaveChain() {
  if (graceTimer !== undefined) clearTimeout(graceTimer);
  graceTimer = setTimeout(() => {
    chainActive = false;
    graceTimer = undefined;
  }, TOOLTIP_CHAIN_GRACE_MS);
}

/** Test-only helper: reset the cross-tooltip chain state so one test's
 *  lingering chain timer doesn't bleed into the next. Not part of the public
 *  API — production callers never need to poke this. */
export function _resetTooltipChainForTests(): void {
  chainActive = false;
  if (graceTimer !== undefined) {
    clearTimeout(graceTimer);
    graceTimer = undefined;
  }
}

interface Placement {
  top: number;
  left: number;
  /** Pixels to shift the arrow along the cross-axis from its centered default.
   *  Nonzero when the tooltip was clamped to the viewport; keeps the arrow
   *  pointing at the trigger even though the bubble has been pushed aside. */
  arrowShift: number;
}

/**
 * Hover/focus tooltip that portals into `document.body`. Shows after `delay`
 * ms (default 400); skips the delay when another tooltip was recently visible
 * so scrubbing between adjacent triggers feels instant (chained-tooltip mode).
 * Arrow position is corrected when the bubble is clamped to the viewport edge.
 */
export default function Tooltip({
  content,
  placement = 'top',
  delay = TOOLTIP_DELAY_MS,
  children,
  className,
}: TooltipProps) {
  const appMobile = useAppMobileOptional();
  const isMobile = appMobile?.isMobile ?? false;

  const [visible, setVisible] = useState(false);
  const [placed, setPlaced] = useState<Placement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  const show = useCallback(() => {
    const open = () => {
      // `placed` goes null first so the tooltip renders off-screen / hidden
      // on its first frame; the layout effect below measures it and writes
      // the real position before the browser paints, avoiding a flicker.
      setPlaced(null);
      setVisible(true);
      enterChain();
    };
    // If another tooltip was recently visible, skip this tooltip's delay so
    // scrubbing across adjacent triggers feels instantaneous.
    const effectiveDelay = chainActive ? 0 : delay;
    if (effectiveDelay > 0) {
      timeoutRef.current = setTimeout(open, effectiveDelay);
    } else {
      open();
    }
  }, [delay]);

  const hide = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setPlaced(null);
    // Use the functional form so we observe the pre-hide `visible` value — only
    // a tooltip that was actually visible participates in chaining. Purely
    // cancelled shows (hover + leave before the delay elapsed) don't extend
    // the grace window.
    setVisible((prev) => {
      if (prev) leaveChain();
      return false;
    });
  }, []);

  // Measure + clamp synchronously after the tooltip mounts. Runs only on the
  // render where `visible` is true and `placed` is still null (first frame).
  useLayoutEffect(() => {
    if (isMobile || !visible || placed !== null) return;
    const tip = tooltipRef.current;
    const wrapper = wrapperRef.current;
    if (!tip || !wrapper) return;
    // Prefer the rendered child's rect — the wrapper span is inline with no
    // size of its own for transformed / absolutely-positioned children.
    const target = (wrapper.firstElementChild as HTMLElement | null) ?? wrapper;
    const triggerRect = target.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top: number;
    let left: number;
    let arrowShift = 0;

    if (placement === 'top' || placement === 'bottom') {
      const triggerCenterX = triggerRect.left + triggerRect.width / 2;
      const desiredLeft = triggerCenterX - tipRect.width / 2;
      const minLeft = VIEWPORT_MARGIN;
      const maxLeft = vw - tipRect.width - VIEWPORT_MARGIN;
      left = Math.max(minLeft, Math.min(desiredLeft, maxLeft));
      // Arrow sits at the tooltip's centre by default; shift it back toward
      // the trigger's centre by the amount the tooltip itself got pushed.
      arrowShift = triggerCenterX - (left + tipRect.width / 2);
      top = placement === 'top'
        ? triggerRect.top - GAP - tipRect.height
        : triggerRect.bottom + GAP;
    } else {
      const triggerCenterY = triggerRect.top + triggerRect.height / 2;
      const desiredTop = triggerCenterY - tipRect.height / 2;
      const minTop = VIEWPORT_MARGIN;
      const maxTop = vh - tipRect.height - VIEWPORT_MARGIN;
      top = Math.max(minTop, Math.min(desiredTop, maxTop));
      arrowShift = triggerCenterY - (top + tipRect.height / 2);
      left = placement === 'left'
        ? triggerRect.left - GAP - tipRect.width
        : triggerRect.right + GAP;
    }

    setPlaced({ top, left, arrowShift });
  }, [isMobile, visible, placed, placement]);

  const preMeasureStyle: React.CSSProperties = {
    top: -9999,
    left: -9999,
    visibility: 'hidden',
  };
  const placedStyle: React.CSSProperties | null = placed
    ? ({
        top: placed.top,
        left: placed.left,
        ['--arrow-shift' as string]: `${placed.arrowShift}px`,
      } as React.CSSProperties)
    : null;

  if (isMobile) {
    return children;
  }

  return (
    <>
      <span
        ref={wrapperRef}
        className={`${styles.wrapper}${className ? ` ${className}` : ''}`}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onMouseDown={hide}
      >
        {React.cloneElement(
          children,
          (visible ? { 'aria-describedby': tooltipId } : {}) as Partial<unknown>,
        )}
      </span>
      {visible &&
        createPortal(
          <span
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            className={`${styles.tooltip} ${styles[placement]}`}
            style={placedStyle ?? preMeasureStyle}
          >
            {content}
          </span>,
          document.body,
        )}
    </>
  );
}
