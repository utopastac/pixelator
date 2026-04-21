/**
 * Tests for `loadStore` / `saveStore` and the v1 → v2 auto-migration path
 * inside `loadStore`. jsdom provides a real localStorage; we clear it
 * between tests to isolate state.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadStore,
  saveStore,
  createDefaultLayer,
  type StoreShape,
  type LegacyDrawingV1,
} from './storage';
import { pixelsToSvg } from '@/editor/lib/pixelArtUtils';

const KEY = 'pixelator.store';

beforeEach(() => {
  localStorage.clear();
});

describe('loadStore', () => {
  it('returns the empty v2 shape when localStorage is empty', () => {
    const store = loadStore();
    expect(store.schemaVersion).toBe(2);
    expect(store.drawings).toEqual([]);
    expect(store.currentDrawingId).toBeNull();
  });

  it('returns a v2 payload verbatim', () => {
    const layer = createDefaultLayer(2, 2);
    const store: StoreShape = {
      schemaVersion: 2,
      drawings: [
        {
          id: 'd1',
          name: 'Test',
          width: 2,
          height: 2,
          layers: [layer],
          activeLayerId: layer.id,
          createdAt: 1,
          updatedAt: 2,
        },
      ],
      currentDrawingId: 'd1',
    };
    localStorage.setItem(KEY, JSON.stringify(store));
    expect(loadStore()).toEqual(store);
  });

  it('migrates a v1 payload to v2 and writes it back to localStorage', () => {
    const pixels = new Array<string>(4).fill('');
    pixels[0] = '#ff0000';
    const legacy: LegacyDrawingV1 = {
      id: 'old',
      name: 'Legacy',
      width: 2,
      height: 2,
      svg: pixelsToSvg(pixels, 2, 2),
      createdAt: 100,
      updatedAt: 200,
    };
    localStorage.setItem(
      KEY,
      JSON.stringify({ schemaVersion: 1, drawings: [legacy], currentDrawingId: 'old' }),
    );

    const migrated = loadStore();
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.drawings).toHaveLength(1);
    expect(migrated.drawings[0].id).toBe('old');
    expect(migrated.drawings[0].layers).toHaveLength(1);
    expect(migrated.drawings[0].layers[0].name).toBe('Background');
    expect(migrated.drawings[0].layers[0].pixels).toEqual(pixels);
    expect(migrated.currentDrawingId).toBe('old');

    // Write-back side effect: reading the raw localStorage should now show v2.
    const raw = JSON.parse(localStorage.getItem(KEY)!);
    expect(raw.schemaVersion).toBe(2);
  });

  it('returns empty store on corrupt JSON', () => {
    localStorage.setItem(KEY, '{not json');
    const store = loadStore();
    expect(store.drawings).toEqual([]);
    expect(store.schemaVersion).toBe(2);
  });
});

describe('saveStore ↔ loadStore round trip', () => {
  it('persists and reloads an arbitrary v2 store exactly', () => {
    const bg = createDefaultLayer(3, 3);
    const fg = createDefaultLayer(3, 3);
    const store: StoreShape = {
      schemaVersion: 2,
      drawings: [
        {
          id: 'x',
          name: 'X',
          width: 3,
          height: 3,
          layers: [bg, fg],
          activeLayerId: fg.id,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      currentDrawingId: 'x',
    };
    saveStore(store);
    expect(loadStore()).toEqual(store);
  });
});
