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
