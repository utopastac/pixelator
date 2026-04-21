/**
 * Move-tool pointer handlers for the "no active selection" branch. When the
 * user is on the Move tool with active pixels and no marquee, pointer gestures
 * either start / update / finish a pending affine transform on the active
 * layer's tight bbox. The main pointer-handlers hook delegates to these when
 * appropriate; selection-mode move keeps its existing masked-translate path.
 *
 * Gestures supported:
 *   - body drag       → translate preview
 *   - corner handle   → uniform scale from opposite corner
 *   - edge handle     → single-axis stretch from opposite edge
 *   - rotate handle   → free rotation around bbox centre
 *
 * The preview is rendered on the preview canvas via a canvas 2D transform
 * applied to a snapshot offscreen bitmap. The committed canvas shows empty
 * for the active layer during the pending transform (achieved by dispatching
 * an all-empty pixel array — `activePixels.dispatch`).
 */

import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import {
  applyMatrix,
  invertMatrix,
  multiplyMatrix,
  type AffineMatrix,
  type TransformBBox,
} from '../lib/transforms';
import type {
  TransformHandle,
  UseLayerTransformReturn,
} from './useLayerTransform';

interface UseMoveTransformToolArgs {
  width: number;
  height: number;
  disabled: boolean;
  committedCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  transform: UseLayerTransformReturn;
  panX: number;
  panY: number;
  zoom: number;
}

interface DragState {
  handle: TransformHandle;
  /** Matrix at the moment the drag started (needed for rotate / scale anchored
   *  at opposite corner — we re-derive from the drag-start matrix each move
   *  rather than incrementally stacking rotations). */
  startMatrix: AffineMatrix;
  /** Pointer position in grid coords at drag start. */
  startGrid: [number, number];
  /** Bbox at drag start in source coords. Note: transforms compose on top of
   *  startMatrix, so the "anchor" for scale/stretch is a corner/edge of this
   *  bbox mapped via startMatrix. */
  bbox: TransformBBox;
}

export interface UseMoveTransformToolReturn {
  /** Returns true when the event was handled by the transform tool. The
   *  calling hook should short-circuit its other tool branches when true. */
  handlePointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => boolean;
  handlePointerMove: (e: { clientX: number; clientY: number; shiftKey?: boolean }) => boolean;
  handlePointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => boolean;
  /** Called on pointer cancel — treats the in-flight drag as a no-op. */
  handlePointerCancel: () => void;
  /** Render the preview: apply pending matrix to the snapshot bitmap and
   *  paint it onto the preview canvas. Called on every matrix update. */
  renderPreview: () => void;
  /** Clear the preview canvas. */
  clearPreview: () => void;
}

/**
 * Provides pointer handlers for the Move tool's transform-frame branch (translate, scale, rotate).
 * Delegates to `useLayerTransform` for matrix state; renders the preview onto the preview canvas.
 */
