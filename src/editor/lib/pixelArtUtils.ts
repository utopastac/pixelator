/**
 * Re-exports from the domain modules that make up the pixel-art utility layer.
 * Kept as a barrel so existing imports (`from '../lib/pixelArtUtils'`) continue
 * to resolve without change.
 *
 *   pixelArtBrush.ts    — brush sizes, applyBrush, applyBrushInPlace, expandCellsWithBrush,
 *                         collectStrokeDirtyIndices
 *   pixelArtFormat.ts   — HEX_REGEX, DEFAULT_PALETTE, GRID_COLOR,
 *                         resizeLayerCentered, parseSvgToPixels, pixelsToSvg
 *   pixelArtGeometry.ts — bresenhamLine, rectCells, ellipseCells,
 *                         triangleCells, starCells, arrowCells
 *   pixelArtFill.ts     — floodFill, floodSelect, maskToSelection,
 *                         PixelArtSelection, MARCHING_ANTS_*
 *   pixelArtShapes.ts   — SHAPE_TOOLS, isShapeTool, getShapeCells,
 *                         constrainToSquare, constrainLineTo45
 */

export * from './pixelArtBrush';
export * from './pixelArtFormat';
export * from './pixelArtGeometry';
export * from './pixelArtFill';
export * from './pixelArtShapes';
