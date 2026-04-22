/**
 * Canvas 2D drawing helpers for the PixelArtEditor grid. Each function accepts
 * an HTMLCanvasElement and renders a specific layer (committed pixels, in-progress
 * preview, or anchor markers). All functions gracefully no-op when
 * `canvas.getContext('2d')` returns null (e.g. in jsdom during tests).
 *
 * Since Phase 1 of the viewport refactor, every canvas is sized 1:1 with the
 * logical pixel grid — one raster pixel = one logical pixel. Visual scale comes
 * from a CSS transform applied to the wrapper, so these helpers no longer take
 * a `cellSize` argument; they operate in pure cell coordinates.
 */

import { type PixelArtSelection } from './pixelArtUtils';

/**
 * Paints opaque cells as horizontal runs (`fillRect(col, row, width, 1)`),
 * one colour per run. Dramatically fewer draw calls than per-pixel fills on
 * large grids (e.g. 256×256) while preserving identical pixels.
 */
function paintOpaquePixelRuns(
  ctx: CanvasRenderingContext2D,
  pixels: string[],
  logicalWidth: number,
  nRows: number,
): void {
  const maxCells = pixels.length;
  for (let row = 0; row < nRows; row++) {
    const rowStart = row * logicalWidth;
    if (rowStart >= maxCells) break;
    let col = 0;
    while (col < logicalWidth) {
      const i = rowStart + col;
      if (i >= maxCells) break;
      const color = pixels[i];
      if (!color) {
        col++;
        continue;
      }
      let run = 1;
      while (col + run < logicalWidth) {
        const j = rowStart + col + run;
        if (j >= maxCells) break;
        if (pixels[j] !== color) break;
        run++;
      }
      ctx.fillStyle = color;
      ctx.fillRect(col, row, run, 1);
      col += run;
    }
  }
}

/**
 * Redraws the committed pixel state onto the canvas, including the background
 * and all painted cells. The grid is intentionally not drawn at unit scale —
 * it would be 1px wide, i.e. invisible after upscaling via CSS. A future phase
 * will draw a zoom-aware grid overlay on a separate layer.
 *
 * @param canvas - The canvas element to draw into. Must be sized `width × height`.
 * @param pixels - Flat row-major pixel array; empty strings are treated as transparent.
 * @param logicalWidth - Grid width in cells (= canvas.width).
 */
export function drawCommitted(
  canvas: HTMLCanvasElement,
  pixels: string[],
  logicalWidth: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  paintOpaquePixelRuns(ctx, pixels, logicalWidth, canvas.height);
}

/**
 * Rasterises `pixels` onto `canvas` WITHOUT painting any background. Used for
 * per-layer offscreen canvases, which must stay transparent where no cell is
 * painted so upper layers can composite correctly. Contrast with
 * `drawCommitted`, which also paints a white fullbleed first for the
 * single-layer editor rendering.
 *
 * @param canvas - The canvas element to draw into. Must be sized `width × height`.
 * @param pixels - Flat row-major pixel array; empty strings are skipped.
 * @param logicalWidth - Grid width in cells (= canvas.width).
 */
export function drawLayer(
  canvas: HTMLCanvasElement,
  pixels: string[],
  logicalWidth: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  paintOpaquePixelRuns(ctx, pixels, logicalWidth, canvas.height);
}

/**
 * Draws a semi-transparent preview of cells that would be painted if the user
 * commits the current gesture (e.g. a shape being dragged out). Rendered at
 * `globalAlpha` 0.7 so the committed layer beneath remains visible.
 *
 * This function clears its canvas before drawing, so the preview canvas should
 * be a separate overlay element above the committed canvas.
 *
 * @param canvas - The overlay canvas element to draw into.
 * @param cells - Array of [col, row] pairs to preview.
 * @param color - Hex colour string to paint; falls back to `#000000` if empty.
 */
