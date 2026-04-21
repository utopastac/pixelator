/**
 * Move-tool transform state. When the Move tool is active, the active layer
 * has drawn pixels, and there is no active selection, the editor renders a
 * tight bbox around those pixels with 8 scale/stretch handles + a rotate
 * handle. Dragging anything on that bbox starts a "pending transform": the
 * original pixels are snapshotted, and the user's gestures accumulate into
 * an affine matrix that maps source grid coords → destination grid coords.
 *
 * The bbox itself has two lives:
 *   - "idle"   — tracks the live `tightBBox(pixels)`; snaps whenever the
 *                layer pixels change.
 *   - "pending" — frozen at the moment the pending transform begins, then
 *                decorated with the current matrix on each gesture update.
 *
 * Commit paths:
 *   - `commit()` — apply the matrix to the snapshotted pixels
 *                  (inverse-mapped nearest-neighbour), clear pending state,
 *                  and route the new pixels through `activePixels.commit`
 *                  (which drives undo + autosave).
 *   - `cancel()` — clear pending state; the bbox snaps back to the idle
 *                  tight bbox of the current pixels.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  applyAffineToPixels,
  applyMatrix,
  IDENTITY,
  multiplyMatrix,
  tightBBox,
  type AffineMatrix,
  type TransformBBox,
} from '../lib/transforms';
import type { ActivePixels } from './usePixelArtHistory';

export type TransformHandle =
  | 'nw' | 'n' | 'ne'
  | 'w' | 'e'
  | 'sw' | 's' | 'se'
  | 'rotate' | 'body';

export interface PendingTransform {
  /** Untransformed layer pixels at the moment the pending transform began. */
  snapshotPixels: string[];
  /** Tight bbox of `snapshotPixels`. */
  snapshotBBox: TransformBBox;
  /** The accumulated affine matrix. Identity when pending first starts. */
  matrix: AffineMatrix;
}

export interface UseLayerTransformArgs {
  pixels: string[];
  width: number;
  height: number;
  activePixels: ActivePixels;
}

export interface UseLayerTransformReturn {
  /** The bbox the editor should render. Null when the layer is empty. */
  bbox: TransformBBox | null;
  /** Current pending transform (snapshot + matrix), or null. */
  pending: PendingTransform | null;
  /** True if a transform is pending (any handle has been dragged). */
  isPending: boolean;
  /** Begin a pending transform if not already started. Returns the freshly
   *  initialised (or existing) pending state. */
  beginPending: () => PendingTransform | null;
  /** Replace the pending matrix. No-op when pending is null. */
  setMatrix: (m: AffineMatrix) => void;
  /** Apply (left-multiply) a matrix onto the current pending matrix. */
  multiplyMatrixLeft: (m: AffineMatrix) => void;
  /** Commit the pending transform to the active layer. Safe to call when
   *  nothing is pending (no-op). */
  commit: () => void;
  /** Discard the pending transform; bbox reverts to tracking live pixels. */
  cancel: () => void;
  /** Utility: which handle (if any) is under the given screen-space point. */
  hitTestHandle: (
    screenX: number,
    screenY: number,
    panX: number,
    panY: number,
    zoom: number,
    containerWidth?: number,
    containerHeight?: number,
  ) => TransformHandle | null;
  /** Returns the transformed bbox corners in SOURCE grid coords, already
   *  matrix-applied. Used by the overlay renderer. */
  transformedCorners: () => [number, number][] | null;
}

const HANDLE_HIT_PX = 12; // CSS-pixel slop around each handle for hit-testing.
const ROTATE_OFFSET_PX = 24; // Distance from top edge to the rotate handle.

function cornersOfBBox(b: TransformBBox): [number, number][] {
  // 4 corners in source coords: NW, NE, SE, SW (clockwise from top-left).
  return [
    [b.x1, b.y1],
    [b.x2 + 1, b.y1],
    [b.x2 + 1, b.y2 + 1],
    [b.x1, b.y2 + 1],
  ];
}

/**
 * Move-tool transform state machine: tracks the tight bbox of the active
 * layer's pixels and manages the pending affine transform (snapshot + matrix).
 * Exposes `beginPending`, `setMatrix`, `commit`, and `cancel` as the state
 * transitions, plus `hitTestHandle` and `transformedCorners` for the overlay
 * renderer and pointer handler.
 */
