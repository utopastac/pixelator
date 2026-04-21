/**
 * PNG rasterization for PixelArtEditor. Renders a flat pixel array to an
 * offscreen canvas at the requested scale and returns a PNG Blob.
 *
 * Empty cells stay transparent (the canvas is not pre-filled), so the resulting
 * PNG preserves alpha — no grid lines, no white background. This differs from
 * the editor's committed-canvas rendering, which intentionally paints a white
 * backdrop + grid for editing.
 */
export async function pixelsToPngBlob(
  pixels: string[],
  width: number,
  height: number,
  scale: number,
): Promise<Blob> {
  if (scale < 1 || !Number.isFinite(scale)) {
    throw new Error(`pixelsToPngBlob: scale must be >= 1 (got ${scale})`);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('pixelsToPngBlob: 2D context unavailable');

  for (let i = 0; i < pixels.length; i++) {
    const color = pixels[i];
    if (!color) continue;
    const col = i % width;
    const row = Math.floor(i / width);
    ctx.fillStyle = color;
    ctx.fillRect(col * scale, row * scale, scale, scale);
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('pixelsToPngBlob: canvas.toBlob returned null'));
        else resolve(blob);
      },
      'image/png',
    );
  });
}
