/**
 * Curated list of predefined colour palettes for the editor. The palette
 * selection is stored per-drawing (`Drawing.paletteId`); custom colours added
 * via the "+" picker live in a separate global list shared across drawings.
 *
 * Changing palettes never mutates canvas pixels — only which swatches are
 * displayed in the toolbar.
 */

export interface Palette {
  id: string;
  name: string;
  colors: string[];
}

export const DEFAULT_PALETTE_ID = 'default';

export const PALETTES: Palette[] = [
  // 'default' = the current 16-color array hard-coded in EditorView.tsx today
  { id: 'default', name: 'Default', colors: [
    '#000000','#ffffff','#ff0000','#00aa00','#0000ff','#ffff00','#ff8800','#aa00aa',
    '#00aaaa','#aaaaaa','#555555','#ff5555','#55ff55','#5555ff','#ffaa00','#ff55ff',
  ]},
  { id: 'pico-8', name: 'Pico-8', colors: [
    '#000000','#1d2b53','#7e2553','#008751','#ab5236','#5f574f','#c2c3c7','#fff1e8',
    '#ff004d','#ffa300','#ffec27','#00e436','#29adff','#83769c','#ff77a8','#ffccaa',
  ]},
  { id: 'gameboy', name: 'Game Boy', colors: [
    '#0f380f','#306230','#8bac0f','#9bbc0f',
  ]},
  { id: 'nes', name: 'NES', colors: [
    // 54 canonical NES colors (2C02). Widely-cited set.
    '#7c7c7c','#0000fc','#0000bc','#4428bc','#940084','#a80020','#a81000','#881400',
    '#503000','#007800','#006800','#005800','#004058','#000000','#000000','#000000',
    '#bcbcbc','#0078f8','#0058f8','#6844fc','#d800cc','#e40058','#f83800','#e45c10',
    '#ac7c00','#00b800','#00a800','#00a844','#008888','#000000','#000000','#000000',
    '#f8f8f8','#3cbcfc','#6888fc','#9878f8','#f878f8','#f85898','#f87858','#fca044',
    '#f8b800','#b8f818','#58d854','#58f898','#00e8d8','#787878','#000000','#000000',
    '#fcfcfc','#a4e4fc','#b8b8f8','#d8b8f8','#f8b8f8','#f8a4c0',
  ]},
  { id: 'sweetie-16', name: 'Sweetie 16', colors: [
    '#1a1c2c','#5d275d','#b13e53','#ef7d57','#ffcd75','#a7f070','#38b764','#257179',
    '#29366f','#3b5dc9','#41a6f6','#73eff7','#f4f4f4','#94b0c2','#566c86','#333c57',
  ]},
  { id: 'db16', name: 'DB16', colors: [
    '#140c1c','#442434','#30346d','#4e4a4e','#854c30','#346524','#d04648','#757161',
    '#597dce','#d27d2c','#8595a1','#6daa2c','#d2aa99','#6dc2ca','#dad45e','#deeed6',
  ]},
  { id: 'db32', name: 'DB32', colors: [
    '#000000','#222034','#45283c','#663931','#8f563b','#df7126','#d9a066','#eec39a',
    '#fbf236','#99e550','#6abe30','#37946e','#4b692f','#524b24','#323c39','#3f3f74',
    '#306082','#5b6ee1','#639bff','#5fcde4','#cbdbfc','#ffffff','#9badb7','#847e87',
    '#696a6a','#595652','#76428a','#ac3232','#d95763','#d77bba','#8f974a','#8a6f30',
  ]},
  { id: 'metallic', name: 'Metallic', colors: [
    '#d4af37','#c5a028','#b5942c','#cd7f32','#b87333','#a0522d','#8c6f47','#6b4c2a',
    '#e5e4e2','#dbe4eb','#c0c0c0','#a8a8a8','#878681','#4f5761','#43464b','#2b2f33',
  ]},
  { id: 'pastel', name: 'Pastel', colors: [
    '#ffd5c2','#ffcfa4','#ffb5a7','#f7bfbe','#ffc2d1','#ffc6ff','#e8c7c8','#e0c3fc',
    '#c8c8ff','#c2e7ff','#b5ead7','#c7f0bd','#cadcae','#fff5b8','#fff3b0','#fff1d6',
  ]},
  { id: 'nature', name: 'Nature', colors: [
    '#0f4c3a','#2d5016','#4a7c2e','#8a9a5b','#cadcae','#d4a574','#e1c699','#f4b942',
    '#e07a39','#a0522d','#8b6f47','#5d4037','#8b2d30','#857b6d','#4a7aa0','#87ceeb',
  ]},
];

/**
 * Resolve a palette by id, falling back to Default for unknown/undefined ids.
 * Always returns a palette so consumers don't need to null-check.
 */
export function getPalette(id: string | undefined): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}
