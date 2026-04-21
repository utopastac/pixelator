/**
 * Tests for the pure `historyReducer` — pixel-array undo/redo with a capped
 * past stack. No React, no renderHook; this is just a reducer.
 */
import { describe, expect, it } from 'vitest';
import { HISTORY_LIMIT, historyReducer, type HistoryState } from './pixelArtHistory';

function initialState(present: string[] = []): HistoryState {
  return { past: [], present, future: [] };
}

describe('historyReducer', () => {
  it('set updates present without touching past or future', () => {
    const state: HistoryState = {
      past: [['a']],
      present: ['b'],
      future: [['c']],
    };
    const next = historyReducer(state, { type: 'set', pixels: ['x'] });
    expect(next.present).toEqual(['x']);
    expect(next.past).toBe(state.past);
    expect(next.future).toBe(state.future);
  });

  it('commit pushes current present onto past, sets new present, clears future', () => {
    const state: HistoryState = {
      past: [['a']],
      present: ['b'],
      future: [['redo-me']],
    };
    const next = historyReducer(state, { type: 'commit', pixels: ['c'] });
    expect(next.past).toEqual([['a'], ['b']]);
    expect(next.present).toEqual(['c']);
    expect(next.future).toEqual([]);
  });

  it('commit caps past at HISTORY_LIMIT, dropping the oldest', () => {
    // Seed past with exactly HISTORY_LIMIT entries.
    const seeded: string[][] = Array.from({ length: HISTORY_LIMIT }, (_, i) => [`p${i}`]);
    const state: HistoryState = { past: seeded, present: ['current'], future: [] };
    const next = historyReducer(state, { type: 'commit', pixels: ['new'] });
    expect(next.past).toHaveLength(HISTORY_LIMIT);
    // Oldest ('p0') dropped; 'current' appended at the end.
    expect(next.past[0]).toEqual(['p1']);
    expect(next.past[next.past.length - 1]).toEqual(['current']);
    expect(next.present).toEqual(['new']);
  });

  it('undo moves present onto future and pops past into present', () => {
    const state: HistoryState = {
      past: [['a'], ['b']],
      present: ['c'],
      future: [],
    };
    const next = historyReducer(state, { type: 'undo' });
    expect(next.past).toEqual([['a']]);
    expect(next.present).toEqual(['b']);
    expect(next.future).toEqual([['c']]);
  });

  it('undo is a no-op when past is empty', () => {
    const state = initialState(['x']);
    const next = historyReducer(state, { type: 'undo' });
    expect(next).toBe(state);
  });

  it('redo shifts future[0] into present and appends old present to past', () => {
    const state: HistoryState = {
      past: [['a']],
      present: ['b'],
      future: [['c'], ['d']],
    };
    const next = historyReducer(state, { type: 'redo' });
    expect(next.past).toEqual([['a'], ['b']]);
    expect(next.present).toEqual(['c']);
    expect(next.future).toEqual([['d']]);
  });

  it('redo is a no-op when future is empty', () => {
    const state: HistoryState = { past: [['a']], present: ['b'], future: [] };
    const next = historyReducer(state, { type: 'redo' });
    expect(next).toBe(state);
  });

  it('commit → commit → undo → undo → redo → redo round-trips to the final state', () => {
    let s = initialState(['v0']);
    s = historyReducer(s, { type: 'commit', pixels: ['v1'] });
    s = historyReducer(s, { type: 'commit', pixels: ['v2'] });
    expect(s.present).toEqual(['v2']);
    s = historyReducer(s, { type: 'undo' });
    expect(s.present).toEqual(['v1']);
    s = historyReducer(s, { type: 'undo' });
    expect(s.present).toEqual(['v0']);
    s = historyReducer(s, { type: 'redo' });
    expect(s.present).toEqual(['v1']);
    s = historyReducer(s, { type: 'redo' });
    expect(s.present).toEqual(['v2']);
    expect(s.future).toEqual([]);
  });

  it('a fresh commit after an undo wipes the redo stack', () => {
    let s = initialState(['v0']);
    s = historyReducer(s, { type: 'commit', pixels: ['v1'] });
    s = historyReducer(s, { type: 'commit', pixels: ['v2'] });
    s = historyReducer(s, { type: 'undo' }); // present=v1, future=[v2]
    expect(s.future).toEqual([['v2']]);
    s = historyReducer(s, { type: 'commit', pixels: ['v3'] });
    expect(s.present).toEqual(['v3']);
    expect(s.future).toEqual([]);
  });
});