export function useLayerTransform({
  pixels,
  width,
  height,
  activePixels,
}: UseLayerTransformArgs): UseLayerTransformReturn {
  const [pending, setPending] = useState<PendingTransform | null>(null);

  const idleBBox = useMemo(
    () => tightBBox(pixels, width, height),
    [pixels, width, height],
  );

  const bbox = pending ? pending.snapshotBBox : idleBBox;

  // Track the live pending via ref so handlers inside a single gesture can
  // update it synchronously without waiting for a re-render.
  const pendingRef = useRef<PendingTransform | null>(null);
  pendingRef.current = pending;

  const beginPending = useCallback((): PendingTransform | null => {
    if (pendingRef.current) return pendingRef.current;
    if (!idleBBox) return null;
    const next: PendingTransform = {
      snapshotPixels: pixels.slice(),
      snapshotBBox: idleBBox,
      matrix: { ...IDENTITY },
    };
    pendingRef.current = next;
    setPending(next);
    return next;
  }, [idleBBox, pixels]);

  const setMatrix = useCallback((m: AffineMatrix) => {
    if (!pendingRef.current) return;
    pendingRef.current = { ...pendingRef.current, matrix: m };
    setPending(pendingRef.current);
  }, []);

  const multiplyMatrixLeft = useCallback((m: AffineMatrix) => {
    if (!pendingRef.current) return;
    const next = multiplyMatrix(m, pendingRef.current.matrix);
    pendingRef.current = { ...pendingRef.current, matrix: next };
    setPending(pendingRef.current);
  }, []);

  const commit = useCallback(() => {
    const p = pendingRef.current;
    if (!p) return;
    // Identity → no-op; skip history noise.
    const m = p.matrix;
    const isIdentity =
      Math.abs(m.a - 1) < 1e-9 && Math.abs(m.d - 1) < 1e-9 &&
      Math.abs(m.b) < 1e-9 && Math.abs(m.c) < 1e-9 &&
      Math.abs(m.tx) < 1e-9 && Math.abs(m.ty) < 1e-9;
    if (!isIdentity) {
      const next = applyAffineToPixels(
        p.snapshotPixels,
        width,
        height,
        p.matrix,
        p.snapshotBBox,
      );
      // The active layer's pixels were never mutated during pending (it was
      // hidden via the composite's skipLayerId), so commitPixels snapshots
      // the pre-transform state as the undo target without any pre-dispatch.
      activePixels.commit(next);
      activePixels.emit(next);
    }
    pendingRef.current = null;
    setPending(null);
  }, [activePixels, width, height]);

  const cancel = useCallback(() => {
    if (!pendingRef.current) return;
    // Layer pixels were never mutated during pending; clearing pending state
    // is enough for the composite to re-include the layer on the next render.
    pendingRef.current = null;
    setPending(null);
  }, []);

  const transformedCorners = useCallback((): [number, number][] | null => {
    const b = bbox;
    if (!b) return null;
    const corners = cornersOfBBox(b);
    if (!pending) return corners;
    return corners.map(([x, y]) => applyMatrix(pending.matrix, x, y));
  }, [bbox, pending]);

  const hitTestHandle = useCallback(
    (
      screenX: number,
      screenY: number,
      panX: number,
      panY: number,
      zoom: number,
      containerWidth?: number,
      containerHeight?: number,
    ): TransformHandle | null => {
      const corners = transformedCorners();
      if (!corners) return null;
      // Map source-corner grid coords to screen-space CSS pixels.
      const toScreen = ([gx, gy]: [number, number]) =>
        [panX + gx * zoom, panY + gy * zoom] as [number, number];
      const [nw, ne, se, sw] = corners.map(toScreen) as [number, number][];
      const mid = (a: [number, number], b: [number, number]): [number, number] =>
        [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const n = mid(nw, ne);
      const s = mid(sw, se);
      const w = mid(nw, sw);
      const e = mid(ne, se);
      // Rotate handle sits ROTATE_OFFSET_PX CSS pixels away from the N edge,
      // perpendicular to that edge (pointing "up" away from the centre).
      const cx = (nw[0] + se[0]) / 2;
      const cy = (nw[1] + se[1]) / 2;
      const topVecX = n[0] - cx;
      const topVecY = n[1] - cy;
      const topLen = Math.hypot(topVecX, topVecY) || 1;
      const rotate: [number, number] = [
        n[0] + (topVecX / topLen) * ROTATE_OFFSET_PX,
        n[1] + (topVecY / topLen) * ROTATE_OFFSET_PX,
      ];
      const near = (p: [number, number]) =>
        Math.hypot(screenX - p[0], screenY - p[1]) <= HANDLE_HIT_PX;
      // Clamp rotate handle to container bounds — matches the drawing code so
      // the visual and hit-test positions stay in sync.
      const HANDLE_R = 6;
      const cw = containerWidth ?? Infinity;
      const ch = containerHeight ?? Infinity;
      const clampedRotate: [number, number] = [
        Math.max(HANDLE_R, Math.min(cw - HANDLE_R, rotate[0])),
        Math.max(HANDLE_R, Math.min(ch - HANDLE_R, rotate[1])),
      ];
      if (near(clampedRotate)) return 'rotate';
      if (near(nw)) return 'nw';
      if (near(ne)) return 'ne';
      if (near(se)) return 'se';
      if (near(sw)) return 'sw';
      if (near(n)) return 'n';
      if (near(s)) return 's';
      if (near(w)) return 'w';
      if (near(e)) return 'e';
      // Body test: point-in-quad via signed edge checks so rotated bboxes
      // still work.
      const inside = pointInQuad([screenX, screenY], [nw, ne, se, sw]);
      if (inside) return 'body';
      return null;
    },
    [transformedCorners],
  );

  return {
    bbox,
    pending,
    isPending: pending !== null,
    beginPending,
    setMatrix,
    multiplyMatrixLeft,
    commit,
    cancel,
    hitTestHandle,
    transformedCorners,
  };
}

/** Ray-cast point-in-convex-quad. Quad must be in clockwise order (NW → NE → SE → SW). */
function pointInQuad(
  p: [number, number],
  quad: [[number, number], [number, number], [number, number], [number, number]],
): boolean {
  // For a convex CW polygon, the point is inside when it lies on the right
  // side of every edge. Cross product sign tells us which side.
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (cross === 0) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (sign !== s) return false;
  }
  return true;
}
