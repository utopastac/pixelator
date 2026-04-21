/** Matches a valid 6-digit hex colour string (e.g. `#ff0000`). */
export const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

/**
 * The built-in colour palette shown in the editor toolbar.
 * Eight opinionated defaults covering black, white, and primary/secondary hues.
 */
export const DEFAULT_PALETTE = [
  '#000000',
  '#ffffff',
  '#ff0000',
  '#00ff00',
  '#0000ff',
  '#ffff00',
  '#ff8800',
  '#8800ff',
];

/** The colour used to draw grid lines over the canvas. */
export const GRID_COLOR = '#e0e0e0';

/**
 * Returns a new pixel array of size `newWidth × newHeight` containing the
 * source pixels centered in the new grid. Works for both grow and shrink.
 */
export function resizeLayerCentered(
  pixels: string[],
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
): string[] {
  const next = new Array<string>(newWidth * newHeight).fill('');
  const dx = Math.floor((newWidth - oldWidth) / 2);
  const dy = Math.floor((newHeight - oldHeight) / 2);
  for (let r = 0; r < newHeight; r++) {
    const srcR = r - dy;
    if (srcR < 0 || srcR >= oldHeight) continue;
    for (let c = 0; c < newWidth; c++) {
      const srcC = c - dx;
      if (srcC < 0 || srcC >= oldWidth) continue;
      next[r * newWidth + c] = pixels[srcR * oldWidth + srcC];
    }
  }
  return next;
}

/**
 * Parses an SVG string produced by `pixelsToSvg` and reconstructs the flat
 * pixel array. Uses `DOMParser` (available in browsers and jsdom).
 */
export function parseSvgToPixels(svg: string, width: number, height: number): string[] {
  const pixels = new Array<string>(width * height).fill('');
  if (!svg) return pixels;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    const rects = doc.querySelectorAll('rect');
    rects.forEach((rect) => {
      const x = parseInt(rect.getAttribute('x') ?? '0', 10);
      const y = parseInt(rect.getAttribute('y') ?? '0', 10);
      const fill = rect.getAttribute('fill') ?? '';
      if (x >= 0 && x < width && y >= 0 && y < height && fill) {
        pixels[y * width + x] = fill;
      }
    });
  } catch (err) {
    console.error('[PixelArtEditor] Failed to parse SVG value:', err);
  }
  return pixels;
}

/**
 * Serialises a flat pixel array to an SVG string. Each non-empty cell becomes
 * a `<rect>` at (col, row). Empty (transparent) cells are omitted.
 */
export function pixelsToSvg(pixels: string[], width: number, height: number): string {
  const rects: string[] = [];
  for (let i = 0; i < pixels.length; i++) {
    const color = pixels[i];
    if (!color) continue;
    const col = i % width;
    const row = Math.floor(i / width);
    rects.push(`  <rect x="${col}" y="${row}" width="1" height="1" fill="${color}"/>`);
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    ...rects,
    '</svg>',
  ].join('\n');
}
