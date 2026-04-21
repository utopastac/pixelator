/**
 * Backup / restore envelope format for Pixelator.
 *
 * A backup file is a JSON blob containing one or more drawings plus optional
 * global colour lists (recents + custom). Two shapes share the same envelope:
 *   - `scope: "all"`       → whole-store export, includes colour lists.
 *   - `scope: "drawing"`   → single-drawing export, colour lists omitted.
 *
 * The `format` tag and integer `version` are what we actually validate on
 * import; any extra fields are ignored. Drawing-shape validation is deliberately
 * shallow — we trust the structural fields (id, width, height, layers,
 * activeLayerId) and reject outright if they're missing or wrong-typed. A
 * looser "best-effort repair" approach would mask genuine bad files.
 *
 * Pixel wire formats across versions:
 *   v1 — `pixels: string[]`                  full flat array, "" = transparent
 *   v2 — `pixels: Record<string,string>`      sparse object, omits transparent
 *   v3 — `palette: string[], pixels: Record<string,number>`
 *                                             sparse indexed; values are palette indices
 */

import { createDefaultLayer, newId, type Drawing, type Layer } from './storage';

export const BACKUP_FORMAT = 'pixelator-backup';
export const BACKUP_VERSION = 3;

export type BackupScope = 'all' | 'drawing';

export interface BackupEnvelope {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  scope: BackupScope;
  exportedAt: number;
  drawings: Drawing[];
  /** Only present on whole-store (`scope: "all"`) exports. */
  recentColors?: string[];
  /** Only present on whole-store (`scope: "all"`) exports. */
  customColors?: string[];
}

export interface BuildAllOptions {
  drawings: Drawing[];
  recentColors: string[];
  customColors: string[];
  now?: number;
}

export interface BuildDrawingOptions {
  drawing: Drawing;
  now?: number;
}

/** Build a whole-store envelope — drawings + both colour lists. */
export function buildAllEnvelope({
  drawings,
  recentColors,
  customColors,
  now = Date.now(),
}: BuildAllOptions): BackupEnvelope {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    scope: 'all',
    exportedAt: now,
    drawings: drawings.map(cloneDrawing),
    recentColors: [...recentColors],
    customColors: [...customColors],
  };
}

/** Build a single-drawing envelope — no colour lists. */
export function buildDrawingEnvelope({
  drawing,
  now = Date.now(),
}: BuildDrawingOptions): BackupEnvelope {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    scope: 'drawing',
    exportedAt: now,
    drawings: [cloneDrawing(drawing)],
  };
}

/**
 * Serialize a BackupEnvelope to a compact JSON string using the v3 wire
 * format: sparse pixel indices + per-layer palette, no whitespace.
 */
export function serializeEnvelope(envelope: BackupEnvelope): string {
  const wire = {
    ...envelope,
    drawings: envelope.drawings.map((d) => ({
      ...d,
      layers: d.layers.map((l) => {
        const { palette, pixels } = pixelsToIndexed(l.pixels);
        return { ...l, palette, pixels };
      }),
    })),
  };
  return JSON.stringify(wire);
}

export class BackupParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupParseError';
  }
}

/**
 * Parse a backup JSON string and validate it matches the current envelope.
 * Accepts v1 (array pixels), v2 (sparse string pixels), and v3 (sparse indexed
 * pixels) wire formats. Throws `BackupParseError` with a user-facing message
 * on any problem.
 */
