import React, { useEffect, useRef, useState } from 'react';
import type { Layer } from '@/lib/storage';

const DRAG_THRESHOLD_PX = 4;

interface DragState {
  srcLayerId: string;
  /** Source row's index in the REVERSED display order (0 = top of list). */
  srcDisplayIndex: number;
  startX: number;
  startY: number;
  /** True once the pointer has travelled past DRAG_THRESHOLD_PX. */
  activated: boolean;
  altKey: boolean;
  /** Current drop slot, 0..layers.length. */
  dropSlot: number;
  /** Measured height of a row in CSS pixels. */
  rowHeight: number;
  /** Distance between row origins = rowHeight + gap. */
  rowStride: number;
  /** List's top padding in CSS pixels. */
  paddingTop: number;
}

interface UseLayerDragProps {
  layers: Layer[];
  onSetActive: (id: string) => void;
  onDuplicateLayerTo: (id: string, toIndex: number) => void;
  onMoveLayer: (id: string, toIndex: number) => void;
}

interface UseLayerDragResult {
  listRef: React.RefObject<HTMLDivElement | null>;
  dragState: DragState | null;
  beginDrag: (layerId: string, displayIndex: number, e: React.PointerEvent<HTMLDivElement>) => void;
}

export function useLayerDrag({
  layers,
  onSetActive,
  onDuplicateLayerTo,
  onMoveLayer,
}: UseLayerDragProps): UseLayerDragResult {
  const listRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const beginDrag = (
    layerId: string,
    displayIndex: number,
    e: React.PointerEvent<HTMLDivElement>,
  ) => {
    const list = listRef.current;
    const firstRow = list?.firstElementChild as HTMLElement | null;
    const secondRow = firstRow?.nextElementSibling as HTMLElement | null;
    const rowHeight = firstRow?.offsetHeight ?? 48;
    // Measure stride from the actual gap between two adjacent rows. Falls
    // back to a 2px gap (matches LayersPanel.module.css `.list { gap: 2px }`)
    // when there's only one row in the stack.
    const rowStride = secondRow && firstRow
      ? secondRow.offsetTop - firstRow.offsetTop
      : rowHeight + 2;
    const paddingTop = firstRow?.offsetTop ?? 0;
    setDragState({
      srcLayerId: layerId,
      srcDisplayIndex: displayIndex,
      startX: e.clientX,
      startY: e.clientY,
      activated: false,
      altKey: e.altKey,
      dropSlot: displayIndex,
      rowHeight,
      rowStride,
      paddingTop,
    });
  };

  useEffect(() => {
    if (!dragState) return;

    // Edge auto-scroll state. Pointer position is captured fresh each frame
    // from pointermove; rAF ticks the scroll while the pointer stays parked
    // inside an edge zone.
    const AUTOSCROLL_EDGE_PX = 40;
    const AUTOSCROLL_MAX_SPEED = 14;
    let lastPointerY = 0;
    let rafId: number | null = null;

    const recomputeDropSlot = (list: HTMLElement) => {
      setDragState((prev) => {
        if (!prev || !prev.activated) return prev;
        const rect = list.getBoundingClientRect();
        const relY = lastPointerY - rect.top + list.scrollTop - prev.paddingTop;
        const dropSlot = Math.max(0, Math.min(layers.length, Math.round(relY / prev.rowStride)));
        return dropSlot === prev.dropSlot ? prev : { ...prev, dropSlot };
      });
    };

    const tick = () => {
      rafId = null;
      const list = listRef.current;
      if (!list) return;
      const rect = list.getBoundingClientRect();
      const topDist = lastPointerY - rect.top;
      const bottomDist = rect.bottom - lastPointerY;
      let delta = 0;
      if (topDist < AUTOSCROLL_EDGE_PX) {
        const intensity = Math.max(0, (AUTOSCROLL_EDGE_PX - topDist) / AUTOSCROLL_EDGE_PX);
        delta = -Math.ceil(intensity * AUTOSCROLL_MAX_SPEED);
      } else if (bottomDist < AUTOSCROLL_EDGE_PX) {
        const intensity = Math.max(0, (AUTOSCROLL_EDGE_PX - bottomDist) / AUTOSCROLL_EDGE_PX);
        delta = Math.ceil(intensity * AUTOSCROLL_MAX_SPEED);
      }
      if (delta !== 0) {
        const before = list.scrollTop;
        list.scrollTop = before + delta;
        if (list.scrollTop !== before) recomputeDropSlot(list);
        rafId = requestAnimationFrame(tick);
      }
    };

    const ensureTicking = () => {
      if (rafId == null) rafId = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      lastPointerY = e.clientY;
      setDragState((prev) => {
        if (!prev) return prev;
        const dx = e.clientX - prev.startX;
        const dy = e.clientY - prev.startY;
        const dist = Math.hypot(dx, dy);
        const activated = prev.activated || dist >= DRAG_THRESHOLD_PX;

        let dropSlot = prev.dropSlot;
        if (activated) {
          const list = listRef.current;
          if (list) {
            const rect = list.getBoundingClientRect();
            // `paddingTop` is in the list's scroll-content coordinate system
            // (it came from `firstRow.offsetTop`, which ignores scroll). Map
            // the pointer into that same system by adding `scrollTop`.
            const relY = e.clientY - rect.top + list.scrollTop - prev.paddingTop;
            dropSlot = Math.max(0, Math.min(layers.length, Math.round(relY / prev.rowStride)));
          }
        }

        return { ...prev, activated, altKey: e.altKey, dropSlot };
      });

      if (listRef.current) {
        const rect = listRef.current.getBoundingClientRect();
        const inEdge =
          e.clientY - rect.top < AUTOSCROLL_EDGE_PX ||
          rect.bottom - e.clientY < AUTOSCROLL_EDGE_PX;
        if (inEdge) ensureTicking();
      }
    };

    const onUp = (e: PointerEvent) => {
      setDragState((prev) => {
        if (!prev) return prev;

        if (!prev.activated) {
          onSetActive(prev.srcLayerId);
          return null;
        }

        const n = layers.length;
        const k = prev.dropSlot;
        const s = prev.srcDisplayIndex;

        if (e.altKey) {
          onDuplicateLayerTo(prev.srcLayerId, n - k);
        } else if (k !== s && k !== s + 1) {
          const targetDisplay = k < s ? k : k - 1;
          const targetArrayIdx = n - 1 - targetDisplay;
          onMoveLayer(prev.srcLayerId, targetArrayIdx);
        }
        return null;
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [dragState, layers.length, onDuplicateLayerTo, onMoveLayer, onSetActive]);

  return { listRef, dragState, beginDrag };
}