export function drawPreview(
  canvas: HTMLCanvasElement,
  cells: Array<[number, number]>,
  color: string,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = color || '#000000';
  for (const [col, row] of cells) {
    ctx.fillRect(col, row, 1, 1);
  }
  ctx.globalAlpha = 1;
}

/**
 * Draws a marching-ants selection overlay onto the given canvas. The canvas
 * should be a transparent overlay positioned above the committed and preview
 * canvases. Call this every animation frame (or on `marchingAntsOffset` tick)
 * to animate the ants.
 *
 * Stroke widths are expressed in raster pixels, which become visually scaled
 * by the wrapper's CSS transform — the marching ants therefore stay "one pixel
 * thick relative to the grid" regardless of zoom. If the dash pattern looks
 * wrong at high zoom in practice, revisit this together with the zoom-aware
 * grid work planned for Phase 2.
 *
 * @param canvas - The overlay canvas element to draw into.
 * @param sel - Selection bounds in grid cell coordinates (inclusive).
 * @param marchingAntsOffset - Dash offset used to animate the border (0–7).
 * @param gridWidth - Grid width in cells (used for cell-set selections).
 */
export function drawSelectionOverlay(
  canvas: HTMLCanvasElement,
  sel: PixelArtSelection,
  marchingAntsOffset: number,
  gridWidth?: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (sel.shape === 'cells') {
    const gw = gridWidth ?? canvas.width;
    // Semi-transparent fill
    ctx.fillStyle = 'rgba(100, 160, 255, 0.15)';
    for (const idx of sel.cells) {
      const col = idx % gw;
      const row = Math.floor(idx / gw);
      ctx.fillRect(col, row, 1, 1);
    }
    // Helper: builds edge path for the entire cells boundary
    const buildEdgePath = () => {
      ctx.beginPath();
      for (const idx of sel.cells) {
        const col = idx % gw;
        const row = Math.floor(idx / gw);
        const px = col, py = row;
        // Top edge
        if (!sel.cells.has((row - 1) * gw + col)) {
          ctx.moveTo(px, py); ctx.lineTo(px + 1, py);
        }
        // Bottom edge
        if (!sel.cells.has((row + 1) * gw + col)) {
          ctx.moveTo(px, py + 1); ctx.lineTo(px + 1, py + 1);
        }
        // Left edge (guard against row-wrap)
        if (col === 0 || !sel.cells.has(row * gw + col - 1)) {
          ctx.moveTo(px, py); ctx.lineTo(px, py + 1);
        }
        // Right edge
        if (col === gw - 1 || !sel.cells.has(row * gw + col + 1)) {
          ctx.moveTo(px + 1, py); ctx.lineTo(px + 1, py + 1);
        }
      }
    };
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    buildEdgePath();
    ctx.stroke();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -marchingAntsOffset;
    buildEdgePath();
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }

  const x = Math.min(sel.x1, sel.x2);
  const y = Math.min(sel.y1, sel.y2);
  const w = Math.abs(sel.x2 - sel.x1) + 1;
  const h = Math.abs(sel.y2 - sel.y1) + 1;

  if (sel.shape === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(100, 160, 255, 0.15)';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -marchingAntsOffset;
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }

  // rect (original logic, now in unit coords)
  ctx.fillStyle = 'rgba(100, 160, 255, 0.15)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.lineDashOffset = -marchingAntsOffset;
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
}

/**
 * Renders anchor point indicators for multi-point tools (e.g. the second
 * anchor of a line or shape). Each anchor cell is drawn as a white-filled
 * square with a dark outline so it is visible against any background colour.
 *
 * No-ops if there are no anchors to draw.
 *
 * @param canvas - The overlay canvas element to draw into.
 * @param anchors - Array of [col, row] pairs to mark as anchors.
 */
export function drawAnchorDots(
  canvas: HTMLCanvasElement,
  anchors: Array<[number, number]>,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || anchors.length === 0) return;
  for (const [col, row] of anchors) {
    // White fill with dark border so it's visible on any colour.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(col, row, 1, 1);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(col, row, 1, 1);
  }
}

