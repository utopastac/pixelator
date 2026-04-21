/**
 * Decode a user-supplied image file and downsample it to a flat `string[]`
 * pixel array sized `gridW × gridH`. Each cell is either a `#rrggbb` hex or
 * the empty string for transparent.
 *
 * The image is fit INSIDE the target grid — if the source aspect ratio
 * differs, margins on the shorter axis stay transparent (letterbox).
 *
 * Colour sampling delegates to the browser's canvas resample (smoothing on,
 * high quality), which gives a reasonable box-average for downscaling at the
 * resolutions this editor operates at (typically 8–256 px per side). Alpha
 * is thresholded at 128 — cells whose source area is majority-transparent
 * become empty cells, which matches what users expect from PNG icons.
 */

/** Long-edge pixel cap applied to the decoded bitmap before the final
 *  grid-sized downsample. A decoded 10000×10000 ImageBitmap alone is ~400MB,
 *  which can briefly stall or crash the tab on phones and low-RAM laptops.
 *  Downsampling to a more reasonable intermediate frees that memory and costs
 *  nothing visually — we're about to resample to ≤256px anyway. */
const MAX_SOURCE_DIM = 2048;

function byteToHex(n: number): string {
  return n.toString(16).padStart(2, '0');
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${byteToHex(r)}${byteToHex(g)}${byteToHex(b)}`;
}

export async function importImageAsPixels(
  file: Blob,
  gridW: number,
  gridH: number,
): Promise<string[]> {
  if (gridW <= 0 || gridH <= 0) {
    throw new Error(`Invalid grid dimensions: ${gridW}×${gridH}`);
  }

  // `imageOrientation: 'from-image'` respects EXIF rotation — without it,
  // JPEGs from phones arrive rotated in Safari.
  let bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  // Guardrail: if the decoded image is huge, re-bitmap it into a capped size
  // before the final resample. This is cheap and saves hundreds of MB of
  // transient memory on oversized sources.
  const longEdge = Math.max(bitmap.width, bitmap.height);
  if (longEdge > MAX_SOURCE_DIM) {
    const k = MAX_SOURCE_DIM / longEdge;
    const targetW = Math.max(1, Math.round(bitmap.width * k));
    const targetH = Math.max(1, Math.round(bitmap.height * k));
    const capped = await createImageBitmap(bitmap, {
      resizeWidth: targetW,
      resizeHeight: targetH,
      resizeQuality: 'high',
    });
    bitmap.close();
    bitmap = capped;
  }

  try {
    const srcW = bitmap.width;
    const srcH = bitmap.height;

    // Letterbox: scale by the smaller ratio so the image fits inside. Round
    // to keep the draw rect on whole pixels — subpixel draw edges smear one
    // extra row / column of partial alpha into the output.
    const scale = Math.min(gridW / srcW, gridH / srcH);
    const drawW = Math.max(1, Math.round(srcW * scale));
    const drawH = Math.max(1, Math.round(srcH * scale));
    const offsetX = Math.floor((gridW - drawW) / 2);
    const offsetY = Math.floor((gridH - drawH) / 2);

    const canvas = document.createElement('canvas');
    canvas.width = gridW;
    canvas.height = gridH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D canvas context');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, offsetX, offsetY, drawW, drawH);

    const imageData = ctx.getImageData(0, 0, gridW, gridH);
    const data = imageData.data;
    const pixels: string[] = new Array(gridW * gridH);

    for (let i = 0; i < gridW * gridH; i++) {
      const base = i * 4;
      const alpha = data[base + 3];
      if (alpha < 128) {
        pixels[i] = '';
      } else {
        pixels[i] = rgbToHex(data[base], data[base + 1], data[base + 2]);
      }
    }

    return pixels;
  } finally {
    bitmap.close();
  }
}

/** Strip a filename of its extension + replace dash/underscore runs with
 *  spaces, so `my-photo.png` → `my photo`. Clamped to 24 chars, with a
 *  fallback to "Image" if nothing meaningful is left. */
export function layerNameFromFile(file: File): string {
  const base = file.name.replace(/\.[^.]+$/, '');
  const cleaned = base.replace(/[-_]+/g, ' ').trim().slice(0, 24);
  return cleaned || 'Image';
}
