/**
 * Undo/redo history state management for the PixelArtEditor, implemented as a
 * pure reducer with no React dependency. The state holds a past stack, a
 * present snapshot, and a future stack. History is capped at HISTORY_LIMIT
 * entries to bound memory usage.
 */

/** Maximum number of past states retained in the undo stack. */
export const HISTORY_LIMIT = 50;

/**
 * Immutable history state shape used with `historyReducer`.
 *
 * - `past` — stack of pixel arrays that can be restored via undo, oldest first.
 * - `present` — the current pixel array.
 * - `future` — stack of pixel arrays that can be restored via redo, most
 *   recent first (i.e. the next redo target is `future[0]`).
 */
export interface HistoryState {
  past: string[][];
  present: string[];
  future: string[][];
}

/**
 * Discriminated union of all actions accepted by `historyReducer`.
 *
 * - `set` — Updates `present` in place without creating a history entry.
 *   Used for intermediate states during a drag gesture so that every mouse
 *   move does not create an undoable step.
 * - `commit` — Pushes the current `present` onto `past`, sets the new
 *   `present`, and clears `future`. This is the action to call when a gesture
 *   completes and should become undoable.
 * - `undo` — Moves `present` to the top of `future` and pops the top of
 *   `past` into `present`. No-ops if `past` is empty.
 * - `redo` — Moves `present` to the bottom of `past` and shifts the top of
 *   `future` into `present`. No-ops if `future` is empty.
 */
export type HistoryAction =
  | { type: 'set'; pixels: string[] }
  | { type: 'commit'; pixels: string[] }
  | { type: 'undo' }
  | { type: 'redo' };

/**
 * Pure reducer for pixel art undo/redo history.
 *
 * The `past` stack is capped at `HISTORY_LIMIT` entries; when the limit is
 * reached the oldest entry is dropped. Any `commit` action clears the `future`
 * stack, making previously undone states unreachable.
 *
 * @param state - Current history state.
 * @param action - Action to apply.
 * @returns New history state (or the same reference if no change was possible,
 *   e.g. undo with an empty past stack).
 */
export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'set':
      return { ...state, present: action.pixels };
    case 'commit': {
      const past = [...state.past, state.present].slice(-HISTORY_LIMIT);
      return { past, present: action.pixels, future: [] };
    }
    case 'undo': {
      if (state.past.length === 0) return state;
      const past = state.past.slice(0, -1);
      const present = state.past[state.past.length - 1];
      const future = [state.present, ...state.future];
      return { past, present, future };
    }
    case 'redo': {
      if (state.future.length === 0) return state;
      const future = state.future.slice(1);
      const present = state.future[0];
      const past = [...state.past, state.present];
      return { past, present, future };
    }
    default:
      return state;
  }
}
