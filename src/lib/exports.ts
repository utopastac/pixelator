import { pixelsToSvg } from '@/editor/lib/pixelArtUtils';
import { pixelsToPngBlob } from '@/editor/lib/pixelArtPng';
import { flattenLayers } from '@/editor/lib/composite';
import type { Drawing } from './storage';

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sanitiseFilename(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'pixel-art';
}

/** Flatten all visible layers to SVG and trigger a browser download. */
export function exportSvg(drawing: Drawing): void {
  const pixels = flattenLayers(drawing.layers, drawing.width, drawing.height);
  const svg = pixelsToSvg(pixels, drawing.width, drawing.height);
  download(new Blob([svg], { type: 'image/svg+xml' }), `${sanitiseFilename(drawing.name)}.svg`);
}

/**
 * Flatten all visible layers to a PNG at `scale` pixels per cell and trigger
 * a browser download. Defaults to 8× so a 16×16 drawing exports at 128×128 px.
 */
export async function exportPng(drawing: Drawing, scale = 8): Promise<void> {
  const pixels = flattenLayers(drawing.layers, drawing.width, drawing.height);
  const blob = await pixelsToPngBlob(pixels, drawing.width, drawing.height, scale);
  download(blob, `${sanitiseFilename(drawing.name)}@${scale}x.png`);
}
