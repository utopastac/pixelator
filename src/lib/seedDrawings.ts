/**
 * First-launch seed drawings. Each drawing is stored as an exported Pixelator
 * JSON file in `src/lib/seeds/` and loaded via `buildSeedFromEnvelope`.
 *
 * Seeding is versioned. The `pixelator.seeded` localStorage flag stores the
 * highest seed version the user has received. When `SEED_VERSION` is bumped
 * (new batch shipped), existing users get *just the new batch* appended on
 * their next load — their own drawings are never touched, and deleted seeds
 * don't come back. Users at the current version are a no-op. Fresh users
 * (missing flag) get every batch in order.
 *
 * Adding a new seed drawing:
 *   1. Design the drawing in the app.
 *   2. Download → Export Pixelator file → drop the .json into src/lib/seeds/.
 *   3. Import it below, add it to a new `createSeedDrawingsVN` function,
 *      bump SEED_VERSION to N, and update `seedsForUpgrade`.
 */

import type { Drawing, Layer } from './storage';
import { loadStore, newId, saveStore } from './storage';
import { parseEnvelope } from './backup';

// ── Seed JSON imports ─────────────────────────────────────────────────────

import turtleJson    from './seeds/turtle.json';
import faceJson      from './seeds/face.json';
import beachJson     from './seeds/beach.json';
import cityscapeJson from './seeds/cityscape.json';
import heartJson     from './seeds/heart.json';
import mushroomJson  from './seeds/mushroom.json';
import catJson       from './seeds/cat.json';
import rocketJson    from './seeds/rocket.json';
import icons16       from './seeds/icons-16.json';

// ── Version ───────────────────────────────────────────────────────────────

export const SEEDED_KEY = 'pixelator.seeded';

/** Highest seed version this build knows about. Bumped whenever a new batch
 *  of seed drawings ships. Users whose stored version is below this value get
 *  the *new* drawings appended on next load — existing drawings are never
 *  touched. An empty stored version (undefined / null) means "never seeded",
 *  and the whole set is installed. */
export const SEED_VERSION = 3;

// ── Envelope → seed converter ─────────────────────────────────────────────

/**
 * Convert an exported Pixelator JSON file into a seed Drawing with fresh ids.
 * All layers and palette selection are preserved; only ids are regenerated so
 * the drawing never collides with anything already in the user's store.
 */
export function buildSeedFromEnvelope(json: unknown): Drawing {
  const env = parseEnvelope(JSON.stringify(json));
  const source = env.drawings[0]!;
  const now = Date.now();
  const idMap = new Map<string, string>();
  const layers: Layer[] = source.layers.map((l) => {
    const fresh = newId();
    idMap.set(l.id, fresh);
    return { ...l, id: fresh, pixels: [...l.pixels] };
  });
  return {
    id: newId(),
    name: source.name,
    width: source.width,
    height: source.height,
    layers,
    activeLayerId: idMap.get(source.activeLayerId) ?? layers[0]!.id,
    paletteId: source.paletteId,
    createdAt: now,
    updatedAt: now,
  };
}

// ── Seed batches ──────────────────────────────────────────────────────────

/** Seed drawings shipped in the initial batch (v1 → first release). */
function createSeedDrawingsV1(): Drawing[] {
  return [turtleJson, faceJson, beachJson, cityscapeJson].map(buildSeedFromEnvelope);
}

/** Seed drawings added in the v2 batch — heart, mushroom, cat, rocket. */
function createSeedDrawingsV2(): Drawing[] {
  return [heartJson, mushroomJson, catJson, rocketJson].map(buildSeedFromEnvelope);
}

/** Seed drawings added in the v3 batch — icons. */
function createSeedDrawingsV3(): Drawing[] {
  return [icons16].map(buildSeedFromEnvelope);
}

/** All seed drawings across all shipped versions, in display order. Used for
 *  fresh installs. */
export function createSeedDrawings(): Drawing[] {
  return [...createSeedDrawingsV1(), ...createSeedDrawingsV2()];
}

// ── Seeding machinery ─────────────────────────────────────────────────────

/** Parse the persisted seed version. A missing / malformed flag is treated as
 *  "never seeded" (version 0) so a fresh install receives the full set. The
 *  literal `'1'` string used in the first shipped build is honoured as v1. */
function readSeededVersion(): number {
  try {
    const raw = localStorage.getItem(SEEDED_KEY);
    if (raw === null) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    // Throwing `localStorage` likely means we're in a sandboxed context;
    // skipping seeding is the only safe option.
    return SEED_VERSION;
  }
}

/** Build the batch of drawings for versions the user hasn't received yet. */
function seedsForUpgrade(fromVersion: number): Drawing[] {
  const next: Drawing[] = [];
  if (fromVersion < 1) next.push(...createSeedDrawingsV1());
  if (fromVersion < 2) next.push(...createSeedDrawingsV2());
  if (fromVersion < 3) next.push(...createSeedDrawingsV3());
  return next;
}

/**
 * Read the persisted store, seeding on first launch and appending any seed
 * batches the user's stored version hasn't yet received. Versioned so:
 * - Fresh installs (version 0): get every seed in order.
 * - Existing users at an older version: get only the new batches appended,
 *   their own drawings untouched.
 * - Users at the current version: no-op, even if they've deleted every seed.
 *
 * Persists to the store immediately so repeated calls (React Strict Mode,
 * double initializers) see the same final state.
 */
export function loadInitialState(): { drawings: Drawing[]; currentDrawingId: string | null } {
  const store = loadStore();
  const seededVersion = readSeededVersion();
  if (seededVersion >= SEED_VERSION) {
    return { drawings: store.drawings, currentDrawingId: store.currentDrawingId };
  }
  const newSeeds = seedsForUpgrade(seededVersion);
  // Append new seeds to the end of the list so existing user drawings stay at
  // the top of the DrawingsPanel. For fresh installs (where `store.drawings`
  // is empty) this still yields the right display order.
  const drawings = [...store.drawings, ...newSeeds];
  const currentDrawingId = store.currentDrawingId ?? drawings[0]?.id ?? null;
  saveStore({ schemaVersion: 2, drawings, currentDrawingId });
  try { localStorage.setItem(SEEDED_KEY, String(SEED_VERSION)); } catch { /* non-fatal */ }
  return { drawings, currentDrawingId };
}
