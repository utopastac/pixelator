/**
 * Tests for the pure backup envelope helpers. No DOM / localStorage; these are
 * all in-memory transformations.
 */
import { describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupParseError,
  backupFilename,
  buildAllEnvelope,
  buildDrawingEnvelope,
  formatBackupDate,
  mergeDrawings,
  parseEnvelope,
  rewriteDrawingIds,
  sanitiseFilename,
  serializeEnvelope,
} from './backup';
import { createDefaultLayer, type Drawing } from './storage';

function makeDrawing(overrides: Partial<Drawing> = {}): Drawing {
  const layer = createDefaultLayer(2, 2);
  return {
    id: 'd1',
    name: 'Test',
    width: 2,
    height: 2,
    layers: [layer],
    activeLayerId: layer.id,
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

describe('buildAllEnvelope', () => {
  it('wraps drawings + colour lists in a well-formed envelope', () => {
    const d = makeDrawing();
    const env = buildAllEnvelope({
      drawings: [d],
      recentColors: ['#000000', '#ffffff'],
      customColors: ['#ff0000'],
      now: 1000,
    });
    expect(env.format).toBe(BACKUP_FORMAT);
    expect(env.version).toBe(BACKUP_VERSION);
    expect(env.scope).toBe('all');
    expect(env.exportedAt).toBe(1000);
    expect(env.drawings).toHaveLength(1);
    expect(env.recentColors).toEqual(['#000000', '#ffffff']);
    expect(env.customColors).toEqual(['#ff0000']);
  });

  it('deep-clones drawings so later mutation does not leak into the envelope', () => {
    const d = makeDrawing();
    const env = buildAllEnvelope({ drawings: [d], recentColors: [], customColors: [] });
    d.layers[0].pixels[0] = '#ff0000';
    expect(env.drawings[0].layers[0].pixels[0]).toBe('');
  });
});

describe('buildDrawingEnvelope', () => {
  it('wraps a single drawing, omitting colour lists', () => {
    const d = makeDrawing({ name: 'Mine' });
    const env = buildDrawingEnvelope({ drawing: d, now: 500 });
    expect(env.scope).toBe('drawing');
    expect(env.drawings).toHaveLength(1);
    expect(env.drawings[0].name).toBe('Mine');
    expect(env.recentColors).toBeUndefined();
    expect(env.customColors).toBeUndefined();
  });
});

describe('serializeEnvelope', () => {
  it('produces compact JSON (no whitespace)', () => {
    const env = buildDrawingEnvelope({ drawing: makeDrawing(), now: 1 });
    const json = serializeEnvelope(env);
    expect(json).not.toMatch(/\n/);
    expect(json).not.toMatch(/  /);
  });

  it('omits transparent pixels and stores colour indices', () => {
    const d = makeDrawing();
    d.layers[0].pixels[1] = '#ff0000';
    d.layers[0].pixels[3] = '#ff0000';
    const json = serializeEnvelope(buildDrawingEnvelope({ drawing: d, now: 1 }));
    type WireLayer = { palette: string[]; pixels: Record<string, number> };
    const wire = JSON.parse(json) as { drawings: [{ layers: [WireLayer] }] };
    const layer = wire.drawings[0].layers[0];
    expect(layer.palette).toEqual(['#ff0000']);
    expect(layer.pixels).toEqual({ '1': 0, '3': 0 });
  });

  it('round-trips a drawing with mixed colours', () => {
    const d = makeDrawing();
    d.layers[0].pixels[0] = '#ff0000';
    d.layers[0].pixels[2] = '#00ff00';
    const env = buildDrawingEnvelope({ drawing: d, now: 1 });
    const parsed = parseEnvelope(serializeEnvelope(env));
    expect(parsed.drawings[0].layers[0].pixels).toEqual(d.layers[0].pixels);
  });

  it('round-trips a whole-store envelope', () => {
    const env = buildAllEnvelope({
      drawings: [makeDrawing()],
      recentColors: ['#000000'],
      customColors: ['#ff0000'],
      now: 100,
    });
    const parsed = parseEnvelope(serializeEnvelope(env));
    expect(parsed.drawings[0].layers[0].pixels).toEqual(env.drawings[0].layers[0].pixels);
    expect(parsed.recentColors).toEqual(env.recentColors);
    expect(parsed.customColors).toEqual(env.customColors);
  });
});

describe('parseEnvelope', () => {
  it('round-trips a single-drawing envelope', () => {
    const env = buildDrawingEnvelope({ drawing: makeDrawing(), now: 100 });
    const parsed = parseEnvelope(serializeEnvelope(env));
    expect(parsed.scope).toBe('drawing');
    expect(parsed.drawings).toHaveLength(1);
    expect(parsed.recentColors).toBeUndefined();
  });

  it('parses a v1 envelope with full array pixels', () => {
    const d = makeDrawing();
    d.layers[0].pixels[0] = '#ff0000';
    const v1 = {
      format: BACKUP_FORMAT,
      version: 1,
      scope: 'drawing' as const,
      exportedAt: 1,
      drawings: [d],
    };
    const parsed = parseEnvelope(JSON.stringify(v1));
    expect(parsed.drawings[0].layers[0].pixels[0]).toBe('#ff0000');
    expect(parsed.drawings[0].layers[0].pixels).toHaveLength(4);
  });

  it('parses a v2 envelope with sparse string pixels', () => {
    const wireLayer = { id: 'l1', name: 'Background', visible: true, opacity: 1, pixels: { '2': '#00ff00' } };
    const v2 = {
      format: BACKUP_FORMAT,
      version: 2,
      scope: 'drawing' as const,
      exportedAt: 1,
      drawings: [{
        id: 'd1', name: 'Test', width: 2, height: 2,
        layers: [wireLayer], activeLayerId: 'l1', createdAt: 1, updatedAt: 1,
      }],
    };
    const parsed = parseEnvelope(JSON.stringify(v2));
    expect(parsed.drawings[0].layers[0].pixels[2]).toBe('#00ff00');
    expect(parsed.drawings[0].layers[0].pixels).toHaveLength(4);
  });

  it('throws on non-JSON input', () => {
    expect(() => parseEnvelope('not json')).toThrow(BackupParseError);
  });

  it('throws on a JSON array (must be an object)', () => {
    expect(() => parseEnvelope('[]')).toThrow(/object/);
  });

  it('throws on wrong format tag', () => {
    expect(() =>
      parseEnvelope(JSON.stringify({ format: 'something-else', version: 1 })),
    ).toThrow(/Pixelator/);
  });

  it('throws on mismatched version', () => {
    expect(() =>
      parseEnvelope(JSON.stringify({ format: BACKUP_FORMAT, version: 99 })),
    ).toThrow(/version/);
  });

  it('throws on unknown scope', () => {
    expect(() =>
      parseEnvelope(
        JSON.stringify({
          format: BACKUP_FORMAT,
          version: BACKUP_VERSION,
          scope: 'partial',
          drawings: [makeDrawing()],
        }),
      ),
    ).toThrow(/scope/);
  });

  it('throws when drawings array is empty', () => {
    expect(() =>
      parseEnvelope(
        JSON.stringify({
          format: BACKUP_FORMAT,
          version: BACKUP_VERSION,
          scope: 'all',
          drawings: [],
        }),
      ),
    ).toThrow(/no drawings/);
  });

  it('throws on a drawing missing required fields', () => {
    expect(() =>
      parseEnvelope(
        JSON.stringify({
          format: BACKUP_FORMAT,
          version: BACKUP_VERSION,
          scope: 'all',
          drawings: [{ id: 'x' }],
        }),
      ),
    ).toThrow(/required/);
  });

  it('repairs a layer with a bad-length pixel array rather than failing', () => {
    const d = makeDrawing();
    d.layers[0].pixels = ['#ff0000']; // too short — use v1 wire format to exercise array path
    const v1 = {
      format: BACKUP_FORMAT,
      version: 1,
      scope: 'all' as const,
      exportedAt: 1,
      drawings: [d],
      recentColors: [],
      customColors: [],
    };
    const parsed = parseEnvelope(JSON.stringify(v1));
    expect(parsed.drawings[0].layers[0].pixels).toHaveLength(4);
  });

  it('falls back to the first layer when activeLayerId is stale', () => {
    const env = buildAllEnvelope({
      drawings: [makeDrawing()],
      recentColors: [],
      customColors: [],
    });
    env.drawings[0].activeLayerId = 'does-not-exist';
    const parsed = parseEnvelope(serializeEnvelope(env));
    expect(parsed.drawings[0].activeLayerId).toBe(parsed.drawings[0].layers[0].id);
  });

  it('ignores recentColors / customColors on a drawing-scoped envelope', () => {
    const env = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      scope: 'drawing' as const,
      exportedAt: 1,
      drawings: [makeDrawing()],
      recentColors: ['#111111'],
      customColors: ['#222222'],
    };
    const parsed = parseEnvelope(serializeEnvelope(env as Parameters<typeof serializeEnvelope>[0]));
    expect(parsed.recentColors).toBeUndefined();
    expect(parsed.customColors).toBeUndefined();
  });
});

describe('rewriteDrawingIds', () => {
  it('replaces drawing ids, layer ids, and remaps activeLayerId', () => {
    const d = makeDrawing();
    const oldId = d.id;
    const oldLayerId = d.layers[0].id;
    const [out] = rewriteDrawingIds([d]);
    expect(out.id).not.toBe(oldId);
    expect(out.layers[0].id).not.toBe(oldLayerId);
    expect(out.activeLayerId).toBe(out.layers[0].id);
  });

  it('does not mutate the input', () => {
    const d = makeDrawing();
    const snapshot = JSON.stringify(d);
    rewriteDrawingIds([d]);
    expect(JSON.stringify(d)).toBe(snapshot);
  });

  it('produces unique ids across multiple drawings', () => {
    const rewritten = rewriteDrawingIds([
      makeDrawing({ id: 'a' }),
      makeDrawing({ id: 'b' }),
    ]);
    const ids = rewritten.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('mergeDrawings', () => {
  it('prepends incoming drawings to existing', () => {
    const existing = [makeDrawing({ id: 'a', name: 'A' })];
    const incoming = [makeDrawing({ id: 'b', name: 'B' })];
    const out = mergeDrawings(existing, incoming);
    expect(out.map((d) => d.name)).toEqual(['B', 'A']);
  });
});

describe('filename helpers', () => {
  it('formatBackupDate produces YYYY-MM-DD', () => {
    // 2026-04-19 local — month is 0-indexed for Date constructor.
    const s = formatBackupDate(new Date(2026, 3, 19));
    expect(s).toBe('2026-04-19');
  });

  it('sanitiseFilename strips unsafe chars', () => {
    expect(sanitiseFilename('My Drawing!')).toBe('My-Drawing');
    expect(sanitiseFilename('  ')).toBe('pixel-art');
  });

  it('backupFilename uses pixelator-backup-<date> for whole-store', () => {
    const env = buildAllEnvelope({ drawings: [makeDrawing()], recentColors: [], customColors: [] });
    const fn = backupFilename(env, new Date(2026, 3, 19));
    expect(fn).toBe('pixelator-backup-2026-04-19.json');
  });

  it('backupFilename uses pixelator-<name>-<date> for single drawing', () => {
    const env = buildDrawingEnvelope({ drawing: makeDrawing({ name: 'My Cat' }) });
    const fn = backupFilename(env, new Date(2026, 3, 19));
    expect(fn).toBe('pixelator-My-Cat-2026-04-19.json');
  });
});
