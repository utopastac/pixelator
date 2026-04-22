import { resolveSize, type SizeSmMd } from '@/utils/resolveSize';

/**
 * Toolbar icon pixel bases + mobile scale. Keep in sync with
 * `--toolbar-button-icon-*` and `html[data-mobile]` overrides in
 * `src/styles/tokens.css`.
 */
export const TOOLBAR_ICON_SM_PX = 16;
export const TOOLBAR_ICON_MD_PX = 18;

/** Multiplier for toolbar icon + hit area on `html[data-mobile='true']`. */
export const TOOLBAR_MOBILE_SCALE = 1.2;

export function toolbarIconPixel(size: SizeSmMd | undefined, isMobile: boolean): number {
  const r = resolveSize(size, 'md');
  const base = r === 'sm' ? TOOLBAR_ICON_SM_PX : TOOLBAR_ICON_MD_PX;
  return Math.round(base * (isMobile ? TOOLBAR_MOBILE_SCALE : 1));
}