/**
 * Draws the editor's UI affordances (marching-ants selection outline, pen
 * anchor markers) onto a screen-space overlay canvas that sits OUTSIDE the
 * viewport transform. Because this canvas isn't scaled by CSS transform, the
 * ants and dots stay 1 CSS pixel thick / a consistent handle size at any zoom.
 *
 * @param canvas - Overlay canvas sized to the container in CSS pixels.
 * @param params.selection - Current marquee selection, or null.
 * @param params.anchors - Pen tool anchor cells (empty array if not active).
 * @param params.gridWidth - Grid width in cells (needed for cell-set selections).
 * @param params.zoom - CSS pixels per cell.
 * @param params.panX - Horizontal offset of the pixel grid's origin, CSS pixels.
 * @param params.panY - Vertical offset, CSS pixels.
 * @param params.marchingAntsOffset - Dash offset for the ants animation (0–7).
 */
/** One external edge of a cell-based selection, in grid cell coordinates.
 *  x1,y1 is the start corner; x2,y2 is the end corner. */
export interface EdgeSegment { x1: number; y1: number; x2: number; y2: number }

/**
 * Returns the external edges of a cell-based selection — edges that border a
 * cell that is NOT in the selection set. Each segment is in grid cell
 * coordinates (not screen pixels). Used by drawScreenOverlay to draw marching
 * ants on cell selections.
 */
export function getSelectionEdgeSegments(
  cells: ReadonlySet<number>,
  gridWidth: number,
): EdgeSegment[] {
  const segs: EdgeSegment[] = [];
  for (const idx of cells) {
    const col = idx % gridWidth;
    const row = Math.floor(idx / gridWidth);
    if (!cells.has((row - 1) * gridWidth + col))        segs.push({ x1: col, y1: row,     x2: col + 1, y2: row });
    if (!cells.has((row + 1) * gridWidth + col))        segs.push({ x1: col, y1: row + 1, x2: col + 1, y2: row + 1 });
    if (col === 0 || !cells.has(row * gridWidth + col - 1))              segs.push({ x1: col, y1: row, x2: col, y2: row + 1 });
    if (col === gridWidth - 1 || !cells.has(row * gridWidth + col + 1)) segs.push({ x1: col + 1, y1: row, x2: col + 1, y2: row + 1 });
  }
  return segs;
}

/** Transformed bbox corners (NW → NE → SE → SW, clockwise) in source grid
 *  coordinates, already matrix-applied. Passed into `drawScreenOverlay` to
 *  render the Move-tool transform handles. */
export interface TransformBoxOverlay {
  corners: Array<[number, number]>;
}

