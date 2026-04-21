/**
 * Layered drawing data model (schema v2) + localStorage persistence.
 *
 * A drawing is composed of one or more layers, each holding its own flat,
 * row-major pixel array (empty string = transparent cell). Layers stack from
 * bottom → top (index 0 is bottom). The `activeLayerId` points to the layer
 * receiving tool input; it is not part of history.
 *
 * On `loadStore()` a persisted v1 blob is migrated in-memory to v2 and
 * written back immediately so subsequent loads skip the migration path.
 */

import { migrateStoreV1ToV2 } from './migrate';

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  pixels: string[];
  /** When true, the layer rejects paint/erase/fill/shape/pen commits — its
   *  pixels are read-only. Absent on older stored drawings is treated as
   *  "unlocked", so this is optional for backward compatibility without a
   *  schema-version bump. */
  locked?: boolean;
}

export interface Drawing {
  id: string;
  name: string;
  width: number;
  height: number;
  layers: Layer[];
  activeLayerId: string;
  createdAt: number;
  updatedAt: number;
  /** Id of the palette used for swatch display. Absent = Default palette.
   *  Palette selection never mutates canvas pixels; it only changes which
   *  swatches appear in the toolbar. Optional so existing stored drawings
   *  decode cleanly without a schema-version bump. */
  paletteId?: string;
}

export interface StoreShape {
  schemaVersion: 2;
  drawings: Drawing[];
  currentDrawingId: string | null;
}

// Legacy v1 types — used only by the migration path. Kept internal so
// downstream code only sees the v2 shape.
export interface LegacyDrawingV1 {
  id: string;
  name: string;
  width: number;
  height: number;
  svg: string;
  createdAt: number;
  updatedAt: number;
}

interface LegacyStoreV1 {
  schemaVersion: 1;
  drawings: LegacyDrawingV1[];
  currentDrawingId: string | null;
}

const KEY = 'pixelator.store';

const empty = (): StoreShape => ({
  schemaVersion: 2,
  drawings: [],
  currentDrawingId: null,
});

/**
 * Read the v2 store from localStorage, running the v1 → v2 migration
 * in-memory and writing the result back if needed. Returns an empty store on
 * missing key, JSON parse error, or unrecognised schema version.
 */
export function loadStore(): StoreShape {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as StoreShape | LegacyStoreV1 | { schemaVersion?: number };

    // v2 fast path.
    if (parsed && (parsed as StoreShape).schemaVersion === 2 && Array.isArray((parsed as StoreShape).drawings)) {
      return parsed as StoreShape;
    }

    // v1 → v2 migration. `migrate.ts` only depends on types from this module,
    // so the static import is not a runtime cycle.
    if (parsed && (parsed as LegacyStoreV1).schemaVersion === 1 && Array.isArray((parsed as LegacyStoreV1).drawings)) {
      const migrated = migrateStoreV1ToV2(parsed as LegacyStoreV1);
      saveStore(migrated);
      return migrated;
    }

    return empty();
  } catch {
    return empty();
  }
}

/** Persist the store to localStorage. Logs (but does not throw) on quota errors. */
export function saveStore(store: StoreShape): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch (err) {
    console.error('[pixelator] Failed to persist store:', err);
  }
}

/** Generate a collision-resistant unique id using `crypto.randomUUID` with a Math.random fallback. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'd_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Create an empty pixel array (all transparent cells) of the given dimensions.
 */
export function createEmptyPixels(width: number, height: number): string[] {
  return new Array<string>(width * height).fill('');
}

/**
 * Create a default "Background" layer wrapping the given (or an empty) pixel
 * array. Used by both new-drawing flow and v1 → v2 migration.
 */
export function createDefaultLayer(
  width: number,
  height: number,
  pixels?: string[],
): Layer {
  return {
    id: newId(),
    name: 'Background',
    visible: true,
    opacity: 1,
    pixels: pixels ?? createEmptyPixels(width, height),
  };
}
