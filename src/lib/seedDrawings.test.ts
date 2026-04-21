/**
 * Tests for `loadInitialState`, `SEEDED_KEY`, and `SEED_VERSION` from
 * `seedDrawings.ts`. `loadStore` / `saveStore` are mocked so the tests don't
 * touch the real localStorage store key — only the seeded-version flag is
 * read from jsdom's real localStorage.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/storage')>();
  return {
    ...actual,
    loadStore: vi.fn(),
    saveStore: vi.fn(),
  };
});

import { loadStore, saveStore } from '@/lib/storage';
import { loadInitialState, SEEDED_KEY, SEED_VERSION } from '@/lib/seedDrawings';

const mockLoadStore = loadStore as ReturnType<typeof vi.fn>;
const mockSaveStore = saveStore as ReturnType<typeof vi.fn>;

/** Minimal empty store returned for a brand-new install. */
const emptyStore = () => ({
  schemaVersion: 2 as const,
  drawings: [],
  currentDrawingId: null,
});

/** A store that already has one user drawing. */
const storeWithDrawing = () => ({
  schemaVersion: 2 as const,
  drawings: [
    {
      id: 'user-1',
      name: 'My Drawing',
      width: 8,
      height: 8,
      layers: [
        {
          id: 'layer-1',
          name: 'Background',
          visible: true,
          opacity: 1,
          pixels: new Array(64).fill('') as string[],
        },
      ],
      activeLayerId: 'layer-1',
      createdAt: 1000,
      updatedAt: 1000,
    },
  ],
  currentDrawingId: 'user-1',
});

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  // Default: loadStore returns an empty store unless overridden per-test.
  mockLoadStore.mockReturnValue(emptyStore());
});

afterEach(() => {
  localStorage.clear();
});

describe('constants', () => {
  it('SEED_VERSION is a positive integer', () => {
    expect(Number.isInteger(SEED_VERSION)).toBe(true);
    expect(SEED_VERSION).toBeGreaterThan(0);
  });

  it('SEEDED_KEY is a non-empty string', () => {
    expect(typeof SEEDED_KEY).toBe('string');
    expect(SEEDED_KEY.length).toBeGreaterThan(0);
  });
});

describe('loadInitialState', () => {
  describe('fresh install — no seeded key in localStorage', () => {
    it('calls saveStore at least once to persist the seed drawings', () => {
      // No SEEDED_KEY set — acts as version 0 (never seeded).
      loadInitialState();
      expect(mockSaveStore).toHaveBeenCalled();
    });

    it('sets SEEDED_KEY in localStorage to the current SEED_VERSION', () => {
      loadInitialState();
      expect(localStorage.getItem(SEEDED_KEY)).toBe(String(SEED_VERSION));
    });

    it('returns a store with drawings (seed drawings are injected)', () => {
      const result = loadInitialState();
      expect(result.drawings.length).toBeGreaterThan(0);
    });

    it('returns a currentDrawingId pointing at the first seeded drawing', () => {
      const result = loadInitialState();
      expect(result.currentDrawingId).toBeTruthy();
      const ids = result.drawings.map((d) => d.id);
      expect(ids).toContain(result.currentDrawingId);
    });
  });

  describe('already at current version — no seeds needed', () => {
    beforeEach(() => {
      localStorage.setItem(SEEDED_KEY, String(SEED_VERSION));
      mockLoadStore.mockReturnValue(storeWithDrawing());
    });

    it('does NOT call saveStore (nothing new to persist)', () => {
      loadInitialState();
      expect(mockSaveStore).not.toHaveBeenCalled();
    });

    it('returns the existing drawings list unchanged', () => {
      const existing = storeWithDrawing();
      mockLoadStore.mockReturnValue(existing);
      const result = loadInitialState();
      expect(result.drawings).toEqual(existing.drawings);
    });

    it('preserves the existing currentDrawingId', () => {
      const result = loadInitialState();
      expect(result.currentDrawingId).toBe('user-1');
    });
  });

  describe('partial upgrade — seeded version < SEED_VERSION', () => {
    beforeEach(() => {
      // Simulate user who received an older batch but not the latest.
      localStorage.setItem(SEEDED_KEY, '0');
      mockLoadStore.mockReturnValue(storeWithDrawing());
    });

    it('calls saveStore to persist the new seed batch', () => {
      loadInitialState();
      expect(mockSaveStore).toHaveBeenCalled();
    });

    it('updates SEEDED_KEY to the current SEED_VERSION', () => {
      loadInitialState();
      expect(localStorage.getItem(SEEDED_KEY)).toBe(String(SEED_VERSION));
    });

    it('appends new seed drawings so the returned store has more than before', () => {
      const before = storeWithDrawing().drawings.length;
      const result = loadInitialState();
      expect(result.drawings.length).toBeGreaterThan(before);
    });

    it('preserves the existing user drawings at the start of the list', () => {
      const result = loadInitialState();
      expect(result.drawings[0].id).toBe('user-1');
    });
  });

  describe('loadStore returns empty store (corrupted / missing store fallback)', () => {
    beforeEach(() => {
      // The real loadStore returns empty() — { schemaVersion: 2, drawings: [],
      // currentDrawingId: null } — whenever storage is missing or corrupt.
      // This test verifies loadInitialState handles that gracefully.
      mockLoadStore.mockReturnValue(emptyStore());
    });

    it('does not throw', () => {
      expect(() => loadInitialState()).not.toThrow();
    });

    it('returns a valid store with drawings and a valid currentDrawingId', () => {
      const result = loadInitialState();
      expect(Array.isArray(result.drawings)).toBe(true);
      expect(result.drawings.length).toBeGreaterThan(0);
      const ids = result.drawings.map((d) => d.id);
      expect(ids).toContain(result.currentDrawingId);
    });
  });
});