export function parseEnvelope(json: string): BackupEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new BackupParseError('File is not valid JSON.');
  }
  if (!isRecord(parsed)) {
    throw new BackupParseError('Backup must be a JSON object.');
  }
  if (parsed.format !== BACKUP_FORMAT) {
    throw new BackupParseError('Not a Pixelator backup file.');
  }
  if (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== BACKUP_VERSION) {
    throw new BackupParseError(
      `Unsupported backup version ${String(parsed.version)}; expected ${BACKUP_VERSION}.`,
    );
  }
  if (parsed.scope !== 'all' && parsed.scope !== 'drawing') {
    throw new BackupParseError('Backup has an unknown scope.');
  }
  if (!Array.isArray(parsed.drawings) || parsed.drawings.length === 0) {
    throw new BackupParseError('Backup contains no drawings.');
  }
  const drawings: Drawing[] = [];
  for (const raw of parsed.drawings) {
    drawings.push(coerceDrawing(raw));
  }
  const envelope: BackupEnvelope = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    scope: parsed.scope,
    exportedAt: typeof parsed.exportedAt === 'number' ? parsed.exportedAt : Date.now(),
    drawings,
  };
  if (parsed.scope === 'all') {
    if (Array.isArray(parsed.recentColors)) {
      envelope.recentColors = parsed.recentColors.filter((s): s is string => typeof s === 'string');
    }
    if (Array.isArray(parsed.customColors)) {
      envelope.customColors = parsed.customColors.filter((s): s is string => typeof s === 'string');
    }
  }
  return envelope;
}

/**
 * Rewrite every drawing's id (and its layers' ids + activeLayerId) so they
 * can't collide with drawings already in the store on import. Pure — returns
 * a new list.
 */
export function rewriteDrawingIds(drawings: Drawing[]): Drawing[] {
  return drawings.map((d) => {
    const idMap = new Map<string, string>();
    const layers: Layer[] = d.layers.map((l) => {
      const fresh = newId();
      idMap.set(l.id, fresh);
      return { ...l, id: fresh, pixels: [...l.pixels] };
    });
    return {
      ...d,
      id: newId(),
      layers,
      activeLayerId: idMap.get(d.activeLayerId) ?? layers[0]?.id ?? d.activeLayerId,
    };
  });
}

/**
 * Merge imported drawings into an existing list (imported items go to the
 * front, matching the "new drawing prepends" convention). Pure.
 */
export function mergeDrawings(existing: Drawing[], incoming: Drawing[]): Drawing[] {
  return [...incoming, ...existing];
}

/** Sanitise a drawing name for use in a filename. Matches `exports.ts`. */
export function sanitiseFilename(name: string): string {
  return (
    name.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') ||
    'pixel-art'
  );
}

