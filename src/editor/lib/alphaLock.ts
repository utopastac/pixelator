/**
 * Alpha Lock (Transparency Protect): when enabled, pixel writes are restricted
 * to cells that are already opaque on the active layer. Transparent cells (`''`)
 * are left untouched. The eraser is exempt — callers must skip this filter when
 * the active color is `''`.
 */
export function applyAlphaLock(
  newPixels: string[],
  currentPixels: string[],
  enabled: boolean,
): string[] {
  if (!enabled) return newPixels;
  return newPixels.map((p, i) => (currentPixels[i] === '' ? '' : p));
}

/** Mutates `newPixels` when `enabled`; `currentPixels` is read as the pre-stroke snapshot. */
export function applyAlphaLockInPlace(
  newPixels: string[],
  currentPixels: string[],
  enabled: boolean,
): void {
  if (!enabled) return;
  for (let i = 0; i < newPixels.length; i++) {
    if (currentPixels[i] === '') newPixels[i] = '';
  }
}