export function drawScreenOverlay(
  canvas: HTMLCanvasElement,
  params: {
    selection: PixelArtSelection | null;
    anchors: Array<[number, number]>;
    gridWidth: number;
    zoom: number;
    panX: number;
    panY: number;
    marchingAntsOffset: number;
    /** When provided, renders the tight-bbox transform frame with 8 handles
     *  + a rotate handle. Rendered on top of the selection/anchor visuals. */
    transformBox?: TransformBoxOverlay | null;
    /** Polygon-select in-progress anchor cells. Empty if tool is not active. */
    polygonAnchors?: Array<[number, number]>;
    /** Current cursor cell for the polygon-select tool, used to draw the preview edge. */
    polygonCursor?: [number, number] | null;
  },
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const { selection: sel, anchors, gridWidth, zoom, panX, panY, marchingAntsOffset } = params;

  // Cell → screen-pixel corner.
  const sx = (col: number) => panX + col * zoom;
  const sy = (row: number) => panY + row * zoom;

  if (sel) {
    if (sel.shape === 'cells') {
      ctx.fillStyle = 'rgba(100, 160, 255, 0.15)';
      for (const idx of sel.cells) {
        const col = idx % gridWidth;
        const row = Math.floor(idx / gridWidth);
        ctx.fillRect(sx(col), sy(row), zoom, zoom);
      }
      const segs = getSelectionEdgeSegments(sel.cells, gridWidth);
      const buildEdgePath = () => {
        ctx.beginPath();
        for (const { x1, y1, x2, y2 } of segs) {
          ctx.moveTo(sx(x1), sy(y1));
          ctx.lineTo(sx(x2), sy(y2));
        }
      };
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      buildEdgePath();
      ctx.stroke();
      ctx.strokeStyle = '#000000';
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -marchingAntsOffset;
      buildEdgePath();
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const x1 = Math.min(sel.x1, sel.x2);
      const y1 = Math.min(sel.y1, sel.y2);
      const x2 = Math.max(sel.x1, sel.x2) + 1;
      const y2 = Math.max(sel.y1, sel.y2) + 1;
      const rx = sx(x1), ry = sy(y1), rw = (x2 - x1) * zoom, rh = (y2 - y1) * zoom;

      if (sel.shape === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(rx + rw / 2, ry + rh / 2, rw / 2, rh / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100, 160, 255, 0.15)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.strokeStyle = '#000000';
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -marchingAntsOffset;
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = 'rgba(100, 160, 255, 0.15)';
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.strokeStyle = '#000000';
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -marchingAntsOffset;
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.setLineDash([]);
      }
    }
  }

  // Pen anchor dots — small filled circles at cell centres, 1 CSS pixel white ring.
  if (anchors.length > 0) {
    for (const [col, row] of anchors) {
      const cx = sx(col) + zoom / 2;
      const cy = sy(row) + zoom / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#000000';
      ctx.stroke();
    }
  }

  // Transform box (Move tool, no selection). Rendered last so it sits above
  // the selection/anchors. Corners are in source grid coords post-matrix —
  // the caller is responsible for applying the pending matrix before passing
  // them in.
  const transformBox = params.transformBox;
  if (transformBox && transformBox.corners.length === 4) {
    const toScreen = ([gx, gy]: [number, number]) =>
      [panX + gx * zoom, panY + gy * zoom] as [number, number];
    const [nw, ne, se, sw] = transformBox.corners.map(toScreen);

    // Bbox outline: 1 CSS pixel, halo + dark so it's visible on any
    // background.
    const outline = () => {
      ctx.beginPath();
      ctx.moveTo(nw[0], nw[1]);
      ctx.lineTo(ne[0], ne[1]);
      ctx.lineTo(se[0], se[1]);
      ctx.lineTo(sw[0], sw[1]);
      ctx.closePath();
    };
    ctx.setLineDash([]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    outline();
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000000';
    outline();
    ctx.stroke();

    const mid = (a: [number, number], b: [number, number]): [number, number] =>
      [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const n = mid(nw, ne);
    const s = mid(sw, se);
    const w = mid(nw, sw);
    const e = mid(ne, se);
    const handles: Array<[number, number]> = [nw, ne, se, sw, n, s, w, e];

    // 8 scale/stretch handles: 8 CSS pixel squares, white fill + dark border.
    const HANDLE_SZ = 8;
    ctx.setLineDash([]);
    for (const [hx, hy] of handles) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx - HANDLE_SZ / 2, hy - HANDLE_SZ / 2, HANDLE_SZ, HANDLE_SZ);
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(hx - HANDLE_SZ / 2, hy - HANDLE_SZ / 2, HANDLE_SZ, HANDLE_SZ);
    }

    // Rotate handle: 24 CSS pixels out from the top-edge midpoint,
    // perpendicular to that edge (so it still points "above" the bbox even
    // when rotated). Clamped to stay within the committed-canvas area so the
    // handle is always reachable when content fills the grid.
    const bcx = (nw[0] + se[0]) / 2;
    const bcy = (nw[1] + se[1]) / 2;
    const topVecX = n[0] - bcx;
    const topVecY = n[1] - bcy;
    const topLen = Math.hypot(topVecX, topVecY) || 1;
    const ROTATE_DIST = 24;
    const HANDLE_R = 6;
    const rawRx = n[0] + (topVecX / topLen) * ROTATE_DIST;
    const rawRy = n[1] + (topVecY / topLen) * ROTATE_DIST;
    const rx = Math.max(HANDLE_R, Math.min(canvas.width - HANDLE_R, rawRx));
    const ry = Math.max(HANDLE_R, Math.min(canvas.height - HANDLE_R, rawRy));

    // Connector line from top midpoint to rotate handle.
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(n[0], n[1]);
    ctx.lineTo(rx, ry);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(n[0], n[1]);
    ctx.lineTo(rx, ry);
    ctx.stroke();

    // Rotate handle circle (6 CSS pixel radius).
    ctx.beginPath();
    ctx.arc(rx, ry, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000000';
    ctx.stroke();
  }

  // Polygon-select in-progress overlay: marching ants on committed edges,
  // faint preview from last anchor to cursor (and back to first anchor),
  // anchor dots at each vertex.
  const polygonAnchors = params.polygonAnchors;
  const polygonCursor = params.polygonCursor;
  if (polygonAnchors && polygonAnchors.length > 0) {
    const pts = polygonAnchors.map(([c, r]) => [sx(c) + zoom / 2, sy(r) + zoom / 2] as [number, number]);
    const cursorPt = polygonCursor ? [sx(polygonCursor[0]) + zoom / 2, sy(polygonCursor[1]) + zoom / 2] as [number, number] : null;

    if (pts.length >= 2) {
      const buildPath = () => {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      };
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      buildPath();
      ctx.stroke();
      ctx.strokeStyle = '#000000';
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -marchingAntsOffset;
      buildPath();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (cursorPt) {
      const last = pts[pts.length - 1];
      const first = pts[0];
      ctx.beginPath();
      ctx.moveTo(last[0], last[1]);
      ctx.lineTo(cursorPt[0], cursorPt[1]);
      if (pts.length >= 2) ctx.lineTo(first[0], first[1]);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -marchingAntsOffset;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const [col, row] of polygonAnchors) {
      const cx = sx(col) + zoom / 2;
      const cy = sy(row) + zoom / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#000000';
      ctx.stroke();
    }
  }
}

/**
 * Draws the pixel-grid overlay onto a full-container-size canvas in screen
 * space. Drawing directly in screen coordinates (rather than relying on CSS
 * transforms) avoids the subpixel compositing misalignment Safari has between
 * CSS-transformed elements and their layout-positioned siblings.
 *
 * @param canvas - Sized to the container (not the logical grid).
 * @param opts.zoom - Current zoom level (CSS px per logical cell).
 * @param opts.panX - Horizontal pan offset in CSS pixels.
 * @param opts.panY - Vertical pan offset in CSS pixels.
 * @param opts.width - Grid width in logical pixels.
 * @param opts.height - Grid height in logical pixels.
 */
export function drawGridOverlay(
  canvas: HTMLCanvasElement,
  opts: { zoom: number; panX: number; panY: number; width: number; height: number },
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { zoom, panX, panY, width, height } = opts;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.lineWidth = 1;

  ctx.beginPath();

  // +0.5 snaps each line centre onto a physical half-pixel so the 1 px stroke
  // lands on exactly one pixel row/column when pan/zoom land on whole pixels.

  for (let col = 0; col <= width; col++) {
    const x = panX + col * zoom + 0.5;
    ctx.moveTo(x, panY);
    ctx.lineTo(x, panY + height * zoom);
  }

  for (let row = 0; row <= height; row++) {
    const y = panY + row * zoom + 0.5;
    ctx.moveTo(panX, y);
    ctx.lineTo(panX + width * zoom, y);
  }

  ctx.stroke();
}