/** `YYYY-MM-DD` from a Date, in local time. */
export function formatBackupDate(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Filename conventions:
 *  - whole-store: `pixelator-backup-YYYY-MM-DD.json`
 *  - single drawing: `pixelator-<sanitisedName>-YYYY-MM-DD.json`
 */
export function backupFilename(envelope: BackupEnvelope, d: Date = new Date()): string {
  const date = formatBackupDate(d);
  if (envelope.scope === 'all') return `pixelator-backup-${date}.json`;
  const name = sanitiseFilename(envelope.drawings[0]?.name ?? 'drawing');
  return `pixelator-${name}-${date}.json`;
}

// ── internals ────────────────────────────────────────────────────────────────

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function cloneDrawing(d: Drawing): Drawing {
  return {
    ...d,
    layers: d.layers.map((l) => ({ ...l, pixels: [...l.pixels] })),
  };
}

/** Convert a full pixel array to a sparse palette-indexed wire object. */
function pixelsToIndexed(pixels: string[]): { palette: string[]; pixels: Record<string, number> } {
  const colorMap = new Map<string, number>();
  const palette: string[] = [];
  const sparse: Record<string, number> = {};
  for (let i = 0; i < pixels.length; i++) {
    const c = pixels[i];
    if (!c) continue;
    let idx = colorMap.get(c);
    if (idx === undefined) {
      idx = palette.length;
      palette.push(c);
      colorMap.set(c, idx);
    }
    sparse[String(i)] = idx;
  }
  return { palette, pixels: sparse };
}

/** Expand a sparse palette-indexed wire object back to a full pixel array. */
function indexedToPixels(
  sparse: Record<string, unknown>,
  palette: string[],
  size: number,
): string[] {
  const pixels = new Array<string>(size).fill('');
  for (const [k, v] of Object.entries(sparse)) {
    const cellIdx = Number(k);
    const colorIdx = typeof v === 'number' ? v : -1;
    if (
      Number.isFinite(cellIdx) &&
      cellIdx >= 0 &&
      cellIdx < size &&
      colorIdx >= 0 &&
      colorIdx < palette.length
    ) {
      pixels[cellIdx] = palette[colorIdx];
    }
  }
  return pixels;
}

/** Expand a sparse string-keyed wire object (v2) back to a full pixel array. */
function sparseToPixels(sparse: Record<string, unknown>, size: number): string[] {
  const pixels = new Array<string>(size).fill('');
  for (const [k, v] of Object.entries(sparse)) {
    const idx = Number(k);
    if (Number.isFinite(idx) && idx >= 0 && idx < size && typeof v === 'string') {
      pixels[idx] = v;
    }
  }
  return pixels;
}

/**
 * Structural validation for a drawing inside an imported envelope. Throws
 * `BackupParseError` on missing / wrong-typed fields. `paletteId` is optional
 * (mirrors the v2 schema); `activeLayerId` falls back to the first layer if
 * missing or stale.
 */
function coerceDrawing(raw: unknown): Drawing {
  if (!isRecord(raw)) throw new BackupParseError('Drawing entry is not an object.');
  const id = typeof raw.id === 'string' && raw.id ? raw.id : null;
  const name = typeof raw.name === 'string' ? raw.name : null;
  const width = typeof raw.width === 'number' && Number.isFinite(raw.width) ? raw.width : null;
  const height = typeof raw.height === 'number' && Number.isFinite(raw.height) ? raw.height : null;
  if (id === null || name === null || width === null || height === null) {
    throw new BackupParseError('Drawing is missing required fields.');
  }
  if (!Array.isArray(raw.layers) || raw.layers.length === 0) {
    throw new BackupParseError(`Drawing "${name}" has no layers.`);
  }
  const layers: Layer[] = raw.layers.map((l) => coerceLayer(l, width, height, name));
  const activeLayerId =
    typeof raw.activeLayerId === 'string' && layers.some((l) => l.id === raw.activeLayerId)
      ? raw.activeLayerId
      : layers[0].id;
  const now = Date.now();
  const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : now;
  const updatedAt = typeof raw.updatedAt === 'number' ? raw.updatedAt : now;
  const out: Drawing = {
    id,
    name,
    width,
    height,
    layers,
    activeLayerId,
    createdAt,
    updatedAt,
  };
  if (typeof raw.paletteId === 'string') out.paletteId = raw.paletteId;
  return out;
}

function coerceLayer(raw: unknown, width: number, height: number, drawingName: string): Layer {
  if (!isRecord(raw)) {
    throw new BackupParseError(`Drawing "${drawingName}" has an invalid layer.`);
  }
  const id = typeof raw.id === 'string' && raw.id ? raw.id : newId();
  const name = typeof raw.name === 'string' ? raw.name : 'Layer';
  const visible = typeof raw.visible === 'boolean' ? raw.visible : true;
  const opacity =
    typeof raw.opacity === 'number' && Number.isFinite(raw.opacity)
      ? Math.max(0, Math.min(1, raw.opacity))
      : 1;
  const expected = width * height;
  let pixels: string[];
  if (Array.isArray(raw.pixels)) {
    // v1: full flat array
    if (!raw.pixels.every((p) => typeof p === 'string')) {
      throw new BackupParseError(`Drawing "${drawingName}" has a layer with invalid pixels.`);
    }
    pixels = raw.pixels as string[];
    if (pixels.length !== expected) {
      // Size mismatch on one layer shouldn't lose the rest of the drawing.
      pixels = createDefaultLayer(width, height).pixels;
    }
  } else if (isRecord(raw.pixels) && Array.isArray(raw.palette)) {
    // v3: sparse indexed
    const palette = (raw.palette as unknown[]).filter((c): c is string => typeof c === 'string');
    pixels = indexedToPixels(raw.pixels, palette, expected);
  } else if (isRecord(raw.pixels)) {
    // v2: sparse string values
    pixels = sparseToPixels(raw.pixels, expected);
  } else {
    throw new BackupParseError(`Drawing "${drawingName}" has a layer with invalid pixels.`);
  }
  return { id, name, visible, opacity, pixels };
}