export function useMoveTransformTool({
  width,
  height,
  disabled,
  committedCanvasRef,
  previewCanvasRef,
  transform,
  panX,
  panY,
  zoom,
}: UseMoveTransformToolArgs): UseMoveTransformToolReturn {
  const dragRef = useRef<DragState | null>(null);
  // Offscreen holding the snapshotted pixels, used as the source for the
  // preview canvas transform draws. Rebuilt each time a pending transform
  // begins.
  const snapshotOffscreenRef = useRef<HTMLCanvasElement | null>(null);

  const buildSnapshotOffscreen = useCallback(
    (pixels: string[]) => {
      const off = document.createElement('canvas');
      off.width = width;
      off.height = height;
      const ctx = off.getContext('2d');
      if (!ctx) return off;
      for (let i = 0; i < pixels.length; i++) {
        const color = pixels[i];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(i % width, Math.floor(i / width), 1, 1);
      }
      return off;
    },
    [width, height],
  );

  const clearPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }, [previewCanvasRef]);

  const renderPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    const off = snapshotOffscreenRef.current;
    const p = transform.pending;
    if (!canvas || !off || !p) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    const m = p.matrix;
    // setTransform signature: (a, b, c, d, e, f) maps (x, y) to
    //   (a*x + c*y + e, b*x + d*y + f)
    // — i.e. same components as our AffineMatrix.
    ctx.setTransform(m.a, m.b, m.c, m.d, m.tx, m.ty);
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  }, [previewCanvasRef, transform.pending]);

  // Re-render the preview any time the pending matrix changes (e.g. from a
  // keyboard flip). Covers all update paths, including ones that don't go
  // through the pointer handlers.
  useEffect(() => {
    if (!transform.pending) {
      clearPreview();
      return;
    }
    renderPreview();
  }, [transform.pending, clearPreview, renderPreview]);

  const getCellFromEvent = useCallback(
    (e: { clientX: number; clientY: number }): [number, number] | null => {
      const canvas = committedCanvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const cellPx = rect.width / width;
      // Sub-cell precision for smooth scale/rotate gestures; callers that
      // need integers can floor.
      const x = (e.clientX - rect.left) / cellPx;
      const y = (e.clientY - rect.top) / cellPx;
      return [x, y];
    },
    [width, committedCanvasRef],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>): boolean => {
      if (disabled) return false;
      if (e.button !== 0) return false;
      if (!transform.bbox) {
        // Empty active layer. The Move tool has nothing to frame and no
        // "drag to translate" behaviour in the no-selection branch — return
        // true to swallow the click so it doesn't fall through to other tool
        // handlers (which would no-op anyway, but the intent is clearer).
        return true;
      }
      const container = committedCanvasRef.current?.parentElement?.parentElement;
      const containerW = container?.clientWidth ?? Infinity;
      const containerH = container?.clientHeight ?? Infinity;
      const handle = transform.hitTestHandle(e.clientX, e.clientY, panX, panY, zoom, containerW, containerH);
      if (!handle) {
        // Click outside the bbox → commit any pending transform so the user
        // can see the result. If nothing is pending, just swallow — the Move
        // tool has no "click anywhere" semantics in this branch.
        if (transform.isPending) {
          transform.commit();
          clearPreview();
        }
        return true;
      }
      e.preventDefault();
      // Begin pending (idempotent). The snapshot happens here, at the moment
      // of the first drag on any handle.
      const pending = transform.beginPending();
      if (!pending) return true;
      snapshotOffscreenRef.current = buildSnapshotOffscreen(pending.snapshotPixels);
      // Active layer is hidden on the committed canvas via the composite
      // effect's `skipLayerId` while `transform.isPending` is true — we do NOT
      // dispatch empty pixels, because `commitPixels` snapshots the layer
      // state at commit time and a prior dispatch would make the undo target
      // empty instead of the pre-transform pixels.

      const start = getCellFromEvent(e);
      if (!start) return true;
      dragRef.current = {
        handle,
        startMatrix: { ...pending.matrix },
        startGrid: start,
        bbox: pending.snapshotBBox,
      };
      renderPreview();
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- committedCanvasRef is a stable ref
    [
      disabled, transform, panX, panY, zoom, buildSnapshotOffscreen,
      getCellFromEvent, renderPreview, clearPreview,
    ],
  );

  const handlePointerMove = useCallback(
    (e: { clientX: number; clientY: number; shiftKey?: boolean }): boolean => {
      // Parity with `handlePointerDown`: if the tool gets disabled mid-gesture
      // (e.g. active layer locked during a drag), stop updating the matrix.
      if (disabled) return false;
      if (!dragRef.current) return false;
      const drag = dragRef.current;
      const p = transform.pending;
      if (!p) return false;
      const cur = getCellFromEvent(e);
      if (!cur) return true;

      const b = drag.bbox;
      const startM = drag.startMatrix;
      // The four corners (inclusive-bounds-to-edges: +1) in source coords.
      const nw: [number, number] = [b.x1, b.y1];
      const ne: [number, number] = [b.x2 + 1, b.y1];
      const se: [number, number] = [b.x2 + 1, b.y2 + 1];
      const sw: [number, number] = [b.x1, b.y2 + 1];
      const midSrc = (a: [number, number], c: [number, number]): [number, number] =>
        [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
      const cxSrc = (b.x1 + b.x2 + 1) / 2;
      const cySrc = (b.y1 + b.y2 + 1) / 2;

      // Translate is composed LEFT of startMatrix; scale/stretch/rotate are
      // composed with an anchor in screen-space by pre- and post-multiplying
      // with translation matrices.
      const compose = (delta: AffineMatrix) => multiplyMatrix(delta, startM);

      let nextMatrix: AffineMatrix;
      const handle = drag.handle;

      if (handle === 'body') {
        const dx = cur[0] - drag.startGrid[0];
        const dy = cur[1] - drag.startGrid[1];
        nextMatrix = compose({ a: 1, b: 0, c: 0, d: 1, tx: dx, ty: dy });
      } else if (handle === 'rotate') {
        // Rotate around the bbox centre mapped through startMatrix.
        const [mcx, mcy] = applyMatrix(startM, cxSrc, cySrc);
        const a0 = Math.atan2(drag.startGrid[1] - mcy, drag.startGrid[0] - mcx);
        const a1 = Math.atan2(cur[1] - mcy, cur[0] - mcx);
        const rawTheta = a1 - a0;
        const snap = Math.PI / 4;
        const theta = e.shiftKey ? Math.round(rawTheta / snap) * snap : rawTheta;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        // Rotation about (mcx, mcy): T(mcx, mcy) · R(theta) · T(-mcx, -mcy)
        const R: AffineMatrix = {
          a: cos, b: sin, c: -sin, d: cos,
          tx: mcx - mcx * cos + mcy * sin,
          ty: mcy - mcx * sin - mcy * cos,
        };
        nextMatrix = multiplyMatrix(R, startM);
      } else {
        // Scale / stretch. Anchor = the opposite corner/edge in destination
        // (screen/grid post-transform) space. The source-space pivot is a
        // fixed point in the bbox; we map it through startMatrix.
        let pivotSrc: [number, number];
        let refSrc: [number, number];
        let sxAxis = true, syAxis = true;
        switch (handle) {
          case 'nw': pivotSrc = se; refSrc = nw; break;
          case 'ne': pivotSrc = sw; refSrc = ne; break;
          case 'se': pivotSrc = nw; refSrc = se; break;
          case 'sw': pivotSrc = ne; refSrc = sw; break;
          case 'n':  pivotSrc = midSrc(sw, se); refSrc = midSrc(nw, ne); sxAxis = false; break;
          case 's':  pivotSrc = midSrc(nw, ne); refSrc = midSrc(sw, se); sxAxis = false; break;
          case 'w':  pivotSrc = midSrc(ne, se); refSrc = midSrc(nw, sw); syAxis = false; break;
          case 'e':  pivotSrc = midSrc(nw, sw); refSrc = midSrc(ne, se); syAxis = false; break;
          default: return true;
        }
        // Convert pivot and reference into destination coords via startMatrix.
        const pivot = applyMatrix(startM, pivotSrc[0], pivotSrc[1]);
        const ref = applyMatrix(startM, refSrc[0], refSrc[1]);
        // The "axis vector" in destination space goes from pivot → ref. When
        // the user drags, the new ref point is `cur`. The scale factor is the
        // projection of (cur - pivot) onto (ref - pivot), divided by |ref - pivot|².
        const refDx = ref[0] - pivot[0];
        const refDy = ref[1] - pivot[1];
        const refLenSq = refDx * refDx + refDy * refDy;
        if (refLenSq < 1e-9) return true;
        const curDx = cur[0] - pivot[0];
        const curDy = cur[1] - pivot[1];
        // Uniform (corner): scale in both axes along the diagonal.
        // Axis (edge): scale only along that axis; the other axis stays 1.
        let sx = 1;
        let sy = 1;
        if (handle === 'nw' || handle === 'ne' || handle === 'se' || handle === 'sw') {
          const s = (curDx * refDx + curDy * refDy) / refLenSq;
          sx = s;
          sy = s;
        } else if (!sxAxis) {
          // n / s — scale in the axis parallel to (ref - pivot).
          const s = (curDx * refDx + curDy * refDy) / refLenSq;
          sy = s;
        } else if (!syAxis) {
          // w / e.
          const s = (curDx * refDx + curDy * refDy) / refLenSq;
          sx = s;
        }
        // Clamp absolute scale so we never produce a singular matrix. Sign is
        // preserved so the user CAN flip past zero by dragging through the
        // pivot (matches the expectation that edges/corners can invert).
        const MIN = 0.01;
        if (Math.abs(sx) < MIN) sx = (sx < 0 ? -1 : 1) * MIN;
        if (Math.abs(sy) < MIN) sy = (sy < 0 ? -1 : 1) * MIN;
        // Apply in destination space, anchored at pivot:
        //   T(pivot) · S(sx, sy) · T(-pivot) · startMatrix
        const anchoredScale: AffineMatrix = {
          a: sx, b: 0, c: 0, d: sy,
          tx: pivot[0] * (1 - sx),
          ty: pivot[1] * (1 - sy),
        };
        nextMatrix = multiplyMatrix(anchoredScale, startM);
      }

      // Guard singular matrices before pushing — the inverse in
      // applyAffineToPixels (and the renderPreview) would otherwise fail.
      if (!invertMatrix(nextMatrix)) return true;
      transform.setMatrix(nextMatrix);
      renderPreview();
      return true;
    },
    [disabled, transform, getCellFromEvent, renderPreview],
  );

  const handlePointerUp = useCallback(
    (_e: React.PointerEvent<HTMLCanvasElement>): boolean => {
      if (!dragRef.current) return false;
      dragRef.current = null;
      // We don't auto-commit on pointerup — the pending transform stays live
      // so the user can keep tweaking it with other handles, H/V flips, or
      // switch to Enter/click-outside to commit.
      return true;
    },
    [],
  );

  const handlePointerCancel = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    // Pointer cancel ends the current gesture but preserves the pending
    // matrix so the UI can continue from its current state.
  }, []);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    renderPreview,
    clearPreview,
  };
}
